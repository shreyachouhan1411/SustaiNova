/* register.js — 4-step registration & payment flow */
(async function () {
  "use strict";
  const S = Site, B = Backend, F = S.field, R = S.RULES, $ = id => document.getElementById(id);
  const c = await S.init("register"), payReq = S.payReq(c);     // payReq: admin setting "Is payment required?"

  /* closed / not yet open */
  if (!c.registrationOpen || S.isPast(c.registrationDeadline)) {
    $("flow").hidden = true; $("closed").hidden = false;
    $("closed-title").textContent = c.registrationOpen ? "Registration is closed" : "Registration opening soon";
    $("closed-text").textContent = c.registrationOpen ? "The registration deadline has passed. Thank you for your interest." : (c._initError ? "The site is not connected to Firebase yet. " + c._initError : c._settingsMissing ? S.errText({ message: "SETTINGS_MISSING" }) : "We are getting things ready. Please check back shortly.");
    return;
  }

  const lim = S.teamLimits(c), YEARS = ["1st year", "2nd year", "3rd year", "4th year", "Other"];
  const sizes = []; for (let i = lim.min; i <= lim.max; i++) sizes.push(String(i));
  const f1 = $("f1"), f3 = $("f3"), stepLis = [...document.querySelectorAll("#stepper li")];
  let reg = null;
  if (!payReq) {                                   // free registration: hide the payment steps, tell the student
    $("free-note").hidden = false; stepLis[1].hidden = stepLis[2].hidden = true; stepLis[3].querySelector("span").textContent = "2";
  }

  function show(n, focus) {
    [1, 2, 3, 4].forEach(i => $("step" + i).hidden = i !== n);
    stepLis.forEach((li, i) => { li.classList.toggle("done", i < n - 1); li.classList.toggle("now", i === n - 1); i === n - 1 ? li.setAttribute("aria-current", "step") : li.removeAttribute("aria-current"); });
    if (focus) { $("t" + n).focus(); window.scrollTo({ top: 0 }); }
  }

  /* ---- Step 1 ---- */
  $("team-fields").innerHTML = [
    F({ n: "teamName", l: "Team name", ph: "e.g. Green Coders", attrs: 'maxlength="60" autocomplete="off"' }),
    F({ n: "teamSize", l: "Team size", opts: sizes, hint: "Allowed: " + S.teamText(c) }),
    F({ n: "leaderName", l: "Team leader name", attrs: 'autocomplete="name"' }),
    F({ n: "leaderEmail", l: "Leader email", t: "email", attrs: 'autocomplete="email"' }),
    F({ n: "leaderPhone", l: "Leader phone (10-digit)", t: "tel", attrs: 'autocomplete="tel-national" inputmode="numeric"' }),
    F({ n: "leaderYear", l: "Leader year", opts: YEARS }),
    F({ n: "leaderBranch", l: "Leader branch", ph: "e.g. CSE" }),
    F({ n: "domain", l: "Sustainable Development Goal (SDG)", opts: c.sdgs.map(g => "SDG " + g[0] + ": " + g[1]), hint: "Choose the one SDG your idea addresses." }),
    F({ n: "ideaTitle", l: "Idea title", attrs: 'maxlength="120"' })
  ].join("");
  if (sizes.length === 1) $("teamSize").value = sizes[0];

  function renderMembers() {
    const n = parseInt($("teamSize").value) || 0, keep = Object.fromEntries(new FormData(f1));
    $("members").innerHTML = Array.from({ length: Math.max(n - 1, 0) }, (_, k) => { const i = k + 1;
      return `<fieldset class="member"><legend>Member ${i + 1}</legend><div class="fgrid">${F({ n: "m" + i + "_name", l: "Full name" })}${F({ n: "m" + i + "_email", l: "Email", t: "email" })}${F({ n: "m" + i + "_phone", l: "Phone (10-digit)", t: "tel", attrs: 'inputmode="numeric"' })}${F({ n: "m" + i + "_year", l: "Year", opts: YEARS })}${F({ n: "m" + i + "_branch", l: "Branch" })}</div></fieldset>`; }).join("");
    Object.keys(keep).forEach(k => { if (f1.elements[k] && $("members").contains(f1.elements[k])) f1.elements[k].value = keep[k]; });
  }
  $("teamSize").addEventListener("change", renderMembers); renderMembers();

  function fillForm(d) { if (!d) return; $("teamSize").value = d.teamSize || ""; renderMembers(); Object.keys(d).forEach(k => { if (f1.elements[k]) f1.elements[k].value = d[k]; }); }
  /* No two members of a team may share an email or a phone number (compared case-insensitively / digits only). The later duplicate is flagged. */
  const keyOf = { email: v => String(v).trim().toLowerCase(), phone: v => String(v).replace(/[\s-]/g, "") };
  const uniq = (kind, name) => (v, form) => {
    const base = R[kind](v); if (base) return base;
    const n = parseInt($("teamSize").value) || 0, order = [kind === "email" ? "leaderEmail" : "leaderPhone"]; for (let i = 1; i < n; i++) order.push("m" + i + "_" + kind);
    for (const k of order) { if (k === name) break; const el = form.elements[k]; if (el && keyOf[kind](el.value) === keyOf[kind](v)) return (kind === "email" ? "This email" : "This phone number") + " is already used by another member of your team. Each member needs their own."; }
    return "";
  };
  function rules() {
    const r = { teamName: R.req("Team name"), teamSize: R.req("Team size"), leaderName: R.req("Leader name"), leaderEmail: uniq("email", "leaderEmail"), leaderPhone: uniq("phone", "leaderPhone"), leaderYear: R.req("Year"), leaderBranch: R.req("Branch"), domain: R.req("SDG"), ideaTitle: R.req("Idea title") };
    const n = parseInt($("teamSize").value) || 0;
    for (let i = 1; i < n; i++) { r["m" + i + "_name"] = R.req("Name"); r["m" + i + "_email"] = uniq("email", "m" + i + "_email"); r["m" + i + "_phone"] = uniq("phone", "m" + i + "_phone"); r["m" + i + "_year"] = R.req("Year"); r["m" + i + "_branch"] = R.req("Branch"); }
    return r;
  }
  f1.addEventListener("submit", async ev => {
    ev.preventDefault(); const btn = f1.querySelector("button[type=submit]"); if (btn.disabled) return;
    S.msg($("m1"), "", ""); if (!S.validate(f1, rules())) return;
    S.busy(btn, true, "Saving…");
    try {
      const form = Object.fromEntries([...new FormData(f1)].map(([k, v]) => [k, String(v).trim()])), email = form.leaderEmail.toLowerCase();     // values are trimmed before saving
      if (reg) reg = await B.updateRegistration(reg.id, { email, form }); else { reg = await B.createRegistration({ email, form }); B.rememberRegistrationId(reg.id); }
      if (payReq) { setupPay(); show(2, true); } else { renderDone(); show(4, true); }     // no payment step when registration is free
    } catch (x) { S.msg($("m1"), "bad", S.errText(x, "We couldn't save your details. Please try again.")); }
    finally { S.busy(btn, false); }
  });

  /* ---- Step 2 ---- */
  function setupPay() {
    $("fee").textContent = S.feeText(c); $("fee-note").textContent = S.tba(c.fee && c.fee.note, ""); $("rid2").textContent = reg.id;
    const pi = S.tba(c.paymentInstructions, ""); $("pay-instr").textContent = pi; $("pay-instr").hidden = !pi;
    const a = $("pay"); if (S.isTBA(c.paymentLink)) { a.removeAttribute("href"); a.setAttribute("aria-disabled", "true"); $("pay-note").hidden = false; } else a.href = c.paymentLink;
  }
  $("paid").addEventListener("click", () => show(3, true));
  $("back1").addEventListener("click", () => { fillForm(reg.form); show(1, true); });
  $("back2").addEventListener("click", () => show(2, true));

  /* ---- Step 3 ---- */
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  $("proof-fields").innerHTML = [
    F({ n: "txnId", l: "Transaction / reference ID", attrs: 'autocomplete="off" maxlength="40" style="text-transform:uppercase"' }),
    F({ n: "payDate", l: "Payment date", t: "date", attrs: 'max="' + today + '"' }),
    F({ n: "amount", l: "Amount paid (₹)", t: "number", attrs: 'min="1" step="any" inputmode="decimal"' }),
    F({ n: "screenshotLink", l: "Payment screenshot link (Google Drive)", t: "url", ph: "https://drive.google.com/file/d/…", attrs: 'autocomplete="off" maxlength="500"', hint: "Paste the Drive share link of your payment screenshot." })
  ].join("");
  $("proof-fields").insertAdjacentHTML("beforebegin", S.driveHelp(c, "payment"));     // sharing instructions
  f3.addEventListener("submit", async ev => {
    ev.preventDefault(); const btn = f3.querySelector("button[type=submit]"); if (btn.disabled) return;
    const t = f3.elements.txnId; t.value = t.value.trim().toUpperCase(); S.msg($("m3"), "", "");
    if (!S.validate(f3, {
      txnId: v => !v ? "Transaction ID is required." : /^[A-Z0-9][A-Z0-9\-_\/]{5,39}$/.test(v) ? "" : "Use 6–40 letters, numbers, - _ or /.",
      payDate: v => !v ? "Payment date is required." : v > today ? "Date cannot be in the future." : "",
      amount: v => !v ? "Amount is required." : !(parseFloat(v) > 0) ? "Enter a valid amount." : "",
      screenshotLink: v => S.driveLink(v)
    })) return;
    S.busy(btn, true, "Submitting…");
    try {
      if (await B.isTransactionIdUsed(t.value, reg.id)) { S.err(t, "This transaction ID has already been used. Check it, or contact the coordinators."); t.focus(); return; }
      reg = await B.updateRegistration(reg.id, { status: "payment_submitted", rejectionReason: "", payment: { txnId: t.value, date: f3.elements.payDate.value, amount: f3.elements.amount.value, screenshotLink: f3.elements.screenshotLink.value.trim(), submittedAt: new Date().toISOString() } });
      renderDone(); show(4, true);
    } catch (x) {
      if (x.message === "TXN_USED") S.err(t, "This transaction ID has already been used.");
      else S.msg($("m3"), "bad", S.errText(x));
    } finally { S.busy(btn, false); }
  });

  /* ---- Step 4 ---- */
  function renderDone() {
    const f = reg.form || {}, p = reg.payment || {}, st = S.STATUS[!payReq && (reg.status === "pending_payment" || reg.status === "rejected") ? "registered" : reg.status] || S.STATUS.pending_payment;
    $("rid4").textContent = reg.id;
    $("verify-msg").textContent = !payReq || reg.status === "registered" ? "You are registered. No payment is required." : reg.status === "verified" ? "Your payment is verified." : "Your payment is under verification.";
    $("summary").innerHTML = [["Team", f.teamName], ["Team leader", f.leaderName], ["Problem domain", f.domain], ["Idea title", f.ideaTitle]].concat(!payReq || reg.status === "registered" ? [] : [["Transaction ID", p.txnId], ["Amount paid", p.amount ? "₹" + p.amount : ""]]).concat([["Status", st.label]])
      .map(r => `<div><dt>${r[0]}</dt><dd>${S.esc(r[1] || "—")}</dd></div>`).join("");
    $("ppt-dl").textContent = S.fmt(c.pptDeadline);
  }

  /* ---- resume after refresh ---- */
  $("newreg").addEventListener("click", ev => { ev.preventDefault(); B.forgetRegistrationId(); location.reload(); });
  try {
    const id = B.getRememberedRegistrationId(); reg = id ? await B.getRegistrationById(id) : null;
    if (id && !reg) B.forgetRegistrationId();
  } catch (x) { reg = null; }
  if (reg) {
    $("resume").hidden = false; fillForm(reg.form); setupPay();
    if (!payReq && (reg.status === "pending_payment" || reg.status === "rejected")) {     // payment was switched off after this team registered: they no longer need to pay
      try { reg = await B.updateRegistration(reg.id, { status: "registered" }); } catch (x) { /* shown as registered below anyway */ }
      renderDone(); show(4);
    } else if (!payReq) { renderDone(); show(4); }
    else if (reg.status === "pending_payment") show(2);
    else if (reg.status === "rejected") { $("rej").hidden = false; $("rej").textContent = "Your previous payment proof was rejected" + (reg.rejectionReason ? ": " + reg.rejectionReason : ".") + " Please submit it again."; show(3); }
    else { renderDone(); show(4); }
  } else show(1);
})();
