// Shared helpers for the Cloudflare Pages Functions in /functions/api.
// Talks to Stripe's REST API with plain fetch (no npm packages, no build step).
//
// Environment variables (set in Cloudflare Pages > Settings > Variables and Secrets):
//   STRIPE_SECRET_KEY   sk_test_... while testing, sk_live_... when you go live   (secret)
//   PRICE_MONTHLY       price_... for $2.99/month
//   PRICE_YEARLY        price_... for $19.99/year
//   TOKEN_SECRET        any long random string; signs the "this device is Pro" token (secret)
//   RESEND_API_KEY      optional; lets "Restore purchase" email a sign-in link (secret)
//   MAIL_FROM           optional; e.g. "Bark Guard <support@nobarks.com>"

export const PRO_STATUSES = ["active", "trialing", "past_due"];

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

// Flatten {a:{b:1}, c:[x,y]} into Stripe's form encoding: a[b]=1&c[0]=x&c[1]=y
function form(obj, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") form(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

export async function stripe(env, method, path, params) {
  if (!env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set");
  const base = env.STRIPE_API_BASE || "https://api.stripe.com";
  let url = `${base}/v1/${path}`;
  const init = {
    method,
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY.trim()}` },
  };
  if (params) {
    const body = form(params);
    if (method === "GET") url += (url.includes("?") ? "&" : "?") + body;
    else {
      init.body = body;
      init.headers["content-type"] = "application/x-www-form-urlencoded";
    }
  }
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Stripe error ${res.status}`);
  return data;
}

// ---- signed token: base64url(payload).base64url(hmac) ----
const enc = new TextEncoder();
const b64u = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function hmacKey(env) {
  if (!env.TOKEN_SECRET) throw new Error("TOKEN_SECRET is not set");
  return crypto.subtle.importKey("raw", enc.encode(env.TOKEN_SECRET), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function makeToken(env, payload) {
  const body = b64u(enc.encode(JSON.stringify({ ...payload, iat: Date.now() })));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(env), enc.encode(body));
  return `${body}.${b64u(sig)}`;
}

export async function readToken(env, token, maxAgeMs) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(env), unb64u(sig), enc.encode(body));
    if (!ok) return null;
    const p = JSON.parse(new TextDecoder().decode(unb64u(body)));
    if (maxAgeMs && Date.now() - p.iat > maxAgeMs) return null;
    return p;
  } catch {
    return null;
  }
}

// Is this Stripe customer currently subscribed? Returns {pro, plan, renews, cancelAt}.
export async function subscriptionFor(env, customer) {
  const list = await stripe(env, "GET", "subscriptions", { customer, status: "all", limit: 10 });
  const sub = list.data.find((s) => PRO_STATUSES.includes(s.status));
  if (!sub) return { pro: false };
  const item = sub.items?.data?.[0];
  const interval = item?.price?.recurring?.interval;
  const periodEnd = sub.current_period_end ?? item?.current_period_end;
  return {
    pro: true,
    plan: interval === "year" ? "yearly" : "monthly",
    renews: periodEnd ? periodEnd * 1000 : null,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
  };
}

export const originOf = (request) => new URL(request.url).origin;
