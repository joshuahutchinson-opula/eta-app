// lib/errors.ts — the one way user-facing errors become text.
// API routes answer { error, code } in English (patois where it fits).
// English users see that message as-is; Spanish, German and French users get
// a plain translated message picked by the error code or HTTP status, so
// patois never reaches them.
import { t, type DictKey, type Lang } from '@/lib/i18n'

export class ApiError extends Error {
  status: number
  code?: string
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

const BY_CODE: Record<string, DictKey> = {
  SESSION_EXPIRED: 'm.err.session',
  LOGIN_REQUIRED: 'm.err.login',
  EMAIL_UNVERIFIED: 'm.err.verify',
  RATE_LIMITED: 'm.err.rateLimited',
  INVALID_BODY: 'm.err.invalid',
  FORBIDDEN: 'm.err.forbidden',
  TRIP_FORBIDDEN: 'm.err.tripForbidden',
  SLOT_UNAVAILABLE: 'm.err.slot',
  TOKEN_EXPIRED: 'm.err.linkExpired',
  NETWORK: 'm.err.network'
}

const BY_STATUS: Record<number, DictKey> = {
  400: 'm.err.invalid',
  401: 'm.err.login',
  402: 'm.err.wallet',
  403: 'm.err.forbidden',
  404: 'm.err.notFound',
  409: 'm.err.conflict',
  410: 'm.err.linkExpired',
  429: 'm.err.rateLimited'
}

/** Turns anything thrown (ApiError, Error, network failure) into the message to show. */
export function errorText(error: unknown, lang: Lang): string {
  const isNetwork = error instanceof TypeError || (error instanceof Error && /fetch|network/i.test(error.message) && !(error instanceof ApiError))
  if (isNetwork) return t(lang, 'm.err.network')
  if (lang === 'en' && error instanceof Error && error.message) return error.message
  if (error instanceof ApiError) {
    const key = (error.code && BY_CODE[error.code]) || BY_STATUS[error.status]
    if (key) return t(lang, key)
  }
  return t(lang, 'm.err.generic')
}

/** Reads a failed fetch Response into an ApiError. */
export async function responseError(res: Response): Promise<ApiError> {
  const data = await res.json().catch(() => ({}))
  return new ApiError(typeof data?.error === 'string' ? data.error : '', res.status, typeof data?.code === 'string' ? data.code : undefined)
}
