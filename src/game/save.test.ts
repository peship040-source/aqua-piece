import { expect, it, vi } from 'vitest'
import { seededRng, stage, stageFor } from './engine'
import { STAGES } from './stages'
import { decodeSave, loadSave, recordClear, SAVE_KEY, storeSave, type Save } from '../save'

const game = { ...stage(seededRng(14)), moves: 20, score: 350 }
const { stageId, collected, ...legacyGame } = game
const legacy = { version: 1, seed: 14, best: 460, game: legacyGame }
const snapshot: Save = {
  version: 2,
  progress: { unlocked: 1, stars: {}, best: { 1: 460 } },
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

it('keeps a collect-stage snapshot with a high score and an unfinished color goal', () => {
  const game = { ...stageFor(STAGES[1], seededRng(14)), score: 2100, collected: [17, 3, 0, 0, 0, 0] }
  const save: Save = {
    version: 2,
    progress: { unlocked: 2, stars: { 1: 2 }, best: { 1: 1500 } },
    current: { seed: 14, game },
  }
  expect(decodeSave(JSON.stringify(save))).toEqual(save)
  expect(decodeSave(JSON.stringify({ ...save, current: null }))).toEqual({ ...save, current: null })
})

it('loads and stores v2 with the widget-style in-memory storage shim', () => {
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
    expect(loadSave()).toEqual({ version: 2, progress: { unlocked: 1, stars: {}, best: {} }, current: null })
  } finally {
    vi.unstubAllGlobals()
  }
})

it('records a clear without lowering previous bests or mutating progress', () => {
  const progress = { unlocked: 2, stars: { 1: 3, 2: 3 }, best: { 1: 1800, 2: 1600 } }
  const won = { ...game, stageId: 2, collected: [18, 0, 0, 0, 0, 0], score: 1750 }
  const updated = recordClear(progress, STAGES[1], won)
  expect(updated).toEqual({ unlocked: 3, stars: { 1: 3, 2: 3 }, best: { 1: 1800, 2: 1750 } })
  expect(progress).toEqual({ unlocked: 2, stars: { 1: 3, 2: 3 }, best: { 1: 1800, 2: 1600 } })
  expect(recordClear(updated, STAGES[0], { ...game, score: 1000 })).toEqual(updated)
})

it('caps unlocks at stage 5 and records stars for a first clear', () => {
  expect(recordClear({ unlocked: 5, stars: {}, best: {} }, STAGES[4], { ...game, score: 3200 }))
    .toEqual({ unlocked: 5, stars: { 5: 3 }, best: { 5: 3200 } })
})
