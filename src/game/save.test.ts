import { expect, it } from 'vitest'
import { seededRng, stage } from './engine'
import { decodeSave } from '../save'

const snapshot = {
  version: 1,
  seed: 14,
  best: 460,
  game: { ...stage(seededRng(14)), moves: 20, score: 350 },
}

it('round-trips a versioned save with current progress and best score', () => {
  expect(decodeSave(JSON.stringify(snapshot))).toEqual(snapshot)
})

it('rejects malformed saves and unsupported versions', () => {
  for (const raw of [
    null, '{', 'null', '{}', JSON.stringify({ ...snapshot, version: 2 }),
    JSON.stringify({ ...snapshot, game: { ...snapshot.game, board: [null] } }),
    JSON.stringify({ ...snapshot, game: { ...snapshot.game, moves: -1 } }),
  ]) {
    expect(decodeSave(raw)).toBeNull()
  }
})
