import type { ApiError } from '@platform/contracts'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

import { serverEnv } from './env.js'
import { healthRoutes } from './routes/health.js'
import { marketRoutes } from './routes/market.js'

export const app = new Hono()

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return serverEnv.corsOrigins[0] ?? ''
      return serverEnv.corsOrigins.includes(origin) ? origin : (serverEnv.corsOrigins[0] ?? '')
    },
    allowMethods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    maxAge: 86400,
  }),
)

app.route('/api/health', healthRoutes)
app.route('/api/market', marketRoutes)

app.notFound((c) => {
  const body: ApiError = { error: { code: 'not_found', message: '路由不存在' } }
  return c.json(body, 404)
})

app.onError((error, c) => {
  console.error('[api] unhandled error:', error)
  const body: ApiError = { error: { code: 'internal_error', message: '服务端内部错误' } }
  return c.json(body, 500)
})

export type AppType = typeof app
