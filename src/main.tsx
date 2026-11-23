import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { animateTurn, createTileLayout, type Frame } from './animation'
import { ItemIcon } from './components/ItemIcon'
import { adjacent, playWithSteps, seededRng, stageFor, status, type Game } from './game/engine'
import { ITEMS, itemForStage, type ItemDef } from './game/items'
import { earnedStars, STAGES, stageDef, type StageDef } from './game/stages'
import { loadSave, recordClear, storeSave, type CurrentGame, type Progress, type Save } from './save'
import { Board } from './pixi/Board'
import { gems } from './pixi/textures'
import './styles.css'

declare module 'react' {
  export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T
}

const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]
const start = (def: StageDef, seed = newSeed()): CurrentGame => ({ seed, game: stageFor(def, seededRng(seed)) })
const formatNumber = (value: number) => value.toLocaleString('ja-JP')
const motionPreference = '(prefers-reduced-motion: reduce)'
const formatDepth = (stage: number) => stage === 1 ? '0 m' : `−${(stage - 1) * 10} m`

function depthTier(stage: number) {
  if (stage <= 3) return 'shallow'
  if (stage <= 6) return 'mid'
  if (stage <= 8) return 'deep'
  return 'abyss'
}

function collectionColor(def: StageDef) {
  return def.goalType === 'collect' ? def.targetColor : undefined
}

function SeaAmbience() {
  const bubbles = useMemo(() => Array.from({ length: 12 }, (_, index) => {
    const duration = 18 + (index * 7) % 15
    return {
      left: `${5 + (index * 17) % 91}%`,
      width: 4 + (index * 5) % 14,
      animationDuration: `${duration}s`,
      animationDelay: `${-duration * ((index * 7) % 13) / 13}s`,
      '--bubble-opacity': 0.16 + (index % 5) * 0.055,
      '--bubble-drift': `${(index % 2 ? -1 : 1) * (12 + (index * 11) % 28)}px`,
    }
  }), [])

  return (
    <div className="sea-ambience" aria-hidden="true">
      <div className="sea-ray" />
      {bubbles.map((style, index) => <span className="sea-bubble" key={index} style={style} />)}
    </div>
  )
}

function Splash({ dismiss }: { dismiss: () => void }) {
  const layer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = layer.current
    const preference = window.matchMedia(motionPreference)
    const fallback = window.setTimeout(dismiss, 1000)

    function finish(event: Event) {
      if (event.target === element) dismiss()
    }

    function skipIfReduced() {
      if (preference.matches) dismiss()
    }

    element?.addEventListener('animationend', finish)
    preference.addEventListener('change', skipIfReduced)
    skipIfReduced()
    return () => {
      window.clearTimeout(fallback)
      element?.removeEventListener('animationend', finish)
      preference.removeEventListener('change', skipIfReduced)
    }
  }, [dismiss])

  return (
    <div className="splash" ref={layer}>
      <button type="button" className="splash-skip" aria-label="Aqua Piece スプラッシュをスキップ" onClick={dismiss}>
        <span className="splash-mark" aria-hidden="true">
          <span className="title-logo"><span>Aqua Piece</span></span>
          <span className="splash-bubble" />
          <span className="splash-bubble" />
          <span className="splash-bubble" />
        </span>
      </button>
    </div>
  )
}

const starEntranceStart = 150
const starEntranceInterval = 250
const starEntranceDuration = 340

function Stars({ count, animate = false }: { count: number; animate?: boolean }) {
  return (
    <span className={`stars${animate ? ' stars-animated' : ''}`} role="img" aria-label={`星3つのうち${count}つ`}>
      {[0, 1, 2].map(index => (
        <span
          key={index} className={index < count ? 'star-earned' : undefined}
          style={animate && index < count ? {
            animationDelay: `${starEntranceStart + index * starEntranceInterval}ms`,
            animationDuration: `${starEntranceDuration}ms`,
          } : undefined}
          aria-hidden="true"
        >
          {index < count ? '★' : '☆'}
        </span>
      ))}
    </span>
  )
}

const diveStops = [28, 50, 72, 50]
const diveRoute = STAGES.map((_, index) => {
  const x = diveStops[index % diveStops.length]
  const y = index * 100 + 50
  if (index === 0) return `M ${x} ${y}`
  const previousX = diveStops[(index - 1) % diveStops.length]
  return `C ${previousX} ${y - 50}, ${x} ${y - 50}, ${x} ${y}`
}).join(' ')

function StageSelect({ save, resume, choose, openCollection }: {
  save: Save; resume: () => void; choose: (def: StageDef) => void; openCollection: () => void
}) {
  const { unlocked, stars, best, collection } = save.progress
  const nextId = STAGES.find(def => def.id <= unlocked && !stars[def.id])?.id

  return (
    <main className="game select-screen">
      <header className="select-header">
        <h1 className="title-logo"><span>Aqua Piece</span></h1>
        {save.current && (
          <button type="button" className="button button-primary continue" onClick={resume}>
            <strong>つづきから</strong>
            <span>ステージ {save.current.game.stageId}</span>
          </button>
        )}
        <div className="dive-map-heading">
          <h2 id="dive-map-title">ステージをえらぶ</h2>
          <button type="button" className="button collection-link" onClick={openCollection}>
            図鑑 <span>{collection.length}/{ITEMS.length}</span>
          </button>
        </div>
      </header>
      <section className="dive-map" aria-labelledby="dive-map-title" {...{ tabIndex: 0 }}>
        <div className="dive-water">
          <p className="dive-depth">浅瀬 <span>{formatDepth(1)}</span></p>
          <div className="dive-stops">
            <svg
              className="dive-route" viewBox={`0 0 100 ${STAGES.length * 100}`} width={100} height={STAGES.length * 100}
              aria-hidden="true" {...{ preserveAspectRatio: 'none' }}
            >
              <path className="dive-route-edge" d={diveRoute} />
              <path className="dive-route-dashes" d={diveRoute} />
            </svg>
            {STAGES.map((def, index) => {
              const locked = def.id > unlocked
              const count = stars[def.id] ?? 0
              const record = best[def.id]
              const color = collectionColor(def)
              const item = itemForStage(def.id)
              const stop = index % diveStops.length
              const state = locked ? 'locked' : count > 0 ? 'cleared' : def.id === nextId ? 'next' : 'open'
              return (
                <div className="dive-stop" key={def.id} style={{ '--dive-x': `${diveStops[stop]}%` }}>
                  <button
                    type="button" className={`dive-node dive-node-${state}${stop >= 2 ? ' dive-node-reverse' : ''}`}
                    disabled={locked} onClick={() => choose(def)}
                  >
                    <span className="dive-badge">
                      <span className="dive-stage-label">ステージ </span>{def.id}
                      {locked && <span className="dive-lock"><span className="stage-lock" role="img" aria-label="ロック中" /></span>}
                      {item && collection.includes(item.id) && (
                        <span className="dive-reward"><ItemIcon itemId={item.id} owned size={22} label={item.name} /></span>
                      )}
                      <Stars count={count} />
                    </span>
                    <span className="dive-note">
                      <strong>{color === undefined ? `スコア ${formatNumber(def.target)}` : `${gems[color].label}×${def.target}`}</strong>
                      {record !== undefined && <small>ベスト {formatNumber(record)}</small>}
                    </span>
                  </button>
                </div>
              )
            })}
          </div>
          <p className="dive-depth">深海 <span>{formatDepth(STAGES.length)}</span></p>
        </div>
      </section>
    </main>
  )
}

function Collection({ collection, back }: { collection: Progress['collection']; back: () => void }) {
  const [selected, setSelected] = useState<ItemDef | null>(null)
  const detail = useRef<HTMLDivElement>(null)
  const selectedOwned = selected && collection.includes(selected.id)

  useEffect(() => {
    if (selected) detail.current?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  return (
    <main className="game collection-screen">
      <header className="play-header collection-header">
        <button type="button" className="button back" onClick={back}>もどる</button>
        <h1>ずかん</h1>
        <p>{collection.length} / {ITEMS.length} あつめた</p>
      </header>
      <div className="collection-tank">
        {ITEMS.map(item => {
          const owned = collection.includes(item.id)
          return (
            <button
              key={item.id} type="button" className={owned ? 'collection-item' : 'collection-item collection-item-locked'}
              aria-pressed={selected === item} aria-controls="collection-detail" onClick={() => setSelected(item)}
            >
              <span className="collection-perch"><ItemIcon itemId={item.id} owned={owned} size={50} /></span>
              <strong>{owned ? item.name : '？？？'}</strong>
              {!owned && <small>ステージ{item.stageId}をクリアしよう</small>}
            </button>
          )
        })}
        <div className="collection-sand" aria-hidden="true">
          <svg viewBox="0 0 72 52" width={72} height={52}>
            <path fill="none" stroke="#428c7b" strokeWidth="4" strokeLinecap="round"
              d="M25 43c-15-14 5-20-5-35m8 35c-3-19 15-23 10-39M24 44C17 39 8 39 7 28" />
            <path fill="#687f79" d="m10 48 6-9 13-3 10 6 4 7Z" />
            <path fill="#a0a397" d="m45 48 4-6 9-1 5 7Z" />
          </svg>
          <svg viewBox="0 0 66 44" width={66} height={44}>
            <path fill="none" stroke="#cc8f85" strokeWidth="4" strokeLinecap="round"
              d="M40 36c4-10-4-19 0-29m1 21c-7-2-15-3-16-13m17 11c7 0 13-4 15-11m-9 9 1-13" />
            <path fill="#786e76" d="m24 39 7-8 14-1 10 5 5 6Z" />
            <path fill="#aca092" d="m6 38 4-6 9 1 4 6Z" />
          </svg>
        </div>
      </div>
      <div id="collection-detail" aria-live="polite" ref={detail}>
        {selected && (
          <div className="collection-detail" key={selected.id}>
            <h2>{selectedOwned ? selected.name : '？？？'}</h2>
            <p>{selectedOwned ? selected.flavor : `ステージ${selected.stageId}をクリアしよう`}</p>
            {selectedOwned && <small>ステージ{selected.stageId}のごほうび</small>}
          </div>
        )}
      </div>
    </main>
  )
}

function useTweenedScore(score: number) {
  const [displayed, setDisplayed] = useState(score)
  const current = useRef(score)

  useEffect(() => {
    const preference = window.matchMedia(motionPreference)
    let request = 0

    function sync() {
      cancelAnimationFrame(request)
      if (preference.matches) {
        current.current = score
        setDisplayed(score)
        return
      }
      const from = current.current ?? score
      if (from === score) return
      const start = performance.now()
      function tick(now: number) {
        const progress = Math.min(1, (now - start) / 320)
        const value = Math.round(from + (score - from) * (1 - (1 - progress) ** 3))
        current.current = value
        setDisplayed(value)
        if (progress < 1) request = requestAnimationFrame(tick)
      }
      request = requestAnimationFrame(tick)
    }

    sync()
    preference.addEventListener('change', sync)
    return () => {
      preference.removeEventListener('change', sync)
      cancelAnimationFrame(request)
    }
  }, [score])
  return displayed
}

const hudIconPaths = {
  score: 'm10 2 2.4 5 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.8L10 2Z',
  moves: 'M5 3h10M5 17h10M6 3v3c0 2 4 3 4 4s-4 2-4 4v3m8-14v3c0 2-4 3-4 4s4 2 4 4v3',
  goal: 'M5 17V3m0 1c4-4 6 4 11 0v8c-5 4-7-4-11 0',
}

function HudIcon({ kind }: { kind: keyof typeof hudIconPaths }) {
  return (
    <svg className={`hud-icon hud-icon-${kind}`} viewBox="0 0 20 20" width={15} height={15} aria-hidden="true">
      <path d={hudIconPaths[kind]} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Moves({ count }: { count: number }) {
  return (
    <dl className={`moves card${count <= 5 ? ' moves-low' : ''}`}>
      <dt><HudIcon kind="moves" />残り手数</dt>
      <dd>{count}</dd>
    </dl>
  )
}

function Hud({ def, score, settledScore, count, moves }: {
  def: StageDef; score: number; settledScore: number; count: number; moves: number
}) {
  const color = collectionColor(def)
  const value = color === undefined ? score : count
  const progress = Math.min(value, def.target)
  const displayedScore = useTweenedScore(settledScore)
  const stars = value >= def.target ? 1 + Number(score >= def.star2) + Number(score >= def.star3) : 0
  const previousStars = useRef(stars)
  const [glow, setGlow] = useState(0)

  useEffect(() => {
    const previous = previousStars.current ?? stars
    previousStars.current = stars
    if (stars > previous) setGlow(value => value + 1)
    else if (stars < previous) setGlow(0)
  }, [stars])

  return (
    <section className="hud" aria-label="ステージの進み具合">
      <div className="goal card">
        <div className="goal-label">
          <span id="goal-label">
            {color === undefined ? <><HudIcon kind="score" />スコア</> : <><img src={gems[color].asset} alt="" />{gems[color].label}</>}
          </span>
          <strong>
            {formatNumber(color === undefined ? displayedScore : count)}{' '}
            <small className="goal-target">/ <HudIcon kind="goal" />{formatNumber(def.target)}</small>
          </strong>
        </div>
        <div
          className="progress" role="progressbar" aria-labelledby="goal-label"
          aria-valuenow={progress} aria-valuemax={def.target}
        >
          <span className="progress-fill" style={{ width: `${progress / def.target * 100}%` }} />
          {glow > 0 && <span key={glow} className="progress-glow" aria-hidden="true" />}
        </div>
        <div className="hud-details">
          {color !== undefined && (
            <small className="secondary-score"><HudIcon kind="score" />スコア <strong>{formatNumber(displayedScore)}</strong></small>
          )}
          <small className="hud-depth">深度 {formatDepth(def.id)}</small>
        </div>
      </div>
      <Moves count={moves} />
    </section>
  )
}

const clearTitle = 'ステージクリア！'
const lossTitle = '手数を使い切りました'

type Reward = { item: ItemDef; isNew: boolean }

const resultBubbles = Array.from({ length: 18 }, (_, index) => ({
  left: `${5 + (index * 17) % 90}%`,
  width: 4 + (index * 5) % 8,
  animationDelay: `${100 + index * 16}ms`,
  '--bubble-end': `${64 + (index * 13) % 28}%`,
  '--bubble-drift': `${(index % 2 ? -1 : 1) * (8 + (index * 7) % 18)}px`,
}))

function ResultBubbles() {
  const [visible, setVisible] = useState(() => !window.matchMedia(motionPreference).matches)
  const layer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const lastBubble = layer.current?.lastElementChild
    if (!visible || !lastBubble) return
    const preference = window.matchMedia(motionPreference)
    const finish = () => setVisible(false)
    function stopIfReduced() {
      if (preference.matches) finish()
    }
    lastBubble.addEventListener('animationend', finish)
    preference.addEventListener('change', stopIfReduced)
    stopIfReduced()
    return () => {
      lastBubble.removeEventListener('animationend', finish)
      preference.removeEventListener('change', stopIfReduced)
    }
  }, [visible])

  return visible && (
    <div className="result-bubbles" ref={layer} aria-hidden="true">
      {resultBubbles.map((style, index) => (
        <span key={index} className="result-bubble" style={style} />
      ))}
    </div>
  )
}

function Result({ def, game, won, reward, restart, select, next }: {
  def: StageDef; game: Game; won: boolean; reward?: Reward
  restart: () => void; select: () => void; next?: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => dialog.current?.showModal(), [])
  const color = collectionColor(def)
  const stars = won ? earnedStars(def, game) : 0
  const rewardDelay = starEntranceStart + Math.max(0, stars - 1) * starEntranceInterval + starEntranceDuration + 70
  return (
    <dialog
      className={`result card${won ? ' result-won' : ' result-lost'}`} ref={dialog} aria-labelledby="result-title"
      onCancel={event => { event.preventDefault(); select() }}
    >
      <p className="stage">ステージ {def.id}</p>
      <h2 id="result-title">{won ? clearTitle : lossTitle}</h2>
      {won && <><Stars count={stars} animate /><ResultBubbles /></>}
      <dl className="result-stats">
        <div>
          <dt>スコア</dt>
          <dd>
            {formatNumber(game.score)}
            {!won && color === undefined && <small> / {formatNumber(def.target)}</small>}
          </dd>
        </div>
        {color !== undefined && (
          <div>
            <dt><img src={gems[color].asset} alt="" />{gems[color].label}</dt>
            <dd>{formatNumber(game.collected[color])}<small> / {formatNumber(def.target)}個</small></dd>
          </div>
        )}
      </dl>
      {reward && (
        reward.isNew ? (
          <div className="result-reward" style={{ animationDelay: `${rewardDelay}ms` }}>
            <ItemIcon itemId={reward.item.id} owned size={58} />
            <span>
              <small>あたらしいアイテム！</small>
              <strong>{reward.item.name}</strong>
            </span>
          </div>
        ) : (
          <div className="result-reward-owned">
            <ItemIcon itemId={reward.item.id} owned size={22} label={reward.item.name} />
            <small>（ずかん登録ずみ）</small>
          </div>
        )
      )}
      <div className="result-actions">
        {next && <button type="button" className="button button-primary" onClick={next}>つぎのステージ</button>}
        <button type="button" className={`button${next ? '' : ' button-primary'}`} onClick={restart}>もういちど</button>
        <button type="button" className="button" onClick={select}>ステージをえらぶ</button>
      </div>
    </dialog>
  )
}

type PlayFrame = Frame & { collected?: number }
type Playback = { frames: PlayFrame[]; index: number; startingScore: number; message: string }

function Play({ initial, progress, onGameChange, select, choose }: {
  initial: CurrentGame
  progress: Progress
  onGameChange: (current: CurrentGame, def: StageDef) => Reward | undefined
  select: () => void
  choose: (def: StageDef) => void
}) {
  const [{ seed, game }, setCurrent] = useState(initial)
  const def = stageDef(game.stageId)!
  const color = collectionColor(def)
  const result = status(game, def)
  const [layout] = useState(createTileLayout)
  const [tiles, setTiles] = useState(() => layout.place(game.board))
  const [selected, setSelected] = useState<number | null>(null)
  const [chain, setChain] = useState(0)
  const [message, setMessage] = useState('')
  const [playback, setPlayback] = useState<Playback | null>(null)
  const [reward, setReward] = useState<Reward | undefined>(undefined)
  const resolving = useRef(false)
  const frame = playback?.frames[playback.index]
  const score = frame?.score ?? game.score
  const count = color === undefined ? 0 : (frame?.collected ?? game.collected[color])
  const shownChain = frame?.chain ?? chain
  const best = progress.best[def.id]
  const next = result === 'won' ? stageDef(def.id + 1) : undefined

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

  function restart() {
    if (resolving.current) return
    const current = start(def, seed)
    setCurrent(current)
    setTiles(layout.place(current.game.board))
    setSelected(null)
    setChain(0)
    setMessage('')
    setReward(undefined)
    onGameChange(current, def)
  }

  function tap(at: number) {
    if (resolving.current || result !== 'playing') return
    if (selected === at) {
      setSelected(null)
    } else if (selected === null || !adjacent(selected, at)) {
      setSelected(at)
      setMessage('')
    } else {
      const random = seededRng(seed ^ Math.imul(def.moves - game.moves + 1, 0x9e3779b9))
      const turn = playWithSteps(game, selected, at, random)
      let frames: PlayFrame[] = animateTurn(turn.steps, layout, tiles, game.score)
      if (color !== undefined) {
        let collected = game.collected[color]
        frames = frames.map(frame => {
          // Drop frames reuse the clear effect for the points popup.
          if (!frame.lifting) {
            for (const cell of frame.effect?.cells ?? []) {
              if (frame.tiles[cell].tile.color === color) collected++
            }
          }
          return { ...frame, collected }
        })
      }
      resolving.current = true
      setSelected(null)
      setPlayback({
        frames, index: 0, startingScore: game.score,
        message: turn.game === game ? 'そろう宝石がありませんでした。' : turn.reshuffled ? '宝石を並べ直しました。' : '',
      })
      if (turn.game !== game) {
        const current = { seed, game: turn.game }
        setCurrent(current)
        setTiles(layout.place(turn.game.board))
        setChain(turn.chain)
        setReward(onGameChange(current, def))
      }
    }
  }

  const feedback = frame
    ? shownChain > 1 ? `${shownChain}連鎖！` : '宝石を入れ替えています…'
    : message || (chain > 1 ? `${chain}連鎖！` : 'となり合う宝石をタップして入れ替えよう。')

  return (
    <main className={`game play-screen depth-${depthTier(def.id)}`}>
      <header className="play-header">
        <button type="button" className="button back" onClick={select}>もどる</button>
        <h1>ステージ {def.id}</h1>
      </header>
      <Hud def={def} score={score} settledScore={playback?.startingScore ?? game.score} count={count} moves={game.moves} />
      <div className="board-frame card">
        <Board
          tiles={tiles} frame={frame} selected={selected} locked={!!playback || result !== 'playing'}
          onTap={tap} onFrameDone={advance}
        />
      </div>
      <p className="feedback" role="status">{result !== 'playing' && !playback ? '' : feedback}</p>
      <footer>
        {best !== undefined && <p className="best">ベスト <strong>{formatNumber(best)}</strong></p>}
        <button type="button" className="button restart" onClick={restart} disabled={!!playback}>リスタート</button>
      </footer>
      {!playback && result !== 'playing' && (
        <Result
          def={def} game={game} won={result === 'won'} reward={reward} restart={restart} select={select}
          next={next && next.id <= progress.unlocked ? () => choose(next) : undefined}
        />
      )}
    </main>
  )
}

type Screen = { name: 'select' } | { name: 'collection' } | { name: 'play'; initial: CurrentGame }

function App() {
  const [save, setSave] = useState(loadSave)
  const [screen, setScreen] = useState<Screen>({ name: 'select' })
  const [showSplash, setShowSplash] = useState(() => !window.matchMedia(motionPreference).matches)
  useEffect(() => window.scrollTo(0, 0), [screen])

  function persist(next: Save) {
    storeSave(next)
    setSave(next)
  }

  function updateGame(current: CurrentGame, def: StageDef) {
    const game = current.game
    const result = status(game, def)
    let progress = save.progress
    let reward: Reward | undefined
    if (result === 'won') {
      progress = recordClear(progress, def, game)
      const item = itemForStage(def.id)
      if (item && progress.collection.includes(item.id)) {
        reward = { item, isNew: !save.progress.collection.includes(item.id) }
      }
    } else if (game.score > (progress.best[def.id] ?? 0)) {
      progress = { ...progress, best: { ...progress.best, [def.id]: game.score } }
    }
    persist({ ...save, progress, current: result === 'playing' ? current : null })
    return reward
  }

  function choose(def: StageDef) {
    if (def.id > save.progress.unlocked) return
    const current = start(def)
    persist({ ...save, current })
    setScreen({ name: 'play', initial: current })
  }

  function resume() {
    if (save.current) setScreen({ name: 'play', initial: save.current })
  }

  function dismissSplash() {
    setShowSplash(false)
  }

  return (
    <>
      <div className="sea" aria-hidden="true" />
      <SeaAmbience />
      <div {...{ inert: showSplash }}>
        {screen.name === 'select' ? (
          <StageSelect key="select" save={save} choose={choose} resume={resume} openCollection={() => setScreen({ name: 'collection' })} />
        ) : screen.name === 'collection' ? (
          <Collection key="collection" collection={save.progress.collection} back={() => setScreen({ name: 'select' })} />
        ) : (
          <Play
            key={`play-${screen.initial.game.stageId}`} initial={screen.initial} progress={save.progress}
            onGameChange={updateGame} select={() => setScreen({ name: 'select' })} choose={choose}
          />
        )}
      </div>
      {showSplash && <Splash dismiss={dismissSplash} />}
    </>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
