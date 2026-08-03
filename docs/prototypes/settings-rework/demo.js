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
    copy: "after",
    density: "standard",
    /* Per-screen sub-tab selection. Language Models opens on Rewrite, not on
       the first tab: Rewrite is where the copy weight the plan measured
       actually sits (the communication-style description and the slang
       paragraph), so landing anywhere else hides what the switch is for. */
    sub: { llm: "Rewrite" },
  };

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
    check: '<path d="m4.5 12.5 5 5 10-11"/>',
    x: '<path d="m5.5 5.5 13 13"/><path d="m18.5 5.5-13 13"/>',
    alert: '<path d="M12 4.5 2.8 20h18.4Z"/><path d="M12 10v4"/><path d="M12 17h.01"/>',
    play: '<path d="M7 4.5 19 12 7 19.5Z"/>',
    restore: '<path d="M3 12a9 9 0 1 0 2.6-6.4"/><path d="M3 4.5V10h5.5"/>',
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 5.5A2 2 0 0 0 13.5 3.5h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2"/>',
    trash: '<path d="M4.5 6.5h15"/><path d="M9 6.5V4.5h6v2"/><path d="M6.5 6.5 7.5 20h9l1-13.5"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    arrow: '<path d="M5 12h13"/><path d="m12.5 6 6 6-6 6"/>',
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
  };

  /* ── Brand mark ────────────────────────────────────────────────────────────
     The shipped wordmark itself — `assets/logos/wordscipt-logo-transparent.png`,
     copied into this folder as `wordmark.png` rather than redrawn, so the
     prototype shows the real thing. `SettingsWindow.tsx` caps it at 180 px; the
     same cap holds here. The qualifier below it is what tells the two windows
     apart, since ADR 0003 leaves the title bar to the OS. */

  function brandMark(qualifier) {
    return '<div class="brand">' +
      '<img src="wordmark.png" alt="WordScript">' +
      (qualifier ? '<span class="qual">' + t(qualifier) + "</span>" : "") +
      "</div>";
  }

  /* ── Component builders ─────────────────────────────────────────────── */

  function card(o) {
    var head = "";
    if (o.title || o.desc) {
      head = '<div class="card-head">' +
        (o.title ? "<h3>" + t(o.title) + "</h3>" : "") +
        (o.desc ? "<p>" + p(o.desc) + "</p>" : "") + "</div>";
    }
    return '<div class="card">' + head +
      (o.rows ? '<div class="rows">' + o.rows.join("") + "</div>" : "") +
      (o.body || "") + "</div>";
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

  function subtabs(screen, items) {
    var active = state.sub[screen] || items[0];
    return '<div class="subtabs" role="tablist" data-subtabs="' + screen + '">' +
      items.map(function (i) {
        return '<button role="tab" aria-selected="' + (i === active ? "true" : "false") +
          '" data-sub="' + esc(i) + '">' + t(i) + "</button>";
      }).join("") + "</div>";
  }

  function activeSub(screen, items) { return state.sub[screen] || items[0]; }

  function banner(o) {
    return '<div class="banner">' + icon("eye") +
      '<span class="banner-text"><b>Layout preview — not wired to the runtime.</b> ' +
      p(o.text) + "</span></div>";
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
    return '<input class="field" value="' + t(value || "") + '"' +
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

  function check(items) {
    return items.map(function (i) {
      var mark = i.state === "ok" ? icon("check") : i.state === "fail" ? icon("x") : "";
      return '<div class="check" data-state="' + i.state + '"><span class="mark">' + mark + "</span>" +
        '<span class="check-text"><b>' + t(i.label) + "</b>" +
        (i.detail ? "<span>" + p(i.detail) + "</span>" : "") +
        (i.code ? "<code>" + t(i.code) + "</code>" : "") + "</span>" +
        (i.tag ? badge(i.tag, i.tagTone || "accent") : "") +
        (i.action ? btn(i.action, "ghost") : "") + "</div>";
    }).join("");
  }

  function listItem(o) {
    return '<div class="list-item"><div class="list-item-text"><b>' + t(o.title) + "</b>" +
      '<span class="list-item-meta">' + o.meta.map(function (m, ix) {
        return (ix ? '<span class="sep">·</span>' : "") + "<span>" + t(m) + "</span>";
      }).join("") + "</span></div>" +
      (o.badge ? badge(o.badge.text, o.badge.tone) : "") +
      (o.actions ? '<div class="list-actions">' + o.actions.join("") + "</div>" : "") + "</div>";
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

  function wave(n, seed) {
    var bars = "";
    for (var i = 0; i < n; i++) {
      var h = 3 + Math.abs(Math.sin((i + seed) * 1.7)) * 15;
      bars += '<i style="height:' + h.toFixed(1) + 'px"></i>';
    }
    return '<span class="wave">' + bars + "</span>";
  }

  function docLink(label) {
    return ' <a class="link" href="#" onclick="return false">' + t(label) + "</a>";
  }

  /* ── Pane: a list column and its detail, as one surface ────────────────
     Not two cards side by side. The column is part of the window; what is
     selected in it governs everything right of the hairline. */

  function pane(o) {
    return '<div class="pane">' +
      '<div class="pane-list">' +
      '<div class="pane-list-head"><b>' + t(o.listTitle) + "</b>" +
      (o.count != null ? '<span class="count">' + t(o.count) + "</span>" : "") + "</div>" +
      (o.search ? '<div class="pane-search">' + field("", { placeholder: o.search }) + "</div>" : "") +
      '<div class="pane-scroll">' +
      (o.groups
        ? o.groups.map(function (g) {
          return '<div class="pane-group"><label>' + t(g.label) + "</label>" +
            g.rows.map(paneRow).join("") + "</div>";
        }).join("")
        : o.rows.map(paneRow).join("")) +
      "</div>" +
      (o.foot ? '<div class="pane-list-foot">' + o.foot + "</div>" : "") +
      "</div>" +
      '<div class="pane-detail">' +
      '<div class="pane-detail-head"><div class="grow"><h2>' + t(o.title) + "</h2>" +
      (o.desc ? "<p>" + p(o.desc) + "</p>" : "") + "</div>" +
      (o.actions ? '<div class="rowflex">' + o.actions + "</div>" : "") + "</div>" +
      '<div class="pane-detail-body">' + o.body + "</div></div></div>";
  }

  function paneRow(r) {
    return '<button class="pane-row" aria-current="' + (r.on ? "true" : "false") + '">' +
      (r.icon ? icon(r.icon) : "") +
      '<span class="pane-row-text"><b>' + t(r.title) + "</b>" +
      (r.sub ? "<span>" + t(r.sub) + "</span>" : "") + "</span>" +
      (r.pinned ? '<span class="pin">' + icon("pin") + "</span>" : "") +
      (r.badge ? badge(r.badge.text, r.badge.tone) : "") + "</button>";
  }

  /** One centred column: a view whose whole job is one action, or one that is
      not set up yet. Honest where a populated fake layout is not. */
  function solo(o) {
    return '<div class="solo"><div class="solo-head">' +
      (o.icon ? '<span class="tile">' + icon(o.icon) + "</span>" : "") +
      "<h2>" + t(o.title) + "</h2>" +
      (o.desc ? "<p>" + p(o.desc) + "</p>" : "") + "</div>" + o.body + "</div>";
  }

  function chips(items) {
    return '<div class="chips">' + items.map(function (c) {
      return '<span class="chip-x" data-origin="' + (c.origin || "added") + '">' + t(c.term) +
        "<button aria-label=\"Remove " + t(c.term) + '">' + icon("x") + "</button></span>";
    }).join("") + "</div>";
  }

  /** A small caption above a card group. Section 3, borrow: the donor labels
      its Integrations groups this way rather than titling each card. */
  function grp(label, body) {
    return '<div class="grp"><label>' + t(label) + "</label>" + body + "</div>";
  }

  function cmd(text) {
    return '<div class="cmd"><code>' + t(text) + "</code>" +
      btn("Copy", "ghost", { icon: "copy" }) + "</div>";
  }

  /** Home's attention line. Rendered only when something is actually owed —
      a standing banner reporting that all is well is furniture. */
  function strip(o) {
    return '<div class="strip">' + icon(o.icon || "alert") +
      '<div class="strip-text"><b>' + t(o.title) + "</b><span>" + p(o.text) + "</span></div>" +
      '<div class="rowflex">' + o.actions + "</div></div>";
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
      group: "Workspace", items: [
        { id: "home", label: "Home", icon: "home", surface: "workspace" },
        { id: "history", label: "History", icon: "history", surface: "workspace" },
        { id: "profiles", label: "Profiles", icon: "profiles", surface: "workspace" },
        { id: "notes", label: "Notes", icon: "notes", surface: "workspace", tag: "prev" },
        { id: "upload", label: "Upload", icon: "upload", surface: "workspace", tag: "prev" },
        { id: "chat", label: "Chat", icon: "chat", surface: "workspace", tag: "prev" },
        { id: "integrations", label: "Integrations", icon: "integrations", surface: "workspace", tag: "prev" },
      ]
    },
    {
      group: "Settings", items: [
        { id: "general", label: "General", icon: "general", surface: "settings" },
        { id: "hotkeys", label: "Hotkeys", icon: "keyboard", surface: "settings" },
        { id: "stt", label: "Speech-to-Text", icon: "mic", surface: "settings" },
        { id: "llm", label: "Language Models", icon: "models", surface: "settings" },
        { id: "agents", label: "Agents", icon: "agents", surface: "settings", tag: "prev" },
        { id: "delivery", label: "Delivery & Insert", icon: "delivery", surface: "settings" },
        { id: "privacy", label: "Privacy & Data", icon: "privacy", surface: "settings" },
        { id: "account", label: "Account & Sync", icon: "user", surface: "settings", tag: "prev" },
        { id: "diagnostics", label: "Diagnostics", icon: "diagnostics", surface: "settings" },
        { id: "about", label: "About & Updates", icon: "about", surface: "settings" },
      ]
    },
    {
      group: "Previews", items: [
        { id: "onboarding", label: "Onboarding", icon: "wand", surface: "standalone" },
        { id: "commit", label: "Live preview & commit", icon: "eye", surface: "standalone" },
        { id: "agents", label: "Agents", icon: "agents", surface: "settings", alias: true },
        { id: "account", label: "Account & Sync", icon: "user", surface: "settings", alias: true },
        { id: "notes", label: "Notes", icon: "notes", surface: "workspace", alias: true },
        { id: "upload", label: "Upload", icon: "upload", surface: "workspace", alias: true },
        { id: "chat", label: "Chat", icon: "chat", surface: "workspace", alias: true },
        { id: "integrations", label: "Integrations", icon: "integrations", surface: "workspace", alias: true },
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

  function workspaceSidebar(active) {
    var items = NAV[1].items;
    return '<nav class="nav">' + brandMark(null) +
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

  function settingsSidebar(active) {
    var items = NAV[2].items;
    var groups = [
      { name: "App", ids: ["general", "hotkeys"] },
      { name: "AI", ids: ["stt", "llm", "agents"] },
      { name: "System", ids: ["delivery", "privacy", "account", "diagnostics", "about"] },
    ];
    return '<nav class="nav">' + brandMark("Settings") + groups.map(function (g) {
      return '<div class="nav-group"><h3>' + t(g.name) + "</h3>" +
        g.ids.map(function (id) {
          var i = items.filter(function (x) { return x.id === id; })[0];
          return '<button class="nav-row" data-go="' + i.id + '" aria-current="' +
            (i.id === active ? "true" : "false") + '">' + icon(i.icon) + t(i.label) +
            (i.tag ? '<span class="nav-tag">preview</span>' : "") + "</button>";
        }).join("") + "</div>";
    }).join("") +
      /* The settings window carries the same switcher as the workspace. It is
         not decoration here: every value marked with a scope tag on these
         screens belongs to whichever profile this row names, so the row is the
         context the whole window is read in — and switching it changes what
         several of these screens are showing. The tags say which values; this
         says which profile. */
      '<div class="nav-foot"><button class="nav-row" data-go="home">' + icon("arrow") +
      "Back to workspace</button>" + profileSwitcher() + "</div></nav>";
  }

  function systemSidebar(active) {
    var groups = [
      { name: "System", items: NAV[0].items },
      { name: "Workspace", items: NAV[1].items },
      { name: "Settings", items: NAV[2].items },
      { name: "Previews", items: NAV[3].items },
    ];
    return '<nav class="nav">' + brandMark(null) + groups.map(function (g) {
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
      '<header class="view-head"><h1>Design System</h1><p>' +
      p("The system this prototype is made of. Every value below is live — flip the switches in the rig and this page changes with the rest of the demo.") +
      "</p></header>",

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
          ]
        })
      ),

      sec("Radius", "Concentric: an inner radius equals its outer radius minus the gap between them.",
        card({
          rows: [
            row({ label: "Card", ctl: '<span class="mono muted">' + (ds ? "12px" : "10px") + "</span>" }),
            row({ label: "Control, input, tile", ctl: '<span class="mono muted">8px</span>' }),
            row({ label: "Key cap", ctl: '<span class="mono muted">5px</span>' }),
            row({ label: "Segment, sub-tab, badge, radio", ctl: '<span class="mono muted">999px</span>' }),
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
            state_("waveform", wave(22, 1)) +
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
              label: "Solo",
              hint: "One centred column when the view has one job, or is not set up yet. Upload, Onboarding.",
              ctl: badge("one action", "plan")
            }),
          ]
        }) +
        note("Two cards side by side is not a pane. It reads as two unrelated boxes, because nothing on screen states that the left one governs the right one.", "alert")
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

      sec("What the palette switch changes", "So the comparison is legible rather than atmospheric.",
        card({
          rows: [
            row({ label: "Surface ladder", hint: "Five background tokens move up roughly seven L* points and lose the blue tint.", ctl: badge("changed", "accent") }),
            row({ label: "Foreground ramp", hint: "Warm neutrals. --fg-muted clears AA for the first time.", ctl: badge("changed", "accent") }),
            row({ label: "Accent", hint: "#e68900 to #ff9c2b — one step up, because the ground got lighter.", ctl: badge("changed", "accent") }),
            row({ label: "Card radius and border", hint: "10 px with a hairline becomes 12 px with none.", ctl: badge("changed", "accent") }),
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
  SCREENS.home = function () {
    return [
      '<header class="view-head"><h1>Home</h1><p>' +
      p("Press Ctrl+Super in any app. What lands here is what the runtime produced.") +
      "</p></header>",

      // Owed, and dismissible. Absent whenever nothing is owed.
      strip({
        icon: "alert",
        title: "One insert fell back to the clipboard",
        text: "Yesterday 17:03, Support reply. The target app ignored the paste.",
        actions: btn("Review", null, { icon: "arrow" }) + btn("Dismiss", "ghost"),
      }),

      /* ADR 0024: the mode has one source, and every writer announces it. Home
         reports it and cannot set it \u2014 the control lives in the profile.

         The lane, the model and the delivery target used to stand here as a
         second row. They are standing state, not news, so they moved to the
         window's bottom edge where they are readable from every view instead
         of only from this one. What is left is what changes between
         dictations: which mode the next one runs as, and what the last one
         left behind. */
      card({
        body: '<div class="rows">' +
          row({
            label: "Next dictation runs as Cleanup",
            hint: {
              b: "General writing is set to Auto, which routed the last five dictations from the workspace context.",
              a: "General writing is on Auto. The workspace context routed the last five."
            },
            ctl: '<span class="rowflex">' + badge("via Auto", "plan") + scope("General writing") + "</span>"
          }) +
          row({
            label: "Last transcript",
            hint: "\u201cKundenanfrage zum Lieferstatus, bitte freundlich beantworten.\u201d",
            ctl: '<span class="rowflex">' + btn("Copy", "ghost", { icon: "copy" }) +
              btn("Restore", null, { icon: "restore" }) + "</span>"
          }) + "</div>"
      }),

      sec("Recent", null,
        card({
          body: '<div class="list">' +
            listItem({ title: "Let\u2019s ship the settings restructure today and review the overlay tab.", meta: ["2 min ago", "Cleanup", "General writing"], actions: [btn("Copy", "ghost", { icon: "copy" }), btn("Insert", "ghost")] }) +
            listItem({ title: "Hey WordScript, write a short reply confirming Thursday works.", meta: ["18 min ago", "Draft", "General writing"], actions: [btn("Copy", "ghost", { icon: "copy" })] }) +
            listItem({ title: "Consolidate insert recovery into a single home.", meta: ["1 h ago", "Verbatim", "General writing"], actions: [btn("Copy", "ghost", { icon: "copy" })] }) +
            listItem({ title: "Kundenanfrage zum Lieferstatus, bitte freundlich beantworten.", meta: ["Yesterday", "Rewrite", "Support reply"], badge: { text: "Clipboard", tone: "warning" }, actions: [btn("Restore", "ghost", { icon: "restore" })] }) +
            listItem({ title: "Structure this into a prompt for Claude Code with the constraints I listed.", meta: ["Yesterday", "Prompt Enhance", "General writing"], actions: [btn("Copy", "ghost", { icon: "copy" })] }) +
            "</div>"
        }) +
        '<div class="rowflex">' + btn("Open History", "ghost", { icon: "arrow" }) + "</div>"
      ),

      note("Empty, this surface reads: \u201cNo dictations yet \u2014 press Ctrl+Super in any app to start.\u201d One line, one key, no illustration.", "about"),
    ].join("");
  };

  /* ── Workspace: History ─────────────────────────────────────────────── */

  /* The shipped surface spends a whole card of stacked FormRows on three
     filters — a search box, a status select and a toggle, each with a label in
     the left column. Filters are a toolbar: they belong above the thing they
     filter, on one line, and the count belongs to the list they produce. */
  SCREENS.history = function () {
    return [
      '<header class="view-head"><h1>History</h1><p>' +
      p("Every transcription kept on this machine.") + "</p></header>",

      '<div class="toolbar">' +
      '<span class="search">' + icon("search") + field("", { placeholder: "Search transcripts…" }) + "</span>" +
      select("All statuses", ["All statuses", "Completed", "Empty", "Failed"]) +
      '<span class="rowflex"><span class="muted">Errors only</span>' + toggle(false) + "</span>" +
      '<span class="right rowflex">' + btn("Export", "ghost", { icon: "download" }) + "</span></div>",

      sec("7 transcriptions", null,
        card({
          body: '<div class="list">' +
            [
              ["Let's ship the settings restructure today and review the overlay tab.", ["09:42", "Cleanup", "General writing"], null],
              ["Hey WordScript, write a short reply confirming Thursday works.", ["09:26", "Draft", "General writing"], null],
              ["Consolidate insert recovery into a single home.", ["08:51", "Verbatim", "General writing"], null],
              ["Kundenanfrage zum Lieferstatus, bitte freundlich beantworten.", ["Yesterday 17:03", "Rewrite", "Support reply"], { text: "Insert failed", tone: "danger" }],
              ["Structure this into a prompt for Claude Code with the constraints I just listed.", ["Yesterday 15:40", "Prompt Enhance", "General writing"], { text: "Retry", tone: "plan" }],
              ["Standup notes: overlay placement fixed, shortcuts still open.", ["Yesterday 09:12", "Cleanup", "General writing"], null],
              ["Danke fuer die Rueckmeldung, ich schaue mir das heute noch an.", ["Mon 16:22", "Rewrite", "Support reply"], { text: "Clipboard only", tone: "warning" }],
            ].map(function (e) {
              return listItem({
                title: e[0], meta: e[1], badge: e[2],
                actions: [btn("Copy", "ghost", { icon: "copy" }), btn("Retry", "ghost", { icon: "restore" }), btn("Delete", "ghost", { icon: "trash" })]
              });
            }).join("") + "</div>"
        })
      ),

      note("Kept on this machine for 90 days, capped at 500 entries.", "privacy",
        docLink("Change in Privacy & Data")),
    ].join("");
  };

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
    if (active === "Defaults") {
      body = card({
        title: "How this profile works",
        desc: {
          b: "These settings travel with the profile. Switching profiles switches all of them at once, and a running session keeps the ones it started with.",
          a: "These travel with the profile. A running session keeps the ones it started with."
        },
        rows: [
          row({
            label: "Processing mode",
            hint: "Auto picks Cleanup, Draft or Prompt Enhance per dictation. It never picks Verbatim or Rewrite — those stay your call.",
            ctl: select("Auto", ["Auto", "Verbatim", "Cleanup", "Rewrite", "Draft", "Prompt Enhance"])
          }),
          row({
            label: "Delivery",
            hint: "Where a finished transcript goes in this profile.",
            ctl: seg(["Insert at cursor", "Clipboard only"], "Insert at cursor")
          }),
          row({
            label: "Workspace context",
            hint: {
              b: "When enabled, WordScript detects the active app (IDE, browser, chat, …) and passes it to every mode as a weak hint. It never contributes content.",
              a: "Passes the active app to every mode as a weak hint. Never contributes content."
            },
            ctl: toggle(true)
          }),
          /* Three things bound a recording, and they used to be two rows that
             never mentioned each other. Ordered by how hard each one is: you
             stop talking, the recording gets long, the provider cannot take
             any more. The limit is stated where it is spent (ADR 0034) and it
             is the runtime's number — it moves with the provider, the account
             plan and the model, so nothing recomputes it in the UI. */
          row({
            label: "Processing limit",
            hint: {
              b: "The longest recording this setup can process at all — 13:39, set by the 25 MiB upload size on your free plan. Past it the recording cannot be transcribed, so the auto-stop below stays underneath it.",
              a: "13:39 here, set by the 25 MiB upload size. Past it nothing can be transcribed."
            },
            ctl: badge("13:39")
          }),
          row({
            label: "Auto-stop",
            hint: {
              b: "Ends the recording at this length, so it always finishes processing. Recommended: up to 12:18, which keeps 01:21 of headroom under the processing limit.",
              a: "Ends the recording here so it still goes through. Up to 12:18 keeps headroom."
            },
            ctl: stepper(10, "min")
          }),
          row({
            label: "Stop after silence",
            hint: {
              b: "Ends the recording after this many seconds without speech (0 disables it). Independent of the length limits above — it reacts to you stopping, not to the recording getting long.",
              a: "Ends the recording when you stop talking. 0 disables it."
            },
            ctl: stepper(3, "s")
          }),
        ]
      }) + card({
        rows: [
          row({
            label: "Profile health",
            hint: "One flag: the context list is long enough to blur what the recognizer is biased towards.",
            ctl: '<span class="rowflex">' + badge("1 flag", "warning") + btn("Review", "ghost", { icon: "arrow" }) + "</span>"
          })
        ]
      }) + card({
        title: "What travels, and what it does",
        desc: {
          b: "Where each list lands before and after transcription, then the rules run against a sample. No microphone capture and no semantic guessing — the AI stages are not part of this preview.",
          a: "Where each list lands, checked against a sample."
        },
        rows: [
          row({ label: "Profile context", hint: "Steers which word the AI picks.", ctl: badge("AI modes", "plan") }),
          row({ label: "Words & names", hint: "Repairs mangled terms, biases the recognizer.", ctl: badge("recognizer + AI", "plan") }),
          row({ label: "Replacements", hint: "Exact swap, before the AI sees the text.", ctl: badge("every mode", "plan") }),
          row({ label: "Snippets", hint: "Trigger phrase expands to a block.", ctl: badge("every mode", "plan") })
        ],
        body: '<div class="rows"><div class="row stack">' +
          '<div class="rowflex">' + btn("Check against a sample", null, { icon: "play" }) + "</div></div></div>"
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
              actions: [btn("Edit", "ghost"), btn("Delete", "ghost", { icon: "trash" })]
            });
          }).join("") + "</div>" +
          note({ b: "", a: "Misheard names belong in Words & names instead." }, "arrow", docLink("Why")) +
          '<div class="rowflex" style="padding-top:12px">' + btn("Add replacement", null, { icon: "plus" }) + "</div>"
      });
    } else {
      body = card({
        title: "Snippets",
        desc: "A trigger phrase you say, and the block it expands to.",
        body: '<div class="list">' +
          [["standard closing", "Best regards,\nFelix"], ["ticket header", "Ticket: \nStatus: \nNext step: "]].map(function (s) {
            return listItem({
              title: s[0], meta: ["expands to " + s[1].split("\n").length + " lines"],
              actions: [btn("Edit", "ghost"), btn("Delete", "ghost", { icon: "trash" })]
            });
          }).join("") + "</div>" +
          '<div class="rowflex" style="padding-top:12px">' + btn("Add snippet", null, { icon: "plus" }) + "</div>"
      });
    }

    return '<header class="view-head"><h1>Profiles</h1><p>' +
      p("What a profile knows, and what it changes about how you are written.") +
      "</p></header>" +
      pane({
        listTitle: "Profiles", count: "3",
        rows: [
          { title: "General writing", sub: "Auto · Insert at cursor", on: true, icon: "profiles" },
          { title: "Support reply", sub: "Rewrite · Client register", icon: "profiles" },
          { title: "Customer success replies", sub: "Rewrite · Clipboard only", icon: "profiles" }
        ],
        foot: btn("New profile", "ghost", { icon: "plus" }),
        title: "General writing",
        desc: "Curated · active in this session",
        actions: badge("Active", "success") + btn("Duplicate", "ghost") +
          btn("Export", "ghost", { icon: "download" }),
        body: subtabs("profiles", tabs) + body
      });
  };
  SCREENS.profiles.layout = "pane";

  /* ── Workspace previews ─────────────────────────────────────────────── */

  /* Content parity with the shipped NotesArea: three panes (transcript with
     speaker separation, raw notes, enhanced summary), pinning, search, the
     per-note actions and both empty states. The layout is the new one; the
     feature set is what already exists. */
  SCREENS.notes = function () {
    var panes = ["Transcript", "Raw notes", "Enhanced"];
    var open = activeSub("notes", panes);
    var body;

    if (open === "Transcript") {
      body = '<div class="readout">' +
        '<span class="speaker" data-tone="a">Speaker 1</span> Let’s ship the settings restructure today.\n' +
        '<span class="speaker" data-tone="b">Speaker 2</span> Agreed, then review the overlay tab.\n' +
        '<span class="speaker" data-tone="a">Speaker 1</span> I’ll handle the Diagnostics sub-tabs.' +
        "</div>" +
        '<div class="rowflex">' + btn("Copy transcript", null, { icon: "copy" }) +
        btn("Unpin", "ghost", { icon: "pin" }) + btn("Delete", "ghost", { icon: "trash" }) + "</div>";
    } else if (open === "Raw notes") {
      body = textarea("Ship settings restructure\nReview overlay tab\nHandle Diagnostics sub-tabs",
        "Type raw notes here…", 9) +
        '<div class="rowflex">' + btn("Copy", "ghost", { icon: "copy" }) + "</div>";
    } else {
      body = '<div class="readout"><span class="lead">' + icon("sparkle") + "AI-enhanced summary</span>" +
        "Decisions:\n- Ship settings restructure today\n- Review overlay tab next\n\n" +
        "Action items:\n- Speaker 1: Diagnostics sub-tabs</div>" +
        note("Enhancement is not wired yet. It will extract decisions and action items.", "eye");
    }

    return '<header class="view-head"><h1>Notes</h1><p>' +
      p("Meeting notes with speaker separation and an AI summary.") + "</p></header>" +
      banner({ text: "Planned: V2. Diarization has no native path yet." }) +
      pane({
        listTitle: "Notes", count: "3", search: "Search notes…",
        groups: [
          {
            label: "Pinned", rows: [
              { title: "Standup 2026-06-21", sub: "09:41 · 2 speakers", on: true, icon: "notes", pinned: true }
            ]
          },
          {
            label: "All notes", rows: [
              { title: "Customer call — Acme", sub: "11:02 · 2 speakers", icon: "notes" },
              { title: "Untitled note", sub: "No transcript yet", icon: "notes" }
            ]
          }
        ],
        foot: btn("New note", "ghost", { icon: "plus" }),
        title: "Standup 2026-06-21",
        desc: "09:41 · 2 speakers · 12:04",
        actions: btn("Enhance", null, { icon: "wand", disabled: true }),
        body: '<div class="speakers">' +
          '<span class="speaker" data-tone="a">Speaker 1</span>' +
          '<span class="speaker" data-tone="b">Speaker 2</span></div>' +
          subtabs("notes", panes) + body +
          card({
            rows: [
              row({ label: "Speaker diarization", hint: "Colour-codes each speaker in the transcript pane.", ctl: toggle(true, { disabled: true }) }),
              row({ label: "Enhancement", hint: "Extracts decisions and action items from the transcript.", ctl: badge("Not wired", "plan") })
            ]
          }) +
          note("Empty, the list reads “No notes match this search.” and the detail reads “No note selected — create a new note to start.”", "about")
      });
  };
  SCREENS.notes.layout = "pane";

  /* Content parity with the shipped UploadArea: the queue counts, the real
     provider error, per-row copy/retry/remove, and the stated size limits. */
  SCREENS.upload = function () {
    return '<header class="view-head"><h1>Upload</h1><p>' +
      p("Transcribe audio files you already have.") + "</p></header>" +
      banner({ text: "Planned: V2." }) +
      solo({
        icon: "upload",
        title: "Upload audio",
        desc: "Using Groq · whisper-large-v3-turbo · General writing",
        body: '<button class="dropzone">' + icon("upload") +
          "<b>Drop audio or video files, or click to browse</b>" +
          "<span>MP3, WAV, M4A, WebM, OGG, FLAC</span></button>" +
          stats([
            { label: "Completed", value: "1", tone: "success" },
            { label: "Processing", value: "1" },
            { label: "Failed", value: "1", tone: "warning" }
          ]) +
          card({
            title: "Queue (3)",
            desc: {
              b: "Files are processed in upload order. Completed transcripts can be copied or inserted at the cursor.",
              a: "Processed in upload order."
            },
            body: '<div class="list">' +
              listItem({
                title: "standup-2026-06-21.wav", meta: ["4.2 MB", "completed", "Okay let’s ship the settings restructure today and review the overlay tab."],
                badge: { text: "Completed", tone: "success" },
                actions: [btn("Copy", "ghost", { icon: "copy" }), btn("Insert", "ghost"), btn("Remove", "ghost", { icon: "trash" })]
              }) +
              listItem({
                title: "acme-call.wav", meta: ["31.8 MB", "uploading"],
                badge: { text: "Transcribing", tone: "warning" },
                actions: [btn("Remove", "ghost", { icon: "trash" })]
              }) +
              listItem({
                title: "interview-recording.mp3", meta: ["18.4 MB", "413 request_too_large — file exceeds the 100 MiB dev upload limit"],
                badge: { text: "Failed", tone: "danger" },
                actions: [btn("Retry", "ghost", { icon: "restore" }), btn("Remove", "ghost", { icon: "trash" })]
              }) +
              "</div>"
          }) +
          card({
            rows: [row({
              label: "Upload limits",
              hint: {
                b: "Cloud uploads are bounded by provider request size (Free ~25 MiB, Dev ~100 MiB). Local lane has no hard limit but is constrained by available memory and model context.",
                a: "Cloud: ~25 MiB free, ~100 MiB dev. Local is bounded by memory, not by a limit."
              },
              ctl: badge("Provider-bounded", "plan")
            })]
          })
      });
  };

  /* Content parity with the shipped ChatArea: the local-context label, per-turn
     copy, send states including failure, the typing indicator, the empty state
     and the two boundaries it states (voice input reuses the dictation hotkey;
     messages are not persisted). */
  SCREENS.chat = function () {
    function bubble(o) {
      return '<div class="msg" data-from="' + (o.me ? "me" : "ws") + '">' +
        '<span class="who">' + (o.me ? "F" : "WS") + "</span>" +
        '<div class="bubble"><div class="bubble-head"><b>' + (o.me ? "You" : "Assistant") +
        '</b><time>' + t(o.at) + "</time></div><p>" + t(o.text) + "</p>" +
        (o.failed ? '<p class="fail">Failed to send</p>' : "") +
        '<button class="copy" aria-label="Copy message">' + icon("copy") + "</button></div></div>";
    }

    return '<header class="view-head"><h1>Chat</h1><p>' +
      p("Ask about your own transcripts, dictionary, snippets and profiles.") + "</p></header>" +
      banner({ text: "Planned: V2. Replies are not wired to the runtime." }) +
      pane({
        listTitle: "Conversations", count: "2", search: "Search chats…",
        rows: [
          { title: "Support profile dictionary", sub: "09:41 · 2 messages", on: true, icon: "chat" },
          { title: "What did I dictate on Monday?", sub: "Mon 16:30 · 4 messages", icon: "chat" }
        ],
        foot: btn("New chat", "ghost", { icon: "plus" }),
        title: "Support profile dictionary",
        desc: "Local context — your transcripts, dictionary, snippets and profiles. Nothing else is read.",
        body: '<div class="thread grow">' +
          bubble({ me: true, at: "09:41", text: "What does my Support profile dictionary contain?" }) +
          bubble({
            at: "09:41",
            text: "Your active Support profile has 3 dictionary terms: SEV-1 → Severity 1, ETA → estimated time of arrival, and WordScript → WordScript. There are also 2 snippets for follow-up notes and status updates."
          }) +
          '<div class="msg" data-from="ws"><span class="who">WS</span>' +
          '<span class="typing"><i></i><i></i><i></i></span></div>' +
          "</div>" +
          '<div class="composer">' + field("", { placeholder: "Type a message…" }) +
          btn("Send", "primary", { disabled: true }) + "</div>" +
          note("Voice input will reuse the same hotkey logic as dictation. Messages here are local and not persisted.", "about")
      });
  };
  SCREENS.chat.layout = "pane";

  /* Two surfaces, not one. The plan's section 10.1 recorded that WordScript
     appears to need more than one MCP surface — a bridge that can speak to the
     user (ADR 0030) and a read surface for notes and transcripts that ADR 0030
     does not contemplate — and left the shape of the answer open. The first
     build showed only the bridge. Showing both is what makes the open question
     visible where it is spent: a client allowed to read transcripts holding a
     token that also reaches `ask` is a UX fact, not only an architecture one.
     The two groups are built so either answer fits without a redesign. */
  SCREENS.integrations = function () {
    return [
      '<header class="view-head"><h1>Integrations</h1><p>' +
      p("How other tools reach WordScript on this machine.") + "</p></header>",
      banner({ text: "Planned: Phase 8. Nothing here is running, and no port is open." }),

      stats([
        { label: "Endpoint", value: "Loopback" },
        { label: "Clients", value: "0" },
        { label: "Tokens", value: "None" },
      ]),

      grp("Ask me out loud", card({
        title: "Agent bridge",
        /* Written to budget on both sides of the switch: this screen has no
           shipped copy to reduce, so claiming a reduction here would inflate
           the meter with a comparison against nothing. */
        desc: "Lets a running agent ask you a question out loud, and wait for the answer.",
        rows: [
          row({ label: "Address", ctl: '<span class="mono muted">127.0.0.1 · port assigned at start</span>' }),
          row({
            label: "Token",
            hint: "Bearer token plus Origin rejection. Rotating it disconnects every client at once.",
            ctl: '<span class="rowflex">' + badge("Not issued", "plan") + btn("Generate", null, { disabled: true }) + "</span>"
          }),
          row({ label: "Tools", hint: "ask returns immediately; await blocks on the event stream within a budget.", ctl: '<span class="mono muted">ask · await</span>' }),
          row({ label: "Who may connect", hint: "One orchestrator. Coding agents get no entry of their own — it starts them and speaks for them.", ctl: badge("1 client", "plan") }),
        ],
        body: '<div class="rows"><div class="row stack">' +
          '<div class="row-text"><b>Port file</b><span class="row-hint">' +
          p("Written at start, so a client finds the port without being configured.") +
          "</span></div>" + cmd("~/.local/state/wordscript/mcp.port") + "</div></div>"
      })),

      grp("Read what I dictated", card({
        title: "Transcripts & notes",
        desc: "Lets any MCP client you configure read your history, notes and vocabulary.",
        rows: [
          row({ label: "Tools", ctl: '<span class="mono muted">history.search · notes.read · vocabulary.list</span>' }),
          row({ label: "Writes", hint: "Read-only for now. Whether it ever writes is not decided.", ctl: badge("Never", "success") }),
          row({
            label: "Can it speak to you?",
            hint: "No. Reaching your ears is the bridge's capability, and this surface does not have it.",
            ctl: badge("No", "success")
          }),
        ],
        body: '<div class="rows">' +
          row({
            label: "How the two are kept apart",
            hint: "Undecided. A reader must not end up holding a token that also reaches ask.",
            ctl: '<span class="rowflex">' + badge("Open decision", "warning") + "</span>"
          }) + "</div>"
      })),

      grp("From the terminal", card({
        title: "wordscript",
        desc: "Talks to a running WordScript over the same loopback port. No login, no key of its own.",
        rows: [
          stackRow({
            label: "Install and use",
            body: '<div class="stack gap2">' +
              cmd("brew install wordscript   ·   npm i -g @wordscript/cli") +
              cmd("wordscript history search \"lieferstatus\" --since 7d") +
              cmd("wordscript notes export --format md > standup.md") +
              cmd("wordscript profile use \"Support reply\"") +
              "</div>"
          }),
          row({ label: "Discovery", hint: "Reads the port file. Nothing to configure, nothing to paste.", ctl: badge("Automatic", "success") }),
          row({ label: "Dictating from the CLI", hint: "Not offered. The microphone belongs to whoever is at the keyboard, and a command cannot hold that claim.", ctl: badge("By design", "plan") }),
        ]
      })),

      grp("Where the text lands", card({
        desc: "WordScript writes into whatever app has focus. No per-editor plugin exists, or is needed.",
        rows: [
          row({ label: "Any focused app", hint: "Editor, browser, chat, terminal — the insert chain does not care which.", ctl: badge("Works today", "success") }),
          row({ label: "Prompt targets", hint: "Prompt Enhance shapes syntax for the named tool.", ctl: '<span class="mono muted">Claude Code · Cursor · ChatGPT · Copilot</span>' }),
          row({ label: "Hook-based delivery", hint: "Hand a finished transcript to a script instead of to the cursor.", ctl: badge("Later", "plan") }),
        ]
      })),

      grp("Deliberately absent", card({
        body: '<div class="rows">' +
          row({ label: "Per-repository setup", hint: "No MCP entry to paste into a repo, no snippet to commit. The orchestrator is the only client.", ctl: badge("By design", "plan") }) +
          row({ label: "Remote access", hint: "The endpoint stays on loopback. There is no tunnel, and no account to hang one on.", ctl: badge("By design", "plan") }) +
          row({ label: "Editor plugins", hint: "A plugin per editor is a maintenance surface with no user benefit — insert already works everywhere.", ctl: badge("By design", "plan") }) +
          "</div>"
      })),

      note("WordScript hands text to your tools; it does not run inside them. What starts and supervises coding agents is the orchestrator in Settings → Agents.", "about"),
    ].join("");
  };

  /* ── Settings: General ──────────────────────────────────────────────── */

  /* Everything on this screen belongs to the machine. Recording limits and the
     workspace-context switch used to sit here and are per-profile in the
     runtime, so they moved to Profiles → Defaults; what is left is the
     microphone, the cues and where the overlay opens. */
  SCREENS.general = function () {
    return [
      '<header class="view-head"><h1>General</h1><p>' +
      p("Microphone, sound and where the overlay appears.") + "</p></header>",

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
            body: level(62, 74, 34, "ok", "Good — peak −13 dBFS.") +
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

  /* ── Settings: Hotkeys ──────────────────────────────────────────────── */

  SCREENS.hotkeys = function () {
    var modes = [["Auto", "Alt+1"], ["Verbatim", "Alt+2"], ["Cleanup", "Alt+3"],
    ["Rewrite", "Alt+4"], ["Draft", "Alt+5"], ["Prompt Enhance", "Alt+6"]];
    return [
      '<header class="view-head"><h1>Hotkeys</h1><p>' +
      p("Every key WordScript listens for, in one place.") + "</p></header>",

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

      note("Alt+1 to Alt+6 replaced the earlier Ctrl rotation, which collided with tab switching in every browser and Ctrl+S in every editor.", "about"),
      note("Linux · X11 — the desktop registers global shortcuts; a combination another app already holds is reported here, never silently dropped.", "keyboard"),
    ].join("");
  };

  /* ── Settings: Speech-to-Text ───────────────────────────────────────── */

  SCREENS.stt = function () {
    return [
      '<header class="view-head"><h1>Speech-to-Text</h1><p>' +
      p("Which engine turns your voice into text.") + "</p></header>",

      lane({
        title: "Lane",
        options: [
          {
            icon: "cloud", name: "Groq cloud", on: true,
            desc: { b: "Cloud BYOK. Keys are stored locally in the OS secret store and never returned to the interface.", a: "Bring your own key. Stored in the OS secret store." }
          },
          {
            icon: "local", name: "Local", on: false, tag: "Preview",
            desc: { b: "WordScript needs a speech runner, one ggml STT model, a local cleanup endpoint and the selected cleanup model before this lane is ready.", a: "Runs on this machine. Needs four things installed." }
          },
        ]
      }),

      /* The shipped tab offers a "Profile" select beside the model select; in
         the cloud lane its options ARE the models, so two controls set one
         value. One stays. */
      sec("Model", null, card({
        rows: [
          row({
            label: "Groq API key",
            hint: { b: "Keys are stored locally in the OS secret store.", a: "In the OS secret store. Never written to the config file." },
            ctl: '<span class="rowflex">' + badge("Set", "success") + btn("Manage key", "ghost", { icon: "key" }) + "</span>"
          }),
          /* The plan is a property of the key, not of a profile, so it sits
             beside the key. It bounds the largest upload the provider accepts
             and with it the longest recording — which is why Profiles →
             Defaults can state a processing limit at all. Rendered only for
             providers that declare plans; the local lane has none. */
          row({
            label: "Account plan",
            hint: {
              b: "Which plan this API key is on. It sets the largest upload the provider accepts, and with it the longest recording WordScript can process — see Profiles → Defaults.",
              a: "Sets the largest upload, and with it the longest recording. See Profiles → Defaults."
            },
            ctl: select("Free — 25 MiB per request", ["Free — 25 MiB per request", "Developer — 100 MiB per request"])
          }),
          row({ label: "Model", ctl: select("whisper-large-v3-turbo", ["whisper-large-v3-turbo", "whisper-large-v3", "distil-whisper-large-v3-en"]) }),
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
        ]
      })),

      sec("Bias", "The active profile's words steer the recognizer before the AI sees anything.", card({
        rows: [
          row({ label: "Strength", ctl: '<span class="rowflex">' + scope() + seg(["Off", "Light", "Standard"], "Standard") + "</span>" }),
          row({ label: "Carry across windows", hint: "Keeps the bias in place for a long dictation, not just its first seconds.", ctl: toggle(true) }),
          row({ label: "What the recognizer receives", hint: "It takes only a few terms, and which ones is decided for you.", ctl: btn("Show", "ghost", { icon: "eye" }) }),
        ]
      })),

      /* The shipped tab hides this whole block unless the local lane is
         already selected, which makes switching a leap in the dark: you pick
         the lane, and only then find out what it needs. It stays visible and
         says it is not the active one. */
      sec("Local lane — not active", "What it would need, checked natively. Nothing here is inferred from environment variables.",
        card({
          body: check([
            { state: "ok", label: "Speech runner", detail: "whisper-cli resolved in PATH", code: "/usr/bin/whisper-cli" },
            { state: "ok", label: "STT model", detail: "ggml model present", code: "ggml-base.en.bin" },
            { state: "fail", label: "Cleanup endpoint", detail: "No local chat endpoint answered.", code: "http://127.0.0.1:11434", action: "How to fix" },
            { state: "todo", label: "Cleanup model", detail: "llama3.2:latest is not installed.", action: "Copy command" },
          ]),
          /* Beam size and best-of are two more rows of equal weight in the
             shipped tab, for a decode pass most users never touch. Folded, with
             the recommended values named in the summary. */
          rows: null
        }) +
        card({
          body: '<div class="rows">' +
            row({ label: "Preset", hint: "Model and decode settings as one choice.", ctl: select("base · fast", ["base · fast", "base · accurate", "small · accurate"]) }) +
            "</div>" +
            disclosure("Decode settings — beam 5, best of 5", "2", [
              row({ label: "Beam size", hint: "Higher trades latency for a broader local decode pass.", ctl: stepper(5, null) }),
              row({ label: "Best of", hint: "How many candidate decodes are scored before one is kept.", ctl: stepper(5, null) }),
            ])
        })
      ),
    ].join("");
  };

  /* ── Settings: Language Models ──────────────────────────────────────── */

  SCREENS.llm = function () {
    /* ADR 0029 renames the `agent` mode to `draft`: ADR 0030 gives the product
       a settings area called Agents for coding agents, and two unrelated things
       cannot both be called agent. `draft` states what comes out — a first
       version to be reviewed, which is what ADR 0026 means by calling the
       output an artifact rather than an answer. `agent` stays a legacy alias on
       read, `draft` is written back, so no profile breaks. */
    var tabs = ["Cleanup", "Rewrite", "Draft", "Prompt Enhance"];
    var active = activeSub("llm", tabs);

    /* ADR 0023 scopes the communication style to Draft AND Rewrite; Cleanup,
       Verbatim and Prompt Enhance are untouched. It therefore has to stand on
       both tabs — on one only, the other silently inherits a setting whose
       cause is nowhere on screen. Same card, same state, stated scope. */
    function styleCard(where) {
      return card({
        title: "Communication style",
        desc: {
          b: "How this profile writes. Applies to Agent and to Rewrite; Cleanup, Verbatim and Prompt Enhance stay untouched. The level sets the form only — it never changes the language you dictated in.",
          a: "Shared with " + where + ". Sets form, never language."
        },
        rows: [
          row({ label: "Register", hint: "Internal mail to the team. Complete sentences, address form follows your dictation, short salutation.", ctl: select("Colleague", ["Off", "Authority", "Client", "Colleague", "Friend", "Quick message"]) }),
          row({
            label: "Length",
            hint: { b: "Independent of the level above: formal and terse is as valid as informal and expansive.", a: "Independent of the register." },
            ctl: seg(["Terse", "Normal", "Expansive"], "Normal")
          }),
          stackRow({
            label: "Style rules",
            body: '<div class="field-wrap">' + textarea("no emoji\nkeep it under five sentences", "one rule per line", 3) + meterLine(42, 400) + "</div>"
          }),
          stackRow({
            label: "Writing sample",
            body: '<div class="field-wrap">' + textarea("morning, pushing the call to monday, hope that works", "a message you actually sent", 2) + meterLine(52, 400) + "</div>"
          })
        ],
        body: '<div class="rows"><div class="row stack"><p class="row-hint">' +
          p({
            b: "Slang comes from you, not from the level. The agent is forbidden from inventing slang or youth language on its own — models get it wrong more often than right, and wrong slang reads worse than none. It uses only what your rules and writing sample contain. Load a starter set to edit down:",
            a: "Uses only the slang your rules and sample contain."
          }) +
          (state.copy === "after" ? docLink("Why it never invents slang") : "") +
          '</p><div class="rowflex">' +
          btn("Load Deutsch starter set", "ghost") + btn("Load English starter set", "ghost") +
          "</div></div></div>"
      });
    }

    var body;
    if (active === "Cleanup") {
      body = card({
        title: "Cleanup",
        desc: "Removes filler sounds and fixes typos, grammar and punctuation. Stays close to your phrasing.",
        rows: [row({ label: "Model", ctl: select("llama-3.1-8b-instant", ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]) })]
      }) + note("No style applies here. Cleanup, Verbatim and Prompt Enhance are untouched by the communication style.", "about");
    } else if (active === "Rewrite") {
      body = card({
        title: "Rewrite",
        desc: "Cleanup plus rephrasing for clearer, more professional language. Manual only — never auto-selected.",
        rows: [row({ label: "Model", ctl: select("llama-3.3-70b-versatile", ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]) })]
      }) + styleCard("Draft");
    } else if (active === "Draft") {
      body = card({
        title: "Draft",
        desc: {
          b: "WordScript executes what you dictate as an instruction to it (e.g. “Hey WordScript, write an email…”). Named Agent until ADR 0029.",
          a: "Carries out what you dictate as an instruction, and returns a first version."
        },
        rows: [
          row({ label: "Model", ctl: select("llama-3.3-70b-versatile", ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]) }),
          row({
            label: "Name you address it by",
            hint: {
              b: "Who the agent is when you address it by name. The name also decides whether Auto routes a dictation into Agent mode, so it applies no matter which mode is selected.",
              a: "Also decides when Auto routes a dictation here, in every mode."
            },
            ctl: field("WordScript", { w: "150px" })
          })
        ]
      }) + styleCard("Rewrite") +
        note("Renamed from “Agent” — Settings → Agents is a different thing entirely: coding agents that speak to you. `agent` still reads from existing configs.", "about", docLink("ADR 0029"));
    } else {
      body = card({
        title: "Prompt Enhance",
        desc: "Structures raw dictation into a well-formed AI prompt for external tools.",
        rows: [
          row({ label: "Sub-mode", hint: "Enhance polishes without bloat; Expand restructures fully.", ctl: seg(["Enhance", "Expand"], "Enhance") }),
          row({ label: "Prompt target", hint: "Optimizes prompt syntax for the chosen AI tool.", ctl: select("Claude Code", ["General", "Claude Code", "Cursor", "ChatGPT", "Copilot"]) })
        ]
      });
    }

    return [
      '<header class="view-head"><h1>Language Models</h1><p>' +
      p("Which model each mode uses, and how it writes.") + "</p></header>",
      subtabs("llm", tabs),
      body,
      note("Which mode is effective right now is runtime truth and lives on Home. Which mode a profile defaults to lives in that profile. Neither is set here.", "about"),
    ].join("");
  };

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
    var tabs = ["Orchestrator", "Targets", "Voice"];
    var active = activeSub("agents", tabs);
    var body;

    if (active === "Orchestrator") {
      body = card({
        title: "The orchestrator",
        desc: "One process. It starts and drives the coding agents, and for them it is the human — they get no MCP entry and no per-repository setup.",
        rows: [
          row({ label: "Command", ctl: '<span class="mono muted">claude --print --permission-mode plan</span>' }),
          row({ label: "Status", ctl: badge("Not configured", "plan") }),
          row({ label: "Answer budget", hint: "How long await may block before the caller is told nobody answered.", ctl: '<span class="rowflex">' + field("90", { w: "56px" }) + '<span class="muted">s</span></span>' }),
          row({ label: "Spoken questions", hint: "One open question at a time, so an answer belongs to it by construction.", ctl: badge("Serial", "plan") })
        ]
      }) + card({
        body: '<div class="rows">' +
          row({ label: "This is not the Draft mode", hint: "Draft, in Language Models, turns one dictation into a first version of a text. Nothing here writes into your editor.", ctl: btn("Open Draft", "ghost", { icon: "arrow" }) }) +
          row({ label: "Agent is a delivery target", hint: "A bridge session returns the transcript to the caller and inserts nothing, so it sits on the delivery axis, not the mode axis.", ctl: btn("Open Delivery", "ghost", { icon: "arrow" }) }) +
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
            }).join("") + "</div>" +
          '<div class="rowflex" style="padding:0 0 16px">' + btn("New target", null, { icon: "plus" }) + "</div>"
      }) + card({
        title: "Roles",
        rows: [
          row({ label: "inspect", hint: "Reads the repository and answers. Writes nothing.", ctl: '<span class="rowflex">' + icon("inspect") + "</span>" }),
          row({ label: "work", hint: "May write, under the target’s permission profile.", ctl: '<span class="rowflex">' + icon("work") + "</span>" }),
          row({ label: "resume", hint: "Continues the target’s existing thread instead of starting one.", ctl: '<span class="rowflex">' + icon("resume") + "</span>" })
        ]
      }) + note("Runs are headless. A discussion is a sequence of runs with resume, not an open connection.", "about");
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
      }) + card({
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
      '<header class="view-head"><h1>Agents</h1><p>' +
      p("Coding agents that ask you out loud, and the one process that speaks for them.") +
      "</p></header>",
      banner({ text: "Planned: Phase 8, decided in ADR 0030. Nothing here is implemented." }),
      subtabs("agents", tabs),
      body,
    ].join("");
  };

  /* ── Settings: Delivery & Insert ────────────────────────────────────── */

  SCREENS.delivery = function () {
    return [
      '<header class="view-head"><h1>Delivery & Insert</h1><p>' +
      p("How a finished transcript reaches the app you are writing in.") + "</p></header>",

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
        body: '<div class="rows"><div class="row stack">' +
          '<div class="row-text"><b>Driver chain</b><span class="row-hint">' +
          p("Tried in this order. The first one that answers delivers.") + "</span></div>" +
          check([
            { state: "ok", label: "xdotool type", detail: "Active on the X11 lane.", tag: "in use" },
            { state: "ok", label: "xdotool key ctrl+v", detail: "Clipboard paste, previous clipboard restored afterwards." },
            { state: "todo", label: "wtype", detail: "Wayland only. Not in PATH." },
            { state: "todo", label: "ydotool", detail: "Wayland fallback. Daemon not running." },
            { state: "ok", label: "Recovery scratchpad", detail: "Always available. The last transcript stays retrievable." },
          ]) + "</div></div>"
      })),

      sec("Recovery", null, card({
        desc: {
          b: "Use recovery when direct insert failed, the target app ignored paste, or you want the latest transcript back without reopening diagnostics.",
          a: "For when insert failed or the app ignored the paste."
        },
        rows: [
          row({
            label: "Last transcript",
            hint: "“Kundenanfrage zum Lieferstatus, bitte freundlich beantworten.” — yesterday 17:03, clipboard only.",
            ctl: btn("Restore", null, { icon: "restore" })
          }),
          row({
            label: "Scratchpad",
            hint: "~/.local/state/wordscript/scratchpad.jsonl",
            ctl: '<span class="rowflex">' + badge("3 entries", "success") + btn("Clear", "ghost", { icon: "trash" }) + "</span>"
          }),
        ]
      })),

      sec("Limits on other platforms", "Platform limits are product information, not an error.", card({
        rows: [
          row({ label: "Wayland", hint: "The portal does not grant synthetic input to every compositor; those sessions fall back to clipboard-only.", ctl: badge("Not this session", "plan") }),
          row({ label: "Elevated Windows targets", hint: "A non-elevated WordScript cannot paste into an elevated window.", ctl: badge("Not this session", "plan") }),
          row({ label: "macOS permissions", hint: "Accessibility and Input Monitoring are required for development builds.", ctl: badge("Not this session", "plan") }),
        ]
      })),

      note("Portal check: compositor mutter · xdg-desktop-portal present · RemoteDesktop not reachable — which is why the Wayland lane stays unavailable here.", "alert"),
    ].join("");
  };

  /* ── Settings: Privacy & Data ───────────────────────────────────────── */

  SCREENS.privacy = function () {
    return [
      '<header class="view-head"><h1>Privacy & Data</h1><p>' +
      p("What stays on this machine, and how long.") + "</p></header>",

      sec("History", "How much history WordScript keeps on this machine.", card({
        rows: [
          row({ label: "Stored entries", hint: "The oldest is dropped when the cap is reached.", ctl: select("500", ["50", "100", "200", "500", "1000"]) }),
          row({ label: "Retention", hint: "Older entries are pruned automatically.", ctl: select("90 days", ["7 days", "30 days", "90 days", "1 year", "Keep all"]) }),
        ]
      })),

      sec("Where things live", null, card({
        rows: [
          row({ label: "API keys", hint: "In the OS secret store. Never written to the JSON config and never returned to this window.", ctl: badge("OS secret store", "success") }),
          row({ label: "Transcripts, profiles, settings", hint: "On this machine only. No account, no cloud sync.", ctl: badge("This machine", "success") }),
          row({ label: "Audio", hint: "Sent to the selected provider for transcription, then discarded. The local lane sends nothing.", ctl: badge("Provider, then discarded", "plan") }),
        ]
      })),

      sec("Export", null, card({
        rows: [
          row({ label: "Full export", hint: "Everything local, as one archive.", ctl: btn("Export", null, { icon: "download" }) }),
          row({ label: "Full import", hint: "Restores from a previously exported archive.", ctl: btn("Import", "ghost") }),
        ]
      })),

      sec("Danger zone", null, card({
        rows: [
          row({ label: "Clear transcription history", hint: "Deletes every stored transcript. Profiles and settings stay.", danger: true, ctl: btn("Clear", "danger") }),
          row({ label: "Reset all settings", hint: "Restores every setting to its default. History and profiles stay.", danger: true, ctl: btn("Reset", "danger") }),
        ]
      })),
    ].join("");
  };

  /* ── Settings: Account & Sync (preview) ─────────────────────────────────
     SETTINGS_REWORK_PLAN.md §7 recorded Account as "documented as pending, not
     rendered", on the grounds that there is no decided data model to lay out.
     That is overruled by review on 2026-08-02: the area exists in the shipped
     tree (AccountArea.tsx) and a user who reaches it today must still find it.
     It is therefore a labelled preview like the others.

     Its "Data export & import" card is NOT duplicated here — §4.2 moves that to
     Privacy & Data, and it stays moved. This screen keeps only what has no
     other home: the account mode and self-hosting sync. */
  SCREENS.account = function () {
    return [
      '<header class="view-head"><h1>Account & Sync</h1><p>' +
      p("WordScript works fully without an account.") + "</p></header>",

      banner({ text: "Planned: V2 or later. No data model is decided, so nothing here can be configured." }),

      stats([
        { label: "Account", value: "Local", tone: "success" },
        { label: "Sync", value: "Off" },
        { label: "Data", value: "This machine", tone: "success" },
      ]),

      sec("Account", null, lane({
        options: [
          {
            icon: "user", name: "Local only", on: true,
            desc: {
              b: "Local mode keeps everything on this device. Self-hosting will sync to your own server.",
              a: "Everything stays on this device. No sign-in, no cloud."
            }
          },
          {
            icon: "server", name: "Self-hosted", on: false, tag: "V2 or later",
            desc: "Would sync transcripts, profiles and settings to a server you run."
          },
        ]
      })),

      sec("Self-hosting sync", null, card({
        desc: {
          b: "When enabled, WordScript will sync transcripts, profiles and settings to your own server. This is a layout preview; no sync runs yet.",
          a: "Nothing here runs yet."
        },
        rows: [
          row({ label: "Enable sync", hint: "Off by default. Turning it on requires a server URL.", ctl: toggle(false, { disabled: true }) }),
          row({ label: "Server URL", hint: "The base URL of your own sync server.", ctl: field("", { placeholder: "https://sync.example.com", w: "220px" }) }),
          row({ label: "Sync status", hint: "Last sync and pending changes appear here once sync exists.", ctl: badge("Not configured", "plan") }),
        ]
      })),

      note("Exporting and importing your data does not wait for this. Full export and import live in Privacy & Data, single-profile text rules in Profiles, and transcription history in History.", "arrow"),
    ].join("");
  };

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
        body: '<div class="rowflex" style="padding:0 0 16px">' + btn("Run check", "primary", { icon: "play" }) + btn("Open pop-out", "ghost", { icon: "external" }) + "</div>"
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
        body: '<div class="rows"><div class="row stack">' +
          '<div class="diff-pane"><h4>Preview text</h4><p>' +
          t("Let's ship the settings restructure today and review the overlay tab.") + "</p></div></div></div>"
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
      '<header class="view-head"><h1>Diagnostics</h1><p>' +
      p("What the runtime is doing, in its own vocabulary.") + "</p></header>",
      subtabs("diagnostics", tabs),
      body,
    ].join("");
  };

  /* ── Settings: About & Updates ──────────────────────────────────────── */

  SCREENS.about = function () {
    return [
      '<header class="view-head"><h1>About & Updates</h1><p>' +
      p("Lightweight speech-to-text for your desktop.") + "</p></header>",

      stats([
        { label: "Version", value: "0.2.2" },
        { label: "Channel", value: "alpha" },
        { label: "Installed as", value: "Source build" },
      ]),

      /* The shipped card is careful about one thing and this keeps it: until a
         release exists, this is release-path diagnostics, and it must not read
         as though installers or in-app updates already work. */
      sec("Updates", null, card({
        rows: [
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

      sec("Not built", "Named here so it is not looked for elsewhere.", card({
        rows: [
          row({ label: "Account and sign-in", hint: "WordScript has no account model. Everything is local.", ctl: badge("V2 or later", "plan") }),
          row({ label: "Self-hosting sync", hint: "Would sync to your own server. No data model is decided.", ctl: badge("V2 or later", "plan") }),
          row({ label: "Translation mode", hint: "Not decided. Recorded as a roadmap candidate with an open gate.", ctl: badge("Candidate", "plan") }),
        ]
      })),
    ].join("");
  };

  /* ── Preview: Onboarding ────────────────────────────────────────────── */

  SCREENS.onboarding = function () {
    return [
      '<div class="steps">' +
      '<span class="step" data-state="done"><span class="n">' + "✓" + '</span>Provider</span><span class="bar"></span>' +
      '<span class="step" data-state="done"><span class="n">' + "✓" + '</span>Permissions</span><span class="bar"></span>' +
      '<span class="step" data-state="now"><span class="n">3</span>Trigger</span></div>',

      '<header class="view-head"><h1>Try your hotkey</h1><p>' +
      p("Setup proves itself before it claims success.") + "</p></header>",

      banner({ text: "Planned: Phase 6, Guided Setup." }),

      card({
        rows: [
          row({ label: "Dictate", hint: "Press this anywhere, in any app.", ctl: kbd("Ctrl+Super") }),
        ],
        body: '<div class="rows"><div class="row stack">' +
          '<div class="row-text"><b>Click here and use your hotkey to dictate</b>' +
          '<span class="row-hint">' + p("Whatever you say lands in this field. Nothing is saved.") + "</span></div>" +
          textarea("", "waiting for the hotkey…", 3) +
          '<div class="rowflex">' + dot("success") + '<span class="muted">Hotkey registered · microphone reachable · insert driver xdotool</span></div>' +
          "</div></div>"
      }),

      card({
        body: check([
          { state: "ok", label: "Provider", detail: "Groq cloud, key stored in the OS secret store." },
          { state: "ok", label: "Microphone", detail: "System default microphone reachable." },
          { state: "ok", label: "Insert", detail: "xdotool available on the active X11 lane." },
          { state: "todo", label: "First dictation", detail: "Not yet. This step ends when text lands above." },
        ])
      }),

      '<div class="rowflex">' + btn("Finish setup", "primary", { disabled: true }) + btn("Skip", "ghost") + "</div>",
    ].join("");
  };

  /* ── Preview: Live preview & commit ─────────────────────────────────── */

  SCREENS.commit = function () {
    return [
      '<header class="view-head"><h1>Live preview & commit</h1><p>' +
      p("See raw and transformed text, then decide, before anything is inserted.") + "</p></header>",

      banner({ text: "Planned: Phase 3. The overlay itself is out of scope for this rework — this shows the layout only." }),

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

      note("Commit routes through the same native insert, history and session contracts as an ordinary dictation. There is no second insert path.", "about"),
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
    return '<div class="win-foot">' + dot("success") +
      "<b>Ready</b><span class='sep'>·</span><span>Groq cloud · whisper-large-v3-turbo</span>" +
      "<span class='sep'>·</span><span>Insert at cursor</span>" +
      "<span class='right'>Every change saves as you make it</span></div>";
  }

  function render() {
    computeTotal();          // sub-tab changes move the total, so recount here
    COUNT = { b: 0, a: 0 };

    var nav = findNav(state.screen);
    var screen = SCREENS[state.screen] || SCREENS.ds;
    var html = screen();
    var layout = screen.layout || "column";

    var sidebar =
      nav.surface === "workspace" ? workspaceSidebar(state.screen) :
        nav.surface === "settings" ? settingsSidebar(state.screen) :
          nav.surface === "system" ? systemSidebar(state.screen) : "";

    var title =
      nav.surface === "settings" ? "WordScript Settings" :
        nav.surface === "workspace" ? "WordScript" :
          nav.surface === "system" ? "WordScript — design system" :
            "WordScript — " + nav.label;

    document.getElementById("win").innerHTML =
      '<div class="win-deco">' + icon("dot", "sr") +
      "<span>native window decoration — drawn by the OS · <em>" + t(title) + "</em></span></div>" +
      '<div class="win-body">' + sidebar +
      '<div class="content" id="content" data-layout="' + layout + '">' +
      '<div class="content-inner" data-layout="' + layout + '">' + html +
      "</div></div></div>" + statusStrip(nav.surface);

    document.documentElement.dataset.palette = state.palette;
    document.documentElement.dataset.density = state.density;

    var cut = COUNT.b > 0 ? Math.round((1 - COUNT.a / COUNT.b) * 100) : 0;
    var tcut = TOTAL.b > 0 ? Math.round((1 - TOTAL.a / TOTAL.b) * 100) : 0;
    document.getElementById("meter").innerHTML =
      '<span class="mrow"><span>This screen</span>' +
      '<b class="' + (state.copy === "before" ? "on" : "off") + '">' + COUNT.b + "</b>" +
      "<span>→</span>" +
      '<b class="' + (state.copy === "after" ? "on" : "off") + '">' + COUNT.a + "</b>" +
      (COUNT.b !== COUNT.a ? '<span class="cut">−' + cut + "%</span>" : '<span class="cut">—</span>') +
      "</span>" +
      '<span class="mrow"><span>19 screens</span>' +
      '<b class="' + (state.copy === "before" ? "on" : "off") + '">' + TOTAL.b + "</b>" +
      "<span>→</span>" +
      '<b class="' + (state.copy === "after" ? "on" : "off") + '">' + TOTAL.a + "</b>" +
      '<span class="cut">−' + tcut + "%</span></span>";

    document.querySelectorAll("[data-rig]").forEach(function (el) {
      var k = el.dataset.rig, v = el.dataset.val;
      el.setAttribute("aria-pressed", String(state[k] === v));
    });

    document.getElementById("pick").value = state.screen;
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

  document.addEventListener("click", function (e) {
    var rig = e.target.closest("[data-rig]");
    if (rig) { state[rig.dataset.rig] = rig.dataset.val; render(); return; }

    var go = e.target.closest("[data-go]");
    if (go) { state.screen = go.dataset.go; render(); document.getElementById("content").scrollTop = 0; return; }

    var sub = e.target.closest("[data-sub]");
    if (sub) {
      var owner = sub.closest("[data-subtabs]").dataset.subtabs;
      state.sub[owner] = sub.dataset.sub;
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

  document.getElementById("pick").addEventListener("change", function (e) {
    state.screen = e.target.value;
    render();
    document.getElementById("content").scrollTop = 0;
  });

  document.addEventListener("keydown", function (e) {
    if (e.target.matches("input, textarea, select")) return;
    var k = e.key.toLowerCase();
    if (k === "p") { state.palette = state.palette === "after" ? "before" : "after"; render(); }
    else if (k === "c") { state.copy = state.copy === "after" ? "before" : "after"; render(); }
    else if (k === "1") { state.density = "tight"; render(); }
    else if (k === "2") { state.density = "standard"; render(); }
    else if (k === "3") { state.density = "roomy"; render(); }
  });

  /** Renders every screen once, off-DOM, purely to total the prose. Sub-tabbed
      screens contribute only their open tab — the same thing the eye sees —
      so this total is the demo's own document, never a claim about the whole
      shipped surface. */
  function computeTotal() {
    var save = COUNT;
    TOTAL = { b: 0, a: 0 };
    Object.keys(SCREENS).forEach(function (id) {
      if (id === "ds") return;   // the system view documents the demo; it is
      COUNT = { b: 0, a: 0 };    // not product copy and must not dilute the cut
      try { SCREENS[id](); } catch (err) { /* a broken screen must not blank the meter */ }
      TOTAL.b += COUNT.b;
      TOTAL.a += COUNT.a;
    });
    COUNT = save;
  }

  buildPicker();
  render();
})();
