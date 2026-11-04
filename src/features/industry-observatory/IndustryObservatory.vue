<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import './styles.css'
import TopBar from './components/TopBar.vue'
import KpiPanel from './components/KpiPanel.vue'
import RankPanel from './components/RankPanel.vue'
import DetailCard from './components/DetailCard.vue'
import AuditDrawer from './components/AuditDrawer.vue'
import { FlowScene } from './three/FlowScene.js'
import { loadFeed } from './feed/client.js'
import { PERIODS } from './core/constants.js'
import { fmtClock } from './utils/format.js'

const sceneEl = ref(null)
const scene = shallowRef(null)

const period = ref('d1')
const payload = ref(null)
const channel = ref('live')
const loading = ref(true)
const refreshing = ref(false)
const error = ref('')
const toast = ref('')
const clock = ref('')
const selectedId = ref('')
const hoveredId = ref('')
const auditOpen = ref(false)
const rotating = ref(true)
const progress = ref({ loaded: 0, pages: 5 })

const periods = PERIODS
const periodMeta = computed(() => PERIODS.find((p) => p.key === period.value) || PERIODS[0])
const nodes = computed(() => payload.value?.nodes || [])
const selectedNode = computed(() => nodes.value.find((n) => n.id === selectedId.value) || null)
const activeId = computed(() => selectedId.value || hoveredId.value)

let clockTimer = null
let refreshTimer = null

function showToast(msg, ms = 2600) {
  toast.value = msg
  setTimeout(() => {
    toast.value = ''
  }, ms)
}

async function load({ force = false } = {}) {
  refreshing.value = true
  error.value = ''
  try {
    const { payload: p, channel: ch, errors } = await loadFeed(period.value, {
      force,
      onProgress: (pr) => {
        progress.value = pr
      },
    })
    payload.value = p
    channel.value = ch
    if (ch === 'snapshot') {
      error.value = '实时通道不可用，已切换离线快照'
      showToast('实时通道不可用 · 正在使用离线快照', 3600)
    } else if (ch === 'jsonp') {
      showToast('同源流水线未启动 · 已切换浏览器直连', 2400)
    } else if (errors?.length) {
      error.value = errors[0]
    }
    scene.value?.setData(p)
  } catch (e) {
    error.value = e.message
    showToast('取数失败：' + e.message, 5000)
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function scheduleRefresh() {
  clearTimeout(refreshTimer)
  const phase = payload.value?.session?.phase
  const delay = phase === 'open' ? 30_000 : phase === 'lunch' ? 120_000 : 300_000
  refreshTimer = setTimeout(async () => {
    if (document.visibilityState === 'visible') await load({ force: true })
    scheduleRefresh()
  }, delay)
}

watch(period, () => {
  selectedId.value = ''
  scene.value?.applySelection(null)
  scene.value?.homeCamera()
  load({ force: false }).then(scheduleRefresh)
})

watch(activeId, (id) => {
  scene.value?.applySelection(id || null)
  // 聚焦时停止巡航，否则镜头会在飞行途中继续漂移
  scene.value?.setAutoRotate(!id && rotating.value)
})

function onSelect(id) {
  if (!id) {
    selectedId.value = ''
    scene.value?.homeCamera()
    return
  }
  selectedId.value = id === selectedId.value ? '' : id
  if (selectedId.value) scene.value?.focusCamera(id)
}

function onFocus(id) {
  selectedId.value = id
  scene.value?.focusCamera(id)
}

function toggleRotate() {
  rotating.value = !rotating.value
  if (!activeId.value) scene.value?.setAutoRotate(rotating.value)
}

onMounted(() => {
  scene.value = new FlowScene(sceneEl.value, {
    onHover: (id) => {
      hoveredId.value = id || ''
    },
    onSelect,
  })
  scene.value.setAutoRotate(true)
  // 诊断桥：仅在 ?debug=1 时挂载，生产默认不污染全局
  if (new URLSearchParams(location.search).has('debug')) {
    window.__iflow = { scene, payload, selectedId }
  }
  clock.value = fmtClock(Date.now())
  clockTimer = setInterval(() => {
    clock.value = fmtClock(Date.now())
  }, 1000)
  load().then(scheduleRefresh)
})

onBeforeUnmount(() => {
  clearInterval(clockTimer)
  clearTimeout(refreshTimer)
  scene.value?.dispose()
})
</script>

<template>
  <div class="flow-observatory">
    <div class="stage">
      <div ref="sceneEl" class="scene" />
      <div class="vignette" />

      <TopBar
        :period="period"
        :periods="periods"
        :session="payload?.session"
        :channel="channel"
        :audit="payload?.audit"
        :clock="clock"
        :loading="refreshing"
        :rotating="rotating"
        @update:period="(p) => (period = p)"
        @refresh="load({ force: true })"
        @audit="auditOpen = !auditOpen"
        @rotate="toggleRotate"
        @home="scene?.homeCamera()"
      />

      <KpiPanel v-if="payload" :kpi="payload.kpi" :period="periodMeta" />

      <RankPanel
        v-if="payload"
        :nodes="nodes"
        :groups="payload.groups"
        :selected="selectedId"
        :hovered="hoveredId"
        @select="onSelect"
        @hover="(id) => (hoveredId = id)"
      />

      <DetailCard
        v-if="selectedNode"
        :node="selectedNode"
        :period-label="periodMeta.label"
        @close="onSelect('')"
        @focus="onFocus"
      />

      <AuditDrawer
        v-if="auditOpen && payload"
        :audit="payload.audit"
        :universe="payload.universe"
        :source="payload.source"
        :session="payload.session"
        :period="payload.period"
        :generated-at="payload.generatedAt"
        @close="auditOpen = false"
      />

      <footer class="bottombar glass">
        <div class="legend">
          <div class="legend-item">
            <span class="legend-swatch in" />
            <span>净流入 · 上行</span>
          </div>
          <div class="legend-item">
            <span class="legend-swatch out" />
            <span>净流出 · 下行</span>
          </div>
          <div class="legend-item" style="color: var(--ink-3)">
            <span>内环 = 一级 · 中环 = 二级 · 外环 = 三级 · 柱高 = 强度 · 粒子 = 流向</span>
          </div>
        </div>

        <div class="spacer" />

        <div class="divider-v" />

        <span class="micro" style="color: var(--ink-3)">
          {{ payload?.asOf ? payload.asOf.slice(0, 16).replace('T', ' ') : '—' }} · 申万
          {{ payload?.universe?.received ?? '—' }} 节点
          <template v-if="payload?.universe?.levels">
            （{{ payload.universe.levels[1] }}/{{ payload.universe.levels[2] }}/{{
              payload.universe.levels[3]
            }}）
          </template>
        </span>

        <button class="audit-chip" @click="auditOpen = !auditOpen">
          <span class="score-dot" :class="payload?.audit?.degraded ? 'bad' : ''" />
          契约 {{ payload?.audit?.passed ?? 0 }}/{{ payload?.audit?.total ?? 0 }}
          <span style="color: var(--ink-3)">· 质量 {{ payload?.audit?.score ?? 0 }}</span>
        </button>
      </footer>

      <div class="loading" :class="{ hide: !loading }">
        <div class="loading-inner">
          <div class="loading-ring" />
          <b>正在装配资金势能场</b>
          <p>
            {{ loading ? `枚举样本 · 分页抓取 ${progress.loaded}/${progress.pages}` : '就绪' }}
          </p>
        </div>
      </div>

      <div v-if="toast" class="toast">{{ toast }}</div>
    </div>
  </div>
</template>
