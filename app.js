
/* Battle for Britannia (mobile-first) - v3
   Designed to match the uploaded board map (Board game map v2).
   One human player, other kingdoms are AI. 2–5 total players.

   Notes:
   - Events + income/upkeep are automatic at the start of every player's turn (round 1 skips events).
   - Isle of Man is transit-only: cannot be claimed or built upon.
*/

const MAP = {"meta": {"name": "Board map v2", "version": 3}, "regions": {"MORAY": {"x": 720, "y": 110, "kingdom": "Picts", "capital": false, "terrain": "mountain"}, "SCONE": {"x": 790, "y": 260, "kingdom": "Picts", "capital": true, "terrain": "plains"}, "GALLOWAY": {"x": 560, "y": 440, "kingdom": "Picts", "capital": false, "terrain": "mountain"}, "CUMBRIA": {"x": 560, "y": 680, "kingdom": "Picts", "capital": false, "terrain": "mountain"}, "LOTHIAN": {"x": 860, "y": 360, "kingdom": "Northumbria", "capital": false, "terrain": "mountain"}, "BERNICIA": {"x": 860, "y": 500, "kingdom": "Northumbria", "capital": true, "terrain": "plains"}, "TYNEDALE": {"x": 860, "y": 660, "kingdom": "Northumbria", "capital": false, "terrain": "mountain"}, "DEIRA": {"x": 860, "y": 820, "kingdom": "Northumbria", "capital": false, "terrain": "plains"}, "GWYNEDD": {"x": 350, "y": 820, "kingdom": "Wales", "capital": true, "terrain": "mountain"}, "POWYS": {"x": 360, "y": 1010, "kingdom": "Wales", "capital": false, "terrain": "plains"}, "DYFED": {"x": 220, "y": 1180, "kingdom": "Wales", "capital": false, "terrain": "plains"}, "GWENT": {"x": 380, "y": 1180, "kingdom": "Wales", "capital": false, "terrain": "mountain"}, "CHESHIRE": {"x": 600, "y": 900, "kingdom": "Mercia", "capital": false, "terrain": "plains"}, "TAMWORTH": {"x": 600, "y": 1060, "kingdom": "Mercia", "capital": true, "terrain": "plains"}, "HWICCE": {"x": 600, "y": 1230, "kingdom": "Mercia", "capital": false, "terrain": "plains"}, "LINDSEY": {"x": 820, "y": 920, "kingdom": "Mercia", "capital": false, "terrain": "plains"}, "EAST_ANGLIA": {"x": 910, "y": 1090, "kingdom": "Wessex", "capital": false, "terrain": "plains"}, "SUSSEX_KENT": {"x": 910, "y": 1325, "kingdom": "Wessex", "capital": false, "terrain": "plains", "label": "SUSSEX & KENT"}, "WINCHESTER": {"x": 650, "y": 1380, "kingdom": "Wessex", "capital": true, "terrain": "plains"}, "CORNWALL": {"x": 330, "y": 1420, "kingdom": "Wessex", "capital": false, "terrain": "mountain"}, "ISLE_OF_MAN": {"x": 220, "y": 620, "kingdom": "Neutral", "capital": false, "terrain": "sea", "special": "transit_only", "label": "Isle of Man"}}, "edges": [["MORAY", "SCONE", 2], ["SCONE", "GALLOWAY", 1], ["SCONE", "LOTHIAN", 2], ["GALLOWAY", "LOTHIAN", 1], ["GALLOWAY", "CUMBRIA", 2], ["CUMBRIA", "CHESHIRE", 1], ["CUMBRIA", "TYNEDALE", 1], ["LOTHIAN", "BERNICIA", 1], ["BERNICIA", "TYNEDALE", 1], ["TYNEDALE", "DEIRA", 2], ["DEIRA", "LINDSEY", 2], ["LINDSEY", "EAST_ANGLIA", 1], ["EAST_ANGLIA", "SUSSEX_KENT", 2], ["SUSSEX_KENT", "WINCHESTER", 1], ["WINCHESTER", "HWICCE", 2], ["HWICCE", "TAMWORTH", 1], ["TAMWORTH", "CHESHIRE", 1], ["CHESHIRE", "POWYS", 1], ["POWYS", "GWYNEDD", 2], ["POWYS", "GWENT", 1], ["GWENT", "DYFED", 1], ["DYFED", "CORNWALL", 1], ["CORNWALL", "WINCHESTER", 2], ["ISLE_OF_MAN", "DYFED", 1], ["ISLE_OF_MAN", "GALLOWAY", 1], ["EAST_ANGLIA", "TYNEDALE", 2]]};

/** ---------- Utilities ---------- **/
const $ = (sel) => document.querySelector(sel);
const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
const rnd = (n)=>Math.floor(Math.random()*n);
const pick = (arr)=>arr[rnd(arr.length)];
const uid = ()=>Math.random().toString(36).slice(2,10);

function logEntry(who, title, details=""){
  const el = document.createElement("div");
  el.className="entry";
  el.innerHTML = `<div class="who">${escapeHtml(who)} — ${escapeHtml(title)}</div>` + (details?`<div class="small">${escapeHtml(details)}</div>`:"");
  $("#log").prepend(el);
}
function escapeHtml(s){ return (s??"").toString().replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }

function deepClone(o){ return JSON.parse(JSON.stringify(o)); }

/** ---------- Game data ---------- **/
const KINGDOMS = [
  {name:"Wessex", color:"#FBB84C", capitals:["WINCHESTER"], core:["WINCHESTER","SUSSEX_KENT","EAST_ANGLIA","CORNWALL"]},
  {name:"Mercia", color:"#5EA1FF", capitals:["TAMWORTH"], core:["TAMWORTH","HWICCE","CHESHIRE","LINDSEY"]},
  {name:"Northumbria", color:"#7CFFB2", capitals:["BERNICIA"], core:["BERNICIA","DEIRA","TYNEDALE","LOTHIAN"]},
  {name:"Wales", color:"#FF6A8D", capitals:["GWYNEDD"], core:["GWYNEDD","POWYS","GWENT","DYFED"]},
  {name:"Picts", color:"#C29BFF", capitals:["SCONE"], core:["SCONE","MORAY","GALLOWAY","CUMBRIA"]},
];

const TERRAIN_DEF = { plains:0, mountain:1, sea:0 };

const BUILDINGS = {
  farm:{name:"Farm", icon:"🌾", cost:1, food:1, silver:0, inf:0, def:0, pillageable:true},
  market:{name:"Market", icon:"💰", cost:2, food:0, silver:1, inf:0, def:0, pillageable:true},
  hall:{name:"Hall", icon:"👑", cost:3, food:0, silver:0, inf:1, def:0, pillageable:true},
  castle:{name:"Castle", icon:"🏰", cost:3, food:0, silver:0, inf:0, def:2, pillageable:false},
};

const EVENTS = [
  {name:"Good Harvest", rarity:1, text:"+2 Food.", apply:(g,p)=>{p.food+=2; return "+2 Food";}},
  {name:"Poor Harvest", rarity:1, text:"-1 Food.", apply:(g,p)=>{p.food=Math.max(0,p.food-1); return "-1 Food";}},
  {name:"Trade Boom", rarity:1, text:"+2 Silver.", apply:(g,p)=>{p.silver+=2; return "+2 Silver";}},
  {name:"Banditry", rarity:1, text:"-1 Silver.", apply:(g,p)=>{p.silver=Math.max(0,p.silver-1); return "-1 Silver";}},
  {name:"Royal Favour", rarity:2, text:"+1 Influence.", apply:(g,p)=>{p.inf+=1; return "+1 Influence";}},
  {name:"Plague", rarity:2, text:"Disband 1 active unit (if any).", apply:(g,p)=>{
    const a = firstArmyOf(p);
    if(!a) return "No active units.";
    a.units -= 1;
    if(a.units<=0) removeArmy(g,a.id);
    return "Lost 1 unit to plague";
  }},
  {name:"Major Revolt", rarity:5, text:"Pay 2 Silver or lose control of a non-capital region.", apply:(g,p)=>{
    const opts = ownedRegions(g,p).filter(r=>!isCapital(r) && !isTransitOnly(r));
    if(opts.length===0) return "No eligible region.";
    if(p.silver>=2){
      // human may choose; AI pays
      if(isHuman(p)){
        g.pendingPrompt = {type:"revolt", playerId:p.id, regions:opts.map(r=>r.key)};
        return "Choice required";
      } else {
        p.silver-=2; return "Paid 2 Silver to stop revolt";
      }
    } else {
      const lose = pick(opts);
      g.regionState[lose.key].owner=null;
      return `Lost control of ${labelOf(lose.key)}`;
    }
  }},
];

// weighted draw: lower rarity => more common
function drawEvent(){
  const pool = [];
  for(const e of EVENTS){
    const weight = Math.max(1, 6 - e.rarity);
    for(let i=0;i<weight;i++) pool.push(e);
  }
  return pick(pool);
}

/** ---------- State ---------- **/
let G = null;

function newGameConfig(){
  return {
    playersTotal: parseInt($("#selPlayers").value,10),
    humanKingdom: $("#selKingdom").value,
    humanName: ($("#inpName").value||"You").trim(),
  };
}

function initGame(cfg){
  const kingdomsInPlay = chooseKingdoms(cfg.humanKingdom, cfg.playersTotal);

  const players = kingdomsInPlay.map((k, idx)=>({
    id: uid(),
    name: idx===0 ? cfg.humanName : k.name,
    kingdom: k.name,
    color: k.color,
    food: 2,
    silver: 2,
    inf: 0,
    eliminated: false,
  }));

  // shuffle turn order, but keep human in list (not necessarily first)
  const order = [...players.map(p=>p.id)];
  // randomize but keep stable-ish
  for(let i=order.length-1;i>0;i--){
    const j=rnd(i+1); [order[i],order[j]]=[order[j],order[i]];
  }

  const activeRegions = activeRegionKeysFor(kingdomsInPlay.map(k=>k.name));
  const regionState = {};
  for(const [key, reg] of Object.entries(MAP.regions)){
    if(!activeRegions.has(key)){ continue; }
    regionState[key] = {
      owner: null,
      // reserve levies stored in this region
      reserve: 0,
      buildings: [],
      contest: null, // {occupierPlayerId, turnsHeld}
    };
  }

  // starting control: each player controls their capital only, and gains 1 reserve levy in that capital
  for(const p of players){
    const cap = capitalOf(p.kingdom);
    if(regionState[cap]){
      regionState[cap].owner = p.id;
      regionState[cap].reserve = 1;
      // optional: give a starting castle to capitals? not requested now.
    }
  }

  const g = {
    version: 3,
    cfg,
    kingdomsInPlay: kingdomsInPlay.map(k=>k.name),
    activeRegions: Array.from(activeRegions),
    regionState,
    players,
    turnOrder: order,
    turnIndex: 0,
    round: 1,
    ap: 2,
    armies: [], // {id, playerId, regionKey, units}
    selected: { regionKey:null, armyId:null },
    mode: "setup", // setup | playing
    pendingPrompt: null,
    aiTurnSummary: "",
  };

  return g;
}

function chooseKingdoms(humanKingdom, totalPlayers){
  const human = KINGDOMS.find(k=>k.name===humanKingdom) || KINGDOMS[0];
  const others = KINGDOMS.filter(k=>k.name!==human.name);
  // random choose others for AIs
  const ai = [];
  while(ai.length < totalPlayers-1){
    const k = pick(others.filter(x=>!ai.includes(x)));
    ai.push(k);
  }
  return [human, ...ai];
}

function activeRegionKeysFor(kingdomNames){
  // remove unused kingdoms' regions entirely
  const set = new Set();
  for(const [key, reg] of Object.entries(MAP.regions)){
    if(reg.special==="transit_only"){ set.add(key); continue; }
    if(kingdomNames.includes(reg.kingdom)) set.add(key);
  }
  // keep coast bypass edges that may cross removed areas already handled because nodes removed.
  return set;
}

function playerById(id){ return G.players.find(p=>p.id===id); }
function playerByKingdom(name){ return G.players.find(p=>p.kingdom===name); }
function currentPlayer(){ return playerById(G.turnOrder[G.turnIndex]); }
function isHuman(p){ return p.id === humanPlayer().id; }
function humanPlayer(){ return G.players.find(p=>p.name===G.cfg.humanName) || G.players[0]; }

function labelOf(regionKey){
  const r = MAP.regions[regionKey];
  return r.label || regionKey.replaceAll("_"," ");
}
function isCapital(regionKey){ return !!MAP.regions[regionKey]?.capital; }
function isTransitOnly(regionKey){ return MAP.regions[regionKey]?.special === "transit_only"; }

function capitalOf(kingdom){
  const k = KINGDOMS.find(x=>x.name===kingdom);
  return k?.capitals?.[0];
}

function ownedRegions(g, p){
  const out=[];
  for(const [k, st] of Object.entries(g.regionState)){
    if(st.owner===p.id) out.push({key:k, ...MAP.regions[k]});
  }
  return out;
}
function firstArmyOf(p){
  return G.armies.find(a=>a.playerId===p.id);
}
function armiesInRegion(regionKey){
  return G.armies.filter(a=>a.regionKey===regionKey);
}
function friendlyArmiesInRegion(p, regionKey){
  return G.armies.filter(a=>a.regionKey===regionKey && a.playerId===p.id);
}
function enemyArmiesInRegion(p, regionKey){
  return G.armies.filter(a=>a.regionKey===regionKey && a.playerId!==p.id);
}
function removeArmy(g, armyId){
  const idx = g.armies.findIndex(a=>a.id===armyId);
  if(idx>=0) g.armies.splice(idx,1);
}

/** ---------- Rendering ---------- **/
let scale = 1;
let pan = {x:0,y:0};
let isPanning=false;
let panStart=null;

function setupMapUI(){
  const viewport = $("#mapViewport");
  const stage = $("#mapStage");

  const applyTransform = ()=>{
    stage.style.transform = `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${scale})`;
  };

  viewport.addEventListener("pointerdown",(e)=>{
    isPanning=true;
    panStart={x:e.clientX, y:e.clientY, px:pan.x, py:pan.y};
    viewport.setPointerCapture(e.pointerId);
  });
  viewport.addEventListener("pointermove",(e)=>{
    if(!isPanning) return;
    const dx=e.clientX-panStart.x;
    const dy=e.clientY-panStart.y;
    pan.x = panStart.px + dx;
    pan.y = panStart.py + dy;
    applyTransform();
  });
  viewport.addEventListener("pointerup",(e)=>{
    isPanning=false;
  });

  $("#zoomIn").addEventListener("click",()=>{ scale=clamp(scale+0.12,0.7,2.2); applyTransform(); });
  $("#zoomOut").addEventListener("click",()=>{ scale=clamp(scale-0.12,0.7,2.2); applyTransform(); });
  $("#zoomReset").addEventListener("click",()=>{ scale=1; pan={x:0,y:0}; applyTransform(); });

  applyTransform();
}

function renderOverlay(){
  const overlay = $("#overlay");
  overlay.innerHTML = "";

  // draw edges (movement links) with subtle glow; label costs
  const edges = MAP.edges
    .filter(([a,b])=> G.activeRegions.includes(a) && G.activeRegions.includes(b));

  for(const [a,b,cost] of edges){
    const ra=MAP.regions[a], rb=MAP.regions[b];
    if(!ra||!rb) continue;
    const line = document.createElementNS("http://www.w3.org/2000/svg","line");
    line.setAttribute("x1", ra.x); line.setAttribute("y1", ra.y);
    line.setAttribute("x2", rb.x); line.setAttribute("y2", rb.y);
    line.setAttribute("stroke", "rgba(255,255,255,.18)");
    line.setAttribute("stroke-width", "3");
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("vector-effect","non-scaling-stroke");
    overlay.appendChild(line);

    const mx=(ra.x+rb.x)/2, my=(ra.y+rb.y)/2;
    const t = document.createElementNS("http://www.w3.org/2000/svg","text");
    t.setAttribute("x", mx); t.setAttribute("y", my);
    t.setAttribute("fill","rgba(255,255,255,.85)");
    t.setAttribute("font-size","18");
    t.setAttribute("font-weight","900");
    t.setAttribute("text-anchor","middle");
    t.setAttribute("dominant-baseline","middle");
    t.textContent = cost;
    t.style.paintOrder="stroke";
    t.style.stroke="rgba(0,0,0,.7)";
    t.style.strokeWidth="4px";
    overlay.appendChild(t);
  }
}

function renderRegions(){
  // region dots + labels in DOM for clickability (better on mobile)
  const stage = $("#mapStage");
  // remove previous dots/labels but keep bg/img/svg/tokens
  stage.querySelectorAll(".regionDot,.regionLabel,.capIcon").forEach(n=>n.remove());

  for(const key of G.activeRegions){
    const r = MAP.regions[key];
    if(!r) continue;

    // dot
    const dot = document.createElement("div");
    dot.className="regionDot";
    dot.style.left = r.x+"px";
    dot.style.top  = r.y+"px";
    dot.dataset.region = key;
    dot.addEventListener("click",(e)=>{
      e.stopPropagation();
      selectRegion(key);
    });
    stage.appendChild(dot);

    // label
    const lab = document.createElement("div");
    lab.className="regionLabel";
    lab.style.left = r.x+"px";
    lab.style.top  = (r.y - 26)+"px";
    lab.textContent = labelOf(key);
    stage.appendChild(lab);

    // capital icon
    if(r.capital){
      const ci = document.createElement("div");
      ci.className="capIcon";
      ci.style.left = (r.x + 28)+"px";
      ci.style.top  = (r.y - 10)+"px";
      ci.textContent="👑";
      stage.appendChild(ci);
    }
  }
}

function renderTokens(){
  const tokens = $("#tokens");
  tokens.innerHTML = "";
  const p = currentPlayer();

  // draw control flags subtly by colouring region dots border (owner)
  document.querySelectorAll(".regionDot").forEach(dot=>{
    const key = dot.dataset.region;
    const st = G.regionState[key];
    dot.style.background = "rgba(0,0,0,.25)";
    dot.style.borderColor = "rgba(255,255,255,.55)";
    if(st?.owner){
      const owner = playerById(st.owner);
      dot.style.borderColor = owner.color;
      dot.style.background = owner.color + "33";
    }
    if(st?.contest){
      dot.style.borderColor = "rgba(255,255,255,.95)";
      dot.style.background = "rgba(255,87,87,.18)";
    }
  });

  // army tokens
  for(const a of G.armies){
    if(!G.activeRegions.includes(a.regionKey)) continue;
    const reg = MAP.regions[a.regionKey];
    const owner = playerById(a.playerId);
    const el = document.createElement("div");
    el.className = "token";
    if(G.selected.armyId===a.id) el.classList.add("sel");
    el.style.left = reg.x + "px";
    el.style.top  = reg.y + "px";
    el.style.background = owner.color;
    el.textContent = a.units;
    const sm = document.createElement("small");
    sm.textContent = owner.kingdom;
    el.appendChild(sm);
    el.addEventListener("click",(e)=>{
      e.stopPropagation();
      if(owner.id !== humanPlayer().id){ // allow selecting enemy for info
        selectRegion(a.regionKey);
        return;
      }
      selectArmy(a.id);
    });
    tokens.appendChild(el);
  }
}

function renderUI(){
  const p = currentPlayer();
  const human = humanPlayer();

  $("#subtitle").textContent = `You: ${human.kingdom} • ${G.players.length-1} AI`;

  // setup/turn panel toggle
  $("#setupCard").classList.toggle("hidden", G.mode!=="setup");
  $("#turnCard").classList.toggle("hidden", G.mode!=="playing");
  $("#logCard").classList.toggle("hidden", G.mode!=="playing");

  // HUD
  $("#pillTurn").textContent = `Round ${G.round} • ${isHuman(p) ? "Your turn" : p.kingdom + " (AI)"}`;
  $("#pillAP").textContent = `AP: ${G.ap}`;

  $("#resFood").textContent = `🍞 ${human.food}`;
  $("#resSilver").textContent = `💰 ${human.silver}`;
  $("#resInf").textContent = `👑 ${human.inf}`;
  $("#resUnits").textContent = `⚔️ ${G.armies.filter(a=>a.playerId===human.id).reduce((s,a)=>s+a.units,0)} active`;

  // context
  $("#aiSummary").textContent = G.aiTurnSummary || "—";
  $("#selectedInfo").textContent = selectedInfoText();

  // action enable/disable
  const hasSelection = !!G.selected.regionKey || !!G.selected.armyId;
  $("#btnMove").disabled   = !canMove();
  $("#btnAttack").disabled = !canAttack();
  $("#btnRecruit").disabled= !canRecruit();
  $("#btnCallup").disabled = !canCallup();
  $("#btnBuild").disabled  = !canBuild();
  $("#btnPillage").disabled= !canPillage();
  $("#btnDisband").disabled= !canDisband();
  $("#btnEnd").disabled    = !(G.mode==="playing" && isHuman(p));

  // selected marker
  document.querySelectorAll(".regionDot").forEach(dot=>{
    dot.classList.toggle("sel", dot.dataset.region===G.selected.regionKey);
  });

  renderOverlay();
  renderTokens();
}

function selectedInfoText(){
  const lines=[];
  if(G.selected.armyId){
    const a = G.armies.find(x=>x.id===G.selected.armyId);
    if(a){
      lines.push(`Army: ${a.units} (${playerById(a.playerId).kingdom})`);
      lines.push(`Location: ${labelOf(a.regionKey)}`);
    }
  }
  if(G.selected.regionKey){
    const key = G.selected.regionKey;
    const st = G.regionState[key];
    const owner = st.owner ? playerById(st.owner).kingdom : "None";
    lines.push(`Region: ${labelOf(key)}`);
    lines.push(`Owner: ${owner}`);
    lines.push(`Reserve: ${st.reserve}`);
    const b = st.buildings.map(x=>BUILDINGS[x].icon).join(" ");
    lines.push(`Buildings: ${b||"—"}`);
    if(st.contest){
      lines.push(`Contested: held ${st.contest.turnsHeld}/`+(isCapital(key)?2:1));
    }
  }
  return lines.join("\n") || "—";
}

/** ---------- Selection ---------- **/
function selectRegion(key){
  G.selected.regionKey = key;
  G.selected.armyId = null;
  $("#contextLine").textContent = `Selected region: ${labelOf(key)}`;
  renderUI();
}
function selectArmy(armyId){
  const a = G.armies.find(x=>x.id===armyId);
  if(!a) return;
  G.selected.armyId = armyId;
  G.selected.regionKey = a.regionKey;
  $("#contextLine").textContent = `Selected army in ${labelOf(a.regionKey)} (${a.units})`;
  renderUI();
}

/** ---------- Actions eligibility ---------- **/
function canMove(){
  const p = currentPlayer();
  if(!isHuman(p) || G.ap<=0) return false;
  if(!G.selected.armyId) return false;
  const a = G.armies.find(x=>x.id===G.selected.armyId);
  if(!a || a.playerId!==p.id) return false;
  return neighbors(a.regionKey).some(n=>n.cost<=G.ap);
}
function canAttack(){
  const p = currentPlayer();
  if(!isHuman(p) || G.ap<1) return false;
  const key = G.selected.regionKey;
  if(!key) return false;
  const enemies = enemyArmiesInRegion(p, key);
  const friend = friendlyArmiesInRegion(p, key);
  return enemies.length>0 && friend.length>0;
}
function canRecruit(){
  const p = currentPlayer();
  if(!isHuman(p) || G.ap<1) return false;
  if(p.silver<1) return false;
  const key = G.selected.regionKey;
  if(!key) return false;
  const st = G.regionState[key];
  if(!st || st.owner!==p.id) return false;
  if(isTransitOnly(key)) return false;
  const max = isCapital(key)?3:2;
  return st.reserve < max;
}
function canCallup(){
  const p = currentPlayer();
  if(!isHuman(p)) return false;
  const totalReserve = ownedRegions(G,p).reduce((s,r)=>s+G.regionState[r.key].reserve,0);
  if(totalReserve<=0) return false;
  return G.ap>=1;
}
function canBuild(){
  const p=currentPlayer();
  if(!isHuman(p) || G.ap<1) return false;
  const key=G.selected.regionKey;
  if(!key) return false;
  const st=G.regionState[key];
  if(!st || st.owner!==p.id) return false;
  if(isTransitOnly(key)) return false;
  const maxSlots = isCapital(key)?3:2;
  return st.buildings.length < maxSlots;
}
function canPillage(){
  const p=currentPlayer();
  if(!isHuman(p) || G.ap<1) return false;
  const key=G.selected.regionKey;
  if(!key) return false;
  if(isTransitOnly(key)) return false;
  const st=G.regionState[key];
  const friend = friendlyArmiesInRegion(p,key);
  if(friend.length===0) return false;
  if(st.owner===p.id) return false;
  if(st.buildings.length===0) return false;
  return true;
}
function canDisband(){
  const p=currentPlayer();
  if(!isHuman(p) || G.ap<1) return false;
  if(!G.selected.armyId) return false;
  const a = G.armies.find(x=>x.id===G.selected.armyId);
  return a && a.playerId===p.id && a.units>0;
}

/** ---------- Map graph ---------- **/
function neighbors(regionKey){
  const out=[];
  for(const [a,b,c] of MAP.edges){
    if(!G.activeRegions.includes(a) || !G.activeRegions.includes(b)) continue;
    if(a===regionKey) out.push({key:b, cost:c});
    else if(b===regionKey) out.push({key:a, cost:c});
  }
  return out;
}

/** ---------- Core mechanics ---------- **/
function startGame(){
  G = initGame(newGameConfig());
  G.mode="playing";
  // show map labels
  renderRegions();
  renderOverlay();
  // auto-run start of first player's turn (round 1 no event)
  beginTurn();
  renderUI();
}

function beginTurn(){
  const p = currentPlayer();
  G.ap = 2;
  G.aiTurnSummary = "";

  // auto phases: event (skip round 1), income, upkeep
  const eventsAllowed = G.round >= 2;
  if(eventsAllowed){
    const e = drawEvent();
    const result = e.apply(G,p);
    logEntry(p.kingdom, `Event: ${e.name}`, e.text + (result && result!=="Choice required" ? ` • ${result}` : ""));
    if(G.pendingPrompt){
      // handled immediately for human before continuing
      handlePendingPrompt();
      return;
    }
  }

  const inc = applyIncomeAndUpkeep(p);
  logEntry(p.kingdom, "Income & upkeep", inc.summary);

  // if upkeep forced disband for human, prompt and pause; AI disbands automatically in applyIncomeAndUpkeep
  if(inc.needsHumanDisband){
    promptHumanDisband(inc.needsHumanDisband);
    return;
  }

  // AI plays immediately
  if(!isHuman(p)){
    runAIturn(p);
  } else {
    logEntry("System","Your turn", "Select an army/region, then use actions. Events and upkeep are automatic.");
  }

  checkVictory();
  renderUI();
}

function applyIncomeAndUpkeep(p){
  // production from buildings
  let foodGain=0, silverGain=0, infGain=0;
  for(const r of ownedRegions(G,p)){
    const st = G.regionState[r.key];
    for(const b of st.buildings){
      foodGain += BUILDINGS[b].food;
      silverGain += BUILDINGS[b].silver;
      infGain += BUILDINGS[b].inf;
    }
  }
  // capital always gives +1 food and +1 silver
  const cap = capitalOf(p.kingdom);
  if(G.regionState[cap]){
    foodGain += 1;
    silverGain += 1;
  }
  p.food += foodGain;
  p.silver += silverGain;
  p.inf += infGain;

  // upkeep: 1 food per active unit
  const active = G.armies.filter(a=>a.playerId===p.id).reduce((s,a)=>s+a.units,0);
  p.food -= active;

  let needsHumanDisband = 0;
  if(p.food < 0){
    const deficit = -p.food;
    // must disband 'deficit' units
    if(isHuman(p)){
      needsHumanDisband = deficit;
      p.food = 0; // temporarily clamp; disband will effectively satisfy
    } else {
      // AI auto disband from smallest/most distant
      disbandUnitsAI(p, deficit);
      p.food = 0;
    }
  }

  return {
    summary:`+${foodGain}🍞 +${silverGain}💰 +${infGain}👑, upkeep -${active}🍞` + (needsHumanDisband?` • Need to disband ${needsHumanDisband} unit(s)`:""),
    needsHumanDisband
  };
}

function disbandUnitsAI(p, count){
  let left=count;
  // disband from smallest armies first
  const armies = G.armies.filter(a=>a.playerId===p.id).sort((a,b)=>a.units-b.units);
  for(const a of armies){
    if(left<=0) break;
    const take = Math.min(left, a.units);
    a.units -= take;
    left -= take;
    if(a.units<=0) removeArmy(G,a.id);
  }
  logEntry(p.kingdom, "Forced disband", `Disbanded ${count-left} unit(s) due to lack of food.`);
}

function promptHumanDisband(count){
  const body = document.createElement("div");
  body.innerHTML = `<p>You don’t have enough Food to pay upkeep. You must disband <b>${count}</b> unit(s).</p>
  <p>Pick armies to disband from:</p>`;
  const list = document.createElement("div");
  list.style.display="flex";
  list.style.flexDirection="column";
  list.style.gap="8px";

  const my = G.armies.filter(a=>a.playerId===humanPlayer().id);
  if(my.length===0){
    // nothing to disband
    closeModal();
    return;
  }

  let left=count;

  const refreshButtons=()=>{
    list.innerHTML="";
    for(const a of my){
      if(!G.armies.find(x=>x.id===a.id)) continue;
      const btn = document.createElement("button");
      btn.className="btn";
      btn.textContent = `${labelOf(a.regionKey)} — ${a.units} unit(s)`;
      btn.onclick=()=>{
        if(left<=0) return;
        const take=1;
        a.units -= take;
        left -= take;
        if(a.units<=0) removeArmy(G,a.id);
        $("#modalBody").querySelector("b").textContent = left;
        refreshButtons();
        renderUI();
        if(left<=0){
          closeModal();
          // continue turn (human's turn)
          logEntry("System","Upkeep resolved","You may now take your 2 actions.");
          renderUI();
        }
      };
      list.appendChild(btn);
    }
  };

  refreshButtons();
  body.appendChild(list);

  openModal("Upkeep — Disband required", body, [
    {text:"Cancel", kind:"ghost", onClick:()=>{}}
  ], false);
}

function handlePendingPrompt(){
  const pr = G.pendingPrompt;
  if(!pr) return;
  const p = playerById(pr.playerId);
  if(pr.type==="revolt"){
    const wrap = document.createElement("div");
    wrap.innerHTML = `<p><b>Major Revolt</b>: pay 2 Silver to stop it, or lose control of a region.</p>
                      <p>You have 💰 ${p.silver}.</p>`;
    const footBtns = [];
    footBtns.push({text:"Pay 2 Silver", kind:"primary", onClick:()=>{
      p.silver -= 2;
      G.pendingPrompt=null;
      closeModal();
      logEntry(p.kingdom, "Major Revolt", "Paid 2 Silver.");
      beginTurn(); // resume
    }});
    footBtns.push({text:"Let it revolt", kind:"danger", onClick:()=>{
      const loseKey = pick(pr.regions);
      G.regionState[loseKey].owner = null;
      G.pendingPrompt=null;
      closeModal();
      logEntry(p.kingdom, "Major Revolt", `Lost control of ${labelOf(loseKey)}.`);
      beginTurn();
    }});
    openModal("Choice", wrap, footBtns, false);
  }
}

/** ---------- Human action handlers ---------- **/
function doMove(){
  const p=currentPlayer();
  const a = G.armies.find(x=>x.id===G.selected.armyId);
  if(!a) return;
  const opts = neighbors(a.regionKey).filter(n=>n.cost<=G.ap);
  if(opts.length===0) return;

  openSheet("Move", renderChoiceList(opts.map(o=>({
      title: `${labelOf(o.key)}`,
      subtitle: `Cost ${o.cost} AP`,
      onClick: ()=>{
        moveArmy(p,a,o.key,o.cost);
        closeSheet();
        afterAction();
      }
    })), []
  );
}

function moveArmy(p, army, toKey, cost){
  G.ap -= cost;
  const from = army.regionKey;
  army.regionKey = toKey;
  logEntry(p.kingdom, "Move", `${labelOf(from)} → ${labelOf(toKey)} (−${cost} AP)`);

  // entering a region: set contest if not owned by you, unless transit-only
  if(!isTransitOnly(toKey)){
    const st = G.regionState[toKey];
    const enemies = enemyArmiesInRegion(p,toKey);
    if(enemies.length>0){
      // contested by presence
      st.contest = {occupierPlayerId:p.id, turnsHeld:0};
    } else if(st.owner !== p.id){
      st.contest = {occupierPlayerId:p.id, turnsHeld:0};
    }
  }
}

function doAttack(){
  const p=currentPlayer();
  const key = G.selected.regionKey;
  const enemies = enemyArmiesInRegion(p,key);
  const friends = friendlyArmiesInRegion(p,key);
  if(enemies.length===0 || friends.length===0) return;

  // choose which friendly army attacks and which enemy defends (if multiple)
  const f = friends[0];
  const e = enemies[0];

  openSheet("Attack", (()=>{
    const d=document.createElement("div");
    d.innerHTML = `
      <p><b>${labelOf(key)}</b></p>
      <p>Attacker: ${p.kingdom} (${f.units})</p>
      <p>Defender: ${playerById(e.playerId).kingdom} (${e.units})</p>
      <p>Choose your stance:</p>
    `;
    const stanceRow=document.createElement("div");
    stanceRow.style.display="grid";
    stanceRow.style.gridTemplateColumns="1fr 1fr 1fr";
    stanceRow.style.gap="10px";

    const stances=[
      {id:"O", label:"Offensive ⚔️"},
      {id:"B", label:"Balanced ⚖️"},
      {id:"D", label:"Defensive 🛡️"},
    ];
    for(const s of stances){
      const btn=document.createElement("button");
      btn.className="btn";
      btn.textContent=s.label;
      btn.onclick=()=>{
        const result = resolveCombat({attacker:f, defender:e, regionKey:key, attackerStance:s.id, defenderStance:aiChooseStance()});
        G.ap -= 1;
        logEntry(p.kingdom, "Attack", result.summary);
        closeSheet();
        afterAction();
      };
      stanceRow.appendChild(btn);
    }
    d.appendChild(stanceRow);
    return d;
  })(), []);
}

function aiChooseStance(){
  return pick(["O","B","D"]);
}

function resolveCombat({attacker, defender, regionKey, attackerStance, defenderStance}){
  // skirmish if either exactly 1
  if(attacker.units===1 || defender.units===1){
    const roll = 1 + rnd(6);
    let out="";
    if(roll<=2){
      // defender wins
      attacker.units -= 1;
      if(attacker.units<=0) removeArmy(G, attacker.id);
      out = `Skirmish (d6=${roll}): Defender holds. Attacker loses 1.`;
    } else if(roll===3){
      attacker.units -= 1; defender.units -= 1;
      if(attacker.units<=0) removeArmy(G, attacker.id);
      if(defender.units<=0) removeArmy(G, defender.id);
      out = `Skirmish (d6=${roll}): Stalemate. Both lose 1.`;
    } else {
      defender.units -= 1;
      if(defender.units<=0) removeArmy(G, defender.id);
      out = `Skirmish (d6=${roll}): Attacker wins. Defender loses 1.`;
    }
    return {summary: out};
  }

  // stance RPS => winner gets +1 defense
  const rps = (a,b)=>{
    if(a===b) return 0;
    if(a==="O" && b==="B") return 1;
    if(a==="B" && b==="D") return 1;
    if(a==="D" && b==="O") return 1;
    return -1;
  };
  const stanceRes = rps(attackerStance, defenderStance);
  let stanceDefBonus = 0;
  let stanceNote = "Stances tied.";
  if(stanceRes===1){ stanceDefBonus = 0; stanceNote="Attacker won stance (+1 def to attacker per rules is ambiguous; using +1 defense to winner side)."; }
  if(stanceRes===-1){ stanceDefBonus = 1; stanceNote="Defender won stance (+1 defense)."; }

  // region defense
  const terrain = MAP.regions[regionKey]?.terrain || "plains";
  let def = TERRAIN_DEF[terrain] || 0;
  const st = G.regionState[regionKey];
  const hasCastle = st.buildings.includes("castle");
  if(hasCastle) def += 2;
  if(isCapital(regionKey)) def += 1;
  def += stanceDefBonus;

  // defense die mapping
  const roll = 1 + rnd(6);
  const dieMod = ({1:2,2:1,3:0,4:0,5:-1,6:-2})[roll];
  def = Math.max(0, def + dieMod);

  // convert defense to strength bonus
  let defStr=0;
  if(def>=2 && def<=3) defStr=1;
  else if(def>=4 && def<=5) defStr=2;
  else if(def>=6) defStr=3;

  const atk = attacker.units;
  const dfn = defender.units + defStr;
  const diff = Math.abs(atk-dfn);

  const winner = atk>=dfn ? "attacker":"defender";
  let summary = `Battle: A${atk} vs D${defender.units} (def ${def}=>+${defStr}, d6=${roll}). `;
  if(diff<=1){
    attacker.units -=1; defender.units -=1;
    summary += "Stalemate: both lose 1.";
  } else if(diff<=3){
    if(winner==="attacker"){
      defender.units -=1;
      summary += "Minor win: defender loses 1 and retreats 1.";
      retreat(defender, 1);
    } else {
      attacker.units -=1;
      summary += "Minor win: attacker loses 1 and retreats 1.";
      retreat(attacker, 1);
    }
  } else if(diff<=5){
    if(winner==="attacker"){
      defender.units -=2;
      summary += "Clear win: defender loses 2 and retreats 2.";
      retreat(defender, 2);
    } else {
      attacker.units -=2;
      summary += "Clear win: attacker loses 2 and retreats 2.";
      retreat(attacker, 2);
    }
  } else {
    if(winner==="attacker"){
      defender.units -=3;
      summary += "Crushing victory: defender loses 3; survivors disband.";
      defender.units = 0;
    } else {
      attacker.units -=3;
      summary += "Crushing victory: attacker loses 3; survivors disband.";
      attacker.units = 0;
    }
  }

  if(attacker.units<=0) removeArmy(G, attacker.id);
  if(defender.units<=0) removeArmy(G, defender.id);

  // contested state update
  const occ = G.regionState[regionKey];
  if(occ){
    const atkP = playerById(attacker.playerId);
    if(atkP){
      occ.contest = {occupierPlayerId: atkP.id, turnsHeld:0};
    }
  }
  return {summary};
}

function retreat(army, steps){
  // crude retreat: move toward army's capital using BFS shortest path (by edges count)
  const cap = capitalOf(playerById(army.playerId).kingdom);
  let cur = army.regionKey;
  for(let s=0;s<steps;s++){
    const next = stepToward(cur, cap);
    if(!next) break;
    cur = next;
  }
  army.regionKey = cur;
}

function stepToward(from, target){
  // BFS to find first step
  const q=[from];
  const prev = new Map();
  prev.set(from,null);
  while(q.length){
    const x=q.shift();
    if(x===target) break;
    for(const n of neighbors(x)){
      if(!prev.has(n.key)){
        prev.set(n.key, x);
        q.push(n.key);
      }
    }
  }
  if(!prev.has(target)) return null;
  // backtrack from target to from
  let cur=target, p=prev.get(cur);
  while(p && p!==from){
    cur=p; p=prev.get(cur);
  }
  return cur===from ? null : cur;
}

function doRecruit(){
  const p=currentPlayer();
  const key = G.selected.regionKey;
  const st = G.regionState[key];
  p.silver -= 1;
  st.reserve += 1;
  G.ap -= 1;
  logEntry(p.kingdom, "Recruit", `+1 levy into ${labelOf(key)} reserve (−1💰, −1 AP)`);
  afterAction();
}

function doCallup(){
  const p=currentPlayer();
  const cap = capitalOf(p.kingdom);
  const regs = ownedRegions(G,p).filter(r=>G.regionState[r.key].reserve>0);
  const total = regs.reduce((s,r)=>s+G.regionState[r.key].reserve,0);

  openSheet("Call up to capital", (()=>{
    const d=document.createElement("div");
    d.innerHTML = `<p>Call up levies to <b>${labelOf(cap)}</b> (your capital). You have ${total} stored.</p>
                   <p>1–2 units costs 1 AP. 3+ units costs 2 AP.</p>`;
    const input=document.createElement("input");
    input.type="number";
    input.min="1";
    input.max=String(total);
    input.value=String(Math.min(2,total));
    input.style.marginTop="10px";
    d.appendChild(input);

    const byRegion=document.createElement("div");
    byRegion.style.marginTop="10px";
    byRegion.style.color="rgba(255,255,255,.88)";
    byRegion.innerHTML = regs.map(r=>`${labelOf(r.key)}: ${G.regionState[r.key].reserve}`).join("<br>");
    d.appendChild(byRegion);

    const foot=document.createElement("div");
    foot.style.marginTop="12px";
    const btn=document.createElement("button");
    btn.className="btn primary";
    btn.textContent="Call up";
    btn.onclick=()=>{
      const n=clamp(parseInt(input.value,10)||1,1,total);
      const apCost = n<=2 ? 1 : 2;
      if(G.ap < apCost){ alert("Not enough AP."); return; }
      // remove from reserves (simple: drain from farthest? just in listed order)
      let left=n;
      for(const r of regs){
        if(left<=0) break;
        const take=Math.min(left, G.regionState[r.key].reserve);
        G.regionState[r.key].reserve -= take;
        left -= take;
      }
      addOrReinforceArmy(p.id, cap, n);
      G.ap -= apCost;
      logEntry(p.kingdom,"Call up", `${n} unit(s) to ${labelOf(cap)} (−${apCost} AP)`);
      closeSheet();
      afterAction();
    };
    return d;
  })(), []);
}

function addOrReinforceArmy(playerId, regionKey, units){
  const existing = G.armies.find(a=>a.playerId===playerId && a.regionKey===regionKey);
  if(existing) existing.units += units;
  else G.armies.push({id:uid(), playerId, regionKey, units});
}

function doBuild(){
  const p=currentPlayer();
  const key=G.selected.regionKey;
  const st=G.regionState[key];

  const choices = Object.entries(BUILDINGS).map(([id,b])=>({
    id,
    title: `${b.icon} ${b.name}`,
    subtitle: `Cost ${b.cost} Silver` + (id==="castle"?" • +2 defense":""),
    disabled: p.silver < b.cost || (id==="castle" && isTransitOnly(key)),
    onClick: ()=>{
      if(p.silver < b.cost) return;
      p.silver -= b.cost;
      st.buildings.push(id);
      G.ap -= 1;
      logEntry(p.kingdom, "Build", `${b.name} in ${labelOf(key)} (−${b.cost}💰, −1 AP)`);
      closeSheet();
      afterAction();
    }
  }));

  openSheet("Build", renderChoiceList(choices), []);
}

function doPillage(){
  const p=currentPlayer();
  const key=G.selected.regionKey;
  const st=G.regionState[key];

  // pillage removes one pillageable building if possible
  const pill = st.buildings.filter(b=>BUILDINGS[b].pillageable);
  if(pill.length===0){ alert("No pillageable buildings here."); return; }
  const target = pick(pill);
  st.buildings.splice(st.buildings.indexOf(target),1);
  p.silver += 1;
  G.ap -= 1;
  logEntry(p.kingdom,"Pillage",`Destroyed ${BUILDINGS[target].name} in ${labelOf(key)} (+1💰, −1 AP)`);
  afterAction();
}

function doDisband(){
  const p=currentPlayer();
  const a = G.armies.find(x=>x.id===G.selected.armyId);
  if(!a) return;
  a.units -= 1;
  G.ap -= 1;
  if(a.units<=0) removeArmy(G,a.id);
  logEntry(p.kingdom,"Disband",`Disbanded 1 unit in ${labelOf(a.regionKey)} (−1 AP)`);
  afterAction();
}

function afterAction(){
  resolveControlProgress();
  checkVictory();
  renderUI();
}

function resolveControlProgress(){
  // for each region with contest, increment if occupier still present and no enemies
  for(const [key, st] of Object.entries(G.regionState)){
    if(!st.contest) continue;
    if(isTransitOnly(key)){ st.contest=null; continue; }
    const occ = st.contest.occupierPlayerId;
    const occPlayer = playerById(occ);
    if(!occPlayer){ st.contest=null; continue; }
    const occArmies = G.armies.filter(a=>a.regionKey===key && a.playerId===occ);
    const enemies = G.armies.filter(a=>a.regionKey===key && a.playerId!==occ);
    if(occArmies.length===0){ st.contest=null; continue; }
    if(enemies.length>0){ st.contest.turnsHeld=0; continue; }
    st.contest.turnsHeld += 1;
    const need = isCapital(key) ? 2 : 1;
    if(st.contest.turnsHeld >= need){
      // capture control, unless transit
      st.owner = occ;
      st.contest = null;
      logEntry(occPlayer.kingdom, "Captured", `${labelOf(key)} is now controlled.`);
      if(isCapital(key)){
        // eliminate previous owner
        const prevOwner = G.players.find(p=>p.id!==occ && p.kingdom===MAP.regions[key].kingdom);
        // actually capital belongs to kingdom; find player owning that kingdom
        const capitalKingdom = MAP.regions[key].kingdom;
        const loser = G.players.find(p=>p.kingdom===capitalKingdom && p.id!==occ);
        if(loser && !loser.eliminated){
          loser.eliminated=true;
          logEntry("System","Kingdom defeated", `${loser.kingdom} has lost its capital and is eliminated.`);
        }
      }
    }
  }
}

function checkVictory(){
  // if human eliminated -> game over
  const human = humanPlayer();
  if(human.eliminated){
    openModal("Defeat", document.createTextNode("You lost your capital. Game over."), [
      {text:"New Game", kind:"primary", onClick:()=>{ closeModal(); resetToSetup(); }}
    ], true);
    return;
  }

  const alive = G.players.filter(p=>!p.eliminated);
  if(alive.length===1){
    const w = alive[0];
    openModal("Victory", document.createTextNode(`${w.kingdom} wins (last kingdom standing).`), [
      {text:"New Game", kind:"primary", onClick:()=>{ closeModal(); resetToSetup(); }}
    ], true);
    return;
  }

  const influenceTarget = (G.players.length<=3) ? 18 : 24;
  const extraNeeded = (G.players.length<=3) ? 2 : 4;

  for(const p of alive){
    if(p.inf >= influenceTarget){
      openModal("Victory", document.createTextNode(`${p.kingdom} wins by Influence (👑 ${p.inf}/${influenceTarget}).`), [
        {text:"New Game", kind:"primary", onClick:()=>{ closeModal(); resetToSetup(); }}
      ], true);
      return;
    }
    const core = KINGDOMS.find(k=>k.name===p.kingdom).core;
    const owned = ownedRegions(G,p).map(r=>r.key);
    const hasCore = core.every(k=>owned.includes(k));
    if(hasCore){
      const extra = owned.filter(k=>!core.includes(k) && !isTransitOnly(k)).length;
      if(extra >= extraNeeded){
        openModal("Victory", document.createTextNode(`${p.kingdom} wins by Dominion (core + ${extra} extra).`), [
          {text:"New Game", kind:"primary", onClick:()=>{ closeModal(); resetToSetup(); }}
        ], true);
        return;
      }
    }
  }
}

/** ---------- Turn end & AI ---------- **/
function endTurn(){
  // only human ends human turn
  const p=currentPlayer();
  if(!isHuman(p)) return;

  // advance turn
  advanceTurn();
  beginTurn();
  renderUI();
}

function advanceTurn(){
  // end of a player's turn increments contest timers already in afterAction; we also resolve once more at end of turn
  resolveControlProgress();

  // move to next non-eliminated player
  let tries=0;
  do{
    G.turnIndex = (G.turnIndex + 1) % G.turnOrder.length;
    tries++;
    if(tries>10) break;
  } while(playerById(G.turnOrder[G.turnIndex])?.eliminated);

  // if wrapped to start, round++
  if(G.turnIndex===0){
    G.round += 1;
  }
}

function runAIturn(p){
  const actions=[];
  // simple AI: prioritize capturing adjacent uncontrolled/enemy regions, then attack if in contested, then build farms if food low, then recruit
  // Determine AI armies; if none, call up if possible
  const cap = capitalOf(p.kingdom);

  const totalReserve = ownedRegions(G,p).reduce((s,r)=>s+G.regionState[r.key].reserve,0);
  const activeUnits = G.armies.filter(a=>a.playerId===p.id).reduce((s,a)=>s+a.units,0);

  const wantMoreUnits = totalReserve>0 && activeUnits<4 && p.food>=2;
  if(wantMoreUnits && G.ap>0){
    const n = Math.min(2, totalReserve);
    const apCost = n<=2 ? 1 : 2;
    if(G.ap>=apCost){
      // drain reserves
      let left=n;
      const regs = ownedRegions(G,p).filter(r=>G.regionState[r.key].reserve>0);
      for(const r of regs){
        if(left<=0) break;
        const take=Math.min(left, G.regionState[r.key].reserve);
        G.regionState[r.key].reserve -= take;
        left -= take;
      }
      addOrReinforceArmy(p.id, cap, n);
      G.ap -= apCost;
      actions.push(`Call up ${n} to ${labelOf(cap)} (AP ${apCost})`);
    }
  }

  // if no armies even now, recruit
  if(G.armies.filter(a=>a.playerId===p.id).length===0 && p.silver>=1 && G.ap>=1){
    const regs = ownedRegions(G,p).filter(r=>!isTransitOnly(r.key));
    const r = pick(regs);
    const st=G.regionState[r.key];
    const max=isCapital(r.key)?3:2;
    if(st.reserve<max){
      st.reserve += 1;
      p.silver -= 1;
      G.ap -= 1;
      actions.push(`Recruit in ${labelOf(r.key)}`);
    }
  }

  // move/attack loop
  while(G.ap>0){
    // choose an army
    const myArmies = G.armies.filter(a=>a.playerId===p.id);
    if(myArmies.length===0) break;
    // prefer largest army
    myArmies.sort((a,b)=>b.units-a.units);
    const a = myArmies[0];

    // if enemy in region and have AP for attack
    const enemies = enemyArmiesInRegion(p, a.regionKey);
    if(enemies.length>0 && G.ap>=1){
      const e = enemies.sort((x,y)=>y.units-x.units)[0];
      const res = resolveCombat({attacker:a, defender:e, regionKey:a.regionKey, attackerStance:aiChooseStance(), defenderStance:aiChooseStance()});
      G.ap -= 1;
      actions.push(`Attack in ${labelOf(a.regionKey)} • ${res.summary}`);
      continue;
    }

    // find best neighbor to move to: prioritize capturing core regions, then any uncontrolled, then enemy owned (for contest)
    const neigh = neighbors(a.regionKey).filter(n=>n.cost<=G.ap && !isTransitOnly(n.key));
    if(neigh.length===0) break;

    const core = KINGDOMS.find(k=>k.name===p.kingdom).core;
    neigh.sort((n1,n2)=>{
      const s=(n)=>{
        const st=G.regionState[n.key];
        let score=0;
        if(core.includes(n.key)) score+=6;
        if(st.owner===null) score+=4;
        if(st.owner && st.owner!==p.id) score+=3;
        // avoid moving into big enemy stack if small
        const enemies = G.armies.filter(x=>x.regionKey===n.key && x.playerId!==p.id).reduce((s,a)=>s+a.units,0);
        score -= Math.max(0,enemies - a.units);
        // prefer cheaper
        score += (2-n.cost);
        return score;
      };
      return s(n2)-s(n1);
    });

    const target = neigh[0];
    const from=a.regionKey;
    moveArmy(p,a,target.key,target.cost);
    actions.push(`Move ${labelOf(from)}→${labelOf(target.key)} (AP ${target.cost})`);
  }

  // build if can and economy needs: low food -> farm, else market, else hall
  const buildIf = (type)=>{
    const owned = ownedRegions(G,p).filter(r=>!isTransitOnly(r.key));
    if(owned.length===0) return false;
    const r = pick(owned);
    const st = G.regionState[r.key];
    const max=isCapital(r.key)?3:2;
    if(st.buildings.length>=max) return false;
    const b=BUILDINGS[type];
    if(p.silver < b.cost || G.ap<1) return false;
    p.silver -= b.cost;
    st.buildings.push(type);
    G.ap -= 1;
    actions.push(`Build ${b.name} in ${labelOf(r.key)}`);
    return true;
  };

  if(G.ap>0){
    if(p.food<=1) buildIf("farm");
    else if(p.silver>=2) buildIf("market");
    else buildIf("hall");
  }

  // recruitment if AP left
  if(G.ap>0 && p.silver>=1){
    const owned = ownedRegions(G,p).filter(r=>!isTransitOnly(r.key));
    owned.sort((a,b)=>G.regionState[a.key].reserve - G.regionState[b.key].reserve);
    for(const r of owned){
      const st=G.regionState[r.key];
      const max=isCapital(r.key)?3:2;
      if(st.reserve<max){
        st.reserve += 1;
        p.silver -= 1;
        G.ap -= 1;
        actions.push(`Recruit in ${labelOf(r.key)}`);
        break;
      }
    }
  }

  G.aiTurnSummary = `${p.kingdom}: ` + (actions.length?actions.slice(0,6).join("\n"):"No actions.");
  logEntry(p.kingdom, "AI turn", actions.length ? actions[0] : "No actions");
  // End AI turn automatically
  advanceTurn();
  beginTurn();
}

/** ---------- Sheets & modals ---------- **/
function openSheet(title, bodyNode, footButtons){
  $("#sheetTitle").textContent=title;
  const b=$("#sheetBody"); b.innerHTML=""; b.appendChild(bodyNode);
  const f=$("#sheetFoot"); f.innerHTML="";
  for(const btn of (footButtons||[])){
    const el=document.createElement("button");
    el.className="btn " + (btn.kind||"");
    el.textContent=btn.text;
    el.onclick=btn.onClick;
    f.appendChild(el);
  }
  $("#sheet").classList.remove("hidden");
}
function closeSheet(){ $("#sheet").classList.add("hidden"); }

function openModal(title, bodyNode, buttons, closable=true){
  $("#modalTitle").textContent=title;
  const b=$("#modalBody"); b.innerHTML="";
  if(typeof bodyNode==="string") b.textContent=bodyNode;
  else b.appendChild(bodyNode);
  const f=$("#modalFoot"); f.innerHTML="";
  for(const btn of (buttons||[])){
    const el=document.createElement("button");
    el.className="btn " + (btn.kind||"");
    el.textContent=btn.text;
    el.onclick=btn.onClick;
    f.appendChild(el);
  }
  $("#modal").classList.remove("hidden");
  if(closable){
    $("#modal").onclick=(e)=>{ if(e.target.id==="modal") closeModal(); };
  } else {
    $("#modal").onclick=null;
  }
}
function closeModal(){ $("#modal").classList.add("hidden"); }

function renderChoiceList(items){
  const wrap=document.createElement("div");
  wrap.style.display="flex";
  wrap.style.flexDirection="column";
  wrap.style.gap="10px";
  for(const it of items){
    const btn=document.createElement("button");
    btn.className="btn";
    btn.disabled=!!it.disabled;
    btn.innerHTML=`<div style="font-weight:900">${escapeHtml(it.title)}</div><div style="opacity:.75;font-size:12px">${escapeHtml(it.subtitle||"")}</div>`;
    btn.onclick=it.onClick;
    wrap.appendChild(btn);
  }
  return wrap;
}

/** ---------- Save/Load ---------- **/
function saveGame(){
  if(!G || G.mode!=="playing"){ alert("No active game."); return; }
  const data = JSON.stringify(G);
  localStorage.setItem("bfb_save", data);
  logEntry("System","Saved","Saved to your phone browser storage.");
}
function loadGame(){
  const data = localStorage.getItem("bfb_save");
  if(!data){ alert("No save found."); return; }
  try{
    G = JSON.parse(data);
    // rehydrate any missing fields
    G.pendingPrompt=null;
    G.aiTurnSummary=G.aiTurnSummary||"";
    G.selected=G.selected||{regionKey:null, armyId:null};
    G.mode="playing";
    renderRegions();
    renderOverlay();
    renderUI();
    logEntry("System","Loaded","Game loaded.");
  }catch(e){
    alert("Save is corrupted.");
  }
}

/** ---------- Help ---------- **/
function showHelp(){
  const d=document.createElement("div");
  d.innerHTML = `
    <p><b>How to play (mobile)</b></p>
    <ul>
      <li>Pan the map by dragging. Zoom with + / −.</li>
      <li>Tap a region dot to select it. Tap one of your coloured army tokens to select that army.</li>
      <li>Each turn you have <b>2 AP</b>. Move costs shown on the map lines.</li>
      <li><b>Events</b> and <b>Income & Upkeep</b> happen automatically at the start of each player’s turn (round 1 skips events).</li>
      <li>Food upkeep is <b>1 per active unit</b>. If you can’t pay, you must disband.</li>
      <li>Isle of Man is <b>transit-only</b> (cannot be claimed or built on).</li>
    </ul>
    <p><b>Victory</b></p>
    <ul>
      <li>Influence: reach 18 (2–3 players) or 24 (4–5 players).</li>
      <li>Dominion: control your 4 core regions + 2 extra (2–3 players) or +4 extra (4–5 players).</li>
      <li>Or eliminate all other kingdoms by taking their capitals.</li>
    </ul>
  `;
  openModal("Help", d, [{text:"Close", kind:"primary", onClick:closeModal}], true);
}

/** ---------- Reset ---------- **/
function resetToSetup(){
  G=null;
  $("#log").innerHTML="";
  $("#setupCard").classList.remove("hidden");
  $("#turnCard").classList.add("hidden");
  $("#logCard").classList.add("hidden");
  // keep map rendered for nice look
}

/** ---------- Wire up UI ---------- **/
function wire(){
  setupMapUI();

  $("#btnStart").addEventListener("click", startGame);
  $("#btnNew").addEventListener("click", ()=>{ resetToSetup(); });
  $("#btnSave").addEventListener("click", saveGame);
  $("#btnLoad").addEventListener("click", loadGame);
  $("#btnHelp").addEventListener("click", showHelp);

  $("#sheetClose").addEventListener("click", closeSheet);

  $("#btnMove").addEventListener("click", doMove);
  $("#btnAttack").addEventListener("click", doAttack);
  $("#btnRecruit").addEventListener("click", doRecruit);
  $("#btnCallup").addEventListener("click", doCallup);
  $("#btnBuild").addEventListener("click", doBuild);
  $("#btnPillage").addEventListener("click", doPillage);
  $("#btnDisband").addEventListener("click", doDisband);
  $("#btnEnd").addEventListener("click", endTurn);
  $("#btnClearLog").addEventListener("click", ()=>$("#log").innerHTML="");

  // click on map background clears selection
  $("#mapStage").addEventListener("click", (e)=>{
    if(e.target.classList.contains("regionDot") || e.target.classList.contains("token")) return;
    G && (G.selected={regionKey:null, armyId:null});
    renderUI();
  });
}

window.addEventListener("load", ()=>{
  wire();
  // initial dummy state for map render
  // create a lightweight G for showing map before starting
  G = {
    mode:"setup",
    activeRegions: Object.keys(MAP.regions),
    regionState: Object.fromEntries(Object.keys(MAP.regions).map(k=>[k,{owner:null,reserve:0,buildings:[],contest:null}])),
    armies:[],
    selected:{regionKey:null, armyId:null},
    players:[],
    ap:2,
    round:1,
    aiTurnSummary:"",
  };
  renderRegions();
  renderOverlay();
  renderTokens();
});
