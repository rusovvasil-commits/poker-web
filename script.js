// Texas Hold'em demo for 1 table, 3 players
// Simplified betting: each act rotates, bet +10 as flat increment, check/call matches current bet.
// Hand evaluation supports proper 5-card ranking; we choose best 5 out of 7.

const SUITS = ["♠","♥","♦","♣"];
const RANKS = ["2","3","4","5","6","7","8","9","T","J","Q","K","A"];

function cardCode(rank, suit){ return rank + suit; }

function makeDeck(){
  const deck = [];
  for (const s of SUITS){
    for (const r of RANKS){
      deck.push(cardCode(r,s));
    }
  }
  return deck;
}

function shuffle(array){
  for (let i = array.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

const state = {
  deck: [],
  hands: [[],[],[]],
  community: [],
  stacks: [1000,1000,1000],
  bets: [0,0,0],
  inHand: [true,true,true],
  pot: 0,
  toAct: 0,
  street: "pre", // pre, flop, turn, river, showdown
  maxBet: 0,
  log: [],
};

function setStatus(txt){
  document.getElementById("status").textContent = txt;
}
function log(msg, cls=""){
  const el = document.getElementById("action-log");
  const div = document.createElement("div");
  div.textContent = msg;
  if (cls) div.classList.add(cls);
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function render(){
  // pot
  document.getElementById("pot").textContent = state.pot;

  // community
  const comm = document.getElementById("community-cards");
  comm.innerHTML = "";
  state.community.forEach(c => comm.appendChild(renderCard(c)));

  // hands + stacks/bets
  for (let i=0;i<3;i++){
    const h = document.getElementById(`hand-${i}`);
    h.innerHTML = "";
    state.hands[i].forEach(c => h.appendChild(renderCard(c)));
    document.querySelector(`.stack-val[data-id="${i}"]`).textContent = state.stacks[i];
    document.querySelector(`.bet-val[data-id="${i}"]`).textContent = state.bets[i];
    document.getElementById(`p${i}`).style.opacity = state.inHand[i] ? "1" : ".5";
  }

  // buttons enable/disable
  document.getElementById("btn-deal").disabled = !(state.street === "pre" && state.hands[0].length===0);
  document.getElementById("btn-flop").disabled = !(state.street==="pre" && state.hands[0].length>0 && state.community.length===0);
  document.getElementById("btn-turn").disabled = !(state.street==="flop");
  document.getElementById("btn-river").disabled = !(state.street==="turn");
  document.getElementById("btn-showdown").disabled = !(state.street==="river");

  // highlight toAct
  for (let i=0;i<3;i++){
    const p = document.getElementById(`p${i}`);
    p.style.outline = (i === state.toAct && state.inHand[i]) ? "2px solid #5ea7ff" : "none";
  }
}

function renderCard(code){
  const div = document.createElement("div");
  div.className = "card";
  const r = code[0];
  const s = code.slice(1);
  const corner = document.createElement("div");
  corner.className = "corner";
  corner.textContent = r;
  const suit = document.createElement("div");
  suit.className = "suit";
  suit.textContent = s;
  div.appendChild(corner);
  div.appendChild(suit);
  return div;
}

function newHand(){
  Object.assign(state, {
    deck: shuffle(makeDeck()),
    hands: [[],[],[]],
    community: [],
    bets: [0,0,0],
    inHand: [true,true,true],
    pot: 0,
    toAct: 0,
    street: "pre",
    maxBet: 0,
  });
  setStatus("Роздаємо...");
  log("Нова роздача","info");
  render();
}

function deal(){
  // 2 cards each
  for (let r=0;r<2;r++){
    for (let i=0;i<3;i++){
      state.hands[i].push(state.deck.pop());
    }
  }
  state.street = "pre";
  setStatus("Префлоп: хід гравця " + (state.toAct+1));
  render();
}

function flop(){
  // burn one
  state.deck.pop();
  // 3 cards
  state.community.push(state.deck.pop(), state.deck.pop(), state.deck.pop());
  state.street = "flop";
  state.maxBet = 0;
  state.bets = [0,0,0];
  setStatus("Флоп: хід гравця " + (state.toAct+1));
  render();
}
function turn(){
  state.deck.pop();
  state.community.push(state.deck.pop());
  state.street = "turn";
  state.maxBet = 0;
  state.bets = [0,0,0];
  setStatus("Тьорн: хід гравця " + (state.toAct+1));
  render();
}
function river(){
  state.deck.pop();
  state.community.push(state.deck.pop());
  state.street = "river";
  state.maxBet = 0;
  state.bets = [0,0,0];
  setStatus("Рівер: хід гравця " + (state.toAct+1));
  render();
}

function nextPlayer(){
  for (let tries=0; tries<3; tries++){
    state.toAct = (state.toAct + 1) % 3;
    if (state.inHand[state.toAct]) break;
  }
  setStatus((state.street==="pre"?"Префлоп":"Хід") + ": гравець " + (state.toAct+1));
  render();
}

function allBetsEqualOrFolded(){
  const activeBets = [];
  for (let i=0;i<3;i++){
    if (state.inHand[i]) activeBets.push(state.bets[i]);
  }
  if (activeBets.length<=1) return true;
  const first = activeBets[0];
  return activeBets.every(b => b === first);
}

function collectBetsToPot(){
  for (let i=0;i<3;i++){
    state.pot += state.bets[i];
    state.bets[i] = 0;
  }
}

function attemptAdvanceStreet(){
  if (!allBetsEqualOrFolded()) return;
  // If only one player remains -> showdown immediately
  const alive = state.inHand.filter(x=>x).length;
  if (alive === 1){
    return showdown(true);
  }
  // Advance street if appropriate
  if (state.street==="pre" && state.community.length===0){
    collectBetsToPot();
    flop();
  } else if (state.street==="flop"){
    collectBetsToPot();
    turn();
  } else if (state.street==="turn"){
    collectBetsToPot();
    river();
  } else if (state.street==="river"){
    collectBetsToPot();
    showdown(false);
  }
}

function actFold(i){
  if (!state.inHand[i]) return;
  state.inHand[i] = false;
  log(`Player ${i+1}: Fold`,"lose");
  nextPlayer();
  attemptAdvanceStreet();
}

function actCheckCall(i){
  if (!state.inHand[i]) return;
  const need = state.maxBet - state.bets[i];
  if (need <= 0){
    log(`Player ${i+1}: Check`);
  } else {
    const toPay = Math.min(need, state.stacks[i]);
    state.stacks[i] -= toPay;
    state.bets[i] += toPay;
    log(`Player ${i+1}: Call ${toPay}`);
  }
  render();
  attemptAdvanceStreet();
  nextPlayer();
}

function actBet(i){
  if (!state.inHand[i]) return;
  const incr = 10;
  const toPay = (state.maxBet - state.bets[i]) + incr;
  const actual = Math.min(toPay, state.stacks[i]);
  state.stacks[i] -= actual;
  state.bets[i] += actual;
  state.maxBet = Math.max(state.maxBet, state.bets[i]);
  log(`Player ${i+1}: Bet/Raise ${actual}`);
  render();
  nextPlayer();
}

function showdown(winsByFold){
  state.street = "showdown";
  // Determine winner(s)
  const aliveIdx = [0,1,2].filter(i => state.inHand[i]);
  let winners = [];
  if (winsByFold){
    winners = aliveIdx; // only 1 anyway
  } else {
    // proper hand evaluation among alive players
    let bestRank = null;
    for (const i of aliveIdx){
      const seven = [...state.hands[i], ...state.community];
      const {name, rankTuple, best5} = bestOfSeven(seven);
      if (bestRank === null || compareRankTuple(rankTuple, bestRank.rankTuple) > 0){
        bestRank = {i, name, rankTuple, best5};
        winners = [i];
      } else if (compareRankTuple(rankTuple, bestRank.rankTuple) === 0){
        winners.push(i);
      }
    }
    winners = winners;
  }

  // split pot if needed
  const share = Math.floor(state.pot / winners.length);
  winners.forEach(i => state.stacks[i] += share);
  log(`Showdown. Переможець(і): ${winners.map(i=>"Player "+(i+1)).join(", ")}. Кожен отримує ${share}.`,"win");
  setStatus("Роздача завершена");
  render();
}

// Hand evaluation helpers
function rankValue(r){
  return RANKS.indexOf(r);
}
function parseCard(c){
  return {r: c[0], s: c.slice(1), v: rankValue(c[0])};
}

function combinations(arr, k){
  const res = [];
  const n = arr.length;
  const idx = Array.from({length:k}, (_,i)=>i);
  function pushComb(){
    res.push(idx.map(i => arr[i]));
  }
  if (k>n || k<=0){ return res; }
  pushComb();
  while (true){
    let i;
    for (i=k-1;i>=0;i--){
      if (idx[i] !== i + n - k) break;
    }
    if (i<0) break;
    idx[i]++;
    for (let j=i+1; j<k; j++){
      idx[j] = idx[j-1] + 1;
    }
    pushComb();
  }
  return res;
}

function evaluate5(cards){
  // cards: array of "Rsuit" length 5
  const p = cards.map(parseCard).sort((a,b)=>a.v-b.v);
  // counts
  const counts = {};
  for (const c of p) counts[c.r] = (counts[c.r]||0)+1;
  const byCount = Object.entries(counts).sort((a,b)=> b[1]-a[1] || rankValue(b[0])-rankValue(a[0]));
  const isFlush = p.every(c => c.s === p[0].s);

  // straight (handle wheel A-2-3-4-5)
  let isStraight=false, topStraightVal=-1;
  const vals = [...new Set(p.map(c=>c.v))];
  if (vals.length===5){
    if (vals[4]-vals[0]===4){ isStraight=true; topStraightVal=vals[4]; }
    // wheel A2345
    if (!isStraight && JSON.stringify(vals)==='[0,1,2,3,12]'){ isStraight=true; topStraightVal=3; }
  }

  // determine rank
  // rank order: 8 StraightFlush,7 Four,6 FullHouse,5 Flush,4 Straight,3 Trips,2 TwoPair,1 OnePair,0 HighCard
  if (isStraight && isFlush) return {rank:8, tiebreak:[topStraightVal]};
  if (byCount[0][1]===4){
    const quadVal = rankValue(byCount[0][0]);
    const kicker = p.filter(c=>rankValue(c.r)!==quadVal).map(c=>c.v).sort((a,b)=>b-a)[0];
    return {rank:7, tiebreak:[quadVal,kicker]};
  }
  if (byCount[0][1]===3 && byCount[1][1]===2){
    return {rank:6, tiebreak:[rankValue(byCount[0][0]), rankValue(byCount[1][0])]};
  }
  if (isFlush){
    return {rank:5, tiebreak:p.map(c=>c.v).sort((a,b)=>b-a)};
  }
  if (isStraight){
    return {rank:4, tiebreak:[topStraightVal]};
  }
  if (byCount[0][1]===3){
    const trips = rankValue(byCount[0][0]);
    const kickers = p.filter(c=>rankValue(c.r)!==trips).map(c=>c.v).sort((a,b)=>b-a);
    return {rank:3, tiebreak:[trips, ...kickers]};
  }
  if (byCount[0][1]===2 && byCount[1][1]===2){
    const highPair = rankValue(byCount[0][0]);
    const lowPair  = rankValue(byCount[1][0]);
    const kicker = p.filter(c=>![byCount[0][0],byCount[1][0]].includes(c.r)).map(c=>c.v).sort((a,b)=>b-a)[0];
    return {rank:2, tiebreak:[highPair, lowPair, kicker]};
  }
  if (byCount[0][1]===2){
    const pair = rankValue(byCount[0][0]);
    const kickers = p.filter(c=>rankValue(c.r)!==pair).map(c=>c.v).sort((a,b)=>b-a);
    return {rank:1, tiebreak:[pair, ...kickers]};
  }
  return {rank:0, tiebreak:p.map(c=>c.v).sort((a,b)=>b-a)};
}

function compareRankTuple(a,b){
  if (a.rank !== b.rank) return a.rank - b.rank;
  // tiebreak arrays compare lexicographically
  for (let i=0;i<Math.max(a.tiebreak.length, b.tiebreak.length); i++){
    const av = a.tiebreak[i] ?? -1;
    const bv = b.tiebreak[i] ?? -1;
    if (av !== bv) return av - bv;
  }
  return 0;
}

function bestOfSeven(seven){
  const combs = combinations(seven, 5);
  let best = null, best5=null;
  for (const c of combs){
    const eval5 = evaluate5(c);
    if (!best || compareRankTuple(eval5, best) > 0){
      best = eval5;
      best5 = c;
    }
  }
  const name = handName(best);
  return {name, rankTuple: best, best5};
}

function handName(rt){
  const names = ["High Card","One Pair","Two Pair","Trips","Straight","Flush","Full House","Quads","Straight Flush"];
  return names[rt.rank];
}

// Wire UI
document.getElementById("btn-reset").addEventListener("click", ()=>{
  newHand();
});

document.getElementById("btn-deal").addEventListener("click", ()=>{
  newHand();
  deal();
});

document.getElementById("btn-flop").addEventListener("click", flop);
document.getElementById("btn-turn").addEventListener("click", turn);
document.getElementById("btn-river").addEventListener("click", river);
document.getElementById("btn-showdown").addEventListener("click", ()=>showdown(false));

// player controls
document.querySelectorAll(".controls").forEach(ctrl=>{
  const id = parseInt(ctrl.getAttribute("data-id"));
  ctrl.addEventListener("click", (e)=>{
    if (!(e.target instanceof HTMLButtonElement)) return;
    const act = e.target.getAttribute("data-act");
    if (state.toAct !== id || state.street==="showdown") return;
    if (act==="fold") actFold(id);
    if (act==="check") actCheckCall(id);
    if (act==="bet") actBet(id);
  });
});

// init
newHand();
render();
