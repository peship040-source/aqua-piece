import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { animateTurn, createTileLayout, type Frame } from './animation'
import { MOVES, adjacent, playWithSteps, seededRng, stage, status } from './game/engine'
import { loadSave, storeSave, type Save } from './save'
import { Board } from './pixi/Board'
import './styles.css'

const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]
const start = (seed: number, best: number): Save =>
  ({ version: 1, seed, best, game: stage(seededRng(seed)) })
const motionPreference = '(prefers-reduced-motion: reduce)'

function usePulse(active: boolean, interval: number) {
  const [pulse, setPulse] = useState(false)
  useEffect(() => {
    if (!active) return
    const preference = window.matchMedia(motionPreference)
    let timer: number
    function sync() {
      window.clearInterval(timer)
      if (preference.matches) setPulse(false)
      else timer = window.setInterval(() => setPulse(value => !value), interval)
    }
    sync()
    preference.addEventListener('change', sync)
    return () => {
      preference.removeEventListener('change', sync)
      window.clearInterval(timer)
    }
  }, [active, interval])
  return active && pulse
}

function Moves({ count }: { count: number }) {
  const low = count <= 5
  const pulse = usePulse(low, 650)
  return (
    <dl className={`moves card${low ? ' moves-low' : ''}${pulse ? ' pulse' : ''}`}>
      <dt>Moves left</dt>
      <dd>{count}</dd>
    </dl>
  )
}

function Actions({ restart, newGame, disabled }: { restart: () => void; newGame: () => void; disabled?: boolean }) {
  return (
    <div className="actions">
      <button type="button" onClick={restart} disabled={disabled}>Restart</button>
      <button type="button" onClick={newGame} disabled={disabled}>New Game</button>
    </div>
  )
}

function Result({ title, score, best, restart, newGame }: {
  title: string; score: number; best: number; restart: () => void; newGame: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => dialog.current?.showModal(), [])
  return (
    <dialog className="result card" ref={dialog} aria-labelledby="result-title">
      <p className="stage">Stage 1</p>
      <h2 id="result-title">{title}</h2>
      <dl className="result-stats">
        <div><dt>Score</dt><dd>{score.toLocaleString()}</dd></div>
        <div><dt>Best</dt><dd>{best.toLocaleString()}</dd></div>
      </dl>
      <Actions restart={restart} newGame={newGame} />
    </dialog>
  )
}

type Playback = { frames: Frame[]; index: number; best: number; message: string }

function App() {
  const [loaded] = useState(loadSave)
  const [save, setSave] = useState(() => loaded ?? start(newSeed(), 0))
  const [layout] = useState(createTileLayout)
  const [tiles, setTiles] = useState(() => layout.place(save.game.board))
  const [selected, setSelected] = useState<number | null>(null)
  const [chain, setChain] = useState(0)
  const [message, setMessage] = useState(loaded && status(loaded.game) === 'playing' ? 'Game continued.' : '')
  const [playback, setPlayback] = useState<Playback | null>(null)
  const resolving = useRef(false)
  const { game, seed, best } = save
  const result = status(game)
  const frame = playback?.frames[playback.index]
  const score = frame?.score ?? game.score
  const moves = game.moves
  const shownChain = frame?.chain ?? chain
  const shownBest = playback ? Math.max(playback.best, score) : best
  const resultTitle = result === 'won' ? 'Stage cleared!' : 'Out of moves'
  useEffect(() => storeSave(save), [save])

  function advance(completed: Frame) {
    if (!playback || completed !== frame) return
    if (playback.index + 1 < playback.frames.length) {
      setPlayback({ ...playback, index: playback.index + 1 })
    } else {
      resolving.current = false
      setMessage(playback.message)
      setPlayback(null)
    }
  }

  function reset(nextSeed: number) {
    if (resolving.current) return
    const next = start(nextSeed, best)
    setSave(next)
    setTiles(layout.place(next.game.board))
    setSelected(null)
    setChain(0)
    setMessage('')
  }

  function tap(at: number) {
    if (resolving.current || result !== 'playing') return
    if (selected === at) {
      setSelected(null)
    } else if (selected === null || !adjacent(selected, at)) {
      setSelected(at)
      setMessage('')
    } else {
      const random = seededRng(seed ^ Math.imul(MOVES - game.moves + 1, 0x9e3779b9))
      const turn = playWithSteps(game, selected, at, random)
      const frames = animateTurn(turn.steps, layout, tiles, game.score)
      resolving.current = true
      setSelected(null)
      setPlayback({
        frames, index: 0, best,
        message: turn.game === game ? 'That swap made no match.' : turn.reshuffled ? 'Board reshuffled.' : '',
      })
      if (turn.game !== game) {
        setTiles(layout.place(turn.game.board))
        setSave({ ...save, game: turn.game, best: Math.max(best, turn.game.score) })
        setChain(turn.chain)
      }
    }
  }

  const restart = () => reset(seed)
  const newGame = () => reset(newSeed())
  return (
    <>
      <div className="sea" aria-hidden="true" />
      <main className="game">
        <header>
          <p className="stage">Stage 1</p>
          <h1>Aqua Piece</h1>
        </header>

        <section className="hud" aria-label="Stage statistics">
          <div className="goal card">
            <div className="goal-label">
              <span id="score-label">Score</span>
              <strong>{score.toLocaleString()} <small>/ {game.goal.toLocaleString()}</small></strong>
            </div>
            <div
              className="progress" role="progressbar" aria-labelledby="score-label"
              aria-valuenow={Math.min(score, game.goal)} aria-valuemax={game.goal}
            >
              <span style={{ width: `${Math.min(100, score / game.goal * 100)}%` }} />
            </div>
          </div>
          <Moves count={moves} />
        </section>

        <div className="board-frame">
          <Board
            tiles={tiles} frame={frame} selected={selected} locked={!!playback || result !== 'playing'}
            onTap={tap} onFrameDone={advance}
          />
          <span className={`chain-banner${frame && shownChain > 1 ? ' visible' : ''}`} aria-hidden="true">
            {shownChain} Chain!
          </span>
        </div>

        <p className="feedback" role="status">
          {frame ? (shownChain > 1 ? `${shownChain} Chain!` : 'Resolving move…') :
            result !== 'playing' ? resultTitle :
            message || (chain > 1 ? `${chain} Chain!` : 'Tap two neighboring pieces to swap.')}
        </p>
        <footer>
          <p className="best">Best <strong>{shownBest.toLocaleString()}</strong></p>
          <Actions restart={restart} newGame={newGame} disabled={!!playback} />
        </footer>

        {!playback && result !== 'playing' && (
          <Result title={resultTitle} score={game.score} best={best} restart={restart} newGame={newGame} />
        )}
      </main>
    </>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
