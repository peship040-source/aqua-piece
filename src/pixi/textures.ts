import { Assets, Graphics, Rectangle, type Application, type Texture } from 'pixi.js'
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

const fallbackTextures = new WeakSet<Texture>()

function createFallbackTexture(renderer: Application['renderer'], base: number): Texture {
  const frame = new Rectangle(0, 0, CELL - 8, CELL - 8)
  const art = new Graphics()
    .roundRect(4, 4, frame.width - 8, frame.height - 8, 18)
    .fill(base)
    .stroke({ color: 0x0b1e33, alpha: 0.9, width: 3 })

  try {
    const texture = renderer.generateTexture({ target: art, frame, resolution: 2, antialias: true })
    fallbackTextures.add(texture)
    return texture
  } finally {
    art.destroy()
  }
}

export async function loadGemTextures(
  renderer: Application['renderer'],
  signal?: AbortSignal,
): Promise<GemTextures> {
  const results = await Promise.allSettled(gems.map(({ asset }) => Assets.load<Texture>(asset)))
  signal?.throwIfAborted()
  return results.map((result, index) => result.status === 'fulfilled'
    ? result.value
    : createFallbackTexture(renderer, gems[index].base))
}

export function destroyGemFallbackTextures(textures: GemTextures) {
  for (const texture of textures) {
    if (fallbackTextures.has(texture)) texture.destroy(true)
  }
}
