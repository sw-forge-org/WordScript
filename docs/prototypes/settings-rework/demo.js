/* ===========================================================================
   WordScript — Settings Rework, Stage 0 prototype
   Standalone. Not imported by src/, not routed, no Tauri API, no build step.

   Every label, model name, hotkey token, provider name and diagnostic term
   below is read from the current tree. Every string on the "before" side of
   the copy switch is a verbatim string literal from src/, so the reduction is
   measured rather than asserted. Runtime values (readiness, counts, log lines)
   are sample data — the rig says so, and every preview carries its banner.
   =========================================================================== */

(function () {
  "use strict";

  /* ── State ──────────────────────────────────────────────────────────── */

  var state = {
    screen: "ds",
    palette: "after",
    /* dark | light | system. `system` is not a third palette — it is a
       deferral, and it resolves per render against the OS. Keeping it as its
       own value rather than resolving it once at boot is the whole point: a
       user who switches their desktop to light at dusk must not have to
       restart the app to be followed. */
    theme: "dark",
    /* Palette state. Query and selection live here rather than in the DOM so a
       re-render cannot lose what was typed — every other piece of this demo
       rebuilds `#win` wholesale on every keystroke it handles. */
    cmdk: false,
    cmdkQuery: "",
    cmdkSel: 0,
    copy: "after",
    density: "standard",
    /* Per-screen sub-tab selection. Language Models opens on Rewrite, not on
       the first tab: Rewrite is where the copy weight the plan measured
       actually sits (the communication-style description and the slang
       paragraph), so landing anywhere else hides what the switch is for. */
    /* Context opens on Summary for the same reason: it is the tab the whole
       surface exists to produce, and the ones that feed it are one click
       away. The key was `notes` until 2026-08-03 and the tab was `Enhanced`;
       both were renamed with the screen (§11.41). */
    sub: { llm: "Rewrite", context: "Summary" },
    /* THE ONE SEGMENT IN THIS PROTOTYPE THAT IS NOT INERT.
       Every other `seg()` is a demo control: it moves its own thumb and
       changes nothing, which is honest for a static mock. The connection lane
       cannot be one of those. It decides what a provider even *is* — a cloud
       account with a key, a binary on this disk, a URL you operate, or a cloud
       account with a region — so a lane switch that leaves the card identical
       is not an inert control, it is a false one. It says the four lanes are
       the same thing with different names.

       Held in state and re-rendered, so the four are actually four. */
    lane: "Cloud",
    /* Which onboarding step is on screen. The flow is walkable because a setup
       flow's content IS its order, and a single frame cannot show an order. */
    ob: 0,
    /* Which transcript rows have their raw text unfolded. Keyed by row id, so
       opening one does not close another and a re-render keeps them all. */
    raw: {},
    /* The workspace view the settings modal is laid over. Settings is no longer
       a second window (§11.22), so it always has something behind it. */
    under: "home",
    /* Which of Context's two states is on screen. A context object is either
       being read or being made; `intake` is the making. It is a state and not
       a place, which is the whole of §11.41 in one variable. */
    ctx: "read",
    /* And which of the three ways in is open while it is being made. Write
       first: it is the cheapest and the most frequent, and an intake whose
       default is its rarest case makes the common case feel like the
       exception (§11.48). */
    intake: "Write",
  };

  /* THE NAME OF THE ONE PROCESS — a copy decision, held in one place so it
     costs one line to change (§11.44).

     `Orchestrator` is an architecture word. It names the thing correctly and
     nobody says it out loud, which is exactly the failure the copy budget in
     §5.2 exists to catch. Four candidates were weighed:

       lead      — collides with the CRM sense, and this product now models a
                   customer as a context object.
       foreman   — gendered, and an established piece of infrastructure software.
       handler   — accurate ("agent handler" is the exact relationship) but
                   reads as tradecraft.
       desk      — help desk, news desk, trading desk: takes things in, decides
                   what goes up, acts on your behalf. Chosen.

     It is also the only candidate that is not a person. ADR 0043 deliberately
     gave this thing a sphere rather than a face, and a personal name would
     argue with its own body. */
  var DESK = "the desk";
  var DESK_CAP = "The desk";

  var COUNT = { b: 0, a: 0 };   // prose on the screen being rendered
  var TOTAL = { b: 0, a: 0 };   // prose across every screen in this demo

  /* ── Helpers ────────────────────────────────────────────────────────── */

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Label text: escaped, never counted as prose. */
  function t(s) { return s == null ? "" : esc(s); }

  /** Prose: a plain string is identical on both sides; {b, a} differs.
      Both sides are counted on every render, so one pass yields both totals. */
  function p(x) {
    if (x == null) return "";
    if (typeof x === "string") {
      var n = words(x); COUNT.b += n; COUNT.a += n;
      return esc(x);
    }
    COUNT.b += words(x.b); COUNT.a += words(x.a);
    return esc(state.copy === "before" ? x.b : x.a);
  }

  function words(s) {
    if (!s) return 0;
    var m = String(s).trim().match(/[^\s]+/g);
    return m ? m.length : 0;
  }

  function icon(name, cls) {
    return '<svg class="' + (cls || "") + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1.75" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.dot) + "</svg>";
  }

  /* ── Icon set — lucide geometry, one stroke weight, drawn not borrowed ── */

  var ICONS = {
    dot: '<circle cx="12" cy="12" r="3"/>',
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5.5h4V20"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v4h4"/><path d="M12 7.5V12l3 2"/>',
    profiles: '<path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2Z"/><path d="M18 16H7a2 2 0 0 0-2 2"/><path d="M9 8h6"/><path d="M9 11.5h4"/>',
    notes: '<path d="M5 4h10v16H6a1 1 0 0 1-1-1Z"/><path d="M5 8H3"/><path d="M5 12H3"/><path d="M5 16H3"/><path d="m18 9 3 3-4.5 4.5H14v-2.5Z"/>',
    upload: '<path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/><path d="M12 15V4"/><path d="m8 8 4-4 4 4"/>',
    chat: '<path d="M20 15a2 2 0 0 1-2 2H8l-4 3V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z"/><path d="M8.5 9.5h7"/><path d="M8.5 12.5h4"/>',
    integrations: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M17.5 14v7"/><path d="M14 17.5h7"/>',
    general: '<path d="M4 7h10"/><path d="M18 7h2"/><path d="M4 17h4"/><path d="M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 9.5h.01"/><path d="M9.5 9.5h.01"/><path d="M13 9.5h.01"/><path d="M16.5 9.5h.01"/><path d="M7.5 14h9"/>',
    mic: '<rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/>',
    models: '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 3v4"/><path d="M14 3v4"/><path d="M10 17v4"/><path d="M14 17v4"/><path d="M3 10h4"/><path d="M3 14h4"/><path d="M17 10h4"/><path d="M17 14h4"/>',
    agents: '<rect x="4" y="8" width="16" height="11" rx="2.5"/><path d="M12 4v4"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/><path d="M2 12v3"/><path d="M22 12v3"/>',
    delivery: '<path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6Z"/><path d="m9 12 2 2 4-4"/>',
    privacy: '<rect x="4.5" y="10" width="15" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v2"/>',
    diagnostics: '<path d="M3 12h3.5l2-5 3.5 11 2.5-6H21"/>',
    about: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><path d="M12 7.5h.01"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2M12 19.5v2M4.2 7.2l1.7 1M18.1 15.8l1.7 1M4.2 16.8l1.7-1M18.1 8.2l1.7-1"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.2 2.4c-.5.2-.7.7-.7 1.2v.4"/><path d="M12 17h.01"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>',
    check: '<path d="m4.5 12.5 5 5 10-11"/>',
    x: '<path d="m5.5 5.5 13 13"/><path d="m18.5 5.5-13 13"/>',
    alert: '<path d="M12 4.5 2.8 20h18.4Z"/><path d="M12 10v4"/><path d="M12 17h.01"/>',
    play: '<path d="M7 4.5 19 12 7 19.5Z"/>',
    restore: '<path d="M3 12a9 9 0 1 0 2.6-6.4"/><path d="M3 4.5V10h5.5"/>',
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 5.5A2 2 0 0 0 13.5 3.5h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2"/>',
    trash: '<path d="M4.5 6.5h15"/><path d="M9 6.5V4.5h6v2"/><path d="M6.5 6.5 7.5 20h9l1-13.5"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    arrow: '<path d="M5 12h13"/><path d="m12.5 6 6 6-6 6"/>',
    /* The same arrow mirrored. Drawn rather than derived with a transform: a
       `scaleX(-1)` on an icon inside a button also mirrors nothing else, but it
       makes the glyph's stroke join land on the wrong side at this weight. */
    "arrow-left": '<path d="M19 12H6"/><path d="m11.5 6-6 6 6 6"/>',
    external: '<path d="M13 4h7v7"/><path d="M20 4 10.5 13.5"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
    cloud: '<path d="M7 18a4.2 4.2 0 0 1-.4-8.4 5.6 5.6 0 0 1 10.7-1.2A3.9 3.9 0 0 1 17.5 18Z"/>',
    local: '<rect x="3" y="4.5" width="18" height="7" rx="1.8"/><rect x="3" y="13" width="18" height="6.5" rx="1.8"/><path d="M6.5 8h.01"/><path d="M6.5 16.2h.01"/>',
    key: '<circle cx="8" cy="14" r="4"/><path d="m11 11 8-8"/><path d="m16.5 5.5 2.5 2.5"/><path d="m14 8 2.5 2.5"/>',
    tokens: '<circle cx="8" cy="8" r="4.5"/><circle cx="16" cy="16" r="4.5"/><path d="M12.2 8H19"/><path d="M5 16h6.8"/>',
    type: '<path d="M4.5 7V5h15v2"/><path d="M12 5v14"/><path d="M9 19h6"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
    motion: '<path d="M3 17c4-9 14-9 18 0"/><circle cx="6" cy="15" r="2"/><circle cx="18" cy="15" r="2"/>',
    ruler: '<rect x="2.5" y="8" width="19" height="8" rx="1.5"/><path d="M7 8v3"/><path d="M11 8v4"/><path d="M15 8v3"/><path d="M19 8v4"/>',
    wand: '<path d="M4 20 16 8"/><path d="M14 4.5 15 7l2.5 1-2.5 1-1 2.5-1-2.5L10.5 8 13 7Z"/><path d="M19.5 13.5 20 15l1.5.5-1.5.5-.5 1.5-.5-1.5L17.5 15l1.5-.5Z"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
    terminal: '<path d="m5 8 4 4-4 4"/><path d="M12 16h7"/>',
    volume: '<path d="M11 5 6.5 9H3v6h3.5L11 19Z"/><path d="M15 9.5a3.5 3.5 0 0 1 0 5"/><path d="M17.5 7a7 7 0 0 1 0 10"/>',
    monitor: '<rect x="2.5" y="4" width="19" height="12.5" rx="2"/><path d="M8.5 20.5h7"/><path d="M12 16.5v4"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M3 19a6 6 0 0 1 12 0"/><path d="M16 5.2a3.5 3.5 0 0 1 0 5.6"/><path d="M17.5 14.2A6 6 0 0 1 21 19"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    download: '<path d="M12 3v11"/><path d="m8 10.5 4 4 4-4"/><path d="M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1"/>',
    file: '<path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5Z"/><path d="M13.5 3v5.5H19"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    inspect: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/><path d="M8.5 11h5"/>',
    work: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"/>',
    resume: '<path d="M5 5v14"/><path d="M9 12 20 5v14Z"/>',
    pin: '<path d="M12 15v6"/><path d="M9 4h6l-1 6 3 3H7l3-3Z"/>',
    sparkle: '<path d="M12 3.5 13.6 9 19 10.5 13.6 12 12 17.5 10.4 12 5 10.5 10.4 9Z"/><path d="M18.5 4v3"/><path d="M20 5.5h-3"/>',
    user: '<circle cx="12" cy="8" r="3.75"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
    server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01"/><path d="M7 16.5h.01"/>',
    minus: '<path d="M5 12h14"/>',
    updown: '<path d="m8 10.5 4-4 4 4"/><path d="m8 13.5 4 4 4-4"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="9.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    plug: '<path d="M9 3v6"/><path d="M15 3v6"/><path d="M6 9h12v3a6 6 0 0 1-12 0Z"/><path d="M12 18v3"/>',
    filter: '<path d="M3 5h18"/><path d="M7 12h10"/><path d="M10.5 19h3"/>',
    folder: '<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4L11 8.5h8.5A1.5 1.5 0 0 1 21 10v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18Z"/>',
    folderOpen: '<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4L11 8.5h8.5A1.5 1.5 0 0 1 21 10v1"/><path d="M3 18V7.5"/><path d="m3.2 19.4 2.3-7.4h16l-2.3 7.4a1.5 1.5 0 0 1-1.4 1.1H4.5a1.4 1.4 0 0 1-1.3-1.1Z"/>',
    caretUp: '<path d="m6 14.5 6-6 6 6"/>',
    caretDown: '<path d="m6 9.5 6 6 6-6"/>',
    speaker: '<circle cx="12" cy="8" r="3.25"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/><path d="M20 6.5a5 5 0 0 1 0 5"/>',
    stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2"/>',
    pause: '<path d="M9.5 5.5v13"/><path d="M14.5 5.5v13"/>',
    mail: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.6 7 8.4 6 8.4-6"/>',
    template: '<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M3.5 9h17"/><path d="M9 9v11"/>',
    list: '<path d="M8 7h12"/><path d="M8 12h12"/><path d="M8 17h8"/><path d="M4 7h.01"/><path d="M4 12h.01"/><path d="M4 17h.01"/>',
    link: '<path d="M10.5 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.7 1.7"/><path d="M13.5 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.7-1.7"/>',
    /* Two things and a passage between them, which is what a handoff is: the
       assistant on the left, the desk on the right, the arrow the only part
       the user performs. Not a "send" glyph — nothing is being dispatched, a
       piece of work is changing owner. */
    handoff: '<circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="12" r="2.5"/><path d="M8 12h6.5"/><path d="m12.5 9.5 2.5 2.5-2.5 2.5"/>',
    /* An open decision that is holding somebody up. A question mark inside the
       clock rather than beside it: what the decision inbox sorts on is not
       that a question exists but that something is waiting on it. */
    pending: '<circle cx="12" cy="12" r="9"/><path d="M9.8 9.6a2.3 2.3 0 1 1 2.9 2.2c-.5.2-.7.6-.7 1.1v.3"/><path d="M12 16.4h.01"/>',
    calendar: '<rect x="3.5" y="5.5" width="17" height="15" rx="2"/><path d="M3.5 10h17"/><path d="M8 3.5v4"/><path d="M16 3.5v4"/>',
  };

  /* ── Brand mark ────────────────────────────────────────────────────────────
     The shipped wordmark itself — `assets/logos/wordscipt-logo-transparent.png`,
     copied into this folder as `wordmark.png` rather than redrawn, so the
     prototype shows the real thing. `SettingsWindow.tsx` caps it at 180 px; the
     same cap holds here. The qualifier below it is what tells the two windows
     apart, since ADR 0003 leaves the title bar to the OS. */

  function brandMark(qualifier) {
    return '<div class="brand">' +
      /* Two files, not a filter. The mark is a dark tile with a cream quill
         beside a pure-white wordmark, so on a light ground the tile still
         reads perfectly and only the word disappears. `filter: invert()` would
         fix the word by destroying the tile, and a logo is the one thing in a
         surface that may not be approximated. `wordmark-light.png` recolours
         the white glyphs and leaves every other pixel alone. */
      '<img src="' + (resolvedTheme() === "light" ? "wordmark-light.png" : "wordmark.png") + '" alt="WordScript">' +
      (qualifier ? '<span class="qual">' + t(qualifier) + "</span>" : "") +
      "</div>";
  }

  /* ── Component builders ─────────────────────────────────────────────── */

  /** `foot` is the action that acts on the card's own content — Add
      replacement, New target, Run check. It used to be written by each screen
      as a bare `.rowflex` with an inline padding, three different values of it,
      and on Profiles no padding at all, which is why the button sat welded to
      the bottom edge of the card. It is a component now. */
  function card(o) {
    var head = "";
    if (o.title || o.desc) {
      head = '<div class="card-head">' +
        (o.title ? "<h3>" + t(o.title) + "</h3>" : "") +
        (o.desc ? "<p>" + p(o.desc) + "</p>" : "") + "</div>";
    }
    return '<div class="card">' + head +
      (o.rows ? '<div class="rows">' + o.rows.join("") + "</div>" : "") +
      (o.body || "") +
      (o.foot ? '<div class="card-foot">' + o.foot + "</div>" : "") + "</div>";
  }

  /** The masthead of a view: what it is called, what it is, whether it is a
      preview, and which of its tabs is open. One block, one rhythm — as three
      siblings they inherited the 32 px block gap and drifted apart. */
  function viewTop(o) {
    return '<div class="view-top"><header class="view-head"><h1>' + t(o.title) + "</h1>" +
      (o.lead ? "<p>" + p(o.lead) + "</p>" : "") + "</header>" +
      (o.banner ? banner(o.banner) : "") +
      (o.tabs ? subtabs(o.tabs.screen, o.tabs.items) : "") + "</div>";
  }

  function row(o) {
    return '<div class="row"' + (o.danger ? " data-danger" : "") + ">" +
      '<div class="row-text"><b>' + t(o.label) + "</b>" +
      (o.hint ? '<span class="row-hint">' + p(o.hint) + "</span>" : "") + "</div>" +
      (o.ctl ? '<div class="row-ctl">' + o.ctl + "</div>" : "") + "</div>";
  }

  function stackRow(o) {
    return '<div class="row stack">' +
      '<div class="row-text"><b>' + t(o.label) + "</b>" +
      (o.hint ? '<span class="row-hint">' + p(o.hint) + "</span>" : "") + "</div>" +
      (o.body || "") + "</div>";
  }

  function sec(title, desc, body) {
    return '<section class="sec">' +
      '<div class="sec-head"><h2>' + t(title) + "</h2>" +
      (desc ? "<p>" + p(desc) + "</p>" : "") + "</div>" +
      '<div class="sec-body">' + body + "</div></section>";
  }

  function lane(o) {
    var rows = o.options.map(function (opt) {
      return '<button class="lane-row" role="radio" aria-checked="' + (opt.on ? "true" : "false") + '">' +
        '<span class="lane-tile">' + icon(opt.icon) + "</span>" +
        '<span class="lane-text"><b>' + t(opt.name) +
        (opt.on ? ' <span class="badge" data-tone="success">Active</span>' : "") +
        (opt.tag ? ' <span class="badge" data-tone="plan">' + t(opt.tag) + "</span>" : "") +
        "</b><span>" + p(opt.desc) + "</span></span>" +
        '<span class="radio"></span></button>';
    }).join("");
    return card({ title: o.title, desc: o.desc, body: '<div class="lane" role="radiogroup">' + rows + "</div>" });
  }

  /** `"|"` in the item list is a rule, not a tab.
      Language Models put five tabs in one run — Cleanup, Rewrite, Draft,
      Prompt Enhance, Notes — and four of those are processing modes while the
      fifth is not. A tab bar is a claim that its entries are the same kind of
      thing, and this one was claiming that the model a note is formatted with
      is a fifth way of transforming a dictation. It is not: it is a different
      consumer of a model, on a surface the dictation path never reaches. The
      rule says so without spending a heading on it. */
  function subtabs(screen, items) {
    var real = items.filter(function (i) { return i !== "|"; });
    var active = state.sub[screen] || real[0];
    return '<div class="subtabs" role="tablist" data-subtabs="' + screen + '">' +
      items.map(function (i) {
        if (i === "|") return '<span class="subtabs-rule" aria-hidden="true"></span>';
        return '<button role="tab" aria-selected="' + (i === active ? "true" : "false") +
          '" data-sub="' + esc(i) + '">' + t(i) + "</button>";
      }).join("") + "</div>";
  }

  function activeSub(screen, items) {
    var real = items.filter(function (i) { return i !== "|"; });
    return state.sub[screen] || real[0];
  }

  /* Default lead is the preview label every unbuilt screen carries. `lead` and
     `tone` exist for the one screen that is not a preview but a withdrawal:
     a screen the plan decided against still has to say so on itself, or the
     next reader builds from it. See SETTINGS_REWORK_PLAN.md section 11.15. */
  /** THE PREVIEW BANNER IS A STRIP, AND IT WAS A CARD — §11.47.

      It stood at the top of eleven screens as a dashed box with an icon, a
      bold sentence and a paragraph, running to about 60 px. On the screens
      that need it most — Context, Agents, Meeting — that was a third of what
      was visible above the fold, spent on a fact the reader takes in once and
      then has to scroll past on every visit.

      What it has to say is two things: this is not real, and here is what it
      will be. So: a chip carrying the first, one line carrying the second, no
      box. It is 26 px now, measured, and it says the same thing.

      The lead is a WORD, not a sentence. `Layout preview — not wired to the
      runtime.` was accurate and it was also the fourth time the surface said
      so: the rig says `static mock, no runtime` permanently, the nav tags the
      entry `preview`, and the screen itself is under a picker labelled
      Previews. One chip is enough. */
  function banner(o) {
    return '<div class="banner"' + (o.tone ? ' data-tone="' + o.tone + '"' : "") + ">" +
      '<span class="banner-tag">' + icon(o.icon || "eye") +
      t(o.lead || "Preview") + "</span>" +
      '<span class="banner-text">' + p(o.text) + "</span></div>";
  }

  function empty(iconName, line, action) {
    return '<div class="empty">' + icon(iconName) + "<p>" + p(line) + "</p>" +
      (action ? btn(action, "ghost") : "") + "</div>";
  }

  function btn(label, variant, opts) {
    opts = opts || {};
    return '<button class="btn"' + (variant ? ' data-v="' + variant + '"' : "") +
      (opts.disabled ? " disabled" : "") + (opts.busy ? " data-busy" : "") + ">" +
      (opts.icon ? icon(opts.icon) : "") + t(label) + "</button>";
  }

  /** A row action reduced to its icon.
      Five labelled buttons on a transcript row spend more width than the
      transcript does — the row's own subject ends in an ellipsis while
      "Show in File Manager" gets to say all four of its words. The label
      survives as the accessible name and the tooltip; only the drawing is
      dropped. 24 px hit target, 14 px glyph: smaller than the 28 px labelled
      button, and the five of them together are narrower than two of those. */
  function iconBtn(label, iconName, opts) {
    opts = opts || {};
    return '<button class="ibtn"' +
      (opts.tone ? ' data-tone="' + opts.tone + '"' : "") +
      (opts.on ? ' data-on' : "") +
      (opts.act ? ' data-act="' + esc(opts.act) + '"' : "") +
      (opts.disabled ? " disabled" : "") +
      ' title="' + t(label) + '" aria-label="' + t(label) + '">' +
      icon(iconName) + "</button>";
  }

  function toggle(on, opts) {
    opts = opts || {};
    return '<button class="toggle" role="switch" aria-checked="' + (on ? "true" : "false") +
      '"' + (opts.disabled ? " disabled" : "") + '><span class="sr">toggle</span></button>';
  }

  function select(value, options) {
    return '<span class="sel-wrap"><select class="sel">' +
      (options || [value]).map(function (o) {
        return "<option" + (o === value ? " selected" : "") + ">" + t(o) + "</option>";
      }).join("") + "</select></span>";
  }

  function seg(items, active) {
    return '<div class="seg">' + items.map(function (i) {
      return '<button aria-pressed="' + (i === active ? "true" : "false") + '">' + t(i) + "</button>";
    }).join("") + "</div>";
  }

  /** A segment that actually governs something: it writes `state[key]` and
      re-renders, where `seg()` only moves its own thumb. Use it when the rest
      of the screen has to change — anything less makes the control a lie. */
  function segState(key, items) {
    return '<div class="seg" data-segstate="' + esc(key) + '">' + items.map(function (i) {
      return '<button data-segval="' + esc(i) + '" aria-pressed="' +
        (i === state[key] ? "true" : "false") + '">' + t(i) + "</button>";
    }).join("") + "</div>";
  }

  /** A bounded number adjusted by one. The unit lives inside the control.
      `at` marks an end of the range so the disabled state is visible. */
  function stepper(value, unit, at) {
    return '<span class="stepper">' +
      "<button" + (at === "min" ? " disabled" : "") + ' aria-label="Decrease">' + icon("minus") + "</button>" +
      '<span class="val num">' + t(value) + "</span>" +
      "<button" + (at === "max" ? " disabled" : "") + ' aria-label="Increase">' + icon("plus") + "</button>" +
      (unit ? '<span class="unit">' + t(unit) + "</span>" : "") + "</span>";
  }

  function slider(pct) {
    return '<span class="slider"><span class="track"><i style="width:' + pct + '%"></i>' +
      '<span class="knob" style="left:' + pct + '%"></span></span>' +
      '<span class="out">' + t(pct) + "%</span></span>";
  }

  /** The threshold mark is the component. `state`: ok | quiet | hot. */
  function level(peak, hold, threshold, state, verdict) {
    return '<div class="level" data-state="' + state + '">' +
      '<div class="track"><span class="fill" style="width:' + peak + '%"></span>' +
      '<span class="thr" style="left:' + threshold + '%"></span>' +
      '<span class="hold" style="left:' + hold + '%"></span></div>' +
      '<span class="verdict">' + p(verdict) +
      '<span class="thr-key">threshold</span></span></div>';
  }

  function disclosure(summary, count, rows) {
    return '<details class="disc"><summary>' + icon("chevron") + t(summary) +
      (count ? '<span class="n">' + t(count) + "</span>" : "") + "</summary>" +
      '<div class="rows">' + rows.join("") + "</div></details>";
  }

  /** A value that belongs to the active profile, not to this machine. */
  function scope(label) {
    return '<button class="scope" data-go="profiles">' + icon("profiles") + t(label || "Per profile") + "</button>";
  }

  function field(value, opts) {
    opts = opts || {};
    return '<input class="field' + (opts.cls ? " " + esc(opts.cls) : "") + '" value="' + t(value || "") + '"' +
      (opts.placeholder ? ' placeholder="' + t(opts.placeholder) + '"' : "") +
      (opts.invalid ? " data-invalid" : "") +
      (opts.w ? ' style="width:' + opts.w + '"' : "") + ">";
  }

  function textarea(value, placeholder, rows) {
    return '<textarea class="field" rows="' + (rows || 3) + '" placeholder="' +
      t(placeholder || "") + '">' + t(value || "") + "</textarea>";
  }

  function meterLine(used, max) {
    var pct = Math.min(100, Math.round((used / max) * 100));
    return '<div class="meter"' + (used > max ? " data-over" : "") + ">" +
      "<span>" + used + " / " + max + "</span>" +
      '<span class="bar"><i style="width:' + pct + '%"></i></span></div>';
  }

  function kbd(combo) {
    if (!combo) {
      return '<button class="kbd-btn" data-empty><span class="kbd"><kbd>not set</kbd></span>' +
        '<span class="edit">Set</span></button>';
    }
    return '<button class="kbd-btn"><span class="kbd">' +
      combo.split("+").map(function (k) { return "<kbd>" + t(k) + "</kbd>"; }).join("") +
      '</span><span class="edit">Change</span></button>';
  }

  function badge(text, tone) {
    return '<span class="badge"' + (tone ? ' data-tone="' + tone + '"' : "") + ">" + t(text) + "</span>";
  }

  function dot(tone) { return '<span class="dot"' + (tone ? ' data-tone="' + tone + '"' : "") + "></span>"; }

  function stats(items) {
    return '<div class="stats">' + items.map(function (i) {
      return '<div class="stat"' + (i.tone ? ' data-tone="' + i.tone + '"' : "") + ">" +
        "<b>" + t(i.value) + "</b><span>" + t(i.label) + "</span></div>";
    }).join("") + "</div>";
  }

  /** A check reports a probe: the runtime looked, and this is what it found.
      It is not a bullet. Wrapped so the card's edge rule reaches it. */
  function check(items) {
    return '<div class="check-list">' + items.map(function (i) {
      var mark = i.state === "ok" ? icon("check") : i.state === "fail" ? icon("x") : "";
      return '<div class="check" data-state="' + i.state + '"><span class="mark">' + mark + "</span>" +
        '<span class="check-text"><b>' + t(i.label) + "</b>" +
        (i.detail ? "<span>" + p(i.detail) + "</span>" : "") +
        (i.code ? "<code>" + t(i.code) + "</code>" : "") + "</span>" +
        (i.tag ? badge(i.tag, i.tagTone || "accent") : "") +
        (i.action ? btn(i.action, "ghost") : "") + "</div>";
    }).join("") + "</div>";
  }

  /** A transcript line is indexed by time. Without it a meeting transcript
      cannot be matched against the recording, and a note cannot point at the
      moment it is about. */
  function tline(o) {
    return '<div class="tline"' + (o.marked ? " data-marked" : "") + "><time>" + t(o.at) + "</time>" +
      '<span class="said">' +
      (o.who ? '<span class="speaker" data-tone="' + o.tone + '">' + t(o.who) + "</span>" : "") +
      t(o.text) + "</span></div>";
  }

  /** `preview` is a sentence the row is about — a transcript, an error — and it
      gets its own truncated line. As another `meta` entry it wrapped onto a
      second line and pushed the badge into the middle of the row, which is what
      the Upload queue looked like: three facts and a paragraph on one line. */
  /** `state` is a dot plus a word at the head of the meta line, for a status
      that is expected. A badge is for a status that is not: nine rows each
      carrying a coloured pill is a colour chart, and the one row that actually
      needs attention has nowhere left to stand out from. */
  /** `badges` is a column, not a slot. One badge inline was fine; the moment a
      row can carry two — a delivery exception AND a queue state — they fought
      the actions for the same horizontal run and the row reflowed on hover.
      They stack in a fixed right-hand column now, so the row's width is the
      same whether it carries none or two, and the actions never move. */
  /** `raw` opens under the row. A transcript has two texts — what was heard and
      what was written — and the difference is the only evidence that the AI
      stage did anything at all. It is not a second row and not a dialog: it is
      the same record, unfolded. */
  function listItem(o) {
    var badges = o.badges || (o.badge ? [o.badge] : []);
    var open = o.raw && state.raw[o.raw.id];
    return '<div class="list-item"' + (open ? " data-open" : "") + ">" +
      '<div class="list-item-text"><b>' + t(o.title) + "</b>" +
      '<span class="list-item-meta">' +
      (o.state ? '<span class="st">' + dot(o.state.tone) + t(o.state.text) + '</span><span class="sep">·</span>' : "") +
      o.meta.map(function (m, ix) {
        return (ix ? '<span class="sep">·</span>' : "") + "<span>" + t(m) + "</span>";
      }).join("") + "</span>" +
      (o.preview ? '<span class="list-item-preview"' + (o.previewTone ? ' data-tone="' + o.previewTone + '"' : "") +
        ">" + t(o.preview) + "</span>" : "") + "</div>" +
      (badges.length ? '<div class="list-item-badges">' +
        badges.map(function (b) { return badge(b.text, b.tone); }).join("") + "</div>" : "") +
      (o.actions ? '<div class="list-actions">' + o.actions.join("") + "</div>" : "") + "</div>" +
      (open ? rawPanel(o.raw) : "");
  }

  /** Both texts, labelled, with the one fact that decides whether the pair is
      worth reading: whether they differ at all. */
  function rawPanel(r) {
    return '<div class="list-raw">' +
      '<div class="raw-col"><span class="raw-label">' + t("Heard") + "</span>" +
      "<p>" + t(r.heard) + "</p></div>" +
      '<div class="raw-col"><span class="raw-label">' + t("Written") + "</span>" +
      "<p>" + t(r.written) + "</p></div>" +
      '<div class="raw-foot">' + t(r.same ? "Identical — no AI stage ran on this one." : r.note) +
      '<span class="raw-path mono">' + t(r.path) + "</span></div></div>";
  }

  /** `tail` is raw HTML appended after the prose — it must not be escaped and
      must not be counted, because a link is navigation, not prose.

      A note whose active side is empty renders nothing but is still counted on
      both sides. That is what keeps the word meter stable: counting has to be
      independent of which side is on screen, or the two totals are measured
      against different documents. */
  function note(text, iconName, tail) {
    var s = p(text);
    if (!s) return "";
    return '<p class="note">' + icon(iconName || "about") + "<span>" + s +
      (tail || "") + "</span></p>";
  }

  /* `wave(n, seed)` stood here: a row of `<i>` elements with heights from a
     sine, drawn once and never again. It was the surface's stand-in for a
     level wherever a canvas felt like too much — the meeting HUD's state line,
     the agent window's answer strip, the component gallery — and in two of
     those three it was reporting a live recording. A frozen meter on a window
     whose claim is that it is listening is a fake state, which the runtime
     rules forbid in as many words. Every one of its call sites now carries a
     real instrument: the matrix where the space is small, `waveform()` where
     there is room. Removed in the thirteenth pass. */

  /** THE ORCHESTRATOR'S VOICE, GIVEN A BODY.
      Added 2026-08-03 — ADR 0043.

      The agent window drew a rail of three targets, each with its own status
      dot, and read as three agents talking. It is one: ADR 0030 is built on
      exactly that, the orchestrator is WordScript's only client and it speaks
      FOR the agents it starts. A surface that suggests otherwise is arguing
      against the decision it exists to implement.

      One voice, one body. The orb is the orchestrator itself, not a target and
      not a level meter: idle it is small, still and white — a process that
      exists and is quiet. Speaking, it grows, warms and moves with its own
      amplitude, which is the same signal a waveform would carry, drawn as one
      object instead of eleven bars that read as several.

      `level` is 0..1 and is the envelope of the speaking voice. In the runtime
      it is the TTS output amplitude; here it is a fixed value per drawing,
      because a prototype that animates on a timer would be claiming a signal
      it does not have.

      WHY THIS IS NOT ON THE DICTATION PILL. Your dictation is your voice, and
      the bars are the shipped drawing of it — `overlay-pill.css`, unchanged,
      out of scope per §1. The orb is the other direction: the machine speaking
      to you. Two different things, two different drawings, and the recording
      overlay is not touched. */
  function orb(o) {
    o = o || {};
    var lvl = o.level == null ? 0 : o.level;
    var state = o.state || "active";
    var size = o.size || (state === "idle" ? 26 : 96);
    var label = o.label || ORB_LABEL[state] || "Orchestrator";
    return '<span class="orb" data-state="' + state + '"' +
      (o.still ? " data-still" : "") +
      (o.drive ? ' data-drive="' + o.drive + '"' : "") +
      ' style="--orb-size:' + size + "px;--orb-level:" + lvl.toFixed(2) + '"' +
      ' role="img" aria-label="' + t(label) + '">' +
      '<i class="orb-glow"></i><i class="orb-body"></i></span>';
  }

  var ORB_LABEL = {
    idle: "Orchestrator idle",
    listening: "Orchestrator listening",
    thinking: "Orchestrator working",
    speaking: "Orchestrator speaking",
    active: "Orchestrator speaking"
  };

  /* ── The envelope driver ────────────────────────────────────────────────
     WHAT THIS IS AND IS NOT. It is a drawing of how the orb MOVES, and it runs
     only where a screen asks for it with `drive:`. It is not a runtime signal
     and no screen presents it as one — the previews carrying it already state
     that the surface exists in no build. The distinction matters and it is the
     same one the rest of this prototype keeps: sample values are fine, claimed
     readiness is not. A motion model cannot be judged from a still, and the
     shipped orb's motion was wrong in a way no still would ever have shown.

     WHY NOT A SINE. The old orb breathed on a fixed-period keyframe, and the
     reason that read as a machine rather than as a voice is that speech has no
     period. It has syllables — roughly four to seven a second, each with a
     sharp onset and a softer tail, separated by gaps too short to see, and
     interrupted by phrase pauses long enough to notice. Amplitude between
     syllables varies more than most people expect: stressed syllables run
     twice the amplitude of unstressed ones in the same word.

     So the target is a syllable chain, and the smoothing is a real meter's:
     fast attack, slow release. That asymmetry is most of the effect. A signal
     that rises and falls at the same rate looks like a pulse no matter what
     shape you feed it, because the eye reads symmetry as rhythm.

     Listening is the same machinery at lower gain and slower phrasing — it is
     a person dictating, not a synthesiser reading, and dictation has longer
     thinking gaps than TTS ever does. */

  var ORB_PROFILE = {
    speaking: { syl: [0.10, 0.20], gap: [0.03, 0.07], amp: [0.42, 1.00],
                phrase: [0.34, 0.70], phraseEvery: [5, 11], attack: 0.040, release: 0.16 },
    listening: { syl: [0.12, 0.26], gap: [0.04, 0.11], amp: [0.28, 0.86],
                 phrase: [0.45, 1.30], phraseEvery: [3, 8], attack: 0.055, release: 0.21 }
  };

  function rand(range) { return range[0] + Math.random() * (range[1] - range[0]); }

  function orbEnvelope(kind) {
    return {
      p: ORB_PROFILE[kind] || ORB_PROFILE.speaking,
      level: 0, target: 0, until: 0, clock: 0,
      left: Math.round(rand((ORB_PROFILE[kind] || ORB_PROFILE.speaking).phraseEvery))
    };
  }

  function orbStep(e, dt) {
    e.clock += dt;
    if (e.clock >= e.until) {
      if (e.target > 0) {
        /* A syllable just ended. Either the next gap, or — once the syllable
           budget for this phrase is spent — a pause long enough to read as
           the end of a thought. */
        e.target = 0;
        e.left -= 1;
        if (e.left <= 0) {
          e.until = e.clock + rand(e.p.phrase);
          e.left = Math.round(rand(e.p.phraseEvery));
        } else {
          e.until = e.clock + rand(e.p.gap);
        }
      } else {
        e.target = rand(e.p.amp);
        e.until = e.clock + rand(e.p.syl);
      }
    }
    /* Exponential approach, different constant each direction. dt-correct, so
       a dropped frame does not produce a jump. */
    var tau = e.target > e.level ? e.p.attack : e.p.release;
    e.level += (e.target - e.level) * (1 - Math.exp(-dt / tau));
    if (e.level < 0.001) e.level = 0;
    return e.level;
  }

  var orbDriven = [];

  function orbCollect() {
    orbDriven = [];
    var nodes = document.querySelectorAll(".orb[data-drive]");
    for (var i = 0; i < nodes.length; i++) {
      orbDriven.push({ el: nodes[i], env: orbEnvelope(nodes[i].getAttribute("data-drive")) });
    }
  }

  /* ── The live waveform ──────────────────────────────────────────────────
     The shipped surface judges a microphone with a progress bar, which reports
     one number — current peak — and reports it as a length. That is enough to
     see that a level exists and not enough to see anything a person actually
     needs to see when they are deciding whether their microphone is set right:
     whether the signal is steady or spiky, whether the room floor is audible
     under the speech, whether the peaks are clipping while the average sits
     far too low. All of that is shape over time, and a bar has no time axis.

     So this keeps a rolling history and draws it. Canvas rather than DOM
     because it is 96 bars at 60 Hz and 96 elements being restyled every frame
     is a layout thrash; canvas is one paint into one already-composited node.

     Bars are drawn from the centre out, which is the convention every audio
     tool uses and the one that makes silence read as a line rather than as an
     empty box. Colour is the same economy as the meter: neutral while the
     signal is in range, and only the state worth acting on takes a hue. */

  var waveDriven = [];

  function waveform(o) {
    o = o || {};
    return '<canvas class="wave-live" data-wave="' + (o.kind || "input") + '"' +
      (o.tone ? ' data-tone="' + o.tone + '"' : "") +
      ' width="0" height="0"' +
      ' role="img" aria-label="' + t(o.label || "Live input level over the last few seconds") + '"></canvas>';
  }

  function waveCollect() {
    waveDriven = [];
    var nodes = document.querySelectorAll("canvas.wave-live");
    for (var i = 0; i < nodes.length; i++) {
      waveDriven.push({
        el: nodes[i],
        env: orbEnvelope(nodes[i].getAttribute("data-wave") === "voice" ? "speaking" : "listening"),
        bars: [],
        sized: 0
      });
    }
  }

  function waveDraw(w, dt) {
    var el = w.el;
    var cssW = el.clientWidth, cssH = el.clientHeight;
    if (!cssW || !cssH) return;
    var dpr = window.devicePixelRatio || 1;
    if (w.sized !== cssW * 10000 + cssH) {
      el.width = Math.round(cssW * dpr);
      el.height = Math.round(cssH * dpr);
      w.sized = cssW * 10000 + cssH;
    }
    var ctx = el.getContext("2d");
    /* THIRTEENTH PASS — THE GEOMETRY IS `live-waveform`'S. Upstream is vendored
       at src/components/ui/live-waveform.tsx and it opens the microphone
       itself, through `getUserMedia` and an `AnalyserNode`; this prototype has
       no microphone and fakes levels through `orbEnvelope`, so what is ported
       is the drawing and not the audio path. Upstream's numbers, upstream's
       defaults: `barWidth` 3, `barGap` 1, a `barRadius` of half the bar, bars
       centred on the middle line and grown to 80% of the height, and scrolling
       mode filling from the right edge backwards so the newest sample is under
       the leading edge rather than at a fixed slot.

       TWO OF ITS RULES ARE WHY THIS LOOKS DIFFERENT FROM WHAT WAS HERE:

       ALPHA CARRIES LEVEL, NOT JUST HEIGHT. `0.4 + value * 0.6` — a quiet bar
       is short AND faint, so a run of near-silence reads as one dim texture
       instead of as a row of little marks each drawn at full strength. The
       previous version switched between two flat colours at a 0.02 threshold,
       which put a hard edge in the middle of the quietest part of the signal.

       THE FLOOR IS A BASE HEIGHT, NOT A SECOND COLOUR. Upstream keeps every
       bar at least `baseBarHeight` tall so silence is a line rather than a
       gap, which is the same conclusion the old code reached and a cheaper way
       to reach it. */
    var barW = 3, gap = 1, step = barW + gap, baseH = 2;
    var slots = Math.max(1, Math.floor(cssW / step));

    w.bars.push(orbStep(w.env, dt));
    while (w.bars.length > slots) w.bars.shift();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    var cs = getComputedStyle(el);
    var live = cs.getPropertyValue("--wave-fg").trim() || "#c2bfb8";
    var mid = cssH / 2;

    ctx.fillStyle = live;
    for (var i = 0; i < slots; i++) {
      /* Newest at the right edge, walking backwards — upstream's scrolling
         mode. A history shorter than the canvas leaves the left end empty
         rather than stretching to fill it, because a meter that rescales its
         own past is reporting a shape that never happened. */
      var v = w.bars[w.bars.length - 1 - i];
      if (v == null) break;
      var h = Math.max(baseH, v * cssH * 0.8);
      var x = cssW - (i + 1) * step;
      ctx.globalAlpha = 0.4 + Math.min(1, v) * 0.6;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, mid - h / 2, barW, h, barW / 2);
      else ctx.rect(x, mid - h / 2, barW, h);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ── The matrix ─────────────────────────────────────────────────────────
     ELEVENTH PASS. What stood here was a field of drifting glyphs — the Matrix
     film's rain, drawn on a canvas, used as Home's background. It was written
     because the real component could not be fetched: ui.elevenlabs.io answers
     every request with a Vercel bot check, so the tenth pass built a
     substitute and named it after the thing it was standing in for.

     The substitute was wrong twice. It looked wrong — at rest it reads as
     speckle on the panel rather than as texture, which is what the first look
     at a screenshot said. And it was not the component it was named after:
     ElevenLabs `matrix` is a dot-matrix LED display, a grid of round pixels
     that spells digits, runs a loader, and drives a VU meter from levels. It
     is a readout. It was never a background, so no arrangement of the film
     rain was ever going to converge on it.

     The real one is now in the tree, fetched from github.com/elevenlabs/ui
     (MIT) since the registry host is unreachable. React lives at
     src/components/ui/matrix.tsx; this is the same geometry in plain SVG,
     because the prototype has no bundler and a screen that cannot be shown
     here is a screen that cannot be argued with. `vu` below is a port of the
     upstream function, not an approximation of it.

     WHAT IT IS FOR HERE. Home's question at rest is "is this thing
     listening", and a level meter answers it without being read — from across
     a desk, which is the distance this app is used at. The difference from the
     rain is that a VU meter is a measurement: it goes still when the room is
     quiet, and the old field kept drifting whether or not anything was
     happening. */

  /* THE PORT IS COMPLETE AS OF THE THIRTEENTH PASS. The twelfth carried `vu()`
     and the circle geometry and nothing else, which was enough to draw one
     meter and not enough to be the component: the parts that make a dot-matrix
     display a display — the patterns it can spell, the frame clock that plays
     them, the brightness control, the lit-pixel swell and the radial fills that
     make a pixel read as emitting rather than as a filled circle — were all
     still upstream. Everything below is ported from
     `src/components/ui/matrix.tsx`, which is itself vendored from
     github.com/elevenlabs/ui at 6e5b681c01ee.

     WHY IT IS A PORT AND NOT A SECOND IMPLEMENTATION. Where upstream and this
     disagree, upstream wins and the difference is written down. Two of them:

     1. The frame is rendered once and then updated in place. React reconciles
        attributes on a stable element tree; rebuilding 168 `<circle>` elements
        from a string every animation frame is not the same thing performed
        differently, it is a different cost, and at 60 fps with a blur filter
        attached it is a visible one.
     2. Gradient and filter ids are per-instance. Upstream hardcodes
        `matrix-pixel-on`, `matrix-pixel-off` and `matrix-glow`, so two matrices
        on one page share three definitions and the second one silently renders
        with the first one's palette. Nothing in this prototype puts two on a
        screen today; the meeting HUD puts three. */

  var MATRIX_ROWS = 7;
  var matrixSeq = 0;

  function matrixClamp(v) { return Math.max(0, Math.min(1, v)); }

  function matrixEmpty(rows, cols) {
    var f = [];
    for (var r = 0; r < rows; r++) f.push(new Array(cols).fill(0));
    return f;
  }

  function matrixSetPixel(frame, row, col, value) {
    if (row >= 0 && row < frame.length && col >= 0 && col < frame[0].length) {
      frame[row][col] = value;
    }
  }

  /* A frame authored at one size, drawn at another. Upstream pads with zeroes
     rather than scaling, so a 5-wide digit in a 7-wide field sits left and the
     caller places it — which is what lets `digits` compose into a clock. */
  function matrixEnsureSize(frame, rows, cols) {
    var out = [];
    for (var r = 0; r < rows; r++) {
      var row = frame[r] || [];
      out.push([]);
      for (var c = 0; c < cols; c++) out[r][c] = row[c] == null ? 0 : row[c];
    }
    return out;
  }

  var MATRIX = {};

  MATRIX.digits = [
    [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
    [[0,0,1,0,0],[0,1,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,1,1,1,0]],
    [[0,1,1,1,0],[1,0,0,0,1],[0,0,0,0,1],[0,0,0,1,0],[0,0,1,0,0],[0,1,0,0,0],[1,1,1,1,1]],
    [[0,1,1,1,0],[1,0,0,0,1],[0,0,0,0,1],[0,0,1,1,0],[0,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
    [[0,0,0,1,0],[0,0,1,1,0],[0,1,0,1,0],[1,0,0,1,0],[1,1,1,1,1],[0,0,0,1,0],[0,0,0,1,0]],
    [[1,1,1,1,1],[1,0,0,0,0],[1,1,1,1,0],[0,0,0,0,1],[0,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
    [[0,1,1,1,0],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
    [[1,1,1,1,1],[0,0,0,0,1],[0,0,0,1,0],[0,0,1,0,0],[0,1,0,0,0],[0,1,0,0,0],[0,1,0,0,0]],
    [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
    [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,1],[0,0,0,0,1],[0,0,0,0,1],[0,1,1,1,0]],
  ];

  MATRIX.chevronLeft = [[0,0,0,1,0],[0,0,1,0,0],[0,1,0,0,0],[0,0,1,0,0],[0,0,0,1,0]];
  MATRIX.chevronRight = [[0,1,0,0,0],[0,0,1,0,0],[0,0,0,1,0],[0,0,1,0,0],[0,1,0,0,0]];

  /* Eight lit pixels walking a circle of radius 2.5 in a 7x7 field, each one
     dimmer than the one ahead of it. Twelve frames is one revolution. */
  MATRIX.loader = (function () {
    var frames = [], size = 7, center = 3, radius = 2.5;
    for (var frame = 0; frame < 12; frame++) {
      var f = matrixEmpty(size, size);
      for (var i = 0; i < 8; i++) {
        var angle = (frame / 12) * Math.PI * 2 + (i / 8) * Math.PI * 2;
        var x = Math.round(center + Math.cos(angle) * radius);
        var y = Math.round(center + Math.sin(angle) * radius);
        matrixSetPixel(f, y, x, Math.max(0.2, 1 - i / 10));
      }
      frames.push(f);
    }
    return frames;
  })();

  /* A ring expanding from a lit centre. Sixteen frames of one sine period.
     NOT FOR THE ORB, AND NOT FOR ANY STATE OF IT: ADR 0049 settles that the
     orb has four states and none of them pulses. This is here because the port
     is a port — the component carries it, so this carries it — and because a
     dot-matrix readout is not the orchestrator's voice. Using it to say "alive"
     anywhere in this product would be the thing that ADR forbids. */
  MATRIX.pulse = (function () {
    var frames = [], size = 7, center = 3;
    for (var frame = 0; frame < 16; frame++) {
      var f = matrixEmpty(size, size);
      var intensity = (Math.sin((frame / 16) * Math.PI * 2) + 1) / 2;
      matrixSetPixel(f, center, center, 1);
      var radius = Math.floor((1 - intensity) * 3) + 1;
      for (var dy = -radius; dy <= radius; dy++) {
        for (var dx = -radius; dx <= radius; dx++) {
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (Math.abs(dist - radius) < 0.7) {
            matrixSetPixel(f, center + dy, center + dx, intensity * 0.6);
          }
        }
      }
      frames.push(f);
    }
    return frames;
  })();

  /* A travelling sine, anti-aliased vertically: the fractional part of the
     height lights the pixel above and below in proportion, which is what keeps
     a 7-row wave from stepping. */
  MATRIX.wave = (function () {
    var frames = [], rows = 7, cols = 7;
    for (var frame = 0; frame < 24; frame++) {
      var f = matrixEmpty(rows, cols);
      var phase = (frame / 24) * Math.PI * 2;
      for (var col = 0; col < cols; col++) {
        var height = Math.sin(phase + (col / cols) * Math.PI * 2) * 2.5 + 3.5;
        var row = Math.floor(height);
        if (row >= 0 && row < rows) {
          matrixSetPixel(f, row, col, 1);
          var frac = height - row;
          if (row > 0) matrixSetPixel(f, row - 1, col, 1 - frac);
          if (row < rows - 1) matrixSetPixel(f, row + 1, col, frac);
        }
      }
      frames.push(f);
    }
    return frames;
  })();

  /* A five-pixel tail walking a boustrophedon path over the whole field. */
  MATRIX.snake = (function () {
    var frames = [], rows = 7, cols = 7, path = [];
    var x = 0, y = 0, dx = 1, dy = 0;
    var visited = {};
    while (path.length < rows * cols) {
      path.push([y, x]);
      visited[y + "," + x] = true;
      var nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !visited[ny + "," + nx]) {
        x = nx; y = ny;
      } else {
        var ndx = -dy, ndy = dx;
        dx = ndx; dy = ndy;
        nx = x + dx; ny = y + dy;
        if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !visited[ny + "," + nx]) {
          x = nx; y = ny;
        } else break;
      }
    }
    var len = 5;
    for (var frame = 0; frame < path.length; frame++) {
      var f = matrixEmpty(rows, cols);
      for (var i = 0; i < len; i++) {
        var idx = frame - i;
        if (idx >= 0 && idx < path.length) {
          matrixSetPixel(f, path[idx][0], path[idx][1], 1 - i / len);
        }
      }
      frames.push(f);
    }
    return frames;
  })();

  /* Column heights from a level array, brightness stepping down the column so
     the top of a tall bar is dimmer than its base. */
  MATRIX.vu = function (columns, levels) {
    var rows = MATRIX_ROWS;
    var frame = matrixEmpty(rows, columns);
    for (var col = 0; col < Math.min(columns, levels.length); col++) {
      var height = Math.floor(matrixClamp(levels[col]) * rows);
      for (var row = 0; row < rows; row++) {
        if (rows - 1 - row < height) {
          frame[row][col] = row < rows * 0.3 ? 1 : row < rows * 0.6 ? 0.8 : 0.6;
        }
      }
    }
    return frame;
  };

  /** One matrix. `mode` is `vu`, `pattern` or `frames`; a `vu` reads levels,
      the other two read a frame array. Every option below is upstream's, with
      upstream's default. */
  function matrixField(o) {
    o = o || {};
    return '<span class="matrix-wrap" role="img"' +
      ' aria-label="' + t(o.ariaLabel || "matrix display") + '"' +
      ' data-mode="' + (o.mode || "vu") + '"' +
      (o.pattern ? ' data-pattern="' + t(o.pattern) + '"' : "") +
      ' data-rows="' + (o.rows || MATRIX_ROWS) + '"' +
      ' data-cols="' + (o.cols || 28) + '"' +
      ' data-size="' + (o.size || 4) + '"' +
      ' data-gap="' + (o.gap || 2) + '"' +
      ' data-fps="' + (o.fps || 12) + '"' +
      ' data-brightness="' + (o.brightness == null ? 1 : o.brightness) + '"' +
      (o.autoplay === false ? ' data-autoplay="false"' : "") +
      (o.loop === false ? ' data-loop="false"' : "") +
      (o.live === false ? ' data-live="false"' : "") + "></span>";
  }

  var matrixDriven = [];

  /* The frame source, resolved once per mount. A named pattern is one of the
     ports above; `vu` has no frames and reads the level ring instead. */
  function matrixFrames(name) {
    if (!name) return null;
    if (name === "digits") return MATRIX.digits;
    return MATRIX[name] || null;
  }

  /** Build the SVG once: defs, then one circle per pixel, kept in a flat array
      so a frame is applied by writing attributes rather than by re-parsing. */
  function matrixMount(el) {
    var rows = parseInt(el.getAttribute("data-rows"), 10) || MATRIX_ROWS;
    var cols = parseInt(el.getAttribute("data-cols"), 10) || 28;
    var size = parseFloat(el.getAttribute("data-size")) || 4;
    var gap = parseFloat(el.getAttribute("data-gap")) || 2;
    var mode = el.getAttribute("data-mode") || "vu";
    var uid = "mx" + (++matrixSeq);
    var w = cols * (size + gap) - gap;
    var h = rows * (size + gap) - gap;
    var radius = (size / 2) * 0.9;

    /* Inline width/height, not attributes alone: the reset gives every svg in
       this prototype a glyph-sized box, and a panel declared only in attributes
       came out 16x16. */
    var svg = '<svg class="matrix-led" viewBox="0 0 ' + w + " " + h +
      '" width="' + w + '" height="' + h +
      '" style="width:' + w + "px;height:" + h + 'px" aria-hidden="true">' +
      "<defs>" +
      '<radialGradient id="' + uid + '-on" cx="50%" cy="50%" r="50%">' +
      '<stop offset="0%" stop-color="var(--matrix-on)" stop-opacity="1"/>' +
      '<stop offset="70%" stop-color="var(--matrix-on)" stop-opacity="0.85"/>' +
      '<stop offset="100%" stop-color="var(--matrix-on)" stop-opacity="0.6"/>' +
      "</radialGradient>" +
      /* WORDSCRIPT, carried over from matrix.tsx: upstream hardcodes
         `--muted-foreground` in both stops, so the palette prop it documents
         never reaches the unlit pixels. */
      '<radialGradient id="' + uid + '-off" cx="50%" cy="50%" r="50%">' +
      '<stop offset="0%" stop-color="var(--matrix-off)" stop-opacity="1"/>' +
      '<stop offset="100%" stop-color="var(--matrix-off)" stop-opacity="0.7"/>' +
      "</radialGradient>" +
      /* WORDSCRIPT. Upstream fixes `stdDeviation` at 2 user units, which is
         tuned to its own default 10 px pixel and is a soft halo there. The
         blur radius is in the SVG's coordinate system, so at the meeting HUD's
         2 px pixel the same number blurs each dot across more than the whole
         grid and the readout dissolves into an orange smear. It scales with
         the pixel instead, at upstream's own ratio — 2 at size 10 — so a
         matrix drawn at any size gets the bloom upstream drew at its.
         Performance is not the reason for this and was measured before the
         change: at 7x24 in WebKitGTK 2.52.4 the filter, a static drop-shadow
         and no bloom at all all hold 62 fps. */
      '<filter id="' + uid + '-glow" x="-50%" y="-50%" width="200%" height="200%">' +
      '<feGaussianBlur stdDeviation="' + (size / 5).toFixed(3) + '" result="blur"/>' +
      '<feComposite in="SourceGraphic" in2="blur" operator="over"/>' +
      "</filter>" +
      "</defs>";

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        svg += '<circle class="matrix-pixel" cx="' + (c * (size + gap) + size / 2).toFixed(2) +
          '" cy="' + (r * (size + gap) + size / 2).toFixed(2) +
          '" r="' + radius.toFixed(3) + '" fill="url(#' + uid + '-off)" opacity="0.1"/>';
      }
    }
    el.innerHTML = svg + "</svg>";
    /* The filter is defined per instance, so the handle to it is too. */
    el.style.setProperty("--matrix-glow", "url(#" + uid + "-glow)");

    return {
      el: el,
      px: el.querySelectorAll("circle"),
      rows: rows,
      cols: cols,
      uid: uid,
      mode: mode,
      brightness: parseFloat(el.getAttribute("data-brightness")),
      fps: parseFloat(el.getAttribute("data-fps")) || 12,
      loop: el.getAttribute("data-loop") !== "false",
      playing: el.getAttribute("data-autoplay") !== "false",
      frames: matrixFrames(el.getAttribute("data-pattern")),
      frameIndex: 0,
      acc: 0,
      /* The levels are sampled, not measured — this is a static mock and there
         is no microphone. `orbEnvelope` is the same generator the waveforms and
         the orb use, so every live drawing on a screen agrees about what the
         room is doing rather than each inventing its own speech. */
      live: el.getAttribute("data-live") !== "false",
      env: orbEnvelope("listening"),
      levels: [],
      last: null
    };
  }

  /** Write one frame onto the mounted circles. Every rule here is upstream's:
      a pixel is on above 0.05 of computed brightness and swells to 1.1 above
      0.5, an off pixel holds a fixed 0.1 rather than vanishing, because a dark
      grid is the display and an empty box is a broken one. */
  function matrixApply(m, frame) {
    var key = "";
    var i = 0;
    for (var r = 0; r < m.rows; r++) {
      for (var c = 0; c < m.cols; c++, i++) {
        var value = matrixClamp(m.brightness * (frame[r] ? frame[r][c] || 0 : 0));
        key += value > 0.5 ? "2" : value > 0.05 ? "1" : "0";
        var node = m.px[i];
        if (!node) continue;
        var on = value > 0.05;
        var active = value > 0.5;
        node.setAttribute("fill", "url(#" + m.uid + (on ? "-on" : "-off") + ")");
        node.setAttribute("opacity", on ? value.toFixed(3) : "0.1");
        node.setAttribute("class", "matrix-pixel" + (active ? " matrix-pixel-active" : ""));
        node.style.transform = active ? "scale(1.1)" : "";
      }
    }
    /* The class string is what changed, or nothing did — the aria-live region
       upstream declares is only honest while frames actually differ. */
    if (key !== m.last) m.last = key;
  }

  function matrixCollect() {
    matrixDriven = [];
    var nodes = document.querySelectorAll(".matrix-wrap");
    for (var i = 0; i < nodes.length; i++) matrixDriven.push(matrixMount(nodes[i]));
    for (i = 0; i < matrixDriven.length; i++) matrixDraw(matrixDriven[i], 0.016);
  }

  function matrixDraw(m, dt) {
    if (m.mode === "vu") {
      m.levels.push(m.live ? orbStep(m.env, dt) : 0);
      while (m.levels.length > m.cols) m.levels.shift();
      while (m.levels.length < m.cols) m.levels.unshift(0);
      matrixApply(m, MATRIX.vu(m.cols, m.levels));
      return;
    }
    if (!m.frames || !m.frames.length) { matrixApply(m, matrixEmpty(m.rows, m.cols)); return; }
    if (m.mode === "pattern") {
      matrixApply(m, matrixEnsureSize(m.frames[0], m.rows, m.cols));
      return;
    }
    /* The frame clock, upstream's accumulator: real time in, fixed frame
       interval out, so playback holds its fps whatever the display refresh
       is doing. A non-looping animation stops on its last frame and stays
       there rather than clearing. */
    if (m.playing) {
      m.acc += dt * 1000;
      var interval = 1000 / m.fps;
      while (m.acc >= interval) {
        m.acc -= interval;
        var next = m.frameIndex + 1;
        if (next >= m.frames.length) {
          if (m.loop) m.frameIndex = 0;
          else { m.playing = false; break; }
        } else m.frameIndex = next;
      }
    }
    matrixApply(m, matrixEnsureSize(m.frames[m.frameIndex], m.rows, m.cols));
  }

  /* One loop for every live drawing on the page. Three separate rAF chains
     would each pay their own frame-scheduling cost and could tear against one
     another; this way every drawing on a screen advances on the same clock and
     with the same dt. */
  function animLoop() {
    /* Reduced motion stops the clock, it does not blank the drawing. A
       waveform that renders as an empty box says the microphone is dead; a
       still one says the same thing a photograph of a waveform says. One
       frame is drawn with a fixed dt so the shapes exist, and nothing
       advances after it. */
    if (REDUCED) {
      requestAnimationFrame(function () {
        for (var i = 0; i < waveDriven.length; i++) {
          for (var k = 0; k < 140; k++) waveDraw(waveDriven[i], 0.016);
        }
        for (i = 0; i < matrixDriven.length; i++) matrixDraw(matrixDriven[i], 0.016);
      });
      return;
    }
    var last = 0;
    function frame(now) {
      var dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
      last = now;
      var i;
      for (i = 0; i < orbDriven.length; i++) {
        orbDriven[i].el.style.setProperty("--orb-level", orbStep(orbDriven[i].env, dt).toFixed(3));
      }
      for (i = 0; i < waveDriven.length; i++) waveDraw(waveDriven[i], dt);
      for (i = 0; i < matrixDriven.length; i++) matrixDraw(matrixDriven[i], dt);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  var REDUCED = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  var SYSTEM_DARK = window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : { matches: true, addEventListener: null, addListener: null };

  function resolvedTheme() {
    if (state.theme === "system") return SYSTEM_DARK.matches ? "dark" : "light";
    return state.theme;
  }

  /* ── Provider marks ─────────────────────────────────────────────────────
     `@lobehub/icons-static-svg` v1.94.0, MIT, by LobeHub. Inlined as paths
     because this prototype has no build step and no network.

     IN COLOUR, AND THE COLOUR IS THE IDENTIFICATION. The first build used the
     monochrome variants, reasoning from §11.20's rule against colour charts:
     nine rows each carrying a coloured pill is a chart in which the row that
     needs attention has nothing to stand out from. That rule is about STATUS
     colour — a hue the interface assigns to mean something, competing with the
     one hue that means "look here". A brand mark is not status. Its colour is
     part of the mark, it is the same orange every time you have ever seen
     Anthropic, and stripping it makes the marks harder to tell apart while
     freeing no attention at all. Monochrome cost recognition and bought
     nothing.

     The accent still means "overridden" and still has no competition, because
     no brand in this set is WordScript's amber.

     A SPRITE, NOT REPEATED INLINE SVG. Six of these carry gradients with
     internal ids, and the same mark appears in the provider grid AND in a job
     row — inline that is duplicate ids in one document, which browsers resolve
     by first-wins and validators reject. Defined once as `<symbol>`,
     referenced with `<use>`: ids are unique by construction and each mark's
     geometry is sent once. Every id is additionally namespaced per mark, so
     two symbols cannot collide even if lobehub ever ships colliding ones.

     THREE ARE BLACK-AND-WHITE BY DESIGN — OpenAI, xAI and Ollama have no
     colour variant because their marks have no colour. They take
     `currentColor` and follow the theme, which is what their brand does too.
     Groq and LM Studio ship mono files with a known brand colour, so they are
     tinted rather than left grey. */
  var BRAND_TINTS = {
    groq: '#F55036',
    lmstudio: '#4B6BFB',
  };

  var BRAND_SYMBOLS = {
    groq: '<path d="M12.036 2c-3.853-.035-7 3-7.036 6.781-.035 3.782 3.055 6.872 6.908 6.907h2.42v-2.566h-2.292c-2.407.028-4.38-1.866-4.408-4.23-.029-2.362 1.901-4.298 4.308-4.326h.1c2.407 0 4.358 1.915 4.365 4.278v6.305c0 2.342-1.944 4.25-4.323 4.279a4.375 4.375 0 01-3.033-1.252l-1.851 1.818A7 7 0 0012.029 22h.092c3.803-.056 6.858-3.083 6.879-6.816v-6.5C18.907 4.963 15.817 2 12.036 2z"></path>',
    openai: '<path d="M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z"></path>',
    anthropic: '<path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z" fill="#D97757" fill-rule="nonzero"></path>',
    gemini: '<path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="#3186FF"></path><path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="url(#pm-gemini-ini0R0)"></path><path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="url(#pm-gemini-ini1R0)"></path><path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="url(#pm-gemini-ini2R0)"></path><defs><linearGradient gradientUnits="userSpaceOnUse" id="pm-gemini-ini0R0" x1="7" x2="11" y1="15.5" y2="12"><stop stop-color="#08B962"></stop><stop offset="1" stop-color="#08B962" stop-opacity="0"></stop></linearGradient><linearGradient gradientUnits="userSpaceOnUse" id="pm-gemini-ini1R0" x1="8" x2="11.5" y1="5.5" y2="11"><stop stop-color="#F94543"></stop><stop offset="1" stop-color="#F94543" stop-opacity="0"></stop></linearGradient><linearGradient gradientUnits="userSpaceOnUse" id="pm-gemini-ini2R0" x1="3.5" x2="17.5" y1="13.5" y2="12"><stop stop-color="#FABC12"></stop><stop offset=".46" stop-color="#FABC12" stop-opacity="0"></stop></linearGradient></defs>',
    mistral: '<path d="M3.428 3.4h3.429v3.428H3.428V3.4zm13.714 0h3.43v3.428h-3.43V3.4z" fill="gold"></path><path d="M3.428 6.828h6.857v3.429H3.429V6.828zm10.286 0h6.857v3.429h-6.857V6.828z" fill="#FFAF00"></path><path d="M3.428 10.258h17.144v3.428H3.428v-3.428z" fill="#FF8205"></path><path d="M3.428 13.686h3.429v3.428H3.428v-3.428zm6.858 0h3.429v3.428h-3.429v-3.428zm6.856 0h3.43v3.428h-3.43v-3.428z" fill="#FA500F"></path><path d="M0 17.114h10.286v3.429H0v-3.429zm13.714 0H24v3.429H13.714v-3.429z" fill="#E10500"></path>',
    xai: '<path d="M6.469 8.776L16.512 23h-4.464L2.005 8.776H6.47zm-.004 7.9l2.233 3.164L6.467 23H2l4.465-6.324zM22 2.582V23h-3.659V7.764L22 2.582zM22 1l-9.952 14.095-2.233-3.163L17.533 1H22z"></path>',
    openrouter: '<path d="M18.654 3.87a5.087 5.087 0 110 10.174L23.7 19.09c.64.641.187 1.737-.72 1.737H8.48a8.479 8.479 0 010-16.958h10.175zM8.479 7.26a5.087 5.087 0 100 10.176 5.087 5.087 0 000-10.175z" fill="#C8FF00"></path>',
    bedrock: '<defs><linearGradient id="pm-bedrock-rockR0" x1="80%" x2="20%" y1="20%" y2="80%"><stop offset="0%" stop-color="#6350FB"></stop><stop offset="50%" stop-color="#3D8FFF"></stop><stop offset="100%" stop-color="#9AD8F8"></stop></linearGradient></defs><path d="M13.05 15.513h3.08c.214 0 .389.177.389.394v1.82a1.704 1.704 0 011.296 1.661c0 .943-.755 1.708-1.685 1.708-.931 0-1.686-.765-1.686-1.708 0-.807.554-1.484 1.297-1.662v-1.425h-2.69v4.663a.395.395 0 01-.188.338l-2.69 1.641a.385.385 0 01-.405-.002l-4.926-3.086a.395.395 0 01-.185-.336V16.3L2.196 14.87A.395.395 0 012 14.555L2 14.528V9.406c0-.14.073-.27.192-.34l2.465-1.462V4.448c0-.129.062-.249.165-.322l.021-.014L9.77 1.058a.385.385 0 01.407 0l2.69 1.675a.395.395 0 01.185.336V7.6h3.856V5.683a1.704 1.704 0 01-1.296-1.662c0-.943.755-1.708 1.685-1.708.931 0 1.685.765 1.685 1.708 0 .807-.553 1.484-1.296 1.662v2.311a.391.391 0 01-.389.394h-4.245v1.806h6.624a1.69 1.69 0 011.64-1.313c.93 0 1.685.764 1.685 1.707 0 .943-.754 1.708-1.685 1.708a1.69 1.69 0 01-1.64-1.314H13.05v1.937h4.953l.915 1.18a1.66 1.66 0 01.84-.227c.931 0 1.685.764 1.685 1.707 0 .943-.754 1.708-1.685 1.708-.93 0-1.685-.765-1.685-1.708 0-.346.102-.668.276-.937l-.724-.935H13.05v1.806zM9.973 1.856L7.93 3.122V6.09h-.778V3.604L5.435 4.669v2.945l2.11 1.36L9.712 7.61V5.334h.778V7.83c0 .136-.07.263-.184.335L7.963 9.638v2.081l1.422 1.009-.446.646-1.406-.998-1.53 1.005-.423-.66 1.605-1.055v-1.99L5.038 8.29l-2.26 1.34v1.676l1.972-1.189.398.677-2.37 1.429V14.3l2.166 1.258 2.27-1.368.397.677-2.176 1.311V19.3l1.876 1.175 2.365-1.426.398.678-2.017 1.216 1.918 1.201 2.298-1.403v-5.78l-4.758 2.893-.4-.675 5.158-3.136V3.289L9.972 1.856zM16.13 18.47a.913.913 0 00-.908.92c0 .507.406.918.908.918a.913.913 0 00.907-.919.913.913 0 00-.907-.92zm3.63-3.81a.913.913 0 00-.908.92c0 .508.406.92.907.92a.913.913 0 00.908-.92.913.913 0 00-.908-.92zm1.555-4.99a.913.913 0 00-.908.92c0 .507.407.918.908.918a.913.913 0 00.907-.919.913.913 0 00-.907-.92zM17.296 3.1a.913.913 0 00-.907.92c0 .508.406.92.907.92a.913.913 0 00.908-.92.913.913 0 00-.908-.92z" fill="url(#pm-bedrock-rockR0)" fill-rule="nonzero"></path>',
    azure: '<path d="M7.242 1.613A1.11 1.11 0 018.295.857h6.977L8.03 22.316a1.11 1.11 0 01-1.052.755h-5.43a1.11 1.11 0 01-1.053-1.466L7.242 1.613z" fill="url(#pm-azure-ure0R0)"></path><path d="M18.397 15.296H7.4a.51.51 0 00-.347.882l7.066 6.595c.206.192.477.298.758.298h6.226l-2.706-7.775z" fill="#0078D4"></path><path d="M15.272.857H7.497L0 23.071h7.775l1.596-4.73 5.068 4.73h6.665l-2.707-7.775h-7.998L15.272.857z" fill="url(#pm-azure-ure1R0)"></path><path d="M17.193 1.613a1.11 1.11 0 00-1.052-.756h-7.81.035c.477 0 .9.304 1.052.756l6.748 19.992a1.11 1.11 0 01-1.052 1.466h-.12 7.895a1.11 1.11 0 001.052-1.466L17.193 1.613z" fill="url(#pm-azure-ure2R0)"></path><defs><linearGradient gradientUnits="userSpaceOnUse" id="pm-azure-ure0R0" x1="8.247" x2="1.002" y1="1.626" y2="23.03"><stop stop-color="#114A8B"></stop><stop offset="1" stop-color="#0669BC"></stop></linearGradient><linearGradient gradientUnits="userSpaceOnUse" id="pm-azure-ure1R0" x1="14.042" x2="12.324" y1="15.302" y2="15.888"><stop stop-opacity=".3"></stop><stop offset=".071" stop-opacity=".2"></stop><stop offset=".321" stop-opacity=".1"></stop><stop offset=".623" stop-opacity=".05"></stop><stop offset="1" stop-opacity="0"></stop></linearGradient><linearGradient gradientUnits="userSpaceOnUse" id="pm-azure-ure2R0" x1="12.841" x2="20.793" y1="1.626" y2="22.814"><stop stop-color="#3CCBF4"></stop><stop offset="1" stop-color="#2892DF"></stop></linearGradient></defs>',
    vertexai: '<path d="M11.995 20.216a1.892 1.892 0 100 3.785 1.892 1.892 0 000-3.785zm0 2.806a.927.927 0 11.927-.914.914.914 0 01-.927.914z" fill="#4285F4"></path><path clip-rule="evenodd" d="M21.687 14.144c.237.038.452.16.605.344a.978.978 0 01-.18 1.3l-8.24 6.082a1.892 1.892 0 00-1.147-1.508l8.28-6.08a.991.991 0 01.682-.138z" fill="#669DF6" fill-rule="evenodd"></path><path clip-rule="evenodd" d="M10.122 21.842l-8.217-6.066a.952.952 0 01-.206-1.287.978.978 0 011.287-.206l8.28 6.08a1.893 1.893 0 00-1.144 1.479z" fill="#AECBFA" fill-rule="evenodd"></path><path d="M4.273 4.475a.978.978 0 01-.965-.965V1.09a.978.978 0 111.943 0v2.42a.978.978 0 01-.978.965zM4.247 13.034a.978.978 0 100-1.956.978.978 0 000 1.956zM4.247 10.19a.978.978 0 100-1.956.978.978 0 000 1.956zM4.247 7.332a.978.978 0 100-1.956.978.978 0 000 1.956z" fill="#AECBFA"></path><path d="M19.718 7.307a.978.978 0 01-.965-.979v-2.42a.965.965 0 011.93 0v2.42a.964.964 0 01-.965.979zM19.743 13.047a.978.978 0 100-1.956.978.978 0 000 1.956zM19.743 10.151a.978.978 0 100-1.956.978.978 0 000 1.956zM19.743 2.068a.978.978 0 100-1.956.978.978 0 000 1.956z" fill="#4285F4"></path><path d="M11.995 15.917a.978.978 0 01-.965-.965v-2.459a.978.978 0 011.943 0v2.433a.976.976 0 01-.978.991zM11.995 18.762a.978.978 0 100-1.956.978.978 0 000 1.956zM11.995 10.64a.978.978 0 100-1.956.978.978 0 000 1.956zM11.995 7.783a.978.978 0 100-1.956.978.978 0 000 1.956z" fill="#669DF6"></path><path d="M15.856 10.177a.978.978 0 01-.965-.965v-2.42a.977.977 0 011.702-.763.979.979 0 01.241.763v2.42a.978.978 0 01-.978.965zM15.869 4.913a.978.978 0 100-1.956.978.978 0 000 1.956zM15.869 15.853a.978.978 0 100-1.956.978.978 0 000 1.956zM15.869 12.996a.978.978 0 100-1.956.978.978 0 000 1.956z" fill="#4285F4"></path><path d="M8.121 15.853a.978.978 0 100-1.956.978.978 0 000 1.956zM8.121 7.783a.978.978 0 100-1.956.978.978 0 000 1.956zM8.121 4.913a.978.978 0 100-1.957.978.978 0 000 1.957zM8.134 12.996a.978.978 0 01-.978-.94V9.611a.965.965 0 011.93 0v2.445a.966.966 0 01-.952.94z" fill="#AECBFA"></path>',
    ollama: '<path d="M7.905 1.09c.216.085.411.225.588.41.295.306.544.744.734 1.263.191.522.315 1.1.362 1.68a5.054 5.054 0 012.049-.636l.051-.004c.87-.07 1.73.087 2.48.474.101.053.2.11.297.17.05-.569.172-1.134.36-1.644.19-.52.439-.957.733-1.264a1.67 1.67 0 01.589-.41c.257-.1.53-.118.796-.042.401.114.745.368 1.016.737.248.337.434.769.561 1.287.23.934.27 2.163.115 3.645l.053.04.026.019c.757.576 1.284 1.397 1.563 2.35.435 1.487.216 3.155-.534 4.088l-.018.021.002.003c.417.762.67 1.567.724 2.4l.002.03c.064 1.065-.2 2.137-.814 3.19l-.007.01.01.024c.472 1.157.62 2.322.438 3.486l-.006.039a.651.651 0 01-.747.536.648.648 0 01-.54-.742c.167-1.033.01-2.069-.48-3.123a.643.643 0 01.04-.617l.004-.006c.604-.924.854-1.83.8-2.72-.046-.779-.325-1.544-.8-2.273a.644.644 0 01.18-.886l.009-.006c.243-.159.467-.565.58-1.12a4.229 4.229 0 00-.095-1.974c-.205-.7-.58-1.284-1.105-1.683-.595-.454-1.383-.673-2.38-.61a.653.653 0 01-.632-.371c-.314-.665-.772-1.141-1.343-1.436a3.288 3.288 0 00-1.772-.332c-1.245.099-2.343.801-2.67 1.686a.652.652 0 01-.61.425c-1.067.002-1.893.252-2.497.703-.522.39-.878.935-1.066 1.588a4.07 4.07 0 00-.068 1.886c.112.558.331 1.02.582 1.269l.008.007c.212.207.257.53.109.785-.36.622-.629 1.549-.673 2.44-.05 1.018.186 1.902.719 2.536l.016.019a.643.643 0 01.095.69c-.576 1.236-.753 2.252-.562 3.052a.652.652 0 01-1.269.298c-.243-1.018-.078-2.184.473-3.498l.014-.035-.008-.012a4.339 4.339 0 01-.598-1.309l-.005-.019a5.764 5.764 0 01-.177-1.785c.044-.91.278-1.842.622-2.59l.012-.026-.002-.002c-.293-.418-.51-.953-.63-1.545l-.005-.024a5.352 5.352 0 01.093-2.49c.262-.915.777-1.701 1.536-2.269.06-.045.123-.09.186-.132-.159-1.493-.119-2.73.112-3.67.127-.518.314-.95.562-1.287.27-.368.614-.622 1.015-.737.266-.076.54-.059.797.042zm4.116 9.09c.936 0 1.8.313 2.446.855.63.527 1.005 1.235 1.005 1.94 0 .888-.406 1.58-1.133 2.022-.62.375-1.451.557-2.403.557-1.009 0-1.871-.259-2.493-.734-.617-.47-.963-1.13-.963-1.845 0-.707.398-1.417 1.056-1.946.668-.537 1.55-.849 2.485-.849zm0 .896a3.07 3.07 0 00-1.916.65c-.461.37-.722.835-.722 1.25 0 .428.21.829.61 1.134.455.347 1.124.548 1.943.548.799 0 1.473-.147 1.932-.426.463-.28.7-.686.7-1.257 0-.423-.246-.89-.683-1.256-.484-.405-1.14-.643-1.864-.643zm.662 1.21l.004.004c.12.151.095.37-.056.49l-.292.23v.446a.375.375 0 01-.376.373.375.375 0 01-.376-.373v-.46l-.271-.218a.347.347 0 01-.052-.49.353.353 0 01.494-.051l.215.172.22-.174a.353.353 0 01.49.051zm-5.04-1.919c.478 0 .867.39.867.871a.87.87 0 01-.868.871.87.87 0 01-.867-.87.87.87 0 01.867-.872zm8.706 0c.48 0 .868.39.868.871a.87.87 0 01-.868.871.87.87 0 01-.867-.87.87.87 0 01.867-.872zM7.44 2.3l-.003.002a.659.659 0 00-.285.238l-.005.006c-.138.189-.258.467-.348.832-.17.692-.216 1.631-.124 2.782.43-.128.899-.208 1.404-.237l.01-.001.019-.034c.046-.082.095-.161.148-.239.123-.771.022-1.692-.253-2.444-.134-.364-.297-.65-.453-.813a.628.628 0 00-.107-.09L7.44 2.3zm9.174.04l-.002.001a.628.628 0 00-.107.09c-.156.163-.32.45-.453.814-.29.794-.387 1.776-.23 2.572l.058.097.008.014h.03a5.184 5.184 0 011.466.212c.086-1.124.038-2.043-.128-2.722-.09-.365-.21-.643-.349-.832l-.004-.006a.659.659 0 00-.285-.239h-.004z"></path>',
    lmstudio: '<path d="M2.84 2a1.273 1.273 0 100 2.547h14.107a1.273 1.273 0 100-2.547H2.84zM7.935 5.33a1.273 1.273 0 000 2.548H22.04a1.274 1.274 0 000-2.547H7.935zM3.624 9.935c0-.704.57-1.274 1.274-1.274h14.106a1.274 1.274 0 010 2.547H4.898c-.703 0-1.274-.57-1.274-1.273zM1.273 12.188a1.273 1.273 0 100 2.547H15.38a1.274 1.274 0 000-2.547H1.273zM3.624 16.792c0-.704.57-1.274 1.274-1.274h14.106a1.273 1.273 0 110 2.547H4.898c-.703 0-1.274-.57-1.274-1.273zM13.029 18.849a1.273 1.273 0 100 2.547h9.698a1.273 1.273 0 100-2.547h-9.698z" fill-opacity=".3"></path><path d="M2.84 2a1.273 1.273 0 100 2.547h10.287a1.274 1.274 0 000-2.547H2.84zM7.935 5.33a1.273 1.273 0 000 2.548H18.22a1.274 1.274 0 000-2.547H7.935zM3.624 9.935c0-.704.57-1.274 1.274-1.274h10.286a1.273 1.273 0 010 2.547H4.898c-.703 0-1.274-.57-1.274-1.273zM1.273 12.188a1.273 1.273 0 100 2.547H11.56a1.274 1.274 0 000-2.547H1.273zM3.624 16.792c0-.704.57-1.274 1.274-1.274h10.286a1.273 1.273 0 110 2.547H4.898c-.703 0-1.274-.57-1.274-1.273zM13.029 18.849a1.273 1.273 0 100 2.547h5.78a1.273 1.273 0 100-2.547h-5.78z"></path>',
    meta: '<path d="M6.897 4h-.024l-.031 2.615h.022c1.715 0 3.046 1.357 5.94 6.246l.175.297.012.02 1.62-2.438-.012-.019a48.763 48.763 0 00-1.098-1.716 28.01 28.01 0 00-1.175-1.629C10.413 4.932 8.812 4 6.896 4z" fill="url(#pm-meta-eta0R0)"></path><path d="M6.873 4C4.95 4.01 3.247 5.258 2.02 7.17a4.352 4.352 0 00-.01.017l2.254 1.231.011-.017c.718-1.083 1.61-1.774 2.568-1.785h.021L6.896 4h-.023z" fill="url(#pm-meta-eta1R0)"></path><path d="M2.019 7.17l-.011.017C1.2 8.447.598 9.995.274 11.664l-.005.022 2.534.6.004-.022c.27-1.467.786-2.828 1.456-3.845l.011-.017L2.02 7.17z" fill="url(#pm-meta-eta2R0)"></path><path d="M2.807 12.264l-2.533-.6-.005.022c-.177.918-.267 1.851-.269 2.786v.023l2.598.233v-.023a12.591 12.591 0 01.21-2.44z" fill="url(#pm-meta-eta3R0)"></path><path d="M2.677 15.537a5.462 5.462 0 01-.079-.813v-.022L0 14.468v.024a8.89 8.89 0 00.146 1.652l2.535-.585a4.106 4.106 0 01-.004-.022z" fill="url(#pm-meta-eta4R0)"></path><path d="M3.27 16.89c-.284-.31-.484-.756-.589-1.328l-.004-.021-2.535.585.004.021c.192 1.01.568 1.85 1.106 2.487l.014.017 2.018-1.745a2.106 2.106 0 01-.015-.016z" fill="url(#pm-meta-eta5R0)"></path><path d="M10.78 9.654c-1.528 2.35-2.454 3.825-2.454 3.825-2.035 3.2-2.739 3.917-3.871 3.917a1.545 1.545 0 01-1.186-.508l-2.017 1.744.014.017C2.01 19.518 3.058 20 4.356 20c1.963 0 3.374-.928 5.884-5.33l1.766-3.13a41.283 41.283 0 00-1.227-1.886z" fill="#0082FB"></path><path d="M13.502 5.946l-.016.016c-.4.43-.786.908-1.16 1.416.378.483.768 1.024 1.175 1.63.48-.743.928-1.345 1.367-1.807l.016-.016-1.382-1.24z" fill="url(#pm-meta-eta6R0)"></path><path d="M20.918 5.713C19.853 4.633 18.583 4 17.225 4c-1.432 0-2.637.787-3.723 1.944l-.016.016 1.382 1.24.016-.017c.715-.747 1.408-1.12 2.176-1.12.826 0 1.6.39 2.27 1.075l.015.016 1.589-1.425-.016-.016z" fill="#0082FB"></path><path d="M23.998 14.125c-.06-3.467-1.27-6.566-3.064-8.396l-.016-.016-1.588 1.424.015.016c1.35 1.392 2.277 3.98 2.361 6.971v.023h2.292v-.022z" fill="url(#pm-meta-eta7R0)"></path><path d="M23.998 14.15v-.023h-2.292v.022c.004.14.006.282.006.424 0 .815-.121 1.474-.368 1.95l-.011.022 1.708 1.782.013-.02c.62-.96.946-2.293.946-3.91 0-.083 0-.165-.002-.247z" fill="url(#pm-meta-eta8R0)"></path><path d="M21.344 16.52l-.011.02c-.214.402-.519.67-.917.787l.778 2.462a3.493 3.493 0 00.438-.182 3.558 3.558 0 001.366-1.218l.044-.065.012-.02-1.71-1.784z" fill="url(#pm-meta-eta9R0)"></path><path d="M19.92 17.393c-.262 0-.492-.039-.718-.14l-.798 2.522c.449.153.927.222 1.46.222.492 0 .943-.073 1.352-.215l-.78-2.462c-.167.05-.341.075-.517.073z" fill="url(#pm-meta-ta10R0)"></path><path d="M18.323 16.534l-.014-.017-1.836 1.914.016.017c.637.682 1.246 1.105 1.937 1.337l.797-2.52c-.291-.125-.573-.353-.9-.731z" fill="url(#pm-meta-ta11R0)"></path><path d="M18.309 16.515c-.55-.642-1.232-1.712-2.303-3.44l-1.396-2.336-.011-.02-1.62 2.438.012.02.989 1.668c.959 1.61 1.74 2.774 2.493 3.585l.016.016 1.834-1.914a2.353 2.353 0 01-.014-.017z" fill="url(#pm-meta-ta12R0)"></path><defs><linearGradient id="pm-meta-eta0R0" x1="75.897%" x2="26.312%" y1="89.199%" y2="12.194%"><stop offset=".06%" stop-color="#0867DF"></stop><stop offset="45.39%" stop-color="#0668E1"></stop><stop offset="85.91%" stop-color="#0064E0"></stop></linearGradient><linearGradient id="pm-meta-eta1R0" x1="21.67%" x2="97.068%" y1="75.874%" y2="23.985%"><stop offset="13.23%" stop-color="#0064DF"></stop><stop offset="99.88%" stop-color="#0064E0"></stop></linearGradient><linearGradient id="pm-meta-eta2R0" x1="38.263%" x2="60.895%" y1="89.127%" y2="16.131%"><stop offset="1.47%" stop-color="#0072EC"></stop><stop offset="68.81%" stop-color="#0064DF"></stop></linearGradient><linearGradient id="pm-meta-eta3R0" x1="47.032%" x2="52.15%" y1="90.19%" y2="15.745%"><stop offset="7.31%" stop-color="#007CF6"></stop><stop offset="99.43%" stop-color="#0072EC"></stop></linearGradient><linearGradient id="pm-meta-eta4R0" x1="52.155%" x2="47.591%" y1="58.301%" y2="37.004%"><stop offset="7.31%" stop-color="#007FF9"></stop><stop offset="100%" stop-color="#007CF6"></stop></linearGradient><linearGradient id="pm-meta-eta5R0" x1="37.689%" x2="61.961%" y1="12.502%" y2="63.624%"><stop offset="7.31%" stop-color="#007FF9"></stop><stop offset="100%" stop-color="#0082FB"></stop></linearGradient><linearGradient id="pm-meta-eta6R0" x1="34.808%" x2="62.313%" y1="68.859%" y2="23.174%"><stop offset="27.99%" stop-color="#007FF8"></stop><stop offset="91.41%" stop-color="#0082FB"></stop></linearGradient><linearGradient id="pm-meta-eta7R0" x1="43.762%" x2="57.602%" y1="6.235%" y2="98.514%"><stop offset="0%" stop-color="#0082FB"></stop><stop offset="99.95%" stop-color="#0081FA"></stop></linearGradient><linearGradient id="pm-meta-eta8R0" x1="60.055%" x2="39.88%" y1="4.661%" y2="69.077%"><stop offset="6.19%" stop-color="#0081FA"></stop><stop offset="100%" stop-color="#0080F9"></stop></linearGradient><linearGradient id="pm-meta-eta9R0" x1="30.282%" x2="61.081%" y1="59.32%" y2="33.244%"><stop offset="0%" stop-color="#027AF3"></stop><stop offset="100%" stop-color="#0080F9"></stop></linearGradient><linearGradient id="pm-meta-ta10R0" x1="20.433%" x2="82.112%" y1="50.001%" y2="50.001%"><stop offset="0%" stop-color="#0377EF"></stop><stop offset="99.94%" stop-color="#0279F1"></stop></linearGradient><linearGradient id="pm-meta-ta11R0" x1="40.303%" x2="72.394%" y1="35.298%" y2="57.811%"><stop offset=".19%" stop-color="#0471E9"></stop><stop offset="100%" stop-color="#0377EF"></stop></linearGradient><linearGradient id="pm-meta-ta12R0" x1="32.254%" x2="68.003%" y1="19.719%" y2="84.908%"><stop offset="27.65%" stop-color="#0867DF"></stop><stop offset="100%" stop-color="#0471E9"></stop></linearGradient></defs>',
    qwen: '<path d="M12.604 1.34c.393.69.784 1.382 1.174 2.075a.18.18 0 00.157.091h5.552c.174 0 .322.11.446.327l1.454 2.57c.19.337.24.478.024.837-.26.43-.513.864-.76 1.3l-.367.658c-.106.196-.223.28-.04.512l2.652 4.637c.172.301.111.494-.043.77-.437.785-.882 1.564-1.335 2.34-.159.272-.352.375-.68.37-.777-.016-1.552-.01-2.327.016a.099.099 0 00-.081.05 575.097 575.097 0 01-2.705 4.74c-.169.293-.38.363-.725.364-.997.003-2.002.004-3.017.002a.537.537 0 01-.465-.271l-1.335-2.323a.09.09 0 00-.083-.049H4.982c-.285.03-.553-.001-.805-.092l-1.603-2.77a.543.543 0 01-.002-.54l1.207-2.12a.198.198 0 000-.197 550.951 550.951 0 01-1.875-3.272l-.79-1.395c-.16-.31-.173-.496.095-.965.465-.813.927-1.625 1.387-2.436.132-.234.304-.334.584-.335a338.3 338.3 0 012.589-.001.124.124 0 00.107-.063l2.806-4.895a.488.488 0 01.422-.246c.524-.001 1.053 0 1.583-.006L11.704 1c.341-.003.724.032.9.34zm-3.432.403a.06.06 0 00-.052.03L6.254 6.788a.157.157 0 01-.135.078H3.253c-.056 0-.07.025-.041.074l5.81 10.156c.025.042.013.062-.034.063l-2.795.015a.218.218 0 00-.2.116l-1.32 2.31c-.044.078-.021.118.068.118l5.716.008c.046 0 .08.02.104.061l1.403 2.454c.046.081.092.082.139 0l5.006-8.76.783-1.382a.055.055 0 01.096 0l1.424 2.53a.122.122 0 00.107.062l2.763-.02a.04.04 0 00.035-.02.041.041 0 000-.04l-2.9-5.086a.108.108 0 010-.113l.293-.507 1.12-1.977c.024-.041.012-.062-.035-.062H9.2c-.059 0-.073-.026-.043-.077l1.434-2.505a.107.107 0 000-.114L9.225 1.774a.06.06 0 00-.053-.031zm6.29 8.02c.046 0 .058.02.034.06l-.832 1.465-2.613 4.585a.056.056 0 01-.05.029.058.058 0 01-.05-.029L8.498 9.841c-.02-.034-.01-.052.028-.054l.216-.012 6.722-.012z" fill="url(#pm-qwen-qwenR0)" fill-rule="nonzero"></path><defs><linearGradient id="pm-qwen-qwenR0" x1="0%" x2="100%" y1="0%" y2="0%"><stop offset="0%" stop-color="#6336E7" stop-opacity=".84"></stop><stop offset="100%" stop-color="#6F69F7" stop-opacity=".84"></stop></linearGradient></defs>',
    gemma: '<defs><linearGradient id="pm-gemma-emmaR0" x1="24.419%" x2="75.194%" y1="75.581%" y2="25.194%"><stop offset="0%" stop-color="#446EFF"></stop><stop offset="36.661%" stop-color="#2E96FF"></stop><stop offset="83.221%" stop-color="#B1C5FF"></stop></linearGradient></defs><path d="M12.34 5.953a8.233 8.233 0 01-.247-1.125V3.72a8.25 8.25 0 015.562 2.232H12.34zm-.69 0c.113-.373.199-.755.257-1.145V3.72a8.25 8.25 0 00-5.562 2.232h5.304zm-5.433.187h5.373a7.98 7.98 0 01-.267.696 8.41 8.41 0 01-1.76 2.65L6.216 6.14zm-.264-.187H2.977v.187h2.915a8.436 8.436 0 00-2.357 5.767H0v.186h3.535a8.436 8.436 0 002.357 5.767H2.977v.186h2.976v2.977h.187v-2.915a8.436 8.436 0 005.767 2.357V24h.186v-3.535a8.436 8.436 0 005.767-2.357v2.915h.186v-2.977h2.977v-.186h-2.915a8.436 8.436 0 002.357-5.767H24v-.186h-3.535a8.436 8.436 0 00-2.357-5.767h2.915v-.187h-2.977V2.977h-.186v2.915a8.436 8.436 0 00-5.767-2.357V0h-.186v3.535A8.436 8.436 0 006.14 5.892V2.977h-.187v2.976zm6.14 14.326a8.25 8.25 0 005.562-2.233H12.34c-.108.367-.19.743-.247 1.126v1.107zm-.186-1.087a8.015 8.015 0 00-.258-1.146H6.345a8.25 8.25 0 005.562 2.233v-1.087zm-8.186-7.285h1.107a8.23 8.23 0 001.125-.247V6.345a8.25 8.25 0 00-2.232 5.562zm1.087.186H3.72a8.25 8.25 0 002.232 5.562v-5.304a8.012 8.012 0 00-1.145-.258zm15.47-.186a8.25 8.25 0 00-2.232-5.562v5.315c.367.108.743.19 1.126.247h1.107zm-1.086.186c-.39.058-.772.144-1.146.258v5.304a8.25 8.25 0 002.233-5.562h-1.087zm-1.332 5.69V12.41a7.97 7.97 0 00-.696.267 8.409 8.409 0 00-2.65 1.76l3.346 3.346zm0-6.18v-5.45l-.012-.013h-5.451c.076.235.162.468.26.696a8.698 8.698 0 001.819 2.688 8.698 8.698 0 002.688 1.82c.228.097.46.183.696.259zM6.14 17.848V12.41c.235.078.468.167.696.267a8.403 8.403 0 012.688 1.799 8.404 8.404 0 011.799 2.688c.1.228.19.46.267.696H6.152l-.012-.012zm0-6.245V6.326l3.29 3.29a8.716 8.716 0 01-2.594 1.728 8.14 8.14 0 01-.696.259zm6.257 6.257h5.277l-3.29-3.29a8.716 8.716 0 00-1.728 2.594 8.135 8.135 0 00-.259.696zm-2.347-7.81a9.435 9.435 0 01-2.88 1.96 9.14 9.14 0 012.88 1.94 9.14 9.14 0 011.94 2.88 9.435 9.435 0 011.96-2.88 9.14 9.14 0 012.88-1.94 9.435 9.435 0 01-2.88-1.96 9.434 9.434 0 01-1.96-2.88 9.14 9.14 0 01-1.94 2.88z" fill="url(#pm-gemma-emmaR0)" fill-rule="evenodd"></path>',
  };

  /** The sprite. Injected once, hidden, and referenced by every mark. */
  function brandSprite() {
    var out = '<svg class="pmark-sprite" aria-hidden="true" focusable="false">';
    for (var k in BRAND_SYMBOLS) {
      out += '<symbol id="pm-' + k + '" viewBox="0 0 24 24">' + BRAND_SYMBOLS[k] + "</symbol>";
    }
    return out + "</svg>";
  }

  /** A provider's mark, or nothing when the provider has none. Returning empty
      rather than a placeholder is deliberate: a generic glyph standing in for a
      brand reads as a brand nobody recognises. */
  function brand(name, cls) {
    var key = String(name || "").toLowerCase().replace(/[^a-z]/g, "");
    var map = {
      groq: "groq", openai: "openai", anthropic: "anthropic",
      googlegemini: "gemini", gemini: "gemini", mistral: "mistral",
      xai: "xai", openrouter: "openrouter",
      awsbedrock: "bedrock", azureopenai: "azure", gcpvertexai: "vertexai",
      ollama: "ollama", lmstudio: "lmstudio",
      llama: "meta", qwen: "qwen", gemma: "gemma", llamacpp: "meta",
      yourserver: null
    };
    var id = map[key];
    if (id === undefined) id = BRAND_SYMBOLS[key] ? key : null;
    if (!id) return "";
    var tint = BRAND_TINTS[id];
    return '<svg class="pmark ' + (cls || "") + '"' +
      (tint ? ' style="color:' + tint + '"' : "") +
      ' aria-hidden="true"><use href="#pm-' + id + '"/></svg>';
  }

  function docLink(label) {
    return ' <a class="link" href="#" onclick="return false">' + t(label) + "</a>";
  }

  /** A connectable provider: identity, what it does, and the state of the
      connection — which is either a button or the accounts it produced.

      Not a card of rows. A row is a label and a control, and the control here
      changes what the block contains: connected, it grows a list; unconnected,
      it is one sentence and one button. Connected accounts are children of the
      provider, indented under it, because they are instances of it and not
      three more providers. */
  function conn(o) {
    var accounts = (o.accounts || []).map(function (a) {
      return '<div class="conn-account">' + icon("user") +
        "<span>" + t(a) + "</span>" +
        iconBtn("Disconnect " + a, "x", { tone: "danger" }) + "</div>";
    }).join("");
    var on = (o.accounts || []).length > 0;
    return '<div class="conn"' + (on ? " data-on" : "") + ">" +
      '<div class="conn-top">' +
      '<span class="conn-tile">' + icon(o.icon) + "</span>" +
      '<span class="conn-text"><b>' + t(o.name) + "</b>" +
      "<span>" + p(o.desc) + "</span></span>" +
      '<span class="conn-ctl">' +
      (on ? badge("Connected", "success") : o.state ? badge(o.state.text, o.state.tone) : "") +
      (on ? "" : o.action || "") + "</span></div>" +
      (accounts ? '<div class="conn-accounts">' + accounts +
        '<div class="conn-add">' + (o.action || "") + "</div></div>" : "") +
      "</div>";
  }

  /* ── Pane: a list column and its detail, as one surface ────────────────
     Not two cards side by side. The column is part of the window; what is
     selected in it governs everything right of the hairline. */

  /** `listBody` replaces the default head/search/scroll when the rail carries
      more than one level — Notes puts folders above the note list, and the
      folder selection governs the list the way the list governs the detail.
      `overlay` is a panel that covers part of the detail (the AI chat). */
  function pane(o) {
    return '<div class="pane">' +
      '<div class="pane-list">' +
      (o.listBody ||
        ('<div class="pane-list-head"><b>' + t(o.listTitle) + "</b>" +
          (o.count != null ? '<span class="count">' + t(o.count) + "</span>" : "") + "</div>" +
          (o.search ? '<div class="pane-search">' + field("", { placeholder: o.search }) + "</div>" : "") +
          '<div class="pane-scroll">' +
          (o.groups
            ? o.groups.map(function (g) {
              return '<div class="pane-group"><label>' + t(g.label) + "</label>" +
                g.rows.map(paneRow).join("") + "</div>";
            }).join("")
            : o.rows.map(paneRow).join("")) +
          "</div>")) +
      (o.foot ? '<div class="pane-list-foot">' + o.foot + "</div>" : "") +
      (o.path
        ? '<button class="pane-path" data-go="notesettings">' + icon("folder") +
        "<span>" + t(o.path) + '</span><span class="chg">Change</span></button>'
        : "") +
      "</div>" +
      /* THE HEAD IS TWO ROWS WHEN IT CARRIES TABS, and it was one until
         2026-08-03. Measured at the sheet's width: the fourth tab took the tab
         bar to 349 px against 387 px of head, with 245 px of buttons still to
         place — the title wrapped to two lines and the buttons dropped under
         the tabs, unaligned. Squeezing it back was available and wrong: the
         way to fit was to drop the Linked tab or unlabel Ask and Actions, and
         both are content decisions being made by a layout.

         So the identity and the windows share the first row, the views get the
         second, and the head grows by 30 px once. It also reads better: what
         this object IS sits above how you are looking at it. */
      '<div class="pane-detail">' +
      '<div class="pane-detail-head"' + (o.tabs ? " data-two" : "") + ">" +
      '<div class="pane-detail-row"><div class="grow"><h2>' + t(o.title) + "</h2>" +
      (o.desc ? "<p>" + p(o.desc) + "</p>" : "") + "</div>" +
      (o.actions ? '<div class="rowflex">' + o.actions + "</div>" : "") + "</div>" +
      (o.tabs ? '<div class="pane-detail-tabs">' + o.tabs + "</div>" : "") + "</div>" +
      /* The body scrolls; the floating bar and the chat panel do not. They are
         positioned against this wrapper rather than against the scroller, or
         they would scroll away with the content, and they sit below the detail
         head rather than over it, so switching tabs stays reachable with the
         panel open. */
      '<div class="pane-detail-main"' + (o.overlay ? " data-panel" : "") + ">" +
      '<div class="pane-detail-body">' + o.body + "</div>" +
      (o.float || "") + (o.overlay || "") +
      "</div></div></div>";
  }

  /** A folder is a directory. See the note on `.folders` in demo.css: this is a
      promise the surface makes that the runtime has to keep. */
  function folderRow(f) {
    return '<button class="folder-row" aria-current="' + (f.on ? "true" : "false") + '">' +
      icon(f.on ? "folderOpen" : "folder") +
      '<span class="fname">' + t(f.name) + "</span>" +
      '<span class="n">' + t(f.n) + "</span></button>";
  }

  function paneSecHead(label, addLabel) {
    return '<div class="pane-sec-head"><b>' + t(label) + "</b>" +
      '<button class="add" aria-label="' + t(addLabel) + '">' + icon("plus") + "</button></div>";
  }

  /** A state badge goes on the SUB-line, not beside the title. The list column
      is 236 px wide; a badge next to the title left about ninety pixels for the
      name, so "Planning — Q3 scope" rendered as "Planning — …". The sub-line is
      already the row's metadata and has room. */
  function paneRow(r) {
    return '<button class="pane-row" aria-current="' + (r.on ? "true" : "false") + '">' +
      (r.icon ? icon(r.icon) : "") +
      '<span class="pane-row-text">' +
      '<span class="pane-row-top"><b>' + t(r.title) + "</b>" +
      (r.when ? '<span class="when">' + t(r.when) + "</span>" : "") + "</span>" +
      (r.sub || r.badge
        ? '<span class="pane-row-meta">' +
        (r.badge ? badge(r.badge.text, r.badge.tone) : "") +
        (r.sub ? "<span>" + t(r.sub) + "</span>" : "") + "</span>"
        : "") + "</span>" +
      (r.pinned ? '<span class="pin">' + icon("pin") + "</span>" : "") + "</button>";
  }

  /* ── The note, and the two things you do to it ─────────────────────────── */

  function noteTabs(screen, items) {
    var active = state.sub[screen] || items[0].id;
    return '<div class="note-tabs" role="tablist" data-subtabs="' + screen + '">' +
      items.map(function (i) {
        return '<button role="tab" aria-selected="' + (i.id === active ? "true" : "false") +
          '" data-sub="' + esc(i.id) + '">' +
          (i.icon ? icon(i.icon) : "") + t(i.id) + "</button>";
      }).join("") + "</div>";
  }

  /** The common action, plus the menu of the actions it belongs to. A select
      would make you choose before you can act; this way the default is one
      click and the alternatives are two. */
  function floatbar(o) {
    return '<div class="floatbar">' +
      '<button class="mic-btn"' + (o.live ? " data-live" : "") + ' aria-label="Dictate into this note">' +
      icon("mic") + "</button>" +
      '<span class="split-btn">' +
      (o.menu ? menu(o.menu) : "") +
      '<button class="btn" data-v="primary">' + icon("sparkle") + t(o.action) + "</button>" +
      '<button class="btn" data-v="primary" aria-label="Other actions">' +
      icon(o.menu ? "caretDown" : "caretUp") + "</button>" +
      "</span></div>";
  }

  /* The same boundary rule the actions window uses (§11.30): entries from two
     categories, one control, a rule between them. Here it also carries a label,
     because the menu is where the split is met first — the window is opened by
     people who are editing, the menu by people who are running. */
  function menu(items) {
    var ordinary = items.filter(function (m) { return m.kind !== "desk"; });
    var deskish = items.filter(function (m) { return m.kind === "desk"; });
    function entry(m) {
      return '<button role="menuitem" aria-current="' + (m.on ? "true" : "false") + '">' +
        icon(m.icon || "sparkle") +
        '<span class="mtext"><b>' + t(m.label) + "</b><span>" + t(m.hint) + "</span></span></button>";
    }
    return '<div class="menu" role="menu">' + ordinary.map(entry).join("") +
      (deskish.length
        ? '<div class="menu-rule"><span>' + t("Runs on " + DESK) + "</span></div>" +
        deskish.map(entry).join("")
        : "") + "</div>";
  }

  function chips(items) {
    return '<div class="chips">' + items.map(function (c) {
      return '<span class="chip-x" data-origin="' + (c.origin || "added") + '">' + t(c.term) +
        "<button aria-label=\"Remove " + t(c.term) + '">' + icon("x") + "</button></span>";
    }).join("") + "</div>";
  }

  function cmd(text) {
    return '<div class="cmd"><code>' + t(text) + "</code>" +
      btn("Copy", "ghost", { icon: "copy" }) + "</div>";
  }

  /** A SPEAKER, AND HOW SURE THE PRODUCT IS OF THE NAME — ADR 0047.

      Four statuses, borrowed whole from the donor's `speakerAssignmentPolicy`
      because it is the part of diarization that is a product decision rather
      than a model:

        provisional  a cluster with no name yet — `Speaker 2`
        suggested    a name proposed from the calendar or a saved voice profile
        confirmed    the model matched a voice it has seen labelled before
        locked       you said so, and re-clustering may not overwrite it

      `locked` is the one that has to exist. Clustering runs again when the
      meeting ends, over the whole recording rather than the live window, and
      it will happily renumber everybody. Without a status that survives that
      pass, every name the user typed during the call is a name that changes
      after it — which is worse than never having offered names.

      The chip states its source in as many words, because "Sarah Chen" from
      the attendee list and "Sarah Chen" that you typed are different claims. */
  function whoChip(o) {
    var how = {
      mic: "from your microphone",
      calendar: "suggested from the invite",
      cluster: "voice cluster, unnamed",
      profile: "matched a saved voice"
    }[o.how] || o.how;
    return '<span class="who-chip" data-status="' + esc(o.status) + '">' +
      '<span class="who-dot"></span>' +
      "<b>" + t(o.name) + "</b>" +
      '<span class="who-how">' + t(how) + "</span></span>";
  }

  /** A derived list whose entries can carry one action each. `enh` renders the
      same shape without the column, and most entries have nothing to do — an
      action on every row would make the two that matter invisible. */
  function enhActs(title, items) {
    return '<div class="enh"><h4>' + t(title) + "</h4><ul>" +
      items.map(function (i) {
        return '<li class="enh-act"><span>' + i.text + "</span>" +
          (i.act ? '<span class="enh-act-btn">' + i.act + "</span>" : "") + "</li>";
      }).join("") + "</ul></div>";
  }

  /** One group of the Linked tab. Deliberately a list and deliberately not a
      graph (§11.42): a graph draws that things connect, and the question is
      what connects. */
  function linkGroup(title, items) {
    return '<div class="linkgrp"><h4>' + t(title) + "</h4>" +
      items.map(function (i) {
        return '<button class="link-row">' + icon(i.icon) +
          '<span class="link-text"><b>' + t(i.name) + "</b>" +
          "<span>" + t(i.meta) + "</span></span>" +
          '<span class="link-go">' + icon("chevron") + "</span></button>";
      }).join("") + "</div>";
  }

  /** Home's attention line. Rendered only when something is actually owed —
      a standing banner reporting that all is well is furniture. */
  function strip(o) {
    return '<div class="strip"><span class="strip-tile">' + icon(o.icon || "alert") + "</span>" +
      '<div class="strip-text"><b>' + t(o.title) + "</b><span>" + p(o.text) + "</span></div>" +
      '<div class="rowflex">' + o.actions + "</div></div>";
  }

  /** ONE ROW OF THE DECISION INBOX — ADR 0044, §11.40.

      The strip above is the same shape for one item. This is the shape for a
      list of them, and it carries one column the strip never needed:
      `cost`, which answers **what happens if I do nothing**.

      That column is the entire difference between a decision inbox and a
      to-do list. Three things reach this list and they behave nothing alike
      when ignored: a desk question blocks a process until its answer budget
      expires, a question raised out of a meeting sits in the note forever, and
      a transcript on the clipboard survives exactly until the next copy. A
      list that draws them identically is telling the user they are the same
      kind of debt, and only one of them has somebody on the other end.

      So `cost` is not a timestamp and not a status. It is a sentence about the
      future, it is what the list sorts on, and `urgent` is set by whether that
      sentence names a deadline — never by which surface raised the item.

      NO COLOURED EDGE RULE. Emphasis is the ground plus the icon tile, which
      is the idiom §11.17 settled and the lane rows already use.

      THE COST IS A LINE, NOT A COLUMN, and the first build had it as a column.
      Measured in the browser at the sheet's 640 px: a 190 px cost column plus
      two answer buttons left about 200 px for the title, and all three titles
      truncated — "Should I update t…". That is §11.28 exactly, one screen
      later, and the answer there was to stop spending a row's width on things
      that are not its sentence. The answer buttons cannot become icons (they
      are the words the agent offered), so the cost moves down instead. Same
      information, three lines, and the title gets the measure it needs. */
  function owed(o) {
    return '<div class="owed"' + (o.urgent ? " data-urgent" : "") + ">" +
      '<span class="owed-tile">' + icon(o.icon || "pending") + "</span>" +
      '<div class="owed-text"><b>' + t(o.title) + "</b>" +
      '<span class="owed-from">' + p(o.from) + "</span>" +
      '<span class="owed-cost">' + icon(o.urgent ? "clock" : "minus") +
      "<span>" + p(o.cost) + "</span></span></div>" +
      '<div class="owed-acts rowflex">' + o.actions + "</div></div>";
  }

  /* ===========================================================================
     NAVIGATION MODEL
     =========================================================================== */

  var NAV = [
    {
      group: "System", items: [
        { id: "ds", label: "Design System", icon: "tokens", surface: "system" },
      ]
    },
    {
      /* Notes and Upload became one entry on 2026-08-03 (ADR 0045, §11.41).
         They were two places that produced the same object by two routes, and
         a user arriving with an hour of audio had to know which one WordScript
         filed it under. A meeting, a dictation, an uploaded file, a pasted
         link and a calendar entry that has not happened yet are one type with
         one detail view; how it got here is a field on it.

         The workspace drops from 5 entries to 4, which is the test the
         abstraction had to pass: a real one removes an entry, a false one adds
         a screen that explains the others. */
      group: "Workspace", items: [
        { id: "home", label: "Home", icon: "home", surface: "workspace" },
        { id: "history", label: "History", icon: "history", surface: "workspace" },
        { id: "profiles", label: "Profiles", icon: "profiles", surface: "workspace" },
        { id: "context", label: "Context", icon: "notes", surface: "workspace", tag: "prev" },
      ]
    },
    {
      /* Integrations moved here from the workspace on 2026-08-03. It is an
         endpoint, a token, a port file and an install command — nothing on it
         is authored, and §4.3.1 says a thing you *set* belongs in settings. It
         also sits next to the screen it shares a subject with: Agents is the
         other half of the same MCP question (§10.1). Correcting §4.2's table,
         not overruling it — the table sorts by where a control was found, and
         §11.7 already established that has to give way to what a value is. */
      group: "Settings", items: [
        { id: "general", label: "General", icon: "general", surface: "settings" },
        { id: "hotkeys", label: "Hotkeys", icon: "keyboard", surface: "settings" },
        { id: "notesettings", label: "Notes & Meetings", icon: "notes", surface: "settings", tag: "prev" },
        /* Speech-to-Text and Language Models became one entry on 2026-08-03
           (ADR 0042, §11.34). They were two screens that took the same four
           settings from the same ten providers, and between them a third had
           appeared to hold the credentials they shared. One section, one
           connection, one row per job. Both old ids still resolve. */
        { id: "models", label: "AI Models", icon: "models", surface: "settings" },
        { id: "agents", label: "Agents", icon: "agents", surface: "settings", tag: "prev" },
        { id: "integrations", label: "Integrations", icon: "integrations", surface: "settings", tag: "prev" },
        { id: "delivery", label: "Delivery & Insert", icon: "delivery", surface: "settings" },
        { id: "privacy", label: "Privacy & Data", icon: "privacy", surface: "settings" },
        /* `account` stood here until 2026-08-04. Removed with its screen: an
           entry in this list promises that a decision lives behind it, and
           there is no WordScript account to decide anything about. */
        { id: "diagnostics", label: "Diagnostics", icon: "diagnostics", surface: "settings" },
        { id: "about", label: "About & Updates", icon: "about", surface: "settings" },
      ]
    },
    {
      group: "Previews", items: [
        { id: "onboarding", label: "Onboarding", icon: "wand", surface: "standalone" },
        { id: "meeting", label: "Meeting capture", icon: "users", surface: "standalone" },
        { id: "agentoverlay", label: "Agent overlay", icon: "agents", surface: "standalone" },
        { id: "handoff", label: "Handoff", icon: "handoff", surface: "standalone" },
        { id: "commit", label: "Live preview & commit (withdrawn)", icon: "eye", surface: "standalone" },
        { id: "contextintake", label: "Context · intake", icon: "upload", surface: "workspace" },
        { id: "contextactions", label: "Actions & templates", icon: "template", surface: "workspace" },
        { id: "agents", label: "Agents", icon: "agents", surface: "settings", alias: true },
        { id: "integrations", label: "Integrations", icon: "integrations", surface: "settings", alias: true },
        { id: "notesettings", label: "Notes & Meetings", icon: "notes", surface: "settings", alias: true },
        { id: "context", label: "Context", icon: "notes", surface: "workspace", alias: true },
      ]
    },
  ];

  function findNav(id) {
    for (var g = 0; g < NAV.length; g++) {
      for (var i = 0; i < NAV[g].items.length; i++) {
        if (NAV[g].items[i].id === id) return NAV[g].items[i];
      }
    }
    return NAV[0].items[0];
  }

  /* ===========================================================================
     WORKSPACE SIDEBAR (inside the mock window)
     =========================================================================== */

  /* ELEVENTH PASS — the palette got a door.
     The command palette has worked since the tenth pass and nobody could open
     it: it answered Ctrl+K and Cmd+K and appeared nowhere else, so the only
     way to reach it was to already know it existed. A keyboard shortcut is an
     accelerator for a thing you can see, not a substitute for it, and the
     first report from outside this file was "no idea how to call it up".
     macOS puts the field at the top of the sidebar, above the first group. It
     is not a real input here — clicking it opens the palette, which is where
     the typing actually happens — because two search fields that filter
     different things would be the more expensive answer to the same question.
     The shortcut stays, and is now printed on the control that it accelerates. */
  function navSearch() {
    return '<button class="nav-search" data-cmdk-open>' + icon("search") +
      "<span>" + t("Search") + "</span>" +
      '<kbd>' + (isMac() ? "⌘K" : "Ctrl K") + "</kbd></button>";
  }

  /* The prototype is opened on Linux as often as on macOS and the key it
     prints has to be the one that works on the machine reading it. */
  function isMac() {
    return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
  }

  function workspaceSidebar(active) {
    var items = NAV[1].items;
    /* The actions window and the intake are states of Context, not workspace
       entries of their own, so the sidebar keeps pointing at Context while
       either is open. Intake is the one that used to be an entry: an upload is
       a way to make a context object, and a way is not a place (§11.41). */
    if (active === "contextactions" || active === "contextintake") active = "context";
    return '<nav class="nav">' + brandMark(null) + navSearch() +
      '<div class="nav-group">' + items.map(function (i) {
        return '<button class="nav-row" data-go="' + i.id + '" aria-current="' +
          (i.id === active ? "true" : "false") + '">' + icon(i.icon) + t(i.label) +
          (i.tag ? '<span class="nav-tag">preview</span>' : "") + "</button>";
      }).join("") + "</div>" +
      '<div class="nav-foot">' +
      '<button class="nav-row" data-go="general">' + icon("settings") + "Settings" +
      '<span class="nav-tag">Ctrl+,</span></button>' +
      '<button class="nav-row">' + icon("help") + "Help</button>" +
      profileSwitcher() +
      "</div></nav>";
  }

  /* The active profile decides the recognizer, so the runtime refuses to swap
     it mid-session (`sessions::PROFILE_LOCKED_DURING_SESSION`). The control
     states that before the attempt rather than failing after it — and it is
     one control, not the shipped avatar-row-plus-select underneath. */
  function profileSwitcher() {
    return '<button class="nav-profile"><span class="av">GW</span>' +
      '<span class="who"><b>General writing</b><span>Auto · Insert at cursor</span></span>' +
      '<span class="caret">' + icon("updown") + "</span></button>";
  }

  /* ── Settings, as a modal over the workspace ─────────────────────────────
     Was a second window. §11.22 records why it is a sheet now; the two changes
     that matter here are that it carries no wordmark (the window behind it is
     still WordScript, and still visible) and no "Back to workspace" row —
     closing it IS going back, and Escape and the scrim both do it. The profile
     switcher survives, promoted into the modal header where the context that
     every scope tag refers to is stated once and read from anywhere. */
  function settingsNav(active) {
    var items = NAV[2].items;
    var groups = [
      { name: "App", ids: ["general", "hotkeys", "notesettings"] },
      /* Three AI entries became one on 2026-08-03 (ADR 0042): Speech-to-Text,
         Language Models and the Providers & Keys screen that had grown between
         them are `models`. The group is three. */
      { name: "AI", ids: ["models", "agents", "integrations"] },
      { name: "System", ids: ["delivery", "privacy", "diagnostics", "about"] },
    ];
    return '<nav class="modal-nav">' + navSearch() + groups.map(function (g) {
      return '<div class="nav-group"><h3>' + t(g.name) + "</h3>" +
        g.ids.map(function (id) {
          var i = items.filter(function (x) { return x.id === id; })[0];
          return '<button class="nav-row" data-go="' + i.id + '" aria-current="' +
            (i.id === active ? "true" : "false") + '">' + icon(i.icon) + t(i.label) +
            (i.tag ? '<span class="nav-tag">preview</span>' : "") + "</button>";
        }).join("") + "</div>";
    }).join("") + "</nav>";
  }

  /* `fresh` is false when the sheet was already on screen and only its section
     changed. Without it the whole surface is rebuilt by `render()`, so the
     scrim faded and the sheet flew in AGAIN on every click in its own sidebar
     — the sheet re-announcing its arrival to a user who is already inside it.
     An entrance animation belongs to an entrance. Switching sections is not
     one, and neither is switching a sub-tab within a section. */
  function settingsModal(active, html, layout, fresh) {
    return '<div class="modal-scrim" data-close' + (fresh ? " data-enter" : "") + ">" +
      '<div class="modal-win" role="dialog" aria-modal="true" aria-label="WordScript Settings">' +
      '<header class="modal-head"><h2>' + t("Settings") + "</h2>" +
      '<button class="modal-profile"><span class="av">GW</span>' +
      "<span>General writing</span>" + icon("updown") + "</button>" +
      '<button class="modal-close" data-close aria-label="Close settings">' + icon("x") + "</button>" +
      "</header>" +
      '<div class="modal-body">' + settingsNav(active) +
      '<div class="modal-content" data-layout="' + layout + '">' +
      '<div class="content-inner" data-layout="' + layout + '">' + html +
      "</div></div></div>" +
      '<div class="modal-foot"><span>' + t("Every change applies as you make it.") + "</span>" +
      '<span class="right">' + t("Esc to close") + "</span></div>" +
      "</div></div>";
  }

  function systemSidebar(active) {
    var groups = [
      { name: "System", items: NAV[0].items },
      { name: "Workspace", items: NAV[1].items },
      { name: "Settings", items: NAV[2].items },
      { name: "Previews", items: NAV[3].items },
    ];
    return '<nav class="nav">' + brandMark(null) + navSearch() + groups.map(function (g) {
      return '<div class="nav-group"><h3>' + t(g.name) + "</h3>" +
        g.items.map(function (i) {
          return '<button class="nav-row" data-go="' + i.id + '" aria-current="' +
            (i.id === active && g.name !== "Previews" ? "true" : "false") + '">' +
            icon(i.icon) + t(i.label) +
            (i.alias ? '<span class="nav-tag">' + t(i.surface === "settings" ? "in settings" : "in workspace") + "</span>"
              : i.tag ? '<span class="nav-tag">preview</span>' : "") + "</button>";
        }).join("") + "</div>";
    }).join("") + "</nav>";
  }

  /* ===========================================================================
     SCREENS
     =========================================================================== */

  var SCREENS = {};

  /* ── Design System ──────────────────────────────────────────────────── */

  SCREENS.ds = function () {
    var ds = state.palette === "after";

    var surfaces = ds
      ? [["--bg-sidebar", "#141416", "6.4", "Sidebar, below the window"],
      ["--bg-inset", "#161617", "7.3", "Inputs, wells, code, logs"],
      ["--bg-base", "#1c1c1e", "10.3", "Window"],
      ["--bg-surface", "#2e2e31", "19.0", "Card"],
      ["--bg-elevated", "#3a3a3e", "24.6", "Hover, active, segment thumb"]]
      : [["--sidebar-bg", "#080a0e", "2.7", "Sidebar, below the window"],
      ["--bg-elevated", "#141a20", "8.9", "Secondary surface"],
      ["--bg", "#0a0d11", "3.5", "Window"],
      ["--surface-elevated", "#1c2127", "12.5", "Card"],
      ["--surface-strong", "#28333d", "20.7", "Hover, active"]];

    var contrast = ds
      ? [["--fg", "#f2efe9", "11.80", "ok", "Primary text"],
      ["--fg-dim", "#c2bfb8", "7.37", "ok", "Row hints, descriptions"],
      ["--fg-muted", "#9b9892", "4.71", "ok", "Labels and counts only"],
      ["--accent", "#ff9c2b", "6.47", "ok", "Primary action, selection"],
      ["--success", "#81d6ae", "7.84", "ok", "Validated runtime state"],
      ["--danger", "#ff7a6b", "5.32", "ok", "Errors, destructive"]]
      : [["--fg", "#f4f1ea", "14.36", "ok", "Primary text"],
      ["--fg-dim", "#a4b1bd", "7.41", "ok", "Secondary text"],
      ["--fg-muted", "#707e8b", "3.89", "fail", "Carries every 12 px hint — below AA"],
      ["--accent", "#e68900", "6.13", "ok", "Primary action"],
      ["--green", "#81d6ae", "9.44", "ok", "Validated runtime state"],
      ["--red", "#ff7a6b", "6.40", "ok", "Errors, destructive"]];

    var typeScale = [
      ["--t-hero", "28px / 600", "Home headline only"],
      ["--t-title", "20px / 600", "View title"],
      ["--t-lead", "16px / 600", "Section header"],
      ["--t-body", "14px / 400", "Body, list rows"],
      ["--t-label", "12px / 400", "Row hints, descriptions, meta"],
      ["--t-micro", "11px / 600", "Key caps, counts, group headers — never prose"],
    ];

    return [
      viewTop({ title: "Design System", lead: "The system this prototype is made of. Every value below is live — flip the switches in the rig and this page changes with the rest of the demo." }),

      sec("Surfaces", "One ladder, five steps. The switch moves the whole ladder, not its spacing.",
        '<div class="ramp">' + surfaces.map(function (s) {
          return '<div class="ramp-row" style="background:' + s[1] + '">' +
            '<span class="lbl mono">' + t(s[0]) + "</span>" +
            '<span class="val">' + t(s[1]) + "</span>" +
            "<span>" + t(s[3]) + "</span>" +
            '<span class="lstar">L* ' + t(s[2]) + "</span></div>";
        }).join("") + "</div>" +
        note(ds
          ? "Window to card is 8.7 L* — the same separation as today, seven points higher up the range, where a panel can still show it."
          : "Window to card is 8.9 L*, but a window at L* 3.5 sits inside the range where panel black crush flattens everything above it.",
          ds ? "check" : "alert")
      ),

      sec("Text contrast", "Measured against the card surface. WCAG AA is 4.5:1 for body text.",
        card({
          body: '<div class="spec-scroll"><table class="spec">' +
            "<thead><tr><th>Token</th><th>Value</th><th>On card</th><th>Role</th></tr></thead><tbody>" +
            contrast.map(function (c) {
              return "<tr><td class='mono'>" + t(c[0]) + "</td><td class='n'>" + t(c[1]) + "</td>" +
                '<td class="n ' + (c[3] === "fail" ? "fail" : "pass") + '">' + t(c[2]) + ":1" +
                (c[3] === "fail" ? " ✗" : " ✓") + "</td><td>" + t(c[4]) + "</td></tr>";
            }).join("") + "</tbody></table></div>"
        }) +
        note("--fg-muted measures 3.94:1 on the elevated surface even after the lift, so it is confined to the card plane. That is why rows carrying muted text do not change background on hover — which is also the fix for the hover repaint in section 2.4 P7.", "alert")
      ),

      sec("Type", "One family. Fixed px scale, not fluid — the window is viewed at a consistent size.",
        card({
          body: typeScale.map(function (r) {
            return '<div class="type-row"><span class="tag">' + t(r[0]) + "</span>" +
              '<span style="font-size:var(' + r[0] + ');font-weight:' + (r[1].indexOf("600") > 0 ? 600 : 400) + '">' +
              t(r[2]) + "</span></div>";
          }).join("")
        }) +
        note("Scale kept from DESIGN_SYSTEM.md (12, 14, 16, 20, 28). 11 px is added for key caps and counts and never carries a sentence.")
      ),

      sec("Spacing", "4 px rhythm. The density switch scales card padding and row height, never the rhythm.",
        card({
          body: '<div class="rhythm">' +
            [["s1", 4], ["s2", 8], ["s3", 12], ["s4", 16], ["s5", 20], ["s6", 24], ["s7", 32], ["s8", 40]]
              .map(function (s) {
                return "<div><i style='height:" + s[1] * 1.6 + "px;width:" + Math.max(14, s[1]) + "px'></i>" +
                  s[1] + "</div>";
              }).join("") + "</div>"
        })
      ),

      sec("Elevation", "Declared once. Background carries grouping; a border means the thing accepts input.",
        card({
          rows: [
            row({ label: "Card", hint: "Background step only. No shadow, no border in the proposed palette.", ctl: badge(ds ? "background" : "background + hairline", ds ? "success" : "warning") }),
            row({ label: "Input, select, textarea, log", hint: "Hairline border. This is the one signal that means “you can put something in here”.", ctl: badge("border", "success") }),
            row({ label: "Row divider", hint: "Hairline inside a card, never around it.", ctl: badge("border", "success") }),
            row({ label: "Hover", hint: ds ? "Background only, and only where the row is a target. Cards never repaint on pointer transit." : "Card border lightens over 150 ms as the pointer crosses it.", ctl: badge(ds ? "background" : "border-color 150ms", ds ? "success" : "danger") }),
            row({
              label: "Coloured edge bar",
              hint: "Never. A vertical accent rule down the side of a notice is a web convention that reads as a rendering defect at this scale. Emphasis is the ground plus an icon tile.",
              ctl: badge("forbidden", "danger")
            }),
          ]
        })
      ),

      /* The record of the 2026-08-03 pass. Every row here is a rule that was
         broken somewhere before it was written down, and each names where.
         Without it the next reader re-derives the same three inline paddings
         and the same 17 px radio. */
      sec("Rules this pass added", "Each one was a defect somewhere first.",
        card({
          rows: [
            row({
              label: "A card owns its inset",
              hint: "Padding on all four sides; the first and last child of a row stack drop their own edge padding. Nothing inside a card knows it is at an edge.",
              ctl: badge("was 20 / 13 / 0", "danger")
            }),
            row({
              label: "A control that must look centred is drawn on integers",
              hint: "Even box, whole-pixel border. The radio was 17 px with a 1.5 px border, which has no integer centre and snaps differently on each side.",
              ctl: '<span class="rowflex"><span class="radio"></span>' + badge("16 / 2 / 8", "success") + "</span>"
            }),
            row({
              label: "A stat tile carries a number that changes",
              hint: "And summarises more rows than fit on screen. Otherwise it is a row. Nine tiles left three screens; one honest use remains, above the Upload queue.",
              ctl: badge("1 use left", "success")
            }),
            row({
              label: "The action on a card sits at its foot",
              hint: "As a component, not as a flex row with a padding guessed per screen.",
              ctl: badge("card-foot", "plan")
            }),
            row({
              label: "A check reports a probe",
              hint: "The runtime looked, and this is what it found. Not a bullet — a checkmark beside an argument claims a measurement nobody took.",
              ctl: badge("check-list", "plan")
            }),
            row({
              label: "Muted text never lands on the elevated plane",
              hint: "4.71:1 on the card, 3.94:1 on elevated. The rule was written on this page and broken by the selected pane row, which is elevated by definition.",
              ctl: badge("fixed", "success")
            }),
            row({
              label: "An action zone shrinks once there is a list under it",
              hint: "A dropzone is the whole screen while the screen is empty and a band once it is not. Upload's 460 px column could not hold a row carrying a name, a size, a status and a transcript.",
              ctl: badge("dropzone[data-band]", "plan")
            }),
            row({
              label: "Title, banner and sub-tabs are one masthead",
              hint: "16 px inside it, 32 px below it. As siblings of the content blocks they inherited the block rhythm and drifted apart.",
              ctl: badge("view-top", "plan")
            }),
          ]
        })
      ),

      /* REWRITTEN 2026-08-03. There was no scale — the surface had accumulated
         twelve radius values with no rule about which belonged to what, and
         the aggregate read soft to the point of unseriousness. A tool people
         keep open all day is not a consumer app, and a capsule on every label
         is the fastest way to look like one.

         Four steps, assigned by what a thing IS rather than by how big it is.
         Capsules survive only where the object is physically a capsule. */
      sec("Radius", "Four steps, by what a thing is. Concentric: an inner radius is its outer minus the gap.",
        card({
          rows: [
            row({ label: "Window, sheet", hint: "The outermost object on its layer.", ctl: '<span class="mono muted">' + (ds ? "10px" : "10px") + "</span>" }),
            row({ label: "Card, panel, well", hint: "A grouping surface.", ctl: '<span class="mono muted">' + (ds ? "8px" : "10px") + "</span>" }),
            row({ label: "Button, input, tab bar", hint: "Something you operate.", ctl: '<span class="mono muted">' + (ds ? "6px" : "8px") + "</span>" }),
            row({ label: "Badge, chip, tab, segment", hint: "A label, and anything inside a control.", ctl: '<span class="mono muted">' + (ds ? "4px" : "999px") + "</span>" }),
            row({
              label: "Switch, level bar, dot, avatar, count",
              hint: "Round because of what it is, not because rounding was the house style.",
              ctl: '<span class="mono muted">999px / 50%</span>'
            }),
            row({
              label: "The overlay",
              hint: "Exempt. A capsule by design, out of this plan's scope, and it keeps its own tokens.",
              ctl: '<span class="mono muted">999px · 14px</span>'
            }),
          ]
        })
      ),

      sec("Components", "Every state, on one page. A component missing a state is a component that ships broken.",
        card({
          title: "Buttons",
          body: '<div class="states">' +
            state_("default", btn("Capture", "primary")) +
            state_("secondary", btn("Refresh")) +
            state_("ghost", btn("Review", "ghost")) +
            state_("with icon", btn("Restore", null, { icon: "restore" })) +
            state_("danger", btn("Reset all settings", "danger")) +
            state_("disabled", btn("Commit", "primary", { disabled: true })) +
            state_("loading", btn("Running check", null, { busy: true })) +
            "</div>"
        }) +
        card({
          title: "Inputs",
          desc: {
            b: "One control per kind of value. A number with a unit and a small range is a stepper, never a text field; a proportion with no unit worth typing is a slider.",
            a: "One control per kind of value."
          },
          body: '<div class="states">' +
            state_("toggle off", toggle(false)) +
            state_("toggle on", toggle(true)) +
            state_("toggle disabled", toggle(true, { disabled: true })) +
            state_("segment", seg(["Tap", "Double tap", "Hold"], "Tap")) +
            state_("select", select("whisper-large-v3-turbo", ["whisper-large-v3-turbo", "whisper-large-v3", "distil-whisper-large-v3-en"])) +
            state_("stepper", stepper(12, "s")) +
            state_("stepper at min", stepper(0, "Disabled", "min")) +
            state_("slider", slider(70)) +
            state_("text", field("General writing", { w: "170px" })) +
            state_("invalid", field("Ctrl+", { invalid: true, w: "120px" })) +
            state_("hotkey", kbd("Ctrl+Super")) +
            state_("hotkey empty", kbd(null)) +
            "</div>"
        }) +
        card({
          title: "Level",
          desc: {
            b: "The one meter in the surface. The threshold mark is the component: a capture whose peak never crosses it is discarded as empty, so the bar to clear has to be on screen.",
            a: "The threshold mark is the component — a capture below it is discarded as empty."
          },
          body: '<div class="stack gap4">' +
            level(62, 74, 34, "ok", "Good — peak −13 dBFS.") +
            level(18, 22, 34, "quiet", "Too quiet — peak −34 dBFS is below the −26 dBFS needed to register as speech.") +
            level(97, 99, 34, "hot", "Very hot — peak −1 dBFS. Lower the input level to avoid distortion.") +
            "</div>"
        }) +
        card({
          title: "Status",
          body: '<div class="states">' +
            state_("success", badge("Ready", "success")) +
            state_("warning", badge("Fallback", "warning")) +
            state_("danger", badge("Failed", "danger")) +
            state_("accent", badge("Active", "accent")) +
            state_("planned", badge("Phase 8", "plan")) +
            state_("dot", '<span class="rowflex">' + dot("success") + "<span class='muted'>Direct paste available</span></span>") +
            /* The live component, not a still of it. This swatch used to be
               `wave(22, 1)` — a row of bars from a sine, drawn once — which is
               a picture of a waveform standing in a gallery of working
               controls. Nothing in the product draws that any more. */
            state_("waveform", waveform({ kind: "input", label: "Live input level" })) +
            "</div>"
        }) +
        card({
          title: "New in this plan",
          desc: {
            b: "The components section 5.3 adds, plus the three the second pass found missing. Each replaces an ad-hoc pattern that exists in more than one place today.",
            a: "Each replaces an ad-hoc pattern that exists in more than one place today."
          },
          body: '<div class="stack gap3">' +
            lane({
              title: null, options: [
                { icon: "cloud", name: "Groq cloud", desc: "Bring your own key. Fastest lane.", on: true },
                { icon: "local", name: "Local", desc: "whisper-cli and Ollama on this machine.", on: false },
              ]
            }) +
            subtabs("ds", ["Defaults", "Context", "Words", "Replacements", "Snippets"]) +
            banner({ text: "Planned: Phase 8." }) +
            card({ body: '<div class="rows">' + row({ label: "Reset all settings", hint: "Restores every setting to its default. History and profiles are untouched.", danger: true, ctl: btn("Reset", "danger") }) + "</div>" }) +
            empty("history", "No transcriptions yet.", "Press Ctrl+Super to start") +
            chips([{ term: "WordScript", origin: "learned" }, { term: "ydotool", origin: "added" }]) +
            strip({
              icon: "alert", title: "Action strip",
              text: "Home only, and only when something is owed.",
              actions: btn("Review", null, { icon: "arrow" }) + btn("Dismiss", "ghost")
            }) +
            '<div class="toolbar"><span class="search">' + icon("search") +
            field("", { placeholder: "Toolbar — filters belong above the list, not in a card" }) + "</span>" +
            select("All statuses", ["All statuses", "Completed", "Empty", "Failed"]) + "</div>" +
            card({
              body: '<div class="rows">' +
                row({ label: "Scope tag", hint: "On any row whose value belongs to the active profile rather than to this machine.", ctl: scope() }) +
                row({ label: "Action strip", hint: "Ground plus icon tile. Never a coloured edge bar.", ctl: badge("no edge rule", "success") }) +
                row({ label: "Source list", hint: "Under an assistant turn: which of your own rows the answer was read from.", ctl: '<span class="sources">' + icon("inspect") + "<span>Support reply · Words &amp; names</span></span>" }) +
                row({ label: "Transcript line", hint: "Time, speaker, what was said. The time is how a note points at a moment.", ctl: badge("tline", "plan") }) +
                "</div>" +
                disclosure("Disclosure — states what is inside, never “Advanced”", "2", [
                  row({ label: "Beam size", hint: "Folded because the recommended value is right for almost everyone.", ctl: stepper(5, null) }),
                  row({ label: "Best of", hint: "Same. Visible in one click, absent from the first read.", ctl: stepper(5, null) }),
                ])
            }) +
            "</div>"
        })
      ),

      sec("Layout primitives", "Three ways a view can be built. Picking the wrong one is what made the first build of Profiles, Notes and Chat hard to read.",
        card({
          rows: [
            row({
              label: "Column",
              hint: "Sections of cards down one centred column. Every settings section, History, Home.",
              ctl: badge("default", "plan")
            }),
            row({
              label: "Pane",
              hint: "A list column and its detail as ONE surface — the list is borderless, sits on the sidebar plane and is separated by a hairline. Profiles, Notes, Chat.",
              ctl: badge("list + detail", "plan")
            }),
            row({
              label: "Split column",
              hint: "Two columns INSIDE a pane detail, when reading and writing have to happen at once. Notes: the transcript on the left, your notes and the summary on the right.",
              ctl: badge("read + work", "plan")
            }),
            row({
              label: "Solo — removed",
              hint: "One centred 460 px column. It existed for Upload, which is a band over a full-width queue now, and nothing else has one job and nothing to show. A primitive with no user is not part of the system.",
              ctl: badge("no user", "danger")
            }),
          ]
        }) +
        note("Two cards side by side is not a pane. It reads as two unrelated boxes, because nothing on screen states that the left one governs the right one.", "alert") +
        note("A tab row is not a layout. Three sub-tabs put the transcript, the notes and the summary in three places you cannot see at once — which is the one thing a meeting note exists to do.", "alert")
      ),

      sec("Motion", "One authored moment per interaction, on transform and opacity only.",
        card({
          rows: [
            row({ label: "Control state", hint: "Toggle knob, radio fill, segment thumb.", ctl: '<span class="mono muted">120ms</span>' }),
            row({ label: "Disclosure, sheet", hint: "Anything that changes layout height.", ctl: '<span class="mono muted">180ms</span>' }),
            row({ label: "Tab and navigation change", hint: "Immediate. A crossfade here regressed WebKitGTK scrolling once already.", ctl: '<span class="mono muted">0ms</span>' }),
            row({ label: "Card hover", hint: ds ? "None. Cards do not respond to pointer transit." : "border-color over 150 ms — fires as the pointer crosses cards while scrolling.", ctl: ds ? badge("none", "success") : badge("150ms", "danger") }),
            row({ label: "prefers-reduced-motion", hint: "Every duration collapses to 1 ms.", ctl: badge("respected", "success") }),
          ]
        })
      ),

      /* ── THE READOUT, WHOLE ────────────────────────────────────────────────
         The Design System screen exists so a component is judged as a
         component rather than inferred from the one screen that happens to use
         it, and the matrix is the case that argument was written for: the
         product uses one of its modes, in one place, at one size, and the
         twelfth pass shipped exactly that much of it and called it the
         component. Everything it can do is here, drawn at upstream's own
         default 10 px pixel so the bloom is the one upstream tuned. */
      sec("The matrix", "A dot-matrix readout. One component, four frame sources and a level mode — ported whole from ElevenLabs UI (MIT), because a subset of a component is a different component.",
        card({
          body: '<div class="mx-lab">' +
            [["VU", "vu", "Levels in, column heights out. The one mode the product uses, in the meeting HUD.",
              matrixField({ mode: "vu", cols: 16, size: 10, gap: 2, ariaLabel: "Level meter" })],
             ["Loader", "frames", "Eight pixels around a circle, twelve frames to the turn.",
              matrixField({ mode: "frames", pattern: "loader", rows: 7, cols: 7, size: 10, gap: 2, fps: 12, ariaLabel: "Loader" })],
             ["Wave", "frames", "A travelling sine, anti-aliased vertically so seven rows do not step.",
              matrixField({ mode: "frames", pattern: "wave", rows: 7, cols: 7, size: 10, gap: 2, fps: 16, ariaLabel: "Wave" })],
             ["Snake", "frames", "A five-pixel tail over every cell in the field.",
              matrixField({ mode: "frames", pattern: "snake", rows: 7, cols: 7, size: 10, gap: 2, fps: 14, ariaLabel: "Snake" })],
             ["Pulse", "frames", "A ring out of a lit centre. Ported, and deliberately unused: ADR 0049 settles that the orchestrator's voice has four states and no pulse.",
              matrixField({ mode: "frames", pattern: "pulse", rows: 7, cols: 7, size: 10, gap: 2, fps: 16, ariaLabel: "Pulse" })],
             ["Digit", "pattern", "A static frame. Ten of them, 5 x 7 each, which is what makes a clock possible.",
              matrixField({ mode: "pattern", pattern: "digits", rows: 7, cols: 5, size: 10, gap: 2, ariaLabel: "Digit zero" })]]
              .map(function (m) {
                return '<figure class="mx-cell"><div class="mx-stage">' + m[3] + "</div>" +
                  '<figcaption><b>' + t(m[0]) + '</b><span class="mx-mode mono">' + t(m[1]) + "</span>" +
                  "<span>" + p(m[2]) + "</span></figcaption></figure>";
              }).join("") + "</div>",
          rows: [
            row({ label: "Lit pixel", hint: "A radial fill, not a flat colour, plus a blur that scales with the pixel. Both are what make a dot read as emitting instead of as a filled circle.", ctl: '<span class="mono muted">radialGradient + feGaussianBlur</span>' }),
            row({ label: "Unlit pixel", hint: "Drawn, never omitted. The dark grid is what makes a mostly-off display read as a display.", ctl: '<span class="mono muted">opacity 0.1</span>' }),
            row({ label: "Palette", hint: "Two properties on the wrapper. The light scheme keeps the colours and drops the bloom — there is nothing to glow into on white.", ctl: '<span class="mono muted">--matrix-on / --matrix-off</span>' }),
            row({ label: "Frame clock", hint: "An accumulator over real time, so playback holds its fps whatever the display is doing. Reduced motion draws one frame and stops.", ctl: '<span class="mono muted">fps · loop · autoplay</span>' }),
          ]
        }) +
        note("Measured in WebKitGTK 2.52.4 at 7 x 24: upstream's SVG glow filter 62.1 fps, a static drop-shadow 62.1, no bloom 62.2. The filter costs nothing here and is what the component looks like, so it is the one that ships.", "eye")
      ),

      sec("What the palette switch changes", "So the comparison is legible rather than atmospheric.",
        card({
          rows: [
            row({ label: "Surface ladder", hint: "Five background tokens move up roughly seven L* points and lose the blue tint.", ctl: badge("changed", "accent") }),
            row({ label: "Foreground ramp", hint: "Warm neutrals. --fg-muted clears AA for the first time.", ctl: badge("changed", "accent") }),
            row({ label: "Accent", hint: "#e68900 to #ff9c2b — one step up, because the ground got lighter.", ctl: badge("changed", "accent") }),
            row({ label: "Card radius and border", hint: "10 px with a hairline becomes 8 px with none.", ctl: badge("changed", "accent") }),
            row({ label: "Window background", hint: "The two-layer fixed-attachment gradient becomes one flat colour.", ctl: badge("changed", "accent") }),
            row({ label: "Information architecture", hint: "Not touched by this switch. Both sides show the proposed structure.", ctl: badge("unchanged", "plan") }),
            row({ label: "Overlay", hint: "Out of scope for the whole plan. No overlay token, size or rule is part of this.", ctl: badge("unchanged", "plan") }),
          ]
        })
      ),
    ].join("");
  };

  function state_(label, body) {
    return '<div class="state"><label>' + t(label) + "</label>" + body + "</div>";
  }

  /* ── Workspace: Home ────────────────────────────────────────────────── */

  /* Home is the dictation record, not a dashboard.

     The first build opened on a "Ready to dictate" hero with a Capture button.
     Nothing can press that button into a recording: dictation starts with the
     global hotkey, in whatever app has focus, and this window is usually not
     that app. A button that navigates while looking like it records is a lie
     about the product's central act. So the state is one line, the hotkey is
     named where the eye already is, and the dominant surface is the record of
     what was actually dictated. The donor lands on the same shape: its Home is
     the transcription list, with an action strip above it only when something
     is owed. */
  /* ── The hero ───────────────────────────────────────────────────────────
     Replaces `viewTop` on Home, and only on Home. Every other view keeps the
     title-and-lead header, because every other view is a place you navigated
     to on purpose and already know the name of. Home is the one you land on,
     and what it owes you on landing is not its own name.

     WHAT IS NOT IN IT. No metric, no count, no ring, no "3 dictations today".
     The product does not have a number worth that position — the thing worth
     that position is the shortcut, because the shortcut is how the product is
     used and it is used from inside another application. A user who has not
     memorised it cannot start. */
  /* ── THIRTEENTH PASS — THE PANEL IS GONE, AND SO IS WHAT IT REPEATED ─────
     What stood here was a `--bg-surface` block with a top-edge highlight: a
     card in everything but name, holding a state line, the keycaps and a facts
     line. The owner's verdict was that the surface was odd and its content was
     odd, and both halves were right for the same reason.

     THE SURFACE. It was the only panel in the prototype that was not a `.card`
     and did not behave like one — no head, no rows, no separators, its own
     padding, and a dot-matrix readout floating in its top-right corner
     attached to nothing. Every other view opens with `viewTop`: a heading on
     the window ground. Home's opening block is now the same object, and the
     one thing that made it worth a panel — the keycaps — was never the panel's
     doing. A keycap is already a raised object; putting it on a raised panel
     costs it the ground it is raised from.

     THE CONTENT. The state line said "Ready · Groq cloud ·
     whisper-large-v3-turbo" directly above a status bar that says "Ready ·
     Groq cloud · whisper-large-v3-turbo · Insert at cursor" — the same three
     facts, twice, 700 px apart, and §11.12 calls that furniture. The status
     bar is the surface that owns runtime state, on every screen rather than on
     this one, so the duplicate goes and "Insert at cursor" leaves the facts
     line for the same reason.

     THE READOUT LEFT WITH IT. A VU meter on a screen that is not recording is
     a measurement of nothing, and DESIGN_SYSTEM.md already names that failure:
     a permanently moving surface is a status light that never turns off. It is
     now in the meeting HUD, where a recording is actually running. */
  function homeHero() {
    return '<section class="home-open">' +
      '<div class="hero-invoke">' +
        '<span class="hero-keys">' +
          '<kbd class="keycap">' + t("Ctrl") + "</kbd>" +
          '<span class="plus">+</span>' +
          '<kbd class="keycap" data-wide>' + t("Super") + "</kbd>" +
        "</span>" +
        '<span class="what"><b>' + t("Hold in any app to dictate") + "</b>" +
        "<span>" + p({
          b: "Release to stop. What the runtime produced lands here and goes to the cursor you left it at.",
          a: "Release to stop. What it produces goes to the cursor you left."
        }) + "</span></span>" +
      "</div>" +

      '<div class="hero-facts">' +
        "<span>" + t("Next dictation runs as") + " <b>" + t("Cleanup") + "</b></span>" +
        '<span class="sep">·</span>' +
        "<span><b>" + t("General writing") + "</b> " + t("on Auto") + "</span>" +
        '<span class="grow">' + btn("Change in profile", "ghost", { icon: "arrow" }) + "</span>" +
      "</div>" +
      "</section>";
  }

  SCREENS.home = function () {
    return [
      homeHero(),

      /* THE DECISION INBOX — ADR 0044, §11.40.

         This was a single strip carrying one owed thing, absent when nothing
         was owed, and that shape was right for a product whose only exception
         was a failed insert. It is a list now, for one reason that is not
         "more features fit": ADR 0030 builds the whole agent design on a
         filter, and a filter has an output. The desk answers what it can and
         reaches the user for what it cannot — and what it cannot answer had
         nowhere on this surface to land. It went to a thread in a window that
         is usually closed, and to a notification that is gone once dismissed.

         Three sources, one list, and the reason they can share a list is not
         that they are alike. It is that all three are the same *question to
         the user*: something is stopped until you say something.

         WHAT KEEPS IT FROM BECOMING A TO-DO LIST is the third column. A desk
         question expires and takes a running process down with it; a question
         out of a meeting expires never; a clipboard transcript lasts until the
         next copy. Sorting is by that column, so the row that is costing
         something is first by construction rather than by which surface was
         built first.

         The strip is not deleted — it is what this list looks like with one
         entry, and `owed()` is the row. Nothing is drawn here when nothing is
         owed; a standing "all clear" is furniture (§11.12). */
      sec("Waiting for you · 3", null,
        card({
          body: '<div class="owed-list">' +
            owed({
              icon: "agents", urgent: true,
              title: "“Should I update the overlay test or the host?”",
              from: DESK_CAP + " · WordScript · asked 6 min ago, out loud",
              cost: "The run stays blocked and stops in 24 min without an answer.",
              actions: btn("the test", "ghost") + btn("the host", "ghost") +
                iconBtn("Answer out loud", "mic")
            }) +
            owed({
              icon: "users",
              title: "Budget for Q2 headcount — unanswered since Monday",
              from: "Product Sync · raised twice, in two meetings",
              cost: "Nothing. It stays an open question on both notes.",
              actions: btn("Open note", "ghost", { icon: "arrow" }) + btn("Dismiss", "ghost")
            }) +
            owed({
              icon: "alert",
              title: "One insert fell back to the clipboard",
              from: "Yesterday 17:03 · Support reply · the target app ignored the paste",
              cost: "The text is lost the next time you copy anything.",
              actions: btn("Restore", null, { icon: "restore" }) + btn("Dismiss", "ghost")
            }) +
            "</div>"
        })
      ),

      /* ADR 0024: the mode has one source, and every writer announces it. Home
         reports it and cannot set it \u2014 the control lives in the profile.

         The lane, the model and the delivery target used to stand here as a
         second row. They are standing state, not news, so they moved to the
         window's bottom edge where they are readable from every view instead
         of only from this one. What is left is what changes between
         dictations: which mode the next one runs as, and what the last one
         left behind. */
      /* The "next dictation runs as" row moved into the hero's foot on
         2026-08-03. It is one line of standing state, and it had a whole card
         with its own elevation and padding to itself — which put it at the
         same visual rank as the list of things that are blocking work. Rank is
         the scarce thing on this screen; a fact that never changes while you
         are reading it does not get a surface of its own. ADR 0024 still
         holds: Home reports the mode and cannot set it, and the control it
         links to is still the profile. */

      /* The count is in the header for the same reason History's is: a count is
         the result of a list, not a label on it. "Open History" is the action
         of this card and sits at its foot, not loose on the page under it. */
      sec("Recent \u00b7 5", null,
        card({
          body: '<div class="list">' + RECENT.map(transcriptRow).join("") + "</div>",
          foot: btn("Open History", "ghost", { icon: "arrow" })
        })
      ),
    ].join("");
  };

  /* \u2500\u2500 The transcript row, shared by Home and History \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
     Both screens list the same record and were building it with two different
     action sets \u2014 Home offered Copy and Insert, History offered Copy, Retry
     and Delete, and neither offered the two the record actually owns: the raw
     text it was written from, and the file it was written to. One builder now,
     so the row cannot drift apart again.

     ORDER. Read, locate, redo, take, destroy. The two that only look are
     first, the one that cannot be undone is last and is the only one that
     tones. `Retry` keeps its shipped name (`retryTranscription` in the donor
     calls the same thing "Retranscribe"; ours is the shorter true one \u2014 it
     re-runs the pipeline over kept audio, ADR 0039).

     Every row can be shown in the file manager, because every transcript is a
     Markdown file (\u00a711.23). Rows whose audio has been swept cannot be retried,
     and say so by disabling the control rather than by hiding it. */
  function transcriptRow(e) {
    var acts = [
      iconBtn("View raw transcript", "file", { act: "raw:" + e.id, on: !!state.raw[e.id] }),
      iconBtn("Show in file manager", "folderOpen"),
      iconBtn(e.audio === false ? "Retry \u2014 audio no longer kept" : "Retry", "restore", { disabled: e.audio === false }),
      iconBtn("Copy", "copy"),
    ];
    if (e.restore) acts.splice(3, 0, iconBtn("Restore to cursor", "resume"));
    acts.push(iconBtn("Delete", "trash", { tone: "danger" }));

    return listItem({
      title: e.text,
      meta: [e.at, e.mode, e.profile],
      state: e.state || null,
      badges: e.badges || [],
      raw: {
        id: e.id, heard: e.heard || e.text, written: e.text,
        same: !e.heard, note: e.rawNote || "The AI stage rewrote it.",
        path: e.path
      },
      actions: acts
    });
  }

  /* `heard` absent means the two texts are identical \u2014 Verbatim, or a mode that
     found nothing to change. `path` is the Markdown file this record was
     written to; it is what "Show in file manager" opens. */
  var RECENT = [
    {
      id: "r1", text: "Let\u2019s ship the settings restructure today and review the overlay tab.",
      heard: "lets ship the settings restructure today and uh review the overlay tab",
      at: "2 min ago", mode: "Cleanup", profile: "General writing",
      path: "~/WordScript/transcripts/2026/08/03-0942-settings-restructure.md"
    },
    {
      id: "r2", text: "Hey WordScript, write a short reply confirming Thursday works.",
      heard: "hey wordscript write a short reply confirming thursday works",
      at: "18 min ago", mode: "Draft", profile: "General writing",
      path: "~/WordScript/transcripts/2026/08/03-0926-reply-thursday.md"
    },
    {
      id: "r3", text: "Consolidate insert recovery into a single home.",
      at: "1 h ago", mode: "Verbatim", profile: "General writing",
      path: "~/WordScript/transcripts/2026/08/03-0851-insert-recovery.md"
    },
    {
      id: "r4", text: "Kundenanfrage zum Lieferstatus, bitte freundlich beantworten.",
      heard: "kundenanfrage zum lieferstatus bitte freundlich beantworten",
      at: "Yesterday", mode: "Rewrite", profile: "Support reply",
      badges: [{ text: "Clipboard", tone: "warning" }], restore: true,
      path: "~/WordScript/transcripts/2026/08/02-1703-lieferstatus.md"
    },
    {
      id: "r5", text: "Structure this into a prompt for Claude Code with the constraints I listed.",
      heard: "structure this into a prompt for claude code with the constraints i listed",
      at: "Yesterday", mode: "Prompt Enhance", profile: "General writing",
      path: "~/WordScript/transcripts/2026/08/02-1540-claude-prompt.md"
    },
  ];

  /* ── Workspace: History ─────────────────────────────────────────────── */

  /* The shipped surface spends a whole card of stacked FormRows on three
     filters — a search box, a status select and a toggle, each with a label in
     the left column. Filters are a toolbar: they belong above the thing they
     filter, on one line, and the count belongs to the list they produce. */
  SCREENS.history = function () {
    return [
      viewTop({ title: "History", lead: "Every transcription kept on this machine." }),

      /* Three filters became two. The shipped card carried a search box, a
         status select AND an "Errors only" toggle — but the select already has
         a Failed option, so two controls narrowed the list to the same set and
         could contradict each other. The toggle is gone. */
      '<div class="toolbar">' +
      '<span class="search">' + icon("search") + field("", { placeholder: "Search transcripts…" }) + "</span>" +
      select("All statuses", ["All statuses", "Completed", "Empty", "Failed"]) +
      '<span class="right rowflex">' + btn("Export", "ghost", { icon: "download" }) + "</span></div>",

      sec("7 transcriptions", null,
        card({ body: '<div class="list">' + HISTORY.map(transcriptRow).join("") + "</div>" })
      ),

      /* The pairing with Privacy & Data, stated from this side too (§11.51):
         this screen is the records, that one is the rule about them. */
      note("Every transcript is a Markdown file in ~/WordScript/transcripts. Kept 90 days, capped at 500 entries.",
        "privacy", docLink("Change the rule in Privacy & Data")),
    ].join("");
  };

  /* The seventh row is what a swept record looks like: the transcript survives
     as a file, the audio is gone, so Retry has nothing to re-run (ADR 0039). */
  var HISTORY = [
    {
      id: "h1", text: "Let’s ship the settings restructure today and review the overlay tab.",
      heard: "lets ship the settings restructure today and uh review the overlay tab",
      at: "09:42", mode: "Cleanup", profile: "General writing",
      path: "~/WordScript/transcripts/2026/08/03-0942-settings-restructure.md"
    },
    {
      id: "h2", text: "Hey WordScript, write a short reply confirming Thursday works.",
      heard: "hey wordscript write a short reply confirming thursday works",
      at: "09:26", mode: "Draft", profile: "General writing",
      path: "~/WordScript/transcripts/2026/08/03-0926-reply-thursday.md"
    },
    {
      id: "h3", text: "Consolidate insert recovery into a single home.",
      at: "08:51", mode: "Verbatim", profile: "General writing",
      path: "~/WordScript/transcripts/2026/08/03-0851-insert-recovery.md"
    },
    {
      id: "h4", text: "Kundenanfrage zum Lieferstatus, bitte freundlich beantworten.",
      heard: "kundenanfrage zum lieferstatus bitte freundlich beantworten",
      at: "Yesterday 17:03", mode: "Rewrite", profile: "Support reply",
      badges: [{ text: "Insert failed", tone: "danger" }], restore: true,
      path: "~/WordScript/transcripts/2026/08/02-1703-lieferstatus.md"
    },
    {
      id: "h5", text: "Structure this into a prompt for Claude Code with the constraints I just listed.",
      heard: "structure this into a prompt for claude code with the constraints i just listed",
      at: "Yesterday 15:40", mode: "Prompt Enhance", profile: "General writing",
      badges: [{ text: "Retried once", tone: "plan" }],
      path: "~/WordScript/transcripts/2026/08/02-1540-claude-prompt.md"
    },
    {
      id: "h6", text: "Standup notes: overlay placement fixed, shortcuts still open.",
      heard: "standup notes overlay placement fixed shortcuts still open",
      at: "Yesterday 09:12", mode: "Cleanup", profile: "General writing",
      path: "~/WordScript/transcripts/2026/08/02-0912-standup.md"
    },
    {
      id: "h7", text: "Danke fuer die Rueckmeldung, ich schaue mir das heute noch an.",
      heard: "danke für die rückmeldung ich schaue mir das heute noch an",
      at: "Mon 16:22", mode: "Rewrite", profile: "Support reply", audio: false,
      badges: [{ text: "Clipboard only", tone: "warning" }, { text: "Audio swept", tone: "plan" }],
      restore: true,
      path: "~/WordScript/transcripts/2026/07/31-1622-rueckmeldung.md"
    },
  ];

  /* ── Workspace: Profiles ────────────────────────────────────────────── */

  SCREENS.profiles = function () {
    var tabs = ["Defaults", "Context", "Words", "Replacements", "Snippets"];
    var active = activeSub("profiles", tabs);
    var body;

    /* Defaults is the tab the plan's IA table implies and the first build did
       not have. ADR 0024 puts "which mode this profile defaults to" in the
       profile and nowhere else; ADR 0025 makes the session inherit it. The
       delivery target, the workspace-context switch and the recording limits
       are per-profile in the runtime as well, and were sitting in three
       different settings sections where they read as machine-wide. Gathering
       them here is what lets Settings mean "this machine" without exception —
       and it answers the Phase 7 success measure directly: what a profile
       contains, and what stays global. */
    /* REBUILT FOR WEIGHT, 2026-08-03.
       Defaults was one card of six rows each carrying two or three sentences,
       then a health card, then a four-row card with its own two-sentence
       description — about 230 words to configure six values, on the tab that
       opens first. Three faults, and only the third is about wording:

       1. SIX EQUAL ROWS WERE NOT SIX EQUAL DECISIONS. Three decide how this
          profile writes; three decide when a recording stops. Different
          subjects, adjacent siblings, so the tab read as an undifferentiated
          list of settings rather than as two decisions with three parts each.
       2. THE HEALTH CARD WAS A CARD. One flag, one sentence, one button — a
          full card for a status that belongs beside the profile's name, where
          it is visible from all five tabs instead of only from this one.
       3. THE HINTS EXPLAINED THE FEATURE, NOT THE CHOICE. "When enabled,
          WordScript detects the active app (IDE, browser, chat, …) and passes
          it to every mode as a weak hint. It never contributes content." The
          reader is deciding whether to leave a switch alone. What they need is
          what changes if they don't — one clause, not three sentences. */
    if (active === "Defaults") {
      body = card({
        title: "How this profile writes",
        desc: {
          b: "These settings travel with the profile. Switching profiles switches all of them at once, and a running session keeps the ones it started with.",
          a: "Travels with the profile. A running session keeps what it started with."
        },
        rows: [
          row({
            label: "Processing mode",
            hint: "Auto never picks Verbatim or Rewrite — those stay your call.",
            ctl: select("Auto", ["Auto", "Verbatim", "Cleanup", "Rewrite", "Translate", "Draft", "Prompt Enhance"])
          }),
          row({
            label: "Delivery",
            hint: "Where a finished transcript goes.",
            ctl: seg(["Insert at cursor", "Clipboard only"], "Insert at cursor")
          }),
          row({
            label: "Workspace context",
            hint: {
              b: "When enabled, WordScript detects the active app (IDE, browser, chat, …) and passes it to every mode as a weak hint. It never contributes content.",
              a: "Tells the AI which app you are writing into. Never adds content."
            },
            ctl: toggle(true)
          }),
        ]
      }) + card({
        /* Three things bound a recording, ordered by how hard each one is: you
           stop talking, the recording gets long, the provider cannot take any
           more. The ceiling is the runtime's number — it moves with the
           provider, the plan and the model — so it is stated, not offered, and
           it is stated here because this is where it is spent (ADR 0034). */
        title: "When a recording stops",
        desc: "Nothing here can pass the ceiling, and the ceiling is not yours to set.",
        rows: [
          row({
            label: "Stop after silence",
            hint: {
              b: "Ends the recording after this many seconds without speech (0 disables it). Independent of the length limits above — it reacts to you stopping, not to the recording getting long.",
              a: "When you stop talking. 0 disables it."
            },
            ctl: stepper(3, "s")
          }),
          row({
            label: "Auto-stop",
            hint: {
              b: "Ends the recording at this length, so it always finishes processing. Recommended: up to 12:18, which keeps 01:21 of headroom under the processing limit.",
              a: "At this length. Up to 12:18 keeps headroom under the ceiling."
            },
            ctl: stepper(10, "min")
          }),
          row({
            label: "Ceiling",
            hint: {
              b: "The longest recording this setup can process at all — 13:39, set by the 25 MiB upload size on your free plan. Past it the recording cannot be transcribed, so the auto-stop below stays underneath it.",
              a: "13:39 — the 25 MiB upload size on your plan. Past it, nothing transcribes."
            },
            ctl: badge("13:39")
          }),
        ]
      }) + card({
        /* Four lists, four destinations. This was four labelled rows with a
           badge each, under a card description of two sentences — the shape of
           a settings card, on a block that sets nothing. It is a legend, so it
           is built as one: three columns, one line each, no hint column. */
        title: "Where each list lands",
        body: '<div class="legend">' +
          [["Context", "steers which word the AI picks", "AI modes"],
          ["Words & names", "repairs mangled terms", "recognizer + AI"],
          ["Replacements", "exact swap, before the AI", "every mode"],
          ["Snippets", "phrase expands to a block", "every mode"]].map(function (l) {
            return '<div class="legend-row"><b>' + t(l[0]) + "</b>" +
              "<span>" + p(l[1]) + "</span>" + badge(l[2], "plan") + "</div>";
          }).join("") + "</div>",
        foot: btn("Check against a sample", "ghost", { icon: "play" })
      });
    } else if (active === "Context") {
      body = card({
        title: "Profile context",
        desc: {
          b: "The topics you talk about — not spellings. One per line. This tells the AI what field it is reading, so it picks the right word where dictation is ambiguous. For individual terms, use Words & names below.",
          a: "Topics you talk about, one per line. Not spellings."
        },
        body: '<div class="rows"><div class="row stack">' +
          textarea("Tauri desktop runtime\nWhisper speech-to-text\nRust native insert chain\nSettings information architecture", "One topic per line", 5) +
          "</div></div>" +
          note({ b: "", a: "For individual terms, use Words & names." }, "arrow",
            docLink("How context reaches the model"))
      });
    } else if (active === "Words") {
      // A word list is an input and a set of chips — the donor's Dictionary.
      // Rows with hover actions imply a record with fields; a term has none.
      body = card({
        title: "Words & names",
        desc: {
          b: "The words this profile has learned to spell, plus anything you added yourself. Every term reaches all AI modes and is repaired automatically when speech recognition mangles it. Speech recognition itself takes only a few, and which ones is decided for you.",
          a: "Terms this profile knows. Repaired automatically when speech mangles them."
        },
        body: '<div class="rows"><div class="row stack">' +
          field("", { placeholder: "Add a word or name…" }) +
          chips([
            { term: "WordScript", origin: "learned" }, { term: "Tauri", origin: "learned" },
            { term: "WebKitGTK", origin: "added" }, { term: "ydotool", origin: "added" },
            { term: "Kundenanfrage", origin: "added" }, { term: "Groq", origin: "learned" },
            { term: "whisper-cli", origin: "added" }, { term: "Ollama", origin: "learned" }
          ]) +
          '<p class="muted">' + p("Outlined chips were learned from repairs. 8 terms.") + "</p>" +
          "</div></div>"
      }) + card({
        rows: [row({
          label: "Effective transcription bias",
          hint: "Which of these the recognizer actually receives — it takes only a few.",
          ctl: btn("Show", "ghost", { icon: "eye" })
        })]
      });
    } else if (active === "Replacements") {
      body = card({
        title: "Replacements",
        desc: {
          b: "Spoken form → written form. For shorthand you say deliberately, like “KA” for “Kundenanfrage”. Exact and case-insensitive, applied in every mode. Misheard names do not belong here — the recognizer mangles them differently every time, so there is no left side to write down. Put those in Words & names.",
          a: "Shorthand you say on purpose. Exact match, every mode."
        },
        body: '<div class="list">' +
          [["KA", "Kundenanfrage"], ["WS", "WordScript"], ["asap", "as soon as possible"]].map(function (r) {
            return listItem({
              title: r[0] + "  →  " + r[1], meta: ["exact", "case-insensitive"],
              actions: [iconBtn("Edit", "type"), iconBtn("Delete", "trash", { tone: "danger" })]
            });
          }).join("") + "</div>",
        /* The button that adds to this list, at the foot of the card that holds
           it. It used to be a bare flex row with `padding-top:12px` and no
           bottom padding at all, so it sat welded to the card's bottom edge —
           the defect that started this whole pass. */
        foot: btn("Add replacement", null, { icon: "plus" })
      }) +
        note({ b: "", a: "Misheard names belong in Words & names instead." }, "arrow", docLink("Why"));
    } else {
      body = card({
        title: "Snippets",
        desc: "A trigger phrase you say, and the block it expands to.",
        body: '<div class="list">' +
          [["standard closing", "Best regards,\nFelix"], ["ticket header", "Ticket: \nStatus: \nNext step: "]].map(function (s) {
            return listItem({
              title: s[0], meta: ["expands to " + s[1].split("\n").length + " lines"],
              actions: [iconBtn("Edit", "type"), iconBtn("Delete", "trash", { tone: "danger" })]
            });
          }).join("") + "</div>",
        foot: btn("Add snippet", null, { icon: "plus" })
      });
    }

    /* The health flag moved out of its own card and into the detail header.
       It is a property of the profile, not of the Defaults tab, and from here
       it is visible on all five. Two ghost buttons went with it: Duplicate and
       Export are things you do to a profile rarely and from the list, not from
       the header of the one you are editing — they are on the row's own menu.
       What is left in the header is the profile's name, its state, and the one
       thing wrong with it. */
    return viewTop({
      title: "Profiles",
      lead: "What a profile knows, and what it changes about how you are written.",
    }) +
      pane({
        listTitle: "Profiles", count: "3",
        rows: [
          { title: "General writing", sub: "Auto · Insert at cursor", on: true, icon: "profiles" },
          { title: "Support reply", sub: "Rewrite · Client register", icon: "profiles" },
          { title: "Customer success replies", sub: "Rewrite · Clipboard only", icon: "profiles" }
        ],
        foot: btn("New profile", "ghost", { icon: "plus" }),
        title: "General writing",
        desc: "Active in this session",
        actions: badge("Active", "success") +
          '<button class="flag">' + icon("alert") + t("1 flag") + "</button>" +
          iconBtn("More", "updown"),
        body: subtabs("profiles", tabs) + body
      });
  };
  SCREENS.profiles.layout = "pane";

  /* ── Workspace previews ─────────────────────────────────────────────── */

  /* Content parity with the shipped NotesArea: three panes (transcript with
     speaker separation, raw notes, enhanced summary), pinning, search, the
     per-note actions and both empty states. The layout is the new one; the
     feature set is what already exists. */
  /* Rebuilt twice. The first build put Transcript, Raw notes and Enhanced on
     three sub-tabs; the second replaced them with two fixed columns; this one
     goes back to three tabs, and the reason the second attempt failed is worth
     keeping.

     Two columns pin the transcript beside the notes so both are visible. But
     they are not equal: the transcript is long and the notes are short, so the
     most-read view got half a column and the least-read one got the other half,
     permanently. Reading and writing at the same time is real, and it is what
     the meeting HUD is for — during the call. Afterwards you read ONE of the
     three, and switching is cheap.

     So: three tabs at the top right of the note, where a view switch belongs.
     Transcript is what was said, Notes is what you wrote, Enhanced is what was
     derived from both.

     Three things this build adds:

       FOLDERS.   The rail carries folders above the note list. They are
                  directories on this machine, not a grouping column in a
                  database — the path is stated in the rail footer so that
                  promise stays visible. Upload writes into one of them.
       AI CHAT.   Chat was a top-level workspace view. Every question it can
                  answer is about something you are already looking at, so it
                  was a place you had to LEAVE the note to ask about the note.
                  It is a panel here, over the note, with the note behind it.
       ONE BAR.   A mic and one primary action with the rest behind a chevron,
                  floating at the foot of the note at every scroll position.
  */
  /* `panel` picks which of the two overlays the note is shown under. Both are
     panels over the same note for the same reason (§11.19): the thing you are
     asking about, or running an action over, is the thing behind them. They
     are two screens in this demo only because a static mock can show one open
     panel at a time and both need looking at. */
  /* ── Workspace: Context ────────────────────────────────────────────────
     Notes and Upload merged here on 2026-08-03 — ADR 0045, §11.41.

     They were two workspace entries producing one thing by two routes, and
     the user had to know which route WordScript had filed something under
     before they could look for it. Worse, the two drew the same material
     differently: an upload's transcript was a row in a queue with a `Copy`
     button, a meeting's transcript was a tab in a note, and they were the same
     transcript.

     ONE TYPE. A meeting, a dictation, an uploaded file, a fetched link and a
     calendar entry that has not happened yet are one object. What differs is
     `origin` — a field on it — and `state`, which is where in its life it is:

       scheduled     it exists because the calendar says it will happen
       recording     it is being captured right now
       transcribing  the audio is in, the text is not
       ready         it has a transcript
       failed        it has a reason instead

     `scheduled` is the one that earns the merge its keep, and it is the whole
     of the user's point 11: a meeting you have not had yet already has a name,
     attendees, an agenda and the decisions the last one left open. Drawing it
     as an object in the same list means the surface answers "what do I know
     about this meeting" before the meeting, in the place that will hold it
     afterwards. It costs no calendar view, and a calendar view would have lost
     to Google Calendar anyway.

     Upload stops being a place. It is `intake` — a state of this screen, not
     an entry beside it (`state.ctx`), reached from the rail's add control. The
     queue it used to own is this list filtered to the objects that are not
     ready yet, because a file being transcribed IS a context object without a
     transcript, and giving it a second list was giving it a second identity.

     FOUR TABS, AND THE FIRST DRAFT HAD SEVEN. Summary · Transcript · People ·
     Decisions · Tasks · Linked was written out and thrown away, for a reason
     worth keeping: **a tab is a view of the whole object, not a heading inside
     one of them.** Decisions and Tasks are sections of the summary — that is
     where they are derived and where they are read — and putting them on tabs
     of their own splits one page into three and asks the user to guess which
     of the three holds the sentence they remember. People are not a view at
     all; they are chips on the transcript and in the object's own header.

     So: Transcript, Notes, Summary, Linked. `Enhanced` was renamed to
     `Summary` in the same pass — "enhanced" describes how it was made, which
     is only interesting for the ten seconds after it is made, and it means
     nothing at all on a dictation.

     `panel` picks which of the two windows is open over the object. Both are
     windows over the same object for the same reason (§11.19): the thing you
     are asking about, or running an action over, is the thing behind them. */
  SCREENS.context = function () {
    return state.ctx === "intake" ? contextIntake() : contextScreen("ask");
  };
  SCREENS.contextactions = function () { return contextScreen("actions"); };
  SCREENS.contextintake = function () { return contextIntake(); };
  SCREENS.context.layout = "pane";
  SCREENS.contextactions.layout = "pane";
  SCREENS.contextintake.layout = "pane";
  /* The old ids still resolve, per §4.3's rule that a deep link survives a
     restructure. `upload` lands on the intake it became rather than 404-ing
     into Home, which is the honest redirect: the thing it named still exists,
     as a state. */
  SCREENS.notes = SCREENS.context;
  SCREENS.noteactions = SCREENS.contextactions;
  SCREENS.upload = SCREENS.contextintake;
  SCREENS.notes.layout = "pane";
  SCREENS.noteactions.layout = "pane";
  SCREENS.upload.layout = "pane";

  /* THE OBJECT LIST — one type, five states, four origins.
     Ordered by time and not by state: a list that groups by state is a list
     the user has to re-learn every time something finishes. What is running is
     visible because it says so on the row, not because it was hoisted. */
  var CTX = [
    {
      title: "Acme — quarterly review", when: "14:00", origin: "calendar",
      sub: "in 2 h · 4 attendees · 3 open from last time",
      icon: "calendar", state: { text: "Scheduled", tone: "plan" }
    },
    { title: "Product Sync", when: "10:30", origin: "meeting", sub: "Action items from the weekly", icon: "users", on: true },
    { title: "Planning — Q3 scope", when: "Now", origin: "meeting", sub: "08:12 elapsed", icon: "users", state: { text: "Recording", tone: "danger" } },
    { title: "acme-call.wav", when: "09:58", origin: "upload", sub: "31.8 MB · 2:14 of 34:18", icon: "upload", state: { text: "Transcribing", tone: "warning" } },
    { title: "Ep. 142 — Shipping desktop software", when: "09:41", origin: "link", sub: "youtube.com · resolving stream", icon: "link", state: { text: "Fetching", tone: "warning" } },
    { title: "Voice pipeline", when: "09:15", origin: "meeting", sub: "Architecture notes for the runtime", icon: "users" },
    { title: "Settings restructure", when: "09:42", origin: "dictation", sub: "Cleanup · General writing", icon: "mic" },
    { title: "interview-recording.mp3", when: "Yest.", origin: "upload", sub: "413 request_too_large — over the 25 MiB limit", icon: "upload", state: { text: "Failed", tone: "danger" } },
    { title: "Weekly standup", when: "Yest.", origin: "meeting", sub: "Sprint progress and blockers", icon: "users" },
  ];

  /* The rail is shared by the reading state and the intake state, because it
     is the same list either way — the intake is a thing you do TO this list,
     not a different collection. */
  function contextRail(addOn) {
    return '<div class="pane-sec">' + paneSecHead("Folders", "New folder") +
      '<div class="folders">' +
      [{ name: "Personal", n: 5 }, { name: "Meetings", n: 9, on: true }, { name: "Work", n: 2 }]
        .map(folderRow).join("") +
      "</div></div>" +
      '<div class="pane-sec grow">' +
      '<div class="pane-sec-head"><b>' + t("Everything") + "</b>" +
      '<button class="add" data-go="contextintake" aria-label="Add a recording, file or link"' +
      (addOn ? " data-on" : "") + ">" + icon("plus") + "</button></div>" +
      '<div class="pane-search">' + field("", { placeholder: "Search transcripts, notes and people…" }) + "</div>" +
      '<div class="pane-scroll">' +
      CTX.map(function (c) {
        return paneRow({
          title: c.title, when: c.when, sub: c.sub, icon: c.icon,
          on: c.on && !addOn, badge: c.state
        });
      }).join("") +
      "</div></div>";
  }

  function contextScreen(panel) {
    var tabs = [
      { id: "Transcript", icon: "list" },
      { id: "Notes", icon: "notes" },
      { id: "Summary", icon: "sparkle" },
      { id: "Linked", icon: "layers" },
    ];
    var open = state.sub.context || "Summary";

    var lines = [
      { at: "00:12", who: "S1", tone: "a", text: "Let’s ship the settings restructure today." },
      { at: "00:31", who: "S2", tone: "b", text: "Agreed. Then review the overlay tab — the placement bug is still open." },
      { at: "01:04", who: "S1", tone: "a", text: "I’ll handle the Diagnostics sub-tabs.", marked: true },
      { at: "01:22", who: "S2", tone: "b", text: "Can we decide the MCP server question this week?" },
      { at: "01:40", who: "S1", tone: "a", text: "Not this week. It needs its own ADR." },
    ];

    function enh(title, items) {
      return '<div class="enh"><h4>' + t(title) + "</h4><ul>" +
        items.map(function (i) { return "<li>" + i + "</li>"; }).join("") + "</ul></div>";
    }

    var body;
    if (open === "Transcript") {
      /* PEOPLE ARE HERE, NOT ON A TAB OF THEIR OWN — and the chips carry the
         speaker's status, which is the part the surface was missing entirely.

         Nothing in the audio produces a name (ADR 0047). The source separates
         you from everyone else, clustering separates the others from each
         other, and a name arrives from the calendar, from a click, or from a
         saved voice profile. A chip therefore has to say which of those it is,
         because "Sarah" that was guessed and "Sarah" that you confirmed behave
         differently: the guessed one is replaced when the meeting ends and the
         clustering runs again over the whole recording, and the confirmed one
         is not. Drawing them identically is how a name silently changes after
         the fact. */
      body = '<div class="rowflex">' +
        '<span class="search">' + icon("search") +
        field("", { placeholder: "Find in this transcript…" }) + "</span>" +
        '<span class="muted">5 lines · 2 speakers</span>' +
        btn("Copy", "ghost", { icon: "copy" }) + "</div>" +
        '<div class="who-chips">' +
        whoChip({ name: "You", how: "mic", status: "locked" }) +
        whoChip({ name: "Sarah Chen", how: "calendar", status: "suggested" }) +
        whoChip({ name: "Speaker 2", how: "cluster", status: "provisional" }) +
        '<button class="who-add">' + icon("plus") + t("Name a speaker") + "</button>" +
        "</div>" +
        '<div class="tscript">' + lines.map(tline).join("") + "</div>" +
        '<p class="muted">' + p("Highlighted lines were marked during the meeting.") + "</p>";
    } else if (open === "Notes") {
      body = textarea("- ship voice pipeline by march\n- talk to design team re: new UI\n- budget Q: ask finance\n- settings restructure today, overlay tab after",
        "Type while you listen…", 10) +
        note({
          b: "What you write stays yours. Enhance reads it alongside the transcript and never overwrites it.",
          a: "Enhance reads this alongside the transcript. It never overwrites it."
        }, "about");
    } else if (open === "Summary") {
      /* Decisions, tasks and open questions stay SECTIONS of this tab rather
         than becoming tabs of their own — the seven-tab draft is discussed at
         the head of this screen. What is new is that two of the three are now
         connected to something outside the note.

         An open question with `escalate` set is the one thing on this page
         that can go to the decision inbox, and it goes there because somebody
         is stuck on it, not because it is important. A task with `handoff` set
         can go to the desk. Both are explicit gestures with a button; nothing
         on this tab reaches out on its own, which is the same rule the
         handoff screen states for a dictation. */
      body =
        enh("Decisions", [
          "Voice pipeline is the top priority — ship by end of March before any other workstream",
          "UI redesign deferred until the pipeline lands, to avoid splitting focus",
          "Dictionary feature approved: custom words for medical, legal and technical terms",
        ]) +
        enhActs("Tasks", [
          { text: "<b>Sarah</b> — frontend migration to the new component library, by end of sprint" },
          { text: "<b>Alex</b> — API refactor plus latency benchmarks, target sub-200 ms, currently ~280 ms" },
          { text: "<b>Gabriel</b> — follow up with finance on the Q2 budget, headcount approval by Friday" },
          {
            text: "Draft the migration plan from the three architecture notes and open a PR",
            act: btn("Hand to " + DESK, "ghost", { icon: "handoff" })
          },
        ]) +
        enhActs("Open questions", [
          {
            text: "Q2 headcount budget — raised twice, still unanswered",
            act: btn("Send to inbox", "ghost", { icon: "pending" })
          },
          { text: "Real-time collaboration on notes — CRDT or OT? No timeline yet" },
          { text: "Third-party dependency audit needed before public open-sourcing" },
        ]) +
        note({
          b: "Derived from the transcript and your notes together. Not wired to the runtime yet — nothing on this tab was produced by a model.",
          a: "Derived from the transcript and your notes together."
        }, "eye");
    } else {
      /* LINKED — the relationships, at the object, and not as a graph.

         A graph view was proposed and ruled out (§11.42). It shows THAT things
         connect; the question a user actually arrives with is WHAT connects,
         and that is a list. The entry point from the other direction — every
         object touching one person or one project — is a filter on the rail,
         not a second view: `Sarah Chen · 6 objects` is a search this list
         already supports.

         Everything here is either produced on this machine or read read-only
         from an intake. Nothing on this tab was fetched by reaching out.

         What is NOT here and says so: mail. It would be the obvious fifth
         group and it is on the other side of the effect line (ADR 0046) — the
         desk reaches a mailbox, WordScript does not read one. */
      body =
        linkGroup("People", [
          { icon: "user", name: "Sarah Chen", meta: "6 objects · from Google Calendar", tone: null },
          { icon: "user", name: "Alex Rivera", meta: "4 objects · named by you", tone: null },
          { icon: "user", name: "Gabriel Ost", meta: "2 objects · named by you", tone: null },
        ]) +
        linkGroup("Before this", [
          { icon: "users", name: "Product Sync — 27 Jul", meta: "same series · 2 decisions still open", tone: null },
          { icon: "users", name: "Voice pipeline", meta: "shares 3 topics and 2 people", tone: null },
        ]) +
        linkGroup("Came out of it", [
          { icon: "mic", name: "Settings restructure", meta: "dictation · 09:42 · inserted into the plan", tone: null },
          { icon: "file", name: "03-0942-settings-restructure.md", meta: "~/WordScript/transcripts/2026/08/", tone: null },
        ]) +
        linkGroup("From the calendar", [
          { icon: "calendar", name: "Product Sync · weekly, Mon 10:30", meta: "Google Calendar · read-only", tone: null },
        ]) +
        note({
          b: "Links are computed on this machine from shared people, shared topics and the calendar series. Nothing was fetched from a service to build this tab.",
          a: "Computed on this machine. Nothing was fetched to build this."
        }, "local");
    }

    var rail = contextRail(false);

    /* The chat's boundary is stated once, in its own header area, and its two
       shipped facts survive the move out of the old screen: an answer names the
       rows it read, and voice input is the dictation hotkey rather than a
       second recording path. */
    var chat =
      '<div class="chatwin"><div class="chatwin-deco"><b>Ask</b>' +
      '<button aria-label="Minimize">' + icon("minus") + "</button>" +
      '<button aria-label="Close">' + icon("x") + "</button></div>" +
      '<div class="aichat-body">' +
      '<div class="msg" data-from="me"><div class="bubble"><p>' +
      t("Summarize what we discussed in today’s meetings.") + "</p></div></div>" +
      '<div class="msg" data-from="ws"><div class="bubble">' +
      "<p>" + t("Based on today’s discussions:") + "</p>" +
      '<div class="enh"><ul>' +
      "<li>" + t("Voice pipeline — ship by end of March") + "</li>" +
      "<li>" + t("UI redesign deferred post-pipeline") + "</li>" +
      "<li>" + t("Follow up with finance on the Q2 budget") + "</li>" +
      "</ul></div>" +
      '<div class="sources">' + icon("inspect") +
      "<span>Product Sync</span><span class='sep'>·</span><span>Weekly standup</span></div>" +
      '<button class="copy" aria-label="Copy message">' + icon("copy") + "</button></div></div>" +
      '<span class="typing"><i></i><i></i><i></i></span>' +
      "</div>" +
      '<div class="aichat-foot">' + icon("mic") +
      "<span>Hold <kbd>Ctrl</kbd> <kbd>Space</kbd> to speak · nothing here is kept</span></div>" +
      '<span class="hud-resize" aria-hidden="true"></span></div>';

    return viewTop({
      title: "Context",
      lead: "Everything you have said, recorded or brought in — and what follows from it.",
      banner: { text: "Planned for V2. Nothing on the Summary tab is wired." },
    }) +
      pane({
        listBody: rail,
        /* `New note` was here and is gone. The rail already carries an add
           control on the Folders header and another on the list header — the
           section heads own their own additions (`paneSecHead`), which is the
           pattern the whole rail is built on. A third button repeating one of
           them at the foot made the foot look like the place new things are
           made, and then contradicted itself by not offering a new folder.
           What is left is the one action the rail cannot express as an
           addition to a list: starting a recording. */
        foot: btn("Record meeting", null, { icon: "users" }),
        path: "~/Documents/WordScript/Meetings",
        title: "Product Sync",
        tabs: noteTabs("context", tabs),
        /* Two windows, two buttons, side by side — they open the same kind of
           thing and are told apart by their names, not by their behaviour.
           Export lost its label in the same pass: it is the one control here
           that is not a way of looking at the object or a window over it, and
           §11.28's rule applies — a labelled ghost button has to earn its
           width against the row's own sentence. */
        actions: '<button class="btn" data-v="ghost" data-go="context"' +
          (panel === "ask" ? ' data-on' : "") + ">" + icon("chat") + "Ask</button>" +
          '<button class="btn" data-v="ghost" data-go="contextactions"' +
          (panel === "actions" ? ' data-on' : "") + ">" + icon("template") + "Actions</button>" +
          iconBtn("Export", "download"),
        /* THE OBJECT'S OWN HEADER LINE, and it now names its origin.
           Every object in this list carries the same line and it always
           answers the same three questions: when, where it came from, and
           what it is made of. On an upload it reads `uploaded file · 34:18`;
           on a dictation, `dictation · Cleanup`. Same slot, same order, so the
           merge does not cost the reader a second layout to learn. */
        body: '<div class="note-body"><span class="note-date">' +
          t("Mar 11, 2026 · 12:04 · meeting · mic + system audio · 2 speakers") +
          ' <span class="origin-from">' + t("· from Google Calendar") + "</span></span>" +
          body + "</div>",
        /* The menu is drawn closed here and open on the meeting HUD. It was
           open on this screen and the list grew from four entries to six, so
           it ran up behind the Ask window — two overlays open at once, which
           is a state nobody is ever in. One surface demonstrates the open
           menu; this one demonstrates the two windows. */
        float: floatbar({ action: ACTIONS[0].name }),
        overlay: panel === "actions" ? actionsPanel() : chat,
      });
  }

  /* ── Context · intake ──────────────────────────────────────────────────
     What Upload was, as a state of Context rather than a place beside it —
     and then corrected, because the first build of it answered the wrong
     question. §11.48.

     THE FAULT. Pressing `+` landed straight in a dropzone. That made importing
     an existing recording the definition of "add something", and it is the
     rarest of the ways material arrives: most of what enters this list is
     something you are about to say or type. Merging Notes into Context had
     quietly deleted the plainest thing the old Notes could do — make an empty
     note and start writing in it — because the merge kept Upload's screen and
     dropped Notes'.

     THREE WAYS IN, AND THEY ARE GENUINELY THREE. The segment is not a filter
     or a preference; each one produces a different object from a different
     source, and the controls under it have nothing in common:

       Write    an empty object. Type into it, or hold the dictation key and
                talk into it. Nothing is transcribed because nothing was
                recorded — the words arrive as words.
       Record   a meeting, live, in the HUD. This is the only one that opens
                another window, because a capture that lasts an hour cannot be
                operated from a settings-shaped panel (§10.4).
       Import   a file you have or a link you can reach — §11.24's two equal
                intakes, unchanged, with §11.25's batch decisions under them.

     `Write` is the default because it is the cheapest and the most frequent.
     An intake whose default is its rarest case makes the common case feel
     like the exception.

     THE QUEUE IS STILL GONE, and that part of the first build was right: it
     was this screen's own list filtered to the objects with no transcript
     yet, drawn a second time with a second set of actions. The rail behind
     this panel is showing those rows now, with their states on them. */
  function contextIntake() {
    var ways = ["Write", "Record", "Import"];
    var way = state.intake || "Write";
    var body;

    if (way === "Write") {
      /* No card and no form. A blank object is a title and a body, and every
         row of chrome between the button and the first word is a reason not to
         have pressed the button. The two decisions that do apply — where it
         lands and whose vocabulary runs — are one line under the editor, not a
         settings block above it. */
      body =
        '<div class="write-head">' +
        field("", { placeholder: "Untitled", cls: "write-title" }) +
        '<span class="write-meta">' + t("Nothing is recorded. What you type and what you dictate both arrive as text.") + "</span>" +
        "</div>" +
        textarea("", "Start typing, or hold Ctrl+Space and talk.", 12) +
        /* A plain key display, not `kbd()`. That one is the hotkey editor —
           it carries a `Change` affordance, which here would offer to rebind
           the dictation shortcut from inside a text editor. */
        '<div class="write-foot">' +
        '<span class="rowflex">' + icon("mic") +
        '<span class="kbd"><kbd>Ctrl</kbd><kbd>Space</kbd></span>' +
        '<span class="muted">' + t("to dictate into it") + "</span></span>" +
        '<span class="right rowflex">' +
        select("Meetings", ["Personal", "Meetings", "Work"]) +
        select("General writing", ["General writing", "Support reply"]) +
        "</span></div>";
    } else if (way === "Record") {
      /* Deliberately almost empty. Everything about a live capture belongs to
         the window that runs it; putting a second copy of those controls here
         would make this the place a meeting is configured and the HUD the
         place it is watched, which is one decision in two rooms. */
      body =
        '<div class="rec-start">' +
        '<button class="mic-btn rec-big" aria-label="Start recording">' + icon("mic") + "</button>" +
        "<b>" + t("Record a meeting") + "</b>" +
        "<p>" + p("Opens the meeting window: your microphone, the system audio, and the note filling in while people talk. It never inserts anything anywhere.") + "</p>" +
        '<div class="rowflex">' + btn("Start recording", null, { icon: "users" }) +
        btn("What it captures", "ghost", { icon: "arrow" }) + "</div>" +
        "</div>" +
        card({
          rows: [
            row({
              label: "Acme — quarterly review",
              hint: "14:00, in 2 h · 4 attendees · from Google Calendar. Recording it fills in the transcript; the object already exists.",
              ctl: btn("Record this", "ghost", { icon: "play" })
            }),
          ]
        }) +
        note("A meeting on a connected calendar is already in the list on the left, with its attendees and the questions the last one left open.", "calendar");
    } else {
      body =
        '<div class="intake">' +
        '<button class="dropzone" data-band>' + icon("upload") +
        '<span class="dz-text"><b>Drop audio or video, or click to browse</b>' +
        "<span>" + p("MP3, WAV, M4A, WebM, OGG, FLAC · up to 25 MiB per file on your Free plan") +
        "</span></span></button>" +
        '<div class="intake-or"><span>' + t("or") + "</span></div>" +
        '<div class="intake-link">' +
        '<label class="intake-link-label">' + icon("link") + t("Paste a link") + "</label>" +
        '<div class="rowflex">' +
        '<span class="search grow">' + field("", { placeholder: "YouTube, podcast episode or direct audio URL" }) + "</span>" +
        btn("Fetch", null, { icon: "download" }) + "</div>" +
        '<p class="intake-hint">' +
        p("WordScript resolves the media stream. Nothing is kept but the audio it needs and the transcript it produces.") +
        "</p></div></div>" +

        card({
          rows: [
            row({
              label: "Speaker detection",
              hint: {
                b: "Separates the transcript by speaker and labels each turn. Costs a second pass over the audio, so leave it off for recordings with one voice.",
                a: "Labels each turn by speaker. A second pass — off for one voice."
              },
              ctl: toggle(true)
            }),
            row({
              label: "Folder",
              hint: "Where the finished object lands.",
              ctl: select("Meetings", ["Personal", "Meetings", "Work"])
            }),
            row({
              label: "Profile",
              hint: "Whose vocabulary and replacements run over every transcript.",
              ctl: select("General writing", ["General writing", "Support reply", "Customer success replies"]) +
                scope("this batch")
            }),
          ]
        }) +

        /* `Write a note` was a fourth decision here and is withdrawn with the
           thing it decided. It asked whether the transcript should also become
           a note — a question that only existed while a transcript and a note
           were two objects. */
        note({
          b: "There were four rows here. “Write a note” is gone: an imported file and the note about it are one object now, so there is nothing left for that switch to decide.",
          a: "“Write a note” is gone — the file and the note about it are one object."
        }, "layers");
    }

    return viewTop({
      title: "Context",
      lead: "Everything you have said, recorded or brought in — and what follows from it.",
      banner: { text: "Planned for V2." },
    }) +
      pane({
        listBody: contextRail(true),
        foot: btn("Record meeting", null, { icon: "users" }),
        path: "~/Documents/WordScript/Meetings",
        title: "New",
        /* THE SEGMENT IS NOT INERT, for the same reason the connection lane is
           not (§11.38): it decides what is being made, so a switch that leaves
           the panel identical would assert the three ways are one thing with
           three names. Second use of `segState` in the prototype. */
        tabs: segState("intake", ways),
        actions: '<button class="btn" data-v="ghost" data-go="context">' +
          icon("arrow") + "Back to reading</button>",
        body: '<div class="note-body intake-body">' + body +
          note("What is running is in the list on the left with its state on the row. There is no second queue: a file being transcribed is a context object without a transcript yet.", "list") +
          "</div>",
      });
  }

  /* ── Actions & templates ────────────────────────────────────────────────
     §11.20 answered where a template lives — Markdown files in `_actions/`
     beside the notes — and put the management of them in Settings → Notes &
     Meetings. That was wrong, and this is the correction (§11.25).

     An action is not configuration. It is a prompt you write, run, read the
     result of, and edit because the result was not what you wanted — a loop
     that happens entirely inside a note. Sending it to a settings section
     breaks the loop at every turn: run it in Notes, judge it in Notes, leave
     Notes to change one line of it, come back, run it again. Settings is for
     what you set once. This is authoring, so it lives where the authoring is.

     BUILT AS A PANEL, NOT A DIALOG. The note is the evidence for whether the
     prompt is right, so it stays visible behind — the same reason Ask is a
     panel. A dialog would cover the only thing that tells you the prompt needs
     changing.

     Built-in actions are readable and runnable but not editable; "Duplicate"
     is how you get an editable one, so the shipped prompt is a starting point
     rather than a black box. Every action states its file, because it IS a
     file: `_actions/meeting-summary.md`, editable in any editor, in git, and
     shareable by sending someone a file. */
  /* TWO KINDS, ONE LIST — ADR 0044, §11.43.

     An action was one thing: a prompt the assistant runs over this object,
     right now, producing text. That covers everything the assistant can do and
     nothing beyond it, and "collect the decisions from these three meetings
     and open a PR" is a sentence people will write into this box.

     So an action declares who runs it, and the two kinds differ in every way
     that matters to the person about to press the button:

       assistant   seconds · produces text · no effects · runs on this object
       desk        minutes · produces effects · runs somewhere else · confirmed
                   by key before it starts

     They stay in ONE list because the user's intent is one intent — "do this
     with what I have here" — and splitting the list would ask them to classify
     their own idea before they can act on it. What must not be shared is the
     button: a desk action starts a process, so it goes through the same keyed
     confirmation a dictated handoff does. `kind` is what the surface reads to
     know which.

     A desk action is also where the assistant and the desk are visibly not
     rivals. It BEGINS at the assistant — gathering the material out of the
     objects is a read, which is exactly what the assistant is allowed to do —
     and hands over an assembled prompt. The desk never had to search for
     anything; that is the division of labour the effect line produces. */
  var ACTIONS = [
    {
      name: "Enhance notes", icon: "sparkle", builtin: true, kind: "assistant",
      desc: "Clean up, structure and enhance what you wrote",
      file: "built-in",
      prompt: "Rewrite the note below as clean prose. Keep every fact and every\nnumber. Remove filler and false starts. Do not add anything that is\nnot in the source."
    },
    {
      name: "Meeting summary", icon: "users", builtin: true, kind: "assistant",
      desc: "Decisions, owners and open questions",
      file: "built-in",
      prompt: "From the transcript and notes below, produce: Decisions, Action\nitems with an owner each, and Open questions. Omit a heading that\nwould be empty."
    },
    {
      name: "Standup from notes", icon: "list", kind: "assistant",
      desc: "Yesterday, today, blockers",
      file: "_actions/standup-from-notes.md",
      prompt: "Turn the note into a standup update with exactly three headings:\nYesterday, Today, Blockers. One line per item. Write nothing under\nBlockers if there are none — omit the heading."
    },
    {
      name: "Kundenanfrage beantworten", icon: "type", kind: "assistant",
      desc: "German support reply in the client register",
      file: "_actions/kundenanfrage-beantworten.md",
      prompt: "Beantworte die Anfrage unten auf Deutsch, in der Sie-Form.\nFreundlich, knapp, ohne Floskeln. Nenne einen konkreten nächsten\nSchritt. Erfinde keine Zusagen zu Terminen oder Preisen."
    },
    {
      name: "Turn this into a PR", icon: "handoff", kind: "desk",
      desc: "Collect the decisions, hand them to the desk, open a pull request",
      file: "_actions/turn-this-into-a-pr.md",
      target: "WordScript", role: "work",
      prompt: "Read the decisions and tasks on the objects I selected. Write them\nup as a change description, then implement it in the target and open\na pull request. Ask me before touching anything outside src/."
    },
    {
      name: "Follow up by mail", icon: "mail", kind: "desk",
      desc: "Draft and send the follow-up to everyone who was in the meeting",
      file: "_actions/follow-up-by-mail.md",
      target: "General", role: "work",
      prompt: "Take the summary and the open questions from this meeting. Write one\nfollow-up mail per attendee with only the parts that concern them.\nShow me each mail before sending it."
    },
  ];

  /* THE THIRD MEMBER OF THE WINDOW FAMILY.
     Built first as a panel docked to the note's right edge, and corrected: Ask
     is a small always-on-top window (§11.20) and this is reached the same way,
     from a button beside it, so it has to BE the same thing. Two overlays that
     open from adjacent buttons and behave differently — one docked and modal-
     ish, one floating and movable — teach two rules for one gesture.

     Same chrome: OS-drawn decoration (ADR 0003), a title, a close control, a
     resize grip. Wider than Ask because it holds a list beside an editor and
     Ask holds a column of turns; movable and resizable for the same reason
     Ask is — the note underneath is the evidence, and you have to be able to
     get it out of the way of the part you are looking at. */
  function actionsPanel() {
    /* The selected one is the desk action, because that is the half of this
       window that is new and the half whose extra fields have to be visible. */
    var sel = ACTIONS[4];
    var desk = sel.kind === "desk";

    return '<div class="chatwin actionswin">' +
      '<div class="chatwin-deco"><b>' + t("Actions") + "</b>" +
      '<span class="win-sub">' + t("6 · 2 built-in · 2 run on " + DESK) + "</span>" +
      "<button aria-label='Close actions'>" + icon("x") + "</button></div>" +

      '<div class="actions-body">' +
      /* ONE LIST, TWO KINDS, AND THE RULE BETWEEN THEM.
         §11.30 established the shape: when a control offers entries from two
         categories, a 1 px rule marks the boundary and the control stays one
         control. It is the same situation and the same answer — the entries
         are all "things I can run on this", and two of them run somewhere
         else, for minutes, with effects. */
      '<div class="actions-list">' +
      ACTIONS.filter(function (a) { return a.kind !== "desk"; }).map(function (a) {
        return actionRow(a, a === sel);
      }).join("") +
      '<div class="actions-rule"><span>' + t("Runs on " + DESK) + "</span></div>" +
      ACTIONS.filter(function (a) { return a.kind === "desk"; }).map(function (a) {
        return actionRow(a, a === sel);
      }).join("") +
      '<button class="action-new">' + icon("plus") + t("New action") + "</button>" +
      "</div>" +

      '<div class="actions-edit">' +
      '<div class="field-wrap"><label>' + t("Name") + "</label>" +
      field(sel.name) + "</div>" +
      '<div class="field-wrap"><label>' + t("Description") + "</label>" +
      field(sel.desc) + "</div>" +

      /* WHO RUNS IT is the first decision, not a detail under the prompt: it
         changes what the prompt may ask for, how long it takes, and whether
         anything happens outside this window. Written as a segment because it
         is genuinely two options and both are legitimate. */
      '<div class="field-wrap"><label>' + t("Runs on") + "</label>" +
      seg(["The assistant", DESK_CAP], desk ? DESK_CAP : "The assistant") + "</div>" +

      (desk
        ? '<div class="actions-desk">' +
        '<div class="field-row">' +
        '<div class="field-wrap grow"><label>' + t("Target") + "</label>" +
        select(sel.target, ["General", "WordScript", "dotfiles", "sw-forge-org"]) + "</div>" +
        '<div class="field-wrap grow"><label>' + t("Role") + "</label>" +
        select(sel.role, ["inspect", "work", "resume"]) + "</div>" +
        "</div>" +
        '<p class="note">' + icon("handoff") +
        "<span>" + p("What the assistant collects out of the selected objects is assembled into the prompt below and handed over. Reading is the assistant's half; the desk never searches for anything.") +
        "</span></p>" +
        "</div>"
        : "") +

      '<div class="field-wrap"><label>' + t("Prompt") + "</label>" +
      textarea(sel.prompt, desk ? "What should the desk do, and with what?" : "What should the model do with this object?", 7) + "</div>" +
      '<p class="note">' + icon("file") +
      "<span>" + t(sel.file) + " — " +
      p("a file in the notes folder. Edit it here or in your editor; it is the same file.") +
      "</span></p>" +

      '<div class="actions-foot">' +
      (desk
        /* The button says what will happen and states that it is not the last
           step. ADR 0030 puts a visible keyed confirmation before anything a
           process does in a real repository, and an action is not exempt from
           it just because the prompt was written in advance rather than
           dictated — if anything it is further from the user, not closer. */
        ? btn("Hand over…", null, { icon: "handoff" })
        : btn("Run on this object", null, { icon: "play" })) +
      btn("Duplicate", "ghost", { icon: "copy" }) +
      '<span class="right">' + iconBtn("Delete action", "trash", { tone: "danger" }) + "</span>" +
      "</div></div></div>" +
      '<span class="hud-resize" aria-hidden="true"></span></div>';
  }

  function actionRow(a, on) {
    return '<button class="action-row" aria-current="' + (on ? "true" : "false") + '">' +
      icon(a.icon) + '<span class="action-text"><b>' + t(a.name) + "</b>" +
      "<span>" + p(a.desc) + "</span></span>" +
      (a.builtin ? '<span class="badge" data-tone="plan">Built-in</span>' : "") +
      "</button>";
  }

  /* SCREENS.upload was removed on 2026-08-03 (ADR 0045, §11.41). Upload is not
     a place: it is one of the ways a context object comes into existence, and
     the object it produced was already the same type as a meeting note. What
     it carried lives on as `contextIntake()` — the same dropzone, the same
     link field, the same batch decisions — with its queue deleted rather than
     moved, because the queue was this product's object list filtered to the
     rows that have no transcript yet, drawn twice. `SCREENS.upload` still
     resolves, to the intake, so a deep link survives (§4.3).
     The workspace list drops from 5 entries to 4. */

  /* Content parity with the shipped ChatArea: the local-context label, per-turn
     copy, send states including failure, the typing indicator, the empty state
     and the two boundaries it states (voice input reuses the dictation hotkey;
     messages are not persisted). */
  /* SCREENS.chat was removed on 2026-08-03. Chat is no longer a place to go: it
     is a panel inside Notes, because every question it can answer is about
     something you are already looking at, and a top-level entry made you leave
     the note to ask about the note. Everything it carried survives the move —
     an answer names the rows it read, voice input is the dictation hotkey and
     not a second recording path, and nothing is persisted. See SCREENS.notes.
     The workspace list drops from 7 entries to 5. */

  /* ── Settings: Integrations ────────────────────────────────────────────
     REBUILT AND CUT, 2026-08-03 — §11.49. It had grown to eight sections and
     roughly 2000 words, and the review verdict was the right one: nobody reads
     it, and the information was unstructured rather than merely long.

     Two faults, and the second is the instructive one.

     THE PROSE WAS DOING THE STRUCTURE'S JOB. Every row carried a sentence
     arguing for itself, because the screen had no shape that made the rows
     mean anything on their own. Once the three classes are a table at the top,
     a row only has to say what it is — the class it sits under already says
     what it can do, who runs it and what it costs. Around 1100 words came out
     and no fact went with them.

     ONE SECTION BELONGED TO ANOTHER SCREEN. "Where the text lands" answered
     how a finished transcript reaches the focused app, which is exactly what
     Delivery & Insert is for, in more detail and with the live driver chain
     beside it. Two screens answering one question is the failure §11.7 was
     written about; the section is gone rather than moved, because the other
     one already had it.

     ADR 0046 gives the shape: intake reads, bridge answers, reach writes. The
     two MCP surfaces §10.1 raised are both under bridge, and the open question
     between them is still stated in the row where it is spent. */
  SCREENS.integrations = function () {
    return [
      viewTop({
        title: "Integrations",
        lead: "What reaches WordScript, and what reaches out for you.",
        banner: { text: "Planned for Phase 8. No port is open." },
      }),

      /* The table is the screen's argument and it replaces most of its former
         prose: one question sorts every entry, present and future. */
      sec("Three kinds, and one question sorts them", "Does it write anywhere?",
        card({
          body: '<div class="klass">' +
            /* Three columns, and a fourth was cut. It carried an example per
               class — `Calendar`, `ask · await`, `Mail · issues` — which the
               three sections directly below already are. At the sheet's 640 px
               it took the `what` column down to about 220 px and wrapped every
               row to three lines, so the table meant to be read at a glance
               was the tallest thing on the screen. */
            [["intake", "Reads. What it reads is why a context object exists.", "WordScript"],
             ["bridge", "Answers a call from something else.", "WordScript"],
             ["reach", "Writes something, somewhere, for you.", DESK_CAP]]
              .map(function (k) {
                return '<div class="klass-row" data-k="' + esc(k[0]) + '">' +
                  '<span class="klass-name">' + t(k[0]) + "</span>" +
                  '<span class="klass-what">' + p(k[1]) + "</span>" +
                  '<span class="klass-who">' + t(k[2]) + "</span></div>";
              }).join("") + "</div>"
        })
      ),

      sec("Intake · Calendar", "The only source of a speaker's name, and the only intake there is.",
        '<div class="conn-list">' +
        conn({
          icon: "calendar", name: "Google Calendar",
          desc: "Reads the calendars you pick. Never writes.",
          accounts: ["felix@sw-labs.dev", "felix@wordscript.app"],
          action: btn("Add account", "ghost", { icon: "plus" })
        }) +
        conn({
          icon: "calendar", name: "Apple Calendar",
          desc: "Local calendars through EventKit. Nothing leaves the machine.",
          state: { text: "macOS only", tone: "plan" },
          action: btn("Connect", null, { disabled: true })
        }) +
        conn({
          icon: "server", name: "CalDAV",
          desc: "Fastmail, Nextcloud, iCloud by URL, or any server that speaks it.",
          action: btn("Connect", null, { disabled: true })
        }) +
        "</div>" +
        card({
          rows: [
            row({
              label: "What it gives a meeting",
              hint: "A name, a time, attendees and the questions the last one left open — before it starts.",
              ctl: btn("Open Context", "ghost", { icon: "arrow" })
            }),
            row({
              label: "No calendar view",
              hint: "A scheduled meeting is a row in Context. A month grid here would hold nothing that row does not.",
              ctl: badge("By design", "plan")
            }),
          ]
        })
      ),

      sec("Bridge · What can call in", "Two surfaces and a command line, all on loopback.",
        card({
          rows: [
            row({ label: "Address", ctl: '<span class="mono muted">127.0.0.1 · port assigned at start</span>' }),
            row({
              label: "Token",
              hint: "Bearer token, plus Origin rejection. Rotating it disconnects every client.",
              ctl: '<span class="rowflex">' + badge("Not issued", "plan") + btn("Generate", null, { disabled: true }) + "</span>"
            }),
            stackRow({
              label: "Port file",
              hint: "Written at start, so a client finds the port without being configured.",
              body: cmd("~/.local/state/wordscript/mcp.port")
            }),
          ]
        }) +
        /* The two surfaces side by side rather than as two sections of rows.
           They differ in exactly three ways, and a table shows three
           differences in the space two sections spent introducing themselves.
           §10.1's open question lives in the row it is spent in. */
        card({
          body: '<div class="srvl">' +
            [["Agent bridge", "ask · await", "Lets a running agent ask you out loud and wait.", "One client — " + DESK, "yes"],
             ["Transcripts & notes", "history.search · notes.read · vocabulary.list", "Lets an MCP client you configure read what is here.", "Any client you configure", "no"]]
              .map(function (r) {
                return '<div class="srv-row"><div class="srv-head"><b>' + t(r[0]) + "</b>" +
                  '<span class="mono">' + t(r[1]) + "</span></div>" +
                  '<p>' + p(r[2]) + "</p>" +
                  '<div class="srv-meta">' + badge(r[3], "plan") +
                  badge(r[4] === "yes" ? "can speak to you" : "cannot speak to you",
                    r[4] === "yes" ? "accent" : "success") +
                  "</div></div>";
              }).join("") + "</div>",
          rows: [
            row({
              label: "How the two are kept apart",
              hint: "Undecided. A note reader must not end up holding a token that also reaches ask.",
              ctl: badge("Open decision", "warning")
            }),
          ]
        }) +
        /* MCP is for processes, the CLI is for people. ADR 0030 rejected a CLI
           as an agent transport with evidence (sandboxes block loopback); this
           states what is left, which is the surface for the user who happens
           to be in a terminal. */
        card({
          title: "Command line",
          desc: "For you, in your own shell. Not a second way for an agent to call in.",
          body: '<div class="stack gap2">' +
            cmd("brew install wordscript   ·   npm i -g @wordscript/cli") +
            cmd("wordscript context search \"budget\" --since 30d") +
            cmd("wordscript notes export --format md > standup.md") +
            "</div>",
          rows: [
            row({ label: "Discovery", hint: "Reads the port file.", ctl: badge("Automatic", "success") }),
            row({
              label: "Not for agents",
              hint: "Their sandboxes block loopback, so a CLI call fails as an unexplained command error. Agents use MCP, which sits outside it.",
              ctl: badge("People only", "plan")
            }),
            row({ label: "Dictating from it", hint: "Not offered. The microphone belongs to whoever is at the keyboard.", ctl: badge("By design", "plan") }),
          ]
        })
      ),

      sec("Reach · What " + DESK + " can do for you", "Configured there, not here.",
        card({
          rows: [
            row({
              label: "Where they live",
              hint: DESK_CAP + " is an agent CLI with its own MCP client. WordScript reads that configuration and shows it.",
              ctl: btn("Open Agents", "ghost", { icon: "arrow" })
            }),
            row({
              label: "Typical ones",
              ctl: '<span class="mono muted">Gmail · Calendar · GitHub · Notion · Linear</span>'
            }),
            row({
              label: "No second door",
              hint: "No way to add one here. A connector configured in two places is a connector that disagrees with itself.",
              ctl: badge("By design", "plan")
            }),
          ]
        })
      ),

      sec("Deliberately absent", "Named so it is not looked for.",
        card({
          rows: [
            row({ label: "Per-repository setup", hint: "Nothing to paste into a repo. " + DESK_CAP + " is the only client.", ctl: badge("By design", "plan") }),
            row({ label: "Remote access", hint: "Loopback only. No tunnel, no account to hang one on.", ctl: badge("By design", "plan") }),
            row({ label: "Editor plugins", hint: "Insert already works in every focused app.", ctl: btn("Open Delivery", "ghost", { icon: "arrow" }) }),
          ]
        })
      ),
    ].join("");
  };

  /* ── Settings: General ──────────────────────────────────────────────── */

  /* Everything on this screen belongs to the machine. Recording limits and the
     workspace-context switch used to sit here and are per-profile in the
     runtime, so they moved to Profiles → Defaults; what is left is the
     microphone, the cues and where the overlay opens. */
  SCREENS.general = function () {
    return [
      viewTop({ title: "General", lead: "Microphone, sound and where the overlay appears." }),

      sec("Microphone", null, card({
        rows: [
          row({
            label: "Input device",
            hint: "Next capture will use Yeti Nano Analog Stereo.",
            ctl: '<span class="rowflex">' + select("Yeti Nano Analog Stereo — default", ["System default microphone", "Yeti Nano Analog Stereo — default", "HD Pro Webcam C920"]) +
              btn("Rescan", "ghost", { icon: "restore" }) + "</span>"
          }),
          stackRow({
            label: "Input level",
            hint: {
              b: "Measured live while you dictate. A capture whose loudest moment never crosses the marked threshold is discarded as empty — which is what a microphone set too quietly looks like. Set the level for this microphone in your system sound settings; WordScript never changes it, because that setting is shared with every other app using the same microphone.",
              a: "A capture that never crosses the mark is discarded as empty."
            },
            /* The waveform sits above the bar, in that order, because the
               shape is what you look at while you talk and the threshold is
               what you check afterwards. Reversing them puts the decision
               boundary where the eye is during the only moment it is not
               being read. */
            body: waveform({ kind: "input", label: "Live input, last few seconds" }) +
              level(62, 74, 34, "ok", "Good — peak −13 dBFS.") +
              (function () {
                var s = p({ b: "", a: "Set the level itself in your system sound settings — it is shared with every app using this microphone." });
                return s ? '<p class="note">' + icon("about") + "<span>" + s + docLink("Why not here") + "</span></p>" : "";
              })()
          }),
        ]
      })),

      sec("Sound", null, card({
        desc: {
          b: "Audio cues report what the runtime is actually doing: listening, handing off to the pipeline, and confirming that text landed.",
          a: "Cues report what the runtime is doing, not what it is about to do."
        },
        rows: [
          row({ label: "Play sound cues", ctl: toggle(true) }),
          row({ label: "Sound pack", hint: "All four play the same motif, so a cue stays recognisable across packs.", ctl: select("Timber — warm mallet", ["Timber — warm mallet", "Glass — soft bell", "Air — breath", "Tap — short and dry"]) }),
          row({
            label: "Cue volume",
            hint: {
              b: "How loud the cues are within WordScript. How loud WordScript is against other apps stays yours to set in the system mixer, where it appears as its own entry — the two are deliberately separate, the same way Discord, Slack or Spotify handle it.",
              a: "Within WordScript. App volume stays in the system mixer."
            },
            ctl: slider(70)
          }),
          row({ label: "Play the signature at launch", hint: "The full G-major theme, once when WordScript starts. The cues are fragments of it.", ctl: toggle(false) }),
          stackRow({
            label: "Hear them",
            hint: {
              b: "Plays through the native runtime, so this is exactly what you will hear in use — also while cues are switched off.",
              a: "Played by the runtime, so this is what you will hear. Works with cues off."
            },
            body: '<div class="rowflex">' +
              ["Startup", "Listen", "Handoff", "Done", "Abort", "Error"].map(function (c) {
                return btn(c, "ghost", { icon: "play" });
              }).join("") + "</div>"
          }),
        ]
      })),

      /* The shipped tab shows Display and Anchor whether or not they do
         anything; in "remember last drag" they are inert and still look
         settable. A control that cannot act is not shown. */
      sec("Overlay", null, card({
        desc: {
          b: "Pick one default: either reopen the overlay where you last dragged it, or pin it to a chosen display anchor.",
          a: "Reopen where you dragged it, or pin it to a display anchor."
        },
        rows: [
          row({ label: "Placement", ctl: select("Use preset display anchor", ["Remember last drag position", "Use preset display anchor"]) }),
          row({ label: "Display", ctl: select("DP-1 (2560×1440) — primary", ["DP-1 (2560×1440) — primary", "HDMI-A-1 (1920×1080)"]) }),
          row({
            label: "Anchor",
            hint: "Kept on DP-1 at bottom center until you drag it somewhere else.",
            ctl: select("Bottom center", ["Top left", "Top center", "Top right", "Left center", "Right center", "Bottom left", "Bottom center", "Bottom right"])
          }),
          row({
            label: "Result overlay stays for",
            hint: {
              b: "How long the result overlay stays visible in seconds (1–60) before auto-dismissing. Editing the transcript pauses the timer.",
              a: "Editing the transcript pauses the timer."
            },
            ctl: stepper(12, "s")
          }),
        ]
      })),

      note("Auto-stop, stop after silence and workspace context belong to the profile, not to this machine. The processing limit is stated there too — it follows the provider and account plan.", "profiles",
        docLink("Open Profiles → Defaults")),
    ].join("");
  };

  /* ── Settings: Notes & Meetings (preview) ───────────────────────────────
     Added 2026-08-03. Four things had no home and were being implied by
     surfaces that could not configure them: where notes are written, what the
     actions in the note's action bar are, what a meeting capture records, and
     which speech engine transcribes an hour of meeting rather than a sentence
     of dictation.

     THE ACTIONS ARE THE TEMPLATE ANSWER. The meeting HUD's bar offers "Sync
     template", and a template has to live somewhere. The donor already
     answers this and the answer is better than a template file: OpenWhispr's
     `ActionPicker` is a split button whose menu lists user-editable **actions**
     — a name, a description and a prompt each — with "Manage actions" at the
     foot of the menu (`src/components/notes/ActionPicker.tsx`,
     `ActionManagerDialog.tsx`). Last used becomes the default button. Borrowed
     whole, with one WordScript change: OpenWhispr keeps actions in SQLite, and
     since notes here are files under a real directory, the actions are files
     beside them. A prompt you can read in your editor and put in git is worth
     more than a row in a database nobody can see.

     THE MEETING LANE IS SEPARATE FROM THE DICTATION LANE, and that is not an
     invention either: the donor carries a full parallel set of transcription
     settings for meetings (`MeetingSettings.tsx` — meetingTranscriptionMode,
     meetingWhisperModel, meetingCloudTranscriptionProvider, and the rest).
     The reason is in the workload: dictation is seconds of one voice and wants
     the fastest lane; a meeting is an hour of several voices and wants a lane
     that streams and separates them. One setting cannot be right for both. */
  SCREENS.notesettings = function () {
    return [
      viewTop({
        title: "Notes & Meetings",
        lead: "Where notes are written, what can be made from them, and what a meeting records.",
        banner: { text: "Planned for V2. Nothing is written to disk yet." },
      }),

      sec("Where notes live", "Notes are Markdown files. A folder in the sidebar is a directory here.",
        card({
          rows: [
            stackRow({
              label: "Notes folder",
              hint: {
                b: "Every note is a Markdown file under this folder, and every folder in the Notes sidebar is a real directory inside it. Moving the folder moves the files with it.",
                a: "Moving this moves the files with it."
              },
              body: '<div class="rowflex">' + cmd("~/Documents/WordScript") + "</div>"
            }),
            row({
              label: "Change folder",
              hint: "Picks a new location and moves what is already there.",
              ctl: btn("Choose…", null, { icon: "folder" })
            }),
            row({
              label: "File name",
              hint: "How a new note is named before you rename it.",
              ctl: select("2026-06-21 Standup.md", ["2026-06-21 Standup.md", "Standup.md", "standup-2026-06-21.md"])
            }),
            row({
              label: "If a file changes outside WordScript",
              hint: "The folder is yours — an editor, a sync client or a script may write into it.",
              ctl: select("Reload the note", ["Reload the note", "Ask", "Keep what is open"])
            }),
          ]
        })
      ),

      /* Straight from the donor's ActionPicker: name, description, prompt.
         The last one used is what the bar's main button runs. */
      sec("Actions", "What the button at the foot of a note can make from it.",
        card({
          body: '<div class="list">' +
            [["Sync template", "Format using the team template", "Last used"],
            ["Meeting summary", "Summarize decisions and actions", null],
            ["Email draft", "Draft the follow-up email", null]]
              .map(function (a) {
                return listItem({
                  title: a[0], meta: [a[1]],
                  state: a[2] ? { text: a[2], tone: "warning" } : null,
                  actions: [btn("Edit prompt", "ghost"), btn("Delete", "ghost", { icon: "trash" })]
                });
              }).join("") + "</div>",
          foot: btn("New action", null, { icon: "plus" }) +
            '<span class="muted">Stored as Markdown beside your notes, in <span class="mono">_actions/</span></span>'
        })
      ),

      sec("Meeting capture", "A second capture type: longer, two audio sources, and it inserts nothing.",
        card({
          rows: [
            row({
              label: "Meeting hotkey",
              hint: "Its own key. Dictation and meeting capture must never be the same press — one inserts and one does not.",
              ctl: kbd(null)
            }),
            row({
              label: "When a call is detected",
              hint: "Offered in a window rather than an OS notification, so it is visible in Focus mode and absent from a screen share.",
              ctl: select("Ask", ["Ask", "Start recording", "Do nothing"])
            }),
            row({
              label: "Record system audio",
              hint: "Everyone else, as this machine plays them. No participant joins the call.",
              ctl: toggle(true, { disabled: true })
            }),
            row({
              label: "Echo cancellation",
              hint: "The microphone hears the speakers, so every remote voice arrives twice. Removed before transcription.",
              ctl: toggle(true, { disabled: true })
            }),
            row({
              label: "Separate speakers",
              hint: "Labelled as the call runs and re-clustered when it ends.",
              ctl: toggle(true, { disabled: true })
            }),
            row({
              label: "Expected speakers",
              hint: "Set it if you know it. Auto-detect is the default and is usually right for two.",
              ctl: stepper(2, null)
            }),
            row({
              label: "Keep the audio",
              hint: "An hour of meeting is a different size of promise than a failed dictation. Undecided.",
              ctl: '<span class="rowflex">' + badge("Open decision", "warning") +
                select("Until the note is saved", ["Until the note is saved", "7 days", "Never"]) + "</span>"
            }),
          ]
        })
      ),

      /* The meeting speech engine stood here until 2026-08-03 and repeated
         Speech-to-Text's rows to say the same thing in a different place —
         one of the five screens §11.34 found that could each set a model. It
         is a model setting, so it is a row in AI Models like every other. What
         stays here is what a meeting RECORDS, which is a capture question and
         belongs to the surface that captures. */
      sec("Speech engine for meetings", "A different workload from a dictation, and it has its own row.", card({
        rows: [
          row({
            label: "Engine",
            hint: {
              b: "Dictation is seconds of one voice and wants the fastest lane. A meeting is an hour of several voices and wants one that streams and separates them. They are two rows in one list rather than two settings in two places.",
              a: "Its own row, beside the dictation engine. One list, not two places."
            },
            ctl: '<span class="rowflex">' + badge("whisper-large-v3", "plan") +
              '<button class="btn" data-v="ghost" data-go="models">' + icon("arrow") + "AI Models</button></span>"
          })
        ]
      })),

      /* Corrected 2026-08-03 by ADR 0040. This pointed at a Notes tab that
         held a model of its own. There is no such tab and no such model: the
         summary, the action and the answer are the assistant that Draft is,
         which is what lets an action say "draft the mail from this meeting"
         and have the same thing that would have written it from a dictation
         write it from the note. */
      note("The model that writes a summary, runs an action or answers in Ask is the assistant — the same one Draft uses in a dictation. One setting, one place.", "models",
        docLink("Open AI Models → The assistant")),
    ].join("");
  };

  /* ── Settings: Hotkeys ──────────────────────────────────────────────── */

  SCREENS.hotkeys = function () {
    /* Translate joined the axis on 2026-08-03 (ADR 0041) and took the seventh
       slot rather than displacing one. The shipped defaults run Alt+1..6, so a
       seventh mode is the first one that arrives without a default binding —
       which is stated on its row rather than papered over with Alt+7, because
       the number of digits a modifier row can carry is a real limit and the
       eighth mode will hit it harder. */
    var modes = [["Auto", "Alt+1"], ["Verbatim", "Alt+2"], ["Cleanup", "Alt+3"],
    ["Rewrite", "Alt+4"], ["Translate", null], ["Draft", "Alt+5"], ["Prompt Enhance", "Alt+6"]];
    return [
      viewTop({ title: "Hotkeys", lead: "Every key WordScript listens for, in one place." }),

      /* A shortcut the OS refused is the single most expensive silent failure
         in the product: nothing happens, and nothing says why. The shipped tab
         states it per row and this keeps that, as a badge beside the caps
         rather than a sentence under them. */
      sec("Capture", null, card({
        rows: [
          row({
            label: "Dictate", hint: "Starts and stops a capture, in any app.",
            ctl: '<span class="rowflex">' + badge("Registered", "success") + kbd("Ctrl+Super") + "</span>"
          }),
          row({
            label: "Pause", hint: "Holds the capture without ending the session.",
            ctl: '<span class="rowflex">' + badge("Registered", "success") + kbd("Ctrl+Space") + "</span>"
          }),
          row({
            label: "Abort", hint: "Discards the capture. Nothing is transcribed or inserted.",
            ctl: '<span class="rowflex">' + badge("Taken by the desktop", "danger") + kbd("Ctrl+Alt") + "</span>"
          }),
          row({
            label: "Activation",
            hint: {
              b: "Tap starts and stops on the same shortcut. Repeated presses within 300 ms of the same kind are debounced. Because this shortcut is modifier-only, every single press acts — which also takes that combination away from other applications. Double tap avoids that.",
              a: "Ctrl+Super is modifier-only, so every press acts — and other apps lose it. Double tap avoids that."
            },
            ctl: seg(["Tap", "Double tap", "Hold"], "Tap")
          }),
        ]
      })),

      sec("Modes", "One key per mode, plus a key that opens the picker.", card({
        rows: [row({
          label: "Mode select",
          hint: {
            b: "Opens the overlay mode selector; press again to cycle. Leave empty to disable.",
            a: "Opens the picker; press again to cycle."
          },
          ctl: kbd("Alt+S")
        })].concat(modes.map(function (m) {
          return row({ label: m[0], ctl: kbd(m[1]) });
        }))
      })),

      sec("Mode-select overlay", null, card({
        rows: [row({
          label: "Picker stays for",
          hint: {
            b: "How long the mode-select overlay stays visible in seconds (1–30) after the first hotkey press before auto-dismissing. Press the hotkey again to cycle through modes.",
            a: "Press the key again to cycle while it is open."
          },
          ctl: stepper(4, "s")
        })]
      })),

      /* One closing note, not two. The other one explained why the mode keys
         are on Alt rather than Ctrl, which is history: it belongs in the ADR
         that decided it, not under a list of keys that already work. This one
         stays because it is the thing the badges above cannot say for
         themselves — that a refusal is reported rather than swallowed. */
      note("Linux · X11 — the desktop registers global shortcuts; a combination another app already holds is reported here, never silently dropped.", "keyboard",
        docLink("Why the mode keys are on Alt")),
    ].join("");
  };

  /* ═══ AI MODELS — ONE SECTION ═════════════════════════════════════════════
     Rebuilt 2026-08-03, and this is the second rebuild in one pass. Both the
     fault and the wrong fix are recorded in §11.34, because the wrong fix is
     the instructive one.

     WHAT WAS WRONG. A model could be set in five places: Speech-to-Text, five
     tabs of Language Models, the meeting engine on Notes & Meetings, the voice
     preset on Agents, and the local checks that named a model they could not
     install. Every one of them was individually defensible and the total was
     not usable — the answer to "which model is doing this" required opening
     four screens and knowing which one wins.

     THE WRONG FIX WAS A THIRD SCREEN. `Providers & Keys` was added to hold the
     credentials the other two shared, which made three screens listing the
     same providers instead of two, and left the actual gap — no way to install
     a local model — untouched.

     WHAT IT IS NOW. One section. One connection, stated once, used by
     everything. One list of every job that runs a model, each row showing what
     it uses and opening to its own settings. One tab for what is installed on
     this machine, because an installation is shared and is not a credential.

     WHY NOT THE DONOR'S TWO SECTIONS. OpenWhispr divides speech from language
     at the top level, and that is right for OpenWhispr: its speech section
     carries a whole local-model manager, a VAD panel, GPU selection and three
     consumer tabs, and its LLM section carries five scopes. Ours does not.
     Split the same way here, the speech side would be one engine row and a
     language picker, and the language side five near-identical rows — two
     screens whose combined content is one screen's worth, joined by the fact
     that they take the same four settings from the same providers. The
     division earns its keep at OpenWhispr's size and does not at ours.

     WHAT THE DIVISION IS INSTEAD: **one model per JOB**, and the jobs are
     grouped by what they do to sound and text — listening, writing, speaking.
     That is the question a user actually arrives with. */

  var PROVIDERS = [
    { name: "Groq", lane: "Cloud", stt: true, llm: true, key: true, desc: "Speech and language. The fastest lane, and today's default for both." },
    { name: "OpenAI", lane: "Cloud", stt: true, llm: true, key: true, desc: "Speech and language." },
    { name: "Anthropic", lane: "Cloud", stt: false, llm: true, key: true, desc: "Language only. No speech recognition." },
    { name: "Gemini", lane: "Cloud", stt: false, llm: true, desc: "Language only." },
    { name: "Mistral", lane: "Cloud", stt: true, llm: true, desc: "Speech and language." },
    { name: "xAI", lane: "Cloud", stt: true, llm: false, desc: "Speech only." },
    { name: "OpenRouter", lane: "Cloud", stt: false, llm: true, desc: "One key, many models. Reaches providers with no adapter of their own." },
    { name: "AWS Bedrock", lane: "Enterprise", stt: false, llm: true, desc: "Access key, secret and region — or the ambient AWS credential chain." },
    { name: "Azure OpenAI", lane: "Enterprise", stt: true, llm: true, desc: "Endpoint, deployment and key. The deployment name is the model id." },
    { name: "GCP Vertex AI", lane: "Enterprise", stt: false, llm: true, desc: "Service account JSON, project and location." }
  ];

  function providerNames(cap, lane) {
    return PROVIDERS.filter(function (p) { return p[cap] && (!lane || p.lane === lane); })
      .map(function (p) { return p.name; });
  }

  /** A downloadable model row, shared by Settings and onboarding — the same
      reason `providerPick()` is shared. Onboarding's local lane needs real
      download controls, not a select that names files it cannot fetch, and a
      second implementation of the same row would drift from this one.

      The state decides the control: not installed -> download; installing ->
      progress and cancel; installed -> use it or remove it. The size is stated
      before the download rather than discovered during it, because the size is
      the fact that decides whether you want it. */
  function modelRow(o) {
    var st = o.state || "available";
    var act = st === "installed"
      ? '<span class="rowflex">' + (o.active ? badge("In use", "success") : btn("Use", "ghost")) +
      iconBtn("Remove " + o.name, "trash", { tone: "danger" }) + "</span>"
      : st === "downloading"
        ? '<span class="rowflex"><span class="dl"><i style="width:' + (o.pct || 0) + '%"></i></span>' +
        '<span class="muted mono">' + t((o.pct || 0) + "%") + "</span>" + iconBtn("Cancel", "x") + "</span>"
        : btn("Download", "ghost", { icon: "download" });
    return '<div class="mdl" data-state="' + st + '">' +
      '<span class="mdl-mark">' + (brand(o.brand) || icon("models")) + "</span>" +
      '<div class="mdl-text"><b>' + t(o.name) + "</b>" +
      '<span class="mdl-meta">' + t(o.size) + " · " + t(o.detail) + "</span></div>" +
      '<div class="mdl-ctl">' + act + "</div></div>";
  }

  /** The provider picker, shared by Settings and onboarding.
      The donor does the same — its onboarding renders `TranscriptionModelPicker`,
      the very component the settings page uses, rather than a simplified twin.
      A setup flow that draws its own version of a control teaches the wrong
      surface: the user learns a screen they will never see again, and the two
      drift the first time one is edited.

      THIRTEENTH PASS — SEVEN TILES BECAME ONE ROW.

      This was a `provgrid`: seven tiles on a 152 px minimum track, three to a
      row, spending three rows of surface to state one value. It was built that
      way to answer the "dropdowns eat space" complaint, and it answered it by
      eating more — a grid is not the opposite of a dropdown, it is a dropdown
      with every option permanently unfolded. What the complaint was actually
      about is that a bare `<select>` throws away the two facts that make a
      provider picker worth looking at: whose logo it is, and what it can run.

      So neither. A row, in the grammar every other setting on this surface
      already uses, whose control carries the mark beside the name — the same
      `selmark` + `select` pairing the per-job override rows use one card
      below. The connection and its overrides finally read as one control
      appearing twice rather than as two unrelated designs for one decision.

      THE CAPABILITY LINE SURVIVES, AND IT MOVES TO WHERE IT DECIDES SOMETHING.
      On a tile, "speech · language" was a permanent caption under a name; as
      the row's hint it is a sentence about the provider you have actually
      chosen, and it can say the thing the tiles could not — that picking a
      language-only provider leaves the listening jobs somewhere else.

      FOURTEENTH PASS — THE MARKS COME BACK, THE GRID DOES NOT.
      Owner's decision on 2026-08-04: the providers are to be seen, not opened.
      That is not a reversal of the paragraphs above, and the distinction is the
      whole design. What was removed was a GRID: seven tiles on a 152 px track,
      three rows of surface, each tile carrying a name, a caption and a
      readiness check. What replaces the select is a CHIP ROW: one line per
      four or five providers, each chip a mark and a name at row height, wrapping
      when it must. It states the same one value the select stated and costs one
      to two rows instead of three, and unlike the select it answers "who can I
      even pick" without a click — which is the actual reason a logo is worth
      space here.

      The chip is a radio, not a button. Exactly one is on, the group is a
      `radiogroup`, and the accent marks the chosen one because that is what the
      accent means (DESIGN_SYSTEM: primary action, active selection, live
      capture). The marks keep their brand tint: recognition is the entire
      point, and a row of grey logos is a row of shapes.

      THE CAPABILITY LINE STILL BELONGS TO THE CHOSEN ONE. It stays the row's
      hint and is not repeated per chip — a caption under every chip is the tile
      caption again, and it would say "speech and language" nine times to tell
      you one thing about the one you picked. */
  function providerPick(lane, selected, opts) {
    opts = opts || {};
    var here = PROVIDERS.filter(function (p) { return p.lane === lane; });
    var cur = here.filter(function (p) { return p.name === selected; })[0] || here[0];
    var caps = cur.stt && cur.llm ? "Speech and language."
      : cur.llm ? "Language only — the listening jobs stay on whichever provider can hear."
        : "Speech only — the writing jobs stay on whichever provider can write.";
    return stackRow({
      /* Enterprise calls this an Account, because there it is one: a tenant,
         a region and a credential chain rather than a company you buy tokens
         from. Same control, and the label is the caller's to set. */
      label: opts.label || "Provider",
      hint: opts.hint || {
        b: t(cur.desc) + " Every job below follows this unless you override it on the job itself.",
        a: caps
      },
      /* NO CREDENTIAL BADGE ON THE CHIP. The old tile carried a small check when
         a key was stored. The credential has its own row directly below saying
         `Set`, and one fact stated twice six pixels apart is the furniture rule
         exactly. */
      body: provChips(here, cur.name, opts.custom !== false)
    });
  }

  /** The chip row itself, so the meeting/onboarding callers and the settings
      caller cannot drift. `custom` is the last chip and is not a provider: it is
      the door to an OpenAI-compatible endpoint the user operates, which every
      cloud list needs and no cloud list contains. */
  function provChips(list, selected, custom) {
    var chips = list.map(function (pv) {
      var on = pv.name === selected;
      return '<button class="provchip" role="radio" aria-checked="' + (on ? "true" : "false") + '"' +
        (on ? " data-on" : "") + ">" +
        '<span class="provchip-mark">' + (brand(pv.name) || icon("cloud")) + "</span>" +
        "<span>" + t(pv.name) + "</span></button>";
    }).join("");
    if (custom) {
      chips += '<button class="provchip" role="radio" aria-checked="false" data-custom>' +
        '<span class="provchip-mark">' + icon("settings") + "</span>" +
        "<span>" + t("Custom") + "</span></button>";
    }
    return '<div class="provrow" role="radiogroup" aria-label="' + t("Provider") + '">' + chips + "</div>";
  }

  /* ── What each lane actually offers ─────────────────────────────────────
     Added after review: the lane switch changed nothing below it, so the four
     lanes read as four names for one thing. They are not. A lane decides what
     a provider even IS — a cloud account with a key, a binary on this disk, a
     URL you operate, an account with a region — and with it what a model is
     called, whether it can be downloaded, and whether a credential exists at
     all.

     Two consequences the surface has to show rather than imply:

     THE MODEL NAMES CHANGE. `whisper-large-v3-turbo` is a Groq endpoint;
     `ggml-large-v3-turbo` is a file on this disk. They are the same weights and
     they are not the same thing — one is billed per request and bounded by an
     upload limit, the other costs 1.6 GB and a load. A surface that shows the
     same string in both lanes is hiding the only difference that matters.

     A JOB CAN BE UNAVAILABLE IN A LANE. No enterprise provider we would ship
     transcribes except Azure, and no self-hosted OpenAI-compatible endpoint
     does at all. Those jobs say so and name the lane that can run them, rather
     than offering a picker with nothing in it. */
  var LANES = {
    Cloud: {
      provider: "Groq",
      jobs: {
        dictation: { model: "whisper-large-v3-turbo", models: ["whisper-large-v3-turbo", "whisper-large-v3", "distil-whisper-large-v3-en"] },
        meetings: { model: "whisper-large-v3", models: ["whisper-large-v3", "whisper-large-v3-turbo"] },
        upload: { model: "whisper-1", models: ["whisper-1", "gpt-4o-transcribe", "whisper-large-v3"], override: "OpenAI" },
        cleanup: { model: "llama-3.1-8b-instant", models: ["llama-3.1-8b-instant", "llama-3.3-70b-versatile"] },
        rewrite: { model: "llama-3.3-70b-versatile", models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"] },
        translate: { model: "claude-sonnet-4-6", models: ["claude-sonnet-4-6", "claude-haiku-4-5", "claude-opus-4-7"], override: "Anthropic" },
        enhance: { model: "llama-3.3-70b-versatile", models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"] },
        assistant: { model: "claude-sonnet-4-6", models: ["claude-sonnet-4-6", "claude-opus-4-7", "claude-haiku-4-5"], override: "Anthropic" }
      }
    },
    Local: {
      provider: "llama.cpp",
      jobs: {
        dictation: { model: "ggml-base", models: ["ggml-base", "ggml-base.en", "ggml-small"], mark: "openai" },
        meetings: { model: "ggml-small", models: ["ggml-small", "ggml-base", "ggml-medium"], mark: "openai" },
        upload: { model: "ggml-small", models: ["ggml-small", "ggml-medium", "ggml-large-v3-turbo"], mark: "openai" },
        cleanup: { model: "llama-3.2-3b-instruct", models: ["llama-3.2-3b-instruct", "qwen2.5-7b-instruct"], mark: "llama" },
        rewrite: { model: "qwen2.5-7b-instruct", models: ["qwen2.5-7b-instruct", "llama-3.2-3b-instruct"], mark: "qwen" },
        translate: { model: "qwen2.5-7b-instruct", models: ["qwen2.5-7b-instruct", "gemma-3-4b-it"], mark: "qwen" },
        enhance: { model: "qwen2.5-7b-instruct", models: ["qwen2.5-7b-instruct", "llama-3.2-3b-instruct"], mark: "qwen" },
        assistant: { model: "qwen2.5-7b-instruct", models: ["qwen2.5-7b-instruct", "gemma-3-4b-it"], mark: "qwen" }
      }
    },
    "Self-hosted": {
      provider: "your server",
      jobs: {
        dictation: { none: "Speech has no OpenAI-compatible shape to talk to. Use Cloud or Local for the listening jobs." },
        meetings: { none: "Same — a self-hosted chat endpoint does not transcribe." },
        upload: { none: "Same — a self-hosted chat endpoint does not transcribe." },
        cleanup: { model: "typed on the endpoint", models: ["typed on the endpoint"], mark: null },
        rewrite: { model: "typed on the endpoint", models: ["typed on the endpoint"], mark: null },
        translate: { model: "typed on the endpoint", models: ["typed on the endpoint"], mark: null },
        enhance: { model: "typed on the endpoint", models: ["typed on the endpoint"], mark: null },
        assistant: { model: "typed on the endpoint", models: ["typed on the endpoint"], mark: null }
      }
    },
    Enterprise: {
      provider: "AWS Bedrock",
      jobs: {
        dictation: { none: "Only Azure OpenAI transcribes among the three. Switch the provider above, or use Cloud or Local." },
        meetings: { none: "Only Azure OpenAI transcribes among the three." },
        upload: { none: "Only Azure OpenAI transcribes among the three." },
        cleanup: { model: "anthropic.claude-haiku-4-5", models: ["anthropic.claude-haiku-4-5", "anthropic.claude-sonnet-4-6"], mark: "bedrock" },
        rewrite: { model: "anthropic.claude-sonnet-4-6", models: ["anthropic.claude-sonnet-4-6", "anthropic.claude-haiku-4-5"], mark: "bedrock" },
        translate: { model: "anthropic.claude-sonnet-4-6", models: ["anthropic.claude-sonnet-4-6"], mark: "bedrock" },
        enhance: { model: "anthropic.claude-haiku-4-5", models: ["anthropic.claude-haiku-4-5"], mark: "bedrock" },
        assistant: { model: "anthropic.claude-sonnet-4-6", models: ["anthropic.claude-sonnet-4-6", "anthropic.claude-opus-4-7"], mark: "bedrock" }
      }
    }
  };

  SCREENS.models = function () {
    var tabs = ["Models", "On this machine"];
    var active = activeSub("models", tabs);

    /* A JOB IS A ROW THAT OPENS. Closed, it answers the only question most
       people have: what is running this, and is it the default or something I
       changed. Open, it is that job's whole settings — no second screen, no
       tab, no navigation.

       THE BADGE CARRIES THE ONE FACT THE LIST EXISTS FOR. `Default` means it
       follows the connection above, so changing the connection changes it.
       Anything else is an override and says which provider it went to, because
       an override is the reason a list like this is ever read. */
    function job(o) {
      /* The lane owns what this job runs, so the row reads it rather than
         carrying its own copy. A job the lane cannot run says so in place of
         a model and names the lane that can — an empty picker would be worse
         than the sentence. */
      var lj = o.key ? (LANES[state.lane].jobs[o.key] || {}) : {};
      if (lj.none) {
        return '<div class="job" data-none>' +
          '<div class="job-text"><b>' + t(o.name) + "</b><span>" + p(lj.none) + "</span></div>" +
          '<div class="job-ctl">' + badge("Not on this lane", "warning") + "</div></div>";
      }
      var model = lj.model || o.model;
      var override = "override" in lj ? lj.override : o.override;
      var mark = "mark" in lj ? lj.mark : o.mark;

      /* THE MARK IS WHAT MAKES THE COLUMN SCANNABLE. Twelve rows of model
         names are twelve strings that have to be read; the same twelve with a
         provider mark in front are sorted by shape at a glance, and the one
         that went somewhere else is visible without reading any of them. */
      /* `mark: null` means this job is not on the connection's axis at all —
         speech synthesis has its own lane — so it gets neither a mark nor the
         `default` suffix, which would be claiming it follows something. */
      var offAxis = mark === null;
      var badgeEl = o.none
        ? badge("No model", "plan")
        : '<span class="jobmodel' + (override ? '" data-override="true' : '') + '">' +
        (offAxis ? "" : brand(mark || override || LANES[state.lane].provider)) +
        '<span class="jobmodel-name">' + t(model) + "</span>" +
        (offAxis ? "" : '<span class="job-prov">' + t(override || "default") + "</span>") +
        "</span>";

      if (o.none) {
        return '<div class="job" data-none>' +
          '<div class="job-text"><b>' + t(o.name) + "</b><span>" + p(o.why) + "</span></div>" +
          '<div class="job-ctl">' + (o.ctl || badgeEl) + "</div></div>";
      }

      return '<details class="job job-open"><summary>' + icon("chevron") +
        '<span class="job-text"><b>' + t(o.name) + "</b><span>" + p(o.what) + "</span></span>" +
        '<span class="job-ctl">' + badgeEl + "</span></summary>" +
        '<div class="job-body"><div class="rows">' + (o.rows || []).join("") + "</div>" +
        (o.extra || "") + "</div></details>";
    }

    /* THE OVERRIDE ROWS. Every job takes the same three, in the same order,
       and the first one is the one that matters: this job either follows the
       connection or it does not. Saying that explicitly is what lets the
       connection card above be believed. */
    function follows(o) {
      o = o || {};
      var lane = state.lane;
      var lj = o.key ? (LANES[lane].jobs[o.key] || {}) : {};
      var model = lj.model || o.model;
      var models = lj.models || o.models || [model];
      var override = "override" in lj ? lj.override : o.override;
      var conn = LANES[lane].provider;
      var rows = [];

      /* The provider row only exists where there is a provider to pick.
         On Local the choice is a file and on Self-hosted it is a URL, so
         offering "which company" there would be furniture with nothing
         behind it. */
      if (lane === "Cloud" || lane === "Enterprise") {
        rows.push(row({
          label: "Provider",
          hint: o.hint || "Follows the connection unless you change it here.",
          ctl: override
            ? '<span class="rowflex"><span class="selmark">' + brand(override) + "</span>" +
            select(override, providerNames(o.cap || "llm", lane)) +
            btn("Use the default", "ghost") + "</span>"
            : '<span class="rowflex"><span class="selmark">' + brand(conn) + "</span>" +
            select("Follow the connection · " + conn,
              ["Follow the connection · " + conn].concat(providerNames(o.cap || "llm", lane))) + "</span>"
        }));
      } else if (lane === "Local") {
        rows.push(row({
          label: "Runs on",
          hint: "This machine. Which model is the only choice there is — there is no account behind it.",
          ctl: '<span class="rowflex">' + badge("Local runtime", "success") +
            '<button class="btn" data-v="ghost" data-go="models">' + icon("arrow") + "Installed models</button></span>"
        }));
      } else {
        rows.push(row({
          label: "Endpoint",
          hint: "The server set on the connection above. Every job uses the same one; only the model id differs.",
          ctl: '<span class="mono muted">http://10.0.0.2:8080/v1</span>'
        }));
      }

      rows.push(lane === "Self-hosted"
        ? row({ label: "Model id", hint: "Not discoverable on every server, so it is typed rather than picked.", ctl: field("", { placeholder: "llama-3.3-70b", w: "190px" }) })
        : row({ label: "Model", ctl: select(model, models) }));

      if (override && (lane === "Cloud" || lane === "Enterprise")) {
        rows.push(row({
          label: "API key",
          hint: "Its own, because this job is not on the connection above. Held in the OS secret store like every other.",
          ctl: '<span class="rowflex">' + badge("Set", "success") + btn("Replace", "ghost", { icon: "key" }) + "</span>"
        }));
      }
      return rows.concat(o.extra || []);
    }

    /* WHAT THE CONNECTION IS, PER LANE — and it is four different things.
       The first build drew one card and switched a thumb above it, so all four
       lanes showed a cloud provider grid, a cloud API key and a cloud account
       plan. That is not a lane selector, it is a label. Each lane now brings
       the credential shape it actually has:

         Cloud        a provider, from a grid, and one key
         Local        a runtime, installed models, and no credential at all
         Self-hosted  a URL you operate, a typed model id, an optional token
         Enterprise   an account and a region, with three credential shapes */
    function laneRows() {
      var lane = state.lane;

      if (lane === "Local") {
        return [
          row({
            label: "Runtime",
            hint: "The server that loads a language model. WordScript can ship and manage one, or talk to the Ollama or LM Studio you already run.",
            ctl: '<span class="rowflex"><span class="selmark">' + brand("ollama") + "</span>" +
              seg(["Bundled", "Yours"], "Bundled") + "</span>"
          }),
          row({
            label: "State",
            hint: "Probed natively, and started on demand by whichever job needs it. Nothing here is read from an environment variable.",
            ctl: '<span class="rowflex">' + badge("Running", "success") + '<span class="mono muted">127.0.0.1:11434</span></span>'
          }),
          row({
            label: "Installed models",
            hint: "Speech and language share one disk and one total, so they are installed in one place.",
            ctl: '<span class="rowflex">' + badge("4 models · 6.7 GB", "plan") +
              '<button class="btn" data-v="ghost" data-sub="On this machine">' + icon("arrow") + "Manage</button></span>"
          }),
          row({
            label: "Credential",
            hint: "None, and there is nothing to add. This is the one lane where “no request leaves this machine” is true by construction rather than by promise.",
            ctl: badge("Not needed", "success")
          }),
          row({
            label: "Acceleration",
            hint: "Detected, not configured. A CPU-only machine runs the small models and struggles above 7B — which is worth knowing before a 4 GB download, not after.",
            ctl: '<span class="rowflex">' + badge("CPU only", "warning") + '<span class="muted">no CUDA, ROCm or Metal device</span></span>'
          })
        ];
      }

      if (lane === "Self-hosted") {
        return [
          row({
            label: "URL",
            hint: {
              b: "An OpenAI-compatible server you operate, on another machine. Reserved for exactly that — it is not another name for the on-device lane, and the two are never substituted for one another.",
              a: "An OpenAI-compatible server you operate, on another machine. Not the on-device lane."
            },
            ctl: field("http://10.0.0.2:8080/v1", { w: "230px" })
          }),
          row({ label: "Reachability", ctl: '<span class="rowflex">' + badge("Answering", "success") + btn("Test", "ghost") + "</span>" }),
          row({
            label: "Credential",
            hint: "Optional. Some self-hosted servers take a bearer token, most take none.",
            ctl: '<span class="rowflex">' + badge("None", "plan") + btn("Add", "ghost", { icon: "key" }) + "</span>"
          }),
          row({
            label: "Model ids are typed",
            hint: "A server behind a URL does not have to publish a model list, so each job carries the id you give it rather than picking from one.",
            ctl: badge("Per job", "plan")
          })
        ];
      }

      if (lane === "Enterprise") {
        return [
          providerPick("Enterprise", "AWS Bedrock", {
            label: "Account",
            hint: "Each of the three authenticates differently, so picking one changes which fields exist below it."
          }),
          row({
            label: "Credentials",
            hint: "Access key, secret and region — or the ambient AWS credential chain when one is present on this machine.",
            ctl: '<span class="rowflex">' + badge("Not configured", "plan") + btn("Configure", "ghost", { icon: "key" }) + "</span>"
          }),
          row({ label: "Region", ctl: select("eu-central-1", ["eu-central-1", "us-east-1", "us-west-2"]) }),
          row({
            label: "Speech",
            hint: "Only Azure OpenAI transcribes among the three, so the listening jobs say so instead of offering an empty picker.",
            ctl: badge("Azure only", "warning")
          })
        ];
      }

      /* Cloud. The provider was a grid of tiles here, on the argument that
         picking one is a recognition task — you know the mark before you have
         read the word. That much held; the tiles were not what delivered it.
         The mark travels with the row's control now (`providerPick`), so
         recognition survives at a twelfth of the surface, and capability moved
         from a caption under every option to a sentence about the one that is
         actually selected. */
      return [
        providerPick("Cloud", "Groq"),
        row({
          label: "API key",
          hint: {
            b: "Held in the OS secret store, never written to the config file and never read back out into the interface once saved.",
            a: "In the OS secret store. Never written to the config file."
          },
          ctl: '<span class="rowflex">' + badge("Set", "success") + btn("Replace", "ghost", { icon: "key" }) + "</span>"
        }),
        row({
          label: "Account plan",
          hint: {
            b: "A property of the key, not of a profile. It sets the largest upload the provider accepts, and with it the longest recording WordScript can process — stated again in Profiles → Defaults, where the limit is spent.",
            a: "Sets the largest upload, and with it the longest recording. Stated again where it is spent."
          },
          ctl: select("Free — 25 MiB per request", ["Free — 25 MiB per request", "Developer — 100 MiB per request"])
        })
      ];
    }

    var body;

    if (active === "Models") {
      body = [
        /* ONE CONNECTION. This is the card that makes the rest of the screen
           short: a lane, a provider, a key, and a sentence saying that
           everything below follows it. Most people set this once and never
           open a job row at all.

           THE LANE IS FOUR AND NOT TWO. Cloud and Local were the two the
           surface had, which left self-hosted and enterprise with nowhere to
           live — and that homelessness is what produced the third screen.
           They are lanes: each answers "where does this run" and each brings
           its own credential shape. */
        sec("Connection", "Set once. Every job below follows it unless you say otherwise.",
          card({
            rows: [
              row({
                label: "Lane",
                hint: {
                  b: "Where this runs. Cloud sends audio and text to a provider you hold a key for; Local keeps everything on this machine; Self-hosted is a server you operate; Enterprise authenticates against a cloud account and a region rather than with a single token.",
                  a: "Where this runs. Everything below follows from it."
                },
                ctl: segState("lane", ["Cloud", "Local", "Self-hosted", "Enterprise"])
              })
            ].concat(laneRows())
          })
        ),

        /* THE LIST. Every job that runs a model, in the order sound moves
           through the product: heard, written, spoken. Three groups, and a
           fourth for the modes that run no model at all — which have to be on
           this screen because "why can I not set a model for Verbatim" is
           answered by seeing it stated, not by its absence. */
        sec("What runs what", "One row per job. Open one to change it.",
          card({
            body: '<div class="stack gap4">' +

              '<div class="grp"><label>Listening</label><div class="joblist">' +
              job({
                key: "dictation", name: "Dictation", what: "Seconds of one voice, on the fastest path there is.",
                rows: follows({
                  key: "dictation", cap: "stt",
                  hint: "Follows the connection. A dictation is latency-bound, which is the one argument that decides this row.",
                  extra: [
                    row({
                      label: "Language",
                      hint: "Auto-detect reads it from the audio, per dictation.",
                      ctl: '<span class="rowflex">' + scope() + select("Auto-detect", ["Auto-detect", "German", "English"]) + "</span>"
                    }),
                    row({
                      label: "Pin this language",
                      hint: {
                        b: "Speaking another language inside a sentence stays untouched either way. This only makes WordScript quicker to drop a whole passage that another script wrote and that the audio does not support.",
                        a: "Only affects whole passages in another script. Mixed sentences stay untouched."
                      },
                      ctl: toggle(false)
                    }),
                    row({
                      label: "Longest recording this lane accepts",
                      hint: "Follows from the account plan on the connection. The ceiling Profiles → Defaults sets a recording limit under.",
                      ctl: '<span class="rowflex">' + badge("~26 min", "plan") + scope("Limit in profile") + "</span>"
                    }),
                    row({
                      label: "Bias from the profile's words",
                      hint: "The active profile's terms steer the recognizer before the AI sees anything. The terms themselves live in the profile.",
                      ctl: '<span class="rowflex">' + scope() + seg(["Off", "Light", "Standard"], "Standard") + "</span>"
                    })
                  ]
                })
              }) +
              job({
                key: "meetings", name: "Meetings", what: "An hour of several voices, with nothing waiting on the result.",
                rows: follows({
                  key: "meetings", cap: "stt",
                  hint: {
                    b: "Moved here from Notes & Meetings on 2026-08-03, where it repeated these rows to say the same thing. A meeting is a different workload from a dictation — an hour of several voices against seconds of one — so it gets its own row, not its own screen.",
                    a: "A different workload from a dictation, so it is its own row rather than its own screen."
                  },
                  extra: [
                    row({ label: "Speakers", hint: "Who said what, re-clustered when the meeting ends. Costs a pass over the recording.", ctl: toggle(true) }),
                    row({ label: "Live transcript", hint: "Text arrives while you are still talking, which is what makes the meeting HUD worth looking at during a call.", ctl: toggle(true) }),
                    row({
                      label: "What a meeting records",
                      hint: "Microphone, system audio and echo cancellation are a capture question, not a model one.",
                      ctl: '<button class="btn" data-v="ghost" data-go="notesettings">' + icon("arrow") + "Notes & Meetings</button>"
                    })
                  ]
                })
              }) +
              job({
                key: "upload", name: "Upload", what: "A file you hand it, with no clock running at all.",
                rows: follows({
                  key: "upload", cap: "stt",
                  hint: "Nothing is waiting, so accuracy is the only argument on this row.",
                  extra: [
                    row({ label: "Speakers", hint: "The same pass the meeting engine runs, on a file instead of a call.", ctl: toggle(false) })
                  ]
                })
              }) +
              "</div></div>" +

              '<div class="grp"><label>Writing</label><div class="joblist">' +
              job({
                key: "cleanup", name: "Cleanup", what: "Removes filler sounds and fixes typos, grammar and punctuation. Stays close to your phrasing.",
                rows: follows({
                  key: "cleanup",
                  hint: "Cleanup runs inside the dictation, so this is the one job where latency decides the model."
                }),
                extra: note("Auto routes with this model too. Deciding which mode applies is the same size of job as a cleanup, and a router with its own model would be a sixth thing to configure for no gain.", "about") +
                  note("No communication style here. It applies to Rewrite and the assistant only.", "about")
              }) +
              job({
                key: "rewrite", name: "Rewrite", what: "Cleanup plus rephrasing for clearer, more professional language. Manual only — never auto-selected.",
                rows: follows({ key: "rewrite" }),
                extra: note("How this writes — register, length, style rules, writing sample — is the profile's communication style, shared with the assistant.", "profiles",
                  docLink("Open the profile"))
              }) +
              job({
                /* NEW MODE — ADR 0041. The three settings here are the three
                   questions a translation raises that a cleanup does not: into
                   what, what happens when you already speak it, and what must
                   survive untranslated. The last is why this is not a Cleanup
                   with a flag — the profile's words are names and products,
                   the one part of a sentence a translator must leave alone. */
                key: "translate", name: "Translate", what: "Renders the dictation in another language instead of tidying it.",
                rows: follows({
                  key: "translate",
                  hint: "Overridden: translation is where model quality shows first, and it is not on the fastest path.",
                  extra: [
                    row({
                      label: "Into",
                      hint: "One target, fixed. Reading it from the focused window is a guess, and a guess that silently changes the language you are writing in is worse than a wrong keystroke.",
                      ctl: '<span class="rowflex">' + scope() + select("English", ["English", "German", "French", "Spanish", "Italian", "Portuguese", "Dutch", "Polish"]) + "</span>"
                    }),
                    row({
                      label: "When you already dictated in that language",
                      hint: "Nothing to translate. Say which happens rather than letting the model decide per dictation.",
                      ctl: seg(["Pass through", "Run Cleanup"], "Run Cleanup")
                    }),
                    row({
                      label: "Address form",
                      hint: "German, French and Spanish force a choice English does not carry. As dictated keeps a formal sentence formal.",
                      ctl: seg(["As dictated", "Formal", "Informal"], "As dictated")
                    }),
                    row({
                      label: "Keep the profile's words",
                      hint: "Names, products and technical terms are what a translator must leave alone and a model will localize.",
                      ctl: '<span class="rowflex">' + toggle(true) + scope() + "</span>"
                    })
                  ]
                })
              }) +
              job({
                key: "enhance", name: "Prompt Enhance", what: "Structures raw dictation into a well-formed prompt for an external AI tool.",
                rows: follows({
                  key: "enhance",
                  extra: [
                    row({ label: "Sub-mode", hint: "Enhance polishes without bloat; Expand restructures fully.", ctl: seg(["Enhance", "Expand"], "Enhance") }),
                    row({ label: "Prompt target", hint: "Optimizes prompt syntax for the chosen AI tool.", ctl: select("Claude Code", ["General", "Claude Code", "Cursor", "ChatGPT", "Copilot"]) })
                  ]
                })
              }) +
              job({
                /* DRAFT AND ASK ARE ONE THING — ADR 0040. They were two: a
                   Draft mode with a model, and a notes/meetings/Ask model
                   beside it behind a rule. The rule was honest about the
                   surfaces being different and wrong about the thing being
                   different, and the cost of the split was the sentence the
                   product exists to serve: "write the mail from Tuesday's
                   meeting". Draft could write a mail and could not reach
                   Tuesday's meeting; Ask could reach it and inserted nothing
                   where you were typing. */
                key: "assistant", name: "The assistant", what: "Draft in a dictation, the Ask window, and the actions on a note and in the meeting HUD. One model for all four.",
                rows: follows({
                  key: "assistant",
                  hint: "Overridden: it is the one job that both writes from scratch and reads your material, and it is not latency-bound the way a cleanup is.",
                  extra: [
                    row({
                      label: "Name you address it by",
                      hint: {
                        b: "Who it is when you address it by name. The name also decides whether Auto routes a dictation into Draft, so it applies no matter which mode is selected.",
                        a: "Also decides when Auto routes a dictation here, in every mode."
                      },
                      ctl: field("WordScript", { w: "150px" })
                    }),
                    row({
                      label: "May read your notes and transcripts",
                      hint: "Read-only, bounded to the notes directory, and it cites what it used. This is what lets an instruction point at material instead of repeating it.",
                      ctl: toggle(true)
                    }),
                    row({
                      label: "When it looks",
                      hint: {
                        b: "Reading is a tool call and a tool call costs a round trip, and dictation is the one surface where that is felt. On reference searches only when what you dictated points at something — “from Tuesday's meeting” — and is as fast as Draft ever was when it does not. Always is right for Ask, where you are waiting for an answer anyway.",
                        a: "On reference searches only when the dictation points at something. Always is right for Ask, wrong in a dictation."
                      },
                      ctl: seg(["Never", "On reference", "Always"], "On reference")
                    })
                  ]
                }),
                extra: note("Not the coding agents. Those are started by " + DESK + ", they write code, and they speak to you through the agent overlay — a different thing that only shares a word.", "agents",
                  docLink("Open Agents"))
              }) +
              "</div></div>" +

              '<div class="grp"><label>Speaking</label><div class="joblist">' +
              job({
                /* No mark: speech synthesis providers are not in the brand set
                   and inventing a glyph for one is worse than leaving the slot
                   empty. `mark: null` is explicit so the default does not
                   quietly attribute this row to Groq. */
                name: "The desk's voice", what: "How a coding agent's question reaches you out loud, and how your answer returns.",
                model: "Cartesia Sonic-3", mark: null,
                rows: [
                  row({ label: "Preset", hint: "Chosen by time to first byte, not by price.", ctl: select("Cartesia Sonic-3", ["Cartesia Sonic-3", "Kokoro-82M (local)"]) }),
                  row({ label: "Measured TTFB", hint: "Measured on this machine, not quoted from a datasheet.", ctl: badge("Not measured", "plan") }),
                  row({
                    label: "Everything else about agents",
                    hint: "Targets, the answer budget, the notification and its sound are the agent surface, not a model setting.",
                    ctl: '<button class="btn" data-v="ghost" data-go="agents">' + icon("arrow") + "Agents</button>"
                  })
                ]
              }) +
              "</div></div>" +

              /* THE MODES THAT RUN NOTHING. They belong on this screen for one
                 reason: "why can I not set a model for Verbatim" is answered
                 by seeing it stated. An absence answers nothing. */
              '<div class="grp"><label>Runs no model</label><div class="joblist">' +
              job({
                none: true, name: "Verbatim",
                why: {
                  b: "What the recognizer heard, with nothing after it. No model runs, so there is nothing to set — which is the point of it: it is the mode you reach for when a transform is what you do not want.",
                  a: "What the recognizer heard, with nothing after it. Nothing to set — that is the point of it."
                }
              }) +
              job({
                none: true, name: "Auto",
                why: {
                  b: "Picks Cleanup, Draft or Prompt Enhance per dictation from the transcript and the workspace context. It never picks Verbatim, Rewrite or Translate — those stay your call. It routes with Cleanup's model rather than one of its own.",
                  a: "Picks Cleanup, Draft or Prompt Enhance per dictation. Routes with Cleanup's model."
                },
                ctl: badge("Routes with Cleanup's model", "plan")
              }) +
              job({
                none: true, name: "Agent",
                why: {
                  b: "A bridge session hands the transcript back to the coding agent that asked for it and inserts nothing, so no transform runs at all — the overlay shows Agent where a mode would otherwise stand. It is a delivery target, not a mode (ADR 0030).",
                  a: "Hands the transcript to a waiting coding agent. No transform runs — a delivery target, not a mode."
                },
                ctl: '<span class="rowflex">' + badge("delivery axis", "plan") +
                  '<button class="btn" data-v="ghost" data-go="delivery">' + icon("arrow") + "Delivery</button></span>"
              }) +
              "</div></div>" +

              "</div>"
          })
        )
      ].join("");

    } else {
      /* ── On this machine ──────────────────────────────────────────────────
         THE GAP THE THIRD SCREEN DID NOT FILL. The local lane could be
         selected and then not populated: Speech-to-Text listed four native
         checks with no way to act on any of them ("llama3.2:latest is not
         installed" · "Copy command"), and Language Models offered a lane whose
         models did not exist. Both were telling the user to leave the
         application and come back.

         The donor does not. `ModelCardList` and `LocalModelPicker` put a
         download button, a progress bar, a size and a delete on every model,
         and `useModelDownload` runs them in the app.

         ONE TAB FOR BOTH KINDS, because it is one installation: speech models
         and language models sit on the same disk, under the same runtime, and
         compete for the same memory. Split across the two things that consume
         them, the total — the number that matters when a model is 4 GB — would
         be invisible. */
      body = [
        sec("Speech models", "Downloaded once, loaded by the local speech runner. Larger is more accurate and slower.",
          card({
            body: '<div class="mdl-list">' +
              modelRow({ brand: "openai", name: "ggml-base", size: "142 MB", detail: "multilingual · the recommended balance", state: "installed", active: true }) +
              modelRow({ brand: "openai", name: "ggml-base.en", size: "142 MB", detail: "English only, more accurate on English", state: "installed" }) +
              modelRow({ brand: "openai", name: "ggml-small", size: "466 MB", detail: "multilingual · better on accents", state: "downloading", pct: 38 }) +
              modelRow({ brand: "openai", name: "ggml-medium", size: "1.5 GB", detail: "multilingual · noticeably slower on CPU" }) +
              modelRow({ brand: "openai", name: "ggml-large-v3-turbo", size: "1.6 GB", detail: "multilingual · the best that still runs in real time" }) +
              "</div>",
            foot: '<span class="rowflex">' + badge("2 installed · 284 MB", "plan") +
              '<span class="muted">Speech runner: <span class="mono">/usr/bin/whisper-cli</span></span></span>'
          })
        ),

        sec("Language models", "Downloaded once, served to every writing job by the server below.",
          card({
            body: '<div class="mdl-list">' +
              modelRow({ brand: "qwen", name: "qwen2.5-7b-instruct", size: "4.4 GB", detail: "Q4_K_M · the general recommendation", state: "installed", active: true }) +
              modelRow({ brand: "llama", name: "llama-3.2-3b-instruct", size: "2.0 GB", detail: "Q4_K_M · fast enough for cleanup on CPU", state: "installed" }) +
              modelRow({ brand: "gemma", name: "gemma-3-4b-it", size: "2.5 GB", detail: "Q4_K_M · strong on German" }) +
              modelRow({ brand: "qwen", name: "qwen2.5-14b-instruct", size: "8.4 GB", detail: "Q4_K_M · needs a GPU to be pleasant" }) +
              "</div>",
            foot: '<span class="rowflex">' + badge("2 installed · 6.4 GB", "plan") + btn("Open the model folder", "ghost", { icon: "folder" }) + "</span>"
          }) +
          note("The sizes are on disk. Loading one costs roughly the same again in memory, and a model that does not fit does not fail at download time — it fails at first use.", "about")
        ),

        sec("The server", "Language models need an OpenAI-compatible server in front of them.",
          card({
            rows: [
              row({
                label: "Who runs it",
                hint: {
                  b: "Bundled means WordScript ships the server, starts it when a job needs it and stops it when none does. Yours means you already run Ollama, LM Studio or llama.cpp and WordScript only talks to it — nothing is downloaded and nothing is started.",
                  a: "Bundled: WordScript ships and manages it. Yours: it only talks to what you run."
                },
                ctl: seg(["Bundled", "Yours"], "Bundled")
              }),
              row({ label: "Endpoint", ctl: '<span class="rowflex">' + field("http://127.0.0.1:11434/v1", { w: "210px" }) + badge("Answering", "success") + "</span>" }),
              row({ label: "State", hint: "Started on demand by whichever job is on the local lane, stopped when the last one leaves it.", ctl: '<span class="rowflex">' + badge("Running · 1 job", "success") + btn("Restart", "ghost") + "</span>" }),
              row({ label: "Keep it warm", hint: "Skips the load on the first dictation after an idle period, at the cost of the memory the model occupies.", ctl: toggle(false) }),
              row({ label: "Acceleration", hint: "Detected, not configured. A CPU-only machine runs the small models and struggles above 7B.", ctl: '<span class="rowflex">' + badge("CPU only", "warning") + '<span class="muted">no CUDA, ROCm or Metal device found</span></span>' })
            ]
          })
        ),

        note("Nothing on this tab sends anything anywhere. It is the one lane where that is true by construction rather than by promise.", "privacy")
      ].join("");
    }

    return [
      viewTop({
        title: "AI Models",
        lead: "One connection, and what each job runs on it.",
        tabs: { screen: "models", items: tabs },
      }),
      body,
      note("Which mode is effective right now is runtime truth and lives on Home. Which mode a profile defaults to lives in that profile. Neither is set here.", "about"),
    ].join("");
  };

  /* Deep links from the two screens this replaced keep working, on the
     `SECTION_ALIASES` pattern §4.3 requires. */
  SCREENS.stt = SCREENS.models;
  SCREENS.llm = SCREENS.models;

  /* ── Settings: Agents (preview) ─────────────────────────────────────────
     Three things were tangled here in the first build. They are separated on
     their own tabs, and the disambiguation is stated rather than implied:

       Orchestrator  — the one process WordScript starts and talks to. It is
                       WordScript's only client (ADR 0030).
       Targets       — the repositories it works in, each with a role.
       Voice         — how a question reaches you and how your answer returns.

     None of this is the Draft mode in Language Models. And per ADR 0030 the
     bridge is a DELIVERY target, not a processing mode: the pill shows `Agent`
     where the mode would otherwise stand, which is why it appears in
     Delivery & Insert and not in the mode list. */
  SCREENS.agents = function () {
    /* The first tab was called `Orchestrator`, which is what the thing is and
       not what anyone calls it (§11.44). The section stays `Agents`, because
       that is what the user came here about — the desk is the answer to it,
       not the subject. */
    var tabs = [DESK_CAP, "Targets", "Voice"];
    var active = activeSub("agents", tabs);
    var body;

    if (active === DESK_CAP) {
      body = card({
        title: DESK_CAP,
        desc: {
          b: "One process. It starts and drives the coding agents, and for them it is the human — they get no MCP entry and no per-repository setup.",
          a: "One process. It drives the coding agents, and for them it is the human."
        },
        rows: [
          row({ label: "Harness", hint: "Which agent CLI runs as the desk. Presets carry the command, the roles and the environment each one needs.", ctl: select("Claude Code", ["Claude Code", "Codex CLI", "Gemini CLI", "opencode", "Custom command"]) }),
          row({ label: "Command", ctl: '<span class="mono muted">claude --print --permission-mode plan</span>' }),
          row({ label: "Status", ctl: badge("Not configured", "plan") }),
          row({ label: "Answer budget", hint: "How long await may block before the caller is told nobody answered.", ctl: '<span class="rowflex">' + field("90", { w: "56px" }) + '<span class="muted">s</span></span>' }),
          row({ label: "Spoken questions", hint: "One open question at a time, so an answer belongs to it by construction.", ctl: badge("Serial", "plan") })
        ]
      }) +

        /* WHICH MODEL THE DESK RUNS, AND WHY IT IS NOT SET HERE — §11.45.
           This row exists because its absence was being read as an oversight.
           ADR 0042 put every model choice in the product on one surface, and
           the desk's own model is genuinely not one of them: it is a setting
           of somebody else's program, held in the harness's own configuration
           inside the directory below. Stating that is the same move as the
           "Runs no model" group on AI Models — an absence answers nothing, and
           the question is asked either way.

           WHAT WE DO OWE IS THE DOOR. "WordScript does not choose it" is a
           true statement that is also useless on its own, because the user
           still wants it changed sometimes. So: three ways in, and an honest
           account of what a change costs. */
        card({
          title: "Its own model",
          desc: {
            b: "The desk is a coding agent you chose, so which model it runs is a setting of that program and lives in its configuration, not in WordScript. This is the one model choice AI Models does not own.",
            a: "The desk is a program you chose. Its model is its own setting, not ours."
          },
          rows: [
            row({
              label: "Currently",
              hint: "Read from the harness configuration in the directory below. WordScript reports it and does not set it.",
              ctl: '<span class="rowflex">' + brand("anthropic") + '<span class="mono muted">claude-opus-5</span>' + badge("read-only", "plan") + "</span>"
            }),
            row({
              label: "Changing it",
              hint: "Edit it where it lives, then restart the desk. A running process does not re-read its configuration, and pretending otherwise would be the worst kind of fake readiness.",
              ctl: badge("Needs a restart", "warning")
            }),
            row({
              label: "Every other model in the product",
              hint: "Dictation, meetings, cleanup, translate, the assistant and the voice are all on one surface, and this row is the documented exception to that.",
              ctl: btn("Open AI Models", "ghost", { icon: "arrow" })
            }),
          ]
        }) +

        /* THE DOOR INTO THE DIRECTORY — §11.45.
           ADR 0030 forbids rebuilding the CLI's controls in the overlay:
           "rebuild those and what is left is a terminal with extra steps, and
           the promise of this record (not having to look) is gone." That rule
           is about REBUILDING. A button that opens the real directory rebuilds
           nothing — it hands over the original, which is the strongest form of
           the same rule, and it is exactly what the MCP position is (we do not
           build connectors, we build the place they hang).

           ONE HONESTY THIS SURFACE OWES. The running desk is headless: ADR
           0030 has the runs as `claude -p` with "no PTY and no terminal
           emulation". There is no terminal to reveal. What the button opens is
           a SECOND session in the same directory — good for editing config,
           reading files and running the harness interactively, and it is not
           the process that is currently answering questions. A surface that
           implied otherwise would have the user typing at something that
           cannot hear them. */
        card({
          title: "Its directory",
          desc: {
            b: "WordScript creates and owns this folder, generates the instruction file inside it, and otherwise leaves it alone. Everything the harness itself is configured with lives here — its MCP servers, its model, its own rules.",
            a: "WordScript makes this folder and generates one file in it. The rest is the harness's."
          },
          rows: [
            stackRow({
              label: "Where it is",
              body: cmd("~/.local/state/wordscript/desk/")
            }),
            row({
              label: "Open a terminal here",
              hint: "A new interactive session in this folder — for editing configuration, adding MCP servers, or running the harness by hand. It is not the running desk: that one is headless and has no terminal to show.",
              ctl: btn("Open terminal", "ghost", { icon: "terminal" })
            }),
            row({
              label: "Open the folder",
              hint: "The same directory in your file manager.",
              ctl: btn("Show", "ghost", { icon: "folderOpen" })
            }),
            row({
              label: "Instruction file",
              hint: "WordScript rewrites only the region between its two markers — the target list, the delegation rule, the rules on asking. Everything outside it is yours and is never touched.",
              ctl: '<span class="rowflex">' + badge("2 regions", "plan") + btn("Edit", "ghost", { icon: "file" }) + "</span>"
            }),
            row({
              label: "Restart it",
              hint: "Picks up everything changed in here. It also costs the context it has built: a desk that has been running for days filters well because it knows the recent decisions, and a fresh one does not.",
              ctl: '<span class="rowflex">' + badge("Loses its context", "warning") + btn("Restart", "ghost", { icon: "restore" }) + "</span>"
            }),
          ]
        }) +

        /* WHAT IT CAN REACH — ADR 0046, §11.44.
           The desk is an MCP client of its own, so anything the user hangs
           into that configuration is a capability the desk has and WordScript
           does not. This list is a READOUT of that file. Nothing here is
           connected from this screen and there is deliberately no "Add
           server" button: a second way to write that configuration would put
           WordScript in the business of maintaining connectors, which is the
           one thing this whole arrangement exists to avoid.

           IT ALSO CARRIES THE PRIVACY CONSEQUENCE, at the rows that spend it
           (ADR 0034). A local-first product with a Gmail server attached to
           its agent is not a local-first path for that traffic, and saying so
           here is cheaper than being caught not saying it. */
        card({
          title: "What it can reach",
          desc: {
            b: "The desk is an agent CLI, so it is its own MCP client and carries its own connectors. WordScript reads that configuration and shows it; it does not write it, and there is no second place to add one.",
            a: "The desk carries its own connectors. WordScript reads that list and does not write it."
          },
          body: '<div class="mcpl">' +
            [["WordScript", "ask · await", "loopback", "ours", "This is how it reaches you. Issued and rotated by WordScript."],
             ["Gmail", "read · send", "network", "theirs", "Sends mail as you. Nothing about this path is local."],
             ["Google Calendar", "read · write", "network", "theirs", "Writes events. WordScript's own calendar intake is read-only and separate."],
             ["GitHub", "read · write", "network", "theirs", "Opens issues and pull requests in your name."],
             ["Filesystem", "read · write", "local", "theirs", "Scoped to the target directories you configured."]]
              .map(function (m) {
                return '<div class="mcp-row" data-owner="' + esc(m[3]) + '">' +
                  '<span class="mcp-name"><b>' + t(m[0]) + "</b>" +
                  '<span class="mono">' + t(m[1]) + "</span></span>" +
                  '<span class="mcp-where">' + badge(m[2], m[2] === "loopback" ? "success" : m[2] === "local" ? "plan" : "warning") + "</span>" +
                  '<span class="mcp-why">' + p(m[4]) + "</span></div>";
              }).join("") + "</div>",
          rows: [
            row({
              label: "Who runs these",
              hint: "The desk's own process, under its own permissions, from its own configuration file. WordScript never calls them and cannot see what they returned.",
              ctl: badge("Not WordScript", "plan")
            }),
            row({
              label: "Adding one",
              hint: "Open the terminal above and configure it the way that harness documents. A second editor here would be a connector surface to maintain, and maintaining connectors is what using a real agent CLI avoids.",
              ctl: btn("Open terminal", "ghost", { icon: "terminal" })
            }),
            row({
              label: "What WordScript reads by itself",
              hint: "Calendars, and nothing else. That one is an intake — it makes a meeting have a name and attendees before it starts — and it never writes.",
              ctl: btn("Open Integrations", "ghost", { icon: "arrow" })
            }),
          ]
        }) +

        card({
          body: '<div class="rows">' +
            row({ label: "This is not the Draft mode", hint: "Draft turns one dictation into a first version of a text, in seconds, at your cursor. Nothing here writes into your editor.", ctl: btn("Open the assistant", "ghost", { icon: "arrow" }) }) +
            row({ label: "Agent is a delivery target", hint: "A bridge session returns the transcript to the caller and inserts nothing, so it sits on the delivery axis, not the mode axis.", ctl: btn("Open Delivery", "ghost", { icon: "arrow" }) }) +
            row({ label: "A dictation can arrive here", hint: "When what you said asks for something to be done rather than written, the assistant offers to hand it over. It never hands it over by itself.", ctl: btn("Open Handoff", "ghost", { icon: "handoff" }) }) +
            "</div>"
        });
    } else if (active === "Targets") {
      body = card({
        title: "Targets",
        desc: "A target is a repository, a role and a thread. Configuration hangs on the target, never on what you said.",
        body: '<div class="list">' +
          [["WordScript", "work · writes · General writing", "Ready", "success"],
           ["dotfiles", "inspect · read-only · General writing", "Ready", "success"],
           ["sw-forge-org", "resume · continues last thread", "No thread yet", "plan"]]
            .map(function (tg) {
              return listItem({
                title: tg[0], meta: [tg[1]], badge: { text: tg[2], tone: tg[3] },
                actions: [btn("Edit", "ghost"), btn("Start", "ghost", { icon: "play" })]
              });
            }).join("") + "</div>",
        foot: btn("New target", null, { icon: "plus" })
      }) +
        /* The roles were a second card of three rows whose only control was a
           bare icon — a legend for a vocabulary the list above already uses in
           every row. What each role means belongs to the row that picks it, so
           it is a disclosure on this card rather than a card of its own. */
        card({
          body: disclosure("What the three roles do", "3", [
            row({ label: "inspect", hint: "Reads the repository and answers. Writes nothing." }),
            row({ label: "work", hint: "May write, under the target’s permission profile." }),
            row({ label: "resume", hint: "Continues the target’s existing thread instead of starting one." })
          ])
        }) +
        note("Runs are headless. A discussion is a sequence of runs with resume, not an open connection.", "about");
    } else {
      body = card({
        title: "Speaking",
        desc: "Chosen by time to first byte, not by price.",
        rows: [
          row({ label: "Preset", ctl: select("Cartesia Sonic-3", ["Cartesia Sonic-3", "Kokoro-82M (local)"]) }),
          row({ label: "Measured TTFB", hint: "Measured on this machine, not quoted from a datasheet.", ctl: badge("Not measured", "plan") }),
          row({ label: "Rate limit", hint: "Reported to the caller when it bites. Never silent.", ctl: '<span class="rowflex">' + field("6", { w: "50px" }) + '<span class="muted">/ hour</span></span>' }),
          row({ label: "Output guard", hint: "Stays quiet while a call is running.", ctl: toggle(true) })
        ]
      }) +

        /* THE VOICE HAS ONE BODY, AND THIS IS WHERE IT IS CONFIGURED —
           ADR 0043. Its two drawings sit beside the settings that govern them
           rather than in a legend somewhere else, because "what does the orb
           mean" is the question this card exists to close. */
        card({
          title: "How the voice shows itself",
          desc: {
            b: "One process speaks for every agent it starts, so there is one voice and one thing on screen that carries it. It appears in the agent window and in the notification, and it is the same object in both.",
            a: "One voice, one object. It appears in the agent window and in the notification."
          },
          body: '<div class="orb-demo" data-four>' +
            '<figure><div class="orb-stage">' + orb({ state: "idle", size: 72, still: true }) + "</div>" +
            "<figcaption><b>" + t("Idle") + "</b><span>" +
            p("Unlit, neutral, motionless. The process exists and is not doing anything.") + "</span></figcaption></figure>" +

            '<figure><div class="orb-stage">' + orb({ state: "listening", size: 72, drive: "listening" }) + "</div>" +
            "<figcaption><b>" + t("Listening") + "</b><span>" +
            p("Cool material, following your level with a fast rise and a slow fall. It is receiving, so it is not lit from inside.") + "</span></figcaption></figure>" +

            '<figure><div class="orb-stage">' + orb({ state: "thinking", size: 72 }) + "</div>" +
            "<figcaption><b>" + t("Working") + "</b><span>" +
            p("The size holds and the light drifts. There is no amplitude to show here, and a pulse would be inventing one.") + "</span></figcaption></figure>" +

            '<figure><div class="orb-stage">' + orb({ state: "speaking", size: 72, drive: "speaking" }) + "</div>" +
            "<figcaption><b>" + t("Speaking") + "</b><span>" +
            p("Warm, lit from inside, moving on the voice envelope — syllables and phrase pauses, not a period.") +
            "</span></figcaption></figure>" +
            "</div>",
          rows: [
            row({
              label: "Motion",
              hint: "Reduced motion holds every state still and keeps all four distinguishable, because material and glow carry the state and only movement is dropped.",
              ctl: seg(["Follow the system", "Always still"], "Follow the system")
            })
          ]
        }) +

        /* THE NOTIFICATION, AND WHY IT IS A WINDOW.
           A question that is never seen is worse than no question: `await`
           blocks the agent until the budget runs out, so the one thing this
           surface may not do is be missable. The agent window can be closed,
           the overlay can be behind something, and an OS notification is
           suppressed by Focus and by screen sharing — which is when a coding
           agent is most likely to be running.

           So it is WordScript's own always-on-top window, above every other
           surface this product owns, and it carries the same orb so it is
           recognisable as the same voice.

           THE SOUND IS A CUE ON THE EXISTING STREAM, NOT AN OS SOUND.
           ADR 0010 already settled this shape for every other cue: one
           persistent output stream, a synthesised motif, no fresh stream per
           sound. A question re-uses that path and gets one more motif; it does
           not open its own audio and it does not go through the OS notification
           sound, which the user cannot mix separately and Focus can mute. */
        card({
          title: "The notification",
          desc: {
            b: "A small window that appears over everything WordScript has on screen when an agent is waiting for you. It is not an OS notification: those are suppressed by Focus and by screen sharing, which is exactly when an agent is likely to be running.",
            a: "A small window over every other surface. Not an OS notification — Focus suppresses those."
          },
          rows: [
            row({ label: "Show it", hint: "Off leaves the tab on the overlay and the window as the only signals.", ctl: toggle(true) }),
            row({
              label: "Where",
              hint: "Remembered per monitor. It never covers the dictation overlay — it offsets above it while one is on screen.",
              ctl: select("Top right", ["Top right", "Top centre", "Bottom right", "Where I last put it"])
            }),
            row({
              label: "Sound",
              hint: {
                b: "A cue on the same persistent audio stream every other WordScript sound uses, so it carries the same motif and one application volume in the OS mixer governs all of it. It is not the system notification sound.",
                a: "A cue on the same stream as every other sound, not the system notification sound."
              },
              ctl: '<span class="rowflex">' + select("Question motif", ["Question motif", "Silent"]) + btn("Play", "ghost", { icon: "play" }) + "</span>"
            }),
            row({ label: "Stay quiet while I dictate", hint: "A cue during a capture is picked up by the microphone. It queues and fires after the session ends.", ctl: toggle(true) }),
            row({
              label: "Answer from the notification",
              hint: "The offered options are buttons on it, so a question with two answers never needs the window opened.",
              ctl: toggle(true)
            }),
            row({ label: "Dismisses when", hint: "Answered, or the answer budget expired. It never times out on its own — an unanswered question is still blocking somebody.", ctl: badge("Answered or expired", "plan") })
          ]
        }) +

        card({
        title: "Answering",
        rows: [
          row({ label: "Answer window", hint: "Opens after a question. Continuous listening is an option and shows a microphone indicator.", ctl: seg(["After a question", "Continuous"], "After a question") }),
          row({ label: "Undo window", hint: "How long a matched option answer can be taken back.", ctl: '<span class="rowflex">' + field("4", { w: "50px" }) + '<span class="muted">s</span></span>' }),
          row({ label: "The microphone belongs to you", hint: "A request during a dictation gets the busy answer; your dictation hotkey ends a bridge session.", ctl: badge("Always", "success") })
        ]
      }) + card({
        title: "Thread",
        body: '<div class="thread">' +
          '<div class="msg" data-from="ws"><span class="who">WS</span><div class="msg-body">' +
          "<p>" + t("WordScript · The overlay test expects a 480 by 60 surface. Should I update the test or the host?") + "</p>" +
          '<div class="msg-opts">' + btn("the test", "ghost") + btn("the host", "ghost") + "</div>" +
          '<span class="when">spoken · waiting 0:12</span></div></div>' +
          '<div class="msg" data-from="me"><span class="who">F</span><div class="msg-body">' +
          "<p>" + t("the host") + "</p><span class='when'>answered by voice · undo window 4 s</span></div></div>" +
          "</div>"
      });
    }

    return [
      viewTop({
        title: "Agents",
        lead: "Coding agents that ask you out loud, and the one process that speaks for them.",
        banner: { text: "Planned for Phase 8 \u2014 ADR 0030." },
        tabs: { screen: "agents", items: tabs },
      }),
      body,
    ].join("");
  };

  /* ── Settings: Delivery & Insert ────────────────────────────────────── */

  SCREENS.delivery = function () {
    return [
      viewTop({ title: "Delivery & Insert", lead: "How a finished transcript reaches the app you are writing in." }),

      /* Delivery is its own axis (ADR 0011a), but the choice on that axis is
         per-profile in the runtime — the same value ADR 0024 was written about
         for the mode. So the choice stands once, in the profile, and this
         section answers the question only it can answer: can this machine
         deliver at all, and by what route. */
      sec("Where transcripts go", null, card({
        rows: [
          row({
            label: "General writing delivers",
            hint: {
              b: "Direct insert copies the transcript, pastes it at the cursor and restores your previous clipboard afterwards.",
              a: "Pastes at the cursor, then restores your clipboard."
            },
            ctl: '<span class="rowflex">' + badge("Insert at cursor", "accent") + scope("Change in profile") + "</span>"
          }),
          row({
            label: "Agent bridge",
            hint: "Returns the transcript to the waiting agent and inserts nothing. The caller decides this, not a profile.",
            ctl: badge("Phase 8", "plan")
          }),
        ]
      })),

      sec("This machine", null, card({
        desc: {
          b: "Whether WordScript can place transcribed text into the focused app, and which native driver it uses right now.",
          a: "Whether text can reach the focused app right now."
        },
        rows: [
          row({ label: "Platform", ctl: '<span class="rowflex">' + badge("tier 1", "success") + '<span class="mono muted">Linux · X11</span></span>' }),
          row({ label: "Readiness", hint: "Direct paste available. The previous clipboard is restored after every insert.", ctl: badge("Ready", "success") }),
          row({ label: "Strategy", ctl: '<span class="mono muted">auto_paste · xdotool</span>' }),
        ],
      })),

      /* Corrected 2026-08-03 against core/insertion.rs, which has been right all
         along while this screen was wrong three ways.

         It drew ONE ordered chain. The runtime has two, plus a terminal state,
         and it says so itself: `NativeInsertDriver::role()` returns "clipboard"
         for wl-copy and arboard, "paste" for xdotool/wtype/ydotool/enigo, and
         "recovery" for the scratchpad. Putting a clipboard writer, a paste
         driver and a fallback in one list makes them look like alternatives for
         the same job, which is how the missing ones went unnoticed.

         It omitted wl-copy, arboard and enigo — three of the eight drivers the
         runtime names, including the only one that writes a Wayland clipboard.

         And it listed wtype and ydotool as "not in PATH", which is not why they
         are unused. `paste_driver_execution_chain` never reaches them: on hybrid
         XWayland it returns after xdotool, and on pure Wayland it returns an
         empty chain with a comment saying clipboard-only is the safe default
         because wtype and ydotool trigger compositor privilege prompts. They are
         excluded by a decision, not by an absent binary — the opposite of what
         the surface said, and the difference between "install a package" and
         "this will never work here". */
      sec("How text gets there", "Two stages and a fallback, not one chain.", card({
        body: '<div class="stack gap4">' +

          '<div class="grp"><label>1 · Put it on the clipboard</label>' +
          check([
            { state: "todo", label: "wl-copy", detail: "Wayland clipboard. This session is X11, so it is not a candidate." },
            { state: "ok", label: "arboard clipboard", detail: "Cross-platform, always last, always available.", tag: "in use" },
          ]) + "</div>" +

          '<div class="grp"><label>2 · Make the target take it</label>' +
          check([
            { state: "ok", label: "xdotool type", detail: "Types the text directly, before either chain, for up to 800 characters.", tag: "in use" },
            { state: "ok", label: "xdotool", detail: "Sends ctrl+v. The previous clipboard is restored afterwards." },
            { state: "todo", label: "enigo", detail: "The only paste driver on Windows and macOS. On Linux, hybrid sessions without xdotool." },
            { state: "fail", label: "wtype · ydotool", detail: "Excluded by design, not missing: both trigger a compositor privilege prompt per paste, which is what clipboard-only avoids." },
          ]) + "</div>" +

          '<div class="grp"><label>When none of it works</label>' +
          card({
            rows: [row({
              label: "Recovery scratchpad",
              hint: "Not a driver and not in either chain — it is where a transcript waits when nothing could place it.",
              ctl: badge("Always", "success")
            })]
          }) + "</div>" +

          "</div>"
      })),

      /* THE INCIDENT LEFT THIS CARD — §11.51.
         It carried the last failed transcript verbatim, with a Restore button:
         "Kundenanfrage zum Lieferstatus…" — yesterday 17:03, clipboard only.
         That same event is now a row in Home's decision inbox, where it has an
         expiry and an action, and a row in History, where it is the record. A
         third telling on a settings screen is §11.12's fault exactly, one
         screen over: one event, three places, and the two that cannot clear it
         still offering the button that does.

         What is left is what only this screen can answer — whether recovery
         works here at all, where it writes, and how much is sitting in it. */
      sec("Recovery", null, card({
        desc: {
          b: "Where a transcript waits when nothing could place it. Not a driver and not in either chain above.",
          a: "Where a transcript waits when nothing could place it."
        },
        rows: [
          row({
            label: "Scratchpad",
            hint: "~/.local/state/wordscript/scratchpad.jsonl",
            ctl: '<span class="rowflex">' + badge("3 entries", "success") + btn("Clear", "ghost", { icon: "trash" }) + "</span>"
          }),
          row({
            label: "Something waiting right now",
            hint: "A failed insert is reported once, on Home, where the action that clears it lives. It is a record in History afterwards either way.",
            ctl: btn("Open Home", "ghost", { icon: "arrow" })
          }),
        ]
      })),

      /* Three rows, one badge, repeated three times: every one said "Not this
         session", which is the only thing they had in common and therefore the
         one thing worth saying once. Folded — the recommended reading is that
         none of them apply here, and the detail is one click away for the
         reader who is about to move to another machine. The portal check that
         used to be a loose note at the bottom of the screen now sits inside the
         Wayland row, which is the row it explains. */
      sec("Limits on other platforms", "None of these apply to this session.",
        card({
          body: disclosure("Wayland, elevated Windows targets, macOS permissions", "3", [
            row({
              label: "Wayland",
              hint: "The portal does not grant synthetic input to every compositor; those sessions fall back to clipboard-only. Here: compositor mutter, xdg-desktop-portal present, RemoteDesktop not reachable."
            }),
            row({ label: "Elevated Windows targets", hint: "A non-elevated WordScript cannot paste into an elevated window." }),
            row({ label: "macOS permissions", hint: "Accessibility and Input Monitoring are required for development builds." }),
          ])
        })
      ),
    ].join("");
  };

  /* ── Settings: Privacy & Data ───────────────────────────────────────── */

  SCREENS.privacy = function () {
    return [
      viewTop({ title: "Privacy & Data", lead: "What stays on this machine, and how long." }),

      /* THE RULE LIVES HERE, THE LIST LIVES IN HISTORY — §11.51.
         Both screens are about the same records and neither is redundant,
         because they answer different questions: History is the data (find
         one, read it, retry it, delete one) and this is the policy (how many,
         how long, where). The pairing is stated on both sides — History's
         closing note already points here — so nobody has to discover which
         screen wins.

         It covers context objects too now, and the heading says so: a meeting
         is a bigger object than a transcript and an hour of audio is a
         different size of promise, so a retention rule that silently only
         governed dictations would be the more dangerous half unstated. */
      sec("How long things are kept", "History and context objects, on this machine.", card({
        rows: [
          row({ label: "Stored transcripts", hint: "The oldest is dropped when the cap is reached.", ctl: select("500", ["50", "100", "200", "500", "1000"]) }),
          row({ label: "Retention", hint: "Older entries are pruned automatically.", ctl: select("90 days", ["7 days", "30 days", "90 days", "1 year", "Keep all"]) }),
          row({
            label: "Context objects",
            hint: "Meetings, uploads and notes are files in a folder you chose. Nothing prunes them, and nothing will without asking.",
            ctl: '<span class="rowflex">' + badge("Kept until you delete", "plan") + btn("Open Context", "ghost", { icon: "arrow" }) + "</span>"
          }),
          row({
            label: "Meeting audio",
            hint: "An hour of recording is a different size of promise than a dictation's few seconds. Undecided.",
            ctl: badge("Open decision", "warning")
          }),
        ]
      })),

      /* `Transcripts, profiles, settings — This machine only. No account, no
         cloud sync.` was the second row here and it was Account & Sync's whole
         first screen said again — so it was cut and the row below linked there
         instead.
         2026-08-04: Account & Sync is gone (no WordScript account, none
         planned), so the sentence comes home. This is now the only place that
         answers "does any of this leave", and it answers it with a fact rather
         than with a door to a screen that promised a decision it did not have.
         The vendor accounts named in the last row are model vendors' — AI
         Models is where those are set, and that link stays because it goes
         somewhere that decides something. */
      sec("Where things live", null, card({
        rows: [
          row({ label: "API keys", hint: "In the OS secret store. Never written to the JSON config and never returned to this window.", ctl: badge("OS secret store", "success") }),
          row({ label: "Transcripts, context, profiles, settings", hint: "Files on this machine, under paths you can open.", ctl: badge("This machine", "success") }),
          row({ label: "Audio", hint: "Sent to the selected provider for transcription, then discarded. The local lane sends nothing.", ctl: badge("Provider, then discarded", "plan") }),
          row({
            label: "Whether any of it leaves",
            hint: "No. There is no WordScript account, no cloud of ours and no sync — nothing to sign up for and no server of ours holding anything.",
            ctl: badge("Never", "success")
          }),
          row({
            label: "The accounts you do have",
            hint: "Groq, Anthropic, an enterprise tenant. Those belong to model vendors, they are the only thing audio is ever sent to, and they are set where the model is chosen.",
            ctl: btn("Open AI Models", "ghost", { icon: "arrow" })
          }),
        ]
      })),

      sec("Export", null, card({
        rows: [
          row({ label: "Full export", hint: "Everything local, as one archive.", ctl: btn("Export", null, { icon: "download" }) }),
          row({ label: "Full import", hint: "Restores from a previously exported archive.", ctl: btn("Import", "ghost") }),
        ]
      })),

      /* "Danger zone" was a third red signal on top of the red row label and
         the red button, and it is the least useful of the three: it names a
         neighbourhood rather than a consequence. The header now says what these
         two rows have in common that the colour cannot — that they take effect
         at once and there is no undo. */
      sec("Delete and reset", "Both take effect immediately and cannot be undone.", card({
        rows: [
          row({ label: "Clear transcription history", hint: "Deletes every stored transcript. Profiles and settings stay.", danger: true, ctl: btn("Clear", "danger") }),
          row({ label: "Reset all settings", hint: "Restores every setting to its default. History and profiles stay.", danger: true, ctl: btn("Reset", "danger") }),
        ]
      })),
    ].join("");
  };

  /* ── Settings: Account & Sync, removed ───────────────────────────────────
     Owner's decision, 2026-08-04: there is no WordScript account and none is
     coming in any foreseeable release, so the surface that explained the
     absence is gone too. The screen was already honest — it led with "there is
     no WordScript account" and refused to draw a hosted tier — but a settings
     entry is a promise that a decision lives there, and this one has no
     decision in it. Two rows saying "never" and a sync lane nobody can enable
     is a page about a feature, and the feature is that there is no feature.

     This is about the WORDSCRIPT account only. It says nothing about local or
     self-hosted AI models, which are a lane on AI Models and unaffected.

     Where its two real sentences went:
       - "your data stays on this machine"  ->  Privacy & Data, which already
         owned where the data lives and for how long.
       - "the accounts you already have are model vendors'"  ->  AI Models,
         which is where those accounts are set.
     Its data-export card was never here; §4.2 moved it to Privacy & Data. */

  /* ── Settings: Diagnostics ──────────────────────────────────────────── */

  SCREENS.diagnostics = function () {
    var tabs = ["Checks", "Preview", "Logs"];
    var active = activeSub("diagnostics", tabs);
    var body;

    if (active === "Checks") {
      body = card({
        title: "Runtime snapshot",
        desc: {
          b: "This contract comes from the native runtime snapshot. Unsaved changes in this window do not change the running contract until you save settings.",
          a: "From the native runtime. Unsaved edits here do not change it."
        },
        rows: [
          row({ label: "Stage", ctl: badge("idle", "plan") }),
          row({ label: "Active session", ctl: '<span class="mono muted">no session armed</span>' }),
          row({ label: "Transcription path", ctl: '<span class="mono muted">groq / whisper-large-v3-turbo</span>' }),
          row({ label: "Provider readiness", ctl: badge("Ready", "success") }),
          row({ label: "Work mode", ctl: '<span class="mono muted">auto → cleanup</span>' }),
          row({ label: "Capture runtime", ctl: '<span class="mono muted">native · 10 min cap · 3 s silence stop</span>' }),
          row({ label: "Capture device", ctl: '<span class="mono muted">Yeti Nano Analog Stereo</span>' }),
          row({ label: "Pipeline", ctl: '<span class="mono muted">capture · provider · transform · insert</span>' }),
        ]
      }) + card({
        title: "Run a check",
        desc: "A full capture-to-insert pass against the current native state.",
        rows: [
          row({ label: "Session source", ctl: select("Diagnostics demo", ["Hold to talk", "Tap to toggle", "Diagnostics demo"]) }),
          row({ label: "Text profile", ctl: select("General writing", ["Developer notes", "General writing", "Support reply"]) }),
          row({ label: "Preview target", ctl: select("Editor preview", ["Editor preview", "Clipboard fallback preview"]) }),
        ],
        foot: btn("Run check", "primary", { icon: "play" }) + btn("Open pop-out", "ghost", { icon: "external" })
      });
    } else if (active === "Preview") {
      body = card({
        title: "Diagnostics preview",
        desc: {
          b: "This preview belongs to the active diagnostics lane in this window. It is not the recovery scratchpad from Input.",
          a: "The diagnostics lane only. Not the recovery scratchpad."
        },
        rows: [
          row({ label: "Target", ctl: '<span class="mono muted">this window</span>' }),
          row({ label: "Insert mode", ctl: '<span class="mono muted">auto_paste</span>' }),
          row({ label: "Fallback path", ctl: '<span class="mono muted">clipboard → scratchpad</span>' }),
          row({ label: "Profile used", ctl: '<span class="mono muted">General writing</span>' }),
        ],
        /* Raw beside transformed, not stacked — the one idea kept from the
           withdrawn commit screen (SETTINGS_REWORK_PLAN.md section 11.15). It
           is a pairing, not a feature: no commit action follows it here,
           because a commit control in Diagnostics would commit a session
           nobody dictated. */
        body: '<div class="rows"><div class="row stack"><div class="diff">' +
          '<div class="diff-pane" data-side="in"><h4>Raw</h4><p>' +
          t("um okay so let's uh ship the settings restructure today and and review the overlay tab yeah") +
          "</p></div>" +
          '<div class="diff-pane" data-side="out"><h4>Cleanup</h4><p>' +
          "Okay, let's ship the settings restructure today and review the <mark>overlay</mark> tab." +
          "</p></div></div></div></div>"
      }) + card({
        /* Title and the "before" description are RebuildLabTab's own strings;
           the rule names are the labels the runtime prints for an applied
           rule. The shipped panel translates roughly 25 of them. */
        title: "Decoded transform rules",
        desc: {
          b: "Raw logs stay unchanged in the textarea above. Known transform rules from recent entries are translated here for faster reading.",
          a: "Rules from recent entries, translated."
        },
        body: check([
          { state: "ok", label: "Removed filler words", detail: "“um”, “uh”." },
          { state: "ok", label: "Collapsed a repeated word", detail: "“and and” → “and”." },
          { state: "ok", label: "Dictionary replacement applied", detail: "“overlay”, from the profile vocabulary." },
          { state: "ok", label: "Capitalized sentence start", detail: "One sentence." },
          { state: "ok", label: "AI post-correction applied", detail: "Cleanup, 673 ms." },
          { state: "todo", label: "Hallucination filtered", detail: "Nothing filtered. No content was added." },
        ])
      });
    } else {
      body = card({
        title: "Runtime logs",
        desc: {
          b: "Structured native logs stay enabled and are buffered here for fast inspection while the runtime is active. The durable transcript record lives in the History area.",
          a: "Buffered while the runtime is active. Durable transcripts live in History."
        },
        body: '<div class="log">' +
          [["09:42:11.204", "INFO", "trigger: hotkey Ctrl+Super pressed, activation=tap"],
          ["09:42:11.207", "INFO", "capture: started, device=System default microphone"],
          ["09:42:25.881", "INFO", "capture: stopped, 14.6s, peak=-11.2dBFS"],
          ["09:42:25.883", "INFO", "provider: groq whisper-large-v3-turbo, 1 segment"],
          ["09:42:26.940", "INFO", "provider: ok, 1057ms"],
          ["09:42:26.942", "INFO", "mode_router: auto -> cleanup (workspace_context=editor)"],
          ["09:42:27.615", "INFO", "transform: cleanup ok, 673ms, 2 repairs applied"],
          ["09:42:27.618", "INFO", "insert: driver=xdotool strategy=paste"],
          ["09:42:27.702", "INFO", "insert: ok, clipboard restored"],
          ["09:42:27.703", "INFO", "session: ended, surface=result_overlay"],
          ["09:41:02.118", "WARN", "portal: RemoteDesktop.SelectDevices unavailable, staying on xdotool"],
          ["09:38:44.007", "ERROR", "insert: target ignored paste, fell back to scratchpad"]]
            .map(function (l) {
              return '<div><span class="ts">' + t(l[0]) + '</span><span class="lv" data-l="' + l[1] + '">' +
                t(l[1]) + '</span><span class="msg">' + t(l[2]) + "</span></div>";
            }).join("") + "</div>"
      });
    }

    return [
      viewTop({
        title: "Diagnostics",
        lead: "What the runtime is doing, in its own vocabulary.",
        tabs: { screen: "diagnostics", items: tabs },
      }),
      body,
    ].join("");
  };

  /* ── Settings: About & Updates ──────────────────────────────────────── */

  SCREENS.about = function () {
    return [
      viewTop({ title: "About & Updates", lead: "Lightweight speech-to-text for your desktop." }),

      /* The shipped card is careful about one thing and this keeps it: until a
         release exists, this is release-path diagnostics, and it must not read
         as though installers or in-app updates already work.

         The version, channel and install kind used to be three stat tiles
         across the top. A version string is not a metric — it is a fact you
         copy into a bug report — so it is the first row of the card that is
         about how this build got here. */
      sec("This build", null, card({
        rows: [
          row({
            label: "Version",
            ctl: '<span class="rowflex"><span class="mono muted">0.2.2-alpha</span>' +
              btn("Copy", "ghost", { icon: "copy" }) + "</span>"
          }),
          row({
            label: "How you run it today",
            hint: "A developer build from source. There is no installer yet.",
            ctl: '<span class="mono muted">npm run tauri dev</span>'
          }),
          row({
            label: "Latest published release",
            hint: "None yet — the cross-platform release path is still being assembled.",
            ctl: '<span class="rowflex">' + badge("In progress", "warning") + btn("Check now", "ghost", { icon: "restore" }) + "</span>"
          }),
          row({ label: "Target build lanes", hint: "Linux AppImage, macOS universal, Windows MSI.", ctl: badge("Planned", "plan") }),
        ]
      })),

      sec("Project", null, card({
        rows: [
          row({ label: "GitHub", ctl: btn("Open", "ghost", { icon: "external" }) }),
          row({ label: "SW labs", ctl: btn("Open", "ghost", { icon: "external" }) }),
          row({ label: "Release workflow", ctl: btn("Open", "ghost", { icon: "external" }) }),
          row({ label: "Release runbook", ctl: btn("Open", "ghost", { icon: "external" }) }),
        ]
      })),

      /* Two of the three rows here were Account & Sync's own banner said a
         second time, one screen away. A thing that has a screen states its
         status on that screen; this section is for what has no screen at all.
         2026-08-04: the account row comes back into this section, because the
         screen it pointed at no longer exists. It reads differently now and it
         should — "not built yet" and "not going to be built" are not the same
         answer, and only the second one belongs in a list somebody reads to
         find out whether to keep waiting. */
      sec("Not built", "Named here so it is not looked for elsewhere.", card({
        rows: [
          row({ label: "Translation mode", hint: "Not decided. Recorded as a roadmap candidate with an open gate.", ctl: badge("Candidate", "plan") }),
          row({ label: "Meeting capture", hint: "Sketched as a preview. Needs system-audio capture and a second window.", ctl: badge("Preview", "plan") }),
          row({
            label: "Account, sign-in and sync",
            hint: "Not planned, rather than not started. Everything is on this machine, there is nothing to sign in to, and no server of ours holds anything. The keys you do hold are model vendors' and live in AI Models.",
            ctl: badge("Never", "success")
          }),
        ]
      })),
    ].join("");
  };

  /* ── Preview: Onboarding ────────────────────────────────────────────── */

  /* ── Preview: Onboarding ────────────────────────────────────────────────
     Rebuilt 2026-08-03. It was one static screen — step 3 of 3, "Try your
     hotkey" — which said what the last step looks like and nothing about the
     flow. A setup flow's whole content is its ORDER: what is asked first, what
     is proved before the next thing is asked, and what happens when an answer
     is "not yet". A single frame cannot show any of that, so this one is
     walkable: every step, forward and back, with the rail as a control.

     THE ORDER IS THE ARGUMENT, and it follows one rule — **nothing is claimed
     until it is proved.** Each step ends in a checked fact, not a filled
     field, and the flow ends by producing text rather than by saying it will.

       1  Welcome       what this is, and the one sentence about where audio goes
       2  Microphone    a device, a level, and a permission that was granted
       3  AI Models     the connection — lane, provider, key, verified
       4  Hotkey        a binding the OS actually accepted
       5  Insert        whether text can reach the app you were in
       6  Try it        one real dictation, end to end
       7  Done          what was set, and the one thing left open

     WHAT THE DONOR SETTLES. `OnboardingFlow.tsx` builds its step list
     dynamically (`SKIPPABLE_STEPS`, steps appended per account state), renders
     `<StepProgress>` from that list, and — the part worth copying — its setup
     step renders `TranscriptionModelPicker`, the same component the settings
     page uses. A setup flow that draws its own simplified twin of a control
     teaches a screen the user never sees again, and the two drift the moment
     one is edited. Step 3 here therefore renders the same lane segment and the
     same provider grid as AI Models.

     WHERE WE DIVERGE, AND WHY. The donor asks for a use case first and lets
     several steps be skipped. WordScript's blocking facts are different: a
     dictation that cannot be inserted is the failure this product has actually
     shipped (see `known-issues/`), and it is invisible until the first real
     dictation. So insert readiness is its own step, before the proof rather
     than after it, and the proof is not skippable — it is the only step that
     demonstrates the product instead of configuring it. */
  var OB_STEPS = [
    { id: "welcome", label: "Welcome", icon: "wand" },
    { id: "mic", label: "Microphone", icon: "mic" },
    { id: "models", label: "AI Models", icon: "models" },
    { id: "hotkey", label: "Hotkey", icon: "keyboard" },
    { id: "insert", label: "Insert", icon: "delivery" },
    { id: "try", label: "Try it", icon: "play" },
    { id: "done", label: "Done", icon: "check" }
  ];

  SCREENS.onboarding = function () {
    var i = Math.max(0, Math.min(state.ob, OB_STEPS.length - 1));
    var step = OB_STEPS[i];

    /* THE RAIL IS A CONTROL, NOT A DECORATION. A progress indicator you cannot
       click is a promise that the flow is linear, and this one is not: every
       step before the current one is a decision you may want to revisit after
       seeing what it caused. Steps ahead stay unreachable, because claiming
       you can jump to a step whose prerequisites are unmet is the same lie in
       the other direction. */
    function rail() {
      return '<div class="obrail">' + OB_STEPS.map(function (s, ix) {
        var st = ix < i ? "done" : ix === i ? "now" : "todo";
        var inner = '<span class="obrail-dot">' +
          (st === "done" ? icon("check") : icon(s.icon)) + "</span>" +
          '<span class="obrail-label">' + t(s.label) + "</span>";
        return (ix <= i
          ? '<button class="obrail-step" data-ob="' + ix + '" data-state="' + st + '">' + inner + "</button>"
          : '<span class="obrail-step" data-state="' + st + '">' + inner + "</span>") +
          (ix < OB_STEPS.length - 1 ? '<span class="obrail-bar" data-state="' + (ix < i ? "done" : "todo") + '"></span>' : "");
      }).join("") + "</div>";
    }

    function foot(nextLabel, opts) {
      opts = opts || {};
      return '<div class="obfoot">' +
        (i > 0 ? '<button class="btn" data-v="ghost" data-ob="' + (i - 1) + '">' + icon("arrow-left") + "Back</button>" : "<span></span>") +
        '<div class="rowflex">' +
        (opts.skip ? '<button class="btn" data-v="ghost" data-ob="' + (i + 1) + '">' + t(opts.skip) + "</button>" : "") +
        (i < OB_STEPS.length - 1
          ? '<button class="btn" data-v="primary" data-ob="' + (i + 1) + '"' + (opts.blocked ? " disabled" : "") + ">" +
          t(nextLabel || "Continue") + "</button>"
          : '<button class="btn" data-v="primary" data-ob="0">' + t("Start over") + "</button>") +
        "</div></div>";
    }

    var body;

    if (step.id === "welcome") {
      body = card({
        title: "WordScript turns speech into text, in any application",
        desc: {
          b: "Press one key anywhere, say what you mean, and the text appears where your cursor already was. Six steps, about two minutes, and the last one proves it works rather than telling you it does.",
          a: "Press one key anywhere, speak, and the text appears at your cursor. Six steps, and the last one proves it."
        },
        body: '<div class="rows">' +
          row({
            label: "Where your audio goes",
            hint: {
              b: "You choose in step three, and the choice is honest either way: a cloud provider you hold a key for, or a model on this machine that sends nothing anywhere. Neither is preselected for you.",
              a: "You choose in step three: a cloud provider you hold a key for, or a model on this machine."
            },
            ctl: badge("Your choice", "plan")
          }) +
          row({
            label: "What is stored",
            hint: "Transcripts stay on this machine. API keys go to the OS secret store, never to a config file.",
            ctl: badge("Locally", "success")
          }) +
          "</div>"
      });

    } else if (step.id === "mic") {
      body = card({
        title: "Which microphone",
        desc: "The device, and proof that sound is actually arriving from it.",
        rows: [
          row({ label: "Input device", ctl: '<span class="rowflex">' + select("Yeti Nano Analog Stereo — default", ["Yeti Nano Analog Stereo — default", "Built-in Audio"]) + btn("Rescan", "ghost") + "</span>" }),
          row({ label: "Permission", hint: "Granted by the OS, checked natively rather than assumed.", ctl: badge("Granted", "success") })
        ],
        body: '<div class="rows"><div class="row stack">' +
          '<div class="row-text"><b>Say something</b><span class="row-hint">' +
          p("A capture that never crosses the mark is discarded as empty, so this is worth checking before the hotkey exists.") +
          "</span></div>" +
          level(64, 71, 30, "ok", "Good — peak −13 dBFS.") +
          "</div></div>"
      });

    } else if (step.id === "models") {
      /* THE STEP THIS FLOW WAS MISSING ENTIRELY. Setup asked for a provider in
         one line and never mentioned that the same connection drives cleanup,
         translation and the assistant — so the first surprise arrived later,
         in settings, as five model rows nobody had been told about.

         It renders the SAME lane segment and the SAME provider grid as AI
         Models. Not a simplified twin: the control the user meets here is the
         control they will find again. */
      body = card({
        title: "One connection, for everything",
        desc: {
          b: "The same connection recognizes your speech and runs every text job — cleanup, rewrite, translate, prompt enhance and the assistant. Set it once here; each job can be pointed somewhere else later, and most never are.",
          a: "The same connection recognizes speech and runs every text job. Set once; any job can be repointed later."
        },
        rows: [
          row({
            label: "Lane",
            hint: "Cloud sends audio and text to a provider you hold a key for. Local keeps everything on this machine and needs a download.",
            ctl: segState("lane", ["Cloud", "Local", "Self-hosted", "Enterprise"])
          }),
          /* THE ONE SETTING THAT EARNS A LINE HERE AND IS NOT A CONNECTION.
             Auto-detect works, so this is not blocking — but the user this
             product is built for dictates German and writes English, and
             getting it wrong is the difference between a usable first
             dictation and a baffling one. One row, no step of its own. */
          row({
            label: "What you speak",
            hint: "Auto-detect reads it from the audio, per dictation. Naming it is a little faster and a little more accurate.",
            ctl: select("Auto-detect", ["Auto-detect", "German", "English", "French", "Spanish"])
          })
        ].concat(
          state.lane === "Cloud" ? [
            providerPick("Cloud", "Groq", {
              hint: "Speech and language are different capabilities and not every provider has both."
            }),
            row({
              label: "API key",
              hint: "Held in the OS secret store. Never written to the config file, and never read back into the interface.",
              ctl: '<span class="rowflex">' + field("gsk_••••••••••••••••", { w: "190px" }) + badge("Verified", "success") + "</span>"
            })
          ]

          : state.lane === "Enterprise" ? [
            providerPick("Enterprise", "AWS Bedrock", {
              label: "Account",
              hint: "These authenticate against an account and a region rather than with a single token, and each carries its own credential shape."
            }),
            row({ label: "Region", ctl: select("eu-central-1", ["eu-central-1", "us-east-1", "us-west-2"]) }),
            row({
              label: "Credentials",
              hint: "Access key, secret and region — or the ambient AWS credential chain when this machine already has one.",
              ctl: '<span class="rowflex">' + badge("Not configured", "plan") + btn("Configure", "ghost", { icon: "key" }) + "</span>"
            }),
            row({
              label: "Speech",
              hint: "Only Azure OpenAI transcribes among the three. On the other two, recognition needs the Cloud or Local lane and the writing jobs use your account.",
              ctl: badge("Azure only", "warning")
            })
          ]

          : state.lane === "Self-hosted" ? [
            row({
              label: "URL",
              hint: "An OpenAI-compatible server you operate, on another machine. Not another name for the on-device lane.",
              ctl: '<span class="rowflex">' + field("", { placeholder: "http://10.0.0.2:8080/v1", w: "220px" }) + btn("Test", "ghost") + "</span>"
            }),
            row({
              label: "Model id",
              hint: "A server behind a URL does not have to publish a model list, so it is typed rather than picked.",
              ctl: field("", { placeholder: "llama-3.3-70b", w: "190px" })
            }),
            row({
              label: "Credential",
              hint: "Optional. Some self-hosted servers take a bearer token, most take none.",
              ctl: '<span class="rowflex">' + badge("None", "plan") + btn("Add", "ghost", { icon: "key" }) + "</span>"
            }),
            row({
              label: "Speech",
              hint: "A chat endpoint does not transcribe. Recognition needs the Cloud or Local lane; the writing jobs use your server.",
              ctl: badge("Needs another lane", "warning")
            })
          ] : []
        )
      })

        /* THE LOCAL LANE GETS THE REAL THING, NOT A SELECT.
           A picker that names `ggml-base · 142 MB` and cannot fetch it is the
           same failure the settings surface had before §11.34: the lane can be
           chosen and then not populated. Onboarding is the worst place for it —
           it is the one moment the user has agreed to spend time on setup.

           So it renders `modelRow()`, the component the settings screen uses,
           with its real controls: a size before the download, a progress bar
           with cancel, and a state that decides the button. One speech model
           and one language model are all this step needs; everything else is
           in Settings, and the note says so rather than listing it here. */
        + (state.lane === "Local"
          ? sec("Pick one speech model", "It runs on this machine, so it has to be downloaded once. Sizes are stated before the download, not during it.",
            card({
              body: '<div class="mdl-list">' +
                modelRow({ brand: "openai", name: "ggml-base", size: "142 MB", detail: "multilingual · the recommended balance", state: "downloading", pct: 46 }) +
                modelRow({ brand: "openai", name: "ggml-base.en", size: "142 MB", detail: "English only, more accurate on English" }) +
                modelRow({ brand: "openai", name: "ggml-small", size: "466 MB", detail: "multilingual · better on accents" }) +
                "</div>"
            })
          ) +
          /* Two cards, not one with `rows` and `body`. `card()` renders rows
             before body, so a single card put "which server runs it" above
             "which model" — the answer before the question. The choice comes
             first and what it implies follows it. */
          sec("And one language model", "This one writes: cleanup, rewrite, translate and the assistant all use it.",
            card({
              body: '<div class="mdl-list">' +
                modelRow({ brand: "llama", name: "llama-3.2-3b-instruct", size: "2.0 GB", detail: "Q4_K_M · fast enough for cleanup on CPU" }) +
                modelRow({ brand: "qwen", name: "qwen2.5-7b-instruct", size: "4.4 GB", detail: "Q4_K_M · the general recommendation" }) +
                modelRow({ brand: "gemma", name: "gemma-3-4b-it", size: "2.5 GB", detail: "Q4_K_M · strong on German" }) +
                "</div>"
            }) +
            card({
              rows: [
                row({
                  label: "Server",
                  hint: "WordScript ships one and starts it when a job needs it. If you already run Ollama or LM Studio, point it there instead in Settings.",
                  ctl: '<span class="rowflex"><span class="selmark">' + brand("ollama") + "</span>" + badge("Bundled", "success") + "</span>"
                }),
                row({
                  label: "This machine",
                  hint: "Detected, not configured. CPU-only runs the small models and struggles above 7B.",
                  ctl: '<span class="rowflex">' + badge("CPU only", "warning") + '<span class="muted">32 GB RAM</span></span>'
                }),
                row({ label: "Credential", hint: "None, and nothing to add. This lane sends nothing anywhere.", ctl: badge("Not needed", "success") })
              ]
            })
          )
          : "")

        + note("Every job that runs a model is listed in Settings → AI Models, with this connection as its default. Nothing below it has to be set now.", "models");

    } else if (step.id === "hotkey") {
      body = card({
        title: "Which key starts a dictation",
        desc: "Registered with the OS now, so a refusal is found here rather than the first time you need it.",
        rows: [
          row({ label: "Dictate", hint: "Works in any application, including ones WordScript knows nothing about.", ctl: kbd("Ctrl+Super") }),
          row({
            label: "Registration",
            hint: "The OS accepted it. A combination another application already holds is reported here, not swallowed.",
            ctl: badge("Accepted", "success")
          }),
          row({
            label: "How it activates",
            hint: "Tap to start and tap to stop, or hold the key for as long as you speak.",
            ctl: seg(["Tap", "Hold"], "Tap")
          })
        ]
      });

    } else if (step.id === "insert") {
      /* OUR STEP, NOT THE DONOR'S, and it is here because of what has actually
         gone wrong: a dictation that transcribes perfectly and then cannot be
         placed. It is invisible until the first real one, it depends on the
         session type rather than on anything the user chose, and on Wayland it
         is a decision rather than a missing package. Better found in setup with
         a sentence than at the end of the first sentence worth keeping. */
      body = card({
        title: "Can text reach the app you were in",
        desc: {
          b: "This is the part that fails quietly. Transcription can be perfect and the text still not arrive, because placing it depends on the window system rather than on anything you configured.",
          a: "The part that fails quietly: placing text depends on the window system, not on your settings."
        },
        body: check([
          { state: "ok", label: "Session", detail: "Linux · X11 — direct paste is available.", tag: "tier 1", tagTone: "success" },
          { state: "ok", label: "Driver", detail: "xdotool resolved. Your previous clipboard is restored after every insert.", code: "auto_paste · xdotool" },
          { state: "ok", label: "Fallback", detail: "If an app ignores the paste, the transcript waits in recovery instead of being lost." }
        ])
      }) + note("On a pure Wayland session this step reports clipboard-only instead, and says why: the paste drivers there raise a compositor prompt on every insert, which is worse than pressing Ctrl+V yourself.", "about");

    } else if (step.id === "try") {
      body = card({
        title: "Try it once",
        desc: "The only step that demonstrates the product rather than configuring it.",
        rows: [
          row({ label: "Press", hint: "Anywhere — including in this field.", ctl: kbd("Ctrl+Super") })
        ],
        body: '<div class="rows"><div class="row stack">' +
          '<div class="row-text"><b>Click here and use your hotkey</b>' +
          '<span class="row-hint">' + p("Whatever you say lands in this field. Nothing is saved and nothing is sent anywhere you did not choose.") + "</span></div>" +
          textarea("", "waiting for the hotkey…", 3) +
          '<div class="rowflex">' + dot("success") +
          '<span class="muted">Hotkey registered · microphone reachable · insert driver xdotool</span></div>' +
          "</div></div>"
      }) + card({
        body: check([
          { state: "ok", label: "Connection", detail: "Groq, key verified in the OS secret store." },
          { state: "ok", label: "Microphone", detail: "Yeti Nano reachable, level checked." },
          { state: "ok", label: "Insert", detail: "xdotool available on the active X11 session." },
          { state: "todo", label: "First dictation", detail: "Not yet. This step ends when text lands above." }
        ])
      });

    } else {
      body = card({
        title: "Ready",
        desc: "What is set, and where to change it.",
        rows: [
          row({ label: "Connection", ctl: '<span class="jobmodel">' + brand("Groq") + '<span class="jobmodel-name">' + t("whisper-large-v3-turbo") + "</span></span>" }),
          row({ label: "Hotkey", ctl: kbd("Ctrl+Super") }),
          row({ label: "Delivery", ctl: badge("Insert at cursor", "success") }),
          row({
            label: "Mode",
            hint: "Auto picks Cleanup, Draft or Prompt Enhance per dictation. Every other mode stays your call.",
            ctl: badge("Auto", "accent")
          })
        ]
      }) + card({
        title: "One thing is still open",
        desc: {
          b: "Words WordScript cannot know yet — names, products, technical terms. It learns them by watching what you correct, so this fills itself in; adding a few now just makes the first day better.",
          a: "Names and terms it cannot know yet. It learns them from your corrections — adding a few now just helps the first day."
        },
        rows: [
          row({ label: "Words & names", hint: "Lives in the active profile, with everything else that is per profile.", ctl: btn("Add a few", "ghost", { icon: "arrow" }) })
        ]
      }) +

        /* WHAT IS NOT IN THIS FLOW, STATED RATHER THAN OMITTED.
           A setup flow's real failure mode is length, and the way it gets long
           is one defensible addition at a time. The test each of these failed:
           **does it block the first dictation?** Nothing below does. Every one
           has a working default, and a user who never opens it still dictates
           successfully — which is what makes leaving it out a decision rather
           than an oversight.

           This card is on the last step and not the first, because it is only
           readable once the flow is behind you: on step 1 it would be a list of
           things you have not seen yet. */
        card({
          title: "Deliberately not in this flow",
          desc: {
            b: "Each of these has a working default and none of them blocks a first dictation, so asking about them here would trade the flow's length for nothing. They are one click away, and the surfaces that need them say so where they are needed.",
            a: "Each has a working default and none blocks a first dictation. One click away when you want them."
          },
          body: '<div class="rows">' +
            row({ label: "Processing modes", hint: "Auto picks per dictation. Cleanup, Rewrite, Translate, Prompt Enhance and the assistant all have models already, from the connection you set.", ctl: badge("Auto", "plan") }) +
            row({ label: "Communication style", hint: "Register, length and writing sample. Empty is a valid setting and the assistant writes plainly without it.", ctl: badge("In the profile", "plan") }) +
            row({ label: "Overlay placement, sound cues, history policy", hint: "Defaults are safe: the overlay follows the active screen, cues are on, history is kept locally.", ctl: badge("Settings", "plan") }) +
            row({ label: "Notes, meetings and the Ask window", hint: "A second capture type and a second surface. Nothing about a dictation depends on them.", ctl: badge("Later", "plan") }) +
            row({ label: "Coding agents and integrations", hint: "Phase 8, and a different job entirely — those speak to you while they work.", ctl: badge("Phase 8", "plan") }) +
            "</div>"
        });
    }

    return [
      viewTop({
        title: "Onboarding",
        lead: "Seven steps, walkable. Nothing is claimed until it is proved.",
        banner: { text: "Planned for Phase 6. The flow's shape and order, not a working setup." },
      }),
      rail(),
      '<div class="obstep"><span class="obstep-n">' + t("Step " + (i + 1) + " of " + OB_STEPS.length) + "</span>" +
      "<h2>" + t(step.label) + "</h2></div>",
      body,
      foot(step.id === "try" ? "It worked" : null, {
        skip: step.id === "try" ? "Skip the proof" : null,
        blocked: false
      })
    ].join("");
  };


  /* ── Preview: Meeting capture ───────────────────────────────────────────────
     Added 2026-08-03. Notes could separate speakers and had no way to make a
     recording — a diarization feature with no recording entry point. This is
     the missing door, drawn as a preview.

     IT IS A SECOND WINDOW, NOT A SECOND STATE OF THE DICTATION OVERLAY. That
     distinction is the whole reason this can be sketched without reopening the
     plan's §1 (the overlay is out of scope) or its §10.3 (Phase 3 wants a
     reading surface in a window that cannot be one). §10.3's conflict is real
     because the dictation pill must keep `focus:false` — taking focus moves the
     insert target away from the app being dictated into. A meeting inserts
     nothing. There is no insert target to protect, so the constraint that makes
     §10.3 unsolvable simply does not apply here, and a window that is read for
     an hour may be moved, resized, collapsed and focused.

     What the landscape settles, and what it does not:

       Settled — no bot joins the call. Granola's model: capture system audio
       and the microphone locally. WordScript is local-first and has no server
       to send a participant from, so this is the only honest lane anyway.

       Settled — the transcript arrives while you are still talking (Otter's
       one differentiator), which is what makes the note's left column worth
       looking at during the meeting rather than after it.

       Settled — content protection. OpenWhispr calls setContentProtection(true)
       on its meeting surfaces so they never appear in a screen share or a
       recording. A window that floats over a call being shared needs this and
       the dictation pill never did.

       Settled — two audio streams with echo cancellation, because the
       microphone hears the speakers. OpenWhispr carries an AEC sidecar and a
       leak detector for exactly this.

     What is NOT settled and is named on the screen rather than drawn away:
     whether meeting capture is started by a hotkey, by detecting a call, or by
     both; and what happens to the audio of a meeting nobody keeps. */

  /* ── Preview: the agent overlay ───────────────────────────────────────────
     ADR 0030 specifies this surface in one paragraph and it has never been
     drawn. Settings → Agents configures a thing nobody has seen, which is the
     same gap Meeting capture had before §11.6.

     THE SCOPE NOTE THIS SCREEN OWES. The plan's §1 puts the overlay out of
     scope, and that stands: no shipped overlay token, size or CSS rule is
     touched here. This is not the dictation overlay restyled — it is a
     surface that does not exist yet, in a phase that has not started, drawn
     for the first time. What it borrows from the shipped overlay is its base
     geometry (480 × 60, `REFERENCE.md`), because ADR 0030 says it extends it.

     THE SPEC, VERBATIM, SO THE DRAWING CAN BE CHECKED AGAINST IT:

       "The surface is a pill with two wings. The base is the existing edit
        overlay, extended, so the user already knows how to operate it.
        - The pill (always visible when delivery is Agent): microphone,
          waveform, status dot, the word Agent, timer. The status dot carries
          the most important information — as long as nothing is waiting,
          neither panel is needed.
        - Left, expandable: targets with state. One row per target, a status
          (running / waiting for you / done / idle) and an unread counter.
        - Right, expandable: the history — the active thread with questions,
          answers and completion messages.
        So space on the left, time on the right."

     THE WINGS ARE DRAWN SEPARATELY, AND THAT IS THE SPEC RATHER THAN A
     CONCESSION. ADR 0030 has them "expandable separately, because the normal
     case is that the application is not in the foreground", and the status dot
     is explicitly enough on its own. Three states, in the order they occur:
     nothing waiting, something waiting, and looking at the work. Both wings
     open at once is legal and measures 1038 px; it is a number here rather
     than a drawing, because it is the rarest of the three and drawing it would
     cost the other two their true size. */
  SCREENS.agentoverlay = function () {

    /* THE PILL, AS IT SHIPS.
       Geometry, tokens and composition read from `src/styles/overlay-pill.css`
       and `src/components/overlay/OverlayPill.tsx`, not invented here: 40 px
       tall, `width: max-content`, 999 px radius, `--ov-surface #1b1b1d`, a
       hairline `rgba(255,255,255,0.09)`, the inset top highlight and NO outer
       shadow (WebKitGTK paints one opaquely — see the file's own note). The
       composition is the shipped recording pill's, in its order:

         mic · bars · divider · mode chip · divider · timer

       The mode chip reads `Agent`, which is the whole point: ADR 0030 says
       `delivery = agent` makes the mode axis vacuous and the pill shows
       `Agent` where a mode would otherwise stand. Nothing else about the pill
       changes. This is a state of the overlay, not a second overlay. */
    function pill(o) {
      o = o || {};
      return '<div class="ovp-shell">' +
        (o.tab ? o.tab : "") +
        '<div class="ovp"' + (o.rec ? " data-rec" : "") + ">" +
        '<span class="ovp-mic">' + icon("mic") + "</span>" +
        '<span class="ovp-bars">' + ovBars(o.rec) + "</span>" +
        '<span class="ovp-div"></span>' +
        '<button class="ovp-mode"><span class="ovp-mode-dot"></span>' +
        '<span class="ovp-mode-label">' + t(o.mode || "Agent") + "</span></button>" +
        '<span class="ovp-div"></span>' +
        '<span class="ovp-timer">' + t(o.timer) + "</span>" +
        "</div></div>";
    }

    function ovBars(live) {
      var out = "";
      for (var i = 0; i < 11; i++) {
        var h = live
          ? 4 + Math.abs(Math.sin((i + 2) * 1.9)) * 16
          : 3 + Math.abs(Math.sin(i * 0.9)) * 3;
        out += '<i style="height:' + h.toFixed(1) + 'px"></i>';
      }
      return out;
    }

    /* THE TAB.
       Not a wing, not a panel — the same small tab the overlay already grows
       out of its own edge, twice: `.ov-learned-tab` on the left (ADR 0035, one
       shot, retracts) and `.ov-limit-tab` on the right (the auto-stop, open
       for the whole recording, clickable). This is a third of the same
       component, and it is built to their constraints exactly.

       WHY THE LEFT SLOT, WITH NO COLLISION TO ARBITRATE. `REFERENCE.md` puts
       one tab per side "so neither has to yield to the other", so a third has
       to prove it cannot contend. It can: the left slot belongs to the learned
       tab, and a bridge session cannot produce one. Learning is filled by
       observing repairs (ADR 0035) in the finalization stage, and ADR 0030
       states that `finalize_with_text_rules` does not run on bridge output at
       all. In Agent delivery the learned tab is structurally absent, so the
       left slot is free for exactly as long as this tab can exist. The right
       slot stays with the auto-stop, which is time-critical and yields to
       nothing.

       THREE CONSTRAINTS INHERITED FROM THE TWO THAT SHIP, all load-bearing:
       out of the pill's flex flow (in the flow it widens the pill, and a pill
       wider than the 480 px window has its rounded ends clipped); `width`
       animated, never `transform` or `opacity` (a compositor layer that
       outlives a surface swap is the WebKitGTK ghosting mechanism the file
       documents at length); and the shutter paints nothing while the inner
       element is pinned to the shutter's right edge, so the tab reads as
       emerging from behind the pill rather than as a box growing in place.

       IT IS CLICKABLE, like the limit tab and unlike the learned one, because
       it is the way into the window below. */
    function agentTab(label) {
      return '<span class="ovp-tab"><span class="ovp-tab-inner">' +
        '<span class="ovp-tab-dot"></span>' +
        '<span class="ovp-tab-label">' + t(label) + "</span></span></span>";
    }

    /* THE WINDOW.
       Everything agent-specific lives here and nothing of it lives on the
       pill. Fourth member of the window family — Ask, the meeting HUD, Actions,
       this — with the same chrome, the same OS-drawn decoration (ADR 0003) and
       the same resize grip.

       This is where ADR 0030's two halves land, and the split it names is the
       window's layout rather than two wings on a pill: space on the left
       (targets, their state, what is unread), time on the right (the thread,
       and the answer window at its foot). On a pill that split cost 1038 px of
       always-on-top furniture. In a window it costs nothing until you open it,
       which is the correction. */
    function agentWindow() {
      var targets = [
        ["WordScript", "work · writes", "Waiting for you", "accent", "1"],
        ["dotfiles", "inspect · read-only", "Running", "success", null],
        ["sw-forge-org", "resume · last thread", "Idle", null, null]
      ];

      return '<div class="agw">' +
        '<div class="chatwin-deco"><b>' + t("Agents") + "</b>" +
        '<span class="win-sub">' + t("3 targets · 1 waiting") + "</span>" +
        "<button aria-label='Close'>" + icon("x") + "</button></div>" +

        '<div class="agw-body">' +

        '<div class="agw-rail">' +
        /* THE RAIL WAS READING AS THREE AGENTS — corrected 2026-08-03,
           ADR 0043. Three rows, three status dots, three names, and nothing
           on the surface saying that one process drives all of them. ADR 0030
           is built on that being one process: it is WordScript's only client,
           the agents it starts get no entry of their own, and for them IT is
           the human. A window that suggests three peers is arguing against the
           decision it implements.

           The fix is not a sentence. The orb sits at the head of the rail as
           the identity the rail belongs to, and the targets are indented under
           it — the same relationship `conn()` draws for accounts under a
           provider. They are what the one voice is working on, not three
           things that can each speak. */
        '<div class="agw-rail-head">' + orb({ state: "idle", size: 18, still: true, label: DESK_CAP }) +
        "<b>" + t(DESK_CAP) + "</b>" +
        '<span class="agw-rail-sub">' + t("one process · speaks for all three") + "</span></div>" +
        '<div class="agw-rail-label"><label>' + t("Working on") + "</label></div>" +
        '<div class="agw-targets">' + targets.map(function (tg, ix) {
          return '<button class="agw-target" aria-current="' + (ix === 0 ? "true" : "false") + '">' +
            dot(tg[3]) +
            '<span class="agw-target-text"><b>' + t(tg[0]) + "</b>" +
            "<span>" + t(tg[1]) + "</span></span>" +
            (tg[4] ? '<span class="agw-unread">' + t(tg[4]) + "</span>" : "") +
            '<span class="agw-target-state">' + t(tg[2]) + "</span>" +
            "</button>";
        }).join("") + "</div>" +
        '<div class="agw-rail-foot">' +
        '<button class="ovp-mini">' + icon("layers") + t("Compact") + "</button>" +
        '<button class="ovp-mini">' + icon("plus") + t("New session") + "</button>" +
        "</div></div>" +

        '<div class="agw-main">' +
        '<div class="agw-main-head"><b>' + t("WordScript") + "</b>" +
        '<span>' + t("work · thread since 09:12") + "</span></div>" +
        '<div class="agw-thread">' +

        '<div class="agw-msg" data-from="ws"><p>' +
        t("The overlay test expects a 480 by 60 surface. Should I update the test or the host?") +
        "</p>" +
        '<div class="agw-opts">' +
        '<button class="agw-opt">' + t("the test") + "</button>" +
        '<button class="agw-opt">' + t("the host") + "</button></div>" +
        '<span class="agw-when">' + t("spoken · 0:06 ago") + "</span></div>" +

        '<div class="agw-msg" data-from="done"><p>' + icon("check") +
        t("dotfiles finished — 3 files changed") + "</p>" +
        '<span class="agw-when">' + t("09:41") + "</span></div>" +

        "</div>" +
        /* The second frozen waveform, and the last one. This strip is the
           moment the user is speaking an answer into a window that is counting
           down, so a level that never moves is the one thing it must not show.
           Same instrument as the meeting HUD and for the same reason — the
           space is small, and a quantised meter survives being small. */
        '<div class="agw-answer">' + icon("mic") +
        matrixField({ mode: "vu", cols: 12, size: 2, gap: 1, ariaLabel: "Input level" }) +
        "<span>" + t("Answer window") + "</span>" +
        '<span class="agw-answer-left">' + t("0:08") + "</span></div>" +
        "</div></div>" +

        /* THE DASH. A strip across the foot of the window, and the only place
           in the product where the machine's own voice is drawn.

           It is at the foot rather than in the thread because it is a state of
           the window, not an entry in it: what is being said right now is
           already the last message above, and repeating it as a second bubble
           would double every question. The strip says who is speaking and how
           loudly; the thread says what was said.

           It is small on purpose. The orb at 22 px is an indicator; the same
           object at 96 px is the notification's whole content. One component,
           two sizes, and the size is what says how much of your attention it
           is asking for. */
        '<div class="agw-voice" data-speaking>' +
        orb({ state: "active", size: 22, level: 0.74 }) +
        '<span class="agw-voice-text"><b>' + t("Speaking") + "</b>" +
        "<span>" + t("“Should I update the test or the host?”") + "</span></span>" +
        '<span class="agw-voice-meta">' + t("Cartesia Sonic-3 · 240 ms") + "</span>" +
        '<button class="ovp-mini">' + icon("x") + t("Stop") + "</button>" +
        "</div>" +

        '<span class="hud-resize" aria-hidden="true"></span></div>';
    }

    /* THE NOTIFICATION — ADR 0043.
       Same orb, one size up, and nothing else on it but the question and the
       way out of it. It is WordScript's own always-on-top window rather than
       an OS notification, because `await` blocks the calling agent until the
       answer budget expires and a question nobody saw is the one failure this
       surface may not have: Focus mode and screen sharing suppress OS
       notifications, and a screen share is when an agent is most likely to be
       running.

       It is content-protected for the same reason the meeting HUD is: a
       question about a private repository does not belong in a shared screen.

       The two answer buttons are the ones the agent offered. A question with
       options never needs the window opened, which is what keeps this small. */
    function agentPopup() {
      return '<div class="agpop">' +
        '<div class="agpop-orb">' + orb({ state: "active", size: 72, level: 0.9 }) + "</div>" +
        '<div class="agpop-body">' +
        '<span class="agpop-from">' + t("WordScript · dotfiles") + "</span>" +
        "<p>" + t("The overlay test expects a 480 by 60 surface. Should I update the test or the host?") + "</p>" +
        '<div class="agpop-opts">' +
        '<button class="agw-opt">' + t("the test") + "</button>" +
        '<button class="agw-opt">' + t("the host") + "</button>" +
        '<button class="agpop-more">' + icon("mic") + t("Answer out loud") + "</button>" +
        "</div>" +
        '<span class="agpop-meta">' + icon("volume") + t("question motif · 0:52 of the answer budget left") + "</span>" +
        "</div>" +
        "<button class='agpop-x' aria-label='Dismiss'>" + icon("x") + "</button></div>";
    }

    return [
      viewTop({
        title: "Agent overlay",
        lead: "What is on screen while coding agents are working and one of them needs you.",
        banner: { text: "Planned for Phase 8 \u2014 ADR 0030. This surface exists in no build." },
      }),

      /* Written to budget on both sides of the switch throughout this screen.
         Nothing about this surface ships, so there is no shipped copy to
         reduce, and §11.10 forbids claiming a cut against nothing. */
      sec("It is the overlay you already have",
        "Agent is what the mode chip says. Everything else about the pill is unchanged.",
        '<div class="ovp-stage">' + pill({ rec: true, timer: "04:12" }) + "</div>" +
        note("The shipped recording pill, drawn at its real geometry: 40 px tall, max-content wide, the composition and tokens from overlay-pill.css. This is a state of that overlay, not a second one.", "ruler")
      ),

      sec("Something needs you",
        "A tab grows out of the left edge and stays out. The same component the overlay already has on both sides.",
        '<div class="ovp-stage">' +
        pill({ rec: true, timer: "04:31", tab: agentTab("1 needs you") }) +
        "</div>" +
        note("The left slot is the learned-word tab's, and a bridge session cannot produce one — it runs no finalization, so it learns nothing. The right slot stays with the auto-stop.", "arrow")
      ),

      sec("Clicking it opens a window",
        "Everything agent-specific is in here, and none of it is on the pill.",
        '<div class="agw-stage">' + agentWindow() + "</div>" +
        note("Fourth member of the window family, after Ask, the meeting HUD and Actions. Same chrome, same resize grip, OS-drawn decoration.", "layers") +
        note("The orb at the head of the rail and the strip at the foot are the same object: one process, one voice. The targets are what it is working on, not three agents that can each speak to you.", "agents", docLink("ADR 0043"))
      ),

      /* THE NOTIFICATION, DRAWN AT THE SIZE IT APPEARS AT. It is deliberately
         the largest drawing on this screen, because it is the one surface here
         that arrives uninvited and the argument for it is that it cannot be
         missed. */
      sec("And if the window is closed, this arrives",
        "A small always-on-top window over every other surface, with a cue on the audio stream every other WordScript sound uses.",
        '<div class="agpop-stage">' + agentPopup() + "</div>" +
        note("Not an OS notification: Focus mode and screen sharing suppress those, and a screen share is exactly when a coding agent is likely to be running. Content-protected, like the meeting HUD — a question about a private repository does not belong in a shared screen.", "privacy") +
        note("The sound is a motif on the one persistent output stream, not a fresh stream per cue and not the system notification sound. That is ADR 0010's shape, re-used rather than re-decided; it also means one application volume in the OS mixer governs it.", "volume", docLink("ADR 0010"))
      ),

      /* THE LINE THIS SCREEN HAS TO HOLD. Two voices, two drawings, and the
         one that ships is not being redesigned here. */
      sec("Your dictation is untouched",
        "The recording overlay keeps its bars, its geometry and its behaviour. Nothing on this page changes it.",
        card({
          rows: [
            row({
              label: "The bars on the pill",
              hint: "Your microphone, drawn as it ships. Eleven bars in a 30 px band, and this page does not touch overlay-pill.css.",
              ctl: badge("Unchanged", "success")
            }),
            row({
              label: "The orb",
              hint: "The machine speaking to you. It exists only where " + DESK + " has a voice — the agent window and the notification — and never on the dictation overlay.",
              ctl: badge("Agents only", "plan")
            }),
            row({
              label: "A dictation while an agent waits",
              hint: "Records, transcribes and inserts exactly as always. The cue queues until the session ends, because a sound during a capture is picked up by the microphone.",
              ctl: badge("Normal", "success")
            })
          ]
        })
      ),

      /* WHERE THIS SITS ON THE AXES — the question the surface is asked most
         often and answers worst. ADR 0030 is explicit: `Agent` is a delivery
         target, and `delivery = agent` makes the mode axis vacuous, so the
         pill shows `Agent` where a mode would otherwise stand. It is therefore
         reachable by cycling the mode — the control the user already has —
         while not being a mode. The rule in the cycle is the same rule
         Language Models now carries before Notes, and for the same reason. */
      sec("How you get here",
        "The mode cycle reaches it, and it is not a mode.",
        card({
          body: '<div class="cycle">' +
            ["Verbatim", "Cleanup", "Rewrite", "Draft", "Prompt Enhance"].map(function (m) {
              return '<span class="cycle-item">' + t(m) + "</span>";
            }).join("") +
            '<span class="cycle-rule" aria-hidden="true"></span>' +
            '<span class="cycle-item" data-on>' + icon("agents") + t("Agent") + "</span>" +
            "</div>",
          rows: [
            row({
              label: "Agent is a delivery target",
              hint: "It returns the transcript to the caller and inserts nothing. No transform runs.",
              ctl: badge("delivery axis", "plan")
            }),
            row({
              label: "So the mode axis goes empty",
              hint: "The pill shows Agent where a mode would stand. No greyed-out mode.",
              ctl: badge("Agent", "accent")
            }),
            row({
              label: "Why it is in the cycle at all",
              hint: "Cycling the mode is the control you already have on the overlay, and this is what you want when you reach for it. Being reachable there is not a claim about which axis it is on — the rule says which.",
              ctl: kbd("Ctrl+Super+M")
            }),
          ]
        })
      ),

      note("Bridge sessions do not enter the transcript history. They end in the thread above and in the Agents settings area, because an answer without its question is unreadable in a list of dictations.",
        "about", docLink("Open Agents settings")),
    ].join("");
  };
  SCREENS.agentoverlay.layout = "wide";

  /* ── Preview: Handoff ──────────────────────────────────────────────────
     ADR 0044, §11.40. The one surface that was missing between the two halves
     of this product, and the reason it was missing is that nobody had written
     down where the boundary runs.

     THE PROBLEM, IN TWO SENTENCES ONE WORD APART:

       "Write the mail from Tuesday's meeting."   -> text at your cursor
       "Send the mail from Tuesday's meeting."    -> something happens

     The user does not classify their sentence before saying it, and they
     should not have to. Today they must: `draft` reaches the assistant and
     `delivery = agent` reaches the desk, and the choice is made with a hotkey
     BEFORE the sentence exists. Standing in the wrong door costs a whole
     dictation.

     WHAT THIS IS NOT. It is not the assistant gaining the ability to act.
     ADR 0029 rules side-effecting tools out of the dictation path permanently
     and ADR 0040 narrowed exactly one clause of that — a single bounded read —
     leaving the rest standing. Nothing here touches it: the assistant does not
     send the mail, it does not open the repository, it does not call a tool
     with an effect. It recognises that the sentence asks for one and **hands
     the sentence over**, which is a thing the user then does or does not do.

     So the load-bearing property is that the handoff is an OFFER. The
     inference is visible, it is attached to a key, and refusing it costs
     nothing — the dictation falls back to being a dictation and the text is
     inserted as it always would have been. ADR 0031 rejects inference on the
     speech channel because inference there silently changes the text; this
     changes nothing until a key is pressed.

     AND AUTO NEVER ROUTES HERE. ADR 0041 established the shape of that rule
     for language: Auto may choose how text reads, never what language it is
     in. The same sentence, one word further: **Auto may choose how text reads,
     never whether something happens.** */
  SCREENS.handoff = function () {

    /* The pill, identical to the agent overlay's, because it IS that pill —
       geometry and tokens from `overlay-pill.css`, mode chip reading the mode
       the dictation actually ran as. What differs is the tab. */
    function pill(o) {
      o = o || {};
      var bars = "";
      for (var i = 0; i < 11; i++) {
        var h = o.rec ? 4 + Math.abs(Math.sin((i + 2) * 1.9)) * 16 : 3 + Math.abs(Math.sin(i * 0.9)) * 3;
        bars += '<i style="height:' + h.toFixed(1) + 'px"></i>';
      }
      return '<div class="ovp-shell">' +
        (o.tab || "") +
        '<div class="ovp"' + (o.rec ? " data-rec" : "") + ">" +
        '<span class="ovp-mic">' + icon("mic") + "</span>" +
        '<span class="ovp-bars">' + bars + "</span>" +
        '<span class="ovp-div"></span>' +
        '<button class="ovp-mode"><span class="ovp-mode-dot"></span>' +
        '<span class="ovp-mode-label">' + t(o.mode || "Draft") + "</span></button>" +
        '<span class="ovp-div"></span>' +
        '<span class="ovp-timer">' + t(o.timer) + "</span>" +
        "</div></div>";
    }

    /* THE CARD. Not a member of the window family and deliberately not shaped
       like one: it has no title bar, no close control and no resize grip,
       because it is not a place you work — it is one question with two answers
       that is on screen for about four seconds.

       IT DOES NOT TAKE FOCUS, AND THAT IS THE HARD PART. The dictation overlay
       must keep `focus: false` or the insert target moves out of the app being
       dictated into, and this card stands in exactly that moment. So it cannot
       be a focused dialog with a default button — it grabs two keys for as
       long as it is visible, the same way the dictation hotkey is grabbed, and
       releases them when it closes. Rust owns that, like every other shortcut
       (ADR 0006).

       ESCAPE IS NOT A CANCEL, IT IS A FALLBACK. Refusing the handoff does not
       throw the dictation away: the text goes to the cursor as an ordinary
       dictation in the mode the pill is showing. That is what makes the offer
       cheap enough to be offered at all — a wrong guess costs one keystroke
       and no words. */
    function handoffCard(o) {
      o = o || {};
      return '<div class="hoff">' +

        '<div class="hoff-head">' + icon("handoff") +
        "<b>" + t("Hand this to " + DESK + "?") + "</b>" +
        '<span class="hoff-why">' + t("You asked for something to happen, not for text.") + "</span>" +
        "</div>" +

        /* THE DICTATION, VERBATIM. ADR 0030 requires the dictated prompt to be
           shown verbatim before a run starts, and the reason is the same one
           that makes the confirmation keyed rather than spoken: the input
           arrived over an unreliable channel, so the last thing the user sees
           has to be the thing that will actually be sent. Not a summary of it,
           not the desk's paraphrase of it. */
        '<div class="hoff-said"><span class="hoff-label">' + t("What you said") + "</span>" +
        "<p>" + t("“Take the decisions from Tuesday's Acme review, write the follow-up mail to Sarah and send it.”") + "</p></div>" +

        /* WHAT IT WILL DO WITH IT. Four facts, and every one of them is
           configuration that hangs on the target rather than on the utterance
           (ADR 0030) — which is why they are stated and not spoken. Speech is
           a bad configuration language and this surface does not ask it to be
           one: you said the intent, the rest was set once. */
        '<div class="hoff-grid">' +
        [["Target", o.target || "General", "the desk's own thread — no repository involved"],
         ["Role", o.role || "work", "may act, under this target's permission profile"],
         ["Reads", "Acme review · 3 objects", "collected by the assistant before handing over"],
         ["May reach", "Mail · Calendar", "through the desk's own connectors, not WordScript's"]]
          .map(function (r) {
            return '<div class="hoff-cell"><span class="hoff-label">' + t(r[0]) + "</span>" +
              "<b>" + t(r[1]) + "</b><span>" + p(r[2]) + "</span></div>";
          }).join("") + "</div>" +

        '<div class="hoff-foot">' +
        '<span class="hoff-keys"><kbd>Enter</kbd> ' + t("hand over") +
        '<span class="sep">·</span><kbd>Esc</kbd> ' + t("insert it as a dictation instead") + "</span>" +
        '<span class="rowflex">' + btn("Insert instead", "ghost") +
        btn("Hand over", null, { icon: "handoff" }) + "</span>" +
        "</div></div>";
    }

    return [
      viewTop({
        title: "Handoff",
        lead: "What happens when a dictation asks for something to be done rather than written.",
        banner: { text: "Planned for Phase 8 \u2014 ADR 0044." },
      }),

      /* Written to budget on both sides of the switch: nothing on this surface
         ships, so a copy reduction here would be measured against nothing
         (§11.10). */
      sec("One word apart",
        "The assistant can do the first of these and must not do the second.",
        '<div class="hoff-pair">' +
        '<div class="hoff-side"><span class="hoff-label">' + t("The assistant") + "</span>" +
        "<p>“<b>" + t("Write") + "</b> " + t("the mail from Tuesday's meeting.”") + "</p>" +
        '<span class="hoff-side-out">' + icon("type") + t("text at your cursor, in about two seconds") + "</span></div>" +
        '<div class="hoff-side" data-desk><span class="hoff-label">' + DESK_CAP + "</span>" +
        "<p>“<b>" + t("Send") + "</b> " + t("the mail from Tuesday's meeting.”") + "</p>" +
        '<span class="hoff-side-out">' + icon("handoff") + t("a mail leaves your account, in about two minutes") + "</span></div>" +
        "</div>" +
        note("The difference is a verb, and the user does not classify their sentence before saying it. Today the choice is made with a hotkey before the sentence exists, so standing in the wrong door costs the whole dictation.", "about")
      ),

      sec("The offer",
        "The assistant recognises it cannot do this, and offers to pass it on. It does not pass it on.",
        '<div class="hoff-stage">' + handoffCard({ target: "General", role: "work" }) + "</div>" +
        note("Nothing has happened when this appears. ADR 0029's prohibition on side-effecting tools in the dictation path is intact — what is offered is a handover, and the offer is refused by doing nothing to it.", "privacy", docLink("ADR 0029")) +
        note("It does not take focus. The dictation overlay must keep focus: false or the insert target moves out of the app you were writing in, and this card stands in exactly that moment — so it grabs Enter and Escape while it is visible instead of becoming a focused dialog.", "keyboard", docLink("ADR 0006"))
      ),

      sec("Escape is a fallback, not a cancel",
        "Refusing costs one keystroke and no words.",
        card({
          rows: [
            row({
              label: "Enter",
              hint: "Hands over. The dictation becomes the prompt for a run, the thread opens in the agent window, and nothing is inserted at your cursor.",
              ctl: badge("Starts a run", "accent")
            }),
            row({
              label: "Escape",
              hint: "Treats it as the dictation it always was. The text goes to the cursor in the mode on the pill, and the run never existed.",
              ctl: badge("Inserts the text", "success")
            }),
            row({
              label: "Neither, for 10 seconds",
              hint: "Same as Escape. A card that expires into the destructive option would be a trap, and doing nothing must be the safe answer everywhere in this product.",
              ctl: badge("Inserts the text", "success")
            }),
          ]
        })
      ),

      sec("Where the line runs",
        "Four properties, and they all fall on the same side of the same cut. That is the argument that the boundary is real and not drawn to sort a list.",
        card({
          body: '<div class="linecmp">' +
            [["", "The assistant", DESK_CAP],
             ["Time", "seconds — inside the dictation", "minutes to days"],
             ["Effects", "none. Text, and only text", "whatever its connectors reach"],
             ["Reads", "what is on this disk", "what is reachable over the network"],
             ["Owned by", "WordScript — model, prompt, stages", "the harness you chose"],
             ["Ends in", "one reducer commit", "a thread that stays open"]]
              .map(function (r, ix) {
                return '<div class="linecmp-row"' + (ix === 0 ? " data-head" : "") + ">" +
                  "<span>" + t(r[0]) + "</span><span>" + p(r[1]) + "</span><span>" + p(r[2]) + "</span></div>";
              }).join("") + "</div>",
          rows: [
            row({
              label: "Why they cannot simply be one thing",
              hint: "A session ends in exactly one reducer commit (ADR 0018). A process that runs for days has no single end point, and one that has an end point cannot run for days. The rest follows from that.",
              ctl: badge("ADR 0018", "plan")
            }),
            row({
              label: "And why the surface can be",
              hint: "The user has one intent — do this with what I have here. Only the execution differs, and the handoff is where the difference becomes visible instead of being demanded up front.",
              ctl: badge("One input", "success")
            }),
          ]
        })
      ),

      sec("Auto never comes here",
        "The mode picker reaches the assistant. Nothing reaches the desk without a key.",
        card({
          rows: [
            row({
              label: "What Auto may decide",
              hint: "Cleanup, Draft or Prompt Enhance — how the text reads.",
              ctl: badge("How it reads", "success")
            }),
            row({
              label: "What Auto may not decide",
              hint: "The language it is in (ADR 0041), and whether anything happens at all. Both are unrecoverable the moment they are wrong: text in the wrong language is already in somebody else's document, and a mail that has been sent cannot be recalled.",
              ctl: badge("Never", "plan")
            }),
            row({
              label: "So the offer is always an offer",
              hint: "Even with the recogniser certain and the sentence unambiguous, the key is pressed by a person. This is the one place in the dictation path where something irreversible starts, and it is the one place two seconds are justified.",
              ctl: kbd("Enter")
            }),
          ]
        })
      ),

      /* FOURTEENTH PASS — THE CROSSING ITSELF.
         Everything above this point was the offer: why it exists, what the two
         keys do, where the line runs. What the screen never drew is the thing
         the line is FOR — what actually goes across when Enter is pressed. That
         omission mattered, because ADR 0044's privacy claim lives entirely in
         this step: "the assistant reads what is on this disk, the desk reaches
         what comes over the network" is only true if you can see what left the
         disk. A boundary nobody can inspect is a boundary nobody can trust. */
      sec("What crosses",
        "The assistant assembles the brief before it hands over, because gathering is a read and reads are what the assistant is allowed to do. The desk receives a finished prompt and never searches for anything.",
        card({
          body: '<div class="cross">' +
            '<div class="cross-side">' +
            '<span class="cross-label">' + icon("check") + t("Handed over") + "</span>" +
            '<ul class="cross-list">' +
            [["The sentence, verbatim", "Not a paraphrase. It is the thing that will be acted on, so it is the thing you were shown."],
             ["3 objects from the Acme review", "The decisions, the attendee list and the follow-up note — read off this disk by the assistant."],
             ["Target and role", "General · work. Set once, on the target, not spoken into the dictation."]]
              .map(function (r) {
                return "<li><b>" + t(r[0]) + "</b><span>" + p(r[1]) + "</span></li>";
              }).join("") + "</ul></div>" +

            /* THE OTHER COLUMN IS THE POINT. A list of what was sent is a
               feature description; a list of what was deliberately NOT sent is
               the privacy boundary being shown rather than asserted. */
            '<div class="cross-side" data-held>' +
            '<span class="cross-label">' + icon("privacy") + t("Stayed here") + "</span>" +
            '<ul class="cross-list">' +
            [["The audio", "Discarded after transcription, as on every other path. The desk never receives sound."],
             ["Your other context objects", "The assistant read three and sent three. Nothing is handed over on the chance it might be useful."],
             ["Your API keys", "The desk authenticates with its own credentials to its own connectors. WordScript's keys never leave the OS secret store."],
             ["Profiles, dictionary, history", "Personalization is how the text was produced. It is not part of what was asked."]]
              .map(function (r) {
                return "<li><b>" + t(r[0]) + "</b><span>" + p(r[1]) + "</span></li>";
              }).join("") + "</ul></div>" +
            "</div>",
          rows: [
            row({
              label: "Inspect before handing over",
              hint: "The brief is readable in the card. A handoff you cannot read before pressing the key is the silent auto-handoff this record forbids, arrived at by a different route.",
              ctl: btn("Show the brief", "ghost", { icon: "eye" })
            }),
          ]
        })
      ),

      /* The second half of the same omission: the offer had two documented
         outcomes and the screen drew neither of them past the keypress. */
      sec("After the key",
        "Four steps, and the first two are the ones that make it safe.",
        card({
          body: '<ol class="crossflow">' +
            [["The card closes and nothing is inserted", "The dictation does not also go to your cursor. One sentence produces one outcome — the failure this whole record exists to remove is a sentence that lands in two places."],
             ["A new thing starts, with its own lifetime", "The session that offered the handoff ends in its own single commit (ADR 0018). It does not stay open waiting for the run; the run is not part of it."],
             ["The thread opens in the agent window", "Your sentence is its first entry, which is why a handed-over dictation is not in the transcript history — it is in the thread, where the answer to it will be."],
             ["The overlay tab says so", "The same left slot the agent tab uses. A handed-over session runs no finalization, so it learns no words, so the learned-word tab cannot be there at the same time."]]
              .map(function (r) {
                return "<li><b>" + t(r[0]) + "</b><span>" + p(r[1]) + "</span></li>";
              }).join("") + "</ol>"
        })
      ),

      sec("And when it comes back",
        "The desk answers what it can and reaches you for what it cannot. That is a filter, and a filter has an output.",
        card({
          rows: [
            row({
              label: "It finished",
              hint: "A line in the thread and the cue that means a round trip completed. No card, no interruption — you asked for it, it happened.",
              ctl: badge("Thread only", "success")
            }),
            row({
              label: "It has a question",
              hint: "A row in Home's decision inbox, sorted by what happens if you do nothing. A desk question expires and takes its blocked run with it, which is why that column and not urgency decides the order.",
              ctl: btn("Open the inbox", "ghost", { icon: "arrow" })
            }),
            row({
              label: "It asked out loud",
              hint: "Only when you configured it to. One spoken field, length-limited, and the answer is returned verbatim — the desk may compose the question, never the answer.",
              ctl: badge("ADR 0030", "plan")
            }),
            row({
              label: "The offer was wrong",
              hint: "You pressed Escape and got a dictation. That costs one keystroke and no words, and it is the entire budget the effect-verb recogniser has: if refusals become common the recogniser is wrong, and the fix is fewer offers rather than a faster path through one.",
              ctl: badge("One keystroke", "success")
            }),
          ]
        })
      ),

      sec("It is the same tab",
        "While a handed-over run is working, the overlay says so with the component it already has.",
        '<div class="ovp-stage">' +
        pill({ rec: false, mode: "Draft", timer: "00:00", tab: '<span class="ovp-tab"><span class="ovp-tab-inner">' +
          '<span class="ovp-tab-dot"></span><span class="ovp-tab-label">' + t("handed over") + "</span></span></span>" }) +
        "</div>" +
        note("The left slot, the same one the agent tab uses and for the same reason: a handed-over session runs no finalization, so it learns no words, so the learned-word tab is structurally absent for exactly as long as this one can exist.", "arrow")
      ),

      note("A handed-over dictation does not enter the transcript history. What you said becomes the first entry of the thread, where the answer to it will also be — the same reason bridge sessions stay out of it.", "about", docLink("ADR 0030")),
    ].join("");
  };
  SCREENS.handoff.layout = "wide";

  SCREENS.meeting = function () {
    var lines = [
      { at: "11:48", who: "S2", tone: "b", text: "…so the placement bug is still open on the second monitor." },
      { at: "11:57", who: "S1", tone: "a", text: "Right, I’ll take the Diagnostics sub-tabs this week." },
      { at: "12:04", who: "S2", tone: "b", text: "Can we decide the MCP server question before Friday?" },
    ];

    function enh(title, items) {
      return '<div class="enh"><h4>' + t(title) + "</h4><ul>" +
        items.map(function (i) { return "<li>" + i + "</li>"; }).join("") + "</ul></div>";
    }

    /* THE COPILOT LANE — ADR 0047, §11.46.
       One strip above the bar, one hint at a time, and it replaces itself.

       It is not a panel and it is not a stream in the transcript, and both of
       those were considered. A hint belongs to a moment, so putting it in the
       transcript column anchors it correctly — and then it scrolls away while
       new lines arrive, which means the hint you needed is the one you missed.
       During a call nobody scrolls back; they watch the bottom edge, where the
       new text appears. So the lane sits there, holds one thing, and is
       replaced by the next.

       TWO RULES IT MAY NOT BREAK, and they are the whole of its design:

       IT NEVER SPEAKS. The one spoken path in this product is the desk's, and
       it is guarded (ADR 0030). A second voice talking over a meeting is a
       product defect, and it would be talking into a microphone that is
       recording.

       IT NEVER HINTS WITHOUT A CITATION. Every hint carries the place it came
       from and the link is part of the hint, not an affordance beside it.
       ADR 0040 already made this a contract for the assistant — "without the
       citation there is no way to tell a grounded draft from an invented one,
       and an invented one is worse than a refusal" — and a hint whispered mid
       meeting is the highest-cost place in the product to be confidently
       wrong. Without a source, a hint is an opinion arriving with authority. */
    function copilot(o) {
      return '<div class="cop">' + icon("sparkle") +
        '<div class="cop-text"><b>' + t(o.text) + "</b>" +
        '<button class="cop-src">' + icon("inspect") + t(o.source) + "</button></div>" +
        '<button class="cop-x" aria-label="Dismiss">' + icon("x") + "</button></div>";
    }

    /* One window, drawn in the three states that carry the argument: what it
       looks like while the meeting runs (Summary), what it looks like while
       you are writing in it (Notes, with the action menu open), and what it
       looks like on the record itself (Transcript). Same window, same width,
       same bar. `Enhanced` was renamed to `Summary` with the tab in Context,
       so the two surfaces still teach one vocabulary (§11.41). */
    function hud(tab, opts) {
      opts = opts || {};
      var body;
      if (tab === "Summary") {
        body =
          enh("Decisions", [
            "Voice pipeline is the top priority — ship by end of March before any other workstream",
            "UI redesign deferred until the pipeline lands, don’t want to split focus",
            "Dictionary feature approved: custom words for medical, legal and technical terms",
          ]) +
          enh("Action items", [
            "<b>Sarah</b> — frontend migration to the new component library by end of sprint",
            "<b>Alex</b> — API refactor plus latency benchmarks, target sub-200 ms, currently ~280 ms",
            "<b>Gabriel</b> — follow up with finance on the Q2 budget, headcount approval by Friday",
          ]) +
          enh("Open questions", [
            "Real-time collaboration on notes — CRDT or OT? No timeline yet",
            "Third-party dependency audit needed before public open-sourcing",
          ]);
      } else if (tab === "Notes") {
        body = '<div class="readout">' +
          t("- ship voice pipeline by march\n- talk to design team re: new UI\n- budget Q: ask finance") +
          "</div>";
      } else {
        body = '<div class="tscript">' + lines.map(tline).join("") + "</div>";
      }

      var tabsHtml = '<div class="note-tabs" role="tablist">' +
        ["Transcript", "Notes", "Summary"].map(function (i) {
          return '<button role="tab" aria-selected="' + (i === tab ? "true" : "false") + '">' +
            (i === "Summary" ? icon("sparkle") : "") + t(i) + "</button>";
        }).join("") + "</div>";

      return '<div class="hud">' +
        '<div class="hud-deco">' + t("native window decoration — drawn by the OS") + "</div>" +
        '<div class="hud-head">' +
        /* The title and the date come from the calendar entry, not from a
           filename and not from a prompt asking what to call this. That is
           what the intake buys: the object existed before the recording did
           (§11.41), so the window opens with it already filled in. */
        /* Two rows, as in `pane()` and for the same measured reason: at the
           HUD's 330 px the three tabs and the title cannot share a line, and
           adding the calendar origin to the date line is what finally proved
           it — the tabs were painting over "from Google Calendar". */
        '<div class="row1"><div class="grow"><h3>' + t("Sprint Planning") + "</h3>" +
        '<span class="note-date">Mar 11, 2026 <span class="origin-from">· from Google Calendar</span></span></div></div>' +
        '<div class="hud-tabs">' + tabsHtml + "</div>" +
        /* THE ONE LEVEL READOUT IN THE PRODUCT, AND THIS IS WHERE IT LIVES.
           What stood here was `wave(12, 2)` — twelve bars from a sine, drawn
           once and never again. A frozen waveform on a window whose whole
           claim is that it is recording right now is the fake-state failure
           the runtime rules name outright, and it was the most conspicuous
           place in the prototype to commit it.

           IT IS THE MATRIX AND NOT THE WAVEFORM, and the reason is the width.
           The state line is ~70 px of spare run inside a 330 px window. A
           waveform trace in 70 px is a texture; a 7-row quantised meter is
           still a meter — it is the shape a hardware level indicator has taken
           for fifty years precisely because it survives being small. The
           waveform keeps the input-level row in General, where it has 600 px
           and a threshold mark to sit against.

           IT MEASURES SOMETHING. That was the whole objection to it standing
           on Home: at rest it reported a room nobody was recording. Here the
           recording is the reason the window is open. */
        '<div class="hud-state">' + dot("danger") + '<span class="el">12:04</span>' +
        "<span>·</span><span>2 of 4 speaking</span><span>·</span><span>mic + system</span>" +
        '<span class="grow"></span>' +
        /* 16 x 7 at a 2 px pixel is 47 x 20 — the height of the line it sits
           in. Sized up it stops being part of the state line and becomes a
           second thing on the row, which at 330 px of window is the whole
           budget. */
        matrixField({ mode: "vu", cols: 16, size: 2, gap: 1, ariaLabel: "Input level" }) +
        "</div>" +
        "</div>" +
        '<div class="hud-scroll">' + body + "</div>" +
        (opts.copilot ? copilot(opts.copilot) : "") +
        floatbar({
          live: true,
          action: opts.menu ? "Sync template" : "Stop and save",
          /* The one place the open menu is drawn, and it carries the rule the
             actions window carries (§11.43): the last entry runs somewhere
             else, for minutes, and does something. Right after a meeting is
             exactly when that entry gets picked, which is why it is shown
             here rather than argued about on a settings screen. */
          menu: opts.menu ? [
            { label: "Sync template", hint: "Format using the team template", on: true, icon: "template" },
            { label: "Meeting summary", hint: "Summarize decisions and actions", icon: "sparkle" },
            { label: "Email draft", hint: "Draft the follow-up email", icon: "mail" },
            { label: "Follow up by mail", hint: "Draft one per attendee, then send", icon: "handoff", kind: "desk" },
          ] : null
        }) +
        '<span class="hud-resize" aria-hidden="true"></span>' +
        "</div>";
    }

    return [
      viewTop({
        title: "Meeting capture",
        lead: "A recording that lasts an hour, inserts nothing, and ends as a note.",
        banner: { text: "Planned for V2. No system audio is captured today." },
      }),

      /* The window IS the note. The first sketch made it a strip of transcript
         with a quick-note field beside it — a control panel for a recorder. That
         is the wrong object: during a call you are not operating a recording,
         you are reading and writing the note the call is producing. Same three
         tabs it will have in Notes afterwards, so there is nothing to learn
         twice and nothing to migrate when the meeting ends. The recording is
         one line of state, not the subject. */
      sec("The window", "It is the object, live. Same tabs it has in Context afterwards.",
        '<div class="hud-row">' +
        '<div class="hud-wrap">' + hud("Summary") +
        '<span class="hud-cap">' + icon("monitor") +
        "<b>While it runs</b> · 330 × 560, resizable, always on top, and excluded from screen shares" +
        "</span></div>" +

        '<div class="hud-wrap">' + hud("Notes", { menu: true }) +
        '<span class="hud-cap">' + icon("monitor") +
        "<b>Writing in it</b> · the bar's chevron opens what else can be made from this object" +
        "</span></div>" +

        '<div class="hud-wrap">' + hud("Transcript", {
          copilot: {
            text: "Budget was left open on Monday too, and nobody has named an owner yet.",
            source: "Product Sync · 27 Jul · 14:02"
          }
        }) +
        '<span class="hud-cap">' + icon("monitor") +
        "<b>The record, and a hint</b> · timestamps, speakers, and one thing the copilot noticed" +
        "</span></div>" +
        "</div>" +
        note("Drawn, not screenshotted. The sizes are the proposal; the dictation overlay's 440 × 60 is measured from tauri.conf.json and is a different window.", "eye")
      ),

      /* ── The copilot ─────────────────────────────────────────────────────
         The most speculative surface in this prototype, and the one with the
         worst failure mode, so it is drawn with its limits rather than with
         its possibilities. */
      sec("The copilot",
        "One line above the bar. It notices things and it is wrong sometimes, which is why every rule below exists.",
        card({
          rows: [
            row({
              label: "It never speaks",
              hint: "There is one spoken path in this product and it is the desk's, guarded and rate-limited. A second voice over a live call would also be talking into a microphone that is recording.",
              ctl: badge("Writes only", "success")
            }),
            row({
              label: "It never hints without a source",
              hint: "The citation is part of the hint and clicking it opens the line it came from. ADR 0040 made this a contract for the assistant; a hint arriving mid-meeting is the highest-cost place in the product to be confidently wrong.",
              ctl: badge("Always cited", "success")
            }),
            row({
              label: "One at a time",
              hint: "It replaces rather than stacks. A list of hints is something to read, and reading it is time not spent in the conversation.",
              ctl: badge("Replaces", "plan")
            }),
            row({
              label: "What it is allowed to notice",
              hint: "Contradictions against earlier objects, questions raised and not answered, and a topic on the invite's agenda that has not come up. Not sentiment, not coaching, not how the meeting is going.",
              ctl: badge("3 kinds", "plan")
            }),
            row({
              label: "What it costs",
              hint: "It compares the running transcript against the index continuously, which is inference for the length of the call rather than once at the end. Off by default, and the row that turns it on states the cost.",
              ctl: '<span class="rowflex">' + badge("Open decision", "warning") + toggle(false) + "</span>"
            }),
          ]
        })
      ),

      /* ── Speakers ────────────────────────────────────────────────────────
         Three stages, and they are worth separating on the surface because
         they fail differently and because the third one is not a model at all.
         Read out of the donors rather than invented: voxtype has the Rust
         path (`meeting/diarization/{simple,ml}.rs`, ECAPA-TDNN embeddings over
         `ort` with cosine clustering, and a subprocess backend for memory
         isolation), OpenWhispr the Electron one (sherpa-onnx with pyannote
         segmentation, 3D-Speaker CAMPPlus embeddings and Silero VAD). */
      sec("Where a speaker's name comes from",
        "Three stages, and only the first two are audio. A name is never in the recording.",
        card({
          body: '<div class="stagelist">' +
            [["1", "Source", "Your microphone is you; system audio is everyone else. No model, no error worth speaking of — and this alone already separates you from the room.", "SimpleDiarizer · free"],
             ["2", "Cluster", "Voice embeddings, compared against each other, group the remaining turns into distinct speakers. This produces Speaker 1 and Speaker 2 — a count and a separation, never an identity.", "ECAPA-TDNN · a second pass"],
             ["3", "Name", "Comes from the calendar's attendee list, from a saved voice you labelled before, or from you clicking one. Nothing in an audio stream produces a name.", "not audio at all"]]
              .map(function (s) {
                return '<div class="stage-row"><span class="stage-n">' + t(s[0]) + "</span>" +
                  '<div class="stage-text"><b>' + t(s[1]) + "</b><span>" + p(s[2]) + "</span></div>" +
                  '<span class="stage-tag mono">' + t(s[3]) + "</span></div>";
              }).join("") + "</div>",
          rows: [
            row({
              label: "A name you set is never overwritten",
              hint: "Clustering runs again when the call ends, over the whole recording instead of the live window, and it renumbers freely. A name you confirmed is locked against that pass — otherwise every name typed during a call changes after it, which is worse than offering no names.",
              ctl: badge("locked survives", "accent")
            }),
            row({
              label: "The echo problem is real and is upstream of all three",
              hint: "The microphone hears the speakers, so a remote voice arrives on both streams and stage 1 attributes part of it to you. Cancellation runs before any of this; what leaks through is caught by comparing the two streams for overlapping text.",
              ctl: badge("Before stage 1", "plan")
            }),
            row({
              label: "Expected speakers",
              hint: "From the invite when there is one, and settable when there is not. Clustering with a known count is a materially easier problem than clustering without one.",
              ctl: '<span class="rowflex">' + stepper(4, null) + scope("from the invite") + "</span>"
            }),
          ]
        })
      ),

      sec("The bar", "Two things you do to a note, at every scroll position.", card({
        rows: [
          row({
            label: "Talk to it",
            hint: "The same hotkey as dictation. It writes into the note instead of into another app — nothing is inserted anywhere while a meeting runs.",
            ctl: '<span class="rowflex">' + kbd("Ctrl+Super") + '<button class="mic-btn" data-live aria-label="Dictate">' + icon("mic") + "</button></span>"
          }),
          row({
            label: "Make something of it",
            hint: "One default action, the rest behind the chevron. A select would make you choose before you can act.",
            ctl: badge("3 actions", "plan")
          }),
          row({
            label: "Stop",
            hint: "Ends the capture and keeps the note. It is the default action while recording, and becomes Sync template once the call is over.",
            ctl: badge("primary while live", "accent")
          }),
        ]
      })),

      /* The table is the point of the screen. Without it, "a bigger overlay" is
         exactly the thing §1 forbids and §10.3 proved impossible. With it, the
         two windows are visibly different objects with different obligations. */
      sec("Why this is not the dictation overlay", null, card({
        rows: [
          row({
            label: "Focus",
            hint: "The pill must never take focus — that would move the insert target away from the app being dictated into. A meeting inserts nothing, so there is no target to protect.",
            ctl: '<span class="rowflex">' + badge("pill: never", "plan") + badge("meeting: may", "accent") + "</span>"
          }),
          row({
            label: "Size",
            hint: "440 × 60 is a pill above the work. A transcript read for an hour is not a pill.",
            ctl: '<span class="rowflex">' + badge("pill: fixed", "plan") + badge("meeting: resizable", "accent") + "</span>"
          }),
          row({
            label: "Lifetime",
            hint: "Seconds against the length of a call.",
            ctl: '<span class="rowflex">' + badge("pill: seconds", "plan") + badge("meeting: the call", "accent") + "</span>"
          }),
          row({
            label: "Audio",
            hint: "The pill records you. A meeting records you and the room, which means the microphone hears the speakers and the echo has to come back out.",
            ctl: '<span class="rowflex">' + badge("pill: mic", "plan") + badge("meeting: mic + system", "accent") + "</span>"
          }),
          row({
            label: "Ends in",
            hint: "Text at your cursor against a note you can read afterwards.",
            ctl: '<span class="rowflex">' + badge("pill: insert", "plan") + badge("meeting: a note", "accent") + "</span>"
          }),
          row({
            label: "Screen share",
            hint: "A window that floats over a call being shared must not appear in the share or in the recording. The pill never had this problem.",
            ctl: '<span class="rowflex">' + badge("pill: visible", "plan") + badge("meeting: excluded", "success") + "</span>"
          }),
        ]
      })),

      sec("What it captures", null, card({
        rows: [
          row({ label: "Your microphone", hint: "The same device the next dictation would use.", ctl: badge("Required", "plan") }),
          row({ label: "System audio", hint: "Everyone else, as the machine plays them. No participant joins the call.", ctl: badge("Required", "plan") }),
          row({
            label: "Echo cancellation",
            hint: "The microphone hears the speakers, so every remote voice arrives twice. It is removed from the system stream before transcription.",
            ctl: badge("Required", "plan")
          }),
          row({
            label: "Speakers",
            hint: "Separated as it runs and re-clustered when it ends. The count comes from the invite when there is one.",
            ctl: stepper(4, null)
          }),
        ]
      })),

      sec("How it starts and where it goes", null, card({
        rows: [
          row({
            label: "It already existed",
            hint: "A meeting on a connected calendar is a context object before anyone presses anything — with its name, its time, its attendees and the questions the last one in the series left open. Recording fills in the transcript; it does not create the object.",
            ctl: btn("Open Context", "ghost", { icon: "arrow" })
          }),
          row({
            label: "Meeting hotkey",
            hint: "Its own key. Dictation and meeting capture must never be the same press — one inserts and one does not.",
            ctl: kbd(null)
          }),
          row({
            label: "When a call is detected",
            hint: "Offer to record, in a window rather than an OS notification, so it is visible in Focus mode and absent from a share. With a calendar connected, the offer can name the meeting instead of asking what this is.",
            ctl: '<span class="rowflex">' + badge("Open decision", "warning") + select("Ask", ["Ask", "Start recording", "Do nothing"]) + "</span>"
          }),
          row({
            label: "It becomes readable",
            hint: "The same object, no longer live. Nothing is migrated and nothing is created — the window simply stops being the way you look at it.",
            ctl: btn("Open Context", "ghost", { icon: "arrow" })
          }),
          row({
            label: "The audio afterwards",
            hint: "Undecided. ADR 0039 keeps a failed dictation's audio until the retry or the sweep; an hour of meeting is a different size of promise.",
            ctl: badge("Open decision", "warning")
          }),
        ]
      })),

      note("This screen proposes product. It is here so the direction is written down and argued with, not so it is built from — no roadmap phase is pulled forward by drawing it.", "about"),
    ].join("");
  };

  /* ── Withdrawn: Live preview & commit ───────────────────────────────────
     Was a built preview. Withdrawn 2026-08-03 — SETTINGS_REWORK_PLAN.md
     section 11.15. It is kept, and it is kept *as the illustration for section
     10.3*: the layout below is what a settings-shaped answer to Phase 3 looks
     like, and the box above it is the window that answer has to fit into. A
     screen the plan decided against has to say so on itself. The alternative
     is a reader who finds a clean layout, no label, and builds it. */

  SCREENS.commit = function () {
    return [
      '<div class="view-top"><header class="view-head"><h1>Live preview & commit</h1><p>' +
      p("Withdrawn. Kept as the illustration for the plan's open Phase 3 problem.") + "</p></header>" +

      banner({
        tone: "withdrawn",
        icon: "about",
        lead: "Withdrawn",
        text: "Not a target shape — do not build Phase 3 from this screen. Two reasons, both in SETTINGS_REWORK_PLAN.md section 11.15: Diagnostics already does this, better; and the decision cannot live in a settings-shaped view."
      }) + "</div>",

      /* Three reasons, as rows. They used to be a checklist, which is the
         component that reports a probe the runtime ran — a checkmark next to a
         paragraph of argument claims something was measured that was not. */
      card({
        title: "Why it is withdrawn",
        rows: [
          row({
            label: "Diagnostics already carries it",
            hint: "RebuildLabTab's Diagnostics preview panel runs raw text through the real runtime and names roughly 25 applied rules. This screen showed four of them."
          }),
          row({
            label: "The decision happens in another app",
            hint: "You are dictating into an editor, a chat, a form. A window of this product is not where you are looking, so it cannot be where you decide."
          }),
          row({
            label: "One idea survives",
            hint: "Raw and transformed belong side by side, not stacked. That moved to Diagnostics as a layout line — with no commit action attached.",
            ctl: badge("Kept", "success")
          }),
        ]
      }),

      /* The constraint, drawn rather than asserted. The box is the real window
         size from src-tauri/tauri.conf.json, so the conflict is something you
         look at instead of something you take on faith. */
      card({
        title: "The window it would have to live in",
        desc: "From src-tauri/tauri.conf.json. focus:false is not a detail to relax — taking focus moves the insert target away from the app that was dictated into.",
        rows: [
          row({ label: "Size", ctl: '<span class="mono muted">440 × 60</span>' }),
          row({ label: "Focus", ctl: '<span class="mono muted">false</span>' }),
          row({ label: "Chrome", ctl: '<span class="mono muted">transparent · alwaysOnTop · no decorations</span>' }),
        ],
        body: '<div class="rows"><div class="row stack">' +
          '<span class="scale-cap">The overlay at actual size</span>' +
          '<div class="scale-box">' + dot("accent") +
          '<span class="mono">' + t("Okay, let's ship the settings restructure to…") + "</span>" +
          btn("Commit", "primary", { icon: "check" }) + btn("Cancel", "ghost") +
          "</div>" +
          '<span class="row-hint">' +
          p("That is the whole surface. Everything below this card asks to fit inside it.") +
          "</span></div></div>"
      }),

      note("What ships today is the narrow version: clipboard_only stops, the pill offers commit, cancel and edit, and nothing is inspected. Phase 3 wants the wide version in the same window. See section 10.3.", "about"),

      '<div class="withdrawn-body">',

      '<header class="view-head"><h1>What was proposed</h1><p>' +
      p("Below this line is the withdrawn layout, unchanged, so the argument has something to point at.") + "</p></header>",

      card({
        title: "Transcript",
        rows: [
          row({ label: "Mode", ctl: '<span class="rowflex">' + badge("Cleanup", "accent") + '<span class="muted">via Auto</span></span>' }),
          row({ label: "Delivery", ctl: '<span class="mono muted">insert at cursor · xdotool</span>' }),
        ],
        body: '<div class="rows"><div class="row stack"><div class="diff">' +
          '<div class="diff-pane" data-side="in"><h4>Raw</h4><p>' +
          t("um okay so let's uh ship the settings restructure today and and review the overlay tab yeah") +
          "</p></div>" +
          '<div class="diff-pane" data-side="out"><h4>Cleanup</h4><p>' +
          "Okay, let's ship the settings restructure today and review the <mark>overlay</mark> tab." +
          "</p></div></div></div></div>"
      }),

      /* The rule names are the runtime's own — the same labels Diagnostics
         prints for an applied rule. A preview that invents its own vocabulary
         teaches a word the product does not use. */
      card({
        title: "What was applied",
        desc: "Every change, named by the rule that made it.",
        body: check([
          { state: "ok", label: "Removed filler words", detail: "“um”, “uh”." },
          { state: "ok", label: "Collapsed a repeated word", detail: "“and and” → “and”." },
          { state: "ok", label: "Dictionary replacement applied", detail: "“overlay”, from the profile vocabulary." },
          { state: "ok", label: "Capitalized sentence start", detail: "One sentence." },
          { state: "ok", label: "AI post-correction applied", detail: "Cleanup, 673 ms." },
          { state: "todo", label: "Hallucination filtered", detail: "Nothing filtered. No content was added." },
        ])
      }),

      '<div class="rowflex">' + btn("Commit", "primary", { icon: "check" }) +
      btn("Retry", null, { icon: "restore" }) + btn("Copy", "ghost", { icon: "copy" }) +
      btn("Cancel", "ghost") + "</div>",

      "</div>",
    ].join("");
  };

  /* ===========================================================================
     RENDER
     =========================================================================== */

  /* Standing runtime state, on the bottom edge, where macOS puts it.
     It replaces three things the shipped shell repeats: the permanently green
     "Auto-saved" badge, the footer sentence saying the same, and the readiness
     badge that the settings window would otherwise lose when it stops being
     the window Home lives in. One line, no controls, never a place to click. */
  function statusStrip(surface) {
    if (surface !== "workspace" && surface !== "settings") return "";
    /* "Every change saves as you make it" sat on the right of this strip until
       2026-08-03. It is the same furniture the plan removed from the header —
       a permanent statement that nothing is wrong — moved down one edge and
       kept. A surface that never shows a save state has already said this by
       never asking. Nothing replaced it: the profile is named in the sidebar
       footer of both windows and would have been the same mistake again. What
       is left is three facts that change. */
    return '<div class="win-foot">' + dot("success") +
      "<b>Ready</b><span class='sep'>·</span><span>Groq cloud · whisper-large-v3-turbo</span>" +
      "<span class='sep'>·</span><span>Insert at cursor</span></div>";
  }

  function render() {
    computeTotal();          // sub-tab changes move the total, so recount here
    COUNT = { b: 0, a: 0 };

    /* The brand sprite is injected once and outlives every re-render. It has
       to sit outside the tree `render()` replaces: `<use>` resolves against
       the document, so a sprite rebuilt on each render would leave every mark
       briefly pointing at a symbol that is being replaced. */
    if (!document.getElementById("pmark-sprite-host")) {
      var host = document.createElement("div");
      host.id = "pmark-sprite-host";
      host.innerHTML = brandSprite();
      document.body.appendChild(host);
    }

    var nav = findNav(state.screen);
    var screen = SCREENS[state.screen] || SCREENS.ds;
    var html = screen();
    var layout = screen.layout || "column";

    /* A settings screen is not a surface of its own any more: it is a sheet
       over a workspace screen, so the workspace has to be rendered underneath
       it. `state.under` remembers which one you left, so closing the modal
       returns you to it rather than to a fixed home. The word count belongs to
       the settings screen alone — the workspace behind is scenery here and
       must not be counted twice, so it renders with the meter parked. */
    var modal = "";
    var base = nav;
    if (nav.surface === "settings") {
      /* Was the sheet already on screen before this render? If it was, it is
         not arriving and must not animate. */
      var wasOpen = !!document.querySelector(".modal-win");
      modal = settingsModal(state.screen, html, layout, !wasOpen);
      var save = COUNT;
      COUNT = { b: 0, a: 0 };
      base = findNav(state.under);
      html = (SCREENS[state.under] || SCREENS.home)();
      layout = (SCREENS[state.under] || SCREENS.home).layout || "column";
      COUNT = save;
    }

    var sidebar =
      base.surface === "workspace" ? workspaceSidebar(state.under) :
        base.surface === "system" ? systemSidebar(state.screen) : "";

    var title =
      base.surface === "workspace" ? "WordScript" :
        base.surface === "system" ? "WordScript — design system" :
          "WordScript — " + base.label;

    /* TWO NESTED LAYERS, BECAUSE THERE ARE TWO THINGS THAT CAN FLOAT — see the
       frost section in demo.css.

       `.win-shell` is the application: decoration, body, status strip. The
       settings sheet floats over that, so that is what recedes behind it.
       `.win-stack` is the application AND the sheet. The palette floats over
       both, so that is what recedes behind the palette — which is what makes
       Cmd+K work correctly from inside settings, where the sheet has to go
       soft along with everything under it.

       Each is ONE element on purpose. Blurring the decoration, the body and
       the status strip separately would blur each against transparency at its
       own edges, and the seams would show as soft lines across the window. */
    var win = document.getElementById("win");
    win.innerHTML =
      '<div class="win-stack">' +
      '<div class="win-shell">' +
      '<div class="win-deco">' + icon("dot", "sr") +
      "<span>native window decoration — drawn by the OS · <em>" + t(title) + "</em></span></div>" +
      '<div class="win-body">' + sidebar +
      '<div class="content" id="content" data-layout="' + layout + '">' +
      '<div class="content-inner" data-layout="' + layout + '">' + html +
      "</div></div></div>" + statusStrip(base.surface) +
      "</div>" + modal +
      "</div>" + commandPalette();
    /* The flags are on the window, because what they describe is the window's
       state: something is floating over it, and how far down that goes. */
    win.toggleAttribute("data-frost-shell", !!modal);
    win.toggleAttribute("data-frost-stack", !!state.cmdk);

    document.documentElement.dataset.palette = state.palette;
    document.documentElement.dataset.density = state.density;
    document.documentElement.dataset.theme = resolvedTheme();

    var cut = COUNT.b > 0 ? Math.round((1 - COUNT.a / COUNT.b) * 100) : 0;
    var tcut = TOTAL.b > 0 ? Math.round((1 - TOTAL.a / TOTAL.b) * 100) : 0;
    document.getElementById("meter").innerHTML =
      '<span class="mrow"><span>This screen</span>' +
      '<b class="' + (state.copy === "before" ? "on" : "off") + '">' + COUNT.b + "</b>" +
      "<span>→</span>" +
      '<b class="' + (state.copy === "after" ? "on" : "off") + '">' + COUNT.a + "</b>" +
      (COUNT.b !== COUNT.a ? '<span class="cut">−' + cut + "%</span>" : '<span class="cut">—</span>') +
      "</span>" +
      '<span class="mrow"><span>' + TOTAL.n + " screens</span>" +
      '<b class="' + (state.copy === "before" ? "on" : "off") + '">' + TOTAL.b + "</b>" +
      "<span>→</span>" +
      '<b class="' + (state.copy === "after" ? "on" : "off") + '">' + TOTAL.a + "</b>" +
      '<span class="cut">−' + tcut + "%</span></span>";

    document.querySelectorAll("[data-rig]").forEach(function (el) {
      var k = el.dataset.rig, v = el.dataset.val;
      el.setAttribute("aria-pressed", String(state[k] === v));
    });

    document.getElementById("pick").value = state.screen;

    /* Live drawings are re-collected after every render, because innerHTML
       replaced the nodes the previous pass was writing to. Anything holding a
       reference across a render is holding a detached element. */
    orbCollect();
    waveCollect();
    matrixCollect();

    /* The field is re-created by every render, so focus and caret have to be
       put back. Without the caret restore, typing the second character sends
       the cursor to position 0 and the query builds backwards. */
    if (state.cmdk) {
      var f = document.getElementById("cmdk-input");
      if (f) { f.focus(); f.setSelectionRange(state.cmdkQuery.length, state.cmdkQuery.length); }
    }
  }

  /* ── Command palette ────────────────────────────────────────────────────
     The index is three kinds of thing and they are not weighted equally.

     A PLACE is a view or a settings section — always findable, and the answer
     to "where is X". A SETTING is an individual control; it is the entry that
     makes the palette worth having, because a control is what people actually
     go looking for and it is the thing the information architecture buries by
     design. An ACTION does something without navigating anywhere.

     Ranking is prefix-first, then word-start, then substring. A plain
     substring match on a 60-entry index puts "Sound pack" above "Sound cues"
     for the query "sound cue" unless position is scored, and a palette whose
     first row is wrong is one people stop trusting after two tries. */
  var CMDK_INDEX = [
    { g: "Go to", icon: "home", label: "Home", act: "go:home" },
    { g: "Go to", icon: "history", label: "History", act: "go:history" },
    { g: "Go to", icon: "profiles", label: "Profiles", act: "go:profiles" },
    { g: "Go to", icon: "file", label: "Context", act: "go:context" },
    { g: "Go to", icon: "general", label: "General", where: "Settings", act: "go:general" },
    { g: "Go to", icon: "keyboard", label: "Hotkeys", where: "Settings", act: "go:hotkeys" },
    { g: "Go to", icon: "models", label: "AI Models", where: "Settings", act: "go:models" },
    { g: "Go to", icon: "agents", label: "Agents", where: "Settings", act: "go:agents" },
    { g: "Go to", icon: "check", label: "Delivery & Insert", where: "Settings", act: "go:delivery" },
    { g: "Go to", icon: "lock", label: "Privacy & Data", where: "Settings", act: "go:privacy" },
    { g: "Go to", icon: "diagnostics", label: "Diagnostics", where: "Settings", act: "go:diagnostics" },
    { g: "Go to", icon: "about", label: "About & Updates", where: "Settings", act: "go:about" },

    { g: "Settings", icon: "mic", label: "Input device", where: "General", act: "go:general" },
    { g: "Settings", icon: "mic", label: "Input level", where: "General", act: "go:general" },
    { g: "Settings", icon: "volume", label: "Play sound cues", where: "General", act: "go:general" },
    { g: "Settings", icon: "volume", label: "Sound pack", where: "General", act: "go:general" },
    { g: "Settings", icon: "keyboard", label: "Dictation shortcut", where: "Hotkeys", act: "go:hotkeys" },
    { g: "Settings", icon: "keyboard", label: "Push to talk or toggle", where: "Hotkeys", act: "go:hotkeys" },
    { g: "Settings", icon: "models", label: "Speech model", where: "AI Models", act: "go:models" },
    { g: "Settings", icon: "models", label: "Cleanup model", where: "AI Models", act: "go:models" },
    { g: "Settings", icon: "lock", label: "Groq API key", where: "AI Models", act: "go:models" },
    { g: "Settings", icon: "check", label: "Insert at cursor", where: "Delivery & Insert", act: "go:delivery" },
    { g: "Settings", icon: "copy", label: "Clipboard fallback", where: "Delivery & Insert", act: "go:delivery" },
    { g: "Settings", icon: "trash", label: "Keep audio after transcription", where: "Privacy & Data", act: "go:privacy" },
    { g: "Settings", icon: "restore", label: "Check for updates", where: "About & Updates", act: "go:about" },

    { g: "Do", icon: "restore", label: "Restore last clipboard insert", act: "noop" },
    { g: "Do", icon: "copy", label: "Copy last transcript", act: "noop" },
    { g: "Do", icon: "folderOpen", label: "Show transcripts in file manager", act: "noop" },
    { g: "Do", icon: "sun", label: "Switch to light theme", act: "theme:light" },
    { g: "Do", icon: "moon", label: "Switch to dark theme", act: "theme:dark" },
    { g: "Do", icon: "diagnostics", label: "Follow the system theme", act: "theme:system" }
  ];

  function cmdkScore(label, q) {
    var l = label.toLowerCase();
    if (l.indexOf(q) === 0) return 0;
    /* Word start: "sound cues" must be reachable by "cue", and a user typing
       the second word of a two-word label is the common case, not the edge. */
    if (l.indexOf(" " + q) > -1) return 1;
    if (l.indexOf(q) > -1) return 2;
    return -1;
  }

  function cmdkMatches() {
    var q = state.cmdkQuery.trim().toLowerCase();
    var out = CMDK_INDEX.map(function (e, i) {
      var s = q ? cmdkScore(e.label, q) : 0;
      return { e: e, s: s, i: i };
    }).filter(function (r) { return r.s > -1; });
    out.sort(function (a, b) { return a.s - b.s || a.i - b.i; });
    return out.slice(0, 40).map(function (r) { return r.e; });
  }

  function cmdkMark(label) {
    var q = state.cmdkQuery.trim();
    if (!q) return t(label);
    var at = label.toLowerCase().indexOf(q.toLowerCase());
    if (at < 0) return t(label);
    return t(label.slice(0, at)) + "<mark>" + t(label.slice(at, at + q.length)) + "</mark>" +
      t(label.slice(at + q.length));
  }

  function commandPalette() {
    if (!state.cmdk) return "";
    var rows = cmdkMatches();
    if (state.cmdkSel >= rows.length) state.cmdkSel = Math.max(0, rows.length - 1);

    var body = "", lastGroup = null;
    if (!rows.length) {
      body = '<p class="cmdk-empty">' + t("Nothing matches “" + state.cmdkQuery + "”.") + "</p>";
    } else {
      rows.forEach(function (e, i) {
        if (e.g !== lastGroup) { body += '<div class="cmdk-group">' + t(e.g) + "</div>"; lastGroup = e.g; }
        body += '<button class="cmdk-row"' + (i === state.cmdkSel ? " data-sel" : "") +
          ' data-cmdk-act="' + e.act + '" data-cmdk-i="' + i + '">' +
          icon(e.icon) +
          '<span class="grow">' + cmdkMark(e.label) + "</span>" +
          (e.where ? '<span class="where">' + t(e.where) + "</span>" : "") +
          "</button>";
      });
    }

    return '<div class="cmdk-scrim" data-cmdk-scrim><div class="cmdk" role="dialog" aria-label="Search WordScript">' +
      '<div class="cmdk-field">' + icon("search") +
      '<input class="cmdk-input" id="cmdk-input" placeholder="' + t("Search settings, screens and transcripts") +
      '" value="' + t(state.cmdkQuery) + '" autocomplete="off" spellcheck="false">' +
      "</div>" +
      '<div class="cmdk-list">' + body + "</div>" +
      '<div class="cmdk-foot">' +
        '<span class="k"><kbd>↑</kbd><kbd>↓</kbd> ' + t("move") + "</span>" +
        '<span class="k"><kbd>↵</kbd> ' + t("open") + "</span>" +
        '<span class="k"><kbd>esc</kbd> ' + t("close") + "</span>" +
      "</div></div></div>";
  }

  /** The rig's screen picker. The in-window navigation is the proposal under
      test; this is the way out of it, so every screen stays reachable from
      every other one without a reload. */
  function buildPicker() {
    var seen = {};
    document.getElementById("pick").innerHTML = NAV.map(function (g) {
      var opts = g.items.filter(function (i) {
        if (seen[i.id]) return false;
        seen[i.id] = true;
        return true;
      });
      if (!opts.length) return "";
      return '<optgroup label="' + t(g.group) + '">' + opts.map(function (i) {
        return '<option value="' + i.id + '">' + t(i.label) + "</option>";
      }).join("") + "</optgroup>";
    }).join("");
  }

  /* ── Events ─────────────────────────────────────────────────────────── */

  /** One way to change screen, so the rule about what the modal is laid over
      lives in one place. Navigating to a workspace or system screen also
      records it as the thing settings would cover; navigating to a settings
      screen leaves that record alone. */
  function goTo(id) {
    state.screen = id;
    if (findNav(id).surface !== "settings") state.under = id;
    render();
    var c = document.getElementById("content");
    if (c) c.scrollTop = 0;
  }

  /** Every palette row resolves to one of three things, and a row that cannot
      do its thing in a static mock says so by doing nothing rather than by
      pretending. `noop` rows are real product actions with no runtime here. */
  function runCmdk(act) {
    state.cmdk = false;
    if (act.indexOf("go:") === 0) { goTo(act.slice(3)); return; }
    if (act.indexOf("theme:") === 0) { state.theme = act.slice(6); render(); return; }
    render();
  }

  document.addEventListener("click", function (e) {
    var rig = e.target.closest("[data-rig]");
    if (rig) { state[rig.dataset.rig] = rig.dataset.val; render(); return; }

    if (e.target.closest("[data-cmdk-open]")) {
      state.cmdk = true;
      state.cmdkQuery = "";
      state.cmdkSel = 0;
      render();
      return;
    }

    var cmdkRow = e.target.closest("[data-cmdk-act]");
    if (cmdkRow) { runCmdk(cmdkRow.dataset.cmdkAct); return; }

    /* Clicking the scrim closes; clicking the panel does not. The check is
       "was the scrim itself the target", because the panel is inside it and
       `closest` would match on both. */
    if (state.cmdk && e.target.hasAttribute && e.target.hasAttribute("data-cmdk-scrim")) {
      state.cmdk = false; render(); return;
    }

    /* A row action. Only the raw-transcript fold does anything — the rest are
       inert by design, like every other control in this demo. */
    var act = e.target.closest("[data-act]");
    if (act) {
      var parts = act.dataset.act.split(":");
      if (parts[0] === "raw") {
        state.raw[parts[1]] = !state.raw[parts[1]];
        render();
      }
      return;
    }

    /* The scrim and the close button both dismiss; a click anywhere else
       inside the sheet must not, even though it bubbles through the scrim.
       Closing returns to the workspace screen the modal was opened over —
       that is what `state.under` is for. */
    if (e.target.closest(".modal-close") ||
      (e.target.closest("[data-close]") && !e.target.closest(".modal-win"))) {
      goTo(state.under);
      return;
    }

    var go = e.target.closest("[data-go]");
    if (go) { goTo(go.dataset.go); return; }

    var sub = e.target.closest("[data-sub]");
    if (sub) {
      var owner = sub.closest("[data-subtabs]").dataset.subtabs;
      state.sub[owner] = sub.dataset.sub;
      render();
      return;
    }

    var obBtn = e.target.closest("[data-ob]");
    if (obBtn && !obBtn.disabled) {
      state.ob = parseInt(obBtn.dataset.ob, 10) || 0;
      render();
      return;
    }

    // A segment that governs the rest of its screen, before the inert ones.
    var segState_ = e.target.closest("[data-segstate] button");
    if (segState_) {
      state[segState_.closest("[data-segstate]").dataset.segstate] = segState_.dataset.segval;
      render();
      return;
    }

    // Demo controls are inert by design, but they must still look alive.
    var tg = e.target.closest(".toggle:not([disabled])");
    if (tg) { tg.setAttribute("aria-checked", tg.getAttribute("aria-checked") === "true" ? "false" : "true"); return; }

    var segBtn = e.target.closest(".seg button, .subtabs button:not([data-sub])");
    if (segBtn) {
      segBtn.parentElement.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
      segBtn.setAttribute("aria-pressed", "true");
      return;
    }

    var laneRow = e.target.closest(".lane-row");
    if (laneRow) {
      laneRow.parentElement.querySelectorAll(".lane-row").forEach(function (r) { r.setAttribute("aria-checked", "false"); });
      laneRow.setAttribute("aria-checked", "true");
      return;
    }
  });

  /* THE POINTER MOVES THE SELECTION RATHER THAN PAINTING BESIDE IT. A palette
     has exactly one row that Return will run, and a hover highlight that is
     not that row is a second answer to the only question the surface asks. So
     hovering takes the selection with it, and the highlight the pointer leaves
     IS the selection.

     Written straight to the DOM rather than through `render()`: a re-render
     rebuilds the whole window, and doing that on every row the pointer crosses
     would also rebuild the field the user is typing in. */
  document.addEventListener("mouseover", function (e) {
    if (!state.cmdk) return;
    var row = e.target.closest("[data-cmdk-i]");
    if (!row) return;
    var i = parseInt(row.dataset.cmdkI, 10);
    if (isNaN(i) || i === state.cmdkSel) return;
    state.cmdkSel = i;
    var list = row.closest(".cmdk-list");
    if (!list) return;
    list.querySelectorAll("[data-sel]").forEach(function (r) { r.removeAttribute("data-sel"); });
    row.setAttribute("data-sel", "");
  });

  document.getElementById("pick").addEventListener("change", function (e) {
    goTo(e.target.value);
  });

  /* ── The keyboard layer ─────────────────────────────────────────────────
     Drawn here, owned by Rust. §1 of the plan does not cover the window, and
     `Cmd+Q`, `Cmd+W`, a real menu bar and native drag and drop are all things
     the OS grants a process rather than things a document can do — a web page
     cannot quit an application, and a page that appears to is lying. What this
     file settles is the ASSIGNMENT, which is a design decision and is settled
     here so the native work has something to implement rather than invent:

       Cmd/Ctrl + K      search — the palette below
       Cmd/Ctrl + ,      settings, the platform convention on all three
       Cmd/Ctrl + W      close the window, not quit the app
       Cmd/Ctrl + Q      quit (macOS; Alt+F4 elsewhere)
       Esc               dismiss the topmost transient thing

     The last one is a stack, not a switch, and the order matters: palette
     first, then the settings sheet. Escape closing the sheet out from under an
     open palette is the bug this ordering exists to prevent.

     `metaKey || ctrlKey` rather than a platform sniff. The prototype runs in a
     browser on whatever the reviewer has, and both are correct on the platform
     they come from. */
  document.addEventListener("input", function (e) {
    if (e.target && e.target.id === "cmdk-input") {
      state.cmdkQuery = e.target.value;
      state.cmdkSel = 0;
      render();
    }
  });

  document.addEventListener("keydown", function (e) {
    var mod = e.metaKey || e.ctrlKey;

    if (mod && e.key.toLowerCase() === "k") {
      e.preventDefault();
      state.cmdk = !state.cmdk;
      state.cmdkQuery = "";
      state.cmdkSel = 0;
      render();
      return;
    }

    if (state.cmdk) {
      if (e.key === "Escape") { e.preventDefault(); state.cmdk = false; render(); return; }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        var n = cmdkMatches().length;
        if (n) {
          /* Wraps. A list this short with a hard stop at each end makes the
             user check where they are; wrapping never does. */
          state.cmdkSel = (state.cmdkSel + (e.key === "ArrowDown" ? 1 : n - 1)) % n;
          render();
        }
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        var hit = cmdkMatches()[state.cmdkSel];
        if (hit) runCmdk(hit.act);
        return;
      }
      return;
    }

    if (mod && e.key === ",") {
      e.preventDefault();
      if (findNav(state.screen).surface !== "settings") goTo("general");
      return;
    }

    /* Escape dismisses the sheet, from the field as well — that is the one key
       a modal owes regardless of focus. */
    if (e.key === "Escape" && findNav(state.screen).surface === "settings") {
      goTo(state.under);
      return;
    }
    /* `document` is a legal event target and has no `matches`, so the guard
       has to check for the method rather than assume an element. A synthetic
       key event dispatched on the document — which is how the screen sweep in
       the README's verification runs — threw here before this line. */
    if (e.target && e.target.matches && e.target.matches("input, textarea, select")) return;
    var k = e.key.toLowerCase();
    if (k === "p") { state.palette = state.palette === "after" ? "before" : "after"; render(); }
    else if (k === "c") { state.copy = state.copy === "after" ? "before" : "after"; render(); }
    else if (k === "1") { state.density = "tight"; render(); }
    else if (k === "2") { state.density = "standard"; render(); }
    else if (k === "3") { state.density = "roomy"; render(); }
    else if (k === "d") { state.theme = "dark"; render(); }
    else if (k === "l") { state.theme = "light"; render(); }
    else if (k === "s") { state.theme = "system"; render(); }
  });

  /* The OS theme is watched, not sampled. `system` means system, and a value
     read once at load is a guess that goes stale the first time the desktop
     switches at sunset. Only re-renders while the deferral is actually in
     effect — flipping the desktop while pinned to Dark must change nothing. */
  if (SYSTEM_DARK.addEventListener) {
    SYSTEM_DARK.addEventListener("change", function () {
      if (state.theme === "system") render();
    });
  } else if (SYSTEM_DARK.addListener) {
    SYSTEM_DARK.addListener(function () {
      if (state.theme === "system") render();
    });
  }

  /** Renders every screen once, off-DOM, purely to total the prose. Sub-tabbed
      screens contribute only their open tab — the same thing the eye sees —
      so this total is the demo's own document, never a claim about the whole
      shipped surface. */
  function computeTotal() {
    var save = COUNT;
    // `n` is counted rather than written down: the label drifted once already,
    // when screens were added and "19 screens" stayed 19.
    TOTAL = { b: 0, a: 0, n: 0 };
    Object.keys(SCREENS).forEach(function (id) {
      // `ds` documents the demo and `commit` was withdrawn 2026-08-03 — neither
      // is product copy, and counting either would dilute the cut. The commit
      // screen's remaining prose argues about itself; it proposes nothing.
      // `noteactions` is Notes with its other panel open: counting it would
      // count the whole note body a second time.
      if (id === "ds" || id === "commit" || id === "noteactions") return;
      COUNT = { b: 0, a: 0 };
      try { SCREENS[id](); } catch (err) { /* a broken screen must not blank the meter */ }
      TOTAL.b += COUNT.b;
      TOTAL.a += COUNT.a;
      TOTAL.n += 1;
    });
    COUNT = save;
  }

  buildPicker();
  render();
  animLoop();

  /* Reduced motion is a live setting, not a boot-time fact. Someone turning it
     on mid-session must not have to reload to be obeyed. */
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    var onMq = function () { REDUCED = mq.matches; render(); animLoop(); };
    if (mq.addEventListener) mq.addEventListener("change", onMq);
    else if (mq.addListener) mq.addListener(onMq);
  }
})();
