<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { fmtMoney, fmtPct } from '../utils/format.js'
import { loadIntraday } from '../feed/client.js'

const props = defineProps({
  node: { type: Object, required: true },
  periodLabel: { type: String, default: '' },
})
const emit = defineEmits(['close', 'focus'])

const points = ref([])
const loading = ref(false)

const tone = computed(() => (props.node.net ?? 0) >= 0 ? 'in' : 'out')

const path = computed(() => {
  const pts = points.value
  if (pts.length < 2) return { line: '', area: '' }
  const vals = pts.map((p) => p.main)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = max - min || 1
  const W = 300
  const H = 46
  const step = W / (pts.length - 1)
  const y = (v) => H - 4 - ((v - min) / span) * (H - 10)
  let line = `M0,${y(vals[0]).toFixed(1)}`
  pts.forEach((p, i) => {
    if (i === 0) return
    line += ` L${(i * step).toFixed(1)},${y(p.main).toFixed(1)}`
  })
  const area = `${line} L${W},${H} L0,${H} Z`
  return { line, area }
})

async function fetchSeries() {
  if (loading.value) return
  loading.value = true
  try {
    const data = await loadIntraday(props.node.id)
    points.value = data.points || []
  } catch {
    points.value = []
  } finally {
    loading.value = false
  }
}

onMounted(fetchSeries)
watch(() => props.node.id, () => {
  points.value = []
  fetchSeries()
})

const d5 = computed(() => props.node.d5net)
const d10 = computed(() => props.node.d10net)
</script>

<template>
  <section class="detail glass">
    <div class="detail-head">
      <div>
        <span class="micro">{{ node.group }} · {{ node.id }} · {{ ['', '一级', '二级', '三级'][node.level] }}</span>
        <h3 class="detail-title">{{ node.name }}</h3>
        <span class="verdict-badge" :class="tone">
          <svg v-if="node.verdict.tone === 'in'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M7 17 17 7M9 7h8v8"/></svg>
          <svg v-else-if="node.verdict.tone === 'out'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M17 7 7 17M15 17H7V9"/></svg>
          {{ node.verdict.label }}
          <template v-if="node.score?.tier"> · {{ node.score.tier }} 级</template>
        </span>
      </div>
      <button class="detail-close" @click="emit('close')">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>
      </button>
    </div>

    <div class="detail-nums">
      <div class="detail-num">
        <span>{{ periodLabel }}主力净额</span>
        <b :class="tone === 'in' ? 'up' : 'down'">{{ fmtMoney(node.net) }}</b>
      </div>
      <div class="detail-num">
        <span>净额占成交</span>
        <b :class="(node.netPct ?? 0) >= 0 ? 'up' : 'down'">{{ fmtPct(node.netPct) }}</b>
      </div>
      <div class="detail-num">
        <span>5 日累计</span>
        <b :class="(d5 ?? 0) >= 0 ? 'up' : 'down'">{{ fmtMoney(d5) }}</b>
      </div>
      <div class="detail-num">
        <span>10 日累计</span>
        <b :class="(d10 ?? 0) >= 0 ? 'up' : 'down'">{{ fmtMoney(d10) }}</b>
      </div>
      <div class="detail-num">
        <span>涨跌幅</span>
        <b :class="(node.chg ?? 0) >= 0 ? 'up' : 'down'">{{ fmtPct(node.chg) }}</b>
      </div>
      <div class="detail-num">
        <span>涨/跌家数</span>
        <b class="num-pair"><span class="up">{{ node.up ?? '—' }}</span><span class="sep">/</span><span class="down">{{ node.down ?? '—' }}</span></b>
      </div>
    </div>

    <div class="spark" v-if="points.length">
      <div class="section-title" style="margin-bottom: 4px">当日资金曲线</div>
      <svg viewBox="0 0 300 46" preserveAspectRatio="none">
        <defs>
          <linearGradient :id="'g' + node.id" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" :stop-color="tone === 'in' ? '#ff3559' : '#0fdc9b'" stop-opacity="0.32" />
            <stop offset="100%" :stop-color="tone === 'in' ? '#ff3559' : '#0fdc9b'" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path :d="path.area" :fill="'url(#g' + node.id + ')'" />
        <path :d="path.line" fill="none" :stroke="tone === 'in' ? '#ff5c78' : '#2eeab0'" stroke-width="1.4" stroke-linejoin="round" />
      </svg>
    </div>
    <div v-else-if="loading" class="micro" style="margin-top: 12px">加载分时…</div>

    <div class="reasons" v-if="node.verdict.reasons?.length">
      <div v-for="(r, i) in node.verdict.reasons" :key="i" class="reason">
        <span>{{ r.label }}</span>
        <span>{{ r.value }}</span>
      </div>
    </div>

    <div v-if="node.leader" class="kv" style="margin-top: 12px">
      <span>领涨 · {{ node.leader.name }} <em style="font-style:normal;color:var(--ink-3)">{{ node.leader.code }}</em></span>
      <b :class="(node.leader.chg ?? 0) >= 0 ? 'up' : 'down'">{{ fmtPct(node.leader.chg) }}</b>
    </div>

    <button
      class="audit-chip"
      style="width: 100%; justify-content: center; margin-top: 14px"
      @click="emit('focus', node.id)"
    >
      聚焦该板块
    </button>
  </section>
</template>
