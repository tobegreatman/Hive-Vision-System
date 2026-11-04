<script setup lang="ts">
import type { Object3D } from 'three'
import { useLoop } from '@tresjs/core'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, PointsMaterial, Vector3 } from 'three'
import { onUnmounted, ref } from 'vue'

import { radialGlowTexture } from '@/shared/lib/three/glow-textures'

interface StarOptions {
  count: number
  /** 亮度下限，星空需要明暗差，否则会像一片均匀的噪点 */
  minBrightness: number
  minDistance: number
  maxDistance: number
  /** 是否聚成一条斜跨天穹的银河带 */
  band?: boolean
}

const STAR_PALETTE = [
  new Color('#ffffff'),
  new Color('#d8ecff'),
  new Color('#9dc4ff'),
  new Color('#ffe3ae'),
  new Color('#ffc0d4'),
]

/**
 * 银河带的倾斜法线。法线越水平，大圆越接近竖直、越会横跨天顶；
 * 之前法线接近竖直，大圆几乎贴着地平线，几百颗星挤成一条灰雾。
 */
const BAND_NORMAL = new Vector3(0.62, 0, 0.79).normalize()

function writeColor(colors: Float32Array, index: number, minBrightness: number): void {
  const color = STAR_PALETTE[index % STAR_PALETTE.length] ?? STAR_PALETTE[0]
  const brightness = minBrightness + Math.random() ** 1.5 * (1 - minBrightness)
  if (!color) return
  colors[index * 3] = color.r * brightness
  colors[index * 3 + 1] = color.g * brightness
  colors[index * 3 + 2] = color.b * brightness
}

/**
 * 上半球均匀撒点：cosTheta 均匀分布即球面面积均匀，避免星点都挤在天顶。
 * band 模式改为沿一条倾斜大圆聚集，用来做银河带。
 */
function createStarGeometry(options: StarOptions): BufferGeometry {
  const { count, minBrightness, minDistance, maxDistance, band = false } = options
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)

  for (let index = 0; index < count; index += 1) {
    const distance = minDistance + Math.random() * (maxDistance - minDistance)

    if (band) {
      const along = Math.random() * Math.PI * 2
      // 三次均匀分布相加近似钟形，星点向带中心收拢
      const spread = (Math.random() + Math.random() + Math.random() - 1.5) * 0.12
      const direction = new Vector3(Math.cos(along), 0, Math.sin(along))
        .addScaledVector(BAND_NORMAL, spread)
        .normalize()

      positions[index * 3] = direction.x * distance
      positions[index * 3 + 1] = direction.y * distance
      positions[index * 3 + 2] = direction.z * distance
    } else {
      // 略低于地平线即可：地台是半透明的，真正的天穹只在上方，
      // 撒到全球会让星点漏到平台底下，看起来像「地底有星星」
      const cosTheta = Math.random() * 1.12 - 0.12
      const theta = Math.acos(cosTheta)
      const phi = Math.random() * Math.PI * 2

      positions[index * 3] = distance * Math.sin(theta) * Math.cos(phi)
      positions[index * 3 + 1] = distance * cosTheta
      positions[index * 3 + 2] = distance * Math.sin(theta) * Math.sin(phi)
    }

    writeColor(colors, index, minBrightness)
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  return geometry
}

/**
 * 三层星点：细星铺满天空、银河带增加密度、近层亮星拉开纵深。
 * 点精灵挂上径向光晕贴图，否则默认的方形点会被看成噪点方块。
 *
 * 星点尺寸用「屏幕像素」而不是世界尺寸（sizeAttenuation = false）：
 * 世界尺寸的换算依赖绘图缓冲高度，首帧高度异常时会缩成 0.x 像素，
 * 表现为「星空要拖动窗口才出现」。固定像素尺寸与画布尺寸无关，
 * 缩放镜头时也像真实星空一样大小恒定。
 */
const fieldGeometry = createStarGeometry({
  count: 1400,
  minBrightness: 0.34,
  minDistance: 58,
  maxDistance: 96,
})

const bandGeometry = createStarGeometry({
  count: 420,
  minBrightness: 0.32,
  minDistance: 62,
  maxDistance: 98,
  band: true,
})

const beaconGeometry = createStarGeometry({
  count: 96,
  minBrightness: 0.7,
  minDistance: 46,
  maxDistance: 84,
})

const starTexture = radialGlowTexture()

const fieldMaterial = new PointsMaterial({
  map: starTexture,
  // sizeAttenuation = false 时 size 即 CSS 像素，与相机距离和画布高度无关
  size: 2.6,
  sizeAttenuation: false,
  vertexColors: true,
  transparent: true,
  opacity: 0.9,
  depthWrite: false,
  blending: AdditiveBlending,
})

const bandMaterial = new PointsMaterial({
  map: starTexture,
  size: 2.1,
  sizeAttenuation: false,
  vertexColors: true,
  transparent: true,
  opacity: 0.65,
  depthWrite: false,
  blending: AdditiveBlending,
})

const beaconMaterial = new PointsMaterial({
  map: starTexture,
  size: 4.8,
  sizeAttenuation: false,
  vertexColors: true,
  transparent: true,
  opacity: 0.92,
  depthWrite: false,
  blending: AdditiveBlending,
})

const skyRef = ref<Object3D | null>(null)

/** 天穹自转 + 亮星呼吸，让星空像在慢慢流动 */
const { onBeforeRender } = useLoop()
onBeforeRender(({ elapsed }) => {
  if (skyRef.value) skyRef.value.rotation.y = elapsed * 0.0045
  fieldMaterial.opacity = 0.84 + Math.sin(elapsed * 0.5) * 0.08
  beaconMaterial.opacity = 0.78 + Math.sin(elapsed * 1.2 + 1.1) * 0.2
})

onUnmounted(() => {
  fieldGeometry.dispose()
  bandGeometry.dispose()
  beaconGeometry.dispose()
  fieldMaterial.dispose()
  bandMaterial.dispose()
  beaconMaterial.dispose()
})
</script>

<template>
  <TresGroup ref="skyRef">
    <TresPoints :geometry="fieldGeometry" :material="fieldMaterial" />
    <TresPoints :geometry="bandGeometry" :material="bandMaterial" />
    <TresPoints :geometry="beaconGeometry" :material="beaconMaterial" />
  </TresGroup>
</template>
