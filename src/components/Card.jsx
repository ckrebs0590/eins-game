import { isWild } from '../game/deck.js'

const VALUE_DISPLAY = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
  '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  skip: '⊘',
  reverse: '⇄',
  draw2: '+2',
  wild: '★',
  wild4: '+4',
}

export default function Card({
  card,
  faceDown = false,
  size = 'normal',
  playable = false,
  onClick,
  className = '',
  style,
}) {
  const sizeClass = size === 'large' ? 'large' : size === 'small' ? 'small' : ''
  if (faceDown) {
    return (
      <div
        className={`card back ${sizeClass} ${className}`}
        style={style}
        onClick={onClick}
      >
        <div className="card-inner">
          <div className="logo">Eins!</div>
        </div>
      </div>
    )
  }

  const display = VALUE_DISPLAY[card.value] ?? card.value
  const colorClass = `color-${card.color}`
  const playableClass = onClick ? (playable ? 'playable' : 'not-playable') : ''
  const isWildCard = isWild(card)

  return (
    <div
      className={`card ${colorClass} ${sizeClass} ${playableClass} ${className}`}
      style={style}
      onClick={playable && onClick ? onClick : undefined}
    >
      <div className="corner tl">{display}</div>
      <div className="card-inner">
        {isWildCard && <div className="wild-circle" />}
        <div className="center-value">{display}</div>
      </div>
      <div className="corner br">{display}</div>
    </div>
  )
}
