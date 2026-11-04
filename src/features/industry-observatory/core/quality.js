/**
 * 质量门禁
 *
 * 每条门禁输出「实测值 / 期望值 / 是否通过」，最终合成 0–100 的质量分。
 * 任一致命门禁失败 → degraded=true，前端显式降级提示，绝不静默飘红。
 */
import { GATES } from './constants.js'
import { staleBudgetSeconds } from './session.js'

function check(id, label, value, expect, pass, fatal = false, note = '') {
  return { id, label, value, expect, pass, fatal, note }
}

/**
 * @param {Array} nodes 归一化节点
 * @param {{expected:number, received:number, fetchedAt:number, period:string, total:number}} meta
 * @param {string} phase 交易时段
 */
export function runGates(nodes, meta, phase = 'closed') {
  const checks = []
  const now = Date.now()

  // 1) 覆盖度：样本域是否完整
  const coverage = meta.expected ? meta.received / meta.expected : 0
  checks.push(
    check('coverage', '样本覆盖度', `${meta.received}/${meta.expected}`, `≥ ${(GATES.minCoverage * 100).toFixed(0)}%`, coverage >= GATES.minCoverage, true,
      '申万三级板块全域，缺失将导致分组失真')
  )

  // 2) 唯一性：主键去重后是否仍为 received
  const uniq = new Set(nodes.map((n) => n.id)).size
  checks.push(check('uniqueness', '主键唯一', uniq, `= ${meta.received}`, uniq === meta.received, true, '分页并发抓取可能产生重复'))

  // 3) 恒等式：主力 = 超大单 + 大单
  let identityHit = 0
  let identityBase = 0
  for (const n of nodes) {
    const t = n.period.tiers
    if (!t || t.xl == null || t.lg == null || n.period.net == null) continue
    identityBase++
    const diff = Math.abs(n.period.net - (t.xl + t.lg))
    const scale = Math.max(Math.abs(n.period.net), 1e7)
    if (diff / scale <= GATES.identityTolerance) identityHit++
  }
  const identityRate = identityBase ? identityHit / identityBase : 1
  checks.push(
    check('identity', '主力=超大+大单', `${(identityRate * 100).toFixed(1)}%`, '≥ 95%', identityRate >= 0.95, false,
      `校验 ${identityBase} 个节点的资金拆分一致性`)
  )

  // 4) 守恒律：所有板块四级资金流之和应趋近于零
  let sumAll = 0
  let sumAbs = 0
  for (const n of nodes) {
    const t = n.period.tiers
    if (!t) continue
    const vals = [n.period.net, t.md, t.sm].filter((v) => v != null)
    if (vals.length < 3) continue
    const s = vals.reduce((a, b) => a + b, 0)
    sumAll += s
    sumAbs += Math.abs(n.period.net || 0)
  }
  const conservation = sumAbs > 0 ? Math.abs(sumAll) / sumAbs : 0
  checks.push(
    check('conservation', '资金守恒残差', `${(conservation * 100).toFixed(3)}%`, `≤ ${(GATES.conservationTolerance * 100).toFixed(1)}%`, conservation <= GATES.conservationTolerance, false,
      '主力+中单+小单 全域求和应趋近 0，用于识别量级错位')
  )

  // 5) 完整度：关键字段空值率
  let nulls = 0
  for (const n of nodes) {
    if (n.period.net == null) nulls++
    else if (n.period.netPct == null) nulls++
    else if (n.chg == null) nulls++
  }
  const nullRate = nodes.length ? nulls / nodes.length : 1
  checks.push(
    check('completeness', '关键字段完整率', `${((1 - nullRate) * 100).toFixed(2)}%`, '≥ 98%', nullRate <= GATES.maxNullRate, true, `${nulls} 个节点存在空值`)
  )

  // 6) 时效性
  const stamps = nodes.map((n) => n.ts).filter((t) => Number.isFinite(t) && t > 1e12)
  const latest = stamps.length ? Math.max(...stamps) : meta.fetchedAt
  const ageSec = Math.max(0, (now - latest) / 1000)
  const budget = staleBudgetSeconds(phase)
  checks.push(
    check('freshness', '数据时效', `${Math.round(ageSec)}s`, `≤ ${budget}s`, ageSec <= budget, false,
      phase === 'closed' ? '非交易时段以最后收盘为准' : '盘中允许的最大延迟')
  )

  // 7) 归组完整性
  const ungrouped = nodes.filter((n) => n.group === '未归类').length
  checks.push(
    check('grouping', '行业归组覆盖', `${nodes.length - ungrouped}/${nodes.length}`, '= 100%', ungrouped === 0, false, '未归类节点会落到「未归类」扇区')
  )

  // 8) 分组一致性：每个分组的一级锚点存在
  const groups = new Set(nodes.map((n) => n.group))
  let anchored = 0
  for (const g of groups) {
    if (nodes.some((n) => n.group === g && n.level === 1)) anchored++
  }
  checks.push(
    check('anchors', '分组锚点', `${anchored}/${groups.size}`, '≥ 90%', groups.size > 0 && anchored / groups.size >= 0.9, false, '一级行业节点用于空间锚定与标签')
  )

  // 9) 层级守恒：申万一/二/三级是嵌套关系，各自独立闭合于同一全市场净额
  //    三层求和分裂，说明层级判定失效（父子混算会把金额放大数倍）
  const sums = { 1: 0, 2: 0, 3: 0 }
  const counts = { 1: 0, 2: 0, 3: 0 }
  for (const n of nodes) {
    const lv = n.level || 3
    sums[lv] += n.period.net ?? 0
    counts[lv]++
  }
  const baseScale = Math.max(Math.abs(sums[1]), Math.abs(sums[2]), 1e8)
  const drift = Math.max(Math.abs(sums[2] - sums[1]), Math.abs(sums[3] - sums[1])) / baseScale
  const layerOk = counts[1] >= 30 && counts[2] >= 120 && counts[3] >= 300 && drift <= GATES.hierarchyTolerance
  checks.push(
    check('hierarchy', '层级守恒', `L1/L2/L3 ${counts[1]}/${counts[2]}/${counts[3]} · 偏差 ${(drift * 100).toFixed(2)}%`,
      `31/128/337 · ≤ ${(GATES.hierarchyTolerance * 100).toFixed(1)}%`, layerOk, false,
      '一级=二级之和=三级之和；层级判定失效会导致金额重复计数')
  )

  const passed = checks.filter((c) => c.pass).length
  const fatalFail = checks.some((c) => c.fatal && !c.pass)
  const score = Math.round((passed / checks.length) * 100)

  return {
    checks,
    passed,
    total: checks.length,
    score,
    degraded: fatalFail || score < GATES.minPassRate * 100,
    latestTs: latest,
    ageSec: Math.round(ageSec),
  }
}
