import { Graphics, Rectangle, type Application, type Texture } from 'pixi.js'
import coral from '../assets/gems/gem-coral.webp'
import ocean from '../assets/gems/gem-ocean.webp'
import amber from '../assets/gems/gem-amber.webp'
import violet from '../assets/gems/gem-violet.webp'
import sun from '../assets/gems/gem-sun.webp'
import emerald from '../assets/gems/gem-emerald.webp'

export const gems = [
  { name: 'Coral jewel', label: 'コーラル', asset: coral, base: 0xed5e6b, light: 0xffb5ac },
  { name: 'Ocean jewel', label: 'オーシャン', asset: ocean, base: 0x218ccb, light: 0xc0eaff },
  { name: 'Amber jewel', label: 'アンバー', asset: amber, base: 0xd98221, light: 0xffefae },
  { name: 'Violet jewel', label: 'バイオレット', asset: violet, base: 0x9350dc, light: 0xead5ff },
  { name: 'Sun jewel', label: 'サン', asset: sun, base: 0xf5cf39, light: 0xffe795 },
  { name: 'Emerald jewel', label: 'エメラルド', asset: emerald, base: 0x19a661, light: 0xe7ffc5 },
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
  const shade = 0x142345

  return gems.map(({ base, light }) => {
    const art = new Graphics()
      .moveTo(14, 1).lineTo(42, 1).quadraticCurveTo(47, 1, 50, 5)
      .lineTo(53, 9).quadraticCurveTo(55, 12, 55, 16)
      .lineTo(55, 40).quadraticCurveTo(55, 44, 52, 48)
      .lineTo(49, 51).quadraticCurveTo(46, 55, 41, 55)
      .lineTo(15, 55).quadraticCurveTo(10, 55, 6, 51)
      .lineTo(3, 47).quadraticCurveTo(1, 44, 1, 40)
      .lineTo(1, 16).quadraticCurveTo(1, 12, 4, 8)
      .lineTo(7, 4).quadraticCurveTo(10, 1, 14, 1)
      .closePath().fill(base)

      // Four bevel planes meet the central table facet.
      .poly([13, 4, 43, 4, 51, 12, 39, 12, 15, 14, 4, 14]).fill({ color: light, alpha: 0.58 })
      .poly([4, 14, 15, 14, 14, 42, 13, 52, 4, 43]).fill({ color: light, alpha: 0.25 })
      .poly([39, 12, 51, 12, 52, 42, 43, 52, 42, 40]).fill({ color: shade, alpha: 0.23 })
      .poly([14, 42, 42, 40, 43, 52, 13, 52]).fill({ color: shade, alpha: 0.42 })
      .poly([15, 14, 39, 12, 42, 40, 14, 42]).fill({ color: light, alpha: 0.12 })

      .poly([10, 11, 15, 6, 28, 6, 18, 9]).fill({ color: 0xffffff, alpha: 0.83 })
      .moveTo(52, 22).lineTo(52, 40).quadraticCurveTo(52, 44, 48, 48)
      .quadraticCurveTo(45, 52, 40, 52).lineTo(25, 52)
      .stroke({ color: light, width: 1.5, alpha: 0.52, cap: 'round' })

    try {
      return renderer.generateTexture({ target: art, frame, resolution: 2, antialias: true })
    } finally {
      art.destroy()
    }
  })
}
