<script setup lang="ts">
import type { MarketBoardSummary, MarketNode } from '@platform/contracts'
import { OrbitControls } from '@tresjs/cientos'
import { TresCanvas } from '@tresjs/core'
import { computed } from 'vue'

import { BoardHex } from '@/entities/market-board'
import { NodeHex } from '@/entities/market-node'
import { hiveExtent, hexLayout } from '@/shared/lib/hex'
import { cinematicRenderer } from '@/shared/lib/three'

import HiveDust from './HiveDust.vue'
import HiveFloor from './HiveFloor.vue'
import HiveSky from './HiveSky.vue'

const props = withDefaults(
  defineProps<{
    level: 'boards' | 'nodes'
    boards: MarketBoardSummary[]
    nodes: MarketNode[]
    selectedId: string | null
    hoveredId: string | null
  }>(),
  {},
)

const emit = defineEmits<{
  pickBoard: [board: MarketBoardSummary]
  pickNode: [id: string]
  hover: [id: string | null]
  clear: []
}>()

/** 瓦片半径随格子数量收敛：格子多就缩小，保证整簇始终装进画面。 */
const radius = computed(() => (props.level === 'boards' ? 1.62 : 1.3))

const points = computed(() => {
  const count = props.level === 'boards' ? props.boards.length : props.nodes.length
  return hexLayout(count, radius.value)
})

/**
 * 相机距离按蜂巢外接半径推导，留出 2.25 倍余量，避免俯视透视把底排格子裁掉。
 * 再给一个最小取景半径：科创板这类只有一两只标的的板块，
 * 否则相机会直接怼到格子脸上，单格会占满整屏。
 */
const cameraDistance = computed(() => {
  const extent = Math.max(hiveExtent(points.value, radius.value), radius.value * 3.4)
  return Number((extent * 2.25 + 4).toFixed(2))
})

const cameraPosition = computed<[number, number, number]>(() => {
  const distance = cameraDistance.value
  /**
   * 俯角约 26°（0.44 / 0.9）。俯角一旦大于半个视野（20°），地平线就永远在屏幕外，
   * 画面会被地台填满、星空只剩最上面一条。压到 26° 后上半屏是深空，下半屏是蜂巢台面。
   */
  return [0, distance * 0.44, distance * 0.9]
})

const target = computed<[number, number, number]>(() => [0, 0.2, 0])

function onPickNode(id: string): void {
  emit('pickNode', id)
}

function onPickBoard(board: MarketBoardSummary): void {
  emit('pickBoard', board)
}
</script>

<template>
  <div class="hive-canvas">
    <TresCanvas
      v-bind="cinematicRenderer"
      class="hive-canvas__surface"
      window-size
      @pointermissed="emit('clear')"
    >
      <TresPerspectiveCamera
        :position="cameraPosition"
        :fov="40"
        :near="0.1"
        :far="220"
        :look-at="target"
      />

      <OrbitControls
        make-default
        :target="target"
        :enable-damping="true"
        :damping-factor="0.06"
        :min-distance="radius * 5"
        :max-distance="cameraDistance * 1.9"
        :max-polar-angle="Math.PI / 2.15"
        :min-polar-angle="0.15"
        :enable-pan="false"
      />

      <TresAmbientLight :intensity="0.4" color="#6f8fc9" />
      <TresDirectionalLight :position="[9, 16, 10]" :intensity="1.05" color="#ffffff" />
      <TresDirectionalLight :position="[-11, 7, -10]" :intensity="0.7" color="#4fc3ff" />
      <TresPointLight :position="[0, 5, 0]" :intensity="0.9" :distance="22" color="#f0c665" />
      <TresPointLight :position="[-6, 2, -7]" :intensity="0.35" :distance="18" color="#ff4d9d" />

      <HiveSky />
      <HiveDust />
      <HiveFloor @click="emit('clear')" />

      <!-- 板块层 -->
      <template v-if="level === 'boards'">
        <BoardHex
          v-for="(board, index) in boards"
          :key="`board-${board.board}`"
          :board="board"
          :radius="radius"
          :position="[points[index]?.x ?? 0, 0, points[index]?.z ?? 0]"
          @pick="onPickBoard"
          @hover="(value) => emit('hover', value ? value.board : null)"
        />
      </template>

      <!-- 标的层 -->
      <template v-else>
        <NodeHex
          v-for="(node, index) in nodes"
          :key="`node-${node.id}`"
          :node="node"
          :radius="radius"
          :position="[points[index]?.x ?? 0, 0, points[index]?.z ?? 0]"
          :selected="node.id === selectedId"
          :hovered="node.id === hoveredId"
          @pick="onPickNode"
          @hover="emit('hover', $event)"
        />
      </template>
    </TresCanvas>

    <div v-if="level === 'nodes' && nodes.length === 0" class="hive-canvas__empty">
      <p class="hive-canvas__empty-title">该板块暂无标的</p>
      <p class="hive-canvas__empty-body mono">按 Esc 返回板块层</p>
    </div>
  </div>
</template>

<style scoped>
.hive-canvas {
  position: absolute;
  inset: 0;
  /* 压在暗角遮罩之上：透明画布依旧能透出 CSS 的极光与星尘，
     但 3D 星空和霓虹不会被那层 30%+ 的黑纱再压一遍 */
  z-index: 2;
}

.hive-canvas__surface {
  position: absolute;
  inset: 0;
  width: 100% !important;
  height: 100% !important;
}

.hive-canvas :deep(canvas) {
  width: 100% !important;
  height: 100% !important;
}

.hive-canvas__empty {
  position: absolute;
  left: 50%;
  top: 50%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  transform: translate(-50%, -50%);
  text-align: center;
}

.hive-canvas__empty-title {
  font-size: 13px;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.hive-canvas__empty-body {
  font-size: 10px;
  color: var(--text-dim);
}
</style>
