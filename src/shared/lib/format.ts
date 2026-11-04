export function formatNumber(value: number, fractionDigits = 2): string {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)
}

export function formatUptime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

export function formatRelativeTime(iso: string | null, now: number = Date.now()): string {
  if (!iso) return '尚未记录'
  const timestamp = Date.parse(iso)
  if (Number.isNaN(timestamp)) return '时间无效'

  const diffSeconds = Math.max(0, Math.round((now - timestamp) / 1000))
  if (diffSeconds < 5) return '刚刚'
  if (diffSeconds < 60) return `${diffSeconds} 秒前`
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} 小时前`
  return `${Math.floor(diffHours / 24)} 天前`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** 价格/点位：千分位 + 两位小数，指数点位同样适用。 */
export function formatPrice(value: number, fractionDigits = 2): string {
  return formatNumber(value, fractionDigits)
}

/** 涨跌幅：始终带符号，A 股语境里「+」本身就是信息。 */
export function formatPct(value: number, fractionDigits = 2): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(fractionDigits)}%`
}

/** 金额（亿元）：过万亿改用「万亿」，避免盘面上出现过长数字。 */
export function formatAmount(yi: number): string {
  const abs = Math.abs(yi)
  if (abs >= 10000) {
    const sign = yi < 0 ? '-' : ''
    return `${sign}${(abs / 10000).toFixed(2)} 万亿`
  }
  // 百亿以上取整，避免「2810.00 亿」在窄卡片里换行
  if (abs >= 100) return `${Math.round(yi)} 亿`
  return `${yi.toFixed(2)} 亿`
}

/** 主力净流入等可正可负的金额：带符号，单位亿元。 */
export function formatSignedAmount(yi: number): string {
  const sign = yi > 0 ? '+' : ''
  return `${sign}${yi.toFixed(2)} 亿`
}
