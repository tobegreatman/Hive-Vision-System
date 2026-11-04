import type { MarketNode } from '@platform/contracts'

/** 行业聚合结果：资金流与主线分析共用同一份口径。 */
export interface IndustryFlow {
  name: string
  count: number
  up: number
  down: number
  turnover: number
  netInflow: number
  avgChangePct: number
  leader: MarketNode
}

/**
 * 行业口径：取个股标签里的第一个行业标签。
 * 一只股票常带「锂电 + 新能源」多个标签，按第一个聚合能避免同一笔资金被重复统计。
 */
export function aggregateIndustryFlow(nodes: readonly MarketNode[]): IndustryFlow[] {
  const groups = new Map<string, MarketNode[]>()

  for (const node of nodes) {
    if (node.kind !== 'stock') continue
    const industry = node.tags[0] ?? '其他'
    const list = groups.get(industry)
    if (list) list.push(node)
    else groups.set(industry, [node])
  }

  const rows: IndustryFlow[] = []
  for (const [name, list] of groups) {
    const turnover = list.reduce((sum, node) => sum + node.turnover, 0)
    const netInflow = list.reduce((sum, node) => sum + node.mainNetInflow, 0)
    const weighted =
      turnover > 0
        ? list.reduce((sum, node) => sum + node.changePct * node.turnover, 0) / turnover
        : list.reduce((sum, node) => sum + node.changePct, 0) / list.length
    const leader = list.reduce((best, node) => (node.changePct > best.changePct ? node : best))

    rows.push({
      name,
      count: list.length,
      up: list.filter((node) => node.changePct > 0).length,
      down: list.filter((node) => node.changePct < 0).length,
      turnover,
      netInflow,
      avgChangePct: weighted,
      leader,
    })
  }

  return rows.sort((a, b) => b.netInflow - a.netInflow)
}
