// lib/validate.ts — request body validation for write routes. Each route
// declares a zod schema of exactly the fields it accepts; anything else in
// the body is dropped, so nothing reaches Prisma that the route didn't list.
import { NextResponse } from 'next/server'
import { z } from 'zod'

export { z }

type Parsed<T> = { ok: true; data: T } | { ok: false; response: NextResponse }

function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0]
  if (!issue) return 'Check the details and try again'
  const field = issue.path.join('.')
  return field ? `${field}: ${issue.message}` : issue.message
}

export async function parseBody<S extends z.ZodTypeAny>(request: Request, schema: S): Promise<Parsed<z.infer<S>>> {
  const raw = await request.json().catch(() => undefined)
  const result = schema.safeParse(raw ?? {})
  if (!result.success) {
    return { ok: false, response: NextResponse.json({ error: firstIssue(result.error), code: 'INVALID_BODY' }, { status: 400 }) }
  }
  return { ok: true, data: result.data }
}

// Shared field shapes.
export const id = z.string().min(1).max(64)
export const httpsUrl = z.string().trim().url().max(2000).refine(u => u.startsWith('https://'), 'must be an https link')
export const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD')
export const hhmm = z.string().regex(/^\d{1,2}:\d{2}$/, 'use HH:MM')
export const lat = z.number().finite().min(-90).max(90)
export const lng = z.number().finite().min(-180).max(180)
export const text = (max: number) => z.string().trim().max(max)
