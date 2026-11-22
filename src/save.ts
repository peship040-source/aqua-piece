import { COLORS, SIZE, findRuns, hasMove, status, type Game, type Tile } from './game/engine'
import { earnedStars, STAGES, stageDef, type StageDef } from './game/stages'

export const SAVE_KEY = 'aqua-piece-v1'
export type Progress = { unlocked: number; stars: Record<number, number>; best: Record<number, number> }
export type CurrentGame = { seed: number; game: Game }
export type Save = { version: 2; progress: Progress; current: CurrentGame | null }
type LegacySave = { version: 1; seed: number; best: number; game: Omit<Game, 'collected' | 'stageId'> }

const freshSave = (): Save => ({ version: 2, progress: { unlocked: 1, stars: {}, best: {} }, current: null })

const integer = (value: unknown, max = Number.MAX_SAFE_INTEGER): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max

function isTile(tile: Tile): boolean {
  return !!tile && integer(tile.color, COLORS - 1) &&
    (tile.special === undefined || ['line-row', 'line-column', 'burst', 'color'].includes(tile.special))
}

function isStageMap(value: unknown, max?: number): boolean {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.entries(value).every(([id, count]) => STAGES.some(def => String(def.id) === id) && integer(count, max))
}

function validGame(game: Game, def: StageDef): boolean {
  return integer(game.moves, def.moves) && integer(game.score) && game.goal === def.target &&
    Array.isArray(game.collected) && game.collected.length === COLORS && game.collected.every(count => integer(count)) &&
    Array.isArray(game.board) && game.board.length === SIZE * SIZE && game.board.every(isTile) &&
    !findRuns(game.board).length && (status(game, def) !== 'playing' || hasMove(game.board))
}

function validCurrent(current: CurrentGame | null): boolean {
  if (current === null) return true
  if (!current?.game || !integer(current.seed, 0xffffffff)) return false
  const def = stageDef(current.game.stageId)
  return !!def && validGame(current.game, def) && status(current.game, def) === 'playing'
}

function migrate({ seed, best, game }: Partial<LegacySave>): Save | null {
  if (!integer(seed, 0xffffffff) || !integer(best) || !game) return null
  const def = STAGES[0]
  const migrated = { ...game, stageId: def.id, collected: Array<number>(COLORS).fill(0) }
  if (!validGame(migrated, def)) return null
  return {
    version: 2,
    progress: { unlocked: 1, stars: {}, best: { 1: best } },
    current: status(migrated, def) === 'playing' ? { seed, game: migrated } : null,
  }
}

export function decodeSave(raw: string | null): Save | null {
  if (!raw) return null
  try {
    const save = JSON.parse(raw) as Save | LegacySave | null
    if (save?.version === 1) return migrate(save)
    if (save?.version !== 2 || !save.progress) return null
    const { unlocked, stars, best } = save.progress
    if (!integer(unlocked, STAGES.length) || unlocked < 1 || !isStageMap(stars, 3) ||
      !isStageMap(best) || !validCurrent(save.current)) return null
    return save
  } catch {
    return null
  }
}

export function loadSave(): Save {
  try {
    return decodeSave(localStorage.getItem(SAVE_KEY)) ?? freshSave()
  } catch {
    return freshSave()
  }
}

export function recordClear(progress: Progress, def: StageDef, game: Game): Progress {
  const { id } = def
  return {
    unlocked: Math.max(progress.unlocked, Math.min(STAGES.length, id + 1)),
    stars: { ...progress.stars, [id]: Math.max(progress.stars[id] ?? 0, earnedStars(def, game)) },
    best: { ...progress.best, [id]: Math.max(progress.best[id] ?? 0, game.score) },
  }
}

export function storeSave(save: Save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save))
  } catch {
    // The game stays playable if browser storage is unavailable.
  }
}
