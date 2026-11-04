import type { ApiError } from '@platform/contracts'
import type { Context } from 'hono'
import type { ZodTypeAny, z } from 'zod'

type ParseResult<S extends ZodTypeAny> =
  { success: true; data: z.output<S> } | { success: false; response: Response }

function badRequest(c: Context, code: string, message: string, details?: unknown): Response {
  const body: ApiError = {
    error: { code, message, ...(details === undefined ? {} : { details }) },
  }
  return c.json(body, 400) as unknown as Response
}

/** 统一的请求体校验：失败即 400，成功返回 Zod 解析后的强类型数据。 */
export async function parseBody<S extends ZodTypeAny>(
  c: Context,
  schema: S,
): Promise<ParseResult<S>> {
  let raw: unknown
  try {
    raw = await c.req.json()
  } catch {
    return { success: false, response: badRequest(c, 'invalid_json', '请求体必须是合法 JSON') }
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      response: badRequest(c, 'validation_error', '请求参数校验失败', parsed.error.flatten()),
    }
  }
  return { success: true, data: parsed.data }
}

export function notFound(c: Context, message = '资源不存在'): Response {
  const body: ApiError = { error: { code: 'not_found', message } }
  return c.json(body, 404) as unknown as Response
}
