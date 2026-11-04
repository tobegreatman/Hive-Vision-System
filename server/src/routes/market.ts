import type {
  ListMarketBoardsResponse,
  ListMarketNodesResponse,
  MarketNodeDetailResponse,
  MarketNodeResponse,
  MarketOverviewResponse,
} from '@platform/contracts'
import { limitStatusOf } from '@platform/contracts'
import { Hono } from 'hono'

import { createMarketNodeInputSchema, updateMarketNodeInputSchema } from '../schemas/index.js'
import { notFound, parseBody } from '../schemas/validate.js'
import { marketService } from '../services/market.service.js'

/** 路由层只做「解析 → 调用 service → 序列化」，不承载业务规则。 */
export const marketRoutes = new Hono()

marketRoutes.get('/overview', (c) => {
  const body: MarketOverviewResponse = { overview: marketService.overview() }
  return c.json(body)
})

/** 蜂巢第一层：板块聚合。 */
marketRoutes.get('/boards', (c) => {
  const body: ListMarketBoardsResponse = {
    items: marketService.boards(),
    asOf: new Date().toISOString(),
  }
  return c.json(body)
})

marketRoutes.get('/nodes', (c) => {
  const items = marketService.list()
  const body: ListMarketNodesResponse = { items, total: items.length }
  return c.json(body)
})

marketRoutes.post('/nodes', async (c) => {
  const parsed = await parseBody(c, createMarketNodeInputSchema)
  if (!parsed.success) return parsed.response

  const node = marketService.create(parsed.data)
  const body: MarketNodeResponse = { node }
  return c.json(body, 201)
})

marketRoutes.get('/nodes/:id', (c) => {
  const node = marketService.find(c.req.param('id'))
  if (!node) return notFound(c, '标的不存在')

  const body: MarketNodeResponse = { node }
  return c.json(body)
})

marketRoutes.get('/nodes/:id/detail', (c) => {
  const id = c.req.param('id')
  const node = marketService.find(id)
  if (!node) return notFound(c, '标的不存在')

  const visit = marketService.inspect(id)
  const body: MarketNodeDetailResponse = {
    node,
    detail: {
      rank: marketService.rankOf(id),
      peerCount: marketService.peerCountOf(node),
      limitStatus: limitStatusOf(node),
      visits: visit?.visits ?? 0,
      lastVisitedAt: visit?.lastVisitedAt ?? null,
    },
  }
  return c.json(body)
})

marketRoutes.patch('/nodes/:id', async (c) => {
  const parsed = await parseBody(c, updateMarketNodeInputSchema)
  if (!parsed.success) return parsed.response

  const node = marketService.update(c.req.param('id'), parsed.data)
  if (!node) return notFound(c, '标的不存在')

  const body: MarketNodeResponse = { node }
  return c.json(body)
})
