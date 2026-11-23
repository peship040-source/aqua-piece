import { expect, it, vi } from 'vitest'
import { seededRng, stage, stageFor } from './engine'
import { ENDLESS_DEF, STAGES } from './stages'
import { decodeSave, loadSave, recordClear, SAVE_KEY, storeSave, type Save } from '../save'

const game = { ...stage(seededRng(14)), moves: 20, score: 350 }
const { stageId, collected, ...legacyGame } = game
const legacy = { version: 1, seed: 14, best: 460, game: legacyGame }
const snapshot: Save = {
  version: 5,
  progress: { unlocked: 1, stars: {}, best: { 1: 460 }, endlessBest: 0, ocean: {}, collection: [] },
  current: { seed: 14, game },
}

it('round-trips a versioned save with current progress and best score', () => {
  expect(decodeSave(JSON.stringify(snapshot))).toEqual(snapshot)
})

it('rejects malformed saves and unsupported versions', () => {
  for (const raw of [
    null, '{', 'null', '{}', JSON.stringify({ ...legacy, version: 2 }),
    JSON.stringify({ ...legacy, game: { ...legacyGame, board: [null] } }),
    JSON.stringify({ ...legacy, game: { ...legacyGame, moves: -1 } }),
    JSON.stringify({ ...snapshot, current: { seed: 14, game: { ...game, collected: [0] } } }),
    JSON.stringify({ ...snapshot, progress: { ...snapshot.progress, stars: { 1: 4 } } }),
    JSON.stringify({ ...snapshot, progress: { ...snapshot.progress, collection: undefined } }),
    JSON.stringify({ ...snapshot, progress: { ...snapshot.progress, collection: ['unknown'] } }),
    JSON.stringify({ ...snapshot, progress: { ...snapshot.progress, collection: ['starfish', 'starfish'] } }),
  ]) {
    expect(decodeSave(raw)).toBeNull()
  }
})

it('migrates a v1 save with its existing board, seed, and stage 1 best', () => {
  expect(decodeSave(JSON.stringify(legacy))).toEqual(snapshot)
})

it('preserves the best score from a completed v1 game', () => {
  const finished = { ...legacy, game: { ...legacyGame, moves: 0 } }
  expect(decodeSave(JSON.stringify(finished))).toEqual({ ...snapshot, current: null })
})

it('backfills v2 rewards for stages with positive stars and preserves progress', () => {
  const oldSave = {
    version: 2,
    progress: { unlocked: 5, stars: { 4: 2, 1: 3, 2: 0, 5: 1 }, best: { 1: 1800, 2: 900, 4: 1800, 5: 2200 } },
    current: { seed: 14, game: stageFor(STAGES[4], seededRng(14)) },
  }
  expect(decodeSave(JSON.stringify(oldSave))).toEqual({
    ...oldSave,
    version: 5,
    progress: { ...oldSave.progress, endlessBest: 0, ocean: {}, collection: ['seaglass-green', 'seaglass-blue', 'pearl-oyster'] },
  })
})

it('keeps a collect-stage snapshot with a high score and an unfinished color goal', () => {
  const game = { ...stageFor(STAGES[1], seededRng(14)), score: 2100, collected: [17, 3, 0, 0, 0, 0] }
  const save: Save = {
    version: 5,
    progress: { unlocked: 2, stars: { 1: 2 }, best: { 1: 1500 }, endlessBest: 0, ocean: {}, collection: ['seaglass-green'] },
    current: { seed: 14, game },
  }
  expect(decodeSave(JSON.stringify(save))).toEqual(save)
  expect(decodeSave(JSON.stringify({ ...save, current: null }))).toEqual({ ...save, current: null })
})

it('loads and stores v5 with the widget-style in-memory storage shim', () => {
  const storage = new Map([[SAVE_KEY, JSON.stringify(legacy)]])
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  })
  try {
    expect(loadSave()).toEqual(snapshot)
    storeSave(snapshot)
    expect(JSON.parse(storage.get('aqua-piece-v1')!)).toEqual(snapshot)
    expect(loadSave()).toEqual(snapshot)
    storage.set(SAVE_KEY, '{')
    expect(loadSave()).toEqual({ version: 5, progress: { unlocked: 1, stars: {}, best: {}, endlessBest: 0, ocean: {}, collection: [] }, current: null })
  } finally {
    vi.unstubAllGlobals()
  }
})

it('records a clear without lowering previous bests or mutating progress', () => {
  const collection = ['seaglass-green', 'coral-shell']
  const progress = { endlessBest: 2750, ocean: {}, unlocked: 2, stars: { 1: 3, 2: 3 }, best: { 1: 1800, 2: 1600 }, collection }
  const won = { ...game, stageId: 2, collected: [18, 0, 0, 0, 0, 0], score: 1750 }
  const updated = recordClear(progress, STAGES[1], won)
  expect(updated).toEqual({ unlocked: 3, stars: { 1: 3, 2: 3 }, best: { 1: 1800, 2: 1750 }, endlessBest: 2750, ocean: {}, collection: ['seaglass-green', 'coral-shell'] })
  expect(progress).toEqual({ unlocked: 2, stars: { 1: 3, 2: 3 }, best: { 1: 1800, 2: 1600 }, endlessBest: 2750, ocean: {}, collection: ['seaglass-green', 'coral-shell'] })
  expect(recordClear(updated, STAGES[0], { ...game, score: 1000 })).toEqual(updated)
})

it('unlocks stage 6 and records stars and a reward for a first clear of stage 5', () => {
  const progress = { unlocked: 5, stars: {}, best: {}, endlessBest: 0, ocean: {}, collection: ['seaglass-green'] }
  const updated = recordClear(progress, STAGES[4], { ...game, score: 3200 })
  expect(updated).toEqual({
    unlocked: 6, stars: { 5: 3 }, best: { 5: 3200 }, endlessBest: 0, ocean: {}, collection: ['seaglass-green', 'pearl-oyster'],
  })
  expect(progress.collection).toEqual(['seaglass-green'])
})

it('caps unlocks at stage 10 and preserves its collectible in a v5 save', () => {
  const def = STAGES[9]
  const progress = recordClear({ unlocked: 10, stars: {}, best: {}, endlessBest: 0, ocean: {}, collection: [] }, def, {
    ...stageFor(def, seededRng(14)), score: 3000, collected: [0, 0, 0, 0, 0, 32],
  })
  expect(progress).toEqual({ unlocked: 10, stars: { 10: 3 }, best: { 10: 3000 }, endlessBest: 0, ocean: {}, collection: ['sea-turtle'] })
  const save: Save = { version: 5, progress, current: { seed: 14, game: stageFor(def, seededRng(14)) } }
  expect(decodeSave(JSON.stringify(save))).toEqual(save)
})

it('migrates v3 saves with their collection and current stage intact', () => {
  const progress = { unlocked: 2, stars: { 1: 2 }, best: { 1: 1650 }, collection: ['seaglass-green'] }
  const oldSave = { ...snapshot, version: 3, progress }
  expect(decodeSave(JSON.stringify(oldSave))).toEqual({
    ...snapshot, progress: { ...progress, endlessBest: 0, ocean: {} },
  })
})

it('migrates v4 saves with an empty ocean and preserves existing progress', () => {
  const progress = { unlocked: 2, stars: { 1: 2 }, best: { 1: 1650 }, collection: ['seaglass-green'], endlessBest: 2450 }
  const oldSave = { ...snapshot, version: 4, progress }
  expect(decodeSave(JSON.stringify(oldSave))).toEqual({
    ...snapshot, progress: { ...progress, ocean: {} },
  })
})

it('round-trips v5 placements independently of the collection', () => {
  const progress = {
    ...snapshot.progress,
    collection: ['seaglass-green', 'coral-shell'],
    ocean: { 'seaglass-green': { x: .25, y: .8 }, starfish: { x: 0, y: 1 } },
  }
  const save = { ...snapshot, progress }
  expect(decodeSave(JSON.stringify(save))).toEqual(save)
})

it('rejects invalid v5 ocean data', () => {
  for (const ocean of [
    undefined, null, [], 'ocean', { unknown: { x: .5, y: .5 } },
    { starfish: null }, { starfish: { x: .5 } }, { starfish: { x: '0.5', y: .5 } },
    { starfish: { x: -.01, y: .5 } }, { starfish: { x: .5, y: 1.01 } },
  ]) {
    expect(decodeSave(JSON.stringify({ ...snapshot, progress: { ...snapshot.progress, ocean } }))).toBeNull()
  }
  const save = JSON.stringify({ ...snapshot, progress: { ...snapshot.progress, ocean: { starfish: { x: null, y: .5 } } } })
  expect(decodeSave(save.replace('"x":null', '"x":1e309'))).toBeNull()
})

it('validates the endless best in v5 saves', () => {
  const current = { ...snapshot, progress: { ...snapshot.progress, endlessBest: 2450 } }
  expect(decodeSave(JSON.stringify(current))).toEqual(current)
  for (const endlessBest of [undefined, null, -1, 2.5, '2450', Number.MAX_SAFE_INTEGER + 1]) {
    expect(decodeSave(JSON.stringify({ ...snapshot, progress: { ...snapshot.progress, endlessBest } }))).toBeNull()
  }
})

it('rejects an endless run in the current slot', () => {
  const current = { seed: 14, game: stageFor(ENDLESS_DEF, seededRng(14)) }
  expect(decodeSave(JSON.stringify({ ...snapshot, current }))).toBeNull()
})
