import { randomUUID } from 'node:crypto'

import type {
  CreateMarketNodeCommand,
  MarketBoard,
  MarketBoardSummary,
  MarketBreadth,
  MarketExchange,
  MarketKind,
  MarketNode,
  MarketOverview,
  MarketSession,
  UpdateMarketNodePayload,
} from '@platform/contracts'
import { BOARD_LABEL, BOARD_ORDER, limitStatusOf, trendOf } from '@platform/contracts'

interface VisitRecord {
  visits: number
  lastVisitedAt: string | null
}

interface SeedNode {
  symbol: string
  exchange: MarketExchange
  name: string
  kind: MarketKind
  board: MarketBoard
  price: number
  changePct: number
  amplitude: number
  turnoverRate: number
  volumeRatio: number
  turnover: number
  marketCap: number
  mainNetInflow: number
  heat: number
  tags: string[]
}

/**
 * 盘面样本：13 只个股 + 3 条指数。数值为教学用快照，非实时行情，
 * 接口通过 health.dataMode = 'demo' 明确标注。
 */
const SEEDS: SeedNode[] = [
  {
    symbol: '000001',
    exchange: 'SH',
    name: '上证指数',
    kind: 'index',
    board: 'index',
    price: 3312.45,
    changePct: 0.62,
    amplitude: 0.94,
    turnoverRate: 0.9,
    volumeRatio: 1.05,
    turnover: 4210,
    marketCap: 552000,
    mainNetInflow: 86.4,
    heat: 0.86,
    tags: ['大盘', '沪市'],
  },
  {
    symbol: '399001',
    exchange: 'SZ',
    name: '深证成指',
    kind: 'index',
    board: 'index',
    price: 10548.32,
    changePct: 0.94,
    amplitude: 1.32,
    turnoverRate: 1.1,
    volumeRatio: 1.12,
    turnover: 5860,
    marketCap: 312000,
    mainNetInflow: 42.8,
    heat: 0.82,
    tags: ['大盘', '深市'],
  },
  {
    symbol: '399006',
    exchange: 'SZ',
    name: '创业板指',
    kind: 'index',
    board: 'index',
    price: 2176.88,
    changePct: -0.35,
    amplitude: 1.86,
    turnoverRate: 1.3,
    volumeRatio: 0.96,
    turnover: 2870,
    marketCap: 121000,
    mainNetInflow: -18.6,
    heat: 0.78,
    tags: ['成长', '创业板'],
  },
  {
    symbol: '600519',
    exchange: 'SH',
    name: '贵州茅台',
    kind: 'stock',
    board: 'main',
    price: 1586.0,
    changePct: 1.24,
    amplitude: 1.86,
    turnoverRate: 0.28,
    volumeRatio: 1.14,
    turnover: 38.6,
    marketCap: 19920,
    mainNetInflow: 6.2,
    heat: 0.92,
    tags: ['白酒', '权重'],
  },
  {
    symbol: '300750',
    exchange: 'SZ',
    name: '宁德时代',
    kind: 'stock',
    board: 'gem',
    price: 268.4,
    changePct: 2.86,
    amplitude: 3.42,
    turnoverRate: 0.92,
    volumeRatio: 1.36,
    turnover: 62.4,
    marketCap: 11810,
    mainNetInflow: 9.8,
    heat: 0.95,
    tags: ['锂电', '新能源'],
  },
  {
    symbol: '601318',
    exchange: 'SH',
    name: '中国平安',
    kind: 'stock',
    board: 'main',
    price: 58.72,
    changePct: -0.68,
    amplitude: 1.24,
    turnoverRate: 0.36,
    volumeRatio: 0.88,
    turnover: 41.2,
    marketCap: 10690,
    mainNetInflow: -4.1,
    heat: 0.7,
    tags: ['保险', '权重'],
  },
  {
    symbol: '000858',
    exchange: 'SZ',
    name: '五粮液',
    kind: 'stock',
    board: 'main',
    price: 142.3,
    changePct: 0.86,
    amplitude: 1.52,
    turnoverRate: 0.41,
    volumeRatio: 1.02,
    turnover: 31.5,
    marketCap: 5520,
    mainNetInflow: 2.4,
    heat: 0.6,
    tags: ['白酒'],
  },
  {
    symbol: '002594',
    exchange: 'SZ',
    name: '比亚迪',
    kind: 'stock',
    board: 'main',
    price: 312.8,
    changePct: 3.42,
    amplitude: 4.16,
    turnoverRate: 1.08,
    volumeRatio: 1.44,
    turnover: 78.9,
    marketCap: 9110,
    mainNetInflow: 12.6,
    heat: 0.88,
    tags: ['汽车', '新能源'],
  },
  {
    symbol: '688981',
    exchange: 'SH',
    name: '中芯国际',
    kind: 'stock',
    board: 'star',
    price: 96.35,
    changePct: 4.68,
    amplitude: 6.02,
    turnoverRate: 2.14,
    volumeRatio: 1.62,
    turnover: 55.3,
    marketCap: 7660,
    mainNetInflow: 7.4,
    heat: 0.82,
    tags: ['半导体', '科创板'],
  },
  {
    symbol: '300059',
    exchange: 'SZ',
    name: '东方财富',
    kind: 'stock',
    board: 'gem',
    price: 22.48,
    changePct: 5.12,
    amplitude: 6.88,
    turnoverRate: 3.62,
    volumeRatio: 1.88,
    turnover: 96.8,
    marketCap: 3550,
    mainNetInflow: 15.2,
    heat: 0.93,
    tags: ['券商', '互联网金融'],
  },
  {
    symbol: '600030',
    exchange: 'SH',
    name: '中信证券',
    kind: 'stock',
    board: 'main',
    price: 28.16,
    changePct: 2.05,
    amplitude: 3.14,
    turnoverRate: 1.26,
    volumeRatio: 1.22,
    turnover: 68.4,
    marketCap: 4170,
    mainNetInflow: 5.6,
    heat: 0.75,
    tags: ['券商'],
  },
  {
    symbol: '300124',
    exchange: 'SZ',
    name: '汇川技术',
    kind: 'stock',
    board: 'gem',
    price: 61.2,
    changePct: -1.42,
    amplitude: 2.68,
    turnoverRate: 0.74,
    volumeRatio: 0.92,
    turnover: 22.7,
    marketCap: 1640,
    mainNetInflow: -2.8,
    heat: 0.5,
    tags: ['工控', '机器人'],
  },
  {
    symbol: '601012',
    exchange: 'SH',
    name: '隆基绿能',
    kind: 'stock',
    board: 'main',
    price: 17.85,
    changePct: -2.36,
    amplitude: 3.28,
    turnoverRate: 1.14,
    volumeRatio: 1.06,
    turnover: 18.9,
    marketCap: 1350,
    mainNetInflow: -3.6,
    heat: 0.45,
    tags: ['光伏'],
  },
  {
    symbol: '002415',
    exchange: 'SZ',
    name: '海康威视',
    kind: 'stock',
    board: 'main',
    price: 30.42,
    changePct: 0.32,
    amplitude: 1.18,
    turnoverRate: 0.44,
    volumeRatio: 0.94,
    turnover: 19.8,
    marketCap: 2810,
    mainNetInflow: 1.1,
    heat: 0.55,
    tags: ['安防'],
  },
  {
    symbol: '601127',
    exchange: 'SH',
    name: '赛力斯',
    kind: 'stock',
    board: 'main',
    price: 128.6,
    changePct: 10,
    amplitude: 11.42,
    turnoverRate: 4.86,
    volumeRatio: 2.34,
    turnover: 54.2,
    marketCap: 2160,
    mainNetInflow: 8.9,
    heat: 0.8,
    tags: ['汽车', '华为链'],
  },
  {
    symbol: '002460',
    exchange: 'SZ',
    name: '赣锋锂业',
    kind: 'stock',
    board: 'main',
    price: 32.18,
    changePct: -10,
    amplitude: 9.68,
    turnoverRate: 5.24,
    volumeRatio: 2.18,
    turnover: 27.4,
    marketCap: 640,
    mainNetInflow: -6.4,
    heat: 0.65,
    tags: ['锂矿'],
  },
  {
    symbol: '835185',
    exchange: 'BJ',
    name: '贝特瑞',
    kind: 'stock',
    board: 'bse',
    price: 41.2,
    changePct: 30,
    amplitude: 18.64,
    turnoverRate: 3.18,
    volumeRatio: 2.06,
    turnover: 8.4,
    marketCap: 292,
    mainNetInflow: 1.7,
    heat: 0.58,
    tags: ['锂电材料', '北交所'],
  },
]

const SHANGHAI_INDEX = '000001'
const SHENZHEN_INDEX = '399001'

function isoNow(): string {
  return new Date().toISOString()
}

function beijingClock(now: Date): { minutes: number; weekday: string; tradeDate: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  }).formatToParts(now)

  const pick = (type: string): string => parts.find((part) => part.type === type)?.value ?? ''
  const hour = Number(pick('hour')) % 24
  const minute = Number(pick('minute'))

  return {
    minutes: hour * 60 + minute,
    weekday: pick('weekday'),
    tradeDate: `${pick('year')}-${pick('month')}-${pick('day')}`,
  }
}

export function currentSession(now: Date = new Date()): MarketSession {
  const { minutes, weekday } = beijingClock(now)
  if (weekday === 'Sat' || weekday === 'Sun') return 'holiday'
  if (minutes < 9 * 60 + 15) return 'pre-open'
  if (minutes < 9 * 60 + 30) return 'auction'
  if (minutes < 11 * 60 + 30) return 'open'
  if (minutes < 13 * 60) return 'lunch-break'
  if (minutes < 15 * 60) return 'open'
  return 'closed'
}

export function currentTradeDate(now: Date = new Date()): string {
  return beijingClock(now).tradeDate
}

function buildSeed(): MarketNode[] {
  const createdAt = isoNow()

  return SEEDS.map((seed) => ({
    id: randomUUID(),
    symbol: seed.symbol,
    exchange: seed.exchange,
    name: seed.name,
    kind: seed.kind,
    board: seed.board,
    price: seed.price,
    changePct: seed.changePct,
    amplitude: seed.amplitude,
    turnoverRate: seed.turnoverRate,
    volumeRatio: seed.volumeRatio,
    turnover: seed.turnover,
    marketCap: seed.marketCap,
    mainNetInflow: seed.mainNetInflow,
    heat: seed.heat,
    tags: seed.tags,
    createdAt,
    updatedAt: createdAt,
  }))
}

function sortByTurnoverDesc(nodes: MarketNode[]): MarketNode[] {
  return [...nodes].sort((a, b) => b.turnover - a.turnover)
}

/**
 * 内存仓储：单进程、无外部依赖。
 * 业务规则（涨跌停、排名、家数）一律服务端计算，前端只渲染。
 */
export class MarketService {
  private readonly nodes = new Map<string, MarketNode>()
  private readonly visits = new Map<string, VisitRecord>()

  constructor(seed: MarketNode[] = buildSeed()) {
    for (const node of seed) {
      this.nodes.set(node.id, node)
      this.visits.set(node.id, { visits: 0, lastVisitedAt: null })
    }
  }

  /** 盘面顺序：指数在前，其余按成交额降序，保证 3D 与列表读序一致。 */
  list(): MarketNode[] {
    const all = [...this.nodes.values()]
    const indices = all.filter((node) => node.kind === 'index')
    const stocks = sortByTurnoverDesc(all.filter((node) => node.kind === 'stock'))
    return [...indices, ...stocks]
  }

  find(id: string): MarketNode | undefined {
    return this.nodes.get(id)
  }

  overview(): MarketOverview {
    const all = [...this.nodes.values()]
    const stocks = all.filter((node) => node.kind === 'stock')
    const indices = all.filter((node) => node.kind === 'index')

    const breadth: MarketBreadth = {
      up: stocks.filter((node) => trendOf(node.changePct) === 'up').length,
      down: stocks.filter((node) => trendOf(node.changePct) === 'down').length,
      flat: stocks.filter((node) => trendOf(node.changePct) === 'flat').length,
      limitUp: stocks.filter((node) => limitStatusOf(node) === 'limit-up').length,
      limitDown: stocks.filter((node) => limitStatusOf(node) === 'limit-down').length,
    }

    const shanghai = all.find((node) => node.symbol === SHANGHAI_INDEX)
    const shenzhen = all.find((node) => node.symbol === SHENZHEN_INDEX)

    return {
      indices,
      breadth,
      // 两市成交额只取沪、深综指口径，避免创业板指重复计入。
      turnover: Number(((shanghai?.turnover ?? 0) + (shenzhen?.turnover ?? 0)).toFixed(2)),
      mainNetInflow: Number(all.reduce((sum, node) => sum + node.mainNetInflow, 0).toFixed(2)),
      session: currentSession(),
      tradeDate: currentTradeDate(),
      asOf: isoNow(),
    }
  }

  create(command: CreateMarketNodeCommand): MarketNode {
    const now = isoNow()
    const kind: MarketKind = command.board === 'index' ? 'index' : 'stock'

    const node: MarketNode = {
      id: randomUUID(),
      symbol: command.symbol,
      exchange: command.exchange,
      name: command.name,
      kind,
      board: command.board,
      price: command.price,
      changePct: command.changePct,
      amplitude: Number(Math.min(Math.abs(command.changePct) * 1.8, 20).toFixed(2)),
      turnoverRate: 0,
      volumeRatio: 0,
      turnover: command.turnover,
      marketCap: Number((command.price * 10).toFixed(2)),
      mainNetInflow: 0,
      heat: command.heat,
      tags: ['自选'],
      createdAt: now,
      updatedAt: now,
    }

    this.nodes.set(node.id, node)
    this.visits.set(node.id, { visits: 0, lastVisitedAt: null })
    return node
  }

  update(id: string, patch: UpdateMarketNodePayload): MarketNode | undefined {
    const current = this.nodes.get(id)
    if (!current) return undefined

    const next: MarketNode = {
      ...current,
      heat: patch.heat ?? current.heat,
      updatedAt: isoNow(),
    }
    this.nodes.set(id, next)
    return next
  }

  /** 记录一次检视，返回自增后的计数。 */
  inspect(id: string): { visits: number; lastVisitedAt: string | null } | undefined {
    if (!this.nodes.has(id)) return undefined
    const record = this.visits.get(id) ?? { visits: 0, lastVisitedAt: null }
    const next: VisitRecord = { visits: record.visits + 1, lastVisitedAt: isoNow() }
    this.visits.set(id, next)
    return next
  }

  /**
   * 板块聚合：蜂巢导航第一层的单元。
   *
   * 指数单列（`index` 板块），个股按 board 分组。板块顺序固定为
   * 指数 → 主板 → 创业板 → 科创板 → 北交所，保证两次刷新之间六边形不会跳位。
   */
  boards(): MarketBoardSummary[] {
    const all = [...this.nodes.values()]

    return BOARD_ORDER.map((board) => {
      const members = all.filter((node) => node.board === board)
      const sorted = [...members].sort((a, b) => b.changePct - a.changePct)
      const turnover = members.reduce((sum, node) => sum + node.turnover, 0)
      const netInflow = members.reduce((sum, node) => sum + node.mainNetInflow, 0)
      const avg =
        members.length === 0
          ? 0
          : members.reduce((sum, node) => sum + node.changePct, 0) / members.length

      return {
        board,
        label: BOARD_LABEL[board],
        count: members.length,
        up: members.filter((node) => trendOf(node.changePct) === 'up').length,
        down: members.filter((node) => trendOf(node.changePct) === 'down').length,
        limitCount: members.filter((node) => limitStatusOf(node) !== 'normal').length,
        turnover: Number(turnover.toFixed(2)),
        mainNetInflow: Number(netInflow.toFixed(2)),
        avgChangePct: Number(avg.toFixed(2)),
        leader: sorted[0] ?? null,
      }
    })
  }

  /** 成交额排名（全样本口径），1 表示成交额最大。 */
  rankOf(id: string): number {
    const ordered = sortByTurnoverDesc([...this.nodes.values()])
    const index = ordered.findIndex((node) => node.id === id)
    return index < 0 ? ordered.length : index + 1
  }

  peerCountOf(node: MarketNode): number {
    return [...this.nodes.values()].filter(
      (candidate) => candidate.id !== node.id && candidate.board === node.board,
    ).length
  }
}

export const marketService = new MarketService()
