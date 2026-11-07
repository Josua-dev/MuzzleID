import type { BiometricEngine, BiometricTemplate, GalleryEntry, IdentifyOptions, MatchResult, QualityReport } from './types';
import { SimulatedMuzzleEngine } from './simulatedEngine';
import { loadGray } from './imageOps';
import { decodeEmbedding, embedImage, encodeEmbedding, shortlist, type EmbEntry } from './aiEmbedding';
import { SIZE, deserialize, extractFeatures, extractMultiView, matchFeatures, serialize, type FeatureSet } from './featureMatcher';

/** Minimum geometrically-consistent matches to declare a match. Impostor pairs peaked at 3 in the benchmark. */
export const MIN_INLIERS = 12;
/** Best candidate must beat the runner-up by this factor, otherwise the result is ambiguous. */
const MARGIN = 1.5;
/** Animals sent to geometric verification when the gallery is larger than this. */
const SHORTLIST = 12;

/**
 * Real on-device local-feature matcher (DoG keypoints + SIFT-style descriptors + geometric verification).
 * Not a trained deep model: see scripts/bench.ts for what it has and has not been tested against.
 * Quality lighting/blur checks and the presenter "demo hint" reuse the simulator.
 */
export class FeatureMatchEngine implements BiometricEngine {
  readonly name = 'OwaMuzzle Hybrid (AI + feature matcher)';
  readonly modelVersion = 'dog-sift-2.0';
  readonly simulated = false;
  readonly requiresNetwork = true; // kept server-modelled so the offline queue behaves as before
  private readonly fallback = new SimulatedMuzzleEngine();

  assessQuality(image: string): Promise<QualityReport> {
    return this.fallback.assessQuality(image);
  }

  /** Capture gate: lighting + sharpness from the image, and a REAL pattern check from detected keypoints. */
  async gate(image: string): Promise<QualityReport> {
    const base = await this.fallback.assessQuality(image);
    const gray = await loadGray(image, SIZE, SIZE);
    const n = extractFeatures(gray, SIZE, SIZE, 400).n; // sharp muzzles: 90+; too far away: ~25-40; blank: <10
    const status = n >= 70 ? 'good' : n >= 45 ? 'fair' : 'poor';
    const pattern = {
      key: 'visibility' as const, label: 'Pattern', score: Math.min(1, n / 90), status: status as 'good' | 'fair' | 'poor', simulated: false,
      message: status === 'good' ? 'Muzzle pattern clear' : status === 'fair' ? 'Pattern weak: move closer' : 'No usable pattern: fill the oval with the nose',
    };
    const checks = base.checks.map((c) => (c.key === 'visibility' ? pattern : c));
    const overall = checks.reduce((a, c) => a + c.score, 0) / checks.length;
    return { checks, overall, passed: checks.every((c) => c.status !== 'poor') };
  }

  async compareImages(a: string, b: string): Promise<number> {
    const [ga, gb] = await Promise.all([loadGray(a, SIZE, SIZE), loadGray(b, SIZE, SIZE)]);
    return matchFeatures(extractMultiView(gb), extractFeatures(ga), 'affine').inliers;
  }

  async extractTemplate(image: string): Promise<BiometricTemplate> {
    const gray = await loadGray(image, SIZE, SIZE);
    const feats = extractFeatures(gray);
    // enrolment quality: how many stable keypoints were found (real measurement)
    const quality = Math.min(1, feats.n / 100);
    // Probe-side only: extra simulated viewpoints help when the animal is photographed from a different angle.
    const multi = extractMultiView(gray);
    const emb = await embedImage(image); // null when the AI model is unavailable
    const reference = serialize(feats) + (emb ? '#' + encodeEmbedding(emb) : '');
    return { reference, quality, modelVersion: emb ? `${this.modelVersion}+ai` : this.modelVersion, transient: { multi, emb } };
  }

  async identify(probe: BiometricTemplate, gallery: GalleryEntry[], opts?: IdentifyOptions): Promise<MatchResult> {
    if (opts?.demoHintAnimalId) return this.fallback.identify(probe, gallery, opts);
    const base = { simulated: false, modelVersion: this.modelVersion, candidatesSearched: gallery.length };
    const tr = probe.transient as { multi: FeatureSet; emb: Float32Array | null } | undefined;
    const p: FeatureSet | null = tr?.multi ?? deserialize(probe.reference);
    if (!p) return { ...base, matched: false };
    const probeEmb = tr?.emb ?? decodeEmbedding(probe.reference.split('#')[1]);

    // AI shortlist: with a large gallery only the most similar animals get the expensive geometric check.
    const entries = gallery.map((g) => ({ g, f: deserialize(g.reference), emb: decodeEmbedding(g.reference.split('#')[1]) })).filter((e) => e.f);
    const embEntries: EmbEntry[] = entries.map((e) => ({ animalId: e.g.animalId, emb: e.emb }));
    const { keep, sims } = shortlist(probeEmb, embEntries, SHORTLIST);

    const perAnimal = new Map<string, number>();
    for (const { g, f } of entries) {
      if (!keep.has(g.animalId)) continue;
      const s = matchFeatures(p, f!, 'affine').inliers;
      perAnimal.set(g.animalId, Math.max(perAnimal.get(g.animalId) ?? 0, s));
    }
    const ranked = [...perAnimal.entries()].sort((a, b) => b[1] - a[1]);
    const [bestId, best] = ranked[0] ?? [undefined, 0];
    const second = ranked[1]?.[1] ?? 0;
    if (!bestId || best < MIN_INLIERS || best < second * MARGIN) return { ...base, matched: false };
    // Evidence score, not a calibrated probability: saturates as consistent matches grow.
    const confidence = Math.round(Math.min(99.5, 100 * (1 - Math.exp(-(best - MIN_INLIERS + 6) / 14))) * 10) / 10;
    const sim = sims.get(bestId);
    return { ...base, matched: true, animalId: bestId, confidence, aiSimilarity: sim === undefined ? undefined : Math.round(sim * 1000) / 1000 };
  }
}
