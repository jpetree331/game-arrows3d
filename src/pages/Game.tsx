import { useMemo, useState } from 'react'
import SceneHost from '../components/SceneHost'
import raw001 from '../levels/001.json'
import { sanitizeLevel } from '../lib/level'

export default function Game() {
  const level = useMemo(() => sanitizeLevel(raw001), [])
  const [remaining, setRemaining] = useState(level.stars.length)
  const [won, setWon] = useState(false)
  const [resetKey, setResetKey] = useState(0)

  const reset = () => {
    setRemaining(level.stars.length)
    setWon(false)
    setResetKey((k) => k + 1) // remount SceneHost: fresh board from the level
  }

  return (
    <div className="game">
      <SceneHost key={resetKey} level={level} onProgress={setRemaining} onWin={() => setWon(true)} />
      <div className="hud">
        <span className="hud-name">SAGITTA · {level.name}</span>
        <span className="hud-count">
          stars <b>{remaining}</b>
        </span>
        <span className="hud-spacer" />
        <button onClick={reset}>Reset</button>
      </div>
      {won && (
        <div className="win-overlay">
          <h1>Constellation complete</h1>
          <p>orbit to admire it</p>
          <button onClick={reset}>Again</button>
        </div>
      )}
    </div>
  )
}
