import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Asset } from 'expo-asset'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// ─── Asset ────────────────────────────────────────────────────────────────────

const BODY_MODEL = Asset.fromModule(require('../../assets/generalized_human_body.glb')).uri

// ─── Theme ────────────────────────────────────────────────────────────────────

const CARD_BG = '#050A12'
const ACCENT  = '#F97316'

// ─── Abs highlight ────────────────────────────────────────────────────────────
// Substrings matched case-insensitively against mesh.name.
// Replace with exact names from the "GLB MESH NAMES" console group once known.

const ABS_FRAGMENTS = ['genhuman', 'sycranian']

const ABS_COLOR    = new THREE.Color('#66D9FF')
const ABS_EMISSIVE = new THREE.Color('#1EA7FF')

// ─── Floor mesh filter ────────────────────────────────────────────────────────

const isFloorMesh = (name) => {
  const n = String(name || '').toLowerCase()
  return (
    n.includes('floor') || n.includes('ground') || n.includes('plane') ||
    n.includes('circle') || n.includes('pedestal') || n.includes('platform')
  )
}

// ─── 3D body model ────────────────────────────────────────────────────────────

function HumanBodyModel({ viewMode, onReady }) {
  const groupRef   = useRef(null)
  const readyFired = useRef(false)

  const gltf = useLoader(GLTFLoader, BODY_MODEL)

  const centerOffset = useMemo(() => {
    if (!gltf?.scene) return new THREE.Vector3()
    const box = new THREE.Box3().setFromObject(gltf.scene)
    return box.getCenter(new THREE.Vector3())
  }, [gltf?.scene])

  // ── Mesh name logger — remove once names are confirmed ───────────────────
  useEffect(() => {
    if (!gltf?.scene) return
    console.log('──── GLB MESH + MATERIAL NAMES ────')
    gltf.scene.traverse((child) => {
      if (child.isMesh || child.isSkinnedMesh) {
        console.log('MESH:', child.name, 'MAT:', child.material?.name)
      }
    })
  }, [gltf?.scene])

  // ── Effect 1: clone every material once, hide floor ───────────────────────
  useEffect(() => {
    if (!gltf?.scene) return

    gltf.scene.traverse((child) => {
      if (!child.isMesh && !child.isSkinnedMesh) return
      if (!child.material) return

      if (isFloorMesh(child.name)) {
        child.visible = false
        return
      }

      if (!child.userData.matCloned) {
        child.material = child.material.clone()
        child.userData.matCloned = true
        if (child.geometry?.attributes?.color) {
          child.geometry.deleteAttribute('color')
        }
        // Save originals after cloning — never touched again outside Effect 2
        child.userData.origColor       = child.material.color.clone()
        child.userData.origOpacity     = child.material.opacity     ?? 1
        child.userData.origTransparent = child.material.transparent ?? false
        child.userData.origDepthWrite  = child.material.depthWrite  ?? true
        child.userData.origEmissive    = child.material.emissive?.clone() ?? null
        child.userData.origEmissiveInt = child.material.emissiveIntensity ?? 0
      }
    })
  }, [gltf?.scene])

  // ── Effect 2: apply STATIC colors — abs=blue, everything else=original ─────
  // Colors never change between front/back/auto. Only rotation changes per view.
  // Runs once after scene loads (and again if scene ref ever changes).
  useEffect(() => {
    if (!gltf?.scene) return

    gltf.scene.traverse((child) => {
      if (!child.isMesh && !child.isSkinnedMesh) return
      if (!child.material || !child.userData.matCloned) return
      if (isFloorMesh(child.name)) return

      const mat      = child.material
      const meshName = child.name.toLowerCase()
      const isAbs    = ABS_FRAGMENTS.some((f) => meshName.includes(f))

      if (isAbs) {
        mat.color.copy(ABS_COLOR)
        if (mat.emissive) {
          mat.emissive.copy(ABS_EMISSIVE)
          mat.emissiveIntensity = 0.18
        }
        mat.opacity     = 1.0
        mat.transparent = false
        mat.depthWrite  = true
      } else {
        mat.color.set('#FFFFFF')
        if (mat.emissive) {
          mat.emissive.set(0, 0, 0)
          mat.emissiveIntensity = 0
        }
        mat.opacity     = 1.0
        mat.transparent = false
        mat.depthWrite  = true
      }

      mat.needsUpdate = true
    })
  }, [gltf?.scene])

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

  return (
    <group ref={groupRef} scale={1.55}>
      <primitive
        object={gltf.scene}
        position={[-centerOffset.x, -centerOffset.y, -centerOffset.z]}
        dispose={null}
      />
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

  return (
    <View style={styles.container}>
      <View style={styles.viewer}>

        <ModelErrorBoundary>
          <Canvas
            style={styles.canvas}
            camera={{ position: [0, 0.8, 5.5], fov: 45, near: 0.1, far: 100 }}
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

            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.22, 0]}>
              <circleGeometry args={[0.78, 64]} />
              <meshBasicMaterial color="#000000" transparent opacity={0.28} depthWrite={false} />
            </mesh>

            <Suspense fallback={null}>
              <HumanBodyModel
                viewMode={viewMode}
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

useLoader.preload(GLTFLoader, BODY_MODEL)

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
