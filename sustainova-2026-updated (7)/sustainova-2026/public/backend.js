/* =====================================================================
   backend.js — the ONLY place that reads/writes data (Firestore or the demo store).
   Pages call window.Backend.* and never use localStorage or a database.
   Adapters: "firebase" (live, the default) and "demo" (localStorage; used ONLY when config.js says backendMode: "demo").
   If Firebase is not configured correctly the site does NOT silently switch to demo any more: it shows the exact reason (Backend.initError).
   ===================================================================== */
(function () {
  "use strict";
  const CFG = () => window.SITE_CONFIG || {};
  const MODE = CFG().backendMode === "firebase" ? "firebase" : "demo";   // set in config.js
  const DB_KEY = "sustainova2026_demo_db", ID_KEY = "sustainova2026_reg_id", RL_KEY = "sustainova2026_rl";
  const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";   // no 0/O/1/I/L
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const now = () => new Date().toISOString();
  const up = s => String(s || "").trim().toUpperCase();
  const lc = s => String(s || "").trim().toLowerCase();
  const clone = o => JSON.parse(JSON.stringify(o));
  const newId = () => { const a = new Uint32Array(6); crypto.getRandomValues(a); return "SUST26-" + Array.from(a, n => ALPHABET[n % ALPHABET.length]).join(""); };

  /* ---------------- DEMO ADAPTER (localStorage) ---------------- */
  const load = () => { try { return JSON.parse(localStorage.getItem(DB_KEY)) || { registrations: {} }; } catch (e) { return { registrations: {} }; } };
  const save = db => { try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) { throw new Error("STORAGE_FULL"); } };
  const txnUsedBy = (db, txn, exceptId) => Object.values(db.registrations).some(r => r.id !== exceptId && r.payment && up(r.payment.txnId) === up(txn));

  const demo = {
    mode: "demo",
    async getSiteContent() { await wait(120); return clone(CFG()); },
    async createRegistration(data) {
      const db = load(); let id; do { id = newId(); } while (db.registrations[id]);   // collision check
      const t = now();
      db.registrations[id] = { id, email: lc(data.email), status: CFG().paymentRequired === true ? "pending_payment" : "registered", form: data.form || {}, payment: null, ppt: null,
        pptSubmitted: false, shortlisted: false, rejectionReason: "", createdAt: t, updatedAt: t };
      save(db); return clone(db.registrations[id]);
    },
    async updateRegistration(id, data) {
      const db = load(), r = db.registrations[id]; if (!r) throw new Error("NOT_FOUND");
      if (data.payment && data.payment.txnId && txnUsedBy(db, data.payment.txnId, id)) throw new Error("TXN_USED");
      if (data.email) data.email = lc(data.email);
      Object.assign(r, data, { id: r.id, updatedAt: now() }); save(db); return clone(r);
    },
    async getRegistrationById(id) { const r = load().registrations[up(id)]; return r ? clone(r) : null; },
    async getRegistrationByIdAndEmail(id, email) { const r = load().registrations[up(id)]; return r && lc(r.email) === lc(email) ? clone(r) : null; },
    async isTransactionIdUsed(txn, exceptId) { return txnUsedBy(load(), txn, exceptId); },
    async submitPpt(regId, fileOrLink) {          // Google Drive link only
      if (typeof fileOrLink !== "string" || (window.Site && window.Site.driveLink(fileOrLink))) throw new Error("BAD_LINK");
      const cfg = CFG(), db0 = load(), r0 = db0.registrations[regId]; if (!r0) throw new Error("NOT_FOUND");
      if (!cfg.pptSubmissionOpen) throw new Error("PPT_NOT_OPEN");
      if (window.Site.isPast(cfg.pptDeadline)) throw new Error("PPT_CLOSED");
      const sub = { type: "link", url: fileOrLink.trim(), submittedAt: now() };
      const db = load(), r = db.registrations[regId]; r.ppt = sub; r.pptSubmitted = true; r.updatedAt = now(); save(db); return clone(r);
    }
  };
  /* Testing helpers (demo only). Use from the browser console — see README. */
  const tools = {
    setStatus(id, status, reason) { const db = load(), r = db.registrations[up(id)]; if (!r) return "Not found"; r.status = status; r.rejectionReason = reason || ""; save(db); return "OK: " + status; },
    setShortlisted(id, v) { const db = load(), r = db.registrations[up(id)]; if (!r) return "Not found"; r.shortlisted = v !== false; save(db); return "OK"; },
    list() { return Object.values(load().registrations).map(r => ({ id: r.id, email: r.email, status: r.status })); },
    reset() { localStorage.removeItem(DB_KEY); localStorage.removeItem(ID_KEY); localStorage.removeItem(RL_KEY); return "Demo data cleared"; }
  };

  /* ---------------- FIREBASE ADAPTER ----------------
     Same signatures/return shapes as `demo`. SDK is loaded lazily from firebase-init.js.
     Students are signed in anonymously; registrations are tied to that uid (ownerUid).
     Errors are normalised to: PERMISSION, OFFLINE, TXN_USED, NOT_FOUND (pages show friendly text). */
  const lazy = () => (lazy.p = lazy.p || import("./firebase-init.js").catch(e => { throw Object.assign(new Error("FIREBASE_INIT_FAILED"), { detail: String((e && e.message) || e) }); }));
  const sha = async s => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))), b => b.toString(16).padStart(2, "0")).join("");
  const iso = v => v && v.toDate ? v.toDate().toISOString() : (v || "");
  const txnKey = t => up(t).replace(/\//g, "_");          // must match txnKey() in firestore.rules
  const norm = (id, x) => ({ id, email: x.email || "", status: x.status, form: x.form || {},
    payment: x.payment ? Object.assign({}, x.payment, { submittedAt: iso(x.payment.submittedAt) }) : null,
    ppt: x.ppt ? Object.assign({}, x.ppt, { submittedAt: iso(x.ppt.submittedAt) }) : null,
    pptSubmitted: !!x.pptSubmitted, shortlisted: !!x.shortlisted, rejectionReason: x.rejectReason || "", pptRejectReason: x.pptRejectReason || "", pptDeadlineOverride: iso(x.pptDeadlineOverride) });
  async function fx() { const m = await lazy(); await m.auth.authStateReady(); if (!m.auth.currentUser) await m.signInAnonymously(m.auth); return m; }
  const guard = async fn => { try { return await fn(); } catch (e) { const c = (e && e.code) || ""; if (/permission-denied|unauthorized/.test(c)) throw new Error("PERMISSION"); if (/resource-exhausted/.test(c)) throw new Error("BUSY"); if (/unavailable|network|offline/.test(c)) throw new Error("OFFLINE"); if (/^auth\//.test(c)) { console.error("Firebase auth error:", e); throw Object.assign(new Error(/operation-not-allowed|admin-restricted-operation/.test(c) ? "AUTH_DISABLED" : "AUTH_FAILED"), { code: c }); } console.error("Firestore error:", e); throw e; } };
  /* When Firestore says "permission-denied", find out WHY so the student gets a specific message instead of a generic one.
     (The rules are the real enforcement; this only explains their decision.) */
  const tsMs = v => v && v.toMillis ? v.toMillis() : v ? new Date(v).getTime() : 0;
  async function whyCreateDenied(m, uid) {
    try {
      const s = await m.getDoc(m.doc(m.db, "settings", "site"));
      if (!s.exists()) return "SETTINGS_MISSING";
      const d = s.data();
      if (d.registrationOpen !== true) return "REG_CLOSED";
      if (d.registrationDeadline && Date.now() > tsMs(d.registrationDeadline)) return "REG_DEADLINE";
      const r = await m.getDoc(m.doc(m.db, "rateLimits", uid));
      if (r.exists()) { const x = r.data(); if ((x.count || 0) >= 8) return "RATE_LIMIT"; if (x.last && Date.now() - tsMs(x.last) < 20000) return "RATE_LIMIT"; }
    } catch (e) {}
    return "REG_REJECTED";
  }
  async function whyPptDenied(m, id) {
    try {
      const s = await m.getDoc(m.doc(m.db, "settings", "site")); if (!s.exists()) return "SETTINGS_MISSING";
      const d = s.data(); if (d.pptSubmissionOpen !== true) return "PPT_NOT_OPEN";
      let end = tsMs(d.pptDeadline); const own = await m.getDoc(m.doc(m.db, "registrations", id)), ov = own.exists() ? tsMs(own.data().pptDeadlineOverride) : 0;
      if (ov > end) end = ov;
      if (end && Date.now() > end) return "PPT_CLOSED";
    } catch (e) {}
    return "PPT_REJECTED";
  }

  const firebase = {
    mode: "firebase",
    async getSiteContent() {                                   // settings/site is public-read
      const m = await lazy(); if (m.configProblem) throw Object.assign(new Error("FIREBASE_INIT_FAILED"), { detail: "firebase-config.js: " + m.configProblem });
      const s = await m.getDoc(m.doc(m.db, "settings", "site"));
      // The rules treat a missing document / missing switch as CLOSED, so the page must do the same (not fall back to config.js's "true").
      if (!s.exists()) return { registrationOpen: false, pptSubmissionOpen: false, _settingsMissing: true };
      const d = s.data(); d.registrationOpen = d.registrationOpen === true; d.pptSubmissionOpen = d.pptSubmissionOpen === true; d.paymentRequired = d.paymentRequired === true;
      // Saved content older than config.js's contentVersion yields to the newer defaults (FAQs) until an admin saves again.
      if ((d.contentVersion || 0) < (CFG().contentVersion || 0)) ["faqs"].forEach(k => delete d[k]);
      d.registrationDeadline = iso(d.registrationDeadline); d.pptDeadline = iso(d.pptDeadline); delete d.updatedAt; delete d.updatedBy; return d;
    },
    createRegistration: d => guard(async () => {
      const m = await fx(), uid = m.auth.currentUser.uid, email = lc(d.email), hash = await sha(email);
      // specific, friendly pre-checks (the rules re-check all of this on the server)
      const ss = await m.getDoc(m.doc(m.db, "settings", "site")); if (!ss.exists()) throw new Error("SETTINGS_MISSING");
      const sd = ss.data(); if (sd.registrationOpen !== true) throw new Error("REG_CLOSED");
      if (sd.registrationDeadline && Date.now() > tsMs(sd.registrationDeadline)) throw new Error("REG_DEADLINE");
      const status = sd.paymentRequired === true ? "pending_payment" : "registered";     // free registration when the admin turned payment off
      // server-side rate limit record (see rateLimits in firestore.rules): 1 registration / 20 s, max 8 per device
      const rl = m.doc(m.db, "rateLimits", uid), rs = await m.getDoc(rl), prev = rs.exists() ? rs.data() : null, cnt = prev ? (prev.count || 0) + 1 : 1;
      if (cnt > 8) throw new Error("RATE_LIMIT");
      if (prev && prev.last && prev.last.toMillis && Date.now() - prev.last.toMillis() < 20000) throw Object.assign(new Error("RATE_LIMIT"), { wait: 20 });
      for (let i = 0; i < 5; i++) {                            // retry on (very unlikely) ID collision
        const id = newId(), b = m.writeBatch(m.db);
        b.set(rl, { last: m.serverTimestamp(), count: cnt });
        b.set(m.doc(m.db, "registrations", id), { form: d.form || {}, email, ownerUid: uid, status, pptSubmitted: false, shortlisted: false, createdAt: m.serverTimestamp(), updatedAt: m.serverTimestamp() });
        b.set(m.doc(m.db, "statusLookup", id), { emailHash: hash, status, rejectReason: "", pptSubmitted: false, shortlisted: false });
        try { await b.commit(); return { id, email, status, form: d.form || {}, payment: null, ppt: null, pptSubmitted: false, shortlisted: false, rejectionReason: "" }; }
        catch (e) { if (e.code !== "permission-denied") throw e; if (i === 4) throw new Error(await whyCreateDenied(m, uid)); }
      }
    }),
    updateRegistration: (id, data) => guard(async () => {
      const m = await fx(), uid = m.auth.currentUser.uid, b = m.writeBatch(m.db), ref = m.doc(m.db, "registrations", id);
      const u = { updatedAt: m.serverTimestamp() }, lk = {}; let key = null;     // only fields students may write
      if (data.form) u.form = data.form;
      if (data.email) { u.email = lc(data.email); lk.emailHash = await sha(lc(data.email)); }
      if (data.payment) u.payment = Object.assign({}, data.payment, { submittedAt: m.serverTimestamp() });
      if (data.status === "registered") { u.status = lk.status = "registered"; }     // payment switched off: pending/rejected -> registered
      if (data.status === "payment_submitted") {
        u.status = lk.status = "payment_submitted"; key = txnKey(data.payment.txnId);
        const t = await m.getDoc(m.doc(m.db, "transactions", key));
        if (t.exists() && t.data().ownerUid !== uid) throw new Error("TXN_USED");
        if (!t.exists()) b.set(m.doc(m.db, "transactions", key), { ownerUid: uid, regId: id, createdAt: m.serverTimestamp() });   // same batch = guaranteed unique
      }
      b.update(ref, u); if (Object.keys(lk).length) b.update(m.doc(m.db, "statusLookup", id), lk);
      try { await b.commit(); }
      catch (e) { if (key && e.code === "permission-denied") { const t2 = await m.getDoc(m.doc(m.db, "transactions", key)); if (t2.exists() && t2.data().ownerUid !== uid) throw new Error("TXN_USED"); } throw e; }
      const s = await m.getDoc(ref); return norm(id, s.data());
    }),
    getRegistrationById: id => guard(async () => {
      const m = await fx();
      try { const s = await m.getDoc(m.doc(m.db, "registrations", up(id))); return s.exists() ? norm(s.id, s.data()) : null; }
      catch (e) { if (e.code === "permission-denied") return null; throw e; }     // not mine / not found
    }),
    getRegistrationByIdAndEmail: (id, email) => guard(async () => {
      const m = await fx(); id = up(id);
      const l = await m.getDoc(m.doc(m.db, "statusLookup", id));
      if (!l.exists() || l.data().emailHash !== await sha(lc(email))) return null;
      const own = await firebase.getRegistrationById(id); if (own) { own.email = lc(email); return own; }
      const d = l.data();      // another device: limited, personal-data-free view
      return { id, email: lc(email), status: d.status, form: {}, payment: null, ppt: null, pptSubmitted: !!d.pptSubmitted, shortlisted: !!d.shortlisted, rejectionReason: d.rejectReason || "", limited: true };
    }),
    isTransactionIdUsed: (txn) => guard(async () => { const m = await fx(), t = await m.getDoc(m.doc(m.db, "transactions", txnKey(txn))); return t.exists() && t.data().ownerUid !== m.auth.currentUser.uid; }),
    submitPpt: (id, x) => guard(async () => {
      if (typeof x !== "string" || (window.Site && window.Site.driveLink(x))) throw new Error("BAD_LINK");   // Google Drive link only
      const m = await fx(), ppt = { type: "link", url: x.trim(), submittedAt: m.serverTimestamp() };                   // rules require the server time
      const b = m.writeBatch(m.db), ref = m.doc(m.db, "registrations", id);
      b.update(ref, { ppt, pptSubmitted: true, updatedAt: m.serverTimestamp() });
      b.update(m.doc(m.db, "statusLookup", id), { pptSubmitted: true });
      try { await b.commit(); } catch (e) { if (e.code === "permission-denied") throw new Error(await whyPptDenied(m, id)); throw e; }
      return norm(id, (await m.getDoc(ref)).data());
    })
  };

  /* Client-side rate limiter: a speed bump against button-mashing and ID/email guessing.
     (It can be bypassed by a determined attacker; the real limits are the Firestore rules + App Check.) */
  function limit(name, max, winMs) {
    let st = {}; try { st = JSON.parse(localStorage.getItem(RL_KEY)) || {}; } catch (e) {}
    const t = Date.now(), arr = (st[name] || []).filter(x => t - x < winMs);
    if (arr.length >= max) throw Object.assign(new Error("RATE_LIMIT"), { wait: Math.ceil((winMs - (t - arr[0])) / 1000) });
    arr.push(t); st[name] = arr; try { localStorage.setItem(RL_KEY, JSON.stringify(st)); } catch (e) {}
    return () => { try { const s2 = JSON.parse(localStorage.getItem(RL_KEY)) || {}, a2 = s2[name] || [], i = a2.lastIndexOf(t); if (i >= 0) { a2.splice(i, 1); s2[name] = a2; localStorage.setItem(RL_KEY, JSON.stringify(s2)); } } catch (e) {} };   // refund
  }
  /* An attempt that failed only because of a setup/connection problem (not the student's fault) does not use up their allowance. */
  const SETUP_ERR = /^(AUTH_FAILED|AUTH_DISABLED|OFFLINE|SETTINGS_MISSING|REG_CLOSED|REG_DEADLINE|PPT_NOT_OPEN|PPT_CLOSED|FIREBASE_.*)$/;
  const metered = async (name, max, win, fn) => { const undo = limit(name, max, win); try { return await fn(); } catch (e) { if (SETUP_ERR.test((e && e.message) || "")) undo(); throw e; } };

  /* ---------------- PUBLIC API ----------------
     backendMode "firebase" (default) = live Firestore. There is NO silent fallback to demo any more: when firebase-config.js still has
     placeholders, is malformed, or the SDK cannot load, Backend.initError holds the reason, the pages show it, and registration stays closed.
     Demo (localStorage) is used only when config.js explicitly says backendMode: "demo". */
  const bad = v => typeof v !== "string" || !v.trim() || /PASTE|YOUR_|XXXX/i.test(v);
  let A = MODE === "firebase" ? firebase : demo, INIT_ERROR = "";
  const blocked = new Proxy({ mode: "firebase" }, { get: (t, k) => k === "mode" ? "firebase" : async () => { throw new Error("FIREBASE_NOT_CONFIGURED"); } });
  const ready = () => ready.p || (ready.p = (async () => {
    if (MODE !== "firebase") return;
    try {
      const c = (await import("./firebase-config.js")).firebaseConfig;
      const miss = !c ? ["firebaseConfig is not exported"] : ["apiKey", "authDomain", "projectId", "appId"].filter(k => bad(c[k])).map(k => k + " is missing or still a PASTE placeholder");
      if (miss.length) INIT_ERROR = "firebase-config.js: " + miss.join("; ") + ".";
    } catch (e) { INIT_ERROR = "firebase-config.js could not be loaded (" + String((e && e.message) || e) + "). It must start with `export const firebaseConfig = {...}`."; }
    if (INIT_ERROR) A = blocked;
  })());
  window.Backend = {
    get mode() { return A.mode; },
    get initError() { return INIT_ERROR; },
    async getSiteContent() {                        // config.js text is the fallback for CONTENT only; a setup/read problem is reported and keeps registration/PPT closed
      await ready();
      if (INIT_ERROR) return Object.assign({}, CFG(), { registrationOpen: false, pptSubmissionOpen: false, _initError: INIT_ERROR });
      try { const c = await A.getSiteContent(); if (!c || typeof c !== "object") throw 0; return Object.assign({}, CFG(), c); }
      catch (e) {
        const code = (e && (e.code || e.message)) || "unknown";
        if (e && e.message === "FIREBASE_INIT_FAILED") { INIT_ERROR = "Firebase could not start: " + (e.detail || "unknown error"); A = blocked; return Object.assign({}, CFG(), { registrationOpen: false, pptSubmissionOpen: false, _initError: INIT_ERROR }); }
        if (/unavailable|network|offline/i.test(code)) return CFG();                       // just offline: show the static content
        return Object.assign({}, CFG(), { registrationOpen: false, pptSubmissionOpen: false, _initError: "Could not read settings from Firestore (" + code + "). Publish the latest firestore.rules and check the Firebase project in firebase-config.js." });
      }
    },
    createRegistration: async d => { await ready(); return metered("create", 3, 300000, () => A.createRegistration(d)); },
    updateRegistration: async (id, d) => { await ready(); return d && d.payment ? metered("pay", 5, 300000, () => A.updateRegistration(id, d)) : metered("edit", 20, 60000, () => A.updateRegistration(id, d)); },
    getRegistrationById: async id => { await ready(); return A.getRegistrationById(id); },
    getRegistrationByIdAndEmail: async (id, e) => { await ready(); limit("lookup", 6, 60000); return A.getRegistrationByIdAndEmail(id, e); },
    isTransactionIdUsed: async (t, ex) => { await ready(); return A.isTransactionIdUsed(t, ex); },
    submitPpt: async (id, x) => { await ready(); return metered("ppt", 8, 300000, () => A.submitPpt(id, x)); },
    /* remember the registration ID so a student can resume after refresh */
    rememberRegistrationId(id) { try { localStorage.setItem(ID_KEY, id); } catch (e) {} },
    getRememberedRegistrationId() { try { return localStorage.getItem(ID_KEY) || ""; } catch (e) { return ""; } },
    forgetRegistrationId() { try { localStorage.removeItem(ID_KEY); } catch (e) {} },
    get demo() { return A.mode === "demo" ? tools : undefined; }
  };
})();
