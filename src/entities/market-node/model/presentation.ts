import type {
  LimitStatus,
  MarketExchange,
  MarketNode,
  MarketSession,
  MarketTrend,
} from '@platform/contracts'
import { BOARD_LABEL, limitStatusLabel, trendOf } from '@platform/contracts'

import { clamp } from '@/shared/lib/format'

/** 板块名前后端共用一份；这里再导出，前端不必重复定义。 */
export { BOARD_LABEL }

export const EXCHANGE_LABEL: Record<MarketExchange, string> = {
  SH: '沪',
  SZ: '深',
  BJ: '北',
}

export const SESSION_LABEL: Record<MarketSession, string> = {
  'pre-open': '盘前',
  auction: '集合竞价',
  open: '交易中',
  'lunch-break': '午间休市',
  closed: '已收盘',
  holiday: '休市',
}

/** A 股惯例：红涨绿跌。中性色留给平盘，避免误读。浅色主题下加深一档保证可读。 */
export const TREND_COLOR: Record<MarketTrend, string> = {
  up: '#d64545',
  down: '#0f9d76',
  flat: '#8291a5',
}

export function trendOfNode(node: Pick<MarketNode, 'changePct'>): MarketTrend {
  return trendOf(node.changePct)
}

export function trendColor(node: Pick<MarketNode, 'changePct'>): string {
  return TREND_COLOR[trendOf(node.changePct)]
}

/**
 * 3D 深空场景专用的霓虹涨跌色。
 * 分析页的表格文字仍用 TREND_COLOR（深色），场景里则需要亮一档才能在暗底上发光。
 */
export const SCENE_TREND_COLOR: Record<MarketTrend, string> = {
  up: '#ff5d73',
  down: '#2ee6a6',
  flat: '#8ba3c2',
}

export function sceneTrendColor(node: Pick<MarketNode, 'changePct'>): string {
  return SCENE_TREND_COLOR[trendOf(node.changePct)]
}

/** 展示用完整代码：600519.SH */
export function symbolLabel(node: Pick<MarketNode, 'symbol' | 'exchange'>): string {
  return `${node.symbol}.${node.exchange}`
}

/** 涨跌停徽标配色：正常态用中性色，避免「没事发生」被渲染成绿色成功态。 */
export type LimitTone = 'danger' | 'ok' | 'idle'

export function limitTone(status: LimitStatus): LimitTone {
  if (status === 'limit-up') return 'danger'
  if (status === 'limit-down') return 'ok'
  return 'idle'
}

export function limitLabel(status: LimitStatus): string {
  return limitStatusLabel(status)
}

/** 平均波动 → 辉光系数，盘面越活跃整体越亮。 */
export function bloomFactor(nodes: readonly MarketNode[]): number {
  if (nodes.length === 0) return 0.7
  const average = nodes.reduce((sum, node) => sum + Math.abs(node.changePct), 0) / nodes.length
  return clamp(0.62 + average * 0.045, 0.62, 1.25)
}

/** 板块内导航顺序：先按成交额降序，保证「上一只 / 下一只」稳定可预期。 */
export function orderByTurnover(nodes: readonly MarketNode[]): MarketNode[] {
  return [...nodes].sort((a, b) => b.turnover - a.turnover)
}

/**
 * 板块内相邻标的。到头部/尾部时环绕，避免用户走到尽头后要退出重进。
 * `id` 不在列表里时返回第一个。
 */
export function neighborOf(
  nodes: readonly MarketNode[],
  id: string | null,
  step: 1 | -1,
): MarketNode | null {
  if (nodes.length === 0) return null
  const current = nodes.findIndex((node) => node.id === id)
  if (current < 0) return nodes[0] ?? null
  const next = (current + step + nodes.length) % nodes.length
  return nodes[next] ?? null
}

export function heatPercent(heat: number): number {
  return Math.round(clamp(heat, 0, 1) * 100)
}

/** 把 #RRGGBB 转成带透明度的 rgba，用于涨跌色块的柔和底色。 */
export function tint(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '')
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
