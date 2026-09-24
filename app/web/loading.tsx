// app/web/loading.tsx — shown instantly during client-side navigation while
// the next page's server data loads, so the click always gets feedback.
// Deliberately avoids the scroll-reveal class names so it's never hidden.
export default function WebLoading() {
  return (
    <div className="w-container" aria-busy="true" aria-live="polite">
      <div style={{ padding: '48px 0 28px' }}>
        <div className="w-skel" style={{ width: 140, height: 14 }} />
        <div className="w-skel" style={{ width: '46%', height: 48, marginTop: 14 }} />
        <div className="w-skel" style={{ width: '62%', height: 18, marginTop: 16 }} />
      </div>
      <div className="w-skel-grid">
        {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="w-skel" style={{ height: 300, borderRadius: 16 }} />)}
      </div>
      <span className="w-sr">Loading…</span>
    </div>
  )
}
