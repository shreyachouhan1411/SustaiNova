# SUSTAINOVA 2026 — website + Firebase backend + admin panel

Plain HTML/CSS/JS (no build step). Data: Firebase Auth + Firestore. Payment screenshots and PPTs are **Google Drive links** (no Firebase Storage, no Blaze plan). Admin panel: `/admin/`.

**Files:** `config.js` (default content, fallback) · `backend.js` (all data access; `demo` and `firebase` adapters) · `firebase-config.js` (your Firebase keys) · `firebase-init.js` (SDK loader) · `firestore.rules`, `firestore.indexes.json`, `firebase.json` · `admin/` · `robots.txt`.

## 1. Set up Firebase (beginner steps)
1. Go to console.firebase.google.com → **Add project** (Analytics not needed).
2. **Build → Authentication → Get started.** Enable **Anonymous** (students) and **Email/Password** (admins). Leave **Google** and every other provider disabled.
3. **Build → Firestore Database → Create database** (production mode, pick a region such as `asia-south1`).
5. **Project settings → Your apps → Web (`</>`)** → register an app → copy the config into **`firebase-config.js`**.
6. In **Authentication → Settings → Authorized domains** add your hosting domain (Firebase Hosting domains are added automatically).

## 2. Deploy the rules
```
npm install -g firebase-tools
firebase login
firebase use --add            # choose your project
firebase deploy --only firestore:rules,firestore:indexes
```

## 1b. "Site setup problem" banner / demo mode (read this first)
The site no longer silently switches to demo mode. If `firebase-config.js` still has `PASTE...` values, lacks `export const firebaseConfig = {...}` (a snippet pasted straight from the Firebase console has no `export`), or the Firebase SDK cannot load, a **red "Site setup problem" banner** names the exact reason and registration stays closed. The admin login shows the same reason and the connected project id (`Connected to Firebase project: ...`). Demo mode now exists only if `config.js` says `backendMode: "demo"`; keep it `"firebase"` on the live site.

## 2b. Try the admin screens first (no Firebase needed)
Run a local server in this folder (`npx serve` or `python3 -m http.server 8000`) and open `http://localhost:8000/admin/?preview`. Preview works **only on localhost / 127.0.0.1**; it is ignored on your live site. Any email and password works; sample teams are included. Data lives only in your browser. Delete `admin/demo-firebase.js` before launch if you like.

## 3. Create the admin accounts (8-9 people)
Admins are created and managed **only in the Firebase console**. The website has no sign-up, no Google sign-in, no password reset and no way to add admins.
1. **Authentication → Users → Add user**: email + password for each admin. You choose and reset the passwords here.
2. **Firestore → Start collection** `admins` → for each admin add a document whose **Document ID is the lowercase email** (e.g. `asha@example.com`) with any field, e.g. `role: "admin"`.
3. Admins open `/admin/` and sign in with email + password. **No email verification is needed.**
4. Access = (signed in with email + password) AND (their lowercase email exists in `admins`). To remove an admin, delete their `admins` document (and, ideally, their Auth user).
5. Create every admin's Auth user yourself before sharing the admin URL, and keep **Google/other providers disabled**, so nobody can claim an admin email first. An Auth account without an `admins` document can sign in but sees "Access denied" and gets no data.
6. Use a **separate browser profile** for admin and for testing as a student.

## 4. Seed `settings/site`
Sign in to `/admin/#content` and press **Save changes** once. This writes all editable values from `config.js` into Firestore. **Until you do this, registration and PPT submission stay closed** (the rules read `settings/site`, and a missing document or switch means closed). The public site now says so instead of showing a form that cannot work.
Set the deadlines (IST), team size, fee, payment instructions and the Jodo link there.

**Payment switch (Round 1):** in *Site content*, **“Round 1: Is payment required?”** ON = original paid flow (fee, instructions, transaction ID, Drive screenshot, admin verify/reject). OFF = free registration: no payment fields or verification, teams are created as `Registered` and the site says registration is free. Existing records are never deleted. Round 2 is offline and has no online registration, so it has no payment switch.

**PPT submission is independent of payment.** It has its own switch (*PPT submission open*) and its own deadline, plus optional per-team extensions. Payment status is never checked for PPT. Admins can open, extend and **reject** PPTs (the team sees the reason and can resubmit) in *PPT management*. Shortlisting needs a submitted PPT, and also verified payment only while payment is required.

## 5. Deploy the site
The website itself lives in the **`public/`** folder (everything else in the project root is Firebase configuration and docs, and is not served).

- **Vercel via GitHub (recommended):** push this whole project to a GitHub repo and import it in Vercel. `vercel.json` already sets the output folder to `public/`, so no build settings are needed. Every push to `main` redeploys automatically.
- **Firebase Hosting:** `firebase deploy --only hosting` (`firebase.json` serves `public/`).

After the first deploy, add your site's domain (for example `your-project.vercel.app`, plus any custom domain) in Firebase Console → Authentication → Settings → **Authorized domains**, otherwise admin login will fail. Rules deploy separately: `firebase deploy --only firestore:rules,firestore:indexes`.

## 6. Test the admin flow end to end
1. Student browser: Register → pay link → payment proof → confirmation. Status page shows "Payment submitted".
2. Admin: **Payments → Review → Verify**. Student status page now shows "Verified" (refresh).
3. Student: **Submit PPT** works whether or not payment is verified. Admin: **PPT management** shows it; open or reject it.
4. Admin: **Shortlisting** → select → shortlist. Status page shows "Shortlisted".
5. Admin: **Site content** → add an announcement, mark Active, Save. A banner appears on the public pages.
6. **Deadline check:** set PPT deadline to a past time in Site content → student PPT submission is refused (by the rules too). Use **PPT management → Extend** for one team → only that team can upload.
7. **Registrations → Export CSV**. (The Audit Log page was removed from the admin portal; admin actions are still recorded silently in the `auditLog` collection, viewable in the Firebase console.)
8. Duplicate transaction check: submit the same transaction ID from a second student browser → friendly error.

## 7. Backups
- **CSV:** Admin → Export (also after each phase).
- Firestore's built-in export needs the Blaze plan, so use the free **CSV export** (it includes the Drive links).

## 8. Security rules in plain English
**firestore.rules**
- *Admin* = signed in with **email + password** and the lowercase email exists in `admins/{email}` (no email verification needed).
- `settings/site`: anyone can read; only admins write.
- `registrations`: nobody can list them except admins; a student can read only their own (matched by anonymous uid).
- Create: a student may create one only while registration is open (and before its deadline), with status exactly `pending_payment` (or `registered` when payment is switched off), their own uid, `shortlisted=false`, `pptSubmitted=false`, an ID in the `SUST26-XXXXXX` format, and server timestamps.
- Update by student: only `form`, `email`, `payment`, `status`, `ppt`, `pptSubmitted`, `updatedAt`. Team details lock after payment starts. Status may only go `pending_payment` → `payment_submitted` (or `rejected` → `payment_submitted` for resubmission) and only if a transaction document owned by them exists. They can never set `verified`, `rejected`, `shortlisted`, `rejectReason`, `verifiedBy` or the deadline override.
- PPT fields: only if `pptSubmissionOpen` is on (no payment check), and now is before the global deadline **or** the team's extension. The upload time must be the server time. Links must be `https` Google Drive links.
- Admins: full access, but can only shortlist teams with a submitted PPT who are verified (when payment is required).
- `transactions/{ID}`: a student can create one (must match the payment ID on their own registration, in the same batch) but never update/delete. If someone else already holds it, the batch fails → "already used".
- `statusLookup/{id}`: anyone can read one by exact ID (holds only emailHash, status, reject reason, PPT/shortlist flags; no names, phones, emails or payment info). A student can only make it match their own registration.
- `admins`: a user may read only their own entry; nobody can list/create/edit/delete admins from the website. `auditLog`: admin read + append only (no page in the portal).
- Everything else is denied.


## 9. Security checklist
- [ ] Turn on 2-step verification for every admin Google/Firebase account.
- [ ] Keep admin emails to 2–4 people; remove people after the event.
- [ ] Never commit service-account keys or private keys (the web config in `firebase-config.js` is safe to publish).
- [ ] Enable **App Check** (reCAPTCHA v3) and enforce it for Firestore when ready; add `initializeAppCheck` in `firebase-init.js`.
- [ ] Re-test the rules after any edit (Rules Playground / emulator).
- [ ] Set a billing budget alert.

## 10. Known limits (by design)
- Students submit/replace the PPT only from the browser they registered with (their anonymous uid owns the record). Other devices can check status via ID + email.
- Audit entries for admin actions are written from the admin app in the same batch as the change (admins are trusted; rules make the log append-only).
- `config.js` `backendMode: "demo"` still works for offline testing.

## 11. Rate limiting (added)
Three layers (no server needed):
1. **In the browser** (`backend.js`): at most 3 registrations / 5 min, 5 payment submissions / 5 min, 6 ID+email lookups / min. Shows "Too many attempts. Please wait…". This is a speed bump; it can be bypassed.
2. **In the rules** (`rateLimits/{uid}` in `firestore.rules`): one registration per device every 20 seconds, max 8 per device. **Re-publish `firestore.rules` after updating.** To reset a blocked device, delete its document in the `rateLimits` collection.
3. **App Check (recommended before launch):** Firebase console → App Check → register your web app with reCAPTCHA v3 → paste the site key into `appCheckSiteKey` in `firebase-config.js` → test → then click **Enforce** for Firestore and Storage. For local testing add your debug token in the console first.
Testing in demo mode: if you hit the limit, run `Backend.demo.reset()` in the browser console.

## 12. Launch checklist
- [ ] Real keys in `firebase-config.js` (no demo banner on the live site). If the DEMO banner shows, data is NOT being saved to Firebase.
- [ ] `firestore.rules` published (latest version), admin created, Site content saved once.
- [ ] Fee, Jodo link, team size, deadlines, contacts filled in.
- [ ] Whole flow tested in two browsers; duplicate transaction ID and past-deadline PPT submission both refused.
- [ ] Live domain added to Authentication → Authorized domains.
- [ ] App Check enforced; budget alert set; 2-step verification on admin accounts.

## 13. Payment screenshots and PPTs are Google Drive links (no Firebase Storage)
Students upload to **their own Google Drive** and paste the share link. Links are saved in Firestore (`payment.screenshotLink`, `ppt.url`) with timestamps. Nothing is stored in Firebase Storage, so **you do not enable Storage and do not need the Blaze plan**.
- **Validation:** the form accepts only `https://drive.google.com/...` or `https://docs.google.com/...` file/folder links; the Firestore rules re-check this on the server.
- **Safer sharing for payment screenshots:** set `driveShareEmail` (config.js, or Admin → Site content → "Organizer Google account for Drive sharing") to a Google account that your admins can all open, for example a club Gmail. Students are then told to set General access to **Restricted** and add that account as **Viewer**, so screenshots are never public. If it is empty, students are told to use "Anyone with the link → Viewer" (less private).
- **Reviewing:** in the admin panel (Payments, drawer, PPT management) click **Open ↗**; it opens in a new Google Drive tab. Be signed in to Google with the account students shared with, otherwise Drive shows "Request access".
- **Limits:** a website cannot check a Drive file's sharing settings, so a student can submit a link you cannot open. Reject that payment with a reason such as "Cannot open your Drive link, please share it with <email>" and the student can resubmit.
- If you already have test data with old `screenshotPath` or file-type PPTs, delete those test registrations.


## 14. Round 1 is free; what admins can edit (updated)
- **Free by default.** `paymentRequired` defaults to **false** everywhere (page, rules, admin). To charge, switch *Round 1 payment required* ON in Site content.
- **Editable from Site content (no code):** registration/PPT switches and deadlines, the **badge under the logo** (empty = "Registration closes <deadline>" automatically), tagline, About, expected outcome, prize note, **How it works steps**, **Rounds**, team size, fee, payment text, timeline, prizes, FAQs, contacts, announcements. Changes show on the public site on the next page load (no caching). The home page SDG tiles and problem-domain cards are still in `config.js`.
- **Old saved FAQs:** when `contentVersion` in `config.js` is newer than what was saved, the saved FAQs yield to the new defaults until an admin presses Save again.
- **Teams:** two members of one team cannot share an email or phone number (checked in the form; email compared case-insensitively, phone by digits).
- **"We couldn't start a secure session" / "organizers still need to enable Anonymous sign-in":** enable **Authentication > Sign-in method > Anonymous** in Firebase. The error shows the Firebase code.
- **Firestore free-plan limits (Spark):** 50,000 reads and 20,000 writes per day. A registration costs about 3 writes and a few reads; a page view costs 1 read. The admin panel loads the team list once and then refreshes single teams, not the whole list.
