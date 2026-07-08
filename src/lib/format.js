// Formatting + date helpers. Money is display-only per spec (currency code
// stored on rows). We format with grouping and 2 decimals.

export function money(n, currency = 'PKR') {
  const v = Number(n || 0)
  const formatted = v.toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${currency} ${formatted}`
}

export function num(n, digits = 0) {
  return Number(n || 0).toLocaleString('en-PK', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function pct(n) {
  return `${Number(n || 0).toFixed(1)}%`
}

// Time in Asia/Karachi for POS "today" filtering and display.
const KARACHI = 'Asia/Karachi'

export function fmtTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-PK', {
    hour: '2-digit', minute: '2-digit', timeZone: KARACHI,
  })
}

export function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-PK', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: KARACHI,
  })
}

// Return the Y-M-D string for "now" in Karachi (for same-day comparisons).
function karachiYMD(d = new Date()) {
  // en-CA gives YYYY-MM-DD
  return d.toLocaleDateString('en-CA', { timeZone: KARACHI })
}

export function isToday(iso) {
  if (!iso) return false
  return karachiYMD(new Date(iso)) === karachiYMD(new Date())
}

// Period boundaries (UTC instants) for the current week (Mon-based) and month,
// computed against Karachi local calendar. We return ISO strings usable in
// .gte()/.lt() filters on sold_at / returned_at.
//
// Approach: figure out the Karachi-local date parts, construct the local
// midnight boundary, then convert back to a UTC instant by offsetting.
function karachiParts(d = new Date()) {
  const s = d.toLocaleString('en-CA', {
    timeZone: KARACHI, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
  // s like "2026-07-08, 14:03:11"
  const [datePart] = s.split(',')
  const [y, m, day] = datePart.trim().split('-').map(Number)
  return { y, m, day }
}

// Karachi is UTC+5, no DST. Local midnight = UTC 19:00 previous day.
const KARACHI_OFFSET_HRS = 5

function karachiLocalMidnightToUtc(y, m, day) {
  // Local midnight in Karachi == UTC time (day 00:00 - 5h)
  const utcMs = Date.UTC(y, m - 1, day, 0, 0, 0) - KARACHI_OFFSET_HRS * 3600 * 1000
  return new Date(utcMs)
}

export function currentMonthRange() {
  const { y, m } = karachiParts()
  const start = karachiLocalMidnightToUtc(y, m, 1)
  // first day of next month
  const nextM = m === 12 ? 1 : m + 1
  const nextY = m === 12 ? y + 1 : y
  const end = karachiLocalMidnightToUtc(nextY, nextM, 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

export function currentWeekRange() {
  // Week starts Monday (matches date_trunc('week') in Postgres).
  const { y, m, day } = karachiParts()
  // Determine weekday of that Karachi date.
  const localNoonUtc = new Date(Date.UTC(y, m - 1, day, 12))
  // getUTCDay of the constructed noon reflects the calendar day correctly.
  let dow = localNoonUtc.getUTCDay() // 0=Sun..6=Sat
  const isoDow = dow === 0 ? 7 : dow // 1=Mon..7=Sun
  const startMidnight = karachiLocalMidnightToUtc(y, m, day)
  const start = new Date(startMidnight.getTime() - (isoDow - 1) * 86400 * 1000)
  const end = new Date(start.getTime() + 7 * 86400 * 1000)
  return { start: start.toISOString(), end: end.toISOString() }
}
