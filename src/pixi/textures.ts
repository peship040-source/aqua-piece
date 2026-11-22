import { Assets, type Texture } from 'pixi.js'
import coral from '../assets/gems/gem-coral.webp'
import ocean from '../assets/gems/gem-ocean.webp'
import amber from '../assets/gems/gem-amber.webp'
import violet from '../assets/gems/gem-violet.webp'
import sun from '../assets/gems/gem-sun.webp'
import emerald from '../assets/gems/gem-emerald.webp'

export const gems = [
  { name: 'Coral drop', label: 'コーラル', asset: coral, light: 0xffb5ac },
  { name: 'Ocean diamond', label: 'オーシャン', asset: ocean, light: 0xc0eaff },
  { name: 'Amber orb', label: 'アンバー', asset: amber, light: 0xffefae },
  { name: 'Violet square', label: 'バイオレット', asset: violet, light: 0xead5ff },
  { name: 'Sun hexagon', label: 'サン', asset: sun, light: 0xffe795 },
  { name: 'Emerald oval', label: 'エメラルド', asset: emerald, light: 0xe7ffc5 },
]

export const specials = {
  'line-row': { glyph: '↔', name: 'LINE row' },
  'line-column': { glyph: '↕', name: 'LINE column' },
  burst: { glyph: '✦', name: 'BURST' },
  color: { glyph: '◎', name: 'COLOR' },
}

export const CELL = 64

export type GemTextures = readonly Texture[]

export function loadGemTextures(): Promise<GemTextures> {
  // Pixi Assets owns the shared textures across board mounts.
  return Promise.all(gems.map(({ asset }) => Assets.load<Texture>(asset)))
}
