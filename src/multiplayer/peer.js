import { Peer } from 'peerjs'
import { MSG, ROOM_PREFIX, generateRoomCode } from './messages.js'

const PEER_OPTS = {
  debug: 2,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
    ],
  },
}

function openPeer(id) {
  return new Promise((resolve, reject) => {
    const peer = id ? new Peer(id, PEER_OPTS) : new Peer(PEER_OPTS)
    console.log('[peer] opening peer with id:', id || '(auto)')
    let done = false
    const timer = setTimeout(() => {
      if (!done) {
        done = true
        console.warn('[peer] open timeout after 15s')
        try { peer.destroy() } catch {}
        reject(new Error('Verbindung zum Signalisierungs-Server fehlgeschlagen (Timeout)'))
      }
    }, 15000)
    peer.once('open', (gotId) => {
      if (done) return
      done = true
      clearTimeout(timer)
      console.log('[peer] open ok, id =', gotId)
      resolve(peer)
    })
    peer.once('error', (err) => {
      if (done) return
      done = true
      clearTimeout(timer)
      console.error('[peer] open error:', err?.type, err?.message)
      try { peer.destroy() } catch {}
      reject(err)
    })
  })
}

export async function createHost() {
  let lastErr = null
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode()
    const id = ROOM_PREFIX + code
    try {
      const peer = await openPeer(id)
      const connections = new Map()

      const ctrl = {
        code,
        peerId: peer.id,
        onPlayerJoin: null,
        onPlayerLeave: null,
        onAction: null,
        broadcast(msg) {
          for (const conn of connections.values()) {
            try { conn.send(msg) } catch {}
          }
        },
        sendTo(peerId, msg) {
          const conn = connections.get(peerId)
          if (conn) { try { conn.send(msg) } catch {} }
        },
        kick(peerId) {
          const conn = connections.get(peerId)
          if (conn) {
            try { conn.send({ type: MSG.KICK }) } catch {}
            try { conn.close() } catch {}
            connections.delete(peerId)
          }
        },
        close() {
          for (const conn of connections.values()) {
            try { conn.close() } catch {}
          }
          connections.clear()
          try { peer.destroy() } catch {}
        },
      }

      peer.on('connection', (conn) => {
        console.log('[host] incoming connection from', conn.peer)
        conn.on('open', () => {
          console.log('[host] connection open from', conn.peer)
          connections.set(conn.peer, conn)
        })
        conn.on('data', (data) => {
          if (!data || typeof data !== 'object') return
          if (data.type === MSG.HELLO) {
            console.log('[host] hello from', conn.peer, 'name=', data.name)
            ctrl.onPlayerJoin?.(conn.peer, String(data.name || 'Spieler').slice(0, 20))
          } else if (data.type === MSG.ACTION) {
            ctrl.onAction?.(conn.peer, data.action)
          }
        })
        conn.on('close', () => {
          console.log('[host] connection closed from', conn.peer)
          connections.delete(conn.peer)
          ctrl.onPlayerLeave?.(conn.peer)
        })
        conn.on('error', (e) => {
          console.error('[host] conn error from', conn.peer, e)
          connections.delete(conn.peer)
          ctrl.onPlayerLeave?.(conn.peer)
        })
      })

      peer.on('error', (err) => {
        console.error('[host] peer error:', err?.type, err?.message)
      })

      console.log('[host] ready, code =', code)
      return ctrl
    } catch (err) {
      lastErr = err
      if (err && err.type === 'unavailable-id') continue
      throw err
    }
  }
  throw lastErr || new Error('Konnte keinen Raum erzeugen')
}

export async function joinHost({ code, name }) {
  const cleaned = String(code || '').trim().toUpperCase()
  if (!/^[A-Z0-9]{4,8}$/.test(cleaned)) {
    throw new Error('Code ungültig')
  }
  const peer = await openPeer(null)
  const hostId = ROOM_PREFIX + cleaned

  return new Promise((resolve, reject) => {
    let opened = false
    console.log('[client] connecting to host id:', hostId)
    const conn = peer.connect(hostId, { reliable: true })
    const timer = setTimeout(() => {
      if (!opened) {
        console.warn('[client] connect timeout after 18s')
        try { peer.destroy() } catch {}
        reject(new Error('Verbindung fehlgeschlagen — Code prüfen oder Host-Tab im Vordergrund halten?'))
      }
    }, 18000)

    const ctrl = {
      peerId: peer.id,
      onMessage: null,
      onClose: null,
      send(msg) { try { conn.send(msg) } catch {} },
      close() {
        try { conn.close() } catch {}
        try { peer.destroy() } catch {}
      },
    }

    conn.on('open', () => {
      console.log('[client] data channel open')
      opened = true
      clearTimeout(timer)
      conn.send({ type: MSG.HELLO, name: String(name || 'Spieler').slice(0, 20) })
      resolve(ctrl)
    })

    conn.on('data', (data) => {
      if (!data || typeof data !== 'object') return
      ctrl.onMessage?.(data)
    })

    conn.on('close', () => {
      console.log('[client] connection closed')
      ctrl.onClose?.('closed')
      try { peer.destroy() } catch {}
    })

    conn.on('error', (err) => {
      console.error('[client] conn error:', err?.type, err?.message)
      if (!opened) {
        clearTimeout(timer)
        try { peer.destroy() } catch {}
        reject(new Error(err?.message || 'Verbindung zum Host fehlgeschlagen'))
      }
    })

    peer.on('error', (err) => {
      console.error('[client] peer error:', err?.type, err?.message)
      if (!opened) {
        clearTimeout(timer)
        try { peer.destroy() } catch {}
        reject(new Error(err?.message || 'Peer-Fehler'))
      }
    })
  })
}
