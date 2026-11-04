const DEFAULT_CORS_ORIGINS = [
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]

function parsePort(raw: string | undefined, fallback: number): number {
  const port = Number.parseInt(raw ?? '', 10)
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : fallback
}

export const serverEnv = {
  port: parsePort(process.env.PORT, 3600),
  host: process.env.HOST ?? '127.0.0.1',
  runtime: `node-${process.versions.node}`,
  corsOrigins: (process.env.CORS_ORIGINS?.split(',')
    .map((value) => value.trim())
    .filter(Boolean) ?? DEFAULT_CORS_ORIGINS) as string[],
} as const
