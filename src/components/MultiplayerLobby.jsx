import { useEffect, useRef, useState } from 'react'
import { createHost, joinHost } from '../multiplayer/peer.js'
import { MSG } from '../multiplayer/messages.js'

const STORED_NAME_KEY = 'eins.playerName'

function readStoredName() {
  try { return localStorage.getItem(STORED_NAME_KEY) || '' } catch { return '' }
}
function storeName(n) {
  try { localStorage.setItem(STORED_NAME_KEY, n) } catch {}
}

export default function MultiplayerLobby({ initialMode, onAbort, onStart }) {
  const [stage, setStage] = useState(initialMode === 'host' ? 'host-setup' : 'join-setup')
  const [name, setName] = useState(readStoredName())
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [players, setPlayers] = useState([])
  const [botCount, setBotCount] = useState(0)
  const [difficulty, setDifficulty] = useState('easy')
  const controllerRef = useRef(null)
  const handedOffRef = useRef(false)

  useEffect(() => {
    return () => {
      if (controllerRef.current && !handedOffRef.current) {
        try { controllerRef.current.close() } catch {}
      }
    }
  }, [])

  const localCleanup = () => {
    if (controllerRef.current) {
      try { controllerRef.current.close() } catch {}
      controllerRef.current = null
    }
  }

  const startHosting = async () => {
    if (!name.trim()) { setError('Bitte Namen eingeben'); return }
    setError(null); setBusy(true)
    storeName(name.trim())
    try {
      const hostName = name.trim()
      const initial = [{ peerId: 'host', name: hostName, isBot: false, isHost: true }]
      const ctrl = await createHost()
      controllerRef.current = ctrl
      const list = [...initial]

      ctrl.onPlayerJoin = (peerId, n) => {
        if (list.length >= 4) {
          ctrl.kick(peerId)
          return
        }
        if (!list.find((p) => p.peerId === peerId)) {
          list.push({ peerId, name: n, isBot: false, isHost: false })
          setPlayers([...list])
          ctrl.broadcast({
            type: MSG.LOBBY,
            players: list.map(({ peerId, name, isHost }) => ({ peerId, name, isHost })),
          })
        }
      }
      ctrl.onPlayerLeave = (peerId) => {
        const idx = list.findIndex((p) => p.peerId === peerId)
        if (idx >= 0) {
          list.splice(idx, 1)
          setPlayers([...list])
          ctrl.broadcast({
            type: MSG.LOBBY,
            players: list.map(({ peerId, name, isHost }) => ({ peerId, name, isHost })),
          })
        }
      }

      setPlayers(list)
      setStage('host-lobby')
    } catch (e) {
      setError(e?.message || 'Konnte Raum nicht erstellen')
    } finally {
      setBusy(false)
    }
  }

  const doJoin = async () => {
    if (!name.trim()) { setError('Bitte Namen eingeben'); return }
    if (!code.trim()) { setError('Bitte Code eingeben'); return }
    setError(null); setBusy(true)
    storeName(name.trim())
    try {
      const ctrl = await joinHost({ code: code.trim(), name: name.trim() })
      controllerRef.current = ctrl

      ctrl.onMessage = (msg) => {
        if (msg.type === MSG.LOBBY) {
          setPlayers(msg.players || [])
        } else if (msg.type === MSG.START) {
          // Hand controller to App for game phase
          handedOffRef.current = true
          onStart({
            role: 'client',
            controller: ctrl,
            selfId: ctrl.peerId,
            initialState: msg.state,
            difficulty: msg.difficulty,
          })
        } else if (msg.type === MSG.KICK) {
          setError('Vom Host entfernt')
          localCleanup()
          setStage('join-setup')
        }
      }
      ctrl.onClose = () => {
        if (handedOffRef.current) return
        setError('Verbindung zum Host beendet')
        controllerRef.current = null
        setStage('join-setup')
      }

      setPlayers([])
      setStage('client-lobby')
    } catch (e) {
      setError(e?.message || 'Beitreten fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  const startGameAsHost = () => {
    const ctrl = controllerRef.current
    if (!ctrl) return
    const humans = players
    if (humans.length < 1) return
    const totalPlayers = Math.min(4, humans.length + botCount)
    const botsNeeded = totalPlayers - humans.length
    const botNames = ['Bot Anna', 'Bot Ben', 'Bot Clara']
    const allPlayers = [
      ...humans.map((h) => ({ id: h.peerId, name: h.name, isBot: false })),
      ...Array.from({ length: botsNeeded }, (_, i) => ({
        id: `bot${i + 1}`,
        name: botNames[i] || `Bot ${i + 1}`,
        isBot: true,
      })),
    ]
    handedOffRef.current = true
    onStart({
      role: 'host',
      controller: ctrl,
      selfId: 'host',
      gamePlayers: allPlayers,
      difficulty,
    })
  }

  const copyCode = () => {
    const c = controllerRef.current?.code
    if (c) try { navigator.clipboard.writeText(c) } catch {}
  }

  if (stage === 'host-setup') {
    return (
      <div className="mp-screen">
        <div className="mp-card">
          <h2>Raum erstellen</h2>
          <input
            className="mp-input"
            placeholder="Dein Name"
            maxLength={20}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {error && <div className="mp-error">{error}</div>}
          <div className="mp-actions">
            <button className="action-btn" onClick={onAbort} disabled={busy}>Zurück</button>
            <button className="action-btn primary" onClick={startHosting} disabled={busy || !name.trim()}>
              {busy ? 'Starte…' : 'Raum erstellen'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (stage === 'host-lobby') {
    const room = controllerRef.current?.code || '???'
    const totalSlots = Math.min(4, players.length + botCount)
    return (
      <div className="mp-screen">
        <div className="mp-card mp-card-wide">
          <h2>Raum-Code</h2>
          <div className="mp-code" onClick={copyCode} title="Klick zum Kopieren">{room}</div>
          <div className="mp-hint">Code mit Freunden teilen — sie tippen ihn bei „Beitreten" ein.</div>

          <div className="mp-section">
            <div className="mp-section-title">Spieler ({players.length}/4)</div>
            <ul className="mp-player-list">
              {players.map((p) => (
                <li key={p.peerId} className="mp-player">
                  <span>{p.name}{p.isHost ? ' (Du, Host)' : ''}</span>
                </li>
              ))}
              {players.length < 4 && (
                <li className="mp-player mp-player-empty">Warte auf weitere Spieler…</li>
              )}
            </ul>
          </div>

          <div className="mp-section">
            <div className="mp-section-title">Bots auffüllen ({Math.min(botCount, 4 - players.length)})</div>
            <input
              type="range"
              min="0"
              max={Math.max(0, 4 - players.length)}
              step="1"
              value={Math.min(botCount, 4 - players.length)}
              onChange={(e) => setBotCount(parseInt(e.target.value))}
              className="speed-slider"
            />
            <div className="mp-hint">Insgesamt: {totalSlots} Spieler</div>
          </div>

          <div className="mp-section">
            <div className="mp-section-title">Schwierigkeit (Bots)</div>
            <div className="difficulty-row">
              {['easy', 'medium', 'hard'].map((d) => (
                <button
                  key={d}
                  className={`diff-btn ${difficulty === d ? 'active' : ''}`}
                  onClick={() => setDifficulty(d)}
                >
                  {d === 'easy' ? 'Leicht' : d === 'medium' ? 'Mittel' : 'Schwer'}
                </button>
              ))}
            </div>
          </div>

          <div className="mp-actions">
            <button className="action-btn" onClick={() => { localCleanup(); onAbort() }}>Abbrechen</button>
            <button
              className="action-btn primary"
              onClick={startGameAsHost}
              disabled={totalSlots < 2}
            >
              Spiel starten ({totalSlots} Spieler)
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (stage === 'join-setup') {
    return (
      <div className="mp-screen">
        <div className="mp-card">
          <h2>Raum beitreten</h2>
          <input
            className="mp-input"
            placeholder="Dein Name"
            maxLength={20}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="mp-input mp-code-input"
            placeholder="Code (z. B. ABC23)"
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoCapitalize="characters"
          />
          {error && <div className="mp-error">{error}</div>}
          <div className="mp-actions">
            <button className="action-btn" onClick={onAbort} disabled={busy}>Zurück</button>
            <button className="action-btn primary" onClick={doJoin} disabled={busy || !name.trim() || !code.trim()}>
              {busy ? 'Verbinde…' : 'Beitreten'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (stage === 'client-lobby') {
    return (
      <div className="mp-screen">
        <div className="mp-card mp-card-wide">
          <h2>Warte auf Start…</h2>
          <div className="mp-section">
            <div className="mp-section-title">Spieler im Raum</div>
            <ul className="mp-player-list">
              {players.map((p) => (
                <li key={p.peerId} className="mp-player">
                  <span>{p.name}{p.isHost ? ' (Host)' : ''}</span>
                </li>
              ))}
              {players.length === 0 && <li className="mp-player mp-player-empty">Verbindung steht…</li>}
            </ul>
          </div>
          <div className="mp-actions">
            <button className="action-btn" onClick={() => { localCleanup(); onAbort() }}>Verlassen</button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
