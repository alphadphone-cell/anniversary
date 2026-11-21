import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { ANNIVERSARY_DATA, type GalaxyNodeConfig } from '../../../data/anniversaryData';
import { getNextJourneyStep, useAppStore } from '../../../store/useAppStore';
import { sfxEngine } from '../../../utils/sfxEngine';
import { galaxySignals } from '../../galaxySignals';

const NODE_BEACON_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Cohesive rose-pink (#f472b6) & pearlescent-white (#fdf2f8) soft additive bloom aura
 * for the current guided target node — zero solid rings, zero harsh yellow borders.
 */
const NODE_BEACON_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uStrength; // 0 = off, 1 = soft breathing rose-pink/pearlescent bloom aura
  varying vec2 vUv;

  void main() {
    if (uStrength <= 0.005) discard;
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;

    float breathe = 0.78 + 0.22 * sin(uTime * 2.8);
    float edgeFade = pow(1.0 - smoothstep(0.05, 0.92, r), 3.0);
    float coreBloom = exp(-r * r * 6.2) * 0.62;
    float outerVeil = exp(-r * r * 3.4) * 0.18;

    float alpha = clamp((coreBloom + outerVeil) * edgeFade * breathe * uStrength, 0.0, 0.78);

    vec3 cRosePink = vec3(1.45, 0.48, 1.02);
    vec3 cPearlWhite = vec3(1.58, 1.42, 1.54);
    vec3 col = mix(cRosePink, cPearlWhite, exp(-r * r * 6.5) * 0.62);
    gl_FragColor = vec4(col * alpha, alpha);
  }
`;

/** Beat 2 Portal Flare: expanding rose-white luminous shockwave ring around the focused orb. */
const PORTAL_RING_FRAGMENT = /* glsl */ `
  uniform float uFlare;
  varying vec2 vUv;

  void main() {
    if (uFlare <= 0.002 || uFlare >= 0.998) discard;
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;

    float eased = 1.0 - pow(1.0 - uFlare, 2.4);
    float ringRadius = mix(0.16, 0.92, eased);
    float bandWidth = mix(0.11, 0.045, eased);
    float ring = exp(-pow((r - ringRadius) / bandWidth, 2.0));
    float innerFlash = exp(-r * r * 7.5) * (1.0 - uFlare) * 0.85;

    float envelope = smoothstep(0.0, 0.14, uFlare) * (1.0 - smoothstep(0.55, 1.0, uFlare));
    float edgeSoft = 1.0 - smoothstep(0.75, 0.98, r);
    float alpha = clamp((ring * 0.92 + innerFlash) * envelope * edgeSoft, 0.0, 0.95);

    vec3 cRose = vec3(1.55, 0.58, 1.18);
    vec3 cWhite = vec3(1.85, 1.72, 1.88);
    vec3 col = mix(cRose, cWhite, clamp(ring * 0.65 + innerFlash, 0.0, 1.0));
    gl_FragColor = vec4(col * alpha, alpha);
  }
`;

/** Beat 2 Pooled 14-Sparkle Stardust Burst: 100% GPU-driven radial burst with zero per-frame allocations. */
const PORTAL_SPARKLE_VERTEX = /* glsl */ `
  uniform float uFlare;
  uniform float uPixelRatio;
  attribute vec3 aDir;
  attribute float aSpeed;
  attribute float aSize;
  attribute float aPhase;
  varying float vAlpha;
  varying float vMix;

  void main() {
    float eased = 1.0 - pow(1.0 - uFlare, 2.6);
    vec3 displaced = aDir * (0.18 + eased * aSpeed);
    displaced.y += eased * 0.18;

    float twinkle = 0.72 + 0.28 * sin(uFlare * 16.0 + aPhase);
    float env = smoothstep(0.0, 0.16, uFlare) * (1.0 - smoothstep(0.52, 1.0, uFlare));
    vAlpha = env * twinkle;
    vMix = fract(aPhase * 1.73);

    vec4 mvPos = modelViewMatrix * vec4(displaced, 1.0);
    gl_Position = projectionMatrix * mvPos;
    float sizeFactor = (1.0 - eased * 0.35);
    gl_PointSize = clamp(aSize * sizeFactor * uPixelRatio * (18.0 / max(1.2, -mvPos.z)), 2.0, 26.0);
  }
`;

const PORTAL_SPARKLE_FRAGMENT = /* glsl */ `
  varying float vAlpha;
  varying float vMix;

  void main() {
    if (vAlpha <= 0.01) discard;
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;

    // Delicate 4-point star core + soft halo
    float core = exp(-r * r * 7.0);
    float crossSpark = exp(-abs(p.x) * 8.0 - abs(p.y) * 2.4) * 0.55 +
                       exp(-abs(p.y) * 8.0 - abs(p.x) * 2.4) * 0.55;
    float shape = clamp(core + crossSpark * (1.0 - r), 0.0, 1.0);
    float alpha = shape * vAlpha;
    if (alpha <= 0.005) discard;

    vec3 cPearl = vec3(1.85, 1.72, 1.9);
    vec3 cRose = vec3(1.65, 0.58, 1.2);
    vec3 col = mix(cPearl, cRose, vMix * 0.6);
    gl_FragColor = vec4(col, alpha);
  }
`;

const PORTAL_SPARKLE_COUNT = 14;

interface OrbitingNodesProps {
  interactive?: boolean;
  reducedMotion?: boolean;
}

/** Draws a crisp, luminous glowing heart/sticker medallion onto a 256x256 CanvasTexture. */
function createNodeTexture(node: GalaxyNodeConfig): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const cx = size / 2;
    const cy = size / 2;

    // Soft outer cosmic bloom aura
    const aura = ctx.createRadialGradient(cx, cy, 18, cx, cy, 118);
    aura.addColorStop(0, `${node.primaryColor}cc`);
    aura.addColorStop(0.48, `${node.primaryColor}48`);
    aura.addColorStop(1, 'rgba(5, 2, 10, 0)');
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, size, size);

    const drawHeart = (x: number, y: number, r: number, fill: string | CanvasGradient) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.beginPath();
      ctx.moveTo(0, r * 0.78);
      ctx.bezierCurveTo(-r * 1.15, r * 0.15, -r * 1.05, -r * 0.85, -r * 0.48, -r * 0.85);
      ctx.bezierCurveTo(-r * 0.16, -r * 0.85, 0, -r * 0.56, 0, -r * 0.42);
      ctx.bezierCurveTo(0, -r * 0.56, r * 0.16, -r * 0.85, r * 0.48, -r * 0.85);
      ctx.bezierCurveTo(r * 1.05, -r * 0.85, r * 1.15, r * 0.15, 0, r * 0.78);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.restore();
    };

    const heartGrad = ctx.createRadialGradient(cx - 18, cy - 22, 8, cx, cy + 12, 84);
    heartGrad.addColorStop(0, node.secondaryColor);
    heartGrad.addColorStop(0.45, node.primaryColor);
    heartGrad.addColorStop(1, '#701a75');

    ctx.shadowColor = node.primaryColor;
    ctx.shadowBlur = 24;

    if (node.emblem === 'twin-hearts') {
      drawHeart(cx - 24, cy + 10, 44, heartGrad);
      drawHeart(cx + 22, cy - 8, 56, heartGrad);
    } else {
      drawHeart(cx, cy + 4, 66, heartGrad);
    }

    // Crisp minimalist white sticker emblem inside the heart
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffffff';
    ctx.strokeStyle = '#fff7fd';
    ctx.fillStyle = '#fff7fd';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (node.emblem === 'heart-mail') {
      // Envelope icon
      ctx.strokeRect(cx - 22, cy - 12, 44, 28);
      ctx.beginPath();
      ctx.moveTo(cx - 22, cy - 12);
      ctx.lineTo(cx, cy + 5);
      ctx.lineTo(cx + 22, cy - 12);
      ctx.stroke();
    } else if (node.emblem === 'heart-clock') {
      // Clock emblem
      ctx.beginPath();
      ctx.arc(cx, cy + 2, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy + 2);
      ctx.lineTo(cx, cy - 9);
      ctx.moveTo(cx, cy + 2);
      ctx.lineTo(cx + 9, cy + 6);
      ctx.stroke();
    } else if (node.emblem === 'star-heart') {
      // Four-point cosmic star sparkle
      ctx.beginPath();
      ctx.moveTo(cx, cy - 22);
      ctx.quadraticCurveTo(cx + 4, cy - 4, cx + 22, cy);
      ctx.quadraticCurveTo(cx + 4, cy + 4, cx, cy + 22);
      ctx.quadraticCurveTo(cx - 4, cy + 4, cx - 22, cy);
      ctx.quadraticCurveTo(cx - 4, cy - 4, cx, cy - 22);
      ctx.closePath();
      ctx.fill();
    } else if (node.emblem === 'keepsake-heart') {
      // Polaroid frame emblem
      ctx.strokeRect(cx - 19, cy - 18, 38, 38);
      ctx.beginPath();
      ctx.moveTo(cx - 19, cy + 10);
      ctx.lineTo(cx + 19, cy + 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx - 6, cy - 6, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

interface GalaxyNodeItemProps {
  node: GalaxyNodeConfig;
  interactive: boolean;
  reducedMotion: boolean;
}

function GalaxyNodeItem({ node, interactive, reducedMotion }: GalaxyNodeItemProps) {
  const groupRef = useRef<THREE.Group>(null);
  const scaleWrapperRef = useRef<THREE.Group>(null);
  const beaconMeshRef = useRef<THREE.Mesh>(null);
  const portalRingRef = useRef<THREE.Mesh>(null);
  const portalSparklesRef = useRef<THREE.Points>(null);
  const angleRef = useRef(node.orbitAngle);
  const colorScratchRef = useRef(new THREE.Color());
  const [hovered, setHovered] = useState(false);

  const {
    texture,
    geometry,
    material,
    beaconGeo,
    beaconMat,
    portalRingGeo,
    portalRingMat,
    sparkleGeo,
    sparkleMat,
  } = useMemo(() => {
    const tex = createNodeTexture(node);
    const geo = new THREE.PlaneGeometry(1.65, 1.65);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      color: new THREE.Color(1.22, 1.15, 1.25),
    });
    const bGeo = new THREE.PlaneGeometry(3.2, 3.2);
    const bMat = new THREE.ShaderMaterial({
      vertexShader: NODE_BEACON_VERTEX,
      fragmentShader: NODE_BEACON_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uStrength: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const pRingGeo = new THREE.PlaneGeometry(3.8, 3.8);
    const pRingMat = new THREE.ShaderMaterial({
      vertexShader: NODE_BEACON_VERTEX,
      fragmentShader: PORTAL_RING_FRAGMENT,
      uniforms: {
        uFlare: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // Pooled 14-sparkle radial burst geometry (deterministic per-node seed)
    const sGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(PORTAL_SPARKLE_COUNT * 3);
    const dirs = new Float32Array(PORTAL_SPARKLE_COUNT * 3);
    const speeds = new Float32Array(PORTAL_SPARKLE_COUNT);
    const sizes = new Float32Array(PORTAL_SPARKLE_COUNT);
    const phases = new Float32Array(PORTAL_SPARKLE_COUNT);

    for (let i = 0; i < PORTAL_SPARKLE_COUNT; i++) {
      const baseAngle = (i / PORTAL_SPARKLE_COUNT) * Math.PI * 2 + node.orbitAngle * 0.7;
      const jitter = Math.sin(i * 12.9898 + node.orbitRadius * 78.233) * 0.22;
      const angle = baseAngle + jitter;
      const zSpread = Math.cos(i * 4.13 + node.orbitAngle) * 0.25;
      dirs[i * 3] = Math.cos(angle);
      dirs[i * 3 + 1] = Math.sin(angle);
      dirs[i * 3 + 2] = zSpread;
      speeds[i] = 1.15 + ((i * 37) % 10) * 0.12;
      sizes[i] = 1.35 + ((i * 19) % 7) * 0.24;
      phases[i] = i * 1.17 + node.orbitAngle;
    }

    sGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    sGeo.setAttribute('aDir', new THREE.BufferAttribute(dirs, 3));
    sGeo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    sGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    sGeo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    const sMat = new THREE.ShaderMaterial({
      vertexShader: PORTAL_SPARKLE_VERTEX,
      fragmentShader: PORTAL_SPARKLE_FRAGMENT,
      uniforms: {
        uFlare: { value: 0 },
        uPixelRatio: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return {
      texture: tex,
      geometry: geo,
      material: mat,
      beaconGeo: bGeo,
      beaconMat: bMat,
      portalRingGeo: pRingGeo,
      portalRingMat: pRingMat,
      sparkleGeo: sGeo,
      sparkleMat: sMat,
    };
  }, [node]);

  useEffect(() => {
    if (!interactive && hovered) {
      setHovered(false);
      document.body.style.cursor = 'auto';
    }
  }, [interactive, hovered]);

  useEffect(() => {
    return () => {
      texture.dispose();
      geometry.dispose();
      material.dispose();
      beaconGeo.dispose();
      beaconMat.dispose();
      portalRingGeo.dispose();
      portalRingMat.dispose();
      sparkleGeo.dispose();
      sparkleMat.dispose();
      document.body.style.cursor = 'auto';
    };
  }, [
    texture,
    geometry,
    material,
    beaconGeo,
    beaconMat,
    portalRingGeo,
    portalRingMat,
    sparkleGeo,
    sparkleMat,
  ]);

  const handlePointerOver = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!interactive || useAppStore.getState().focusingNodeId !== null) return;
      event.stopPropagation();
      setHovered(true);
      document.body.style.cursor = 'pointer';
      sfxEngine.playHoverTick();
    },
    [interactive]
  );

  const handlePointerOut = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!interactive) return;
      event.stopPropagation();
      setHovered(false);
      document.body.style.cursor = 'auto';
    },
    [interactive]
  );

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (!interactive) return;
      event.stopPropagation();
      setHovered(false);
      document.body.style.cursor = 'auto';
      useAppStore.getState().openFeatureWithCameraFly(node.id);
    },
    [interactive, node.id]
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const elapsed = state.clock.elapsedTime;
    const { completedSteps, viewMode, activeModal, focusingNodeId } = useAppStore.getState();

    const isFocusedTarget =
      galaxySignals.focusingNodeId === node.id ||
      focusingNodeId === node.id ||
      activeModal === node.id;
    const isAnyFocusOrModal =
      galaxySignals.focusingNodeId !== null || focusingNodeId !== null || activeModal !== null;

    // Freeze target node cleanly during camera fly-to & open modal; slow peripheral orbs gently
    if (!reducedMotion) {
      const speedMul = isFocusedTarget ? 0 : isAnyFocusOrModal ? 0.22 : hovered ? 0.15 : 1;
      angleRef.current += dt * node.orbitSpeed * speedMul;
    }

    if (groupRef.current) {
      const x = Math.cos(angleRef.current) * node.orbitRadius;
      const z = Math.sin(angleRef.current) * node.orbitRadius;
      const bobAmp = isFocusedTarget ? 0.04 : 0.18;
      const bob = reducedMotion ? 0 : Math.sin(elapsed * 1.8 + node.orbitAngle * 2) * bobAmp;
      groupRef.current.position.set(x, node.heightOffset + bob, z);
      groupRef.current.getWorldPosition(galaxySignals.nodeWorldPositions[node.id]);
    }

    // Beat 2 Portal Flare & Sparkle Burst (strictly on the focused target orb)
    const flareT = galaxySignals.focusingNodeId === node.id ? galaxySignals.nodeFlareProgress : 0;
    const flarePulse = flareT > 0 ? Math.sin(flareT * Math.PI) : 0;

    portalRingMat.uniforms.uFlare.value = flareT;
    if (portalRingRef.current) {
      portalRingRef.current.visible = flareT > 0.002 && flareT < 0.998;
    }
    sparkleMat.uniforms.uFlare.value = flareT;
    sparkleMat.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    if (portalSparklesRef.current) {
      portalSparklesRef.current.visible = flareT > 0.002 && flareT < 0.998;
    }

    // Imperative zero-re-render target aura lookup (soft rose-pink/pearlescent bloom, zero harsh rings)
    const nextStep = getNextJourneyStep(completedSteps);
    const isNextSpotlight = interactive && viewMode === 'galaxy' && nextStep === node.id;

    beaconMat.uniforms.uTime.value = elapsed;
    const desiredStrength = isFocusedTarget ? 1.15 + flarePulse * 0.55 : isNextSpotlight ? 1 : 0;
    const nextStrength = THREE.MathUtils.lerp(
      beaconMat.uniforms.uStrength.value,
      desiredStrength,
      Math.min(1, dt * (isFocusedTarget ? 12 : 6))
    );
    beaconMat.uniforms.uStrength.value = nextStrength;
    if (beaconMeshRef.current) {
      beaconMeshRef.current.visible = nextStrength > 0.01;
    }

    // Gentle breathing scale 1.0 -> 1.12, plus bright rose-white ignition glow pulse during Beat 2
    const spotlightBreathe =
      isNextSpotlight && !reducedMotion && !isFocusedTarget
        ? (0.5 + 0.5 * Math.sin(elapsed * 2.8)) * 0.12
        : 0;
    if (isFocusedTarget && flarePulse > 0.01) {
      colorScratchRef.current.setRGB(
        1.45 + flarePulse * 0.95,
        1.28 + flarePulse * 0.88,
        1.44 + flarePulse * 0.92
      );
    } else if (isFocusedTarget || isNextSpotlight) {
      colorScratchRef.current.setRGB(1.42, 1.26, 1.4);
    } else {
      colorScratchRef.current.setRGB(1.22, 1.15, 1.25);
    }
    material.color.lerp(colorScratchRef.current, Math.min(1, dt * (flarePulse > 0.01 ? 16 : 6)));

    if (scaleWrapperRef.current) {
      const baseScale = isFocusedTarget
        ? 1.14 + flarePulse * 0.24
        : hovered
          ? 1.26
          : isNextSpotlight
            ? 1.0 + spotlightBreathe
            : 1.0;
      const current = scaleWrapperRef.current.scale.x;
      const next = THREE.MathUtils.lerp(current, baseScale, isFocusedTarget ? 0.2 : 0.14);
      scaleWrapperRef.current.scale.setScalar(next);
    }
  });

  const initialX = Math.cos(node.orbitAngle) * node.orbitRadius;
  const initialZ = Math.sin(node.orbitAngle) * node.orbitRadius;

  return (
    <group
      ref={groupRef}
      position={[initialX, node.heightOffset, initialZ]}
      name={`galaxy-node-${node.id}`}
    >
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <group ref={scaleWrapperRef}>
          <mesh
            ref={beaconMeshRef}
            position={[0, 0, -0.04]}
            geometry={beaconGeo}
            material={beaconMat}
            visible={false}
          />
          <mesh
            ref={portalRingRef}
            position={[0, 0, -0.02]}
            geometry={portalRingGeo}
            material={portalRingMat}
            visible={false}
          />
          <points
            ref={portalSparklesRef}
            position={[0, 0, 0.03]}
            geometry={sparkleGeo}
            material={sparkleMat}
            visible={false}
          />
          <mesh
            geometry={geometry}
            material={material}
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut}
            onClick={handleClick}
          />
          {hovered && (
            <Text
              font="/fonts/BeVietnamPro-SemiBold.ttf"
              position={[0, 1.08, 0.02]}
              fontSize={0.28}
              letterSpacing={0.05}
              color="#fff5fe"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.02}
              outlineColor="#db2777"
              material-toneMapped={false}
            >
              {node.label.toUpperCase()}
            </Text>
          )}
        </group>
      </Billboard>
    </group>
  );
}

export function OrbitingNodes({ interactive = true, reducedMotion = false }: OrbitingNodesProps) {
  return (
    <group name="orbiting-modal-nodes">
      {ANNIVERSARY_DATA.galaxyNodes.map((node) => (
        <GalaxyNodeItem
          key={node.id}
          node={node}
          interactive={interactive}
          reducedMotion={reducedMotion}
        />
      ))}
    </group>
  );
}
