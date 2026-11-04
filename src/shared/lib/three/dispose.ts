import type { Object3D } from 'three'
import { Texture } from 'three'
import type { BufferGeometry, Material } from 'three'

export interface DisposeReport {
  geometries: number
  materials: number
  textures: number
}

interface Drawable {
  geometry?: BufferGeometry
  material?: Material | Material[]
}

function disposeMaterial(material: Material, report: DisposeReport): void {
  for (const value of Object.values(material)) {
    if (value instanceof Texture) {
      value.dispose()
      report.textures += 1
    }
  }
  material.dispose()
  report.materials += 1
}

/**
 * 显式释放 GPU 资源。Three.js 不会在组件卸载时自动回收，
 * 每次场景重建（热更新、路由切换）都必须调用，否则显存持续增长。
 * 用「有没有 geometry + material」来判断，可同时覆盖 Mesh / Sprite / Line / Points。
 */
export function disposeObjectTree(root: Object3D | null | undefined): DisposeReport {
  const report: DisposeReport = { geometries: 0, materials: 0, textures: 0 }
  if (!root) return report

  root.traverse((node) => {
    const drawable = node as unknown as Drawable
    if (!drawable.geometry || !drawable.material) return

    drawable.geometry.dispose()
    report.geometries += 1

    const materials = Array.isArray(drawable.material) ? drawable.material : [drawable.material]
    for (const material of materials) {
      if (material) disposeMaterial(material, report)
    }
  })

  return report
}

/** 浏览器丢失 WebGL 上下文（移动端切后台、GPU 重置）时的兜底。 */
export function releaseRendererContext(canvas: HTMLCanvasElement | null): void {
  if (!canvas) return
  const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
  gl?.getExtension('WEBGL_lose_context')?.loseContext()
}
