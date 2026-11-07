# Go live: WhatsApp lookup in about 30 minutes

You need: a Supabase account, a Meta (Facebook) developer account, a phone with WhatsApp.

## 1. Database
1. supabase.com > New project. Note the **Project ref** (the part of the URL before `.supabase.co`).
2. SQL Editor > run `supabase/schema.sql`, then `supabase/seed-demo.sql` (12 demo animals, including one STOLEN: `MZ-NA-000091`).
   The seed is fake demo data. Regenerate it any time with `npx tsx scripts/make-seed-sql.ts`.

## 2. Deploy the function
```
npm i -g supabase          # or: npx supabase ...
supabase login
supabase link --project-ref <ref>
supabase secrets set LOOKUP_SALT=$(openssl rand -hex 16) LOOKUP_TOKEN=$(openssl rand -hex 16)
supabase functions deploy lookup --no-verify-jwt
```
(On Windows, replace `$(openssl rand -hex 16)` with any long random string.)

## 3. Smoke-test before touching WhatsApp
```
curl -X POST "https://<ref>.functions.supabase.co/lookup?channel=sms&token=<LOOKUP_TOKEN>" -d from=+264810000000 -d text=MZ-NA-000238
curl -X POST "https://<ref>.functions.supabase.co/lookup?channel=sms&token=<LOOKUP_TOKEN>" -d from=+264810000000 -d text=MZ-NA-000091
```
Expected: an ACTIVE reply, then `ALERT ... REPORTED STOLEN ... DO NOT BUY`. If you get "No OwaMuzzle record", the seed did not run.

## 4. WhatsApp (Meta Cloud API)
1. developers.facebook.com > Create app > type **Business** > add the **WhatsApp** product.
2. WhatsApp > API Setup: copy the **Phone number ID** and a **temporary access token** (for a lasting token create a System User token).
   Add your own phone under "To" and verify it.
3. App settings > Basic: copy the **App secret**.
4. `supabase secrets set WHATSAPP_VERIFY_TOKEN=<any string you choose> WHATSAPP_APP_SECRET=<app secret> WHATSAPP_TOKEN=<access token> WHATSAPP_PHONE_ID=<phone number id>`
5. WhatsApp > Configuration > Webhook: callback URL `https://<ref>.functions.supabase.co/lookup?channel=whatsapp`, verify token = your `WHATSAPP_VERIFY_TOKEN`, then Verify and save. Subscribe to the **messages** field.
6. From your phone, message the test number: `MZ-NA-000238`.

## If it does not work
- Verify fails: `WHATSAPP_VERIFY_TOKEN` differs from what you typed in Meta, or the function was not deployed with `--no-verify-jwt`.
- No reply: `supabase functions logs lookup` (or Dashboard > Edge Functions > lookup > Logs). "bad signature" means a wrong `WHATSAPP_APP_SECRET`; "WhatsApp send failed" shows Meta's error (often an expired token or an un-verified recipient).
- Test numbers only message recipients you added; messages outside 24 hours of the user's last message need an approved template (not needed for replies to a user who just wrote to you).
