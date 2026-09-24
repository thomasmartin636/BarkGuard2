// POST /api/checkout  {plan: "monthly"|"yearly"}  -> {url}  (Stripe-hosted checkout page)
import { json, stripe, originOf } from "../../lib/shared.js";

export async function onRequestPost({ request, env }) {
  const { plan } = await request.json().catch(() => ({}));
  const price = plan === "yearly" ? env.PRICE_YEARLY : env.PRICE_MONTHLY;
  if (!price) return json({ error: "Prices are not configured yet." }, 500);
  const origin = originOf(request);
  try {
    const session = await stripe(env, "POST", "checkout/sessions", {
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled`,
      allow_promotion_codes: true,
    });
    return json({ url: session.url });
  } catch (e) {
    return json({ error: e.message }, 502);
  }
}
