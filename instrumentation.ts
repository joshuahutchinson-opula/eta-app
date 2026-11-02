// instrumentation.ts — runs once when the server starts (dev and prod).
// Fails loudly instead of running with an unsigned or guessable session secret.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not set. Add it to .env (local) or the Railway variables — any long random string.')
  }
}
