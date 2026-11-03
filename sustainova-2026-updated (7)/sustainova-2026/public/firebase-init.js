/* firebase-init.js — single place that loads the Firebase modular SDK (v10, CDN) and exposes it.
   Used by backend.js (public site, lazily) and admin/admin.js.
   `configProblem` is "" when firebase-config.js holds a real config, otherwise a plain-English reason (shown by the site and the admin login). */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-check.js";
import * as CFG from "./firebase-config.js";          // namespace import: a missing export no longer breaks the whole module
export * from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
export * from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
export const firebaseConfig = CFG.firebaseConfig || {};
const appCheckSiteKey = CFG.appCheckSiteKey || "";
const bad = v => typeof v !== "string" || !v.trim() || /PASTE|YOUR_|XXXX/i.test(v);
export const configProblem = !CFG.firebaseConfig ? "firebase-config.js does not export `firebaseConfig`."
  : ["apiKey", "authDomain", "projectId", "appId"].filter(k => bad(firebaseConfig[k])).map(k => k + " is missing or still a PASTE placeholder").join("; ");
const app = configProblem ? null : initializeApp(firebaseConfig);
if (app && appCheckSiteKey) initializeAppCheck(app, { provider: new ReCaptchaV3Provider(appCheckSiteKey), isTokenAutoRefreshEnabled: true });   // blocks traffic that is not from your site
export const auth = app ? getAuth(app) : null, db = app ? getFirestore(app) : null;
