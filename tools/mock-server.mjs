// Demo Xtream Codes server for testing IPTV PLAYER locally.
// Usage: node tools/mock-server.mjs [path/to/video.webm|mp4]   →  server http://localhost:8088  user: demo  pass: demo
import http from 'node:http'
import fs from 'node:fs'

const PORT = Number(process.env.PORT || 8088)
const VIDEO = process.argv[2]
const now = Math.floor(Date.now() / 1000)
const color = (i) => ['0A84FF', 'FF375F', '30D158', 'FF9F0A', 'BF5AF2', '64D2FF'][i % 6]
const img = (txt, i, w = 300, h = 450) => `http://localhost:${PORT}/img/${w}x${h}/${color(i)}/${encodeURIComponent(txt)}.svg`

const liveCats = ['UK | Entertainment', 'UK | Sports', 'USA | News', 'Kids', 'Adult XXX'].map((n, i) => ({ category_id: String(i + 1), category_name: n }))
const live = Array.from({ length: 60 }, (_, i) => ({
  num: i + 1, name: ['BBC One', 'ITV 1', 'Channel 4', 'Sky Sports Main Event', 'Sky Sports Football', 'CNN', 'Fox News', 'Cartoon Network', 'Disney Junior', 'Discovery'][i % 10] + (i >= 10 ? ' ' + (Math.floor(i / 10) + 1) : '') + (i % 3 === 0 ? ' FHD' : ' HD'),
  stream_id: 1000 + i, stream_icon: img('CH' + (i + 1), i, 200, 120), epg_channel_id: 'ch' + i,
  category_id: String((i % 5) + 1), tv_archive: i % 4 === 0 ? 1 : 0, tv_archive_duration: 3, added: String(now - i * 1000),
}))
const vodCats = ['Action', 'Comedy', 'Drama', 'Sci-Fi', '4K UHD'].map((n, i) => ({ category_id: String(10 + i), category_name: n }))
const titles = ['Midnight Run', 'Ocean Drive', 'The Last Signal', 'Northern Lights', 'Silver Coast', 'Iron Valley', 'Paper Moon', 'Red Horizon', 'Glass City', 'Quiet Storm', 'Neon Rain', 'Wild River']
const vod = Array.from({ length: 48 }, (_, i) => ({
  stream_id: 5000 + i, name: titles[i % 12] + (i >= 12 ? ' ' + (Math.floor(i / 12) + 1) : ''), stream_icon: img(titles[i % 12], i),
  rating: (5 + (i % 5)).toFixed(1), rating_5based: (2.5 + (i % 5) / 2).toFixed(1), category_id: String(10 + (i % 5)), container_extension: 'webm', added: String(now - i * 3600), year: String(2015 + (i % 10)),
}))
const serCats = ['Drama Series', 'Crime', 'Comedy Series'].map((n, i) => ({ category_id: String(20 + i), category_name: n }))
const series = Array.from({ length: 18 }, (_, i) => ({
  series_id: 9000 + i, name: ['Harbor Lights', 'The Firm', 'Blue Line', 'Kingdom Road', 'Tall Pines', 'City Desk'][i % 6] + (i >= 6 ? ' ' + (Math.floor(i / 6) + 1) : ''),
  cover: img('Series ' + (i + 1), i + 2), plot: 'A gripping story told over several seasons.', rating: (6 + (i % 4)).toFixed(1), rating_5based: (3 + (i % 4) / 2).toFixed(1), category_id: String(20 + (i % 3)), last_modified: String(now - i * 7200), releaseDate: String(2018 + (i % 6)) + '-01-01',
}))
const progs = (ch) => {
  const out = []
  let t = Math.floor(now / 1800) * 1800 - 3 * 3600
  for (let k = 0; k < 22; k++) { const d = [1800, 3600, 2700][(ch + k) % 3]; out.push({ start: t, stop: t + d, title: ['Morning Show', 'News at Ten', 'Live Football', 'Movie Night', 'Documentary', 'Cartoons', 'Talk Show'][(ch + k) % 7] }); t += d }
  return out
}
const b64 = (s) => Buffer.from(s).toString('base64')
const fmt = (s) => { const d = new Date(s * 1000); const p = (n) => String(n).padStart(2, '0'); return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}00 +0000` }
const loc = (s) => new Date(s * 1000).toISOString().slice(0, 19).replace('T', ' ')

function api(q) {
  if (q.get('username') !== 'demo' || q.get('password') !== 'demo') return { user_info: { auth: 0 } }
  const a = q.get('action')
  if (!a) return { user_info: { auth: 1, username: 'demo', status: 'Active', exp_date: String(now + 300 * 86400), created_at: String(now - 30 * 86400), is_trial: '0', active_cons: '0', max_connections: '2', allowed_output_formats: ['m3u8', 'ts'] }, server_info: { url: 'localhost', port: String(PORT), server_protocol: 'http', timezone: 'UTC' } }
  if (a === 'get_live_categories') return liveCats
  if (a === 'get_live_streams') return live
  if (a === 'get_vod_categories') return vodCats
  if (a === 'get_vod_streams') return q.get('category_id') ? vod.filter((v) => v.category_id === q.get('category_id')) : vod
  if (a === 'get_series_categories') return serCats
  if (a === 'get_series') return q.get('category_id') ? series.filter((v) => v.category_id === q.get('category_id')) : series
  if (a === 'get_vod_info') { const v = vod.find((x) => x.stream_id == q.get('vod_id')); return { info: { name: v.name, movie_image: v.stream_icon, backdrop_path: [img(v.name, 3, 1280, 720)], plot: 'An original demo film used to test IPTV PLAYER.', director: 'A. Director', cast: 'Actor One, Actor Two', genre: 'Drama', duration: '1h 52m', releasedate: v.year + '-05-01', video: { height: 2160 } }, movie_data: v } }
  if (a === 'get_series_info') { const s = series.find((x) => x.series_id == q.get('series_id')); const eps = {}; for (let se = 1; se <= 3; se++) eps[se] = Array.from({ length: 6 }, (_, e) => ({ id: String(s.series_id * 100 + se * 10 + e), episode_num: e + 1, season: se, title: `Chapter ${e + 1}`, container_extension: 'webm', info: { movie_image: img(`S${se}E${e + 1}`, e, 640, 360), plot: 'Episode plot goes here.', duration: '45m' } })); return { info: { name: s.name, cover: s.cover, plot: s.plot, cast: 'Cast Member', genre: 'Drama', releaseDate: s.releaseDate, backdrop_path: [img(s.name, 4, 1280, 720)] }, episodes: eps } }
  if (a === 'get_short_epg' || a === 'get_simple_data_table') { const i = Number(q.get('stream_id')) - 1000; return { epg_listings: progs(i).map((p) => ({ title: b64(p.title), description: b64('About ' + p.title), start: loc(p.start), start_timestamp: String(p.start), stop_timestamp: String(p.stop), has_archive: 1 })) } }
  return []
}
function xmltv() {
  let x = '<?xml version="1.0" encoding="UTF-8"?><tv>'
  live.forEach((c, i) => (x += `<channel id="ch${i}"><display-name>${c.name}</display-name></channel>`))
  live.forEach((c, i) => progs(i).forEach((p) => (x += `<programme start="${fmt(p.start)}" stop="${fmt(p.stop)}" channel="ch${i}"><title>${p.title}</title><desc>About ${p.title}</desc></programme>`)))
  return x + '</tv>'
}
function sendVideo(req, res) {
  if (!VIDEO) return (res.statusCode = 404), res.end()
  const size = fs.statSync(VIDEO).size
  const m = /bytes=(\d+)-(\d*)/.exec(req.headers.range || '')
  const type = VIDEO.endsWith('.mp4') ? 'video/mp4' : 'video/webm'
  if (m) { const s = +m[1], e = m[2] ? +m[2] : size - 1; res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${s}-${e}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': e - s + 1 }); fs.createReadStream(VIDEO, { start: s, end: e }).pipe(res) }
  else { res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes' }); fs.createReadStream(VIDEO).pipe(res) }
}
// ——— fake website API (device activation) ———
const devices = {} // id -> { key, playlists: [] }
globalThis.__dev = devices
const body = (req) => new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { try { r(JSON.parse(b || '{}')) } catch { r({}) } }) })
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const u = new URL(req.url, 'http://x')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.end()
  if (u.pathname === '/api/device/register') return body(req).then((b) => { devices[b.id] = devices[b.id] && devices[b.id].key === b.key ? devices[b.id] : { key: b.key, playlists: [] }; res.end(JSON.stringify({ ok: true })) })
  if (u.pathname === '/api/device/playlists') { const d = devices[u.searchParams.get('id')]; if (!d || d.key !== u.searchParams.get('key')) { res.statusCode = 401; return res.end('{"ok":false}') } return res.end(JSON.stringify({ ok: true, playlists: d.playlists })) }
  if (u.pathname === '/api/test/add') return body(req).then((b) => { const d = devices[b.id]; if (!d || d.key !== b.key) { res.statusCode = 401; return res.end('no') } d.playlists.push({ id: String(Date.now()), ...b.playlist }); res.end('ok') })
  if (u.pathname === '/player_api.php') return res.setHeader('Content-Type', 'application/json'), res.end(JSON.stringify(api(u.searchParams)))
  if (u.pathname === '/xmltv.php') return res.setHeader('Content-Type', 'application/xml'), res.end(xmltv())
  if (u.pathname === '/get.php') { let m = '#EXTM3U\n'; live.forEach((c) => (m += `#EXTINF:-1 tvg-id="${c.epg_channel_id}" tvg-logo="${c.stream_icon}" group-title="${liveCats[c.category_id - 1].category_name}",${c.name}\nhttp://localhost:${PORT}/live/demo/demo/${c.stream_id}.ts\n`)); return res.end(m) }
  const im = u.pathname.match(/^\/img\/(\d+)x(\d+)\/(\w+)\/(.+)\.svg$/)
  if (im) { const [, w, h, c, t] = im; res.setHeader('Content-Type', 'image/svg+xml'); return res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="#${c}"/><stop offset="1" stop-color="#111"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><text x="50%" y="50%" fill="#fff" font-family="Arial" font-weight="700" font-size="${Math.round(w / 9)}" text-anchor="middle">${decodeURIComponent(t).replace(/[<&]/g, '')}</text></svg>`) }
  if (/^\/(live|movie|series|timeshift)\//.test(u.pathname)) return sendVideo(req, res)
  res.statusCode = 404; res.end()
}).listen(PORT, () => console.log(`Demo Xtream server → http://localhost:${PORT}  (user demo / pass demo)`))
