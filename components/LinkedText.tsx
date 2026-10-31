// components/LinkedText.tsx — a translated sentence with {placeholders}
// replaced by links, e.g. "I agree to the {terms} and {privacy}".
import Link from 'next/link'

export default function LinkedText({ text, links }: { text: string; links: Record<string, { href: string; label: string }> }) {
  return (
    <>
      {text.split(/(\{\w+\})/).map((part, i) => {
        const key = part.match(/^\{(\w+)\}$/)?.[1]
        const link = key ? links[key] : undefined
        return link
          ? <Link key={i} href={link.href} style={{ color: 'var(--rum-text)', fontWeight: 600 }}>{link.label}</Link>
          : <span key={i}>{part}</span>
      })}
    </>
  )
}

/** A translated sentence with {placeholders} replaced by any element (prices, bold names). */
export function Filled({ text, values }: { text: string; values: Record<string, React.ReactNode> }) {
  return (
    <>
      {text.split(/(\{\w+\})/).map((part, i) => {
        const key = part.match(/^\{(\w+)\}$/)?.[1]
        return <span key={i}>{key && key in values ? values[key] : part}</span>
      })}
    </>
  )
}

/** Only same-site paths are followed after login (no open redirects). */
export function safeNext(value: string | null): string | null {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : null
}
