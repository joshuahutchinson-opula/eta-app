// lib/wallet-pay.ts — the placeholder payment step: "Pay with ETA Wallet"
// deducts from User.walletBalance and records a PAYMENT transaction. Real
// payment rails are being decided separately; this keeps bookings end-to-end.
import type { prisma } from '@/lib/prisma'

/** The client handed to prisma.$transaction callbacks (the extended client, minus its lifecycle methods). */
export type TxClient = Omit<typeof prisma, '$extends' | '$transaction' | '$disconnect' | '$connect' | '$on' | '$use'>

export class WalletError extends Error {}

export async function payFromWallet(
  tx: TxClient,
  input: { userId: string; amount: number; fees?: number; tip?: number; description: string; bookingId?: string; vendorId?: string | null }
) {
  // Conditional decrement, so two payments racing can't overdraw the wallet.
  const debited = await tx.user.updateMany({
    where: { id: input.userId, walletBalance: { gte: input.amount } },
    data: { walletBalance: { decrement: input.amount } }
  })
  if (debited.count === 0) throw new WalletError('Not enough in your ETA Wallet — top up and try again')
  return tx.transaction.create({
    data: {
      userId: input.userId,
      amount: input.amount,
      fees: input.fees ?? 0,
      tip: input.tip ?? 0,
      description: input.description,
      rail: 'ETA Wallet',
      type: 'PAYMENT',
      status: 'COMPLETED',
      bookingId: input.bookingId,
      vendorId: input.vendorId ?? null
    }
  })
}
