# Bark Guard: going live on nobarking.com with Stripe

What's in this repo:

- `public/` is the website (the app, terms page, privacy page, icons).
- `functions/api/` is the small backend Cloudflare runs for you. It creates Stripe checkouts, confirms payments, and checks whether a phone's subscription is still active.
- `lib/shared.js` holds code both of those share.

How the free hour works: the app counts listening time on the phone. After 60 minutes in a day it stops listening and shows the upgrade screen. The count resets at midnight. Subscribers get no limit. The app re-checks with Stripe each time it opens, so cancelled subscriptions lock again at the end of the paid period.

Everything below can be done in a web browser. Plan on about an hour the first time.

---

## Step 1: Put the new files in GitHub (5 min)

1. Unzip `nobarking-site.zip`.
2. Open github.com/thomasmartin636/BarkGuard2.
3. Delete the old root files that moved into `public/`: `index.html`, `sw.js`, `manifest.webmanifest`, the three `.png` icons and `README.txt`. For each one, open the file, choose **⋯ › Delete file**, then commit.
4. Choose **Add file › Upload files**. Drag in the `public`, `functions` and `lib` folders plus `SETUP.md` and `README.md`. The folders need to stay folders. Then click **Commit changes**.

After this, the repo should show `functions/`, `lib/`, `public/`, `README.md` and `SETUP.md` at the top level.

## Step 2: Stripe account and prices (15 min)

1. Sign up at stripe.com. Leave **Test mode** on for now (it's the toggle at the top of the dashboard). In test mode no real money moves.
2. Go to **Product catalog › Add product**.
   - Name: `Bark Guard Unlimited`
   - Price 1: **Recurring**, $2.99 USD, **Monthly**
   - Click **Add another price**. Price 2: **Recurring**, $19.99 USD, **Yearly**
   - Save.
3. Open the product. Each price has an ID that starts with `price_`. Copy both IDs somewhere.
4. Go to **Developers › API keys**. Copy the **Secret key** (`sk_test_…`). Keep it private.
5. Go to **Settings › Billing › Customer portal** and click **Activate** (or **Save**). Under Subscriptions, turn on **Cancel subscriptions** and **Switch plans**, then add both prices. This is the page subscribers use when they tap **Manage subscription**.

## Step 3: Cloudflare Pages (10 min)

1. Sign up at dash.cloudflare.com (the free plan is enough).
2. Go to **Workers & Pages › Create**, then choose the **Pages** tab and **Connect to Git**. If Cloudflare only shows Workers options, look for a link like "Looking to deploy Pages? Get started".
3. Connect GitHub and choose **BarkGuard2**.
4. Build settings:
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: `public`
5. Click **Save and Deploy**. You'll get an address like `barkguard2.pages.dev`.
6. Go to the project's **Settings › Variables and Secrets** and add these under **Production**. Use the **Secret** type for the ones marked secret.

   | Name | Value |
   |---|---|
   | `STRIPE_SECRET_KEY` (secret) | your `sk_test_…` key |
   | `PRICE_MONTHLY` | the $2.99 `price_…` ID |
   | `PRICE_YEARLY` | the $19.99 `price_…` ID |
   | `TOKEN_SECRET` (secret) | a long random string, 40+ characters. Mash the keyboard or use a password generator. **Don't change it later**, because that signs every subscriber out. |

7. Go to **Deployments**, open the latest one, and choose **⋯ › Retry deployment**. Variables only take effect on a new deploy.

## Step 4: Test a purchase (5 min)

1. Open your `.pages.dev` address and tap **Go unlimited › Yearly**.
2. On Stripe's page, use card `4242 4242 4242 4242`, any future expiry date, any CVC and any ZIP.
3. You should land back on Bark Guard with **Unlimited · Yearly** showing.
4. Tap **Manage subscription** and cancel. Reload the app. It should say *Cancelled. Unlimited until …*
5. To test the free limit without waiting an hour, open the browser console on a computer and run
   `localStorage.setItem("bg.usage", JSON.stringify({day:new Date().toDateString(), secs:3590}))`, then reload and press Start. It should stop and show the upgrade screen after about 10 seconds.

## Step 5: Buy nobarking.com and connect it (10 min)

1. In Cloudflare, go to **Domain Registration › Register Domains** and search `nobarking.com`. Cloudflare sells domains at cost, about $10/yr for .com. If the name is taken, the search suggests close alternatives. Nothing in the code depends on the exact name. If you pick a different one, update the three `support@nobarking.com` mentions in `public/index.html`, `terms.html` and `privacy.html`.
2. Once you own the domain, open your Pages project and go to **Custom domains › Set up a custom domain**. Enter `nobarking.com`, then add `www.nobarking.com` as well. Cloudflare creates the DNS records and the HTTPS certificate automatically. The microphone requires HTTPS, and you get it here for free.
3. Set up support email: open the domain, then **Email › Email Routing**. Create `support@nobarking.com` and forward it to your Gmail.

## Step 6 (optional but recommended): "Restore purchase" emails

This lets a subscriber who gets a new phone type their email and receive a sign-in link. Without this step, the button replies "contact support".

1. Sign up at resend.com (the free tier covers 3,000 emails/month).
2. Go to **Domains › Add domain › nobarking.com**. Resend can add its DNS records to Cloudflare for you. If it can't, copy them into Cloudflare DNS by hand.
3. Go to **API Keys › Create**, then add these in Cloudflare Pages variables:
   - `RESEND_API_KEY` (secret): the `re_…` key
   - `MAIL_FROM`: `Bark Guard <support@nobarking.com>`
4. Retry the deployment.

## Step 7: Go live with real payments

1. In Stripe, click **Activate payments**. Stripe asks for your details, your bank for payouts, and your website (`https://nobarking.com`). The Terms & refunds and Privacy pages linked in the app footer cover what Stripe reviewers look for. The terms promise a **14-day full refund**. Edit `public/terms.html` if you want a different policy.
2. Switch the dashboard out of Test mode. Repeat Step 2 in live mode: live products and prices get new `price_…` IDs, you need the live `sk_live_…` key, and the Customer portal needs activating again.
3. Replace `STRIPE_SECRET_KEY`, `PRICE_MONTHLY` and `PRICE_YEARLY` in Cloudflare with the live values, then retry the deployment.
4. Buy it once yourself with a real card to confirm everything works. You can refund yourself from the Stripe dashboard.

---

### Good to know

- **The free hour is counted on the phone.** Someone technical could reset it by clearing the site's data. That's normal for this kind of app and not worth fighting at $2.99. Payments themselves are checked with Stripe on the server and can't be faked.
- **Updating the app:** edit the files in GitHub, and Cloudflare redeploys within a minute.
- **Costs:** Cloudflare is free and Resend is free at this scale. Stripe takes 2.9% + 30¢ per charge, so a $2.99 month nets about $2.60 and a $19.99 year nets about $19.11. Yearly keeps a lot more of each dollar.
- **Sales tax:** Stripe Tax (Settings › Tax) can calculate and collect it if you need it. Ask an accountant whether you do.
