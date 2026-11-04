import { z } from 'zod';
/** 品种类型：指数用于大盘锚点，个股构成盘面主体。 */
export declare const marketKindSchema: z.ZodEnum<["index", "stock"]>;
export type MarketKind = z.infer<typeof marketKindSchema>;
/** 交易所：决定代码展示后缀与涨跌停规则。 */
export declare const marketExchangeSchema: z.ZodEnum<["SH", "SZ", "BJ"]>;
export type MarketExchange = z.infer<typeof marketExchangeSchema>;
/**
 * 板块：主板 / 创业板 / 科创板 / 北交所 / 指数。
 * 涨跌停幅度由板块决定，规则见 `market-rules.ts`，前后端共用同一份实现。
 */
export declare const marketBoardSchema: z.ZodEnum<["main", "gem", "star", "bse", "index"]>;
export type MarketBoard = z.infer<typeof marketBoardSchema>;
/** 板块展示名与蜂巢顺序：前后端共用，避免「主板 / 沪深主板」两套叫法漂移。 */
export declare const BOARD_LABEL: Record<MarketBoard, string>;
export declare const BOARD_ORDER: readonly MarketBoard[];
export declare const marketNodeSchema: z.ZodObject<{
    id: z.ZodString;
    symbol: z.ZodString;
    exchange: z.ZodEnum<["SH", "SZ", "BJ"]>;
    name: z.ZodString;
    kind: z.ZodEnum<["index", "stock"]>;
    board: z.ZodEnum<["main", "gem", "star", "bse", "index"]>;
    /** 最新价（指数为点位） */
    price: z.ZodNumber;
    /** 涨跌幅 %，主板 ±10、创业板/科创板 ±20 */
    changePct: z.ZodNumber;
    /** 振幅 % */
    amplitude: z.ZodNumber;
    /** 换手率 % */
    turnoverRate: z.ZodNumber;
    /** 量比 */
    volumeRatio: z.ZodNumber;
    /** 成交额（亿元） */
    turnover: z.ZodNumber;
    /** 总市值（亿元） */
    marketCap: z.ZodNumber;
    /** 主力净流入（亿元，可为负） */
    mainNetInflow: z.ZodNumber;
    /** 关注度 0–1，驱动盘面高亮与六边形辉光强度 */
    heat: z.ZodNumber;
    tags: z.ZodArray<z.ZodString, "many">;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    symbol: string;
    id: string;
    exchange: "SH" | "SZ" | "BJ";
    name: string;
    kind: "index" | "stock";
    board: "index" | "main" | "gem" | "star" | "bse";
    price: number;
    changePct: number;
    amplitude: number;
    turnoverRate: number;
    volumeRatio: number;
    turnover: number;
    marketCap: number;
    mainNetInflow: number;
    heat: number;
    tags: string[];
    createdAt: string;
    updatedAt: string;
}, {
    symbol: string;
    id: string;
    exchange: "SH" | "SZ" | "BJ";
    name: string;
    kind: "index" | "stock";
    board: "index" | "main" | "gem" | "star" | "bse";
    price: number;
    changePct: number;
    amplitude: number;
    turnoverRate: number;
    volumeRatio: number;
    turnover: number;
    marketCap: number;
    mainNetInflow: number;
    heat: number;
    tags: string[];
    createdAt: string;
    updatedAt: string;
}>;
export type MarketNode = z.infer<typeof marketNodeSchema>;
/** 新增自选：只需给出身份与行情快照，盘面落点与规模由服务端分配。 */
export declare const createMarketNodeInputSchema: z.ZodEffects<z.ZodObject<{
    symbol: z.ZodString;
    name: z.ZodString;
    exchange: z.ZodEnum<["SH", "SZ", "BJ"]>;
    board: z.ZodEnum<["main", "gem", "star", "bse", "index"]>;
    price: z.ZodNumber;
    changePct: z.ZodDefault<z.ZodNumber>;
    turnover: z.ZodDefault<z.ZodNumber>;
    heat: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    symbol: string;
    exchange: "SH" | "SZ" | "BJ";
    name: string;
    board: "index" | "main" | "gem" | "star" | "bse";
    price: number;
    changePct: number;
    turnover: number;
    heat: number;
}, {
    symbol: string;
    exchange: "SH" | "SZ" | "BJ";
    name: string;
    board: "index" | "main" | "gem" | "star" | "bse";
    price: number;
    changePct?: number | undefined;
    turnover?: number | undefined;
    heat?: number | undefined;
}>, {
    symbol: string;
    exchange: "SH" | "SZ" | "BJ";
    name: string;
    board: "index" | "main" | "gem" | "star" | "bse";
    price: number;
    changePct: number;
    turnover: number;
    heat: number;
}, {
    symbol: string;
    exchange: "SH" | "SZ" | "BJ";
    name: string;
    board: "index" | "main" | "gem" | "star" | "bse";
    price: number;
    changePct?: number | undefined;
    turnover?: number | undefined;
    heat?: number | undefined;
}>;
export type CreateMarketNodePayload = z.input<typeof createMarketNodeInputSchema>;
export type CreateMarketNodeCommand = z.output<typeof createMarketNodeInputSchema>;
export declare const updateMarketNodeInputSchema: z.ZodEffects<z.ZodObject<{
    heat: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    heat?: number | undefined;
}, {
    heat?: number | undefined;
}>, {
    heat?: number | undefined;
}, {
    heat?: number | undefined;
}>;
export type UpdateMarketNodePayload = z.input<typeof updateMarketNodeInputSchema>;
export type UpdateMarketNodeCommand = z.output<typeof updateMarketNodeInputSchema>;
//# sourceMappingURL=market.d.ts.map