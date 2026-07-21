import { useMemo, useState } from 'react'
import SceneHost from '../components/SceneHost'
import { LEVELS } from '../config/levels'
import type { Level } from '../lib/level'
import { sanitizeLevel } from '../lib/level'

// eager glob: all level JSON ships in the bundle; the sanitizer guards each
const rawLevels = import.meta.glob('../levels/*.json', { eager: true, import: 'default' })
const loadLevel = (id: string): Level => sanitizeLevel(rawLevels[`../levels/${id}.json`])

export default function Game() {
  const [levelId, setLevelId] = useState<string>(LEVELS[0])
  const [resetKey, setResetKey] = useState(0)
  const level = useMemo(() => loadLevel(levelId), [levelId])
  const levelNames = useMemo(() => new Map(LEVELS.map((id) => [id, loadLevel(id).name])), [])
  const [remaining, setRemaining] = useState(level.stars.length)
  const [won, setWon] = useState(false)

  const start = (id: string, key: number) => {
    setLevelId(id)
    setResetKey(key)
    setRemaining(loadLevel(id).stars.length)
    setWon(false)
  }

  return (
    <div className="game">
      <SceneHost
        key={`${levelId}:${resetKey}`}
        level={level}
        onProgress={setRemaining}
        onWin={() => setWon(true)}
      />
      <div className="hud">
        <span className="hud-name">SAGITTA</span>
        <select value={levelId} onChange={(e) => start(e.target.value, 0)} aria-label="Level">
          {LEVELS.map((id) => (
            <option key={id} value={id}>
              {id} · {levelNames.get(id)}
            </option>
          ))}
        </select>
        <span className="hud-count">
          stars <b>{remaining}</b>
        </span>
        <span className="hud-spacer" />
        <button onClick={() => start(levelId, resetKey + 1)}>Reset</button>
      </div>
      {won && (
        <div className="win-overlay">
          <h1>Constellation complete</h1>
          <p>orbit to admire it</p>
          <button onClick={() => start(levelId, resetKey + 1)}>Again</button>
        </div>
      )}
    </div>
  )
}
