import type { BiometricEngine } from './types';
import { FeatureMatchEngine } from './featureEngine';

let engine: BiometricEngine = new FeatureMatchEngine();

/** Swap in a real engine (e.g. new RemoteMuzzleEngine(url)) without touching any UI code. */
export const setBiometricEngine = (e: BiometricEngine) => { engine = e; };
export const biometrics = () => engine;
export * from './types';
