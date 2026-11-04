/**
 * 浏览器端取数通道
 *
 * 三级通道，逐级降级，任何一级失败都不影响渲染：
 *   live     ── 同源流水线 /api/feed（推荐，含质量门禁与聚合）
 *   jsonp    ── 直连数据源（无 CORS 限制，静态部署可用）
 *   snapshot ── 内置快照（离线兜底，明确标注数据时间）
 *
 * 反限流：全局限速 + 分页串行 + 指数退避 + 本地缓存（60s）
 */
import { PROVIDER, buildListUrl, decodeRow, extractDiff, extractTotal } from '../adapters/eastmoney.js'
import { build } from '../core/build.js'

const CACHE_KEY = 'industry-flow:v1'
const PAGE_GAP = 320

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function readCache(period) {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY}:${period}`)
    if (!raw) return null
    const obj = JSON.parse(raw)
    if (Date.now() - obj.ts > 60_000) return null
    return obj.payload
  } catch {
    return null
  }
}

function writeCache(period, payload) {
  try {
    localStorage.setItem(`${CACHE_KEY}:${period}`, JSON.stringify({ ts: Date.now(), payload }))
  } catch {
    /* 配额溢出时静默跳过，不影响主流程 */
  }
}

let seq = 0
function jsonp(url, timeout = 9000) {
  return new Promise((resolve, reject) => {
    const name = `__iflow_${Date.now()}_${seq++}`
    const script = document.createElement('script')
    const timer = setTimeout(() => cleanup(new Error('timeout')), timeout)
    function cleanup(err) {
      clearTimeout(timer)
      script.remove()
      delete window[name]
      if (err) reject(err)
    }
    window[name] = (data) => {
      cleanup()
      resolve(data)
    }
    script.onerror = () => cleanup(new Error('script error'))
    script.src = `${url}${url.includes('?') ? '&' : '?'}cb=${name}`
    document.head.appendChild(script)
  })
}

/** 通道一：同源流水线 */
async function viaApi(period, signal) {
  const res = await fetch(`/api/feed?period=${period}`, { signal })
  if (!res.ok) throw new Error(`api ${res.status}`)
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) throw new Error('api not json')
  const payload = await res.json()
  if (payload?.schema !== 'industry-flow/v1') throw new Error('schema mismatch')
  return payload
}

/** 通道二：浏览器直连数据源（JSONP 分页聚合） */
async function viaJsonp(period, onProgress) {
  const t0 = Date.now()
  const pageSize = 100
  const first = await jsonp(buildListUrl({ host: PROVIDER.hosts[0], page: 1, pageSize, sortBy: 'f12', sortDir: 0 }))
  const total = extractTotal(first) || 496
  const pages = Math.max(1, Math.ceil(total / pageSize))

  let rows = extractDiff(first)
  onProgress?.({ loaded: 1, pages })

  for (let p = 2; p <= pages; p++) {
    await sleep(PAGE_GAP)
    const resp = await jsonp(buildListUrl({ host: PROVIDER.hosts[0], page: p, pageSize, sortBy: 'f12', sortDir: 0 }))
    rows = rows.concat(extractDiff(resp))
    onProgress?.({ loaded: p, pages })
  }

  const records = rows.map(decodeRow).filter(Boolean)
  return build(records, {
    period,
    expected: total,
    total,
    channel: 'jsonp',
    latencyMs: Date.now() - t0,
    pages,
    failovers: 0,
  })
}

/** 通道三：内置快照 */
async function viaSnapshot(period) {
  const res = await fetch(`./data/snapshot-${period}.json`, { cache: 'no-store' })
  if (!res.ok) throw new Error('snapshot missing')
  const payload = await res.json()
  payload.source = { ...payload.source, channel: 'snapshot' }
  payload.audit = { ...payload.audit, degraded: true }
  return payload
}

/**
 * 统一取数入口
 * @param {'d1'|'d5'|'d10'} period
 * @param {{force?:boolean, onProgress?:Function}} opt
 */
export async function loadFeed(period, opt = {}) {
  if (!opt.force) {
    const cached = readCache(period)
    if (cached) return { payload: cached, channel: 'cache' }
  }

  const errors = []

  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 3500)
    const payload = await viaApi(period, ctrl.signal)
    clearTimeout(timer)
    writeCache(period, payload)
    return { payload, channel: 'live' }
  } catch (e) {
    errors.push(`live: ${e.message}`)
  }

  try {
    const payload = await viaJsonp(period, opt.onProgress)
    writeCache(period, payload)
    return { payload, channel: 'jsonp' }
  } catch (e) {
    errors.push(`jsonp: ${e.message}`)
  }

  try {
    const payload = await viaSnapshot(period)
    return { payload, channel: 'snapshot', errors }
  } catch (e) {
    errors.push(`snapshot: ${e.message}`)
  }

  throw new Error(errors.join(' | '))
}

export async function loadIntraday(code) {
  try {
    const res = await fetch(`/api/intraday?code=${code}`)
    if (res.ok) return await res.json()
  } catch {
    /* 忽略，走直连 */
  }
  const data = await jsonp(
    `https://${PROVIDER.hosts[0]}/api/qt/stock/fflow/kline/get?lmt=0&klt=1&secid=90.${code}` +
      `&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61`
  )
  return { code, points: (data?.data?.klines || []).map((line) => {
    const [t, main, sm, md, lg, xl] = line.split(',')
    return { t, main: +main, sm: +sm, md: +md, lg: +lg, xl: +xl }
  }) }
}
