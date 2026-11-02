// components/LegalDocument.tsx — renders one of the legal documents from
// lib/i18n.ts (legal.<doc>.<n>.h / .p). Server component: reads the
// language cookie, so it works with or without the app shell.
// Every document is a DRAFT pending legal review, and says so at the top.
import Link from 'next/link'
import { t, type DictKey } from '@/lib/i18n'
import { getServerLang } from '@/lib/i18n-server'
import { LEGAL_UPDATED } from '@/lib/legal'
import BackButton from '@/components/BackButton'

export type LegalDoc = 'privacy' | 'terms' | 'vendor' | 'cancel'
const SECTIONS: Record<LegalDoc, number> = { privacy: 9, terms: 8, vendor: 8, cancel: 5 }

export default function LegalDocument({ doc, version, intro }: { doc: LegalDoc; version: string; intro?: DictKey }) {
  const lang = getServerLang()
  const key = (k: string) => t(lang, k as DictKey)
  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '48px' }}>
      <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <BackButton />
        <div className="section-heading">
          <span className="section-eyebrow">{t(lang, 'm.legal.section')}</span>
          <h1 className="section-title">{key(`legal.${doc}.title`)}</h1>
        </div>
      </div>
      <article style={{ padding: '0 16px', maxWidth: '720px', margin: '0 auto' }}>
        <p role="note" style={{ display: 'inline-block', fontSize: '12px', fontWeight: 800, letterSpacing: '0.04em', color: 'var(--error)', border: '1.5px solid var(--error)', borderRadius: '8px', padding: '4px 8px', marginBottom: '8px' }}>
          {t(lang, 'm.legal.draft')}
        </p>
        <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginBottom: '16px' }}>
          {t(lang, 'm.legal.updated', { date: LEGAL_UPDATED })} · {t(lang, 'm.legal.version', { v: version })}
        </p>
        {intro && <p style={{ fontSize: '15px', color: 'var(--label-primary)', marginBottom: '16px', lineHeight: 1.5 }}>{t(lang, intro)}</p>}
        {Array.from({ length: SECTIONS[doc] }, (_, i) => i + 1).map(n => (
          <section key={n} style={{ marginBottom: '18px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '6px' }}>{n}. {key(`legal.${doc}.${n}.h`)}</h2>
            <p style={{ fontSize: '15px', lineHeight: 1.55, color: 'var(--label-primary)' }}>{key(`legal.${doc}.${n}.p`)}</p>
          </section>
        ))}
        <p style={{ fontSize: '13px', color: 'var(--label-secondary)', marginTop: '24px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <Link href="/terms" style={{ color: 'var(--rum-text)' }}>{t(lang, 'm.legal.terms')}</Link>
          <Link href="/privacy" style={{ color: 'var(--rum-text)' }}>{t(lang, 'm.legal.privacy')}</Link>
          <Link href="/policies/cancellation" style={{ color: 'var(--rum-text)' }}>{t(lang, 'm.legal.cancellation')}</Link>
          <Link href="/vendor-agreement" style={{ color: 'var(--rum-text)' }}>{t(lang, 'm.legal.vendorAgreement')}</Link>
        </p>
      </article>
    </main>
  )
}
