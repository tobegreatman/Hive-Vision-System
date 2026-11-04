import { z } from 'zod'

import { isoDateSchema } from './primitives.js'
import { marketBoardSchema, marketNodeSchema, updateMarketNodeInputSchema } from './market.js'

/** 路由表前后端共用，避免魔法字符串漂移。 */
export const API_ROUTES = {
  health: '/api/health',
  overview: '/api/market/overview',
  boards: '/api/market/boards',
  nodes: '/api/market/nodes',
  node: (id: string) => `/api/market/nodes/${id}`,
  nodeDetail: (id: string) => `/api/market/nodes/${id}/detail`,
} as const

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
})

export type ApiError = z.infer<typeof apiErrorSchema>

/** 交易时段，用于顶部状态栏与「是否实时」提示。 */
export const marketSessionSchema = z.enum([
  'pre-open',
  'auction',
  'open',
  'lunch-break',
  'closed',
  'holiday',
])

export type MarketSession = z.infer<typeof marketSessionSchema>

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  runtime: z.string(),
  uptimeMs: z.number().nonnegative(),
  timestamp: z.string(),
  session: marketSessionSchema,
  tradeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** 明确标注数据来源，避免把演示快照当成实时行情。 */
  dataMode: z.enum(['demo', 'live']),
})

export type HealthResponse = z.infer<typeof healthResponseSchema>

export const marketBreadthSchema = z.object({
  up: z.number().int().nonnegative(),
  down: z.number().int().nonnegative(),
  flat: z.number().int().nonnegative(),
  limitUp: z.number().int().nonnegative(),
  limitDown: z.number().int().nonnegative(),
})

export type MarketBreadth = z.infer<typeof marketBreadthSchema>

export const marketOverviewSchema = z.object({
  indices: z.array(marketNodeSchema),
  breadth: marketBreadthSchema,
  /** 两市成交额（亿元） */
  turnover: z.number().nonnegative(),
  /** 主力净流入合计（亿元） */
  mainNetInflow: z.number(),
  session: marketSessionSchema,
  tradeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  asOf: isoDateSchema,
})

export type MarketOverview = z.infer<typeof marketOverviewSchema>

export const marketOverviewResponseSchema = z.object({
  overview: marketOverviewSchema,
})

export type MarketOverviewResponse = z.infer<typeof marketOverviewResponseSchema>

export const listMarketNodesResponseSchema = z.object({
  items: z.array(marketNodeSchema),
  total: z.number().int().nonnegative(),
})

export type ListMarketNodesResponse = z.infer<typeof listMarketNodesResponseSchema>

/**
 * 板块聚合：蜂巢导航第一层的单元。
 * 家数 / 涨跌 / 成交额 / 均涨幅 / 领涨股都由服务端算好，前端只负责排布六边形。
 */
export const marketBoardSummarySchema = z.object({
  board: marketBoardSchema,
  label: z.string().min(1),
  count: z.number().int().nonnegative(),
  up: z.number().int().nonnegative(),
  down: z.number().int().nonnegative(),
  /** 涨跌停家数合计（涨停 + 跌停），用于板块层面的极端情绪提示 */
  limitCount: z.number().int().nonnegative(),
  /** 板块成交额（亿元） */
  turnover: z.number().nonnegative(),
  /** 板块主力净流入合计（亿元） */
  mainNetInflow: z.number(),
  /** 板块平均涨跌幅 % */
  avgChangePct: z.number().min(-30).max(30),
  /** 领涨标的（按涨跌幅），空板块为 null */
  leader: marketNodeSchema.nullable(),
})

export type MarketBoardSummary = z.infer<typeof marketBoardSummarySchema>

export const listMarketBoardsResponseSchema = z.object({
  items: z.array(marketBoardSummarySchema),
  asOf: isoDateSchema,
})

export type ListMarketBoardsResponse = z.infer<typeof listMarketBoardsResponseSchema>

export const marketNodeResponseSchema = z.object({
  node: marketNodeSchema,
})

export type MarketNodeResponse = z.infer<typeof marketNodeResponseSchema>

/**
 * 拾取后展示的盘口统计：排名、同板块家数、涨跌停状态均由服务端计算，
 * 前端只渲染，不在本地重复实现业务规则。
 */
export const marketNodeDetailSchema = z.object({
  rank: z.number().int().positive(),
  peerCount: z.number().int().nonnegative(),
  limitStatus: z.enum(['limit-up', 'limit-down', 'normal']),
  visits: z.number().int().nonnegative(),
  lastVisitedAt: isoDateSchema.nullable(),
})

export type MarketNodeDetail = z.infer<typeof marketNodeDetailSchema>

export const marketNodeDetailResponseSchema = z.object({
  node: marketNodeSchema,
  detail: marketNodeDetailSchema,
})

export type MarketNodeDetailResponse = z.infer<typeof marketNodeDetailResponseSchema>

export const updateMarketNodePayloadSchema = updateMarketNodeInputSchema

export type ApiRouteKey = keyof typeof API_ROUTES
