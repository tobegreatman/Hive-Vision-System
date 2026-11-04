/**
 * 阈值与裁决内核
 *
 * 设计原则：
 * 1) 全部指标可计算、可复现——不引入随机数与人工偏好；
 * 2) 使用稳健统计（中位数 / MAD）抵抗少数极端板块对量纲的污染；
 * 3) 每条裁决都携带命中的具体阈值与实测值，便于复核。
 */
import { THRESHOLDS, WEIGHTS, VERDICTS } from './constants.js'

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
export const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0)

export function median(arr) {
  if (!arr.length) return 0
  const a = [...arr].sort((x, y) => x - y)
  const m = a.length >> 1
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
}

export function quantile(arr, q) {
  if (!arr.length) return 0
  const a = [...arr].sort((x, y) => x - y)
  const pos = (a.length - 1) * clamp(q, 0, 1)
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return lo === hi ? a[lo] : a[lo] + (a[hi] - a[lo]) * (pos - lo)
}

/** 稳健 z 分数：以中位数为中心、1.4826×MAD 为尺度 */
export function robustZ(value, med, mad) {
  const scale = mad * 1.4826
  if (!Number.isFinite(scale) || scale <= 1e-9) return 0
  return clamp((value - med) / scale, -6, 6)
}

export function percentileRank(sortedAsc, value) {
  if (!sortedAsc.length) return 0.5
  let lo = 0
  let hi = sortedAsc.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sortedAsc[mid] <= value) lo = mid + 1
    else hi = mid
  }
  return lo / sortedAsc.length
}

/** HHI 集中度（0–10000） */
export function hhi(values) {
  const total = values.reduce((s, v) => s + Math.abs(v), 0)
  if (total <= 0) return 0
  return values.reduce((s, v) => s + ((Math.abs(v) / total) * 100) ** 2, 0)
}

/**
 * 计算全样本的统计上下文与逐节点得分。
 * @param {Array} nodes 已归一化节点（含 d1/d5/d10）
 * @param {'d1'|'d5'|'d10'} period
 */
export function scoreNodes(nodes, _period = 'd1') {
  const nets = nodes.map((n) => n.period.net ?? 0)
  const ints = nodes.map((n) => n.period.netPct ?? 0)
  const medNet = median(nets)
  const madNet = median(nets.map((v) => Math.abs(v - medNet)))
  const medInt = median(ints)
  const madInt = median(ints.map((v) => Math.abs(v - medInt)))

  const absSorted = nets.map(Math.abs).sort((a, b) => a - b)
  const scoreSorted = []

  const scored = nodes.map((n) => {
    const net = n.period.net ?? 0
    const netPct = n.period.netPct ?? 0
    const zNet = robustZ(net, medNet, madNet)
    const zInt = robustZ(netPct, medInt, madInt)

    // 量级用分位而非 z：z 在长尾分布上会饱和，分位保证强弱可分且尺度均匀
    const magnitude = percentileRank(absSorted, Math.abs(net))
    const magnitudeSigned = (magnitude - 0.5) * 2 * sign(net)

    const tot = (n.up ?? 0) + (n.down ?? 0)
    const breadth = tot > 0 ? ((n.up ?? 0) - (n.down ?? 0)) / tot : 0

    const d5 = n.d5?.net ?? 0
    const d10 = n.d10?.net ?? 0
    const persistence = (sign(net) + sign(d5) + sign(d10)) / 3

    const daily5 = d5 / 5
    const accel = clamp((net - daily5) / (Math.abs(daily5) + Math.abs(net) + 1), -1, 1)

    const composite =
      WEIGHTS.zNet * magnitudeSigned +
      WEIGHTS.zIntensity * Math.tanh(zInt / 2) +
      WEIGHTS.persistence * persistence +
      WEIGHTS.breadth * breadth +
      WEIGHTS.acceleration * accel

    const score = Math.round(Math.tanh(composite * 1.2) * 1000) / 10

    return {
      node: n,
      score,
      magnitude,
      metrics: { zNet, zInt, breadth, persistence, accel, composite },
      absScore: Math.abs(score),
    }
  })

  for (const s of scored) scoreSorted.push(s.absScore)
  scoreSorted.sort((a, b) => a - b)

  for (const s of scored) {
    const pr = percentileRank(scoreSorted, s.absScore)
    s.percentile = pr
    s.tier = tierOf(pr)
  }

  // 确定性排序：得分降序 → 净额绝对量降序 → 代码升序（消除同分抖动）
  scored.sort((a, b) => b.score - a.score || Math.abs(b.node.period.net) - Math.abs(a.node.period.net) || a.node.id.localeCompare(b.node.id))
  scored.forEach((s, i) => {
    s.rank = i + 1
  })

  return {
    stats: { medNet, madNet, medInt, madInt },
    scored,
  }
}

export function tierOf(pr) {
  const b = THRESHOLDS.tierBands
  if (pr >= b.S) return 'S'
  if (pr >= b.A) return 'A'
  if (pr >= b.B) return 'B'
  if (pr >= b.C) return 'C'
  return 'D'
}

/**
 * 裁决：按固定顺序命中第一条规则，返回可复核的理由链。
 */
export function verdictOf(node, metrics) {
  const net = node.period.net ?? 0
  const netPct = node.period.netPct ?? 0
  const d5 = node.d5?.net ?? 0
  const d10 = node.d10?.net ?? 0
  const chg = node.chg ?? 0
  const { zNet, breadth } = metrics
  const T = THRESHOLDS

  const reasons = []
  const push = (label, value, ref) => reasons.push({ label, value, ref })

  push('当日净额', fmtCNY(net), 'f62')
  push('稳健 z', zNet.toFixed(2), `|z|≥${T.surgeZ} 触发`)

  let code = 'neutral'

  if (net < 0 && zNet <= T.panicZ && chg <= T.panicChg) {
    code = 'panic'
    push('触发条件', `z≤${T.panicZ} 且 涨跌幅≤${T.panicChg}%`, 'panic')
  } else if (net > 0 && zNet >= T.surgeZ && breadth >= T.surgeBreadth) {
    code = 'surge'
    push('触发条件', `z≥${T.surgeZ} 且 广度≥${T.surgeBreadth}`, 'surge')
  } else if (net < 0 && d5 < 0 && d10 < 0) {
    code = 'bleed'
    push('触发条件', '当日/5日/10日 三周期同向流出', 'bleed')
  } else if (net > 0 && d5 > 0 && d10 > 0) {
    code = 'accumulate'
    push('触发条件', '当日/5日/10日 三周期同向流入', 'accumulate')
  } else if (net < 0 && d5 > 0) {
    code = 'distribution'
    push('触发条件', '当日流出但 5 日仍净流入', 'distribution')
  } else if (net > 0) {
    code = 'mild-in'
    push('触发条件', `净流入但 z<${T.surgeZ}`, 'mild-in')
  } else {
    code = 'neutral'
    push('触发条件', '未命中任何方向性条件', 'neutral')
  }

  push('净额占成交比', `${netPct.toFixed(2)}%`, 'f184')

  return {
    code,
    label: VERDICTS[code].label,
    tone: VERDICTS[code].tone,
    reasons,
  }
}

export function fmtCNY(v) {
  const a = Math.abs(v)
  if (a >= 1e8) return `${(v / 1e8).toFixed(2)}亿`
  if (a >= 1e4) return `${(v / 1e4).toFixed(2)}万`
  return v.toFixed(0)
}
