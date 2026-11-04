import { onUnmounted, ref } from 'vue'

/**
 * 轻量帧率探针：不依赖 three，仅用 rAF 采样，
 * 用于验证后处理管线没有把首屏帧率拖垮。
 */
export function useFrameRate(sampleMs = 500) {
  const fps = ref(0)
  let frameId = 0
  let frames = 0
  let lastSample = performance.now()
  let running = false

  function tick(now: number): void {
    if (!running) return
    frames += 1
    if (now - lastSample >= sampleMs) {
      fps.value = Math.round((frames * 1000) / (now - lastSample))
      frames = 0
      lastSample = now
    }
    frameId = requestAnimationFrame(tick)
  }

  function start(): void {
    if (running) return
    running = true
    frames = 0
    lastSample = performance.now()
    frameId = requestAnimationFrame(tick)
  }

  function stop(): void {
    running = false
    cancelAnimationFrame(frameId)
  }

  onUnmounted(stop)

  return { fps, start, stop }
}
