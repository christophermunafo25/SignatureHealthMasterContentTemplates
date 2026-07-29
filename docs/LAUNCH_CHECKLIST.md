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
| Additional redirect URLs | Production + `http://localhost:5199` | ☑ 2026-07-29 |
| JWT expiry | Confirm and record | ☐ |
| MFA | Decision required (open question) | ☐ |

**First admin bootstrapped 2026-07-29**: company `signature-healthcare`
created; christophermunafo25@gmail.com invited via the GoTrue admin API
and attached as admin. Invite/recovery links now land on an in-app
set-password gate. All further admins: People page → Invite.

## Edge Function secrets (`supabase secrets set`)
| Secret | Purpose | Status |
|---|---|---|
| `RESEND_API_KEY` | Submission + decline notifications | ☐ |
| `NOTIFICATION_FROM_EMAIL` | Sending address, e.g. content@mail.<domain> | ☐ |
| `PUBLIC_APP_URL` | Review deep links in email (set) | ☑ |

**SPF and DKIM records** for the sending domain must be added by
Signature IT or notifications land in spam. Raise before launch day.

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
- Decline email delivery once Resend + SPF/DKIM are live.

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
