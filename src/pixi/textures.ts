import { Graphics, Rectangle, type Application, type Texture } from 'pixi.js'
import coral from '../assets/gems/gem-coral.webp'
import ocean from '../assets/gems/gem-ocean.webp'
import amber from '../assets/gems/gem-amber.webp'
import violet from '../assets/gems/gem-violet.webp'
import sun from '../assets/gems/gem-sun.webp'
import emerald from '../assets/gems/gem-emerald.webp'

export const gems = [
  { name: 'Coral jewel', label: 'コーラル', asset: coral, base: 0xd9384c, light: 0xff8b92 },
  { name: 'Ocean jewel', label: 'オーシャン', asset: ocean, base: 0x0875bf, light: 0x65c5fa },
  { name: 'Amber jewel', label: 'アンバー', asset: amber, base: 0xce6810, light: 0xffab58 },
  { name: 'Violet jewel', label: 'バイオレット', asset: violet, base: 0x8036cc, light: 0xc794fa },
  { name: 'Sun jewel', label: 'サン', asset: sun, base: 0xe1ad13, light: 0xffda63 },
  { name: 'Emerald jewel', label: 'エメラルド', asset: emerald, base: 0x078b50, light: 0x67d99b },
]

export const specials = {
  'line-row': { glyph: '↔', name: 'LINE row' },
  'line-column': { glyph: '↕', name: 'LINE column' },
  burst: { glyph: '✺', name: 'BURST' },
  color: { glyph: '✦', name: 'COLOR' },
}

export const CELL = 64

export type GemTextures = readonly Texture[]

export function createGemTextures(renderer: Application['renderer']): GemTextures {
  const frame = new Rectangle(0, 0, CELL - 8, CELL - 8)
  const outline = 0x0b1e33
  const shapes = [
    {
      draw: (art: Graphics) => art.circle(28, 28, 24),
      facet: { halfWidth: 16, y: 17, rise: 12 },
      shade: { halfWidth: 16, y: 43, drop: 10 },
    },
    {
      draw: (art: Graphics) => art.moveTo(28, 3)
        .bezierCurveTo(24, 11, 7, 22, 7, 34)
        .bezierCurveTo(7, 45, 16, 52, 28, 52)
        .bezierCurveTo(40, 52, 49, 45, 49, 34)
        .bezierCurveTo(49, 22, 32, 11, 28, 3)
        .closePath(),
      facet: { halfWidth: 10, y: 23, rise: 12 },
      shade: { halfWidth: 15, y: 43, drop: 10 },
    },
    {
      draw: (art: Graphics) => art.poly([14, 6, 42, 6, 52, 28, 42, 50, 14, 50, 4, 28]),
      facet: { halfWidth: 15, y: 16, rise: 9 },
      shade: { halfWidth: 14, y: 43, drop: 8 },
    },
    {
      draw: (art: Graphics) => art.ellipse(28, 28, 17, 24),
      facet: { halfWidth: 11, y: 18, rise: 13 },
      shade: { halfWidth: 11, y: 43, drop: 10 },
    },
    {
      draw: (art: Graphics) => art.poly([28, 3, 53, 28, 28, 53, 3, 28]),
      facet: { halfWidth: 10, y: 20, rise: 13 },
      shade: { halfWidth: 9, y: 40, drop: 11 },
    },
    {
      draw: (art: Graphics) => art.poly([14, 4, 42, 4, 52, 14, 52, 42, 42, 52, 14, 52, 4, 42, 4, 14]),
      facet: { halfWidth: 17, y: 15, rise: 11 },
      shade: { halfWidth: 16, y: 45, drop: 8 },
    },
  ]

  return gems.map(({ base, light }, index) => {
    const { draw, facet, shade } = shapes[index]
    const art = new Graphics()

    draw(art).fill(base).stroke({ color: outline, alpha: 0.9, width: 3, join: 'round' })

    // Keep the accents near the edges so special-tile glyphs have a clear center.
    art.moveTo(28 - facet.halfWidth, facet.y)
      .quadraticCurveTo(28, facet.y - facet.rise, 28 + facet.halfWidth, facet.y)
      .quadraticCurveTo(28, facet.y - 2, 28 - facet.halfWidth, facet.y)
      .closePath()
      .fill({ color: light, alpha: 0.26 })
      .moveTo(28 - shade.halfWidth, shade.y)
      .quadraticCurveTo(28, shade.y + shade.drop, 28 + shade.halfWidth, shade.y)
      .quadraticCurveTo(28, shade.y + 3, 28 - shade.halfWidth, shade.y)
      .closePath()
      .fill({ color: outline, alpha: 0.3 })
      .ellipse(28 - facet.halfWidth * 0.48, facet.y - 2, 3, 1.4)
      .fill({ color: 0xffffff, alpha: 0.55 })

    try {
      return renderer.generateTexture({ target: art, frame, resolution: 2, antialias: true })
    } finally {
      art.destroy()
    }
  })
}
