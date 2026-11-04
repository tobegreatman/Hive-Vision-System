/**
 * 契约组装：把原始数组变成可渲染、可推理、可复核的单一载荷
 * 输出 schema: industry-flow/v1
 */
import {
  SCHEMA_ID, UNIVERSE_ID, PERIODS, REGIMES, VERDICTS,
} from './constants.js'
import { normalize, aggregateGroups, visualOf } from './normalize.js'
import { scoreNodes, verdictOf, hhi } from './score.js'
import { runGates } from './quality.js'
import { sessionPhase } from './session.js'

/** 稳定哈希（FNV-1a 32bit），用于跨端比对同一帧是否一致 */
export function checksum(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

const round = (v, d = 2) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d)

/**
 * @param {Array} records  已 decode 的原始记录
 * @param {object} opt
 * @param {'d1'|'d5'|'d10'} opt.period
 * @param {number} opt.expected 预期样本数
 * @param {number} opt.total    数据源自报总数
 * @param {string} opt.channel  live | jsonp | snapshot
 * @param {number} opt.latencyMs
 * @param {number} opt.failovers
 * @param {number} [opt.now]
 */
export function build(records, opt = {}) {
  const period = opt.period || 'd1'
  const now = opt.now || Date.now()
  const nodes = normalize(records, period)
  const { scored, stats } = scoreNodes(nodes, period)

  // 把得分、裁决、视觉映射写回节点（节点对象即渲染与推理的唯一入口）
  const reasonsBudget = 48
  let reasonsLeft = reasonsBudget

  for (const s of scored) {
    const n = s.node
    const v = visualOf(n.period.netPct, s.magnitude)
    n.visual = v
    n.score = {
      value: s.score,
      abs: s.absScore,
      rank: s.rank,
      percentile: round(s.percentile, 4),
      tier: s.tier,
      zNet: round(s.metrics.zNet, 3),
      zIntensity: round(s.metrics.zInt, 3),
      breadth: round(s.metrics.breadth, 3),
      persistence: round(s.metrics.persistence, 3),
    }
    const verdict = verdictOf(n, s.metrics)
    if (reasonsLeft <= 0) verdict.reasons = []
    else reasonsLeft--
    n.verdict = verdict
    n.l1Anchor = null
    delete n.groupRule
  }

  // 一级锚点：分组 → 一级行业节点 id
  const groups = aggregateGroups(nodes)
  const anchorOf = new Map(groups.map((g) => [g.group, g.level1Id]))
  for (const n of nodes) n.l1Anchor = anchorOf.get(n.group) || null

  // 排行稳定：得分降序已由 scoreNodes 给出，这里同步载荷顺序
  nodes.sort((a, b) => a.score.rank - b.score.rank)

  // 统计口径：申万各级板块嵌套，全域求和会重复计数，故以一级行业为统计总体
  const l1Nodes = nodes.filter((n) => n.level === 1)
  const scope = l1Nodes.length >= 20 ? l1Nodes : nodes

  // 势能迁移弧：以净额排序配对，代表「相对势能差」而非逐笔资金流
  // 只取二级板块：一级是二级之和、三级是二级的子集，任一层混入都会父子同源重复
  const arcPool = nodes.filter((n) => n.level === 2)
  const outs = arcPool.filter((n) => (n.period.net ?? 0) < 0).sort((a, b) => a.period.net - b.period.net).slice(0, 14)
  const ins = arcPool.filter((n) => (n.period.net ?? 0) > 0).sort((a, b) => b.period.net - a.period.net).slice(0, 14)
  const pairs = Math.min(outs.length, ins.length)
  const maxAmt = pairs ? Math.min(Math.abs(outs[0].period.net), ins[0].period.net) : 1
  const arcs = []
  for (let i = 0; i < pairs; i++) {
    const from = outs[i]
    const to = ins[i]
    const amount = Math.min(Math.abs(from.period.net), to.period.net)
    arcs.push({
      from: from.id,
      to: to.id,
      fromName: from.name,
      toName: to.name,
      amount: round(amount, 0),
      weight: round(amount / Math.max(maxAmt, 1), 3),
      basis: 'potential',
      confidence: round(0.42 + 0.12 * (from.group === to.group ? 1 : 0) + 0.1 * (1 - i / Math.max(pairs, 1)), 2),
    })
  }

  // 全局指标（基于一级行业总体，避免层级重复计数）
  const netTotal = scope.reduce((s, n) => s + (n.period.net ?? 0), 0)
  const upTotal = scope.reduce((s, n) => s + (n.up ?? 0), 0)
  const downTotal = scope.reduce((s, n) => s + (n.down ?? 0), 0)
  const breadth = upTotal + downTotal > 0 ? (upTotal - downTotal) / (upTotal + downTotal) : 0
  const absAll = scope.map((n) => Math.abs(n.period.net ?? 0)).sort((a, b) => b - a)
  const absSum = absAll.reduce((a, b) => a + b, 0)
  const top5Share = absSum > 0 ? absAll.slice(0, 5).reduce((a, b) => a + b, 0) / absSum : 0

  /**
   * 流入/流出分解取二级行业，而不是一级：
   *  - 一级只有 31 个扇区，正负相抵后「净流入合计」会显得远小于榜单头部板块，
   *    用户无法把左侧合计与右侧排行对上账（实测 29.62 亿 vs 榜单 top10 39.6 亿）；
   *  - 二级与一级全域闭合于同一个净额（ΣL2 = ΣL1），拆开看不会虚增总额；
   *  - 三级是二级的子集，父子同时计入才会真正重复。
   */
  const flowScope = nodes.filter((n) => n.level === 2)
  const flowIn = flowScope.filter((n) => (n.period.net ?? 0) > 0)
  const flowOut = flowScope.filter((n) => (n.period.net ?? 0) < 0)
  const inSum = flowIn.reduce((s, n) => s + n.period.net, 0)
  const outSum = flowOut.reduce((s, n) => s + n.period.net, 0)

  const regimeKey = netTotal > 0 && breadth > 0.55 ? 'risk-on' : netTotal < 0 && breadth < 0.45 ? 'risk-off' : 'rotate'

  const byNet = [...scope].sort((a, b) => (b.period.net ?? 0) - (a.period.net ?? 0))
  const leader = byNet[0] || null
  const laggard = byNet[byNet.length - 1] || null

  const phases = sessionPhase(new Date(now))
  const gates = runGates(nodes, {
    expected: opt.expected || 496,
    received: nodes.length,
    fetchedAt: now,
    period,
    total: opt.total || nodes.length,
  }, phases.phase)

  const periodMeta = PERIODS.find((p) => p.key === period) || PERIODS[0]

  // 层级分布：用来在审计面板里暴露「一/二/三级各多少个」，
  // 层级判定一旦回归（例如新增板块名不在表内），这里会直接看出来
  const levelCounts = { 1: 0, 2: 0, 3: 0 }
  for (const n of nodes) levelCounts[n.level] = (levelCounts[n.level] || 0) + 1

  const lean = nodes.map((n) => ({
    id: n.id,
    name: n.name,
    level: n.level,
    group: n.group,
    anchor: n.l1Anchor,
    net: round(n.period.net, 0),
    netPct: round(n.period.netPct, 3),
    chg: round(n.chg, 2),
    up: n.up,
    down: n.down,
    d5net: round(n.d5?.net ?? null, 0),
    d10net: round(n.d10?.net ?? null, 0),
    leader: n.leader,
    score: n.score,
    verdict: { code: n.verdict.code, label: n.verdict.label, tone: n.verdict.tone, reasons: n.verdict.reasons },
    visual: n.visual,
  }))

  const payload = {
    schema: SCHEMA_ID,
    generatedAt: now,
    asOf: new Date(gates.latestTs || now).toISOString(),
    period: { key: period, label: periodMeta.label, cn: periodMeta.cn, unit: 'CNY', hint: periodMeta.hint },
    session: { phase: phases.phase, label: phases.label, tradingDay: phases.tradingDay, progress: round(phases.progress, 4) },
    universe: {
      id: UNIVERSE_ID,
      label: '申万三级行业板块',
      expected: opt.expected || 496,
      received: nodes.length,
      groups: groups.length,
      levels: levelCounts,
      hash: checksum(nodes.map((n) => `${n.id}:${n.period.net}`).join('|')),
    },
    source: {
      provider: 'eastmoney.push2',
      channel: opt.channel || 'live',
      latencyMs: opt.latencyMs ?? null,
      failovers: opt.failovers ?? 0,
      pages: opt.pages ?? null,
    },
    kpi: {
      netTotal: round(netTotal, 0),
      inflowCount: flowIn.length,
      outflowCount: flowOut.length,
      inflowSum: round(inSum, 0),
      outflowSum: round(outSum, 0),
      flowScope: { level: 2, count: flowScope.length, label: '二级行业（128）' },
      breadth: round(breadth, 3),
      concentration: round(top5Share, 3),
      hhi: Math.round(hhi(scope.map((n) => n.period.net ?? 0))),
      scope: { count: scope.length, label: scope === l1Nodes ? '一级行业（31）' : '全部板块', level: scope === l1Nodes ? 1 : 0 },
      leader: leader ? { id: leader.id, name: leader.name, net: round(leader.period.net, 0) } : null,
      laggard: laggard ? { id: laggard.id, name: laggard.name, net: round(laggard.period.net, 0) } : null,
      regime: { code: regimeKey, ...REGIMES[regimeKey] },
      stats: { medNet: round(stats.medNet, 0), madNet: round(stats.madNet, 0) },
    },
    groups: groups.map((g) => ({
      group: g.group,
      members: g.members,
      counts: g.counts,
      subs: g.counts[2] || 0,
      net: round(g.net, 0),
      netPct: round(g.netPct, 3),
      breadth: round(g.breadth, 3),
      anchor: g.level1Id,
    })),
    nodes: lean,
    arcs,
    verdictLegend: Object.entries(VERDICTS).map(([code, v]) => ({ code, label: v.label, tone: v.tone })),
    audit: {
      contract: SCHEMA_ID,
      score: gates.score,
      passed: gates.passed,
      total: gates.total,
      degraded: gates.degraded,
      ageSec: gates.ageSec,
      checks: gates.checks,
    },
  }

  const validation = validate(payload)
  payload.audit.contractOk = validation.ok
  payload.audit.errors = validation.errors
  if (!validation.ok) payload.audit.degraded = true

  return payload
}

const REQUIRED_TOP = ['schema', 'generatedAt', 'period', 'session', 'universe', 'source', 'kpi', 'nodes', 'arcs', 'audit']
const REQUIRED_NODE = ['id', 'name', 'net', 'score', 'verdict', 'visual']

/** 契约校验：结构、类型、取值范围三重检查 */
export function validate(payload) {
  const errors = []
  for (const k of REQUIRED_TOP) {
    if (payload[k] === undefined || payload[k] === null) errors.push(`missing ${k}`)
  }
  if (payload.schema !== SCHEMA_ID) errors.push(`schema mismatch: ${payload.schema}`)
  if (!Array.isArray(payload.nodes) || payload.nodes.length === 0) {
    errors.push('nodes empty')
    return { ok: false, errors }
  }
  for (const n of payload.nodes) {
    for (const k of REQUIRED_NODE) {
      if (n[k] === undefined) errors.push(`node ${n.id} missing ${k}`)
    }
    if (n.net != null && !Number.isFinite(n.net)) errors.push(`node ${n.id} net not finite`)
    if (n.score?.value != null && Math.abs(n.score.value) > 100) errors.push(`node ${n.id} score out of range`)
    if (n.rank === 0) errors.push(`node ${n.id} rank invalid`)
    if (n.visual && Math.abs(n.visual.h) > 1.001) errors.push(`node ${n.id} visual.h out of range`)
  }
  for (const a of payload.arcs) {
    if (!a.from || !a.to) errors.push('arc missing endpoint')
    if (!(a.weight >= 0 && a.weight <= 1.0001)) errors.push(`arc weight out of range: ${a.weight}`)
  }
  if (errors.length > 20) errors.length = 20
  return { ok: errors.length === 0, errors }
}
