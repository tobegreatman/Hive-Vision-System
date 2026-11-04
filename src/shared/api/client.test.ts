import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { ApiError, apiRequest } from './client'

const payloadSchema = z.object({ value: z.number() })

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiRequest', () => {
  it('returns schema-parsed data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ value: 42 })))

    await expect(apiRequest('/api/x', payloadSchema)).resolves.toEqual({ value: 42 })
  })

  it('maps error envelopes to ApiError with code and status', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ error: { code: 'validation_error', message: '参数不合法' } }, 400),
        ),
    )

    await expect(apiRequest('/api/x', payloadSchema)).rejects.toMatchObject({
      name: 'ApiError',
      code: 'validation_error',
      status: 400,
      message: '参数不合法',
    })
  })

  it('rejects responses that drift from the shared schema', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ value: 'not-a-number' })))

    const error = await apiRequest('/api/x', payloadSchema).catch((cause: unknown) => cause)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe('invalid_response')
  })

  it('wraps transport failures into a network_error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed to fetch')))

    await expect(apiRequest('/api/x', payloadSchema)).rejects.toMatchObject({
      code: 'network_error',
      status: 0,
    })
  })

  it('serialises the body and sets JSON headers for writes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ value: 1 }))
    vi.stubGlobal('fetch', fetchMock)

    await apiRequest('/api/x', payloadSchema, { method: 'POST', body: { name: 'Vega' } })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/x',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Vega' }),
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    )
  })
})
