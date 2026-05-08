import { COLORS, isWild } from './deck.js'
import { getPlayableCards } from './rules.js'

export function chooseBotMove(state, botId) {
  const bot = state.players.find((p) => p.id === botId)
  const top = state.discardPile[state.discardPile.length - 1]
  const playable = getPlayableCards(bot.hand, top, state.activeColor)
  if (playable.length === 0) return { action: 'draw' }

  const difficulty = state.difficulty || 'easy'
  let card
  if (difficulty === 'easy') {
    card = playable[Math.floor(Math.random() * playable.length)]
  } else if (difficulty === 'medium') {
    card = chooseMedium(playable, bot.hand)
  } else {
    card = chooseHard(playable, bot.hand, state, botId)
  }

  let chosenColor = null
  if (isWild(card)) chosenColor = chooseColor(bot.hand, difficulty)

  return { action: 'play', cardId: card.id, chosenColor }
}

function chooseMedium(playable, hand) {
  const nonWild = playable.filter((c) => !isWild(c))
  const action = nonWild.find((c) => ['draw2', 'skip', 'reverse'].includes(c.value))
  if (action) return action
  const numbers = nonWild.filter((c) => /^\d$/.test(c.value))
  if (numbers.length > 0) {
    const colorCounts = countColors(hand)
    numbers.sort((a, b) => (colorCounts[b.color] || 0) - (colorCounts[a.color] || 0))
    return numbers[0]
  }
  return playable[0]
}

function chooseHard(playable, hand, state, botId) {
  const nextPlayerIdx = nextIndex(state)
  const nextPlayer = state.players[nextPlayerIdx]
  const nextHandSize = nextPlayer.hand.length

  const wild4 = playable.find((c) => c.value === 'wild4')
  const draw2 = playable.find((c) => c.value === 'draw2')
  if (nextHandSize <= 2 && wild4) return wild4
  if (nextHandSize <= 2 && draw2) return draw2

  const nonWild = playable.filter((c) => !isWild(c))
  const action = nonWild.find((c) => ['draw2', 'skip', 'reverse'].includes(c.value))
  if (action && nextHandSize <= 4) return action

  const numbers = nonWild.filter((c) => /^\d$/.test(c.value))
  if (numbers.length > 0) {
    const colorCounts = countColors(hand)
    numbers.sort((a, b) => {
      const diff = (colorCounts[b.color] || 0) - (colorCounts[a.color] || 0)
      if (diff !== 0) return diff
      return parseInt(b.value) - parseInt(a.value)
    })
    return numbers[0]
  }
  if (action) return action
  const wild = playable.find((c) => c.value === 'wild')
  if (wild) return wild
  return playable[0]
}

function chooseColor(hand, difficulty) {
  const counts = countColors(hand)
  if (difficulty === 'easy') {
    return COLORS[Math.floor(Math.random() * COLORS.length)]
  }
  let best = COLORS[0]
  let bestCount = -1
  for (const c of COLORS) {
    if ((counts[c] || 0) > bestCount) {
      bestCount = counts[c] || 0
      best = c
    }
  }
  return best
}

function countColors(hand) {
  const counts = {}
  for (const c of hand) {
    if (c.color !== 'wild') counts[c.color] = (counts[c.color] || 0) + 1
  }
  return counts
}

function nextIndex(state) {
  const total = state.players.length
  const step = state.direction
  return (((state.currentPlayer + step) % total) + total) % total
}

export function botShouldCallEins(difficulty) {
  if (difficulty === 'easy') return Math.random() > 0.4
  if (difficulty === 'medium') return Math.random() > 0.15
  return true
}
