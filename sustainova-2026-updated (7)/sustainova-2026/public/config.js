/* =====================================================================
   config.js — THE ONLY FILE YOU NEED TO EDIT FOR EVENT CONTENT
   - Dates/deadlines: ISO format in IST, e.g. "2026-12-05T23:59:00+05:30".
     Leave "" (empty) to show "To be announced".
   - Any empty value or "TBA" is shown as "To be announced".
   - In FAQ text you may use {{teamSize}}, {{fee}}, {{pptDeadline}}, {{registrationDeadline}}.
   ===================================================================== */
window.SITE_CONFIG = {
  backendMode: "firebase",     // "firebase" = live Firestore (keep this in production). "demo" = browser-only testing; never use it on the live site.

  /* ---- Identity ---- */
  shortName: "SUSTAINOVA 2026",
  eventName: "SUSTAINOVA 2026 — IDEATHON",
  tagline: "Innovation for a Sustainable Future",
  organizer: "SPECTRA Club, Department of Computer Science and Engineering",
  club: "SPECTRA Club",
  department: "Department of Computer Science and Engineering",
  institution: "Acropolis Institute of Technology and Research, Indore",
  location: "Indore, Madhya Pradesh",
  theme: "Innovation for a Sustainable Future, aligned with the UN's 17 Sustainable Development Goals",
  badge: "",                 // text under the logo. Admin can edit it. Empty = automatic: "Registration closes <deadline>" (or "Dates to be announced" if no deadline is set).
  contentVersion: 2,         // bump this when you change faqs/steps defaults here: it makes older saved FAQs in Firestore yield to these defaults until an admin saves again.
  year: "2026",

  /* ---- Registration & PPT controls ---- */
  teamSize: { min: "TBA", max: "TBA" },   // numbers, e.g. { min: 2, max: 4 }. While TBA the form allows 1–6.
  registrationOpen: true,
  registrationDeadline: "",               // e.g. "2026-12-01T23:59:00+05:30"
  pptSubmissionOpen: true,                // set false until PPT submission should begin
  pptDeadline: "",                        // e.g. "2026-12-05T23:59:00+05:30". Empty = no countdown. SET THIS before going live!
  paymentRequired: false,                 // Round 1 is FREE. (Admins can switch payment on in Admin > Site content; the default is free.)
  fee: { amountPerTeam: "", note: "Payment is per team, not per member." },   // e.g. amountPerTeam: 300
  paymentInstructions: "",                // optional text shown on the payment step, e.g. "Pay via the link below, then keep the transaction ID."
  paymentLink: "https://example.com/replace-with-your-jodo-payment-link",
  driveShareEmail: "",                    // Google account (e.g. a club Gmail) that students share their Drive files with as "Viewer". Admins must open the files with THIS account. Empty = students are told to use "Anyone with the link".

  /* ---- Content ---- */
  about: "SUSTAINOVA 2026 invites students to turn real-world sustainability challenges into feasible, technology-driven ideas aligned with the 17 UN Sustainable Development Goals.",
  highlights: [
    { icon: "bulb",  title: "Innovate",    text: "Turn a fresh idea into a practical solution." },
    { icon: "users", title: "Collaborate", text: "Team up and learn from peers and judges." },
    { icon: "globe", title: "Impact",      text: "Build for people, communities and the planet." }
  ],
  domainsNote: "Problem statements are open-ended. Choose one domain, identify your own problem and propose your solution.",
  domains: [
    { icon: "recycle", title: "Waste Management and Circular Economy",        line: "Reduce, reuse and rethink what we throw away." },
    { icon: "droplet", title: "Water Conservation and Management",            line: "Protect and make smarter use of every drop." },
    { icon: "sun",     title: "Renewable Energy and Climate Action",          line: "Clean power for a cooler planet." },
    { icon: "book",    title: "Education and Digital Inclusion",              line: "Learning and technology within everyone's reach." },
    { icon: "sprout",  title: "Sustainable Agriculture and Rural Development",line: "Better yields and livelihoods for villages." },
    { icon: "city",    title: "Smart Cities and Sustainable Mobility",        line: "Cities that move cleanly and live smartly." },
    { icon: "heart",   title: "Healthcare and Community Well-being",          line: "Healthier, safer communities for all." },
    { icon: "users",   title: "Social Equality and Inclusive Communities",    line: "Opportunities that leave no one behind." }
  ],
  /* Official SDG colours; names are short forms (no UN logos used). */
  sdgs: [
    [1,"No Poverty","#E5243B"],[2,"Zero Hunger","#DDA63A"],[3,"Good Health","#4C9F38"],[4,"Quality Education","#C5192D"],
    [5,"Gender Equality","#FF3A21"],[6,"Clean Water","#26BDE2"],[7,"Clean Energy","#FCC30B"],[8,"Decent Work","#A21942"],
    [9,"Industry & Innovation","#FD6925"],[10,"Reduced Inequalities","#DD1367"],[11,"Sustainable Cities","#FD9D24"],
    [12,"Responsible Consumption","#BF8B2E"],[13,"Climate Action","#3F7E44"],[14,"Life Below Water","#0A97D9"],
    [15,"Life on Land","#56C02B"],[16,"Peace & Justice","#00689D"],[17,"Partnerships","#19486A"]
  ],
  rounds: [
    { name: "Round 1", mode: "Online",  points: ["Register your team (free)", "Submit your PPT before its deadline", "Shortlisting of top ideas"] },
    { name: "Round 2", mode: "Offline", points: ["Final presentation on campus", "Questions from the judges", "Winners announced"] }
  ],
  steps: [
    { title: "Form a team",            text: "Gather your teammates and pick the SDG your idea addresses." },
    { title: "Register for free",      text: "Fill in the form. Round 1 registration is free, with no payment." },
    { title: "Submit your PPT",        text: "Share your PPT Google Drive link before the PPT deadline." },
    { title: "Shortlisting and final", text: "Shortlisted teams present offline." }
  ],
  prizes: [
    { position: "1st Position", title: "First Prize",  amount: "", note: "" },
    { position: "2nd Position", title: "Second Prize", amount: "", note: "" },
    { position: "3rd Position", title: "Third Prize",  amount: "", note: "If needed" }
  ],
  prizeNote: "Prize amounts will be finalized after departmental approval and budget availability.",
  timeline: [
    { label: "Registration",        date: "To be announced" },
    { label: "PPT Submission",      date: "To be announced" },
    { label: "Shortlisting",        date: "To be announced" },
    { label: "Offline Final Round", date: "To be announced" }
  ],
  expectedOutcome: "To promote innovation, technical problem-solving and practical solutions for a sustainable future.",
  faqs: [
    { q: "Who can participate?",                       a: "Students of any year and branch can join. Teams are formed by you." },
    { q: "What is the team size?",                     a: "Team size: {{teamSize}}. Every member's details are collected at registration." },
    { q: "Is there a registration fee?",                a: "{{feeInfo}}" },
    { q: "When do we submit the PPT?",                 a: "After you register, use the Submit PPT page before the deadline: {{pptDeadline}}. PPT submission is separate from payment." },
    { q: "What if we miss the PPT deadline?",          a: "The PPT page closes automatically at the deadline and no late submissions are accepted." },
    { q: "Do we need a working prototype?",            a: "No. A clear, feasible idea is enough. A prototype is a bonus, not a requirement." },
    { q: "What happens after shortlisting?",           a: "Shortlisted teams are informed and present offline in Round 2, followed by Q&A with the judges." },
    { q: "How do I check my registration?",            a: "Open the Check Status page and enter your registration ID and registered email." }
  ],
  contacts: [
    { name: "To be announced", role: "Student Coordinator", phone: "", email: "" },
    { name: "To be announced", role: "Faculty Coordinator", phone: "", email: "" }
  ],
  social: { instagram: "", linkedin: "", website: "", email: "" }   // empty = hidden
};
