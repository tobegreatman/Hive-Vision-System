import { storeToRefs } from 'pinia'
import { onUnmounted, ref } from 'vue'

import { useMarketStore } from '@/entities/market-node'

/** 拾取交互的唯一入口：悬停态属于 UI 局部状态，选中态属于领域状态。 */
export function useNodeSelection() {
  const store = useMarketStore()
  const { selectedId, selected, detail } = storeToRefs(store)
  const hoveredId = ref<string | null>(null)

  function pick(id: string): void {
    void store.select(id)
  }

  function clear(): void {
    store.clearSelection()
  }

  function setHovered(id: string | null): void {
    hoveredId.value = id
    document.body.style.cursor = id ? 'pointer' : ''
  }

  onUnmounted(() => {
    document.body.style.cursor = ''
  })

  return { selectedId, selected, detail, hoveredId, pick, clear, setHovered }
}
