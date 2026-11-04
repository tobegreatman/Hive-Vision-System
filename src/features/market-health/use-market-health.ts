import type { HealthResponse } from '@platform/contracts'
import { onMounted, onUnmounted, ref } from 'vue'

import { fetchHealth } from '@/shared/api'

export type HealthState = 'checking' | 'online' | 'offline'

export function useMarketHealth(intervalMs = 20_000) {
  const state = ref<HealthState>('checking')
  const health = ref<HealthResponse | null>(null)
  const latencyMs = ref<number | null>(null)

  let timer: ReturnType<typeof setInterval> | undefined
  let controller: AbortController | null = null

  async function check(): Promise<void> {
    controller?.abort()
    controller = new AbortController()
    const startedAt = performance.now()

    try {
      health.value = await fetchHealth(controller.signal)
      latencyMs.value = Math.round(performance.now() - startedAt)
      state.value = 'online'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      state.value = 'offline'
      latencyMs.value = null
    }
  }

  onMounted(() => {
    void check()
    timer = setInterval(() => void check(), intervalMs)
  })

  onUnmounted(() => {
    if (timer) clearInterval(timer)
    controller?.abort()
  })

  return { state, health, latencyMs, refresh: check }
}
