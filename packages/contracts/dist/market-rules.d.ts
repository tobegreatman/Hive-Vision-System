import type { MarketBoard, MarketNode } from './market.js';
/**
 * A 股涨跌停幅度（%）：主板 ±10、创业板/科创板 ±20、北交所 ±30，指数不设限。
 * 放在共享包里而不是各端各写一份，避免前端徽标与后端判定打架。
 */
export declare const PRICE_LIMIT_PCT: Record<MarketBoard, number>;
export type MarketTrend = 'up' | 'down' | 'flat';
export type LimitStatus = 'limit-up' | 'limit-down' | 'normal';
/** 行情方向：A 股惯例红涨绿跌，平盘走中性色。 */
export declare function trendOf(changePct: number): MarketTrend;
type LimitInput = Pick<MarketNode, 'board' | 'changePct'>;
/** 是否触及涨跌停。容差 0.01 吸收浮点误差与行情快照的四舍五入。 */
export declare function limitStatusOf(node: LimitInput): LimitStatus;
export declare function limitStatusLabel(status: LimitStatus): string;
export {};
//# sourceMappingURL=market-rules.d.ts.map