// Which version of the app this is.
// PLAY = the Google Play version (built with PLAY=1): pays with Google Play, no anti-block route, own user-agent.
// Every other version (website APK, Firestick, TVs, computers) stays exactly as before.
export const PLAY = process.env.PLAY === '1'
// LITE = the small version for old TVs / old Firesticks (built with LITE=1): plain background, no small preview
// player, no glass / blur effects — uses much less memory. Same playlists, same activation, same full-screen player.
export const LITE = process.env.LITE === '1'

/** User-agent the app uses with IPTV servers. Google Play version: our own name (no other app's name). */
export const UA = PLAY ? 'IPTVPlayer/1.0' : 'IPTVSmartersPlayer'
