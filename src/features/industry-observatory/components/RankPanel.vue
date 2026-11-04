<script setup>
import { computed, ref } from 'vue'
import { fmtMoney } from '../utils/format.js'

const props = defineProps({
  nodes: { type: Array, default: () => [] },
  groups: { type: Array, default: () => [] },
  selected: { type: String, default: '' },
  hovered: { type: String, default: '' },
})
const emit = defineEmits(['select', 'hover'])

const mode = ref('top') // top | bottom | group | fine

/**
 * 取数池按层级硬切，绝不混层：
 *   二级（128）—— 与左侧「净流入/流出合计」同一口径，可加总核对；
 *   三级（337）—— 细分视角，是二级的子集，父子不可相加，仅标注不可对账；
 *   一级（31） —— 分组视角，用 payload.groups。
 * 之前把 128+337 一起丢进同一个池，逆变器（三级）与光伏设备（二级）同时上榜，
 * 榜单头部金额因此虚高，与左侧合计对不上。
 */
const scope = computed(() =>
  mode.value === 'group' ? '一级行业 31 · 分组口径'
    : mode.value === 'fine' ? '三级板块 337 · 细分口径，不与左侧合计对账'
      : '二级行业 128 · 与左侧合计同口径'
)

const list = computed(() => {
  if (mode.value === 'group') {
    return props.groups
      .slice()
      .sort((a, b) => b.net - a.net)
      .map((g) => ({
        id: g.anchor || g.group,
        name: g.group,
        net: g.net,
        netPct: g.netPct,
        members: g.members,
        subs: g.subs,
        tier: null,
        isGroup: true,
      }))
  }
  const lv = mode.value === 'fine' ? 3 : 2
  const pool = props.nodes.filter((n) => n.level === lv)
  const arr = pool.slice().sort((a, b) => b.net - a.net)
  return mode.value === 'bottom' ? arr.slice(-60).reverse() : arr.slice(0, 60)
})

const maxAbs = computed(() => Math.max(...list.value.map((n) => Math.abs(n.net || 0)), 1))
</script>

<template>
  <aside class="rank-panel glass">
    <div class="rank-head">
      <h2>势能排行</h2>
      <div class="toggle-mini">
        <button :class="{ on: mode === 'top' }" @click="mode = 'top'">流入</button>
        <button :class="{ on: mode === 'bottom' }" @click="mode = 'bottom'">流出</button>
        <button :class="{ on: mode === 'group' }" @click="mode = 'group'">行业</button>
        <button :class="{ on: mode === 'fine' }" @click="mode = 'fine'">细分</button>
      </div>
    </div>

    <div class="rank-scope">{{ scope }}</div>

    <div class="rank-list">
      <div
        v-for="(n, i) in list"
        :key="n.id + i"
        class="rank-item"
        :class="{ active: selected === n.id }"
        @click="emit('select', n.id)"
        @mouseenter="emit('hover', n.id)"
        @mouseleave="emit('hover', '')"
      >
        <span class="rank-idx">{{ String(i + 1).padStart(2, '0') }}</span>
        <span class="rank-name">
          <span v-if="n.tier" class="tier" :class="n.tier">{{ n.tier }}</span>
          {{ n.name }}
          <em v-if="n.isGroup">{{ n.subs }} 个二级</em>
        </span>
        <span class="rank-val num" :class="(n.net ?? 0) >= 0 ? 'up' : 'down'">
          {{ fmtMoney(n.net, { digits: 1 }) }}
        </span>
        <span class="rank-bar">
          <i
            :style="{
              width: Math.max(3, (Math.abs(n.net) / maxAbs) * 100) + '%',
              background: (n.net ?? 0) >= 0 ? '#ff3559' : '#0fdc9b',
            }"
          />
        </span>
      </div>
    </div>
  </aside>
</template>
