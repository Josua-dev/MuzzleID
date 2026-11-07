# SMS, WhatsApp and USSD lookup

Lets a buyer, auctioneer or checkpoint check an animal with any phone. They send a MuzzleID (or `TAG NA-0238`)
and get back the register status: breed, region, owner initials, registration month, and whether an open theft or
missing report exists. Replies never contain a phone number, address or farm. A lookup proves what the *register*
says about the ID typed; it cannot prove the animal in front of you is that animal, and every reply says to confirm by
muzzle scan.

Code: `supabase/functions/_shared/lookup.ts` (rules), `supabase/functions/lookup/index.ts` (webhooks),
`src/pages/VerifyBySms.tsx` (in-app simulator at `/app/sms`).

## What works without a telecom contract
**WhatsApp** (Meta Cloud API). Needs a Meta developer account and a WhatsApp Business phone number. No operator deal.
**SMS two-way and USSD** need a local arrangement (see below). Until then the in-app simulator demonstrates the flow.

See `docs/GO-LIVE.md` for the short checklist.

## Set up (WhatsApp)
1. Run the new section at the end of `supabase/schema.sql` (creates `lookup_log` and adds `registered_at` to the view).
2. Deploy: `supabase functions deploy lookup --no-verify-jwt`
3. Secrets: `supabase secrets set LOOKUP_SALT=<random> LOOKUP_TOKEN=<random> WHATSAPP_VERIFY_TOKEN=<random> WHATSAPP_APP_SECRET=<meta app secret> WHATSAPP_TOKEN=<system user token> WHATSAPP_PHONE_ID=<phone number id>`
4. In the Meta app, WhatsApp > Configuration: callback URL `https://<project-ref>.functions.supabase.co/lookup?channel=whatsapp`,
   verify token = `WHATSAPP_VERIFY_TOKEN`, subscribe to the `messages` field.
5. Message the number from a phone. Meta's test number only allows a few pre-approved recipients; production needs business verification.

Requests are authenticated by Meta's `X-Hub-Signature-256` HMAC; unsigned requests are rejected.

## SMS and USSD
- **Inbound SMS / USSD in Namibia needs an operator or aggregator.** One pricing guide reports that Twilio offers only outbound SMS
  in Namibia; confirm current availability with each provider. MTC is the largest network (about 86% of subscribers in one
  directory's figures), so start there or with an aggregator that already has a Namibian short code.
- Ask the provider for: a long number or short code, USSD service code, and a webhook that can call
  `.../lookup?channel=sms&token=<LOOKUP_TOKEN>` (fields `from`/`text`, or Twilio-style `From`/`Body`) and
  `.../lookup?channel=ussd&token=<LOOKUP_TOKEN>` (fields `phoneNumber`, `sessionId`, `text`; reply `CON ...`/`END ...`).
  If a provider uses different field names or a response envelope, adapt `readFields` / the return in `index.ts`.
- Check any CRAN (Communications Regulatory Authority of Namibia) requirements for short codes and bulk messaging before launch.

## Safeguards built in
- 20 lookups per sender per hour. Sender numbers are stored only as salted hashes (`lookup_log`).
- Owner shown as initials only; no contact details. "Not found" is worded so it never implies theft or legality.
- Replies are plain GSM-7 text; an SMS reply is one 160-character segment, a USSD reply fits one screen.

## Tests
`deno run -A scripts/lookup-e2e.ts` runs the real function against a mock database and mock WhatsApp API (25 checks:
parsing, privacy, stolen alert, USSD menus, signature check, rate limit).
