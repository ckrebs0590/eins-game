import Card from './Card.jsx'
import { canPlay } from '../game/rules.js'

export default function Hand({ hand, topCard, activeColor, onPlay, isMyTurn, outgoingIds, registerCardRef }) {
  return (
    <div className="player-hand">
      {hand.map((card) => {
        const playable = isMyTurn && canPlay(card, topCard, activeColor)
        const outgoing = outgoingIds?.has(card.id)
        return (
          <div
            key={card.id}
            ref={(el) => registerCardRef && registerCardRef(card.id, el)}
            className={`hand-slot${outgoing ? ' outgoing-slot' : ''}`}
          >
            <Card
              card={card}
              playable={playable}
              onClick={() => onPlay(card)}
              className={outgoing ? 'outgoing' : ''}
            />
          </div>
        )
      })}
    </div>
  )
}
