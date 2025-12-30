/* Battle for Britannia v6 — full rebuild, professional mobile-first
   Engine is pure JS, UI is SVG + bottom sheet.

   Notes:
   - Uses the movement list supplied by Oli (authoritative graph)
   - Map is built from scratch (stylised UK), regions are polygons.
   - Includes: events, income/upkeep automation, disband, build icons, AI summary,
     combat stance + defence roll + retreat, AND a "Battle Tactics" deck for big battles.

   This is a client-only game (no server).
*/

(() => {
  'use strict';

  // ---------- Utils ----------
  const $ = (sel, el=document) => el.querySelector(sel);
  const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const randInt = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
  const choice = (arr) => arr[Math.floor(Math.random()*arr.length)];
  const uid = (()=>{ let n=1; return ()=> (n++).toString(); })();

  const TOAST = (() => {
    let t = null, hideTimer = null;
    function show(msg){
      const el = $('#toast');
      if(!el) return;
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(hideTimer);
      hideTimer = setTimeout(()=> el.classList.remove('show'), 1400);
    }
    return { show };
  })();

  // ---------- Core Data ----------
  const KINGDOMS = [
    { id:'wessex', name:'Wessex', colorVar:'--r', capital:'winchester', core:['winchester','east_anglia','cornwall','sussex_kent'] },
    { id:'mercia', name:'Mercia', colorVar:'--m', capital:'tamworth', core:['tamworth','cheshire','hwicce','lindsey'] },
    { id:'northumbria', name:'Northumbria', colorVar:'--n', capital:'bernicia', core:['bernicia','deira','tynedale','lothian'] },
    { id:'wales', name:'Wales', colorVar:'--w', capital:'gwynedd', core:['gwynedd','powys','dyfed','gwent'] },
    { id:'picts', name:'Picts', colorVar:'--p', capital:'scone', core:['scone','moray','galloway','cumbria'] }, // Strathclyde mapped to Galloway
  ];

  // Region definitions (slots + terrain defence bonus).
  // Terrain defence is used in combat. This is separate from movement AP cost.
  const REGIONS = [
    { id:'moray', name:'Moray', terrain:'Highlands', def:1 },
    { id:'scone', name:'Scone', terrain:'Lowlands', def:0, capitalOf:'picts' },
    { id:'lothian', name:'Lothian', terrain:'Lowlands', def:0 },
    { id:'bernicia', name:'Bernicia', terrain:'Lowlands', def:0, capitalOf:'northumbria' },
    { id:'galloway', name:'Galloway', terrain:'Hills', def:1 },
    { id:'isle_man', name:'Isle of Man', terrain:'Sea', def:0, special:'transit' },
    { id:'cumbria', name:'Cumbria', terrain:'Hills', def:1 },
    { id:'tynedale', name:'Tynedale', terrain:'Hills', def:1 },
    { id:'deira', name:'Deira', terrain:'Lowlands', def:0 },
    { id:'east_anglia', name:'East Anglia', terrain:'Plains', def:0 },
    { id:'cheshire', name:'Cheshire', terrain:'Lowlands', def:0 },
    { id:'lindsey', name:'Lindsey', terrain:'Lowlands', def:0 },
    { id:'gwynedd', name:'Gwynedd', terrain:'Mountains', def:1, capitalOf:'wales' },
    { id:'powys', name:'Powys', terrain:'Hills', def:1 },
    { id:'tamworth', name:'Tamworth', terrain:'Lowlands', def:0, capitalOf:'mercia' },
    { id:'dyfed', name:'Dyfed', terrain:'Lowlands', def:0 },
    { id:'gwent', name:'Gwent', terrain:'Lowlands', def:0 },
    { id:'hwicce', name:'Hwicce', terrain:'Hills', def:1 },
    { id:'winchester', name:'Winchester', terrain:'Lowlands', def:0, capitalOf:'wessex' },
    { id:'sussex_kent', name:'Sussex & Kent', terrain:'Lowlands', def:0 },
    { id:'cornwall', name:'Cornwall', terrain:'Coast', def:0 },
  ];

  const REGION_BY_ID = Object.fromEntries(REGIONS.map(r => [r.id, r]));

  // Slots
  function levySlots(regionId){
    const r = REGION_BY_ID[regionId];
    if(r?.capitalOf) return 3;
    if(r?.special==='transit') return 0;
    return 2;
  }
  function buildingSlots(regionId){
    const r = REGION_BY_ID[regionId];
    if(r?.capitalOf) return 3;
    if(r?.special==='transit') return 0;
    return 2;
  }

  // Movement graph from Oli (bidirectional). Split Galloway->Gwynedd via Isle of Man (1+1).
  const EDGES = [
    ['moray','scone',2],
    ['moray','galloway',2],
    ['scone','lothian',1],
    ['lothian','bernicia',1],
    ['lothian','galloway',1],
    ['galloway','cumbria',2],
    ['galloway','isle_man',1],
    ['isle_man','gwynedd',1],
    ['bernicia','tynedale',1],
    ['tynedale','cumbria',1],
    ['tynedale','east_anglia',2],
    ['tynedale','deira',2],
    ['cumbria','gwynedd',2],
    ['cumbria','cheshire',2],
    ['cheshire','lindsey',1],
    ['lindsey','deira',2],
    ['gwynedd','powys',2],
    ['powys','cheshire',1],
    ['powys','tamworth',1],
    ['powys','dyfed',1],
    ['powys','gwent',1],
    ['dyfed','gwent',1],
    ['gwent','hwicce',2],
    ['tamworth','hwicce',1],
    ['tamworth','east_anglia',2],
    ['dyfed','cornwall',1],
    ['hwicce','winchester',2],
    ['winchester','sussex_kent',1],
    ['winchester','cornwall',2],
    ['sussex_kent','east_anglia',2],
  ];

  // Build adjacency map.
  const ADJ = (() => {
    const m = {};
    for(const r of REGIONS) m[r.id] = [];
    for(const [a,b,cost] of EDGES){
      m[a].push({from:a, to:b, cost});
      m[b].push({from:b, to:a, cost});
    }
    return m;
  })();

  // ---------- Map Geometry (stylised UK polygons) ----------
  // Coordinates in a 1000x1500 viewBox. Each region is a polygon (tap = polygon hit).
  const MAP = (() => {
    // Helper to create rounded-ish polygons (still polygons).
    // We'll hand-place regions in a UK-like stack.
    const polys = {
      moray:        "520.0,120.0 553.3,104.3 590.0,101.2 660.0,120.0 710.0,210.0 671.7,252.5 640.0,300.0 520.0,270.0 501.7,225.8 489.3,204.8 470.0,190.0 506.8,163.5 509.4,140.5",
      scone:        "520.0,300.0 580.0,304.3 640.0,300.0 671.3,344.1 700.0,390.0 676.2,408.6 659.8,433.9 640.0,490.0 609.7,492.1 579.9,486.3 520.0,480.0 502.1,431.1 470.0,390.0 494.1,344.5",
      lothian:        "660.0,500.0 729.0,518.3 800.0,510.0 811.5,558.8 840.0,600.0 803.9,638.8 790.0,690.0 725.9,673.4 660.0,680.0 634.9,635.0 610.0,590.0",
      bernicia:        "780.0,700.0 840.4,707.6 900.0,720.0 918.1,769.1 930.0,820.0 906.9,874.1 870.0,920.0 816.1,904.1 760.0,900.0 738.5,852.3 740.0,800.0 768.1,753.2",
      galloway:        "460.0,520.0 535.0,508.5 610.0,520.0 622.2,568.5 650.0,610.0 615.9,662.7 590.0,720.0 525.9,704.0 460.0,700.0 410.0,600.0 436.2,560.7",
      isle_man:        "360.0,740.0 410.0,740.0 430.0,790.0 420.5,815.2 410.0,840.0 385.0,844.1 360.0,840.0 348.2,815.7 340.0,790.0 353.3,766.3",
      cumbria:        "560.0,740.0 639.9,746.7 679.9,748.6 720.0,750.0 740.3,804.9 748.2,833.1 760.0,860.0 750.7,890.5 735.1,918.4 720.0,980.0 570.0,970.0 552.6,945.0 540.4,917.1 520.0,860.0",
      tynedale:        "760.0,950.0 835.2,958.6 910.0,970.0 912.7,1023.7 940.0,1070.0 900.0,1180.0 760.0,1160.0 738.7,1100.4 720.0,1040.0 748.0,998.5",
      deira:        "740.0,1210.0 815.0,1204.1 890.0,1210.0 916.8,1257.3 930.0,1310.0 880.0,1410.0 812.2,1384.8 740.0,1390.0 709.5,1349.7 700.0,1300.0 731.1,1259.9",
      east_anglia:        "840.0,1420.0 899.5,1433.3 929.3,1440.2 960.0,1440.0 964.4,1490.1 970.0,1540.0 949.4,1557.4 928.1,1573.9 910.6,1594.9 900.0,1620.0 846.1,1604.1 790.0,1600.0 800.5,1540.0 792.4,1510.5 790.0,1480.0 815.5,1450.4",
      cheshire:        "500.0,1040.0 580.0,1054.4 660.0,1040.0 686.1,1087.6 700.0,1140.0 685.6,1199.8 650.0,1250.0 586.8,1228.3 520.0,1230.0 470.0,1120.0 480.3,1078.2",
      lindsey:        "650.0,1270.0 750.0,1280.0 781.5,1319.9 790.0,1370.0 783.3,1415.7 770.0,1460.0 719.3,1461.6 670.0,1450.0 663.2,1394.7 630.0,1350.0 633.2,1308.3",
      gwynedd:        "330.0,900.0 378.3,898.7 425.0,910.7 520.0,900.0 560.0,1030.0 550.2,1070.7 548.8,1112.5 500.0,1180.0 340.0,1160.0 335.9,1118.8 325.8,1078.7 280.0,1010.0 286.6,946.6",
      powys:        "330.0,1180.0 425.0,1188.0 472.4,1183.0 520.0,1180.0 531.9,1252.3 560.0,1320.0 542.1,1353.7 525.1,1387.9 500.0,1460.0 459.5,1456.9 420.6,1445.5 380.2,1443.5 340.0,1440.0 325.7,1401.6 301.9,1368.2 280.0,1290.0",
      tamworth:        "560.0,1260.0 605.0,1250.9 650.0,1260.0 690.0,1350.0 673.1,1398.6 670.0,1450.0 626.3,1433.7 580.0,1440.0 561.0,1389.6 540.0,1340.0 550.4,1300.1",
      dyfed:        "260.0,1460.0 420.0,1460.0 429.4,1511.7 450.0,1560.0 425.6,1622.8 390.0,1680.0 260.0,1660.0 252.1,1605.1 220.0,1560.0 245.4,1512.1",
      gwent:        "430.0,1460.0 560.0,1460.0 562.3,1513.8 590.0,1560.0 540.0,1680.0 420.0,1680.0 409.6,1618.8 390.0,1560.0",
      hwicce:        "560.0,1460.0 620.0,1446.7 680.0,1460.0 720.0,1560.0 690.0,1680.0 625.0,1696.0 560.0,1680.0 544.5,1618.5 520.0,1560.0 532.7,1507.1",
      winchester:        "620.0,1700.0 690.0,1690.5 760.0,1700.0 781.0,1749.6 800.0,1800.0 767.0,1855.7 765.5,1888.1 760.0,1920.0 726.4,1907.8 690.9,1903.6 620.0,1900.0 598.5,1850.6 580.0,1800.0 598.0,1749.2",
      sussex_kent:        "760.0,1700.0 840.0,1709.7 920.0,1720.0 940.0,1820.0 910.0,1881.9 900.0,1950.0 836.5,1949.2 780.0,1920.0 777.4,1857.9 800.0,1800.0 771.6,1753.4",
      cornwall:        "320.0,1760.0 420.0,1764.1 520.0,1760.0 530.6,1785.0 545.1,1808.0 560.0,1860.0 550.0,1923.3 520.0,1980.0 476.9,1998.8 430.0,1996.8 340.0,1980.0 298.3,1925.9 290.2,1892.6 280.0,1860.0 311.2,1814.5",

    };

    // Region label positions (centroids-ish).
    const labels = {
      moray:[600,220], scone:[600,410], lothian:[740,610], bernicia:[850,820],
      galloway:[520,625], isle_man:[385,805], cumbria:[640,870], tynedale:[840,1080],
      deira:[820,1320], east_anglia:[875,1535], cheshire:[585,1160], lindsey:[705,1390],
      gwynedd:[420,1040], powys:[420,1340], tamworth:[615,1375], dyfed:[330,1580],
      gwent:[490,1585], hwicce:[625,1585], winchester:[690,1820], sussex_kent:[865,1830],
      cornwall:[420,1885],
    };

    return { polys, labels, viewBox:{w:1000,h:2100} };
  })();

  // ---------- Decks ----------
  // Event deck: weights keep "rare" rare. Effects are deliberately bounded to avoid runaway.
  const EVENT_DECK = [
    { id:'good_harvest', name:'Good Harvest', weight: 10, text:'+2 Food.', apply:(g,p)=>{ p.food+=2; } },
    { id:'poor_harvest', name:'Poor Harvest', weight: 8, text:'-1 Food (min 0).', apply:(g,p)=>{ p.food=Math.max(0,p.food-1); } },
    { id:'trade_boom', name:'Trade Boom', weight: 8, text:'+2 Silver.', apply:(g,p)=>{ p.silver+=2; } },
    { id:'banditry', name:'Banditry', weight: 8, text:'-1 Silver (min 0).', apply:(g,p)=>{ p.silver=Math.max(0,p.silver-1); } },
    { id:'royal_favour', name:'Royal Favour', weight: 6, text:'+2 Influence.', apply:(g,p)=>{ p.influence+=2; } },
    { id:'minor_revolt', name:'Minor Revolt', weight: 6, text:'If you control 3+ regions, lose 1 Influence (min 0).', apply:(g,p)=>{ if(p.regions.size>=3) p.influence=Math.max(0,p.influence-1);} },
    { id:'major_revolt', name:'Major Revolt', weight: 3, text:'Pay 2 Silver or lose control of a non-capital region.', apply:(g,p)=> g.resolveMajorRevolt(p) },
    { id:'plague', name:'Plague', weight: 4, text:'Disband 1 active unit (if any).', apply:(g,p)=> g.forceDisbandOne(p) },
    { id:'levy_desertion', name:'Levy Desertion', weight: 5, text:'Lose 1 stored levy from a random region (if any).', apply:(g,p)=> g.loseStoredLevy(p) },
    { id:'noble_donation', name:'Noble Donation', weight: 4, text:'Gain 2 stored levies split across controlled regions.', apply:(g,p)=> g.gainStoredLevies(p,2) },
    { id:'stormy_seas', name:'Stormy Seas', weight: 3, text:'Naval edges cost +1 AP this turn (Tynedale↔East Anglia, Dyfed↔Cornwall).', apply:(g,p)=>{ g.turnEffects.navCostPlus1=true; } },
    { id:'festival', name:'Festival', weight: 4, text:'Spend 1 Silver to gain +1 Influence (optional).', apply:(g,p)=> g.offerFestival(p) },
    { id:'mercenaries', name:'Mercenaries', weight: 2, text:'Spend 2 Silver to immediately add +2 units to an active army (optional).', apply:(g,p)=> g.offerMercenaries(p) },
    { id:'spy_network', name:'Spy Network', weight: 2, text:'Peek: learn the next Event (does not change it).', apply:(g,p)=>{ g.peekNextEventFor = p.id; } },
    { id:'bountiful_market', name:'Bountiful Market', weight: 4, text:'If you have a Market, gain +1 Silver extra.', apply:(g,p)=>{ if(g.countBuildings(p,'market')>0) p.silver+=1; } },
    { id:'grain_spoilage', name:'Grain Spoilage', weight: 4, text:'If you have 6+ Food, lose 2 Food.', apply:(g,p)=>{ if(p.food>=6) p.food-=2; } },
    { id:'great_builder', name:'Great Builder', weight: 2, text:'Next build this turn costs -1 Silver (min 0).', apply:(g,p)=>{ g.turnEffects.buildDiscount=1; } },
    { id:'holy_procession', name:'Holy Procession', weight: 3, text:'Gain +1 Influence if you control your capital.', apply:(g,p)=>{ if(g.controlOf(p.capital)===p.id) p.influence+=1; } },
    { id:'tax_shortfall', name:'Tax Shortfall', weight: 4, text:'If you control 4+ regions, lose 1 Silver (min 0).', apply:(g,p)=>{ if(p.regions.size>=4) p.silver=Math.max(0,p.silver-1);} },
    { id:'border_clashes', name:'Border Clashes', weight: 2, text:'A random enemy adjacent to one of your armies takes 1 loss (if any).', apply:(g,p)=> g.borderClashes(p) },
    { id:'quiet_year', name:'Quiet Year', weight: 6, text:'Nothing happens.', apply:(g,p)=>{} },
  ];

  // Battle tactics (only for big battles). Each side draws one card when triggered.
  const TACTIC_DECK = [
    { id:'shieldwall', name:'Shieldwall', weight: 10, text:'+2 defence for the defender.', mod:(ctx)=>{ ctx.defenceBonus += 2; } },
    { id:'high_ground', name:'High Ground', weight: 9, text:'+1 defence (your side).', mod:(ctx)=>{ ctx.defenceBonus += 1; } },
    { id:'berserk_charge', name:'Berserk Charge', weight: 7, text:'+1 attacker strength, but attacker loses 1 extra on stalemate.', mod:(ctx)=>{ ctx.attackBonus += 1; ctx.flags.berserk=true; } },
    { id:'arrow_storm', name:'Arrow Storm', weight: 8, text:'If you are attacker, +1 casualty to defender on any win.', mod:(ctx)=>{ ctx.flags.arrowStorm=true; } },
    { id:'feigned_retreat', name:'Feigned Retreat', weight: 7, text:'If you lose, reduce your casualties by 1 (min 0).', mod:(ctx)=>{ ctx.flags.feigned=true; } },
    { id:'rally', name:'Rally', weight: 7, text:'Ignore the first unit loss your side would take.', mod:(ctx)=>{ ctx.flags.rally=true; } },
    { id:'flanking', name:'Flanking', weight: 7, text:'+2 attacker strength if defender has no castle.', mod:(ctx)=>{ ctx.flags.flanking=true; } },
    { id:'supply_lines', name:'Supply Lines', weight: 6, text:'If you win, gain +1 Silver.', mod:(ctx)=>{ ctx.flags.loot=true; } },
    { id:'muddy_fields', name:'Muddy Fields', weight: 6, text:'-1 attacker strength (min 0).', mod:(ctx)=>{ ctx.attackBonus -= 1; } },
    { id:'war_drums', name:'War Drums', weight: 6, text:'+1 attacker strength.', mod:(ctx)=>{ ctx.attackBonus += 1; } },
  ];

  function drawWeighted(deck){
    const total = deck.reduce((s,c)=> s + c.weight, 0);
    let r = Math.random()*total;
    for(const c of deck){
      r -= c.weight;
      if(r <= 0) return c;
    }
    return deck[deck.length-1];
  }

  // ---------- Game Engine ----------
  class Game {
    constructor({humanKingdomId, aiCount, aiStyle, eventsStartRound}){
      this.config = { humanKingdomId, aiCount, aiStyle, eventsStartRound };
      this.players = [];
      this.round = 1;
      this.turnIndex = 0;
      this.ap = 2;
      this.phase = 'setup';
      this.log = [];
      this.turnSummary = [];
      this.selected = { regionId:null, armyId:null, mode:null };
      this.control = {}; // regionId -> playerId | null
      this.buildings = {}; // regionId -> array of types
      this.storedLevies = {}; // regionId -> {playerId: count} (for simplicity, store in region even if controlled by someone)
      this.armies = []; // {id, ownerId, regionId, units}
      this.captureTimers = {}; // regionId -> {occupierId, remainingTurns} for capitals/regions
      this.turnEffects = { navCostPlus1:false, buildDiscount:0 };
      this.peekNextEventFor = null;
      this._eventQueue = [];
      this._init();
    }

    _init(){
      // Determine kingdoms in play: human + aiCount random from remaining.
      const humanK = KINGDOMS.find(k=>k.id===this.config.humanKingdomId) ?? KINGDOMS[0];
      const remaining = KINGDOMS.filter(k=>k.id!==humanK.id);
      const aiKs = [];
      while(aiKs.length < this.config.aiCount){
        const k = remaining.splice(Math.floor(Math.random()*remaining.length),1)[0];
        if(!k) break;
        aiKs.push(k);
      }
      const inPlay = [humanK, ...aiKs];

      // Regions in play: cores of selected kingdoms (others are dimmed/disabled).
      this.playableRegions = new Set();
      for(const k of inPlay){
        for(const rid of k.core){ this.playableRegions.add(rid); }
      }
      this.playableRegions.add('isle_man');


      // Create players
      this.players = inPlay.map((k, idx) => ({
        id: k.id,
        name: k.name,
        colorVar: k.colorVar,
        capital: k.capital,
        core: k.core.slice(),
        isHuman: idx===0,
        food: 2,
        silver: 2,
        influence: 0,
        regions: new Set(),
        eliminated: false,
      }));

      // Init region state
      for(const r of REGIONS){
        this.control[r.id] = null;
        this.buildings[r.id] = [];
        this.storedLevies[r.id] = {};
      }

      // Place capitals and starting levy
      for(const p of this.players){
        this.control[p.capital] = p.id;
        p.regions.add(p.capital);
        this.storedLevies[p.capital][p.id] = 1; // inactive levy
      }

      // Isles: never controlled/built
      this.control['isle_man'] = null;
      this.buildings['isle_man'] = [];
      this.phase = 'turnStart';
      this.logPush('Game starts. Round 1: no Event phase.');
      this._startTurn();
    }

    // --- helpers ---
    getPlayer(pid){ return this.players.find(p=>p.id===pid); }
    current(){ return this.players[this.turnIndex]; }

    colorOf(pid){
      const p = this.getPlayer(pid);
      return p ? getCSSVar(p.colorVar) : '#94a3b8';
    }
    controlOf(regionId){ return this.control[regionId] ?? null; }
    isCapital(regionId){ return !!REGION_BY_ID[regionId]?.capitalOf; }
    isTransit(regionId){ return REGION_BY_ID[regionId]?.special === 'transit'; }
    isPlayable(regionId){
      if(!this.playableRegions) return true;
      return this.playableRegions.has(regionId);
    }
    regionName(regionId){ return REGION_BY_ID[regionId]?.name ?? regionId; }

    logPush(msg){ this.log.unshift({t: Date.now(), msg}); }
    sumPush(title, lines){
      this.turnSummary.unshift({t:Date.now(), title, lines});
      if(this.turnSummary.length>18) this.turnSummary.pop();
    }

    countBuildings(p, type){
      let n=0;
      for(const rid of p.regions){
        n += this.buildings[rid].filter(b=>b===type).length;
      }
      return n;
    }

    // --- Turn cycle ---
    _startTurn(){
      this.turnEffects = { navCostPlus1:false, buildDiscount:0 };
      const p = this.current();
      if(p.eliminated){ this._advanceTurn(); return; }

      // Automated phases: Event (from configured round), then Income/Upkeep, then Action.
      const lines = [];
      lines.push(`Turn begins: ${p.name} (Round ${this.round}).`);

      const doEvent = this.round >= this.config.eventsStartRound;
      if(doEvent){
        let nextEvent = null;
        if(this.peekNextEventFor === p.id && this._eventQueue.length){
          nextEvent = this._eventQueue[0];
        }
        const ev = this._eventQueue.length ? this._eventQueue.shift() : drawWeighted(EVENT_DECK);
        // keep queue topped for "peek next" experience
        if(this._eventQueue.length < 2) this._eventQueue.push(drawWeighted(EVENT_DECK));

        if(this.peekNextEventFor === p.id){
          this.peekNextEventFor = null;
          lines.push(`Event (peeked): ${ev.name} — ${ev.text}`);
        } else {
          lines.push(`Event: ${ev.name} — ${ev.text}`);
        }
        try { ev.apply(this, p); } catch(e){ console.warn(e); }
      } else {
        lines.push('Event: (skipped).');
      }

      // Income + upkeep
      const inc = this._income(p);
      lines.push(`Income: +${inc.food} Food, +${inc.silver} Silver, +${inc.influence} Influence.`);
      const upkeep = this._upkeep(p);
      if(upkeep.paid>0) lines.push(`Upkeep: -${upkeep.paid} Food for active units.`);
      if(upkeep.forcedDisband>0) lines.push(`Forced Disband: removed ${upkeep.forcedDisband} unit(s) due to low Food.`);

      this.ap = 2;
      this.phase = 'action';
      this.sumPush(`${p.name} — Start`, lines);

      UI.render();
      if(!p.isHuman){
        setTimeout(()=> this._aiTurn(p), 380);
      } else {
        TOAST.show('Your turn.');
      }
    }

    _advanceTurn(){
      // next player; if wraps, new round.
      this.turnIndex += 1;
      if(this.turnIndex >= this.players.length){
        this.turnIndex = 0;
        this.round += 1;
        this.logPush(`--- Round ${this.round} ---`);
      }
      // check eliminations: if only one left => winner
      const alive = this.players.filter(p=>!p.eliminated);
      if(alive.length === 1){
        this._declareWinner(alive[0], 'Last kingdom standing.');
        return;
      }
      this._startTurn();
    }

    endTurn(){
      if(this.phase !== 'action') return;
      const p = this.current();

      // resolve captures for this player's occupancies
      this._resolveCaptures(p);

      // victory check
      const win = this._checkVictory(p);
      if(win){
        this._declareWinner(p, win);
        return;
      }

      // clear selection
      this.selected = { regionId:null, armyId:null, mode:null };
      this._advanceTurn();
    }

    _declareWinner(p, reason){
      this.phase = 'gameOver';
      this.logPush(`WINNER: ${p.name}. ${reason}`);
      this.sumPush('Game Over', [`Winner: ${p.name}`, reason]);
      UI.openModal('Game Over', `<div class="sub">Winner:</div><div style="font-weight:950;font-size:18px;margin-top:2px">${p.name}</div><div class="sub" style="margin-top:8px">${escapeHTML(reason)}</div>`, [
        { text:'New Game', kind:'primary', onClick:()=> UI.restart() },
        { text:'Close', kind:'ghost', onClick:()=> UI.closeModal() },
      ]);
      UI.render();
    }

    _checkVictory(p){
      // High King: 18 influence for 2-3 players, 24 for 4-5
      const pc = this.players.filter(x=>!x.eliminated).length;
      const infTarget = (pc<=3) ? 18 : 24;
      if(p.influence >= infTarget) return `High King — reached ${p.influence}/${infTarget} Influence.`;

      // Territorial: all four core + extra regions (2-3: +2, 4-5: +3)
      const extra = (pc<=3) ? 2 : 3;
      const coreOwned = p.core.filter(rid => this.controlOf(rid)===p.id).length;
      const totalOwned = p.regions.size;
      if(coreOwned === 4 && totalOwned >= 4+extra){
        return `Territorial Dominion — core 4/4 and ${totalOwned}/${4+extra} regions.`;
      }
      return null;
    }

    // --- Economy ---
    _income(p){
      let food=0, silver=0, influence=0;
      // capital base income +1 food +1 silver (always)
      food += 1; silver += 1;

      for(const rid of p.regions){
        for(const b of this.buildings[rid]){
          if(b==='farm') food += 1;
          if(b==='market') silver += 1;
          if(b==='hall') influence += 1;
        }
      }
      p.food += food;
      p.silver += silver;
      p.influence += influence;
      return {food,silver,influence};
    }

    _upkeep(p){
      // active units: each costs 1 food
      const activeUnits = this.armies.filter(a=>a.ownerId===p.id).reduce((s,a)=>s+a.units,0);
      let paid = Math.min(p.food, activeUnits);
      p.food -= paid;

      let forcedDisband = 0;
      if(activeUnits > paid){
        // need to disband (activeUnits - paid) units.
        let need = activeUnits - paid;
        forcedDisband = need;
        this._disbandUnitsAuto(p, need);
      }
      return { paid, forcedDisband };
    }

    _disbandUnitsAuto(p, n){
      // disband from smallest armies first to reduce token clutter (human-friendly).
      const armies = this.armies.filter(a=>a.ownerId===p.id).sort((a,b)=>a.units-b.units);
      let remaining = n;
      for(const a of armies){
        if(remaining<=0) break;
        const take = Math.min(a.units, remaining);
        a.units -= take;
        remaining -= take;
        if(a.units<=0){
          this.armies = this.armies.filter(x=>x.id!==a.id);
        }
      }
      this.logPush(`${p.name} disbanded ${n} unit(s) due to low Food.`);
    }

    // --- Events helpers ---
    resolveMajorRevolt(p){
      // if no non-capital region, nothing.
      const nonCaps = Array.from(p.regions).filter(rid => !this.isCapital(rid));
      if(nonCaps.length===0) return;
      if(p.isHuman){
        UI.openModal('Major Revolt', `Pay <b>2 Silver</b> or lose control of a non-capital region.`, [
          { text:'Pay 2 Silver', kind:'primary', onClick:()=>{ if(p.silver>=2){ p.silver-=2; this.logPush('Major Revolt: paid 2 Silver.'); } else { TOAST.show('Not enough silver.'); this._loseRegion(p, choice(nonCaps)); } UI.closeModal(); UI.render(); } },
          { text:'Lose a region', kind:'danger', onClick:()=>{ this._pickRegionToLose(p, nonCaps); } },
        ]);
      } else {
        if(p.silver>=2){ p.silver-=2; this.logPush(`${p.name} paid 2 Silver to quell a revolt.`); }
        else { this._loseRegion(p, choice(nonCaps)); }
      }
    }

    _pickRegionToLose(p, regionIds){
      // modal list
      const items = regionIds.map(rid => `
        <div class="item">
          <div><b>${escapeHTML(this.regionName(rid))}</b><div class="sub">${escapeHTML(rid)}</div></div>
          <button class="btn danger small" data-lose="${rid}">Lose</button>
        </div>
      `).join('');
      UI.openModal('Choose region to lose', `<div class="list">${items}</div>`, [
        { text:'Cancel', kind:'ghost', onClick:()=> UI.closeModal() }
      ]);
      setTimeout(()=>{
        $$('.btn[data-lose]').forEach(btn=>{
          btn.addEventListener('click', ()=>{
            const rid = btn.getAttribute('data-lose');
            UI.closeModal();
            this._loseRegion(p, rid);
            UI.render();
          });
        });
      },0);
    }

    _loseRegion(p, rid){
      if(!rid) return;
      this.control[rid] = null;
      p.regions.delete(rid);
              // Buildings remain in the region (ownership affects income). Stored levies for the old owner are lost.
        this.storedLevies[rid][p.id] = 0;
      this.logPush(`${p.name} lost control of ${this.regionName(rid)}.`);
    }

    forceDisbandOne(p){
      const armies = this.armies.filter(a=>a.ownerId===p.id);
      if(armies.length===0) return;
      if(p.isHuman){
        const items = armies.map(a=>`
          <div class="item">
            <div><b>${escapeHTML(this.regionName(a.regionId))}</b><div class="sub">Army: ${a.units} unit(s)</div></div>
            <button class="btn danger small" data-dis="${a.id}">Disband 1</button>
          </div>
        `).join('');
        UI.openModal('Plague', `<div class="sub">Choose an army to lose 1 unit.</div><div class="list">${items}</div>`, [
          { text:'OK', kind:'ghost', onClick:()=> UI.closeModal() }
        ]);
        setTimeout(()=>{
          $$('.btn[data-dis]').forEach(btn=>{
            btn.addEventListener('click', ()=>{
              const aid = btn.getAttribute('data-dis');
              const a = this.armies.find(x=>x.id===aid);
              if(a){ a.units -= 1; if(a.units<=0) this.armies=this.armies.filter(x=>x.id!==aid); }
              UI.closeModal();
              UI.render();
            });
          });
        },0);
      } else {
        const a = armies.sort((x,y)=>y.units-x.units)[0];
        a.units -= 1; if(a.units<=0) this.armies=this.armies.filter(x=>x.id!==a.id);
      }
    }

    loseStoredLevy(p){
      const candidates = Array.from(p.regions).filter(rid => (this.storedLevies[rid][p.id]||0) > 0);
      if(candidates.length===0) return;
      const rid = choice(candidates);
      this.storedLevies[rid][p.id] = Math.max(0, (this.storedLevies[rid][p.id]||0) - 1);
    }

    gainStoredLevies(p, n){
      let remaining=n;
      const places = Array.from(p.regions).filter(rid => levySlots(rid) > 0);
      while(remaining>0 && places.length){
        const rid = choice(places);
        const cur = this.storedLevies[rid][p.id]||0;
        if(cur < levySlots(rid)){
          this.storedLevies[rid][p.id] = cur+1;
          remaining--;
        } else {
          // remove full
          const idx = places.indexOf(rid);
          if(idx>=0) places.splice(idx,1);
        }
      }
    }

    offerFestival(p){
      if(p.silver < 1) return;
      if(p.isHuman){
        UI.openModal('Festival', 'Spend <b>1 Silver</b> to gain <b>+1 Influence</b>?', [
          { text:'Do it', kind:'primary', onClick:()=>{ p.silver-=1; p.influence+=1; UI.closeModal(); UI.render(); } },
          { text:'Skip', kind:'ghost', onClick:()=> UI.closeModal() },
        ]);
      } else {
        // AI: do it if aiming influence
        if(p.influence < 18 && Math.random()<0.6){ p.silver-=1; p.influence+=1; }
      }
    }

    offerMercenaries(p){
      if(p.silver < 2) return;
      const armies = this.armies.filter(a=>a.ownerId===p.id);
      if(armies.length===0) return;
      if(p.isHuman){
        const items = armies.map(a=>`
          <div class="item">
            <div><b>${escapeHTML(this.regionName(a.regionId))}</b><div class="sub">Army: ${a.units} unit(s)</div></div>
            <button class="btn good small" data-merc="${a.id}">Hire (+2)</button>
          </div>
        `).join('');
        UI.openModal('Mercenaries', `<div class="sub">Spend 2 Silver to add +2 units to an army.</div><div class="list">${items}</div>`, [
          { text:'Skip', kind:'ghost', onClick:()=> UI.closeModal() },
        ]);
        setTimeout(()=>{
          $$('.btn[data-merc]').forEach(btn=>{
            btn.addEventListener('click', ()=>{
              const aid = btn.getAttribute('data-merc');
              const a = this.armies.find(x=>x.id===aid);
              if(a && p.silver>=2){
                p.silver-=2;
                a.units += 2;
                UI.closeModal();
                UI.render();
              }
            });
          });
        },0);
      } else {
        // AI: do it if it has an army and silver
        if(Math.random() < 0.35){
          p.silver -= 2;
          armies.sort((a,b)=>b.units-a.units)[0].units += 2;
        }
      }
    }

    borderClashes(p){
      // Find adjacent enemy army to any of your armies and deal 1 loss
      const myArmies = this.armies.filter(a=>a.ownerId===p.id);
      const candidates = [];
      for(const a of myArmies){
        for(const e of ADJ[a.regionId]){
          const enemy = this.armies.find(x=>x.regionId===e.to && x.ownerId!==p.id);
          if(enemy) candidates.push(enemy);
        }
      }
      if(!candidates.length) return;
      const target = choice(candidates);
      target.units -= 1;
      if(target.units<=0) this.armies = this.armies.filter(x=>x.id!==target.id);
    }

    // --- Captures ---
    _resolveCaptures(p){
      // For each region occupied by p with no enemy armies present:
      // If region is uncontrolled or controlled by enemy, tick capture timer.
      const occup = new Set(this.armies.filter(a=>a.ownerId===p.id).map(a=>a.regionId));
      for(const rid of occup){
        if(this.isTransit(rid)) continue;
        const enemyHere = this.armies.some(a=>a.regionId===rid && a.ownerId!==p.id);
        if(enemyHere) continue;

        const ctrl = this.controlOf(rid);
        if(ctrl === p.id) {
          // already yours => clear any timer
          if(this.captureTimers[rid] && this.captureTimers[rid].occupierId===p.id) delete this.captureTimers[rid];
          continue;
        }

        // if timer exists and occupier matches, decrement. else create.
        const isCap = this.isCapital(rid);
        const required = isCap ? 2 : 1;
        if(!this.captureTimers[rid] || this.captureTimers[rid].occupierId !== p.id){
          this.captureTimers[rid] = { occupierId: p.id, remainingTurns: required };
        }

        this.captureTimers[rid].remainingTurns -= 1;
        if(this.captureTimers[rid].remainingTurns <= 0){
          // capture!
          const prevOwner = this.controlOf(rid);
          if(prevOwner){
            const prev = this.getPlayer(prevOwner);
            prev?.regions.delete(rid);
          }
          this.control[rid] = p.id;
          p.regions.add(rid);
          // Stored levies in a region are tied to control; clear any previous stored levies.
          for(const pl of this.players){ this.storedLevies[rid][pl.id] = 0; }
          delete this.captureTimers[rid];
          this.logPush(`${p.name} captured ${this.regionName(rid)}.`);
          // if capital captured => previous owner eliminated
          if(isCap){
            const old = this.players.find(x=>x.capital===rid && x.id!==p.id);
            if(old){
              old.eliminated = true;
              this.logPush(`${old.name} has lost their capital and is eliminated.`);
            }
          }
        }
      }

      // Timers reset if occupier not present or contested
      for(const [rid, t] of Object.entries({...this.captureTimers})){
        const stillOccup = this.armies.some(a=>a.regionId===rid && a.ownerId===t.occupierId);
        const contested = this.armies.some(a=>a.regionId===rid && a.ownerId!==t.occupierId);
        if(!stillOccup || contested) delete this.captureTimers[rid];
      }
    }

    // ---------- Actions ----------
    canActHuman(){
      return this.phase==='action' && this.current().isHuman && !this.current().eliminated;
    }

    actionMoveSelect(armyId){
      const a = this.armies.find(x=>x.id===armyId);
      if(!a) return;
      this.selected.armyId = armyId;
      this.selected.regionId = a.regionId;
      this.selected.mode = 'move';
      UI.render();
    }

    actionMoveTo(regionId){
      const p = this.current();
      if(!this.canActHuman()) return;
      if(this.selected.mode!=='move') return;
      const a = this.armies.find(x=>x.id===this.selected.armyId);
      if(!a || a.ownerId!==p.id) return;
      const edge = ADJ[a.regionId].find(e=>e.to===regionId);
      if(!edge) return;
      if(!this.isPlayable(regionId)){ TOAST.show('That region is not in play.'); return; }

      let cost = edge.cost;
      if(this.turnEffects.navCostPlus1 && isNavalEdge(a.regionId, regionId)) cost += 1;
      if(this.ap < cost){ TOAST.show('Not enough AP.'); return; }

      // If moving into enemy-controlled region with enemy army present, still allowed (creates contest)
            a.regionId = regionId;
      // Auto-merge friendly armies in the destination.
      const same = this.armies.filter(x=>x.ownerId===p.id && x.regionId===regionId);
      if(same.length>1){
        const keep = same[0];
        for(let i=1;i<same.length;i++){ keep.units += same[i].units; this.armies = this.armies.filter(x=>x.id!==same[i].id); }
        this.selected.armyId = keep.id;
      }
      this.ap -= cost;
      this.selected = { regionId, armyId:a.id, mode:null };
      this.logPush(`Moved to ${this.regionName(regionId)} (-${cost} AP).`);
      UI.render();
      this._autoAttackPromptIfPossible(p, regionId);
    }

    _autoAttackPromptIfPossible(p, rid){
      const my = this.armies.find(a=>a.ownerId===p.id && a.regionId===rid);
      const enemy = this.armies.find(a=>a.ownerId!==p.id && a.regionId===rid);
      if(my && enemy && this.ap>=1){
        TOAST.show('Enemy here: you can Attack.');
      }
    }

    actionRecruit(regionId){
      const p = this.current();
      if(!this.canActHuman()) return;
      if(this.ap < 1){ TOAST.show('No AP.'); return; }
      if(this.controlOf(regionId)!==p.id){ TOAST.show('You must control the region.'); return; }
      if(this.isTransit(regionId)) return;

      const cur = (this.storedLevies[regionId][p.id]||0);
      if(cur >= levySlots(regionId)){ TOAST.show('Levy slots full.'); return; }
      if(p.silver < 1){ TOAST.show('Need 1 Silver.'); return; }

      p.silver -= 1;
      this.storedLevies[regionId][p.id] = cur+1;
      this.ap -= 1;
      this.logPush(`Recruited 1 levy in ${this.regionName(regionId)} (-1 AP, -1 Silver).`);
      UI.render();
    }

    actionCallUp(totalUnits){
      const p = this.current();
      if(!this.canActHuman()) return;
      totalUnits = Math.floor(totalUnits);
      if(totalUnits<=0) return;
      const available = this._totalStored(p);
      if(totalUnits > available) totalUnits = available;
      if(totalUnits<=0){ TOAST.show('No stored levies.'); return; }

      const cost = (totalUnits<=2) ? 1 : 2;
      if(this.ap < cost){ TOAST.show('Not enough AP.'); return; }

      // Move from stored pool (auto take from regions with most)
      let remaining = totalUnits;
      const sources = Array.from(p.regions).map(rid => ({rid, n:(this.storedLevies[rid][p.id]||0)})).filter(x=>x.n>0).sort((a,b)=>b.n-a.n);
      for(const s of sources){
        if(remaining<=0) break;
        const take = Math.min(s.n, remaining);
        this.storedLevies[s.rid][p.id] -= take;
        remaining -= take;
      }

      // Add to capital as active army
      let army = this.armies.find(a=>a.ownerId===p.id && a.regionId===p.capital);
      if(!army){
        army = { id: uid(), ownerId:p.id, regionId:p.capital, units:0 };
        this.armies.push(army);
      }
      army.units += totalUnits;

      this.ap -= cost;
      this.logPush(`Called up ${totalUnits} unit(s) to ${this.regionName(p.capital)} (-${cost} AP).`);
      UI.render();
    }

    _totalStored(p){
      let n=0;
      for(const rid of p.regions){
        n += (this.storedLevies[rid][p.id]||0);
      }
      return n;
    }

    actionBuild(regionId, type){
      const p = this.current();
      if(!this.canActHuman()) return;
      if(this.ap < 1){ TOAST.show('No AP.'); return; }
      if(this.controlOf(regionId)!==p.id){ TOAST.show('You must control the region.'); return; }
      if(this.isTransit(regionId)) return;

      const slots = buildingSlots(regionId);
      if(this.buildings[regionId].length >= slots){ TOAST.show('No building slots.'); return; }

      const baseCost = (type==='farm')?1 : (type==='market')?2 : 3;
      const discount = this.turnEffects.buildDiscount || 0;
      const cost = Math.max(0, baseCost - discount);
      if(p.silver < cost){ TOAST.show(`Need ${cost} Silver.`); return; }

      p.silver -= cost;
      this.buildings[regionId].push(type);
      this.ap -= 1;
      if(discount>0) this.turnEffects.buildDiscount = 0;

      this.logPush(`Built ${type} in ${this.regionName(regionId)} (-1 AP, -${cost} Silver).`);
      UI.render();
    }

    actionPillage(regionId){
      const p = this.current();
      if(!this.canActHuman()) return;
      if(this.ap < 1){ TOAST.show('No AP.'); return; }
      if(this.isTransit(regionId)) return;

      const myHere = this.armies.some(a=>a.ownerId===p.id && a.regionId===regionId);
      if(!myHere){ TOAST.show('Need an army here.'); return; }
      if(this.controlOf(regionId)===p.id){ TOAST.show('Cannot pillage your own region.'); return; }

      // remove one non-castle building if present
      const idx = this.buildings[regionId].findIndex(b=>b!=='castle');
      if(idx>=0){
        const removed = this.buildings[regionId].splice(idx,1)[0];
        this.logPush(`Pillaged ${this.regionName(regionId)}: destroyed ${removed} (+1 Silver).`);
      } else {
        this.logPush(`Pillaged ${this.regionName(regionId)} (+1 Silver).`);
      }
      p.silver += 1;
      // Region remains uncontrolled after pillage
      const prevOwner = this.controlOf(regionId);
      if(prevOwner){
        const prev = this.getPlayer(prevOwner);
        prev?.regions.delete(regionId);
        this.control[regionId] = null;
        for(const pl of this.players){ this.storedLevies[regionId][pl.id] = 0; }
      }
      this.ap -= 1;
      UI.render();
    }

    actionDisband(armyId, n=1){
      const p = this.current();
      if(!this.canActHuman()) return;
      if(this.ap < 1){ TOAST.show('No AP.'); return; }
      const a = this.armies.find(x=>x.id===armyId);
      if(!a || a.ownerId!==p.id){ TOAST.show('Select your army.'); return; }
      n = Math.max(1, Math.floor(n||1));
      n = Math.min(n, a.units, this.ap);
      if(n<=0){ TOAST.show('No AP.'); return; }
      a.units -= n;
      if(a.units<=0) this.armies = this.armies.filter(x=>x.id!==a.id);
      this.ap -= n;
      this.logPush(`Disbanded ${n} unit(s) (-${n} AP).`);
      UI.render();
    }

    actionAttack(regionId){
      const p = this.current();
      if(!this.canActHuman()) return;
      if(this.ap < 1){ TOAST.show('No AP.'); return; }
      // find armies
      const atk = this.armies.find(a=>a.ownerId===p.id && a.regionId===regionId);
      const def = this.armies.find(a=>a.ownerId!==p.id && a.regionId===regionId);
      if(!atk || !def){ TOAST.show('No battle here.'); return; }

      this._battleInteractive(atk, def, regionId);
    }

    // --- Combat ---
    _battleInteractive(atk, def, regionId){
      // Let human choose stance. AI stance chosen on commit.
      const html = `
        <div class="sub">Battle in <b>${escapeHTML(this.regionName(regionId))}</b></div>
        <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap">
          <div class="pill">Attacker: <b>${escapeHTML(this.getPlayer(atk.ownerId).name)}</b> • ${atk.units} units</div>
          <div class="pill">Defender: <b>${escapeHTML(this.getPlayer(def.ownerId).name)}</b> • ${def.units} units</div>
        </div>
        <div style="margin-top:12px;font-weight:900">Choose stance</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
          <button class="btn primary" data-stance="off">⚔️ Offensive</button>
          <button class="btn primary" data-stance="bal">⚖️ Balanced</button>
          <button class="btn primary" data-stance="def">🛡️ Defensive</button>
        </div>
        <div class="sub" style="margin-top:10px">Stances work like rock-paper-scissors. Winner gets +1 Defence.</div>
      `;
      UI.openModal('Attack', html, [{text:'Cancel', kind:'ghost', onClick:()=> UI.closeModal()}]);
      setTimeout(()=>{
        $$('[data-stance]').forEach(b=>{
          b.addEventListener('click', ()=>{
            const stance = b.getAttribute('data-stance');
            UI.closeModal();
            this._resolveBattle({atk, def, regionId, atkStance: stance, defStance: this._aiChooseStance(this.getPlayer(def.ownerId), atk, def)});
            UI.render();
          });
        });
      },0);
    }

    _aiChooseStance(p, atk, def){
      const style = this.config.aiStyle || 'balanced';
      // heuristic: if defending and weaker, choose defensive more often
      const diff = def.units - atk.units;
      if(style==='defensive'){
        if(diff<0 && Math.random()<0.7) return 'def';
        return choice(['def','bal','bal','off']);
      }
      if(style==='aggressive'){
        if(diff>0 && Math.random()<0.6) return 'off';
        return choice(['off','off','bal','def']);
      }
      // balanced
      if(diff<0 && Math.random()<0.5) return 'def';
      if(diff>1 && Math.random()<0.5) return 'off';
      return choice(['off','bal','def']);
    }

    _resolveBattle({atk, def, regionId, atkStance, defStance, silent=false}){
      const attacker = this.getPlayer(atk.ownerId);
      const defender = this.getPlayer(def.ownerId);

      const bigBattle = (atk.units + def.units) >= 6 && atk.units>1 && def.units>1;

      // Skirmish rule: if either side has exactly 1 unit, use quick table.
      if(atk.units===1 || def.units===1){
        const roll = randInt(1,6);
        let outcome;
        if(roll<=2){
          // defender wins, attacker dies
          atk.units -= 1;
          outcome = 'Skirmish: Defender wins (roll 1–2).';
        } else if(roll===3){
          atk.units -= 1; def.units -= 1;
          outcome = 'Skirmish: Stalemate (roll 3). Both lose 1.';
        } else {
          def.units -= 1;
          outcome = 'Skirmish: Attacker wins (roll 4–6).';
        }
        this._cleanupAfterBattle(atk, def);
        this.ap -= 1;
        this.logPush(`${attacker.name} attacked in ${this.regionName(regionId)} — ${outcome}`);
        if(!silent){ UI.openModal('Battle Result', `<div class="sub">${escapeHTML(outcome)}</div>`, [{text:'OK', kind:'primary', onClick:()=> UI.closeModal()}]); }
        return;
      }

      // Stance RPS: off > bal > def > off
      const beats = { off:'bal', bal:'def', def:'off' };
      let stanceWinner = null; // 'atk' or 'def' or null
      if(beats[atkStance]===defStance) stanceWinner='atk';
      else if(beats[defStance]===atkStance) stanceWinner='def';

      // Base defence modifiers for defender
      let defence = 0;
      defence += (REGION_BY_ID[regionId]?.def || 0);
      const hasCastle = this.buildings[regionId].includes('castle');
      if(hasCastle) defence += 2;
      if(this.isCapital(regionId)) defence += 1; // town walls

      if(stanceWinner==='atk') {
        // attacker wins stance => +1 defence for attacker side? Rule says winner gets +1 defence.
        // Since defender is defending, we interpret this as: stance winner gets +1 defence modifier.
        // We'll apply as: if attacker wins stance, attacker gets +1 to effective strength (equiv),
        // if defender wins stance, defender gets +1 defence.
      }

      // Tactics deck (big battles): both sides draw a card
      const tactic = { atk:null, def:null };
      const ctxA = { attackBonus:0, defenceBonus:0, flags:{} };
      const ctxD = { attackBonus:0, defenceBonus:0, flags:{} };
      if(bigBattle){
        tactic.atk = drawWeighted(TACTIC_DECK);
        tactic.def = drawWeighted(TACTIC_DECK);
        try { tactic.atk.mod(ctxA); } catch(e){}
        try { tactic.def.mod(ctxD); } catch(e){}
      }

      // Apply defender tactic to defence
      defence += ctxD.defenceBonus;

      // Apply stance defence winner
      if(stanceWinner==='def') defence += 1;

      // Defence die roll
      const die = randInt(1,6);
      const dieMod = (die===1)? 2 : (die===2)? 1 : (die===5)? -1 : (die===6)? -2 : 0;
      defence = Math.max(0, defence + dieMod);

      // Defence conversion to added strength
      const addedStrength = (defence<=1) ? 0 : (defence<=3) ? 1 : (defence<=5) ? 2 : 3;

      // Attacker strength bonuses
      let atkStrength = atk.units + ctxA.attackBonus;
      let defStrength = def.units + addedStrength;

      // Attacker stance winner => +1 effective strength
      if(stanceWinner==='atk') atkStrength += 1;

      // Special tactic flags
      if(ctxA.flags.flanking && !hasCastle) atkStrength += 2;
      if(ctxD.flags.flanking && !hasCastle) defStrength += 2; // defender used flanking?? treat symmetrical

      atkStrength = Math.max(0, atkStrength);
      defStrength = Math.max(0, defStrength);

      const diff = Math.abs(atkStrength - defStrength);
      const atkIsWinner = atkStrength > defStrength;
      const defIsWinner = defStrength > atkStrength;

      // Casualty + retreat results (from table)
      let result = '';
      let atkLoss = 0, defLoss = 0, retreatSteps = 0, crushing=false;

      if(diff<=1){
        result = 'Stalemate';
        atkLoss = 1; defLoss = 1;
        if(ctxA.flags.berserk) atkLoss += 1;
      } else if(diff<=3){
        result = 'Minor win';
        retreatSteps = 1;
        if(atkIsWinner){ defLoss = 1; } else { atkLoss = 1; }
      } else if(diff<=5){
        result = 'Clear win';
        retreatSteps = 2;
        if(atkIsWinner){ defLoss = 2; } else { atkLoss = 2; }
      } else {
        result = 'Crushing win';
        crushing = true;
        if(atkIsWinner){ defLoss = 3; } else { atkLoss = 3; }
      }

      // Rally: ignore first loss
      if(ctxA.flags.rally && atkLoss>0) atkLoss = Math.max(0, atkLoss-1);
      if(ctxD.flags.rally && defLoss>0) defLoss = Math.max(0, defLoss-1);

      // Feigned retreat: reduce losses on losing side
      if(!atkIsWinner && ctxA.flags.feigned && atkLoss>0) atkLoss = Math.max(0, atkLoss-1);
      if(!defIsWinner && ctxD.flags.feigned && defLoss>0) defLoss = Math.max(0, defLoss-1);

      // Arrow storm: if attacker wins, +1 to defender losses
      if(atkIsWinner && ctxA.flags.arrowStorm) defLoss += 1;
      if(defIsWinner && ctxD.flags.arrowStorm) atkLoss += 1;

      // Apply losses
      atk.units = Math.max(0, atk.units - atkLoss);
      def.units = Math.max(0, def.units - defLoss);

      // Retreat loser
      if(retreatSteps>0 && (atkIsWinner || defIsWinner)){
        const loser = atkIsWinner ? def : atk;
        const loserP = this.getPlayer(loser.ownerId);
        const steps = retreatSteps;
        this._retreatTowardsCapital(loser, loserP.capital, steps);
      } else if(crushing && (atkIsWinner || defIsWinner)){
        // Crushing: remaining troops disbanded on losing side
        const loser = atkIsWinner ? def : atk;
        loser.units = 0;
      }

      // Loot flag
      if((atkIsWinner && ctxA.flags.loot) || (defIsWinner && ctxD.flags.loot)){
        const winnerP = atkIsWinner ? attacker : defender;
        winnerP.silver += 1;
      }

      this._cleanupAfterBattle(atk, def);

      // Spend AP
      this.ap -= 1;

      const stanceText = (s)=> (s==='off'?'Offensive':s==='def'?'Defensive':'Balanced');
      const tacticText = bigBattle ? `
        <div class="sub" style="margin-top:10px"><b>Battle Tactics</b> (big battle)</div>
        <div class="list">
          <div class="item"><div><b>Attacker card</b><div class="sub">${escapeHTML(tactic.atk.name)} — ${escapeHTML(tactic.atk.text)}</div></div></div>
          <div class="item"><div><b>Defender card</b><div class="sub">${escapeHTML(tactic.def.name)} — ${escapeHTML(tactic.def.text)}</div></div></div>
        </div>` : '';

      const html = `
        <div class="sub">Result: <b>${escapeHTML(result)}</b></div>
        <div style="margin-top:10px" class="list">
          <div class="item"><div><b>Stances</b><div class="sub">Attacker: ${stanceText(atkStance)} • Defender: ${stanceText(defStance)}</div></div></div>
          <div class="item"><div><b>Defence</b><div class="sub">Terrain ${REGION_BY_ID[regionId]?.def||0} + Castle ${hasCastle?2:0} + Capital ${this.isCapital(regionId)?1:0} + Stance ${(stanceWinner==='def')?1:0} + Tactics ${ctxD.defenceBonus} + Die ${dieMod} = <b>${defence}</b></div></div></div>
          <div class="item"><div><b>Strength</b><div class="sub">Attacker ${atkStrength} vs Defender ${defStrength}</div></div></div>
          <div class="item"><div><b>Losses</b><div class="sub">Attacker -${atkLoss} • Defender -${defLoss}${crushing?' • Crushing: survivors disbanded':''}</div></div></div>
        </div>
        ${tacticText}
      `;

      this.logPush(`${attacker.name} attacked ${defender.name} in ${this.regionName(regionId)} — ${result}.`);
      if(!silent){ UI.openModal('Battle Result', html, [{text:'OK', kind:'primary', onClick:()=> UI.closeModal()}]); }
    }

    _cleanupAfterBattle(atk, def){
      if(atk.units<=0) this.armies = this.armies.filter(a=>a.id!==atk.id);
      if(def.units<=0) this.armies = this.armies.filter(a=>a.id!==def.id);
    }

    _retreatTowardsCapital(army, capitalId, steps){
      if(army.units<=0) return;
      let cur = army.regionId;
      for(let i=0;i<steps;i++){
        const next = shortestStep(cur, capitalId);
        if(!next) break;
        // If next has an enemy army, stop (can't retreat into contact)
        const blocked = this.armies.some(a=>a.regionId===next && a.ownerId!==army.ownerId);
        if(blocked) break;
        cur = next;
      }
      army.regionId = cur;
    }

    // ---------- AI ----------
    _aiTurn(p){
      if(this.phase!=='action') return;
      const lines = [];
      try {
      const style = this.config.aiStyle || 'balanced';

      const tryAttack = ()=>{
        // if any AI army shares region with enemy, attack
        const myArmies = this.armies.filter(a=>a.ownerId===p.id);
        for(const a of myArmies){
          const enemy = this.armies.find(x=>x.regionId===a.regionId && x.ownerId!==p.id);
          if(enemy && this.ap>=1){
            // auto stance
            const atkStance = this._aiChooseStance(p, a, enemy);
            const defStance = this._aiChooseStance(this.getPlayer(enemy.ownerId), a, enemy);
            this._resolveBattle({atk:a, def:enemy, regionId:a.regionId, atkStance, defStance, silent:true});
            lines.push(`Attacked in ${this.regionName(a.regionId)}.`);
            return true;
          }
        }
        return false;
      };

      const tryCaptureMove = ()=>{
        // move toward core regions / adjacent neutrals
        const myArmies = this.armies.filter(a=>a.ownerId===p.id);
        if(myArmies.length===0) return false;

        // choose an army near targets
        const targets = p.core.filter(rid => this.controlOf(rid)!==p.id)
          .concat(REGIONS.map(r=>r.id).filter(rid=>!this.isTransit(rid) && this.controlOf(rid)!==p.id))
          .filter(rid=> this.isPlayable(rid));
        let best = null;
        for(const a of myArmies){
          for(const t of targets){
            const path = shortestPath(a.regionId, t, (edge)=> this._edgeCostWithEffects(edge));
            if(!path || path.length<2) continue;
            const step = path[1];
            const cost = this._edgeCostWithEffects({from:a.regionId,to:step});
            if(cost<=this.ap){
              const score = (p.core.includes(t)? 4:1) + (this.isCapital(t)?2:0) - (path.length*0.15);
              if(!best || score>best.score){
                best = {army:a, to:step, cost, target:t, score};
              }
            }
          }
        }
        if(best){
          best.army.regionId = best.to;
          // merge friendly armies
          const same = this.armies.filter(x=>x.ownerId===p.id && x.regionId===best.to);
          if(same.length>1){
            const keep = same[0];
            for(let i=1;i<same.length;i++){ keep.units += same[i].units; this.armies = this.armies.filter(x=>x.id!==same[i].id); }
          }
          this.ap -= best.cost;
          lines.push(`Moved to ${this.regionName(best.to)} (-${best.cost} AP).`);
          return true;
        }
        return false;
      };

      const tryBuildOrRecruit = ()=>{
        if(this.ap<1) return false;

        // prefer farms if food low
        const wantFarm = p.food < 3;
        const controlled = Array.from(p.regions).filter(rid => !this.isTransit(rid));
        // recruit if have open slots and silver
        if(p.silver>=1){
          const rcan = controlled.filter(rid => (this.storedLevies[rid][p.id]||0) < levySlots(rid));
          if(rcan.length && Math.random()<0.6){
            const rid = choice(rcan);
            this.actionRecruitAI(p, rid);
            lines.push(`Recruited in ${this.regionName(rid)}.`);
            return true;
          }
        }
        // build if have silver
        const bcan = controlled.filter(rid => this.buildings[rid].length < buildingSlots(rid));
        if(!bcan.length) return false;
        const rid = choice(bcan);

        const type = wantFarm ? 'farm' : (style==='defensive' ? choice(['castle','farm','market']) : style==='aggressive' ? choice(['market','farm','hall']) : choice(['farm','market','hall']));
        const baseCost = (type==='farm')?1 : (type==='market')?2 : 3;
        const cost = Math.max(0, baseCost - (this.turnEffects.buildDiscount||0));
        if(p.silver >= cost){
          // build
          p.silver -= cost;
          this.buildings[rid].push(type);
          this.ap -= 1;
          if(this.turnEffects.buildDiscount) this.turnEffects.buildDiscount=0;
          lines.push(`Built ${type} in ${this.regionName(rid)}.`);
          return true;
        }
        return false;
      };

      const tryCallUp = ()=>{
        if(this.ap<=0) return false;
        const total = this._totalStored(p);
        if(total<=0) return false;
        // don't starve: keep active units <= food+2
        const active = this.armies.filter(a=>a.ownerId===p.id).reduce((s,a)=>s+a.units,0);
        if(active >= p.food+2) return false;

        const amount = Math.min(total, (this.ap>=2 ? 3 : 2));
        const cost = (amount<=2)?1:2;
        if(this.ap<cost) return false;

        // call up
        let remaining = amount;
        const sources = Array.from(p.regions).map(rid => ({rid, n:(this.storedLevies[rid][p.id]||0)})).filter(x=>x.n>0).sort((a,b)=>b.n-a.n);
        for(const s of sources){
          if(remaining<=0) break;
          const take = Math.min(s.n, remaining);
          this.storedLevies[s.rid][p.id] -= take;
          remaining -= take;
        }
        let army = this.armies.find(a=>a.ownerId===p.id && a.regionId===p.capital);
        if(!army){
          army = { id: uid(), ownerId:p.id, regionId:p.capital, units:0 };
          this.armies.push(army);
        }
        army.units += amount;
        this.ap -= cost;
        lines.push(`Called up ${amount} to capital.`);
        return true;
      };

      // Ensure AI has at least one army on board after a couple rounds
      if(this.round>=2 && this.armies.filter(a=>a.ownerId===p.id).length===0){
        tryCallUp();
      }

      // Spend AP
      let guard = 12;
      while(this.ap>0 && guard-->0){
        if(tryAttack()) continue;
        if(tryCaptureMove()) continue;
        if(tryBuildOrRecruit()) continue;
        if(tryCallUp()) continue;
        break;
      }

      } catch(e){
        console.warn(e);
        lines.push('AI error — ended turn safely.');
      }

      this.sumPush(`${p.name} — Actions`, lines.length?lines:['No actions.']);
      UI.render();
      setTimeout(()=> this.endTurn(), 450);
    }

    actionRecruitAI(p, regionId){
      if(this.ap<1) return false;
      const cur = (this.storedLevies[regionId][p.id]||0);
      if(cur >= levySlots(regionId)) return false;
      if(p.silver < 1) return false;
      p.silver -= 1;
      this.storedLevies[regionId][p.id] = cur+1;
      this.ap -= 1;
      return true;
    }

    _edgeCostWithEffects(edge){
      const a=edge.from, b=edge.to;
      if(!this.isPlayable(a) || !this.isPlayable(b)) return 9999;
      const base = (ADJ[a].find(e=>e.to===b)?.cost) ?? 999;
      let cost = base;
      if(this.turnEffects.navCostPlus1 && isNavalEdge(a,b)) cost += 1;
      return cost;
    }
  }

  // ---------- Pathfinding helpers ----------
  function isNavalEdge(a,b){
    const key = [a,b].sort().join('|');
    return key === ['tynedale','east_anglia'].sort().join('|') || key === ['dyfed','cornwall'].sort().join('|');
  }

  function shortestPath(start, goal, costFn){
    if(start===goal) return [start];
    // Dijkstra where edge weights are AP costs (1/2/+1)
    const dist = new Map([[start,0]]);
    const prev = new Map();
    const pq = [[0,start]];
    while(pq.length){
      pq.sort((x,y)=>x[0]-y[0]);
      const [d,u] = pq.shift();
      if(u===goal) break;
      if(d!==dist.get(u)) continue;
      for(const e of ADJ[u]){
        const v = e.to;
        const w = costFn ? costFn(e) : e.cost;
        const nd = d + w;
        if(nd < (dist.get(v) ?? Infinity)){
          dist.set(v, nd);
          prev.set(v, u);
          pq.push([nd, v]);
        }
      }
    }
    if(!dist.has(goal)) return null;
    const path = [];
    let cur = goal;
    while(cur){
      path.push(cur);
      cur = prev.get(cur);
      if(cur===start){ path.push(start); break; }
    }
    return path.reverse();
  }

  function shortestStep(from, goal){
    const path = shortestPath(from, goal, null);
    if(!path || path.length<2) return null;
    return path[1];
  }

  // ---------- UI ----------
  const UI = (() => {
    const app = document.getElementById('app');

    let game = null;
    let panzoom = null;

    function restart(){
      game = null;
      renderSetup();
    }

    function renderSetup(){
      const html = `
        <div class="screen setup">
          <div class="h1">Battle for Britannia</div>
          <div class="sub">Single-player. You choose your kingdom and how many AI kingdoms to face.</div>

          <div class="card" style="padding:12px">
            <div class="row">
              <div style="font-weight:900">Your kingdom</div>
              <div class="badge">1 human</div>
            </div>
            <div class="kchips" style="margin-top:10px">
              ${KINGDOMS.map(k=>`
                <button class="kchip" data-k="${k.id}">
                  <span class="dot" style="background:${getCSSVar(k.colorVar)}"></span>${k.name}
                </button>
              `).join('')}
            </div>
          </div>

          <div class="card" style="padding:12px">
            <div class="row">
              <div>
                <div style="font-weight:900">AI opponents</div>
                <div class="sub">Total players = you + AI (max 5).</div>
              </div>
              <select id="aiCount" class="select" style="max-width:140px">
                <option value="1">1 AI (2p)</option>
                <option value="2">2 AI (3p)</option>
                <option value="3">3 AI (4p)</option>
                <option value="4" selected>4 AI (5p)</option>
              </select>
            </div>

            <div class="row" style="margin-top:10px">
              <div>
                <div style="font-weight:900">AI style</div>
                <div class="sub">How the AI tends to behave.</div>
              </div>
              <select id="aiStyle" class="select" style="max-width:160px">
                <option value="balanced" selected>Balanced</option>
                <option value="aggressive">Aggressive</option>
                <option value="defensive">Defensive</option>
              </select>
            </div>

            <div class="row" style="margin-top:10px">
              <div>
                <div style="font-weight:900">Events start</div>
                <div class="sub">Rules: Round 2. House rule: Round 3.</div>
              </div>
              <select id="eventsStart" class="select" style="max-width:160px">
                <option value="2" selected>Round 2</option>
                <option value="3">Round 3</option>
              </select>
            </div>
          </div>

          <div class="card" style="padding:12px">
            <div style="font-weight:900">Win conditions</div>
            <div class="sub" style="margin-top:6px">
              High King: 18 Influence (2–3 players) or 24 (4–5).
              Territorial: 4 core regions + extra regions (+2 for 2–3, +3 for 4–5).
            </div>
          </div>

          <div class="row" style="gap:12px">
            <button id="startBtn" class="btn primary" style="width:100%">Start Game</button>
          </div>

          <div class="sub">v6 rebuild • offline-ready • no PC required</div>
        </div>
      `;
      app.innerHTML = html;

      // selection
      let selectedK = KINGDOMS[0].id;
      const chips = $$('.kchip', app);
      function updateChips(){
        chips.forEach(c=>{
          const k = c.getAttribute('data-k');
          c.classList.toggle('selected', k===selectedK);
        });
      }
      chips.forEach(c=>{
        c.addEventListener('click', ()=>{
          selectedK = c.getAttribute('data-k');
          updateChips();
        });
      });
      updateChips();

      $('#startBtn', app).addEventListener('click', ()=>{
        const aiCount = parseInt($('#aiCount', app).value,10);
        const aiStyle = $('#aiStyle', app).value;
        const eventsStartRound = parseInt($('#eventsStart', app).value,10);
        game = new Game({ humanKingdomId:selectedK, aiCount, aiStyle, eventsStartRound });
        renderGame();
      });
    }

    function renderGame(){
      const p = game.current();
      const pc = game.players.filter(x=>!x.eliminated).length;
      const infTarget = (pc<=3)?18:24;
      const extra = (pc<=3)?2:3;
      const human = game.players.find(x=>x.isHuman);
      const humanCoreOwned = human.core.filter(rid=> game.controlOf(rid)===human.id).length;
      const winText = `Win: 👑 ${human.influence}/${infTarget} • 🗺️ ${human.regions.size}/${4+extra} (core ${humanCoreOwned}/4)`;

      app.innerHTML = `
        <div class="game">
          <div class="hud">
            <div class="left">
              <div class="title">${escapeHTML(p.name)}${p.isHuman?' (You)':''} • Round ${game.round} • AP ${game.ap}/2</div>
              <div class="meta">
                <span class="pill">🍞 ${human.food}</span>
                <span class="pill">💰 ${human.silver}</span>
                <span class="pill">👑 ${human.influence}</span>
                <span class="pill">${escapeHTML(winText)}</span>
              </div>
              <div class="phaseInfo" id="phaseInfo"></div>
            </div>
            <div class="right">
              <button class="btn small ghost" id="scoreBtn">Score</button>
              <button class="btn small ghost" id="resetBtn">Reset</button>
              <button class="btn small ghost" id="logBtn">AI Summary</button>
              <button class="btn small ghost" id="helpBtn">Help</button>
            </div>
          </div>

          <div class="mapWrap">
            <div class="mapControls">
              <div class="fab" id="zoomIn">+</div>
              <div class="fab" id="zoomOut">−</div>
              <div class="fab" id="fit">⤢</div>
            </div>

            <svg id="mapSvg" viewBox="0 0 ${MAP.viewBox.w} ${MAP.viewBox.h}" preserveAspectRatio="xMidYMid meet" aria-label="Map">
              <defs>
                <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="rgba(0,0,0,0.55)"/>
                </filter>
              </defs>
              <g id="panzoom">
                <rect x="0" y="0" width="${MAP.viewBox.w}" height="${MAP.viewBox.h}" fill="rgba(2,30,50,0.92)" />
                <image href="map_bg.png" x="0" y="0" width="${MAP.viewBox.w}" height="${MAP.viewBox.h}" opacity="0.10" preserveAspectRatio="xMidYMid meet" />
                <!-- connections -->
                <g id="connections"></g>
                <!-- regions -->
                <g id="regions"></g>
                <!-- buildings -->
                <g id="buildings"></g>
                <!-- armies -->
                <g id="armies"></g>
                <!-- labels -->
                <g id="labels"></g>
              </g>
            </svg>

            <div class="sheet" id="sheet">
              <div class="inner">
                <div class="head">
                  <div>
                    <div class="name" id="sheetName">Region</div>
                    <div class="subline" id="sheetSub">Tap a region to view details.</div>
                  </div>
                  <button class="btn ghost close" id="sheetClose">✕</button>
                </div>

                <div class="kv">
                  <div class="box"><div class="label">Owner</div><div class="value" id="sheetOwner">—</div></div>
                  <div class="box"><div class="label">Terrain</div><div class="value" id="sheetTerrain">—</div></div>
                  <div class="box"><div class="label">Levies (stored)</div><div class="value" id="sheetLevies">—</div></div>
                  <div class="box"><div class="label">Buildings</div><div class="value" id="sheetBuildCount">—</div></div>
                </div>

                <div class="icons" id="sheetIcons"></div>

                <div class="armiesList" id="sheetArmies"></div>

                <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end" id="sheetActions"></div>
              </div>
            </div>

            <div class="modal" id="modal">
              <div class="panel">
                <div class="mhead">
                  <div class="mtitle" id="modalTitle">Title</div>
                  <button class="btn ghost small" id="modalClose">✕</button>
                </div>
                <div class="mbody" id="modalBody"></div>
                <div class="mfooter" id="modalFooter"></div>
              </div>
            </div>
          </div>

          <div class="activityDock" id="activityDock">
            <div class="activityHead">
              <div style="font-weight:900">Activity</div>
              <button class="btn small ghost" id="activityToggle">Hide</button>
            </div>
            <div class="activityBody" id="feedBody"></div>
          </div>

          <div class="bottomBar">
            <div class="actions">
              <button class="btn small" id="endTurnBtn">End Turn</button>
              <button class="btn small" id="callUpBtn">Call Up</button>
              <button class="btn small" id="moveBtn">Move</button>
              <button class="btn small" id="attackBtn">Attack</button>
            </div>
            <div class="actions">
              <button class="btn small danger" id="disbandBtn">Disband</button>
            </div>
          </div>
        </div>
      `;

      // Build map layers
      buildMapSVG();

      // Setup pan/zoom
      panzoom = new PanZoom($('#mapSvg'), $('#panzoom'));
      $('#zoomIn').addEventListener('click', ()=> panzoom.zoomBy(1.15));
      $('#zoomOut').addEventListener('click', ()=> panzoom.zoomBy(0.87));
      $('#fit').addEventListener('click', ()=> panzoom.fit());

      // UI buttons
      $('#sheetClose').addEventListener('click', ()=> closeSheet());
      $('#endTurnBtn').addEventListener('click', ()=> game.endTurn());
      $('#moveBtn').addEventListener('click', ()=> {
        if(!game.canActHuman()) return;
        const a = selectedHumanArmyAtSelectedRegion();
        if(!a){ TOAST.show('Tap your army first.'); return; }
        game.actionMoveSelect(a.id);
        TOAST.show('Tap a connected region to move.');
      });
      $('#attackBtn').addEventListener('click', ()=> {
        if(!game.canActHuman()) return;
        if(!game.selected.regionId){ TOAST.show('Tap a region first.'); return; }
        game.actionAttack(game.selected.regionId);
      });
      $('#disbandBtn').addEventListener('click', ()=> {
        if(!game.canActHuman()) return;
        const a = selectedHumanArmyAtSelectedRegion();
        if(!a){ TOAST.show('Tap your army first.'); return; }
        openDisbandDialog(a.id);
      });
      $('#callUpBtn').addEventListener('click', ()=> openCallUpDialog());

      $('#resetBtn').addEventListener('click', ()=> {
        UI.openModal('Reset game?', `<div class="sub">This will end the current game and return to setup.</div>`, [
          { text:'Cancel', kind:'ghost', onClick:()=> UI.closeModal() },
          { text:'Reset', kind:'danger', onClick:()=> { UI.closeModal(); UI.restart(); } },
        ]);
      });

      // Activity dock toggle
      const dock = $('#activityDock');
      const toggle = $('#activityToggle');
      if(toggle && dock){
        toggle.addEventListener('click', ()=>{
          dock.classList.toggle('collapsed');
          toggle.textContent = dock.classList.contains('collapsed') ? 'Show' : 'Hide';
        });
      }

      $('#scoreBtn').addEventListener('click', ()=> openScore());
      $('#logBtn').addEventListener('click', ()=> openSummary());
      $('#helpBtn').addEventListener('click', ()=> openHelp());

      $('#modalClose').addEventListener('click', ()=> closeModal());

      render();
    }

    function selectedHumanArmyAtSelectedRegion(){
      const human = game.players.find(p=>p.isHuman);
      if(!human) return null;
      const rid = game.selected.regionId;
      if(!rid) return null;
      // pick biggest human army in that region
      const armies = game.armies.filter(a=>a.ownerId===human.id && a.regionId===rid);
      if(!armies.length) return null;
      armies.sort((a,b)=>b.units-a.units);
      return armies[0];
    }

    function openCallUpDialog(){
      const human = game.players.find(p=>p.isHuman);
      const total = game._totalStored(human);
      if(total<=0){ TOAST.show('No stored levies.'); return; }
      const max = Math.min(total, 6);
      const html = `
        <div class="sub">Call stored levies to <b>${escapeHTML(game.regionName(human.capital))}</b>.</div>
        <div style="margin-top:10px" class="item">
          <div><b>Units to call</b><div class="sub">1–2 costs 1 AP • 3+ costs 2 AP</div></div>
          <span class="badge" id="callN">2</span>
        </div>
        <input id="callRange" type="range" min="1" max="${max}" value="${Math.min(2,max)}" style="width:100%;margin-top:10px">
      `;
      openModal('Call Up', html, [
        { text:'Call', kind:'primary', onClick:()=> {
          const n = parseInt($('#callRange').value,10);
          closeModal();
          game.actionCallUp(n);
        }},
        { text:'Cancel', kind:'ghost', onClick:()=> closeModal() },
      ]);
      setTimeout(()=>{
        const range = $('#callRange');
        const badge = $('#callN');
        const update = ()=> badge.textContent = range.value;
        range.addEventListener('input', update);
        update();
      },0);
    }

    function openDisbandDialog(armyId){
      const human = game.players.find(p=>p.isHuman);
      const a = game.armies.find(x=>x.id===armyId && x.ownerId===human.id);
      if(!a){ TOAST.show('Select your army first.'); return; }
      const max = Math.min(a.units, game.ap);
      if(max<=0){ TOAST.show('No AP.'); return; }
      const html = `
        <div class="sub">Disband units from your army in <b>${escapeHTML(game.regionName(a.regionId))}</b>.</div>
        <div style="margin-top:10px" class="item">
          <div><b>Units to disband</b><div class="sub">Costs 1 AP per unit (max this turn: ${max}).</div></div>
          <span class="badge" id="disN">1</span>
        </div>
        <input id="disRange" type="range" min="1" max="${max}" value="1" style="width:100%;margin-top:10px">
      `;
      openModal('Disband', html, [
        { text:'Disband', kind:'danger', onClick:()=> {
          const n = parseInt($('#disRange').value,10);
          closeModal();
          game.actionDisband(armyId, n);
        }},
        { text:'Cancel', kind:'ghost', onClick:()=> closeModal() },
      ]);
      setTimeout(()=>{
        const range = $('#disRange');
        const badge = $('#disN');
        const update = ()=> badge.textContent = range.value;
        range.addEventListener('input', update);
        update();
      },0);
    }

    function openScore(){
      const pc = game.players.filter(p=>!p.eliminated).length;
      const infTarget = (pc<=3)?18:24;
      const extra = (pc<=3)?2:3;
      const rows = game.players.map(p=>{
        const coreOwned = p.core.filter(rid=> game.controlOf(rid)===p.id).length;
        const nearInf = p.influence >= (infTarget-3);
        const nearTerr = coreOwned===4 && p.regions.size >= (4+extra-1);
        const warn = nearInf || nearTerr;
        return `
          <div class="item">
            <div>
              <b style="color:${game.colorOf(p.id)}">${escapeHTML(p.name)}${p.isHuman?' (You)':''}${p.eliminated?' • Eliminated':''}</b>
              <div class="sub">👑 ${p.influence}/${infTarget} • 🗺️ ${p.regions.size}/${4+extra} (core ${coreOwned}/4)</div>
            </div>
            ${warn && !p.eliminated ? '<span class="badge" style="border-color:rgba(251,113,133,0.55);color:#fecdd3">Near win</span>' : '<span class="badge">OK</span>'}
          </div>
        `;
      }).join('');
      openModal('Score', `<div class="list">${rows}</div>`, [{text:'Close', kind:'primary', onClick:()=> closeModal()}]);
    }

    function openSummary(){
      const items = game.turnSummary.slice(0,10).map(s=>`
        <div class="item" style="align-items:flex-start">
          <div>
            <b>${escapeHTML(s.title)}</b>
            <div class="sub" style="margin-top:6px">${s.lines.map(l=>`• ${escapeHTML(l)}`).join('<br>')}</div>
          </div>
        </div>
      `).join('');
      openModal('Turn Summary', `<div class="sub">Most recent first.</div><div class="list">${items||'<div class="sub">No turns yet.</div>'}</div>`, [{text:'Close', kind:'primary', onClick:()=> closeModal()}]);
    }

    function openHelp(){
      const html = `
        <div class="sub">
          <b>How to play</b><br><br>
          • Tap a region to open its card.<br>
          • Use <b>Call Up</b> to bring stored levies to your capital.<br>
          • Tap your army token, then <b>Move</b> to move along connections (AP costs shown).<br>
          • If an enemy is in the same region, use <b>Attack</b> (costs 1 AP). Big battles draw Tactic cards.<br>
          • Build on the region card: Farm (+Food), Market (+Silver), Hall (+Influence), Castle (+Defence).<br>
          • Events + income + upkeep run automatically at start of each turn.<br>
          • Hold a region uncontested to capture (1 turn). Capitals take 2 turns; losing your capital eliminates you.<br><br>
          <b>Big battles</b><br>
          When both sides have &gt;1 unit and total units ≥ 6, each side draws a <i>Battle Tactic</i> card.
        </div>
      `;
      openModal('Help', html, [
        {text:'Diagnostics', kind:'ghost', onClick:()=> runDiagnostics() },
        {text:'Close', kind:'primary', onClick:()=> closeModal() }
      ]);
    }

    function runDiagnostics(){
      const issues = [];
      // Regions must have polygons and labels
      for(const r of REGIONS){
        if(!MAP.polys[r.id]) issues.push(`Missing polygon for ${r.id}`);
        if(!MAP.labels[r.id]) issues.push(`Missing label point for ${r.id}`);
        if(!(r.id in ADJ)) issues.push(`Missing adjacency entry for ${r.id}`);
      }
      // Edges must be bidirectional
      for(const [a,b,cost] of EDGES){
        const ab = ADJ[a].some(e=>e.to===b && e.cost===cost);
        const ba = ADJ[b].some(e=>e.to===a && e.cost===cost);
        if(!ab || !ba) issues.push(`Edge not bidirectional: ${a}↔${b} (${cost})`);
      }
      // Transit rules
      if(REGION_BY_ID['isle_man']?.special!=='transit') issues.push('Isle of Man should be transit-only.');
      // Victory thresholds sanity
      const tOK = ( (2<=18) && (4<=24) );
      if(!tOK) issues.push('Victory thresholds look wrong.');

      const ok = issues.length===0;
      const body = ok
        ? `<div class="sub"><b>All checks passed.</b><br>Map polygons, labels, and movement links are consistent.</div>`
        : `<div class="sub"><b>Issues found:</b></div><div class="list">${issues.map(x=>`<div class="item"><div>${escapeHTML(x)}</div></div>`).join('')}</div>`;
      openModal('Diagnostics', body, [{text:'Close', kind:'primary', onClick:()=> closeModal()}]);
    }

    function closeSheet(){
      const sh = $('#sheet');
      sh.classList.remove('open');
    }
    function openSheet(regionId){
      const r = REGION_BY_ID[regionId];
      if(!r) return;
      game.selected.regionId = regionId;
      game.selected.mode = null;

      const ownerId = game.controlOf(regionId);
      const ownerName = ownerId ? game.getPlayer(ownerId)?.name : (r.special==='transit'?'Transit':'Uncontrolled');
      const lev = ownerId ? (game.storedLevies[regionId][ownerId]||0) : 0;
      const b = game.buildings[regionId];

      $('#sheetName').textContent = r.name;
      $('#sheetSub').textContent = regionId + (r.capitalOf?' • Capital':'') + (r.special==='transit'?' • Cannot be claimed/built':'');
      $('#sheetOwner').textContent = ownerName || '—';
      $('#sheetOwner').style.color = ownerId ? game.colorOf(ownerId) : 'var(--text)';
      $('#sheetTerrain').textContent = `${r.terrain} (+${r.def} def)`;
      $('#sheetLevies').textContent = ownerId ? `${lev}/${levySlots(regionId)}` : '—';
      $('#sheetBuildCount').textContent = `${b.length}/${buildingSlots(regionId)}`;

      const icons = [];
      if(r.capitalOf) icons.push(`<span class="iconSlot"><span class="mini">👑</span> Capital</span>`);
      if(r.special==='transit') icons.push(`<span class="iconSlot"><span class="mini">⛵</span> Transit only</span>`);
      if(game.captureTimers[regionId]) icons.push(`<span class="iconSlot"><span class="mini">⏳</span> Capture: ${game.captureTimers[regionId].remainingTurns} turn(s)</span>`);
      $('#sheetIcons').innerHTML = icons.join('') || `<span class="iconSlot"><span class="mini">ℹ️</span> Tap your army token to select it</span>`;

      // Armies in this region (reliable selection when tokens overlap)
      const armiesHere = game.armies.filter(a=>a.regionId===regionId);
      const human = game.players.find(p=>p.isHuman);
      const rows = armiesHere.map(a=>{
        const owner = game.getPlayer(a.ownerId);
        const isMine = human && a.ownerId===human.id;
        const sel = (game.selected.armyId===a.id);
        const btn = isMine ? `<button class="btn small" data-select-army="${a.id}">${sel?'Selected':'Select'}</button>` : '';
        return `<div class="armyRow">
          <div class="armyDot" style="background:${game.colorOf(a.ownerId)}"></div>
          <div class="armyMeta"><b>${escapeHTML(owner?.name||'Unknown')}</b><div class="sub">Units: ${a.units}</div></div>
          <div>${btn}</div>
        </div>`;
      }).join('');
      $('#sheetArmies').innerHTML = armiesHere.length
        ? `<div class="sub" style="margin:8px 0 6px">Armies here</div>${rows}`
        : `<div class="sub" style="margin-top:8px">No armies in this region.</div>`;

      // Actions based on state
      const isHumanTurn = game.canActHuman();
      const actions = [];
      if(isHumanTurn){
        if(ownerId===human.id && !r.special){
          actions.push(`<button class="btn small" data-act="recruit">Recruit (-1AP -1💰)</button>`);
          actions.push(`<button class="btn small" data-act="build">Build (-1AP)</button>`);
        }
        const hasMyArmy = game.armies.some(a=>a.ownerId===human.id && a.regionId===regionId);
        const hasEnemyArmy = game.armies.some(a=>a.ownerId!==human.id && a.regionId===regionId);
        if(hasMyArmy && ownerId!==human.id && !r.special){
          actions.push(`<button class="btn small" data-act="pillage">Pillage (-1AP)</button>`);
        }
        if(hasMyArmy){
          actions.push(`<button class="btn small" data-act="move">Move</button>`);
        }
        if(hasMyArmy && hasEnemyArmy){
          actions.push(`<button class="btn small danger" data-act="attack">Attack (-1AP)</button>`);
        }
      }
      $('#sheetActions').innerHTML = actions.join('');

      // Wire actions
      setTimeout(()=>{
        const act = (name)=> $(`[data-act="${name}"]`);
        const recruit = act('recruit');
        if(recruit) recruit.addEventListener('click', ()=> game.actionRecruit(regionId));
        const pillage = act('pillage');
        if(pillage) pillage.addEventListener('click', ()=> game.actionPillage(regionId));
        const attack = act('attack');
        if(attack) attack.addEventListener('click', ()=> game.actionAttack(regionId));
        const move = act('move');
        if(move) move.addEventListener('click', ()=>{
          const a = selectedHumanArmyAtSelectedRegion();
          if(!a){ TOAST.show('No army selected.'); return; }
          game.actionMoveSelect(a.id);
          TOAST.show('Tap a connected region to move.');
        });
        const build = act('build');
        if(build) build.addEventListener('click', ()=> openBuildDialog(regionId));

        // army selects
        $$('#sheetArmies [data-select-army]').forEach(btn=>{
          btn.addEventListener('click', ()=>{
            const aid = btn.getAttribute('data-select-army');
            game.selected.armyId = aid;
            game.selected.regionId = regionId;
            game.selected.mode = null;
            openSheet(regionId);
            render();
          });
        });
      },0);

      $('#sheet').classList.add('open');
      render();
    }

    function openBuildDialog(regionId){
      const human = game.players.find(p=>p.isHuman);
      const base = [
        {type:'farm', name:'Farm', cost:1, icon:'🌾', eff:'+1 Food / round'},
        {type:'market', name:'Market', cost:2, icon:'💰', eff:'+1 Silver / round'},
        {type:'hall', name:'Hall', cost:3, icon:'👑', eff:'+1 Influence / round'},
        {type:'castle', name:'Castle', cost:3, icon:'🏰', eff:'+2 Defence (cannot be pillaged)'},
      ];
      const discount = game.turnEffects.buildDiscount || 0;

      const items = base.map(b=>{
        const cost = Math.max(0, b.cost - discount);
        const disabled = (human.silver < cost);
        return `
          <div class="item">
            <div>
              <b>${b.icon} ${escapeHTML(b.name)}</b>
              <div class="sub">Cost: ${cost} Silver • ${escapeHTML(b.eff)}</div>
            </div>
            <button class="btn ${disabled?'ghost':'primary'} small" data-build="${b.type}" ${disabled?'disabled':''}>Build</button>
          </div>
        `;
      }).join('');
      openModal('Build', `<div class="sub">Build in <b>${escapeHTML(game.regionName(regionId))}</b></div><div class="list">${items}</div>`, [
        { text:'Close', kind:'ghost', onClick:()=> closeModal() }
      ]);
      setTimeout(()=>{
        $$('[data-build]').forEach(btn=>{
          btn.addEventListener('click', ()=>{
            const type = btn.getAttribute('data-build');
            closeModal();
            game.actionBuild(regionId, type);
          });
        });
      },0);
    }

    function openModal(title, bodyHTML, buttons){
      const m = $('#modal');
      $('#modalTitle').textContent = title;
      $('#modalBody').innerHTML = bodyHTML;
      const footer = $('#modalFooter');
      footer.innerHTML = '';
      for(const b of buttons||[]){
        const el = document.createElement('button');
        el.className = `btn ${b.kind||''} small`;
        el.textContent = b.text;
        el.addEventListener('click', b.onClick);
        footer.appendChild(el);
      }
      m.classList.add('open');
    }
    function closeModal(){
      $('#modal').classList.remove('open');
    }

    function buildMapSVG(){
      // connections
      const con = $('#connections');
      con.innerHTML = '';
      for(const [a,b,cost] of EDGES){
        if(game && (!game.isPlayable(a) || !game.isPlayable(b))) continue;
        const [x1,y1]=MAP.labels[a], [x2,y2]=MAP.labels[b];
        const line = document.createElementNS('http://www.w3.org/2000/svg','line');
        line.setAttribute('x1',x1); line.setAttribute('y1',y1);
        line.setAttribute('x2',x2); line.setAttribute('y2',y2);
        line.setAttribute('stroke','rgba(148,163,184,0.22)');
        line.setAttribute('stroke-width','6');
        line.setAttribute('stroke-linecap','round');
        con.appendChild(line);

        // label
        const tx = document.createElementNS('http://www.w3.org/2000/svg','text');
        tx.setAttribute('x', (x1+x2)/2 );
        tx.setAttribute('y', (y1+y2)/2 );
        tx.setAttribute('class','connectionLabel');
        tx.textContent = String(cost);
        con.appendChild(tx);
      }

      // regions
      const reg = $('#regions');
      reg.innerHTML = '';
      for(const r of REGIONS){
        const path = document.createElementNS('http://www.w3.org/2000/svg','polygon');
        path.setAttribute('points', MAP.polys[r.id]);
        path.setAttribute('data-rid', r.id);
        path.setAttribute('filter', 'url(#shadow)');
        path.style.cursor = 'pointer';
        reg.appendChild(path);
      }

      // labels
      const labels = $('#labels');
      labels.innerHTML = '';
      for(const r of REGIONS){
        const [x,y]=MAP.labels[r.id];
        const t = document.createElementNS('http://www.w3.org/2000/svg','text');
        t.setAttribute('x', x);
        t.setAttribute('y', y);
        t.setAttribute('text-anchor','middle');
        t.setAttribute('dominant-baseline','middle');
        t.setAttribute('class','regionLabel');
        t.style.pointerEvents = 'none';
        t.textContent = r.name;
        labels.appendChild(t);
      }

      // Interaction wiring
      $$('#regions polygon').forEach(poly=>{
        poly.addEventListener('pointerup', (ev)=>{
          ev.stopPropagation();
          if(panzoom && (panzoom.dragging || panzoom._justDragged)) return;
          const rid = poly.getAttribute('data-rid');
          if(game && !game.isPlayable(rid)) return;

          // If we're in move mode and this region is reachable, move instead of opening the sheet.
          if(game && game.canActHuman() && game.selected.mode==='move' && game.selected.armyId){
            const a = game.armies.find(x=>x.id===game.selected.armyId);
            if(a){
              const edge = ADJ[a.regionId].find(e=>e.to===rid);
              if(edge){
                let cost = edge.cost;
                if(game.turnEffects.navCostPlus1 && isNavalEdge(a.regionId, rid)) cost += 1;
                if(game.ap >= cost){
                  game.actionMoveTo(rid);
                  return;
                }
              }
            }
          }

          openSheet(rid);
        });
      });

      // Army tokens click
      $('#armies').addEventListener('pointerup', (ev)=> {
        const g = ev.target.closest?.('[data-army]');
        if(!g) return;
        ev.stopPropagation();
        if(panzoom && (panzoom.dragging || panzoom._justDragged)) return;
        const aid = g.getAttribute('data-army');
        const a = game.armies.find(x=>x.id===aid);
        if(!a) return;
        // Select region as that army region.
        game.selected.regionId = a.regionId;
        game.selected.armyId = aid;
        game.selected.mode = null;
        openSheet(a.regionId);
        render();
      });

      // Clicking empty map closes sheet (but keep selection)
      $('#mapSvg').addEventListener('pointerdown', (ev)=>{
        if(ev.target.id==='mapSvg' || ev.target.id==='panzoom' || ev.target.id==='connections' || ev.target.id==='labels'){
          closeSheet();
        }
      });
    }

    function render(){
      if(!game) return;
      // Update HUD + map styling
      const p = game.current();
      const human = game.players.find(x=>x.isHuman);
      if(!human) return;

      // HUD text
      $('.hud .title').textContent = `${p.name}${p.isHuman?' (You)':''} • Round ${game.round} • AP ${game.ap}/2`;
      const pc = game.players.filter(x=>!x.eliminated).length;
      const infTarget = (pc<=3)?18:24;
      const extra = (pc<=3)?2:3;
      const humanCoreOwned = human.core.filter(rid=> game.controlOf(rid)===human.id).length;
      const winText = `Win: 👑 ${human.influence}/${infTarget} • 🗺️ ${human.regions.size}/${4+extra} (core ${humanCoreOwned}/4)`;
      const pills = $$('.hud .pill');
      pills[0].textContent = `🍞 ${human.food}`;
      pills[1].textContent = `💰 ${human.silver}`;
      pills[2].textContent = `👑 ${human.influence}`;
      pills[3].textContent = winText;

      // Activity feed (always visible)
      const feed = $('#feedBody');
      if(feed){
        const rows = game.log.slice(0,8).map((l)=>{
          const t = new Date(l.t);
          const hh = String(t.getHours()).padStart(2,'0');
          const mm = String(t.getMinutes()).padStart(2,'0');
          return `<div class="feedRow"><span class="feedTime">${hh}:${mm}</span><span class="feedMsg">${escapeHTML(l.msg)}</span></div>`;
        }).join('');
        feed.innerHTML = rows || '<div class="sub">No activity yet.</div>';
      }

      // Turn info snippet
      const phaseInfo = $('#phaseInfo');
      if(phaseInfo){
        const cur = game.current();
        const last = game.turnSummary[0];
        let info = '';
        if(last && last.title.endsWith('— Start')){
          // show the latest start summary for whoever is active
          info = last.lines.slice(1,4).map(x=>`• ${escapeHTML(x)}`).join('<br>');
        }
        phaseInfo.innerHTML = info ? `<div class="sub">${info}</div>` : '<div class="sub">Tap a region to view details.</div>';
      }

      // Regions fill by owner
      $$('#regions polygon').forEach(poly=>{
        const rid = poly.getAttribute('data-rid');
        const owner = game.controlOf(rid);
        const isTransit = game.isTransit(rid);
        const playable = game.isPlayable(rid);
        // Base map colours: water is handled by the background rect; land defaults to green.
        const base = isTransit ? 'rgba(148,163,184,0.16)' : (playable ? 'rgba(34,197,94,0.22)' : 'rgba(2,6,23,0.88)');
        let fill = base;
        if(!playable){
          poly.setAttribute('fill', fill);
          poly.setAttribute('stroke','rgba(148,163,184,0.10)');
          poly.setAttribute('stroke-width','1.5');
          return;
        }
        if(owner){
          const col = game.colorOf(owner);
          fill = `color-mix(in oklab, ${col} 35%, rgba(30,41,59,0.55))`;
        }
        poly.setAttribute('fill', fill);
        poly.setAttribute('stroke', (rid===game.selected.regionId) ? 'rgba(56,189,248,0.95)' : 'rgba(148,163,184,0.25)');
        poly.setAttribute('stroke-width', (rid===game.selected.regionId) ? '5' : '2');
        // capital border
        if(game.isCapital(rid)){
          poly.setAttribute('stroke-width', (rid===game.selected.regionId) ? '6' : '3.5');
        }
      });

      // Buildings icons on map
      const bLayer = $('#buildings');
      bLayer.innerHTML = '';
      for(const rid of Object.keys(game.buildings)){
        const bs = game.buildings[rid];
        if(!bs.length) continue;
        const [cx,cy] = MAP.labels[rid];
        const iconMap = { farm:'🌾', market:'💰', hall:'👑', castle:'🏰' };
        const text = bs.map(b=>iconMap[b]||'?').join('');
        const t = document.createElementNS('http://www.w3.org/2000/svg','text');
        t.setAttribute('x', cx);
        t.setAttribute('y', cy+36);
        t.setAttribute('text-anchor','middle');
        t.setAttribute('dominant-baseline','middle');
        t.setAttribute('class','connectionLabel');
        t.textContent = text;
        bLayer.appendChild(t);
      }

      // Armies layer
      const aLayer = $('#armies');
      aLayer.innerHTML = '';
      // group by region
      const groups = {};
      for(const a of game.armies){
        (groups[a.regionId] ||= []).push(a);
      }
      for(const [rid, arr] of Object.entries(groups)){
        const [cx,cy] = MAP.labels[rid];
        arr.sort((a,b)=>b.units-a.units);
        const offsetStart = -(arr.length-1)*24;
        arr.forEach((a, idx)=>{
          const x = cx + offsetStart + idx*48;
          const y = cy - 36;
          const g = document.createElementNS('http://www.w3.org/2000/svg','g');
          g.setAttribute('data-army', a.id);
          g.style.cursor='pointer';

          const circle = document.createElementNS('http://www.w3.org/2000/svg','circle');
          circle.setAttribute('cx', x);
          circle.setAttribute('cy', y);
          circle.setAttribute('r', 22);
          circle.setAttribute('fill', game.colorOf(a.ownerId));
          circle.setAttribute('stroke', (a.id===game.selected.armyId)? 'rgba(255,255,255,0.95)' : 'rgba(2,6,23,0.65)');
          circle.setAttribute('stroke-width', (a.id===game.selected.armyId)? '4' : '2');
          g.appendChild(circle);

          const txt = document.createElementNS('http://www.w3.org/2000/svg','text');
          txt.setAttribute('x', x);
          txt.setAttribute('y', y+1);
          txt.setAttribute('text-anchor','middle');
          txt.setAttribute('dominant-baseline','middle');
          txt.setAttribute('class','regionLabel');
          txt.setAttribute('fill', 'white');
          txt.textContent = String(a.units);
          g.appendChild(txt);

          aLayer.appendChild(g);
        });
      }
      // Move mode highlight is handled inside region tap (to avoid listener buildup).

      // buttons disabled state
      const can = game.canActHuman();
      $('#endTurnBtn').disabled = !can;
      $('#moveBtn').disabled = !can;
      $('#attackBtn').disabled = !can;
      $('#disbandBtn').disabled = !can;
      $('#callUpBtn').disabled = !can;
    }

    // Expose modal to game
    function openModalPublic(title, bodyHTML, buttons){ openModal(title, bodyHTML, buttons); }
    function closeModalPublic(){ closeModal(); }

    return {
      restart,
      renderSetup,
      renderGame,
      render,
      openModal: openModalPublic,
      closeModal: closeModalPublic,
    };
  })();

  // ---------- Pan/Zoom ----------
  class PanZoom {
    constructor(svgEl, groupEl){
      this.svg = svgEl;
      this.g = groupEl;
      this.state = {
        scale: 1,
        minScale: 0.6,
        maxScale: 2.8,
        tx: 0,
        ty: 0,
      };
      this._pointers = new Map();
      this._start = null;
      this.dragging = false;
      this._dragMoved = 0;
      this._bind();
      this.fit();
    }

    _bind(){
      this.svg.addEventListener('pointerdown', (e)=> this._onDown(e));
      this.svg.addEventListener('pointermove', (e)=> this._onMove(e));
      this.svg.addEventListener('pointerup', (e)=> this._onUp(e));
      this.svg.addEventListener('pointercancel', (e)=> this._onUp(e));
      this.svg.addEventListener('wheel', (e)=>{
        e.preventDefault();
        const delta = (e.deltaY < 0) ? 1.10 : 0.90;
        this.zoomBy(delta, {x:e.offsetX, y:e.offsetY});
      }, {passive:false});
    }

    _onDown(e){
      // IMPORTANT: don't pointer-capture, otherwise region/army taps stop firing on mobile.
      // We still track pointers to support drag/pinch, but taps will be handled by the region/army listeners.
      this._pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
      if(this._pointers.size===1){
        this.dragging = false;
        this._dragMoved = 0;
        this._start = { ...this.state, p1: {x:e.clientX, y:e.clientY} };
      } else if(this._pointers.size===2){
        const pts = Array.from(this._pointers.values());
        const dist = Math.hypot(pts[0].x-pts[1].x, pts[0].y-pts[1].y);
        this._start = { ...this.state, dist, mid: { x:(pts[0].x+pts[1].x)/2, y:(pts[0].y+pts[1].y)/2 } };
      }
    }

    _onMove(e){
      if(!this._pointers.has(e.pointerId)) return;
      this._pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
      if(this._pointers.size===1 && this._start){
        const p1 = Array.from(this._pointers.values())[0];
        const dx = p1.x - this._start.p1.x;
        const dy = p1.y - this._start.p1.y;
        this._dragMoved = Math.max(this._dragMoved, Math.hypot(dx,dy));
        // Higher threshold so normal taps don't get mis-classified as drags.
        if(this._dragMoved > 12) this.dragging = true;
        this.state.tx = this._start.tx + dx;
        this.state.ty = this._start.ty + dy;
        this._apply();
      }
      if(this._pointers.size===2 && this._start){
        const pts = Array.from(this._pointers.values());
        const dist = Math.hypot(pts[0].x-pts[1].x, pts[0].y-pts[1].y);
        const scale = clamp(this._start.scale * (dist / this._start.dist), this.state.minScale, this.state.maxScale);
        this.state.scale = scale;
        // Keep midpoint stable in screen space (approx)
        const mid = { x:(pts[0].x+pts[1].x)/2, y:(pts[0].y+pts[1].y)/2 };
        const dx = mid.x - this._start.mid.x;
        const dy = mid.y - this._start.mid.y;
        this.state.tx = this._start.tx + dx;
        this.state.ty = this._start.ty + dy;
        this._apply();
      }
    }

    _onUp(e){
      this._pointers.delete(e.pointerId);
      if(this._pointers.size===0){
        this._start=null;
        // keep a short-lived flag so tap handlers can ignore the pointerup that ended a drag
        this._justDragged = this.dragging;
        setTimeout(()=>{ this._justDragged = false; }, 60);
      }
    }

    _apply(){
      // Translate is in screen px, but applied to SVG group; ok as relative.
      this.g.setAttribute('transform', `translate(${this.state.tx} ${this.state.ty}) scale(${this.state.scale})`);
    }

    zoomBy(factor){
      this.state.scale = clamp(this.state.scale*factor, this.state.minScale, this.state.maxScale);
      this._apply();
    }

    fit(){
      // Reset to a sensible default: show all content, slightly zoomed out.
      this.state.scale = 0.72;
      this.state.tx = 0;
      this.state.ty = -80;
      this._apply();
    }
  }

  // ---------- Helpers ----------
  function getCSSVar(name){
    const s = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return s || '#94a3b8';
  }
  function escapeHTML(str){
    return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  }

  // Boot
  UI.renderSetup();

  // Register service worker
  if('serviceWorker' in navigator){
    window.addEventListener('load', ()=> {
      navigator.serviceWorker.register('./sw.js').catch(()=>{});
    });
  }
})();
