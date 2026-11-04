<script setup lang="ts">
import type { MarketBoardSummary } from '@platform/contracts'
import { computed, onUnmounted } from 'vue'

import { createBoardHexTexture, HEX_LABEL_ASPECT } from '@/entities/market-node'
import { clamp } from '@/shared/lib/format'
import HexTile from '@/shared/lib/three/HexTile.vue'

import { boardAccent, boardGlow } from '../model/presentation'

const props = withDefaults(
  defineProps<{
    board: MarketBoardSummary
    position: [number, number, number]
    radius: number
    hovered?: boolean
  }>(),
  { hovered: false },
)

const emit = defineEmits<{
  pick: [board: MarketBoardSummary]
  hover: [board: MarketBoardSummary | null]
}>()

const accent = computed(() => boardAccent(props.board))
const glow = computed(() => clamp(boardGlow(props.board), 0, 1))
const muted = computed(() => props.board.count === 0)

const texture = createBoardHexTexture(props.board)
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
    :muted="muted"
    :hovered="hovered"
    :texture="texture"
    :label-aspect="HEX_LABEL_ASPECT"
    @pick="emit('pick', board)"
    @hover="(value) => emit('hover', value ? board : null)"
  />
</template>
