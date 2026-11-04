import type { HealthResponse } from '@platform/contracts'
import { Hono } from 'hono'

import { serverEnv } from '../env.js'
import { currentSession, currentTradeDate } from '../services/market.service.js'

const startedAt = Date.now()

export const healthRoutes = new Hono()

healthRoutes.get('/', (c) => {
  const now = new Date()
  const body: HealthResponse = {
    status: 'ok',
    runtime: serverEnv.runtime,
    uptimeMs: Date.now() - startedAt,
    timestamp: now.toISOString(),
    session: currentSession(now),
    tradeDate: currentTradeDate(now),
    dataMode: 'demo',
  }
  return c.json(body)
})
