<script setup lang="ts">
import type { MarketNode } from '@platform/contracts'
import { computed, onUnmounted } from 'vue'

import HexTile from '@/shared/lib/three/HexTile.vue'
import { clamp } from '@/shared/lib/format'

import { createNodeHexTexture, HEX_LABEL_ASPECT } from '../model/hex-texture'
import { sceneTrendColor } from '../model/presentation'

const props = withDefaults(
  defineProps<{
    node: MarketNode
    position: [number, number, number]
    radius: number
    selected?: boolean
    hovered?: boolean
  }>(),
  { selected: false, hovered: false },
)

const emit = defineEmits<{
  pick: [id: string]
  hover: [id: string | null]
}>()

const accent = computed(() => sceneTrendColor(props.node))
/** 涨跌幅越极端，格子越亮：一眼看出哪些标的在异动 */
const glow = computed(() => clamp(Math.abs(props.node.changePct) / 10, 0, 1))

const texture = createNodeHexTexture(props.node)
onUnmounted(() => {
  texture.dispose()
})
</script>

<template>
  <HexTile
    :position="position"
    :radius="radius"
    :accent="accent"
    :glow="glow"
    :selected="selected"
    :hovered="hovered"
    :texture="texture"
    :label-aspect="HEX_LABEL_ASPECT"
    @pick="emit('pick', node.id)"
    @hover="(value) => emit('hover', value ? node.id : null)"
  />
</template>
