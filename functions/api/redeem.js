// POST /api/redeem {restore} -> {token, ...}  Swaps a one-hour emailed restore link for a device token.
import { json, readToken, makeToken, subscriptionFor } from "../../lib/shared.js";

export async function onRequestPost({ request, env }) {
  const { restore } = await request.json().catch(() => ({}));
  const p = await readToken(env, restore, 60 * 60 * 1000);
  if (!p?.r) return json({ error: "This sign-in link has expired. Request a new one." }, 401);
  try {
    const sub = await subscriptionFor(env, p.r);
    if (!sub.pro) return json({ pro: false, error: "No active subscription" }, 402);
    return json({ token: await makeToken(env, { c: p.r }), ...sub });
  } catch (e) {
    return json({ error: e.message }, 502);
  }
}
