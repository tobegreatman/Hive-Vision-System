import { serve } from '@hono/node-server'

import { app } from './app.js'
import { serverEnv } from './env.js'

/** 绑定端口失败后的重试次数与间隔：覆盖 tsx watch 连续重启时旧进程尚未释放端口的窗口。 */
const MAX_BIND_ATTEMPTS = 24
const RETRY_DELAY_MS = 250

type NodeServer = ReturnType<typeof serve>

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function closeQuietly(server: NodeServer): void {
  try {
    server.close()
  } catch {
    // 监听未成功的 server 调用 close 会抛 ERR_SERVER_NOT_RUNNING，忽略即可
  }
}

/**
 * 绑定端口。
 *
 * tsx watch 在「多个文件几乎同时变更」时会连发两次重启，旧进程还没来得及释放端口，
 * 新进程就收到 EADDRINUSE。直接 process.exit(1) 会让 API 一直死到下一次文件变更
 * （前端表现为 Vite 代理统一回 500），所以这里退避重试而不是立刻退出。
 */
async function bind(attempt = 1): Promise<NodeServer> {
  try {
    return await new Promise<NodeServer>((resolve, reject) => {
      const server = serve(
        { fetch: app.fetch, port: serverEnv.port, hostname: serverEnv.host },
        (info) => {
          console.log(`[api] ready on http://${serverEnv.host}:${info.port} (${serverEnv.runtime})`)
          resolve(server)
        },
      )

      server.on('error', (error: NodeJS.ErrnoException) => {
        closeQuietly(server)
        reject(error)
      })
    })
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code !== 'EADDRINUSE') throw error

    if (attempt >= MAX_BIND_ATTEMPTS) {
      console.error(
        `[api] 端口 ${serverEnv.port} 已被占用（已重试 ${MAX_BIND_ATTEMPTS} 次）。` +
          '请释放端口或设置 PORT 环境变量。',
      )
      process.exit(1)
    }

    console.warn(
      `[api] 端口 ${serverEnv.port} 暂被占用，${RETRY_DELAY_MS}ms 后重试（${attempt}/${MAX_BIND_ATTEMPTS}）`,
    )
    await wait(RETRY_DELAY_MS)
    return bind(attempt + 1)
  }
}

const server = await bind()

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
  })
}
