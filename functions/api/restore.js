// POST /api/restore {email}
// For a subscriber on a new phone: if that email has an active subscription we email them a
// one-hour sign-in link. The reply is the same either way so nobody can probe who subscribes.
import { json, stripe, makeToken, subscriptionFor, originOf } from "../../lib/shared.js";

export async function onRequestPost({ request, env }) {
  const { email } = await request.json().catch(() => ({}));
  if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()))
    return json({ error: "Enter a valid email address." }, 400);
  if (!env.RESEND_API_KEY) return json({ error: "Restore by email isn't set up yet. Contact support." }, 501);
  const reply = json({ ok: true, message: "If that email has a subscription, a sign-in link is on its way." });
  try {
    const custs = await stripe(env, "GET", "customers", { email: email.trim(), limit: 10 });
    for (const c of custs.data) {
      if (!(await subscriptionFor(env, c.id)).pro) continue;
      const link = `${originOf(request)}/?restore=${await makeToken(env, { r: c.id })}`;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: env.MAIL_FROM || "Bark Guard <support@nobarks.com>",
          to: [email.trim()],
          subject: "Your Bark Guard sign-in link",
          text: `Tap this link on the phone you want to use Bark Guard Pro on:\n\n${link}\n\nIt works for one hour. If you didn't ask for this, ignore this email.`,
        }),
      });
      break;
    }
  } catch (e) {
    console.error("restore failed", e);
  }
  return reply;
}
