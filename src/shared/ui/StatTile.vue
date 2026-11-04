<script setup lang="ts">
interface Props {
  label: string
  value: string | number
  hint?: string
  accent?: boolean
  /** 涨跌语义色：仅用于行情数值，UI 装饰色一律走金色 accent */
  tone?: 'neutral' | 'up' | 'down'
}

withDefaults(defineProps<Props>(), {
  hint: undefined,
  accent: false,
  tone: 'neutral',
})
</script>

<template>
  <div class="stat-tile" :class="{ 'stat-tile--accent': accent }">
    <span class="stat-tile__label">{{ label }}</span>
    <span class="stat-tile__value" :class="`stat-tile__value--${tone}`">{{ value }}</span>
    <span v-if="hint" class="stat-tile__hint">{{ hint }}</span>
  </div>
</template>

<style scoped>
.stat-tile {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.72);
}

.stat-tile__label {
  font-size: 9.5px;
  letter-spacing: 0.1em;
  color: var(--text-dim);
}

.stat-tile__value {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: var(--text-strong);
}

.stat-tile--accent .stat-tile__value {
  color: var(--accent-gold);
}

.stat-tile__value--up {
  color: var(--up);
}

.stat-tile__value--down {
  color: var(--down);
}

.stat-tile__hint {
  font-size: 9.5px;
  color: var(--text-dim);
}
</style>
