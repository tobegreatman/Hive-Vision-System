import { describe, expect, it } from 'vitest'

import { axialToWorld, hexLayout, hexRing, hiveExtent } from './hex'

const NEIGHBOR_SPACING = Math.sqrt(3)

describe('axialToWorld', () => {
  it('中心点落在原点', () => {
    expect(axialToWorld(0, 0, 2)).toEqual({ x: 0, z: 0 })
  })

  it('X 向步长为 √3·r，Z 向步长为 1.5·r', () => {
    const right = axialToWorld(1, 0, 2)
    expect(right.x).toBeCloseTo(Math.sqrt(3) * 2)
    expect(right.z).toBeCloseTo(0)

    const down = axialToWorld(0, 1, 2)
    expect(down.x).toBeCloseTo(Math.sqrt(3) * 2 * 0.5)
    expect(down.z).toBeCloseTo(3)
  })
})

describe('hexRing', () => {
  it('环 0 只有中心一格', () => {
    expect(hexRing(0, 1)).toEqual([{ x: 0, z: 0 }])
  })

  it('环 n 有 6n 格且互不重复', () => {
    for (const ring of [1, 2, 3]) {
      const points = hexRing(ring, 1)
      expect(points).toHaveLength(ring * 6)
      const unique = new Set(points.map((point) => `${point.x.toFixed(4)}:${point.z.toFixed(4)}`))
      expect(unique.size).toBe(points.length)
    }
  })

  it('同环相邻格子的中心距恒等于外接圆半径的 √3 倍', () => {
    const points = hexRing(2, 1)
    const distances = points.map((point, index) => {
      const next = points[(index + 1) % points.length]
      if (!next) throw new Error('环上取点失败')
      return Math.hypot(next.x - point.x, next.z - point.z)
    })
    for (const distance of distances) {
      expect(distance).toBeCloseTo(NEIGHBOR_SPACING, 5)
    }
  })
})

describe('hexLayout', () => {
  it('任意数量都能给出等量落点', () => {
    for (const count of [1, 2, 5, 7, 9, 13, 16, 20]) {
      expect(hexLayout(count, 1)).toHaveLength(count)
    }
  })

  it('0 与负数返回空数组', () => {
    expect(hexLayout(0, 1)).toEqual([])
    expect(hexLayout(-3, 1)).toEqual([])
  })

  it('第一格永远是中心', () => {
    expect(hexLayout(9, 1.4)[0]).toEqual({ x: 0, z: 0 })
  })

  it('落点互不重合，且相邻中心距不小于 √3·r', () => {
    const radius = 1.4
    const points = hexLayout(9, radius)
    const unique = new Set(points.map((point) => `${point.x.toFixed(4)}:${point.z.toFixed(4)}`))
    expect(unique.size).toBe(points.length)

    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const a = points[i]
        const b = points[j]
        if (!a || !b) throw new Error('取点失败')
        const distance = Math.hypot(a.x - b.x, a.z - b.z)
        expect(distance).toBeGreaterThanOrEqual(Math.sqrt(3) * radius - 1e-6)
      }
    }
  })

  it('7 格正好铺满中心 + 第一环', () => {
    const points = hexLayout(7, 1)
    const ring = hexRing(1, 1)
    expect(points.slice(1)).toEqual(ring)
  })

  it('末环不满时左右铺开，而不是挤在同一侧', () => {
    const points = hexLayout(9, 1)
    const last2 = points.slice(7)
    expect(last2).toHaveLength(2)
    const [first, second] = last2
    if (!first || !second) throw new Error('末环取点失败')
    // 均匀取样取到环上相对的两格：x 符号相反
    expect(Math.sign(first.x)).toBe(-Math.sign(second.x))
  })
})

describe('hiveExtent', () => {
  it('包含瓦片半径', () => {
    expect(hiveExtent([{ x: 0, z: 0 }], 2)).toBe(2)
  })

  it('随环数单调增大', () => {
    const small = hiveExtent(hexLayout(7, 1), 1)
    const large = hiveExtent(hexLayout(19, 1), 1)
    expect(large).toBeGreaterThan(small)
  })
})
