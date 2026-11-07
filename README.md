# MuzzleID — Every Animal Has an Identity.

A mobile-first, offline-capable livestock digital identity and traceability **prototype**.
Farmers register cattle with a muzzle photo, get a permanent MuzzleID, and can later scan an animal
to retrieve its record, check ownership, see theft/missing status, and keep health and transfer history.

> **Prototype notice.** Muzzle matching now uses a real on-device local-feature matcher (`featureMatcher.ts`), but it is not a trained deep model and has only been benchmarked synthetically (`npx tsx scripts/bench.ts`). The scan-screen demo targets still use a simulated presenter hint. MuzzleID is an
> additional digital identification layer. It does not replace legally required livestock identification
> or branding, and no government, police, veterinary-authority or insurer integrations exist.
> All demo people, farms and records are fictional.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build && npm run preview   # production build with service worker (PWA)
```

No backend is needed: without Supabase keys the app runs in **Demo Mode** and stores everything on the device.

### Demo accounts (password `demo1234`)
| Role | Account |
|---|---|
| Farmer | Petrus Haufiku — Omuramba Farm, Omaheke |
| Veterinary | Dr. Selma Nangolo |
| Verification | Linus Tjiramba |
| Admin | MuzzleID Admin |

One-tap demo buttons are on the Sign in screen. Profile → Demo lets you switch role or reset data.

## Demo journey (all steps functional)
1. Open MuzzleID → **TRY DEMO** → Farmer.
2. Dashboard shows the herd (Total, Registered, Healthy, Missing/Stolen).
3. **Register Cattle** → details → muzzle capture (camera, upload, or *sample muzzle photo*) → simulated processing → **IDENTITY CREATED** (`MZ-NA-000847`) → identity card.
4. Animal appears in **My Livestock**.
5. **Scan** → pick `MZ-NA-000238` under *Demo scan targets* → **MATCH FOUND** with simulated confidence.
6. Scan `MZ-NA-000091` → red **ALERT — reported stolen/missing animal** → View record / Contact owner.
7. Animal profile → Ownership, Health, History, Documents tabs.
8. Profile → **Offline mode** on → register an animal → **PENDING SYNC** → Offline mode off → **SYNCING… → SYNC COMPLETE** (permanent MuzzleID issued).

Scanning an uploaded photo that was previously registered also matches (perceptual-hash simulator), and
registering the same muzzle photo twice triggers a *possible duplicate* warning.

## Architecture
```
src/
  types/models.ts            Data models (User, FarmerProfile, Animal, MuzzleBiometricRecord, OwnershipRecord,
                             HealthRecord, VaccinationRecord, MovementRecord, TheftReport, VerificationScan,
                             TransferRequest, AuditLog, OfflineSyncQueueItem …)
  services/
    store.ts                 Offline-first on-device store (localStorage) + React hooks
    actions.ts               All mutations → audit log + sync queue
    sync.ts                  Offline queue processing, deferred enrolment, Supabase push
    auth.ts                  Demo auth or Supabase Auth
    supabase.ts              Optional Supabase client, Storage upload, table mapping
    biometric/
      types.ts               BiometricEngine interface
      simulatedEngine.ts     PROTOTYPE engine (real lighting/blur checks, perceptual hash, demo hint)
      remoteEngine.ts        Adapter for a future recognition API
      index.ts               setBiometricEngine() — swap engines without touching UI
  lib/permissions.ts         Role capabilities + privacy rules (owner phone never shown to others)
  pages/                     Landing, auth, dashboards, register, scan, livestock, profile, transfer, alerts, admin
public/                      manifest.webmanifest, sw.js (offline app shell), icons, demo images
supabase/schema.sql          Tables + Row Level Security policies
```

### Replacing the simulator with a real model
Implement `BiometricEngine` (quality → template → identify) and call
`setBiometricEngine(new RemoteMuzzleEngine('https://your-api'))` at start-up. No UI changes are required.
Offline behaviour stays honest: `requiresNetwork = true` engines are never called offline.

### Connecting Supabase (optional)
1. Create a project, run `supabase/schema.sql`, create a Storage bucket `livestock`.
2. Copy `.env.example` → `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Sign-up/sign-in then uses Supabase Auth, and queued changes are upserted to the database on sync.
   (Demo accounts and seed data remain local to the device.)

## Design
Deep forest green, charcoal, warm sand accent, white and light-grey surfaces. Large touch targets,
one-hand bottom navigation with a centre **SCAN** button, high-contrast status colours
(Active green · Missing amber · Stolen red · Transfer pending blue · Pending sync sand).


## AI layer
`src/services/biometric/aiEmbedding.ts` runs a vision-transformer embedding model in the browser (downloaded on first
use, ~20-30 MB, falls back silently to the classical matcher if unavailable). It shortlists candidates when the gallery
is large and shows an informational *AI similarity* on match results. **It does not change accept/reject decisions:**
those still require geometric verification. Without muzzle data nobody can calibrate it. See `training/README.md` to
fine-tune it on real muzzle photos. `npx tsx scripts/test-ai.ts` tests the AI helper logic with synthetic vectors.

## Guided registration and quality gate
Registration now captures **front, left and right** angles (`src/components/GuidedEnrol.tsx`). Each photo must pass the
capture gate (`FeatureMatchEngine.gate`): lighting and sharpness are measured from the image, and the **pattern** check
counts real detected keypoints (poor < 45, fair < 70; calibrated with `scripts/calib-gate.ts`). Side angles are compared
with the front photo; a wrong animal or junk photo is flagged before it is stored. Front is required, side angles can be
skipped. Offline registrations store all angles and enrol them on sync. `npx tsx scripts/test-guided.ts` tests the
side-vs-front check on simulated 25-degree views.

## Text-channel verification (SMS / WhatsApp / USSD)
Check an animal with any phone by sending its MuzzleID. In-app simulator: `/app/sms`. Live service and setup:
`docs/TEXT-CHANNELS.md`. End-to-end test: `deno run -A scripts/lookup-e2e.ts`.
