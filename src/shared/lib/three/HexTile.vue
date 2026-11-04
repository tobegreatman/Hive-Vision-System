<script setup lang="ts">
import type { Texture } from 'three'
import { AdditiveBlending, Color, CylinderGeometry, DoubleSide, EdgesGeometry } from 'three'
import { computed, onUnmounted } from 'vue'

import { beamGlowTexture, radialGlowTexture } from './glow-textures'

const props = withDefaults(
  defineProps<{
    /** 蜂巢落点（世界坐标，y 由瓦片自身决定） */
    position: [number, number, number]
    /** 外接圆半径（中心 → 顶点） */
    radius: number
    /** 主题色：涨跌方向色或板块色 */
    accent: string
    /** 辉光强度 0–1，通常由涨跌幅或热度驱动 */
    glow?: number
    selected?: boolean
    hovered?: boolean
    /** 空板块等不可下钻的格子 */
    muted?: boolean
    /** 行情牌纹理（CanvasTexture） */
    texture: Texture
    /** 行情牌宽高比，用于保持文字不被拉伸 */
    labelAspect?: number
  }>(),
  { glow: 0.3, selected: false, hovered: false, muted: false, labelAspect: 1.6 },
)

const emit = defineEmits<{
  pick: []
  hover: [value: boolean]
}>()

/** 深色场景的格子更厚：侧面有更多空间承接霓虹轮廓光。 */
const THICKNESS = 0.24
const BEAM_HEIGHT = 3.4

const lift = computed(() => {
  if (props.muted) return -0.05
  if (props.selected) return 0.42
  if (props.hovered) return 0.2
  return 0
})

const scale = computed(() => (props.selected ? 1.06 : props.hovered ? 1.025 : 1))

/** 暗色玻璃主体：只保留一点主题色，亮度交给发光层。 */
const bodyColor = computed(() => {
  const color = new Color('#1a3050').lerp(new Color(props.accent), props.muted ? 0.05 : 0.12)
  return color.getStyle()
})

/**
 * 主体透明度：整体做成半透明玻璃舱，地台网格与光晕能透上来；
 * 悬停/选中时再实体化一点，强化「被点亮」的反馈。
 */
const bodyOpacity = computed(() => {
  if (props.muted) return 0.05
  if (props.selected) return 0.3
  if (props.hovered) return 0.18
  return 0.1
})

/**
 * 顶面发光色片：加色混合，暗底上像一块点亮的荧光板。
 * 压得比主体低一档，让上表面保持通透，颜色语义交给霓虹边框。
 */
const inlayOpacity = computed(() => {
  if (props.muted) return 0.02
  const base = 0.03 + props.glow * 0.06
  if (props.selected) return Math.min(1, base + 0.1)
  if (props.hovered) return Math.min(1, base + 0.04)
  return base
})

/** 顶面霓虹框：整圈实色环，比发丝线更容易被读成「发光」。 */
const frameOpacity = computed(() => {
  if (props.muted) return 0.18
  const base = 0.4 + props.glow * 0.3
  if (props.selected) return 1
  if (props.hovered) return Math.min(1, base + 0.28)
  return Math.min(1, base)
})

const ringOpacity = computed(() => (props.muted ? 0.35 : 0.9))

/** 落地光晕：让每个格子像一盏灯，把光洒在地台上。 */
const haloOpacity = computed(() => {
  if (props.muted) return 0.08
  const base = 0.22 + props.glow * 0.26
  if (props.selected) return 0.9
  if (props.hovered) return Math.min(0.9, base + 0.22)
  return Math.min(0.85, base)
})

const labelWidth = computed(() => props.radius * 1.34)
const labelHeight = computed(() => labelWidth.value / props.labelAspect)

/**
 * Sprite 是以自身中心定位的竖直四边形，抬升高度不足时下半段会沉进六棱柱体内，
 * 被深度测试吃掉（症状：贴图最下面那行「成交额 / 领涨」永远不显示）。
 * 抬升量必须跟着贴图高度走：让最底一行（贴图 y≈84%）刚好落在顶面之上。
 */
const LABEL_MARGIN = 0.05
const labelLift = computed(() => LABEL_MARGIN + labelHeight.value * 0.34)

/**
 * 六棱柱的棱线：EdgesGeometry 只保留真实棱边，
 * 不会像 wireframe 那样把三角剖分的对角线也画出来。
 */
const rimGeometry = new EdgesGeometry(
  new CylinderGeometry(props.radius, props.radius, THICKNESS, 6, 1),
)

const haloTexture = radialGlowTexture()
const beamTexture = beamGlowTexture()

onUnmounted(() => {
  rimGeometry.dispose()
})
</script>

<template>
  <TresGroup :position="position">
    <!-- 落地光晕：贴在地台上，不跟随格子抬升 -->
    <TresMesh :position="[0, 0.02, 0]" :rotation="[-Math.PI / 2, 0, 0]" :render-order="-1">
      <TresPlaneGeometry :args="[radius * 2.6, radius * 2.6]" />
      <TresMeshBasicMaterial
        :map="haloTexture"
        :color="accent"
        :transparent="true"
        :opacity="haloOpacity"
        :blending="AdditiveBlending"
        :depth-write="false"
      />
    </TresMesh>

    <TresGroup :position="[0, lift, 0]" :scale="scale">
      <!-- 主体六棱柱：暗色玻璃，轮廓光来自顶面霓虹框与地台反光 -->
      <TresMesh
        :position="[0, THICKNESS / 2, 0]"
        @click.stop="emit('pick')"
        @pointerenter="emit('hover', true)"
        @pointerleave="emit('hover', false)"
      >
        <TresCylinderGeometry :args="[radius, radius, THICKNESS, 6, 1]" />
        <TresMeshPhysicalMaterial
          :color="bodyColor"
          :transparent="true"
          :opacity="bodyOpacity"
          :metalness="0.42"
          :roughness="0.28"
          :clearcoat="1"
          :clearcoat-roughness="0.12"
          flat-shading
        />
      </TresMesh>

      <!-- 顶面发光色片（加色混合），颜色语义的主要载体 -->
      <!-- CircleGeometry 默认顶点在 ±X（flat-top），转 30° 才能和 pointy-top 的棱柱对齐 -->
      <TresMesh :position="[0, THICKNESS + 0.004, 0]" :rotation="[-Math.PI / 2, 0, Math.PI / 6]">
        <TresCircleGeometry :args="[radius * 0.94, 6]" />
        <TresMeshBasicMaterial
          :color="accent"
          :transparent="true"
          :opacity="inlayOpacity"
          :blending="AdditiveBlending"
          :depth-write="false"
        />
      </TresMesh>

      <!-- 霓虹边框：整圈六边形光环，取代细线成为发光轮廓 -->
      <TresMesh
        :position="[0, THICKNESS + 0.008, 0]"
        :rotation="[-Math.PI / 2, 0, Math.PI / 6]"
        :render-order="1"
      >
        <TresRingGeometry :args="[radius * 0.88, radius * 0.99, 6, 1]" />
        <TresMeshBasicMaterial
          :color="accent"
          :transparent="true"
          :opacity="frameOpacity"
          :blending="AdditiveBlending"
          :depth-write="false"
        />
      </TresMesh>

      <!-- 棱线：保留结构感，颜色略淡避免和边框抢 -->
      <TresLineSegments :geometry="rimGeometry" :position="[0, THICKNESS / 2, 0]">
        <TresLineBasicMaterial
          :color="accent"
          :transparent="true"
          :opacity="ringOpacity"
          :blending="AdditiveBlending"
        />
      </TresLineSegments>

      <!-- 选中光柱：从格子顶面升起的全息投影束 -->
      <TresMesh
        v-if="selected && !muted"
        :position="[0, THICKNESS + BEAM_HEIGHT / 2, 0]"
        :render-order="2"
      >
        <TresCylinderGeometry :args="[radius * 0.78, radius * 0.9, BEAM_HEIGHT, 24, 1, true]" />
        <TresMeshBasicMaterial
          :map="beamTexture"
          :color="accent"
          :transparent="true"
          :opacity="0.42"
          :side="DoubleSide"
          :blending="AdditiveBlending"
          :depth-write="false"
        />
      </TresMesh>

      <!-- 选中：顶面再套一圈亮环 -->
      <TresMesh
        v-if="selected"
        :position="[0, THICKNESS + 0.02, 0]"
        :rotation="[-Math.PI / 2, 0, Math.PI / 6]"
        :render-order="3"
      >
        <TresRingGeometry :args="[radius * 1.0, radius * 1.08, 6, 1]" />
        <TresMeshBasicMaterial
          :color="accent"
          :transparent="true"
          :opacity="0.95"
          :blending="AdditiveBlending"
          :depth-write="false"
        />
      </TresMesh>

      <!-- 行情牌：Canvas 纹理 Sprite，始终正对相机 -->
      <TresSprite
        :position="[0, THICKNESS + labelLift, 0]"
        :scale="[labelWidth, labelHeight, 1]"
        :render-order="10"
        @click.stop="emit('pick')"
        @pointerenter="emit('hover', true)"
        @pointerleave="emit('hover', false)"
      >
        <TresSpriteMaterial :map="texture" :transparent="true" :depth-write="false" />
      </TresSprite>
    </TresGroup>
  </TresGroup>
</template>
