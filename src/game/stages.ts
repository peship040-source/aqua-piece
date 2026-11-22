import type { Game } from './engine'

export type StageDef = {
  id: number
  goalType: 'score' | 'collect'
  targetColor?: number
  target: number
  moves: number
  star2: number
  star3: number
}

export const STAGES: StageDef[] = [
  { id: 1, goalType: 'score', target: 1000, moves: 30, star2: 1400, star3: 1800 },
  { id: 2, goalType: 'collect', targetColor: 0, target: 18, moves: 30, star2: 1500, star3: 2000 },
  { id: 3, goalType: 'score', target: 1800, moves: 30, star2: 2300, star3: 2800 },
  { id: 4, goalType: 'collect', targetColor: 1, target: 25, moves: 30, star2: 1800, star3: 2400 },
  { id: 5, goalType: 'score', target: 2200, moves: 30, star2: 2700, star3: 3200 },
  { id: 6, goalType: 'collect', targetColor: 3, target: 22, moves: 30, star2: 2000, star3: 2500 },
  { id: 7, goalType: 'score', target: 2400, moves: 30, star2: 2900, star3: 3400 },
  { id: 8, goalType: 'collect', targetColor: 2, target: 30, moves: 30, star2: 2200, star3: 2800 },
  { id: 9, goalType: 'score', target: 2600, moves: 30, star2: 3100, star3: 3600 },
  { id: 10, goalType: 'collect', targetColor: 5, target: 32, moves: 30, star2: 2400, star3: 3000 },
]

export function stageDef(id: number): StageDef | undefined {
  return STAGES.find(def => def.id === id)
}

export function goalReached(def: StageDef, game: Game): boolean {
  if (def.goalType === 'score') return game.score >= def.target
  return def.targetColor !== undefined && game.collected[def.targetColor] >= def.target
}

export function earnedStars(def: StageDef, game: Game): number {
  if (!goalReached(def, game)) return 0
  return 1 + Number(game.score >= def.star2) + Number(game.score >= def.star3)
}
