<script setup>
import { computed } from 'vue'
import { fmtClock } from '../utils/format.js'
import { THRESHOLDS, WEIGHTS, GATES } from '../core/constants.js'

const props = defineProps({
  audit: { type: Object, default: () => ({}) },
  universe: { type: Object, default: () => ({}) },
  source: { type: Object, default: () => ({}) },
  session: { type: Object, default: () => ({}) },
  period: { type: Object, default: () => ({}) },
  generatedAt: { type: Number, default: 0 },
})
const emit = defineEmits(['close'])

const toneClass = computed(() => (props.audit.degraded ? 'bad' : props.audit.score >= 100 ? '' : 'warn'))
const checks = computed(() => props.audit.checks || [])
</script>

<template>
  <aside class="drawer glass">
    <div class="drawer-head">
      <div>
        <div class="micro">取数审计 · Pipeline Audit</div>
        <div style="display: flex; align-items: center; gap: 8px; margin-top: 5px">
          <span class="score-dot" :class="toneClass" />
          <b style="font-size: 13px; font-weight: 500">
            {{ audit.passed }}/{{ audit.total }} 门禁通过
          </b>
          <span class="micro" style="color: var(--ink-3)">{{ audit.degraded ? '已降级' : '契约有效' }}</span>
        </div>
      </div>
      <button class="detail-close" @click="emit('close')">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>
      </button>
    </div>

    <div class="drawer-body">
      <div class="section-title">契约 Contract</div>
      <div class="kv"><span>schema</span><b>{{ audit.contract }}</b></div>
      <div class="kv"><span>样本域</span><b>{{ universe.received }} / {{ universe.expected }}</b></div>
      <div class="kv"><span>分组</span><b>{{ universe.groups }} 个一级行业</b></div>
      <div class="kv"><span>帧指纹</span><b style="font-family: var(--mono); font-size: 10.5px">{{ universe.hash }}</b></div>
      <div class="kv"><span>生成时刻</span><b>{{ fmtClock(generatedAt) }}</b></div>
      <div class="kv"><span>数据时效</span><b>{{ audit.ageSec }}s</b></div>

      <div class="section-title">通道 Channel</div>
      <div class="kv"><span>数据源</span><b>{{ source.provider }}</b></div>
      <div class="kv"><span>通道</span><b>{{ source.channel }}</b></div>
      <div class="kv"><span>往返耗时</span><b>{{ source.latencyMs ?? '—' }} ms</b></div>
      <div class="kv"><span>分页 / 故障切换</span><b>{{ source.pages ?? '—' }} / {{ source.failovers ?? 0 }}</b></div>
      <div class="kv"><span>粒度</span><b>{{ period.label }} · {{ period.hint }}</b></div>

      <div class="section-title">门禁 Gates</div>
      <div v-for="c in checks" :key="c.id" class="gate">
        <span class="mark" :class="c.pass ? 'ok' : 'no'">{{ c.pass ? '✓' : '✗' }}</span>
        <span class="gl">{{ c.label }}<small>{{ c.note }}</small></span>
        <span class="gv">{{ c.value }}<small>期望 {{ c.expect }}</small></span>
      </div>

      <div class="section-title">阈值 Thresholds</div>
      <div class="kv"><span>抢筹 z 分位</span><b>≥ {{ THRESHOLDS.surgeZ }}</b></div>
      <div class="kv"><span>恐慌 z 分位</span><b>≤ {{ THRESHOLDS.panicZ }}</b></div>
      <div class="kv"><span>抢筹广度</span><b>≥ {{ THRESHOLDS.surgeBreadth }}</b></div>
      <div class="kv"><span>覆盖度门限</span><b>≥ {{ (GATES.minCoverage * 100).toFixed(0) }}%</b></div>

      <div class="section-title">权重 Weights</div>
      <div class="kv"><span>净额强度</span><b>{{ WEIGHTS.zNet }}</b></div>
      <div class="kv"><span>占比强度</span><b>{{ WEIGHTS.zIntensity }}</b></div>
      <div class="kv"><span>三周期一致性</span><b>{{ WEIGHTS.persistence }}</b></div>
      <div class="kv"><span>广度</span><b>{{ WEIGHTS.breadth }}</b></div>
      <div class="kv"><span>加速度</span><b>{{ WEIGHTS.acceleration }}</b></div>

      <p style="font-size: 10.5px; line-height: 1.6; color: var(--ink-3); margin-top: 18px">
        复合分经 tanh 压缩至 [-100,100]，方向即资金方向；分档由 |score| 的分位确定。
        所有裁决理由随数据下发，可逐条对照阈值复核。
      </p>
    </div>
  </aside>
</template>
