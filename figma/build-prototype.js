// PawTrack "Build the bowl" experiment: Figma prototype generator for Maze.
// Run inside a Figma plugin that can execute code (e.g. Scripter) on an empty page.
// Set PAWTRACK_TASKS = ["A85"] (etc.) before eval to build only some tasks.
// Every interactive state is its own top-level frame so Maze can track paths.
(async function () {
  var ALL = ["A85", "A130", "B85", "B130"];
  var TASKS = (typeof PAWTRACK_TASKS !== "undefined" && PAWTRACK_TASKS) ? PAWTRACK_TASKS : ALL;
  var END_TEXT = (typeof PAWTRACK_END_TEXT !== "undefined" && PAWTRACK_END_TEXT) ? PAWTRACK_END_TEXT :
    "Thanks, that's the end of this task.";

  var C = { bg: "#F9E7F1", pri: "#C6767B", ink: "#2C0C1E", tint: "#F2CEE2", white: "#FFFFFF",
    mut: "#4A2C3C", fed: "#BDE8D2", food: "#7A2E1A", foodTop: "#B5553A", water: "#9AD9EE",
    dry: "#F0B44C", other: "#9AA0A6" };
  var W = 390, H = 844;

  var CFG = {
    A85: { ver: "A", cat: "Fluffy", lo: 85, hi: 85, start: "p170", startV: 170,
      task: "Fluffy ate 1 pouch (85 g) of wet food. Set this amount on the screen and tap Next." },
    A130: { ver: "A", cat: "Mochi", lo: 125, hi: 135, start: "p85", startV: 85,
      task: "Mochi ate about 130 g of wet food, a little more than 1 pouch. Set this amount as closely as you can and tap Next. (125 g to 135 g counts.)" },
    B85: { ver: "B", cat: "Fluffy", lo: 85, hi: 85, startV: 170,
      task: "Fluffy ate 1 pouch (85 g) of wet food. Set this amount on the screen and tap Next." },
    B130: { ver: "B", cat: "Mochi", lo: 125, hi: 135, startV: 85,
      task: "Mochi ate about 130 g of wet food, a little more than 1 pouch. Set this amount as closely as you can and tap Next. (125 g to 135 g counts.)" }
  };

  // ---------- helpers ----------
  function rgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
  }
  function solid(hex, op) { return [{ type: "SOLID", color: rgb(hex), opacity: op === undefined ? 1 : op }]; }
  var SHADOW = [{ type: "DROP_SHADOW", color: Object.assign(rgb(C.ink), { a: 1 }), offset: { x: 2, y: 2 },
    radius: 0, spread: 0, visible: true, blendMode: "NORMAL" }];

  var STYLE = { 400: "Regular", 500: "Medium", 600: "Semi Bold", 700: "Bold" };
  await Promise.all([400, 500, 600, 700].map(function (w) {
    return figma.loadFontAsync({ family: "Inter", style: STYLE[w] });
  }));

  function T(chars, size, weight, color, opts) {
    opts = opts || {};
    var t = figma.createText();
    t.fontName = { family: "Inter", style: STYLE[weight || 400] };
    t.fontSize = size;
    t.characters = chars;
    t.fills = solid(color || C.ink);
    if (opts.lh) t.lineHeight = { value: opts.lh, unit: "PERCENT" };
    if (opts.ls) t.letterSpacing = { value: opts.ls, unit: "PERCENT" };
    if (opts.align) t.textAlignHorizontal = opts.align;
    if (opts.name) t.name = opts.name;
    return t;
  }
  // auto-layout frame
  function AL(dir, o) {
    o = o || {};
    var f = figma.createFrame();
    f.name = o.name || "frame";
    f.layoutMode = dir;
    f.fills = o.fill ? solid(o.fill) : [];
    f.itemSpacing = o.gap || 0;
    var p = o.pad || [0, 0, 0, 0];
    f.paddingTop = p[0]; f.paddingRight = p[1]; f.paddingBottom = p[2]; f.paddingLeft = p[3];
    f.primaryAxisSizingMode = "AUTO";
    f.counterAxisSizingMode = "AUTO";
    if (o.alignMain) f.primaryAxisAlignItems = o.alignMain;
    if (o.alignCross) f.counterAxisAlignItems = o.alignCross;
    if (o.radius) f.cornerRadius = o.radius;
    if (o.stroke) { f.strokes = solid(C.ink); f.strokeWeight = o.stroke; f.strokeAlign = "INSIDE"; }
    f.clipsContent = false;
    return f;
  }
  function add(parent, child, fillH) {
    parent.appendChild(child);
    if (fillH) child.layoutSizingHorizontal = "FILL";
    return child;
  }
  function spacer(h) {
    var s = figma.createFrame(); s.name = "space"; s.fills = []; s.resize(1, h); return s;
  }
  function icon(svg, size) {
    var n = figma.createNodeFromSvg(svg); n.resize(size, size); n.name = "icon"; return n;
  }
  var ICON_BACK = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2C0C1E" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';
  var ICON_X = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2C0C1E" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var ICON_DROP = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2C0C1E" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s6 6.3 6 10.5a6 6 0 0 1-12 0C6 9.3 12 3 12 3z"/></svg>';
  var ICON_TICK = '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2C0C1E" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  // ---------- same maths as the HTML pages ----------
  function fh(v) {
    v = +v || 0;
    var p = v <= 42 ? 8 + v * 32 / 42 : v <= 85 ? 40 + (v - 42) * 30 / 43 : v <= 170 ? 70 + (v - 85) * 25 / 85 : 95 + (v - 170) * 0.05;
    return Math.max(8, Math.min(98, p)) / 100;
  }
  var PILL_H = { 42: 0.40, 85: 0.70, 170: 0.95 };
  var MARKS = [[42, "1/2 pouch"], [85, "1 pouch"], [170, "2 pouches"]];
  function snap(v) { for (var i = 0; i < MARKS.length; i++) if (Math.abs(v - MARKS[i][0]) <= 5) return MARKS[i][0]; return v; }
  function readout(v) {
    var n = ""; for (var j = 0; j < MARKS.length; j++) if (MARKS[j][0] === v) n = " (" + MARKS[j][1] + ")";
    return v + " g" + n;
  }

  // ---------- page + components ----------
  var page = figma.currentPage;
  function findSection(name) {
    return page.children.filter(function (n) { return n.type === "SECTION" && n.name === name; })[0] || null;
  }
  var lib = findSection("PawTrack components");
  var comps = {};
  if (lib) lib.children.forEach(function (n) { if (n.type === "COMPONENT") comps[n.name] = n; });

  function comp(name, buildFn) {
    if (comps[name]) return comps[name];
    var inner = buildFn();
    var c = figma.createComponentFromNode(inner);
    c.name = name;
    if (!lib) { lib = figma.createSection(); lib.name = "PawTrack components"; lib.x = -1400; lib.y = 0; }
    lib.appendChild(c);
    var i = Object.keys(comps).length;
    c.x = 40 + (i % 3) * 430; c.y = 60 + Math.floor(i / 3) * 360;
    lib.resizeWithoutConstraints(1330, 60 + (Math.floor(i / 3) + 1) * 360 + 40);
    comps[name] = c;
    return c;
  }

  function pillFrame(label, on) {
    var p = AL("HORIZONTAL", { name: "pill", fill: on ? C.pri : C.white, pad: [0, 18, 0, 18], gap: 8, radius: 50, stroke: 2, alignCross: "CENTER" });
    p.counterAxisSizingMode = "FIXED"; p.resize(100, 44); p.primaryAxisSizingMode = "AUTO";
    p.effects = SHADOW;
    add(p, T(label, 15, 600, C.ink, { name: "label" }));
    return p;
  }
  function pill(label, on) {
    var c = comp(on ? "Pill / on" : "Pill / off", function () { return pillFrame("Label", on); });
    var i = c.createInstance();
    i.findOne(function (n) { return n.type === "TEXT"; }).characters = label;
    i.name = "pill: " + label;
    return i;
  }

  function banner(key) {
    return comp("Task banner / " + key.replace(/^[AB]/, ""), function () {
      var b = AL("VERTICAL", { name: "task", fill: C.tint, pad: [10, 16, 10, 16], gap: 2 });
      b.counterAxisSizingMode = "FIXED"; b.resize(W, 60);
      b.strokes = solid(C.ink); b.strokeAlign = "INSIDE";
      b.strokeTopWeight = 0; b.strokeLeftWeight = 0; b.strokeRightWeight = 0; b.strokeBottomWeight = 2;
      add(b, T("YOUR TASK", 11, 700, C.ink, { ls: 6 }));
      var t = add(b, T(CFG[key].task, 13, 400, C.ink, { lh: 140 }), true);
      t.textAutoResize = "HEIGHT";
      return b;
    }).createInstance();
  }

  function topbar(cat) {
    return comp("Top bar / " + cat, function () {
      var bar = AL("HORIZONTAL", { name: "top", pad: [14, 16, 8, 16], alignMain: "SPACE_BETWEEN", alignCross: "CENTER" });
      bar.primaryAxisSizingMode = "FIXED"; bar.resize(W, 66);
      function circ(svg, s) {
        var c = AL("HORIZONTAL", { name: "icon button", fill: C.white, radius: 22, stroke: 2, alignMain: "CENTER", alignCross: "CENTER" });
        c.primaryAxisSizingMode = "FIXED"; c.counterAxisSizingMode = "FIXED"; c.resize(44, 44);
        add(c, icon(svg, s)); return c;
      }
      add(bar, circ(ICON_BACK, 22));
      var t = AL("VERTICAL", { name: "title", alignCross: "CENTER" });
      add(t, T("Log a feed", 17, 700));
      add(t, T(cat + ", Hall bicycle shelter", 12.5, 400, C.mut));
      add(bar, t);
      add(bar, circ(ICON_X, 20));
      return bar;
    }).createInstance();
  }

  function progress() {
    return comp("Progress", function () {
      var w = AL("HORIZONTAL", { name: "progress", pad: [0, 16, 0, 16] });
      w.primaryAxisSizingMode = "FIXED"; w.resize(W, 6);
      var track = figma.createFrame(); track.name = "track"; track.fills = solid(C.tint); track.cornerRadius = 6; track.resize(358, 6);
      var bar = figma.createRectangle(); bar.fills = solid(C.pri); bar.resize(Math.round(358 * 0.62), 6); track.appendChild(bar);
      track.clipsContent = true;
      add(w, track, true);
      return w;
    }).createInstance();
  }

  function foodWater() {
    return comp("Food, water and time (static)", function () {
      var f = AL("VERTICAL", { name: "food-water-time" });
      f.counterAxisSizingMode = "FIXED"; f.resize(350, 10);
      add(f, spacer(14)); add(f, T("2. Food", 14, 600)); add(f, spacer(6));
      var row = AL("HORIZONTAL", { name: "food row", gap: 8 });
      add(f, row, true);
      row.layoutWrap = "WRAP"; row.counterAxisSpacing = 8;
      [["Dry", C.dry, false], ["Wet", C.food, true], ["Mixed", null, false], ["Other", C.other, false]].forEach(function (d) {
        var p = pillFrame(d[0], d[2]);
        var sw = figma.createEllipse(); sw.resize(13, 13); sw.strokes = solid(C.ink); sw.strokeWeight = 1.5; sw.strokeAlign = "INSIDE";
        if (d[1]) sw.fills = solid(d[1]);
        else sw.fills = [{ type: "GRADIENT_LINEAR", gradientTransform: [[1, 0, 0], [0, 1, 0]],
          gradientStops: [{ position: 0.5, color: Object.assign(rgb(C.dry), { a: 1 }) }, { position: 0.5, color: Object.assign(rgb(C.food), { a: 1 }) }] }];
        p.insertChild(0, sw);
        add(row, p);
      });
      add(f, spacer(14)); add(f, T("3. Water", 14, 600)); add(f, spacer(6));
      var wp = pillFrame("Water provided", false);
      wp.insertChild(0, icon(ICON_DROP, 18));
      add(f, wp);
      add(f, spacer(14));
      add(f, T("Time: Today, 7:42pm (filled in for you)", 13, 400, C.mut));
      return f;
    }).createInstance();
  }

  function nextBtn() {
    return comp("Next button", function () {
      var n = AL("HORIZONTAL", { name: "Next", fill: C.pri, radius: 50, stroke: 2, alignMain: "CENTER", alignCross: "CENTER" });
      n.primaryAxisSizingMode = "FIXED"; n.counterAxisSizingMode = "FIXED"; n.resize(350, 54);
      add(n, T("Next", 16, 600));
      return n;
    }).createInstance();
  }

  function bowlBox(pct) {
    var box = AL("HORIZONTAL", { name: "bowl box", fill: C.tint, radius: 16, gap: 14, pad: [0, 0, 26, 0], alignMain: "CENTER", alignCross: "MAX" });
    box.counterAxisSizingMode = "FIXED"; box.resize(350, 132);
    box.strokes = solid(C.ink); box.strokeAlign = "INSIDE";
    box.strokeTopWeight = 2; box.strokeLeftWeight = 2; box.strokeRightWeight = 4; box.strokeBottomWeight = 4;
    var bowl = figma.createFrame(); bowl.name = "bowl"; bowl.resize(150, 76); bowl.fills = solid(C.white);
    bowl.bottomLeftRadius = 76; bowl.bottomRightRadius = 76; bowl.clipsContent = true;
    var h = Math.round(70 * pct);
    var fill = figma.createRectangle(); fill.name = "food"; fill.fills = solid(C.food); fill.resize(150, Math.max(h, 1)); fill.x = 0; fill.y = 76 - 3 - h;
    var top = figma.createRectangle(); top.name = "food top"; top.fills = solid(C.foodTop); top.resize(150, Math.min(5, Math.max(h, 1))); top.x = 0; top.y = 76 - 3 - h;
    bowl.appendChild(fill); bowl.appendChild(top);
    var rim = figma.createFrame(); rim.name = "bowl outline"; rim.resize(150, 76); rim.fills = [];
    rim.bottomLeftRadius = 76; rim.bottomRightRadius = 76; rim.strokes = solid(C.ink); rim.strokeWeight = 3; rim.strokeAlign = "INSIDE";
    bowl.appendChild(rim);
    add(box, bowl);
    var dish = figma.createFrame(); dish.name = "water dish"; dish.resize(70, 32); dish.fills = solid(C.water);
    dish.bottomLeftRadius = 36; dish.bottomRightRadius = 36; dish.strokes = solid(C.ink); dish.strokeWeight = 3; dish.strokeAlign = "INSIDE";
    add(box, dish);
    return box;
  }

  // ---------- screen skeleton ----------
  // returns {root, amount (slot for amount controls), next}
  function screen(key, name, pct) {
    var cfg = CFG[key];
    var root = AL("VERTICAL", { name: name, fill: C.bg, pad: [0, 0, 22, 0] });
    root.counterAxisSizingMode = "FIXED"; root.resize(W, 100);
    root.clipsContent = true;
    add(root, banner(key), true);
    add(root, topbar(cfg.cat), true);
    add(root, progress(), true);
    var main = AL("VERTICAL", { name: "main", pad: [16, 20, 0, 20] });
    add(root, main, true);
    add(main, T("Build the bowl", 28, 700, C.ink, { lh: 115 }));
    add(main, spacer(8));
    var chip = AL("HORIZONTAL", { name: "chip", fill: C.tint, radius: 50, stroke: 1.5, pad: [3, 12, 3, 12] });
    add(chip, T("Same as your last feed. Change anything you like.", 12.5, 500));
    add(main, chip);
    add(main, spacer(12));
    add(main, bowlBox(pct), true);
    add(main, spacer(14));
    add(main, T("1. Amount", 14, 600));
    add(main, spacer(6));
    var amount = AL("VERTICAL", { name: "amount" });
    add(main, amount, true);
    add(main, foodWater(), true);
    var sp = add(main, spacer(12), false);
    var nx = add(main, nextBtn(), true);
    return { root: root, main: main, amount: amount, spacer: sp, next: nx };
  }
  function finishHeight(s) {
    var h = s.root.height;
    s.root.primaryAxisSizingMode = "FIXED";
    s.root.resize(W, Math.max(H, h));
    s.main.layoutSizingVertical = "FILL";
    s.spacer.layoutSizingVertical = "FILL";
  }

  function endScreen(key, name) {
    var root = figma.createFrame(); root.name = name; root.fills = solid(C.bg);
    root.layoutMode = "VERTICAL"; root.primaryAxisAlignItems = "CENTER"; root.counterAxisAlignItems = "CENTER";
    root.primaryAxisSizingMode = "FIXED"; root.counterAxisSizingMode = "FIXED"; root.resize(W, H);
    root.paddingLeft = 24; root.paddingRight = 24; root.itemSpacing = 12;
    var tick = AL("HORIZONTAL", { name: "tick", fill: C.fed, radius: 36, stroke: 3, alignMain: "CENTER", alignCross: "CENTER" });
    tick.primaryAxisSizingMode = "FIXED"; tick.counterAxisSizingMode = "FIXED"; tick.resize(72, 72);
    add(tick, icon(ICON_TICK, 36));
    add(root, tick);
    add(root, T("Amount logged", 26, 700, C.ink, { align: "CENTER" }));
    var p = add(root, T(END_TEXT, 16, 400, C.mut, { lh: 150, align: "CENTER" }), true);
    p.textAutoResize = "HEIGHT";
    return root;
  }

  // ---------- version A ----------
  function customStates() {
    var out = [""];
    for (var v = 1; v <= 250; v++) out.push(String(v));
    return out;
  }
  function pressDigit(s, d) {
    if (s === "" && d === "0") return null;
    var ns = s + d;
    if (ns.length > 3 || +ns > 250) return null;
    return ns;
  }

  async function buildA(key) {
    var cfg = CFG[key];
    var frames = {}, order = [];
    function reg(id, node) { frames[id] = node; order.push(id); }
    var pills = [[42, "1/2 pouch (42 g)"], [85, "1 pouch (85 g)"], [170, "2 pouches (170 g)"]];
    var hot = {}; // id -> list of [node, destId, preserveScroll]

    function amountPills(parent, sel) {
      var row = AL("HORIZONTAL", { name: "amount pills", gap: 8 });
      add(parent, row, true);
      row.layoutWrap = "WRAP"; row.counterAxisSpacing = 8;
      var nodes = {};
      pills.forEach(function (p) { nodes["p" + p[0]] = add(row, pill(p[1], sel === "p" + p[0])); });
      nodes.custom = add(row, pill("Custom", sel === "custom"));
      return nodes;
    }

    // pill states
    pills.forEach(function (p) {
      var id = "p" + p[0];
      var s = screen(key, key + " / pill " + p[0] + " g" + (id === cfg.start ? " (start)" : ""), PILL_H[p[0]]);
      var n = amountPills(s.amount, id);
      finishHeight(s);
      reg(id, s.root);
      hot[id] = [[n.p42, "p42"], [n.p85, "p85"], [n.p170, "p170"], [n.custom, "c:"], [s.next, p[0] >= cfg.lo && p[0] <= cfg.hi ? "ok" : "bad"]];
    });

    // custom states with on-screen keypad
    customStates().forEach(function (str) {
      var id = "c:" + str;
      var s = screen(key, key + " / custom " + (str === "" ? "(empty)" : str + " g"), fh(str));
      var n = amountPills(s.amount, "custom");
      add(s.amount, spacer(10));
      var row = AL("HORIZONTAL", { name: "custom input", gap: 8, alignCross: "CENTER" });
      add(s.amount, row);
      add(row, T("Amount in grams", 13.5, 600));
      var inp = AL("HORIZONTAL", { name: "grams input", fill: C.white, radius: 12, stroke: 2, pad: [0, 12, 0, 12], gap: 1, alignCross: "CENTER" });
      inp.primaryAxisSizingMode = "FIXED"; inp.counterAxisSizingMode = "FIXED"; inp.resize(96, 44);
      if (str === "") {
        var caret0 = figma.createRectangle(); caret0.resize(2, 20); caret0.fills = solid(C.ink); add(inp, caret0);
        add(inp, T("e.g. 120", 16, 400, C.mut));
      } else {
        add(inp, T(str, 16, 600));
        var caret = figma.createRectangle(); caret.resize(2, 20); caret.fills = solid(C.ink); add(inp, caret);
      }
      add(row, inp);
      add(row, T("g", 16, 600));
      add(s.amount, spacer(10));
      var pad = AL("VERTICAL", { name: "keypad", gap: 8 });
      add(s.amount, pad, true);
      var keys = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["", "0", "del"]];
      var links = [];
      keys.forEach(function (r) {
        var kr = AL("HORIZONTAL", { name: "keypad row", gap: 8 });
        add(pad, kr, true);
        r.forEach(function (k) {
          var key_ = AL("HORIZONTAL", { name: k === "" ? "blank" : "key " + k, fill: k === "" ? null : C.white, radius: 12,
            stroke: k === "" ? 0 : 2, alignMain: "CENTER", alignCross: "CENTER" });
          if (k === "") key_.strokes = [];
          key_.counterAxisSizingMode = "FIXED"; key_.resize(100, 44);
          if (k !== "") key_.effects = SHADOW;
          if (k === "del") add(key_, T("⌫", 20, 600)); else if (k !== "") add(key_, T(k, 20, 600));
          add(kr, key_, true);
          if (k === "del") { if (str !== "") links.push([key_, "c:" + str.slice(0, -1)]); }
          else if (k !== "") { var ns = pressDigit(str, k); if (ns !== null) links.push([key_, "c:" + ns]); }
        });
      });
      finishHeight(s);
      reg(id, s.root);
      var g = str === "" ? NaN : +str;
      hot[id] = [[n.p42, "p42"], [n.p85, "p85"], [n.p170, "p170"]].concat(links)
        .concat([[s.next, isFinite(g) && g >= cfg.lo && g <= cfg.hi ? "ok" : "bad"]]);
    });
    return { frames: frames, order: order, hot: hot, start: cfg.start };
  }

  // ---------- version B ----------
  function sliderStates() {
    var set = {};
    for (var g = 0; g <= 250; g += 5) set[snap(g)] = true;
    return Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
  }
  async function buildB(key) {
    var cfg = CFG[key];
    var frames = {}, order = [], hot = {};
    var states = sliderStates();
    if (states.indexOf(cfg.startV) < 0) throw new Error("start value not reachable");
    function xOf(v) { return 15 + v / 250 * 300; }
    states.forEach(function (v) {
      var id = "v" + v;
      var s = screen(key, key + " / slider " + v + " g" + (v === cfg.startV ? " (start)" : ""), fh(v));
      var sl = AL("VERTICAL", { name: "slider", pad: [4, 10, 0, 10] });
      add(s.amount, sl, true);
      add(sl, T(readout(v), 15, 700));
      add(sl, spacer(6));
      var area = figma.createFrame(); area.name = "slider track"; area.fills = []; area.resize(330, 44); area.clipsContent = false;
      add(sl, area);
      var track = figma.createRectangle(); track.name = "track"; track.resize(330, 10); track.y = 17; track.cornerRadius = 10;
      track.fills = solid(C.white); track.strokes = solid(C.ink); track.strokeWeight = 2; track.strokeAlign = "INSIDE";
      area.appendChild(track);
      var th = figma.createEllipse(); th.name = "thumb"; th.resize(30, 30); th.x = xOf(v) - 15; th.y = 7;
      th.fills = solid(C.pri); th.strokes = solid(C.ink); th.strokeWeight = 2; th.strokeAlign = "INSIDE"; th.effects = SHADOW;
      area.appendChild(th);
      var links = [];
      for (var g = 0; g <= 250; g += 5) {
        var x0 = g === 0 ? 0 : xOf(g) - 3, x1 = g === 250 ? 330 : xOf(g) + 3;
        var hs = figma.createRectangle(); hs.name = "tap " + g + " g"; hs.resize(x1 - x0, 44); hs.x = x0; hs.y = 0;
        hs.fills = solid(C.white, 0);
        area.appendChild(hs);
        var target = snap(g);
        if (target !== v) links.push([hs, "v" + target]);
      }
      var marks = figma.createFrame(); marks.name = "marks"; marks.fills = []; marks.resize(330, 38); marks.clipsContent = false;
      add(sl, marks);
      MARKS.forEach(function (m) {
        var mk = AL("VERTICAL", { name: "mark " + m[0], gap: 2, alignCross: "CENTER" });
        var tick = figma.createRectangle(); tick.resize(2, 9); tick.fills = solid(C.ink); add(mk, tick);
        add(mk, T(m[1], 11, 600)); add(mk, T(m[0] + " g", 11, 400, C.mut));
        marks.appendChild(mk);
        mk.x = Math.round(xOf(m[0]) - mk.width / 2); mk.y = 0;
      });
      finishHeight(s);
      frames[id] = s.root; order.push(id);
      hot[id] = links.concat([[s.next, v >= cfg.lo && v <= cfg.hi ? "ok" : "bad"]]);
    });
    return { frames: frames, order: order, hot: hot, start: "v" + cfg.startV };
  }

  // ---------- assemble ----------
  var COLS = 16, GAP = 60;
  var built = [];
  for (var ti = 0; ti < TASKS.length; ti++) {
    var key = TASKS[ti];
    var secName = "Task " + key + " (version " + CFG[key].ver + ", " + key.slice(1) + " g)";
    var old = findSection(secName);
    if (old) old.remove();
    var r = CFG[key].ver === "A" ? await buildA(key) : await buildB(key);
    r.frames.ok = endScreen(key, key + " / Amount logged (SUCCESS)");
    r.frames.bad = endScreen(key, key + " / Amount logged (wrong amount)");
    // start first, then the rest, end screens last
    var ids = [r.start].concat(r.order.filter(function (i) { return i !== r.start; })).concat(["ok", "bad"]);
    var sec = figma.createSection(); sec.name = secName;
    var x = 40, y = 80, rowH = 0, col = 0, maxW = 0;
    ids.forEach(function (id) {
      var f = r.frames[id];
      sec.appendChild(f);
      f.x = x; f.y = y; rowH = Math.max(rowH, f.height);
      x += W + GAP; col++; maxW = Math.max(maxW, x);
      if (col === COLS) { col = 0; x = 40; y += rowH + 120; rowH = 0; }
    });
    var secH = y + rowH + 80;
    sec.resizeWithoutConstraints(maxW + 40, secH);
    var prevBottom = 0;
    page.children.forEach(function (n) { if (n.type === "SECTION" && n !== sec && n.name.indexOf("Task ") === 0) prevBottom = Math.max(prevBottom, n.y + n.height); });
    sec.x = 0; sec.y = prevBottom ? prevBottom + 200 : 0;

    // prototype links
    var linkCount = 0;
    var hotIds = Object.keys(r.hot);
    for (var hi = 0; hi < hotIds.length; hi++) {
      var list = r.hot[hotIds[hi]];
      for (var li = 0; li < list.length; li++) {
        var dest = r.frames[list[li][1]];
        if (!dest) throw new Error("missing destination " + list[li][1] + " from " + hotIds[hi]);
        if (list[li][1] === hotIds[hi]) continue; // tapping the current choice does nothing
        var inTask = list[li][1] !== "ok" && list[li][1] !== "bad";
        await list[li][0].setReactionsAsync([{ trigger: { type: "ON_CLICK" }, actions: [{ type: "NODE", destinationId: dest.id,
          navigation: "NAVIGATE", transition: null, preserveScrollPosition: inTask }] }]);
        linkCount++;
      }
    }
    var flows = page.flowStartingPoints.filter(function (f) { return f.name.indexOf(key + " ") !== 0; });
    flows.push({ nodeId: r.frames[r.start].id, name: key + " start" });
    page.flowStartingPoints = flows;
    built.push(key + ": " + ids.length + " screens, " + linkCount + " links, start = " + r.frames[r.start].name);
  }
  var msg = "PawTrack prototype built. " + built.join(" | ");
  try { figma.notify(msg, { timeout: 10000 }); } catch (e) {}
  try { console.log(msg); } catch (e) {}
  return msg;
})();
