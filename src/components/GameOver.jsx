import { useEffect } from 'react'

export default function GameOver({ winnerName, isHumanWinner, onRestart, onMenu, restartLabel, restartDisabled, hint }) {
  useEffect(() => {
    if (!isHumanWinner) return
    const colors = ['#d72638', '#f4c20d', '#1ea84a', '#1f6feb', '#ffffff']
    const root = document.body
    const pieces = []
    for (let i = 0; i < 60; i++) {
      const el = document.createElement('div')
      el.className = 'confetti'
      el.style.background = colors[i % colors.length]
      const angle = Math.random() * Math.PI * 2
      const dist = 200 + Math.random() * 400
      el.style.setProperty('--cx', `${Math.cos(angle) * dist}px`)
      el.style.setProperty('--cy', `${Math.sin(angle) * dist}px`)
      el.style.animationDelay = `${Math.random() * 0.3}s`
      root.appendChild(el)
      pieces.push(el)
    }
    const timer = setTimeout(() => pieces.forEach((p) => p.remove()), 2000)
    return () => {
      clearTimeout(timer)
      pieces.forEach((p) => p.remove())
    }
  }, [isHumanWinner])

  return (
    <div className="gameover-overlay">
      <div className="gameover-card">
        <h1>{isHumanWinner ? 'Gewonnen!' : 'Verloren'}</h1>
        <div className="winner-name">{winnerName} hat gewonnen</div>
        {hint && <div className="gameover-hint">{hint}</div>}
        <div className="action-buttons">
          {onRestart && (
            <button className="action-btn primary" onClick={onRestart} disabled={restartDisabled}>
              {restartLabel || 'Nochmal'}
            </button>
          )}
          <button className="action-btn" onClick={onMenu}>
            Hauptmenü
          </button>
        </div>
      </div>
    </div>
  )
}
