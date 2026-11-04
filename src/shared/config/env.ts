function normalizeOrigin(value: string | undefined): string {
  if (!value) return ''
  return value.replace(/\/+$/, '')
}

export const appEnv = {
  /** 生产可指向独立 API 域名；开发态留空走 Vite proxy，避免 CORS 噪声。 */
  apiOrigin: normalizeOrigin(import.meta.env.VITE_API_ORIGIN),
  isDev: import.meta.env.DEV,
} as const
