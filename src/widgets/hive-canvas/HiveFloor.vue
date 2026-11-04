<script setup lang="ts">
import type { Object3D } from 'three'
import { useLoop } from '@tresjs/core'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  LineBasicMaterial,
  LineDashedMaterial,
} from 'three'
import { onUnmounted, ref } from 'vue'

import { floorFadeTexture, radialGlowTexture } from '@/shared/lib/three/glow-textures'

const emit = defineEmits<{ click: [] }>()

const HEX_RADIUS = 1.12
/** 线框只铺到台面边缘：外圈交给 alphaMap 溶进星空，画面才不会被六边形占满 */
const GRID_RINGS = 4
/** 地台收成一圈「浮空指挥台」，alphaMap 在半径约 9.6 处就完全淡出 */
const PLANE_SIZE = 80

/** 生成一整片蜂巢线框：按轴向坐标铺环，只保留线段端点，不建面。 */
function createHiveGrid(rings: number, radius: number): BufferGeometry {
  const vertices: number[] = []
  const corners = Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 3) * index
    return { x: Math.sin(angle) * radius, z: Math.cos(angle) * radius }
  })

  for (let q = -rings; q <= rings; q += 1) {
    for (let r = Math.max(-rings, -q - rings); r <= Math.min(rings, -q + rings); r += 1) {
      const cx = Math.sqrt(3) * radius * (q + r / 2)
      const cz = 1.5 * radius * r
      for (let index = 0; index < 6; index += 1) {
        const a = corners[index]
        const b = corners[(index + 1) % 6]
        if (!a || !b) continue
        vertices.push(cx + a.x, 0, cz + a.z, cx + b.x, 0, cz + b.z)
      }
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3))
  return geometry
}

/** 单个六边形轮廓，用作向外扩散的扫描环。 */
function createHexOutline(radius: number): BufferGeometry {
  const positions: number[] = []
  // 虚线材质按顶点上的累计长度取段，LineSegments 需要每段自己成对给出
  const distances: number[] = []
  for (let index = 0; index < 6; index += 1) {
    const a = (Math.PI / 3) * index
    const b = (Math.PI / 3) * ((index + 1) % 6)
    positions.push(
      Math.sin(a) * radius,
      0,
      Math.cos(a) * radius,
      Math.sin(b) * radius,
      0,
      Math.cos(b) * radius,
    )
    // 正六边形边长恒等于外接圆半径
    distances.push(index * radius, (index + 1) * radius)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('lineDistance', new BufferAttribute(new Float32Array(distances), 1))
  return geometry
}

const gridGeometry = createHiveGrid(GRID_RINGS, HEX_RADIUS)
/** 扫描环从蜂巢外缘起步，避免从格子缝隙里穿过去像一条乱入的黄线 */
const sweepGeometry = createHexOutline(HEX_RADIUS * 4.6)

const gridMaterial = new LineBasicMaterial({ color: '#3f7fa6', transparent: true, opacity: 0.11 })
/**
 * 扫描环只是「数据在流动」的呼吸感。用虚线而不是实线：
 * 整圈实线会被读成一个突出来的亮框，虚线更像刻度尺/雷达。
 */
const sweepMaterial = new LineDashedMaterial({
  color: '#5fe0ff',
  transparent: true,
  opacity: 0.3,
  dashSize: 0.42,
  gapSize: 0.34,
})

const glowTexture = radialGlowTexture()
const fadeTexture = floorFadeTexture()

const sweepRef = ref<Object3D | null>(null)
const sweepRingRef = ref<Object3D | null>(null)

const SWEEP_PERIOD = 6.4

/** 扫描环：缓慢旋转 + 由内向外扩散并淡出，纯 3D 变换，不触发 Vue 响应式。 */
const { onBeforeRender } = useLoop()
onBeforeRender(({ elapsed }) => {
  const ring = sweepRingRef.value
  if (ring) {
    const phase = (elapsed % SWEEP_PERIOD) / SWEEP_PERIOD
    ring.scale.setScalar(1 + phase * 0.75)
    sweepMaterial.opacity = 0.36 * (1 - phase) ** 2
  }
  if (sweepRef.value) sweepRef.value.rotation.y = elapsed * 0.12
})

onUnmounted(() => {
  gridGeometry.dispose()
  sweepGeometry.dispose()
  gridMaterial.dispose()
  sweepMaterial.dispose()
})
</script>

<template>
  <TresGroup>
    <!-- 地台：深色镜面，让上层霓虹与光晕有承托；点空白处即取消选中 -->
    <TresMesh :position="[0, -0.1, 0]" :rotation="[-Math.PI / 2, 0, 0]" @click.stop="emit('click')">
      <TresPlaneGeometry :args="[PLANE_SIZE, PLANE_SIZE]" />
      <!-- 用 Basic 而不是 Physical：地台只负责一层暗色承托，
           清漆/金属度的高光会在暗底上糊成灰雾，也挡掉台面之外的星空 -->
      <TresMeshBasicMaterial
        color="#060c18"
        :transparent="true"
        :opacity="0.4"
        :alpha-map="fadeTexture"
        :depth-write="false"
      />
    </TresMesh>

    <!-- 地台能量池：两团加色光晕，把蜂巢从「深空」里托出来；范围跟台面收在一起 -->
    <TresMesh :position="[0, -0.092, 0]" :rotation="[-Math.PI / 2, 0, 0]">
      <TresPlaneGeometry :args="[14, 14]" />
      <TresMeshBasicMaterial
        :map="glowTexture"
        color="#2f86b8"
        :transparent="true"
        :opacity="0.3"
        :blending="AdditiveBlending"
        :depth-write="false"
      />
    </TresMesh>

    <TresMesh :position="[0, -0.09, 0]" :rotation="[-Math.PI / 2, 0, 0]">
      <TresPlaneGeometry :args="[9, 9]" />
      <TresMeshBasicMaterial
        :map="glowTexture"
        color="#e0a63f"
        :transparent="true"
        :opacity="0.12"
        :blending="AdditiveBlending"
        :depth-write="false"
      />
    </TresMesh>

    <!-- 蜂巢线框 -->
    <TresLineSegments :geometry="gridGeometry" :material="gridMaterial" :position="[0, -0.06, 0]" />

    <!-- 指挥台环：金色内环 + 青色外环，形成「控制台」的中心感 -->
    <TresMesh :position="[0, -0.048, 0]" :rotation="[-Math.PI / 2, 0, Math.PI / 6]">
      <TresRingGeometry :args="[HEX_RADIUS * 4.24, HEX_RADIUS * 4.32, 6, 1]" />
      <TresMeshBasicMaterial
        color="#f5c04a"
        :transparent="true"
        :opacity="0.55"
        :blending="AdditiveBlending"
        :depth-write="false"
      />
    </TresMesh>

    <TresMesh :position="[0, -0.046, 0]" :rotation="[-Math.PI / 2, 0, Math.PI / 6]">
      <TresRingGeometry :args="[HEX_RADIUS * 5.2, HEX_RADIUS * 5.26, 6, 1]" />
      <TresMeshBasicMaterial
        color="#5fe0ff"
        :transparent="true"
        :opacity="0.3"
        :blending="AdditiveBlending"
        :depth-write="false"
      />
    </TresMesh>

    <TresMesh :position="[0, -0.044, 0]" :rotation="[-Math.PI / 2, 0, Math.PI / 6]">
      <TresRingGeometry :args="[HEX_RADIUS * 6, HEX_RADIUS * 6.04, 6, 1]" />
      <TresMeshBasicMaterial
        color="#5fe0ff"
        :transparent="true"
        :opacity="0.12"
        :blending="AdditiveBlending"
        :depth-write="false"
      />
    </TresMesh>

    <!-- 扩散扫描环 -->
    <TresGroup ref="sweepRef">
      <TresLineSegments
        ref="sweepRingRef"
        :geometry="sweepGeometry"
        :material="sweepMaterial"
        :position="[0, -0.03, 0]"
      />
    </TresGroup>
  </TresGroup>
</template>
