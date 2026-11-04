import type { MarketNode } from '@platform/contracts'
import { describe, expect, it } from 'vitest'

import {
  BOARD_LABEL,
  bloomFactor,
  limitLabel,
  limitTone,
  neighborOf,
  orderByTurnover,
  symbolLabel,
  trendColor,
} from './presentation'

function makeNode(overrides: Partial<MarketNode> = {}): MarketNode {
  return {
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
    createdAt: '2026-11-04T00:00:00.000Z',
    updatedAt: '2026-11-04T00:00:00.000Z',
    ...overrides,
  }
}

describe('trendColor', () => {
  it('红涨绿跌，平盘走中性灰', () => {
    expect(trendColor({ changePct: 3.2 })).toBe('#d64545')
    expect(trendColor({ changePct: -3.2 })).toBe('#0f9d76')
    expect(trendColor({ changePct: 0 })).toBe('#8291a5')
  })

  it('容差内的极小波动按平盘处理', () => {
    expect(trendColor({ changePct: 0.004 })).toBe('#8291a5')
  })
})

describe('BOARD_LABEL', () => {
  it('五个板块都有中文名', () => {
    expect(BOARD_LABEL.main).toBe('沪深主板')
    expect(BOARD_LABEL.bse).toBe('北交所')
    expect(Object.keys(BOARD_LABEL)).toHaveLength(5)
  })
})

describe('涨跌停徽标', () => {
  it('涨停用 danger 调，跌停用 ok 调，正常态走中性', () => {
    expect(limitTone('limit-up')).toBe('danger')
    expect(limitTone('limit-down')).toBe('ok')
    expect(limitTone('normal')).toBe('idle')
  })

  it('标签文案可读', () => {
    expect(limitLabel('limit-up')).toBe('涨停')
    expect(limitLabel('normal')).toBe('正常')
  })
})

describe('bloomFactor', () => {
  it('空盘面给下限值', () => {
    expect(bloomFactor([])).toBe(0.7)
  })

  it('波动越大越亮，且不超过上限', () => {
    const calm = bloomFactor([makeNode({ changePct: 0.2 })])
    const wild = bloomFactor([makeNode({ changePct: 9 })])
    expect(wild).toBeGreaterThan(calm)
    expect(bloomFactor([makeNode({ changePct: 30 })])).toBeLessThanOrEqual(1.25)
  })
})

describe('symbolLabel', () => {
  it('拼成 代码.交易所', () => {
    expect(symbolLabel({ symbol: '300750', exchange: 'SZ' })).toBe('300750.SZ')
  })
})

describe('orderByTurnover', () => {
  it('按成交额降序且不修改入参', () => {
    const nodes = [
      makeNode({ id: 'a', turnover: 10 }),
      makeNode({ id: 'b', turnover: 90 }),
      makeNode({ id: 'c', turnover: 40 }),
    ]
    const ordered = orderByTurnover(nodes)
    expect(ordered.map((node) => node.id)).toEqual(['b', 'c', 'a'])
    expect(nodes.map((node) => node.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('neighborOf（板块内导航）', () => {
  const nodes = [makeNode({ id: 'a' }), makeNode({ id: 'b' }), makeNode({ id: 'c' })]

  it('向后取下一只，到尾部环绕回第一只', () => {
    expect(neighborOf(nodes, 'a', 1)?.id).toBe('b')
    expect(neighborOf(nodes, 'c', 1)?.id).toBe('a')
  })

  it('向前取上一只，到头部环绕到最后一只', () => {
    expect(neighborOf(nodes, 'c', -1)?.id).toBe('b')
    expect(neighborOf(nodes, 'a', -1)?.id).toBe('c')
  })

  it('未选中时给第一只', () => {
    expect(neighborOf(nodes, null, 1)?.id).toBe('a')
  })

  it('空列表返回 null', () => {
    expect(neighborOf([], 'a', 1)).toBeNull()
  })
})
