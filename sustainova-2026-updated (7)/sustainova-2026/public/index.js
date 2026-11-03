/* index.js — renders the home page sections from config.js */
(async function () {
  "use strict";
  const S = Site, $ = id => document.getElementById(id), e = S.esc;
  const c = await S.init("index");

  /* badge under the logo: admin text, else the registration deadline, else "Dates to be announced" */
  const bd = document.querySelector(".hero .badge"); if (bd) { const t = !S.isTBA(c.badge) ? c.badge : S.toDate(c.registrationDeadline) ? "Registration closes " + S.fmt(c.registrationDeadline) : "Dates to be announced"; bd.textContent = t; }
  $("highlights").innerHTML = c.highlights.map(h => `<article class="card reveal"><span class="ico">${S.icon(h.icon)}</span><h3>${e(h.title)}</h3><p>${e(h.text)}</p></article>`).join("");
  $("domain-grid").innerHTML = c.domains.map(d => `<article class="card reveal"><span class="ico">${S.icon(d.icon)}</span><h3>${e(d.title)}</h3><p>${e(d.line)}</p></article>`).join("");

  const dark = hex => { const n = parseInt(hex.slice(1), 16), f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
    return .2126 * f(n >> 16) + .7152 * f(n >> 8 & 255) + .0722 * f(n & 255) > .3; };   // light bg => dark text
  $("sdgs").innerHTML = c.sdgs.map(s => `<li style="background:${s[2]};color:${dark(s[2]) ? "#1F2A24" : "#fff"}"><b>${s[0]}</b><span>${e(s[1])}</span></li>`).join("");

  const free = !S.payReq(c);
  $("rounds").innerHTML = c.rounds.map((r, i) => `${i ? `<span class="rarrow" aria-hidden="true">${S.icon("arrow")}</span>` : ""}<article class="card reveal"><span class="pill">${e(r.mode)}</span><h3>${e(r.name)}</h3><ul>${r.points.map(p => `<li>${e(free ? p.replace(/ and pay$/i, "") : p)}</li>`).join("")}</ul></article>`).join("");
  const stepList = c.steps.filter(s => !(free && s.paid)); $("steps-lead").textContent = (["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"][stepList.length] || stepList.length) + " simple step" + (stepList.length === 1 ? "" : "s") + " from idea to final.";
  $("steps").innerHTML = stepList.map(s => `<li class="reveal"><h3>${e(free && s.freeTitle || s.title)}</h3><p>${e(free && s.freeText || s.text)}</p></li>`).join("");
  $("prize-grid").innerHTML = c.prizes.map((p, i) => `<article class="card prize reveal${i === 0 ? " feat" : ""}"><p class="pos">${e(p.position)}${S.isTBA(p.note) ? "" : " · " + e(p.note)}</p><h3>${e(p.title)}</h3><p class="amt">${e(S.tba(p.amount))}</p><span class="chip">Certificate</span></article>`).join("");
  $("timeline-list").innerHTML = c.timeline.map(t => `<li class="reveal"><b>${e(t.label)}</b><span>${e(S.tba(t.date))}</span></li>`).join("");

  $("faq-list").innerHTML = c.faqs.map((f, i) => `<div class="faq-item"><h3><button type="button" id="fq${i}" aria-expanded="false" aria-controls="fa${i}">${e(f.q)}</button></h3><div class="faq-a" id="fa${i}" role="region" aria-labelledby="fq${i}" hidden><p>${e(S.tpl(f.a, c))}</p></div></div>`).join("");
  $("faq-list").addEventListener("click", ev => { const b = ev.target.closest("button"); if (!b) return;
    const open = b.getAttribute("aria-expanded") === "true"; b.setAttribute("aria-expanded", !open); $(b.getAttribute("aria-controls")).hidden = open; });

  const ct = c.contacts.map(p => {
    const lines = [S.isTBA(p.phone) ? "" : `<a href="tel:${e(p.phone.replace(/\s/g, ""))}">${e(p.phone)}</a>`, S.isTBA(p.email) ? "" : `<a href="mailto:${e(p.email)}">${e(p.email)}</a>`].filter(Boolean);
    return `<article class="card reveal"><h3>${e(S.tba(p.name))}</h3><p class="role">${e(S.tba(p.role, ""))}</p><p>${lines.length ? lines.join("<br>") : "Contact details to be announced"}</p></article>`; });
  ct.push(`<article class="card reveal"><h3>${e(c.institution.split(",")[0])}</h3><p class="role">${e(c.department)}</p><p>${e(c.location)}</p></article>`);
  $("contacts").innerHTML = ct.join("");

  /* registration countdown (display only: the real deadline is still enforced by backend.js and firestore.rules) */
  try {
    const box = $("countdown"), end = S.toDate(c.registrationDeadline);
    if (box && end && c.registrationOpen === true) {
      const el = { d: $("cd-d"), h: $("cd-h"), m: $("cd-m"), s: $("cd-s") }, pad = n => String(n).padStart(2, "0");
      let iv = null, lastMin = -1;
      const closed = () => { clearInterval(iv); box.classList.remove("urgent"); box.classList.add("is-closed"); $("cd-label").textContent = "Registration is closed"; $("cd-grid").hidden = true; $("cd-note").textContent = "The deadline was " + S.fmt(c.registrationDeadline) + ". Thank you for your interest."; $("cd-sr").textContent = "Registration is closed."; };
      const tick = () => {
        const ms = end - Date.now(); if (ms <= 0) return closed();
        const t = Math.floor(ms / 1000), d = Math.floor(t / 86400), h = Math.floor(t % 86400 / 3600), m = Math.floor(t % 3600 / 60);
        el.d.textContent = pad(d); el.h.textContent = pad(h); el.m.textContent = pad(m); el.s.textContent = pad(t % 60);
        box.classList.toggle("urgent", ms < 48 * 3600e3);
        if (m !== lastMin) { lastMin = m; $("cd-sr").textContent = "Registration closes in " + d + " days, " + h + " hours and " + m + " minutes."; }
      };
      $("cd-note").textContent = "Deadline: " + S.fmt(c.registrationDeadline);
      box.hidden = false; tick(); if (end - Date.now() > 0) iv = setInterval(tick, 1000);
    }
  } catch (x) { /* countdown is optional; never block the page */ }

  S.reveal();

  /* active nav link on scroll */
  const links = [...document.querySelectorAll("#menu a[data-sec]")];
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) links.forEach(a => a.classList.toggle("active", a.dataset.sec === x.target.id)); }), { rootMargin: "-40% 0px -55% 0px" });
    links.forEach(a => { const s = document.getElementById(a.dataset.sec); if (s) io.observe(s); });
  }
})();
