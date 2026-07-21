// SceneHost — the single three.js host. Render-only: every game-rule question
// (is this shot legal, where does it stop) is answered by lib/sim; this file
// just animates the answers.

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TUNING } from '../config/tuning'
import type { Level } from '../lib/level'
import { toBoard } from '../lib/level'
import type { BoardState } from '../lib/sim'
import { applyShot, evaluateShot, trailForStar } from '../lib/sim'
import type { Vec3 } from '../lib/vec'

interface SceneHostProps {
  level: Level
  onProgress: (remaining: number) => void
  onWin: () => void
}

const toV = (v: Vec3) => new THREE.Vector3(v[0], v[1], v[2])
const easeOutCubic = (u: number) => 1 - (1 - u) ** 3

export default function SceneHost({ level, onProgress, onWin }: SceneHostProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const callbacksRef = useRef({ onProgress, onWin })
  callbacksRef.current = { onProgress, onWin }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const C = TUNING.COLORS
    let board: BoardState = toBoard(level)
    let busy = false // one shot animates at a time; orbiting stays free

    // --- renderer / scene / camera ---
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(C.space)
    scene.fog = new THREE.Fog(C.fog, TUNING.FOG_NEAR, TUNING.FOG_FAR)

    const camera = new THREE.PerspectiveCamera(
      TUNING.CAMERA_FOV,
      container.clientWidth / container.clientHeight,
      0.1,
      200,
    )
    camera.position.copy(new THREE.Vector3(1, 0.55, 1.15).normalize().multiplyScalar(TUNING.CAMERA_START_DIST))

    scene.add(new THREE.AmbientLight(0xffffff, 0.55))
    const sun = new THREE.DirectionalLight(0xffffff, 1.1)
    sun.position.set(6, 10, 7)
    scene.add(sun)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = TUNING.CAMERA_MIN_DIST
    controls.maxDistance = TUNING.CAMERA_MAX_DIST
    controls.enablePan = false

    // --- static dressing: bounds sphere + starfield backdrop ---
    const boundsMesh = new THREE.Mesh(
      new THREE.SphereGeometry(TUNING.BOUNDS_R, 28, 18),
      new THREE.MeshBasicMaterial({ color: C.bounds, wireframe: true, transparent: true, opacity: 0.16 }),
    )
    scene.add(boundsMesh)

    const fieldPositions = new Float32Array(TUNING.STARFIELD_COUNT * 3)
    for (let i = 0; i < TUNING.STARFIELD_COUNT; i++) {
      // random direction, shell between 0.6R and R of the backdrop radius
      const v = new THREE.Vector3().randomDirection().multiplyScalar(TUNING.STARFIELD_R * (0.6 + 0.4 * Math.random()))
      fieldPositions.set([v.x, v.y, v.z], i * 3)
    }
    const fieldGeo = new THREE.BufferGeometry()
    fieldGeo.setAttribute('position', new THREE.BufferAttribute(fieldPositions, 3))
    const starfield = new THREE.Points(
      fieldGeo,
      new THREE.PointsMaterial({ color: C.backdrop, size: 0.55, sizeAttenuation: true, fog: false }),
    )
    scene.add(starfield)

    // --- stars ---
    const sphereGeo = new THREE.SphereGeometry(TUNING.STAR_R, 24, 16)
    const spikeLen = TUNING.SPIKE_LEN_FACTOR * TUNING.STAR_R
    const spikeGeo = new THREE.ConeGeometry(TUNING.STAR_R * 0.26, spikeLen, 10)
    const UP = new THREE.Vector3(0, 1, 0)

    interface StarVisual {
      group: THREE.Group
      body: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>
      spike: THREE.Mesh<THREE.ConeGeometry, THREE.MeshStandardMaterial>
    }
    const starVisuals = new Map<string, StarVisual>()
    const starsGroup = new THREE.Group()
    scene.add(starsGroup)

    for (const star of level.stars) {
      const group = new THREE.Group()
      group.position.copy(toV(star.pos))
      const body = new THREE.Mesh(sphereGeo, new THREE.MeshStandardMaterial({ color: C.star, roughness: 0.55 }))
      const spike = new THREE.Mesh(spikeGeo, new THREE.MeshStandardMaterial({ color: C.spike, roughness: 0.7 }))
      const dir = toV(star.dir)
      spike.quaternion.setFromUnitVectors(UP, dir)
      spike.position.copy(dir.clone().multiplyScalar(TUNING.STAR_R + spikeLen / 2))
      body.userData.starId = star.id
      spike.userData.starId = star.id
      group.add(body, spike)
      starsGroup.add(group)
      starVisuals.set(star.id, { group, body, spike })
    }

    // --- trails ---
    const trailsGroup = new THREE.Group()
    scene.add(trailsGroup)
    const trailMat = new THREE.MeshBasicMaterial({ color: C.trail })
    const addTrailMesh = (a: Vec3, b: Vec3) => {
      const curve = new THREE.LineCurve3(toV(a), toV(b))
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 1, TUNING.TRAIL_R, 10, false), trailMat)
      trailsGroup.add(mesh)
    }

    // --- tiny task-based animation system ---
    type Task = (dt: number) => boolean // return true when done
    const tasks: Task[] = []
    const moveTo = (obj: THREE.Object3D, to: THREE.Vector3, speed: number, onDone?: () => void) => {
      const from = obj.position.clone()
      const dur = Math.max(0.02, from.distanceTo(to) / speed)
      let t = 0
      tasks.push((dt) => {
        t += dt
        const u = Math.min(1, t / dur)
        obj.position.lerpVectors(from, to, easeOutCubic(u))
        if (u >= 1) {
          onDone?.()
          return true
        }
        return false
      })
    }
    const wait = (ms: number, onDone: () => void) => {
      let t = 0
      tasks.push((dt) => {
        t += dt * 1000
        if (t >= ms) {
          onDone()
          return true
        }
        return false
      })
    }

    // --- firing ---
    const fire = (starId: string) => {
      if (busy) return
      const visual = starVisuals.get(starId)
      if (!visual) return
      const star = board.stars.find((s) => s.id === starId)
      if (!star) return
      const result = evaluateShot(board, starId)
      busy = true

      if (result.legal) {
        moveTo(visual.group, toV(result.exitPoint), TUNING.SHOT_SPEED, () => {
          starsGroup.remove(visual.group)
          visual.body.material.dispose()
          visual.spike.material.dispose()
          starVisuals.delete(starId)
          const trail = trailForStar(star)
          addTrailMesh(trail.a, trail.b)
          board = applyShot(board, starId)
          busy = false
          callbacksRef.current.onProgress(board.stars.length)
          if (board.stars.length === 0) callbacksRef.current.onWin()
        })
      } else {
        const home = visual.group.position.clone()
        const hitPoint = toV(star.pos).lerp(toV(result.exitPoint), result.hitT ?? 0)
        moveTo(visual.group, hitPoint, TUNING.SHOT_SPEED, () => {
          visual.body.material.color.set(C.flash)
          visual.spike.material.color.set(C.flash)
          wait(TUNING.FLASH_MS, () => {
            visual.body.material.color.set(C.star)
            visual.spike.material.color.set(C.spike)
            moveTo(visual.group, home, TUNING.RETURN_SPEED, () => {
              busy = false
            })
          })
        })
      }
    }

    // --- tap vs orbit disambiguation + picking ---
    const raycaster = new THREE.Raycaster()
    const pointer = { downX: 0, downY: 0, downTime: 0, maxMovePx: 0, active: false }

    const onPointerDown = (e: PointerEvent) => {
      pointer.downX = e.clientX
      pointer.downY = e.clientY
      pointer.downTime = performance.now()
      pointer.maxMovePx = 0
      pointer.active = true
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!pointer.active) return
      const move = Math.hypot(e.clientX - pointer.downX, e.clientY - pointer.downY)
      pointer.maxMovePx = Math.max(pointer.maxMovePx, move)
    }
    const onPointerUp = (e: PointerEvent) => {
      if (!pointer.active) return
      pointer.active = false
      const elapsed = performance.now() - pointer.downTime
      if (pointer.maxMovePx >= TUNING.TAP_MAX_PX || elapsed >= TUNING.TAP_MAX_MS) return // it was an orbit
      const rect = renderer.domElement.getBoundingClientRect()
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.setFromCamera(ndc, camera)
      const hit = raycaster
        .intersectObjects(starsGroup.children, true)
        .find((h) => typeof h.object.userData.starId === 'string')
      if (hit) fire(hit.object.userData.starId as string)
    }
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerup', onPointerUp)

    // --- resize (checked every frame: some embedded panes never fire
    // ResizeObserver, and the mount-time size can be 0 before CSS applies) ---
    const size = new THREE.Vector2()
    const resizeIfNeeded = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      if (w === 0 || h === 0) return
      renderer.getSize(size)
      if (size.x === w && size.y === h) return
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resizeIfNeeded()

    // --- frame loop ---
    const timer = new THREE.Timer()
    const frame = (time: number) => {
      timer.update(time)
      const dt = Math.min(timer.getDelta(), TUNING.FRAME_DT_MAX)
      resizeIfNeeded()
      for (let i = tasks.length - 1; i >= 0; i--) {
        if (tasks[i](dt)) tasks.splice(i, 1)
      }
      controls.update()
      renderer.render(scene, camera)
    }
    renderer.setAnimationLoop(frame)
    // Hidden tabs get no rAF, which would freeze in-flight shots until the
    // tab returns; a coarse timer keeps animations resolving in background.
    const hiddenTick = window.setInterval(() => {
      if (document.hidden) frame(performance.now())
    }, 500)

    return () => {
      renderer.setAnimationLoop(null)
      window.clearInterval(hiddenTick)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      controls.dispose()
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
          obj.geometry.dispose()
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
          for (const m of mats) m.dispose()
        }
      })
      renderer.dispose()
      container.removeChild(renderer.domElement)
    }
  }, [level])

  return <div ref={containerRef} className="scene-host" />
}
