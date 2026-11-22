import { Assets, type Texture } from 'pixi.js'
import coral from '../assets/gems/gem-coral.webp'
import ocean from '../assets/gems/gem-ocean.webp'
import amber from '../assets/gems/gem-amber.webp'
import violet from '../assets/gems/gem-violet.webp'
import sun from '../assets/gems/gem-sun.webp'
import emerald from '../assets/gems/gem-emerald.webp'

export const gems = [
  { name: 'Coral drop', asset: coral, light: 0xffb5ac },
  { name: 'Ocean diamond', asset: ocean, light: 0xc0eaff },
  { name: 'Amber orb', asset: amber, light: 0xffefae },
  { name: 'Violet square', asset: violet, light: 0xead5ff },
  { name: 'Sun hexagon', asset: sun, light: 0xffe795 },
  { name: 'Emerald oval', asset: emerald, light: 0xe7ffc5 },
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
