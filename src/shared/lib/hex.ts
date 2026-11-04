/**
 * 蜂巢布局（pointy-top hexagon，尖端朝 ±Z）。
 *
 * 坐标系与 `THREE.CylinderGeometry(r, r, h, 6)` 严格对应：
 * three 在 theta = 0 处把顶点放在 +Z（x = r·sinθ、z = r·cosθ），
 * 因此六边形在 X 方向的宽度是 √3·r、在 Z 方向的高度是 2·r。
 *
 * 于是相邻中心间距为：X = √3·r，Z = 1.5·r，
 * 用轴向坐标 (q, r) 表达即：
 *   x = √3 · r · (q + r / 2)
 *   z = 1.5 · r · r
 *
 * 布局采用同心环填充：环 0 是中心，环 n 有 6n 个格子。
 * 最后一环若装不满，就把剩余格子均匀撒在整环上，避免视觉上一侧堆叠。
 */

export interface HexPoint {
  /** 世界坐标 X */
  x: number
  /** 世界坐标 Z */
  z: number
}

/** 轴向坐标 → 世界坐标（pointy-top）。 */
export function axialToWorld(q: number, r: number, radius: number): HexPoint {
  return {
    x: Math.sqrt(3) * radius * (q + r / 2),
    z: 1.5 * radius * r,
  }
}

const CUBE_DIRECTIONS = [
  { x: 1, y: -1, z: 0 },
  { x: 1, y: 0, z: -1 },
  { x: 0, y: 1, z: -1 },
  { x: -1, y: 1, z: 0 },
  { x: -1, y: 0, z: 1 },
  { x: 0, y: -1, z: 1 },
] as const

/** 第 ring 环上的全部格子（环 0 返回中心 1 格），顺序沿边顺时针。 */
export function hexRing(ring: number, radius: number): HexPoint[] {
  if (ring <= 0) return [{ x: 0, z: 0 }]

  const points: HexPoint[] = []
  let cube = {
    x: CUBE_DIRECTIONS[4].x * ring,
    y: CUBE_DIRECTIONS[4].y * ring,
    z: CUBE_DIRECTIONS[4].z * ring,
  }

  for (const direction of CUBE_DIRECTIONS) {
    for (let step = 0; step < ring; step += 1) {
      points.push(axialToWorld(cube.x, cube.z, radius))
      cube = {
        x: cube.x + direction.x,
        y: cube.y + direction.y,
        z: cube.z + direction.z,
      }
    }
  }

  return points
}

/**
 * 生成 count 个格子的蜂巢落点：从中心往外一环环铺。
 * 最后一环不满时均匀取样，保证左右对称、不会挤在角落。
 */
export function hexLayout(count: number, radius: number): HexPoint[] {
  if (count <= 0) return []
  const points: HexPoint[] = [{ x: 0, z: 0 }]

  for (let ring = 1; points.length < count; ring += 1) {
    const ringPoints = hexRing(ring, radius)
    const remaining = count - points.length
    if (remaining >= ringPoints.length) {
      points.push(...ringPoints)
      continue
    }
    // 均匀取样：slot 严格递增，因此不会取到重复格子
    for (let index = 0; index < remaining; index += 1) {
      const slot = Math.floor((index * ringPoints.length) / remaining)
      const point = ringPoints[slot]
      if (point) points.push(point)
    }
  }

  if (points.length > count) points.length = count
  return points
}

/** 蜂巢的外接半径，用于把相机拉到刚好装下的距离。 */
export function hiveExtent(points: readonly HexPoint[], radius: number): number {
  return points.reduce((max, point) => Math.max(max, Math.hypot(point.x, point.z)), 0) + radius
}
