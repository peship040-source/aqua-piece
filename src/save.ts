import { COLORS, GOAL, MOVES, SIZE, findRuns, hasMove, status, type Game, type Tile } from './game/engine'

export const SAVE_KEY = 'aqua-piece-v1'
export type Save = { version: 1; seed: number; best: number; game: Game }

const integer = (value: unknown, max = Number.MAX_SAFE_INTEGER): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max

function isTile(tile: Tile): boolean {
  return !!tile && integer(tile.color, COLORS - 1) &&
    (tile.special === undefined || ['line-row', 'line-column', 'burst', 'color'].includes(tile.special))
}

export function decodeSave(raw: string | null): Save | null {
  if (!raw) return null
  try {
    const { version, seed, best, game } = JSON.parse(raw) as Partial<Save>
    if (version !== 1 || !integer(seed, 0xffffffff) || !integer(best) || !game ||
      !integer(game.moves, MOVES) || !integer(game.score) || game.goal !== GOAL ||
      !Array.isArray(game.board) || game.board.length !== SIZE * SIZE || !game.board.every(isTile) ||
      findRuns(game.board).length || (status(game) === 'playing' && !hasMove(game.board))) return null
    return { version, seed, best, game }
  } catch {
    return null
  }
}

export function loadSave(): Save | null {
  try {
    return decodeSave(localStorage.getItem(SAVE_KEY))
  } catch {
    return null
  }
}

export function storeSave(save: Save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save))
  } catch {
    // The game stays playable if browser storage is unavailable.
  }
}
