import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Asset } from 'expo-asset'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'

// ─── Assets ───────────────────────────────────────────────────────────────────
// One model per gender; the public component picks based on the `gender` prop.

const MODEL_URIS = {
  male:   Asset.fromModule(require('../../assets/generalized_human_body.glb')).uri,
  female: Asset.fromModule(require('../../assets/anatomy/female/uploads_files_5541620_Girl_Base_GLB.glb')).uri,
}
const modelUriFor = (gender) => (gender === 'female' ? MODEL_URIS.female : MODEL_URIS.male)

// ─── Theme ────────────────────────────────────────────────────────────────────

const CARD_BG = '#EEEEF2'
const ACCENT  = '#F25912'

// ─── Body-part highlighting ───────────────────────────────────────────────────
// The body is a SINGLE skinned mesh, so individual parts cannot be recolored by
// swapping materials. Instead we paint per-vertex colors: each vertex is assigned
// to the muscle group of its dominant skin bone, then coloured green when that
// group is selected, sky blue otherwise.

const BODY_COLOR      = '#87CEEB' // sky blue (default)
const HIGHLIGHT_COLOR = '#16a34a' // green (selected body part)

// Skeleton bone-name fragments → muscle-group label (matches GoalVisualizer HL_MAP).
// A bone may belong to several groups (e.g. the chest spine bone is also "Back");
// a vertex turns green if ANY of its bone's groups is selected.
const BONE_GROUPS = [
  // Muscle groups
  { group: 'Shoulders', frags: ['shoulder'] },
  { group: 'Arms',      frags: ['upper_arm', 'forearm', 'hand', 'palm', 'thumb', 'f_index', 'f_middle', 'f_ring', 'f_pinky'] },
  { group: 'Chest',     frags: ['breast', 'spine.003'] },
  { group: 'Abs',       frags: ['spine.001', 'spine.002'] },
  { group: 'Back',      frags: ['spine.001', 'spine.002', 'spine.003'] },
  { group: 'Glutes',    frags: ['pelvis'] },
  { group: 'Quads',     frags: ['thigh'] },
  { group: 'Calves',    frags: ['shin', 'foot', 'toe'] },
  // Joints / injury-rehab regions (approximate — the skeleton is limb-level)
  { group: 'Neck',      frags: ['spine.004', 'spine.005', 'spine.006'] },
  { group: 'Hip',       frags: ['pelvis', 'thigh'] },
  { group: 'Knee',      frags: ['shin', 'thigh.001'] },
  { group: 'Ankle',     frags: ['foot', 'toe'] },
  { group: 'Elbow',     frags: ['forearm'] },
  { group: 'Wrist',     frags: ['hand', 'palm'] },
]

// Paint the skinned-mesh vertices: green where the dominant bone's group is
// selected, sky blue elsewhere. Writes a `color` attribute consumed by the
// material's vertexColors.
// GLTFLoader sanitizes node/bone names (it strips dots/brackets), so
// "DEF-spine.003" arrives as "DEF-spine003". Normalize both sides before matching.
const normName = (s) => String(s || '').toLowerCase().replace(/[.\s[\]]/g, '')

const paintBodyMesh = (mesh, targetedSet, groupColors) => {
  const geo        = mesh.geometry
  const skinIndex  = geo?.attributes?.skinIndex
  const skinWeight = geo?.attributes?.skinWeight
  const bones      = mesh.skeleton?.bones || []
  if (!skinIndex || !skinWeight || !bones.length) return

  // boneIndex → THREE.Color to paint it (per selected group), or null if not selected.
  const defaultHi = new THREE.Color(HIGHLIGHT_COLOR)
  const colorCache = {}
  const colorFor = (hex) => {
    if (!hex) return defaultHi
    if (!colorCache[hex]) colorCache[hex] = new THREE.Color(hex)
    return colorCache[hex]
  }
  // A target may be a bare group ("Shoulders" = whole region) or side-scoped
  // ("Shoulders|left"). Rigify deform bones are suffixed .L/.R (GLTF sanitizes the
  // dot away, leaving a trailing L/R, optionally before a segment number), so we
  // read each bone's side and only paint it when it matches the requested side.
  const boneColor = bones.map((b) => {
    const raw = b.name || ''
    const sm = /([LR])\d*$/.exec(raw)
    const boneSide = sm ? (sm[1] === 'L' ? 'left' : 'right') : null
    const n = normName(raw)
    for (const token of targetedSet) {
      const [group, side] = String(token).split('|')
      const bg = BONE_GROUPS.find((g) => g.group === group)
      if (!bg) continue
      if (!bg.frags.some((f) => n.includes(normName(f)))) continue
      if (side && boneSide !== side) continue
      return colorFor(groupColors && groupColors[token])
    }
    return null
  })

  const base  = new THREE.Color(BODY_COLOR)
  const count = geo.attributes.position.count
  const arr   = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    // A vertex takes the colour of the first meaningful target-bone influence.
    let c = null
    for (let k = 0; k < 4; k++) {
      if (skinWeight.getComponent(i, k) < 0.12) continue
      const bc = boneColor[skinIndex.getComponent(i, k)]
      if (bc) { c = bc; break }
    }
    if (!c) c = base
    arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b
  }

  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  geo.attributes.color.needsUpdate = true
}

// ─── Region painting (unrigged models) ────────────────────────────────────────
// The female base GLB has no skeleton, so we can't paint by bone. Instead we
// classify each vertex into a body region by its position along the figure's
// vertical axis (with a lateral test for the arms) and colour it the same way.
// Bands are fractions of body height: 0 = feet, 1 = head. Approximate, but lines
// up the highlight with the body part well enough for this base mesh.
const REGION_BANDS = [
  { group: 'Neck',      tMin: 0.80, tMax: 0.88 },
  { group: 'Shoulders', tMin: 0.72, tMax: 0.80 },
  { group: 'Chest',     tMin: 0.60, tMax: 0.73 },
  { group: 'Back',      tMin: 0.52, tMax: 0.73 },
  { group: 'Abs',       tMin: 0.50, tMax: 0.61 },
  { group: 'Hip',       tMin: 0.42, tMax: 0.51 },
  { group: 'Glutes',    tMin: 0.42, tMax: 0.51 },
  { group: 'Quads',     tMin: 0.27, tMax: 0.45 },
  { group: 'Knee',      tMin: 0.20, tMax: 0.28 },
  { group: 'Calves',    tMin: 0.09, tMax: 0.22 },
  { group: 'Ankle',     tMin: 0.02, tMax: 0.10 },
  // Arms extend laterally — require a large sideways offset (xMin = |x| fraction).
  { group: 'Arms',      tMin: 0.52, tMax: 0.80, xMin: 0.42 },
  { group: 'Elbow',     tMin: 0.52, tMax: 0.80, xMin: 0.60 },
  { group: 'Wrist',     tMin: 0.52, tMax: 0.80, xMin: 0.80 },
]

const paintRegionMesh = (mesh, targetedSet, groupColors) => {
  const geo = mesh.geometry
  const pos = geo?.attributes?.position
  if (!pos) return
  if (!geo.boundingBox) geo.computeBoundingBox()
  const bb = geo.boundingBox
  // Height = the longest local axis; width = the next longest (for the arm test).
  const sx = bb.max.x - bb.min.x, sy = bb.max.y - bb.min.y, sz = bb.max.z - bb.min.z
  const axes = [['x', sx], ['y', sy], ['z', sz]].sort((a, b) => b[1] - a[1])
  const hAxis = axes[0][0], wAxis = axes[1][0]
  const cap = (a) => a.toUpperCase()
  const hMin = bb.min[hAxis], hRange = (bb.max[hAxis] - bb.min[hAxis]) || 1
  const wCenter = (bb.min[wAxis] + bb.max[wAxis]) / 2
  const wHalf = Math.max(1e-6, (bb.max[wAxis] - bb.min[wAxis]) / 2)
  // Feet sit at the max end of the height axis for this export (head = min).
  const hMaxEnd = bb.max[hAxis]

  const base = new THREE.Color(BODY_COLOR)
  const defaultHi = new THREE.Color(HIGHLIGHT_COLOR)
  const cache = {}
  const colorFor = (hex) => { if (!hex) return defaultHi; if (!cache[hex]) cache[hex] = new THREE.Color(hex); return cache[hex] }

  const count = pos.count
  const arr = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const hv = pos['get' + cap(hAxis)](i)
    const wv = pos['get' + cap(wAxis)](i)
    const t  = (hMaxEnd - hv) / hRange       // 0 = feet … 1 = head
    const wn = (wv - wCenter) / wHalf        // -1 … 1 across the body
    // wn > 0 is the figure's left (+X side in the rig), wn < 0 the right — so a
    // side-scoped target only paints its half; a bare group paints both.
    let c = null
    for (const r of REGION_BANDS) {
      if (t < r.tMin || t > r.tMax) continue
      if (r.xMin != null && Math.abs(wn) < r.xMin) continue
      let matched = null
      for (const token of targetedSet) {
        const [group, side] = String(token).split('|')
        if (group !== r.group) continue
        if (side === 'left' && wn <= 0) continue
        if (side === 'right' && wn >= 0) continue
        matched = token; break
      }
      if (matched) { c = colorFor(groupColors && groupColors[matched]); break }
    }
    if (!c) c = base
    arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  geo.attributes.color.needsUpdate = true
}

// ─── Floor mesh filter ────────────────────────────────────────────────────────

const isFloorMesh = (name) => {
  const n = String(name || '').toLowerCase()
  return (
    n.includes('floor') || n.includes('ground') || n.includes('plane') ||
    n.includes('circle') || n.includes('pedestal') || n.includes('platform')
  )
}

// ─── 3D body model ────────────────────────────────────────────────────────────

// World height (in scene units) we want the body to fill. The web camera sits at
// z=4.6 with a 45° fov, so the visible height at the origin is
// 2·tan(22.5°)·4.6 ≈ 3.8 units; 3.1 leaves comfortable head/foot margin.
const TARGET_VIEW_H = 3.1

// Bounding box for the body in the space it actually renders in.
//
// This GLB is a single SKINNED mesh, and skinned meshes render from their
// skeleton's bind pose — which matches the geometry's *local* coordinates, NOT
// the mesh's world matrix. (The body node's world transform flattens the model
// to a ~0.35-unit-tall slab; applying it — as Box3.setFromObject does — yields a
// bogus box whose center is ≈0, so the foot-pivot landed at the camera centre
// and only the legs showed.) So we union each non-floor mesh's *local* geometry
// bounds, which is what's on screen: feet ≈ y0, head ≈ y2.
// Skinned meshes (the male GLB) render from their bind pose, which matches the
// geometry's *local* coords — so we union local geometry bounds for those. Static
// meshes (e.g. the female GLB, which has no skeleton) render through their node's
// world transform, so we measure those in world space via setFromObject. Mixing
// the two correctly frames either model regardless of how it was exported.
const measureBox = (root) => {
  root.updateMatrixWorld(true)
  const box = new THREE.Box3()
  root.traverse((c) => {
    if (!(c.isMesh || c.isSkinnedMesh) || !c.geometry) return
    if (isFloorMesh(c.name)) return
    if (c.isSkinnedMesh) {
      if (!c.geometry.boundingBox) c.geometry.computeBoundingBox()
      if (c.geometry.boundingBox) box.union(c.geometry.boundingBox)
    } else {
      const wb = new THREE.Box3().setFromObject(c)
      if (!wb.isEmpty()) box.union(wb)
    }
  })
  return box
}

function HumanBodyModel({ modelUri, viewMode, targetedMuscles = [], groupColors, girthScale = 1, heightScale = 1, onReady }) {
  const groupRef   = useRef(null)
  const readyFired = useRef(false)

  const gltf = useLoader(GLTFLoader, modelUri)

  // Per-instance clone (SkeletonUtils preserves skinning). The loader caches one
  // shared scene; cloning lets multiple <MuscleVisualizer>s mount at once and
  // each paint its own vertex colors without fighting over the same geometry.
  // The floor/pedestal mesh is removed so it can't skew the centering bounds
  // (an invisible floor at the feet drags the bbox center down → body floats up).
  const scene = useMemo(() => {
    if (!gltf?.scene) return null
    const s = cloneSkeleton(gltf.scene)
    const floors = []
    s.traverse((c) => { if ((c.isMesh || c.isSkinnedMesh) && isFloorMesh(c.name)) floors.push(c) })
    floors.forEach((c) => c.parent && c.parent.remove(c))
    return s
  }, [gltf?.scene])

  // Center + auto-fit: translate the model so its bbox center sits at the origin,
  // then scale so its height fills TARGET_VIEW_H regardless of the GLB's units.
  const fit = useMemo(() => {
    if (!scene) return { center: new THREE.Vector3(), scale: 1 }
    const box = measureBox(scene)
    if (box.isEmpty()) return { center: new THREE.Vector3(), scale: 1 }
    const center = box.getCenter(new THREE.Vector3())
    const size   = box.getSize(new THREE.Vector3())
    const scale  = TARGET_VIEW_H / (size.y || 1)
    return { center, scale }
  }, [scene])

  // ── Effect 1: clone material + geometry, strip textures, enable vertex colors
  // Cloning geometry gives this instance its own `color` attribute so its paint
  // is independent of any other mounted instance.
  useEffect(() => {
    if (!scene) return

    scene.traverse((child) => {
      if (!child.isMesh && !child.isSkinnedMesh) return
      if (!child.material) return

      if (isFloorMesh(child.name)) {
        child.visible = false
        return
      }

      if (!child.userData.matCloned) {
        child.material = child.material.clone()
        if (child.geometry) child.geometry = child.geometry.clone()
        child.userData.matCloned = true
        // Strip baked textures so flat per-vertex colors render uniformly.
        child.material.map          = null
        child.material.emissiveMap  = null
        child.material.aoMap        = null
        child.material.roughnessMap = null
        child.material.metalnessMap = null
        // White base lets per-vertex colors (painted below) show at full strength.
        child.material.vertexColors = true
        child.material.color.set('#FFFFFF')
        if (child.material.emissive) {
          child.material.emissive.set(0, 0, 0)
          child.material.emissiveIntensity = 0
        }
        child.material.transparent = false
        child.material.depthWrite  = true
        child.material.needsUpdate = true
      }
    })
  }, [scene])

  // ── Effect 2: paint vertices — green where a selected group's bone drives ──
  // the vertex, sky blue elsewhere. Re-runs whenever the selection changes.
  useEffect(() => {
    if (!scene) return
    const targetedSet = new Set(targetedMuscles)

    scene.traverse((child) => {
      if (!child.isMesh && !child.isSkinnedMesh) return
      if (!child.userData.matCloned || isFloorMesh(child.name)) return
      if (child.isSkinnedMesh) paintBodyMesh(child, targetedSet, groupColors)
      else paintRegionMesh(child, targetedSet, groupColors)
    })
  }, [scene, targetedMuscles, groupColors])

  // ── useFrame: all rotation logic, nothing else ────────────────────────────
  // auto  → continuous spin, never stops
  // front → lerp to y=0   (model faces camera)
  // back  → lerp to y=π   (model faces away)
  //
  // Shortest-path diff prevents snapping when exiting auto at an arbitrary angle.
  useFrame((_, delta) => {
    if (!readyFired.current) {
      readyFired.current = true
      onReady?.()
    }

    const group = groupRef.current
    if (!group) return

    if (viewMode === 'auto') {
      group.rotation.y += delta * 0.5
      return
    }

    const target = viewMode === 'back' ? Math.PI : 0

    // Shortest-path delta so the model always takes the nearest arc
    let diff = target - group.rotation.y
    while (diff >  Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2

    group.rotation.y += diff * Math.min(1, delta * 4)
  })

  // fit.scale frames the body to the camera; height → uniform size on top (a
  // taller person reads larger), weight (girth) adds extra width/depth.
  const sY  = fit.scale * heightScale
  const sXZ = fit.scale * heightScale * girthScale

  return (
    <group ref={groupRef} scale={[sXZ, sY, sXZ]}>
      {scene && (
        <primitive
          object={scene}
          position={[-fit.center.x, -fit.center.y, -fit.center.z]}
          dispose={null}
        />
      )}
    </group>
  )
}

// ─── Error boundary ───────────────────────────────────────────────────────────

class ModelErrorBoundary extends React.Component {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorState}>
          <Text style={styles.errorText}>3D model unavailable</Text>
        </View>
      )
    }
    return this.props.children
  }
}

// ─── View-mode toggle button ──────────────────────────────────────────────────

const ViewModeButton = ({ active, label, onPress }) => (
  <TouchableOpacity
    activeOpacity={0.75}
    accessibilityRole="button"
    accessibilityState={{ selected: active }}
    onPress={onPress}
    style={[styles.modeButton, active && styles.modeButtonActive]}
  >
    <Text style={[styles.modeButtonText, active && styles.modeButtonTextActive]}>{label}</Text>
  </TouchableOpacity>
)

// ─── Public component ─────────────────────────────────────────────────────────

export default function MuscleVisualizer({ gender, targetedMuscles = [], groupColors, activeView, view, onViewChange, height, overlay, hideControls, girthScale = 1, heightScale = 1 }) {
  const modelUri = modelUriFor(gender)
  const controlled = view === 'front' || view === 'back' || view === 'auto'
  const [internalView, setInternalView] = useState(
    activeView === 'front' || activeView === 'back' ? activeView : 'auto',
  )
  const viewMode = controlled ? view : internalView
  const setViewMode = (v) => { onViewChange?.(v); if (!controlled) setInternalView(v) }
  const [modelReady, setModelReady] = useState(false)

  // Accept either a comma-string or an array; stable identity so paint only
  // re-runs when the selection actually changes.
  const muscleArray = useMemo(() => {
    if (Array.isArray(targetedMuscles)) return targetedMuscles
    if (typeof targetedMuscles === 'string') {
      return targetedMuscles.split(',').map((s) => s.trim()).filter(Boolean)
    }
    return []
  }, [Array.isArray(targetedMuscles) ? targetedMuscles.join(',') : targetedMuscles])

  useEffect(() => {
    if (!controlled && (activeView === 'front' || activeView === 'back')) setInternalView(activeView)
  }, [activeView, controlled])

  return (
    <View style={[styles.container, height ? { height, minHeight: height } : null]}>
      <View style={styles.viewer}>

        <ModelErrorBoundary>
          <Canvas
            style={styles.canvas}
            camera={{ position: [0, 0, 4.6], fov: 45, near: 0.1, far: 100 }}
            gl={{
              antialias:             true,
              alpha:                 false,
              preserveDrawingBuffer: true,
              powerPreference:       'high-performance',
            }}
            shadows={false}
            frameloop="always"
            onCreated={({ gl }) => {
              gl.outputColorSpace    = THREE.SRGBColorSpace
              gl.toneMapping         = THREE.ACESFilmicToneMapping
              gl.toneMappingExposure = 1.08
            }}
          >
            <color attach="background" args={[CARD_BG]} />

            <ambientLight intensity={1.7} />
            <directionalLight position={[3, 4, 4]}  intensity={2.2} />
            <directionalLight position={[-3, 2, 2]} intensity={0.9} />
            <pointLight position={[0, -1.8, 2.5]}   intensity={0.8} color="#FDBA74" />

            <Suspense fallback={null}>
              <HumanBodyModel
                modelUri={modelUri}
                viewMode={viewMode}
                targetedMuscles={muscleArray}
                groupColors={groupColors}
                girthScale={girthScale}
                heightScale={heightScale}
                onReady={() => setModelReady(true)}
              />
            </Suspense>
          </Canvas>
        </ModelErrorBoundary>

        {!modelReady && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator color={ACCENT} />
          </View>
        )}

        {/* Caller-supplied tappable overlay (e.g. goal body-part hotspots) */}
        {overlay ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">{overlay}</View>
        ) : null}

        {!hideControls && (
          <View style={styles.modeRow}>
            <ViewModeButton active={viewMode === 'front'} label="Front" onPress={() => setViewMode('front')} />
            <ViewModeButton active={viewMode === 'back'}  label="Back"  onPress={() => setViewMode('back')}  />
            <ViewModeButton active={viewMode === 'auto'}  label="Auto"  onPress={() => setViewMode('auto')}  />
          </View>
        )}

      </View>
    </View>
  )
}

useLoader.preload(GLTFLoader, MODEL_URIS.male)
useLoader.preload(GLTFLoader, MODEL_URIS.female)

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    height: 500,
    minHeight: 500,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(242,89,18,0.26)',
  },
  viewer: {
    flex: 1,
    position: 'relative',
  },
  canvas: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,10,18,0.88)',
  },
  modeRow: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(2,6,23,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(33,24,50,0.1)',
  },
  modeButton: {
    width: 52,
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingHorizontal: 6,
  },
  modeButtonActive: {
    backgroundColor: '#4C4E78',
  },
  modeButtonText: {
    color: '#7A7C90',
    fontSize: 12,
    fontWeight: '700',
  },
  modeButtonTextActive: {
    color: '#FFFFFF',
  },
  errorState: {
    flex: 1,
    minHeight: 360,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CARD_BG,
  },
  errorText: {
    color: '#FED7AA',
    fontSize: 13,
    fontWeight: '700',
  },
})
