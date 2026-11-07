import type { BiometricEngine, BiometricTemplate, GalleryEntry, IdentifyOptions, MatchResult, QualityCheck, QualityReport } from './types';
import { dHash, hamming, laplacianVariance, loadGray, mean, std } from './imageOps';
import { seeded } from '../../lib/utils';

/**
 * PROTOTYPE biometric engine — NOT a trained muzzle-recognition model.
 *
 * - Quality checks: lighting and blur use real image measurements (brightness, Laplacian variance);
 *   muzzle visibility is a simple centre-contrast heuristic (labelled simulated).
 * - Template: a 64-bit perceptual hash of the image. This only recognises the same / near-identical photo,
 *   which is enough to demonstrate the enrol -> identify flow end to end.
 * - Demo hint: presenters can pick which registered demo animal is "being scanned"; the confidence shown
 *   is a simulated value.
 */
export class SimulatedMuzzleEngine implements BiometricEngine {
  readonly name = 'MuzzleID Simulator';
  readonly modelVersion = 'sim-0.3 (simulated)';
  readonly simulated = true;
  readonly requiresNetwork = true; // modelled as server-side matching, to keep offline behaviour honest

  async assessQuality(image: string): Promise<QualityReport> {
    const W = 96, H = 96;
    const g = await loadGray(image, W, H);
    const brightness = mean(g);
    const lap = laplacianVariance(g, W, H);

    // centre region (inside the oval guide): muzzle bead/ridge texture produces high local detail
    const C = 48, o = (W - C) / 2;
    const centre = new Float32Array(C * C);
    for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) centre[y * C + x] = g[(y + o) * W + (x + o)];
    const centreTexture = laplacianVariance(centre, C, C);
    const centreContrast = std(centre);

    const lightScore = brightness < 35 ? 0.2 : brightness < 60 ? 0.55 : brightness > 225 ? 0.3 : brightness > 200 ? 0.6 : 0.95;
    const blurScore = Math.max(0.1, Math.min(1, lap / 260));
    const visScore = Math.max(0.15, Math.min(1, (centreTexture / 900) * 0.7 + (centreContrast / 30) * 0.3));

    const status = (s: number): QualityCheck['status'] => (s >= 0.7 ? 'good' : s >= 0.45 ? 'fair' : 'poor');
    const checks: QualityCheck[] = [
      { key: 'lighting', label: 'Lighting', score: lightScore, status: status(lightScore), simulated: false,
        message: lightScore >= 0.7 ? 'Good light' : brightness < 60 ? 'Too dark, face the light' : 'Too bright, avoid direct glare' },
      { key: 'blur', label: 'Sharpness', score: blurScore, status: status(blurScore), simulated: false,
        message: blurScore >= 0.7 ? 'Sharp' : 'Slightly blurred, hold steady' },
      { key: 'visibility', label: 'Muzzle visible', score: visScore, status: status(visScore), simulated: true,
        message: visScore >= 0.7 ? 'Muzzle pattern visible' : 'Move closer, fill the oval' },
    ];
    const overall = (lightScore + blurScore + visScore) / 3;
    return { checks, overall, passed: checks.every((c) => c.status !== 'poor') };
  }

  async extractTemplate(image: string): Promise<BiometricTemplate> {
    const reference = await dHash(image);
    const q = await this.assessQuality(image).then((r) => r.overall).catch(() => 0.7);
    return { reference, quality: q, modelVersion: this.modelVersion };
  }

  async identify(probe: BiometricTemplate, gallery: GalleryEntry[], opts?: IdentifyOptions): Promise<MatchResult> {
    const base = { simulated: true, modelVersion: this.modelVersion, candidatesSearched: gallery.length };

    if (opts?.demoHintAnimalId) {
      const hit = gallery.find((g) => g.animalId === opts.demoHintAnimalId);
      if (!hit) return { ...base, matched: false };
      const r = seeded(hit.animalId + new Date().toDateString());
      return { ...base, matched: true, animalId: hit.animalId, confidence: Math.round((95.6 + r() * 3.6) * 10) / 10 };
    }

    let best: { id: string; d: number } | null = null;
    for (const g of gallery) {
      const d = hamming(probe.reference, g.reference);
      if (!best || d < best.d) best = { id: g.animalId, d };
    }
    if (best && best.d <= 10) {
      return { ...base, matched: true, animalId: best.id, confidence: Math.round((99.2 - best.d * 0.8) * 10) / 10 };
    }
    return { ...base, matched: false };
  }
}
