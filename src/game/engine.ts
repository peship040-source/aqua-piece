import { goalReached, STAGES, stageDef, type StageDef } from './stages'

export const SIZE = 8
export const COLORS = 6
export const MOVES = STAGES[0].moves
export const GOAL = STAGES[0].target

type Axis = 'row' | 'column'
type Special = 'line-row' | 'line-column' | 'burst' | 'color'
export type Tile = { color: number; special?: Special }
export type Board = Tile[]
export type Rng = () => number
export type Game = {
  board: Board
  moves: number
  score: number
  goal: number
  collected: number[]
  stageId: number
}
type Run = { axis: Axis; cells: number[] }
type ClearStep = {
  kind: 'clear'
  cells: number[]
  activated: number[]
  replacements: ReadonlyMap<number, Tile>
  chain: number
  points: number
}
export type TurnStep =
  | { kind: 'swap' | 'revert' | 'drop' | 'reshuffle'; board: Board }
  | ClearStep
type RecordStep = (step: TurnStep) => void

const steps = { row: 1, column: SIZE } as const
const priority = { 'line-row': 1, 'line-column': 1, burst: 2, color: 3 }
const row = (i: number) => Math.floor(i / SIZE)
const col = (i: number) => i % SIZE
const inside = (i: number) => Number.isInteger(i) && i >= 0 && i < SIZE * SIZE
export const adjacent = (a: number, b: number) =>
  inside(a) && inside(b) && Math.abs(row(a) - row(b)) + Math.abs(col(a) - col(b)) === 1

export function seededRng(seed: number): Rng {
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0
    let value = Math.imul(seed ^ (seed >>> 15), seed | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 2 ** 32
  }
}

function runAt(board: Board, at: number, axis: Axis): number[] {
  const step = steps[axis]
  const coordinate = axis === 'row' ? col : row
  const color = board[at].color
  let start = at
  while (coordinate(start) > 0 && board[start - step].color === color) start -= step
  const cells = [start]
  while (coordinate(start) < SIZE - 1 && board[start + step].color === color) {
    start += step
    cells.push(start)
  }
  return cells
}

export function findRuns(board: Board): Run[] {
  const runs: Run[] = []
  for (let at = 0; at < board.length; at++) {
    for (const axis of ['row', 'column'] as const) {
      const coordinate = axis === 'row' ? col : row
      const step = steps[axis]
      if (coordinate(at) > 0 && board[at - step].color === board[at].color) continue
      const cells = runAt(board, at, axis)
      if (cells.length >= 3) runs.push({ axis, cells })
    }
  }
  return runs
}

const matchesAt = (board: Board, at: number) =>
  runAt(board, at, 'row').length >= 3 || runAt(board, at, 'column').length >= 3

function exchange(board: Board, a: number, b: number) {
  const tile = board[a]
  board[a] = board[b]
  board[b] = tile
}

export function hasMove(board: Board): boolean {
  if (board.some(tile => tile.special)) return true
  const probe = [...board]
  for (let a = 0; a < probe.length; a++) {
    for (const b of [a + 1, a + SIZE]) {
      if (!adjacent(a, b) || probe[a].color === probe[b].color) continue
      exchange(probe, a, b)
      const valid = matchesAt(probe, a) || matchesAt(probe, b)
      exchange(probe, a, b)
      if (valid) return true
    }
  }
  return false
}

export function createBoard(random: Rng): Board {
  for (let attempt = 0; attempt < 32; attempt++) {
    const board: Board = []
    for (let at = 0; at < SIZE * SIZE; at++) {
      const available = Array.from({ length: COLORS }, (_, color) => color).filter(color =>
        !(col(at) >= 2 && board[at - 1].color === color && board[at - 2].color === color) &&
        !(row(at) >= 2 && board[at - SIZE].color === color && board[at - 2 * SIZE].color === color),
      )
      board.push({ color: available[Math.floor(random() * available.length)] })
    }
    if (new Set(board.map(tile => tile.color)).size === COLORS && hasMove(board)) return board
  }
  // A fixed playable pattern guarantees a start even for a degenerate injected RNG.
  const board = Array.from({ length: SIZE * SIZE }, (_, at) => ({ color: (row(at) + col(at)) % COLORS }))
  board[1] = { color: 0 }
  board[SIZE + 2] = { color: 0 }
  return board
}

function reshuffle(board: Board, random: Rng): Board {
  for (let attempt = 0; attempt < 32; attempt++) {
    const shuffled = [...board]
    for (let i = shuffled.length - 1; i > 0; i--) {
      exchange(shuffled, i, Math.floor(random() * (i + 1)))
    }
    if (!findRuns(shuffled).length && hasMove(shuffled)) return shuffled
  }
  return createBoard(random)
}

function matchGroups(runs: Run[]): Run[][] {
  const groups: Run[][] = []
  for (const run of runs) {
    const group = [run]
    for (let i = groups.length - 1; i >= 0; i--) {
      if (groups[i].some(other => other.cells.some(at => run.cells.includes(at)))) {
        group.push(...groups.splice(i, 1)[0])
      }
    }
    groups.push(group)
  }
  return groups
}

function matchSpecial(group: Run[]): Special | undefined {
  if (group.some(run => run.cells.length >= 5)) return 'color'
  if (group.length > 1) return 'burst'
  if (group[0].cells.length === 4) return group[0].axis === 'row' ? 'line-row' : 'line-column'
}

function affected(board: Board, at: number, target: number): number[] {
  return board.flatMap((tile, i) => {
    switch (board[at].special) {
      case 'color': return tile.color === target ? [i] : []
      case 'burst': return Math.abs(row(at) - row(i)) <= 1 && Math.abs(col(at) - col(i)) <= 1 ? [i] : []
      case 'line-row': return row(at) === row(i) ? [i] : []
      case 'line-column': return col(at) === col(i) ? [i] : []
      default: return []
    }
  })
}

function drop(board: Board, clear: Set<number>, replacements: Map<number, Tile>, random: Rng): Board {
  const next = [...board]
  for (let c = 0; c < SIZE; c++) {
    let write = (SIZE - 1) * SIZE + c
    for (let at = write; at >= 0; at -= SIZE) {
      if (clear.has(at)) continue
      next[write] = replacements.get(at) ?? board[at]
      write -= SIZE
    }
    for (; write >= 0; write -= SIZE) next[write] = { color: Math.floor(random() * COLORS) }
  }
  return next
}

export function resolve(initial: Board, random: Rng, swapped?: [number, number]) {
  return resolveBoard(initial, random, swapped)
}

function resolveBoard(initial: Board, random: Rng, swapped?: [number, number], record?: RecordStep) {
  let board = initial
  let score = 0
  let chain = 0
  const clearedByColor = Array<number>(COLORS).fill(0)
  const swapTargets = new Map<number, number>()
  if (swapped) {
    const [from, to] = swapped
    if (board[from].special) swapTargets.set(from, board[to].color)
    if (board[to].special) swapTargets.set(to, board[from].color)
  }

  while (true) {
    const clear = new Set<number>(swapTargets.keys())
    const replacements = new Map<number, Tile>()
    for (const group of matchGroups(findRuns(board))) {
      const cells = [...new Set(group.flatMap(run => run.cells))]
      cells.forEach(at => clear.add(at))
      const special = matchSpecial(group)
      if (!special) continue
      const at = swapped?.find(i => cells.includes(i)) ?? cells[0]
      replacements.set(at, { color: board[at].color, special })
    }
    if (!clear.size) break

    const activated = new Set<number>()
    const rank = (at: number) => {
      const special = board[at].special
      return special ? priority[special] : 0
    }
    while (true) {
      const next = [...clear].filter(at => !activated.has(at) && board[at].special)
        .sort((a, b) => rank(b) - rank(a))[0]
      if (next === undefined) break
      activated.add(next)
      affected(board, next, swapTargets.get(next) ?? board[next].color).forEach(at => clear.add(at))
    }

    swapTargets.clear()
    swapped = undefined
    replacements.forEach((_, at) => clear.delete(at))
    for (const at of clear) clearedByColor[board[at].color]++
    chain++
    const points = clear.size * 10 * chain
    score += points
    record?.({ kind: 'clear', cells: [...clear], activated: [...activated], replacements, chain, points })
    // A constant test RNG can repeat the same match forever.
    if (chain === 32) random = seededRng(score)
    board = drop(board, clear, replacements, random)
    record?.({ kind: 'drop', board })
  }
  return { board, score, chain, clearedByColor }
}

export function stageFor(def: StageDef, random: Rng): Game {
  return {
    board: createBoard(random), moves: def.moves, score: 0, goal: def.target,
    stageId: def.id, collected: Array<number>(COLORS).fill(0),
  }
}

export function stage(random: Rng): Game {
  return stageFor(STAGES[0], random)
}

export function status(game: Game, def = stageDef(game.stageId)): 'playing' | 'won' | 'lost' {
  if (def ? goalReached(def, game) : game.score >= game.goal) return 'won'
  return game.moves === 0 ? 'lost' : 'playing'
}

export function play(game: Game, from: number, to: number, random: Rng) {
  return playTurn(game, from, to, random)
}

// Snapshots preserve surviving Tile objects so the renderer can track them across cells.
export function playWithSteps(game: Game, from: number, to: number, random: Rng) {
  const steps: TurnStep[] = []
  return { ...playTurn(game, from, to, random, step => steps.push(step)), steps }
}

function playTurn(game: Game, from: number, to: number, random: Rng, record?: RecordStep) {
  const rejected = { game, chain: 0, reshuffled: false }
  if (status(game) !== 'playing' || !adjacent(from, to)) return rejected
  const board = [...game.board]
  exchange(board, from, to)
  record?.({ kind: 'swap', board })
  if (!board[from].special && !board[to].special && !matchesAt(board, from) && !matchesAt(board, to)) {
    record?.({ kind: 'revert', board: game.board })
    return rejected
  }

  const result = resolveBoard(board, random, [from, to], record)
  const next = {
    ...game, board: result.board, moves: game.moves - 1, score: game.score + result.score,
    collected: game.collected.map((count, color) => count + result.clearedByColor[color]),
  }
  const reshuffled = status(next) === 'playing' && !hasMove(next.board)
  if (reshuffled) {
    next.board = reshuffle(next.board, random)
    record?.({ kind: 'reshuffle', board: next.board })
  }
  return { game: next, chain: result.chain, reshuffled }
}
