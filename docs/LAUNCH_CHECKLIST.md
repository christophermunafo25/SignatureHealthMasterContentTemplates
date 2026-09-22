# Launch checklist — Signature HealthCARE Content Portal v2.1

Steps that cannot be enforced from the repository. Verify by hand and
record the result before the client-facing launch.

## Supabase dashboard (Authentication)
| Setting | Required | Status |
|---|---|---|
| Allow new users to sign up | **Off** (invite-only; the UI signup is already removed) | ☑ 2026-07-29 (Management API) |
| Confirm email | **On** | ☑ (autoconfirm off) |
| Minimum password length | **12** | ☑ 2026-07-29 |
| Leaked password protection | **On** | ☐ |
| Site URL | Production domain | ☑ 2026-07-29 |
| Additional redirect URLs | `https://signaturehealthcare-graphics.vercel.app/**` + `http://localhost:5199/**` (wildcards — auth emails redirect to `/admin`, not the origin root) | ☑ 2026-07-29 |
| Custom SMTP for auth email | **Required for launch** — the built-in sender allows 2 emails/hour (this is what makes invites fail after testing). Point it at the SendGrid account used for submission notifications so invites and notifications share an authenticated sending domain. Full procedure below. | ☐ |
| JWT expiry | Confirm and record | ☐ |
| MFA | Decision required (open question) | ☐ |

## Search indexing
| Item | Required | Status |
|---|---|---|
| `noindex, nofollow` meta in `index.html` | Shipped in-repo | ☑ 2026-07-29 |
| `public/robots.txt` disallowing `/` | Shipped in-repo | ☑ 2026-07-29 |

## Stray-workspace audit (one workspace only)
Run before launch and after any dev-account activity:
`select count(*) from companies;` (expect 1) and
`select company_id, count(*) from memberships where role='admin' group by company_id;` (expect one group).
**Run 2026-07-29: 1 company (`signature-healthcare`), all admins on it, 0
orphaned auth users. Clean.**

**First admin bootstrapped 2026-07-29**: company `signature-healthcare`
created; christophermunafo25@gmail.com invited via the GoTrue admin API
and attached as admin. Invite/recovery links now land on an in-app
set-password gate. All further admins: People page → Invite.

## Edge Function secrets (`supabase secrets set`)
| Secret | Purpose | Status |
|---|---|---|
| `SENDGRID_API_KEY` | Submission + decline notifications | ☑ 2026-09-17 |
| `NOTIFICATION_FROM_EMAIL` | Sending address, e.g. admin@themercenarynetwork.com | ☑ 2026-09-17 |
| `NOTIFICATION_FROM_NAME` | Display name on outgoing mail — `Social Submission` | ☑ 2026-09-22 |
| `PUBLIC_APP_URL` | Review deep links in email (set) | ☑ |
| Sender Authentication complete in SendGrid | Domain authentication preferred over single-sender | ☐ |

`supabase secrets list` exposes only a SHA-256 digest of each value, so
a checkmark above confirms a secret is **set**, not that its value is
correct. Confirm the actual From address and display name from the From
line on a delivered notification or the SendGrid Activity Feed.

**Sender Authentication is not optional.** An unverified From address
fails at send time with a 403, not at deploy time — the functions deploy
cleanly and then drop every notification. Verify before launch day, not
after the first missed submission.

**SPF and DKIM records** for the sending domain must be in place or
notifications land in spam. The sender lives on the agency's own
domain, so with SendGrid domain authentication these are **CNAME
records that SendGrid generates** for you (Settings → Sender
Authentication → Authenticate Your Domain); the agency adds that
generated set at its own registrar. Complete before launch day.

## Custom SMTP for auth email (SendGrid relay)
Invite, recovery, and confirmation mail does **not** go through
`_shared/email.ts` — `invite-member` uses the GoTrue admin API, so those
send from Supabase's built-in mailer, which is capped at **2 emails per
hour**. That cap is what makes invites fail after a round of testing, and
it is why the batch `mode: "link"` path exists as a workaround. Pointing
Auth at SendGrid removes the cap and puts invites on the same
authenticated domain as submission notifications.

Do this **after** Sender Authentication is complete — the relay
authenticates fine with an unverified sender and then rejects the mail.

Dashboard → Project Settings → Authentication → SMTP Settings:

| Field | Value |
|---|---|
| Enable Custom SMTP | On |
| Host | `smtp.sendgrid.net` |
| Port | `587` |
| Username | `apikey` (the literal string — not the key, not an email) |
| Password | the SendGrid API key |
| Sender email | admin@themercenarynetwork.com (same as `NOTIFICATION_FROM_EMAIL`) |
| Sender name | e.g. Signature Content |

| Step | Status |
|---|---|
| SMTP relay configured in dashboard | ☐ |
| Rate limits raised (Auth → Rate Limits — the per-hour email cap stays in force until this is raised separately) | ☐ |
| Test invite delivered end to end, confirmed in SendGrid Activity Feed | ☐ |
| More than 2 invites sent within one hour to prove the cap is gone | ☐ |

A dedicated API key for SMTP (Mail Send permission only) is worth
creating rather than reusing the Edge Function key — it can be rotated
without taking submission notifications down with it.

**This is deliberately not in `supabase/config.toml`.** See the comment
at the top of that file: `supabase config push` would send the file as
the complete config, and every auth key missing from it would land as a
CLI default — flipping `enable_signup` back on and dropping the minimum
password length from 12 to 6.

## Vercel preview deployments
`vite.config.ts` refuses a production build when `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` are unset — a production bundle without
Supabase config would silently ship the localStorage dev backend.
Vercel builds PR previews in production mode, so until those two
variables are set in the Vercel project's **Preview** environment
(Settings → Environment Variables), the Vercel check fails on every
PR, including docs-only ones. The anon key is client-safe by design;
security comes from RLS.

| Item | Status |
|---|---|
| `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` set in the Vercel Preview environment | ☑ 2026-09-17 (Vercel CLI, values verified against `.env`) |

## Submission notifications carry download links (access boundary)
The Signature team works the queue from the inbox rather than signing
in, so the team notification email lists **every uploaded file as a
direct download link**. Those are signed Storage URLs on the private
`submissions` bucket, valid for **30 days**, and they carry their own
authorization — anyone holding the email can download the content
without an account. This extends what the embedded preview image has
always done, from one file to all of them.

Consequences worth being deliberate about:
- `companies.notification_emails` (Settings → submission notifications)
  is now the effective access boundary for submitted media. Adding an
  address grants 30-day access to everything submitted from then on.
- Forwarding a notification forwards working download links.
- Submissions can contain resident and minor imagery covered by the
  release form, so treat the recipient list as PHI-adjacent.

Revoking early means deleting the object or rotating the bucket; there
is no per-link revocation. If that tradeoff stops being acceptable,
shorten the expiry in `_shared/email.ts` (one constant, used by both
the preview and the download list).

| Item | Status |
|---|---|
| Recipient list reviewed with the client against the above | ☐ |

## One-time tenant provisioning (after the Signature company exists)
1. Sign in as the Signature admin, confirm company slug is
   `signature-healthcare` (or edit the script).
2. Run `scripts/signature-facilities-provision.sql` in the SQL editor —
   expect 69 facilities.
3. Get each facility's **state** from Signature (disambiguates
   Elizabethton/Elizabethtown in the picker) and fill `facilities.state`.
4. Portal Access → Generate portal link → print QR sheets.
5. Settings → add `shcsocial@signaturehealthcarellc.com` to submission
   notifications.

## Remaining manual QA
- Real-device pass: iOS Safari and Android Chrome on the facility flow.
- Two-company tenant isolation pass with real admin accounts.
- Decline email delivery once SendGrid + Sender Authentication are live.

## Root-URL public portal
The bare production URL can serve the facility portal directly (Portal
Access → "Public portal at the site address", default **off**). Decide
with the client whether root access stays link-only or goes public —
turning it on makes the template library reachable by anyone who finds
the domain, and makes link rotation moot for root visitors.
| Decision | Status |
|---|---|
| Public portal at the root URL: on or off for launch | ☐ |

## Open client questions (from the v2.1 spec)
Shared-link distribution method (grace period length), roster ownership,
resident-photo consent/retention (in writing), submission retention
window, posting platforms (to trim the canvas catalog), MFA policy,
repo visibility, hosting region.
