// GET /api/verify?session_id=cs_...  -> {token, pro, plan, ...}
// Called when Stripe sends the buyer back to the site after paying.
import { json, stripe, makeToken, subscriptionFor } from "../../lib/shared.js";

export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get("session_id");
  if (!id || !id.startsWith("cs_")) return json({ error: "Missing session_id" }, 400);
  try {
    const s = await stripe(env, "GET", `checkout/sessions/${encodeURIComponent(id)}`);
    if (s.status !== "complete" || !s.customer) return json({ pro: false, error: "Checkout not completed" }, 402);
    const sub = await subscriptionFor(env, s.customer);
    if (!sub.pro) return json({ pro: false, error: "No active subscription" }, 402);
    return json({ token: await makeToken(env, { c: s.customer }), ...sub });
  } catch (e) {
    return json({ error: e.message }, 502);
  }
}
