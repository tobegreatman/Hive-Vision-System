<script setup lang="ts">
import type { MarketBoardSummary } from '@platform/contracts'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { SESSION_LABEL, useMarketStore } from '@/entities/market-node'
import { useHiveNavigation } from '@/features/navigate-hive/use-hive-navigation'
import { useMarketHealth } from '@/features/market-health/use-market-health'
import { useFrameRate } from '@/features/market-metrics/use-frame-rate'
import { useNodeSelection } from '@/features/select-node/use-node-selection'
import { formatAmount, formatPct, formatPrice } from '@/shared/lib/format'
import { GlassPanel, StatusPill } from '@/shared/ui'
import BoardNav from '@/widgets/board-nav/BoardNav.vue'
import FeatureDeck from '@/widgets/feature-deck/FeatureDeck.vue'
import HiveCanvas from '@/widgets/hive-canvas/HiveCanvas.vue'
import NodeBrief from '@/widgets/node-brief/NodeBrief.vue'

const store = useMarketStore()
const {
  boardList,
  activeNodes,
  selectedId,
  selectedNeighbors,
  overview,
  upCount,
  downCount,
  flatCount,
  status,
} = storeToRefs(store)

const { level, enterBoard, leaveBoard, selectNode, clearNode, step } = useHiveNavigation()
const { hoveredId, setHovered } = useNodeSelection()
const { fps, start, stop } = useFrameRate()
const { state, health } = useMarketHealth()

const controller = new AbortController()
const clock = ref('')

const indexNode = computed(() => overview.value?.indices[0] ?? null)
const totalTurnover = computed(() => formatAmount(overview.value?.turnover ?? 0))
const indexChange = computed(() => indexNode.value?.changePct ?? 0)
const tradeDate = computed(() => health.value?.tradeDate ?? overview.value?.tradeDate ?? '—')

const sessionLabel = computed(() => (health.value ? SESSION_LABEL[health.value.session] : '连接中'))
const sessionTone = computed<'ok' | 'warn' | 'danger' | 'idle'>(() => {
  if (state.value !== 'online') return 'danger'
  if (!health.value) return 'idle'
  if (health.value.session === 'open') return 'ok'
  if (health.value.session === 'holiday') return 'warn'
  return 'idle'
})

const hint = computed(() => {
  if (level.value === 'boards') return '点击六边形下钻板块 · 拖拽旋转 · 滚轮缩放'
  if (selectedId.value) return '方向键切换板块内标的 · Esc 取消选中'
  return '点击六边形查看标的 · Esc 返回板块层'
})

function tickClock(): void {
  clock.value = new Date().toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  })
}

let clockTimer: ReturnType<typeof setInterval> | undefined


function onPickBoard(board: MarketBoardSummary): void {
  if (board.count === 0) return
  enterBoard(board.board)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    if (selectedId.value) {
      clearNode()
      return
    }
    if (level.value === 'nodes') leaveBoard()
    return
  }
  if (level.value !== 'nodes') return
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    step(1)
    return
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    step(-1)
  }
}

onMounted(() => {
  void store.load(controller.signal)
  start()
  tickClock()
  clockTimer = setInterval(tickClock, 1_000)
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  controller.abort()
  stop()
  if (clockTimer) clearInterval(clockTimer)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <main class="market-page">
    <div class="market-stars" aria-hidden="true" />

    <HiveCanvas
      :level="level"
      :boards="boardList"
      :nodes="activeNodes"
      :selected-id="selectedId"
      :hovered-id="hoveredId"
      @pick-board="onPickBoard"
      @pick-node="selectNode"
      @hover="setHovered"
      @clear="clearNode"
    />

    <header class="console-head rise-in">
      <div class="console-brand">
        <span class="console-brand__mark" aria-hidden="true" />
        <div class="console-brand__text">
          <span class="console-brand__name gradient-text">盘面</span>
          <span class="console-brand__tag mono">A-SHARE HIVE</span>
        </div>
      </div>

      <div class="console-hero">
        <p class="console-hero__eyebrow mono">
          <span class="console-hero__pulse" aria-hidden="true" />
          LIVE HIVE NAVIGATION
        </p>
        <h1 class="console-hero__title">
          <span>蜂巢</span><span class="console-hero__accent gradient-text">盘面</span>
        </h1>
        <p class="console-hero__hint">{{ hint }}</p>
      </div>

      <div class="console-meta">
        <div v-if="indexNode" class="index-readout">
          <span class="index-readout__name">{{ indexNode.name }}</span>
          <strong class="index-readout__value mono">{{ formatPrice(indexNode.price) }}</strong>
          <span
            class="index-readout__change mono"
            :class="indexNode.changePct >= 0 ? 'is-up' : 'is-down'"
          >
            {{ formatPct(indexNode.changePct) }}
          </span>
        </div>
        <div class="console-meta__row">
          <StatusPill :tone="sessionTone" :label="sessionLabel" />
          <span class="console-meta__chip mono">{{ tradeDate }}</span>
          <span class="console-meta__chip mono">{{ clock }}</span>
          <span class="console-meta__chip console-meta__chip--demo mono">DEMO</span>
        </div>
      </div>
    </header>

    <aside class="market-page__left rise-in">
      <GlassPanel title="板块导航" eyebrow="Hive" dense>
        <template #actions>
          <span class="panel-tag mono">{{ level === 'boards' ? 'L1' : 'L2' }}</span>
        </template>
        <BoardNav />
      </GlassPanel>
    </aside>

    <aside v-if="level === 'nodes'" class="market-page__right rise-in">
      <GlassPanel title="标的" eyebrow="Navigator" dense>
        <template #actions>
          <span v-if="selectedId" class="panel-tag mono">
            {{ selectedNeighbors.position }}/{{ selectedNeighbors.total }}
          </span>
        </template>
        <NodeBrief />
      </GlassPanel>
    </aside>

    <FeatureDeck class="market-page__deck rise-in" />

    <footer class="market-page__statusbar rise-in">
      <span class="mono statusbar__date">{{ tradeDate }}</span>
      <span class="statusbar__dot" aria-hidden="true" />
      <span class="mono statusbar__up">上涨 {{ upCount }}</span>
      <span class="mono statusbar__down">下跌 {{ downCount }}</span>
      <span class="mono">平盘 {{ flatCount }}</span>
      <span class="statusbar__dot" aria-hidden="true" />
      <span class="mono">两市成交 {{ totalTurnover }}</span>
      <span class="mono statusbar__index" :class="indexChange >= 0 ? 'is-up' : 'is-down'">
        上证 {{ formatPct(indexChange) }}
      </span>
      <span class="statusbar__dot" aria-hidden="true" />
      <span class="mono statusbar__hint">{{ hint }}</span>
      <span class="mono statusbar__fps">{{ fps }} FPS</span>
      <span v-if="status === 'error'" class="mono statusbar__error">后端离线</span>
    </footer>
  </main>
</template>

<style scoped>
.market-page {
  /* 深空控制台的局部主题：只作用于主页，分析页仍保持浅色报告风格 */
  color-scheme: dark;
  --panel: linear-gradient(158deg, rgba(12, 24, 44, 0.92), rgba(6, 12, 24, 0.74));
  --panel-solid: #0a1424;
  --line: rgba(96, 196, 255, 0.22);
  --line-soft: rgba(120, 170, 220, 0.16);
  --line-strong: rgba(96, 196, 255, 0.5);
  --text-strong: #eaf4ff;
  --text: #d2e2f2;
  --text-muted: #9db6d3;
  --text-dim: #86a2c0;
  --accent-gold: #f2c25c;
  --accent-gold-soft: #ffd98a;
  --accent-gold-bright: #ffe7b5;
  --up: #ff5d73;
  --down: #2ee6a6;
  --flat: #8ba3c2;

  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background:
    radial-gradient(1200px 760px at 50% 112%, rgba(26, 86, 156, 0.42), transparent 68%),
    radial-gradient(900px 620px at 8% 6%, rgba(104, 76, 226, 0.26), transparent 70%),
    radial-gradient(820px 560px at 96% 14%, rgba(0, 188, 255, 0.2), transparent 70%),
    radial-gradient(620px 440px at 84% 92%, rgba(255, 77, 157, 0.12), transparent 72%),
    linear-gradient(180deg, #03060e 0%, #07101f 46%, #04080f 100%);
}

/* 星尘层：置于画布之前，透明画布会把星点透出来 */
.market-stars {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0.5;
  background-image:
    radial-gradient(1px 1px at 26px 34px, rgba(255, 255, 255, 0.55), transparent 100%),
    radial-gradient(1px 1px at 148px 96px, rgba(150, 214, 255, 0.5), transparent 100%),
    radial-gradient(1.4px 1.4px at 74px 182px, rgba(255, 214, 150, 0.42), transparent 100%),
    radial-gradient(1px 1px at 208px 142px, rgba(255, 255, 255, 0.32), transparent 100%);
  background-size: 260px 220px, 300px 260px, 340px 300px, 220px 190px;
}

/* 极光色团：隔着透明 3D 画布形成深空的层次 */
.market-page::before {
  content: '';
  position: absolute;
  inset: -12%;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(30% 24% at 28% 24%, rgba(108, 76, 255, 0.34), transparent 70%),
    radial-gradient(24% 19% at 74% 20%, rgba(0, 190, 255, 0.3), transparent 72%),
    radial-gradient(28% 22% at 58% 86%, rgba(255, 170, 60, 0.16), transparent 74%),
    radial-gradient(20% 16% at 10% 76%, rgba(255, 80, 160, 0.16), transparent 76%);
  filter: blur(30px);
  animation: console-aura 22s ease-in-out infinite alternate;
}

@keyframes console-aura {
  0% {
    transform: translate3d(-1.5%, -1%, 0) scale(1);
  }
  100% {
    transform: translate3d(1.5%, 1.6%, 0) scale(1.04);
  }
}

/* 深空暗角：把视线收进蜂巢中心，边缘沉入背景 */
.market-page::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    radial-gradient(118% 90% at 50% 42%, transparent 40%, rgba(0, 0, 0, 0.58) 100%),
    linear-gradient(180deg, rgba(0, 0, 0, 0.3), transparent 20%, transparent 82%, rgba(0, 0, 0, 0.5));
}

.console-head {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 4;
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(280px, auto) minmax(220px, 1fr);
  align-items: start;
  gap: 20px;
  padding: 22px 28px 46px;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(3, 7, 14, 0.94), rgba(3, 7, 14, 0.5) 58%, transparent);
}

.console-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  pointer-events: auto;
}

.console-brand__mark {
  width: 32px;
  height: 36px;
  background: linear-gradient(150deg, #ffe7b5, #f2c25c 45%, #b5811e);
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
  box-shadow:
    0 0 22px rgba(242, 194, 92, 0.55),
    0 8px 18px -9px rgba(0, 0, 0, 0.9);
}

.console-brand__text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.console-brand__name {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: 0.1em;
  line-height: 1.1;
  background: linear-gradient(120deg, #ffe7b5, #f2c25c 46%, #7fe6ff);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
}

.console-brand__tag {
  font-size: 8px;
  letter-spacing: 0.2em;
  color: var(--text-dim);
  white-space: nowrap;
}

.console-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding-top: 2px;
  pointer-events: none;
}

.console-hero__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 8.5px;
  letter-spacing: 0.24em;
  color: var(--accent-gold);
}

.console-hero__pulse {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent-gold);
  box-shadow: 0 0 0 0 rgba(242, 194, 92, 0.5);
  animation: hero-pulse 2.4s ease-out infinite;
}

@keyframes hero-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(242, 194, 92, 0.45);
  }
  70% {
    box-shadow: 0 0 0 7px rgba(242, 194, 92, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(242, 194, 92, 0);
  }
}

.console-hero__title {
  display: flex;
  align-items: baseline;
  gap: 2px;
  font-size: clamp(34px, 3.6vw, 54px);
  font-weight: 800;
  letter-spacing: 0.03em;
  line-height: 1.02;
  color: #f2f8ff;
  text-shadow: 0 0 34px rgba(80, 190, 255, 0.32);
}

.console-hero__accent {
  letter-spacing: 0.06em;
  background: linear-gradient(120deg, #ffe7b5, #f2c25c 42%, #7fe6ff);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 18px rgba(242, 194, 92, 0.35));
}

.console-hero__hint {
  font-size: 10px;
  letter-spacing: 0.03em;
  color: var(--text-muted);
  white-space: nowrap;
}

.console-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 9px;
  pointer-events: auto;
}

.index-readout {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid rgba(96, 196, 255, 0.3);
  border-radius: 13px;
  background: linear-gradient(160deg, rgba(14, 28, 50, 0.88), rgba(6, 12, 24, 0.72));
  backdrop-filter: blur(18px);
  box-shadow:
    0 20px 40px -28px rgba(0, 0, 0, 0.95),
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 0 26px -14px rgba(80, 190, 255, 0.7);
}

.index-readout__name {
  font-size: 9.5px;
  color: var(--text-dim);
}

.index-readout__value {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #f2f8ff;
  text-shadow: 0 0 18px rgba(127, 230, 255, 0.35);
}

.index-readout__change {
  padding: 2px 6px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}

.index-readout__change.is-up {
  color: var(--up);
  background: rgba(255, 93, 115, 0.16);
}

.index-readout__change.is-down {
  color: var(--down);
  background: rgba(46, 230, 166, 0.16);
}

.console-meta__row {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.console-meta__chip {
  padding: 3px 8px;
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  font-size: 9px;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  white-space: nowrap;
}

.console-meta__chip--demo {
  border-color: rgba(242, 194, 92, 0.32);
  background: rgba(242, 194, 92, 0.12);
  color: var(--accent-gold);
  box-shadow: 0 0 18px -8px rgba(242, 194, 92, 0.6);
}

.market-page__left {
  position: absolute;
  top: 158px;
  left: 22px;
  z-index: 2;
  width: 246px;
  max-height: calc(100% - 316px);
  overflow-y: auto;
  pointer-events: auto;
  scrollbar-width: thin;
}

.market-page__right {
  position: absolute;
  top: 158px;
  right: 22px;
  z-index: 2;
  width: 252px;
  max-height: calc(100% - 316px);
  overflow-y: auto;
  pointer-events: auto;
  scrollbar-width: thin;
}

/* 不用 translateX 居中：rise-in 动画会覆盖 transform，导致整块偏到右侧。 */
.market-page__deck {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 56px;
  z-index: 4;
  margin-inline: auto;
}

.panel-tag {
  padding: 2px 7px;
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  font-size: 9px;
  letter-spacing: 0.08em;
  color: var(--text-dim);
}

.market-page__statusbar {
  position: absolute;
  bottom: 16px;
  left: 0;
  right: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  width: max-content;
  margin-inline: auto;
  padding: 7px 16px;
  border: 1px solid rgba(96, 196, 255, 0.2);
  border-radius: 999px;
  background: rgba(5, 11, 20, 0.82);
  backdrop-filter: blur(16px);
  font-size: 10px;
  letter-spacing: 0.02em;
  color: var(--text-dim);
  white-space: nowrap;
  box-shadow:
    0 14px 30px -26px rgba(0, 0, 0, 0.95),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.statusbar__up {
  color: var(--up);
}

.statusbar__down {
  color: var(--down);
}

.statusbar__index.is-up {
  color: var(--up);
}

.statusbar__index.is-down {
  color: var(--down);
}

.statusbar__dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--text-dim);
  opacity: 0.7;
}

.statusbar__hint {
  color: var(--text-dim);
  opacity: 0.85;
}

.statusbar__fps {
  color: var(--accent-gold);
}

.statusbar__error {
  color: #ff6b81;
}

/* 深色主页里，复用组件（板块导航、状态徽标）的硬编码浅色需要局部改写 */
.market-page :deep(.board-nav__root) {
  background: rgba(255, 255, 255, 0.06);
}

.market-page :deep(.board-nav__root:hover) {
  background: rgba(96, 196, 255, 0.1);
}

.market-page :deep(.board-chip:hover) {
  background: rgba(96, 196, 255, 0.1);
}

.market-page :deep(.board-chip--active) {
  background: rgba(242, 194, 92, 0.14);
  border-color: rgba(242, 194, 92, 0.36);
}

.market-page :deep(.board-chip__hex) {
  background: linear-gradient(160deg, rgba(242, 194, 92, 0.4), rgba(96, 196, 255, 0.18));
}

.market-page :deep(.board-chip__hex-core) {
  background: #0a1424;
}

.market-page :deep(.status-pill) {
  background: rgba(255, 255, 255, 0.06);
}

.market-page :deep(.status-pill--ok) {
  color: #2ee6a6;
  border-color: rgba(46, 230, 166, 0.4);
  background: rgba(46, 230, 166, 0.12);
}

.market-page :deep(.status-pill--warn) {
  color: #f2c25c;
  border-color: rgba(242, 194, 92, 0.36);
  background: rgba(242, 194, 92, 0.12);
}

.market-page :deep(.status-pill--danger) {
  color: #ff6b81;
  border-color: rgba(255, 93, 115, 0.4);
  background: rgba(255, 93, 115, 0.12);
}

.market-page :deep(.glass-panel) {
  box-shadow:
    0 30px 60px -34px rgba(0, 0, 0, 0.95),
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    0 0 40px -30px rgba(80, 190, 255, 0.8);
}

.market-page :deep(.divider) {
  border-color: rgba(120, 170, 220, 0.14);
}

/* 全局输入框是浅色底，放在深色面板里会像一块白斑 */
.market-page :deep(.text-input) {
  border-color: rgba(120, 170, 220, 0.24);
  background: rgba(8, 18, 34, 0.86);
  color: var(--text-strong);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.market-page :deep(.text-input::placeholder) {
  color: var(--text-dim);
}

.market-page :deep(.text-input:focus) {
  border-color: rgba(96, 196, 255, 0.55);
  box-shadow: 0 0 0 3px rgba(96, 196, 255, 0.12);
}

.market-page :deep(.index-row:hover) {
  background: rgba(96, 196, 255, 0.08);
}

@media (max-width: 1320px) {
  .market-page__statusbar .statusbar__hint {
    display: none;
  }
}

@media (max-width: 1120px) {
  .console-head {
    grid-template-columns: 1fr auto;
    row-gap: 10px;
    padding: 18px 20px 34px;
  }

  .console-hero {
    grid-column: 1 / -1;
    grid-row: 2;
    align-items: flex-start;
    padding-left: 2px;
  }

  .market-page__left,
  .market-page__right {
    top: 198px;
    max-height: calc(100% - 370px);
  }

  .market-page__left {
    width: 214px;
  }

  .market-page__right {
    width: 226px;
  }
}

@media (max-width: 860px) {
  .console-head {
    padding: 12px 14px 22px;
  }

  .console-hero__hint,
  .console-hero__eyebrow,
  .console-brand__tag {
    display: none;
  }

  .console-hero__title {
    font-size: 30px;
  }

  .console-meta__chip:not(.console-meta__chip--demo) {
    display: none;
  }

  .market-page__left {
    display: none;
  }

  .market-page__right {
    top: auto;
    right: 12px;
    bottom: 168px;
    width: min(280px, calc(100% - 24px));
    max-height: 30vh;
  }

  .market-page__statusbar {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .market-page::before,
  .console-hero__pulse {
    animation: none;
  }
}
</style>
