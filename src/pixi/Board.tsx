import { useEffect, useRef, useState } from 'react'
import { Application } from 'pixi.js'
import type { Frame, PlacedTile } from '../animation'
import { SIZE } from '../game/engine'
import { createScene } from './scene'
import { gems, specials } from './textures'

type Props = {
  tiles: PlacedTile[]
  frame?: Frame
  selected: number | null
  locked: boolean
  onTap: (at: number) => void
  onFrameDone: (frame: Frame) => void
}

function describeBoard(tiles: PlacedTile[], selected: number | null, busy: boolean) {
  const board = `${SIZE} by ${SIZE} match-three board.`
  if (busy) return `${board} Resolving move.`
  const rows = Array.from({ length: SIZE }, (_, row) => {
    const pieces = tiles.slice(row * SIZE, (row + 1) * SIZE).map(({ tile, at }) => {
      const special = tile.special ? ` ${specials[tile.special].name}` : ''
      return `${gems[tile.color].name}${special}${at === selected ? ' selected' : ''}`
    })
    return `Row ${row + 1}, ${pieces.join(', ')}.`
  })
  return `${board} ${rows.join(' ')}`
}

export function Board(props: Props) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const canvas = useRef<HTMLCanvasElement>(null)
  const scene = useRef<Awaited<ReturnType<typeof createScene>>>(null)
  const latest = useRef(props)
  const tiles = props.frame?.tiles ?? props.tiles

  useEffect(() => {
    latest.current = props
    scene.current?.show({ ...props, tiles })
  }, [props, tiles])

  useEffect(() => {
    const view = canvas.current!
    const host = view.parentElement!
    const app = new Application()
    const controller = new AbortController()
    const { signal } = controller
    let initialized = false
    let observer: ResizeObserver | undefined
    const resize = () => {
      const size = Math.max(1, Math.round(host.getBoundingClientRect().width))
      scene.current?.resize(size)
    }

    async function mount() {
      try {
        await app.init({
          canvas: view, preference: 'webgl', backgroundAlpha: 0, antialias: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          width: 1, height: 1,
        })
        initialized = true
        if (signal.aborted) {
          app.destroy({ removeView: false }, { children: true })
          return
        }
        // Pixi disables gestures by default. Tap-to-swap can coexist with page scrolling.
        view.style.touchAction = 'manipulation'

        const next = await createScene(app,
          at => latest.current?.onTap(at),
          frame => latest.current?.onFrameDone(frame),
          signal,
        )
        scene.current = next
        const state = latest.current!
        next.show({ ...state, tiles: state.frame?.tiles ?? state.tiles })

        resize()
        observer = new ResizeObserver(resize)
        observer.observe(host)
        window.addEventListener('resize', resize)
        setStatus('ready')
      } catch (error) {
        if (!signal.aborted) {
          console.error('Unable to initialize the Aqua Piece board', error)
          setStatus('unavailable')
        }
      }
    }

    void mount()
    return () => {
      controller.abort()
      observer?.disconnect()
      window.removeEventListener('resize', resize)
      if (scene.current) {
        scene.current.destroy()
        scene.current = null
      } else if (initialized) {
        app.destroy({ removeView: false }, { children: true })
      }
    }
  }, [])

  const label = status === 'unavailable' ? 'Match-three board unavailable.' :
    status === 'loading' ? 'Match-three board loading.' : describeBoard(tiles, props.selected, !!props.frame)
  return (
    <div className="board">
      <canvas ref={canvas} role="img" aria-label={label} aria-busy={status === 'loading' || !!props.frame} />
      {status !== 'ready' && (
        <p className="board-status" role="status">
          {status === 'loading' ? 'Loading board…' : 'The board could not load.'}
        </p>
      )}
    </div>
  )
}
