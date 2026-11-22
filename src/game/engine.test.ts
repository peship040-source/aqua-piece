import { describe, expect, it } from 'vitest'
import {
  createBoard, findRuns, hasMove, play, playWithSteps, resolve, seededRng, stage, stageFor, status,
  type Board, type Game, type Tile,
} from './engine'
import { earnedStars, STAGES, stageDef } from './stages'

const tile = (color: number, special?: Tile['special']): Tile => ({ color, special })
const pattern = (): Board => Array.from({ length: 64 }, (_, i) => tile((Math.floor(i / 8) + i % 8) % 6))
const gameWith = (board: Board): Game => ({
  board, moves: 30, score: 0, goal: 1000, stageId: 1, collected: [0, 0, 0, 0, 0, 0],
})
const refill = (...colors: number[]) => () => {
  const color = colors.shift()
  if (color === undefined) throw new Error('Unexpected refill')
  return (color + 0.5) / 6
}

describe('board generation', () => {
  it('generates reproducible 8×8 boards with six possible colors and a legal move', () => {
    for (let seed = 0; seed < 24; seed++) {
      const board = createBoard(seededRng(seed))
      expect(board).toEqual(createBoard(seededRng(seed)))
      expect(board).toHaveLength(64)
      expect(new Set(board.map(({ color }) => color)).size).toBe(6)
      expect(findRuns(board)).toHaveLength(0)
      expect(hasMove(board)).toBe(true)
    }
  })

  it('still supplies a playable board with constant randomness', () => {
    const board = createBoard(() => 0)
    expect(findRuns(board)).toHaveLength(0)
    expect(hasMove(board)).toBe(true)
  })
})

describe('swaps and clears', () => {
  it('rejects nonmatching, nonadjacent, and out-of-bounds swaps for free', () => {
    const game = gameWith(pattern())
    for (const [from, to] of [[0, 1], [7, 8], [0, 9], [-1, 0]]) {
      expect(play(game, from, to, seededRng(5))).toEqual({ game, chain: 0, reshuffled: false })
    }
  })

  it('records a swap and its reversal without consuming randomness on rejection', () => {
    const game = gameWith(pattern())
    const result = playWithSteps(game, 0, 1, refill())
    expect(result.game).toBe(game)
    expect(result.steps).toEqual([
      { kind: 'swap', board: [game.board[1], game.board[0], ...game.board.slice(2)] },
      { kind: 'revert', board: game.board },
    ])
    expect(playWithSteps(game, 7, 8, refill()).steps).toEqual([])
  })

  it('records each clear and drop in chain order while preserving tile identity', () => {
    const board = pattern()
    for (const i of [56, 57, 59]) board[i] = tile(0)
    const game = gameWith(board)
    const random = () => refill(5, 5, 5, 0, 1, 2)
    const { steps, ...result } = playWithSteps(game, 58, 59, random())
    expect(result).toEqual(play(game, 58, 59, random()))
    expect(steps.map(step => step.kind)).toEqual(['swap', 'clear', 'drop', 'clear', 'drop'])
    const [swap, clear, drop, nextClear, finalDrop] = steps
    expect(swap).toMatchObject({ board: { 58: board[59], 59: board[58] } })
    expect(clear).toMatchObject({ cells: [56, 57, 58], activated: [], chain: 1, points: 30 })
    if (drop.kind !== 'drop' || finalDrop.kind !== 'drop') throw new Error('Expected drop snapshots')
    expect(drop.board[56]).toBe(board[48])
    expect(board).not.toContain(drop.board[0])
    expect(nextClear).toMatchObject({ cells: [0, 1, 2], activated: [], chain: 2, points: 60 })
    expect(finalDrop.board).toBe(result.game.board)
    expect(result.game.score).toBe(90)
  })

  it('applies gravity and scores two clear steps at their own multipliers', () => {
    const board = pattern()
    for (const i of [56, 57, 58]) board[i] = tile(0)
    const result = resolve(board, refill(5, 5, 5, 0, 1, 2))
    expect(result.score).toBe(90)
    expect(result.chain).toBe(2)
    expect(result.board.slice(8, 11).map(t => t.color)).toEqual([0, 1, 2])
    expect(result.board.slice(56, 59).map(t => t.color)).toEqual([0, 1, 2])
    expect(findRuns(result.board)).toHaveLength(0)
    expect(board[57].color).toBe(0)
  })

  it('creates a horizontal LINE at the swap origin and spends one move', () => {
    const board = pattern()
    for (const i of [0, 1, 3, 10]) board[i] = tile(0)
    const result = play(gameWith(board), 2, 10, refill(1, 2, 3))
    expect(result.game.moves).toBe(29)
    expect(result.game.score).toBe(30)
    expect(result.game.board[2]).toEqual(tile(0, 'line-row'))
  })

  it('creates a vertical LINE for a vertical four', () => {
    const board = pattern()
    for (const i of [0, 8, 16, 24]) board[i] = tile(0)
    const result = resolve(board, seededRng(8))
    expect(result.board.some(t => t.special === 'line-column')).toBe(true)
  })

  it('activates an existing special before replacing it at the swap origin', () => {
    const board = pattern()
    for (const i of [0, 1, 3]) board[i] = tile(0)
    board[10] = tile(0, 'line-row')
    const result = play(gameWith(board), 2, 10, refill(1, 2, 3, 4, 5, 0, 1))
    expect(result.game.board[2]).toEqual(tile(0, 'line-row'))
    expect(result.game.score).toBe(70)
  })

  it('reports triggered specials and the replacements that survive a clear', () => {
    const board = pattern()
    for (const i of [0, 1, 3]) board[i] = tile(0)
    board[10] = tile(0, 'line-row')
    const { steps } = playWithSteps(gameWith(board), 2, 10, refill(1, 2, 3, 4, 5, 0, 1))
    expect(steps[1]).toMatchObject({
      kind: 'clear', activated: [2], points: 70,
      replacements: new Map([[2, tile(0, 'line-row')]]),
    })
  })

  it.each([
    [[0, 1, 2, 3, 4, 10, 18], 'color'],
    [[0, 1, 2, 8, 16], 'burst'],
    [[0, 1, 2, 9, 17], 'burst'],
    [[0, 1, 2, 3, 9, 17], 'burst'],
  ] as const)('creates the highest priority special for the run at %j', (cells, special) => {
    const board = pattern()
    for (const i of cells) board[i] = tile(0)
    const result = resolve(board, seededRng(8))
    expect(result.board.filter(t => t.special).map(t => t.special)).toEqual([special])
  })

  it.each([
    [27, 'line-row', 80],
    [27, 'line-column', 80],
    [27, 'burst', 90],
    [0, 'burst', 60],
    [27, 'color', 130],
  ] as const)('activates a swapped special at %i (%s) even without a match', (index, special, points) => {
    const board = pattern()
    board[index] = tile(board[index].color, special)
    const result = play(gameWith(board), index, index + 1, seededRng(42))
    expect(result.game.moves).toBe(29)
    expect(result.game.score).toBe(points)
    expect(result.game.board.filter(t => t.special === special)).toHaveLength(0)
  })

  it('activates a special caught by a match and counts overlapping cells once', () => {
    const board = pattern()
    board[56] = tile(0)
    board[57] = tile(0, 'line-row')
    board[58] = tile(0)
    const result = resolve(board, refill(0, 1, 2, 3, 4, 5, 0, 1))
    expect(result.score).toBe(80)
    expect(result.chain).toBe(1)
  })
})

describe('Stage 1', () => {
  it('starts with 30 moves and a 1000-point goal', () => {
    expect(stage(seededRng(1))).toMatchObject({ score: 0, moves: 30, goal: 1000 })
  })

  it('automatically reshuffles after a move produces a dead board', () => {
    const board = pattern()
    board[56] = tile(0)
    board[57] = tile(0)
    board[58] = tile(0)
    const columns = pattern()
    for (const col of [0, 1, 2]) {
      for (let row = 0; row < 7; row++) board[row * 8 + col] = columns[(row + 1) * 8 + col]
    }
    board[59] = board[58]
    board[58] = columns[59]
    const nextColor = () => {
      const colors = [0, 1, 2]
      const random = seededRng(42)
      return () => colors.length ? (colors.shift()! + 0.5) / 6 : random()
    }
    const game = { ...gameWith(board), moves: 12, score: 340 }
    const result = play(game, 59, 58, nextColor())
    expect(result).toMatchObject({ game: { moves: 11, score: 370 }, chain: 1, reshuffled: true })
    expect(findRuns(result.game.board)).toHaveLength(0)
    expect(hasMove(result.game.board)).toBe(true)
    const { steps, ...animated } = playWithSteps(game, 59, 58, nextColor())
    expect(animated).toEqual(result)
    expect(steps.map(step => step.kind)).toEqual(['swap', 'clear', 'drop', 'reshuffle'])
    expect(steps.at(-1)).toEqual({ kind: 'reshuffle', board: animated.game.board })
  })

  it('wins at the goal even on the last move and otherwise loses at zero moves', () => {
    const game = gameWith(pattern())
    expect(status(game)).toBe('playing')
    expect(status({ ...game, score: 1000, moves: 0 })).toBe('won')
    expect(status({ ...game, score: 999, moves: 0 })).toBe('lost')
    expect(play({ ...game, moves: 0 }, 0, 1, seededRng(1)).game.moves).toBe(0)
  })
})

describe('stage goals and rewards', () => {
  it.each(STAGES)('initializes stage $id from its definition', def => {
    expect(stageDef(def.id)).toBe(def)
    expect(stageFor(def, seededRng(1))).toMatchObject({
      stageId: def.id, moves: def.moves, goal: def.target, score: 0, collected: [0, 0, 0, 0, 0, 0],
    })
  })

  it('wins a collect goal on the last move using cumulative clears across cascades', () => {
    const board = pattern()
    for (const i of [56, 57, 59]) board[i] = tile(0)
    const game = { ...gameWith(board), goal: 18, stageId: 2, moves: 1, score: 2500,
      collected: [15, 1, 0, 0, 0, 0] }
    expect(status(game)).toBe('playing')
    expect(status({ ...game, moves: 0 })).toBe('lost')
    const result = play(game, 58, 59, refill(5, 5, 5, 0, 1, 2))
    expect(result.game.collected).toEqual([18, 1, 0, 0, 0, 3])
    expect(game.collected).toEqual([15, 1, 0, 0, 0, 0])
    expect(result.game.moves).toBe(0)
    expect(status(result.game)).toBe('won')
  })

  it('counts unique clears from a special and excludes the surviving replacement', () => {
    const board = pattern()
    for (const i of [0, 1, 3]) board[i] = tile(0)
    board[2] = tile(0, 'line-row')
    const result = resolve(board, refill(1, 2, 3, 4, 5, 0, 1), [2, 10])
    expect(result.clearedByColor).toEqual([4, 1, 0, 0, 1, 1])
  })

  it('uses an explicit definition and awards bonus stars at inclusive score thresholds', () => {
    const def = STAGES[3]
    const game = { ...gameWith(pattern()), collected: [30, 24, 0, 0, 0, 0], score: 3000 }
    expect(status(game, def)).toBe('playing')
    expect(earnedStars(def, game)).toBe(0)
    const won = { ...game, collected: [30, 25, 0, 0, 0, 0] }
    expect(earnedStars(def, { ...won, score: 1799 })).toBe(1)
    expect(earnedStars(def, { ...won, score: 1800 })).toBe(2)
    expect(earnedStars(def, { ...won, score: 2400 })).toBe(3)
  })
})
