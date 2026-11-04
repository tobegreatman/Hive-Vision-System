import type { MarketBoardSummary, MarketNode } from '@platform/contracts'
import { CanvasTexture, SRGBColorSpace } from 'three'

import { formatAmount, formatPct, formatPrice } from '@/shared/lib/format'

import { sceneTrendColor } from './presentation'

const WIDTH = 512
const HEIGHT = 320

/** 行情牌宽高比，供 HexTile 计算 Sprite 尺寸，避免文字被压扁。 */
export const HEX_LABEL_ASPECT = WIDTH / HEIGHT

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace'
const SANS = '"PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif'

/** 左右内边距：贴图两侧留白，避免文字贴到六边形棱线。 */
const PAD = 44
/** 同一行两段文字之间的最小呼吸距离。 */
const GAP = 18

function measure(
  ctx: CanvasRenderingContext2D,
  text: string,
  size: number,
  family: string,
  weight = 700,
): number {
  ctx.font = `${weight} ${size}px ${family}`
  return ctx.measureText(text).width
}

/**
 * 一行排不下时按比例整体缩字号（同排行共用缩放，避免大小悬殊），
 * 最低缩到 `minScale`；仍放不下由调用方截断。
 */
function fitScale(
  ctx: CanvasRenderingContext2D,
  parts: readonly { text: string; size: number; family: string; weight?: number }[],
  maxWidth: number,
  minScale = 0.6,
): number {
  const total =
    parts.reduce((sum, part) => sum + measure(ctx, part.text, part.size, part.family, part.weight), 0) +
    GAP * (parts.length - 1)
  if (total <= maxWidth) return 1
  return Math.max(minScale, maxWidth / total)
}

/** 名称过长时逐级降字号，仍超宽则截断加省略号。 */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  size: number,
  minSize: number,
  family: string,
  weight: number,
  maxWidth: number,
): { text: string; size: number } {
  let current = size
  while (current > minSize && measure(ctx, text, current, family, weight) > maxWidth) {
    current -= 2
  }
  if (measure(ctx, text, current, family, weight) <= maxWidth) return { text, size: current }

  let clipped = text
  while (clipped.length > 1 && measure(ctx, `${clipped}…`, current, family, weight) > maxWidth) {
    clipped = clipped.slice(0, -1)
  }
  return { text: `${clipped}…`, size: current }
}

function createCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null } {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  return { canvas, ctx: canvas.getContext('2d') }
}

/**
 * 行情牌底卡：深空场景下是一块半透明深色玻璃，
 * 用主题色的描边 + 外发光把卡片从同样暗的蜂巢面上「提」起来，同时保证文字对比度。
 */
function paintInnerShade(ctx: CanvasRenderingContext2D, accent: string): void {
  const inset = 16
  const width = WIDTH - inset * 2
  const height = HEIGHT - inset * 2
  const radius = 34

  ctx.beginPath()
  ctx.moveTo(inset + radius, inset)
  ctx.lineTo(inset + width - radius, inset)
  ctx.quadraticCurveTo(inset + width, inset, inset + width, inset + radius)
  ctx.lineTo(inset + width, inset + height - radius)
  ctx.quadraticCurveTo(inset + width, inset + height, inset + width - radius, inset + height)
  ctx.lineTo(inset + radius, inset + height)
  ctx.quadraticCurveTo(inset, inset + height, inset, inset + height - radius)
  ctx.lineTo(inset, inset + radius)
  ctx.quadraticCurveTo(inset, inset, inset + radius, inset)
  ctx.closePath()

  ctx.save()
  ctx.shadowColor = accent
  ctx.shadowBlur = 24
  ctx.fillStyle = 'rgba(6, 12, 24, 0.68)'
  ctx.fill()
  ctx.restore()

  ctx.save()
  const sheen = ctx.createLinearGradient(0, inset, 0, inset + height)
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.1)')
  sheen.addColorStop(0.4, 'rgba(255, 255, 255, 0)')
  sheen.addColorStop(1, 'rgba(0, 0, 0, 0.24)')
  ctx.fillStyle = sheen
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.globalAlpha = 0.9
  ctx.strokeStyle = accent
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.restore()
}

function finalize(canvas: HTMLCanvasElement): CanvasTexture {
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

/** 个股 / 指数格子：名称 + 代码 + 最新价 + 涨跌幅 + 成交额。 */
export function createNodeHexTexture(node: MarketNode): CanvasTexture {
  const { canvas, ctx } = createCanvas()
  if (!ctx) return new CanvasTexture(canvas)

  const accent = sceneTrendColor(node)
  const contentWidth = WIDTH - PAD * 2
  paintInnerShade(ctx, accent)
  ctx.textBaseline = 'middle'

  // 名称（左）与代码（右）：先按名称实测宽度收窄，再让代码右对齐
  const code = `${node.symbol}.${node.exchange}`
  const codeWidth = measure(ctx, code, 24, MONO, 400)
  const name = fitText(ctx, node.name, 46, 30, SANS, 600, contentWidth - codeWidth - GAP)

  ctx.fillStyle = '#ecf5ff'
  ctx.font = `600 ${name.size}px ${SANS}`
  ctx.fillText(name.text, PAD, 86)

  ctx.font = `400 24px ${MONO}`
  ctx.fillStyle = '#8ba4c5'
  ctx.fillText(code, WIDTH - codeWidth - PAD, 88)

  // 最新价（大号等宽）与涨跌幅（右对齐，颜色即方向）
  // 长价格（如 1,586.00）与 `-10.00%` 同排会超出贴图宽度，按比例收字号
  const price = formatPrice(node.price)
  const pct = formatPct(node.changePct)
  const scale = fitScale(
    ctx,
    [
      { text: price, size: 70, family: MONO },
      { text: pct, size: 56, family: MONO },
    ],
    contentWidth,
    0.62,
  )
  const priceSize = Math.round(70 * scale)
  const pctSize = Math.round(56 * scale)

  ctx.font = `700 ${priceSize}px ${MONO}`
  ctx.fillStyle = '#ffffff'
  ctx.fillText(price, PAD, 196)

  ctx.font = `700 ${pctSize}px ${MONO}`
  ctx.fillStyle = accent
  ctx.fillText(pct, WIDTH - measure(ctx, pct, pctSize, MONO) - PAD, 198)

  // 成交额：导航时的「活跃度」提示
  ctx.font = `400 24px ${MONO}`
  ctx.fillStyle = '#7f97b7'
  ctx.fillText(`成交 ${formatAmount(node.turnover)}`, PAD, 268)

  return finalize(canvas)
}

/** 板块格子：板块名 + 家数 + 均涨幅 + 涨跌分布 + 领涨股。 */
export function createBoardHexTexture(board: MarketBoardSummary): CanvasTexture {
  const { canvas, ctx } = createCanvas()
  if (!ctx) return new CanvasTexture(canvas)

  const accent = board.count === 0 ? '#7f97b7' : sceneTrendColor({ changePct: board.avgChangePct })
  const contentWidth = WIDTH - PAD * 2
  paintInnerShade(ctx, accent)
  ctx.textBaseline = 'middle'

  const count = `${board.count} 只`
  const countWidth = measure(ctx, count, 26, MONO, 400)
  const label = fitText(ctx, board.label, 56, 34, SANS, 700, contentWidth - countWidth - GAP)

  ctx.fillStyle = '#ecf5ff'
  ctx.font = `700 ${label.size}px ${SANS}`
  ctx.fillText(label.text, PAD, 92)

  ctx.font = `400 26px ${MONO}`
  ctx.fillStyle = '#8ba4c5'
  ctx.fillText(count, WIDTH - countWidth - PAD, 94)

  const pct = board.count === 0 ? '—' : formatPct(board.avgChangePct)
  const breadth = board.count === 0 ? '暂无标的' : `涨 ${board.up} · 跌 ${board.down}`
  const scale = fitScale(
    ctx,
    [
      { text: pct, size: 62, family: MONO },
      { text: breadth, size: 26, family: MONO, weight: 400 },
    ],
    contentWidth,
    0.66,
  )
  const pctSize = Math.round(62 * scale)
  const breadthSize = Math.round(26 * scale)

  ctx.font = `700 ${pctSize}px ${MONO}`
  ctx.fillStyle = accent
  ctx.fillText(pct, PAD, 190)

  ctx.font = `400 ${breadthSize}px ${MONO}`
  ctx.fillStyle = '#8ba4c5'
  ctx.fillText(breadth, WIDTH - measure(ctx, breadth, breadthSize, MONO, 400) - PAD, 192)

  ctx.fillStyle = '#7f97b7'
  ctx.font = `400 24px ${MONO}`
  const leader = board.leader
  const hint =
    board.count === 0
      ? '点击查看空板块'
      : leader
        ? `领涨 ${leader.name} ${formatPct(leader.changePct)}`
        : `成交 ${formatAmount(board.turnover)}`
  const fitted = fitText(ctx, hint, 24, 18, MONO, 400, contentWidth)
  ctx.font = `400 ${fitted.size}px ${MONO}`
  ctx.fillText(fitted.text, PAD, 264)

  return finalize(canvas)
}
