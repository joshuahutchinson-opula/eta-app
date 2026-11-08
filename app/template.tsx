// app/template.tsx — every page (not the tabs, which TabKeeper keeps alive)
// eases in when you open it: a short fade with a small slide, or just the
// fade when a card is growing into the page's hero (lib/morph.ts) or with
// Reduce Motion (app/motion.css). Nothing flashes or cuts.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>
}
