import { API_ROUTES, healthResponseSchema } from '@platform/contracts'
import type { HealthResponse } from '@platform/contracts'

import { apiRequest } from './client'

export function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return apiRequest(API_ROUTES.health, healthResponseSchema, signal ? { signal } : {})
}
