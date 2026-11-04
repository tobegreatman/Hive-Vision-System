import { describe, expect, it } from 'vitest'

import {
  BOARD_LABEL,
  BOARD_ORDER,
  createMarketNodeInputSchema,
  limitStatusOf,
  marketBoardSummarySchema,
  marketNodeSchema,
  trendOf,
  updateMarketNodeInputSchema,
} from '@platform/contracts'

describe('createMarketNodeInputSchema', () => {
  it('applies defaults for the optional snapshot fields', () => {
    const parsed = createMarketNodeInputSchema.parse({
      symbol: '600519',
      name: '贵州茅台',
      exchange: 'SH',
      board: 'main',
      price: 1586,
    })

    expect(parsed).toEqual({
      symbol: '600519',
      name: '贵州茅台',
      exchange: 'SH',
      board: 'main',
      price: 1586,
      changePct: 0,
      turnover: 0,
      heat: 0.5,
    })
  })

  it('rejects symbols that are not six digits', () => {
    const base = { name: '测试', exchange: 'SH', board: 'main', price: 10 }
    expect(createMarketNodeInputSchema.safeParse({ ...base, symbol: '60051' }).success).toBe(false)
    expect(createMarketNodeInputSchema.safeParse({ ...base, symbol: '60051A' }).success).toBe(false)
  })

  it('rejects a board that the exchange does not list', () => {
    const result = createMarketNodeInputSchema.safeParse({
      symbol: '300750',
      name: '宁德时代',
      exchange: 'SH',
      board: 'gem',
      price: 268,
    })
    expect(result.success).toBe(false)
  })

  it('rejects an index code that does not look like 000/399', () => {
    const result = createMarketNodeInputSchema.safeParse({
      symbol: '600000',
      name: '伪指数',
      exchange: 'SH',
      board: 'index',
      price: 3000,
    })
    expect(result.success).toBe(false)
  })

  it('trims names and rejects blank ones', () => {
    const base = { symbol: '600519', exchange: 'SH', board: 'main', price: 10 }
    expect(createMarketNodeInputSchema.parse({ ...base, name: '  茅台  ' }).name).toBe('茅台')
    expect(createMarketNodeInputSchema.safeParse({ ...base, name: '   ' }).success).toBe(false)
  })
})

describe('updateMarketNodeInputSchema', () => {
  it('accepts a partial heat patch', () => {
    expect(updateMarketNodeInputSchema.safeParse({ heat: 0.8 }).success).toBe(true)
  })

  it('rejects an empty patch', () => {
    expect(updateMarketNodeInputSchema.safeParse({}).success).toBe(false)
  })

  it('rejects heat outside 0–1', () => {
    expect(updateMarketNodeInputSchema.safeParse({ heat: 1.4 }).success).toBe(false)
  })
})

describe('marketNodeSchema', () => {
  const valid = {
    id: 'b3f1a3a4-1111-4c2a-9f70-3a4b5c6d7e8f',
    symbol: '600519',
    exchange: 'SH',
    name: '贵州茅台',
    kind: 'stock',
    board: 'main',
    price: 1586,
    changePct: 1.24,
    amplitude: 1.86,
    turnoverRate: 0.28,
    volumeRatio: 1.14,
    turnover: 38.6,
    marketCap: 19920,
    mainNetInflow: 6.2,
    heat: 0.92,
    tags: ['白酒'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }

  it('accepts a well-formed node', () => {
    expect(marketNodeSchema.safeParse(valid).success).toBe(true)
  })

  it('requires a uuid id', () => {
    expect(marketNodeSchema.safeParse({ ...valid, id: 'nope' }).success).toBe(false)
  })

  it('rejects changePct beyond the ±30% schema guard', () => {
    expect(marketNodeSchema.safeParse({ ...valid, changePct: 42 }).success).toBe(false)
  })
})

describe('market rules', () => {
  it('marks direction with the A-share convention thresholds', () => {
    expect(trendOf(0.62)).toBe('up')
    expect(trendOf(-0.68)).toBe('down')
    expect(trendOf(0)).toBe('flat')
  })

  it('uses board specific price limits', () => {
    expect(limitStatusOf({ board: 'main', changePct: 10 })).toBe('limit-up')
    expect(limitStatusOf({ board: 'gem', changePct: 10 })).toBe('normal')
    expect(limitStatusOf({ board: 'gem', changePct: 20 })).toBe('limit-up')
    expect(limitStatusOf({ board: 'main', changePct: -10 })).toBe('limit-down')
  })

  it('never treats an index as limit-locked', () => {
    expect(limitStatusOf({ board: 'index', changePct: 9.9 })).toBe('normal')
  })
})

describe('板块聚合契约（蜂巢第一层）', () => {
  it('BOARD_ORDER 覆盖全部板块，指数打头，保证蜂巢位置稳定', () => {
    expect(BOARD_ORDER).toEqual(['index', 'main', 'gem', 'star', 'bse'])
    expect(Object.keys(BOARD_LABEL).sort()).toEqual([...BOARD_ORDER].sort())
  })

  it('接受一份合法聚合', () => {
    const summary = {
      board: 'gem',
      label: '创业板',
      count: 3,
      up: 2,
      down: 1,
      limitCount: 0,
      turnover: 181.9,
      mainNetInflow: 22.2,
      avgChangePct: 2.19,
      leader: null,
    }
    expect(marketBoardSummarySchema.safeParse(summary).success).toBe(true)
  })

  it('拒绝负家数与非法板块', () => {
    const base = {
      board: 'main',
      label: '沪深主板',
      count: 0,
      up: 0,
      down: 0,
      limitCount: 0,
      turnover: 0,
      mainNetInflow: 0,
      avgChangePct: 0,
      leader: null,
    }
    expect(marketBoardSummarySchema.safeParse({ ...base, count: -1 }).success).toBe(false)
    expect(marketBoardSummarySchema.safeParse({ ...base, board: 'kcb' }).success).toBe(false)
  })
})
