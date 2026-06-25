import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Canvas, useFrame } from '@react-three/fiber/native'
import { useGLTF, Center } from '@react-three/drei/native'
import * as THREE from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'

// ─── Assets ──────────────────────────────────────────────────────────────────
// One model per gender; the public component picks based on the `gender` prop.

const BODY_MODELS = {
  male:   require('../../assets/generalized_human_body.glb'),
  female: require('../../assets/anatomy/female/uploads_files_5541620_Girl_Base_GLB.glb'),
}
const modelFor = (gender) => (gender === 'female' ? BODY_MODELS.female : BODY_MODELS.male)

// ─── Theme ───────────────────────────────────────────────────────────────────

const CARD_BG = '#EEEEF2'
const ACCENT  = '#F25912'

const BODY_COLOR      = '#87CEEB' // sky blue (default)
const HIGHLIGHT_COLOR = '#16a34a' // green (selected body part)

// Skeleton bone-name fragments → muscle-group label. The body is a single
// skinned mesh, so parts are highlighted by painting per-vertex colors based on
// each vertex's dominant skin bone (see paintBodyMesh).
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
// The female base GLB has no skeleton, so we paint by vertex position instead of
// bone: classify each vertex into a body region along the figure's vertical axis
// (with a lateral test for the arms). Bands are fractions of body height
// (0 = feet, 1 = head). Approximate, but aligns highlights with body parts.
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
  const sx = bb.max.x - bb.min.x, sy = bb.max.y - bb.min.y, sz = bb.max.z - bb.min.z
  const axes = [['x', sx], ['y', sy], ['z', sz]].sort((a, b) => b[1] - a[1])
  const hAxis = axes[0][0], wAxis = axes[1][0]
  const cap = (a) => a.toUpperCase()
  const hRange = (bb.max[hAxis] - bb.min[hAxis]) || 1
  const wCenter = (bb.min[wAxis] + bb.max[wAxis]) / 2
  const wHalf = Math.max(1e-6, (bb.max[wAxis] - bb.min[wAxis]) / 2)
  const hMaxEnd = bb.max[hAxis] // feet at the max end of the height axis (head = min)

  const base = new THREE.Color(BODY_COLOR)
  const defaultHi = new THREE.Color(HIGHLIGHT_COLOR)
  const cache = {}
  const colorFor = (hex) => { if (!hex) return defaultHi; if (!cache[hex]) cache[hex] = new THREE.Color(hex); return cache[hex] }

  const count = pos.count
  const arr = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const hv = pos['get' + cap(hAxis)](i)
    const wv = pos['get' + cap(wAxis)](i)
    const t  = (hMaxEnd - hv) / hRange
    const wn = (wv - wCenter) / wHalf
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

// ─── Muscle → GLB mesh-name fragments ────────────────────────────────────────
// Keys   = exact muscle-group strings from workout data (muscleGroup field)
// Values = substrings matched case-insensitively against mesh node names in GLB

const MUSCLE_MAP = {
  Abs:              ['abs', 'abdomen', 'rectus_abdominis', 'abs_upper', 'abs_lower', 'transverse'],
  Biceps:           ['bicep', 'bicep_l', 'bicep_r', 'bicep_left', 'bicep_right', 'brachialis'],
  Chest:            ['chest', 'pectoral', 'pectoralis', 'pec_', 'chest_upper', 'chest_lower'],
  Quads:            ['quad', 'quadricep', 'rectus_femoris', 'vastus', 'quad_left', 'quad_right'],
  Back:             ['back', 'lat', 'latissimus', 'trapezius', 'rhomboid',
                     'upper_back', 'lower_back', 'lat_left', 'lat_right', 'erector', 'spinae'],
  Glutes:           ['glute', 'gluteus', 'glut_', 'buttock',
                     'glute_left', 'glute_right', 'gluteus_maximus'],
  Hamstrings:       ['hamstring', 'biceps_femoris', 'semimembran', 'semitendin',
                     'hamstring_left', 'hamstring_right'],
  Forearms:         ['forearm', 'forearm_l', 'forearm_r', 'forearm_left', 'forearm_right',
                     'brachioradialis'],
  Shoulders:        ['shoulder', 'deltoid', 'delt_', 'deltoid_l', 'deltoid_r',
                     'shoulder_left', 'shoulder_right'],
  Triceps:          ['tricep', 'tricep_l', 'tricep_r', 'tricep_left', 'tricep_right'],
  Calves:           ['calf', 'gastrocnemius', 'soleus', 'calf_l', 'calf_r',
                     'calf_left', 'calf_right'],
  Neck:             ['neck', 'sternocleidomastoid', 'trap_l', 'trap_r', 'trap_left', 'trap_right'],
  Core:             ['abs', 'abdomen', 'core', 'oblique', 'rectus_abdominis', 'transverse'],
  Obliques:         ['oblique', 'oblique_l', 'oblique_r', 'oblique_left', 'oblique_right', 'abs'],
  Traps:            ['trapezius', 'trap_', 'trap_l', 'trap_r'],
  'Rear Delt':      ['deltoid', 'shoulder', 'rear_delt', 'posterior_delt'],
  'Upper Back':     ['back', 'lat', 'latissimus', 'rhomboid', 'trapezius', 'upper_back'],
  'Lower Back':     ['back', 'erector', 'lower_back', 'spinae', 'lumbar'],
  Arms:             ['bicep', 'tricep', 'forearm', 'brachialis', 'brachioradialis'],
  'Rotator Cuff':   ['shoulder', 'deltoid', 'rotator', 'supraspinatus', 'infraspinatus', 'teres'],
  Rhomboids:        ['rhomboid', 'back'],
  'Glute Med':      ['glute', 'gluteus_medius', 'glute_med', 'gluteus_minimus'],
  'Hip Flexors':    ['hip', 'iliopsoas', 'rectus_femoris', 'iliac'],
  'Lower Traps':    ['trapezius', 'trap_'],
  Serratus:         ['serratus', 'chest', 'pec_'],
  Spine:            ['back', 'erector', 'spinae', 'spine'],
  'Posterior Chain':['back', 'lat', 'glute', 'hamstring', 'erector'],
  'Grip Strength':  ['forearm', 'hand', 'wrist', 'finger', 'grip', 'brachioradialis'],
  Legs:             ['quad', 'hamstring', 'calf', 'gastrocnemius', 'rectus_femoris'],
  'Full Body':      [],
}

// ─── Side visibility sets ─────────────────────────────────────────────────────

const FRONT_MUSCLES = new Set([
  'Abs', 'Biceps', 'Chest', 'Quads', 'Forearms', 'Shoulders', 'Calves',
  'Core', 'Obliques', 'Rear Delt', 'Arms', 'Rotator Cuff', 'Hip Flexors',
  'Serratus', 'Grip Strength', 'Neck', 'Legs',
])

const BACK_MUSCLES = new Set([
  'Back', 'Glutes', 'Hamstrings', 'Triceps', 'Shoulders', 'Calves',
  'Traps', 'Neck', 'Upper Back', 'Lower Back', 'Spine', 'Rhomboids',
  'Lower Traps', 'Posterior Chain', 'Arms', 'Rotator Cuff', 'Glute Med', 'Legs',
])

// ─── Highlight helpers ────────────────────────────────────────────────────────

const meshMatchesMuscle = (meshName, muscleKey) => {
  const fragments = MUSCLE_MAP[muscleKey]
  if (!fragments || fragments.length === 0) return false
  const lower = meshName.toLowerCase()
  return fragments.some((f) => lower.includes(f.toLowerCase()))
}

const shouldHighlightMesh = (meshName, targetedMuscles, viewMode) => {
  for (const muscleKey of targetedMuscles) {
    if (!meshMatchesMuscle(meshName, muscleKey)) continue
    if (viewMode === 'auto')                               return true
    if (viewMode === 'front' && FRONT_MUSCLES.has(muscleKey)) return true
    if (viewMode === 'back'  && BACK_MUSCLES.has(muscleKey))  return true
  }
  return false
}

const isFloorMesh = (name) => {
  const n = name.toLowerCase()
  return (
    n.includes('floor') || n.includes('ground') || n.includes('plane') ||
    n.includes('circle') || n.includes('pedestal') || n.includes('platform')
  )
}

// ─── Rotation helpers ─────────────────────────────────────────────────────────

const ROTATIONS = { auto: 0, front: 0, back: Math.PI }

const clampAngle = (v) => {
  let n = v
  while (n >  Math.PI) n -= Math.PI * 2
  while (n < -Math.PI) n += Math.PI * 2
  return n
}

// ─── 3D body inner component ──────────────────────────────────────────────────

function HumanBodyModel({ model, viewMode, targetedMuscles, groupColors, girthScale = 1, heightScale = 1, onReady }) {
  const groupRef   = useRef(null)
  const readyFired = useRef(false)

  // Shared cached scene from useGLTF → per-instance clone (SkeletonUtils keeps
  // skinning) so multiple <MuscleVisualizer>s can mount at once and each paint
  // its own vertex colors. The floor mesh is removed so it can't skew centering.
  const { scene: original } = useGLTF(model)
  const scene = useMemo(() => {
    if (!original) return null
    const s = cloneSkeleton(original)
    const floors = []
    s.traverse((c) => { if ((c.isMesh || c.isSkinnedMesh) && isFloorMesh(c.name)) floors.push(c) })
    floors.forEach((c) => c.parent && c.parent.remove(c))
    return s
  }, [original])

  // ── Material setup (synchronous — runs before first paint) ────────────────
  // useMemo fires during render, not after, so the first frame already shows the
  // intended colors. We clone the material + geometry (keeps skinning, gives this
  // instance its own `color` attribute), strip textures, and enable vertexColors
  // so body parts can be painted. The base material color stays white so vertex
  // colors render at full strength.
  useMemo(() => {
    if (!scene) return
    scene.traverse((child) => {
      if (!child.isMesh && !child.isSkinnedMesh) return
      if (!child.material) return
      if (isFloorMesh(child.name)) { child.visible = false; return }
      if (child.userData.matCloned) return
      child.material = child.material.clone()
      if (child.geometry) child.geometry = child.geometry.clone()
      child.userData.matCloned = true
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
      child.material.needsUpdate = true
    })
  }, [scene])

  // ── Vertex painting — green where a selected group's bone drives the vertex,
  // sky blue elsewhere. Re-runs synchronously whenever the selection changes.
  useMemo(() => {
    if (!scene) return
    const targetedSet = new Set(targetedMuscles || [])
    scene.traverse((child) => {
      if (!child.isMesh && !child.isSkinnedMesh) return
      if (!child.userData.matCloned || isFloorMesh(child.name)) return
      if (child.isSkinnedMesh) paintBodyMesh(child, targetedSet, groupColors)
      else paintRegionMesh(child, targetedSet, groupColors)
    })
  }, [scene, targetedMuscles, groupColors])

  // ── Smooth rotation + first-frame onReady signal ─────────────────────────
  useFrame((_, delta) => {
    if (!readyFired.current) {
      readyFired.current = true
      onReady?.()
    }
    const group = groupRef.current
    if (!group) return
    if (viewMode === 'auto') {
      group.rotation.y += delta * 0.32
      return
    }
    const target = ROTATIONS[viewMode] ?? 0
    const diff   = clampAngle(target - group.rotation.y)
    group.rotation.y += diff * Math.min(1, delta * 8)
  })

  // height → uniform size; weight (girth) adds extra width/depth on top.
  const sXZ = heightScale * girthScale

  return (
    <group ref={groupRef} scale={[sXZ, heightScale, sXZ]}>
      <Center>
        {/* primitive renders the already-mutated scene tree directly */}
        {scene && <primitive object={scene} dispose={null} />}
      </Center>
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
  const model = modelFor(gender)
  const controlled = view === 'front' || view === 'back' || view === 'auto'
  const [internalView, setInternalView] = useState(
    activeView === 'front' || activeView === 'back' ? activeView : 'auto',
  )
  const viewMode = controlled ? view : internalView
  const setViewMode = (v) => { onViewChange?.(v); if (!controlled) setInternalView(v) }
  const [modelReady, setModelReady] = useState(false)

  useEffect(() => {
    if (!controlled && (activeView === 'front' || activeView === 'back')) setInternalView(activeView)
  }, [activeView, controlled])

  // Accept either a comma-string or an array; stable identity so painting only
  // re-runs when the selection actually changes.
  const muscleArray = useMemo(() => {
    if (Array.isArray(targetedMuscles)) return targetedMuscles
    if (typeof targetedMuscles === 'string') {
      return targetedMuscles.split(',').map((s) => s.trim()).filter(Boolean)
    }
    return []
  }, [Array.isArray(targetedMuscles) ? targetedMuscles.join(',') : targetedMuscles])

  const accessibilityLabel = useMemo(() => {
    const label = muscleArray.join(', ')
    return label ? `3D body — targeted: ${label}` : '3D human body model'
  }, [muscleArray])

  return (
    <View style={[styles.container, height ? { height, minHeight: height } : null]} accessibilityLabel={accessibilityLabel}>
      <View style={styles.viewer}>

        <ModelErrorBoundary>
          <Canvas
            style={styles.canvas}
            camera={{ position: [0, 0, 7], fov: 45, near: 0.1, far: 100 }}
            gl={{ antialias: true, alpha: false }}
            frameloop="always"
          >
            <color attach="background" args={[CARD_BG]} />
            <ambientLight intensity={1.5} />
            <directionalLight position={[0, 10, 10]} intensity={2.5} />
            <directionalLight position={[-4, 2, -4]} intensity={0.9} />

            <Suspense fallback={null}>
              <HumanBodyModel
                model={model}
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

useGLTF.preload(BODY_MODELS.male)
useGLTF.preload(BODY_MODELS.female)

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
