// End-to-end test for the lookup Edge Function. Run:  deno run -A scripts/lookup-e2e.ts
// Starts a MOCK PostgREST + WhatsApp Graph API, loads the real function, and drives it with webhook requests.
const MOCK = 54399, FN = 8000;
const rec = (o: Record<string, unknown>) => ({ breed: 'Brahman', sex: 'Female', region: 'Omaheke', status: 'ACTIVE', owner_name: 'Josua Hafeni Uuyuni', registered_at: '2026-03-02T10:00:00Z', open_report_at: null, ...o });
const VIEW = [
  rec({ muzzle_id: 'MZ-NA-000238', ear_tag: 'NA-0238' }),
  rec({ muzzle_id: 'MZ-NA-000091', ear_tag: 'NA-0091', status: 'STOLEN', open_report_at: '2026-10-12T08:00:00Z', breed: 'Nguni', sex: 'Male' }),
  rec({ muzzle_id: 'MZ-NA-000500', ear_tag: 'NA-DUP' }), rec({ muzzle_id: 'MZ-NA-000501', ear_tag: 'NA-DUP' }),
];
const counts = new Map<string, number>(); const sent: { to: string; body: string }[] = [];
Deno.serve({ port: MOCK, onListen() {} }, async (req) => {
  const u = new URL(req.url);
  if (u.pathname.startsWith('/graph/')) { const j = await req.json(); sent.push({ to: j.to, body: j.text.body }); return Response.json({ ok: true }); }
  if (u.pathname.endsWith('/animal_verification_view')) {
    const m = u.searchParams.get('muzzle_id'), t = u.searchParams.get('ear_tag');
    const rows = VIEW.filter((r) => (m ? `eq.${r.muzzle_id}` === m : t ? `eq.${r.ear_tag}` === t : false));
    return Response.json(rows);
  }
  if (u.pathname.endsWith('/lookup_log')) {
    if (req.method === 'POST') { const j = await req.json(); counts.set(j.sender_hash, (counts.get(j.sender_hash) ?? 0) + 1); return new Response(null, { status: 201 }); }
    const h = (u.searchParams.get('sender_hash') ?? '').replace('eq.', ''); const n = counts.get(h) ?? 0;
    return new Response(null, { status: 200, headers: { 'content-range': n ? `0-${n - 1}/${n}` : '*/0' } });
  }
  return new Response('nope', { status: 404 });
});

Deno.env.set('SUPABASE_URL', `http://localhost:${MOCK}`); Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test');
Deno.env.set('LOOKUP_TOKEN', 'tok'); Deno.env.set('LOOKUP_SALT', 'salt'); Deno.env.set('WHATSAPP_VERIFY_TOKEN', 'vt');
Deno.env.set('WHATSAPP_APP_SECRET', 'appsecret'); Deno.env.set('WHATSAPP_TOKEN', 'wt'); Deno.env.set('WHATSAPP_PHONE_ID', '123');
Deno.env.set('WHATSAPP_API_BASE', `http://localhost:${MOCK}/graph`);
await import('../supabase/functions/lookup/index.ts');
await new Promise((r) => setTimeout(r, 400));

let fails = 0;
const check = (n: string, c: boolean, extra = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c || !extra ? '' : '  -> ' + extra)); if (!c) fails++; };
const base = `http://localhost:${FN}/`;
const sms = async (t: string, from = '+264810000001', tok = 'tok') => { const r = await fetch(`${base}?channel=sms&token=${tok}`, { method: 'POST', body: new URLSearchParams({ from, text: t }) }); return { status: r.status, body: await r.text() }; };
const ussd = async (t: string, from = '+264810000002') => (await (await fetch(`${base}?channel=ussd&token=tok`, { method: 'POST', body: new URLSearchParams({ phoneNumber: from, sessionId: 's', text: t }) })).text());
const hmac = async (b: string) => { const k = await crypto.subtle.importKey('raw', new TextEncoder().encode('appsecret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return [...new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(b)))].map((x) => x.toString(16).padStart(2, '0')).join(''); };

// --- SMS
let r = await sms('MZ-NA-000238');
check('SMS active animal', r.status === 200 && r.body.includes('ACTIVE') && r.body.includes('J.U.') && r.body.includes('Brahman F'), r.body);
check('SMS reply fits 2 segments and is plain ASCII', r.body.length <= 320 && /^[\x20-\x7E\n]*$/.test(r.body), String(r.body.length));
check('SMS never leaks full owner name', !r.body.includes('Josua') && !r.body.includes('Uuyuni') && !/\+?\d{9,}/.test(r.body));
check('SMS says it is an ID check only', /scan/i.test(r.body));
r = await sms('mz na 238'); check('SMS tolerant parsing ("mz na 238")', r.body.includes('MZ-NA-000238'), r.body);
r = await sms('MZ-NA-000091'); check('SMS stolen animal warns DO NOT BUY', r.body.startsWith('ALERT') && r.body.includes('DO NOT BUY') && r.body.includes('12 Oct 2026'), r.body);
r = await sms('MZ-NA-999999'); check('SMS unknown id: not-found, no accusation', r.body.includes('No MuzzleID record') && r.body.includes('does not prove'), r.body);
r = await sms('TAG NA-0238'); check('SMS lookup by ear tag', r.body.includes('MZ-NA-000238'), r.body);
r = await sms('TAG NA-DUP'); check('SMS duplicate ear tag asks for full ID', r.body.includes('2 animals share tag'), r.body);
r = await sms('banana'); check('SMS gibberish gets help', r.body.includes('Not understood'), r.body);
r = await sms('help'); check('SMS help', r.body.includes('MuzzleID check'), r.body);
r = await sms('MZ-NA-000238', '+264810000001', 'wrong'); check('SMS wrong token rejected', r.status === 403);

// --- USSD
check('USSD main menu', (await ussd('')).startsWith('CON MuzzleID'));
check('USSD asks for ID', (await ussd('1')).startsWith('CON Enter MuzzleID'));
let u = await ussd('1*MZ-NA-000091'); check('USSD stolen result ends session, <=182 chars', u.startsWith('END ALERT') && u.length <= 182, u);
u = await ussd('1*MZ-NA-000238'); check('USSD active result fits one USSD screen', u.startsWith('END MZ-NA-000238') && u.length <= 182, `${u.length}: ${u}`);
u = await ussd('2*NA-0238'); check('USSD ear-tag path', u.startsWith('END MZ-NA-000238'), u);
check('USSD help', (await ussd('3')).startsWith('END MuzzleID check'));

// --- WhatsApp
let g = await fetch(`${base}?channel=whatsapp&hub.mode=subscribe&hub.verify_token=vt&hub.challenge=abc123`);
check('WhatsApp webhook verification', g.status === 200 && (await g.text()) === 'abc123');
g = await fetch(`${base}?channel=whatsapp&hub.mode=subscribe&hub.verify_token=bad&hub.challenge=x`); check('WhatsApp verification rejects bad token', g.status === 403);
const payload = (from: string, body: string) => JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ from, type: 'text', text: { body } }] } }] }] });
let p = payload('264811112222', 'MZ-NA-000238');
g = await fetch(`${base}?channel=whatsapp`, { method: 'POST', body: p, headers: { 'x-hub-signature-256': 'sha256=' + 'a'.repeat(64) } }); check('WhatsApp POST with bad signature rejected', g.status === 401); await g.text();
g = await fetch(`${base}?channel=whatsapp`, { method: 'POST', body: p, headers: { 'x-hub-signature-256': 'sha256=' + await hmac(p) } }); await g.text();
check('WhatsApp signed message accepted and answered', g.status === 200 && sent.length === 1 && sent[0].to === '264811112222' && sent[0].body.includes('ACTIVE') && sent[0].body.includes('scan its muzzle'), JSON.stringify(sent));
p = payload('264811112222', 'MZ-NA-000091');
g = await fetch(`${base}?channel=whatsapp`, { method: 'POST', body: p, headers: { 'x-hub-signature-256': 'sha256=' + await hmac(p) } }); await g.text();
check('WhatsApp stolen warning', sent.at(-1)?.body.includes('DO NOT BUY') === true);

// --- rate limit: 20 lookups per hour per sender
const who = '+264819999999'; let last = '';
for (let i = 0; i < 21; i++) last = (await sms('MZ-NA-000238', who)).body;
check('Rate limit blocks the 21st lookup in an hour', last.startsWith('Too many lookups'), last);
r = await sms('MZ-NA-000238', '+264818888888'); check('Rate limit is per sender', r.body.includes('ACTIVE'));
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); Deno.exit(fails ? 1 : 0);
