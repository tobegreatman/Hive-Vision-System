<script setup lang="ts">
import { storeToRefs } from 'pinia'

import { tint, trendColor, useMarketStore } from '@/entities/market-node'
import { formatPct, formatPrice } from '@/shared/lib/format'

const store = useMarketStore()
const { indices } = storeToRefs(store)
</script>

<template>
  <div class="index-strip" role="list" aria-label="大盘指数">
    <div v-for="index in indices" :key="index.id" class="index-row" role="listitem">
      <span class="index-row__mark" :style="{ background: trendColor(index) }" aria-hidden="true" />
      <span class="index-row__name">{{ index.name }}</span>
      <span class="index-row__price mono">{{ formatPrice(index.price) }}</span>
      <span
        class="index-row__pct mono"
        :style="{ color: trendColor(index), background: tint(trendColor(index), 0.14) }"
      >
        {{ formatPct(index.changePct) }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.index-strip {
  display: flex;
  flex-direction: column;
  gap: 2px;
  pointer-events: auto;
}

.index-row {
  display: grid;
  grid-template-columns: 6px 1fr auto auto;
  align-items: center;
  gap: 8px;
  padding: 5px 6px;
  border-radius: var(--radius-sm);
  transition: background 0.16s ease;
}

.index-row:hover {
  background: rgba(15, 23, 42, 0.04);
}

.index-row__mark {
  width: 6px;
  height: 6px;
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
}

.index-row__name {
  font-size: 11px;
  letter-spacing: 0.02em;
  color: var(--text-muted);
  white-space: nowrap;
}

.index-row__price {
  font-size: 11.5px;
  color: var(--text);
}

.index-row__pct {
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 10.5px;
  font-weight: 600;
}
</style>
