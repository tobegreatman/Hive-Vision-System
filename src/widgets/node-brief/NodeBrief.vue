<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import {
  BOARD_LABEL,
  limitLabel,
  limitTone,
  symbolLabel,
  tint,
  trendColor,
  useMarketStore,
} from '@/entities/market-node'
import { TuneHeatPanel } from '@/features/tune-node'
import { useHiveNavigation } from '@/features/navigate-hive/use-hive-navigation'
import { formatAmount, formatPct, formatPrice } from '@/shared/lib/format'
import { AppButton, StatusPill } from '@/shared/ui'

const store = useMarketStore()
const { selected, detail, selectedNeighbors, activeBoard, savingId } = storeToRefs(store)
const { step, clearNode } = useHiveNavigation()

const accent = computed(() => (selected.value ? trendColor(selected.value) : 'var(--text-dim)'))

const limitStatus = computed(() => detail.value?.limitStatus ?? 'normal')

const rows = computed(() => {
  const node = selected.value
  if (!node) return []
  return [
    { label: '成交额', value: formatAmount(node.turnover) },
    { label: '换手率', value: `${node.turnoverRate.toFixed(2)}%` },
    { label: '量比', value: node.volumeRatio.toFixed(2) },
    { label: '振幅', value: `${node.amplitude.toFixed(2)}%` },
  ]
})

const facts = computed(() => {
  if (!detail.value) return []
  return [
    { label: '成交额排名', value: `#${detail.value.rank}` },
    { label: '同板块', value: `${detail.value.peerCount} 只` },
    { label: '被检视', value: `${detail.value.visits} 次` },
  ]
})
</script>

<template>
  <div class="node-brief">
    <template v-if="selected">
      <header class="node-brief__head">
        <div class="node-brief__title">
          <span
            class="node-brief__hex"
            :style="{ background: tint(accent, 0.22) }"
            aria-hidden="true"
          />
          <div>
            <h2 class="node-brief__name">{{ selected.name }}</h2>
            <p class="node-brief__code mono">
              {{ symbolLabel(selected) }} · {{ BOARD_LABEL[selected.board] }}
            </p>
          </div>
        </div>
        <button type="button" class="node-brief__close" aria-label="取消选中" @click="clearNode">
          ×
        </button>
      </header>

      <div class="node-brief__price">
        <span class="node-brief__value mono" :style="{ color: accent }">
          {{ formatPrice(selected.price) }}
        </span>
        <span
          class="node-brief__pct mono"
          :style="{ color: accent, background: tint(accent, 0.16) }"
        >
          {{ formatPct(selected.changePct) }}
        </span>
      </div>

      <div class="node-brief__badges">
        <StatusPill :tone="limitTone(limitStatus)" :label="limitLabel(limitStatus)" />
        <span class="node-brief__badge mono">
          {{ selectedNeighbors.position }} / {{ selectedNeighbors.total }}
        </span>
        <span v-if="savingId === selected.id" class="node-brief__badge mono">写入中…</span>
      </div>

      <!-- 板块内导航：键盘 ← → 同效，环绕不停 -->
      <div class="node-brief__step">
        <AppButton variant="ghost" size="sm" @click="step(-1)">‹ 上一只</AppButton>
        <AppButton variant="ghost" size="sm" @click="step(1)">下一只 ›</AppButton>
      </div>

      <dl class="node-brief__grid">
        <div v-for="row in rows" :key="row.label">
          <dt>{{ row.label }}</dt>
          <dd class="mono">{{ row.value }}</dd>
        </div>
      </dl>

      <dl v-if="facts.length" class="node-brief__facts">
        <div v-for="fact in facts" :key="fact.label">
          <dt>{{ fact.label }}</dt>
          <dd class="mono">{{ fact.value }}</dd>
        </div>
      </dl>

      <hr class="divider" />

      <TuneHeatPanel :node="selected" />
    </template>

    <template v-else>
      <div class="node-brief__idle">
        <span class="node-brief__idle-hex" aria-hidden="true" />
        <p class="node-brief__idle-title">尚未选中标的</p>
        <p class="node-brief__idle-body">
          点击蜂巢中任意一格即可查看该标的的成交额排名、同板块家数与涨跌停状态。
        </p>
        <p v-if="activeBoard" class="node-brief__idle-note mono">
          当前板块：{{ BOARD_LABEL[activeBoard] }} · 共 {{ store.activeNodes.length }} 只
        </p>
        <p v-else class="node-brief__idle-note mono">当前在板块层，先点一个板块下钻</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.node-brief {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.node-brief__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.node-brief__title {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.node-brief__hex {
  width: 22px;
  height: 24px;
  flex-shrink: 0;
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
}

.node-brief__name {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: var(--text-strong);
}

.node-brief__code {
  font-size: 9.5px;
  letter-spacing: 0.04em;
  color: var(--text-dim);
}

.node-brief__close {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border: 1px solid var(--line-soft);
  border-radius: 6px;
  background: transparent;
  color: var(--text-dim);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  transition:
    color 0.16s ease,
    border-color 0.16s ease;
}

.node-brief__close:hover {
  color: var(--text-strong);
  border-color: var(--line);
}

.node-brief__price {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.node-brief__value {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.node-brief__pct {
  padding: 2px 7px;
  border-radius: 5px;
  font-size: 12px;
  font-weight: 600;
}

.node-brief__badges {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.node-brief__badge {
  padding: 3px 7px;
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  font-size: 9.5px;
  color: var(--text-dim);
}

.node-brief__step {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.node-brief__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 0;
}

.node-brief__grid div,
.node-brief__facts div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.node-brief__grid dt,
.node-brief__facts dt {
  font-size: 9.5px;
  color: var(--text-dim);
}

.node-brief__grid dd,
.node-brief__facts dd {
  margin: 0;
  font-size: 12px;
  color: var(--text);
  white-space: nowrap;
}

.node-brief__facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin: 0;
  padding-top: 9px;
  border-top: 1px solid var(--line-soft);
}

.node-brief__idle {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 2px;
}

.node-brief__idle-hex {
  width: 30px;
  height: 33px;
  border: 1px solid var(--line);
  background: linear-gradient(160deg, rgba(232, 179, 57, 0.16), transparent);
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
}

.node-brief__idle-title {
  font-size: 12.5px;
  color: var(--text);
}

.node-brief__idle-body {
  font-size: 11px;
  line-height: 1.65;
  color: var(--text-dim);
}

.node-brief__idle-note {
  font-size: 9.5px;
  color: var(--text-muted);
}
</style>
