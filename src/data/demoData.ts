// Fictional Namibian demo data. All people, farms, phone numbers and records are fictional (is_demo = true).
import type {
  Animal, AuditLog, DB, FarmerProfile, HealthRecord, MovementRecord, MuzzleBiometricRecord,
  Notification, OwnershipRecord, TheftReport, TransferRequest, User, VaccinationRecord, VerificationScan, AnimalDocument,
} from '../types/models';
import { daysAgo, seeded } from '../lib/utils';

export const DB_VERSION = 4;
export const DEMO_PASSWORD = 'demo1234';
// sha256('demo1234')
const DEMO_HASH = '0ead2060b65992dca4769af601a1b3a35ef38cfad2c2c465bb160ea764157c5d';

export const DEMO_ACCOUNTS = {
  FARMER: 'u_farmer_1',
  VET: 'u_vet_1',
  VERIFIER: 'u_verifier_1',
  ADMIN: 'u_admin_1',
} as const;

const users: User[] = [
  { id: 'u_farmer_1', role: 'FARMER', full_name: 'Petrus Haufiku', phone: '+264 81 555 0101', email: 'petrus@demo.muzzleid.app', active: true, is_demo: true, password_hash: DEMO_HASH, created_at: daysAgo(330) },
  { id: 'u_farmer_2', role: 'FARMER', full_name: 'Maria Kandjii', phone: '+264 81 555 0202', email: 'maria@demo.muzzleid.app', active: true, is_demo: true, password_hash: DEMO_HASH, created_at: daysAgo(290) },
  { id: 'u_farmer_3', role: 'FARMER', full_name: 'Hendrik Tjiveze', phone: '+264 81 555 0303', email: 'hendrik@demo.muzzleid.app', active: true, is_demo: true, password_hash: DEMO_HASH, created_at: daysAgo(250) },
  { id: 'u_vet_1', role: 'VET', full_name: 'Dr. Selma Nangolo', phone: '+264 81 555 0404', email: 'vet@demo.muzzleid.app', organisation: 'Demo Veterinary Practice (fictional)', active: true, is_demo: true, password_hash: DEMO_HASH, created_at: daysAgo(300) },
  { id: 'u_verifier_1', role: 'VERIFIER', full_name: 'Linus Tjiramba', phone: '+264 81 555 0505', email: 'verify@demo.muzzleid.app', organisation: 'Demo Auction Verification Desk (fictional)', active: true, is_demo: true, password_hash: DEMO_HASH, created_at: daysAgo(280) },
  { id: 'u_admin_1', role: 'ADMIN', full_name: 'MuzzleID Admin', phone: '+264 81 555 0000', email: 'admin@demo.muzzleid.app', organisation: 'MuzzleID (prototype)', active: true, is_demo: true, password_hash: DEMO_HASH, created_at: daysAgo(360) },
];

const farmerProfiles: FarmerProfile[] = [
  { user_id: 'u_farmer_1', farm_name: 'Omuramba Farm', region: 'Omaheke' },
  { user_id: 'u_farmer_2', farm_name: 'Otjiwa Cattle Post', region: 'Otjozondjupa' },
  { user_id: 'u_farmer_3', farm_name: 'Hoanib Ridge Farm', region: 'Kunene' },
];

type Seed = [string, string, string, string | undefined, string, 'Female' | 'Male', string, string, string, string, Animal['status'], Animal['health_status'], string, number];
// [id, muzzle_id, owner, name, breed, sex, colour, birth, farm, region, status, health, photo, registeredDaysAgo]
const seeds: Seed[] = [
  ['a_238', 'MZ-NA-000238', 'u_farmer_1', 'Nangula', 'Brahman', 'Female', 'Grey-white', '2020', 'Omuramba Farm', 'Omaheke', 'ACTIVE', 'HEALTHY', '/demo/brahman.jpg', 310],
  ['a_091', 'MZ-NA-000091', 'u_farmer_1', 'Kalahari', 'Nguni', 'Female', 'Speckled brown/white', '2019', 'Omuramba Farm', 'Omaheke', 'STOLEN', 'HEALTHY', '/demo/nguni.jpg', 325],
  ['a_412', 'MZ-NA-000412', 'u_farmer_1', 'Ndapewa', 'Bonsmara', 'Female', 'Dark red', '2022', 'Omuramba Farm', 'Omaheke', 'ACTIVE', 'HEALTHY', '/demo/bonsmara.jpg', 3],
  ['a_156', 'MZ-NA-000156', 'u_farmer_1', 'Omukwaniilwa', 'Afrikaner', 'Male', 'Red', '2018', 'Seeis Post', 'Khomas', 'ACTIVE', 'HEALTHY', '/demo/afrikaner.jpg', 270],
  ['a_177', 'MZ-NA-000177', 'u_farmer_1', undefined, 'Simmentaler', 'Female', 'Red with white face', '2021', 'Omuramba Farm', 'Omaheke', 'ACTIVE', 'UNDER_TREATMENT', '/demo/simmentaler.jpg', 200],
  ['a_305', 'MZ-NA-000305', 'u_farmer_2', 'Tuli', 'Brahman', 'Female', 'Grey-white', '2021', 'Otjiwa Cattle Post', 'Otjozondjupa', 'ACTIVE', 'HEALTHY', '/demo/brahman-2.jpg', 240],
  ['a_263', 'MZ-NA-000263', 'u_farmer_2', 'Mbeja', 'Nguni', 'Female', 'Speckled brown/white', '2020', 'Otjiwa Cattle Post', 'Otjozondjupa', 'MISSING', 'HEALTHY', '/demo/nguni-2.jpg', 230],
  ['a_344', 'MZ-NA-000344', 'u_farmer_2', undefined, 'Bonsmara', 'Male', 'Dark red', '2019', 'Mariental Post', 'Hardap', 'ACTIVE', 'HEALTHY', '/demo/bonsmara-2.jpg', 180],
  ['a_198', 'MZ-NA-000198', 'u_farmer_2', 'Rooi', 'Afrikaner', 'Female', 'Red', '2021', 'Otjiwa Cattle Post', 'Otjozondjupa', 'ACTIVE', 'HEALTHY', '/demo/afrikaner-2.jpg', 150],
  ['a_521', 'MZ-NA-000521', 'u_farmer_3', 'Etosha', 'Simmentaler', 'Female', 'Red with white face', '2020', 'Hoanib Ridge Farm', 'Kunene', 'ACTIVE', 'HEALTHY', '/demo/simmentaler-2.jpg', 120],
  ['a_488', 'MZ-NA-000488', 'u_farmer_3', undefined, 'Brahman', 'Male', 'Grey-white', '2019', 'Omaruru Post', 'Erongo', 'ACTIVE', 'NEEDS_ATTENTION', '/demo/brahman-3.jpg', 75],
  ['a_602', 'MZ-NA-000602', 'u_farmer_3', 'Kaoko', 'Nguni', 'Female', 'Speckled brown/white', '2022', 'Hoanib Ridge Farm', 'Kunene', 'ACTIVE', 'HEALTHY', '/demo/nguni-3.jpg', 40],
];

const ear = (m: string) => `NA-${m.slice(-4)}`;

/** A 64-bit simulated template (hex). Real deployments would store a model embedding reference instead. */
export const seededTemplate = (key: string) => {
  const r = seeded(key);
  return Array.from({ length: 16 }, () => Math.floor(r() * 16).toString(16)).join('');
};

export function buildDemoDB(): DB {
  const animals: Animal[] = seeds.map(([id, muzzle, owner, name, breed, sex, colour, birth, farm, region, status, health, photo, ago]) => ({
    id, muzzle_id: muzzle, owner_id: owner, ear_tag: ear(muzzle), name, breed, sex, colour, birth_date: birth, farm, region,
    status, health_status: health, photo_url: photo, is_demo: true, sync_state: 'SYNCED', created_at: daysAgo(ago), updated_at: daysAgo(Math.min(ago, 5)),
  }));

  const userName = (id: string) => users.find((u) => u.id === id)!.full_name;
  const userPhone = (id: string) => users.find((u) => u.id === id)!.phone;

  const biometrics: MuzzleBiometricRecord[] = animals.map((a) => ({
    id: `b_${a.id}`, animal_id: a.id, reference_image: '/demo/muzzle.jpg', embedding_reference: seededTemplate(a.muzzle_id),
    model_version: 'sim-0.3 (simulated)', enrollment_quality: 0.86 + seeded(a.id)() * 0.12, created_at: a.created_at,
  }));

  const ownership: OwnershipRecord[] = [];
  const movements: MovementRecord[] = [];
  for (const a of animals) {
    const ago = seeds.find((s) => s[0] === a.id)![13];
    if (a.id === 'a_305') {
      // Transferred animal: originally Petrus's, now Maria's
      ownership.push({ id: 'o_305a', animal_id: a.id, owner_id: 'u_farmer_1', owner_name: userName('u_farmer_1'), owner_phone: userPhone('u_farmer_1'), farm: 'Omuramba Farm', region: 'Omaheke', start_date: daysAgo(ago), end_date: daysAgo(34), via_transfer_id: undefined });
      ownership.push({ id: 'o_305b', animal_id: a.id, owner_id: 'u_farmer_2', owner_name: userName('u_farmer_2'), owner_phone: userPhone('u_farmer_2'), farm: 'Otjiwa Cattle Post', region: 'Otjozondjupa', start_date: daysAgo(34), via_transfer_id: 't_305' });
      movements.push({ id: `m_${a.id}_r`, animal_id: a.id, event: 'REGISTERED', description: 'Muzzle identity enrolled', location: 'Omuramba Farm, Omaheke', actor_name: userName('u_farmer_1'), date: daysAgo(ago) });
      movements.push({ id: `m_${a.id}_tr`, animal_id: a.id, event: 'TRANSFER_REQUESTED', description: 'Transfer requested to Maria Kandjii', actor_name: userName('u_farmer_1'), date: daysAgo(36) });
      movements.push({ id: `m_${a.id}_t`, animal_id: a.id, event: 'OWNERSHIP_TRANSFERRED', description: 'Ownership transferred from Petrus Haufiku to Maria Kandjii', location: 'Otjiwa Cattle Post, Otjozondjupa', actor_name: userName('u_farmer_2'), date: daysAgo(34) });
    } else {
      ownership.push({ id: `o_${a.id}`, animal_id: a.id, owner_id: a.owner_id, owner_name: userName(a.owner_id), owner_phone: userPhone(a.owner_id), farm: a.farm, region: a.region, start_date: daysAgo(ago) });
      movements.push({ id: `m_${a.id}_r`, animal_id: a.id, event: 'REGISTERED', description: 'Muzzle identity enrolled', location: `${a.farm}, ${a.region}`, actor_name: userName(a.owner_id), date: daysAgo(ago) });
    }
  }

  const health: HealthRecord[] = [];
  const vaccinations: VaccinationRecord[] = [];
  const vet = { recorded_by_id: 'u_vet_1', recorded_by_name: 'Dr. Selma Nangolo', recorded_by_role: 'VET' as const };
  const addVacc = (aid: string, ago: number, vaccine: string, dose: string, next: number) => {
    const id = `h_${aid}_v${ago}`;
    health.push({ id, animal_id: aid, type: 'VACCINATION', title: vaccine, date: daysAgo(ago), ...vet, notes: 'Routine vaccination (demo record).', created_at: daysAgo(ago) });
    vaccinations.push({ id: `v_${id}`, health_record_id: id, vaccine, dose, batch: `DEMO-${(ago * 37) % 9000 + 1000}`, next_due: daysAgo(-next) });
    movements.push({ id: `m_${id}`, animal_id: aid, event: 'VACCINATED', description: `${vaccine} administered`, actor_name: vet.recorded_by_name, date: daysAgo(ago) });
  };
  const addHealth = (aid: string, ago: number, type: HealthRecord['type'], title: string, notes: string, medication?: string) => {
    const id = `h_${aid}_${type}${ago}`;
    health.push({ id, animal_id: aid, type, title, medication, date: daysAgo(ago), ...vet, notes, created_at: daysAgo(ago) });
    const ev = type === 'TREATMENT' ? 'TREATED' : 'EXAMINED';
    movements.push({ id: `m_${id}`, animal_id: aid, event: ev, description: title, actor_name: vet.recorded_by_name, date: daysAgo(ago) });
  };

  for (const a of animals) {
    const ago = seeds.find((s) => s[0] === a.id)![13];
    if (ago > 60) addVacc(a.id, Math.max(10, ago - 20), 'Anthrax & Blackquarter', '2 ml SC', 345);
    if (ago > 120) addVacc(a.id, Math.max(8, ago - 100), 'Lumpy Skin Disease', '1 ml SC', 300);
  }
  addHealth('a_238', 21, 'EXAMINATION', 'General health examination', 'Body condition score 3.5/5. No abnormalities found.');
  addHealth('a_238', 18, 'TEST_NOTE', 'Brucellosis test: negative', 'Blood sample taken; result recorded from paper certificate (demo).');
  addHealth('a_177', 6, 'TREATMENT', 'Treatment for tick-borne infection', 'Mild fever observed. Follow-up in 7 days.', 'Oxytetracycline LA');
  addHealth('a_488', 4, 'EXAMINATION', 'Lameness check, hind left', 'Monitor; re-examine next visit.');
  addHealth('a_156', 95, 'TREATMENT', 'Wound treatment after recovery', 'Minor abrasions on flank, cleaned and treated.', 'Topical antiseptic spray');

  // Recovered history for a_156
  movements.push({ id: 'm_156_miss', animal_id: 'a_156', event: 'REPORTED_MISSING', description: 'Reported missing from camp 4', location: 'Seeis Post, Khomas', actor_name: 'Petrus Haufiku', date: daysAgo(102) });
  movements.push({ id: 'm_156_rec', animal_id: 'a_156', event: 'RECOVERED', description: 'Found at neighbouring farm and verified by muzzle scan', location: 'Seeis area, Khomas', actor_name: 'Petrus Haufiku', date: daysAgo(97) });

  const theftReports: TheftReport[] = [
    { id: 'tr_091', animal_id: 'a_091', type: 'STOLEN', reported_at: daysAgo(12, 7), last_seen_date: daysAgo(13, 18), last_seen_location: 'Omuramba Farm, northern camp, Omaheke', description: 'Speckled brown/white Nguni cow with curved horns. Fence cut on northern boundary.', status: 'OPEN', reported_by_id: 'u_farmer_1' },
    { id: 'tr_263', animal_id: 'a_263', type: 'MISSING', reported_at: daysAgo(5, 8), last_seen_date: daysAgo(6, 17), last_seen_location: 'Otjiwa Cattle Post, water point 2', description: 'Nguni cow, speckled, did not return from grazing.', status: 'OPEN', reported_by_id: 'u_farmer_2' },
    { id: 'tr_156', animal_id: 'a_156', type: 'MISSING', reported_at: daysAgo(102), last_seen_location: 'Seeis Post, camp 4', description: 'Red Afrikaner bull.', status: 'RESOLVED', reported_by_id: 'u_farmer_1', resolved_at: daysAgo(97) },
  ];
  movements.push({ id: 'm_091_s', animal_id: 'a_091', event: 'REPORTED_STOLEN', description: 'Reported stolen: fence cut on northern boundary', location: 'Omuramba Farm, Omaheke', actor_name: 'Petrus Haufiku', date: daysAgo(12, 7) });
  movements.push({ id: 'm_263_m', animal_id: 'a_263', event: 'REPORTED_MISSING', description: 'Did not return from grazing', location: 'Otjiwa Cattle Post, Otjozondjupa', actor_name: 'Maria Kandjii', date: daysAgo(5, 8) });

  const transfers: TransferRequest[] = [
    { id: 't_305', animal_id: 'a_305', seller_id: 'u_farmer_1', buyer_name: 'Maria Kandjii', buyer_phone: '+264 81 555 0202', buyer_user_id: 'u_farmer_2', status: 'ACCEPTED', created_at: daysAgo(36), completed_at: daysAgo(34) },
  ];

  const scans: VerificationScan[] = [];
  const scanPlan: [number, string | undefined, VerificationScan['result'], string, number][] = [
    [0, 'a_238', 'MATCH', 'u_verifier_1', 9], [0, 'a_521', 'MATCH', 'u_vet_1', 10], [0, 'a_344', 'MATCH', 'u_verifier_1', 11],
    [0, undefined, 'NO_MATCH', 'u_verifier_1', 12], [0, 'a_198', 'MATCH', 'u_farmer_2', 8],
    [1, 'a_412', 'MATCH', 'u_farmer_1', 9], [1, 'a_602', 'MATCH', 'u_farmer_3', 14], [2, 'a_091', 'ALERT', 'u_verifier_1', 10],
    [3, 'a_305', 'MATCH', 'u_verifier_1', 13], [4, 'a_177', 'MATCH', 'u_vet_1', 9], [5, 'a_488', 'MATCH', 'u_vet_1', 15], [6, 'a_156', 'MATCH', 'u_farmer_1', 8],
  ];
  scanPlan.forEach(([d, aid, result, by, hr], i) => {
    const u = users.find((x) => x.id === by)!;
    scans.push({ id: `s_${i}`, animal_id: aid, scanned_by_id: by, scanned_by_role: u.role, result, confidence: aid ? 94 + ((i * 13) % 50) / 10 : undefined, simulated: true, mode: 'SERVER', created_at: daysAgo(d, hr) });
  });

  const documents: AnimalDocument[] = [
    { id: 'd_1', animal_id: 'a_238', kind: 'VACCINATION', file_name: 'vaccination-card-demo.pdf', size_kb: 214, uploaded_by_name: 'Dr. Selma Nangolo', uploaded_at: daysAgo(18) },
    { id: 'd_2', animal_id: 'a_305', kind: 'OWNERSHIP', file_name: 'sale-agreement-demo.pdf', size_kb: 132, uploaded_by_name: 'Petrus Haufiku', uploaded_at: daysAgo(35) },
  ];

  const audit: AuditLog[] = [
    { id: 'l1', actor_id: 'u_farmer_1', actor_name: 'Petrus Haufiku', actor_role: 'FARMER', action: 'ANIMAL_REGISTERED', target: 'MZ-NA-000412', created_at: daysAgo(3, 10) },
    { id: 'l2', actor_id: 'u_farmer_1', actor_name: 'Petrus Haufiku', actor_role: 'FARMER', action: 'THEFT_REPORTED', target: 'MZ-NA-000091', details: 'Reported STOLEN', created_at: daysAgo(12, 7) },
    { id: 'l3', actor_id: 'u_verifier_1', actor_name: 'Linus Tjiramba', actor_role: 'VERIFIER', action: 'SCAN_ALERT', target: 'MZ-NA-000091', details: 'Scan matched a stolen/missing record (simulated)', created_at: daysAgo(2, 10) },
    { id: 'l4', actor_id: 'u_farmer_2', actor_name: 'Maria Kandjii', actor_role: 'FARMER', action: 'THEFT_REPORTED', target: 'MZ-NA-000263', details: 'Reported MISSING', created_at: daysAgo(5, 8) },
    { id: 'l5', actor_id: 'u_vet_1', actor_name: 'Dr. Selma Nangolo', actor_role: 'VET', action: 'HEALTH_RECORD_ADDED', target: 'MZ-NA-000238', details: 'Vaccination: Anthrax & Blackquarter', created_at: daysAgo(18, 11) },
    { id: 'l6', actor_id: 'u_farmer_2', actor_name: 'Maria Kandjii', actor_role: 'FARMER', action: 'TRANSFER_ACCEPTED', target: 'MZ-NA-000305', created_at: daysAgo(34, 15) },
    { id: 'l7', actor_id: 'u_vet_1', actor_name: 'Dr. Selma Nangolo', actor_role: 'VET', action: 'HEALTH_RECORD_ADDED', target: 'MZ-NA-000177', details: 'Treatment: tick-borne infection', created_at: daysAgo(6, 12) },
    { id: 'l8', actor_id: 'u_verifier_1', actor_name: 'Linus Tjiramba', actor_role: 'VERIFIER', action: 'SCAN_MATCH', target: 'MZ-NA-000238', details: 'Ownership verified (simulated match)', created_at: daysAgo(0, 9) },
  ];

  const notifications: Notification[] = [
    { id: 'n1', user_id: 'u_farmer_1', kind: 'ALERT', title: 'Scan match on your stolen animal', body: 'MZ-NA-000091 was scanned by an authorised verification user (demo). Use “Contact” to follow up.', animal_id: 'a_091', read: false, created_at: daysAgo(2, 10) },
    { id: 'n2', user_id: 'u_farmer_1', kind: 'INFO', title: 'Vaccination due soon', body: 'Lumpy Skin Disease booster for MZ-NA-000177 is due within 30 days (demo).', animal_id: 'a_177', read: false, created_at: daysAgo(1, 8) },
    { id: 'n3', user_id: 'u_farmer_2', kind: 'TRANSFER', title: 'Transfer complete', body: 'You are now the registered owner of MZ-NA-000305.', animal_id: 'a_305', read: true, created_at: daysAgo(34, 15) },
  ];

  return {
    version: DB_VERSION, users, farmerProfiles, animals, biometrics, ownership, health, vaccinations, movements,
    theftReports, scans, transfers, documents, audit, notifications, syncQueue: [], nextSequence: 847,
  };
}
