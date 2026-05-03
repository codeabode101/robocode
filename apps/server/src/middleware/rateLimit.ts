import { Request, Response, NextFunction } from 'express'

const requestCounts = new Map<string, { count: number; resetTime: number }>()

const LIMITS: Record<string, { requests: number; windowMs: number }> = {
  '/api/battle/validate': { requests: 60, windowMs: 60000 },
  '/api/questions/generate': { requests: 120, windowMs: 60000 },
  '/api/shop/purchase': { requests: 10, windowMs: 60000 },
  '/api/battle/submit': { requests: 5, windowMs: 60000 },
}

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const path = req.path
  const limit = LIMITS[path]
  
  if (!limit) {
    return next()
  }
  
  const clientId = (req as any).userId || req.ip || 'unknown'
  const key = `${clientId}:${path}`
  const now = Date.now()
  
  const record = requestCounts.get(key)
  
  if (!record || now > record.resetTime) {
    requestCounts.set(key, { count: 1, resetTime: now + limit.windowMs })
    return next()
  }
  
  if (record.count >= limit.requests) {
    return res.status(429).json({ error: 'Rate limit exceeded' })
  }
  
  record.count++
  next()
}
