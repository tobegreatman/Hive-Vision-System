import { z } from 'zod';
/** 路由表前后端共用，避免魔法字符串漂移。 */
export declare const API_ROUTES: {
    readonly health: "/api/health";
    readonly overview: "/api/market/overview";
    readonly boards: "/api/market/boards";
    readonly nodes: "/api/market/nodes";
    readonly node: (id: string) => string;
    readonly nodeDetail: (id: string) => string;
};
export declare const apiErrorSchema: z.ZodObject<{
    error: z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        details: z.ZodOptional<z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
        details?: unknown;
    }, {
        code: string;
        message: string;
        details?: unknown;
    }>;
}, "strip", z.ZodTypeAny, {
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
}, {
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
}>;
export type ApiError = z.infer<typeof apiErrorSchema>;
/** 交易时段，用于顶部状态栏与「是否实时」提示。 */
export declare const marketSessionSchema: z.ZodEnum<["pre-open", "auction", "open", "lunch-break", "closed", "holiday"]>;
export type MarketSession = z.infer<typeof marketSessionSchema>;
export declare const healthResponseSchema: z.ZodObject<{
    status: z.ZodLiteral<"ok">;
    runtime: z.ZodString;
    uptimeMs: z.ZodNumber;
    timestamp: z.ZodString;
    session: z.ZodEnum<["pre-open", "auction", "open", "lunch-break", "closed", "holiday"]>;
    tradeDate: z.ZodString;
    /** 明确标注数据来源，避免把演示快照当成实时行情。 */
    dataMode: z.ZodEnum<["demo", "live"]>;
}, "strip", z.ZodTypeAny, {
    status: "ok";
    runtime: string;
    uptimeMs: number;
    timestamp: string;
    session: "pre-open" | "auction" | "open" | "lunch-break" | "closed" | "holiday";
    tradeDate: string;
    dataMode: "demo" | "live";
}, {
    status: "ok";
    runtime: string;
    uptimeMs: number;
    timestamp: string;
    session: "pre-open" | "auction" | "open" | "lunch-break" | "closed" | "holiday";
    tradeDate: string;
    dataMode: "demo" | "live";
}>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export declare const marketBreadthSchema: z.ZodObject<{
    up: z.ZodNumber;
    down: z.ZodNumber;
    flat: z.ZodNumber;
    limitUp: z.ZodNumber;
    limitDown: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    flat: number;
    up: number;
    down: number;
    limitUp: number;
    limitDown: number;
}, {
    flat: number;
    up: number;
    down: number;
    limitUp: number;
    limitDown: number;
}>;
export type MarketBreadth = z.infer<typeof marketBreadthSchema>;
export declare const marketOverviewSchema: z.ZodObject<{
    indices: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        symbol: z.ZodString;
        exchange: z.ZodEnum<["SH", "SZ", "BJ"]>;
        name: z.ZodString;
        kind: z.ZodEnum<["index", "stock"]>;
        board: z.ZodEnum<["main", "gem", "star", "bse", "index"]>;
        price: z.ZodNumber;
        changePct: z.ZodNumber;
        amplitude: z.ZodNumber;
        turnoverRate: z.ZodNumber;
        volumeRatio: z.ZodNumber;
        turnover: z.ZodNumber;
        marketCap: z.ZodNumber;
        mainNetInflow: z.ZodNumber;
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
    }>, "many">;
    breadth: z.ZodObject<{
        up: z.ZodNumber;
        down: z.ZodNumber;
        flat: z.ZodNumber;
        limitUp: z.ZodNumber;
        limitDown: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        flat: number;
        up: number;
        down: number;
        limitUp: number;
        limitDown: number;
    }, {
        flat: number;
        up: number;
        down: number;
        limitUp: number;
        limitDown: number;
    }>;
    /** 两市成交额（亿元） */
    turnover: z.ZodNumber;
    /** 主力净流入合计（亿元） */
    mainNetInflow: z.ZodNumber;
    session: z.ZodEnum<["pre-open", "auction", "open", "lunch-break", "closed", "holiday"]>;
    tradeDate: z.ZodString;
    asOf: z.ZodString;
}, "strip", z.ZodTypeAny, {
    turnover: number;
    mainNetInflow: number;
    session: "pre-open" | "auction" | "open" | "lunch-break" | "closed" | "holiday";
    tradeDate: string;
    indices: {
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
    }[];
    breadth: {
        flat: number;
        up: number;
        down: number;
        limitUp: number;
        limitDown: number;
    };
    asOf: string;
}, {
    turnover: number;
    mainNetInflow: number;
    session: "pre-open" | "auction" | "open" | "lunch-break" | "closed" | "holiday";
    tradeDate: string;
    indices: {
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
    }[];
    breadth: {
        flat: number;
        up: number;
        down: number;
        limitUp: number;
        limitDown: number;
    };
    asOf: string;
}>;
export type MarketOverview = z.infer<typeof marketOverviewSchema>;
export declare const marketOverviewResponseSchema: z.ZodObject<{
    overview: z.ZodObject<{
        indices: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            symbol: z.ZodString;
            exchange: z.ZodEnum<["SH", "SZ", "BJ"]>;
            name: z.ZodString;
            kind: z.ZodEnum<["index", "stock"]>;
            board: z.ZodEnum<["main", "gem", "star", "bse", "index"]>;
            price: z.ZodNumber;
            changePct: z.ZodNumber;
            amplitude: z.ZodNumber;
            turnoverRate: z.ZodNumber;
            volumeRatio: z.ZodNumber;
            turnover: z.ZodNumber;
            marketCap: z.ZodNumber;
            mainNetInflow: z.ZodNumber;
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
        }>, "many">;
        breadth: z.ZodObject<{
            up: z.ZodNumber;
            down: z.ZodNumber;
            flat: z.ZodNumber;
            limitUp: z.ZodNumber;
            limitDown: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            flat: number;
            up: number;
            down: number;
            limitUp: number;
            limitDown: number;
        }, {
            flat: number;
            up: number;
            down: number;
            limitUp: number;
            limitDown: number;
        }>;
        /** 两市成交额（亿元） */
        turnover: z.ZodNumber;
        /** 主力净流入合计（亿元） */
        mainNetInflow: z.ZodNumber;
        session: z.ZodEnum<["pre-open", "auction", "open", "lunch-break", "closed", "holiday"]>;
        tradeDate: z.ZodString;
        asOf: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        turnover: number;
        mainNetInflow: number;
        session: "pre-open" | "auction" | "open" | "lunch-break" | "closed" | "holiday";
        tradeDate: string;
        indices: {
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
        }[];
        breadth: {
            flat: number;
            up: number;
            down: number;
            limitUp: number;
            limitDown: number;
        };
        asOf: string;
    }, {
        turnover: number;
        mainNetInflow: number;
        session: "pre-open" | "auction" | "open" | "lunch-break" | "closed" | "holiday";
        tradeDate: string;
        indices: {
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
        }[];
        breadth: {
            flat: number;
            up: number;
            down: number;
            limitUp: number;
            limitDown: number;
        };
        asOf: string;
    }>;
}, "strip", z.ZodTypeAny, {
    overview: {
        turnover: number;
        mainNetInflow: number;
        session: "pre-open" | "auction" | "open" | "lunch-break" | "closed" | "holiday";
        tradeDate: string;
        indices: {
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
        }[];
        breadth: {
            flat: number;
            up: number;
            down: number;
            limitUp: number;
            limitDown: number;
        };
        asOf: string;
    };
}, {
    overview: {
        turnover: number;
        mainNetInflow: number;
        session: "pre-open" | "auction" | "open" | "lunch-break" | "closed" | "holiday";
        tradeDate: string;
        indices: {
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
        }[];
        breadth: {
            flat: number;
            up: number;
            down: number;
            limitUp: number;
            limitDown: number;
        };
        asOf: string;
    };
}>;
export type MarketOverviewResponse = z.infer<typeof marketOverviewResponseSchema>;
export declare const listMarketNodesResponseSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        symbol: z.ZodString;
        exchange: z.ZodEnum<["SH", "SZ", "BJ"]>;
        name: z.ZodString;
        kind: z.ZodEnum<["index", "stock"]>;
        board: z.ZodEnum<["main", "gem", "star", "bse", "index"]>;
        price: z.ZodNumber;
        changePct: z.ZodNumber;
        amplitude: z.ZodNumber;
        turnoverRate: z.ZodNumber;
        volumeRatio: z.ZodNumber;
        turnover: z.ZodNumber;
        marketCap: z.ZodNumber;
        mainNetInflow: z.ZodNumber;
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
    }>, "many">;
    total: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    items: {
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
    }[];
    total: number;
}, {
    items: {
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
    }[];
    total: number;
}>;
export type ListMarketNodesResponse = z.infer<typeof listMarketNodesResponseSchema>;
/**
 * 板块聚合：蜂巢导航第一层的单元。
 * 家数 / 涨跌 / 成交额 / 均涨幅 / 领涨股都由服务端算好，前端只负责排布六边形。
 */
export declare const marketBoardSummarySchema: z.ZodObject<{
    board: z.ZodEnum<["main", "gem", "star", "bse", "index"]>;
    label: z.ZodString;
    count: z.ZodNumber;
    up: z.ZodNumber;
    down: z.ZodNumber;
    /** 涨跌停家数合计（涨停 + 跌停），用于板块层面的极端情绪提示 */
    limitCount: z.ZodNumber;
    /** 板块成交额（亿元） */
    turnover: z.ZodNumber;
    /** 板块主力净流入合计（亿元） */
    mainNetInflow: z.ZodNumber;
    /** 板块平均涨跌幅 % */
    avgChangePct: z.ZodNumber;
    /** 领涨标的（按涨跌幅），空板块为 null */
    leader: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        symbol: z.ZodString;
        exchange: z.ZodEnum<["SH", "SZ", "BJ"]>;
        name: z.ZodString;
        kind: z.ZodEnum<["index", "stock"]>;
        board: z.ZodEnum<["main", "gem", "star", "bse", "index"]>;
        price: z.ZodNumber;
        changePct: z.ZodNumber;
        amplitude: z.ZodNumber;
        turnoverRate: z.ZodNumber;
        volumeRatio: z.ZodNumber;
        turnover: z.ZodNumber;
        marketCap: z.ZodNumber;
        mainNetInflow: z.ZodNumber;
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
    }>>;
}, "strip", z.ZodTypeAny, {
    board: "index" | "main" | "gem" | "star" | "bse";
    turnover: number;
    mainNetInflow: number;
    up: number;
    down: number;
    label: string;
    count: number;
    limitCount: number;
    avgChangePct: number;
    leader: {
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
    } | null;
}, {
    board: "index" | "main" | "gem" | "star" | "bse";
    turnover: number;
    mainNetInflow: number;
    up: number;
    down: number;
    label: string;
    count: number;
    limitCount: number;
    avgChangePct: number;
    leader: {
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
    } | null;
}>;
export type MarketBoardSummary = z.infer<typeof marketBoardSummarySchema>;
export declare const listMarketBoardsResponseSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        board: z.ZodEnum<["main", "gem", "star", "bse", "index"]>;
        label: z.ZodString;
        count: z.ZodNumber;
        up: z.ZodNumber;
        down: z.ZodNumber;
        /** 涨跌停家数合计（涨停 + 跌停），用于板块层面的极端情绪提示 */
        limitCount: z.ZodNumber;
        /** 板块成交额（亿元） */
        turnover: z.ZodNumber;
        /** 板块主力净流入合计（亿元） */
        mainNetInflow: z.ZodNumber;
        /** 板块平均涨跌幅 % */
        avgChangePct: z.ZodNumber;
        /** 领涨标的（按涨跌幅），空板块为 null */
        leader: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            symbol: z.ZodString;
            exchange: z.ZodEnum<["SH", "SZ", "BJ"]>;
            name: z.ZodString;
            kind: z.ZodEnum<["index", "stock"]>;
            board: z.ZodEnum<["main", "gem", "star", "bse", "index"]>;
            price: z.ZodNumber;
            changePct: z.ZodNumber;
            amplitude: z.ZodNumber;
            turnoverRate: z.ZodNumber;
            volumeRatio: z.ZodNumber;
            turnover: z.ZodNumber;
            marketCap: z.ZodNumber;
            mainNetInflow: z.ZodNumber;
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
        }>>;
    }, "strip", z.ZodTypeAny, {
        board: "index" | "main" | "gem" | "star" | "bse";
        turnover: number;
        mainNetInflow: number;
        up: number;
        down: number;
        label: string;
        count: number;
        limitCount: number;
        avgChangePct: number;
        leader: {
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
        } | null;
    }, {
        board: "index" | "main" | "gem" | "star" | "bse";
        turnover: number;
        mainNetInflow: number;
        up: number;
        down: number;
        label: string;
        count: number;
        limitCount: number;
        avgChangePct: number;
        leader: {
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
        } | null;
    }>, "many">;
    asOf: z.ZodString;
}, "strip", z.ZodTypeAny, {
    asOf: string;
    items: {
        board: "index" | "main" | "gem" | "star" | "bse";
        turnover: number;
        mainNetInflow: number;
        up: number;
        down: number;
        label: string;
        count: number;
        limitCount: number;
        avgChangePct: number;
        leader: {
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
        } | null;
    }[];
}, {
    asOf: string;
    items: {
        board: "index" | "main" | "gem" | "star" | "bse";
        turnover: number;
        mainNetInflow: number;
        up: number;
        down: number;
        label: string;
        count: number;
        limitCount: number;
        avgChangePct: number;
        leader: {
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
        } | null;
    }[];
}>;
export type ListMarketBoardsResponse = z.infer<typeof listMarketBoardsResponseSchema>;
export declare const marketNodeResponseSchema: z.ZodObject<{
    node: z.ZodObject<{
        id: z.ZodString;
        symbol: z.ZodString;
        exchange: z.ZodEnum<["SH", "SZ", "BJ"]>;
        name: z.ZodString;
        kind: z.ZodEnum<["index", "stock"]>;
        board: z.ZodEnum<["main", "gem", "star", "bse", "index"]>;
        price: z.ZodNumber;
        changePct: z.ZodNumber;
        amplitude: z.ZodNumber;
        turnoverRate: z.ZodNumber;
        volumeRatio: z.ZodNumber;
        turnover: z.ZodNumber;
        marketCap: z.ZodNumber;
        mainNetInflow: z.ZodNumber;
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
}, "strip", z.ZodTypeAny, {
    node: {
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
    };
}, {
    node: {
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
    };
}>;
export type MarketNodeResponse = z.infer<typeof marketNodeResponseSchema>;
/**
 * 拾取后展示的盘口统计：排名、同板块家数、涨跌停状态均由服务端计算，
 * 前端只渲染，不在本地重复实现业务规则。
 */
export declare const marketNodeDetailSchema: z.ZodObject<{
    rank: z.ZodNumber;
    peerCount: z.ZodNumber;
    limitStatus: z.ZodEnum<["limit-up", "limit-down", "normal"]>;
    visits: z.ZodNumber;
    lastVisitedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    rank: number;
    peerCount: number;
    limitStatus: "limit-up" | "limit-down" | "normal";
    visits: number;
    lastVisitedAt: string | null;
}, {
    rank: number;
    peerCount: number;
    limitStatus: "limit-up" | "limit-down" | "normal";
    visits: number;
    lastVisitedAt: string | null;
}>;
export type MarketNodeDetail = z.infer<typeof marketNodeDetailSchema>;
export declare const marketNodeDetailResponseSchema: z.ZodObject<{
    node: z.ZodObject<{
        id: z.ZodString;
        symbol: z.ZodString;
        exchange: z.ZodEnum<["SH", "SZ", "BJ"]>;
        name: z.ZodString;
        kind: z.ZodEnum<["index", "stock"]>;
        board: z.ZodEnum<["main", "gem", "star", "bse", "index"]>;
        price: z.ZodNumber;
        changePct: z.ZodNumber;
        amplitude: z.ZodNumber;
        turnoverRate: z.ZodNumber;
        volumeRatio: z.ZodNumber;
        turnover: z.ZodNumber;
        marketCap: z.ZodNumber;
        mainNetInflow: z.ZodNumber;
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
    detail: z.ZodObject<{
        rank: z.ZodNumber;
        peerCount: z.ZodNumber;
        limitStatus: z.ZodEnum<["limit-up", "limit-down", "normal"]>;
        visits: z.ZodNumber;
        lastVisitedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        rank: number;
        peerCount: number;
        limitStatus: "limit-up" | "limit-down" | "normal";
        visits: number;
        lastVisitedAt: string | null;
    }, {
        rank: number;
        peerCount: number;
        limitStatus: "limit-up" | "limit-down" | "normal";
        visits: number;
        lastVisitedAt: string | null;
    }>;
}, "strip", z.ZodTypeAny, {
    node: {
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
    };
    detail: {
        rank: number;
        peerCount: number;
        limitStatus: "limit-up" | "limit-down" | "normal";
        visits: number;
        lastVisitedAt: string | null;
    };
}, {
    node: {
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
    };
    detail: {
        rank: number;
        peerCount: number;
        limitStatus: "limit-up" | "limit-down" | "normal";
        visits: number;
        lastVisitedAt: string | null;
    };
}>;
export type MarketNodeDetailResponse = z.infer<typeof marketNodeDetailResponseSchema>;
export declare const updateMarketNodePayloadSchema: z.ZodEffects<z.ZodObject<{
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
export type ApiRouteKey = keyof typeof API_ROUTES;
//# sourceMappingURL=api.d.ts.map