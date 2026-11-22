// Clean display names: panels put codes in front of every title ("VOD | EN - The Batman", "UK: SKY ONE HD",
// "|EN| Netflix", "[FR] Lupin") — the app shows just the real name so the full title fits on screen.
const CODE =
  'VOD|VODS|SRS|SER|SERIES|SERIE|MOVIE|MOVIES|FILM|FILMS|LIVE|TV|EN|ENG|UK|GB|US|USA|CA|AU|IE|FR|FRA|DE|GER|ES|ESP|IT|ITA|PT|NL|BE|CH|AT|SE|NO|DK|FI|PL|TR|AR|MA|DZ|TN|IN|PK|RU|GR|RO|AL|EX-YU|LAT|LATAM|MULTI|ALL|4K|UHD|FHD|HD|SD|HEVC|H265|VIP|PPV|24/7'
const CODE_RE = new RegExp(
  '^\\s*(?:' +
    // [EN] (EN) |EN| ⟦EN⟧
    '[\\[(|⟦]\\s*(?:' + CODE + ')(?:\\s*[|/,-]\\s*(?:' + CODE + '))*\\s*[\\])|⟧]' +
    '|' +
    // VOD | EN -   UK:   EN -   4K-EN |   EN▎
    '(?:' + CODE + ')(?:\\s*[|/-]\\s*(?:' + CODE + '))*\\s*(?:[|:▎•»›]|\\s-\\s|-\\s|\\s-(?=\\s))' +
    ')\\s*[-:|•»›]?\\s*',
  'i'
)

/** "VOD | EN - ACTION & ADVENTURE" → "ACTION & ADVENTURE" · "UK: SKY ONE HD" → "SKY ONE HD" */
export function cleanName(raw: string): string {
  let s = String(raw || '').trim()
  for (let i = 0; i < 4; i++) {
    const m = s.match(CODE_RE)
    if (!m || m[0].length >= s.length) break // never strip the whole name
    s = s.slice(m[0].length).trim()
  }
  return s || String(raw || '').trim()
}

/** Language code a category starts with (EN, FR, DE…) — shown only when two categories would look the same. */
export function langOf(raw: string): string {
  const m = String(raw || '').toUpperCase().match(/\b(EN|ENG|UK|US|FR|DE|ES|IT|PT|NL|AR|TR|PL|SE|MULTI)\b/)
  return m ? m[1] : ''
}

/** Clean category names; when two end up identical ("NETFLIX" from EN and FR), add the language: "NETFLIX · FR". */
export function cleanCats<T extends { name: string }>(list: T[]): T[] {
  const cleaned = list.map((c) => ({ c, raw: c.name, name: cleanName(c.name) }))
  const count = new Map<string, number>()
  for (const x of cleaned) count.set(x.name.toLowerCase(), (count.get(x.name.toLowerCase()) || 0) + 1)
  return cleaned.map(({ c, raw, name }) => {
    const lang = (count.get(name.toLowerCase()) || 0) > 1 ? langOf(raw) : ''
    return { ...c, name: lang && !name.toUpperCase().includes(lang) ? `${name} · ${lang}` : name }
  })
}
