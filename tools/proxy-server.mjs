// Tiny CORS proxy for the WEB version of IPTV PLAYER (not needed in the installed apps).
// Run on your server (e.g. DigitalOcean):  PORT=8090 node tools/proxy-server.mjs
// Then in the app: Settings › Network › Proxy URL = https://your-domain:8090/?url={url}
import http from 'node:http'
import https from 'node:https'

const PORT = Number(process.env.PORT || 8090)
const ALLOW = (process.env.ALLOW_HOSTS || '').split(',').filter(Boolean) // optional allow-list of IPTV hosts

http
  .createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', '*')
    res.setHeader('Access-Control-Expose-Headers', '*')
    if (req.method === 'OPTIONS') return res.end()
    const target = new URL(req.url, 'http://x').searchParams.get('url')
    if (!target || !/^https?:\/\//.test(target)) return (res.statusCode = 400), res.end('missing ?url=')
    const t = new URL(target)
    if (ALLOW.length && !ALLOW.includes(t.hostname)) return (res.statusCode = 403), res.end('host not allowed')
    const lib = t.protocol === 'https:' ? https : http
    const up = lib.request(t, { method: 'GET', headers: { 'User-Agent': 'IPTVPlayer/1.0', ...(req.headers.range ? { Range: req.headers.range } : {}) } }, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        const loc = new URL(r.headers.location, t).href
        res.writeHead(302, { Location: '/?url=' + encodeURIComponent(loc), 'Access-Control-Allow-Origin': '*' })
        return res.end()
      }
      const h = { ...r.headers }
      delete h['access-control-allow-origin']
      res.writeHead(r.statusCode || 502, { ...h, 'Access-Control-Allow-Origin': '*' })
      // Rewrite HLS playlists so segments also go through the proxy
      if (/mpegurl/i.test(r.headers['content-type'] || '') || /\.m3u8(\?|$)/.test(t.pathname)) {
        let body = ''
        r.setEncoding('utf8')
        r.on('data', (c) => (body += c))
        r.on('end', () =>
          res.end(body.split('\n').map((l) => (l && !l.startsWith('#') ? '/?url=' + encodeURIComponent(new URL(l.trim(), t).href) : l)).join('\n'))
        )
      } else r.pipe(res)
    })
    up.on('error', () => (res.statusCode = 502, res.end('upstream error')))
    req.on('close', () => up.destroy())
    up.end()
  })
  .listen(PORT, () => console.log('IPTV PLAYER proxy on :' + PORT))
