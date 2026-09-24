import { Prisma, PrismaClient } from '@prisma/client'

// Errors where the query never reached the database, so running it again
// can't apply anything twice — safe to retry even for writes.
//   P1001: can't reach the database server
//   P2024: timed out waiting for a connection from the pool
const RETRYABLE = new Set(['P1001', 'P2024'])
const BACKOFF_MS = [300, 1000]

function isRetryable(err: unknown): boolean {
  const code = (err as { code?: string; errorCode?: string })?.code ?? (err as { errorCode?: string })?.errorCode
  return (
    (err instanceof Prisma.PrismaClientKnownRequestError || err instanceof Prisma.PrismaClientInitializationError) &&
    typeof code === 'string' &&
    RETRYABLE.has(code)
  )
}

function createClient() {
  // The Railway database proxy drops connections intermittently; ride out
  // short blips instead of failing the whole page render.
  return new PrismaClient().$extends({
    query: {
      async $allOperations({ args, query }) {
        for (let attempt = 0; ; attempt++) {
          try {
            return await query(args)
          } catch (err) {
            if (attempt >= BACKOFF_MS.length || !isRetryable(err)) throw err
            await new Promise(r => setTimeout(r, BACKOFF_MS[attempt]))
          }
        }
      }
    }
  })
}

type ExtendedClient = ReturnType<typeof createClient>

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedClient | undefined
}

export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
