/* common.js — shared helpers, navbar/footer, validation. No event content lives here. */
(function () {
  "use strict";
  document.documentElement.classList.add("js");
  const NA = "To be announced";
  const S = window.Site = { NA };

  /* ---- text & date helpers ---- */
  S.esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  S.isTBA = v => v == null || String(v).trim() === "" || /^tba$/i.test(String(v).trim());
  S.tba = (v, fb) => S.isTBA(v) ? (fb === undefined ? NA : fb) : String(v);
  S.toDate = iso => {                                   // dates without an offset are treated as IST
    if (S.isTBA(iso)) return null; let s = String(iso).trim();
    if (/^\d{4}-\d\d-\d\d$/.test(s)) s += "T23:59:59";
    if (!/([zZ]|[+-]\d\d:?\d\d)$/.test(s)) s += "+05:30";
    const d = new Date(s); return isNaN(d) ? null : d;
  };
  S.fmt = iso => { const d = S.toDate(iso); return d ? d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) + " IST" : NA; };
  S.isPast = iso => { const d = S.toDate(iso); return !!d && Date.now() > d.getTime(); };
  S.teamLimits = c => { const a = parseInt(c.teamSize && c.teamSize.min), b = parseInt(c.teamSize && c.teamSize.max); const mn = isNaN(a) ? 1 : a; return { min: mn, max: isNaN(b) ? 6 : Math.max(b, mn) }; };
  S.teamText = c => { const t = c.teamSize || {}; return S.isTBA(t.min) || S.isTBA(t.max) ? NA : (t.min == t.max ? t.min : t.min + "–" + t.max) + " members"; };
  S.payReq = c => !!c && c.paymentRequired === true;     // admin setting: is payment required for registration? (default: free)
  S.feeText = c => { if (!S.payReq(c)) return "Free"; const a = c.fee && c.fee.amountPerTeam; return S.isTBA(a) ? NA : (/^\d+(\.\d+)?$/.test(String(a)) ? "₹" + a : String(a)) + " per team"; };
  S.tpl = (s, c) => String(s).replace(/\{\{(\w+)\}\}/g, (m, k) => ({ teamSize: S.teamText(c), fee: S.feeText(c), feeNote: S.payReq(c) ? "Pay once for the whole team." : "No payment is required.", feeInfo: S.payReq(c) ? "Fee: " + S.feeText(c) + ". Pay once for the whole team." : "Round 1 registration is free. No payment is required.", pptDeadline: S.fmt(c.pptDeadline), registrationDeadline: S.fmt(c.registrationDeadline) }[k] || m));
  S.bind = c => {                                        // fills any [data-cfg="path"] element
    const v = { _team: S.teamText(c), _fee: S.feeText(c), _pptDeadline: S.fmt(c.pptDeadline), _regDeadline: S.fmt(c.registrationDeadline) };
    document.querySelectorAll("[data-cfg]").forEach(el => { const k = el.dataset.cfg; el.textContent = S.tba(k in v ? v[k] : k.split(".").reduce((o, p) => o && o[p], c)); });
  };

  /* ---- icons & statuses ---- */
  const IC = {
    leaf: "<path d='M5 20C4 10 10 4 20 4c0 10-6 16-15 16z'/><path d='M5 20c3-5 6-8 10-11'/>",
    bulb: "<path d='M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z'/>",
    users: "<circle cx='9' cy='8' r='3'/><path d='M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M18 20a6 6 0 0 0-3-5'/>",
    globe: "<circle cx='12' cy='12' r='9'/><path d='M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18'/>",
    recycle: "<path d='M21 12a9 9 0 0 1-15.5 6.2M3 12A9 9 0 0 1 18.5 5.8M18.5 2v4h-4M5.5 22v-4h4'/>",
    droplet: "<path d='M12 3s6 6.2 6 10.5A6 6 0 0 1 6 13.5C6 9.2 12 3 12 3z'/>",
    sun: "<circle cx='12' cy='12' r='4'/><path d='M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'/>",
    book: "<path d='M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M9 7h6'/>",
    sprout: "<path d='M12 21v-8M12 13c0-4 3-6 7-6 0 4-3 6-7 6zM12 15c0-3-2-5-6-5 0 3 2 5 6 5z'/>",
    city: "<path d='M3 21h18M5 21V8l6-3v16M11 21V11h8v10M8 10h0M8 14h0M15 14h0M15 17h0'/>",
    heart: "<path d='M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z'/>",
    arrow: "<path d='M5 12h14M13 6l6 6-6 6'/>"
  };
  S.icon = n => "<svg viewBox='0 0 24 24' width='24' height='24' fill='none' stroke='currentColor' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true' focusable='false'>" + (IC[n] || IC.leaf) + "</svg>";
  S.STATUS = {
    registered:        { label: "Registered",        cls: "ok",   text: "You are registered. No payment is required." },
    pending_payment:   { label: "Pending payment",   cls: "warn", text: "Registration saved. Payment proof has not been submitted yet." },
    payment_submitted: { label: "Payment submitted", cls: "note", text: "Your payment is under verification." },
    verified:          { label: "Verified",          cls: "ok",   text: "Your payment is verified." },
    rejected:          { label: "Rejected",          cls: "bad",  text: "Your payment proof could not be verified." }
  };

  /* ---- forms ---- */
  S.field = o => {
    const n = o.n, t = o.t || "text", req = o.req !== false;
    const ctl = o.opts
      ? `<select id="${n}" name="${n}" aria-describedby="${n}-err"><option value="">Select…</option>${o.opts.map(x => `<option>${S.esc(x)}</option>`).join("")}</select>`
      : `<input id="${n}" name="${n}" type="${t}" placeholder="${S.esc(o.ph || "")}" aria-describedby="${n}-err" ${o.attrs || ""}>`;
    return `<div class="field"><label for="${n}">${o.l}${req ? "" : ' <span class="opt">(optional)</span>'}</label>${ctl}${o.hint ? `<p class="hint">${o.hint}</p>` : ""}<p class="err" id="${n}-err" role="alert"></p></div>`;
  };
  S.err = (el, m) => { const p = document.getElementById(el.id + "-err"); if (p) p.textContent = m || ""; el.setAttribute("aria-invalid", m ? "true" : "false"); el.classList.toggle("bad", !!m); };
  S.validate = (form, rules) => {
    let first = null;
    Object.keys(rules).forEach(n => { const el = form.elements[n]; if (!el) return;
      const m = rules[n](el.type === "file" ? el.files[0] : String(el.value || "").trim(), form); S.err(el, m); if (m && !first) first = el; });
    if (first) first.focus(); return !first;
  };
  S.RULES = {
    req: l => v => v ? "" : l + " is required.",
    email: v => !v ? "Email is required." : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? "" : "Enter a valid email address.",
    phone: v => !v ? "Phone number is required." : /^[6-9]\d{9}$/.test(v.replace(/[\s-]/g, "")) ? "" : "Enter a valid 10-digit Indian mobile number.",
    regId: v => !v ? "Registration ID is required." : /^SUST26-[A-Z0-9]{6}$/.test(v) ? "" : "Format looks like SUST26-K7Q2XM."
  };
  /* Google Drive link validator (https only; drive.google.com / docs.google.com file, folder or open?id= links).
     Returns "" when valid, otherwise a friendly message. Firestore rules re-check the domain server-side. */
  S.driveLink = v => {
    v = String(v || "").trim(); if (!v) return "Please paste your Google Drive link.";
    if (v.length > 500) return "That link is too long.";
    let u; try { u = new URL(v); } catch (e) { return "That doesn't look like a link. Paste the full address starting with https://"; }
    if (u.protocol !== "https:") return "The link must start with https://";
    if (!/^(drive|docs)\.google\.com$/.test(u.hostname)) return "Only Google Drive links are accepted (drive.google.com or docs.google.com).";
    const p = u.pathname, id = u.searchParams.get("id") || "";
    const ok = /^\/(?:u\/\d+\/)?(?:file|presentation|document|spreadsheets)\/(?:u\/\d+\/)?d\/[\w-]{10,}/.test(p)
      || /^\/drive\/(?:u\/\d+\/)?folders\/[\w-]{10,}/.test(p) || (/^\/(?:open|uc)$/.test(p) && /^[\w-]{10,}$/.test(id));
    return ok ? "" : "This doesn't look like a link to a Drive file. In Drive, open the file, click Share, then Copy link, and paste it here.";
  };
  /* Instructions box shown above the Drive-link fields. kind = "payment" | "ppt". */
  S.driveHelp = (c, kind) => {
    const pay = kind === "payment", em = c && c.driveShareEmail, what = pay ? "payment screenshot" : "PPT";
    const access = !S.isTBA(em)
      ? `Under <b>General access</b> choose <b>Restricted</b>, then add <b>${S.esc(em)}</b> as a <b>Viewer</b>.`
      : `Under <b>General access</b> choose <b>Anyone with the link</b> and set the role to <b>Viewer</b>. (The organizers' Google account for private sharing will be announced.)`;
    return `<div class="msg note" role="note"><b>How to share your ${what} from Google Drive</b>
      <ol style="margin:.5em 0 0;padding-left:1.2em"><li>Upload the ${what} to your Google Drive.</li><li>Right-click it and choose <b>Share</b>.</li><li>${access}</li><li>Click <b>Copy link</b> and paste it below.</li></ol>
      <p class="hint" style="margin:.6em 0 0">${pay ? "Payment screenshots can show personal details, so please do not make them public. The organizers must be able to open the file, otherwise your payment cannot be verified." : "The organizers must be able to open the file, otherwise it cannot be reviewed. You can replace the link until the deadline."}</p></div>`;
  };
  S.msg = (el, type, text) => { el.className = "msg " + type; el.textContent = text || ""; el.hidden = !text; };
  S.busy = (btn, on, label) => { if (on) { btn.dataset.l = btn.textContent; btn.textContent = label; } else btn.textContent = btn.dataset.l || btn.textContent; btn.disabled = on; };
  S.lookupFields = el => { el.innerHTML = S.field({ n: "regId", l: "Registration ID", ph: "SUST26-XXXXXX", attrs: 'autocomplete="off" autocapitalize="characters" maxlength="13"' }) + S.field({ n: "email", l: "Registered email", t: "email", attrs: 'autocomplete="email"' }); document.getElementById("regId").value = Backend.getRememberedRegistrationId(); };
  S.doLookup = async (form, msgEl) => {
    const id = form.elements.regId.value.trim().toUpperCase(); form.elements.regId.value = id;
    if (!S.validate(form, { regId: S.RULES.regId, email: S.RULES.email })) return null;
    const r = await Backend.getRegistrationByIdAndEmail(id, form.elements.email.value.trim());
    if (!r) S.msg(msgEl, "bad", "We couldn't find a registration with that ID and email. Please check both and try again.");
    return r;
  };

  /* ---- scroll reveal (respects reduced motion) ---- */
  S.reveal = () => {
    const els = document.querySelectorAll(".reveal:not(.in)");
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return els.forEach(e => e.classList.add("in"));
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12 });
    els.forEach(e => io.observe(e));
  };

  /* ---- navbar + footer ---- */
  const NAV = [["about", "About"], ["domains", "Domains"], ["format", "Format"], ["prizes", "Prizes"], ["timeline", "Timeline"], ["faq", "FAQ"], ["contact", "Contact"]];
  function chrome(c, page) {
    const base = page === "index" ? "" : "index.html";
    const links = NAV.map(n => `<li><a href="${base}#${n[0]}" data-sec="${n[0]}">${n[1]}</a></li>`).join("");
    document.body.insertAdjacentHTML("afterbegin",
      (Backend.mode === "demo" ? `<div class="demo-banner" role="status">DEMO MODE: data is stored only in this browser.</div>` : "") +
      (c._initError ? `<div class="demo-banner" role="alert" style="background:#7a2020">Site setup problem: ${S.esc(c._initError)}</div>` : "") +
      `<a class="skip" href="#main">Skip to content</a>
       <header class="nav"><div class="wrap nav-in">
         <a class="brand" href="${base || "#top"}">${S.esc(c.shortName || c.eventName)}</a>
         <button class="burger" type="button" aria-expanded="false" aria-controls="menu" aria-label="Open menu"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
         <nav id="menu" aria-label="Main"><ul>${links}</ul><a class="btn btn-sm" href="register.html">Register</a></nav>
       </div></header>`);
    const burger = document.querySelector(".burger"), menu = document.getElementById("menu");
    const set = open => { menu.classList.toggle("open", open); burger.setAttribute("aria-expanded", open); burger.setAttribute("aria-label", open ? "Close menu" : "Open menu"); };
    burger.addEventListener("click", () => set(!menu.classList.contains("open")));
    menu.addEventListener("click", e => { if (e.target.closest("a")) set(false); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && menu.classList.contains("open")) { set(false); burger.focus(); } });

    const soc = c.social || {}, sl = [["instagram", "Instagram"], ["linkedin", "LinkedIn"], ["website", "Website"]].filter(x => !S.isTBA(soc[x[0]])).map(x => `<a href="${S.esc(soc[x[0]])}" target="_blank" rel="noopener noreferrer">${x[1]}</a>`);
    if (!S.isTBA(soc.email)) sl.push(`<a href="mailto:${S.esc(soc.email)}">Email</a>`);
    document.body.insertAdjacentHTML("beforeend", `<footer class="footer"><div class="wrap foot-in">
      <div class="foot-brand"><img src="assets/spectra-logo.jpeg" alt="SPECTRA Club logo" width="56" height="56" loading="lazy">
        <p><strong>${S.esc(c.club)}</strong><br>${S.esc(c.department)}<br>${S.esc(c.institution)}</p></div>
      <nav aria-label="Quick links"><ul><li><a href="${base}#about">About</a></li><li><a href="register.html">Register</a></li><li><a href="submit-ppt.html">Submit PPT</a></li><li><a href="status.html">Check status</a></li></ul>${sl.length ? `<p class="soc">${sl.join(" · ")}</p>` : ""}</nav>
      </div><p class="copy wrap">© ${S.esc(c.year)} ${S.esc(c.club)}. All rights reserved.</p></footer>`);
  }

  S.errText = (x, fb) => x && x.message === "AUTH_FAILED" && x.code ? "We couldn't start a secure session [" + x.code + "]. Check your connection and try again. If it keeps happening, contact the organizers." : x && x.message === "RATE_LIMIT" ? (x.wait ? "Too many attempts. Please wait " + (x.wait > 90 ? Math.ceil(x.wait / 60) + " minutes" : x.wait + " seconds") + " and try again." : "Too many attempts from this device. Please contact the organizers.") : ({ OFFLINE: "You seem to be offline. Check your connection and try again.",
    SETTINGS_MISSING: "Registration has not been opened by the organizers yet (the event settings are not published). Please check back soon.",
    REG_CLOSED: "Registration is currently closed.",
    REG_DEADLINE: "The registration deadline has passed.",
    REG_REJECTED: "The server rejected this registration even though registration is open and you are within the limits. This can happen if this browser failed the site's security check. Please refresh the page and try once more, and if it still fails contact the organizers.",
    PPT_NOT_OPEN: "PPT submission is not open right now.",
    PPT_CLOSED: "The PPT deadline has passed.",
    PPT_REJECTED: "The server rejected this PPT submission. Use the same browser you registered with, refresh the page and try again. If it still fails, contact the organizers.",
    AUTH_FAILED: "We couldn't start a secure session. Check your connection and try again. If it keeps happening, contact the organizers.",
    BUSY: "The server is very busy right now (daily free limit reached). Please try again in a little while or contact the organizers.",
    AUTH_DISABLED: "Registration is temporarily unavailable: the organizers still need to enable Anonymous sign-in in Firebase (Authentication > Sign-in method).",
    PERMISSION: "The server refused this request. Please refresh the page and try again, using the same browser you registered with. If it keeps happening, contact the organizers.",
    FIREBASE_NOT_CONFIGURED: "The site is not connected to Firebase yet, so nothing can be saved. Please contact the organizers.",
    FIREBASE_INIT_FAILED: "The site could not connect to Firebase. Please try again later or contact the organizers.",
    STORAGE_FULL: "Browser storage is full (demo mode).", BAD_LINK: "Please paste a valid Google Drive link." }[x && x.message] || (fb || "Something went wrong. Please try again.") + (x && x.code ? " [" + x.code + "]" : ""));

  S.init = async page => {
    const bar = document.createElement("div"); bar.className = "page-loading"; bar.textContent = "Loading…"; bar.setAttribute("role", "status"); document.body.prepend(bar);
    const c = await Backend.getSiteContent(); bar.remove();
    chrome(c, page); S.bind(c);
    const an = (c.announcements || []).find(a => a && a.active && !S.isTBA(a.text));      // site-wide announcement
    if (an) document.body.insertAdjacentHTML("afterbegin", `<div class="announce" role="status">${S.esc(an.text)}</div>`); S.reveal(); return c;
  };
})();
