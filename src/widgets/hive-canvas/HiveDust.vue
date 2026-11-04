<script setup lang="ts">
import type { Object3D } from 'three'
import { useLoop } from '@tresjs/core'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, PointsMaterial } from 'three'
import { onUnmounted, ref } from 'vue'

const COUNT = 520

/** 深空尘埃：稀疏的彩色星点，给纯色背景一点纵深和视差。 */
const geometry = (() => {
  const positions = new Float32Array(COUNT * 3)
  const colors = new Float32Array(COUNT * 3)

  const palette = [new Color('#bfe9ff'), new Color('#8bb8ff'), new Color('#ffd48a')]

  for (let index = 0; index < COUNT; index += 1) {
    const angle = Math.random() * Math.PI * 2
    const distance = 14 + Math.random() * 30
    positions[index * 3] = Math.cos(angle) * distance
    positions[index * 3 + 1] = 0.6 + Math.random() * 17
    positions[index * 3 + 2] = Math.sin(angle) * distance

    const color = palette[index % palette.length] ?? palette[0]
    const brightness = 0.45 + Math.random() * 0.55
    if (color) {
      colors[index * 3] = color.r * brightness
      colors[index * 3 + 1] = color.g * brightness
      colors[index * 3 + 2] = color.b * brightness
    }
  }

  const buffer = new BufferGeometry()
  buffer.setAttribute('position', new BufferAttribute(positions, 3))
  buffer.setAttribute('color', new BufferAttribute(colors, 3))
  return buffer
})()

const material = new PointsMaterial({
  size: 0.16,
  sizeAttenuation: true,
  vertexColors: true,
  transparent: true,
  opacity: 0.9,
  depthWrite: false,
  blending: AdditiveBlending,
})

const dustRef = ref<Object3D | null>(null)

const { onBeforeRender } = useLoop()
onBeforeRender(({ elapsed }) => {
  if (dustRef.value) dustRef.value.rotation.y = elapsed * 0.018
})

onUnmounted(() => {
  geometry.dispose()
  material.dispose()
})
</script>

<template>
  <TresGroup ref="dustRef">
    <TresPoints :geometry="geometry" :material="material" />
  </TresGroup>
</template>
