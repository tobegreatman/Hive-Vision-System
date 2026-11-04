import type { MarketBoardSummary } from '@platform/contracts'
import { trendOf } from '@platform/contracts'

import { SCENE_TREND_COLOR } from '@/entities/market-node/model/presentation'

/** 空板块走中性灰，避免用「上涨红」误导成有行情。板块色只用于 3D 场景与深色导航，因此用霓虹档。 */
export function boardAccent(board: MarketBoardSummary): string {
  if (board.count === 0) return SCENE_TREND_COLOR.flat
  return SCENE_TREND_COLOR[trendOf(board.avgChangePct)]
}

/** 板块辉光：均涨幅越极端越亮，涨跌停家数再补一层权重。 */
export function boardGlow(board: MarketBoardSummary): number {
  if (board.count === 0) return 0
  return Math.abs(board.avgChangePct) / 8 + (board.limitCount / Math.max(board.count, 1)) * 0.5
}

/** 板块在蜂巢里的副标题，用于左侧导航条。 */
export function boardSubtitle(board: MarketBoardSummary): string {
  if (board.count === 0) return '暂无标的'
  return `${board.count} 只 · 涨 ${board.up} 跌 ${board.down}`
}
