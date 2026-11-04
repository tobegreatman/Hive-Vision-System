import type {
  CreateMarketNodePayload,
  MarketBoard,
  MarketBoardSummary,
  MarketNode,
  MarketNodeDetail,
  MarketOverview,
} from '@platform/contracts'
import { BOARD_ORDER, marketBoardSchema, trendOf } from '@platform/contracts'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  ApiError,
  createMarketNode,
  fetchMarketBoards,
  fetchMarketNodeDetail,
  fetchMarketNodes,
  fetchMarketOverview,
  updateMarketNode,
} from '@/shared/api'

import { bloomFactor, neighborOf, orderByTurnover } from './presentation'

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

/**
 * 蜂巢导航层级：
 * - `boards` 板块层（`/`）
 * - `nodes`  标的层（`/board/:board`）
 */
export type HiveLevel = 'boards' | 'nodes'

function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return '未知错误'
}

/** 把路由参数收敛成合法板块，非法值一律回落到板块层。 */
export function parseBoardParam(raw: string | undefined | null): MarketBoard | null {
  if (!raw) return null
  const parsed = marketBoardSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

export const useMarketStore = defineStore('market', () => {
  const nodes = ref<MarketNode[]>([])
  const boards = ref<MarketBoardSummary[]>([])
  const overview = ref<MarketOverview | null>(null)
  const selectedId = ref<string | null>(null)
  const detail = ref<MarketNodeDetail | null>(null)
  const status = ref<LoadStatus>('idle')
  const error = ref<string | null>(null)
  const isCreating = ref(false)
  const savingId = ref<string | null>(null)
  const lastSyncedAt = ref<number | null>(null)

  /** 当前下钻到的板块；null 表示停在板块层。 */
  const activeBoard = ref<MarketBoard | null>(null)

  const level = computed<HiveLevel>(() => (activeBoard.value ? 'nodes' : 'boards'))

  const indices = computed(() =>
    overview.value ? overview.value.indices : nodes.value.filter((node) => node.kind === 'index'),
  )

  /** 当前层级要铺进蜂巢的标的（板块层没有标的，只有板块格子）。 */
  const activeNodes = computed<MarketNode[]>(() => {
    if (!activeBoard.value) return []
    return orderByTurnover(nodes.value.filter((node) => node.board === activeBoard.value))
  })

  const activeBoardSummary = computed<MarketBoardSummary | null>(
    () => boards.value.find((board) => board.board === activeBoard.value) ?? null,
  )

  const selected = computed<MarketNode | null>(
    () => nodes.value.find((node) => node.id === selectedId.value) ?? null,
  )

  const selectedNeighbors = computed(() => ({
    previous: neighborOf(activeNodes.value, selectedId.value, -1),
    next: neighborOf(activeNodes.value, selectedId.value, 1),
    position: activeNodes.value.findIndex((node) => node.id === selectedId.value) + 1,
    total: activeNodes.value.length,
  }))

  const glow = computed(() => bloomFactor(nodes.value))
  const stocks = computed(() => nodes.value.filter((node) => node.kind === 'stock'))
  const upCount = computed(() => stocks.value.filter((n) => trendOf(n.changePct) === 'up').length)
  const downCount = computed(
    () => stocks.value.filter((n) => trendOf(n.changePct) === 'down').length,
  )
  const flatCount = computed(
    () => stocks.value.filter((n) => trendOf(n.changePct) === 'flat').length,
  )

  /** 左侧导航条：按固定板块顺序排列，空板块也保留，保证两次刷新位置一致。 */
  const boardList = computed<MarketBoardSummary[]>(() => {
    const byBoard = new Map(boards.value.map((board) => [board.board, board]))
    return BOARD_ORDER.map((board) => byBoard.get(board)).filter(
      (board): board is MarketBoardSummary => board !== undefined,
    )
  })

  function upsert(node: MarketNode): void {
    const exists = nodes.value.some((item) => item.id === node.id)
    nodes.value = exists
      ? nodes.value.map((item) => (item.id === node.id ? node : item))
      : [...nodes.value, node]
  }

  function patchHeat(id: string, heat: number): void {
    nodes.value = nodes.value.map((node) => (node.id === id ? { ...node, heat } : node))
  }

  function clearSelection(): void {
    selectedId.value = null
    detail.value = null
  }

  /** 下钻 / 返回：只改层级状态，URL 由页面同步。 */
  function setBoard(board: MarketBoard | null): void {
    if (activeBoard.value === board) return
    activeBoard.value = board
    clearSelection()
  }

  async function load(signal?: AbortSignal): Promise<void> {
    status.value = 'loading'
    error.value = null
    try {
      const [list, snapshot, boardList] = await Promise.all([
        fetchMarketNodes(signal),
        fetchMarketOverview(signal),
        fetchMarketBoards(signal),
      ])
      nodes.value = list.items
      overview.value = snapshot.overview
      boards.value = boardList.items
      status.value = 'ready'
      lastSyncedAt.value = Date.now()
      if (selectedId.value && !list.items.some((item) => item.id === selectedId.value)) {
        clearSelection()
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      status.value = 'error'
      error.value = describeError(cause)
    }
  }

  /** 选中：先本地高亮，再取服务端盘口统计（排名 / 家数 / 涨跌停）。 */
  async function select(id: string): Promise<void> {
    selectedId.value = id
    detail.value = null

    try {
      const response = await fetchMarketNodeDetail(id)
      if (selectedId.value !== id) return
      detail.value = response.detail
      upsert(response.node)
      lastSyncedAt.value = Date.now()
    } catch (cause) {
      error.value = describeError(cause)
    }
  }

  async function create(payload: CreateMarketNodePayload): Promise<MarketNode | null> {
    if (isCreating.value) return null
    isCreating.value = true
    error.value = null

    try {
      const response = await createMarketNode(payload)
      upsert(response.node)
      lastSyncedAt.value = Date.now()
      await Promise.all([select(response.node.id), load()])
      return response.node
    } catch (cause) {
      error.value = describeError(cause)
      return null
    } finally {
      isCreating.value = false
    }
  }

  /** 乐观提交：拖动关注度滑块立即生效，松手后写回服务端。 */
  async function commit(id: string): Promise<void> {
    const target = nodes.value.find((node) => node.id === id)
    if (!target) return

    savingId.value = id
    error.value = null
    try {
      const response = await updateMarketNode(id, { heat: Number(target.heat.toFixed(2)) })
      upsert(response.node)
      lastSyncedAt.value = Date.now()
    } catch (cause) {
      error.value = describeError(cause)
      await load()
    } finally {
      savingId.value = null
    }
  }

  return {
    nodes,
    boards,
    overview,
    selectedId,
    detail,
    status,
    error,
    isCreating,
    savingId,
    lastSyncedAt,
    activeBoard,
    level,
    indices,
    activeNodes,
    activeBoardSummary,
    boardList,
    selected,
    selectedNeighbors,
    glow,
    stocks,
    upCount,
    downCount,
    flatCount,
    load,
    select,
    clearSelection,
    setBoard,
    create,
    patchHeat,
    commit,
  }
})
