import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { galaxySignals } from '../../galaxySignals';
import { useAppStore } from '../../../store/useAppStore';

interface StardustTrailProps {
  active: boolean;
  quality?: number;
  reducedMotion?: boolean;
}

const POOL_SIZE = 120;
const PARTICLE_LIFETIME = 0.62; // seconds graceful fade-out

const TRAIL_VERTEX_SHADER = /* glsl */ `
  attribute float aBirthTime;
  attribute float aScale;
  attribute vec3 aColor;
  attribute vec3 aVelocity;

  uniform float uTime;
  uniform float uPixelRatio;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float age = uTime - aBirthTime;
    if (age < 0.0 || age > ${PARTICLE_LIFETIME.toFixed(2)}) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      vAlpha = 0.0;
      vColor = aColor;
      return;
    }

    float life = age / ${PARTICLE_LIFETIME.toFixed(2)};
    vec3 pos = position + aVelocity * age;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Quick soft fade-in, silky quadratic fade-out
    float fadeIn = smoothstep(0.0, 0.08, life);
    float fadeOut = pow(1.0 - life, 1.85);
    vAlpha = fadeIn * fadeOut * 0.92;
    vColor = aColor * (1.28 - life * 0.35);

    float atten = 28.0 / max(-mvPosition.z, 2.0);
    gl_PointSize = clamp(aScale * (1.0 - life * 0.45) * uPixelRatio * atten, 1.5, 16.0);
  }
`;

const TRAIL_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    if (vAlpha <= 0.004) discard;
    vec2 uv = gl_PointCoord - vec2(0.5);
    float dist = length(uv);
    if (dist > 0.5) discard;

    float core = exp(-dist * dist * 18.0);
    float halo = smoothstep(0.5, 0.08, dist) * 0.5;
    gl_FragColor = vec4(vColor * (core * 1.2 + halo * 0.75), (core + halo) * vAlpha);
  }
`;

export function StardustTrail({
  active,
  quality = 1,
  reducedMotion = false,
}: StardustTrailProps) {
  const { camera, pointer } = useThree();

  // Pre-allocated math scratch objects — ZERO per-frame allocations!
  const planeNormalRef = useRef(new THREE.Vector3());
  const planeAnchorRef = useRef(new THREE.Vector3(0, 2.2, 0));
  const hitPlaneRef = useRef(new THREE.Plane());
  const raycasterRef = useRef(new THREE.Raycaster());
  const hitPointRef = useRef(new THREE.Vector3());
  const prevEmitPointRef = useRef(new THREE.Vector3(0, 100, 0));
  const hasPointerMovedRef = useRef(false);
  const pointerActiveRef = useRef(false);
  const poolIndexRef = useRef(0);
  const lastEmitTimeRef = useRef(0);

  const { geometry, material, posArr, birthArr, velArr } = useMemo(() => {
    const positions = new Float32Array(POOL_SIZE * 3);
    const births = new Float32Array(POOL_SIZE);
    const scales = new Float32Array(POOL_SIZE);
    const colors = new Float32Array(POOL_SIZE * 3);
    const velocities = new Float32Array(POOL_SIZE * 3);

    const palette = [
      new THREE.Color('#fff5fd'),
      new THREE.Color('#ff5ab8'),
      new THREE.Color('#d946ef'),
      new THREE.Color('#a855f7'),
    ];

    for (let i = 0; i < POOL_SIZE; i++) {
      births[i] = -99; // inactive until emitted
      scales[i] = 1.65 + (i % 5) * 0.42;
      const c = palette[i % palette.length];
      const i3 = i * 3;
      colors[i3] = c.r * 1.25;
      colors[i3 + 1] = c.g * 1.25;
      colors[i3 + 2] = c.b * 1.25;
    }

    const geo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(positions, 3);
    const birthAttr = new THREE.BufferAttribute(births, 1);
    const velAttr = new THREE.BufferAttribute(velocities, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    birthAttr.setUsage(THREE.DynamicDrawUsage);
    velAttr.setUsage(THREE.DynamicDrawUsage);

    geo.setAttribute('position', posAttr);
    geo.setAttribute('aBirthTime', birthAttr);
    geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aVelocity', velAttr);

    const mat = new THREE.ShaderMaterial({
      vertexShader: TRAIL_VERTEX_SHADER,
      fragmentShader: TRAIL_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return {
      geometry: geo,
      material: mat,
      posArr: positions,
      birthArr: births,
      velArr: velocities,
    };
  }, []);

  // Track pointer presence across mouse & touch cleanly
  useEffect(() => {
    const onMove = () => {
      hasPointerMovedRef.current = true;
      pointerActiveRef.current = true;
    };
    const onLeave = () => {
      pointerActiveRef.current = false;
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onMove, { passive: true });
    window.addEventListener('pointerleave', onLeave, { passive: true });
    window.addEventListener('blur', onLeave, { passive: true });

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
      window.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('blur', onLeave);
    };
  }, []);

  // Strict GPU disposal on unmount
  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    material.uniforms.uTime.value = elapsed;
    material.uniforms.uPixelRatio.value = state.gl.getPixelRatio();

    const lowQuality = quality < 0.65;
    const modalOpen = useAppStore.getState().activeModal !== null;

    if (!active || lowQuality || reducedMotion || modalOpen || !hasPointerMovedRef.current) {
      galaxySignals.pointerStrength = THREE.MathUtils.lerp(
        galaxySignals.pointerStrength,
        0,
        Math.min(1, dt * 8)
      );
      return;
    }

    // Project pointer onto a camera-facing depth plane passing through (0, 2.2, 0)
    camera.getWorldDirection(planeNormalRef.current).negate();
    hitPlaneRef.current.setFromNormalAndCoplanarPoint(
      planeNormalRef.current,
      planeAnchorRef.current
    );

    raycasterRef.current.setFromCamera(pointer, camera);
    const hit = raycasterRef.current.ray.intersectPlane(hitPlaneRef.current, hitPointRef.current);

    if (hit && pointerActiveRef.current) {
      galaxySignals.pointerWorld.lerp(hit, Math.min(1, dt * 16));
      galaxySignals.pointerStrength = THREE.MathUtils.lerp(
        galaxySignals.pointerStrength,
        1,
        Math.min(1, dt * 10)
      );

      // Emit 1-2 stardust motes into the ring buffer when cursor moves across space
      const moveDistSq = hit.distanceToSquared(prevEmitPointRef.current);
      if (moveDistSq > 0.008 && elapsed - lastEmitTimeRef.current >= 0.012) {
        lastEmitTimeRef.current = elapsed;
        const emitCount = moveDistSq > 0.2 ? 3 : 2;

        for (let k = 0; k < emitCount; k++) {
          const idx = poolIndexRef.current;
          poolIndexRef.current = (idx + 1) % POOL_SIZE;

          const i3 = idx * 3;
          const jitterX = (Math.sin(elapsed * 37.3 + idx * 1.7) * 0.5) * 0.24;
          const jitterY = (Math.cos(elapsed * 29.1 + idx * 2.3) * 0.5) * 0.24;
          const jitterZ = (Math.sin(elapsed * 19.7 + idx * 3.1) * 0.5) * 0.24;

          posArr[i3] = hit.x + jitterX;
          posArr[i3 + 1] = hit.y + jitterY;
          posArr[i3 + 2] = hit.z + jitterZ;

          velArr[i3] = jitterX * 2.4;
          velArr[i3 + 1] = 0.22 + Math.abs(jitterY) * 1.8;
          velArr[i3 + 2] = jitterZ * 2.4;

          birthArr[idx] = elapsed;
        }

        prevEmitPointRef.current.copy(hit);
        (geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        (geometry.attributes.aVelocity as THREE.BufferAttribute).needsUpdate = true;
        (geometry.attributes.aBirthTime as THREE.BufferAttribute).needsUpdate = true;
      }
    } else {
      galaxySignals.pointerStrength = THREE.MathUtils.lerp(
        galaxySignals.pointerStrength,
        0,
        Math.min(1, dt * 6)
      );
    }
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
