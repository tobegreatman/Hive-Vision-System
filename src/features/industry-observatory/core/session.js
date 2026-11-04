/**
 * 交易时段感知
 * 所有时间判断统一按 Asia/Shanghai（UTC+8，无夏令时）计算，
 * 保证非交易时段不触发无意义的轮询与「数据过期」误报。
 */
const CN_OFFSET = 8 * 3600 * 1000

export function cnParts(date = new Date()) {
  const d = new Date(date.getTime() + CN_OFFSET)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + 1
  const day = d.getUTCDate()
  const hh = d.getUTCHours()
  const mm = d.getUTCMinutes()
  const wd = d.getUTCDay()
  return {
    y, m, day, hh, mm, wd,
    tradingDay: `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    minutes: hh * 60 + mm,
    isWeekend: wd === 0 || wd === 6,
  }
}

/** 连续竞价时段（分钟）：9:30–11:30, 13:00–15:00 */
const SEGMENTS = [
  [9 * 60 + 30, 11 * 60 + 30],
  [13 * 60, 15 * 60],
]
const TOTAL_MINUTES = SEGMENTS.reduce((s, [a, b]) => s + (b - a), 0) // 240

export function sessionPhase(date = new Date()) {
  const p = cnParts(date)
  if (p.isWeekend) {
    return { phase: 'closed', label: '休市', tradingDay: p.tradingDay, progress: 1, minutes: p.minutes }
  }
  if (p.minutes < SEGMENTS[0][0]) {
    return { phase: 'pre', label: '盘前', tradingDay: p.tradingDay, progress: 0, minutes: p.minutes }
  }
  if (p.minutes >= SEGMENTS[1][1]) {
    return { phase: 'closed', label: '已收盘', tradingDay: p.tradingDay, progress: 1, minutes: p.minutes }
  }
  const lunch = p.minutes > SEGMENTS[0][1] && p.minutes < SEGMENTS[1][0]
  let elapsed = 0
  for (const [a, b] of SEGMENTS) {
    if (p.minutes >= b) elapsed += b - a
    else if (p.minutes > a) elapsed += p.minutes - a
  }
  return {
    phase: lunch ? 'lunch' : 'open',
    label: lunch ? '午间休市' : '盘中',
    tradingDay: p.tradingDay,
    progress: Math.min(1, elapsed / TOTAL_MINUTES),
    minutes: p.minutes,
  }
}

/** 允许的数据陈旧上限：盘中 5 分钟，非盘中放宽到 1 天 */
export function staleBudgetSeconds(phase) {
  return phase === 'open' || phase === 'lunch' ? 300 : 86400
}
