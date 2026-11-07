import type { BiometricEngine, BiometricTemplate, GalleryEntry, IdentifyOptions, MatchResult, QualityReport } from './types';

/**
 * Adapter for a future muzzle-recognition service (e.g. a hosted CV model).
 * Not active in the prototype. Expected endpoints:
 *   POST {baseUrl}/quality   { image }                 -> QualityReport
 *   POST {baseUrl}/template  { image }                 -> BiometricTemplate
 *   POST {baseUrl}/identify  { reference, gallery? }   -> MatchResult
 */
export class RemoteMuzzleEngine implements BiometricEngine {
  readonly name = 'OwaMuzzle Recognition API';
  readonly simulated = false;
  readonly requiresNetwork = true;
  constructor(private baseUrl: string, readonly modelVersion = 'remote') {}

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`Biometric API error ${res.status}`);
    return res.json() as Promise<T>;
  }
  assessQuality(image: string) { return this.post<QualityReport>('/quality', { image }); }
  extractTemplate(image: string) { return this.post<BiometricTemplate>('/template', { image }); }
  identify(probe: BiometricTemplate, _gallery: GalleryEntry[], _opts?: IdentifyOptions) {
    // A real service would search its own index server-side rather than receiving the gallery.
    return this.post<MatchResult>('/identify', { reference: probe.reference });
  }
}
