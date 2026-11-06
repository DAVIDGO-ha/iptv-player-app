// Your IPTV PLAYER website (built in v0 / Vercel). Clients open it on their phone to add playlists to their TV.
// Change this after you publish the website, or set SITE_URL as a GitHub Actions variable.
export const SITE_URL: string = (process.env.SITE_URL || 'https://iptv-player-website.vercel.app').replace(/\/+$/, '')
export const SITE_LABEL = SITE_URL.replace(/^https?:\/\//, '')
