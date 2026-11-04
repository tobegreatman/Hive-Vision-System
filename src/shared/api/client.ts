import { apiErrorSchema } from '@platform/contracts'
import type { z } from 'zod'

import { appEnv } from '../config/env'

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly details: unknown

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

/**
 * 唯一的网络出口：请求 → 状态码 → Zod 校验 → 强类型返回值。
 * 任何越过 Schema 的响应都会在这里被拦下，而不是在组件里炸开。
 */
export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, signal } = options

  let response: Response
  try {
    response = await fetch(`${appEnv.apiOrigin}${path}`, {
      method,
      signal,
      headers:
        body === undefined
          ? { Accept: 'application/json' }
          : { Accept: 'application/json', 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError('network_error', '无法连接后端服务，请确认 3600 端口是否已启动', 0)
  }

  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(payload)
    if (parsed.success) {
      throw new ApiError(
        parsed.data.error.code,
        parsed.data.error.message,
        response.status,
        parsed.data.error.details,
      )
    }
    throw new ApiError('http_error', `请求失败（HTTP ${response.status}）`, response.status)
  }

  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    throw new ApiError(
      'invalid_response',
      '响应结构与共享 Schema 不匹配',
      response.status,
      parsed.error.flatten(),
    )
  }

  return parsed.data
}
