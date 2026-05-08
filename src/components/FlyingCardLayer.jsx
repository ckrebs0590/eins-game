import { useEffect } from 'react'
import Card from './Card.jsx'

export default function FlyingCardLayer({ flights, onComplete }) {
  return (
    <div className="flying-layer">
      {flights.map((f) => (
        <Flight key={f.id} flight={f} onComplete={onComplete} />
      ))}
    </div>
  )
}

function Flight({ flight, onComplete }) {
  const { id, card, fromRect, toRect, mode, duration, size } = flight

  useEffect(() => {
    const t = setTimeout(() => onComplete(id), duration)
    return () => clearTimeout(t)
  }, [id, duration, onComplete])

  const fromCx = fromRect.left + fromRect.width / 2
  const fromCy = fromRect.top + fromRect.height / 2
  const toCx = toRect.left + toRect.width / 2
  const toCy = toRect.top + toRect.height / 2
  const dx = fromCx - toCx
  const dy = fromCy - toCy
  const fromScale = fromRect.width / toRect.width

  const style = {
    position: 'fixed',
    top: toRect.top,
    left: toRect.left,
    width: toRect.width,
    height: toRect.height,
    pointerEvents: 'none',
    zIndex: 500,
    '--fly-from-dx': `${dx}px`,
    '--fly-from-dy': `${dy}px`,
    '--fly-from-scale': fromScale,
    '--fly-duration': `${duration}ms`,
  }

  if (mode === 'flip') {
    return (
      <div className="flying-card flying-card-flipper" style={style}>
        <div className="flip-inner">
          <div className="flip-face flip-back">
            <Card card={card} size={size} faceDown />
          </div>
          <div className="flip-face flip-front">
            <Card card={card} size={size} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flying-card" style={style}>
      <Card card={card} size={size} faceDown={mode === 'face-down'} />
    </div>
  )
}
