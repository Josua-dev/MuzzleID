// Supabase Edge Function: OwaMuzzle text-channel lookup (WhatsApp, SMS, USSD).
//   deploy:  supabase functions deploy lookup --no-verify-jwt
//   routes:  ?channel=whatsapp            Meta WhatsApp Cloud API webhook (GET verify + POST messages)
//            ?channel=sms&token=...       generic inbound-SMS gateway webhook
//            ?channel=ussd&token=...      USSD aggregator callback (sessionId / phoneNumber / text form fields)
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (provided by Supabase), LOOKUP_TOKEN, LOOKUP_SALT,
//          WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET, WHATSAPP_TOKEN, WHATSAPP_PHONE_ID
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  MAX_QUERIES_PER_HOUR, formatReply, gsmSafe, parseQuery, ussdRoute, ussdWrap,
  type Channel, type LookupRecord, type ParsedQuery,
} from '../_shared/lookup.ts';

const env = (k: string) => Deno.env.get(k) ?? '';
const db = () => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const sha256 = async (s: string) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
async function hmac(secret: string, body: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(body)));
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function findRecords(q: ParsedQuery): Promise<LookupRecord[]> {
  if (q.kind !== 'muzzle' && q.kind !== 'tag') return [];
  const col = q.kind === 'muzzle' ? 'muzzle_id' : 'ear_tag';
  const { data, error } = await db().from('animal_verification_view')
    .select('muzzle_id,ear_tag,breed,sex,region,status,owner_name,registered_at,open_report_at').eq(col, q.value).limit(3);
  if (error) throw error;
  return (data ?? []) as LookupRecord[];
}

/** Resolve one message to a reply. Rate-limited per salted sender hash; stores no phone numbers. */
async function answer(channel: Channel, sender: string, query: ParsedQuery): Promise<string> {
  if (query.kind === 'muzzle' || query.kind === 'tag') {
    const hash = await sha256(env('LOOKUP_SALT') + '|' + sender);
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await db().from('lookup_log').select('id', { count: 'exact', head: true }).eq('sender_hash', hash).gte('created_at', since);
    if ((count ?? 0) >= MAX_QUERIES_PER_HOUR) return 'Too many lookups from this number. Please try again in an hour.';
    const records = await findRecords(query);
    await db().from('lookup_log').insert({ channel, sender_hash: hash, query: query.value, found: records.length > 0 });
    return formatReply(query, records, channel);
  }
  return formatReply(query, [], channel);
}

const text = (body: string, status = 200) => new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

async function readFields(req: Request): Promise<Record<string, string>> {
  const ct = req.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) { const j = await req.json(); return Object.fromEntries(Object.entries(j).map(([k, v]) => [k, String(v)])); }
  const f = await req.formData();
  return Object.fromEntries([...f.entries()].map(([k, v]) => [k, String(v)]));
}

async function whatsappSend(to: string, body: string) {
  if (!env('WHATSAPP_TOKEN') || !env('WHATSAPP_PHONE_ID')) { console.error('WhatsApp send skipped: WHATSAPP_TOKEN / WHATSAPP_PHONE_ID not set'); return; }
  const r = await fetch(`${env('WHATSAPP_API_BASE') || 'https://graph.facebook.com/v21.0'}/${env('WHATSAPP_PHONE_ID')}/messages`, {
    method: 'POST', headers: { authorization: `Bearer ${env('WHATSAPP_TOKEN')}`, 'content-type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
  });
  if (!r.ok) console.error('WhatsApp send failed', r.status, await r.text());
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const channel = url.searchParams.get('channel');
  try {
    if (channel === 'whatsapp') {
      if (req.method === 'GET') { // Meta webhook verification handshake
        const ok = url.searchParams.get('hub.mode') === 'subscribe' && env('WHATSAPP_VERIFY_TOKEN') && safeEqual(url.searchParams.get('hub.verify_token') ?? '', env('WHATSAPP_VERIFY_TOKEN'));
        return ok ? text(url.searchParams.get('hub.challenge') ?? '') : text('forbidden', 403);
      }
      const raw = await req.text();
      if (!env('WHATSAPP_APP_SECRET')) return text('not configured', 500);
      const sig = (req.headers.get('x-hub-signature-256') ?? '').replace('sha256=', '');
      if (!safeEqual(sig, await hmac(env('WHATSAPP_APP_SECRET'), raw))) return text('bad signature', 401);
      const payload = JSON.parse(raw);
      const jobs: Promise<void>[] = [];
      for (const entry of payload.entry ?? []) for (const ch of entry.changes ?? []) for (const m of ch.value?.messages ?? []) {
        if (m.type !== 'text' || !m.from) continue;
        jobs.push((async () => whatsappSend(m.from, await answer('whatsapp', m.from, parseQuery(m.text?.body ?? ''))))());
      }
      await Promise.allSettled(jobs);
      return text('ok');
    }

    if (channel === 'sms' || channel === 'ussd') {
      if (!env('LOOKUP_TOKEN') || !safeEqual(url.searchParams.get('token') ?? '', env('LOOKUP_TOKEN'))) return text('forbidden', 403);
      const f = await readFields(req);
      const sender = f.phoneNumber ?? f.from ?? f.From ?? f.msisdn ?? '';
      if (!sender) return text('missing sender', 400);
      if (channel === 'sms') return text(await answer('sms', sender, parseQuery(f.text ?? f.Body ?? f.message ?? '')));
      const step = ussdRoute(f.text ?? '');
      const reply = step.query ? await answer('ussd', sender, step.query) : gsmSafe(step.reply ?? '');
      return text(ussdWrap(step.con, reply));
    }
    return text('unknown channel', 404);
  } catch (e) {
    console.error('lookup error', e);
    return channel === 'ussd' ? text('END Service busy. Try again shortly.') : channel === 'sms' ? text('OwaMuzzle is busy. Please try again shortly.') : text('error', 500);
  }
});
