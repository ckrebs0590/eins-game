import { useState } from 'react'

const DIFFICULTIES = [
  { id: 'easy', label: 'Einfach' },
  { id: 'medium', label: 'Mittel' },
  { id: 'hard', label: 'Schwer' },
]

export default function Menu({ onStart, onMultiplayer }) {
  const [difficulty, setDifficulty] = useState('easy')
  return (
    <div className="menu-screen">
      <div>
        <h1 className="menu-title">Eins!</h1>
        <p className="menu-subtitle">Das Kartenspiel</p>
      </div>
      <div className="menu-card">
        <div className="menu-label">Schwierigkeit (Solo)</div>
        <div className="difficulty-row">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              className={`diff-btn ${difficulty === d.id ? 'active' : ''}`}
              onClick={() => setDifficulty(d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
      <button className="start-btn" onClick={() => onStart(difficulty)}>
        Solo spielen
      </button>
      <div className="menu-mp-row">
        <button className="mp-btn" onClick={() => onMultiplayer('host')}>
          Mit Freunden spielen (Host)
        </button>
        <button className="mp-btn" onClick={() => onMultiplayer('join')}>
          Raum beitreten
        </button>
      </div>
    </div>
  )
}
