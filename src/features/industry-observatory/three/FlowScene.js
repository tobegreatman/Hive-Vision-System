/**
 * 3D 资金流观测台
 *
 * 空间语法：
 *   半径  ── 层级（内环=申万一级，外环=二级），全样本恒定，刷新不跳位
 *   角度  ── 所属一级行业的扇区，宽度按成员数分配，使行业聚集可读
 *   高度  ── 带符号的资金强度（上=净流入，下=净流出，穿过地面）
 *   亮度  ── 强度分位，配合泛光形成视觉重量
 *   粒子  ── 方向即流向；内向汇聚=吸筹，外向逃逸=失血
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

const IN_COLOR = new THREE.Color('#ff3559')
const OUT_COLOR = new THREE.Color('#0fdc9b')
const FLAT_COLOR = new THREE.Color('#5f6b8a')
const ACCENT = new THREE.Color('#6d5cff')
const TAU = Math.PI * 2

const R_INNER = 9.8
const R_MID = 13.7
const R_OUTER = 17.6
const GROUND_R = 26

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const lerp = (a, b, t) => a + (b - a) * t
const easeOutCubic = (t) => 1 - (1 - t) ** 3

/* ── 拾取辅助（屏幕空间，复用临时向量避免 GC） ───────── */
const _pickA = new THREE.Vector3()
const _pickB = new THREE.Vector3()
const _pickC = new THREE.Vector3()

// 点到线段的平方距离（像素空间）
const distToSegmentSq = (px, py, ax, ay, bx, by) => {
  const vx = bx - ax
  const vy = by - ay
  const wx = px - ax
  const wy = py - ay
  const len2 = vx * vx + vy * vy
  let t = len2 > 1e-6 ? (wx * vx + wy * vy) / len2 : 0
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const dx = px - (ax + vx * t)
  const dy = py - (ay + vy * t)
  return dx * dx + dy * dy
}

/* ── 着色器 ───────────────────────────────────────────── */

const TOWER_VERT = /* glsl */ `
  attribute vec2 aParam;      // x: 强度 0..1   y: 层级
  attribute float aSel;       // 1 = 当前选中
  varying vec3 vColor;
  varying float vSel;
  varying float vY;
  varying float vPulse;
  void main() {
    vY = position.y + 0.5;
    #ifdef USE_INSTANCING_COLOR
      vColor = instanceColor;
    #else
      vColor = vec3(0.4);
    #endif
    vPulse = aParam.x;
    vSel = aSel;
    #ifdef USE_INSTANCING
      vec4 wp = instanceMatrix * vec4(position, 1.0);
    #else
      vec4 wp = vec4(position, 1.0);
    #endif
    gl_Position = projectionMatrix * modelViewMatrix * wp;
  }
`

const TOWER_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vY;
  varying float vPulse;
  varying float vSel;
  uniform float uTime;
  uniform float uDim;
  uniform float uBoost;
  void main() {
    float grad = pow(clamp(vY, 0.0, 1.0), 0.72);
    vec3 base = vColor * 0.07;
    vec3 body = mix(base, vColor, grad);
    // 顶端高光，作为泛光的种子
    float tip = pow(clamp(vY, 0.0, 1.0), 9.0);
    float breathe = 0.85 + 0.15 * sin(uTime * 1.6 + vPulse * 9.0);
    vec3 col = body + vColor * tip * 0.85 * breathe;
    col *= (1.0 + uBoost + vSel * 1.6);
    col = mix(col, col * 0.10 + vec3(0.02, 0.03, 0.05), uDim);
    gl_FragColor = vec4(col, 1.0);
  }
`

const PARTICLE_VERT = /* glsl */ `
  attribute vec3 aStart;
  attribute vec3 aDir;
  attribute float aSpeed;
  attribute float aOffset;
  attribute float aSize;
  attribute float aTravel;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float t = fract(aOffset + uTime * aSpeed);
    // 螺旋推进，避免粒子沿直线呆板移动
    float swirl = t * 2.4 + aOffset * 40.0;
    vec3 pos = aStart + aDir * (t * aTravel);
    pos.x += sin(swirl) * 0.35 * t;
    pos.z += cos(swirl) * 0.35 * t;
    pos.y += sin(t * 3.14159) * 0.8;
    vAlpha = sin(t * 3.14159) * 0.9;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * uPixelRatio * (72.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`

const PARTICLE_FRAG = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    if (r > 0.5) discard;
    float a = smoothstep(0.5, 0.05, r) * vAlpha;
    gl_FragColor = vec4(vColor * 0.95, a * 0.5);
  }
`

const ARC_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const ARC_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uPhase;
  void main() {
    float pulse = fract(vUv.x - uTime * 0.18 + uPhase);
    float head = smoothstep(0.82, 1.0, 1.0 - pulse) * step(pulse, 0.35);
    float base = 0.16 + 0.3 * sin(vUv.x * 12.0 - uTime * 2.0) * 0.5 + 0.15;
    float a = clamp(base + head * 1.6, 0.0, 1.0);
    gl_FragColor = vec4(uColor * (0.5 + head * 2.4), a * 0.55);
  }
`

/* ── 主体 ─────────────────────────────────────────────── */

export class FlowScene {
  constructor(container, { onHover, onSelect } = {}) {
    this.container = container
    this.onHover = onHover
    this.onSelect = onSelect
    this.payload = null
    this.items = []
    this.hovered = null
    this.selected = null
    this.time = 0
    this.intro = 0
    this.dim = 0

    this._initRenderer()
    this._initScene()
    this._initControls()
    this._initTowers()
    this._initParticles()
    this._initGround()
    this._initCenter()
    this._initPicking()

    this.clock = new THREE.Clock()
    this._animate = this._animate.bind(this)
    this._raf = requestAnimationFrame(this._animate)
    this._onResize = this._resize.bind(this)
    window.addEventListener('resize', this._onResize)
  }

  _initRenderer() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(w, h)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 0.92
    this.renderer.setClearColor(0x04060e, 1)
    this.container.appendChild(this.renderer.domElement)

    this.labelRenderer = new CSS2DRenderer()
    this.labelRenderer.setSize(w, h)
    Object.assign(this.labelRenderer.domElement.style, {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
      overflow: 'hidden',
    })
    this.container.appendChild(this.labelRenderer.domElement)
  }

  _initScene() {
    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.FogExp2(0x04060e, 0.0105)

    this.camera = new THREE.PerspectiveCamera(46, this.container.clientWidth / this.container.clientHeight, 0.1, 500)
    this.camera.position.set(0, 25, 42)

    this.scene.add(new THREE.AmbientLight(0x8494c8, 1.35))
    const key = new THREE.DirectionalLight(0xffffff, 1.1)
    key.position.set(12, 26, 16)
    this.scene.add(key)
    const rim = new THREE.PointLight(0x5b4dff, 90, 90)
    rim.position.set(0, 4, 0)
    this.scene.add(rim)

    // 星尘背景
    const starGeo = new THREE.BufferGeometry()
    const n = 1400
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const r = 46 + Math.random() * 90
      const th = Math.random() * TAU
      const ph = Math.acos(Math.random() * 1.6 - 0.6)
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th)
      pos[i * 3 + 1] = r * Math.cos(ph) * 0.7
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th)
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0x7f93c8, size: 0.28, transparent: true, opacity: 0.38, depthWrite: false })
    )
    this.scene.add(this.stars)

    // 修正 composer 的 render pass（scene 创建后才可用）
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(this.container.clientWidth, this.container.clientHeight),
      0.52,
      0.45,
      0.44
    )
    this.composer.addPass(this.bloom)
    this.composer.addPass(new OutputPass())
  }

  _initControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.055
    this.controls.minDistance = 11
    this.controls.maxDistance = 92
    this.controls.minPolarAngle = 0.18
    this.controls.maxPolarAngle = Math.PI * 0.495
    this.controls.autoRotate = true
    this.controls.autoRotateSpeed = 0.32
    this.controls.target.set(0, 1.2, 0)
    this.controls.enablePan = false
  }

  _initTowers() {
    const geo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, false)
    // 每个实例的派生参数：强度 / 层级
    const param = new THREE.InstancedBufferAttribute(new Float32Array(600 * 2), 2)
    param.setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('aParam', param)

    const sel = new THREE.InstancedBufferAttribute(new Float32Array(600), 1)
    sel.setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('aSel', sel)

    const mat = new THREE.ShaderMaterial({
      vertexShader: TOWER_VERT,
      fragmentShader: TOWER_FRAG,
      uniforms: { uTime: { value: 0 }, uDim: { value: 0 }, uBoost: { value: 0 } },
    })

    this.towerMesh = new THREE.InstancedMesh(geo, mat, 600)
    this.towerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.towerMesh.count = 0
    this.towerMesh.frustumCulled = false
    this.scene.add(this.towerMesh)
  }

  _initParticles() {
    const MAX = 9000
    const geo = new THREE.BufferGeometry()
    const attr = (name, size) => {
      const a = new THREE.BufferAttribute(new Float32Array(MAX * size), size)
      a.setUsage(THREE.DynamicDrawUsage)
      geo.setAttribute(name, a)
      return a
    }
    attr('position', 3)
    this.pStart = attr('aStart', 3)
    this.pDir = attr('aDir', 3)
    this.pSpeed = attr('aSpeed', 1)
    this.pOffset = attr('aOffset', 1)
    this.pSize = attr('aSize', 1)
    this.pTravel = attr('aTravel', 1)
    this.pColor = attr('aColor', 3)

    geo.setDrawRange(0, 0)
    this.particleGeo = geo

    const mat = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    this.particles = new THREE.Points(geo, mat)
    this.particles.frustumCulled = false
    this.scene.add(this.particles)
  }

  _initGround() {
    this.groundGroup = new THREE.Group()
    this.scene.add(this.groundGroup)

    // 极坐标网格
    const gridMat = new THREE.LineBasicMaterial({ color: 0x46558a, transparent: true, opacity: 0.6 })
    for (const r of [3.4, 6.2, 8.2, R_INNER, 13.2, R_OUTER, 20.6, GROUND_R]) {
      const pts = []
      for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * TAU
        pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r))
      }
      this.groundGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat))
    }
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * TAU
      const strong = i % 3 === 0
      const m = new THREE.LineBasicMaterial({
        color: strong ? 0x51629a : 0x33405f,
        transparent: true,
        opacity: strong ? 0.45 : 0.22,
      })
      const pts = [new THREE.Vector3(Math.cos(a) * 3.2, 0, Math.sin(a) * 3.2), new THREE.Vector3(Math.cos(a) * GROUND_R, 0, Math.sin(a) * GROUND_R)]
      this.groundGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), m))
    }

    // 地面圆盘（半透明，让地下柱体透出）
    const discMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        varying vec2 vP; uniform float uTime;
        void main(){
          float r = length(vP) / ${GROUND_R.toFixed(1)};
          float a = (1.0 - smoothstep(0.55, 1.0, r)) * 0.14;
          float sweep = 0.06 * smoothstep(0.0, 0.4, smoothstep(0.02, 0.0, abs(fract(atan(vP.y, vP.x)/6.2831 + uTime*0.02) - 0.5) - 0.44));
          vec3 c = mix(vec3(0.03,0.05,0.12), vec3(0.10,0.13,0.28), 1.0 - r);
          gl_FragColor = vec4(c, a + sweep);
        }`,
    })
    const disc = new THREE.Mesh(new THREE.CircleGeometry(GROUND_R, 96), discMat)
    disc.rotation.x = -Math.PI / 2
    disc.position.y = -0.01
    this.groundGroup.add(disc)
    this.discMat = discMat

    // 行业扇区带
    this.sectorGroup = new THREE.Group()
    this.scene.add(this.sectorGroup)
  }

  _initCenter() {
    this.centerGroup = new THREE.Group()
    this.scene.add(this.centerGroup)

    const coreMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uTone: { value: new THREE.Color('#ff3559') }, uPower: { value: 0.6 } },
      vertexShader: `varying vec3 vN; varying vec3 vV; varying vec2 vUv;
        void main(){ vUv = uv; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vN; varying vec3 vV; varying vec2 vUv; uniform float uTime; uniform vec3 uTone; uniform float uPower;
        void main(){
          float fres = pow(1.0 - abs(dot(vN, vV)), 2.2);
          float band = 0.5 + 0.5 * sin(vUv.y * 26.0 - uTime * 2.4);
          vec3 c = uTone * (0.4 + fres * 2.2) + vec3(0.36,0.42,0.95) * fres * 0.55;
          gl_FragColor = vec4(c * (0.45 + uPower * 0.4), 0.12 + fres * 0.5 * uPower + band * 0.04);
        }`,
    })
    this.core = new THREE.Mesh(new THREE.SphereGeometry(1.9, 48, 48), coreMat)
    this.core.position.y = 1.6
    this.centerGroup.add(this.core)
    this.coreMat = coreMat

    const ringMat = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })
    this.rings = []
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4 + i * 0.7, 0.013, 8, 128), ringMat.clone())
      ring.rotation.x = Math.PI / 2 + i * 0.22
      ring.rotation.z = i * 0.5
      ring.position.y = 1.6
      this.centerGroup.add(ring)
      this.rings.push(ring)
    }

    // 中心光柱
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.34, 10, 24, 1, true),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uColor: { value: new THREE.Color('#7b6bff') } },
        vertexShader: `varying float vY; void main(){ vY = position.y + 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `varying float vY; uniform vec3 uColor; void main(){ float a = pow(1.0 - vY, 3.6) * 0.07; gl_FragColor = vec4(uColor, a); }`,
      })
    )
    beam.position.y = 6.2
    this.beam = beam

    this.marker = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.028, 8, 64),
      new THREE.MeshBasicMaterial({ color: 0xa79bff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    )
    this.marker.rotation.x = -Math.PI / 2
    this.marker.visible = false
    this.centerGroup.add(this.marker)
  }

  _initPicking() {
    this.pointer = new THREE.Vector2(-10, -10)
    this._pointerInside = false
    this._hx = 0
    this._hy = 0
    this._vw = 0
    this._vh = 0
    this._pickDirty = false
    this._lastCamPos = null
    this._lastCamQuat = null

    const el = this.renderer.domElement
    const track = (e) => {
      const rect = el.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      this._hx = e.clientX - rect.left
      this._hy = e.clientY - rect.top
      this._vw = rect.width
      this._vh = rect.height
      this._pointerInside = true
      this._pickDirty = true
    }

    el.addEventListener('pointermove', track)
    el.addEventListener('pointerdown', (e) => {
      this._downAt = performance.now()
      this._downPos = { x: e.clientX, y: e.clientY }
      // 触屏不会先发 pointermove，按下时同步一次指针，否则点击拾取用的是旧坐标
      track(e)
      this._pick()
    })
    el.addEventListener('pointerup', (e) => {
      if (performance.now() - (this._downAt || 0) > 420) return
      const d = this._downPos
      // 拖拽旋转不应触发选中
      if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return
      if (e.pointerType !== 'mouse') track(e)
      this._pick()
      // 点「已高亮的那根柱」，所见即所得
      this.onSelect?.(this.hovered || null)
    })
    el.addEventListener('pointerleave', () => {
      this._pointerInside = false
      this.pointer.set(-10, -10)
      this._setHover(null)
    })
  }

  /**
   * 屏幕空间拾取。
   *
   * 柱体很细（三级柱半径仅 0.115 世界单位，默认镜头下宽约 5px），
   * 直接对 InstancedMesh 打射线几乎点不中，因此改为：
   *   1) 把柱轴线段（地面 → 柱尖）投影到屏幕，算鼠标到该线段的像素距离；
   *   2) 命中半径 = 像素容差 + 柱体自身半宽投影，细柱自动获得宽容差、粗柱按实际体积判定；
   *   3) 多个候选时先看「距离/半径」的归一化得分（越居中越优先），
   *      得分接近时取离相机更近的一根，符合遮挡直觉。
   */
  _pickId({ extraPx = 0, only = null } = {}) {
    if (!this.items.length || !this._pointerInside) return null
    const cam = this.camera
    const vw = this._vw || this.container.clientWidth
    const vh = this._vh || this.container.clientHeight
    if (!vw || !vh) return null
    cam.updateMatrixWorld()

    const px = this._hx
    const py = this._hy
    // 容差随视口高度微调：小窗口少给几像素，大屏多给一点
    const tol = clamp(vh * 0.014, 8, 18) + extraPx
    const camDist = cam.position.distanceTo(this.controls.target) || 48
    // 每世界单位对应多少屏幕像素（以注视点为基准；外环略偏宽松，可接受）
    const pxPerUnit = vh / (2 * camDist * Math.tan((cam.fov * Math.PI) / 360))

    let best = null
    for (const it of this.items) {
      if (only && it.node.id !== only) continue
      const cx = Math.cos(it.angle) * it.radius
      const cz = Math.sin(it.angle) * it.radius
      const tipY = it.direction > 0 ? it.height : -it.height

      _pickC.set(cx, tipY * 0.5, cz)
      const depth = cam.position.distanceToSquared(_pickC)

      _pickA.set(cx, 0, cz).project(cam)
      _pickB.set(cx, tipY, cz).project(cam)
      const ax = (_pickA.x * 0.5 + 0.5) * vw
      const ay = (-_pickA.y * 0.5 + 0.5) * vh
      const bx = (_pickB.x * 0.5 + 0.5) * vw
      const by = (-_pickB.y * 0.5 + 0.5) * vh

      const radius = tol + (it.width ?? 0.16) * pxPerUnit
      const d2 = distToSegmentSq(px, py, ax, ay, bx, by)
      if (!(d2 <= radius * radius)) continue
      const d = Math.sqrt(d2)

      // 屏幕距离优先（指哪打哪）；只有距离几乎相同（<0.75px）时才按离相机远近决定遮挡
      if (!best || d < best.d - 0.75 || (d < best.d + 0.75 && depth < best.depth)) {
        best = { id: it.node.id, d, depth }
      }
    }
    return best ? best.id : null
  }

  _pick() {
    // 先按实际容差找；落空时对当前悬停柱再多给 4px，避免边缘处 hover 反复熄灭
    let id = this._pickId()
    if (!id && this.hovered) id = this._pickId({ extraPx: 4, only: this.hovered })
    this._setHover(id)
  }

  /** 相机或指针变化时才重算拾取：场景在自转，hover 必须跟着转，否则会指向已经转走的柱体 */
  _syncPick() {
    if (!this._pointerInside || !this.items.length) return
    const cam = this.camera
    const dirty =
      this._pickDirty ||
      !this._lastCamPos ||
      cam.position.distanceToSquared(this._lastCamPos) > 1e-4 ||
      1 - Math.abs(cam.quaternion.dot(this._lastCamQuat)) > 1e-7
    if (!dirty) return
    if (!this._lastCamPos) {
      this._lastCamPos = cam.position.clone()
      this._lastCamQuat = cam.quaternion.clone()
    } else {
      this._lastCamPos.copy(cam.position)
      this._lastCamQuat.copy(cam.quaternion)
    }
    this._pickDirty = false
    this._pick()
  }

  _setHover(id) {
    if (this.hovered === id) return
    this.hovered = id
    this.container.style.cursor = id ? 'pointer' : 'grab'
    this.onHover?.(id)
  }

  /* ── 数据装配 ──────────────────────────────────────── */

  setData(payload, { animate = true } = {}) {
    const prevH = new Map(this.items.map((it) => [it.node.id, it.height]))
    this.payload = payload
    const nodes = payload.nodes
    const groups = payload.groups

    // 扇区分配：按二级成员数开方加权，避免大行业挤压小行业
    const weights = groups.map((g) => (g.subs || g.counts?.[2] || g.members || 1) ** 0.78)
    const wSum = weights.reduce((a, b) => a + b, 0) || 1
    const byGroup = new Map(groups.map((g) => [g.group, []]))
    for (const n of nodes) {
      if (!byGroup.has(n.group)) byGroup.set(n.group, [])
      byGroup.get(n.group).push(n)
    }

    let cursor = -Math.PI / 2
    const items = []
    this.groupAngles = []

    groups.forEach((g, gi) => {
      const span = (weights[gi] / wSum) * TAU
      const start = cursor
      cursor += span
      this.groupAngles.push({ group: g.group, start, span, net: g.net })

      const members = (byGroup.get(g.group) || []).slice().sort((a, b) => Math.abs(b.net || 0) - Math.abs(a.net || 0))
      // 三层各占一圈：内环一级（统计总体）、中环二级（可加总）、外环三级（细分，二级子集）
      const l1 = members.find((n) => n.level === 1)
      const l2s = members.filter((n) => n.level === 2)
      const l3s = members.filter((n) => n.level === 3)

      const place = (node, radius, angle, level) => {
        const h = node.visual?.h ?? 0
        const mag = Math.abs(h)
        const height = level === 1 ? 2.0 + mag * 7.2 : level === 2 ? 0.34 + mag * 3.4 : 0.2 + mag * 2.2
        const width = level === 1 ? 0.52 : level === 2 ? 0.19 : 0.115
        const isUp = h >= 0
        const y = isUp ? height / 2 : -height / 2
        const direction = isUp ? 1 : -1
        const color = new THREE.Color()
        const tone = isUp ? IN_COLOR : OUT_COLOR
        const sat = clamp(mag * 2.6, 0.06, 1)
        color.copy(FLAT_COLOR).lerp(tone, sat)
        const lum = (level === 3 ? 0.26 : 0.34) + 0.66 * (node.visual?.glow ?? 0)
        color.multiplyScalar(lum)
        return {
          node,
          angle,
          radius,
          y,
          height,
          width,
          direction,
          color,
          level,
          isL1: level === 1,
        }
      }

      if (l1) items.push(place(l1, R_INNER, start + span / 2, 1))

      const subSpan = span * 0.9
      const ring = (list, baseR, level, jitter) => {
        list.forEach((node, i) => {
          const t = list.length <= 1 ? 0.5 : i / (list.length - 1)
          const angle = start + span / 2 + (t - 0.5) * subSpan
          // 沿半径轻微错落，形成密度带；同一圈内不换层，避免层级被视觉抹平
          const radius = baseR + (jitter && i % 2 === 0 ? 0 : jitter) + ((i * 0.37) % 0.42)
          items.push(place(node, radius, angle, level))
        })
      }
      ring(l2s, R_MID, 2, 0.62)
      ring(l3s, R_OUTER, 3, 0.5)
    })

    this.items = items
    // 记录上一帧高度，使刷新时柱体平滑过渡而非硬跳
    for (const it of items) it.prevH = prevH.get(it.node.id) ?? 0
    this._writeInstances(items)
    this._buildSectors()
    this._buildArcs(payload.arcs)
    this._buildLabels(items)
    this._buildParticles(items)
    this._updateCenter(payload.kpi)

    if (animate) this.intro = 0
    else this.intro = 1
    this._applyFocus()
    this._startIntro = performance.now()
    // 数据换了一批，柱体位置/高度都变了，悬停需要重新判定
    this._pickDirty = true
  }

  _writeInstances(items) {
    const mesh = this.towerMesh
    mesh.count = items.length
    const param = mesh.geometry.getAttribute('aParam')
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const pos = new THREE.Vector3()
    const scale = new THREE.Vector3()

    items.forEach((it, i) => {
      const grow = it.growth ?? 1
      const w = it.width ?? (it.isL1 ? 0.52 : 0.16)
      pos.set(Math.cos(it.angle) * it.radius, it.y * grow, Math.sin(it.angle) * it.radius)
      scale.set(w, Math.max(0.001, it.height * grow), w)
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -it.angle)
      m.compose(pos, q, scale)
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, it.color)
      param.setXY(i, it.node.visual?.glow ?? 0, it.level === 1 ? 1 : it.level === 2 ? 0.55 : 0.25)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    param.needsUpdate = true
  }

  _buildSectors() {
    while (this.sectorGroup.children.length) {
      const c = this.sectorGroup.children.pop()
      c.geometry?.dispose()
      c.material?.dispose()
    }
    const maxAbs = Math.max(...this.groupAngles.map((g) => Math.abs(g.net)), 1)
    this.groupAngles.forEach((g) => {
      const ring = new THREE.RingGeometry(7.35, 8.15, 32, 1, g.start, g.span * 0.97)
      const t = g.net / maxAbs
      const col = new THREE.Color().copy(FLAT_COLOR).lerp(t >= 0 ? IN_COLOR : OUT_COLOR, clamp(Math.abs(t) * 1.8, 0.08, 1))
      const mesh = new THREE.Mesh(
        ring,
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.16 + Math.abs(t) * 0.42, side: THREE.DoubleSide, depthWrite: false })
      )
      mesh.rotation.x = -Math.PI / 2
      mesh.position.y = 0.03
      this.sectorGroup.add(mesh)
    })
  }

  _buildArcs(arcs) {
    if (this.arcGroup) {
      this.scene.remove(this.arcGroup)
      this.arcGroup.traverse((o) => {
        o.geometry?.dispose()
        o.material?.dispose()
      })
    }
    this.arcGroup = new THREE.Group()
    this.scene.add(this.arcGroup)
    if (!arcs?.length) return

    const byId = new Map(this.items.map((it) => [it.node.id, it]))
    arcs.forEach((arc, i) => {
      const a = byId.get(arc.from)
      const b = byId.get(arc.to)
      if (!a || !b) return
      const pa = new THREE.Vector3(Math.cos(a.angle) * a.radius, Math.max(a.height, 0.6) + 0.4, Math.sin(a.angle) * a.radius)
      const pb = new THREE.Vector3(Math.cos(b.angle) * b.radius, Math.max(b.height, 0.6) + 0.4, Math.sin(b.angle) * b.radius)
      const mid = pa.clone().add(pb).multiplyScalar(0.5)
      mid.y = Math.max(pa.y, pb.y) + 3.4 + arc.weight * 5
      const curve = new THREE.QuadraticBezierCurve3(pa, mid, pb)
      const geo = new THREE.TubeGeometry(curve, 48, 0.018 + arc.weight * 0.05, 5, false)
      const mat = new THREE.ShaderMaterial({
        vertexShader: ARC_VERT,
        fragmentShader: ARC_FRAG,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(i % 2 === 0 ? '#ff5470' : '#8f7bff') },
          uPhase: { value: Math.random() },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      this.arcGroup.add(new THREE.Mesh(geo, mat))
    })
  }

  _buildLabels(items) {
    if (this.labelGroup) {
      this.scene.remove(this.labelGroup)
      this.labelGroup.traverse((o) => o.element?.remove())
    }
    this.labelGroup = new THREE.Group()
    this.scene.add(this.labelGroup)
    this.labelMap = new Map()

    const l1 = items.filter((it) => it.isL1)
    // 只常驻展示最强的一批标签，其余按需在悬停/选中时出现，避免内环文字互相遮挡
    const strongIds = new Set(
      l1
        .filter((it) => (it.node.net ?? 0) > 0)
        .slice()
        .sort((a, b) => (b.node.net ?? 0) - (a.node.net ?? 0))
        .slice(0, 3)
        .map((it) => it.node.id)
    )

    const strongSorted = l1
      .filter((it) => strongIds.has(it.node.id))
      .sort((a, b) => a.angle - b.angle)
    const bandOf = new Map(strongSorted.map((it, i) => [it.node.id, i % 2 === 0 ? -1.7 : 2.4]))

    l1.forEach((it) => {
      const el = document.createElement('div')
      el.className = 'node-label' + (strongIds.has(it.node.id) ? ' is-strong' : '')
      const val = it.node.net ?? 0
      const sign = val >= 0 ? '+' : '−'
      const abs = Math.abs(val)
      const txt = abs >= 1e8 ? `${(abs / 1e8).toFixed(1)}亿` : `${(abs / 1e4).toFixed(0)}万`
      el.innerHTML = `<span class="nl-name">${it.node.name}</span><span class="nl-val ${val >= 0 ? 'up' : 'down'}">${sign}${txt}</span>`
      const obj = new CSS2DObject(el)
      const y = it.height + 0.95
      const lr = it.radius + (bandOf.get(it.node.id) ?? 0.8)
      obj.position.set(Math.cos(it.angle) * lr, y, Math.sin(it.angle) * lr)
      obj.visible = strongIds.has(it.node.id)
      this.labelGroup.add(obj)
      obj.userData.strong = strongIds.has(it.node.id)
      this.labelMap.set(it.node.id, obj)
    })
  }

  _buildParticles(items) {
    const geo = this.particleGeo
    let count = 0
    const MAX = 9000
    const tmp = new THREE.Vector3()

    for (const it of items) {
      const glow = it.node.visual?.glow ?? 0
      if (glow < 0.12) continue
      const k = Math.min(16, Math.round(2 + glow * 15))
      if (count + k >= MAX) break
      const tipY = it.direction > 0 ? it.height + 0.3 : -it.height - 0.3
      const outward = it.direction < 0
      for (let i = 0; i < k; i++) {
        tmp.set(Math.cos(it.angle) * it.radius, tipY, Math.sin(it.angle) * it.radius)
        this.pStart.setXYZ(count, tmp.x, tmp.y, tmp.z)
        const dirX = outward ? Math.cos(it.angle) : -Math.cos(it.angle)
        const dirZ = outward ? Math.sin(it.angle) : -Math.sin(it.angle)
        this.pDir.setXYZ(count, dirX * 0.85, outward ? 0.55 : -0.25, dirZ * 0.85)
        this.pSpeed.setX(count, 0.05 + Math.random() * 0.09)
        this.pOffset.setX(count, Math.random())
        this.pSize.setX(count, 1.15 + glow * 2.4 + Math.random() * 1.1)
        this.pTravel.setX(count, outward ? 5.4 + glow * 3.2 : it.radius * 0.72)
        this.pColor.setXYZ(count, it.color.r, it.color.g, it.color.b)
        count++
      }
    }

    for (const a of ['aStart', 'aDir', 'aSpeed', 'aOffset', 'aSize', 'aTravel', 'aColor']) {
      geo.getAttribute(a).needsUpdate = true
    }
    geo.setDrawRange(0, count)
    this.particleCount = count
  }

  _updateCenter(kpi) {
    const t = clamp(kpi.netTotal / 1e11, -1, 1)
    const tone = new THREE.Color(t >= 0 ? '#ff3b63' : '#12e0a0').lerp(new THREE.Color('#ffffff'), 0.28)
    this.coreMat.uniforms.uTone.value.copy(tone)
    this.coreMat.uniforms.uPower.value = 0.35 + Math.abs(t) * 0.9
    this.rings.forEach((r, i) => {
      r.material.color.copy(tone).lerp(ACCENT, i * 0.3)
    })
    this.core.scale.setScalar(0.68 + Math.abs(t) * 0.3)
  }

  /* ── 交互 ─────────────────────────────────────────── */

  applySelection(id) {
    this.selected = id
    const item = id ? this.items.find((i) => i.node.id === id) : null
    const selAttr = this.towerMesh.geometry.getAttribute('aSel')
    const idx = item ? this.items.indexOf(item) : -1
    for (let i = 0; i < selAttr.count; i++) selAttr.setX(i, 0)
    if (idx >= 0) selAttr.setX(idx, 1)
    selAttr.needsUpdate = true

    if (item) {
      this.marker.visible = true
      this.marker.position.set(Math.cos(item.angle) * item.radius, 0.08, Math.sin(item.angle) * item.radius)
      this.marker.userData.base = item.isL1 ? 1.25 : 0.8
      this.marker.scale.setScalar(this.marker.userData.base)
    } else {
      this.marker.visible = false
    }
    this._applyFocus()
  }

  _applyFocus() {
    const active = this.selected || this.hovered
    if (this.labelMap) {
      for (const [id, obj] of this.labelMap) {
        obj.visible = Boolean(obj.userData.strong) || id === active
      }
    }
    if (!active) {
      this._focusTarget = null
      return
    }
    this._focusTarget = this.items.find((i) => i.node.id === active) || null
  }

  focusCamera(id) {
    const item = this.items.find((i) => i.node.id === id)
    if (!item) return
    const R = 44
    const elev = 0.54
    const camR = item.radius + R * Math.cos(elev)
    const px = Math.cos(item.angle) * camR
    const pz = Math.sin(item.angle) * camR
    const py = R * Math.sin(elev) + 3
    this._tweenCamera(
      new THREE.Vector3(px, py, pz),
      new THREE.Vector3(Math.cos(item.angle) * item.radius * 0.9, Math.max(0.4, item.height * 0.35), Math.sin(item.angle) * item.radius * 0.9),
      -6
    )
  }

  homeCamera() {
    this._tweenCamera(new THREE.Vector3(0, 25, 42), new THREE.Vector3(0, 1.2, 0), 0)
  }

  _tweenCamera(pos, target, film = 0) {
    this.camTween = {
      t: 0,
      fromPos: this.camera.position.clone(),
      toPos: pos.clone(),
      fromTar: this.controls.target.clone(),
      toTar: target.clone(),
      fromFilm: this.camera.filmOffset || 0,
      toFilm: film,
    }
  }

  setAutoRotate(on) {
    this.controls.autoRotate = on
  }

  /* ── 主循环 ───────────────────────────────────────── */

  _animate() {
    this._raf = requestAnimationFrame(this._animate)
    const dt = Math.min(this.clock.getDelta(), 0.05)
    this.time += dt

    // 入场：柱体生长 + 镜头推进
    if (this.intro < 1) {
      this.intro = Math.min(1, this.intro + dt / 1.35)
      const p = easeOutCubic(this.intro)
      let dirty = false
      const m = new THREE.Matrix4()
      const q = new THREE.Quaternion()
      const pos = new THREE.Vector3()
      const scale = new THREE.Vector3()
      this.items.forEach((it, i) => {
        const stagger = clamp((p - (it.node.score?.rank ?? 1) / 900) / 0.75, 0, 1)
        const g = easeOutCubic(stagger)
        const w = (it.width ?? (it.isL1 ? 0.52 : 0.16))
        const h = lerp(it.prevH ?? 0, it.height, g)
        const y = it.direction > 0 ? h / 2 : -h / 2
        pos.set(Math.cos(it.angle) * it.radius, y, Math.sin(it.angle) * it.radius)
        scale.set(w * (0.55 + 0.45 * g), Math.max(0.001, h), w * (0.55 + 0.45 * g))
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -it.angle)
        m.compose(pos, q, scale)
        this.towerMesh.setMatrixAt(i, m)
        dirty = true
      })
      if (dirty) this.towerMesh.instanceMatrix.needsUpdate = true
    }

    // 镜头补间
    if (this.camTween) {
      this.camTween.t = Math.min(1, this.camTween.t + dt / 1.0)
      const e = easeOutCubic(this.camTween.t)
      this.camera.position.lerpVectors(this.camTween.fromPos, this.camTween.toPos, e)
      this.controls.target.lerpVectors(this.camTween.fromTar, this.camTween.toTar, e)
      const film = lerp(this.camTween.fromFilm, this.camTween.toFilm, e)
      if (Math.abs(this.camera.filmOffset - film) > 0.001) {
        this.camera.filmOffset = film
        this.camera.updateProjectionMatrix()
      }
      if (this.camTween.t >= 1) this.camTween = null
    }

    // 聚焦压暗
    const dimU = this.towerMesh.material.uniforms.uDim
    const boostU = this.towerMesh.material.uniforms.uBoost
    if (this._focusTarget) {
      dimU.value = lerp(dimU.value, 0.7, 0.09)
      boostU.value = lerp(boostU.value, 0.22, 0.09)
    } else {
      dimU.value = lerp(dimU.value, 0, 0.09)
      boostU.value = lerp(boostU.value, 0, 0.09)
    }

    this.towerMesh.material.uniforms.uTime.value = this.time
    this.particles.material.uniforms.uTime.value = this.time
    this.discMat.uniforms.uTime.value = this.time
    this.coreMat.uniforms.uTime.value = this.time
    if (this.arcGroup) {
      this.arcGroup.children.forEach((c) => {
        c.material.uniforms.uTime.value = this.time
      })
    }
    this.rings.forEach((r, i) => {
      r.rotation.z += dt * (0.18 + i * 0.11)
      r.rotation.y += dt * 0.06
    })
    this.core.rotation.y += dt * 0.15
    if (this.marker.visible) {
      this.marker.rotation.z += dt * 0.8
      const p = 1 + Math.sin(this.time * 3.2) * 0.08
      this.marker.scale.setScalar((this.marker.userData.base ?? 1) * p)
    }
    this.stars.rotation.y += dt * 0.005

    this.controls.update()
    this._syncPick()
    this.composer.render()
    this.labelRenderer.render(this.scene, this.camera)
  }

  _resize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (!w || !h) return
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    this.composer.setSize(w, h)
    this.labelRenderer.setSize(w, h)
  }

  dispose() {
    cancelAnimationFrame(this._raf)
    window.removeEventListener('resize', this._onResize)
    this.renderer.dispose()
    this.composer.dispose?.()
    this.container.innerHTML = ''
  }
}
