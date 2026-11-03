/* status.js — look up registration status */
(async function () {
  "use strict";
  const S = Site, $ = id => document.getElementById(id);
  const c = await S.init("status"), payReq = S.payReq(c); S.lookupFields($("lookup-fields"));
  $("fs").addEventListener("submit", async ev => {
    ev.preventDefault(); const btn = $("fs").querySelector("button[type=submit]"); if (btn.disabled) return; S.msg($("ms"), "", ""); $("result").hidden = true;
    S.busy(btn, true, "Checking…");
    try {
      const r = await S.doLookup($("fs"), $("ms")); if (!r) return;
      const eff = !payReq && (r.status === "pending_payment" || r.status === "rejected") ? "registered" : r.status;     // payment switched off: nobody is "pending payment"
      const st = S.STATUS[eff] || S.STATUS.pending_payment, f = r.form || {};
      const sl = r.shortlisted ? '<p class="msg ok"><b>Congratulations! Your team is shortlisted.</b> Shortlisted teams present offline in Round 2. The organizers will share the details.</p>' : "";
      $("result").innerHTML = sl + `<h2>${S.esc(f.teamName || "Your team")}</h2><p><span class="badge-s msg ${st.cls}">${st.label}</span></p><p>${st.text}${eff === "rejected" && r.rejectionReason ? " Reason: " + S.esc(r.rejectionReason) : ""}</p>
        <dl class="sum"><div><dt>Registration ID</dt><dd>${S.esc(r.id)}</dd></div><div><dt>PPT</dt><dd>${r.pptSubmitted ? "Submitted" : r.pptRejectReason ? "Rejected: " + S.esc(r.pptRejectReason) + " (please resubmit)" : "Not submitted yet"}</dd></div><div><dt>Shortlisting</dt><dd>${r.shortlisted ? "Shortlisted 🎉" : "Not shortlisted yet"}</dd></div></dl>
        <div class="btn-row">${payReq && (r.status === "pending_payment" || r.status === "rejected") ? '<a class="btn" href="register.html">Complete payment proof</a>' : ""}<a class="btn${payReq && (r.status === "pending_payment" || r.status === "rejected") ? " btn-ghost" : ""}" href="submit-ppt.html">Go to PPT page</a></div>`;
      $("result").hidden = false;
    } catch (x) { S.msg($("ms"), "bad", S.errText(x)); }
    finally { S.busy(btn, false); }
  });
})();
