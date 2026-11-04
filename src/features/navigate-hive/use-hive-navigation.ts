import type { MarketBoard } from '@platform/contracts'
import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { parseBoardParam, useMarketStore } from '@/entities/market-node'

/**
 * 蜂巢导航：URL 是层级的唯一事实源。
 *
 * - `/`                 板块层，蜂巢铺板块
 * - `/board/:board`     标的层，蜂巢铺该板块的标的
 * - `/board/:board?node=<id>`  再选中一只
 *
 * 这样浏览器前进 / 后退天然就是「下钻 / 返回上一级」，
 * 不需要在 store 里另建一套返回栈。
 */
export function useHiveNavigation() {
  const store = useMarketStore()
  const router = useRouter()
  const route = useRoute()
  const { level, activeBoard, activeNodes, selectedNeighbors } = storeToRefs(store)

  const routeBoard = computed<MarketBoard | null>(() =>
    parseBoardParam(route.params.board as string),
  )

  const routeNodeId = computed<string | null>(() => {
    const raw = route.query.node
    if (typeof raw !== 'string' || raw.length === 0) return null
    return raw
  })

  /** 路由 → store：合法板块才下钻，非法参数回落到板块层。 */
  watch(
    routeBoard,
    (board) => {
      store.setBoard(board)
      if (!board && route.params.board) void router.replace({ name: 'hive' })
    },
    { immediate: true },
  )

  /**
   * 路由 → store：URL 里带 node 就选中它。
   *
   * 同时盯 `nodes.length` 与 `activeBoard`：冷启动直接访问
   * `/board/main?node=<id>` 时列表还没到，缺少这两个依赖会让选中
   * 永久丢失（URL 不变 → watcher 不再求值）；下钻切板块时
   * `setBoard` 会清空选中，也需要在这里重新落位。
   */
  watch(
    [routeNodeId, () => store.nodes.length, () => store.activeBoard],
    ([id]) => {
      if (!id) {
        if (store.selectedId) store.clearSelection()
        return
      }
      if (store.selectedId === id) return
      if (store.nodes.length === 0) return

      const node = store.nodes.find((item) => item.id === id)
      if (!node) {
        // 旧分享链接 / 已被移除的标的：摘掉参数，避免停在死链上
        if (routeNodeId.value === id) void router.replace({ query: {} })
        return
      }

      // 标的比 URL 里的板块更具体，以中标者为准修正层级
      if (store.activeBoard !== node.board) {
        void router.replace({
          name: 'hive-board',
          params: { board: node.board },
          query: { node: id },
        })
        return
      }

      void store.select(id)
    },
    { immediate: true },
  )

  function enterBoard(board: MarketBoard): void {
    void router.push({ name: 'hive-board', params: { board } })
  }

  function leaveBoard(): void {
    void router.push({ name: 'hive' })
  }

  function goToBoard(board: MarketBoard): void {
    if (activeBoard.value === board) {
      leaveBoard()
      return
    }
    enterBoard(board)
  }

  function selectNode(id: string): void {
    if (routeNodeId.value === id) {
      void router.replace({ query: {} })
      return
    }
    void router.replace({ query: { node: id } })
  }

  function clearNode(): void {
    if (!routeNodeId.value) return
    void router.replace({ query: {} })
  }

  /** 板块内上一只 / 下一只，环绕导航。 */
  function step(offset: 1 | -1): void {
    const target = offset === 1 ? selectedNeighbors.value.next : selectedNeighbors.value.previous
    if (!target) return
    selectNode(target.id)
  }

  return {
    level,
    activeBoard,
    routeBoard,
    routeNodeId,
    activeNodes,
    selectedNeighbors,
    enterBoard,
    leaveBoard,
    goToBoard,
    selectNode,
    clearNode,
    step,
  }
}
