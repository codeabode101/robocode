import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1]
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' })
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
    ;(req as any).userId = decoded.userId
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1]
  
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
      ;(req as any).userId = decoded.userId
    } catch (error) {
      // Ignore invalid tokens for optional auth
    }
  }
  
  next()
}
