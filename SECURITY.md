# Security

## What's protected in the code

| Layer | Protection |
|-------|------------|
| Database rules (`firestore.rules`) | Only the organizer's verified Google account can change the session. Phones can only file, leave or pause their **own** request. Joins are refused while check-ins are closed. Names must be letters, numbers, spaces and `. ' ’ -` (1–30 chars). Timestamps come from the server, so they can't be faked. Skill and party must be from the fixed list. Every other path is closed. |
| Attack tests (`tests/rules.test.mjs`) | 28 tests that try the attacks above against a local copy of the database. `npm run deploy:rules` and `npm run deploy:all` run them first and stop if any fail. |
| Browser security headers (`firebase.json`) | Strict Content-Security-Policy (only your own scripts plus Google sign-in and reCAPTCHA can run), no framing (anti-clickjacking), HTTPS only (HSTS), no MIME sniffing, private referrers, camera/mic/location off. |
| Third-party code | Firebase SDK 10.14.1 and the QR library are hosted in `public/js/vendor/` instead of loaded from outside servers. |
| Page code | Every player-supplied value is escaped before it is shown. |
| App Check | Fraud Defense (reCAPTCHA Enterprise) site key in `public/js/firebase-config.js`. Proves requests come from your site, not a bot. |

## Console settings

Done (Nov 23, 2026):
- **Sign-in methods:** only Google and Anonymous are on. Authorized domains are only localhost, brickstack-queue.web.app and brickstack-queue.firebaseapp.com.
- **API key** ("Browser key (auto created by Firebase)"): only works from `https://brickstack-queue.web.app/*`, `https://brickstack-queue.firebaseapp.com/*` and `http://localhost:5000/*`, and only for Cloud Firestore, Identity Toolkit, Token Service, Firebase App Check and Firebase Installations.
- **App Check:** registered with Fraud Defense (reCAPTCHA Enterprise). Site key `6LeAty4uAAAAAJuLo5QZsUJ359YkeJi5ioxiLCAU` (public) is in `firebase-config.js`. **Monitoring only, not enforced yet.**
- **GitHub:** secret scanning and push protection are on.
- **Billing:** the project is on the free Spark plan, so there is no bill to run up.

Still to do:
1. **2-step verification on the organizer Google account** (most important): myaccount.google.com/security, preferably with a passkey or security key.
2. **Enforce App Check**, 1–2 days after deploying: Firebase console → App Check → APIs. Check that Cloud Firestore and Authentication show mostly *verified* requests, then click **Enforce** on each. After that, `npm run dev` on localhost needs an App Check debug token (see the App Check docs) because localhost isn't on the reCAPTCHA key.
3. Optional: make the GitHub repo private (doesn't affect the live site).

## Ongoing habits
- Never commit service-account keys or passwords. The Firebase web config is public by design; everything else isn't.
- Run `npm test` after any change to `firestore.rules`.
- When updating the Firebase SDK, replace the files in `public/js/vendor/` from the official `firebase` npm package.
