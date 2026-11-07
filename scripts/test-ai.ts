import { l2, cosine, encodeEmbedding, decodeEmbedding, shortlist } from '../src/services/biometric/aiEmbedding';
import { deserialize, serialize, extractFeatures } from '../src/services/biometric/featureMatcher';
let seed = 7; const r = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const g = () => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
const vec = (d = 768) => l2(Float32Array.from({ length: d }, g));
let ok = true; const check = (n: string, c: boolean) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) ok = false; };

const v = vec(); const dec = decodeEmbedding(encodeEmbedding(v))!;
check(`int8 round-trip keeps direction (cos=${cosine(v, dec).toFixed(4)})`, cosine(v, dec) > 0.99);
check('embedding is ~1 KB', encodeEmbedding(v).length < 1100);

// 200 animals; probe = noisy copy of animal 137's embedding
const gallery = Array.from({ length: 200 }, (_, i) => ({ animalId: 'a' + i, emb: vec() }));
const probe = l2(Float32Array.from(gallery[137].emb!, (x) => x + 0.6 * g() / Math.sqrt(768)));
const { keep, sims } = shortlist(probe, gallery, 12);
check(`shortlist cuts 200 animals to ${keep.size}`, keep.size === 12);
check('true animal survives the shortlist', keep.has('a137'));
check(`similarity of true animal (${sims.get('a137')!.toFixed(2)}) > impostors`, [...sims].every(([id, s]) => id === 'a137' || s < sims.get('a137')!));

// small gallery: everything kept, AI can't hide anyone
check('gallery <= K keeps everyone', shortlist(probe, gallery.slice(0, 10), 12).keep.size === 10);
// animals without embeddings are always kept
const mixed = [...gallery.slice(0, 50), { animalId: 'legacy', emb: null }];
check('animals with no embedding are never dropped', shortlist(probe, mixed, 12).keep.has('legacy'));
check('no probe embedding -> verify everyone', shortlist(null, gallery, 12).keep.size === 200);

// templates carrying an embedding suffix still parse
const f = extractFeatures(Float32Array.from({ length: 256 * 256 }, () => r() * 255));
const ref = serialize(f) + '#' + encodeEmbedding(v);
check('feature template parses with AI suffix', deserialize(ref)?.n === f.n);
console.log(ok ? '\nALL PASSED' : '\nFAILURES'); process.exit(ok ? 0 : 1);
