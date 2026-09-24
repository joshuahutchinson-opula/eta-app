// components/web/WebFooter.tsx
import Link from 'next/link'
import { t, type Lang } from '@/lib/i18n'

export default function WebFooter({ lang }: { lang: Lang }) {
  return (
    <footer className="w-footer">
      <div className="w-container">
        <div className="w-footer-top">
          <div className="w-footer-brand">
            <img className="w-logo-light" src="/logo.png" alt="ETA" />
            <img className="w-logo-dark" src="/logo-dark.png" alt="ETA" />
            <p className="w-muted" style={{ fontSize: 14, lineHeight: 1.6 }}>{t(lang, 'footer.tagline')}</p>
          </div>
          <div className="w-footer-cols">
            <div className="w-footer-col">
              <h4>{t(lang, 'footer.product')}</h4>
              <Link href="/web/explore">{t(lang, 'nav.explore')}</Link>
              <Link href="/web/experiences">{t(lang, 'nav.experiences')}</Link>
              <Link href="/web/photo-spots">{t(lang, 'nav.photoSpots')}</Link>
              <Link href="/web/guides">{t(lang, 'nav.guides')}</Link>
              <Link href="/web/plan">{t(lang, 'nav.planDay')}</Link>
              <Link href="/web/get-the-app">{t(lang, 'nav.getApp')}</Link>
            </div>
            <div className="w-footer-col">
              <h4>{t(lang, 'footer.vendors')}</h4>
              <Link href="/web/for-vendors">{t(lang, 'nav.forVendors')}</Link>
              <Link href="/web/for-vendors#apply">{t(lang, 'footer.applyToList')}</Link>
              <Link href="/web/for-vendors#how-it-works">{t(lang, 'footer.howVetting')}</Link>
            </div>
            <div className="w-footer-col">
              <h4>{t(lang, 'footer.company')}</h4>
              <Link href="/web/best">{t(lang, 'footer.bestOf')}</Link>
              <span className="w-faint" style={{ fontSize: 15 }}>Negril, Jamaica</span>
            </div>
          </div>
        </div>
        <div className="w-footer-bottom">
          <span>© {new Date().getFullYear()} ETA. {t(lang, 'footer.rights')}</span>
          <span>{t(lang, 'footer.madeIn')}</span>
        </div>
      </div>
    </footer>
  )
}
