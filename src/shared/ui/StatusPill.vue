<script setup lang="ts">
interface Props {
  tone?: 'ok' | 'warn' | 'danger' | 'idle'
  label: string
}

withDefaults(defineProps<Props>(), {
  tone: 'idle',
})
</script>

<template>
  <span class="status-pill" :class="`status-pill--${tone}`">
    <span class="status-pill__dot" aria-hidden="true" />
    {{ label }}
  </span>
</template>

<style scoped>
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--line-soft);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
  background: rgba(255, 255, 255, 0.8);
  white-space: nowrap;
}

.status-pill__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.status-pill--ok {
  color: #0f8f6d;
  border-color: rgba(15, 143, 109, 0.3);
  background: rgba(15, 157, 118, 0.08);
}

.status-pill--warn {
  color: #a06412;
  border-color: rgba(160, 100, 18, 0.28);
  background: rgba(217, 169, 63, 0.14);
}

.status-pill--danger {
  color: #c53030;
  border-color: rgba(197, 48, 48, 0.28);
  background: rgba(214, 69, 69, 0.08);
}
</style>
