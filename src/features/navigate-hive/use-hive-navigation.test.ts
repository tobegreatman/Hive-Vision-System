import type { MarketBoardSummary, MarketNode } from '@platform/contracts'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useMarketStore } from '@/entities/market-node'
import * as api from '@/shared/api'

import { useHiveNavigation } from './use-hive-navigation'

type SharedApiModule = typeof api

vi.mock('@/shared/api', async (importOriginal) => {
  const actual = await importOriginal<SharedApiModule>()
  return {
    ...actual,
    fetchMarketNodes: vi.fn(),
    fetchMarketOverview: vi.fn(),
    fetchMarketBoards: vi.fn(),
    fetchMarketNodeDetail: vi.fn(),
  }
})

const NOW = '2026-11-04T01:30:00.000Z'

function makeNode(patch: Partial<MarketNode> & Pick<MarketNode, 'id' | 'board'>): MarketNode {
  return {
    symbol: '600000',
    exchange: 'SH',
    name: '示例标的',
    kind: 'stock',
    price: 10,
    changePct: 1,
    amplitude: 2,
    turnoverRate: 1,
    volumeRatio: 1,
    turnover: 10,
    marketCap: 100,
    mainNetInflow: 1,
    heat: 0.5,
    tags: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...patch,
  }
}

/** 主板两只（按成交额降序：中信证券 → 比亚迪），创业板一只。 */
const CITIC = makeNode({
  id: '11111111-1111-4111-8111-111111111111',
  symbol: '600030',
  name: '中信证券',
  board: 'main',
  turnover: 96.8,
})
const BYD = makeNode({
  id: '22222222-2222-4222-8222-222222222222',
  symbol: '002594',
  name: '比亚迪',
  exchange: 'SZ',
  board: 'main',
  turnover: 78.9,
})
const EASTMONEY = makeNode({
  id: '33333333-3333-4333-8333-333333333333',
  symbol: '300059',
  name: '东方财富',
  exchange: 'SZ',
  board: 'gem',
  turnover: 60.2,
})

const NODES = [CITIC, BYD, EASTMONEY]

function boardSummary(board: MarketBoardSummary['board'], count: number): MarketBoardSummary {
  return {
    board,
    label: board,
    count,
    up: count,
    down: 0,
    limitCount: 0,
    turnover: 100,
    mainNetInflow: 1,
    avgChangePct: 1.2,
    leader: null,
  }
}

beforeEach(() => {
  vi.mocked(api.fetchMarketNodes).mockResolvedValue({ items: NODES, total: NODES.length })
  vi.mocked(api.fetchMarketBoards).mockResolvedValue({
    items: [boardSummary('main', 2), boardSummary('gem', 1)],
    asOf: NOW,
  })
  vi.mocked(api.fetchMarketOverview).mockResolvedValue({
    overview: {
      indices: [],
      breadth: { up: 2, down: 1, flat: 0, limitUp: 0, limitDown: 0 },
      turnover: 1000,
      mainNetInflow: 10,
      session: 'open',
      tradeDate: '2026-11-04',
      asOf: NOW,
    },
  })
  vi.mocked(api.fetchMarketNodeDetail).mockImplementation(async (id: string) => ({
    node: NODES.find((node) => node.id === id) ?? CITIC,
    detail: { rank: 1, peerCount: 2, limitStatus: 'normal', visits: 0, lastVisitedAt: null },
  }))
})

const Blank = defineComponent({ render: () => h('div') })

async function mountAt(path: string) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'hive', component: Blank },
      { path: '/board/:board', name: 'hive-board', component: Blank },
    ],
  })
  await router.push(path)
  await router.isReady()

  let nav!: ReturnType<typeof useHiveNavigation>
  const Host = defineComponent({
    setup() {
      nav = useHiveNavigation()
      return () => h('div')
    },
  })
  const wrapper = mount(Host, { global: { plugins: [pinia, router] } })
  await flushPromises()

  return {
    wrapper,
    router,
    store: useMarketStore(),
    get nav() {
      return nav
    },
  }
}

describe('useHiveNavigation', () => {
  it('冷启动直链带 ?node：列表到达后才落位选中，不因首帧未加载而丢失', async () => {
    const ctx = await mountAt(`/board/main?node=${BYD.id}`)

    // 列表还没回来时不能硬选中一个不存在的标的
    expect(ctx.store.selectedId).toBeNull()

    await ctx.store.load()
    await flushPromises()

    expect(ctx.store.selectedId).toBe(BYD.id)
    expect(ctx.store.activeBoard).toBe('main')
    expect(ctx.store.selected?.name).toBe('比亚迪')
  })

  it('?node 与 URL 板块冲突时，以更具体的标的为准修正板块', async () => {
    const ctx = await mountAt(`/board/main?node=${EASTMONEY.id}`)
    await ctx.store.load()
    await flushPromises()

    const current = ctx.router.currentRoute.value
    expect(current.name).toBe('hive-board')
    expect(current.params.board).toBe('gem')
    expect(current.query.node).toBe(EASTMONEY.id)
    expect(ctx.store.activeBoard).toBe('gem')
    expect(ctx.store.selectedId).toBe(EASTMONEY.id)
  })

  it('?node 指向已不存在的标的时摘掉参数，不停在死链上', async () => {
    const ctx = await mountAt('/board/main?node=00000000-0000-4000-8000-000000000000')
    await ctx.store.load()
    await flushPromises()

    expect(ctx.router.currentRoute.value.query.node).toBeUndefined()
    expect(ctx.router.currentRoute.value.params.board).toBe('main')
    expect(ctx.store.selectedId).toBeNull()
  })

  it('selectNode 写入 query，step 在同板块内环绕', async () => {
    const ctx = await mountAt('/board/main')
    await ctx.store.load()
    await flushPromises()

    ctx.nav.selectNode(BYD.id)
    await flushPromises()
    expect(ctx.router.currentRoute.value.query.node).toBe(BYD.id)
    expect(ctx.store.selectedId).toBe(BYD.id)
    // 成交额顺序：中信证券 → 比亚迪，比亚迪是末位，下一只绕回中信证券
    expect(ctx.store.selectedNeighbors.position).toBe(2)
    expect(ctx.store.selectedNeighbors.total).toBe(2)

    ctx.nav.step(1)
    await flushPromises()
    expect(ctx.store.selectedId).toBe(CITIC.id)

    ctx.nav.clearNode()
    await flushPromises()
    expect(ctx.router.currentRoute.value.query.node).toBeUndefined()
    expect(ctx.store.selectedId).toBeNull()
  })

  it('切板块时清空选中，回上层后铺回板块层', async () => {
    const ctx = await mountAt(`/board/main?node=${BYD.id}`)
    await ctx.store.load()
    await flushPromises()
    expect(ctx.store.selectedId).toBe(BYD.id)

    ctx.nav.goToBoard('gem')
    await flushPromises()
    expect(ctx.store.activeBoard).toBe('gem')
    expect(ctx.store.selectedId).toBeNull()

    ctx.nav.goToBoard('gem')
    await flushPromises()
    expect(ctx.router.currentRoute.value.name).toBe('hive')
    expect(ctx.store.level).toBe('boards')
  })
})
