# Call Me

Small React app for sharing one 5–6pm PT call slot on Tue / Wed / Thu. The site is static (GitHub Pages). Shared calendar data lives in Firebase.

## First: create the Firebase project

You need a Google account. Stay on the **Spark** (no-cost) plan and do not add a billing account.

1. Open [Firebase console](https://console.firebase.google.com/) and **Create a project** (Google Analytics can be off).
2. **Build → Authentication → Get started → Email/Password** → enable Email/Password (not email link).
3. **Authentication → Users → Add user**, twice:
   - `owner@callme.local` + your password
   - `friends@callme.local` + the shared friends password
4. **Build → Firestore Database → Create database** in **production** mode. Pick a nearby region (e.g. `us-west2`).
5. Open **Firestore → Rules**, paste [`firestore.rules`](firestore.rules), and **Publish**.
6. **Project settings** (gear) → **Your apps** → web (`</>`) → register app `callme`.
7. Copy `.env.example` to `.env.local` and fill in the `firebaseConfig` values. Do not commit `.env.local`.

If you change those two emails, also update the emails in `firestore.rules`.

## Run locally

This project needs **Node 20+** (Vite 7). If `npm run dev` fails on `import`, switch Node (`nvm use` if you have nvm).

```bash
npm install
cp .env.example .env.local
# fill in Firebase values
npm run dev
```

Then open the URL Vite prints, usually `http://localhost:5173/`.

## GitHub Pages

1. Repo **Settings → Pages** → Source: **GitHub Actions**.
2. Add the same `VITE_*` values from `.env.local` as repository **Secrets**.
3. Push `main`. The workflow builds and deploys `dist/`.

The app URL is `https://<you>.github.io/callme/`.

## Signup email notifications

The `notifyOwnerOfSignup` Cloud Function sends an email through Brevo whenever
a friend creates a booking.

1. Create a Brevo account and verify a sender email.
2. In Brevo, create an API key under **SMTP & API → API Keys**.
3. Store the three values as Firebase secrets:

```bash
npx firebase functions:secrets:set BREVO_API_KEY
npx firebase functions:secrets:set BREVO_SENDER_EMAIL
npx firebase functions:secrets:set OWNER_NOTIFICATION_EMAIL
```

4. Deploy the function:

```bash
npx firebase deploy --only functions
```
