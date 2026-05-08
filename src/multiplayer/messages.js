export const MSG = {
  HELLO: 'hello',
  LOBBY: 'lobby',
  KICK: 'kick',
  START: 'start',
  STATE: 'state',
  ACTION: 'action',
  PING: 'ping',
}

export const ACTION = {
  PLAY: 'play',
  DRAW: 'draw',
  EINS_CALL: 'eins-call',
  COLOR_PICK: 'color-pick',
}

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

export const ROOM_PREFIX = 'einsgame-'
