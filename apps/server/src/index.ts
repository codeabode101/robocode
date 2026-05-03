import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import battleRouter from './routes/battle'
import questionsRouter from './routes/questions'
import authRouter from './routes/auth'
import playerRouter from './routes/player'
import shopRouter from './routes/shop'
import storyRouter from './routes/story'
import { setupWebSocket } from './websocket/wsServer'

dotenv.config()

const app = express()
const server = createServer(app)

// Middleware
app.use(cors())
app.use(express.json())

// Routes
app.use('/api/auth', authRouter)
app.use('/api/player', playerRouter)
app.use('/api/battle', battleRouter)
app.use('/api/questions', questionsRouter)
app.use('/api/shop', shopRouter)
app.use('/api/story', storyRouter)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' })
setupWebSocket(wss)

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Robocode server running on port ${PORT}`)
})
