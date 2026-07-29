import { handleOptions, json, requireRole, serviceClient } from "../_shared/figma.ts";

interface InviteBody {
  companyId?: string;
  email?: string;
  role?: "admin" | "member";
  redirectTo?: string;
  /** "email" (default) sends Supabase's invite mail; "link" mints the same
   * one-time invite URL WITHOUT sending anything, so onboarding a batch of
   * admins is not capped by the auth mailer's per-hour limit. */
  mode?: "email" | "link";
}

/** Invite a person to a company. Caller must be an ADMIN of that company
 * (verified from their JWT). Uses the service role to create the account,
 * the membership, and (in email mode) send the invite — the service role
 * never leaves here. */
Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  try {
    const { companyId, email, role, redirectTo, mode } = (await req.json()) as InviteBody;
    if (!companyId || !email || !role) return json({ error: "companyId, email, role required" }, 400);
    if (role !== "admin" && role !== "member") return json({ error: "role must be admin or member" }, 400);

    const caller = await requireRole(req, companyId, "admin");
    if ("error" in caller) return json({ error: caller.error }, caller.status);

    const db = serviceClient();

    let userId: string | null = null;
    let actionLink: string | null = null;
    let existing = false;

    if (mode === "link") {
      // generate_link creates the account and returns the URL without
      // touching the mailer — no rate limit, admin shares it directly.
      const generated = await db.auth.admin.generateLink({
        type: "invite",
        email,
        options: { redirectTo: redirectTo ?? undefined },
      });
      if (generated.data?.user) {
        userId = generated.data.user.id;
        actionLink = generated.data.properties?.action_link ?? null;
      } else {
        // Already has an account: recovery gives them a working way in.
        const recovery = await db.auth.admin.generateLink({
          type: "recovery",
          email,
          options: { redirectTo: redirectTo ?? undefined },
        });
        const { data: known } = await db.from("users").select("id").eq("email", email).maybeSingle();
        userId = (known as { id: string } | null)?.id ?? recovery.data?.user?.id ?? null;
        actionLink = recovery.data?.properties?.action_link ?? null;
        existing = true;
        if (!userId) {
          return json({ error: generated.error?.message ?? "Could not create that invite." }, 400);
        }
      }
    } else {
      // Send the invite. If the address already has an account, fall back to
      // just creating the membership.
      const invited = await db.auth.admin.inviteUserByEmail(email, {
        redirectTo: redirectTo ?? undefined,
      });
      if (invited.data.user) {
        userId = invited.data.user.id;
      } else {
        const { data: known } = await db.from("users").select("id").eq("email", email).maybeSingle();
        userId = (known as { id: string } | null)?.id ?? null;
        existing = true;
        if (!userId) {
          return json({ error: invited.error?.message ?? "Could not invite that address." }, 400);
        }
      }
    }

    const { error } = await db
      .from("memberships")
      .upsert({ user_id: userId, company_id: companyId, role }, { onConflict: "user_id,company_id" });
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, existing, actionLink });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
