import { CanvasSource, Container, Graphics, Rectangle, Sprite, Text, Texture, type Application, type Ticker } from 'pixi.js'
import type { Frame, PlacedTile } from '../animation'
import type { Tile } from '../game/engine'
import { BOARD_SIZE, createEffects, createGemPolish, createWater, xOf } from './effects'
import { CELL, specials, type GemTextures } from './textures'
import { clampProgress, interpolate, slideProgress } from './tween'

type BoardState = {
  tiles: PlacedTile[]
  frame?: Frame
  selected: number | null
  locked: boolean
}

function createShadowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = CELL
  const context = canvas.getContext('2d')!
  const center = CELL / 2
  const gradient = context.createRadialGradient(center, center, 0, center, center, center)
  gradient.addColorStop(0, 'rgba(0, 6, 19, 0.96)')
  gradient.addColorStop(0.5, 'rgba(0, 6, 19, 0.76)')
  gradient.addColorStop(0.78, 'rgba(0, 6, 19, 0.33)')
  gradient.addColorStop(1, 'rgba(0, 5, 16, 0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, CELL, CELL)
  return new Texture({ source: new CanvasSource({ resource: canvas }) })
}

function createTile(gem: PlacedTile, textures: GemTextures, shadowTexture: Texture, tap: (at: number) => void) {
  const node = new Container()
  node.hitArea = new Rectangle(-CELL / 2, -CELL / 2, CELL, CELL)
  node.cursor = 'pointer'
  node.interactiveChildren = false

  const content = node.addChild(new Container())
  const shadow = content.addChild(new Sprite(shadowTexture))
  shadow.anchor.set(0.5)
  shadow.width = CELL * 0.98
  shadow.height = CELL * 0.53
  shadow.y = CELL * 0.31

  const halo = content.addChild(new Graphics()
    .circle(0, 0, 26).stroke({ color: 0xffffff, width: 10, alpha: 0.12 })
    .circle(0, 0, 26).stroke({ color: 0xffffff, width: 5, alpha: 0.25 })
    .circle(0, 0, 26).stroke({ color: 0xffffff, width: 2, alpha: 0.52 }))

  const face = content.addChild(new Sprite())
  face.anchor.set(0.5)
  // An additive pass lifts the existing highlights within each gem's silhouette.
  const sheen = content.addChild(new Sprite())
  sheen.anchor.set(0.5)
  sheen.blendMode = 'add'

  const ring = content.addChild(new Graphics()
    .roundRect(-28, -29, 56, 56, 16).stroke({ color: 0x6cf3dc, width: 7, alpha: 0.32 })
    .roundRect(-28, -29, 56, 56, 16).stroke({ color: 0xd6fff1, width: 2, alpha: 0.98 }))
  ring.visible = false

  const badge = content.addChild(new Container())
  badge.position.set(16, 15)
  badge.addChild(new Graphics()
    .circle(0, 0, 13).fill({ color: 0x0c253b, alpha: 0.9 })
    .circle(0, 0, 13).stroke({ color: 0xa5fff3, width: 1.25, alpha: 0.62 }))
  const mark = badge.addChild(new Text({
    style: {
      fontFamily: 'system-ui, sans-serif', fontSize: 20, fontWeight: '800', fill: 0xffffff,
      dropShadow: { color: 0x97fff5, alpha: 0.72, blur: 3, distance: 0 },
    },
    resolution: 2,
  }))
  mark.anchor.set(0.5)

  let tile: Tile | undefined
  let at = gem.at
  let targetX = xOf(at)
  let targetY = (gem.row + 0.5) * CELL
  let startX = targetX
  let startY = targetY
  let duration = 0
  let landing = false
  node.position.set(targetX, targetY)
  node.on('pointertap', () => tap(at))

  function place(next: PlacedTile, dropping: boolean) {
    const isNew = tile === undefined
    const createdSpecial = !isNew && tile !== next.tile && !!next.tile.special
    if (tile !== next.tile) {
      tile = next.tile
      const texture = textures[tile.color]
      face.texture = sheen.texture = texture
      const scale = (CELL - 8) / Math.max(texture.width, texture.height)
      face.scale.set(scale)
      sheen.scale.set(scale)
      halo.visible = badge.visible = !!tile.special
      mark.text = tile.special ? specials[tile.special].glyph : ''
    }
    at = next.at
    startX = node.x
    startY = node.y
    targetX = xOf(at)
    targetY = (next.row + 0.5) * CELL
    duration = next.duration ?? 0
    landing = dropping && duration > 0 && startY !== targetY
    return createdSpecial
  }

  function update(elapsed: number, motion: Frame['motion'], reduced: boolean) {
    const progress = clampProgress(elapsed, reduced ? Math.min(35, duration) : duration)
    const eased = slideProgress(progress, motion, reduced)
    node.position.set(interpolate(startX, targetX, eased), interpolate(startY, targetY, eased))
    if (!landing || progress < 1) return false
    landing = false
    return !reduced
  }

  function decorate(selected: boolean, time: number, clearProgress: number, reduced: boolean) {
    const bounce = selected && !reduced ? Math.sin(time / 240) : 0
    content.y = selected && !reduced ? -2 + bounce : 0
    content.scale.set(1 + (selected && !reduced ? 0.03 + bounce * 0.018 : 0) + (reduced ? 0 : 0.26 * clearProgress))
    content.alpha = 1 - clearProgress
    ring.visible = selected
    if (selected) {
      ring.scale.set(1 + bounce * 0.036)
      ring.alpha = reduced ? 1 : 0.79 + bounce * 0.18
    }
    sheen.alpha = selected ? 0.23 : 0.12
  }

  return { node, ring, place, update, decorate, get at() { return at } }
}

export function createScene(
  app: Application,
  textures: GemTextures,
  onTap: (at: number) => void,
  onFrameDone: (frame: Frame) => void,
) {
  const water = createWater(app)
  const shadow = createShadowTexture()
  const tileLayer = app.stage.addChild(new Container())
  const effectLayer = app.stage.addChild(new Container())
  effectLayer.eventMode = 'none'
  const effects = createEffects(effectLayer)
  const polish = createGemPolish(effectLayer)
  type TileView = ReturnType<typeof createTile>
  const tileViews = new Map<number, TileView>()
  const visibleTiles: TileView[] = []
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
  let frame: Frame | undefined
  let placed: PlacedTile[] | undefined
  let clearing = new Set<number>()
  let selected: number | null = null
  let locked = true
  let elapsed = 0
  let visualTime = 0
  let finished = false

  function tap(at: number) {
    if (!preference.matches) effects.ripple(at)
    onTap(at)
  }

  function update(ticker: Ticker) {
    const reduced = preference.matches
    if (!reduced) visualTime += ticker.deltaMS
    water.update(visualTime)
    effects.updateRipples(ticker.deltaMS, reduced)
    effects.updateSparkles(ticker.deltaMS, reduced)
    effects.updateChain(ticker.deltaMS, reduced)
    polish.update(ticker.deltaMS, reduced, !frame && !locked ? placed : undefined)

    if (frame && !finished) elapsed += ticker.deltaMS
    const duration = frame?.duration ?? 0
    const progress = clampProgress(elapsed, reduced ? Math.min(duration, 35) : duration)
    for (let i = 0; i < visibleTiles.length; i++) {
      const tile = visibleTiles[i]
      if (tile.update(elapsed, frame?.motion, reduced)) polish.land(tile.ring)
      tile.decorate(tile.at === selected, visualTime, clearing.has(tile.at) ? progress : 0, reduced)
    }

    if (frame) {
      effects.update(frame, progress, reduced)
      if (progress === 1 && !finished) {
        finished = true
        onFrameDone(frame)
      }
    }
  }
  app.ticker.add(update)

  return {
    show(state: BoardState) {
      selected = state.selected
      locked = state.locked
      tileLayer.eventMode = locked ? 'none' : 'passive'
      if (frame === state.frame && placed === state.tiles) return

      frame = state.frame
      placed = state.tiles
      elapsed = 0
      finished = false
      clearing = new Set(frame?.lifting ? [] : frame?.effect?.cells)
      const createdSpecials: number[] = []
      const isClear = !!frame?.effect && !frame.lifting
      const ids = new Set(placed.map(gem => gem.id))
      visibleTiles.length = 0
      for (const [id, tile] of tileViews) {
        if (ids.has(id)) continue
        polish.release(tile.ring)
        tile.node.destroy({ children: true })
        tileViews.delete(id)
      }
      for (const gem of placed) {
        let tile = tileViews.get(gem.id)
        if (!tile) {
          tile = createTile(gem, textures, shadow, tap)
          tile.node.eventMode = 'static'
          tileLayer.addChild(tile.node)
          tileViews.set(gem.id, tile)
        }
        if (tile.place(gem, frame?.motion === 'drop') && isClear) createdSpecials.push(gem.at)
        visibleTiles.push(tile)
      }
      effects.setFrame(frame, createdSpecials, preference.matches)
    },
    resize(size: number) {
      app.renderer.resize(size, size, Math.min(window.devicePixelRatio || 1, 2))
      app.stage.scale.set(size / BOARD_SIZE)
    },
    destroy() {
      app.ticker.remove(update)
      app.destroy({ removeView: false }, { children: true })
      water.destroy()
      shadow.destroy(true)
    },
  }
}
