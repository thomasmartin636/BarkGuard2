// POST /api/portal {token} -> {url}  Stripe's hosted page to change plan, update card, or cancel.
import { json, stripe, readToken, originOf } from "../../lib/shared.js";

export async function onRequestPost({ request, env }) {
  const { token } = await request.json().catch(() => ({}));
  const p = await readToken(env, token);
  if (!p?.c) return json({ error: "invalid token" }, 401);
  try {
    const s = await stripe(env, "POST", "billing_portal/sessions", { customer: p.c, return_url: originOf(request) + "/" });
    return json({ url: s.url });
  } catch (e) {
    return json({ error: e.message }, 502);
  }
}
