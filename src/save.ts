import { COLORS, SIZE, findRuns, hasMove, status, type Game, type Tile } from './game/engine'
import { ITEMS, itemForStage } from './game/items'
import { earnedStars, STAGES, stageDef, type StageDef } from './game/stages'

export const SAVE_KEY = 'aqua-piece-v1'
export type Progress = { unlocked: number; stars: Record<number, number>; best: Record<number, number>; collection: string[] }
export type CurrentGame = { seed: number; game: Game }
export type Save = { version: 3; progress: Progress; current: CurrentGame | null }
type Version2Save = { version: 2; progress: Omit<Progress, 'collection'>; current: CurrentGame | null }
type LegacySave = { version: 1; seed: number; best: number; game: Omit<Game, 'collected' | 'stageId'> }

const freshSave = (): Save => ({ version: 3, progress: { unlocked: 1, stars: {}, best: {}, collection: [] }, current: null })

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

function validCollection(value: unknown): boolean {
  return Array.isArray(value) && new Set(value).size === value.length &&
    value.every(id => ITEMS.some(item => item.id === id))
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

function migrateV1({ seed, best, game }: Partial<LegacySave>): Version2Save | null {
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
    const parsed = JSON.parse(raw) as Save | Version2Save | LegacySave | null
    const save = parsed?.version === 1 ? migrateV1(parsed) : parsed
    if ((save?.version !== 2 && save?.version !== 3) || !save.progress) return null
    const { unlocked, stars, best } = save.progress
    if (!integer(unlocked, STAGES.length) || unlocked < 1 || !isStageMap(stars, 3) ||
      !isStageMap(best) || !validCurrent(save.current)) return null
    if (save.version === 3) return validCollection(save.progress.collection) ? save : null
    const collection = ITEMS.filter(item => (stars[item.stageId] ?? 0) > 0).map(item => item.id)
    return { version: 3, progress: { unlocked, stars, best, collection }, current: save.current }
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
  const item = itemForStage(id)
  return {
    unlocked: Math.max(progress.unlocked, Math.min(STAGES.length, id + 1)),
    stars: { ...progress.stars, [id]: Math.max(progress.stars[id] ?? 0, earnedStars(def, game)) },
    best: { ...progress.best, [id]: Math.max(progress.best[id] ?? 0, game.score) },
    collection: item && !progress.collection.includes(item.id) ? [...progress.collection, item.id] : progress.collection,
  }
}

export function storeSave(save: Save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save))
  } catch {
    // The game stays playable if browser storage is unavailable.
  }
}
