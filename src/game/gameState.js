import { createDeck, shuffle, isWild } from './deck.js'
import { canPlay, getPlayableCards, nextPlayerIndex } from './rules.js'

export const INITIAL_HAND_SIZE = 7

export function createInitialState({ difficulty = 'easy' } = {}) {
  return {
    players: [],
    drawPile: [],
    discardPile: [],
    currentPlayer: 0,
    direction: 1,
    activeColor: null,
    pendingColorChoice: null,
    status: 'menu',
    winnerId: null,
    difficulty,
    log: [],
    pendingDraw: 0,
    awaitingEinsCall: null,
    lastAction: null,
  }
}

export function startNewGame(difficulty = 'easy', customPlayers = null) {
  const deck = shuffle(createDeck())
  const players = customPlayers
    ? customPlayers.map((p) => ({ ...p, hand: [] }))
    : [
        { id: 'human', name: 'Du', isBot: false, hand: [] },
        { id: 'bot1', name: 'Bot Anna', isBot: true, hand: [] },
        { id: 'bot2', name: 'Bot Ben', isBot: true, hand: [] },
        { id: 'bot3', name: 'Bot Clara', isBot: true, hand: [] },
      ]

  for (let i = 0; i < INITIAL_HAND_SIZE; i++) {
    for (const p of players) p.hand.push(deck.pop())
  }

  let starter = deck.pop()
  while (isWild(starter) || ['skip', 'reverse', 'draw2'].includes(starter.value)) {
    deck.unshift(starter)
    starter = deck.pop()
  }

  return {
    ...createInitialState({ difficulty }),
    players,
    drawPile: deck,
    discardPile: [starter],
    activeColor: starter.color,
    status: 'playing',
    log: [{ type: 'start', message: 'Spiel gestartet!' }],
    lastAction: { type: 'start' },
  }
}

export function topCard(state) {
  return state.discardPile[state.discardPile.length - 1]
}

export function refillDrawPileIfNeeded(state) {
  if (state.drawPile.length > 0) return state
  if (state.discardPile.length <= 1) return state
  const top = state.discardPile[state.discardPile.length - 1]
  const rest = state.discardPile.slice(0, -1).map((c) =>
    isWild(c) ? { ...c, color: 'wild' } : c
  )
  return {
    ...state,
    drawPile: shuffle(rest),
    discardPile: [top],
  }
}

export function drawCards(state, playerId, count) {
  let s = state
  const cards = []
  for (let i = 0; i < count; i++) {
    s = refillDrawPileIfNeeded(s)
    if (s.drawPile.length === 0) break
    const card = s.drawPile[s.drawPile.length - 1]
    s = {
      ...s,
      drawPile: s.drawPile.slice(0, -1),
      players: s.players.map((p) =>
        p.id === playerId ? { ...p, hand: [...p.hand, card] } : p
      ),
    }
    cards.push(card)
  }
  return { state: s, drawn: cards }
}

export function drawUntilPlayable(state, playerId) {
  let s = state
  const drawn = []
  let safety = 200
  while (safety-- > 0) {
    s = refillDrawPileIfNeeded(s)
    if (s.drawPile.length === 0) break
    const card = s.drawPile[s.drawPile.length - 1]
    s = {
      ...s,
      drawPile: s.drawPile.slice(0, -1),
      players: s.players.map((p) =>
        p.id === playerId ? { ...p, hand: [...p.hand, card] } : p
      ),
    }
    drawn.push(card)
    if (canPlay(card, topCard(s), s.activeColor)) break
  }
  return { state: s, drawn }
}

export function playCard(state, playerId, cardId, chosenColor = null) {
  const playerIndex = state.players.findIndex((p) => p.id === playerId)
  const player = state.players[playerIndex]
  const card = player.hand.find((c) => c.id === cardId)
  if (!card) return { state, error: 'Karte nicht in der Hand' }
  if (!canPlay(card, topCard(state), state.activeColor)) {
    return { state, error: 'Karte ist nicht spielbar' }
  }
  if (isWild(card) && !chosenColor) {
    return {
      state: { ...state, pendingColorChoice: { playerId, cardId } },
      needsColor: true,
    }
  }

  let s = {
    ...state,
    players: state.players.map((p, i) =>
      i === playerIndex ? { ...p, hand: p.hand.filter((c) => c.id !== cardId) } : p
    ),
    discardPile: [...state.discardPile, card],
    activeColor: isWild(card) ? chosenColor : card.color,
    pendingColorChoice: null,
  }

  const newHand = s.players[playerIndex].hand
  const won = newHand.length === 0

  let direction = s.direction
  let skipNext = false
  let pendingDrawForNext = 0

  if (card.value === 'reverse') {
    direction = -direction
    if (s.players.length === 2) skipNext = true
  } else if (card.value === 'skip') {
    skipNext = true
  } else if (card.value === 'draw2') {
    pendingDrawForNext = 2
    skipNext = true
  } else if (card.value === 'wild4') {
    pendingDrawForNext = 4
    skipNext = true
  }

  s = { ...s, direction }

  let nextIdx = nextPlayerIndex(playerIndex, direction, s.players.length, 0)
  if (pendingDrawForNext > 0) {
    const draw = drawCards(s, s.players[nextIdx].id, pendingDrawForNext)
    s = draw.state
  }
  if (skipNext) {
    nextIdx = nextPlayerIndex(playerIndex, direction, s.players.length, 1)
  }

  let awaitingEinsCall = s.awaitingEinsCall
  if (newHand.length === 1) {
    awaitingEinsCall = { playerId, deadline: Date.now() + 3000 }
  } else if (awaitingEinsCall && awaitingEinsCall.playerId === playerId) {
    awaitingEinsCall = null
  }

  let logEntry = { type: 'play', playerId, card, message: `${player.name} legt ${describeCard(card, chosenColor)}` }
  let log = [...s.log, logEntry]

  if (won) {
    return {
      state: {
        ...s,
        status: 'finished',
        winnerId: playerId,
        log: [...log, { type: 'win', playerId, message: `${player.name} hat gewonnen!` }],
        lastAction: { type: 'win', playerId },
        awaitingEinsCall: null,
      },
    }
  }

  return {
    state: {
      ...s,
      currentPlayer: nextIdx,
      log,
      awaitingEinsCall,
      lastAction: { type: 'play', playerId, card, chosenColor },
    },
  }
}

export function describeCard(card, chosenColor = null) {
  const colorNames = { red: 'Rot', yellow: 'Gelb', green: 'Grün', blue: 'Blau' }
  const valueNames = {
    skip: 'Aussetzen',
    reverse: 'Retour',
    draw2: '+2',
    wild: 'Farbwahl',
    wild4: '+4 Farbwahl',
  }
  if (isWild(card)) {
    const c = chosenColor ? ` (${colorNames[chosenColor]})` : ''
    return `${valueNames[card.value]}${c}`
  }
  const v = valueNames[card.value] || card.value
  return `${colorNames[card.color]} ${v}`
}

export function applyEinsPenalty(state, playerId) {
  const result = drawCards(state, playerId, 2)
  const player = state.players.find((p) => p.id === playerId)
  return {
    ...result.state,
    awaitingEinsCall: null,
    log: [
      ...result.state.log,
      { type: 'eins-penalty', playerId, message: `${player.name} hat 'Eins!' vergessen — 2 Strafkarten!` },
    ],
  }
}

export function confirmEinsCall(state, playerId) {
  if (!state.awaitingEinsCall || state.awaitingEinsCall.playerId !== playerId) return state
  const player = state.players.find((p) => p.id === playerId)
  return {
    ...state,
    awaitingEinsCall: null,
    log: [...state.log, { type: 'eins-call', playerId, message: `${player.name} ruft 'Eins!'` }],
  }
}

export { canPlay, getPlayableCards }
