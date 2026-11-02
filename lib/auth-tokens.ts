// lib/auth-tokens.ts — single-use emailed tokens (email verification and
// password reset). Only a sha256 of each token is stored.
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { passwordResetEmail, send, verificationEmail } from '@/lib/email'

export const VERIFY_TTL_MS = 48 * 3600000
export const RESET_TTL_MS = 3600000

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function newToken(): string {
  return crypto.randomBytes(32).toString('base64url')
}

/** Creates a verification link for the user and emails it. Returns the raw token (for dev logging only). */
export async function sendVerification(user: { id: string; email: string; name: string }): Promise<string> {
  const token = newToken()
  await prisma.emailVerificationToken.create({
    data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + VERIFY_TTL_MS) }
  })
  await send(verificationEmail(user.email, user.name, token))
  return token
}

export async function sendPasswordReset(user: { id: string; email: string }): Promise<string> {
  const token = newToken()
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) }
  })
  await send(passwordResetEmail(user.email, token))
  return token
}
