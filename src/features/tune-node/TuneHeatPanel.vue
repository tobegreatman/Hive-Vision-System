<script setup lang="ts">
import type { MarketNode } from '@platform/contracts'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import { heatPercent, useMarketStore } from '@/entities/market-node'

const props = defineProps<{ node: MarketNode }>()

const store = useMarketStore()
const { savingId } = storeToRefs(store)

const isSaving = computed(() => savingId.value === props.node.id)

function onHeatInput(event: Event): void {
  const target = event.target as HTMLInputElement
  store.patchHeat(props.node.id, Number(target.value))
}

function commit(): void {
  void store.commit(props.node.id)
}
</script>

<template>
  <div class="tune">
    <div class="field">
      <label class="field__label" :for="`heat-${node.id}`">
        关注度
        <span class="field__value mono">{{ heatPercent(node.heat) }}%</span>
      </label>
      <input
        :id="`heat-${node.id}`"
        class="range-input"
        type="range"
        min="0"
        max="1"
        step="0.01"
        :value="node.heat"
        @input="onHeatInput"
        @change="commit"
      />
      <span class="tune__hint">
        {{ isSaving ? '正在写回服务端…' : '松手即同步到 Hono 后端，并抬高该格在蜂巢里的亮度' }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.tune {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tune__hint {
  font-size: 9.5px;
  line-height: 1.55;
  color: var(--text-dim);
}
</style>
