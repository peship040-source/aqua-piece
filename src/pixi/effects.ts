import { Container, Graphics, Rectangle, Sprite, Text, type Application } from 'pixi.js'
import { SIZE } from '../game/engine'
import type { Frame } from '../animation'
import { CELL, gems } from './textures'

export const BOARD_SIZE = CELL * SIZE
export const xOf = (at: number) => (at % SIZE + 0.5) * CELL
export const yOf = (at: number) => (Math.floor(at / SIZE) + 0.5) * CELL

export function createWater(app: Application) {
  const art = new Graphics()
    .circle(12, 12, 9).fill({ color: 0x52e6ea, alpha: 0.13 })
    .circle(12, 12, 9).stroke({ color: 0xb8fff5, width: 1.2, alpha: 0.7 })
    .ellipse(9, 7, 2.5, 1.25).fill({ color: 0xf0fffb, alpha: 0.8 })
  const texture = app.renderer.generateTexture({ target: art, frame: new Rectangle(0, 0, 24, 24), resolution: 2 })
  art.destroy()

  const bubbles = new Container()
  bubbles.eventMode = 'none'
  const sprites = Array.from({ length: 9 }, (_, i) => {
    const bubble = new Sprite(texture)
    bubble.anchor.set(0.5)
    bubble.scale.set(0.45 + (i % 4) * 0.19)
    bubbles.addChild(bubble)
    return bubble
  })
  app.stage.addChild(bubbles)

  return {
    update(time: number) {
      sprites.forEach((bubble, i) => {
        bubble.x = 19 + i * (BOARD_SIZE - 38) / 8 + Math.sin(time / 1500 + i) * 11
        const rise = (i * 113 + time * (0.017 + i % 3 * 0.006)) % (BOARD_SIZE + 38)
        bubble.y = BOARD_SIZE + 19 - rise
        bubble.alpha = 0.23 + (i % 3) * 0.075
      })
    },
    destroy: () => texture.destroy(true),
  }
}

const PARTICLE_COUNT = 72
const SPARKLE_COUNT = 120
const RIPPLE_DURATION = 300

export function createEffects(layer: Container) {
  const ripples = Array.from({ length: 6 }, () => {
    const ring = layer.addChild(new Graphics()
      .circle(0, 0, 24).stroke({ color: 0x6cf3dc, width: 5, alpha: 0.28 })
      .circle(0, 0, 24).stroke({ color: 0xd6fff1, width: 1.5, alpha: 0.88 }))
    ring.visible = false
    return { ring, elapsed: 0 }
  })
  let nextRipple = 0
  const flash = layer.addChild(new Graphics())
  const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const shape = new Graphics()
    if (i % 3 === 0) shape.poly([0, -5, 1.2, -1.2, 5, 0, 1.2, 1.2, 0, 5, -1.2, 1.2, -5, 0, -1.2, -1.2]).fill(0xffffff)
    else shape.circle(0, 0, i % 2 ? 2 : 3).fill(0xffffff)
    shape.visible = false
    layer.addChild(shape)
    return { shape, x: 0, y: 0, vx: 0, vy: 0 }
  })
  const sparkles = Array.from({ length: SPARKLE_COUNT }, () => {
    const shape = layer.addChild(new Graphics()
      .poly([0, -4, 1, -1, 3, 0, 1, 1, 0, 4, -1, 1, -3, 0, -1, -1]).fill(0xffffff))
    shape.visible = false
    return { shape, x: 0, y: 0, drift: 0, rise: 0, elapsed: 0, duration: 0 }
  })
  let nextSparkle = 0
  const points = layer.addChild(new Text({
    style: {
      fontFamily: 'system-ui, sans-serif', fontWeight: '900', fontSize: 25,
      fill: 0xfff4b6, stroke: { color: 0x092536, width: 4, join: 'round' },
    },
    resolution: 2,
  }))
  points.anchor.set(0.5)
  points.visible = false
  let active = 0

  function setFrame(frame: Frame | undefined, reduced: boolean) {
    flash.clear()
    active = 0
    particles.forEach(({ shape }) => { shape.visible = false })
    const effect = frame?.effect
    points.visible = !!effect
    points.scale.set(1)
    if (!frame || !effect) return
    points.text = `+${effect.points.toLocaleString()}`
    points.x = Math.max(CELL, Math.min(BOARD_SIZE - CELL, xOf(effect.at)))
    if (frame.lifting) return

    for (const { at, special } of effect.activations) {
      const x = xOf(at)
      const y = yOf(at)
      if (special === 'line-row' || special === 'line-column') {
        const horizontal = special === 'line-row'
        const beam = (width: number, color: number, alpha: number) =>
          flash.rect(horizontal ? 0 : x - width / 2, horizontal ? y - width / 2 : 0,
            horizontal ? BOARD_SIZE : width, horizontal ? width : BOARD_SIZE).fill({ color, alpha })
        beam(21, 0x89fff2, 0.26)
        beam(7, 0xbefff4, 0.67)
        beam(2, 0xffffff, 0.94)
      } else {
        const radius = special === 'burst' ? CELL * 1.35 : CELL * 2.25
        flash.circle(x, y, radius).fill({ color: 0xc4fff2, alpha: 0.16 })
          .circle(x, y, radius).stroke({ color: 0x9ffff2, width: 12, alpha: 0.35 })
          .circle(x, y, radius).stroke({ color: 0xffffff, width: 3, alpha: 0.92 })
      }
    }
    if (reduced) return

    const count = Math.min(4, Math.floor(PARTICLE_COUNT / effect.cells.length))
    for (const [index, at] of effect.cells.entries()) {
      for (let i = 0; i < count; i++) {
        const particle = particles[active++]
        const angle = index * 2.4 + i * 2 * Math.PI / count
        const distance = 22 + (index + i * 7) % 20
        particle.x = xOf(at)
        particle.y = yOf(at)
        particle.vx = Math.cos(angle) * distance
        particle.vy = Math.sin(angle) * distance
        particle.shape.tint = i === 0 ? 0xfff9db : gems[frame.tiles[at].tile.color].light
        particle.shape.visible = true
      }
    }

    const sparkleCount = Math.min(effect.cells.length * 3, SPARKLE_COUNT)
    for (let i = 0; i < sparkleCount; i++) {
      const at = effect.cells[i % effect.cells.length]
      const sparkle = sparkles[nextSparkle]
      nextSparkle = (nextSparkle + 1) % sparkles.length
      sparkle.x = xOf(at) + (i * 11 + at * 3) % 25 - 12
      sparkle.y = yOf(at) + (i * 7 + at) % 19 - 9
      sparkle.drift = (i * 13 + at) % 25 - 12
      sparkle.rise = 25 + (i * 9 + at) % 27
      sparkle.elapsed = 0
      sparkle.duration = 360 + (i * 37 + at * 11) % 190
      sparkle.shape.tint = gems[frame.tiles[at].tile.color].light
      sparkle.shape.visible = true
    }
  }

  function update(frame: Frame, progress: number, reduced: boolean) {
    const effect = frame.effect
    if (!effect) return
    flash.alpha = (1 - progress) ** 2 * (reduced ? 0.55 : 1)
    points.y = yOf(effect.at) - (reduced ? 0 : frame.lifting ? 12 + 16 * progress : 12 * progress)
    points.alpha = frame.lifting ? 1 - progress : Math.min(1, 0.65 + progress * 2)
    const bounce = Math.min(1, progress / 0.65)
    points.scale.set(!reduced && !frame.lifting && frame.chain >= 2
      ? 1 + Math.sin(Math.PI * bounce) * (1 - bounce) * 0.42
      : 1)
    for (let i = 0; i < active; i++) {
      const { shape, x, y, vx, vy } = particles[i]
      shape.visible = !reduced
      shape.position.set(x + vx * progress, y + vy * progress + 12 * progress ** 2)
      shape.alpha = (1 - progress) ** 1.5
      shape.scale.set(1 - progress * 0.55)
    }
  }

  function updateSparkles(deltaMS: number, reduced: boolean) {
    for (const sparkle of sparkles) {
      const { shape } = sparkle
      if (!shape.visible) continue
      sparkle.elapsed += deltaMS
      const progress = Math.min(1, sparkle.elapsed / sparkle.duration)
      shape.visible = !reduced && progress < 1
      shape.position.set(sparkle.x + sparkle.drift * progress, sparkle.y - sparkle.rise * progress)
      shape.alpha = (1 - progress) ** 1.4
      shape.scale.set(1.15 - progress * 0.7)
    }
  }

  function ripple(at: number) {
    const entry = ripples[nextRipple]
    nextRipple = (nextRipple + 1) % ripples.length
    entry.elapsed = 0
    entry.ring.position.set(xOf(at), yOf(at))
    entry.ring.scale.set(0.55)
    entry.ring.alpha = 1
    entry.ring.visible = true
  }

  function updateRipples(deltaMS: number, reduced: boolean) {
    for (const entry of ripples) {
      const { ring } = entry
      if (!ring.visible) continue
      entry.elapsed += deltaMS
      const progress = Math.min(1, entry.elapsed / RIPPLE_DURATION)
      ring.visible = !reduced && progress < 1
      ring.scale.set(0.55 + progress * 0.95)
      ring.alpha = (1 - progress) ** 2
    }
  }

  return { setFrame, update, ripple, updateRipples, updateSparkles }
}
