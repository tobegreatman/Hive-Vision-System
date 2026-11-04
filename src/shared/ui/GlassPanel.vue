<script setup lang="ts">
interface Props {
  title?: string
  eyebrow?: string
  dense?: boolean
}

withDefaults(defineProps<Props>(), {
  title: undefined,
  eyebrow: undefined,
  dense: false,
})
</script>

<template>
  <section class="glass-panel" :class="{ 'glass-panel--dense': dense }">
    <header v-if="title || eyebrow || $slots.actions" class="glass-panel__header">
      <div class="glass-panel__heading">
        <span v-if="eyebrow" class="glass-panel__eyebrow">{{ eyebrow }}</span>
        <h2 v-if="title" class="glass-panel__title">{{ title }}</h2>
      </div>
      <div v-if="$slots.actions" class="glass-panel__actions">
        <slot name="actions" />
      </div>
    </header>
    <div class="glass-panel__body">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="glass-panel__footer">
      <slot name="footer" />
    </footer>
  </section>
</template>

<style scoped>
.glass-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 18px 16px;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--panel);
  backdrop-filter: blur(22px) saturate(140%);
  box-shadow: var(--shadow-panel);
  pointer-events: auto;
}

.glass-panel--dense {
  padding: 14px;
  gap: 10px;
}

.glass-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.glass-panel__heading {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.glass-panel__eyebrow {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent-gold);
  opacity: 0.85;
}

.glass-panel__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--text-strong);
}

.glass-panel__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.glass-panel__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.glass-panel__footer {
  padding-top: 12px;
  border-top: 1px solid var(--line-soft);
}
</style>
