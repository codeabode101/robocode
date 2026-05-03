import { WebSocketServer, WebSocket } from 'ws'
import { parseScript } from '../services/scriptParser'
import { simulateBattle } from '../services/battleEngine'

interface Client {
  ws: WebSocket
  userId?: string
  matchId?: string
}

const clients = new Map<WebSocket, Client>()

export function setupWebSocket(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket) => {
    const client: Client = { ws }
    clients.set(ws, client)

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString())
        handleMessage(ws, message)
      } catch (error) {
        ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid message format' }))
      }
    })

    ws.on('close', () => {
      const client = clients.get(ws)
      if (client?.matchId) {
        // Notify opponent
        broadcastToMatch(client.matchId, {
          type: 'OPPONENT_DISCONNECTED'
        }, ws)
      }
      clients.delete(ws)
    })
  })
}

function handleMessage(ws: WebSocket, message: any) {
  const client = clients.get(ws)
  if (!client) return

  switch (message.type) {
    case 'JOIN_ROOM':
      client.matchId = message.matchId
      client.userId = message.userId
      broadcastToMatch(message.matchId, {
        type: 'OPPONENT_JOINED',
        opponentUsername: message.username,
        opponentRobotName: message.robotName
      }, ws)
      break

    case 'LOCK_SCRIPT':
      client.matchId = message.matchId
      // Store script (in production: save to DB)
      broadcastToMatch(message.matchId, {
        type: 'OPPONENT_LOCKED'
      }, ws)
      break

    case 'READY':
      // Check if both players ready, then simulate
      broadcastToMatch(message.matchId, {
        type: 'BOTH_LOCKED'
      })
      // Simulate battle
      setTimeout(() => simulateAndSend(message.matchId), 1000)
      break
  }
}

function simulateAndSend(matchId: string) {
  // Mock scripts - in production, fetch from DB
  const script1 = `if (myHP < 30) { heal(); } else { attack(); }`
  const script2 = `if (tickNumber % 2 == 0) { defend(); } else { attack(); }`

  const { ast: ast1 } = parseScript(script1)
  const { ast: ast2 } = parseScript(script2)

  if (ast1 && ast2) {
    const replay = simulateBattle(ast1, ast2, Date.now())
    broadcastToMatch(matchId, {
      type: 'BATTLE_RESULT',
      replayLog: replay,
      winner: replay.winner
    })
  }
}

function broadcastToMatch(matchId: string, message: any, exclude?: WebSocket) {
  clients.forEach((client, ws) => {
    if (client.matchId === matchId && ws !== exclude && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
    }
  })
}
