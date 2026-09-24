// components/web/SectionHead.tsx
import Link from 'next/link'

export default function SectionHead({ title, sub, href, linkLabel }: { title: string; sub?: string; href?: string; linkLabel?: string }) {
  return (
    <div className="w-section-head">
      <div>
        <h2 className="w-section-title">{title}</h2>
        {sub ? <p className="w-section-sub">{sub}</p> : null}
      </div>
      {href && linkLabel ? <Link href={href} className="w-link-arrow">{linkLabel} →</Link> : null}
    </div>
  )
}
