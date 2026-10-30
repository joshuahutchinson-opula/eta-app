// app/receipt/[id]/page.tsx — a payment receipt (bookings and Pay), linked
// from the booking confirmation, My Bookings and the Wallet.
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import Icon from '@/lib/icons'
import Price from '@/components/Price'
import ErrorState from '@/components/ErrorState'
import { authHeaders } from '@/lib/api-client'
import { useLang } from '@/lib/i18n-client'
import { bookingCode } from '@/lib/pricing'

interface Receipt {
  id: string
  amount: number
  tip: number
  fees: number
  description: string | null
  rail: string | null
  type: string
  status: string
  createdAt: string
  vendor: { id: string; name: string } | null
  user: { name: string }
  booking: { id: string; date: string; partySize: number; unitPrice: number | null; endDate: string | null; experience: { name: string } | null; accommodation: { name: string } | null } | null
}

export default function ReceiptPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const { t, lang } = useLang()
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'notFound' | 'error'>('loading')

  const load = useCallback(async () => {
    setState('loading')
    try {
      const res = await fetch(`/api/transactions/${id}`, { headers: authHeaders() })
      if (res.status === 404 || res.status === 401) return setState('notFound')
      if (!res.ok) throw new Error()
      setReceipt(await res.json())
      setState('ready')
    } catch {
      setState('error')
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const locale = lang === 'en' ? 'en-US' : lang
  const subtotal = receipt ? Math.round((receipt.amount - receipt.tip - receipt.fees) * 100) / 100 : 0
  const title = receipt?.booking?.experience?.name ?? receipt?.booking?.accommodation?.name ?? receipt?.vendor?.name ?? receipt?.description ?? t('m.receipt.payment')

  const line = (label: string, usd: number, strong = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: strong ? '0.5px solid var(--separator)' : 'none' }}>
      <span style={{ fontSize: '15px', color: strong ? 'var(--label-primary)' : 'var(--label-secondary)', fontWeight: strong ? 700 : 400 }}>{label}</span>
      <Price usd={usd} style={{ fontSize: strong ? '17px' : '15px', fontWeight: strong ? 700 : 600, color: 'var(--label-primary)' }} />
    </div>
  )

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', padding: '16px 16px 40px' }}>
      <button onClick={() => router.back()} aria-label="Back" style={{ width: '44px', height: '44px', borderRadius: '50%', border: 'none', background: 'var(--system-bg-elevated)', boxShadow: 'var(--shadow-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--label-primary)', marginBottom: '16px' }}>
        <Icon name="back" size={16} />
      </button>

      {state === 'loading' ? (
        <div className="skeleton-card" style={{ height: '320px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
      ) : state === 'error' ? (
        <ErrorState onRetry={load} />
      ) : state === 'notFound' || !receipt ? (
        <div className="empty-state">
          <Icon name="receipt" size={32} style={{ color: 'var(--label-tertiary)' }} />
          <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.receipt.notFound')}</p>
        </div>
      ) : (
        <div className="card" style={{ padding: '20px', cursor: 'default' }}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: receipt.status === 'COMPLETED' ? 'var(--success)' : 'var(--warning)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
              <Icon name={receipt.status === 'COMPLETED' ? 'check' : 'clock'} size={22} />
            </div>
            <p className="section-eyebrow">{t('m.receipt.title')}</p>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--label-primary)', margin: '2px 0 4px' }}>{title}</h1>
            <p style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>
              {new Date(receipt.createdAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Jamaica' })}
            </p>
          </div>

          <div className="divider-faded" style={{ margin: '0 0 8px' }} />
          {receipt.booking?.unitPrice != null && receipt.booking.partySize > 1 && (
            <p style={{ fontSize: '13px', color: 'var(--label-secondary)', padding: '4px 0' }}>
              {receipt.booking.accommodation ? t('m.receipt.nightly') : t('m.receipt.perPerson')}: <Price usd={receipt.booking.unitPrice} compact /> × {receipt.booking.accommodation && receipt.booking.endDate
                ? Math.round((Date.parse(receipt.booking.endDate) - Date.parse(receipt.booking.date)) / 86400000)
                : receipt.booking.partySize}
            </p>
          )}
          {line(t('m.book.subtotal'), subtotal)}
          {receipt.fees > 0 && line(t('m.book.fees'), receipt.fees)}
          {receipt.tip > 0 && line(t('m.pay.tip'), receipt.tip)}
          {line(t('m.book.total'), receipt.amount, true)}

          <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--label-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span>{t('m.receipt.paidWith')}: {receipt.rail ?? t('m.common.notListed')}</span>
            <span>{t('m.receipt.status')}: {receipt.status.charAt(0) + receipt.status.slice(1).toLowerCase()}</span>
            <span className="num-font">{t('m.receipt.ref')}: {bookingCode(receipt.id)}</span>
            {receipt.booking && <span className="num-font">{t('m.receipt.booking')}: {bookingCode(receipt.booking.id)}</span>}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
            {receipt.booking && <Link href="/bookings" className="btn btn-secondary" style={{ flex: 1, textDecoration: 'none' }}>{t('m.profile.bookings')}</Link>}
            <Link href="/wallet" className="btn btn-secondary" style={{ flex: 1, textDecoration: 'none' }}>{t('m.profile.wallet')}</Link>
          </div>
        </div>
      )}
    </main>
  )
}
