import { z } from 'zod'

import { isoDateSchema, objectIdSchema } from './primitives.js'

/** 品种类型：指数用于大盘锚点，个股构成盘面主体。 */
export const marketKindSchema = z.enum(['index', 'stock'])

export type MarketKind = z.infer<typeof marketKindSchema>

/** 交易所：决定代码展示后缀与涨跌停规则。 */
export const marketExchangeSchema = z.enum(['SH', 'SZ', 'BJ'])

export type MarketExchange = z.infer<typeof marketExchangeSchema>

/**
 * 板块：主板 / 创业板 / 科创板 / 北交所 / 指数。
 * 涨跌停幅度由板块决定，规则见 `market-rules.ts`，前后端共用同一份实现。
 */
export const marketBoardSchema = z.enum(['main', 'gem', 'star', 'bse', 'index'])

export type MarketBoard = z.infer<typeof marketBoardSchema>

/** 板块展示名与蜂巢顺序：前后端共用，避免「主板 / 沪深主板」两套叫法漂移。 */
export const BOARD_LABEL: Record<MarketBoard, string> = {
  main: '沪深主板',
  gem: '创业板',
  star: '科创板',
  bse: '北交所',
  index: '指数',
}

export const BOARD_ORDER: readonly MarketBoard[] = ['index', 'main', 'gem', 'star', 'bse']

const symbolSchema = z.string().regex(/^\d{6}$/, '证券代码必须是 6 位数字')

export const marketNodeSchema = z.object({
  id: objectIdSchema,
  symbol: symbolSchema,
  exchange: marketExchangeSchema,
  name: z.string().min(1).max(16),
  kind: marketKindSchema,
  board: marketBoardSchema,
  /** 最新价（指数为点位） */
  price: z.number().positive(),
  /** 涨跌幅 %，主板 ±10、创业板/科创板 ±20 */
  changePct: z.number().min(-30).max(30),
  /** 振幅 % */
  amplitude: z.number().min(0).max(60),
  /** 换手率 % */
  turnoverRate: z.number().min(0).max(100),
  /** 量比 */
  volumeRatio: z.number().min(0).max(50),
  /** 成交额（亿元） */
  turnover: z.number().nonnegative(),
  /** 总市值（亿元） */
  marketCap: z.number().nonnegative(),
  /** 主力净流入（亿元，可为负） */
  mainNetInflow: z.number(),
  /** 关注度 0–1，驱动盘面高亮与六边形辉光强度 */
  heat: z.number().min(0).max(1),
  tags: z.array(z.string().min(1).max(12)).max(6),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
})

export type MarketNode = z.infer<typeof marketNodeSchema>

const boardByExchange: Record<MarketExchange, readonly MarketBoard[]> = {
  SH: ['main', 'star', 'index'],
  SZ: ['main', 'gem', 'index'],
  BJ: ['bse'],
}

/** 新增自选：只需给出身份与行情快照，盘面落点与规模由服务端分配。 */
export const createMarketNodeInputSchema = z
  .object({
    symbol: symbolSchema,
    name: z.string().trim().min(1, '名称不能为空').max(16, '名称最长 16 字符'),
    exchange: marketExchangeSchema,
    board: marketBoardSchema,
    price: z.number().positive('价格必须为正数').max(100000),
    changePct: z.number().min(-30, '涨跌幅超出范围').max(30).default(0),
    turnover: z.number().min(0).max(5000).default(0),
    heat: z.number().min(0).max(1).default(0.5),
  })
  .superRefine((value, ctx) => {
    if (!boardByExchange[value.exchange].includes(value.board)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['board'],
        message: `${value.exchange} 市场不支持该板块`,
      })
    }
    const isIndexLike = value.symbol.startsWith('000') || value.symbol.startsWith('399')
    if (value.board === 'index' && !isIndexLike) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['symbol'],
        message: '指数代码应以 000 或 399 开头',
      })
    }
  })

export type CreateMarketNodePayload = z.input<typeof createMarketNodeInputSchema>
export type CreateMarketNodeCommand = z.output<typeof createMarketNodeInputSchema>

export const updateMarketNodeInputSchema = z
  .object({
    heat: z.number().min(0).max(1),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: '至少需要提供一个可更新字段',
  })

export type UpdateMarketNodePayload = z.input<typeof updateMarketNodeInputSchema>
export type UpdateMarketNodeCommand = z.output<typeof updateMarketNodeInputSchema>
