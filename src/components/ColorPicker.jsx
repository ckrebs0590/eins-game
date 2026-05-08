import { COLORS } from '../game/deck.js'

const LABELS = { red: 'Rot', yellow: 'Gelb', green: 'Grün', blue: 'Blau' }

export default function ColorPicker({ onPick }) {
  return (
    <div className="color-picker-overlay">
      <div className="color-picker">
        <h2>Farbe wählen</h2>
        <div className="color-picker-grid">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`color-option ${c}`}
              onClick={() => onPick(c)}
              aria-label={LABELS[c]}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
