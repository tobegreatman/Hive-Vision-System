/**
 * 数据源适配器：东方财富行情/资金流（push2 系）
 *
 * 字段映射集中于一处，任何字段含义变更只需改这里。
 * 端点、主机、字段表均声明为纯数据，Node 与浏览器共享。
 */

export const PROVIDER = {
  id: 'eastmoney.push2',
  label: '东方财富 · 行情中心',
  // 主域在部分网络下会重置连接或触发 IP 级限流，故维持一组镜像域并按健康度轮换
  hosts: [
    'push2delay2.eastmoney.com',
    'push2delay.eastmoney.com',
    'push2his.eastmoney.com',
    'push2.eastmoney.com',
  ],
  referer: 'https://quote.eastmoney.com/',
  pageSize: 100,
}

/** 板块筛选串：m:90 t:2 = 申万行业分类（496 个节点，三级树） */
export const UNIVERSE_FS = 'm:90+t:2'
/** 预期节点数（数据源自报 total，用作覆盖度门禁） */
export const UNIVERSE_EXPECTED = 496

export const FIELDS = [
  'f2', 'f3', 'f8', 'f12', 'f14', 'f15', 'f16', 'f17', 'f18', 'f20',
  'f62', 'f66', 'f69', 'f72', 'f75', 'f78', 'f81', 'f84', 'f87', 'f184',
  'f104', 'f105', 'f106', 'f128', 'f136', 'f140',
  'f164', 'f165', 'f166', 'f168', 'f170', 'f172', 'f174', 'f175',
  'f124',
].join(',')

/** 各粒度的指标抽取规则（同一次请求取回全周期，避免多次调用触发限流） */
export const PERIOD_METRIC = {
  d1: {
    net: 'f62',
    netPct: 'f184',
    tiers: { xl: 'f66', lg: 'f72', md: 'f78', sm: 'f84' },
  },
  d5: {
    net: 'f164',
    netPct: 'f165',
    tiers: { xl: 'f166', lg: 'f168', md: 'f170', sm: 'f172' },
  },
  d10: {
    net: 'f174',
    netPct: 'f175',
    tiers: null,
  },
}

/**
 * 构造列表查询 URL。
 * @param {{host?:string, page?:number, pageSize?:number, sortBy?:string, cb?:string}} opt
 */
export function buildListUrl(opt = {}) {
  // 不指定主机时留下占位符，由网络层做主机轮换
  const host = opt.host || '{host}'
  const p = new URLSearchParams({
    pn: String(opt.page || 1),
    pz: String(opt.pageSize || PROVIDER.pageSize),
    po: opt.sortDir === undefined ? '1' : String(opt.sortDir),
    np: '1',
    fltt: '2',
    invt: '2',
    fid: opt.sortBy || 'f62',
    fs: UNIVERSE_FS,
    fields: opt.fields || FIELDS,
    _: String(Date.now()),
  })
  if (opt.cb) p.set('cb', opt.cb)
  return `https://${host}/api/qt/clist/get?${p.toString()}`
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const str = (v) => (v === undefined || v === null || v === '-' || v === '' ? '' : String(v))

/**
 * 原始行 → 规范化记录（纯函数，无副作用）
 * 所有金额单位为元，比率为百分数。
 */
export function decodeRow(row) {
  if (!row || !row.f12) return null
  return {
    id: str(row.f12),
    name: str(row.f14),
    price: num(row.f2),
    chg: num(row.f3),
    turnoverRate: num(row.f8),
    open: num(row.f17),
    high: num(row.f15),
    low: num(row.f16),
    prevClose: num(row.f18),
    mcap: num(row.f20),
    up: num(row.f104),
    down: num(row.f105),
    flat: num(row.f106),
    leaderName: str(row.f128),
    leaderCode: str(row.f140),
    leaderChg: num(row.f136),
    d1: {
      net: num(row.f62),
      netPct: num(row.f184),
      tiers: { xl: num(row.f66), lg: num(row.f72), md: num(row.f78), sm: num(row.f84) },
    },
    d5: {
      net: num(row.f164),
      netPct: num(row.f165),
      tiers: { xl: num(row.f166), lg: num(row.f168), md: num(row.f170), sm: num(row.f172) },
    },
    d10: {
      net: num(row.f174),
      netPct: num(row.f175),
      tiers: null,
    },
    ts: num(row.f124),
  }
}

/** 分钟级资金流曲线（用于详情面板） */
export function buildIntradayUrl(code, host) {
  const secid = `90.${code}`
  const h = host || PROVIDER.hosts[0]
  return (
    `https://${h}/api/qt/stock/fflow/kline/get?lmt=0&klt=1&secid=${secid}` +
    `&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61`
  )
}

/** 解析分钟级返回：时间, 主力, 小单, 中单, 大单, 超大单 */
export function decodeIntraday(payload) {
  const klines = payload?.data?.klines
  if (!Array.isArray(klines)) return []
  return klines
    .map((line) => {
      const [t, main, sm, md, lg, xl] = line.split(',')
      const n = (v) => (v === undefined ? null : Number(v))
      return { t, main: n(main), sm: n(sm), md: n(md), lg: n(lg), xl: n(xl) }
    })
    .filter((d) => d.t && Number.isFinite(d.main))
}

/** 从任意响应中取出 diff 数组（服务端可能返回对象或数组） */
export function extractDiff(payload) {
  const d = payload?.data?.diff
  if (!d) return []
  return Array.isArray(d) ? d : Object.values(d)
}

export function extractTotal(payload) {
  return Number(payload?.data?.total || 0)
}
