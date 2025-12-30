
/* Battle for Britannia (mobile-first) — v4
   Notes:
   - This build prioritizes playability: Setup -> Game, map pan/zoom, visible armies, region cards.
   - The exact board graph can be updated via Map Editor (paste JSON).
*/
(() => {
  const VERSION = "bfb-v4-2025-12-30-1";
  const $ = (sel) => document.querySelector(sel);

  // ---------- Data ----------
  const KINGDOMS = [
    { id:"wessex", name:"Wessex", color:"#ff6a6a", capital:"Winchester", core:["Wessex","Sussex","Kent","Essex"] },
    { id:"mercia", name:"Mercia", color:"#6aa7ff", capital:"Tamworth", core:["Mercia","Hwicce","Cheshire","Lindsey"] },
    { id:"northumbria", name:"Northumbria", color:"#7ee787", capital:"Bernicia", core:["Northumbria","Deira","Tynedale","Cumbria"] },
    { id:"wales", name:"Wales", color:"#ffd36a", capital:"Gwynedd", core:["Gwynedd","Powys","Dyfed","Gwent"] },
    { id:"picts", name:"Picts", color:"#c58cff", capital:"Scone", core:["Picts","Fortriu","Strathmore","Lothian"] },
  ];

  // Terrain types used for defence display only in this build
  const TERRAIN = {
    plains: { name:"Plains", def:0 },
    hills: { name:"Hills", def:1 },
    mountains: { name:"Mountains", def:1 },
    coast: { name:"Coast", def:0 },
  };

  // Default map (editable). Coordinates match map_bg.png base width 1100.
  // IMPORTANT: This is a starter layout. Use Map Editor to match your physical board exactly.
  const DEFAULT_MAP = {
    width: 1100,
    height: 800,
    nodes: [
      // South / Wessex
      { id:"Winchester", label:"Winchester", x:250, y:650, kingdom:"wessex", capital:true, terrain:"plains" },
      { id:"Kent", label:"Kent", x:350, y:690, kingdom:"wessex", capital:false, terrain:"coast" },
      { id:"Sussex", label:"Sussex", x:300, y:720, kingdom:"wessex", capital:false, terrain:"coast" },
      { id:"Essex", label:"Essex", x:420, y:640, kingdom:"wessex", capital:false, terrain:"plains" },

      // East / Anglia
      { id:"East Anglia", label:"East Anglia", x:520, y:600, kingdom:null, capital:false, terrain:"plains" },

      // Mercia core
      { id:"Tamworth", label:"Tamworth", x:390, y:540, kingdom:"mercia", capital:true, terrain:"plains" },
      { id:"Hwicce", label:"Hwicce", x:300, y:560, kingdom:"mercia", capital:false, terrain:"hills" },
      { id:"Cheshire", label:"Cheshire", x:250, y:500, kingdom:"mercia", capital:false, terrain:"plains" },
      { id:"Lindsey", label:"Lindsey", x:460, y:500, kingdom:"mercia", capital:false, terrain:"plains" },

      // North
      { id:"Tynedale", label:"Tynedale", x:420, y:360, kingdom:"northumbria", capital:false, terrain:"hills" },
      { id:"Deira", label:"Deira", x:470, y:410, kingdom:"northumbria", capital:false, terrain:"plains" },
      { id:"Bernicia", label:"Bernicia", x:500, y:330, kingdom:"northumbria", capital:true, terrain:"hills" },
      { id:"Cumbria", label:"Cumbria", x:330, y:360, kingdom:"northumbria", capital:false, terrain:"mountains" },

      // Wales
      { id:"Gwynedd", label:"Gwynedd", x:180, y:460, kingdom:"wales", capital:true, terrain:"mountains" },
      { id:"Powys", label:"Powys", x:220, y:520, kingdom:"wales", capital:false, terrain:"hills" },
      { id:"Dyfed", label:"Dyfed", x:120, y:560, kingdom:"wales", capital:false, terrain:"coast" },
      { id:"Gwent", label:"Gwent", x:180, y:600, kingdom:"wales", capital:false, terrain:"hills" },

      // Scotland / Picts
      { id:"Lothian", label:"Lothian", x:560, y:260, kingdom:"picts", capital:false, terrain:"hills" },
      { id:"Fortriu", label:"Fortriu", x:520, y:170, kingdom:"picts", capital:false, terrain:"mountains" },
      { id:"Strathmore", label:"Strathmore", x:450, y:190, kingdom:"picts", capital:false, terrain:"mountains" },
      { id:"Scone", label:"Scone", x:490, y:220, kingdom:"picts", capital:true, terrain:"hills" },

      // Isle of Man (transit only)
      { id:"Isle of Man", label:"Isle of Man", x:270, y:410, kingdom:null, capital:false, terrain:"coast", transitOnly:true },
    ],
    edges: [
      // Wessex cluster
      { a:"Winchester", b:"Sussex", cost:1 },
      { a:"Winchester", b:"Essex", cost:1 },
      { a:"Sussex", b:"Kent", cost:1 },
      { a:"Kent", b:"Essex", cost:1 },
      { a:"Essex", b:"East Anglia", cost:1 },

      // Mercia links
      { a:"Tamworth", b:"Hwicce", cost:1 },
      { a:"Tamworth", b:"Lindsey", cost:1 },
      { a:"Tamworth", b:"Essex", cost:1 },
      { a:"Hwicce", b:"Gwent", cost:1 },
      { a:"Hwicce", b:"Cheshire", cost:1 },
      { a:"Cheshire", b:"Powys", cost:2 },

      // Northumbria links
      { a:"Lindsey", b:"Deira", cost:1 },
      { a:"Deira", b:"Tynedale", cost:2 },
      { a:"Tynedale", b:"Bernicia", cost:1 },
      { a:"Tynedale", b:"Cumbria", cost:2 },

      // Wales links
      { a:"Powys", b:"Gwynedd", cost:2 },
      { a:"Powys", b:"Gwent", cost:1 },
      { a:"Gwent", b:"Dyfed", cost:2 },

      // Picts links
      { a:"Bernicia", b:"Lothian", cost:2 },
      { a:"Lothian", b:"Scone", cost:2 },
      { a:"Scone", b:"Strathmore", cost:2 },
      { a:"Scone", b:"Fortriu", cost:2 },
      { a:"Strathmore", b:"Fortriu", cost:2 },

      // Coastal bypass examples (starter)
      { a:"East Anglia", b:"Tynedale", cost:2 }, // coastal bypass mentioned by you
      { a:"Wales Sea", b:"Isle of Man", cost:2 }, // placeholder not used
      { a:"Gwynedd", b:"Isle of Man", cost:2 },
      { a:"Isle of Man", b:"Cumbria", cost:2 },
    ]
  };

  // Buildings
  const BUILDINGS = {
    farm: { id:"farm", name:"Farm", cost:1, icon:"🌾", produces:{ food:1 } },
    market: { id:"market", name:"Market", cost:2, icon:"💰", produces:{ silver:1 } },
    hall: { id:"hall", name:"Hall", cost:3, icon:"👑", produces:{ infl:1 } },
    castle: { id:"castle", name:"Castle", cost:3, icon:"🏰", produces:{}, defence:2, indestructible:true },
  };

  const EVENTS = [
    { id:"good_harvest", name:"Good Harvest", weight:10, text:"+1 Food", apply:(g,p)=>{p.food+=1; log(g, `${p.name} gains +1 🍞 (Good Harvest).`, "event");}},
    { id:"poor_harvest", name:"Poor Harvest", weight:7, text:"-1 Food", apply:(g,p)=>{p.food=Math.max(0,p.food-1); log(g, `${p.name} loses 1 🍞 (Poor Harvest).`, "event");}},
    { id:"trade_boom", name:"Trade Boom", weight:8, text:"+1 Silver", apply:(g,p)=>{p.silver+=1; log(g, `${p.name} gains +1 💰 (Trade Boom).`, "event");}},
    { id:"bandits", name:"Banditry", weight:6, text:"-1 Silver", apply:(g,p)=>{p.silver=Math.max(0,p.silver-1); log(g, `${p.name} loses 1 💰 (Banditry).`, "event");}},
    { id:"royal_favour", name:"Royal Favour", weight:4, text:"+1 Influence", apply:(g,p)=>{p.infl+=1; log(g, `${p.name} gains +1 👑 (Royal Favour).`, "event");}},
    { id:"plague", name:"Plague", weight:2, text:"Disband 1 active unit (if any)", apply:(g,p)=>{
        const unit = firstActiveUnit(g, p.id);
        if(unit){ removeUnit(g, unit.id); log(g, `${p.name} disbands 1 unit due to Plague.`, "event"); }
        else { log(g, `${p.name} is spared Plague (no active units).`, "event");}
      }},
  ];

  // ---------- State ----------
  let mapData = null;

  const makeNewGame = () => ({
    version: VERSION,
    round: 1,
    turnIndex: 0,
    ap: 2,
    phase: "setup", // setup | playing | gameover
    players: [], // {id, name, kingdomId, color, isHuman, food, silver, infl, alive}
    regions: {}, // id -> {id,label, ownerPlayerId|null, terrain, capital:boolean, transitOnly:boolean, leviesStored, levyCap, buildings:[]}
    units: {},   // unitId -> {id, playerId, regionId, strength}
    ui: { selectedRegionId:null, selectedUnitId:null, pendingMove:false, pendingAttack:false, lastSummary:[] },
    rngSeed: Math.floor(Math.random()*1e9),
  });

  let G = makeNewGame();

  // ---------- DOM ----------
  const screenSetup = $("#screen-setup");
  const screenGame = $("#screen-game");

  const selTotalPlayers = $("#sel-total-players");
  const selHumanKingdom = $("#sel-human-kingdom");
  const inpHumanName = $("#inp-human-name");

  const btnStart = $("#btn-start");
  const btnSave = $("#btn-save");
  const btnLoad = $("#btn-load");
  const btnLoadSetup = $("#btn-load-setup");
  const btnHelp = $("#btn-help");
  const btnHelpSetup = $("#btn-help-setup");

  const btnResetCache = $("#btn-reset-cache");

  const hudRound = $("#hud-round");
  const hudTurn = $("#hud-turn");
  const hudAp = $("#hud-ap");
  const hudFood = $("#hud-food");
  const hudSilver = $("#hud-silver");
  const hudInfl = $("#hud-infl");

  const mapViewport = $("#mapViewport");
  const mapStage = $("#mapStage");
  const mapSvg = $("#mapSvg");
  const btnZoomIn = $("#btn-zoom-in");
  const btnZoomOut = $("#btn-zoom-out");
  const btnZoomFit = $("#btn-zoom-fit");
  const btnMapEditor = $("#btn-map-editor");

  const panelRegion = $("#panel-region");
  const regionName = $("#region-name");
  const regionSub = $("#region-sub");
  const regionOwner = $("#region-owner");
  const regionTerrain = $("#region-terrain");
  const regionLevies = $("#region-levies");
  const buildingSlots = $("#building-slots");

  const btnCloseRegion = $("#btn-close-region");
  const btnBuild = $("#btn-build");
  const btnRecruit = $("#btn-recruit");
  const btnCallup = $("#btn-callup");
  const btnPillage = $("#btn-pillage");
  const btnMove = $("#btn-move");
  const btnAttack = $("#btn-attack");
  const btnDisband = $("#btn-disband");
  const btnEndturn = $("#btn-endturn");
  const contextHint = $("#context-hint");

  const summaryBody = $("#summary-body");
  const btnClearSummary = $("#btn-clear-summary");

  const modal = $("#modal");
  const modalTitle = $("#modal-title");
  const modalBody = $("#modal-body");
  const modalActions = $("#modal-actions");
  const toast = $("#toast");

  // ---------- Setup UI ----------
  function initSetupUI(){
    selTotalPlayers.innerHTML = "";
    [2,3,4,5].forEach(n => {
      const opt = document.createElement("option");
      opt.value = String(n);
      opt.textContent = String(n);
      selTotalPlayers.appendChild(opt);
    });
    selTotalPlayers.value = "3";

    selHumanKingdom.innerHTML = "";
    KINGDOMS.forEach(k => {
      const opt = document.createElement("option");
      opt.value = k.id;
      opt.textContent = k.name;
      selHumanKingdom.appendChild(opt);
    });
    selHumanKingdom.value = "wessex";
    inpHumanName.value = localStorage.getItem("bfb_human_name") || "Oli";
  }

  // ---------- Map (pan/zoom + render) ----------
  const camera = { x:0, y:0, scale:1 };
  let pointers = new Map();
  let lastPan = null;
  let lastPinch = null;

  function applyCamera(){
    mapStage.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`;
  }

  function fitMap(){
    const rect = mapViewport.getBoundingClientRect();
    const W = mapData.width;
    const H = mapData.height;
    // base image is 1100 wide; height may differ, but svg uses same
    const scale = Math.min(rect.width / W, rect.height / H);
    camera.scale = clamp(scale, 0.35, 2.4);
    camera.x = (rect.width - W*camera.scale) / 2;
    camera.y = (rect.height - H*camera.scale) / 2;
    applyCamera();
  }

  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

  function viewportToWorld(px,py){
    // inverse transform
    const x = (px - camera.x) / camera.scale;
    const y = (py - camera.y) / camera.scale;
    return {x,y};
  }

  function handlePointerDown(e){
    mapViewport.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if(pointers.size===1){
      lastPan = {x:e.clientX, y:e.clientY, camX:camera.x, camY:camera.y};
    } else if(pointers.size===2){
      const pts = Array.from(pointers.values());
      const d = dist(pts[0], pts[1]);
      lastPinch = { dist:d, scale:camera.scale };
      lastPan = null;
    }
  }
  function handlePointerMove(e){
    if(!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if(pointers.size===1 && lastPan){
      const dx = e.clientX - lastPan.x;
      const dy = e.clientY - lastPan.y;
      camera.x = lastPan.camX + dx;
      camera.y = lastPan.camY + dy;
      applyCamera();
    } else if(pointers.size===2 && lastPinch){
      const pts = Array.from(pointers.values());
      const d = dist(pts[0], pts[1]);
      const factor = d / Math.max(20, lastPinch.dist);
      const newScale = clamp(lastPinch.scale * factor, 0.35, 2.8);

      // zoom about midpoint
      const mid = {x:(pts[0].x+pts[1].x)/2, y:(pts[0].y+pts[1].y)/2};
      const r = mapViewport.getBoundingClientRect();
      const local = {x: mid.x - r.left, y: mid.y - r.top};
      const before = viewportToWorld(local.x, local.y);
      camera.scale = newScale;
      const after = viewportToWorld(local.x, local.y);
      camera.x += (after.x - before.x) * camera.scale;
      camera.y += (after.y - before.y) * camera.scale;

      applyCamera();
    }
  }
  function handlePointerUp(e){
    pointers.delete(e.pointerId);
    if(pointers.size===0){
      lastPan = null; lastPinch = null;
    }
    if(pointers.size===1){
      const remaining = Array.from(pointers.values())[0];
      lastPan = {x:remaining.x, y:remaining.y, camX:camera.x, camY:camera.y};
      lastPinch = null;
    }
  }
  function dist(a,b){
    const dx=a.x-b.x, dy=a.y-b.y;
    return Math.hypot(dx,dy);
  }

  function renderMap(){
    // Clear SVG
    while(mapSvg.firstChild) mapSvg.removeChild(mapSvg.firstChild);

    // Edges
    mapData.edges.forEach(ed => {
      const a = mapData.nodesById[ed.a];
      const b = mapData.nodesById[ed.b];
      if(!a || !b) return;
      // Skip placeholder
      if(ed.a==="Wales Sea" || ed.b==="Wales Sea") return;

      const line = svgEl("line", {
        x1:a.x, y1:a.y, x2:b.x, y2:b.y,
        stroke:"rgba(255,255,255,.18)",
        "stroke-width":"2"
      });
      mapSvg.appendChild(line);

      // cost label
      const cx=(a.x+b.x)/2, cy=(a.y+b.y)/2;
      const lbl = svgEl("text", {
        x:cx, y:cy-6,
        fill:"rgba(255,255,255,.78)",
        "font-size":"12",
        "text-anchor":"middle",
        "paint-order":"stroke",
        stroke:"rgba(0,0,0,.6)",
        "stroke-width":"3"
      });
      lbl.textContent = String(ed.cost);
      mapSvg.appendChild(lbl);
    });

    // Regions (tap targets) + labels + buildings icon + armies tokens
    Object.values(G.regions).forEach(r => {
      const node = mapData.nodesById[r.id];
      if(!node) return;
      if(r.removed) return;

      const owner = r.ownerPlayerId ? G.players.find(p=>p.id===r.ownerPlayerId) : null;
      const fill = owner ? owner.color : "rgba(255,255,255,.04)";
      const stroke = r.contested ? "rgba(255,211,106,.95)" : "rgba(255,255,255,.28)";
      const strokeW = r.capital ? 5 : 3;

      const circle = svgEl("circle", {
        cx:node.x, cy:node.y, r: r.capital ? 22 : 18,
        fill, stroke, "stroke-width":strokeW,
        opacity: 0.95,
      });
      circle.style.pointerEvents = "auto";
      circle.addEventListener("click", (ev)=> { ev.stopPropagation(); selectRegion(r.id); });
      mapSvg.appendChild(circle);

      // capital icon
      if(r.capital){
        const star = svgEl("text", {
          x:node.x, y:node.y-26,
          fill:"rgba(255,255,255,.92)",
          "font-size":"18",
          "text-anchor":"middle",
          "paint-order":"stroke",
          stroke:"rgba(0,0,0,.6)",
          "stroke-width":"4"
        });
        star.textContent = "★";
        mapSvg.appendChild(star);
      }

      // transit-only label
      if(r.transitOnly){
        const t = svgEl("text", {
          x:node.x, y:node.y+34,
          fill:"rgba(255,255,255,.65)",
          "font-size":"11",
          "text-anchor":"middle",
          "paint-order":"stroke",
          stroke:"rgba(0,0,0,.65)",
          "stroke-width":"4"
        });
        t.textContent = "Transit only";
        mapSvg.appendChild(t);
      }

      // label
      const label = svgEl("text", {
        x:node.x, y:node.y+6,
        fill:"rgba(255,255,255,.92)",
        "font-size":"13",
        "text-anchor":"middle",
        "paint-order":"stroke",
        stroke:"rgba(0,0,0,.75)",
        "stroke-width":"5"
      });
      label.textContent = r.label;
      label.style.pointerEvents = "none";
      mapSvg.appendChild(label);

      // buildings (icons)
      if(r.buildings.length){
        const b = svgEl("text", {
          x:node.x, y:node.y+26,
          fill:"rgba(255,255,255,.9)",
          "font-size":"14",
          "text-anchor":"middle",
          "paint-order":"stroke",
          stroke:"rgba(0,0,0,.65)",
          "stroke-width":"4"
        });
        b.textContent = r.buildings.map(id => BUILDINGS[id]?.icon || "•").join(" ");
        mapSvg.appendChild(b);
      }

      // contested swords
      if(r.contested){
        const s = svgEl("text", {
          x:node.x+30, y:node.y-18,
          fill:"rgba(255,211,106,.95)",
          "font-size":"16",
          "text-anchor":"middle",
          "paint-order":"stroke",
          stroke:"rgba(0,0,0,.65)",
          "stroke-width":"4"
        });
        s.textContent = "⚔";
        mapSvg.appendChild(s);
      }
    });

    // Units
    Object.values(G.units).forEach(u => {
      const r = G.regions[u.regionId];
      if(!r || r.removed) return;
      const node = mapData.nodesById[u.regionId];
      if(!node) return;
      const p = G.players.find(pp=>pp.id===u.playerId);
      const isSelected = (G.ui.selectedUnitId === u.id);

      const token = svgEl("circle",{
        cx:node.x+34, cy:node.y+20, r:16,
        fill:p?.color || "rgba(255,255,255,.25)",
        stroke: isSelected ? "rgba(255,255,255,.95)" : "rgba(0,0,0,.45)",
        "stroke-width": isSelected ? 4 : 2,
        opacity: 0.98
      });
      token.style.pointerEvents="auto";
      token.addEventListener("click",(ev)=>{ev.stopPropagation(); selectUnit(u.id);});
      mapSvg.appendChild(token);

      const txt = svgEl("text",{
        x:node.x+34, y:node.y+25,
        fill:"#081220",
        "font-size":"14",
        "text-anchor":"middle",
        "font-weight":"900"
      });
      txt.textContent = String(u.strength);
      txt.style.pointerEvents="none";
      mapSvg.appendChild(txt);
    });
  }

  function svgEl(tag, attrs){
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for(const [k,v] of Object.entries(attrs||{})){
      el.setAttribute(k, String(v));
    }
    return el;
  }

  // ---------- Game core ----------
  function buildMapIndex(m){
    const nodesById = {};
    m.nodes.forEach(n=> nodesById[n.id]=n);
    m.nodesById = nodesById;

    const adj = {};
    m.edges.forEach(e=>{
      if(e.a==="Wales Sea" || e.b==="Wales Sea") return;
      adj[e.a] = adj[e.a] || [];
      adj[e.b] = adj[e.b] || [];
      adj[e.a].push({to:e.b, cost:e.cost});
      adj[e.b].push({to:e.a, cost:e.cost});
    });
    m.adj = adj;
    return m;
  }

  function startGame(){
    const totalPlayers = parseInt(selTotalPlayers.value,10);
    const humanKingdomId = selHumanKingdom.value;
    const humanName = (inpHumanName.value || "Player").trim().slice(0,24);

    localStorage.setItem("bfb_human_name", humanName);

    // Reset state
    G = makeNewGame();
    G.phase = "playing";
    G.round = 1;
    G.ap = 2;
    G.turnIndex = 0;
    G.ui = { selectedRegionId:null, selectedUnitId:null, pendingMove:false, pendingAttack:false, lastSummary:[] };

    mapData = loadMap();
    mapData = buildMapIndex(mapData);

    // choose AI kingdoms (deterministic but shuffled)
    const humanK = KINGDOMS.find(k=>k.id===humanKingdomId);
    const others = KINGDOMS.filter(k=>k.id!==humanKingdomId);
    shuffleInPlace(others);

    const chosen = [humanK, ...others.slice(0, totalPlayers-1)];

    // build players
    G.players = chosen.map((k, idx) => ({
      id:`p${idx+1}`,
      name: idx===0 ? humanName : k.name,
      kingdomId:k.id,
      kingdomName:k.name,
      color:k.color,
      isHuman: idx===0,
      food:2, silver:2, infl:0,
      alive:true,
    }));

    // build regions from map nodes
    G.regions = {};
    mapData.nodes.forEach(n=>{
      // Remove regions of unused kingdoms entirely (rule scaling)
      const usedKingdomIds = new Set(chosen.map(x=>x.id));
      if(n.kingdom && !usedKingdomIds.has(n.kingdom)){
        G.regions[n.id] = { id:n.id, label:n.label, removed:true };
        return;
      }

      const isCap = !!n.capital;
      const levyCap = isCap ? 3 : 2;
      G.regions[n.id] = {
        id:n.id,
        label:n.label,
        terrain:n.terrain || "plains",
        capital:isCap,
        transitOnly: !!n.transitOnly,
        ownerPlayerId: null,
        leviesStored: 0,
        levyCap,
        buildings: [],
        contested: false,
      };
    });

    // assign starting ownership of capital regions for used kingdoms
    for(const p of G.players){
      const k = KINGDOMS.find(x=>x.id===p.kingdomId);
      const capId = k.capital;
      if(G.regions[capId] && !G.regions[capId].removed){
        G.regions[capId].ownerPlayerId = p.id;
        G.regions[capId].leviesStored = 1; // starting levy on capital card
      }
    }

    // initial unit: none active (board starts with levy on card)
    // We'll create 1 active unit at capital when player calls up.

    // move to game screen
    screenSetup.classList.add("hidden");
    screenGame.classList.remove("hidden");

    // init camera and draw
    requestAnimationFrame(()=>{
      fitMap();
      renderAll();
      log(G, `Game started. Round 1: Events are skipped.`, "system");
      beginTurn(); // start with first player (human)
    });
  }

  function beginTurn(){
    if(G.phase!=="playing") return;

    const player = G.players[G.turnIndex];
    if(!player.alive){
      nextTurn();
      return;
    }
    G.ap = 2;
    G.ui.selectedUnitId = null;
    G.ui.pendingMove = false;
    G.ui.pendingAttack = false;

    const isRound1 = (G.round===1);
    // Auto phases: Event (except round 1) then Income+Upkeep
    const summary = [];
    if(!isRound1){
      const ev = weightedPick(EVENTS);
      ev.apply(G, player);
      summary.push(`Event: ${ev.name} (${ev.text})`);
    } else {
      summary.push(`Event: skipped (Round 1)`);
    }

    const inc = doIncome(player);
    summary.push(...inc.lines);

    // Upkeep and forced disband
    const upkeep = doUpkeep(player);
    summary.push(...upkeep.lines);

    // UI summary
    writeSummary(`${player.name}'s turn start`, summary);

    // If AI, execute AI actions automatically
    if(!player.isHuman){
      hudTurn.textContent = `${player.kingdomName} (AI)`;
      setTimeout(()=> aiTakeTurn(player), 450);
    } else {
      hudTurn.textContent = "Your Turn";
    }
    renderAll();
  }

  function doIncome(player){
    const lines = [];
    // capital income always +1 food +1 silver
    lines.push(`Income: +1 🍞 +1 💰 from Capital.`);
    player.food += 1; player.silver += 1;

    // buildings income from controlled regions
    let f=0,s=0,inf=0;
    Object.values(G.regions).forEach(r=>{
      if(r.removed) return;
      if(r.ownerPlayerId !== player.id) return;
      for(const b of r.buildings){
        const bb = BUILDINGS[b];
        if(!bb) continue;
        f += (bb.produces.food||0);
        s += (bb.produces.silver||0);
        inf += (bb.produces.infl||0);
      }
    });
    if(f||s||inf){
      if(f){ player.food += f; }
      if(s){ player.silver += s; }
      if(inf){ player.infl += inf; }
      const parts = [];
      if(f) parts.push(`+${f} 🍞`);
      if(s) parts.push(`+${s} 💰`);
      if(inf) parts.push(`+${inf} 👑`);
      lines.push(`Income: ${parts.join(" ")} from Buildings.`);
    } else {
      lines.push(`Income: no building output.`);
    }
    return {lines};
  }

  function doUpkeep(player){
    const lines = [];
    const units = Object.values(G.units).filter(u=>u.playerId===player.id);
    const need = units.reduce((a,u)=>a+u.strength,0);
    if(need===0){
      lines.push(`Upkeep: 0 (no active units).`);
      return {lines};
    }
    lines.push(`Upkeep: -${need} 🍞 for active units.`);
    player.food -= need;

    if(player.food >= 0){
      return {lines};
    }

    // Forced disband until food >= 0
    let deficit = -player.food;
    lines.push(`Upkeep shortfall: ${deficit} 🍞. Forced disband required.`);
    // AI: auto disband from smallest/most distant
    if(!player.isHuman){
      const list = Object.values(G.units).filter(u=>u.playerId===player.id).sort((a,b)=>a.strength-b.strength);
      for(const u of list){
        if(deficit<=0) break;
        // disband 1 strength at a time
        const take = Math.min(u.strength, deficit);
        u.strength -= take;
        deficit -= take;
        player.food += take;
        if(u.strength<=0) delete G.units[u.id];
        lines.push(`Forced disband: ${take} unit(s).`);
      }
      return {lines};
    }

    // Human: prompt once to disband enough
    showModal("Upkeep shortfall", `
      You don't have enough Food to maintain your armies.
      <br><br>
      You must disband units until Food is not negative.
      <br><br>
      Tap <b>Disband</b> and remove units, then press <b>Continue</b>.
    `, [
      {label:"Continue", primary:true, onClick:()=>{ hideModal(); toastMsg("Disband units until Food is non-negative."); renderAll();}}
    ]);
    return {lines};
  }

  function nextTurn(){
    // advance turn index
    G.turnIndex = (G.turnIndex + 1) % G.players.length;
    if(G.turnIndex===0){
      G.round += 1;
    }
    beginTurn();
  }

  // ---------- Actions ----------
  function isHumanTurn(){
    return G.phase==="playing" && G.players[G.turnIndex]?.isHuman;
  }

  function selectRegion(id){
    if(G.phase!=="playing") return;
    if(!G.regions[id] || G.regions[id].removed) return;
    G.ui.selectedRegionId = id;
    G.ui.pendingMove = false;
    G.ui.pendingAttack = false;
    updateRegionPanel();
    renderAll();
  }

  function selectUnit(unitId){
    if(G.phase!=="playing") return;
    const u = G.units[unitId];
    if(!u) return;
    G.ui.selectedUnitId = unitId;
    // auto select region
    G.ui.selectedRegionId = u.regionId;
    updateRegionPanel();
    renderAll();
  }

  function updateRegionPanel(){
    const rid = G.ui.selectedRegionId;
    if(!rid){ return; }
    const r = G.regions[rid];
    if(!r) return;

    regionName.textContent = r.label;
    const t = TERRAIN[r.terrain] || {name:"Unknown", def:0};
    regionSub.textContent = r.capital ? "Capital region" : (r.transitOnly ? "Waiting point for troops (no control/build)" : "Region card");
    regionTerrain.textContent = `${t.name} (+${t.def} def)`;
    const owner = r.ownerPlayerId ? G.players.find(p=>p.id===r.ownerPlayerId) : null;
    regionOwner.textContent = owner ? owner.kingdomName : "Uncontrolled";
    regionOwner.style.color = owner ? owner.color : "var(--text)";
    regionLevies.textContent = `${r.leviesStored} / ${r.levyCap}`;

    // buildings
    buildingSlots.innerHTML = "";
    const max = r.capital ? 3 : 2;
    for(let i=0;i<max;i++){
      const bid = r.buildings[i] || null;
      const el = document.createElement("div");
      el.className = "slot";
      if(bid){
        const b=BUILDINGS[bid];
        el.innerHTML = `<b>${b.icon} ${b.name}</b><span>Built</span>`;
      } else {
        el.innerHTML = `<b>Empty</b><span>Tap Build</span>`;
      }
      buildingSlots.appendChild(el);
    }

    // enable/disable buttons (contextual)
    const human = G.players[G.turnIndex];
    const hasUnitSelected = !!G.ui.selectedUnitId && (G.units[G.ui.selectedUnitId]?.playerId === human.id);
    btnMove.disabled = !isHumanTurn() || !hasUnitSelected;
    btnAttack.disabled = !isHumanTurn() || !hasUnitSelected || !regionHasEnemy(rid, human.id);
    btnDisband.disabled = !isHumanTurn() || !hasUnitSelected;
    btnEndturn.disabled = !isHumanTurn();

    btnBuild.disabled = !isHumanTurn() || !canBuildHere(rid, human.id);
    btnRecruit.disabled = !isHumanTurn() || !canRecruitHere(rid, human.id);
    btnCallup.disabled = !isHumanTurn() || !canCallUp(human.id);
    btnPillage.disabled = !isHumanTurn() || !canPillageHere(rid, human.id);

    contextHint.textContent = hasUnitSelected ? "Army selected. You can Move/Attack/Disband." : "Select an army token to enable Move/Attack/Disband.";
  }

  function canBuildHere(rid, pid){
    const r=G.regions[rid];
    if(!r || r.removed) return false;
    if(r.transitOnly) return false;
    if(r.ownerPlayerId !== pid) return false;
    const max = r.capital ? 3 : 2;
    if(r.buildings.length >= max) return false;
    return true;
  }

  function canRecruitHere(rid, pid){
    const r=G.regions[rid];
    if(!r || r.removed) return false;
    if(r.ownerPlayerId !== pid) return false;
    if(r.leviesStored >= r.levyCap) return false;
    return true;
  }

  function canCallUp(pid){
    // need at least 1 stored levy anywhere
    const any = Object.values(G.regions).some(r=>!r.removed && r.ownerPlayerId===pid && r.leviesStored>0);
    return any;
  }

  function canPillageHere(rid, pid){
    const r=G.regions[rid];
    if(!r || r.removed) return false;
    if(r.transitOnly) return false;
    // must have human unit in region and not own it; and region has a building
    const has = Object.values(G.units).some(u=>u.playerId===pid && u.regionId===rid);
    if(!has) return false;
    if(r.ownerPlayerId===pid) return false;
    if(r.buildings.length===0) return false;
    return true;
  }

  function regionHasEnemy(rid, pid){
    return Object.values(G.units).some(u=>u.regionId===rid && u.playerId!==pid);
  }

  function actionBuild(){
    if(!isHumanTurn()) return;
    const human = G.players[G.turnIndex];
    const rid = G.ui.selectedRegionId;
    if(!canBuildHere(rid, human.id)) return toastMsg("Select one of your regions with free building slots.");

    const choices = Object.values(BUILDINGS).map(b=>({
      label: `${b.icon} ${b.name} (${b.cost}💰)`,
      onClick: ()=> {
        if(human.silver < b.cost) return toastMsg("Not enough silver.");
        human.silver -= b.cost;
        G.regions[rid].buildings.push(b.id);
        log(G, `Built ${b.name} in ${rid}. (-${b.cost}💰)`, "build");
        hideModal();
        updateRegionPanel(); renderAll();
      }
    }));
    showModal("Build", "Choose a building to construct in this region.", [
      ...choices.map(c=>({label:c.label, onClick:c.onClick})),
      {label:"Cancel", onClick:()=>hideModal()}
    ]);
  }

  function actionRecruit(){
    if(!isHumanTurn()) return;
    const human = G.players[G.turnIndex];
    const rid = G.ui.selectedRegionId;
    if(!canRecruitHere(rid, human.id)) return toastMsg("Select one of your controlled regions with free levy space.");
    if(human.silver < 1) return toastMsg("You need 1💰 to recruit a levy.");
    human.silver -= 1;
    G.regions[rid].leviesStored += 1;
    log(G, `Recruited 1 levy in ${rid}. (-1💰)`, "recruit");
    updateRegionPanel(); renderAll();
  }

  function actionCallUp(){
    if(!isHumanTurn()) return;
    const human = G.players[G.turnIndex];
    const k = KINGDOMS.find(x=>x.id===human.kingdomId);
    const capId = k.capital;
    if(G.regions[capId].removed) return toastMsg("Your capital isn't in this player-count setup.");
    // gather available levies by region
    const sources = Object.values(G.regions).filter(r=>!r.removed && r.ownerPlayerId===human.id && r.leviesStored>0);
    if(!sources.length) return toastMsg("No stored levies to call up.");
    // simple: call up 1 levy (1 AP)
    if(G.ap < 1) return toastMsg("No AP remaining.");

    // choose how many (1-3) depending on stored total
    const total = sources.reduce((a,r)=>a+r.leviesStored,0);
    const max = Math.min(3, total);
    showModal("Call Up", `Call up levies to your capital (${capId}).`, [
      ...Array.from({length:max}, (_,i)=>i+1).map(n=>({
        label:`Call up ${n} unit(s) (${n<=2? "1 AP":"2 AP"})`,
        primary:n===1,
        onClick:()=>{
          const costAP = (n<=2) ? 1 : 2;
          if(G.ap < costAP) return toastMsg("Not enough AP.");
          // pull levies from regions
          let remaining=n;
          for(const r of sources){
            if(remaining<=0) break;
            const take = Math.min(r.leviesStored, remaining);
            r.leviesStored -= take;
            remaining -= take;
          }
          // create/merge unit stack at capital
          addUnit(human.id, capId, n);
          G.ap -= costAP;
          log(G, `Called up ${n} unit(s) to ${capId}. (-${costAP} AP)`, "callup");
          hideModal();
          updateRegionPanel(); renderAll();
        }
      })),
      {label:"Cancel", onClick:()=>hideModal()}
    ]);
  }

  function actionPillage(){
    if(!isHumanTurn()) return;
    const human = G.players[G.turnIndex];
    const rid = G.ui.selectedRegionId;
    if(G.ap < 1) return toastMsg("No AP remaining.");
    if(!canPillageHere(rid, human.id)) return toastMsg("You can only pillage enemy/neutral regions with a building, where you have an army.");
    // remove first non-castle building if possible
    const r=G.regions[rid];
    let idx = r.buildings.findIndex(bid => !BUILDINGS[bid]?.indestructible);
    if(idx<0) idx=0;
    const removed = r.buildings.splice(idx,1)[0];
    human.silver += 1;
    G.ap -= 1;
    log(G, `Pillaged ${rid}: destroyed ${BUILDINGS[removed]?.name||removed} and gained +1💰. (-1 AP)`, "pillage");
    // region stays uncontrolled; also if transitOnly (shouldn't)
    updateRegionPanel(); renderAll();
  }

  function actionMove(){
    if(!isHumanTurn()) return;
    const human = G.players[G.turnIndex];
    const u = G.units[G.ui.selectedUnitId];
    if(!u || u.playerId !== human.id) return toastMsg("Select one of your armies.");
    const from = u.regionId;

    // show reachable neighbours by remaining AP (one step)
    const opts = (mapData.adj[from] || []).filter(n=> n.cost <= G.ap)
      .map(n=>({ to:n.to, cost:n.cost }));
    if(!opts.length) return toastMsg("No adjacent moves available with your remaining AP.");

    showModal("Move", `Choose a destination from ${from}.`, [
      ...opts.map(o=>({
        label:`→ ${o.to} (${o.cost} AP)`,
        onClick:()=>{
          if(G.ap < o.cost) return toastMsg("Not enough AP.");
          // cannot control Isle of Man; but can move there.
          u.regionId = o.to;
          G.ap -= o.cost;
          // mark contested if enemy present
          const enemyPresent = Object.values(G.units).some(x=>x.regionId===o.to && x.playerId!==human.id);
          const r = G.regions[o.to];
          if(r && !r.removed){
            r.contested = enemyPresent || (r.ownerPlayerId && r.ownerPlayerId!==human.id) || (r.ownerPlayerId===null && !r.transitOnly);
            // If empty neutral and not transit, start occupation; grant control instantly for this digital build (simplified) OR keep contested?
            // We'll keep: if move into uncontrolled, you gain control at end of your next turn. For simplicity, we'll mark pending capture.
            if(r.ownerPlayerId===null && !r.transitOnly && !enemyPresent){
              r.pendingCapture = { by:human.id, roundsLeft: r.capital ? 2 : 1 };
              r.contested = true;
            }
          }
          log(G, `Moved army to ${o.to}. (-${o.cost} AP)`, "move");
          hideModal();
          updateRegionPanel(); renderAll();
        }
      })),
      {label:"Cancel", onClick:()=>hideModal()}
    ]);
  }

  function actionAttack(){
    if(!isHumanTurn()) return;
    const human = G.players[G.turnIndex];
    const u = G.units[G.ui.selectedUnitId];
    if(!u || u.playerId!==human.id) return toastMsg("Select your army first.");
    const rid = u.regionId;
    if(G.ap < 1) return toastMsg("No AP remaining.");
    const enemies = Object.values(G.units).filter(x=>x.regionId===rid && x.playerId!==human.id);
    if(!enemies.length) return toastMsg("No enemies here to attack.");

    // pick first enemy stack
    const def = enemies[0];
    resolveCombat(human.id, u.id, def.id);
  }

  function actionDisband(){
    if(!isHumanTurn()) return;
    const human = G.players[G.turnIndex];
    const u = G.units[G.ui.selectedUnitId];
    if(!u || u.playerId!==human.id) return toastMsg("Select your army.");
    if(G.ap < 1) return toastMsg("No AP remaining.");
    u.strength -= 1;
    if(u.strength<=0) delete G.units[u.id];
    G.ap -= 1;
    human.food += 1; // effectively reduces future upkeep burden; immediate +1 food as if not consuming next upkeep
    log(G, `Disbanded 1 unit. (-1 AP)`, "disband");
    updateRegionPanel(); renderAll();
  }

  function actionEndTurn(){
    if(!isHumanTurn()) return;
    // resolve pending captures for human at end of turn
    resolveCaptures();
    checkVictory();
    if(G.phase==="gameover") return;
    nextTurn();
  }

  function resolveCaptures(){
    // decrement pendingCapture if occupant still present and region not contested by enemy
    Object.values(G.regions).forEach(r=>{
      if(r.removed) return;
      if(!r.pendingCapture) return;
      const pc = r.pendingCapture;
      const by = pc.by;
      const enemyPresent = Object.values(G.units).some(u=>u.regionId===r.id && u.playerId!==by);
      const byPresent = Object.values(G.units).some(u=>u.regionId===r.id && u.playerId===by);
      if(!byPresent || enemyPresent){
        // reset if interrupted
        r.pendingCapture = null;
        r.contested = enemyPresent;
        return;
      }
      pc.roundsLeft -= 1;
      if(pc.roundsLeft<=0){
        // capture
        if(r.transitOnly){
          r.pendingCapture=null; r.contested=false;
          return;
        }
        r.ownerPlayerId = by;
        r.pendingCapture = null;
        r.contested = false;
        log(G, `${playerName(by)} captured ${r.id}.`, "capture");
        // if capital captured -> eliminate
        if(r.capital){
          const defeated = G.players.find(p=>{
            const k=KINGDOMS.find(x=>x.id===p.kingdomId);
            return k.capital===r.id && p.id!==by;
          });
          if(defeated){
            defeated.alive=false;
            log(G, `${defeated.kingdomName} has lost its capital and is eliminated!`, "system");
          }
        }
      } else {
        r.contested = true;
      }
    });
  }

  function checkVictory(){
    const alive = G.players.filter(p=>p.alive);
    if(alive.length===1){
      endGame(`${alive[0].kingdomName} wins (last kingdom standing).`);
      return;
    }
    // Influence win threshold (simple: 18 for 2-3 players, 24 for 4-5 players)
    const total = G.players.length;
    const inflTarget = (total<=3)?18:24;
    for(const p of alive){
      if(p.infl >= inflTarget){
        endGame(`${p.kingdomName} wins by Influence (${p.infl} 👑).`);
        return;
      }
    }
    // Territory: core 4 + extras (2 for <=3 players, 4 for 4-5)
    const extra = (total<=3)?2:4;
    for(const p of alive){
      const k = KINGDOMS.find(x=>x.id===p.kingdomId);
      const owned = Object.values(G.regions).filter(r=>!r.removed && r.ownerPlayerId===p.id).map(r=>r.id);
      const hasCore = k.core.every(rn=>owned.includes(rn));
      if(hasCore && owned.length >= (k.core.length+extra)){
        endGame(`${p.kingdomName} wins by Dominion (controlled core + ${extra} extra).`);
        return;
      }
    }
  }

  function endGame(msg){
    G.phase="gameover";
    showModal("Game Over", msg, [{label:"New Game", primary:true, onClick:()=>{ hideModal(); location.reload(); }}]);
  }

  // ---------- Combat (simple but readable) ----------
  function resolveCombat(attackerPid, attackerUnitId, defenderUnitId){
    const atk = G.units[attackerUnitId];
    const def = G.units[defenderUnitId];
    if(!atk || !def) return;
    if(G.ap < 1 && isHumanTurn()) return toastMsg("No AP remaining.");

    const rid = atk.regionId;
    const region = G.regions[rid];
    const defTerrain = TERRAIN[region.terrain]?.def || 0;
    const hasCastle = region.buildings.includes("castle") ? 2 : 0;
    const capBonus = region.capital ? 1 : 0;
    const baseDef = defTerrain + hasCastle + capBonus;

    const droll = rollDie();
    const mod = (droll===1)?2:(droll===2)?1:(droll===5)?-1:(droll===6)?-2:0;
    const totalDef = Math.max(0, baseDef + mod);

    const defBonus = (totalDef<=1)?0:(totalDef<=3)?1:(totalDef<=5)?2:3;

    const atkStr = atk.strength;
    const defStr = def.strength + defBonus;

    const diff = atkStr - defStr;

    // outcome
    let result = "";
    if(Math.abs(diff) <= 1){
      // stalemate
      atk.strength -= 1;
      def.strength -= 1;
      result = "Stalemate: both lose 1 unit.";
    } else if(diff >= 2 && diff <= 3){
      def.strength -= 1;
      result = "Attacker minor win: defender loses 1 unit.";
    } else if(diff >= 4 && diff <= 5){
      def.strength -= 2;
      result = "Attacker clear win: defender loses 2 units.";
    } else if(diff >= 6){
      def.strength -= 3;
      result = "Crushing victory: defender loses 3 units.";
    } else if(diff <= -2 && diff >= -3){
      atk.strength -= 1;
      result = "Defender minor win: attacker loses 1 unit.";
    } else if(diff <= -4 && diff >= -5){
      atk.strength -= 2;
      result = "Defender clear win: attacker loses 2 units.";
    } else if(diff <= -6){
      atk.strength -= 3;
      result = "Defender crushing win: attacker loses 3 units.";
    }

    if(isHumanTurn()) G.ap -= 1;

    // cleanup
    if(atk.strength<=0) delete G.units[atk.id];
    if(def.strength<=0) delete G.units[def.id];

    // update contested flags
    const enemyLeft = Object.values(G.units).some(u=>u.regionId===rid && u.playerId!==attackerPid);
    const atkLeft = Object.values(G.units).some(u=>u.regionId===rid && u.playerId===attackerPid);
    if(region){
      region.contested = enemyLeft || (region.ownerPlayerId && region.ownerPlayerId!==attackerPid && atkLeft);
    }

    log(G, `Battle in ${rid}: def=${baseDef} + roll(${droll})=${mod} → totalDef ${totalDef} (+${defBonus} str). ${result}`, "battle");
    writeSummary("Battle", [
      `${playerName(attackerPid)} attacked in ${rid}.`,
      `Defence: base ${baseDef}, die ${droll} (${mod>=0?"+":""}${mod}) → ${totalDef} ⇒ +${defBonus} defender strength.`,
      result
    ]);

    hideModal();
    updateRegionPanel(); renderAll();
  }

  function rollDie(){
    return 1 + Math.floor(Math.random()*6);
  }

  // ---------- Units ----------
  function addUnit(pid, rid, amount){
    // merge if unit already exists for player in region
    const existing = Object.values(G.units).find(u=>u.playerId===pid && u.regionId===rid);
    if(existing){
      existing.strength += amount;
      return existing.id;
    }
    const id = `u${Math.random().toString(16).slice(2,10)}`;
    G.units[id] = { id, playerId:pid, regionId:rid, strength:amount };
    return id;
  }

  function firstActiveUnit(g, pid){
    return Object.values(g.units).find(u=>u.playerId===pid);
  }
  function removeUnit(g, unitId){
    delete g.units[unitId];
  }

  // ---------- AI ----------
  function aiTakeTurn(player){
    const lines = [];
    // simple AI priorities:
    // 1) if has stored levies and silver, recruit once
    // 2) if no active units, call up 2 if possible
    // 3) move toward nearest neutral/enemy region
    // 4) attack if enemy in same region
    const k = KINGDOMS.find(x=>x.id===player.kingdomId);
    const capId = k.capital;

    // recruit if possible in any owned region
    const recRegion = Object.values(G.regions).find(r=>!r.removed && r.ownerPlayerId===player.id && r.leviesStored<r.levyCap && player.silver>=1);
    if(recRegion){
      player.silver -= 1;
      recRegion.leviesStored += 1;
      lines.push(`Recruited 1 levy in ${recRegion.id}.`);
    }

    // call up if no units
    const myUnits = Object.values(G.units).filter(u=>u.playerId===player.id);
    if(myUnits.length===0){
      const totalStored = Object.values(G.regions).filter(r=>!r.removed && r.ownerPlayerId===player.id).reduce((a,r)=>a+r.leviesStored,0);
      const n = Math.min(2, totalStored);
      if(n>0){
        // pull from regions
        let remaining=n;
        for(const r of Object.values(G.regions)){
          if(remaining<=0) break;
          if(r.removed || r.ownerPlayerId!==player.id) continue;
          const take = Math.min(r.leviesStored, remaining);
          r.leviesStored -= take;
          remaining -= take;
        }
        addUnit(player.id, capId, n);
        lines.push(`Called up ${n} unit(s) to ${capId}.`);
      }
    }

    // do up to 2 AP worth of moves/attacks
    let ap = 2;
    while(ap>0){
      // attack if enemy present in any unit region
      const unit = Object.values(G.units).find(u=>u.playerId===player.id);
      if(!unit) break;

      const rid = unit.regionId;
      const enemiesHere = Object.values(G.units).filter(u=>u.regionId===rid && u.playerId!==player.id);
      if(enemiesHere.length && ap>=1){
        // AI attack
        G.ap = ap; // temporarily reuse
        resolveCombat(player.id, unit.id, enemiesHere[0].id);
        ap = G.ap;
        lines.push(`Attacked in ${rid}.`);
        continue;
      }

      // move toward best neighbour (prefer neutral or enemy-owned, and lower cost)
      const neigh = (mapData.adj[rid]||[]).filter(n=>n.cost<=ap);
      if(!neigh.length) break;

      let best = null;
      for(const n of neigh){
        const rr = G.regions[n.to];
        if(!rr || rr.removed) continue;
        if(rr.transitOnly){
          // allow but low priority
        }
        const owner = rr.ownerPlayerId;
        const score = (owner===null ? 3 : (owner!==player.id ? 2 : 1)) + (rr.capital?1:0) - (n.cost*0.15);
        if(!best || score>best.score) best = {to:n.to, cost:n.cost, score};
      }
      if(!best) break;

      unit.regionId = best.to;
      ap -= best.cost;

      const rr = G.regions[best.to];
      if(rr && !rr.removed){
        const enemyPresent = Object.values(G.units).some(x=>x.regionId===best.to && x.playerId!==player.id);
        if(rr.ownerPlayerId===null && !rr.transitOnly && !enemyPresent){
          rr.pendingCapture = { by:player.id, roundsLeft: rr.capital?2:1 };
          rr.contested = true;
        } else if(rr.ownerPlayerId && rr.ownerPlayerId!==player.id){
          rr.contested = true;
        } else if(enemyPresent){
          rr.contested = true;
        }
      }
      lines.push(`Moved to ${best.to}.`);
    }

    // AI end of turn: resolve captures and victory
    resolveCaptures();
    checkVictory();
    if(G.phase==="gameover") return;

    writeSummary(`${player.kingdomName} (AI)`, lines.length?lines:["Held position."]);
    // next
    nextTurn();
  }

  // ---------- Map Editor ----------
  function openMapEditor(){
    const current = JSON.stringify({ width:mapData.width, height:mapData.height, nodes:mapData.nodes, edges:mapData.edges }, null, 2);
    const html = `
      <div class="tiny">
        Paste a full map JSON to match your physical board (nodes + edges).
        <br><br>
        <b>Tip:</b> Keep width 1100 and adjust coordinates to match the background image.
      </div>
      <textarea id="mapEditorText" style="width:100%;height:240px;border-radius:14px;border:1px solid rgba(255,255,255,.18);background:rgba(8,12,18,.65);color:#e8eef7;padding:10px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1.35"></textarea>
    `;
    showModal("Map Editor", html, [
      {label:"Apply", primary:true, onClick:()=>{
        const ta = $("#mapEditorText");
        try{
          const obj = JSON.parse(ta.value);
          localStorage.setItem("bfb_map_override", JSON.stringify(obj));
          mapData = buildMapIndex(obj);
          // rebuild regions removed flags based on player selection already applied
          toastMsg("Map applied. (Refresh if anything looks off)");
          hideModal();
          renderAll();
        }catch(err){
          toastMsg("Invalid JSON.");
        }
      }},
      {label:"Reset to Default", onClick:()=>{
        localStorage.removeItem("bfb_map_override");
        mapData = buildMapIndex(JSON.parse(JSON.stringify(DEFAULT_MAP)));
        hideModal();
        renderAll();
      }},
      {label:"Cancel", onClick:()=>hideModal()}
    ]);
    setTimeout(()=> {
      const ta = $("#mapEditorText");
      if(ta) ta.value = current;
    }, 0);
  }

  function loadMap(){
    try{
      const over = localStorage.getItem("bfb_map_override");
      if(over) return JSON.parse(over);
    }catch(e){}
    return JSON.parse(JSON.stringify(DEFAULT_MAP));
  }

  // ---------- UI: summary/log/toast/modal ----------
  function renderAll(){
    // Update HUD
    hudRound.textContent = `Round ${G.round}`;
    hudAp.textContent = `AP ${G.ap}`;

    const human = G.players.find(p=>p.isHuman) || G.players[0];
    hudFood.textContent = String(human.food);
    hudSilver.textContent = String(human.silver);
    hudInfl.textContent = String(human.infl);

    // update region panel state
    updateRegionPanel();

    // map svg size sync
    mapSvg.setAttribute("width", String(mapData.width));
    mapSvg.setAttribute("height", String(mapData.height));
    mapSvg.style.width = `${mapData.width}px`;
    mapSvg.style.height = `${mapData.height}px`;

    renderMap();
  }

  function writeSummary(title, lines){
    const entry = document.createElement("div");
    entry.className = "entry";
    entry.innerHTML = `<b>${escapeHtml(title)}</b><div style="margin-top:6px">${lines.map(l=>`• ${escapeHtml(l)}`).join("<br>")}</div>`;
    summaryBody.prepend(entry);
  }

  function log(game, text, kind){
    // for now we use Turn Summary (more readable than raw logs)
    // Keeping this function for future expansion.
  }

  function toastMsg(msg){
    toast.textContent = msg;
    toast.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(()=> toast.classList.add("hidden"), 1800);
  }

  function showModal(title, bodyHtml, actions){
    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHtml;
    modalActions.innerHTML = "";
    (actions||[]).forEach(a=>{
      const b=document.createElement("button");
      b.className = "btn " + (a.primary ? "btn-primary":"btn-secondary");
      b.type="button";
      b.textContent = a.label;
      b.addEventListener("click", ()=> a.onClick && a.onClick());
      modalActions.appendChild(b);
    });
    modal.classList.remove("hidden");
  }
  function hideModal(){ modal.classList.add("hidden"); }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;" }[c]));
  }

  function playerName(pid){
    const p=G.players.find(x=>x.id===pid);
    return p ? p.kingdomName : pid;
  }

  function shuffleInPlace(arr){
    for(let i=arr.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
  }

  function weightedPick(list){
    const total = list.reduce((a,x)=>a+(x.weight||1),0);
    let r = Math.random()*total;
    for(const x of list){
      r -= (x.weight||1);
      if(r<=0) return x;
    }
    return list[list.length-1];
  }

  // ---------- Save/Load ----------
  function doSave(){
    const payload = {
      version: VERSION,
      mapOverride: localStorage.getItem("bfb_map_override") || null,
      game: G,
    };
    localStorage.setItem("bfb_save", JSON.stringify(payload));
    toastMsg("Saved.");
  }

  function doLoad(){
    const raw = localStorage.getItem("bfb_save");
    if(!raw) return toastMsg("No save found.");
    try{
      const payload = JSON.parse(raw);
      if(payload.mapOverride){
        localStorage.setItem("bfb_map_override", payload.mapOverride);
      }
      G = payload.game;
      mapData = buildMapIndex(loadMap());
      screenSetup.classList.add("hidden");
      screenGame.classList.remove("hidden");
      requestAnimationFrame(()=>{
        fitMap();
        renderAll();
        toastMsg("Loaded.");
      });
    }catch(e){
      toastMsg("Save load failed.");
    }
  }

  // ---------- Cache reset ----------
  async function resetCache(){
    try{
      if("caches" in window){
        const keys = await caches.keys();
        await Promise.all(keys.map(k=>caches.delete(k)));
      }
      localStorage.removeItem("bfb_map_override");
      toastMsg("Cache cleared. Reloading…");
      setTimeout(()=> location.reload(), 500);
    }catch(e){
      toastMsg("Couldn't clear cache.");
    }
  }

  // ---------- Wire up ----------
  function wire(){
    initSetupUI();

    btnStart.addEventListener("click", startGame);
    btnSave.addEventListener("click", doSave);
    btnLoad.addEventListener("click", doLoad);
    btnLoadSetup.addEventListener("click", doLoad);

    btnHelp.addEventListener("click", ()=> showModal("Help", `
      <div>
        <b>Map</b><br>
        • Drag to pan, pinch to zoom.<br>
        • Tap a region circle to open its Region Card.<br>
        • Tap an army token (coloured circle with number) to select it.<br><br>
        <b>Turn flow</b><br>
        • Events + Income + Upkeep run automatically at the start of each turn (Round 1 skips events).<br>
        • Use up to 2 AP on actions, then End Turn.<br><br>
        <b>Map accuracy</b><br>
        • Use Map Editor to paste your exact board routes & node positions.
      </div>
    `, [{label:"Close", primary:true, onClick:()=>hideModal()}]));

    btnHelpSetup.addEventListener("click", ()=> showModal("Help", `
      <div>
        Choose total players and your kingdom, then start.
        <br><br>
        In-game: drag/pinch the map and tap regions to manage buildings and levies.
      </div>
    `, [{label:"Close", primary:true, onClick:()=>hideModal()}]));

    btnResetCache.addEventListener("click", resetCache);

    // map controls
    btnZoomIn.addEventListener("click", ()=>{
      camera.scale = clamp(camera.scale*1.15, 0.35, 2.8);
      applyCamera();
    });
    btnZoomOut.addEventListener("click", ()=>{
      camera.scale = clamp(camera.scale/1.15, 0.35, 2.8);
      applyCamera();
    });
    btnZoomFit.addEventListener("click", fitMap);
    btnMapEditor.addEventListener("click", openMapEditor);

    // pointer pan/zoom
    mapViewport.addEventListener("pointerdown", handlePointerDown);
    mapViewport.addEventListener("pointermove", handlePointerMove);
    mapViewport.addEventListener("pointerup", handlePointerUp);
    mapViewport.addEventListener("pointercancel", handlePointerUp);

    // region panel buttons
    btnCloseRegion.addEventListener("click", ()=>{ G.ui.selectedRegionId=null; G.ui.selectedUnitId=null; regionName.textContent="Select a region"; regionSub.textContent="Tap any region on the map."; renderAll(); });

    btnBuild.addEventListener("click", actionBuild);
    btnRecruit.addEventListener("click", actionRecruit);
    btnCallup.addEventListener("click", actionCallUp);
    btnPillage.addEventListener("click", actionPillage);

    btnMove.addEventListener("click", actionMove);
    btnAttack.addEventListener("click", actionAttack);
    btnDisband.addEventListener("click", actionDisband);
    btnEndturn.addEventListener("click", actionEndTurn);

    btnClearSummary.addEventListener("click", ()=> summaryBody.innerHTML = "");

    // responsive fit on resize/orientation
    window.addEventListener("resize", ()=> {
      if(!screenGame.classList.contains("hidden")) fitMap();
    });

    // service worker
    if("serviceWorker" in navigator){
      window.addEventListener("load", async ()=>{
        try{
          const reg = await navigator.serviceWorker.register("./sw.js");
          // update
          reg.update?.();
        }catch(e){}
      });
    }
  }

  // init map data early (for editor)
  mapData = buildMapIndex(loadMap());
  wire();
})();
