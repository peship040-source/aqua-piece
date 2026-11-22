export const clampProgress = (elapsed: number, duration: number) =>
  duration <= 0 ? 1 : Math.min(elapsed / duration, 1)

export const interpolate = (start: number, end: number, progress: number) =>
  start + (end - start) * progress

export function slideProgress(progress: number, motion: 'drop' | 'revert' | undefined, reduced: boolean) {
  if (reduced) return progress
  if (motion === 'drop') return progress ** 2
  if (motion === 'revert') {
    const rest = 1 - progress
    return 1 - rest ** 3 * Math.cos(progress * Math.PI * 3)
  }
  return progress ** 2 * (3 - 2 * progress)
}
