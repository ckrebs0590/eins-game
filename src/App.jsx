import { useEffect, useRef, useState, useCallback } from 'react'
import './styles/cards.css'
import './styles/layout.css'
import './styles/animations.css'
import './styles/multiplayer.css'

import {
  createInitialState,
  startNewGame,
  topCard,
  playCard,
  drawUntilPlayable,
  applyEinsPenalty,
  confirmEinsCall,
} from './game/gameState.js'
import { canPlay, getPlayableCards } from './game/rules.js'
import { isWild } from './game/deck.js'
import { chooseBotMove, botShouldCallEins } from './game/bot.js'

import Menu from './components/Menu.jsx'
import Opponent from './components/Opponent.jsx'
import Hand from './components/Hand.jsx'
import TableCenter from './components/TableCenter.jsx'
import ColorPicker from './components/ColorPicker.jsx'
import GameOver from './components/GameOver.jsx'
import FlyingCardLayer from './components/FlyingCardLayer.jsx'
import SpeedControl from './components/SpeedControl.jsx'
import MultiplayerLobby from './components/MultiplayerLobby.jsx'
import { MSG, ACTION } from './multiplayer/messages.js'

const BOT_MIN_DELAY = 1100
const BOT_MAX_DELAY = 1900
const PLAY_FLIGHT_MS = 950
const DRAW_FLIGHT_MS = 760
const DRAW_STAGGER_MS = 420
const POST_PLAY_PAUSE_MS = 320
const EINS_GRACE_MS = 3000
const SPEED_STORAGE_KEY = 'eins.botSpeed'

const HAND_CARD_W = 80
const HAND_CARD_H = 120
const BOT_CARD_W = 50
const BOT_CARD_H = 75

function virtualRect(anchorRect, w, h) {
  return {
    left: anchorRect.left + anchorRect.width / 2 - w / 2,
    top: anchorRect.top + anchorRect.height / 2 - h / 2,
    width: w,
    height: h,
  }
}

function botDelay(speed) {
  const base = BOT_MIN_DELAY + Math.random() * (BOT_MAX_DELAY - BOT_MIN_DELAY)
  return base / Math.max(0.1, speed)
}

function readSpeed() {
  try {
    const v = parseFloat(localStorage.getItem(SPEED_STORAGE_KEY))
    if (!isNaN(v) && v >= 0.3 && v <= 3) return v
  } catch {}
  return 1
}

let flightCounter = 0
const nextFlightId = () => `f${++flightCounter}`

export default function App() {
  const [state, setState] = useState(() => createInitialState())
  const [pendingWildCard, setPendingWildCard] = useState(null)
  const [drawingActive, setDrawingActive] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [flights, setFlights] = useState([])
  const [outgoingIds, setOutgoingIds] = useState(() => new Set())
  const [botSpeed, setBotSpeed] = useState(readSpeed)

  const [mpScreen, setMpScreen] = useState(null)
  const [mpSession, setMpSession] = useState(null)
  const [connectionLost, setConnectionLost] = useState(false)

  const stateRef = useRef(state)
  stateRef.current = state
  const botSpeedRef = useRef(botSpeed)
  botSpeedRef.current = botSpeed
  const mpRef = useRef(null)
  mpRef.current = mpSession

  const selfId = mpSession?.selfId || 'human'
  const selfIdRef = useRef(selfId)
  selfIdRef.current = selfId

  useEffect(() => {
    try { localStorage.setItem(SPEED_STORAGE_KEY, String(botSpeed)) } catch {}
  }, [botSpeed])

  const anchorsRef = useRef({})
  const handCardRefs = useRef(new Map())
  const pendingApplyRef = useRef(new Map())

  const setAnchor = useCallback((id) => (el) => {
    if (el) anchorsRef.current[id] = el
    else delete anchorsRef.current[id]
  }, [])

  const registerHandCardRef = useCallback((cardId, el) => {
    if (el) handCardRefs.current.set(cardId, el)
    else handCardRefs.current.delete(cardId)
  }, [])

  const getRectFor = useCallback((playerId, cardId) => {
    if (playerId === selfIdRef.current && cardId) {
      const el = handCardRefs.current.get(cardId)
      if (el) return el.getBoundingClientRect()
    }
    const anchor = anchorsRef.current[playerId]
    if (!anchor) return null
    const rect = anchor.getBoundingClientRect()
    if (playerId === selfIdRef.current) return rect
    return virtualRect(rect, BOT_CARD_W, BOT_CARD_H)
  }, [])

  const completeFlight = useCallback((flightId) => {
    setFlights((list) => list.filter((f) => f.id !== flightId))
    const apply = pendingApplyRef.current.get(flightId)
    if (apply) {
      pendingApplyRef.current.delete(flightId)
      apply()
    }
  }, [])

  const applyState = useCallback((newState) => {
    setState(newState)
    const mp = mpRef.current
    if (mp?.role === 'host') {
      mp.controller.broadcast({ type: MSG.STATE, state: newState })
    }
  }, [])

  const resetTransient = () => {
    setPendingWildCard(null)
    setDrawingActive(false)
    setAnimating(false)
    setFlights([])
    setOutgoingIds(new Set())
    pendingApplyRef.current.clear()
  }

  const startSoloGame = useCallback((difficulty) => {
    setState(startNewGame(difficulty))
    resetTransient()
  }, [])

  const goToMenu = useCallback(() => {
    if (mpRef.current) {
      try { mpRef.current.controller.close() } catch {}
    }
    setMpSession(null)
    setMpScreen(null)
    setConnectionLost(false)
    setState(createInitialState())
    resetTransient()
  }, [])

  const animatePlay = useCallback((playerId, card, mode, applyCb) => {
    const fromRect = getRectFor(playerId, card.id)
    const toAnchor = anchorsRef.current['discard']
    const toRect = toAnchor ? toAnchor.getBoundingClientRect() : null

    if (!fromRect || !toRect) {
      applyCb()
      return
    }
    const size = 'normal'

    const flightId = nextFlightId()
    setAnimating(true)
    if (playerId === selfIdRef.current) {
      setOutgoingIds((s) => {
        const n = new Set(s)
        n.add(card.id)
        return n
      })
    }

    pendingApplyRef.current.set(flightId, () => {
      applyCb()
      if (playerId === selfIdRef.current) {
        setOutgoingIds((s) => {
          const n = new Set(s)
          n.delete(card.id)
          return n
        })
      }
      setTimeout(() => setAnimating(false), POST_PLAY_PAUSE_MS)
    })

    setFlights((list) => [
      ...list,
      { id: flightId, card, fromRect, toRect, mode, size, duration: PLAY_FLIGHT_MS },
    ])
  }, [getRectFor])

  const animateDraw = useCallback((playerId, cards, mode, applyCb) => {
    const fromAnchor = anchorsRef.current['draw']
    const toAnchor = anchorsRef.current[playerId]
    const fromRect = fromAnchor ? fromAnchor.getBoundingClientRect() : null
    const toAnchorRect = toAnchor ? toAnchor.getBoundingClientRect() : null

    if (!fromRect || !toAnchorRect || !cards || cards.length === 0) {
      applyCb()
      return
    }

    const isSelf = playerId === selfIdRef.current
    const size = isSelf ? 'normal' : 'small'
    const cardW = isSelf ? HAND_CARD_W : BOT_CARD_W
    const cardH = isSelf ? HAND_CARD_H : BOT_CARD_H
    const toRect = virtualRect(toAnchorRect, cardW, cardH)

    setAnimating(true)
    const lastIdx = cards.length - 1
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i]
      const flightId = nextFlightId()
      const isLast = i === lastIdx
      pendingApplyRef.current.set(flightId, () => {
        if (isLast) {
          applyCb()
          setTimeout(() => setAnimating(false), POST_PLAY_PAUSE_MS)
        }
      })
      setTimeout(() => {
        setFlights((list) => [
          ...list,
          { id: flightId, card, fromRect, toRect, mode, size, duration: DRAW_FLIGHT_MS },
        ])
      }, i * DRAW_STAGGER_MS)
    }
  }, [])

  const localPlayCard = useCallback((playerId, cardId, color = null) => {
    const s = stateRef.current
    if (s.status !== 'playing') return
    if (s.players[s.currentPlayer].id !== playerId) return
    const player = s.players.find((p) => p.id === playerId)
    if (!player) return
    const card = player.hand.find((c) => c.id === cardId)
    if (!card) return
    if (!canPlay(card, topCard(s), s.activeColor)) return
    const result = playCard(s, playerId, cardId, color)
    if (result.error) return
    const isSelf = playerId === selfIdRef.current
    const mode = isSelf ? 'face-up' : 'flip'
    animatePlay(playerId, card, mode, () => applyState(result.state))
  }, [animatePlay, applyState])

  const localDraw = useCallback((playerId) => {
    const s = stateRef.current
    if (s.status !== 'playing') return
    if (s.players[s.currentPlayer].id !== playerId) return
    const player = s.players.find((p) => p.id === playerId)
    if (!player) return
    const playable = getPlayableCards(player.hand, topCard(s), s.activeColor)
    if (playable.length > 0) return
    const { state: newState, drawn } = drawUntilPlayable(s, playerId)
    const isSelf = playerId === selfIdRef.current
    const mode = isSelf ? 'flip' : 'face-down'
    setDrawingActive(true)
    animateDraw(playerId, drawn, mode, () => {
      applyState(newState)
      setDrawingActive(false)
    })
  }, [animateDraw, applyState])

  const handleSelfPlay = useCallback((card) => {
    const s = stateRef.current
    if (s.players[s.currentPlayer].id !== selfIdRef.current) return
    if (s.pendingColorChoice) return
    if (drawingActive || animating) return
    if (!canPlay(card, topCard(s), s.activeColor)) return

    if (isWild(card)) {
      setPendingWildCard(card)
      return
    }
    const mp = mpRef.current
    if (mp?.role === 'client') {
      mp.controller.send({ type: MSG.ACTION, action: { type: ACTION.PLAY, cardId: card.id } })
      return
    }
    localPlayCard(selfIdRef.current, card.id)
  }, [drawingActive, animating, localPlayCard])

  const handleColorPick = useCallback((color) => {
    if (!pendingWildCard) return
    const card = pendingWildCard
    setPendingWildCard(null)
    const mp = mpRef.current
    if (mp?.role === 'client') {
      mp.controller.send({ type: MSG.ACTION, action: { type: ACTION.PLAY, cardId: card.id, color } })
      return
    }
    localPlayCard(selfIdRef.current, card.id, color)
  }, [pendingWildCard, localPlayCard])

  const handleSelfDraw = useCallback(() => {
    const s = stateRef.current
    if (s.players[s.currentPlayer].id !== selfIdRef.current) return
    if (drawingActive || animating) return
    const me = s.players.find((p) => p.id === selfIdRef.current)
    if (!me) return
    const playableNow = getPlayableCards(me.hand, topCard(s), s.activeColor)
    if (playableNow.length > 0) return

    const mp = mpRef.current
    if (mp?.role === 'client') {
      mp.controller.send({ type: MSG.ACTION, action: { type: ACTION.DRAW } })
      return
    }
    localDraw(selfIdRef.current)
  }, [drawingActive, animating, localDraw])

  const handleEinsCall = useCallback(() => {
    const mp = mpRef.current
    if (mp?.role === 'client') {
      mp.controller.send({ type: MSG.ACTION, action: { type: ACTION.EINS_CALL } })
      return
    }
    applyState(confirmEinsCall(stateRef.current, selfIdRef.current))
  }, [applyState])

  // Bot autoplay (single + host only)
  useEffect(() => {
    if (mpSession?.role === 'client') return
    if (state.status !== 'playing') return
    if (drawingActive || animating) return
    if (state.pendingColorChoice) return
    if (pendingWildCard) return
    const player = state.players[state.currentPlayer]
    if (!player) return
    if (!player.isBot) return

    const delay = botDelay(botSpeedRef.current)
    const timer = setTimeout(() => {
      const s = stateRef.current
      if (s.status !== 'playing') return
      if (s.players[s.currentPlayer].id !== player.id) return
      const move = chooseBotMove(s, player.id)

      if (move.action === 'draw') {
        const { state: afterDraw, drawn } = drawUntilPlayable(s, player.id)
        animateDraw(player.id, drawn, 'face-down', () => {
          const newMove = chooseBotMove(afterDraw, player.id)
          if (newMove.action === 'play') {
            const playableCard = afterDraw.players
              .find((p) => p.id === player.id)
              .hand.find((c) => c.id === newMove.cardId)
            const result = playCard(afterDraw, player.id, newMove.cardId, newMove.chosenColor)
            if (playableCard && !result.error) {
              applyState(afterDraw)
              setTimeout(() => {
                animatePlay(player.id, playableCard, 'flip', () => applyState(result.state))
              }, 380 / Math.max(0.1, botSpeedRef.current))
            } else {
              applyState(afterDraw)
            }
          } else {
            applyState(afterDraw)
          }
        })
      } else {
        const playableCard = s.players
          .find((p) => p.id === player.id)
          .hand.find((c) => c.id === move.cardId)
        const result = playCard(s, player.id, move.cardId, move.chosenColor)
        if (playableCard && !result.error) {
          animatePlay(player.id, playableCard, 'flip', () => applyState(result.state))
        }
      }
    }, delay)

    return () => clearTimeout(timer)
  }, [state.currentPlayer, state.status, state.discardPile.length, state.activeColor, drawingActive, animating, pendingWildCard, state.pendingColorChoice, animatePlay, animateDraw, applyState, mpSession])

  // Eins penalty timeout (single + host only)
  useEffect(() => {
    if (mpSession?.role === 'client') return
    if (!state.awaitingEinsCall) return
    const { playerId, deadline } = state.awaitingEinsCall
    const player = state.players.find((p) => p.id === playerId)
    if (!player) return

    if (player.isBot) {
      const willCall = botShouldCallEins(state.difficulty)
      if (willCall) {
        const t = setTimeout(() => {
          applyState(confirmEinsCall(stateRef.current, playerId))
        }, 600 + Math.random() * 700)
        return () => clearTimeout(t)
      }
      const t = setTimeout(() => {
        const s = stateRef.current
        if (!s.awaitingEinsCall || s.awaitingEinsCall.playerId !== playerId) return
        applyState(applyEinsPenalty(s, playerId))
      }, EINS_GRACE_MS)
      return () => clearTimeout(t)
    }

    // Human: penalty after grace if not called (host enforces for all humans)
    const remaining = Math.max(0, deadline - Date.now())
    const t = setTimeout(() => {
      const s = stateRef.current
      if (!s.awaitingEinsCall || s.awaitingEinsCall.playerId !== playerId) return
      applyState(applyEinsPenalty(s, playerId))
    }, remaining)
    return () => clearTimeout(t)
  }, [state.awaitingEinsCall, state.difficulty, applyState, mpSession])

  // Multiplayer host: handle remote actions
  const handleRemoteAction = useCallback((peerId, action) => {
    if (!action || !action.type) return
    if (action.type === ACTION.PLAY) {
      localPlayCard(peerId, action.cardId, action.color || null)
    } else if (action.type === ACTION.DRAW) {
      localDraw(peerId)
    } else if (action.type === ACTION.EINS_CALL) {
      applyState(confirmEinsCall(stateRef.current, peerId))
    }
  }, [localPlayCard, localDraw, applyState])

  // Host: route remote player actions into game logic
  useEffect(() => {
    if (mpSession?.role !== 'host') return
    const ctrl = mpSession.controller
    ctrl.onAction = handleRemoteAction
    ctrl.onPlayerLeave = (peerId) => {
      const s = stateRef.current
      if (s.status !== 'playing') return
      // Convert leaving human to bot to keep game flowing
      const idx = s.players.findIndex((p) => p.id === peerId)
      if (idx < 0) return
      const newPlayers = s.players.map((p) =>
        p.id === peerId ? { ...p, isBot: true, name: p.name + ' (offline)' } : p
      )
      applyState({ ...s, players: newPlayers, log: [...s.log, { type: 'leave', message: `${s.players[idx].name} hat das Spiel verlassen` }] })
    }
    return () => { ctrl.onAction = null }
  }, [mpSession, handleRemoteAction, applyState])

  // Client: receive host messages
  useEffect(() => {
    if (mpSession?.role !== 'client') return
    const ctrl = mpSession.controller
    ctrl.onMessage = (msg) => {
      if (msg.type === MSG.STATE) {
        setState(msg.state)
        setOutgoingIds(new Set())
        setDrawingActive(false)
        setAnimating(false)
        setFlights([])
      } else if (msg.type === MSG.START) {
        setState(msg.state)
        resetTransient()
      }
    }
    ctrl.onClose = () => {
      setConnectionLost(true)
    }
    return () => {
      ctrl.onMessage = null
      ctrl.onClose = null
    }
  }, [mpSession])

  // Start MP-Lobby Wahl
  const onMultiplayerChoice = useCallback((mode) => {
    setMpScreen(mode)
  }, [])

  const onMultiplayerStart = useCallback((session) => {
    setMpScreen(null)
    if (session.role === 'host') {
      const ctrl = session.controller
      const players = session.gamePlayers
      const initialState = startNewGame(session.difficulty, players)
      setMpSession(session)
      setState(initialState)
      resetTransient()
      ctrl.broadcast({
        type: MSG.START,
        state: initialState,
        players: players.map((p) => ({ peerId: p.id, name: p.name, isHost: p.id === 'host' })),
        difficulty: session.difficulty,
      })
    } else {
      setMpSession(session)
      setState(session.initialState)
      resetTransient()
    }
  }, [])

  if (state.status === 'menu' && !mpSession) {
    if (mpScreen) {
      return (
        <div className="app">
          <MultiplayerLobby
            initialMode={mpScreen}
            onAbort={() => setMpScreen(null)}
            onStart={onMultiplayerStart}
          />
        </div>
      )
    }
    return (
      <div className="app">
        <Menu onStart={startSoloGame} onMultiplayer={onMultiplayerChoice} />
      </div>
    )
  }

  const me = state.players.find((p) => p.id === selfId) || state.players[0]
  if (!me) {
    return <div className="app"><Menu onStart={startSoloGame} onMultiplayer={onMultiplayerChoice} /></div>
  }
  const opponents = state.players.filter((p) => p.id !== me.id)
  const isMyTurn = state.players[state.currentPlayer]?.id === me.id
  const top = topCard(state)
  const myPlayable = isMyTurn ? getPlayableCards(me.hand, top, state.activeColor) : []
  const canDraw = isMyTurn && myPlayable.length === 0 && !drawingActive && !animating
  const showEinsButton =
    state.awaitingEinsCall && state.awaitingEinsCall.playerId === me.id

  return (
    <div className="app">
      <div className="game-area">
        <div className="opponents-row">
          {opponents.map((p) => (
            <Opponent
              key={p.id}
              ref={setAnchor(p.id)}
              player={p}
              isActive={state.players[state.currentPlayer]?.id === p.id}
              hasUno={p.hand.length === 1 && (!state.awaitingEinsCall || state.awaitingEinsCall.playerId !== p.id)}
            />
          ))}
        </div>

        <TableCenter
          drawPileSize={state.drawPile.length}
          topCard={top}
          activeColor={state.activeColor}
          canDraw={canDraw}
          onDraw={handleSelfDraw}
          drawAnchorRef={setAnchor('draw')}
          discardAnchorRef={setAnchor('discard')}
        />

        <div className={`player-area ${isMyTurn ? 'active' : ''}`} ref={setAnchor(me.id)}>
          <div className="player-info">
            <span className="player-name">{me.name}</span>
            <span>· {me.hand.length} Karten</span>
            {mpSession && <span className="mp-badge">{mpSession.role === 'host' ? 'Host' : 'Online'}</span>}
          </div>
          <Hand
            hand={me.hand}
            topCard={top}
            activeColor={state.activeColor}
            onPlay={handleSelfPlay}
            isMyTurn={isMyTurn && !drawingActive && !animating}
            outgoingIds={outgoingIds}
            registerCardRef={registerHandCardRef}
          />
          {isMyTurn && myPlayable.length === 0 && !drawingActive && !animating && (
            <button className="action-btn primary" onClick={handleSelfDraw}>
              Karte ziehen
            </button>
          )}
        </div>
      </div>

      {showEinsButton && (
        <button className="eins-button" onClick={handleEinsCall}>
          Eins!
        </button>
      )}

      {pendingWildCard && <ColorPicker onPick={handleColorPick} />}

      <FlyingCardLayer flights={flights} onComplete={completeFlight} />

      {(!mpSession || mpSession.role === 'host') && (
        <SpeedControl value={botSpeed} onChange={setBotSpeed} />
      )}

      {connectionLost && (
        <div className="connection-lost-overlay">
          <div className="connection-lost-card">
            <h2>Verbindung verloren</h2>
            <p>Die Verbindung zum Host ist beendet.</p>
            <button className="action-btn primary" onClick={goToMenu}>Zurück zum Menü</button>
          </div>
        </div>
      )}

      {state.status === 'finished' && (
        <GameOver
          winnerName={state.players.find((p) => p.id === state.winnerId)?.name}
          isHumanWinner={state.winnerId === me.id}
          restartLabel={mpSession?.role === 'host' ? 'Neue Runde' : 'Nochmal'}
          hint={mpSession?.role === 'client' ? 'Warte, bis der Host eine neue Runde startet…' : null}
          onRestart={
            mpSession?.role === 'client'
              ? null
              : () => {
                  if (mpSession?.role === 'host') {
                    const initialState = startNewGame(mpSession.difficulty || 'easy', mpSession.gamePlayers)
                    setState(initialState)
                    resetTransient()
                    mpSession.controller.broadcast({
                      type: MSG.START,
                      state: initialState,
                      players: mpSession.gamePlayers.map((p) => ({ peerId: p.id, name: p.name, isHost: p.id === 'host' })),
                      difficulty: mpSession.difficulty || 'easy',
                    })
                  } else {
                    startSoloGame(state.difficulty)
                  }
                }
          }
          onMenu={goToMenu}
        />
      )}
    </div>
  )
}
