import type { RendererOptions } from '@tresjs/core'
import { NoToneMapping, SRGBColorSpace } from 'three'

/**
 * 渲染基线：浅色面板需要「白是白、红是红」的干净输出，
 * 因此关闭 ACES 色调映射（它会把纯白压成灰、把涨跌色洗淡），只保留 sRGB 输出。
 * 交给 <TresCanvas v-bind="..."> 使用，保证全站只有一处渲染器配置。
 */
export const cinematicRenderer = {
  antialias: true,
  alpha: true,
  /**
   * 透明清屏：深空背景与星尘都在 CSS 层，画布必须是「全透明玻璃」。
   * 之前用浅灰 #f5f6f4，alpha 一旦没生效就会铺成一层灰色蒙版，
   * 加色混合的星点也会被一起洗掉。
   */
  clearColor: '#000000',
  clearAlpha: 0,
  /**
   * 关闭画布交换后清空：个别浏览器/内嵌预览里，首帧的 WebGL 内容不会被合成，
   * 表现为「要拖一下窗口才出现」。
   */
  preserveDrawingBuffer: true,
  toneMapping: NoToneMapping,
  outputColorSpace: SRGBColorSpace,
  shadows: false,
  powerPreference: 'high-performance',
  dpr: [1, 2],
} satisfies Partial<RendererOptions>
