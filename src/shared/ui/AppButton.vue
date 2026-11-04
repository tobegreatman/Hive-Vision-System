<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'ghost' | 'quiet'
  size?: 'md' | 'sm'
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  loading: false,
  disabled: false,
  type: 'button',
})

const emit = defineEmits<{ click: [event: MouseEvent] }>()

function onClick(event: MouseEvent): void {
  if (props.disabled || props.loading) {
    event.preventDefault()
    return
  }
  emit('click', event)
}
</script>

<template>
  <button
    :type="type"
    class="app-button"
    :class="[`app-button--${variant}`, `app-button--${size}`]"
    :disabled="disabled || loading"
    :aria-busy="loading"
    @click="onClick"
  >
    <span v-if="loading" class="app-button__spinner" aria-hidden="true" />
    <span class="app-button__label"><slot /></span>
  </button>
</template>

<style scoped>
.app-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid transparent;
  border-radius: 10px;
  font: inherit;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    background 0.18s ease,
    border-color 0.18s ease,
    opacity 0.18s ease;
}

.app-button--md {
  padding: 9px 16px;
  font-size: 12.5px;
}

.app-button--sm {
  padding: 6px 11px;
  font-size: 11.5px;
}

.app-button--primary {
  color: #2c1c02;
  background: linear-gradient(135deg, #f0c665, #ffd977 55%, #e6b13c);
  box-shadow: 0 12px 24px -16px rgba(154, 106, 18, 0.85);
}

.app-button--primary:hover:not(:disabled) {
  transform: translateY(-1px);
  background: linear-gradient(135deg, #ffdf9a, #f6dfa4 60%, #efc763);
}

.app-button--ghost {
  color: var(--text-strong);
  border-color: var(--line);
  background: rgba(232, 179, 57, 0.08);
}

.app-button--ghost:hover:not(:disabled) {
  border-color: var(--line-strong);
  background: rgba(232, 179, 57, 0.16);
}

.app-button--quiet {
  color: var(--text-muted);
  background: transparent;
}

.app-button--quiet:hover:not(:disabled) {
  color: var(--text-strong);
  background: rgba(148, 163, 184, 0.1);
}

.app-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.app-button:focus-visible {
  outline: 2px solid var(--accent-gold);
  outline-offset: 2px;
}

.app-button__spinner {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid rgba(26, 18, 4, 0.3);
  border-top-color: currentColor;
  animation: app-button-spin 0.7s linear infinite;
}

@keyframes app-button-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
