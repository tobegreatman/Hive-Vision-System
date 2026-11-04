<script setup>
import { computed } from 'vue'
import { splitMoney, fmtMoney } from '../utils/format.js'

const props = defineProps({
  kpi: { type: Object, required: true },
  period: { type: Object, default: () => ({}) },
})

const money = computed(() => splitMoney(props.kpi.netTotal))
const isUp = computed(() => (props.kpi.netTotal ?? 0) >= 0)
const breadthPct = computed(() => Math.round(((props.kpi.breadth ?? 0) + 1) / 2 * 100))
const concPct = computed(() => Math.round((props.kpi.concentration ?? 0) * 100))
const regimeClass = computed(() => props.kpi.regime?.code || 'rotate')
</script>

<template>
  <aside class="kpi-panel glass">
    <div class="kpi-head">
      <span class="micro">主力净额 · {{ period.cn }}</span>
      <span class="micro" style="color: var(--ink-3)">CNY</span>
    </div>

    <div class="kpi-total num" :class="isUp ? 'up' : 'down'">
      {{ money.num }}<span class="unit">{{ money.unit }}</span>
    </div>
    <div class="kpi-sub">
      {{ kpi.inflowCount }} 个二级板块净流入 · {{ kpi.outflowCount }} 个净流出
    </div>

    <div class="kpi-rows">
      <div>
        <div class="kpi-row">
          <span>市场广度</span>
          <b>{{ breadthPct }}<span style="font-size:10px;color:var(--ink-3)"> / 100</span></b>
        </div>
        <div class="meter">
          <i
            :style="{
              width: breadthPct + '%',
              background: kpi.breadth >= 0 ? 'linear-gradient(90deg,#7a2a3d,#ff3559)' : 'linear-gradient(90deg,#0f6b52,#0fdc9b)',
            }"
          />
        </div>
      </div>

      <div>
        <div class="kpi-row">
          <span>资金集中度</span>
          <b>{{ concPct }}%</b>
        </div>
        <div class="meter">
          <i :style="{ width: Math.min(100, concPct) + '%', background: 'linear-gradient(90deg,#3b2e8f,#8b7bff)' }" />
        </div>
      </div>

      <div class="kpi-row" style="margin-top: 2px">
        <span title="二级行业口径，与右侧排行同口径；流入+流出 = 上方主力净额">净流入合计</span>
        <b class="up">{{ fmtMoney(kpi.inflowSum) }}</b>
      </div>
      <div class="kpi-row">
        <span title="二级行业口径，与右侧排行同口径">净流出合计</span>
        <b class="down">{{ fmtMoney(kpi.outflowSum) }}</b>
      </div>
    </div>

    <div class="regime">
      <span class="regime-badge" :class="regimeClass">{{ kpi.regime?.label }}</span>
      <p>{{ kpi.regime?.desc }}</p>
    </div>

    <div class="kpi-row" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--line)">
      <span title="一级行业口径：31 个行业完整划分市场一次，是唯一不重复的统计总体">最强 · {{ kpi.leader?.name }}</span>
      <b class="up">{{ fmtMoney(kpi.leader?.net) }}</b>
    </div>
    <div class="kpi-row" style="margin-top: 6px">
      <span title="一级行业口径">最弱 · {{ kpi.laggard?.name }}</span>
      <b class="down">{{ fmtMoney(kpi.laggard?.net) }}</b>
    </div>
  </aside>
</template>
