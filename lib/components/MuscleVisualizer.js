import React, { Suspense, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Canvas, useFrame } from '@react-three/fiber/native'
import { useGLTF, Center } from '@react-three/drei/native'
import * as THREE from 'three'

// ─── Asset ───────────────────────────────────────────────────────────────────

const BODY_MODEL = require('../../assets/generalized_human_body.glb')

// ─── Theme ───────────────────────────────────────────────────────────────────

const CARD_BG = '#050A12'
const ACCENT  = '#F97316'

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

function HumanBodyModel({ viewMode, targetedMuscles, onReady }) {
  const groupRef   = useRef(null)
  const readyFired = useRef(false)

  // Destructure scene (the live Object3D tree) from useGLTF
  const { scene } = useGLTF(BODY_MODEL)

  // ── NUCLEAR MATERIAL OVERRIDE (synchronous — runs before first paint) ─────
  // useMemo fires during render, not after, so the very first frame already
  // uses the overridden white material. useEffect would fire post-paint and
  // leave one frame of original GLB colors visible.
  // We replace materials entirely and strip vertex-color attributes so nothing
  // from the original GLB (textures, vertex colors, tints) can bleed through.
  useMemo(() => {
    if (!scene) return
    const whiteMat = new THREE.MeshStandardMaterial({
      color:        0xffffff,
      roughness:    0.8,
      metalness:    0,
      vertexColors: false,
    })
    scene.traverse((child) => {
      if (!child.isMesh) return
      // Replace every material slot (single or array)
      child.material = whiteMat
      child.material.needsUpdate = true
      // Strip vertex-color attribute so the shader cannot tint the geometry
      if (child.geometry?.attributes?.color) {
        child.geometry.deleteAttribute('color')
      }
    })
  }, [scene])

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

  return (
    <group ref={groupRef}>
      <Center>
        {/* primitive renders the already-mutated scene tree directly */}
        <primitive object={scene} dispose={null} />
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

export default function MuscleVisualizer({ targetedMuscles = [], activeView }) {
  const [viewMode, setViewMode] = useState(
    activeView === 'front' || activeView === 'back' ? activeView : 'auto',
  )
  const [modelReady, setModelReady] = useState(false)

  useEffect(() => {
    if (activeView === 'front' || activeView === 'back') setViewMode(activeView)
  }, [activeView])

  // Accept either a comma-string or an array
  const muscleArray = useMemo(() => {
    if (Array.isArray(targetedMuscles)) return targetedMuscles
    if (typeof targetedMuscles === 'string') {
      return targetedMuscles.split(',').map((s) => s.trim()).filter(Boolean)
    }
    return []
  }, [targetedMuscles])

  const accessibilityLabel = useMemo(() => {
    const label = muscleArray.join(', ')
    return label ? `3D body — targeted: ${label}` : '3D human body model'
  }, [muscleArray])

  return (
    <View style={styles.container} accessibilityLabel={accessibilityLabel}>
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
                viewMode={viewMode}
                targetedMuscles={muscleArray}
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

        <View style={styles.modeRow}>
          <ViewModeButton active={viewMode === 'front'} label="Front" onPress={() => setViewMode('front')} />
          <ViewModeButton active={viewMode === 'back'}  label="Back"  onPress={() => setViewMode('back')}  />
          <ViewModeButton active={viewMode === 'auto'}  label="Auto"  onPress={() => setViewMode('auto')}  />
        </View>

      </View>
    </View>
  )
}

useGLTF.preload(BODY_MODEL)

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    height: 500,
    minHeight: 500,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.26)',
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
    borderColor: 'rgba(255,255,255,0.1)',
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
    backgroundColor: ACCENT,
  },
  modeButtonText: {
    color: '#CBD5E1',
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
