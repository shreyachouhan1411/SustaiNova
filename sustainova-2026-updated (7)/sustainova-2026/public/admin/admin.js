/* admin/admin.js — SUSTAINOVA admin panel.
   NOTE: real security is enforced by firestore.rules (isAdmin()). The checks here only shape the UI. */
/* "?preview" loads a fake in-browser Firebase (demo-firebase.js) so you can try the screens before connecting Firebase. */
/* Preview (fake login + sample data) exists ONLY for local testing: it is ignored on any real hostname such as your Netlify site. */
const PREVIEW = ["localhost", "127.0.0.1"].includes(location.hostname) && new URLSearchParams(location.search).has("preview");
const $ = s => document.querySelector(s);
let F;
try { F = await import(PREVIEW ? "./demo-firebase.js" : "../firebase-init.js"); }
catch (e) { $("#lmsg").textContent = "Firebase could not start: " + String((e && e.message) || e) + " (check firebase-config.js and your internet connection)."; $("#lbtn").disabled = true; throw e; }
if (!PREVIEW && F.configProblem) { $("#lmsg").textContent = "Firebase is not configured: firebase-config.js — " + F.configProblem + ". Paste your real web-app config there and redeploy."; $("#lbtn").disabled = true; throw new Error("firebase-config problem: " + F.configProblem); }
const { auth, db } = F;
if (!PREVIEW) { const st = document.createElement("p"); st.className = "hint"; st.style.cssText = "text-align:center;margin:10px 0 0"; st.textContent = "Connected to Firebase project: " + F.firebaseConfig.projectId; $("#lf").after(st); }
const H = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const DEF = window.SITE_CONFIG || {}, IST = 5.5 * 3600e3, PER = 15;
const ST = { registered: "Registered (free)", pending_payment: "Pending payment", payment_submitted: "Payment submitted", verified: "Verified", rejected: "Rejected" };
const NAV = [["dashboard", "Dashboard"], ["registrations", "Registrations"], ["payments", "Payments"], ["ppts", "PPT management"], ["shortlist", "Shortlisting"], ["content", "Site content"], ["export", "Export"]];
const MIG = ["faqs"];     // saved content older than config.js's contentVersion yields to the newer defaults for these keys
const KEYS = ["badge", "tagline", "about", "expectedOutcome", "prizeNote", "steps", "rounds", "registrationOpen", "pptSubmissionOpen", "paymentRequired", "registrationDeadline", "pptDeadline", "teamSize", "fee", "paymentInstructions", "paymentLink", "driveShareEmail", "timeline", "prizes", "faqs", "contacts", "announcements"];
let user = null, regs = [], cfg = {}, dirty = false, started = false, idle, flash = "", cur = "dashboard", timers = [], pf = "all";
const fl = { q: "", status: "", domain: "", ppt: "", short: "", page: 0 };
const V = {};
if (PREVIEW) {
  document.body.insertAdjacentHTML("afterbegin", '<div class="demo-banner" role="status">PREVIEW MODE: fake login and sample data stored only in this browser. Nothing is connected to Firebase. <a href="#" id="prev-reset" style="color:#fff">Reset sample data</a></div>');
  $("#prev-reset").onclick = e => { e.preventDefault(); localStorage.removeItem("sustainova_admin_preview"); location.reload(); };
}

/* ---------- small helpers ---------- */
const toast = (m, t = "ok") => { const e = document.createElement("div"); e.className = "toast " + t; e.textContent = m; $("#toasts").append(e); setTimeout(() => e.remove(), 4500); };
const fdt = v => { const d = v && v.toDate ? v.toDate() : v ? new Date(v) : null; return d && !isNaN(d) ? d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) + " IST" : "—"; };
const toIST = iso => iso && !isNaN(new Date(iso)) ? new Date(new Date(iso).getTime() + IST).toISOString().slice(0, 16) : "";
const getP = (o, p) => p.split(".").reduce((a, k) => a == null ? a : a[k], o);
const setP = (o, p, v) => { const k = p.split("."), l = k.pop(); k.reduce((a, x) => a[x] = a[x] == null ? {} : a[x], o)[l] = v; };
const opt = (v, l, c) => `<option value="${H(v)}" ${c === v ? "selected" : ""}>${H(l)}</option>`;
const errText = x => /permission/i.test(x && (x.code || x.message)) ? "Blocked by security rules. Are you signed in as an admin?" : /unavailable|network/i.test(x && (x.code || x.message)) ? "You seem to be offline." : "Something went wrong. Please try again.";
const safeLink = u => /^https:\/\/(drive|docs)\.google\.com\//.test(String(u || "")) ? u : "";   // only ever link to Google Drive
const payReq = () => cfg.paymentRequired === true;                           // Round 1 payment setting (default: free)
const payOk = r => !payReq() || r.status === "verified";                    // may this team be shortlisted? (payment only matters when it is required)
const feeSet = () => cfg.fee && /^\d+(\.\d+)?$/.test(String(cfg.fee.amountPerTeam));
function ask(title, text, o = {}) {                       // confirm / prompt dialog -> Promise<true|string|null>
  return new Promise(res => { const d = $("#dlg"), i = $("#dlg-i");
    $("#dlg-t").textContent = title; $("#dlg-p").textContent = text; i.hidden = !o.input; i.type = o.type || "text"; i.value = ""; $("#dlg-err").textContent = ""; $("#dlg-ok").textContent = o.ok || "Confirm";
    const done = v => { d.close(); res(v); };
    $("#dlg-ok").onclick = () => { if (o.input && !i.value.trim()) { $("#dlg-err").textContent = "This is required."; return; } done(o.input ? i.value.trim() : true); };
    $("#dlg-cancel").onclick = () => done(null); d.oncancel = e => { e.preventDefault(); done(null); }; d.showModal(); });
}
const audit = (b, action, target, details) => b.set(F.doc(F.collection(db, "auditLog")), { by: user.email, action, target, details: details || {}, at: F.serverTimestamp() });

/* ---------- auth ---------- */
function showLogin() { $("#app").hidden = true; $("#login").hidden = false; $("#drawer").hidden = true; clearTimeout(idle); timers.forEach(clearInterval); started = false; $("#lmsg").textContent = flash || (PREVIEW ? "Preview: enter any email and any password." : ""); flash = ""; }
const AUTH_MSG = { "auth/invalid-credential": "Wrong email or password.", "auth/wrong-password": "Wrong email or password.", "auth/user-not-found": "No Firebase Authentication user with this email.", "auth/invalid-email": "That email address is not valid.",
  "auth/operation-not-allowed": "Email/Password sign-in is not enabled (Firebase console > Authentication > Sign-in method).", "auth/invalid-api-key": "The apiKey in firebase-config.js is invalid.", "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "The apiKey in firebase-config.js is invalid.",
  "auth/configuration-not-found": "Authentication is not set up for this Firebase project (click Get started in Authentication).", "auth/network-request-failed": "Network error. Check your connection.", "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.", "auth/user-disabled": "This account has been disabled.", "auth/unauthorized-domain": "This website's domain is not in Authentication > Settings > Authorized domains." };
const authMsg = x => { const c = (x && x.code) || ""; return (AUTH_MSG[c] || "Sign-in failed.") + (c ? " [" + c + "]" : x && x.message ? " [" + x.message + "]" : ""); };
const deny = async m => { flash = m; await F.signOut(auth); };
$("#lf").onsubmit = async e => { e.preventDefault(); const b = $("#lbtn"); b.disabled = true; $("#lmsg").textContent = "";
  try { await F.signInWithEmailAndPassword(auth, $("#le").value.trim(), $("#lp").value); } catch (x) { console.error("Admin sign-in error:", x); $("#lmsg").textContent = authMsg(x); } finally { b.disabled = false; } };
F.onAuthStateChanged(auth, async u => {
  if (!u || u.isAnonymous) return showLogin();
  // Access = this account's lowercase email exists in the Firestore `admins` allowlist (no email verification needed). Firestore rules enforce the same check.
  const key = String(u.email).toLowerCase();
  try { const a = await F.getDoc(F.doc(db, "admins", key)); if (!a.exists()) return deny("Signed in, but there is no Firestore document admins/" + key + ". The Document ID must be exactly this lowercase email."); }
  catch (x) { console.error("Admin check error:", x); return deny(x && x.code === "permission-denied" ? "Firestore refused the admin check (permission-denied). Publish the latest firestore.rules, and make sure you signed in with email + password." : "Could not check the admin list: " + ((x && (x.code || x.message)) || "unknown error")); }
  user = u; if (!started) { started = true; startApp(); }
});
const bump = () => { clearTimeout(idle); idle = setTimeout(() => { flash = "You were signed out after 30 minutes of inactivity."; F.signOut(auth); }, 30 * 60 * 1000); };
["mousemove", "keydown", "click", "touchstart"].forEach(ev => addEventListener(ev, () => { if (started) bump(); }, { passive: true }));

async function startApp() {
  $("#login").hidden = true; $("#app").hidden = false; $("#who").textContent = user.email; bump();
  try { await Promise.all([loadCfg(), loadRegs()]); } catch (x) { toast(errText(x), "bad"); }
  route();
}
async function loadRegs() { const s = await F.getDocs(F.query(F.collection(db, "registrations"), F.orderBy("createdAt", "desc"))); regs = s.docs.map(d => ({ id: d.id, ...d.data() })); }
async function loadCfg() {
  const s = await F.getDoc(F.doc(db, "settings", "site")), r = s.exists() ? s.data() : {}; cfg = { _exists: s.exists() };
  const stale = (r.contentVersion || 0) < (DEF.contentVersion || 0);
  KEYS.forEach(k => { let v = r[k] !== undefined && !(stale && MIG.includes(k)) ? r[k] : DEF[k] !== undefined ? DEF[k] : k === "announcements" ? [] : ""; if (v && v.toDate) v = v.toDate().toISOString(); cfg[k] = JSON.parse(JSON.stringify(v === undefined ? "" : v)); });
  (cfg.rounds || []).forEach(x => { x.pointsText = (x.points || []).join("\n"); });      // editable as one point per line
}

/* ---------- router ---------- */
async function route() {
  cur = (location.hash || "#dashboard").slice(1); if (!V[cur]) cur = "dashboard";
  timers.forEach(clearInterval); timers = [];
  $("#nav").innerHTML = NAV.map(n => `<a href="#${n[0]}" class="${n[0] === cur ? "on" : ""}">${n[1]}</a>`).join(""); V[cur]();
}
let prev = "dashboard";
addEventListener("hashchange", async () => { if (dirty && prev === "content") { const ok = await ask("Discard unsaved changes?", "You have unsaved changes in Site content.", { ok: "Discard" }); if (!ok) { location.hash = "#content"; return; } dirty = false; await loadCfg(); } prev = (location.hash || "#dashboard").slice(1); route(); });
addEventListener("beforeunload", e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

/* ---------- shared data actions ---------- */
async function mutate(id, fields, lookup, action, details) {       // registrations/{id} + statusLookup/{id} + audit in ONE batch
  const b = F.writeBatch(db);
  b.update(F.doc(db, "registrations", id), { ...fields, updatedAt: F.serverTimestamp() });
  if (lookup) b.set(F.doc(db, "statusLookup", id), lookup, { merge: true });
  audit(b, action, id, details); await b.commit();
  const fresh = await F.getDoc(F.doc(db, "registrations", id)), i = regs.findIndex(x => x.id === id);      // re-read ONLY this team (not the whole list): saves Firestore reads
  if (fresh.exists()) { if (i >= 0) regs[i] = { id, ...fresh.data() }; else regs.unshift({ id, ...fresh.data() }); }
  route(); if (!$("#drawer").hidden) drawer(id);
}
const setStatus = (id, status, reason = "") => mutate(id,
  { status, rejectReason: reason, verifiedBy: status === "verified" ? user.email : null, ...(status !== "verified" ? { shortlisted: false } : {}) },
  { status, rejectReason: reason, ...(status !== "verified" ? { shortlisted: false } : {}) }, "status:" + status, { reason, txn: (regs.find(r => r.id === id).payment || {}).txnId || "" });

/* ---------- dashboard ---------- */
const cd = iso => { const d = iso ? new Date(iso) : null; if (!d || isNaN(d)) return "Not set"; const ms = d - Date.now(); if (ms <= 0) return "Passed"; const s = Math.floor(ms / 1000); return `${Math.floor(s / 86400)}d ${Math.floor(s % 86400 / 3600)}h ${Math.floor(s % 3600 / 60)}m ${s % 60}s`; };
const live = (on, dl) => !on ? "CLOSED (switch off)" : dl && new Date(dl) < Date.now() ? "CLOSED (deadline passed)" : "OPEN";
V.dashboard = () => {
  const n = f => regs.filter(f).length, st = s => n(r => r.status === s);
  const tiles = [["Total teams", regs.length], ...(payReq() && !st("registered") ? [] : [["Registered (free)", st("registered")]]), ["Pending payment", st("pending_payment")], ["Payment submitted", st("payment_submitted")], ["Verified", st("verified")], ["Rejected", st("rejected")], ["PPTs submitted", n(r => r.pptSubmitted)], ["Shortlisted", n(r => r.shortlisted)]];
  const byDom = {}; regs.forEach(r => { const d = (r.form || {}).domain || "—"; byDom[d] = (byDom[d] || 0) + 1; });
  $("#view").innerHTML = `<h1>Dashboard</h1>${cfg._exists ? "" : '<p class="warnbox">Site settings have not been published yet, so registration and PPT submission stay closed. Open “Site content” and press Save once.</p>'}
    <div class="tiles">${[["Registration", live(cfg.registrationOpen, cfg.registrationDeadline)], ["PPT submission", live(cfg.pptSubmissionOpen, cfg.pptDeadline)], ["Round 1 payment", payReq() ? "REQUIRED" : "FREE"]].map(t => `<div class="tile"><b style="font-size:1.35rem">${t[1]}</b><span>${t[0]} (live site)</span></div>`).join("")}</div>
    <div class="tiles">${tiles.map(t => `<div class="tile"><b>${t[1]}</b><span>${t[0]}</span></div>`).join("")}</div>
    <div class="tiles"><div class="tile"><span>Registration deadline<br>${fdt(cfg.registrationDeadline)}</span><b id="c1"></b></div><div class="tile"><span>PPT deadline<br>${fdt(cfg.pptDeadline)}</span><b id="c2"></b></div></div>
    <h2>Registrations per domain</h2><div class="tw"><table><tbody>${Object.entries(byDom).map(([k, v]) => `<tr><td>${H(k)}</td><td>${v}</td></tr>`).join("") || "<tr><td>No registrations yet.</td></tr>"}</tbody></table></div>`;
  const t = () => { $("#c1").textContent = cd(cfg.registrationDeadline); $("#c2").textContent = cd(cfg.pptDeadline); }; t(); timers.push(setInterval(t, 1000));
};

/* ---------- registrations ---------- */
const filtered = () => regs.filter(r => { const f = r.form || {}, q = fl.q.toLowerCase();
  return (!q || [r.id, f.teamName, f.leaderName, r.email, f.ideaTitle, (r.payment || {}).txnId].join(" ").toLowerCase().includes(q)) && (!fl.status || r.status === fl.status) && (!fl.domain || f.domain === fl.domain)
    && (!fl.ppt || (fl.ppt === "yes") === !!r.pptSubmitted) && (!fl.short || (fl.short === "yes") === !!r.shortlisted); });
V.registrations = () => {
  $("#view").innerHTML = `<h1>Registrations</h1><div class="bar"><input data-f="q" placeholder="Search ID, team, leader, email, txn…" value="${H(fl.q)}" aria-label="Search">
    <select data-f="status" aria-label="Status">${opt("", "All statuses", fl.status)}${Object.entries(ST).map(([k, v]) => opt(k, v, fl.status)).join("")}</select>
    <select data-f="domain" aria-label="Domain">${opt("", "All SDGs / domains", fl.domain)}${[...(DEF.sdgs || []).map(g => "SDG " + g[0] + ": " + g[1]), ...(DEF.domains || []).map(d => d.title)].map(t => opt(t, t, fl.domain)).join("")}</select>
    <select data-f="ppt" aria-label="PPT">${opt("", "PPT: any", fl.ppt)}${opt("yes", "PPT submitted", fl.ppt)}${opt("no", "PPT missing", fl.ppt)}</select>
    <select data-f="short" aria-label="Shortlisted">${opt("", "Shortlist: any", fl.short)}${opt("yes", "Shortlisted", fl.short)}${opt("no", "Not shortlisted", fl.short)}</select>
    <button class="btn btn-sm btn-ghost" data-act="exportcsv" type="button">Export CSV</button></div><div id="tbl"></div>`; tbl();
};
function tbl() {
  const rows = filtered(), pages = Math.max(1, Math.ceil(rows.length / PER)); fl.page = Math.min(fl.page, pages - 1); const pg = rows.slice(fl.page * PER, fl.page * PER + PER);
  $("#tbl").innerHTML = `<div class="tw"><table><thead><tr><th>ID</th><th>Team</th><th>Leader</th><th>Domain</th><th>Status</th><th>PPT</th><th>Short</th></tr></thead><tbody>${pg.map(r => { const f = r.form || {};
    return `<tr data-act="open" data-id="${r.id}" tabindex="0"><td>${r.id}</td><td>${H(f.teamName)}</td><td>${H(f.leaderName)}</td><td>${H(f.domain)}</td><td><span class="b ${r.status}">${ST[r.status] || r.status}</span></td><td>${r.pptSubmitted ? "Yes" : "—"}</td><td>${r.shortlisted ? "★" : "—"}</td></tr>`; }).join("") || '<tr><td colspan="7">No registrations match.</td></tr>'}</tbody></table></div>
    <p class="pager">${rows.length} result(s) · Page ${fl.page + 1} of ${pages} <button data-act="page" data-id="-1" type="button">Prev</button><button data-act="page" data-id="1" type="button">Next</button></p>`;
}

/* ---------- detail drawer (+ payment verification) ---------- */
async function drawer(id) {
  const r = regs.find(x => x.id === id); if (!r) return; const f = r.form || {}, p = r.payment || {}, d = $("#drawer");
  const mem = Array.from({ length: 20 }, (_, i) => i + 1).filter(i => f["m" + i + "_name"]).map(i => `<li>${H(f["m" + i + "_name"])} · ${H(f["m" + i + "_email"])} · ${H(f["m" + i + "_phone"])} · ${H(f["m" + i + "_year"])} · ${H(f["m" + i + "_branch"])}</li>`).join("");
  const warn = p.amount ? (!feeSet() ? "Fee per team is not configured, so the amount cannot be compared." : Number(p.amount) !== Number(cfg.fee.amountPerTeam) ? `Amount paid ₹${p.amount} differs from the configured fee ₹${cfg.fee.amountPerTeam}.` : "") : "";
  const row = (k, v) => `<div><dt>${k}</dt><dd>${H(v || "—")}</dd></div>`;
  $("#dt").textContent = f.teamName || r.id;
  $("#dbody").innerHTML = `<p><span class="b ${r.status}">${ST[r.status]}</span> ${r.shortlisted ? "★ Shortlisted" : ""}</p>${r.status === "rejected" ? `<p class="warnbox">Rejected: ${H(r.rejectReason)}</p>` : ""}
    <dl class="sum">${row("Registration ID", r.id)}${row("Leader", f.leaderName)}${row("Email", r.email)}${row("Phone", f.leaderPhone)}${row("Year / branch", (f.leaderYear || "") + " / " + (f.leaderBranch || ""))}${row("Domain", f.domain)}${row("Idea", f.ideaTitle)}${row("Created", fdt(r.createdAt))}${row("Verified by", r.verifiedBy)}</dl>
    <h3>Members</h3>${mem ? `<ul>${mem}</ul>` : "<p>No other members.</p>"}
    <h3>Payment proof</h3>${!payReq() && !p.txnId ? "<p>Payment is not required for this round.</p>" : ""}${p.txnId ? `<dl class="sum">${row("Transaction ID", p.txnId)}${row("Amount", "₹" + p.amount)}${row("Payment date", p.date)}</dl>${warn ? `<p class="warnbox">⚠ ${H(warn)}</p>` : ""}${safeLink(p.screenshotLink) ? `<p><a class="btn btn-sm" href="${H(p.screenshotLink)}" target="_blank" rel="noopener noreferrer">Open payment screenshot ↗</a></p><p class="hint">Opens in Google Drive in a new tab. Use the Google account the students shared with.</p>` : '<p class="warnbox">No valid screenshot link was submitted.</p>'}` : (payReq() ? "<p>No payment proof yet.</p>" : "")}
    <p class="hint">Always match the transaction ID, amount and date against the Jodo payment records before verifying.</p>
    <div class="btn-row">${["payment_submitted", "rejected"].includes(r.status) ? `<button class="btn" data-act="verify" data-id="${id}" type="button">Verify</button>` : ""}${["payment_submitted", "verified"].includes(r.status) ? `<button class="btn btn-ghost" data-act="reject" data-id="${id}" type="button">Reject</button>` : ""}</div>
    <h3>PPT</h3>${r.pptSubmitted && r.ppt ? `<p>Submitted ${fdt(r.ppt.submittedAt)}</p><div class="btn-row">${safeLink(r.ppt.url) ? `<a class="btn btn-sm btn-ghost" href="${H(r.ppt.url)}" target="_blank" rel="noopener noreferrer">Open PPT ↗</a>` : "<span>No valid link.</span>"}<button class="btn btn-sm btn-ghost" data-act="rejectppt" data-id="${id}" type="button">Reject PPT</button></div>` : r.pptRejectReason ? `<p class="warnbox">PPT rejected: ${H(r.pptRejectReason)}. The team can submit a new link while PPT submission is open.</p>` : "<p>Not submitted.</p>"}
    ${r.pptDeadlineOverride ? `<p>Team extension until ${fdt(r.pptDeadlineOverride)}</p>` : ""}`;
  d.hidden = false;
}

/* ---------- payments / ppts / shortlist ---------- */
V.payments = () => {
  const rows = regs.filter(r => r.status === "payment_submitted");
  $("#view").innerHTML = `<h1>Payment verification</h1><p class="warnbox">Match every transaction against the Jodo payment records before verifying.</p><div class="tw"><table><thead><tr><th>ID</th><th>Team</th><th>Txn ID</th><th>Amount</th><th>Date</th><th>Screenshot</th><th></th></tr></thead><tbody>${rows.map(r => { const p = r.payment || {}, bad = feeSet() && Number(p.amount) !== Number(cfg.fee.amountPerTeam);
    return `<tr><td>${r.id}</td><td>${H((r.form || {}).teamName)}</td><td>${H(p.txnId)}</td><td>₹${H(p.amount)} ${bad ? "⚠" : ""}</td><td>${H(p.date)}</td><td>${safeLink(p.screenshotLink) ? `<a class="mini" href="${H(p.screenshotLink)}" target="_blank" rel="noopener noreferrer">Open ↗</a>` : "—"}</td><td><button class="mini" data-act="open" data-id="${r.id}" type="button">Review</button></td></tr>`; }).join("") || '<tr><td colspan="7">Nothing waiting for verification.</td></tr>'}</tbody></table></div>`;
};
V.ppts = () => {                                   // PPT review is independent of payment: every team is listed
  const rows = regs.filter(r => pf === "all" || (pf === "yes") === !!r.pptSubmitted);
  $("#view").innerHTML = `<h1>PPT management</h1><div class="bar"><select data-pf aria-label="Filter">${opt("all", "All teams", pf)}${opt("yes", "Submitted", pf)}${opt("no", "Not submitted", pf)}</select></div><div class="tw"><table><thead><tr><th>Team</th><th>Payment</th><th>PPT</th><th>Extension</th><th></th></tr></thead><tbody>${rows.map(r => `<tr><td>${H((r.form || {}).teamName)}<br><small>${r.id}</small></td><td><span class="b ${r.status}">${ST[r.status] || r.status}</span></td><td>${r.pptSubmitted && r.ppt ? fdt(r.ppt.submittedAt) + (r.shortlisted ? " · ★" : "") : r.pptRejectReason ? "Rejected" : "Missing"}</td><td>${r.pptDeadlineOverride ? fdt(r.pptDeadlineOverride) : "—"}</td>
    <td>${r.pptSubmitted && r.ppt ? (safeLink(r.ppt.url) ? `<a class="mini" href="${H(r.ppt.url)}" target="_blank" rel="noopener noreferrer">Open ↗</a>` : "") + ` <button class="mini" data-act="rejectppt" data-id="${r.id}" type="button">Reject</button>` : ""} <button class="mini" data-act="ext" data-id="${r.id}" type="button">Extend</button>${r.pptDeadlineOverride ? ` <button class="mini" data-act="clearext" data-id="${r.id}" type="button">Clear</button>` : ""}</td></tr>`).join("") || '<tr><td colspan="5">No teams.</td></tr>'}</tbody></table></div>`;
};
V.shortlist = () => {
  const rows = regs.filter(r => payOk(r) && r.pptSubmitted);
  $("#view").innerHTML = `<h1>Shortlisting</h1><p class="hint">${payReq() ? "Only teams with verified payment and a submitted PPT can be shortlisted." : "Payment is not required, so every team with a submitted PPT can be shortlisted."}</p><div class="btn-row"><button class="btn btn-sm" data-act="short" type="button">Shortlist selected</button><button class="btn btn-sm btn-ghost" data-act="unshort" type="button">Remove from shortlist</button></div>
    <div class="tw"><table><thead><tr><th><input type="checkbox" data-act="sall" aria-label="Select all" style="width:auto;min-height:0"></th><th>Team</th><th>Domain</th><th>Idea</th><th>Shortlisted</th></tr></thead><tbody>${rows.map(r => { const f = r.form || {};
    return `<tr><td><input class="sel" type="checkbox" value="${r.id}" aria-label="Select ${H(f.teamName)}" style="width:auto;min-height:0"></td><td>${H(f.teamName)}</td><td>${H(f.domain)}</td><td>${H(f.ideaTitle)}</td><td>${r.shortlisted ? "★ Yes" : "—"}</td></tr>`; }).join("") || '<tr><td colspan="5">No eligible teams yet.</td></tr>'}</tbody></table></div>`;
};
async function bulkShort(val) {
  const ids = [...document.querySelectorAll(".sel:checked")].map(x => x.value); if (!ids.length) return toast("Select at least one team.", "bad");
  if (!await ask(val ? "Shortlist teams?" : "Remove from shortlist?", ids.length + " team(s) will be updated and the status page will change for them.")) return;
  for (let i = 0; i < ids.length; i += 100) { const part = ids.slice(i, i + 100), b = F.writeBatch(db);
    part.forEach(id => { b.update(F.doc(db, "registrations", id), { shortlisted: val, updatedAt: F.serverTimestamp() }); b.set(F.doc(db, "statusLookup", id), { shortlisted: val }, { merge: true }); });
    audit(b, val ? "shortlist" : "unshortlist", "bulk", { ids: part }); await b.commit(); }
  regs.forEach(r => { if (ids.includes(r.id)) r.shortlisted = val; }); route(); toast("Shortlist updated.");     // local update, no re-read of every team
}

/* ---------- site content editor ---------- */
const fld = (p, l, t = "text", x = "") => `<div class="field"><label>${l}<input data-p="${p}" type="${t}" value="${H(getP(cfg, p))}" ${x}></label></div>`;
const dtf = (p, l) => `<div class="field"><label>${l} (IST)<input data-p="${p}" data-dt="1" type="datetime-local" value="${toIST(getP(cfg, p))}"></label><p class="hint">Leave empty for “To be announced”.</p></div>`;
const rowBtns = (l, i) => `<div class="wide"><button class="mini" data-act="li" data-l="${l}" data-i="${i}" data-op="up" type="button">↑</button> <button class="mini" data-act="li" data-l="${l}" data-i="${i}" data-op="down" type="button">↓</button> <button class="mini" data-act="li" data-l="${l}" data-i="${i}" data-op="del" type="button">Remove</button></div>`;
V.content = () => {
  const tog = (k, l) => `<label class="tog"><input type="checkbox" data-tog="${k}" ${cfg[k] ? "checked" : ""}> <span>${l}: <b>${cfg[k] ? "ON" : "OFF"}</b></span></label>`;
  $("#view").innerHTML = `<h1>Site content <span id="dirty" class="b rejected" ${dirty ? "" : "hidden"}>Unsaved changes</span></h1>
  <div class="card">${tog("registrationOpen", "Registration open")}${tog("pptSubmissionOpen", "PPT submission open")}${tog("paymentRequired", "Round 1 payment required")}<p class="hint">Switches save immediately after you confirm. “Payment required” OFF = free registration (no payment step, no verification). The PPT switch and deadline below are independent of payment.</p></div>
  <form id="cf" class="card" novalidate style="margin-top:18px"><h2>Home page text</h2><p class="hint">Badge under the logo: leave it empty to show the registration deadline automatically.</p>
  <div class="fgrid">${fld("badge", "Badge under the logo")}${fld("tagline", "Tagline")}
  <div class="field" style="grid-column:1/-1"><label>About (intro paragraph)<textarea data-p="about" maxlength="800" rows="3">${H(cfg.about)}</textarea></label></div>
  <div class="field" style="grid-column:1/-1"><label>Expected outcome<textarea data-p="expectedOutcome" maxlength="500" rows="2">${H(cfg.expectedOutcome)}</textarea></label></div>
  <div class="field" style="grid-column:1/-1"><label>Prize note<textarea data-p="prizeNote" maxlength="400" rows="2">${H(cfg.prizeNote)}</textarea></label></div></div>
  <h2>How it works (steps)</h2>${cfg.steps.map((t, i) => `<div class="row" style="grid-template-columns:1fr 2fr">${fld(`steps.${i}.title`, "Step title")}${fld(`steps.${i}.text`, "Step text")}${rowBtns("steps", i)}</div>`).join("")}<button class="mini" data-act="add" data-l="steps" type="button">+ Add step</button>
  <h2>Rounds</h2><p class="hint">One point per line.</p>${cfg.rounds.map((t, i) => `<div class="row">${fld(`rounds.${i}.name`, "Round name")}${fld(`rounds.${i}.mode`, "Mode (Online / Offline)")}<div class="wide field"><label>Points<textarea data-p="rounds.${i}.pointsText" rows="3">${H(t.pointsText)}</textarea></label></div></div>`).join("")}
  <h2>Deadlines</h2><div class="fgrid">${dtf("registrationDeadline", "Registration deadline")}${dtf("pptDeadline", "PPT deadline")}</div>
  <h2>Team &amp; fee</h2><p class="hint">Fee and payment details are used only while “Is payment required?” is ON.</p><div class="fgrid">${fld("teamSize.min", "Team size min (number or TBA)")}${fld("teamSize.max", "Team size max (number or TBA)")}${fld("fee.amountPerTeam", "Fee per team (₹, blank = TBA)")}${fld("fee.note", "Fee note")}<div class="field" style="grid-column:1/-1"><label>Payment instructions (shown on the payment step)<textarea data-p="paymentInstructions" maxlength="1000" rows="3">${H(cfg.paymentInstructions)}</textarea></label></div>${fld("paymentLink", "Jodo payment link (https://…)", "url")}${fld("driveShareEmail", "Organizer Google account for Drive sharing", "email")}</div>
  <h2>Timeline</h2>${cfg.timeline.map((t, i) => `<div class="row">${fld(`timeline.${i}.label`, "Label")}${fld(`timeline.${i}.date`, "Date text")}</div>`).join("")}
  <h2>Prizes</h2>${cfg.prizes.map((t, i) => `<div class="row">${fld(`prizes.${i}.position`, "Position")}${fld(`prizes.${i}.title`, "Title")}${fld(`prizes.${i}.amount`, "Amount (blank = TBA)")}${fld(`prizes.${i}.note`, "Note")}</div>`).join("")}
  <h2>FAQs</h2>${cfg.faqs.map((t, i) => `<div class="row">${fld(`faqs.${i}.q`, "Question")}<div class="wide field"><label>Answer<textarea data-p="faqs.${i}.a">${H(t.a)}</textarea></label></div>${rowBtns("faqs", i)}</div>`).join("")}<button class="mini" data-act="add" data-l="faqs" type="button">+ Add FAQ</button>
  <h2>Contacts</h2>${cfg.contacts.map((t, i) => `<div class="row">${fld(`contacts.${i}.name`, "Name")}${fld(`contacts.${i}.role`, "Role")}${fld(`contacts.${i}.phone`, "Phone")}${fld(`contacts.${i}.email`, "Email", "email")}${rowBtns("contacts", i)}</div>`).join("")}<button class="mini" data-act="add" data-l="contacts" type="button">+ Add contact</button>
  <h2>Announcements</h2><p class="hint">The first active one shows as a banner on every public page.</p>${cfg.announcements.map((t, i) => `<div class="row">${fld(`announcements.${i}.text`, "Text")}<label class="tog"><input type="checkbox" data-p="announcements.${i}.active" ${t.active ? "checked" : ""}> Active</label>${rowBtns("announcements", i)}</div>`).join("")}<button class="mini" data-act="add" data-l="announcements" type="button">+ Add announcement</button>
  <p id="cerr" class="msg-t" role="alert"></p><div class="btn-row"><button class="btn" type="submit">Save changes</button></div></form>`;
  $("#cf").onsubmit = async e => { e.preventDefault(); const m = validate(); $("#cerr").textContent = m; if (m) return toast(m, "bad"); if (!await ask("Publish changes?", "These changes go live on the public site immediately.", { ok: "Save" })) return;
    try { const b = F.writeBatch(db); b.set(F.doc(db, "settings", "site"), payload(), { merge: true }); audit(b, "settings:save", "settings/site", {}); await b.commit(); dirty = false; cfg._exists = true; toast("Saved. The public site shows the changes now."); V.content(); } catch (x) { toast(errText(x), "bad"); } };
};
const ts = v => v ? F.Timestamp.fromDate(new Date(v)) : null, num = v => /^\d+$/.test(String(v).trim()) ? Number(v) : "TBA";
function payload() { const c = cfg;
  return { badge: String(c.badge || "").trim(), tagline: String(c.tagline || "").trim(), about: String(c.about || "").trim(), expectedOutcome: String(c.expectedOutcome || "").trim(), prizeNote: String(c.prizeNote || "").trim(),
    steps: c.steps.map(s => ({ title: String(s.title || "").trim(), text: String(s.text || "").trim() })),
    rounds: c.rounds.map(r => ({ name: String(r.name || "").trim(), mode: String(r.mode || "").trim(), points: String(r.pointsText || "").split("\n").map(x => x.trim()).filter(Boolean) })),
    contentVersion: DEF.contentVersion || 0,
    registrationOpen: !!c.registrationOpen, pptSubmissionOpen: !!c.pptSubmissionOpen, paymentRequired: c.paymentRequired === true, registrationDeadline: ts(c.registrationDeadline), pptDeadline: ts(c.pptDeadline),
    teamSize: { min: num(c.teamSize.min), max: num(c.teamSize.max) }, fee: { amountPerTeam: String(c.fee.amountPerTeam || "").trim() === "" ? "" : Number(c.fee.amountPerTeam), note: c.fee.note || "" }, paymentInstructions: String(c.paymentInstructions || "").trim().slice(0, 1000), paymentLink: String(c.paymentLink || "").trim(),
    driveShareEmail: String(c.driveShareEmail || "").trim().toLowerCase(), timeline: c.timeline, prizes: c.prizes, faqs: c.faqs, contacts: c.contacts, announcements: c.announcements, updatedAt: F.serverTimestamp(), updatedBy: user.email }; }
function validate() { const c = cfg, mn = num(c.teamSize.min), mx = num(c.teamSize.max);
  if ((mn === "TBA") !== (mx === "TBA")) return "Team size: set both min and max, or leave both as TBA.";
  if (mn !== "TBA" && (mn < 1 || mx < mn)) return "Team size: min must be at least 1 and not above max.";
  const fe = String(c.fee.amountPerTeam || "").trim(); if (fe && !(Number(fe) >= 0)) return "Fee must be a number.";
  if (String(c.paymentInstructions || "").length > 1000) return "Payment instructions are too long (max 1000 characters).";
  if (c.paymentLink && !/^https:\/\/\S+$/.test(String(c.paymentLink).trim())) return "Payment link must start with https://";
  if (c.driveShareEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.driveShareEmail)) return "The Drive sharing email is not a valid email address.";
  for (const k of ["registrationDeadline", "pptDeadline"]) if (c[k] && isNaN(new Date(c[k]))) return "Invalid date in " + k + ".";
  if (c.steps.some(s => !String(s.title || "").trim())) return "Every step needs a title (or remove it).";
  if (c.rounds.some(r => !String(r.name || "").trim())) return "Every round needs a name.";
  if (String(c.badge || "").length > 80) return "The badge text is too long (max 80 characters).";
  if (c.prizes.some(p => !String(p.title || "").trim())) return "Every prize needs a title.";
  if (c.faqs.some(f => !String(f.q || "").trim() || !String(f.a || "").trim())) return "Every FAQ needs a question and an answer.";
  for (const p of c.contacts) { if (!String(p.name || "").trim()) return "Every contact needs a name."; if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(p.email)) return "Invalid contact email."; if (p.phone && !/^\+?[\d\s-]{10,15}$/.test(p.phone)) return "Invalid contact phone."; }
  if (c.announcements.some(a => !String(a.text || "").trim())) return "Announcements need text (or remove them).";
  return ""; }

/* ---------- export ---------- */
function csv(rows) { return "\ufeff" + rows.map(r => r.map(v => { v = String(v == null ? "" : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(",")).join("\r\n"); }
V.export = () => { $("#view").innerHTML = `<h1>Export</h1><p>${filtered().length} registration(s) match the current filter (set it under Registrations). The CSV has all non-file fields.</p><button class="btn" data-act="exportcsv" type="button">Download CSV</button>`; };
async function exportCsv() {
  const rows = filtered(), head = ["Registration ID", "Status", "Reject reason", "Team", "Team size", "Leader", "Email", "Phone", "Year", "Branch", "Domain", "Idea title", "Members", "Txn ID", "Amount", "Payment date", "Payment screenshot link", "PPT submitted", "PPT type", "PPT link", "PPT submitted at", "Shortlisted", "Created"];
  const out = rows.map(r => { const f = r.form || {}, p = r.payment || {}, ppt = r.ppt || {};
    const mem = Array.from({ length: 20 }, (_, i) => i + 1).filter(i => f["m" + i + "_name"]).map(i => ["name", "email", "phone", "year", "branch"].map(k => f["m" + i + "_" + k]).join(" | ")).join(" ; ");
    return [r.id, r.status, r.rejectReason, f.teamName, f.teamSize, f.leaderName, r.email, f.leaderPhone, f.leaderYear, f.leaderBranch, f.domain, f.ideaTitle, mem, p.txnId, p.amount, p.date, p.screenshotLink, r.pptSubmitted ? "Yes" : "No", ppt.type, ppt.url, fdt(ppt.submittedAt), r.shortlisted ? "Yes" : "No", fdt(r.createdAt)]; });
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv([head, ...out])], { type: "text/csv;charset=utf-8" })); a.download = "sustainova-registrations-" + new Date().toISOString().slice(0, 10) + ".csv"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  await F.addDoc(F.collection(db, "auditLog"), { by: user.email, action: "export:csv", target: "registrations", details: { rows: rows.length }, at: F.serverTimestamp() }); toast("CSV downloaded.");
}

/* ---------- events ---------- */
const ACT = {
  logout: () => F.signOut(auth), closedrawer: () => { $("#drawer").hidden = true; },
  open: (t, id) => drawer(id), page: (t, id) => { fl.page += Number(id); tbl(); }, exportcsv: exportCsv,
  verify: async (t, id) => { if (await ask("Verify this payment?", "The team will see “Verified” and can submit their PPT. Have you matched it with the Jodo records?", { ok: "Verify" })) { await setStatus(id, "verified"); toast("Payment verified."); } },
  reject: async (t, id) => { const why = await ask("Reject this payment?", "Give a reason. The student will see it on their status page.", { input: true, ok: "Reject" }); if (why) { await setStatus(id, "rejected", why); toast("Payment rejected."); } },
  ext: async (t, id) => { const v = await ask("Extend PPT deadline", "New deadline for this team only (IST).", { input: true, type: "datetime-local", ok: "Grant extension" }); if (!v) return; const d = new Date(v + ":00+05:30");
    if (d <= new Date()) return toast("Pick a future date and time.", "bad"); await mutate(id, { pptDeadlineOverride: F.Timestamp.fromDate(d) }, null, "ppt-extension", { until: d.toISOString() }); toast("Extension granted."); },
  clearext: async (t, id) => { if (await ask("Remove extension?", "The team falls back to the global PPT deadline.")) { await mutate(id, { pptDeadlineOverride: F.deleteField() }, null, "ppt-extension-clear", {}); toast("Extension removed."); } },
  rejectppt: async (t, id) => { const why = await ask("Reject this PPT?", "Give a reason. The team will see it and can submit a new link while PPT submission is open.", { input: true, ok: "Reject PPT" }); if (!why) return;
    await mutate(id, { pptSubmitted: false, shortlisted: false, pptRejectReason: why }, { pptSubmitted: false, shortlisted: false }, "ppt-reject", { reason: why }); toast("PPT rejected."); },
  short: () => bulkShort(true), unshort: () => bulkShort(false), sall: t => document.querySelectorAll(".sel").forEach(c => c.checked = t.checked),
  add: t => { const l = t.dataset.l; cfg[l].push(l === "faqs" ? { q: "", a: "" } : l === "steps" ? { title: "", text: "" } : l === "contacts" ? { name: "", role: "", phone: "", email: "" } : { text: "", active: false }); dirty = true; V.content(); },
  li: t => { const l = cfg[t.dataset.l], i = +t.dataset.i, op = t.dataset.op; if (op === "del") l.splice(i, 1); else { const j = op === "up" ? i - 1 : i + 1; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; } dirty = true; V.content(); }
};
document.addEventListener("click", async e => { const t = e.target.closest("[data-act]"); if (!t || t.tagName === "INPUT" && t.type === "checkbox" && t.dataset.act !== "sall") return; if (t.tagName === "INPUT") return; try { await ACT[t.dataset.act](t, t.dataset.id); } catch (x) { toast(errText(x), "bad"); } });
document.addEventListener("change", async e => { const t = e.target;
  if (t.dataset.act === "sall") ACT.sall(t);
  if (t.dataset.pf !== undefined) { pf = t.value; V.ppts(); }
  if (t.dataset.tog) { const k = t.dataset.tog, v = t.checked; t.checked = !v;
    if (!await ask((v ? "Turn ON " : "Turn OFF ") + (k === "registrationOpen" ? "registration" : k === "pptSubmissionOpen" ? "PPT submission" : "the payment requirement for registration") + "?", "This takes effect on the public site immediately.", { ok: "Yes, change it" })) return;
    try { const b = F.writeBatch(db); b.set(F.doc(db, "settings", "site"), { [k]: v, updatedAt: F.serverTimestamp(), updatedBy: user.email }, { merge: true }); audit(b, "toggle:" + k, "settings/site", { value: v }); await b.commit(); cfg[k] = v; cfg._exists = true; toast("Updated."); V.content(); } catch (x) { toast(errText(x), "bad"); } } });
document.addEventListener("input", e => { const t = e.target;
  if (t.dataset.f !== undefined) { fl[t.dataset.f] = t.value; fl.page = 0; tbl(); return; }
  if (t.dataset.p) { let v = t.type === "checkbox" ? t.checked : t.value; if (t.dataset.dt) v = v ? v + ":00+05:30" : ""; setP(cfg, t.dataset.p, v); dirty = true; const d = $("#dirty"); if (d) d.hidden = false; } });
document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.matches("tr[data-act=open]")) e.target.click(); });

/* show/hide password on the login page */
$("#pwt").onclick = () => { const i = $("#lp"), s = i.type === "password"; i.type = s ? "text" : "password"; $("#pwt").textContent = s ? "Hide" : "Show"; $("#pwt").setAttribute("aria-label", s ? "Hide password" : "Show password"); };
