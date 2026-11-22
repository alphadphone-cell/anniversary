import * as THREE from 'three';

export interface SampledParticleSculpture {
  positions: Float32Array;
  colors: Float32Array;
}

const TARGET_CENTER_Y = 0.28;
const MAX_SAMPLE_DIM = 220;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Dreamy pearlescent-white, sakura-pink (#f9a8d4), blush (#fbcfe8), and champagne rose-gold (#fde68a) palette
const COL_PEARL = new THREE.Color('#fff7fb');
const COL_SAKURA = new THREE.Color('#f9a8d4');
const COL_BLUSH = new THREE.Color('#fbcfe8');
const COL_CHAMPAGNE = new THREE.Color('#fde68a');
const COL_ROSE_DEEP = new THREE.Color('#f472b6');

function writeAuraAndSharedHeart(
  positions: Float32Array,
  colors: Float32Array,
  startIdx: number,
  totalCount: number,
  rand: () => number,
  heartAnchorX: number,
  heartAnchorY: number
) {
  const remaining = Math.max(0, totalCount - startIdx);
  const miniHeartCount = Math.floor(remaining * 0.34);
  const tmp = new THREE.Color();

  for (let k = 0; k < remaining; k++) {
    const i = startIdx + k;
    const i3 = i * 3;

    if (k < miniHeartCount) {
      // Delicate glowing mini 3D heart floating softly between the two silhouettes
      const t = rand() * Math.PI * 2;
      const fill = 0.35 + Math.pow(rand(), 0.55) * 0.65;
      const hx = 16 * Math.pow(Math.sin(t), 3);
      const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      const scale = 0.0175 * fill;
      const zThickness = (rand() - 0.5) * 0.14 * (1.1 - fill * 0.45);

      positions[i3] = heartAnchorX + hx * scale;
      positions[i3 + 1] = heartAnchorY + hy * scale;
      positions[i3 + 2] = 0.34 + zThickness;

      tmp.copy(COL_SAKURA).lerp(COL_PEARL, 0.35 + rand() * 0.5);
      if (rand() > 0.72) tmp.lerp(COL_CHAMPAGNE, 0.42);
      const hdr = 1.68;
      colors[i3] = tmp.r * hdr;
      colors[i3 + 1] = tmp.g * hdr;
      colors[i3 + 2] = tmp.b * hdr;
    } else {
      // Ultra-fine twinkling rose-gold stardust halo gently embracing the couple
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      const ringBias = 0.78 + rand() * 0.48;
      const rx = 3.05 * ringBias;
      const ry = 2.15 * ringBias;
      const rz = 0.95 * (0.55 + rand() * 0.7);

      positions[i3] = Math.sin(phi) * Math.cos(theta) * rx;
      positions[i3 + 1] = TARGET_CENTER_Y + Math.cos(phi) * ry;
      positions[i3 + 2] = Math.sin(phi) * Math.sin(theta) * rz;

      const pick = rand();
      if (pick < 0.45) {
        tmp.copy(COL_CHAMPAGNE).lerp(COL_PEARL, rand() * 0.45);
      } else if (pick < 0.8) {
        tmp.copy(COL_BLUSH).lerp(COL_SAKURA, rand() * 0.6);
      } else {
        tmp.copy(COL_PEARL);
      }
      const hdr = 1.05 + rand() * 0.45;
      colors[i3] = tmp.r * hdr;
      colors[i3 + 1] = tmp.g * hdr;
      colors[i3 + 2] = tmp.b * hdr;
    }
  }
}

/**
 * Graceful procedural 3D fallback: two sculpted silhouettes standing close together
 * (right figure slightly taller, left figure gently leaning in, shoulders touching).
 */
export function generateFallbackCoupleSculpture(particleCount: number): SampledParticleSculpture {
  const rand = mulberry32(20231120);
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const tmp = new THREE.Color();

  const edgeCount = Math.floor(particleCount * 0.45);
  const interiorCount = Math.floor(particleCount * 0.45);
  const bodyTotal = edgeCount + interiorCount;

  // Signed-distance union of two gentle human-bust silhouettes (left slightly shorter leaning right, right slightly taller)
  const evalSDF = (x: number, y: number): number => {
    // Left figure (head + hair + soft leaning torso)
    const lxH = (x + 0.88) / 0.58;
    const lyH = (y - 0.62) / 0.68;
    const dLeftHead = Math.hypot(lxH, lyH) - 1.0;

    const lxT = (x + 1.02 - (y + 1.2) * 0.1) / 1.02;
    const lyT = (y + 0.92) / 1.15;
    const dLeftTorso = Math.hypot(lxT, lyT) - 1.0;

    // Right figure (slightly taller head + broader shoulders leaning gently left)
    const rxH = (x - 0.78) / 0.64;
    const ryH = (y - 0.98) / 0.78;
    const dRightHead = Math.hypot(rxH, ryH) - 1.0;

    const rxT = (x - 0.9 + (y + 1.2) * 0.08) / 1.18;
    const ryT = (y + 0.85) / 1.25;
    const dRightTorso = Math.hypot(rxT, ryT) - 1.0;

    // Smooth-min join at shoulders
    const dLeft = Math.min(dLeftHead, dLeftTorso);
    const dRight = Math.min(dRightHead, dRightTorso);
    const k = 0.24;
    const h = Math.max(k - Math.abs(dLeft - dRight), 0) / k;
    return Math.min(dLeft, dRight) - h * h * k * 0.25;
  };

  let idx = 0;
  let attempts = 0;
  const maxAttempts = bodyTotal * 35;

  while (idx < bodyTotal && attempts < maxAttempts) {
    attempts++;
    const x = (rand() * 2 - 1) * 2.45;
    const y = -1.75 + rand() * 3.65;
    const sdf = evalSDF(x, y);
    if (sdf > 0) continue;

    const isEdgeSlot = idx < edgeCount;
    const edgeBand = -sdf < 0.13;
    if (isEdgeSlot && !edgeBand) continue;
    if (!isEdgeSlot && edgeBand && rand() < 0.75) continue;

    const depth = Math.min(1, Math.max(0, -sdf / 0.65));
    const pillow = Math.sqrt(depth) * 0.58;
    const side = rand() < 0.56 ? 1 : -1;
    const z = isEdgeSlot
      ? (rand() - 0.5) * 0.18
      : side * pillow * (0.72 + rand() * 0.28) + (rand() - 0.5) * 0.06;

    const i3 = idx * 3;
    positions[i3] = x;
    positions[i3 + 1] = TARGET_CENTER_Y + y;
    positions[i3 + 2] = z;

    if (isEdgeSlot) {
      tmp.copy(COL_PEARL).lerp(COL_SAKURA, 0.28 + rand() * 0.34);
      const hdr = 1.52;
      colors[i3] = tmp.r * hdr;
      colors[i3 + 1] = tmp.g * hdr;
      colors[i3 + 2] = tmp.b * hdr;
    } else {
      const topHighlight = THREE.MathUtils.clamp((y + 1.4) / 3.0, 0, 1);
      tmp.copy(COL_ROSE_DEEP).lerp(COL_BLUSH, 0.35 + topHighlight * 0.45);
      if (rand() > 0.78) tmp.lerp(COL_CHAMPAGNE, 0.32);
      const hdr = 1.12 + depth * 0.28;
      colors[i3] = tmp.r * hdr;
      colors[i3 + 1] = tmp.g * hdr;
      colors[i3 + 2] = tmp.b * hdr;
    }
    idx++;
  }

  // Fill any unallocated body slots cleanly if rejection loop hit cap
  while (idx < bodyTotal) {
    const i3 = idx * 3;
    const angle = rand() * Math.PI * 2;
    positions[i3] = Math.cos(angle) * 0.9;
    positions[i3 + 1] = TARGET_CENTER_Y + Math.sin(angle) * 0.7;
    positions[i3 + 2] = (rand() - 0.5) * 0.35;
    colors[i3] = COL_SAKURA.r * 1.25;
    colors[i3 + 1] = COL_SAKURA.g * 1.25;
    colors[i3 + 2] = COL_SAKURA.b * 1.25;
    idx++;
  }

  writeAuraAndSharedHeart(positions, colors, bodyTotal, particleCount, rand, -0.05, TARGET_CENTER_Y + 1.18);
  return { positions, colors };
}

/**
 * Offscreen canvas image-to-3D-particle relief sampler.
 * Allocates exact `particleCount` points:
 * - 45% Edge-weighted contour extraction (silhouette + portrait feature gradients)
 * - 45% Sculpted 3D relief interior (chamfer distance-from-edge + luminance pillowed ±Z thickness)
 * - 10% Romantic rose-gold halo aura + tiny shared glowing heart floating between the couple
 */
export async function sampleImageTo3DParticles(
  imageUrl: string,
  particleCount: number
): Promise<SampledParticleSculpture> {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !imageUrl) {
    return generateFallbackCoupleSculpture(particleCount);
  }

  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.decoding = 'async';
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    el.src = imageUrl;
  });

  if (!img || img.naturalWidth < 16 || img.naturalHeight < 16) {
    return generateFallbackCoupleSculpture(particleCount);
  }

  try {
    const scale = Math.min(1, MAX_SAMPLE_DIM / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(32, Math.round(img.naturalWidth * scale));
    const h = Math.max(32, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return generateFallbackCoupleSculpture(particleCount);

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    const n = w * h;
    const alpha = new Float32Array(n);
    const lum = new Float32Array(n);
    const mask = new Uint8Array(n);

    // Detect whether the source uses an alpha channel or dark-background cutout
    let transparentPixels = 0;
    for (let i = 0; i < n; i++) {
      const a = data[i * 4 + 3] / 255;
      alpha[i] = a;
      if (a < 0.12) transparentPixels++;
    }
    const hasAlphaCutout = transparentPixels > n * 0.06;

    let minX = w;
    let maxX = 0;
    let minY = h;
    let maxY = 0;
    let fgCount = 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const p4 = idx * 4;
        const l = (0.299 * data[p4] + 0.587 * data[p4 + 1] + 0.114 * data[p4 + 2]) / 255;
        lum[idx] = l;
        const isFg = hasAlphaCutout ? alpha[idx] > 0.18 : l > 0.11;
        if (isFg) {
          mask[idx] = 1;
          fgCount++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (fgCount < 120 || maxX <= minX || maxY <= minY) {
      return generateFallbackCoupleSculpture(particleCount);
    }

    // 2-pass Chamfer Distance Transform (fast O(w*h) distance-from-edge for pillowed 3D relief)
    const dist = new Float32Array(n);
    const INF = 1e5;
    for (let i = 0; i < n; i++) {
      dist[i] = mask[i] ? INF : 0;
    }
    // Forward pass
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const i = row + x;
        let d = dist[i];
        if (d === 0) continue;
        if (x > 0) d = Math.min(d, dist[i - 1] + 1);
        if (y > 0) {
          d = Math.min(d, dist[i - w] + 1);
          if (x > 0) d = Math.min(d, dist[i - w - 1] + 1.414);
          if (x < w - 1) d = Math.min(d, dist[i - w + 1] + 1.414);
        }
        // Treat image bottom as open bust base (don't pinch bottom edge unnaturally)
        if (y === 0 || x === 0 || x === w - 1) d = Math.min(d, 1);
        dist[i] = d;
      }
    }
    // Backward pass
    let maxDist = 1;
    for (let y = h - 1; y >= 0; y--) {
      const row = y * w;
      for (let x = w - 1; x >= 0; x--) {
        const i = row + x;
        let d = dist[i];
        if (d === 0) continue;
        if (x < w - 1) d = Math.min(d, dist[i + 1] + 1);
        if (y < h - 1) {
          d = Math.min(d, dist[i + w] + 1);
          if (x > 0) d = Math.min(d, dist[i + w - 1] + 1.414);
          if (x < w - 1) d = Math.min(d, dist[i + w + 1] + 1.414);
        }
        dist[i] = d;
        if (d > maxDist) maxDist = d;
      }
    }

    // Sobel edge strength: combines crisp silhouette boundary + subtle interior portrait details (glasses, V-hand, cheeks)
    const edgePixels: number[] = [];
    const edgeWeights: number[] = [];
    const interiorPixels: number[] = [];
    const interiorWeights: number[] = [];

    let edgeWeightSum = 0;
    let interiorWeightSum = 0;

    for (let y = 1; y < h - 1; y++) {
      const row = y * w;
      for (let x = 1; x < w - 1; x++) {
        const i = row + x;
        if (!mask[i]) continue;

        // Alpha/mask silhouette gradient (razor-sharp outer contour of both heads, hair, V-hand, shoulders)
        const ax =
          -alpha[i - w - 1] + alpha[i - w + 1] -
          2 * alpha[i - 1] + 2 * alpha[i + 1] -
          alpha[i + w - 1] + alpha[i + w + 1];
        const ay =
          -alpha[i - w - 1] - 2 * alpha[i - w] - alpha[i - w + 1] +
          alpha[i + w - 1] + 2 * alpha[i + w] + alpha[i + w + 1];
        const alphaGrad = Math.hypot(ax, ay);

        // Luminance gradient inside subject (captures glasses frames, eyes, lips, fingers, hair edge)
        const lx =
          -lum[i - w - 1] + lum[i - w + 1] -
          2 * lum[i - 1] + 2 * lum[i + 1] -
          lum[i + w - 1] + lum[i + w + 1];
        const ly =
          -lum[i - w - 1] - 2 * lum[i - w] - lum[i - w + 1] +
          lum[i + w - 1] + 2 * lum[i + w] + lum[i + w + 1];
        const lumGrad = Math.hypot(lx, ly);

        const isOuterContour = dist[i] <= 2.4 || alphaGrad > 0.55;
        const isPortraitFeature = lumGrad > 0.42 && dist[i] > 2.4 && y < minY + (maxY - minY) * 0.88;

        if (isOuterContour || isPortraitFeature) {
          // Heavily favor outer silhouette (heads, shoulders, V-hand), gently accentuate portrait features
          const wEdge = isOuterContour
            ? 2.8 + Math.min(2.0, alphaGrad)
            : 0.48 + Math.min(1.1, lumGrad * 0.85);
          edgePixels.push(i);
          edgeWeights.push(wEdge);
          edgeWeightSum += wEdge;
        }

        // Smooth interior relief distribution (softly favors illuminated faces/hands over dark shirt base)
        const yNorm = (y - minY) / Math.max(1, maxY - minY);
        const wInt = 0.58 + lum[i] * 0.65 + (1 - yNorm) * 0.25;
        interiorPixels.push(i);
        interiorWeights.push(wInt);
        interiorWeightSum += wInt;
      }
    }

    if (edgePixels.length < 32 || interiorPixels.length < 64) {
      return generateFallbackCoupleSculpture(particleCount);
    }

    // Build CDFs for O(log N) weighted sampling
    const buildCdf = (weights: number[], sum: number) => {
      const cdf = new Float32Array(weights.length);
      let acc = 0;
      for (let i = 0; i < weights.length; i++) {
        acc += weights[i] / sum;
        cdf[i] = acc;
      }
      cdf[weights.length - 1] = 1;
      return cdf;
    };

    const pickIndex = (cdf: Float32Array, u: number) => {
      let lo = 0;
      let hi = cdf.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (cdf[mid] < u) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    };

    const edgeCdf = buildCdf(edgeWeights, edgeWeightSum);
    const interiorCdf = buildCdf(interiorWeights, interiorWeightSum);

    // Scale bounding box into balanced 3D centerpiece proportions cleanly above the Spiral Galaxy core
    const bboxW = maxX - minX;
    const bboxH = maxY - minY;
    const centerX = (minX + maxX) * 0.5;
    const centerY = (minY + maxY) * 0.5;
    const maxWorldW = 5.45;
    const maxWorldH = 3.95;
    const worldScale = Math.min(maxWorldW / bboxW, maxWorldH / bboxH);

    const rand = mulberry32(20261120);
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const tmp = new THREE.Color();

    const edgeCount = Math.floor(particleCount * 0.45);
    const interiorCount = Math.floor(particleCount * 0.45);
    const bodyTotal = edgeCount + interiorCount;

    for (let i = 0; i < bodyTotal; i++) {
      const isEdge = i < edgeCount;
      const pix = isEdge
        ? edgePixels[pickIndex(edgeCdf, rand())]
        : interiorPixels[pickIndex(interiorCdf, rand())];

      const px = (pix % w) + (rand() - 0.5) * 0.85;
      const py = Math.floor(pix / w) + (rand() - 0.5) * 0.85;

      const wx = (px - centerX) * worldScale;
      const wy = TARGET_CENTER_Y + (centerY - py) * worldScale;

      // Pillowed 3D Z-depth from distance-to-edge + soft luminance relief (front & back hologram surfaces)
      const dNorm = Math.min(1, dist[pix] / Math.max(8, maxDist * 0.62));
      const l = lum[pix];
      const baseRelief = Math.sqrt(dNorm) * 0.58 + (l - 0.35) * 0.18;
      const clampedRelief = Math.max(0.04, Math.min(0.76, baseRelief));

      let wz: number;
      if (isEdge) {
        const isRim = dist[pix] <= 2.4;
        // Outer contour rides along clean rounded rim; facial detail lines sit slightly proud on front relief
        wz = isRim
          ? (rand() - 0.5) * 0.22
          : (rand() < 0.72 ? 1 : -0.82) * clampedRelief * (0.88 + rand() * 0.14);
      } else {
        const side = rand() < 0.58 ? 1 : -0.88;
        // Soft volumetric shell + subtle interior fill so rotating OrbitControls reveals true 3D depth
        const shellFactor = 0.68 + Math.pow(rand(), 0.45) * 0.32;
        wz = side * clampedRelief * shellFactor + (rand() - 0.5) * 0.08;
      }

      const i3 = i * 3;
      positions[i3] = wx;
      positions[i3 + 1] = wy;
      positions[i3 + 2] = wz;

      // Harmonious pearlescent-white, sakura-pink (#f9a8d4), and champagne rose-gold (#fbcfe8 / #fde68a)
      if (isEdge) {
        const isRim = dist[pix] <= 2.4;
        if (isRim) {
          tmp.copy(COL_PEARL).lerp(COL_SAKURA, 0.28 + rand() * 0.34);
          if (rand() > 0.78) tmp.lerp(COL_CHAMPAGNE, 0.38);
          const hdr = 1.48 + l * 0.26;
          colors[i3] = tmp.r * hdr;
          colors[i3 + 1] = tmp.g * hdr;
          colors[i3 + 2] = tmp.b * hdr;
        } else {
          // Delicate portrait feature lines (glasses, eyes, smile, V-hand) glow pearlescent champagne-blush
          tmp.copy(COL_PEARL).lerp(COL_BLUSH, 0.35 + (1 - l) * 0.35);
          if (l > 0.52) tmp.lerp(COL_CHAMPAGNE, 0.25);
          const hdr = 1.24 + l * 0.32;
          colors[i3] = tmp.r * hdr;
          colors[i3 + 1] = tmp.g * hdr;
          colors[i3 + 2] = tmp.b * hdr;
        }
      } else {
        // Interior relief: warm sakura-blush shading driven by natural portrait luminance
        tmp.copy(COL_ROSE_DEEP).lerp(COL_SAKURA, 0.35 + l * 0.45);
        tmp.lerp(COL_BLUSH, l * 0.52);
        if (l > 0.58) tmp.lerp(COL_PEARL, (l - 0.58) * 1.15);
        else if (rand() > 0.82) tmp.lerp(COL_CHAMPAGNE, 0.28);
        const hdr = 0.88 + l * 0.55 + dNorm * 0.14;
        colors[i3] = tmp.r * hdr;
        colors[i3 + 1] = tmp.g * hdr;
        colors[i3 + 2] = tmp.b * hdr;
      }
    }

    // Place the tiny glowing shared heart cleanly in the natural open cleft between Tlinh's head (left) and AD's head (right)
    const heartAnchorX = -0.32;
    const heartAnchorY = TARGET_CENTER_Y + bboxH * worldScale * 0.45;
    writeAuraAndSharedHeart(positions, colors, bodyTotal, particleCount, rand, heartAnchorX, heartAnchorY);

    return { positions, colors };
  } catch {
    return generateFallbackCoupleSculpture(particleCount);
  }
}
