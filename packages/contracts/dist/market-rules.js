/**
 * A 股涨跌停幅度（%）：主板 ±10、创业板/科创板 ±20、北交所 ±30，指数不设限。
 * 放在共享包里而不是各端各写一份，避免前端徽标与后端判定打架。
 */
export const PRICE_LIMIT_PCT = {
    main: 10,
    gem: 20,
    star: 20,
    bse: 30,
    index: Number.POSITIVE_INFINITY,
};
/** 行情方向：A 股惯例红涨绿跌，平盘走中性色。 */
export function trendOf(changePct) {
    if (changePct > 0.005)
        return 'up';
    if (changePct < -0.005)
        return 'down';
    return 'flat';
}
/** 是否触及涨跌停。容差 0.01 吸收浮点误差与行情快照的四舍五入。 */
export function limitStatusOf(node) {
    const limit = PRICE_LIMIT_PCT[node.board];
    if (!Number.isFinite(limit))
        return 'normal';
    if (node.changePct >= limit - 0.01)
        return 'limit-up';
    if (node.changePct <= -limit + 0.01)
        return 'limit-down';
    return 'normal';
}
const LIMIT_LABEL = {
    'limit-up': '涨停',
    'limit-down': '跌停',
    normal: '正常',
};
export function limitStatusLabel(status) {
    return LIMIT_LABEL[status];
}
//# sourceMappingURL=market-rules.js.map