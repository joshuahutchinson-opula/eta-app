// scripts/fetch-town-media.ts — finds hero footage for Home (TownMedia):
// for Negril, Montego Bay, Ocho Rios, Port Antonio and Kingston, per
// daypart (morning, afternoon, golden hour, night), it searches Pexels
// (videos first, then photos) and Pixabay as a backup, all free for
// commercial use. It ranks landscape, high-resolution, 8–30s drone /
// aerial / golden-hour clips, skips anything that doesn't look like it's in
// Jamaica, and keeps the top 5 candidates for each town and daypart.
//
// Output (scripts/out/, not committed):
//   town-media-candidates.json   every candidate
//   town-media-review.html       a page to preview them and tick the picks;
//                                "Export picks" downloads town-media-picks.json
// Then: npx tsx scripts/import-town-media.ts scripts/out/town-media-picks.json
//
// Needs PEXELS_API_KEY (and PIXABAY_API_KEY for the backup) in .env.
//   npx tsx scripts/fetch-town-media.ts
import 'dotenv/config'
import fs from 'fs'
import path from 'path'

type Town = 'NEGRIL' | 'MONTEGO_BAY' | 'OCHO_RIOS' | 'PORT_ANTONIO' | 'KINGSTON'
type Daypart = 'morning' | 'afternoon' | 'golden' | 'night'

export interface Candidate {
  id: string
  town: Town
  daypart: Daypart
  kind: 'video' | 'photo'
  source: 'Pexels' | 'Pixabay'
  sourceUrl: string
  /** The best original file to upload. */
  file: string
  preview: string
  poster: string | null
  width: number
  height: number
  duration: number | null
  photographer: string
  photographerUrl: string | null
  license: string
  title: string
  score: number
}

const TOWN_NAME: Record<Town, string> = { NEGRIL: 'Negril', MONTEGO_BAY: 'Montego Bay', OCHO_RIOS: 'Ocho Rios', PORT_ANTONIO: 'Port Antonio', KINGSTON: 'Kingston' }

const QUERIES: Record<Town, Record<Daypart, string[]>> = {
  NEGRIL: {
    morning: ['Negril Jamaica beach morning', 'Seven Mile Beach Negril', 'Negril Jamaica aerial'],
    afternoon: ['Negril Jamaica cliffs', 'Negril Jamaica drone', 'Negril turquoise water'],
    golden: ['Negril Jamaica sunset cliffs', "Rick's Cafe Negril sunset", 'Negril sunset'],
    night: ['Negril Jamaica night', 'Jamaica beach bonfire night', 'Negril bar night']
  },
  MONTEGO_BAY: {
    morning: ['Montego Bay Jamaica beach', 'Montego Bay morning', "Doctor's Cave Beach"],
    afternoon: ['Montego Bay aerial', 'Montego Bay Jamaica drone', 'Montego Bay coast'],
    golden: ['Montego Bay sunset', 'Montego Bay Jamaica golden hour', 'Jamaica sunset sea'],
    night: ['Montego Bay night', 'Montego Bay hip strip night', 'Jamaica city lights night']
  },
  OCHO_RIOS: {
    morning: ["Dunn's River Falls", 'Ocho Rios Jamaica beach', 'Ocho Rios morning'],
    afternoon: ['Ocho Rios aerial', "Dunn's River Falls Jamaica", 'Ocho Rios Jamaica drone'],
    golden: ['Ocho Rios sunset', 'Ocho Rios bay golden hour', 'Jamaica north coast sunset'],
    night: ['Ocho Rios night', 'Ocho Rios cruise ship night', 'Jamaica night lights coast']
  },
  PORT_ANTONIO: {
    morning: ['Port Antonio Blue Lagoon', 'Port Antonio Jamaica', 'Frenchmans Cove Jamaica'],
    afternoon: ['Port Antonio Jamaica aerial', 'Rio Grande rafting Jamaica', 'Blue Lagoon Jamaica'],
    golden: ['Port Antonio sunset', 'Portland Jamaica sunset', 'Port Antonio harbour'],
    night: ['Port Antonio night', 'Jamaica marina night', 'Portland Jamaica night']
  },
  KINGSTON: {
    morning: ['Kingston Blue Mountains', 'Blue Mountains Jamaica sunrise', 'Kingston Jamaica morning'],
    afternoon: ['Kingston Jamaica aerial', 'Kingston Jamaica city', 'Kingston Jamaica drone'],
    golden: ['Kingston Jamaica sunset', 'Blue Mountains Jamaica golden hour', 'Port Royal Jamaica'],
    night: ['Kingston Jamaica night', 'Kingston Jamaica city lights', 'New Kingston night']
  }
}

/** Starting points from the brief: always considered for their town. */
const SEEDS: Array<{ town: Town; dayparts: Daypart[]; pexelsVideo?: number; pexelsPhoto?: number }> = [
  { town: 'NEGRIL', dayparts: ['afternoon', 'golden'], pexelsVideo: 20532693 },
  // Listed as Montego Bay on Pexels, but it's Negril's cliffs (Rockhouse).
  { town: 'NEGRIL', dayparts: ['afternoon', 'golden'], pexelsPhoto: 19565413 }
]
/** Photographers who shoot Jamaica: their results rank higher. */
const FAVOURED = ['ranteen-dixon-3207923', '@aviz', 'sean-witter-3054472']

const JAMAICA = /jamaica|negril|montego|mobay|ocho|dunn|port[- ]antonio|blue[- ]lagoon|kingston|blue[- ]mountain|portland|rick'?s|rockhouse|port[- ]royal|seven[- ]mile/i
const CINEMATIC = /drone|aerial|cinematic|sunset|sunrise|golden|timelapse|time[- ]lapse|bird'?s[- ]eye/i

const PEXELS = process.env.PEXELS_API_KEY
const PIXABAY = process.env.PIXABAY_API_KEY
const PEXELS_LICENSE = 'Pexels License — free for commercial use, no attribution required'
const PIXABAY_LICENSE = 'Pixabay Content License — free for commercial use, no attribution required'

async function getJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers })
    if (res.status === 429) { await new Promise(r => setTimeout(r, 2000 * (attempt + 1))); continue }
    if (!res.ok) throw new Error(`${res.status} ${url}`)
    return res.json()
  }
  throw new Error(`rate limited: ${url}`)
}

function score(c: Omit<Candidate, 'score'>, query: string): number {
  const text = `${c.title} ${c.sourceUrl}`
  let s = 0
  if (c.kind === 'video') s += 10
  if (c.width >= c.height * 1.3) s += 6
  if (Math.max(c.width, c.height) >= 1920) s += 4
  else if (Math.max(c.width, c.height) >= 1280) s += 2
  if (c.duration !== null) s += c.duration >= 8 && c.duration <= 30 ? 6 : c.duration > 30 && c.duration <= 60 ? 2 : -2
  if (CINEMATIC.test(text) || CINEMATIC.test(query)) s += CINEMATIC.test(text) ? 4 : 0
  if (JAMAICA.test(text)) s += 8
  if (FAVOURED.some(f => (c.photographerUrl ?? '').includes(f.replace('@', '')))) s += 6
  return s
}

/** Clearly not in Jamaica: nothing in its title or page mentions Jamaica or a Jamaican place. */
const inJamaica = (c: Omit<Candidate, 'score'>) => JAMAICA.test(`${c.title} ${c.sourceUrl} ${c.photographerUrl ?? ''}`) || FAVOURED.some(f => (c.photographerUrl ?? '').includes(f.replace('@', '')))

function pexelsVideo(v: any, town: Town, daypart: Daypart): Omit<Candidate, 'score'> | null {
  const files = (v.video_files ?? []).filter((f: any) => f.file_type === 'video/mp4' && f.width && f.height)
  const best = files.sort((a: any, b: any) => b.width - a.width).find((f: any) => f.width <= 3840) ?? files[0]
  const preview = files.sort((a: any, b: any) => a.width - b.width).find((f: any) => f.width >= 640) ?? best
  if (!best) return null
  const slug = String(v.url ?? '').split('/').filter(Boolean).pop() ?? ''
  return {
    id: `pexels-v-${v.id}-${town}-${daypart}`, town, daypart, kind: 'video', source: 'Pexels', sourceUrl: v.url,
    file: best.link, preview: preview.link, poster: v.image ?? null, width: v.width ?? best.width, height: v.height ?? best.height,
    duration: v.duration ?? null, photographer: v.user?.name ?? 'Unknown', photographerUrl: v.user?.url ?? null, license: PEXELS_LICENSE, title: slug.replace(/-\d+$/, '').replace(/-/g, ' ')
  }
}

function pexelsPhoto(p: any, town: Town, daypart: Daypart): Omit<Candidate, 'score'> {
  return {
    id: `pexels-p-${p.id}-${town}-${daypart}`, town, daypart, kind: 'photo', source: 'Pexels', sourceUrl: p.url,
    file: p.src?.original, preview: p.src?.large ?? p.src?.medium, poster: null, width: p.width, height: p.height, duration: null,
    photographer: p.photographer ?? 'Unknown', photographerUrl: p.photographer_url ?? null, license: PEXELS_LICENSE, title: p.alt || String(p.url).split('/').filter(Boolean).pop()?.replace(/-\d+$/, '').replace(/-/g, ' ') || ''
  }
}

async function searchPexels(town: Town, daypart: Daypart, query: string) {
  if (!PEXELS) return []
  const h = { Authorization: PEXELS }
  const q = encodeURIComponent(query)
  const [videos, photos] = await Promise.all([
    getJson(`https://api.pexels.com/videos/search?query=${q}&orientation=landscape&size=medium&per_page=20`, h).catch(() => ({ videos: [] })),
    getJson(`https://api.pexels.com/v1/search?query=${q}&orientation=landscape&size=large&per_page=15`, h).catch(() => ({ photos: [] }))
  ])
  return [
    ...(videos.videos ?? []).map((v: any) => pexelsVideo(v, town, daypart)).filter(Boolean),
    ...(photos.photos ?? []).map((p: any) => pexelsPhoto(p, town, daypart))
  ] as Array<Omit<Candidate, 'score'>>
}

async function searchPixabay(town: Town, daypart: Daypart, query: string) {
  if (!PIXABAY) return []
  const q = encodeURIComponent(query)
  const [videos, photos] = await Promise.all([
    getJson(`https://pixabay.com/api/videos/?key=${PIXABAY}&q=${q}&per_page=20&safesearch=true`).catch(() => ({ hits: [] })),
    getJson(`https://pixabay.com/api/?key=${PIXABAY}&q=${q}&image_type=photo&orientation=horizontal&min_width=1920&per_page=20&safesearch=true`).catch(() => ({ hits: [] }))
  ])
  const vids = (videos.hits ?? []).map((v: any): Omit<Candidate, 'score'> | null => {
    const big = v.videos?.large?.url ? v.videos.large : v.videos?.medium
    if (!big?.url) return null
    return {
      id: `pixabay-v-${v.id}-${town}-${daypart}`, town, daypart, kind: 'video', source: 'Pixabay', sourceUrl: v.pageURL,
      file: big.url, preview: v.videos?.small?.url ?? big.url, poster: big.thumbnail ?? null, width: big.width, height: big.height,
      duration: v.duration ?? null, photographer: v.user ?? 'Unknown', photographerUrl: v.user_id ? `https://pixabay.com/users/${v.user}-${v.user_id}/` : null, license: PIXABAY_LICENSE, title: v.tags ?? ''
    }
  }).filter(Boolean) as Array<Omit<Candidate, 'score'>>
  const pics = (photos.hits ?? []).map((p: any): Omit<Candidate, 'score'> => ({
    id: `pixabay-p-${p.id}-${town}-${daypart}`, town, daypart, kind: 'photo', source: 'Pixabay', sourceUrl: p.pageURL,
    file: p.largeImageURL, preview: p.webformatURL, poster: null, width: p.imageWidth, height: p.imageHeight, duration: null,
    photographer: p.user ?? 'Unknown', photographerUrl: p.user_id ? `https://pixabay.com/users/${p.user}-${p.user_id}/` : null, license: PIXABAY_LICENSE, title: p.tags ?? ''
  }))
  return [...vids, ...pics]
}

async function seeds(): Promise<Array<Omit<Candidate, 'score'>>> {
  if (!PEXELS) return []
  const h = { Authorization: PEXELS }
  const out: Array<Omit<Candidate, 'score'>> = []
  for (const s of SEEDS) {
    for (const daypart of s.dayparts) {
      if (s.pexelsVideo) {
        const v = await getJson(`https://api.pexels.com/videos/videos/${s.pexelsVideo}`, h).catch(() => null)
        const c = v && pexelsVideo(v, s.town, daypart)
        if (c) out.push({ ...c, title: `${c.title} (Negril — from the brief)` })
      }
      if (s.pexelsPhoto) {
        const p = await getJson(`https://api.pexels.com/v1/photos/${s.pexelsPhoto}`, h).catch(() => null)
        if (p) out.push({ ...pexelsPhoto(p, s.town, daypart), title: 'Rockhouse cliffs, Negril (from the brief)' })
      }
    }
  }
  return out
}

function reviewHtml(all: Candidate[]): string {
  const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
  const groups = Object.keys(QUERIES).flatMap(town => (['morning', 'afternoon', 'golden', 'night'] as Daypart[]).map(dp => ({ town, dp, items: all.filter(c => c.town === town && c.daypart === dp) })))
  const card = (c: Candidate) => `
    <label class="card">
      <div class="media">${c.kind === 'video'
        ? `<video src="${esc(c.preview)}" poster="${esc(c.poster ?? '')}" muted loop playsinline preload="none" controls></video>`
        : `<img src="${esc(c.preview)}" loading="lazy" alt="">`}</div>
      <div class="meta">
        <input type="checkbox" value="${esc(c.id)}">
        <b>${c.kind === 'video' ? 'Video' : 'Photo'} · ${c.width}×${c.height}${c.duration ? ` · ${c.duration}s` : ''}</b>
        <span>${esc(c.title)}</span>
        <span>${c.source} · <a href="${esc(c.photographerUrl ?? c.sourceUrl)}" target="_blank">${esc(c.photographer)}</a> · <a href="${esc(c.sourceUrl)}" target="_blank">source</a></span>
        <span class="lic">${esc(c.license)}</span>
      </div>
    </label>`
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Town Media Review</title>
<style>
:root{--rum:#B82010;--bg:#F2F2F7;--card:#fff;--ink:#111;--muted:#666}
@media (prefers-color-scheme:dark){:root{--bg:#000;--card:#1C1C1E;--ink:#fff;--muted:#aaa}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.4 Inter,-apple-system,sans-serif}
header{position:sticky;top:0;z-index:2;background:var(--bg);padding:16px 20px;border-bottom:1px solid #8884;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
h1{font-size:22px;margin:0;flex:1}h2{font-size:18px;margin:28px 20px 10px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;padding:0 20px}
.card{background:var(--card);border-radius:16px;overflow:hidden;display:block;cursor:pointer;box-shadow:0 4px 14px #0002}
.card:has(input:checked){outline:3px solid var(--rum)}
.media{aspect-ratio:16/9;background:#000}.media video,.media img{width:100%;height:100%;object-fit:cover;display:block}
.meta{padding:10px 12px;display:flex;flex-direction:column;gap:3px;font-size:13px}.meta input{width:20px;height:20px;accent-color:var(--rum)}
.meta a{color:var(--rum)}.lic{color:var(--muted);font-size:12px}.empty{padding:0 20px;color:var(--muted)}
button{background:var(--rum);color:#fff;border:0;border-radius:999px;padding:10px 18px;font-weight:700;font-size:15px;cursor:pointer}
textarea{width:calc(100% - 40px);margin:20px;height:120px;font:12px monospace}
</style></head><body>
<header><h1>ETA hero footage · ${all.length} candidates</h1><span id="count">0 picked</span><button id="export">Export picks</button></header>
${groups.map(g => `<h2>${TOWN_NAME[g.town as Town]} · ${g.dp === 'golden' ? 'Golden hour' : g.dp[0].toUpperCase() + g.dp.slice(1)}</h2>
<div class="grid">${g.items.length ? g.items.map(card).join('') : '<p class="empty">No candidates found.</p>'}</div>`).join('')}
<textarea id="out" readonly placeholder="Your picks appear here after Export"></textarea>
<script>
const all=${JSON.stringify(all)};
const boxes=[...document.querySelectorAll('input[type=checkbox]')];
const update=()=>document.getElementById('count').textContent=boxes.filter(b=>b.checked).length+' picked';
boxes.forEach(b=>b.addEventListener('change',update));
document.querySelectorAll('video').forEach(v=>{v.addEventListener('mouseenter',()=>v.play());v.addEventListener('mouseleave',()=>v.pause())});
document.getElementById('export').onclick=()=>{
  const ids=boxes.filter(b=>b.checked).map(b=>b.value);
  const picks=all.filter(c=>ids.includes(c.id));
  const json=JSON.stringify(picks,null,2);
  document.getElementById('out').value=json;
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([json],{type:'application/json'}));a.download='town-media-picks.json';a.click();
};
</script></body></html>`
}

async function main() {
  if (!PEXELS && !PIXABAY) {
    console.error('Add PEXELS_API_KEY (and PIXABAY_API_KEY) to .env first.')
    process.exit(1)
  }
  const out: Candidate[] = []
  const seeded = await seeds()
  for (const town of Object.keys(QUERIES) as Town[]) {
    for (const daypart of ['morning', 'afternoon', 'golden', 'night'] as Daypart[]) {
      const found = new Map<string, Candidate>()
      for (const s of seeded.filter(c => c.town === town && c.daypart === daypart)) found.set(s.sourceUrl, { ...s, score: 100 })
      for (const query of QUERIES[town][daypart]) {
        const [px, pb] = await Promise.all([searchPexels(town, daypart, query), searchPixabay(town, daypart, query)])
        for (const c of [...px, ...pb]) {
          if (!c.file || !inJamaica(c) || found.has(c.sourceUrl)) continue
          found.set(c.sourceUrl, { ...c, score: score(c, query) })
        }
      }
      const top = Array.from(found.values()).sort((a, b) => b.score - a.score).slice(0, 5)
      console.log(`${TOWN_NAME[town]} · ${daypart}: ${top.length} candidates`)
      out.push(...top)
    }
  }
  const dir = path.join(process.cwd(), 'scripts', 'out')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'town-media-candidates.json'), JSON.stringify(out, null, 2))
  fs.writeFileSync(path.join(dir, 'town-media-review.html'), reviewHtml(out))
  console.log(`\nReview: ${path.join(dir, 'town-media-review.html')}`)
}

main().catch(e => { console.error(e); process.exit(1) })
