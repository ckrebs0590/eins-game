export const COLORS = ['red', 'yellow', 'green', 'blue']
export const NUMBER_VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
export const ACTION_VALUES = ['skip', 'reverse', 'draw2']
export const WILD_VALUES = ['wild', 'wild4']

let nextId = 0
const makeCard = (color, value) => ({ id: `c${nextId++}`, color, value })

export function createDeck() {
  nextId = 0
  const deck = []
  for (const color of COLORS) {
    deck.push(makeCard(color, '0'))
    for (const v of NUMBER_VALUES.slice(1)) {
      deck.push(makeCard(color, v))
      deck.push(makeCard(color, v))
    }
    for (const v of ACTION_VALUES) {
      deck.push(makeCard(color, v))
      deck.push(makeCard(color, v))
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push(makeCard('wild', 'wild'))
    deck.push(makeCard('wild', 'wild4'))
  }
  return deck
}

export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function isWild(card) {
  return card.color === 'wild'
}

export function isAction(card) {
  return ACTION_VALUES.includes(card.value) || WILD_VALUES.includes(card.value)
}
