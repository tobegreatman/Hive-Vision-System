<script setup lang="ts">
import type { MarketBoard } from '@platform/contracts'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import { BOARD_LABEL, tint, useMarketStore } from '@/entities/market-node'
import { boardAccent, boardSubtitle } from '@/entities/market-board'
import { AddWatchPanel } from '@/features/create-node'
import { useHiveNavigation } from '@/features/navigate-hive/use-hive-navigation'
import { formatAmount, formatNumber, formatPct } from '@/shared/lib/format'
import { StatusPill } from '@/shared/ui'

import IndexStrip from '../index-strip/IndexStrip.vue'

const store = useMarketStore()
const { boardList, level, activeBoard, status, stocks } = storeToRefs(store)
const { goToBoard, leaveBoard } = useHiveNavigation()

const isBoardLevel = computed(() => level.value === 'boards')
const syncedLabel = computed(() => {
  if (status.value === 'loading') return '同步中'
  if (status.value === 'error') return '后端离线'
  return `${stocks.value.length} 只`
})

const totalTurnover = computed(() =>
  formatAmount(boardList.value.reduce((sum, board) => sum + board.turnover, 0)),
)

function activeTone(board: MarketBoard): boolean {
  return activeBoard.value === board
}
</script>

<template>
  <div class="board-nav">
    <header class="board-nav__head">
      <button type="button" class="board-nav__root" @click="leaveBoard">
        <span class="board-nav__root-mark" aria-hidden="true" />
        全部板块
      </button>
      <StatusPill
        :tone="status === 'ready' ? 'ok' : status === 'error' ? 'danger' : 'warn'"
        :label="syncedLabel"
      />
    </header>

    <ul class="board-nav__list">
      <li v-for="board in boardList" :key="board.board">
        <button
          type="button"
          class="board-chip"
          :class="{
            'board-chip--active': activeTone(board.board),
            'board-chip--empty': board.count === 0,
          }"
          :aria-current="activeTone(board.board) ? 'true' : undefined"
          @click="goToBoard(board.board)"
        >
          <span class="board-chip__hex" aria-hidden="true">
            <span class="board-chip__hex-core" />
          </span>

          <span class="board-chip__body">
            <span class="board-chip__name">{{ BOARD_LABEL[board.board] }}</span>
            <span class="board-chip__sub mono">{{ boardSubtitle(board) }}</span>
          </span>

          <span
            class="board-chip__pct mono"
            :style="{
              color: board.count === 0 ? 'var(--text-dim)' : boardAccent(board),
              background: board.count === 0 ? 'transparent' : tint(boardAccent(board), 0.14),
            }"
          >
            {{ board.count === 0 ? '—' : formatPct(board.avgChangePct) }}
          </span>
        </button>
      </li>
    </ul>

    <hr class="divider" />

    <section class="board-nav__section">
      <header class="board-nav__section-head">
        <span class="board-nav__eyebrow">大盘指数</span>
        <span class="board-nav__note mono">成交 {{ totalTurnover }}</span>
      </header>
      <IndexStrip />
    </section>

    <hr class="divider" />

    <section v-if="isBoardLevel" class="board-nav__section">
      <header class="board-nav__section-head">
        <span class="board-nav__eyebrow">加入自选</span>
        <span class="board-nav__note mono">{{ formatNumber(stocks.length, 0) }} 只</span>
      </header>
      <AddWatchPanel />
    </section>

    <p v-else class="board-nav__hint">
      正在浏览
      <strong>{{ activeBoard ? BOARD_LABEL[activeBoard] : '' }}</strong>
      ，点左侧任意板块可切换，或点「全部板块」返回上层。
    </p>
  </div>
</template>

<style scoped>
.board-nav {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.board-nav__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.board-nav__root {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 9px 4px 6px;
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  cursor: pointer;
  transition:
    color 0.16s ease,
    border-color 0.16s ease;
}

.board-nav__root:hover {
  color: var(--accent-gold);
  border-color: var(--line-strong);
}

.board-nav__root-mark {
  width: 9px;
  height: 9px;
  background: var(--accent-gold);
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
  box-shadow: 0 2px 6px -2px rgba(154, 106, 18, 0.5);
}

.board-nav__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.board-chip {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 7px 8px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    transform 0.16s ease;
}

.board-chip:hover {
  background: rgba(15, 23, 42, 0.04);
  border-color: var(--line-soft);
}

.board-chip--active {
  background: rgba(232, 179, 57, 0.12);
  border-color: rgba(154, 106, 18, 0.32);
}

.board-chip--empty {
  opacity: 0.55;
}

/* 六边形徽标：CSS 切出来的蜂巢单元，和 3D 里的格子同构 */
.board-chip__hex {
  display: grid;
  place-items: center;
  width: 26px;
  height: 28px;
  background: linear-gradient(160deg, rgba(217, 169, 63, 0.32), rgba(100, 116, 139, 0.18));
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
}

.board-chip__hex-core {
  width: 20px;
  height: 22px;
  background: #ffffff;
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
}

.board-chip--active .board-chip__hex {
  background: linear-gradient(160deg, #f2cd74, #b5811e);
  box-shadow: 0 4px 10px -4px rgba(154, 106, 18, 0.55);
}

.board-chip__body {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.board-chip__name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-strong);
}

.board-chip__sub {
  font-size: 9.5px;
  letter-spacing: 0.02em;
  color: var(--text-dim);
  white-space: nowrap;
}

.board-chip__pct {
  padding: 2px 6px;
  border-radius: 5px;
  font-size: 10.5px;
  font-weight: 600;
  white-space: nowrap;
}

.board-nav__section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.board-nav__section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.board-nav__eyebrow {
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent-gold);
  opacity: 0.85;
}

.board-nav__note {
  font-size: 9.5px;
  color: var(--text-dim);
  white-space: nowrap;
}

.board-nav__hint {
  font-size: 11px;
  line-height: 1.6;
  color: var(--text-dim);
}

.board-nav__hint strong {
  color: var(--text);
  font-weight: 600;
}
</style>
