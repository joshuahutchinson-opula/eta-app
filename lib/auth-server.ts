// lib/auth-server.ts — who's calling, from the JWT the app keeps in
// localStorage (eta_token) and sends as "Authorization: Bearer …".
import jwt from 'jsonwebtoken'

export function userIdFromRequest(request: Request): string | null {
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return null
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'eta-secret') as { userId?: string }
    return typeof decoded.userId === 'string' ? decoded.userId : null
  } catch {
    return null
  }
}
