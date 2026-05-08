import Card from './Card.jsx'
import { isWild } from '../game/deck.js'

export default function TableCenter({
  drawPileSize,
  topCard,
  activeColor,
  canDraw,
  onDraw,
  drawAnchorRef,
  discardAnchorRef,
}) {
  const stackSize = Math.min(Math.max(drawPileSize, 1), 3)
  const showColorIndicator = topCard && isWild(topCard) && activeColor
  return (
    <div className="table-center">
      <div className="pile">
        <div className="pile-label">Stapel ({drawPileSize})</div>
        <div
          ref={drawAnchorRef}
          className={`draw-pile ${canDraw ? 'clickable' : ''}`}
          onClick={canDraw ? onDraw : undefined}
        >
          {Array.from({ length: stackSize }).map((_, i) => (
            <Card key={i} faceDown />
          ))}
        </div>
      </div>
      <div className="pile">
        <div className="pile-label">Ablage</div>
        <div ref={discardAnchorRef} className="discard-pile">
          {topCard && <Card card={topCard} className="animate-pop" />}
          {showColorIndicator && (
            <div className={`color-indicator ${activeColor}`} />
          )}
        </div>
      </div>
    </div>
  )
}
