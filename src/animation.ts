import { SIZE, type Board, type Tile, type TurnStep } from './game/engine'

const rowOf = (at: number) => Math.floor(at / SIZE)

export type PlacedTile = { id: number; tile: Tile; at: number; row: number; duration?: number }

export function createTileLayout() {
  const ids = new WeakMap<Tile, number>()
  let nextId = 0

  return {
    place: (board: Board): PlacedTile[] => board.map((tile, at) => {
      const id = ids.get(tile) ?? nextId++
      ids.set(tile, id)
      return { id, tile, at, row: rowOf(at) }
    }),
    carry: (tile: Tile, id: number) => ids.set(tile, id),
  }
}

type ClearEffect = {
  cells: number[]
  at: number
  points: number
  activated: boolean
  activations: { at: number; special: NonNullable<Tile['special']> }[]
}

export type Frame = {
  tiles: PlacedTile[]
  duration: number
  score: number
  chain: number
  effect?: ClearEffect
  motion?: 'revert' | 'drop'
  lifting?: boolean
}

function popupCell(cells: number[]) {
  const row = cells.reduce((sum, at) => sum + rowOf(at), 0) / cells.length
  const col = cells.reduce((sum, at) => sum + at % SIZE, 0) / cells.length
  const distance = (at: number) => (rowOf(at) - row) ** 2 + (at % SIZE - col) ** 2
  return cells.reduce((closest, at) => distance(at) < distance(closest) ? at : closest)
}

export function animateTurn(
  steps: TurnStep[],
  layout: ReturnType<typeof createTileLayout>,
  tiles: PlacedTile[],
  score: number,
): Frame[] {
  const frames: Frame[] = []
  let chain = 0
  let effect: ClearEffect | undefined

  for (const step of steps) {
    if (step.kind === 'clear') {
      const activations = step.activated.flatMap(at => {
        const special = tiles[at].tile.special
        return special ? [{ at, special }] : []
      })
      if (step.replacements.size) {
        tiles = tiles.map(gem => {
          const tile = step.replacements.get(gem.at)
          if (!tile) return gem
          layout.carry(tile, gem.id)
          return { ...gem, tile }
        })
      }
      score += step.points
      chain = step.chain
      effect = {
        cells: step.cells, at: popupCell(step.cells), points: step.points,
        activated: step.activated.length > 0, activations,
      }
      frames.push({ tiles, duration: 175, score, chain, effect })
      continue
    }

    const next = layout.place(step.board)
    const previous = new Map(tiles.map(gem => [gem.id, gem]))
    if (step.kind === 'drop') {
      const arrivals = Array<number>(SIZE).fill(0)
      for (const gem of next) {
        if (!previous.has(gem.id)) arrivals[gem.at % SIZE]++
      }

      // Mount refills above the board for one paint before transitioning to their cells.
      const entry = next.map(gem => ({
        ...gem,
        row: previous.get(gem.id)?.row ?? gem.row - arrivals[gem.at % SIZE],
      }))
      frames.push({ tiles: entry, duration: 0, score, chain, effect, lifting: true })
      const falling = next.map((gem, i) => ({
        ...gem,
        duration: gem.row === entry[i].row ? 0 : 145 + 30 * (gem.row - entry[i].row),
      }))
      frames.push({
        tiles: falling, duration: Math.max(210, ...falling.map(gem => gem.duration)),
        score, chain, effect, lifting: true, motion: 'drop',
      })
      effect = undefined
    } else {
      const duration = step.kind === 'reshuffle' ? 260 : step.kind === 'revert' ? 230 : 155
      frames.push({
        tiles: next.map(gem => ({ ...gem, duration: previous.get(gem.id)?.at === gem.at ? 0 : duration })),
        duration, score, chain, motion: step.kind === 'revert' ? 'revert' : undefined,
      })
    }
    tiles = next
  }
  return frames
}
