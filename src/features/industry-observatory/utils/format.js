export function fmtMoney(v, { sign = true, digits = 2 } = {}) {
  if (v == null || !Number.isFinite(v)) return '—'
  const a = Math.abs(v)
  const s = v < 0 ? '−' : sign && v > 0 ? '+' : ''
  if (a >= 1e8) return `${s}${(a / 1e8).toFixed(digits)}亿`
  if (a >= 1e4) return `${s}${(a / 1e4).toFixed(0)}万`
  return `${s}${a.toFixed(0)}`
}

export function splitMoney(v) {
  if (v == null) return { num: '—', unit: '' }
  const a = Math.abs(v)
  const neg = v < 0
  const s = neg ? '−' : '+'
  if (a >= 1e8) return { num: `${s}${(a / 1e8).toFixed(2)}`, unit: '亿' }
  if (a >= 1e4) return { num: `${s}${(a / 1e4).toFixed(0)}`, unit: '万' }
  return { num: `${s}${a.toFixed(0)}`, unit: '元' }
}

export function fmtPct(v, digits = 2) {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(digits)}%`
}

export function fmtNum(v, digits = 0) {
  if (v == null || !Number.isFinite(v)) return '—'
  return v.toLocaleString('zh-CN', { maximumFractionDigits: digits })
}

export function fmtClock(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
