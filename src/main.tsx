import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { animateTurn, createTileLayout, type Frame } from './animation'
import { ItemIcon } from './components/ItemIcon'
import { adjacent, playWithSteps, seededRng, stageFor, status, type Game } from './game/engine'
import { ITEMS, itemForStage, type ItemDef } from './game/items'
import { ENDLESS_DEF, earnedStars, STAGES, stageDef, type StageDef } from './game/stages'
import { loadSave, recordClear, storeSave, type CurrentGame, type OceanPosition, type Progress, type Save } from './save'
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
const formatDepth = (stage: number) => stage <= 1 ? '0 m' : `−${(stage - 1) * 10} m`

function depthTier(stage: number) {
  if (stage <= 3) return 'shallow'
  if (stage <= 6) return 'mid'
  if (stage <= 8) return 'deep'
  return 'abyss'
}

function collectionColor(def: StageDef) {
  return def.goalType === 'collect' ? def.targetColor : undefined
}

const snowByDepth = {
  shallow: { count: 0, opacity: 0 },
  mid: { count: 8, opacity: 0.24 },
  deep: { count: 16, opacity: 0.34 },
  abyss: { count: 26, opacity: 0.44 },
}

function SeaAmbience({ depth, showSilhouettes }: {
  depth?: ReturnType<typeof depthTier>
  showSilhouettes: boolean
}) {
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

  const snow = useMemo(() => {
    if (!depth) return []
    const { count, opacity } = snowByDepth[depth]
    return Array.from({ length: count }, (_, index) => {
      const duration = 34 + (index * 19) % 29
      return {
        left: `${(index * 37 + 11) % 101}%`,
        width: 1 + ((index * 11) % 7) / 4,
        animationDuration: `${duration}s`,
        animationDelay: `${-duration * ((index * 17 + 3) % 31) / 31}s`,
        '--snow-opacity': opacity * (0.55 + (index % 5) * 0.11),
        '--snow-drift': `${(index % 2 ? -1 : 1) * (10 + (index * 13) % 33)}px`,
      }
    })
  }, [depth])

  return (
    <div className="sea-ambience" data-depth={depth} aria-hidden="true">
      <div className="sea-ray" />
      {showSilhouettes && (
        <svg
          className="sea-silhouettes" viewBox="0 0 800 100" width={800} height={100}
          {...{ preserveAspectRatio: 'none', focusable: 'false' }}
        >
          <path d="M0 81Q35 80 58 65T108 72Q135 90 177 82T264 89Q312 95 352 83T430 86Q470 91 513 82T604 86Q635 91 661 74T712 72Q751 84 800 77V100H0Z" />
          <path d="M116 92C121 69 111 56 99 44C115 48 127 61 126 78C133 59 127 45 131 27C146 47 139 70 133 82C143 71 153 70 159 58C163 77 143 83 140 93ZM648 93C639 78 649 66 638 51C655 58 653 71 655 81C660 65 655 58 666 40C670 57 662 66 663 80C669 71 678 71 686 62C683 78 674 78 669 94Z" />
          <path d="M276 94Q278 80 269 72M280 93Q290 83 285 66M288 86Q299 84 302 74M540 94Q537 79 546 64M541 84Q531 81 526 71" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {bubbles.map((style, index) => <span className="sea-bubble" key={index} style={style} />)}
      {snow.map((style, index) => <span className="sea-snow" key={index} style={style} />)}
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

function StageSelect({ save, resume, choose, openCollection, openOcean }: {
  save: Save; resume: () => void; choose: (def: StageDef) => void; openCollection: () => void; openOcean: () => void
}) {
  const { unlocked, stars, best, collection, endlessBest } = save.progress
  const nextId = STAGES.find(def => def.id <= unlocked && !stars[def.id])?.id

  return (
    <main className="game select-screen">
      <header className="select-header">
        <h1 className="title-logo"><span>Aqua Piece</span></h1>
        {save.current && (
          <button type="button" className="button button-primary continue" onClick={resume}>
            <strong>つづきから</strong>
            <span className="stage-number">ステージ {save.current.game.stageId}</span>
          </button>
        )}
        <button type="button" className="button endless-link" onClick={() => choose(ENDLESS_DEF)}>
          エンドレス{endlessBest > 0 && <span>ベスト {formatNumber(endlessBest)}</span>}
        </button>
        <div className="dive-map-heading">
          <h2 id="dive-map-title">ステージをえらぶ</h2>
          <div className="dive-map-actions">
            <button type="button" className="button collection-link" onClick={openCollection}>
              図鑑 <span>{collection.length}/{ITEMS.length}</span>
            </button>
            <button type="button" className="button" onClick={openOcean}>マイオーシャン</button>
          </div>
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

function Collection({ collection, newItems, markSeen, back }: {
  collection: Progress['collection']; newItems: readonly string[]; markSeen: (id: string) => void; back: () => void
}) {
  const [selected, setSelected] = useState<ItemDef | null>(null)
  const detail = useRef<HTMLDialogElement>(null)
  const ownedCount = collection.length
  const total = ITEMS.length

  useEffect(() => {
    if (selected) detail.current?.showModal()
  }, [selected])

  function closeDetail() {
    detail.current?.close()
    setSelected(null)
  }

  return (
    <main className="game collection-screen">
      <header className="play-header collection-header">
        <button type="button" className="button back" onClick={back}>もどる</button>
        <h1>ずかん</h1>
        <div className={`collection-progress${ownedCount === total ? ' collection-progress-complete' : ''}`}>
          <span className="collection-progress-count">
            <svg viewBox="0 0 56 56" width={56} height={56} aria-hidden="true">
              <circle className="collection-progress-track" cx="28" cy="28" r="24" />
              {ownedCount > 0 && (
                <circle
                  className="collection-progress-fill" cx="28" cy="28" r="24"
                  {...{ pathLength: total }} style={{ strokeDasharray: `${ownedCount} ${total - ownedCount}` }}
                />
              )}
            </svg>
            {ownedCount}/{total}
          </span>
          <span>あつめた</span>
        </div>
      </header>
      <div className="collection-tank">
        {ITEMS.map(item => {
          const owned = collection.includes(item.id)
          if (!owned) {
            return (
              <div key={item.id} className="collection-item collection-item-locked">
                <span className="collection-perch"><ItemIcon itemId={item.id} owned={false} size={50} /></span>
                <strong>？？？</strong>
                <small><span className="stage-number">ステージ{item.stageId}</span>をクリアしよう</small>
              </div>
            )
          }
          const isNew = newItems.includes(item.id)
          return (
            <button
              key={item.id} type="button" className="collection-item" aria-controls="collection-detail"
              {...{ 'aria-haspopup': 'dialog' }}
              onClick={() => {
                setSelected(item)
                if (isNew) markSeen(item.id)
              }}
            >
              <span className="collection-perch">
                <ItemIcon itemId={item.id} owned size={50} />
                {isNew && <span className="collection-new" {...{ lang: 'en' }}>NEW</span>}
              </span>
              <strong>{item.name}</strong>
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
      <dialog
        id="collection-detail" className="collection-detail" ref={detail} aria-labelledby="collection-detail-title"
        onCancel={event => { event.preventDefault(); closeDetail() }}
      >
        {selected && (
          <>
            <div className="collection-detail-art"><ItemIcon itemId={selected.id} owned size={128} /></div>
            <h2 id="collection-detail-title">{selected.name}</h2>
            <p className="collection-detail-flavor">{selected.flavor}</p>
            <p className="collection-detail-stage stage-number">ステージ {selected.stageId} のごほうび</p>
            <button type="button" className="button" onClick={closeDetail}>とじる</button>
          </>
        )}
      </dialog>
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

function Moves({ count, endless = false }: { count: number; endless?: boolean }) {
  return (
    <dl className={`moves card${!endless && count <= 5 ? ' moves-low' : ''}`}>
      <dt><HudIcon kind="moves" />{endless ? '手数' : '残り手数'}</dt>
      <dd>{formatNumber(count)}</dd>
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

function EndlessHud({ score, moves, best }: { score: number; moves: number; best: number }) {
  const displayedScore = useTweenedScore(score)
  return (
    <section className="hud" aria-label="エンドレスのスコアと手数">
      <div className="goal card">
        <div className="goal-label">
          <span><HudIcon kind="score" />スコア</span>
          <strong>{formatNumber(displayedScore)}</strong>
        </div>
        <div className="hud-details">
          <small className="secondary-score">ベスト <strong>{formatNumber(best)}</strong></small>
          <small className="hud-depth">深度 {formatDepth(ENDLESS_DEF.id)}</small>
        </div>
      </div>
      <Moves count={moves} endless />
    </section>
  )
}

function StageIntro({ def, collection }: { def: StageDef; collection: Progress['collection'] }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (!visible) return
    const timer = window.setTimeout(() => setVisible(false), 1400)
    return () => window.clearTimeout(timer)
  }, [visible])

  if (!visible) return null

  const color = collectionColor(def)
  const goal = color === undefined
    ? `スコア ${formatNumber(def.target)}点`
    : `${gems[color].label}を ${formatNumber(def.target)}個集める`
  const thresholds = [
    color === undefined ? `${formatNumber(def.target)}点` : '目標達成',
    `${formatNumber(def.star2)}点`,
    `${formatNumber(def.star3)}点`,
  ]
  const item = itemForStage(def.id)
  const owned = item !== undefined && collection.includes(item.id)

  return (
    <div className="stage-intro">
      <div className="stage-intro-card">
        <div className="stage-intro-heading">
          <h2>ステージ {def.id}</h2>
          <span>深度 {formatDepth(def.id)}</span>
        </div>
        <p className="stage-intro-goal"><HudIcon kind="goal" />{goal}</p>
        <dl className="stage-intro-stars" aria-label="星の獲得条件">
          {thresholds.map((threshold, index) => (
            <div key={index}>
              <dt aria-label={`星${index + 1}つ`}>{'★'.repeat(index + 1)}</dt>
              <dd>{threshold}</dd>
            </div>
          ))}
        </dl>
        {item && (
          <p className="stage-intro-reward">
            <ItemIcon itemId={item.id} owned={owned} size={34} />
            <span>ごほうび <strong>{owned ? item.name : '？？？'}</strong></span>
          </p>
        )}
      </div>
      <button type="button" className="stage-intro-dismiss" aria-label="ステージ紹介をとじる" onClick={() => setVisible(false)} />
    </div>
  )
}

const boardProps = {
  shallow: [
    <>
      <path fill="#e4b29c" d="M13 19C6 18 2 13 3 8c1-2 3-3 5-2 0-3 4-5 7-3 2-2 6-1 7 2 4-1 7 2 7 5 0 5-6 9-13 9Z" />
      <path fill="none" stroke="#fff0cd" strokeWidth="1.2" strokeLinecap="round" d="M8 8q2 5 7 8m0-11 1 11m6-9q0 5-5 9" />
    </>,
    <>
      <path fill="#dc9e6d" d="M17 2q2 0 3 6l6 1q4 1 0 4l-5 2 1 6q0 3-3 1l-5-4-6 3q-3 1-1-3l3-5-4-5q-2-3 2-2l6 2q2-6 3-6Z" />
      <path fill="none" stroke="#ffe3ab" strokeWidth="1.6" strokeLinecap="round" d="M16 12h.1m2-6h.1m5 5h.1m-4 6h.1m-8 0h.1m-1-8h.1" />
    </>,
  ],
  mid: [
    <path fill="none" stroke="#d397b0" strokeWidth="2.8" strokeLinecap="round" d="M11 21q6-10 5-18m0 10q6-1 8-6m-10 9Q7 14 5 9m5 5L8 5m13 6 7-1" />,
    <path fill="none" stroke="#bc8eae" strokeWidth="2.6" strokeLinecap="round" d="M20 21q-5-9-2-17m-1 12q-8-2-10-9m6 7-1-9m6 7q6-1 8-6" />,
  ],
  deep: [
    <>
      <path fill="#6aab9d" d="M13 21C7 14 17 9 13 2c9 5-1 13 2 19Zm4 0c-1-6 4-7 7-12 1 7-4 9-5 12Z" />
      <path fill="#758998" d="M3 21q-2-4 4-6 5-1 7 6Zm13 0q2-5 7-4 4 1 5 4Z" />
    </>,
    <>
      <path fill="#59918a" d="M18 21c6-8-1-10 3-18-9 6-2 12-5 18Zm-4 0c1-6-5-7-7-12-1 7 4 9 5 12Z" />
      <path fill="#738694" d="M4 21q1-5 6-5 5 0 8 5Zm15 0q1-4 5-4 4 0 5 4Z" />
    </>,
  ],
  abyss: [
    <>
      <path fill="none" stroke="#83e2ef" strokeWidth="1.3" strokeLinecap="round" d="M12 21q5-7 5-15m-2 10q-4-2-6-6m7 4q5-2 8-6" />
      <path fill="none" stroke="#b4f8ff" strokeWidth="2.8" strokeLinecap="round" d="M6 4h.1m11 2h.1m7 2h.1M9 10h.1m18 5h.1" />
    </>,
    <>
      <path fill="none" stroke="#83e2ef" strokeWidth="1.3" strokeLinecap="round" d="M21 21q-8-7-8-16m2 10q-5-1-9-6m10 7q5-1 7-6" />
      <path fill="none" stroke="#b4f8ff" strokeWidth="2.8" strokeLinecap="round" d="M6 9h.1m7-4h.1m10 5h.1m3-6h.1m3 13h.1" />
    </>,
  ],
}

function BoardDecorations({ depth }: { depth: ReturnType<typeof depthTier> }) {
  return (
    <>
      {boardProps[depth].map((prop, index) => (
        <svg key={index} className={`board-prop board-prop-${index === 0 ? 'left' : 'right'}`}
          viewBox="0 0 32 24" width={32} height={24} aria-hidden="true">
          {prop}
        </svg>
      ))}
    </>
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
  useEffect(() => { dialog.current?.showModal() }, [])
  const color = collectionColor(def)
  const stars = won ? earnedStars(def, game) : 0
  const rewardDelay = starEntranceStart + Math.max(0, stars - 1) * starEntranceInterval + starEntranceDuration + 70
  return (
    <dialog
      className={`result card${won ? ' result-won' : ' result-lost'}`} ref={dialog} aria-labelledby="result-title"
      onCancel={event => { event.preventDefault(); select() }}
    >
      <p className="stage stage-number">ステージ {def.id}</p>
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
const GOAL_BANNER_MS = 1200

function Play({ initial, fresh, progress, onGameChange, select, choose }: {
  initial: CurrentGame
  fresh: boolean
  progress: Progress
  onGameChange: (current: CurrentGame, def: StageDef) => Reward | undefined
  select: () => void
  choose: (def: StageDef) => void
}) {
  const [{ seed, game }, setCurrent] = useState(initial)
  const def = stageDef(game.stageId)!
  const endless = def.id === ENDLESS_DEF.id
  const depth = depthTier(def.id)
  const color = collectionColor(def)
  const result = status(game, def)
  const [layout] = useState(createTileLayout)
  const [tiles, setTiles] = useState(() => layout.place(game.board))
  const [selected, setSelected] = useState<number | null>(null)
  const [chain, setChain] = useState(0)
  const [message, setMessage] = useState('')
  const [playback, setPlayback] = useState<Playback | null>(null)
  const [reward, setReward] = useState<Reward | undefined>(undefined)
  const [introAttempt, setIntroAttempt] = useState(fresh ? 1 : 0)
  const [goalBannerFinished, setGoalBannerFinished] = useState(false)
  const resolving = useRef(false)
  const frame = playback?.frames[playback.index]
  const score = frame?.score ?? game.score
  const count = color === undefined ? 0 : (frame?.collected ?? game.collected[color])
  const shownChain = frame?.chain ?? chain
  const best = progress.best[def.id]
  const next = result === 'won' ? stageDef(def.id + 1) : undefined
  const showGoalBanner = !endless && !goalBannerFinished && result === 'won' && game.moves > 0
    && (color === undefined ? score : count) >= def.target

  useEffect(() => {
    if (!showGoalBanner) return
    const timer = window.setTimeout(() => setGoalBannerFinished(true), GOAL_BANNER_MS)
    return () => window.clearTimeout(timer)
  }, [showGoalBanner])

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
    const current = start(def, endless ? undefined : seed)
    setCurrent(current)
    setTiles(layout.place(current.game.board))
    setSelected(null)
    setChain(0)
    setMessage('')
    setReward(undefined)
    setGoalBannerFinished(false)
    setIntroAttempt(attempt => attempt + 1)
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
    <main className={`game play-screen depth-${depth}`}>
      <header className="play-header">
        <button type="button" className="button back" onClick={select}>もどる</button>
        <h1>{endless ? 'エンドレス' : `ステージ ${def.id}`}</h1>
      </header>
      {endless ? (
        <EndlessHud score={playback?.startingScore ?? game.score} moves={def.moves - game.moves} best={progress.endlessBest} />
      ) : (
        <Hud def={def} score={score} settledScore={playback?.startingScore ?? game.score} count={count} moves={game.moves} />
      )}
      <div className="board-frame card">
        <span className="board-caustics" aria-hidden="true" />
        <Board
          tiles={tiles} frame={frame} selected={selected} locked={!!playback || result !== 'playing'}
          onTap={tap} onFrameDone={advance}
        />
        <BoardDecorations depth={depth} />
        {!endless && introAttempt > 0 && <StageIntro key={introAttempt} def={def} collection={progress.collection} />}
        <div role="status">
          {showGoalBanner && (
            <div className="goal-banner">
              <strong>目標達成！</strong>
              <span>残り手数 {formatNumber(game.moves)}</span>
            </div>
          )}
        </div>
      </div>
      <p className="feedback" role="status">{result !== 'playing' && !playback ? '' : feedback}</p>
      <footer>
        {!endless && best !== undefined && <p className="best">ベスト <strong>{formatNumber(best)}</strong></p>}
        <button type="button" className="button restart" onClick={restart} disabled={!!playback}>リスタート</button>
      </footer>
      {!endless && !playback && !showGoalBanner && result !== 'playing' && (
        <Result
          def={def} game={game} won={result === 'won'} reward={reward} restart={restart} select={select}
          next={next && next.id <= progress.unlocked ? () => choose(next) : undefined}
        />
      )}
    </main>
  )
}

const oceanSpots: OceanPosition[] = [
  { x: .28, y: .89 }, { x: .72, y: .89 }, { x: .5, y: .68 },
  { x: .18, y: .57 }, { x: .82, y: .57 }, { x: .21, y: .33 },
  { x: .5, y: .18 }, { x: .5, y: .43 }, { x: .79, y: .34 }, { x: .82, y: .77 },
]
const oceanSwimmers = new Set(['tropical-fish', 'sea-turtle', 'jellyfish', 'seahorse'])
type OceanPointer = PointerEvent & { currentTarget: HTMLButtonElement }

function Ocean({ progress, place, back }: {
  progress: Progress; place: (id: string, position: OceanPosition) => void; back: () => void
}) {
  const scene = useRef<HTMLDivElement>(null)
  const gesture = useRef<{
    pointerId: number; startX: number; startY: number; offsetX: number; offsetY: number; moved: boolean
  }>(null)
  const [drag, setDrag] = useState<{ id: string; position: OceanPosition } | null>(null)
  const [selected, setSelected] = useState<ItemDef | null>(null)

  function startDrag(event: OceanPointer) {
    if (event.button !== 0 || gesture.current) return
    const button = event.currentTarget
    const bounds = button.getBoundingClientRect()
    button.setPointerCapture(event.pointerId)
    gesture.current = {
      pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      offsetX: event.clientX - (bounds.left + bounds.width / 2),
      offsetY: event.clientY - (bounds.top + bounds.height / 2),
      moved: false,
    }
  }

  function dragPosition(event: OceanPointer): OceanPosition | undefined {
    const active = gesture.current
    if (!active || active.pointerId !== event.pointerId || !scene.current) return
    if (!active.moved && Math.hypot(event.clientX - active.startX, event.clientY - active.startY) < 6) return
    active.moved = true
    const bounds = scene.current.getBoundingClientRect()
    const margin = event.currentTarget.offsetWidth / 2 + 10
    const clamp = (value: number, length: number) => Math.max(margin, Math.min(length - margin, value)) / length
    return {
      x: clamp(event.clientX - bounds.left - scene.current.clientLeft - active.offsetX, scene.current.clientWidth),
      y: clamp(event.clientY - bounds.top - scene.current.clientTop - active.offsetY, scene.current.clientHeight),
    }
  }

  function cancelDrag(event: OceanPointer) {
    if (gesture.current?.pointerId !== event.pointerId) return
    gesture.current = null
    setDrag(null)
  }

  return (
    <main className="game ocean-screen">
      <header className="ocean-header">
        <button type="button" className="button back" onClick={back}>もどる</button>
        <h1>マイオーシャン</h1>
        <p>ドラッグで置き場所を変えられるよ</p>
      </header>
      <div className="ocean-scene" ref={scene} {...{
        onClick: (event: MouseEvent) => {
          if (event.target instanceof Element && !event.target.closest('.ocean-item')) setSelected(null)
        },
      }}>
        <div className="ocean-sand" aria-hidden="true"><BoardDecorations depth="shallow" /></div>
        <SeaAmbience showSilhouettes={false} />
        {progress.collection.length === 0 && (
          <p className="ocean-empty card">ステージをクリアして集めたアイテムを、ここに飾れるよ。</p>
        )}
        {ITEMS.map((item, index) => {
          if (!progress.collection.includes(item.id)) return null
          const moving = drag?.id === item.id
          const { x, y } = moving ? drag.position : progress.ocean[item.id] ?? oceanSpots[index]
          return (
            <button
              key={item.id} type="button"
              className={`ocean-item${moving ? ' ocean-item-dragging' : ''}`}
              aria-label={item.name} aria-pressed={selected?.id === item.id}
              style={{ '--x': `${x * 100}%`, '--y': `${y * 100}%` }}
              {...{
                onPointerDown: startDrag,
                onPointerMove: (event: OceanPointer) => {
                  const position = dragPosition(event)
                  if (position) setDrag({ id: item.id, position })
                },
                onPointerUp: (event: OceanPointer) => {
                  if (gesture.current?.pointerId !== event.pointerId) return
                  const position = dragPosition(event)
                  cancelDrag(event)
                  if (position) place(item.id, position)
                  else setSelected(item)
                },
                onPointerCancel: cancelDrag,
                onLostPointerCapture: cancelDrag,
                onClick: (event?: MouseEvent) => {
                  if (event?.detail === 0) setSelected(item)
                },
              }}
            >
              <span className="ocean-item-art" style={{
                animationDelay: `${-index * .73}s`,
                animationDuration: `${4.8 + (index % 5) * .6}s`,
                '--ocean-sway': oceanSwimmers.has(item.id) ? '4deg' : '0deg',
              }}>
                <ItemIcon itemId={item.id} owned size={72} />
              </span>
            </button>
          )
        })}
        <div className="ocean-selection" aria-live="polite">
          {selected && <span className="ocean-chip">{selected.name}</span>}
        </div>
      </div>
    </main>
  )
}

type Screen = { name: 'select' } | { name: 'collection' } | { name: 'ocean' } | { name: 'play'; initial: CurrentGame; fresh: boolean }

function App() {
  const [save, setSave] = useState(loadSave)
  const [newItems, setNewItems] = useState<string[]>([])
  const [screen, setScreen] = useState<Screen>({ name: 'select' })
  const [showSplash, setShowSplash] = useState(() => !window.matchMedia(motionPreference).matches)
  useEffect(() => { window.scrollTo(0, 0) }, [screen])

  function persist(next: Save) {
    storeSave(next)
    setSave(next)
  }

  function updateGame(current: CurrentGame, def: StageDef) {
    const game = current.game
    if (game.stageId === ENDLESS_DEF.id) {
      if (game.score > save.progress.endlessBest) {
        persist({ ...save, progress: { ...save.progress, endlessBest: game.score } })
      }
      return
    }
    const result = status(game, def)
    let progress = save.progress
    let reward: Reward | undefined
    if (result === 'won') {
      progress = recordClear(progress, def, game)
      const item = itemForStage(def.id)
      if (item && progress.collection.includes(item.id)) {
        reward = { item, isNew: !save.progress.collection.includes(item.id) }
        if (reward.isNew) setNewItems(items => [...items, item.id])
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
    if (def.id !== ENDLESS_DEF.id) persist({ ...save, current })
    setScreen({ name: 'play', initial: current, fresh: true })
  }

  function resume() {
    if (save.current) setScreen({ name: 'play', initial: save.current, fresh: false })
  }

  function dismissSplash() {
    setShowSplash(false)
  }

  return (
    <>
      <div className="sea" aria-hidden="true" />
      {screen.name !== 'ocean' && (
        <SeaAmbience
          depth={screen.name === 'play' ? depthTier(screen.initial.game.stageId) : undefined}
          showSilhouettes={screen.name !== 'collection'}
        />
      )}
      <div {...{ inert: showSplash }}>
        {screen.name === 'select' ? (
          <StageSelect
            key="select" save={save} choose={choose} resume={resume}
            openCollection={() => setScreen({ name: 'collection' })} openOcean={() => setScreen({ name: 'ocean' })}
          />
        ) : screen.name === 'collection' ? (
          <Collection
            key="collection" collection={save.progress.collection} newItems={newItems}
            markSeen={id => setNewItems(items => items.filter(itemId => itemId !== id))}
            back={() => setScreen({ name: 'select' })}
          />
        ) : screen.name === 'ocean' ? (
          <Ocean
            key="ocean" progress={save.progress} back={() => setScreen({ name: 'select' })}
            place={(id, position) => persist({
              ...save, progress: { ...save.progress, ocean: { ...save.progress.ocean, [id]: position } },
            })}
          />
        ) : (
          <Play
            key={`play-${screen.initial.game.stageId}`} initial={screen.initial} fresh={screen.fresh} progress={save.progress}
            onGameChange={updateGame} select={() => setScreen({ name: 'select' })} choose={choose}
          />
        )}
      </div>
      {showSplash && <Splash dismiss={dismissSplash} />}
    </>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
