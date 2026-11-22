import { useEffect, useRef, useState } from 'react'
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

const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]
const start = (def: StageDef, seed = newSeed()): CurrentGame => ({ seed, game: stageFor(def, seededRng(seed)) })
const formatNumber = (value: number) => value.toLocaleString('ja-JP')
const motionPreference = '(prefers-reduced-motion: reduce)'

function collectionColor(def: StageDef) {
  return def.goalType === 'collect' ? def.targetColor : undefined
}

function Stars({ count, animate = false }: { count: number; animate?: boolean }) {
  return (
    <span className={`stars${animate ? ' stars-animated' : ''}`} role="img" aria-label={`星3つのうち${count}つ`}>
      {[0, 1, 2].map(index => (
        <span
          key={index} className={index < count ? 'star-earned' : undefined}
          style={animate ? { animationDelay: `${150 + index * 260}ms` } : undefined} aria-hidden="true"
        >
          {index < count ? '★' : '☆'}
        </span>
      ))}
    </span>
  )
}

function StageSelect({ save, resume, choose, openCollection }: {
  save: Save; resume: () => void; choose: (def: StageDef) => void; openCollection: () => void
}) {
  return (
    <main className="game select-screen">
      <header className="select-header">
        <h1>Aqua Piece</h1>
      </header>
      {save.current && (
        <button type="button" className="button button-primary continue" onClick={resume}>
          <strong>つづきから</strong>
          <span>ステージ {save.current.game.stageId}</span>
        </button>
      )}
      <section aria-labelledby="stage-list-title">
        <div className="stage-list-heading">
          <h2 id="stage-list-title" className="stage-list-title">ステージをえらぶ</h2>
          <button type="button" className="button collection-link" onClick={openCollection}>
            ずかん <span>{save.progress.collection.length}/{ITEMS.length}</span>
          </button>
        </div>
        <div className="stage-list">
          {STAGES.map(def => {
            const locked = def.id > save.progress.unlocked
            const stars = save.progress.stars[def.id] ?? 0
            const best = save.progress.best[def.id]
            const color = collectionColor(def)
            const item = itemForStage(def.id)
            const state = locked ? 'locked' : stars > 0 ? 'cleared' : 'unlocked'
            return (
              <button
                key={def.id} type="button" className={`button card stage-card stage-${state}`}
                disabled={locked} onClick={() => choose(def)}
              >
                <span className="stage-number">ステージ <strong>{def.id}</strong></span>
                <span className="stage-goal">
                  {color === undefined ? `スコア ${formatNumber(def.target)}` : (
                    <><img src={gems[color].asset} alt="" />{gems[color].label} {def.target}個あつめよう</>
                  )}
                </span>
                <span className="stage-record">
                  <span className="stage-record-top">
                    <Stars count={stars} />
                    {item && (
                      <ItemIcon
                        itemId={item.id} owned={save.progress.collection.includes(item.id)}
                        size={24} label={item.name}
                      />
                    )}
                  </span>
                  {locked ? (
                    <span className="stage-lock" role="img" aria-label="ロック中" />
                  ) : best !== undefined && <small>ベスト <strong>{formatNumber(best)}</strong></small>}
                </span>
              </button>
            )
          })}
        </div>
      </section>
    </main>
  )
}

function Collection({ collection, back }: { collection: Progress['collection']; back: () => void }) {
  const [selected, setSelected] = useState<ItemDef | null>(null)
  const detail = useRef<HTMLDivElement>(null)

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
      <div className="collection-grid">
        {ITEMS.map(item => (
          collection.includes(item.id) ? (
            <button
              key={item.id} type="button" className="button card collection-item"
              aria-pressed={selected === item} aria-controls="collection-detail" onClick={() => setSelected(item)}
            >
              <ItemIcon itemId={item.id} owned size={50} />
              <strong>{item.name}</strong>
            </button>
          ) : (
            <div key={item.id} className="card collection-item collection-item-locked">
              <ItemIcon itemId={item.id} owned={false} size={50} />
              <strong>？？？</strong>
              <small>ステージ{item.stageId}をクリアしよう</small>
            </div>
          )
        ))}
      </div>
      <div id="collection-detail" aria-live="polite" ref={detail}>
        {selected && (
          <div className="card collection-detail">
            <h2>{selected.name}</h2>
            <p>{selected.flavor}</p>
            <small>ステージ{selected.stageId}のごほうび</small>
          </div>
        )}
      </div>
    </main>
  )
}

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
      <dt>残り手数</dt>
      <dd>{count}</dd>
    </dl>
  )
}

function Hud({ def, score, count, moves }: { def: StageDef; score: number; count: number; moves: number }) {
  const color = collectionColor(def)
  const value = color === undefined ? score : count
  const progress = Math.min(value, def.target)
  return (
    <section className="hud" aria-label="ステージの進み具合">
      <div className="goal card">
        <div className="goal-label">
          <span id="goal-label">
            {color === undefined ? 'スコア' : <><img src={gems[color].asset} alt="" />{gems[color].label}</>}
          </span>
          <strong>{formatNumber(value)} <small>/ {formatNumber(def.target)}</small></strong>
        </div>
        <div
          className="progress" role="progressbar" aria-labelledby="goal-label"
          aria-valuenow={progress} aria-valuemax={def.target}
        >
          <span style={{ width: `${progress / def.target * 100}%` }} />
        </div>
        {color !== undefined && <small className="secondary-score">スコア <strong>{formatNumber(score)}</strong></small>}
      </div>
      <Moves count={moves} />
    </section>
  )
}

const clearTitle = 'ステージクリア！'
const lossTitle = '手数を使い切りました'

type Reward = { item: ItemDef; isNew: boolean }

function Result({ def, game, won, reward, restart, select, next }: {
  def: StageDef; game: Game; won: boolean; reward?: Reward
  restart: () => void; select: () => void; next?: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => dialog.current?.showModal(), [])
  const color = collectionColor(def)
  return (
    <dialog
      className={`result card${won ? ' result-won' : ' result-lost'}`} ref={dialog} aria-labelledby="result-title"
      onCancel={event => { event.preventDefault(); select() }}
    >
      <p className="stage">ステージ {def.id}</p>
      <h2 id="result-title">{won ? clearTitle : lossTitle}</h2>
      {won && <Stars count={earnedStars(def, game)} animate />}
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
          <div className="result-reward">
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
type Playback = { frames: PlayFrame[]; index: number; message: string }

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
        frames, index: 0,
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
    ? shownChain > 1 ? `${shownChain} Chain!` : '宝石を入れ替えています…'
    : message || (chain > 1 ? `${chain} Chain!` : 'となり合う宝石をタップして入れ替えよう。')

  return (
    <main className="game play-screen">
      <header className="play-header">
        <button type="button" className="button back" onClick={select}>もどる</button>
        <h1>ステージ {def.id}</h1>
      </header>
      <Hud def={def} score={score} count={count} moves={game.moves} />
      <div className="board-frame card">
        <Board
          tiles={tiles} frame={frame} selected={selected} locked={!!playback || result !== 'playing'}
          onTap={tap} onFrameDone={advance}
        />
        <span className={`chain-banner${frame && shownChain > 1 ? ' visible' : ''}`} aria-hidden="true">
          {shownChain} Chain!
        </span>
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

  return (
    <>
      <div className="sea" aria-hidden="true" />
      {screen.name === 'select' ? (
        <StageSelect save={save} choose={choose} resume={resume} openCollection={() => setScreen({ name: 'collection' })} />
      ) : screen.name === 'collection' ? (
        <Collection collection={save.progress.collection} back={() => setScreen({ name: 'select' })} />
      ) : (
        <Play
          key={screen.initial.game.stageId} initial={screen.initial} progress={save.progress}
          onGameChange={updateGame} select={() => setScreen({ name: 'select' })} choose={choose}
        />
      )}
    </>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
