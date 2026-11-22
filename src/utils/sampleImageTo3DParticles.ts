import * as THREE from 'three';

export interface SampledCouplePortrait {
  /** High-resolution interior + Sobel internal-feature particles (NormalBlending, depthTest: true) */
  portraitPositions: Float32Array;
  portraitColors: Float32Array;
  portraitSizes: Float32Array;
  portraitRandoms: Float32Array;
  portraitPhases: Float32Array;
  portraitCount: number;
  /** Separate AdditiveBlending sparkle rim + hair highlights + pendant + floating mini-heart */
  rimPositions: Float32Array;
  rimColors: Float32Array;
  rimSizes: Float32Array;
  rimRandoms: Float32Array;
  rimPhases: Float32Array;
  rimCount: number;
}

const MAX_SAMPLE_DIM = 360;
const PORTRAIT_CENTER_Y = 0.72;
const PORTRAIT_MAX_WORLD_W = 6.25;
const PORTRAIT_MAX_WORLD_H = 4.55;
const RELIEF_HALF_DEPTH = 0.14; // Refined shallow 3D holographic relief z in [-0.14, +0.14]

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

// Cosmic accent colors for additive rim/sparkles & subtle 20% portrait sheen
const COL_PEARL = new THREE.Color('#fff7fb');
const COL_SAKURA = new THREE.Color('#f9a8d4');
const COL_BLUSH = new THREE.Color('#fbcfe8');
const COL_CHAMPAGNE = new THREE.Color('#fde68a');
const COL_LAVENDER = new THREE.Color('#d8b4fe');

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Photo-faithful clarity boost (~1.18x contrast + gentle S-curve) with a subtle ~20%
 * warm rose-gold / lavender cosmic sheen. Output is linear-calibrated below the 0.85
 * Bloom luminanceThreshold so dark glasses, eyes, lips, and V-hand stay razor-sharp.
 */
function gradePortraitColor(
  rRaw: number,
  gRaw: number,
  bRaw: number,
  out: Float32Array,
  i3: number
) {
  const boostChannel = (c: number) => {
    const contrasted = clamp01((c - 0.5) * 1.18 + 0.5);
    const sCurve = contrasted * contrasted * (3 - 2 * contrasted);
    return clamp01(contrasted * 0.7 + sCurve * 0.3);
  };

  let r = boostChannel(rRaw);
  let g = boostChannel(gRaw);
  let b = boostChannel(bRaw);

  // Preserve dark tones (glasses frames, pupils, eyebrows, dark hair & outfits) cleanly
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  // Subtle 18-24% cosmic rose-gold/lavender sheen (stronger in mid-highlights, gentle in darks)
  const sheen = 0.18 + lum * 0.06;
  const tintR = 0.94 + lum * 0.06;
  const tintG = 0.78 + lum * 0.1;
  const tintB = 0.91 + (1 - lum) * 0.07;

  r = r * (1 - sheen) + tintR * lum * sheen * 1.12;
  g = g * (1 - sheen) + tintG * lum * sheen * 1.06;
  b = b * (1 - sheen) + tintB * lum * sheen * 1.12;

  // Lift ultra-crushed blacks slightly (min 0.085) so dark shirts & hair still read as starry hologram silhouettes
  r = clamp01(r * 0.92 + 0.055);
  g = clamp01(g * 0.9 + 0.045);
  b = clamp01(b * 0.92 + 0.068);

  // Convert sRGB-ish to display-calibrated linear RGB capped cleanly below Bloom threshold (0.85)
  const bloomSafeCap = 0.81;
  out[i3] = Math.pow(r, 1.55) * bloomSafeCap;
  out[i3 + 1] = Math.pow(g, 1.55) * bloomSafeCap;
  out[i3 + 2] = Math.pow(b, 1.55) * bloomSafeCap;
}

function writeFloatingHeartAndHalo(
  rimPositions: Float32Array,
  rimColors: Float32Array,
  rimSizes: Float32Array,
  rimRandoms: Float32Array,
  rimPhases: Float32Array,
  startIdx: number,
  rimCount: number,
  rand: () => number,
  heartAnchorX: number,
  heartAnchorY: number,
  haloRx: number,
  haloRy: number
) {
  const remaining = Math.max(0, rimCount - startIdx);
  const miniHeartCount = Math.floor(remaining * 0.55);
  const tmp = new THREE.Color();

  for (let k = 0; k < remaining; k++) {
    const i = startIdx + k;
    const i3 = i * 3;
    rimRandoms[i] = rand();
    rimPhases[i] = rand() * Math.PI * 2;

    if (k < miniHeartCount) {
      // Tiny glowing 3D floating heart cleanly centered above the cleft between both heads
      const t = rand() * Math.PI * 2;
      const fill = 0.38 + Math.pow(rand(), 0.52) * 0.62;
      const hx = 16 * Math.pow(Math.sin(t), 3);
      const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      const scale = 0.024 * fill;
      const zDepth = (rand() - 0.5) * 0.12 * (1.1 - fill * 0.4);

      rimPositions[i3] = heartAnchorX + hx * scale;
      rimPositions[i3 + 1] = heartAnchorY + hy * scale;
      rimPositions[i3 + 2] = 0.08 + zDepth;

      tmp.copy(COL_SAKURA).lerp(COL_PEARL, 0.28 + rand() * 0.52);
      if (rand() > 0.72) tmp.lerp(COL_CHAMPAGNE, 0.45);
      const hdr = 1.72;
      rimColors[i3] = tmp.r * hdr;
      rimColors[i3 + 1] = tmp.g * hdr;
      rimColors[i3 + 2] = tmp.b * hdr;
      rimSizes[i] = 0.92 + rand() * 0.58;
    } else {
      // Sparse outer cosmic stardust halo strictly outside the portrait silhouette
      const angle = rand() * Math.PI * 2;
      const ring = 1.02 + rand() * 0.28;
      rimPositions[i3] = Math.cos(angle) * haloRx * ring;
      rimPositions[i3 + 1] = PORTRAIT_CENTER_Y + Math.sin(angle) * haloRy * ring;
      rimPositions[i3 + 2] = (rand() - 0.5) * 0.55;

      const pick = rand();
      if (pick < 0.45) tmp.copy(COL_CHAMPAGNE).lerp(COL_PEARL, rand() * 0.45);
      else if (pick < 0.8) tmp.copy(COL_BLUSH).lerp(COL_SAKURA, rand() * 0.6);
      else tmp.copy(COL_LAVENDER).lerp(COL_PEARL, 0.5);
      const hdr = 1.15 + rand() * 0.4;
      rimColors[i3] = tmp.r * hdr;
      rimColors[i3 + 1] = tmp.g * hdr;
      rimColors[i3 + 2] = tmp.b * hdr;
      rimSizes[i] = 0.55 + rand() * 0.65;
    }
  }
}

/**
 * Graceful procedural 3D fallback if `/images/couple-finale.png` is missing or fails to load.
 */
export function generateFallbackCouplePortrait(
  portraitCount: number,
  rimCount: number
): SampledCouplePortrait {
  const rand = mulberry32(20231120);
  const portraitPositions = new Float32Array(portraitCount * 3);
  const portraitColors = new Float32Array(portraitCount * 3);
  const portraitSizes = new Float32Array(portraitCount);
  const portraitRandoms = new Float32Array(portraitCount);
  const portraitPhases = new Float32Array(portraitCount);

  const rimPositions = new Float32Array(rimCount * 3);
  const rimColors = new Float32Array(rimCount * 3);
  const rimSizes = new Float32Array(rimCount);
  const rimRandoms = new Float32Array(rimCount);
  const rimPhases = new Float32Array(rimCount);

  const evalSDF = (x: number, y: number): number => {
    const dLeftHead = Math.hypot((x + 0.98) / 0.62, (y - 0.52) / 0.74) - 1.0;
    const dLeftTorso = Math.hypot((x + 1.12 - (y + 1.2) * 0.08) / 1.15, (y + 1.1) / 1.2) - 1.0;
    const dRightHead = Math.hypot((x - 0.86) / 0.68, (y - 0.88) / 0.84) - 1.0;
    const dRightTorso = Math.hypot((x - 0.98 + (y + 1.2) * 0.06) / 1.32, (y + 1.02) / 1.3) - 1.0;
    const dL = Math.min(dLeftHead, dLeftTorso);
    const dR = Math.min(dRightHead, dRightTorso);
    const k = 0.25;
    const h = Math.max(k - Math.abs(dL - dR), 0) / k;
    return Math.min(dL, dR) - h * h * k * 0.25;
  };

  let pIdx = 0;
  let attempts = 0;
  while (pIdx < portraitCount && attempts < portraitCount * 20) {
    attempts++;
    const x = (rand() * 2 - 1) * 2.85;
    const y = -2.0 + rand() * 3.95;
    const sdf = evalSDF(x, y);
    if (sdf > 0) continue;

    const depth = clamp01(-sdf / 0.6);
    const i3 = pIdx * 3;
    portraitPositions[i3] = x;
    portraitPositions[i3 + 1] = PORTRAIT_CENTER_Y + y;
    portraitPositions[i3 + 2] = (depth * 2 - 1) * RELIEF_HALF_DEPTH;

    const shade = clamp01(0.32 + depth * 0.5 + (y + 1.6) * 0.12);
    gradePortraitColor(shade * 0.95, shade * 0.8, shade * 0.88, portraitColors, i3);
    portraitSizes[pIdx] = 0.85 + rand() * 0.35;
    portraitRandoms[pIdx] = rand();
    portraitPhases[pIdx] = rand() * Math.PI * 2;
    pIdx++;
  }

  const rimEdgeCount = Math.floor(rimCount * 0.65);
  const tmp = new THREE.Color();
  let rIdx = 0;
  attempts = 0;
  while (rIdx < rimEdgeCount && attempts < rimEdgeCount * 50) {
    attempts++;
    const x = (rand() * 2 - 1) * 2.85;
    const y = -2.0 + rand() * 3.95;
    const sdf = evalSDF(x, y);
    if (sdf > 0 || sdf < -0.09) continue;

    const i3 = rIdx * 3;
    rimPositions[i3] = x;
    rimPositions[i3 + 1] = PORTRAIT_CENTER_Y + y;
    rimPositions[i3 + 2] = (rand() - 0.5) * 0.1;
    tmp.copy(COL_PEARL).lerp(COL_SAKURA, 0.35 + rand() * 0.35);
    const hdr = 1.48;
    rimColors[i3] = tmp.r * hdr;
    rimColors[i3 + 1] = tmp.g * hdr;
    rimColors[i3 + 2] = tmp.b * hdr;
    rimSizes[rIdx] = 0.72 + rand() * 0.52;
    rimRandoms[rIdx] = rand();
    rimPhases[rIdx] = rand() * Math.PI * 2;
    rIdx++;
  }

  writeFloatingHeartAndHalo(
    rimPositions,
    rimColors,
    rimSizes,
    rimRandoms,
    rimPhases,
    rIdx,
    rimCount,
    rand,
    -0.08,
    PORTRAIT_CENTER_Y + 2.38,
    3.25,
    2.45
  );

  return {
    portraitPositions,
    portraitColors,
    portraitSizes,
    portraitRandoms,
    portraitPhases,
    portraitCount,
    rimPositions,
    rimColors,
    rimSizes,
    rimRandoms,
    rimPhases,
    rimCount,
  };
}

/**
 * High-resolution 2-pass offscreen canvas portrait sampler (~360px):
 * - Pass 1 (~75%): Structured jittered stipple grid across all opaque cutout pixels (alpha > 40)
 * - Pass 2 (~25%): Internal Sobel luminance edge reinforcement (glasses, eyes, lips, V-sign hand)
 * - Shallow 3D holographic relief (z in [-0.14, +0.14]) from smoothed luminance + edge distance
 * - Separate AdditiveBlending rim/highlight/pendant/floating-mini-heart sparkle layer
 */
export async function sampleCouplePortrait3D(
  imageUrl: string,
  portraitCount: number,
  rimCount: number
): Promise<SampledCouplePortrait> {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !imageUrl) {
    return generateFallbackCouplePortrait(portraitCount, rimCount);
  }

  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.decoding = 'async';
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    el.src = imageUrl;
  });

  if (!img || img.naturalWidth < 24 || img.naturalHeight < 24) {
    return generateFallbackCouplePortrait(portraitCount, rimCount);
  }

  try {
    const scale = Math.min(1, MAX_SAMPLE_DIM / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(48, Math.round(img.naturalWidth * scale));
    const h = Math.max(48, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return generateFallbackCouplePortrait(portraitCount, rimCount);

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    const n = w * h;
    const alpha = new Float32Array(n);
    const lum = new Float32Array(n);
    const mask = new Uint8Array(n);

    let transparentPixels = 0;
    for (let i = 0; i < n; i++) {
      const a = data[i * 4 + 3] / 255;
      alpha[i] = a;
      if (a < 0.12) transparentPixels++;
    }
    const hasAlphaCutout = transparentPixels > n * 0.05;

    let minX = w;
    let maxX = 0;
    let minY = h;
    let maxY = 0;
    let fgCount = 0;

    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const i = row + x;
        const p4 = i * 4;
        const l = (0.299 * data[p4] + 0.587 * data[p4 + 1] + 0.114 * data[p4 + 2]) / 255;
        lum[i] = l;
        // Require alpha > 40 (~0.157) for transparent cutouts
        const isFg = hasAlphaCutout ? data[p4 + 3] > 40 : l > 0.11;
        if (isFg) {
          mask[i] = 1;
          fgCount++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (fgCount < 250 || maxX <= minX || maxY <= minY) {
      return generateFallbackCouplePortrait(portraitCount, rimCount);
    }

    // 2-pass Chamfer Distance Transform for smooth distance-from-edge relief
    const dist = new Float32Array(n);
    const INF = 1e5;
    for (let i = 0; i < n; i++) {
      dist[i] = mask[i] ? INF : 0;
    }
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
        if (y === 0 || x === 0 || x === w - 1) d = Math.min(d, 1);
        dist[i] = d;
      }
    }
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

    // Fast 3x3 smoothed luminance for gentle, artifact-free shallow 3D relief
    const smoothLum = new Float32Array(n);
    for (let y = 1; y < h - 1; y++) {
      const row = y * w;
      for (let x = 1; x < w - 1; x++) {
        const i = row + x;
        if (!mask[i]) continue;
        smoothLum[i] =
          (lum[i - w - 1] + lum[i - w] + lum[i - w + 1] +
            lum[i - 1] + lum[i] * 2 + lum[i + 1] +
            lum[i + w - 1] + lum[i + w] + lum[i + w + 1]) / 10;
      }
    }

    const bboxW = maxX - minX;
    const bboxH = maxY - minY;
    const centerX = (minX + maxX) * 0.5;
    const centerY = (minY + maxY) * 0.5;
    const worldScale = Math.min(PORTRAIT_MAX_WORLD_W / bboxW, PORTRAIT_MAX_WORLD_H / bboxH);
    const invMaxDist = 1 / Math.max(10, maxDist * 0.65);

    const calcZ = (pix: number): number => {
      const dNorm = Math.min(1, dist[pix] * invMaxDist);
      const l = smoothLum[pix];
      // Faces, noses, and bright foreground V-hand protrude gently (+z); hair edges & shoulders recede (-z)
      const norm = clamp01(dNorm * 0.52 + l * 0.48);
      return (norm * 2 - 1) * RELIEF_HALF_DEPTH;
    };

    const rand = mulberry32(20261120);
    const portraitPositions = new Float32Array(portraitCount * 3);
    const portraitColors = new Float32Array(portraitCount * 3);
    const portraitSizes = new Float32Array(portraitCount);
    const portraitRandoms = new Float32Array(portraitCount);
    const portraitPhases = new Float32Array(portraitCount);

    // --- PASS 1 (~75%): Structured Jittered Stipple Grid ---
    const pass1Target = Math.floor(portraitCount * 0.75);
    const stride = Math.max(1, Math.sqrt(fgCount / Math.max(1, pass1Target)));
    const gridCandidates: number[] = [];

    for (let fy = minY; fy <= maxY; fy += stride) {
      const y = Math.min(h - 1, Math.floor(fy));
      const row = y * w;
      for (let fx = minX; fx <= maxX; fx += stride) {
        const x = Math.min(w - 1, Math.floor(fx));
        const idx = row + x;
        if (mask[idx]) {
          gridCandidates.push(idx);
        }
      }
    }

    // Shuffle candidates deterministically so quality drawRange reduction degrades uniformly across the portrait
    for (let i = gridCandidates.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = gridCandidates[i];
      gridCandidates[i] = gridCandidates[j];
      gridCandidates[j] = t;
    }

    const writePortraitParticle = (
      outIdx: number,
      pix: number,
      jitterPx: number,
      isFeatureEdge: boolean
    ) => {
      const px = (pix % w) + (rand() - 0.5) * 2 * jitterPx;
      const py = Math.floor(pix / w) + (rand() - 0.5) * 2 * jitterPx;
      const i3 = outIdx * 3;
      const p4 = pix * 4;

      portraitPositions[i3] = (px - centerX) * worldScale;
      portraitPositions[i3 + 1] = PORTRAIT_CENTER_Y + (centerY - py) * worldScale;
      // Nudge internal Sobel features +0.012 proud so glasses & eyes stay crisp on top of interior stipples
      portraitPositions[i3 + 2] = calcZ(pix) + (isFeatureEdge ? 0.012 : 0);

      gradePortraitColor(
        data[p4] / 255,
        data[p4 + 1] / 255,
        data[p4 + 2] / 255,
        portraitColors,
        i3
      );

      const l = lum[pix];
      // Softly feather the bottom 12% edge so shoulders dissolve dreamily into cosmic stardust (no hard flat cut)
      const yNorm = (py - minY) / Math.max(1, bboxH);
      const bottomFeather = yNorm > 0.85 ? clamp01(1 - (yNorm - 0.85) / 0.15) : 1;
      const featherScale = 0.32 + 0.68 * Math.sqrt(bottomFeather);

      // Finer particle size in bright face/hand regions & Sobel feature lines for razor-sharp detail
      if (isFeatureEdge) {
        portraitSizes[outIdx] = (0.72 + rand() * 0.22) * featherScale;
      } else {
        portraitSizes[outIdx] = ((l > 0.34 ? 0.94 : 1.08) + rand() * 0.18) * featherScale;
      }
      portraitRandoms[outIdx] = rand();
      portraitPhases[outIdx] = rand() * Math.PI * 2;
    };

    const gridUsed = Math.min(pass1Target, gridCandidates.length);
    for (let i = 0; i < gridUsed; i++) {
      writePortraitParticle(i, gridCandidates[i], 0.35, false);
    }

    // --- PASS 2 (~25% + any remainder): Internal Sobel Luminance Edge Reinforcement ---
    // Also collect outer silhouette & bright hair/pendant pixels for the separate AdditiveBlending sparkle layer
    const featurePixels: number[] = [];
    const featureWeights: number[] = [];
    let featureWeightSum = 0;

    const outerRimPixels: number[] = [];
    const outerRimWeights: number[] = [];
    let outerRimWeightSum = 0;

    const highlightPixels: number[] = [];
    const highlightWeights: number[] = [];
    let highlightWeightSum = 0;

    for (let y = 1; y < h - 1; y++) {
      const row = y * w;
      const yNorm = (y - minY) / Math.max(1, bboxH);
      for (let x = 1; x < w - 1; x++) {
        const i = row + x;
        if (!mask[i]) continue;

        const ax =
          -alpha[i - w - 1] + alpha[i - w + 1] -
          2 * alpha[i - 1] + 2 * alpha[i + 1] -
          alpha[i + w - 1] + alpha[i + w + 1];
        const ay =
          -alpha[i - w - 1] - 2 * alpha[i - w] - alpha[i - w + 1] +
          alpha[i + w - 1] + 2 * alpha[i + w] + alpha[i + w + 1];
        const alphaGrad = Math.hypot(ax, ay);

        const lx =
          -lum[i - w - 1] + lum[i - w + 1] -
          2 * lum[i - 1] + 2 * lum[i + 1] -
          lum[i + w - 1] + lum[i + w + 1];
        const ly =
          -lum[i - w - 1] - 2 * lum[i - w] - lum[i - w + 1] +
          lum[i + w - 1] + 2 * lum[i + w] + lum[i + w + 1];
        const lumGrad = Math.hypot(lx, ly);

        // Outer silhouette rim (skip bottom crop edge so bottom fades organically without a hard flat bar)
        const isBottomCrop = y > maxY - 3;
        if (!isBottomCrop && (dist[i] <= 2.3 || alphaGrad > 0.55)) {
          const wRim = 1.0 + Math.min(2.2, alphaGrad);
          outerRimPixels.push(i);
          outerRimWeights.push(wRim);
          outerRimWeightSum += wRim;
        }

        // Internal high-contrast features: glasses frames, eyes, eyebrows, pouting lips, V-hand fingers, jawline, hair
        if (dist[i] > 1.8 && lumGrad > 0.24) {
          const faceZoneBoost = yNorm < 0.8 ? 1.55 : 0.72;
          const wFeat = Math.pow(lumGrad, 1.45) * faceZoneBoost;
          featurePixels.push(i);
          featureWeights.push(wFeat);
          featureWeightSum += wFeat;
        }

        // Hair highlights & pendant sparkle candidates (strictly bright specular points, sparse!)
        if (!isBottomCrop && lum[i] > 0.66 && (dist[i] <= 6.5 || (yNorm > 0.52 && yNorm < 0.82 && lumGrad > 0.45))) {
          const wHi = (lum[i] - 0.6) * (1 + lumGrad);
          highlightPixels.push(i);
          highlightWeights.push(wHi);
          highlightWeightSum += wHi;
        }
      }
    }

    const buildCdf = (weights: number[], sum: number) => {
      const cdf = new Float32Array(weights.length);
      let acc = 0;
      for (let i = 0; i < weights.length; i++) {
        acc += weights[i] / sum;
        cdf[i] = acc;
      }
      if (cdf.length > 0) cdf[cdf.length - 1] = 1;
      return cdf;
    };

    const pickCdf = (cdf: Float32Array, u: number) => {
      let lo = 0;
      let hi = cdf.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (cdf[mid] < u) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    };

    const featureCdf = featurePixels.length > 0 ? buildCdf(featureWeights, featureWeightSum) : null;
    for (let i = gridUsed; i < portraitCount; i++) {
      const pix = featureCdf
        ? featurePixels[pickCdf(featureCdf, rand())]
        : gridCandidates[i % gridCandidates.length];
      writePortraitParticle(i, pix, 0.24, true);
    }

    // Keep Pass 1 stipple base BEFORE Pass 2 Sobel features (so dark glasses/eyes/lips always draw cleanly on top)
    // Shuffle each pass internally so quality drawRange stays spatially even
    const shuffleSlice = (start: number, end: number) => {
      for (let i = end - 1; i > start; i--) {
        const j = start + Math.floor(rand() * (i - start + 1));
        const i3 = i * 3;
        const j3 = j * 3;
        for (let k = 0; k < 3; k++) {
          const tp = portraitPositions[i3 + k];
          portraitPositions[i3 + k] = portraitPositions[j3 + k];
          portraitPositions[j3 + k] = tp;
          const tc = portraitColors[i3 + k];
          portraitColors[i3 + k] = portraitColors[j3 + k];
          portraitColors[j3 + k] = tc;
        }
        const ts = portraitSizes[i];
        portraitSizes[i] = portraitSizes[j];
        portraitSizes[j] = ts;
      }
    };
    shuffleSlice(0, gridUsed);
    shuffleSlice(gridUsed, portraitCount);

    // --- SEPARATE ADDITIVEBLENDING RIM + HIGHLIGHTS + FLOATING MINI-HEART LAYER ---
    const rimPositions = new Float32Array(rimCount * 3);
    const rimColors = new Float32Array(rimCount * 3);
    const rimSizes = new Float32Array(rimCount);
    const rimRandoms = new Float32Array(rimCount);
    const rimPhases = new Float32Array(rimCount);
    const tmp = new THREE.Color();

    const outerRimTarget = Math.floor(rimCount * 0.48);
    const highlightTarget = Math.floor(rimCount * 0.14);
    const outerRimCdf = outerRimPixels.length > 0 ? buildCdf(outerRimWeights, outerRimWeightSum) : null;
    const highlightCdf = highlightPixels.length > 0 ? buildCdf(highlightWeights, highlightWeightSum) : null;

    let rCursor = 0;
    if (outerRimCdf) {
      for (let k = 0; k < outerRimTarget; k++, rCursor++) {
        const pix = outerRimPixels[pickCdf(outerRimCdf, rand())];
        const px = (pix % w) + (rand() - 0.5) * 1.1;
        const py = Math.floor(pix / w) + (rand() - 0.5) * 1.1;
        const i3 = rCursor * 3;
        rimPositions[i3] = (px - centerX) * worldScale;
        rimPositions[i3 + 1] = PORTRAIT_CENTER_Y + (centerY - py) * worldScale;
        rimPositions[i3 + 2] = calcZ(pix) + (rand() - 0.5) * 0.08;

        tmp.copy(COL_PEARL).lerp(COL_SAKURA, 0.32 + rand() * 0.42);
        if (rand() > 0.76) tmp.lerp(COL_CHAMPAGNE, 0.42);
        const hdr = 1.38 + rand() * 0.3;
        rimColors[i3] = tmp.r * hdr;
        rimColors[i3 + 1] = tmp.g * hdr;
        rimColors[i3 + 2] = tmp.b * hdr;
        rimSizes[rCursor] = 0.6 + rand() * 0.5;
        rimRandoms[rCursor] = rand();
        rimPhases[rCursor] = rand() * Math.PI * 2;
      }
    }

    if (highlightCdf) {
      for (let k = 0; k < highlightTarget; k++, rCursor++) {
        const pix = highlightPixels[pickCdf(highlightCdf, rand())];
        const px = (pix % w) + (rand() - 0.5) * 0.8;
        const py = Math.floor(pix / w) + (rand() - 0.5) * 0.8;
        const i3 = rCursor * 3;
        rimPositions[i3] = (px - centerX) * worldScale;
        rimPositions[i3 + 1] = PORTRAIT_CENTER_Y + (centerY - py) * worldScale;
        rimPositions[i3 + 2] = calcZ(pix) + 0.035;

        tmp.copy(COL_CHAMPAGNE).lerp(COL_PEARL, 0.45 + rand() * 0.45);
        const hdr = 1.28 + rand() * 0.28;
        rimColors[i3] = tmp.r * hdr;
        rimColors[i3 + 1] = tmp.g * hdr;
        rimColors[i3 + 2] = tmp.b * hdr;
        rimSizes[rCursor] = 0.46 + rand() * 0.4;
        rimRandoms[rCursor] = rand();
        rimPhases[rCursor] = rand() * Math.PI * 2;
      }
    }

    // Center the tiny glowing floating heart right above the romantic cleft between both heads
    const portraitTopY = PORTRAIT_CENTER_Y + (bboxH * worldScale) * 0.5;
    const heartAnchorX = -0.34;
    const heartAnchorY = portraitTopY + 0.14;
    writeFloatingHeartAndHalo(
      rimPositions,
      rimColors,
      rimSizes,
      rimRandoms,
      rimPhases,
      rCursor,
      rimCount,
      rand,
      heartAnchorX,
      heartAnchorY,
      (bboxW * worldScale) * 0.56,
      (bboxH * worldScale) * 0.56
    );

    return {
      portraitPositions,
      portraitColors,
      portraitSizes,
      portraitRandoms,
      portraitPhases,
      portraitCount,
      rimPositions,
      rimColors,
      rimSizes,
      rimRandoms,
      rimPhases,
      rimCount,
    };
  } catch {
    return generateFallbackCouplePortrait(portraitCount, rimCount);
  }
}
