import { getFigmaToken, handleOptions, json, serviceClient } from "../_shared/figma.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  try {
    const { companyId } = (await req.json()) as { companyId?: string };
    if (!companyId) return json({ error: "companyId required" }, 400);
    const token = await getFigmaToken(serviceClient(), companyId);
    return json({ connected: Boolean(token) });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
