/**
 * 归一化：原始记录 → 领域节点
 * 每个节点除数据外，还携带「分组、层级、视觉映射、统计分」四类派生信息，
 * 使渲染层与推理层拿到同一份自解释对象。
 */
import { L1_INDUSTRIES, levelOf } from './constants.js'
import { classify, baseName } from './grouping.js'
import { clamp } from './score.js'

/** 视觉量纲：把不可比的金额压到可比区间，避免极端值压平其余柱体 */
export function visualOf(netPct, absPercentile) {
  const t = Math.tanh((netPct ?? 0) / 2.6) // [-1,1]
  const mag = 0.55 + 0.45 * (absPercentile ?? 0.5)
  return {
    h: Math.round(t * mag * 1000) / 1000, // 带符号高度系数
    intensity: Math.round(clamp(0.5 + t / 2, 0, 1) * 1000) / 1000,
    glow: Math.round(Math.abs(t) * mag * 1000) / 1000,
  }
}

/**
 * @param {Array} records decodeRow 的结果
 * @param {'d1'|'d5'|'d10'} period
 */
export function normalize(records, period) {
  const nodes = []
  const seen = new Set()

  for (const r of records) {
    if (!r || !r.id || seen.has(r.id)) continue
    seen.add(r.id)
    const metric = r[period] || r.d1
    const base = baseName(r.name)
    // 层级必须用原始名称精确判定：银行Ⅱ / 综合Ⅲ 虽与一级同名，但属二、三级板块
    const level = levelOf(r.name)
    const isL1 = level === 1
    const { group, rule } = classify(r.name)

    nodes.push({
      id: r.id,
      name: r.name,
      base,
      level,
      isL1,
      group,
      groupRule: rule,
      chg: r.chg,
      turnoverRate: r.turnoverRate,
      price: r.price,
      mcap: r.mcap,
      up: r.up,
      down: r.down,
      flat: r.flat,
      leader: r.leaderName ? { name: r.leaderName, code: r.leaderCode, chg: r.leaderChg } : null,
      // 当前粒度
      period: {
        key: period,
        net: metric?.net ?? null,
        netPct: metric?.netPct ?? null,
        tiers: metric?.tiers ?? null,
      },
      // 多周期原值，供详情与跨期推理
      d1: r.d1,
      d5: r.d5,
      d10: r.d10,
      ts: r.ts,
      visual: { h: 0, intensity: 0.5, glow: 0 },
    })
  }

  return nodes
}

/** 按一级行业聚合，得到分组层的汇总量（用于空间布局与扇区着色）
 *  注意：申万一级/二级/三级是嵌套关系，成员净额相加会重复计数。
 *  因此存在一级行业节点时，直接采用该节点的净额作为分组真实值。
 */
export function aggregateGroups(nodes) {
  const map = new Map()
  for (const n of nodes) {
    const g = n.group || '未归类'
    if (!map.has(g)) {
      map.set(g, {
        group: g,
        members: 0,
        counts: { 1: 0, 2: 0, 3: 0 },
        net: 0,
        netPctSum: 0,
        up: 0,
        down: 0,
        level1Id: null,
        level1Net: null,
        level1NetPct: null,
        up2: 0,
        down2: 0,
        children: [],
        subIds: [],
      })
    }
    const acc = map.get(g)
    acc.members += 1
    acc.counts[n.level] = (acc.counts[n.level] || 0) + 1
    acc.net += n.period.net ?? 0
    acc.netPctSum += n.period.netPct ?? 0
    if (n.level === 1) {
      acc.level1Id = n.id
      acc.level1Net = n.period.net ?? 0
      acc.level1NetPct = n.period.netPct ?? 0
      acc.up = n.up ?? 0
      acc.down = n.down ?? 0
    } else if (n.level === 2) {
      // 广度只在二级层累加：三级与父级是同一批成分股，累加会重复计数
      acc.up2 += n.up ?? 0
      acc.down2 += n.down ?? 0
      acc.subIds.push(n.id)
    }
    acc.children.push(n.id)
  }
  for (const acc of map.values()) {
    // 一级锚点自带全行业家数，优先采用；无锚点时才退化为二级累加
    if (acc.level1Id) {
      acc.net = acc.level1Net
      acc.netPct = acc.level1NetPct ?? 0
    } else {
      acc.up = acc.up2
      acc.down = acc.down2
      acc.netPct = acc.members ? acc.netPctSum / acc.members : 0
    }
    delete acc.up2
    delete acc.down2
    acc.breadth = acc.up + acc.down > 0 ? (acc.up - acc.down) / (acc.up + acc.down) : 0
  }
  // 固定顺序：按一级行业声明顺序，未归类置末
  const order = new Map(L1_INDUSTRIES.map((g, i) => [g, i]))
  return [...map.values()].sort(
    (a, b) => (order.get(a.group) ?? 999) - (order.get(b.group) ?? 999)
  )
}
