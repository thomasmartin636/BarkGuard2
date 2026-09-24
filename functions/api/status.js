// POST /api/status {token} -> {pro, plan, renews, cancelAtPeriodEnd}
// The app calls this on load so a cancelled subscription stops unlocking Pro.
import { json, readToken, subscriptionFor } from "../../lib/shared.js";

export async function onRequestPost({ request, env }) {
  const { token } = await request.json().catch(() => ({}));
  const p = await readToken(env, token);
  if (!p?.c) return json({ pro: false, error: "invalid token" }, 401);
  try {
    return json(await subscriptionFor(env, p.c));
  } catch (e) {
    return json({ error: e.message }, 502);
  }
}
