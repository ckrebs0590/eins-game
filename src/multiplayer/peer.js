import { Peer } from 'peerjs'
import { MSG, ROOM_PREFIX, generateRoomCode } from './messages.js'

function openPeer(id) {
  return new Promise((resolve, reject) => {
    const peer = id ? new Peer(id) : new Peer()
    let done = false
    const timer = setTimeout(() => {
      if (!done) {
        done = true
        try { peer.destroy() } catch {}
        reject(new Error('Verbindung zum Signalisierungs-Server fehlgeschlagen (Timeout)'))
      }
    }, 12000)
    peer.once('open', () => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve(peer)
    })
    peer.once('error', (err) => {
      if (done) return
      done = true
      clearTimeout(timer)
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
        conn.on('open', () => {
          connections.set(conn.peer, conn)
        })
        conn.on('data', (data) => {
          if (!data || typeof data !== 'object') return
          if (data.type === MSG.HELLO) {
            ctrl.onPlayerJoin?.(conn.peer, String(data.name || 'Spieler').slice(0, 20))
          } else if (data.type === MSG.ACTION) {
            ctrl.onAction?.(conn.peer, data.action)
          }
        })
        conn.on('close', () => {
          connections.delete(conn.peer)
          ctrl.onPlayerLeave?.(conn.peer)
        })
        conn.on('error', () => {
          connections.delete(conn.peer)
          ctrl.onPlayerLeave?.(conn.peer)
        })
      })

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
    const conn = peer.connect(hostId, { reliable: true })
    const timer = setTimeout(() => {
      if (!opened) {
        try { peer.destroy() } catch {}
        reject(new Error('Verbindung fehlgeschlagen — Code prüfen?'))
      }
    }, 12000)

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
      ctrl.onClose?.('closed')
      try { peer.destroy() } catch {}
    })

    conn.on('error', (err) => {
      if (!opened) {
        clearTimeout(timer)
        try { peer.destroy() } catch {}
        reject(err)
      }
    })

    peer.on('error', (err) => {
      if (!opened) {
        clearTimeout(timer)
        try { peer.destroy() } catch {}
        reject(err)
      }
    })
  })
}
