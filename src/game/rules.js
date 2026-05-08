import { isWild } from './deck.js'

export function canPlay(card, topCard, activeColor) {
  if (isWild(card)) return true
  const compareColor = activeColor || topCard.color
  if (card.color === compareColor) return true
  if (card.value === topCard.value && !isWild(topCard)) return true
  return false
}

export function getPlayableCards(hand, topCard, activeColor) {
  return hand.filter((c) => canPlay(c, topCard, activeColor))
}

export function nextPlayerIndex(currentIndex, direction, total, skipCount = 0) {
  const step = direction * (1 + skipCount)
  return (((currentIndex + step) % total) + total) % total
}
