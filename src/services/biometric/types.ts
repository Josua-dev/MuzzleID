// Biometric engine contract. The prototype ships a SIMULATED engine; a real computer-vision
// model (on-device or server API) can replace it by implementing this interface.

export type CheckStatus = 'good' | 'fair' | 'poor';

export interface QualityCheck {
  key: 'lighting' | 'blur' | 'visibility';
  label: string;
  score: number; // 0..1
  status: CheckStatus;
  message: string;
  simulated: boolean;
}

export interface QualityReport {
  checks: QualityCheck[];
  overall: number; // 0..1
  passed: boolean;
}

export interface BiometricTemplate {
  /** Opaque reference stored in muzzle_biometrics.embedding_reference */
  reference: string;
  quality: number;
  modelVersion: string;
  /** Never persisted: engine-internal data (e.g. extra simulated viewpoints) kept for the identify() call. */
  transient?: unknown;
}

export interface GalleryEntry {
  animalId: string;
  reference: string;
}

export interface MatchResult {
  matched: boolean;
  animalId?: string;
  /** 0..100. In the prototype this is a SIMULATED value. */
  confidence?: number;
  /** Cosine similarity (-1..1) from the AI embedding model, when it was available. Informational. */
  aiSimilarity?: number;
  simulated: boolean;
  modelVersion: string;
  candidatesSearched: number;
}

export interface IdentifyOptions {
  /** Prototype only: lets a demo presenter choose which registered animal is "in front of the camera". */
  demoHintAnimalId?: string;
}

export interface BiometricEngine {
  readonly name: string;
  readonly modelVersion: string;
  readonly simulated: boolean;
  /** True when identification needs a server (cannot run offline). */
  readonly requiresNetwork: boolean;
  assessQuality(image: string): Promise<QualityReport>;
  /** Optional stricter check run on a captured photo (slower than the live readout). */
  gate?(image: string): Promise<QualityReport>;
  /** Optional: how many geometrically consistent matches two photos share (0 = not the same muzzle). */
  compareImages?(a: string, b: string): Promise<number>;
  extractTemplate(image: string): Promise<BiometricTemplate>;
  identify(probe: BiometricTemplate, gallery: GalleryEntry[], opts?: IdentifyOptions): Promise<MatchResult>;
}
