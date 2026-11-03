/* ppt.js — PPT submission: its own open/closed switch, its own deadline and an optional per-team extension.
   It is completely independent of payment (free or paid, verified or not). The real enforcement is in firestore.rules. */
(async function () {
  "use strict";
  const S = Site, B = Backend, $ = id => document.getElementById(id);
  const c = await S.init("ppt");
  let reg = null, iv = null;

  const dlFor = r => { const o = r && r.pptDeadlineOverride, g = S.toDate(c.pptDeadline), od = S.toDate(o); return od && (!g || od > g) ? o : c.pptDeadline; };
  const phase = r => S.isPast(dlFor(r)) ? "closed" : !c.pptSubmissionOpen ? "notopen" : "open";
  const hideAll = () => { $("lookup").hidden = $("upload").hidden = $("gate").hidden = true; };
  function applyPhase() {
    const p = phase(reg), st = $("state");
    if (p === "closed") { S.msg(st, "bad", reg ? "PPT submissions are now closed." : "PPT submissions are now closed. If the organizers extended your team's deadline, look up your registration below."); if (reg) hideAll(); $("count").textContent = ""; }
    else if (p === "notopen") { S.msg(st, "warn", "PPT submission has not opened yet. Please check back soon."); hideAll(); }
    else S.msg(st, "", "");
    return p;
  }
  function countdown() {
    clearInterval(iv); $("dl").textContent = S.fmt(dlFor(reg)); const d = S.toDate(dlFor(reg));
    if (!d) { $("count").textContent = ""; return; }
    const tick = () => { const ms = d - Date.now(); if (ms <= 0) { clearInterval(iv); applyPhase(); return; }
      const s = Math.floor(ms / 1000), dd = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
      $("count").textContent = (dd ? dd + "d " : "") + h + "h " + m + "m " + (s % 60) + "s left"; };
    iv = setInterval(tick, 1000); tick();
  }
  if (applyPhase() === "notopen") return;
  countdown();

  S.lookupFields($("lookup-fields"));
  $("fl").addEventListener("submit", async ev => {
    ev.preventDefault(); const btn = $("fl").querySelector("button[type=submit]"); if (btn.disabled) return; S.msg($("ml"), "", "");
    S.busy(btn, true, "Checking…");
    try {
      reg = await S.doLookup($("fl"), $("ml")); if (!reg) return;
      $("lookup").hidden = true; countdown(); if (applyPhase() !== "open") return;
      const g = gate(reg);
      if (g) { $("gate").hidden = false; $("gate-t").textContent = g[0]; $("gate-p").textContent = g[1]; $("gate-a").href = g[2] || "status.html"; $("gate-a").textContent = g[2] ? "Go to registration" : "Check status"; }
      else showUpload();
    } catch (x) { S.msg($("ml"), "bad", S.errText(x)); }
    finally { S.busy(btn, false); }
  });

  function gate(r) {                                  // only the device check remains: payment is NOT a condition
    if (r.limited) return ["Use the browser you registered with", "For security, PPTs can only be submitted from the device and browser used to register. Open this page there. You can still check your status from any device."];
    return null;
  }

  function showUpload() {
    $("upload").hidden = false;
    $("up-fields").innerHTML = S.driveHelp(c, "ppt") + S.field({ n: "link", l: "Google Drive link to your PPT", t: "url", ph: "https://drive.google.com/file/d/…", attrs: 'autocomplete="off" maxlength="500"' });
    showCurrent(); $("sub").textContent = reg.pptSubmitted ? "Replace PPT" : "Submit PPT";
  }
  function showCurrent() {
    if (reg.pptSubmitted && reg.ppt) S.msg($("current"), "ok", "Submitted on " + S.fmt(reg.ppt.submittedAt) + ": " + reg.ppt.url);
    else if (reg.pptRejectReason) S.msg($("current"), "bad", "Your previous PPT was rejected: " + reg.pptRejectReason + ". Please submit a corrected Drive link.");
  }

  $("fu").addEventListener("submit", async ev => {
    ev.preventDefault(); const btn = $("sub"); if (btn.disabled) return; S.msg($("mu"), "", "");
    if (applyPhase() !== "open") return;
    const le = $("link"), link = le.value.trim(); S.err(le, "");
    const bad = S.driveLink(link); if (bad) { S.err(le, bad); le.focus(); return; }
    const label = btn.textContent; S.busy(btn, true, "Submitting…");
    try {
      reg = await B.submitPpt(reg.id, link);
      le.value = ""; showCurrent(); S.msg($("mu"), "ok", "Success! Your PPT was received on " + S.fmt(reg.ppt.submittedAt) + ". You can replace it until the deadline.");
      btn.dataset.l = "Replace PPT";
    } catch (x) {
      const M = { PPT_CLOSED: "PPT submissions are now closed.", PPT_NOT_OPEN: "PPT submission has not opened yet." };
      S.msg($("mu"), "bad", M[x.message] || S.errText(x)); btn.dataset.l = label; applyPhase();
    } finally { S.busy(btn, false); }
  });
})();
