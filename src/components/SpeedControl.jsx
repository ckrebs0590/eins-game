export default function SpeedControl({ value, onChange }) {
  const label =
    value <= 0.6 ? 'Sehr langsam' :
    value <= 0.9 ? 'Langsam' :
    value <= 1.1 ? 'Normal' :
    value <= 1.6 ? 'Schnell' : 'Sehr schnell'

  return (
    <div className="speed-control">
      <div className="speed-header">
        <span className="speed-title">Bot-Tempo</span>
        <span className="speed-value">{value.toFixed(1)}× · {label}</span>
      </div>
      <input
        type="range"
        min="0.4"
        max="2.5"
        step="0.1"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="speed-slider"
        aria-label="Bot Spielgeschwindigkeit"
      />
    </div>
  )
}
