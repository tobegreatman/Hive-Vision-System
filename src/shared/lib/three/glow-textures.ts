import { CanvasTexture, SRGBColorSpace } from 'three'

/**
 * 3D 深空场景的发光贴图。
 * 关闭了后处理 Bloom，用「加色混合的发光滑片」代替：成本更低，透明画布也不会被泛光糊掉。
 * 纹理按应用生命周期缓存，尺寸固定，避免每个格子各建一张。
 */
let radialGlow: CanvasTexture | null = null
let beamGlow: CanvasTexture | null = null
let floorFade: CanvasTexture | null = null

/** 中心亮、边缘透明的径向渐变，用作格子落地光晕与地台能量池。 */
export function radialGlowTexture(): CanvasTexture {
  if (radialGlow) return radialGlow

  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
    gradient.addColorStop(0.22, 'rgba(255, 255, 255, 0.62)')
    gradient.addColorStop(0.52, 'rgba(255, 255, 255, 0.16)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }

  radialGlow = new CanvasTexture(canvas)
  radialGlow.colorSpace = SRGBColorSpace
  return radialGlow
}

/** 底部实、顶部淡出的竖向渐变，用作选中格子的全息光柱。 */
export function beamGlowTexture(): CanvasTexture {
  if (beamGlow) return beamGlow

  const width = 64
  const height = 256
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createLinearGradient(0, height, 0, 0)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
    gradient.addColorStop(0.28, 'rgba(255, 255, 255, 0.5)')
    gradient.addColorStop(0.72, 'rgba(255, 255, 255, 0.14)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  }

  beamGlow = new CanvasTexture(canvas)
  beamGlow.colorSpace = SRGBColorSpace
  return beamGlow
}

/**
 * 地台边缘的径向淡出遮罩：中心白、外围黑，直接当 alphaMap（读取绿通道）。
 * 让地台在远处溶进星空，而不是一块把视野糊死的黑色大板。
 */
export function floorFadeTexture(): CanvasTexture {
  if (floorFade) return floorFade

  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, size, size)

    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, '#ffffff')
    gradient.addColorStop(0.12, '#ffffff')
    gradient.addColorStop(0.17, '#b0b0b0')
    gradient.addColorStop(0.21, '#5a5a5a')
    gradient.addColorStop(0.24, '#000000')
    gradient.addColorStop(1, '#000000')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }

  floorFade = new CanvasTexture(canvas)
  return floorFade
}
