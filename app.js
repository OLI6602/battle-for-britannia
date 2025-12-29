/* Battle for Britannia - Single Player Mobile PWA with AI + 2D SVG Map */

const $ = (id) => document.getElementById(id);

const KINGDOMS = {
  "Wessex": { capital: "Winchester", historic: ["Winchester", "East Anglia", "Cornwall", "Sussex & Kent"] },
  "Mercia": { capital: "Tamworth", historic: ["Tamworth", "Cheshire", "Hwicce", "Lindsey"] },
  "Northumbria": { capital: "Bernicia", historic: ["Bernicia", "Deira", "Tynedale", "Lothian"] },
  "Wales": { capital: "Gwynedd", historic: ["Gwynedd", "Powys", "Dyfed", "Gwent"] },
  "Picts": { capital: "Scone", historic: ["Scone", "Strathclyde", "Moray", "Cumbria"] },
};

const REGIONS = {
  "Winchester": { capital:true, terrainDef:0, slots:3, levyCap:3 },
  "Tamworth": { capital:true, terrainDef:0, slots:3, levyCap:3 },
  "Bernicia": { capital:true, terrainDef:1, slots:3, levyCap:3 },
  "Gwynedd": { capital:true, terrainDef:1, slots:3, levyCap:3 },
  "Scone": { capital:true, terrainDef:1, slots:3, levyCap:3 },

  "East Anglia": { terrainDef:0, slots:2, levyCap:2 },
  "Cornwall": { terrainDef:1, slots:2, levyCap:2 },
  "Sussex & Kent": { terrainDef:0, slots:2, levyCap:2 },

  "Cheshire": { terrainDef:0, slots:2, levyCap:2 },
  "Hwicce": { terrainDef:0, slots:2, levyCap:2 },
  "Lindsey": { terrainDef:0, slots:2, levyCap:2 },

  "Deira": { terrainDef:0, slots:2, levyCap:2 },
  "Tynedale": { terrainDef:1, slots:2, levyCap:2 },
  "Lothian": { terrainDef:1, slots:2, levyCap:2 },

  "Powys": { terrainDef:1, slots:2, levyCap:2 },
  "Dyfed": { terrainDef:1, slots:2, levyCap:2 },
  "Gwent": { terrainDef:0, slots:2, levyCap:2 },

  "Strathclyde": { terrainDef:1, slots:2, levyCap:2 },
  "Moray": { terrainDef:1, slots:2, levyCap:2 },
  "Cumbria": { terrainDef:1, slots:2, levyCap:2 },

  "Isle of Man": { terrainDef:0, slots:0, levyCap:0, transitOnly:true }
};

/* IMPORTANT: edit to match your board exactly */
const MAP = {
  "Winchester": {"Sussex & Kent":1, "Hwicce":1},
  "Sussex & Kent": {"Winchester":1, "East Anglia":1},
  "East Anglia": {"Sussex & Kent":1, "Lindsey":1, "Tynedale":2}, // bypass example
  "Cornwall": {"Hwicce":2},

  "Tamworth": {"Cheshire":1, "Hwicce":1, "Lindsey":1},
  "Cheshire": {"Tamworth":1, "Powys":2, "Isle of Man":2},
  "Hwicce": {"Tamworth":1, "Winchester":1, "Cornwall":2, "Gwent":2},
  "Lindsey": {"Tamworth":1, "East Anglia":1, "Deira":2},

  "Gwynedd": {"Powys":1, "Dyfed":2},
  "Powys": {"Gwynedd":1, "Cheshire":2, "Gwent":1},
  "Dyfed": {"Gwynedd":2, "Gwent":1},
  "Gwent": {"Dyfed":1, "Powys":1, "Hwicce":2},

  "Bernicia": {"Tynedale":1, "Lothian":2, "Deira":1},
  "Deira": {"Bernicia":1, "Lindsey":2, "Cumbria":2},
  "Tynedale": {"Bernicia":1, "Cumbria":2, "East Anglia":2},
  "Lothian": {"Bernicia":2, "Scone":2},

  "Scone": {"Moray":2, "Strathclyde":2, "Lothian":2},
  "Moray": {"Scone":2},
  "Strathclyde": {"Scone":2, "Cumbria":1, "Isle of Man":2},
  "Cumbria": {"Strathclyde":1, "Deira":2, "Tynedale":2},

  "Isle of Man": {"Cheshire":2, "Strathclyde":2}
};

/* 2D layout: tweak coords to look like your board */
const NODE_POS = {
  "Cornwall": [120, 620],
  "Winchester": [230, 540],
  "Hwicce": [340, 500],
  "Tamworth": [450, 440],
  "Sussex & Kent": [320, 600],
  "East Anglia": [520, 580],
  "Lindsey": [560, 460],
  "Cheshire": [330, 380],

  "Gwent": [260, 460],
  "Dyfed": [140, 430],
  "Powys": [240, 360],
  "Gwynedd": [160, 300],

  "Deira": [640, 360],
  "Bernicia": [740, 290],
  "Tynedale": [700, 410],
  "Cumbria": [520, 300],
  "Lothian": [820, 210],

  "Strathclyde": [560, 180],
  "Isle of Man": [420, 260],
  "Scone": [820, 120],
  "Moray": [860, 60]
};

const BUILD_COSTS = { Farm:1, Market:2, Hall:3, Castle:3 };
const CAPITAL_BASE = { food:1, silver:1 };
const REGION_CONTROL_ROUNDS = 1;
const CAPITAL_CAPTURE_ROUNDS = 2;
const HIGH_KING_INFLUENCE = 15;
const TERRITORY_EXTRA_BY_PLAYERS = {2:2,3:2,4:3,5:3};

const EVENTS = [
  ["Poor Harvest", 24],
  ["Banditry", 24],
  ["Local Unrest", 20],
  ["Good Harvest", 24],
  ["Trade Boom", 24],
  ["Skilled Craftsmen", 16],
  ["Noble Retinue Donated", 5],
  ["Royal Favour", 5],
  ["Bountiful Year", 5],
  ["Major Revolt", 3],
  ["Plague", 3],
  ["Treasury Crisis", 3],
];

function weightedPick(list){
  const total = list.reduce((s,[,w])=>s+w,0);
  let r = Math.random()*total;
  for (const [name,w] of list){
    r -= w;
    if (r <= 0) return name;
  }
  return list[list.length-1][0];
}
function deepCopy(obj){ return JSON.parse(JSON.stringify(obj)); }
function d6(){ return 1 + Math.floor(Math.random()*6); }
function shuffle(arr){ for (let i=arr.length-1; i>0; i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } }

let game = null;
let history = [];
let aiLock = false; // prevents recursive AI triggering

function newEmptyGame(){
  return {
    started:false,
    round:1,
    players: [],
    playerOrder: [],
    currentIdx: 0,
    ap: 2,
    buildDiscount: {},
    didEventThisTurn: {},
    didIncomeThisTurn: {},
    regions: Object.fromEntries(Object.entries(REGIONS).map(([name,meta]) => [
      name, {
        name,
        owner: null,
        stored: 0,
        armies: {}, // pid -> units
        buildings: { Farm:0, Market:0, Hall:0, Castle:0 },
        occupation: { timer:0, sole:null },
        meta: {...meta}
      }
    ])),
    selection: { A:null, B:null },
    log: [],
    winner: null,
    humanId: null
  };
}

function log(msg){
  game.log.push(msg);
  const el = $("log");
  el.textContent = game.log.slice(-250).join("\n");
  el.scrollTop = el.scrollHeight;
}

function pushHistory(){
  history.push(deepCopy(game));
  if (history.length > 60) history.shift();
}

function undo(){
  if (history.length === 0) return;
  game = history.pop();
  renderAll();
  log("Undo.");
  maybeRunAI();
}

function currentPlayer(){
  return game.players[ game.playerOrder[game.currentIdx] ];
}
function countActiveUnits(pid){
  let total = 0;
  for (const rs of Object.values(game.regions)){
    total += Number(rs.armies[pid] || 0);
  }
  return total;
}
function controlledRegions(pid){
  return Object.values(game.regions).filter(rs => rs.owner === pid && !rs.meta.outOfPlay);
}
function regionArmiesText(rs){
  const parts = [];
  for (const [pid, units] of Object.entries(rs.armies)){
    const u = Number(units);
    if (u>0){
      const pl = game.players[Number(pid)];
      parts.push(`${pl.name}:${u}`);
    }
  }
  return parts.length ? parts.join(" • ") : "none";
}
function regionLabelOwner(rs){
  if (rs.meta.transitOnly) return "Transit-only";
  if (rs.meta.outOfPlay) return "Out of play";
  if (rs.owner === null) return "—";
  const pl = game.players[rs.owner];
  return pl ? pl.name : "—";
}
function totalBuildings(rs){
  const b = rs.buildings;
  return b.Farm + b.Market + b.Hall + b.Castle;
}

function populateSetup(){
  const kSel = $("yourKingdom");
  kSel.innerHTML = Object.keys(KINGDOMS).map(k=>`<option value="${k}">${k}</option>`).join("");
}
populateSetup();

function startSinglePlayerGame(totalPlayers, yourName, yourKingdom){
  game = newEmptyGame();
  game.started = true;

  const allKingdoms = Object.keys(KINGDOMS).filter(k=>k !== yourKingdom);
  shuffle(allKingdoms);

  const picks = [{ name: yourName || "You", kingdom: yourKingdom, human:true }];
  while (picks.length < totalPlayers){
    const k = allKingdoms.shift();
    picks.push({ name: `AI (${k})`, kingdom: k, human:false });
  }

  game.players = picks.map((p, idx)=>({
    id: idx,
    name: p.name,
    kingdom: p.kingdom,
    capital: KINGDOMS[p.kingdom].capital,
    historic: KINGDOMS[p.kingdom].historic,
    food: 2,
    silver: 2,
    influence: 0,
    alive: true,
    ai: !p.human
  }));

  game.humanId = game.players.find(p=>!p.ai).id;

  // scaling rule: only used kingdoms' regions
  const used = new Set(["Isle of Man"]);
  for (const pl of game.players){
    for (const r of pl.historic) used.add(r);
  }
  for (const rName of Object.keys(game.regions)){
    if (!used.has(rName)) game.regions[rName].meta.outOfPlay = true;
  }

  // Initial ownership + 1 stored levy in capital
  for (const pl of game.players){
    const cap = game.regions[pl.capital];
    cap.owner = pl.id;
    cap.stored = 1;
  }

  game.playerOrder = game.players.map(p=>p.id);
  shuffle(game.playerOrder);
  game.currentIdx = 0;
  game.ap = 2;
  game.round = 1;
  game.buildDiscount = Object.fromEntries(game.players.map(p=>[p.id,0]));
  game.didEventThisTurn = Object.fromEntries(game.players.map(p=>[p.id,false]));
  game.didIncomeThisTurn = Object.fromEntries(game.players.map(p=>[p.id,false]));

  log(`Game started. First player: ${currentPlayer().name}. Round 1 skips events.`);
  renderAll();
  maybeRunAI();
}

/* --- Turn flow --- */

function endTurn(){
  pushHistory();

  resolveOccupationAndControl();
  const winner = checkVictory();
  if (winner !== null){
    game.winner = winner;
    log(`🏆 ${game.players[winner].name} wins!`);
    renderAll();
    return;
  }

  // next living player
  game.currentIdx = (game.currentIdx + 1) % game.playerOrder.length;
  for (let i=0; i<game.playerOrder.length; i++){
    if (currentPlayer().alive) break;
    game.currentIdx = (game.currentIdx + 1) % game.playerOrder.length;
  }

  const pid = currentPlayer().id;
  game.ap = 2;
  game.selection = {A:null, B:null};
  game.didEventThisTurn[pid] = false;
  game.didIncomeThisTurn[pid] = false;

  // new round when looped
  if (game.currentIdx === 0){
    game.round += 1;
    game.buildDiscount = Object.fromEntries(game.players.map(p=>[p.id,0]));
    log(`— Round ${game.round} begins. —`);
  }

  renderAll();
  maybeRunAI();
}

function resolveOccupationAndControl(){
  for (const rs of Object.values(game.regions)){
    if (rs.meta.outOfPlay || rs.meta.transitOnly) {
      rs.occupation.timer = 0;
      rs.occupation.sole = null;
      continue;
    }

    const occupiers = Object.entries(rs.armies)
      .filter(([pid,u]) => Number(u) > 0 && game.players[Number(pid)]?.alive)
      .map(([pid]) => Number(pid));

    if (occupiers.length === 1){
      const occ = occupiers[0];
      if (rs.occupation.sole === occ) rs.occupation.timer += 1;
      else { rs.occupation.sole = occ; rs.occupation.timer = 1; }

      if (rs.owner !== occ){
        const needed = rs.meta.capital ? CAPITAL_CAPTURE_ROUNDS : REGION_CONTROL_ROUNDS;
        if (rs.occupation.timer >= needed){
          if (rs.meta.capital && rs.owner !== null){
            const loser = rs.owner;
            log(`👑 CAPITAL CAPTURE! ${game.players[occ].name} takes ${rs.name}. ${game.players[loser].name} is eliminated.`);
            eliminatePlayer(loser);
          }
          rs.owner = occ;
          log(`${game.players[occ].name} takes control of ${rs.name}.`);
        }
      }
    } else {
      rs.occupation.sole = null;
      rs.occupation.timer = 0;
    }
  }
}

function eliminatePlayer(pid){
  const pl = game.players[pid];
  if (!pl) return;
  pl.alive = false;
  for (const rs of Object.values(game.regions)){
    delete rs.armies[pid];
    if (rs.owner === pid) rs.owner = null;
  }
}

function checkVictory(){
  for (const pl of game.players){
    if (!pl.alive) continue;

    if (pl.influence >= HIGH_KING_INFLUENCE) return pl.id;

    const owned = controlledRegions(pl.id).map(r=>r.name);
    const hasHistoric = pl.historic.every(r => owned.includes(r));
    if (!hasHistoric) continue;

    const extraNeeded = TERRITORY_EXTRA_BY_PLAYERS[game.players.length] ?? 3;
    const extraOwned = owned.filter(r => !pl.historic.includes(r) && !game.regions[r].meta.transitOnly).length;
    if (extraOwned >= extraNeeded) return pl.id;
  }
  return null;
}

/* --- Shared turn steps --- */

async function resolveEventFor(pid){
  const pl = game.players[pid];
  if (!pl.alive) return;
  if (game.round === 1){
    log(`${pl.name}: Event skipped in Round 1.`);
    game.didEventThisTurn[pid] = true;
    return;
  }
  if (game.didEventThisTurn[pid]) return;

  const card = weightedPick(EVENTS);
  log(`${pl.name} draws event: ${card}`);

  if (card === "Poor Harvest") pl.food = Math.max(0, pl.food - 1);
  else if (card === "Banditry") pl.silver = Math.max(0, pl.silver - 1);
  else if (card === "Local Unrest"){
    const regs = controlledRegions(pid).filter(r => r.stored > 0 && !r.meta.transitOnly);
    if (regs.length){
      regs.sort((a,b)=>b.stored-a.stored);
      regs[0].stored = Math.max(0, regs[0].stored - 1);
      log(`${pl.name} loses 1 stored levy from ${regs[0].name}.`);
    } else log("No stored levies to lose.");
  }
  else if (card === "Good Harvest") pl.food += 1;
  else if (card === "Trade Boom") pl.silver += 1;
  else if (card === "Skilled Craftsmen"){
    game.buildDiscount[pid] = 1;
    log(`${pl.name}: Next build cost -1 Silver (this turn).`);
  }
  else if (card === "Noble Retinue Donated"){
    const regs = controlledRegions(pid).filter(r=>!r.meta.transitOnly);
    if (regs.length){
      regs.sort((a,b)=>a.stored-b.stored);
      const r = regs[0];
      r.stored = Math.min(r.meta.levyCap, r.stored + 2);
      log(`${pl.name} gains +2 stored levies in ${r.name}.`);
    }
  }
  else if (card === "Royal Favour") pl.influence += 2;
  else if (card === "Bountiful Year"){ pl.food += 2; pl.silver += 1; }
  else if (card === "Major Revolt"){
    if (pl.silver >= 2){ pl.silver -= 2; log(`${pl.name} pays 2 Silver to prevent revolt.`); }
    else {
      const owned = controlledRegions(pid).filter(r => !r.meta.capital && !r.meta.transitOnly);
      if (owned.length){
        const lose = owned[owned.length-1];
        lose.owner = null;
        log(`${pl.name} loses control of ${lose.name}.`);
      }
    }
  }
  else if (card === "Plague"){
    const active = countActiveUnits(pid);
    const regs = controlledRegions(pid).filter(r=>r.stored>0);
    if (active > 0){
      disbandOneActive(pid);
    } else if (regs.length){
      regs[0].stored -= 1;
      log(`${pl.name} discards 1 stored levy from ${regs[0].name}.`);
    }
  }
  else if (card === "Treasury Crisis") pl.silver = Math.max(0, pl.silver - 2);

  game.didEventThisTurn[pid] = true;
}

function incomeAndUpkeepFor(pid){
  const pl = game.players[pid];
  if (!pl.alive) return;
  if (game.didIncomeThisTurn[pid]) return;

  let foodGain = 0, silverGain = 0, inflGain = 0;
  for (const rs of controlledRegions(pid)){
    foodGain += rs.buildings.Farm;
    silverGain += rs.buildings.Market;
    inflGain += rs.buildings.Hall;
  }
  foodGain += CAPITAL_BASE.food;
  silverGain += CAPITAL_BASE.silver;

  pl.food += foodGain;
  pl.silver += silverGain;
  pl.influence += inflGain;

  const upkeep = countActiveUnits(pid);
  if (upkeep > 0){
    if (pl.food >= upkeep) pl.food -= upkeep;
    else {
      let deficit = upkeep - pl.food;
      pl.food = 0;
      log(`${pl.name} cannot pay upkeep by ${deficit}. Disbanding...`);
      while (deficit > 0 && countActiveUnits(pid) > 0){
        disbandOneActive(pid);
        deficit -= 1;
      }
    }
  }
  log(`${pl.name} income: +${foodGain}F +${silverGain}S +${inflGain}I | upkeep ${upkeep} | now F${pl.food} S${pl.silver} I${pl.influence}`);
  game.didIncomeThisTurn[pid] = true;
}

function disbandOneActive(pid){
  for (const rs of Object.values(game.regions)){
    const u = Number(rs.armies[pid] || 0);
    if (u > 0){
      rs.armies[pid] = u - 1;
      log(`${game.players[pid].name} disbands 1 active unit from ${rs.name}.`);
      return true;
    }
  }
  return false;
}

/* --- Combat --- */

function stanceWinner(att, def){
  if (att === def) return null;
  const beats = { Offensive:"Defensive", Defensive:"Balanced", Balanced:"Offensive" };
  return (beats[att] === def) ? "attacker" : "defender";
}
function normalizeStance(s){
  const t = (s||"").toLowerCase();
  if (t.startsWith("off")) return "Offensive";
  if (t.startsWith("def")) return "Defensive";
  return "Balanced";
}
function hasEnemyIn(rs, pid){
  return Object.entries(rs.armies).some(([other,u]) => Number(other)!==pid && Number(u)>0 && game.players[Number(other)]?.alive);
}

function resolveCombat(attId, defId, rs, aiAuto=false){
  const attName = game.players[attId].name;
  const defName = game.players[defId].name;

  const atkUnits = Number(rs.armies[attId]||0);
  const defUnits = Number(rs.armies[defId]||0);
  if (atkUnits<=0 || defUnits<=0) return;

  log(`⚔️ Combat at ${rs.name}: ${attName}(${atkUnits}) vs ${defName}(${defUnits})`);

  if (atkUnits === 1 || defUnits === 1){
    const roll = d6();
    log(`Skirmish roll: ${roll}`);
    if (roll <= 2){
      rs.armies[attId] = Math.max(0, atkUnits - 1);
      log(`Defender holds. ${attName} loses 1.`);
    } else if (roll === 3){
      rs.armies[attId] = Math.max(0, atkUnits - 1);
      rs.armies[defId] = Math.max(0, defUnits - 1);
      log(`Stalemate. Both lose 1.`);
    } else {
      rs.armies[defId] = Math.max(0, defUnits - 1);
      log(`Attacker succeeds. ${defName} loses 1.`);
    }
    return;
  }

  const attStance = aiAuto ? (atkUnits > defUnits ? "Offensive" : "Balanced")
                          : normalizeStance(prompt(`Stance for ${attName} (Offensive/Balanced/Defensive):`, "Balanced") || "Balanced");
  const defStance = aiAuto ? (defUnits >= atkUnits ? "Defensive" : "Balanced")
                          : normalizeStance(prompt(`Stance for ${defName} (Offensive/Balanced/Defensive):`, "Defensive") || "Defensive");

  const win = stanceWinner(attStance, defStance);
  const stanceDefBonus = (win === "defender") ? 1 : 0;

  let defence = 0;
  defence += rs.meta.terrainDef;
  defence += 2 * Number(rs.buildings.Castle || 0);
  if (rs.meta.capital) defence += 1;
  defence += stanceDefBonus;

  const roll = d6();
  let mod = 0;
  if (roll === 1) mod = 2;
  else if (roll === 2) mod = 1;
  else if (roll === 5) mod = -1;
  else if (roll === 6) mod = -2;
  defence = Math.max(0, defence + mod);

  let added = 0;
  if (defence <= 1) added = 0;
  else if (defence <= 3) added = 1;
  else if (defence <= 5) added = 2;
  else added = 3;

  const atkFinal = atkUnits;
  const defFinal = defUnits + added;
  const diff = Math.abs(atkFinal - defFinal);
  const attackerWins = atkFinal > defFinal;

  log(`Stances: ${attName}=${attStance}, ${defName}=${defStance} | RPS: ${win || "tie"} (def+${stanceDefBonus})`);
  log(`Defence: terrain ${rs.meta.terrainDef} + castles ${2*Number(rs.buildings.Castle||0)} + capital ${rs.meta.capital?1:0} + stance ${stanceDefBonus} + die ${roll}(${mod>=0?"+":""}${mod}) = ${defence} => +${added}`);
  log(`Final: ${attName} ${atkFinal} vs ${defName} ${defFinal} | diff ${diff}`);

  if (diff <= 1){
    rs.armies[attId] = Math.max(0, atkUnits - 1);
    rs.armies[defId] = Math.max(0, defUnits - 1);
    log(`Result: Stalemate — both lose 1.`);
    return;
  }

  let loss = 1, retreat = 1, label="Minor win";
  if (diff <= 3){ loss=1; retreat=1; label="Minor win"; }
  else if (diff <= 5){ loss=2; retreat=2; label="Clear win"; }
  else { loss=3; retreat=2; label="Crushing win"; }

  const winnerId = attackerWins ? attId : defId;
  const loserId = attackerWins ? defId : attId;

  const loserUnitsNow = Number(rs.armies[loserId]||0);
  rs.armies[loserId] = Math.max(0, loserUnitsNow - loss);
  log(`Result: ${label} — ${game.players[winnerId].name} wins. ${game.players[loserId].name} loses ${loss}.`);

  if (label === "Crushing win"){
    rs.armies[loserId] = 0;
    log(`${game.players[loserId].name}'s remaining troops are disbanded.`);
  }

  retreatLoser(loserId, rs.name, retreat);
}

function retreatLoser(loserId, fromName, steps){
  const pl = game.players[loserId];
  if (!pl || !pl.alive) return;
  const units = Number(game.regions[fromName].armies[loserId]||0);
  if (units <= 0) return;

  let current = fromName;
  for (let i=0;i<steps;i++){
    const neighbors = Object.keys(MAP[current]||{});
    if (!neighbors.length) break;
    current = neighbors[Math.floor(Math.random()*neighbors.length)];
  }

  game.regions[fromName].armies[loserId] = 0;
  game.regions[current].armies[loserId] = Number(game.regions[current].armies[loserId]||0) + units;
  log(`${pl.name} retreats to ${current}.`);
}

/* --- AI --- */

function maybeRunAI(){
  if (!game || !game.started || game.winner !== null) return;
  if (aiLock) return;
  const pl = currentPlayer();
  if (!pl.ai) return;

  aiLock = true;
  try{
    runAITurn(pl.id);
  } finally {
    aiLock = false;
  }
  renderAll();
  endTurn();
}

function runAITurn(pid){
  const pl = game.players[pid];
  if (!pl.alive) return;

  log(`🤖 ${pl.name} taking turn...`);
  resolveEventFor(pid);
  incomeAndUpkeepFor(pid);

  while (game.ap > 0){
    if (countActiveUnits(pid) === 0){
      const totalStored = controlledRegions(pid).reduce((s,r)=>s+r.stored,0);
      if (totalStored > 0){
        const n = Math.min(totalStored, game.ap === 2 ? 3 : 2);
        callUpAI(pid, n);
        continue;
      }
    }
    if (tryBuildAI(pid)) continue;
    if (tryRecruitAI(pid)) continue;
    if (tryAttackAI(pid)) continue;
    if (tryMoveAI(pid)) continue;
    break;
  }
}

function callUpAI(pid, n){
  const pl = game.players[pid];
  const regs = controlledRegions(pid);
  let totalStored = regs.reduce((s,r)=>s+r.stored,0);
  if (totalStored <= 0) return false;

  const want = Math.max(1, Math.min(totalStored, n));
  const costAP = (want <= 2) ? 1 : 2;
  if (game.ap < costAP) return false;

  regs.sort((a,b)=>b.stored-a.stored);
  let remaining = want;
  for (const r of regs){
    while (r.stored > 0 && remaining > 0){
      r.stored -= 1;
      remaining -= 1;
    }
    if (remaining === 0) break;
  }
  const called = want - remaining;
  const cap = game.regions[pl.capital];
  cap.armies[pid] = Number(cap.armies[pid]||0) + called;
  game.ap -= costAP;
  log(`🤖 ${pl.name} calls up ${called} unit(s) to ${pl.capital} (AP-${costAP}).`);
  return true;
}

function isCapitalThreatened(pid){
  const cap = game.players[pid].capital;
  const neighbors = Object.keys(MAP[cap]||{});
  for (const n of neighbors){
    const rs = game.regions[n];
    if (!rs || rs.meta.outOfPlay) continue;
    if (Object.entries(rs.armies).some(([op,u])=>Number(op)!==pid && Number(u)>0 && game.players[Number(op)]?.alive)){
      return true;
    }
  }
  return false;
}

function tryBuildAI(pid){
  const pl = game.players[pid];
  if (game.ap < 1) return false;

  const regs = controlledRegions(pid).filter(r=>!r.meta.transitOnly && !r.meta.outOfPlay);
  if (!regs.length) return false;

  regs.sort((a,b)=>(b.meta.capital?1:0)-(a.meta.capital?1:0));
  const r = regs[0];

  if (totalBuildings(r) >= r.meta.slots) return false;

  const active = countActiveUnits(pid);
  const threatened = isCapitalThreatened(pid);

  let build = null;
  if (threatened && pl.silver >= 3) build = "Castle";
  else if (pl.food <= active) build = "Farm";
  else if (pl.silver <= 2) build = "Market";
  else if (pl.influence < 8 && pl.silver >= 3) build = "Hall";
  else if (pl.silver >= 2) build = "Market";
  else return false;

  const discount = Number(game.buildDiscount[pid]||0);
  const cost = Math.max(0, BUILD_COSTS[build] - discount);
  if (pl.silver < cost) return false;

  pl.silver -= cost;
  game.buildDiscount[pid] = 0;
  r.buildings[build] += 1;
  game.ap -= 1;
  log(`🤖 ${pl.name} builds ${build} in ${r.name} (paid ${cost}S).`);
  return true;
}

function tryRecruitAI(pid){
  const pl = game.players[pid];
  if (game.ap < 1) return false;
  if (pl.silver < 1) return false;
  const regs = controlledRegions(pid).filter(r=>!r.meta.transitOnly && r.stored < r.meta.levyCap);
  if (!regs.length) return false;

  regs.sort((a,b)=>a.stored-b.stored);
  const r = regs[0];
  pl.silver -= 1;
  r.stored += 1;
  game.ap -= 1;
  log(`🤖 ${pl.name} recruits 1 stored levy in ${r.name}.`);
  return true;
}

function tryAttackAI(pid){
  if (game.ap < 1) return false;

  const battleRegions = Object.values(game.regions).filter(rs=>{
    if (rs.meta.outOfPlay) return false;
    const myU = Number(rs.armies[pid]||0);
    return myU>0 && hasEnemyIn(rs,pid);
  });
  if (!battleRegions.length) return false;

  battleRegions.sort((a,b)=>attackScore(pid,b)-attackScore(pid,a));
  const rs = battleRegions[0];

  const enemies = Object.entries(rs.armies)
    .filter(([op,u])=>Number(op)!==pid && Number(u)>0 && game.players[Number(op)]?.alive)
    .map(([op])=>Number(op));

  enemies.sort((a,b)=>Number(rs.armies[a]||0)-Number(rs.armies[b]||0));
  const defId = enemies[0];

  resolveCombat(pid, defId, rs, true);
  game.ap -= 1;
  return true;
}

function attackScore(pid, rs){
  const myU = Number(rs.armies[pid]||0);
  const enemyU = Object.entries(rs.armies)
    .filter(([op,u])=>Number(op)!==pid && Number(u)>0 && game.players[Number(op)]?.alive)
    .reduce((s,[,u])=>s+Number(u),0);
  return myU - enemyU;
}

function tryMoveAI(pid){
  const stacks = Object.values(game.regions).filter(rs=>!rs.meta.outOfPlay && Number(rs.armies[pid]||0)>0 && (rs.name in MAP));
  if (!stacks.length) return false;

  stacks.sort((a,b)=>Number(b.armies[pid])-Number(a.armies[pid]));
  const from = stacks[0];

  const candidates = Object.keys(MAP[from.name]||{});
  if (!candidates.length) return false;

  candidates.sort((a,b)=>moveValue(pid, b) - moveValue(pid, a));
  const toName = candidates[0];
  const cost = MAP[from.name][toName];
  if (game.ap < cost) return false;

  const to = game.regions[toName];
  const units = Number(from.armies[pid]||0);
  from.armies[pid] = 0;
  to.armies[pid] = Number(to.armies[pid]||0) + units;
  game.ap -= cost;
  log(`🤖 ${game.players[pid].name} moves ${units} ${from.name} → ${toName} (AP-${cost}).`);
  return true;
}

function moveValue(pid, regionName){
  const rs = game.regions[regionName];
  if (!rs || rs.meta.outOfPlay) return -999;
  if (rs.meta.transitOnly) return -5;
  if (rs.owner === null) return 10;
  if (rs.owner !== pid) return 12;
  return 0;
}

/* --- Human action guards --- */

function requireGame(){
  if (!game || !game.started){
    alert("Start a game first.");
    return false;
  }
  if (game.winner !== null){
    alert("Game over. Start a new game.");
    return false;
  }
  return true;
}
function requireHumanTurn(){
  if (currentPlayer().id !== game.humanId){
    alert("It’s an AI turn.");
    return false;
  }
  return true;
}
function requireAP(n){
  if (game.ap < n){
    alert(`Not enough AP (need ${n}).`);
    return false;
  }
  return true;
}
function selectedRegionA(){ return game.selection.A ? game.regions[game.selection.A] : null; }
function selectedRegionB(){ return game.selection.B ? game.regions[game.selection.B] : null; }

/* --- Human buttons --- */

async function humanResolveEvent(){
  if (!requireGame() || !requireHumanTurn()) return;
  pushHistory();
  await resolveEventFor(game.humanId);
  renderAll();
}
function humanIncome(){
  if (!requireGame() || !requireHumanTurn()) return;
  pushHistory();
  incomeAndUpkeepFor(game.humanId);
  renderAll();
}

async function humanRecruit(){
  if (!requireGame() || !requireHumanTurn()) return;
  if (!requireAP(1)) return;
  const pl = currentPlayer();
  if (pl.silver < 1){ alert("Not enough Silver."); return; }

  const regs = controlledRegions(pl.id).filter(r=>!r.meta.transitOnly && r.stored < r.meta.levyCap);
  if (!regs.length){ alert("No levy slots available."); return; }

  const pick = await pickFromList("Recruit levy into which region?", regs.map(r=>`${r.name} (stored ${r.stored}/${r.meta.levyCap})`));
  if (!pick) return;
  const rName = pick.split(" (")[0];
  pushHistory();
  pl.silver -= 1;
  game.regions[rName].stored += 1;
  game.ap -= 1;
  log(`${pl.name} recruits 1 stored levy in ${rName}. (AP-1, S-1)`);
  renderAll();
}

async function humanCallUp(){
  if (!requireGame() || !requireHumanTurn()) return;
  const pl = currentPlayer();
  const regs = controlledRegions(pl.id);
  const totalStored = regs.reduce((s,r)=>s+r.stored,0);
  if (totalStored <= 0){ alert("No stored levies."); return; }

  const nStr = await promptModal("Call Up", `How many levies to call up to ${pl.capital}? (1-${totalStored})`, "1");
  if (!nStr) return;
  const want = Math.max(1, Math.min(totalStored, Number(nStr)));
  const costAP = (want <= 2) ? 1 : 2;
  if (!requireAP(costAP)) return;

  pushHistory();
  let remaining = want;
  while (remaining > 0){
    const sources = controlledRegions(pl.id).filter(r=>r.stored>0).map(r=>r.name);
    const src = await pickFromList(`Choose source region (${remaining} remaining)`, sources);
    if (!src) break;
    game.regions[src].stored -= 1;
    remaining -= 1;
  }
  const called = want - remaining;
  const cap = game.regions[pl.capital];
  cap.armies[pl.id] = Number(cap.armies[pl.id]||0) + called;
  game.ap -= costAP;
  log(`${pl.name} calls up ${called} unit(s) to ${pl.capital}. (AP-${costAP})`);
  renderAll();
}

function humanMove(){
  if (!requireGame() || !requireHumanTurn()) return;
  const pl = currentPlayer();
  const A = selectedRegionA();
  const B = selectedRegionB();
  if (!A || !B){ alert("Select A (from) and B (to)."); return; }
  const cost = (MAP[A.name]||{})[B.name];
  if (cost == null){ alert("Not connected."); return; }
  if (!requireAP(cost)) return;
  const units = Number(A.armies[pl.id]||0);
  if (units <= 0){ alert("No army there."); return; }

  pushHistory();
  A.armies[pl.id] = 0;
  B.armies[pl.id] = Number(B.armies[pl.id]||0) + units;
  game.ap -= cost;
  log(`${pl.name} moves ${units} ${A.name} → ${B.name} (AP-${cost}).`);
  renderAll();
}

async function humanAttack(){
  if (!requireGame() || !requireHumanTurn()) return;
  if (!requireAP(1)) return;
  const pl = currentPlayer();
  const A = selectedRegionA();
  const B = selectedRegionB();

  let battleground = null;
  if (B && Number(B.armies[pl.id]||0) > 0 && hasEnemyIn(B, pl.id)) battleground = B;
  else if (A && Number(A.armies[pl.id]||0) > 0 && hasEnemyIn(A, pl.id)) battleground = A;

  if (!battleground){ alert("No valid battle: you need your army + enemy in same region."); return; }

  const enemies = Object.entries(battleground.armies)
    .filter(([op,u])=>Number(op)!==pl.id && Number(u)>0 && game.players[Number(op)]?.alive)
    .map(([op])=>Number(op));

  const pick = await pickFromList(`Attack in ${battleground.name}. Choose defender`, enemies.map(id=>game.players[id].name));
  if (!pick) return;
  const defId = enemies.find(id=>game.players[id].name === pick);

  pushHistory();
  resolveCombat(pl.id, defId, battleground, false);
  game.ap -= 1;
  renderAll();
}

async function humanBuild(){
  if (!requireGame() || !requireHumanTurn()) return;
  if (!requireAP(1)) return;
  const pl = currentPlayer();
  const A = selectedRegionA();
  if (!A){ alert("Select a region (A)."); return; }
  if (A.owner !== pl.id){ alert("You must control the region."); return; }
  if (A.meta.transitOnly){ alert("Cannot build on transit-only region."); return; }
  if (totalBuildings(A) >= A.meta.slots){ alert("No building slots available."); return; }

  const opts = ["Farm","Market","Hall","Castle"];
  const pick = await pickFromList("Choose building", opts.map(b=>`${b} (cost ${BUILD_COSTS[b]})`));
  if (!pick) return;
  const building = pick.split(" ")[0];

  const discount = Number(game.buildDiscount[pl.id]||0);
  const cost = Math.max(0, BUILD_COSTS[building] - discount);
  if (pl.silver < cost){ alert(`Not enough Silver (need ${cost}).`); return; }

  pushHistory();
  pl.silver -= cost;
  game.buildDiscount[pl.id] = 0;
  A.buildings[building] += 1;
  game.ap -= 1;
  log(`${pl.name} builds ${building} in ${A.name} (paid ${cost}S).`);
  renderAll();
}

async function humanPillage(){
  if (!requireGame() || !requireHumanTurn()) return;
  if (!requireAP(1)) return;
  const pl = currentPlayer();
  const A = selectedRegionA();
  if (!A){ alert("Select a region (A)."); return; }
  if (A.meta.transitOnly || A.meta.outOfPlay) { alert("Invalid region."); return; }
  if (Number(A.armies[pl.id]||0) <= 0){ alert("You must have an army there."); return; }
  if (A.owner === pl.id){ alert("Can't pillage your own controlled region."); return; }

  const destroyable = [];
  if (A.buildings.Farm > 0) destroyable.push("Farm");
  if (A.buildings.Market > 0) destroyable.push("Market");
  if (A.buildings.Hall > 0) destroyable.push("Hall");
  if (!destroyable.length){ alert("No pillageable buildings (castles cannot be pillaged)."); return; }

  const pick = await pickFromList("Destroy which building?", destroyable);
  if (!pick) return;

  pushHistory();
  A.buildings[pick] -= 1;
  pl.silver += 1;
  A.owner = null;
  game.ap -= 1;
  log(`${pl.name} pillages ${A.name}: destroys ${pick}, gains +1S. Region becomes uncontrolled.`);
  renderAll();
}

/* --- 2D SVG Map rendering --- */

function renderMap(){
  const svg = $("mapSvg");
  svg.innerHTML = "";

  if (!game || !game.started) return;

  const drawn = new Set();
  for (const [from, tos] of Object.entries(MAP)){
    const a = game.regions[from];
    if (!a || a.meta.outOfPlay) continue;
    for (const [to, cost] of Object.entries(tos)){
      const b = game.regions[to];
      if (!b || b.meta.outOfPlay) continue;

      const key = [from,to].sort().join("|");
      if (drawn.has(key)) continue;
      drawn.add(key);

      const [x1,y1] = NODE_POS[from] || [100,100];
      const [x2,y2] = NODE_POS[to] || [200,200];

      const line = el("line", { x1, y1, x2, y2, stroke:"#2a2e38", "stroke-width":"4" });
      svg.appendChild(line);

      const mx = (x1+x2)/2;
      const my = (y1+y2)/2;
      const t = el("text", { x: mx, y: my, class:"edgeLabel", "text-anchor":"middle", "dominant-baseline":"middle" });
      t.textContent = String(cost);
      svg.appendChild(t);
    }
  }

  for (const [name, rs] of Object.entries(game.regions)){
    if (rs.meta.outOfPlay) continue;
    const [x,y] = NODE_POS[name] || [50,50];

    const owner = rs.owner;
    const ownerColor = owner === null ? "#a7acb7" : colorForPlayer(owner);

    const g = el("g", { "data-node": name, style:"cursor:pointer" });

    const r = 24;
    const circle = el("circle", {
      cx:x, cy:y, r,
      class:`nodeCircle ${game.selection.A===name?"nodeSelA":""} ${game.selection.B===name?"nodeSelB":""}`,
      fill: ownerColor
    });
    g.appendChild(circle);

    const label = el("text", { x, y: y-30, class:"nodeText", "text-anchor":"middle" });
    label.textContent = name;
    g.appendChild(label);

    const meta = el("text", { x, y: y+40, class:"nodeMeta", "text-anchor":"middle" });
    const armies = regionArmiesText(rs);
    const occ = rs.meta.transitOnly ? "Transit" : `Occ ${rs.occupation.timer}`;
    meta.textContent = `${occ} • ${armies === "none" ? "—" : armies}`;
    g.appendChild(meta);

    g.addEventListener("click", ()=>{
      if (!game.selection.A || game.selection.A === name){
        game.selection.A = (game.selection.A === name) ? null : name;
      } else {
        game.selection.B = name;
      }
      renderAll();
      renderRegionDetail();
    });

    svg.appendChild(g);
  }
}

function el(tag, attrs={}){
  const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k,v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
}

function colorForPlayer(pid){
  const palette = ["#7dd3fc","#86efac","#fbbf24","#fb7185","#c4b5fd"];
  return palette[pid % palette.length];
}

/* --- Side panels --- */

function renderPlayersPanel(){
  const wrap = $("playersPanel");
  wrap.innerHTML = "";
  if (!game || !game.started) return;

  for (const pl of game.players){
    const isCurrent = currentPlayer().id === pl.id;
    const div = document.createElement("div");
    div.className = "playerCard" + (pl.alive ? "" : " dead");
    div.innerHTML = `
      <div class="playerTop">
        <div class="playerName">${pl.name} ${isCurrent ? "⭐" : ""} ${pl.ai ? "🤖" : ""}</div>
        <div class="badge">${pl.kingdom}</div>
      </div>
      <div class="stats">
        <div class="stat">Food: <b>${pl.food}</b></div>
        <div class="stat">Silver: <b>${pl.silver}</b></div>
        <div class="stat">Influence: <b>${pl.influence}</b></div>
        <div class="stat">Active: <b>${countActiveUnits(pl.id)}</b></div>
      </div>
    `;
    wrap.appendChild(div);
  }
}

function renderRegionDetail(){
  const elD = $("regionDetail");
  if (!game || !game.started){ elD.textContent = "Tap a region."; return; }
  const A = selectedRegionA();
  const B = selectedRegionB();
  $("selA").textContent = A ? A.name : "—";
  $("selB").textContent = B ? B.name : "—";
  if (!A){ elD.textContent = "Tap a region."; return; }

  const b = A.buildings;
  const links = Object.entries(MAP[A.name]||{}).map(([to,c])=>`${to} (AP ${c})`).join(", ") || "none";
  elD.innerHTML = [
    `<b>${A.name}</b> ${A.meta.capital ? "(Capital)" : ""} ${A.meta.transitOnly ? "(Transit-only)" : ""}`,
    `Owner: <b>${regionLabelOwner(A)}</b>`,
    `Terrain defence: <b>+${A.meta.terrainDef}</b>`,
    `Levy cap: <b>${A.meta.levyCap}</b> | Stored: <b>${A.stored}</b>`,
    `Slots: <b>${A.meta.slots}</b> | Buildings: Farm ${b.Farm}, Market ${b.Market}, Hall ${b.Hall}, Castle ${b.Castle}`,
    `Armies: <b>${regionArmiesText(A)}</b>`,
    `Occupation: sole=<b>${A.occupation.sole===null?"—":game.players[A.occupation.sole]?.name}</b> timer=<b>${A.occupation.timer}</b>`,
    `<span class="muted">Links:</span> ${links}`
  ].join("<br/>");
}

function renderTurnInfo(){
  if (!game || !game.started){
    $("turnInfo").textContent = "Not started.";
    $("roundNum").textContent = "—";
    $("apNum").textContent = "—";
    $("subtitle").textContent = "Single Player (AI Kingdoms)";
    return;
  }
  const pl = currentPlayer();
  $("turnInfo").innerHTML = `<b>${pl.name}</b> (${pl.kingdom}) ${pl.ai ? "🤖" : ""}`;
  $("roundNum").textContent = String(game.round);
  $("apNum").textContent = String(game.ap);
  $("subtitle").textContent = game.winner !== null ? `Winner: ${game.players[game.winner].name}` : `Round ${game.round} • ${pl.name}'s turn`;
}

function renderAll(){
  renderTurnInfo();
  renderPlayersPanel();
  renderMap();
  renderRegionDetail();

  const isHuman = game && game.started && game.winner === null && currentPlayer().id === game.humanId;

  const disable = (id, cond) => { $(id).disabled = !!cond; };
  const baseDisabled = (!game || !game.started || game.winner !== null);

  ["actEvent","actIncome","actRecruit","actCallup","actMove","actAttack","actBuild","actPillage"]
    .forEach(id => disable(id, baseDisabled || !isHuman));

  disable("btnEndTurn", baseDisabled || !isHuman);
  disable("btnUndo", baseDisabled);
  disable("btnSave", baseDisabled);
  disable("btnLoad", false);
}

/* --- Modals --- */

async function promptModal(title, msg, def=""){
  const modal = $("modal");
  const inputId = "modalInput";
  $("modalTitle").textContent = title;
  $("modalBody").innerHTML = `
    <div class="small">${escapeHtml(msg)}</div>
    <div style="margin-top:10px">
      <input id="${inputId}" value="${escapeAttr(def)}" style="width:100%"/>
    </div>
  `;
  $("modalOk").textContent = "OK";
  $("modalCancel").textContent = "Cancel";

  return new Promise((resolve)=>{
    modal.addEventListener("close", ()=>{
      if (modal.returnValue === "ok") resolve($(inputId).value);
      else resolve(null);
    }, { once:true });
    modal.showModal();
    setTimeout(()=>$(inputId).focus(), 50);
  });
}

async function pickFromList(title, items){
  const buttons = items.map((it, i)=>`
    <button type="button" class="btn" data-i="${i}" style="width:100%; text-align:left; margin:6px 0;">
      ${escapeHtml(it)}
    </button>
  `).join("");

  const modal = $("modal");
  $("modalTitle").textContent = title;
  $("modalBody").innerHTML = buttons;
  $("modalOk").textContent = "Close";
  $("modalCancel").textContent = "Close";

  return new Promise((resolve)=>{
    function cleanup(){
      modal.removeEventListener("close", onClose);
      $("modalBody").querySelectorAll("button[data-i]").forEach(b=>b.removeEventListener("click", onPick));
    }
    function onPick(e){
      const idx = Number(e.currentTarget.getAttribute("data-i"));
      cleanup();
      modal.close("cancel");
      resolve(items[idx]);
    }
    function onClose(){
      cleanup();
      resolve(null);
    }
    modal.addEventListener("close", onClose, { once:true });
    $("modalBody").querySelectorAll("button[data-i]").forEach(b=>b.addEventListener("click", onPick));
    modal.showModal();
  });
}

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m])); }
function escapeAttr(s){ return escapeHtml(s).replace(/"/g,"&quot;"); }

/* --- Buttons & wiring --- */

$("btnStart").addEventListener("click", ()=>{
  const total = Number($("playerCount").value);
  const name = $("yourName").value.trim() || "You";
  const kingdom = $("yourKingdom").value;
  history = [];
  startSinglePlayerGame(total, name, kingdom);
});

$("btnEndTurn").addEventListener("click", ()=>{ if(requireGame() && requireHumanTurn()) endTurn(); });
$("btnUndo").addEventListener("click", ()=>{ if(requireGame()) undo(); });

$("actEvent").addEventListener("click", humanResolveEvent);
$("actIncome").addEventListener("click", humanIncome);
$("actRecruit").addEventListener("click", humanRecruit);
$("actCallup").addEventListener("click", humanCallUp);
$("actMove").addEventListener("click", humanMove);
$("actAttack").addEventListener("click", humanAttack);
$("actBuild").addEventListener("click", humanBuild);
$("actPillage").addEventListener("click", humanPillage);

$("btnNew").addEventListener("click", ()=>{
  if (confirm("Start a new game?")){
    game = null; history = [];
    $("log").textContent = "";
    renderAll();
  }
});

$("btnSave").addEventListener("click", ()=>{
  if (!game || !game.started){ alert("No game to save."); return; }
  localStorage.setItem("britannia_save", JSON.stringify(game));
  alert("Saved on this device.");
});
$("btnLoad").addEventListener("click", ()=>{
  const raw = localStorage.getItem("britannia_save");
  if (!raw){ alert("No save found."); return; }
  game = JSON.parse(raw);
  history = [];
  renderAll();
  log("Loaded save.");
  maybeRunAI();
});
$("btnHelp").addEventListener("click", ()=> $("help").showModal());

// service worker
if ("serviceWorker" in navigator){
  navigator.serviceWorker.register("sw.js").catch(()=>{});
}

renderAll();
