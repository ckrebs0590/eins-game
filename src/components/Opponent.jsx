import { forwardRef } from 'react'
import Card from './Card.jsx'

const Opponent = forwardRef(function Opponent({ player, isActive, hasUno }, ref) {
  const cardCount = player.hand.length
  const visibleCards = Math.min(cardCount, 7)
  return (
    <div className={`opponent ${isActive ? 'active' : ''}`}>
      <div className="opponent-name">{player.name}</div>
      <div ref={ref} className="opponent-cards">
        {Array.from({ length: visibleCards }).map((_, i) => (
          <Card key={i} faceDown size="small" />
        ))}
      </div>
      <div className="opponent-count">{cardCount} Karten</div>
      {hasUno && <div className="eins-badge">EINS!</div>}
    </div>
  )
})

export default Opponent
