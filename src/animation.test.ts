import { expect, it } from 'vitest'
import { animateTurn, createTileLayout } from './animation'
import { playWithSteps, seededRng, stage } from './game/engine'

it('keeps gem IDs across swap and revert frames', () => {
  const game = stage(seededRng(11))
  const layout = createTileLayout()
  const tiles = layout.place(game.board)
  // Find an invalid adjacent move on this deterministic starting board.
  const pair = tiles.find(({ at }) => at % 8 < 7 &&
    playWithSteps(game, at, at + 1, seededRng(12)).game === game)!
  const turn = playWithSteps(game, pair.at, pair.at + 1, seededRng(12))
  const [swap, revert] = animateTurn(turn.steps, layout, tiles, game.score)

  expect(swap.tiles[pair.at].id).toBe(tiles[pair.at + 1].id)
  expect(swap.tiles[pair.at + 1].id).toBe(pair.id)
  expect(revert.tiles.map(gem => gem.id)).toEqual(tiles.map(gem => gem.id))
  expect(revert.motion).toBe('revert')
})

it('tracks surviving gems and starts refills above the board with distance-based timing', () => {
  const game = stage(seededRng(11))
  game.board[8] = { ...game.board[8], special: 'burst' }
  const layout = createTileLayout()
  const tiles = layout.place(game.board)
  const turn = playWithSteps(game, 8, 16, seededRng(12))
  const [swap, clear, entry, fall] = animateTurn(turn.steps, layout, tiles, game.score)
  const previous = new Set(clear.tiles.map(gem => gem.id))
  const arrivals = entry.tiles.filter(gem => !previous.has(gem.id))
  const survivor = swap.tiles[0]

  expect(swap.tiles[16].id).toBe(tiles[8].id)
  expect(clear.effect).toMatchObject({ activated: true, points: 60 })
  expect(clear.score).toBe(60)
  expect(arrivals).toHaveLength(6)
  expect(arrivals.every(gem => gem.row < 0)).toBe(true)
  expect(fall.tiles[24]).toMatchObject({ id: survivor.id, row: 3, duration: 235 })
  expect(fall.tiles[24].duration).toBeGreaterThan(fall.tiles[24 + 2].duration!)
  expect(fall.tiles.map(gem => gem.id)).toEqual(entry.tiles.map(gem => gem.id))
  expect(fall.motion).toBe('drop')
})
