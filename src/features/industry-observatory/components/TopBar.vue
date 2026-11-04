<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

const props = defineProps({
  period: { type: String, default: 'd1' },
  periods: { type: Array, default: () => [] },
  session: { type: Object, default: () => ({}) },
  channel: { type: String, default: 'live' },
  audit: { type: Object, default: () => ({}) },
  clock: { type: String, default: '' },
  loading: Boolean,
  rotating: Boolean,
})
const emit = defineEmits(['update:period', 'refresh', 'audit', 'rotate', 'home'])

const channelLabel = computed(() => ({
  live: '流水线直连',
  jsonp: '浏览器直连',
  snapshot: '离线快照',
  cache: '本地缓存',
}[props.channel] || props.channel))

const tone = computed(() => {
  if (props.channel === 'snapshot') return 'bad'
  if (props.audit?.degraded) return 'warn'
  return 'live'
})

const sessionTone = computed(() => (props.session?.phase === 'open' ? 'live' : ''))
</script>

<template>
  <div class="topbar">
    <div class="brand">
      <div class="brand-mark" />
      <div class="brand-text">
        <h1>资金流观测台</h1>
        <p>Shenwan L3 · Capital Potential Field</p>
      </div>
    </div>

    <div class="spacer" />

    <div class="segmented">
      <button
        v-for="p in periods"
        :key="p.key"
        :class="{ on: period === p.key }"
        @click="emit('update:period', p.key)"
      >
        {{ p.label }}
        <small>{{ p.bar }}</small>
      </button>
    </div>

    <div class="statusbar">
      <span class="pill" :class="sessionTone">
        <i class="dot" />
        {{ session?.label || '—' }} · {{ clock }}
      </span>
      <span class="pill" :class="tone">
        <i class="dot" />
        {{ channelLabel }}
        <template v-if="audit?.score != null"> · {{ audit.score }}分</template>
      </span>
      <RouterLink class="icon-btn" to="/" title="返回蜂巢">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M12 2.6 20 7v10l-8 4.4L4 17V7z" />
          <path d="M12 2.6V21.4" />
        </svg>
      </RouterLink>
      <button class="icon-btn" :class="{ spin: loading }" title="刷新" @click="emit('refresh')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <path d="M21 12a9 9 0 1 1-3-6.7" />
          <path d="M21 3v6h-6" />
        </svg>
      </button>
      <button class="icon-btn" title="自动巡航" @click="emit('rotate')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" :style="{ opacity: rotating ? 1 : 0.42 }">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </button>
      <button class="icon-btn" title="取数审计" @click="emit('audit')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M9 11l2 2 4-4" />
          <path d="M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9z" />
        </svg>
      </button>
      <button class="icon-btn" title="复位视角" @click="emit('home')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V21h14V9.5" />
        </svg>
      </button>
    </div>
  </div>
</template>
