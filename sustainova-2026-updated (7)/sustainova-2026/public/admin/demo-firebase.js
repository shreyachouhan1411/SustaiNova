/* admin/demo-firebase.js — PREVIEW ONLY.
   A tiny fake of the Firebase functions the admin panel uses, stored in this browser (localStorage).
   Lets you click through every admin screen with sample data BEFORE connecting Firebase.
   It is only loaded when you open  /admin/?preview  — it has no real security and is safe to delete before launch. */
const KEY = "sustainova_admin_preview";
export class Timestamp { constructor(ms) { this.ms = ms; } toDate() { return new Date(this.ms); } static fromDate(d) { return new Timestamp(d.getTime()); } static now() { return new Timestamp(Date.now()); } }
const SV = { __sv: 1 }, DEL = { __del: 1 };
export const serverTimestamp = () => SV, deleteField = () => DEL;
const rep = (k, v) => v instanceof Timestamp ? { __ts: v.ms } : v;
const rev = (k, v) => v && v.__ts !== undefined ? new Timestamp(v.__ts) : v;
const cl = o => JSON.parse(JSON.stringify(o, rep), rev);
const rid = () => "id" + Math.random().toString(36).slice(2, 10);
const save = d => localStorage.setItem(KEY, JSON.stringify(d, rep));
const load = () => { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s, rev); const d = seed(); save(d); return d; };

function seed() {
  const doms = ((window.SITE_CONFIG || {}).domains || []).map(d => d.title), dom = i => doms[i % Math.max(doms.length, 1)] || "Water Conservation and Management";
  const day = n => new Timestamp(Date.now() - n * 864e5);
  const names = ["Green Coders", "Eco Warriors", "AquaTech", "Solar Minds", "Urban Leaf", "HealthBridge", "AgriNext", "EduSpark"];
  const st = ["pending_payment", "payment_submitted", "payment_submitted", "payment_submitted", "verified", "verified", "verified", "rejected"];
  const regs = {}, lk = {};
  names.forEach((n, i) => {
    const id = "SUST26-PREV" + String(i + 1).padStart(2, "0"), s = st[i], paid = s !== "pending_payment";
    regs[id] = { email: "leader" + (i + 1) + "@example.com", ownerUid: "u" + i, status: s, rejectReason: s === "rejected" ? "Transaction ID not found in payment records" : "", verifiedBy: s === "verified" ? "preview-admin@example.com" : null,
      pptSubmitted: false, shortlisted: false, createdAt: day(9 - i), updatedAt: day(9 - i),
      form: { teamName: n, teamSize: "2", leaderName: "Student " + (i + 1), leaderEmail: "leader" + (i + 1) + "@example.com", leaderPhone: "98765432" + String(10 + i), leaderYear: "3rd year", leaderBranch: "CSE", domain: dom(i), ideaTitle: n + " sustainability idea", m1_name: "Teammate " + (i + 1), m1_email: "mate" + (i + 1) + "@example.com", m1_phone: "91234567" + String(10 + i), m1_year: "3rd year", m1_branch: "CSE" },
      ...(paid ? { payment: { txnId: "TXN" + (700100 + i), date: "2026-11-0" + (1 + i % 8), amount: i === 2 ? "250" : "300", screenshotLink: "https://drive.google.com/file/d/1PreviewSample" + (i + 1) + "AbCdEfGhIjKl/view?usp=sharing", submittedAt: day(8 - i) } } : {}) };
    lk[id] = { emailHash: "x".repeat(64), status: s, rejectReason: regs[id].rejectReason, pptSubmitted: false, shortlisted: false };
  });
  regs["SUST26-PREV05"].pptSubmitted = true; regs["SUST26-PREV05"].ppt = { type: "link", url: "https://drive.google.com/file/d/example", submittedAt: day(1) };
  regs["SUST26-PREV06"].pptSubmitted = true; regs["SUST26-PREV06"].shortlisted = true; regs["SUST26-PREV06"].ppt = { type: "link", url: "https://drive.google.com/file/d/1PreviewPptSampleAbCdEf/view?usp=sharing", submittedAt: day(2) };
  return { registrations: regs, statusLookup: lk, settings: {}, admins: {}, auditLog: {} };
}

/* ---- Firestore-like API ---- */
export const auth = {}, db = {};
export const collection = (d, name) => ({ coll: name });
export const doc = (a, coll, id) => a.coll && coll === undefined ? { coll: a.coll, id: rid() } : { coll, id };
export const getDoc = async r => { const d = (load()[r.coll] || {})[r.id]; return { id: r.id, exists: () => !!d, data: () => cl(d) }; };
export const orderBy = (field, dir = "asc") => ({ t: "o", field, dir }), limit = n => ({ t: "l", n });
export const query = (c, ...cs) => ({ coll: c.coll, cs });
export const getDocs = async q => {
  let items = Object.entries(load()[q.coll] || {}); const o = (q.cs || []).find(c => c.t === "o"), l = (q.cs || []).find(c => c.t === "l");
  const val = d => { const v = d[o.field]; return v && v.ms !== undefined ? v.ms : v; };
  if (o) { items.sort((a, b) => val(a[1]) > val(b[1]) ? 1 : -1); if (o.dir === "desc") items.reverse(); } if (l) items = items.slice(0, l.n);
  return { docs: items.map(([id, d]) => ({ id, data: () => cl(d) })) };
};
const res = o => { const r = {}; Object.keys(o).forEach(k => { r[k] = o[k] === SV ? Timestamp.now() : o[k]; }); return r; };
export const writeBatch = () => { const ops = []; return {
  set(r, data, opt) { ops.push(d => { const c = d[r.coll] = d[r.coll] || {}; c[r.id] = opt && opt.merge ? Object.assign(c[r.id] || {}, res(data)) : res(data); }); },
  update(r, data) { ops.push(d => { const x = (d[r.coll] || {})[r.id]; if (!x) throw new Error("not-found"); Object.entries(res(data)).forEach(([k, v]) => v === DEL ? delete x[k] : x[k] = v); }); },
  async commit() { const d = load(); ops.forEach(f => f(d)); save(d); } }; };
export const addDoc = async (c, data) => { const d = load(); (d[c.coll] = d[c.coll] || {})[rid()] = res(data); save(d); };

/* ---- fake auth (any email/password works) ---- */
let cb = null, user = null;
export const onAuthStateChanged = (a, f) => { cb = f; setTimeout(() => f(user), 0); };
export const signInWithEmailAndPassword = async (a, email) => { if (!email) throw new Error("no email"); user = { email: email.toLowerCase(), emailVerified: true, isAnonymous: false }; const d = load(); d.admins[user.email] = { role: "admin" }; save(d); cb && cb(user); };
export const signOut = async () => { user = null; cb && cb(null); };
