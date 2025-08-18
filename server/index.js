
import express from 'express';
import http from 'http';
import { Server as IOServer } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new IOServer(server, { cors:{ origin:'*' } });
const PORT = process.env.PORT || 3000;
const BLINDS = { sb:10, bb:20 };
const BET_STEP = 10, MAX_BET = 80, RAKE = 0.05;

app.use(express.static('public'));

const tables = {}; let nextId=1;
function makeTable(seats, bb){
  const id = 't'+(nextId++);
  tables[id] = { id, name:`${seats}-max BB${bb}`, seats, bb, players:[], dealerBtn:-1, board:[], pot:0, deck:[], maxBet:0, state:'waiting', currentIdx:-1, houseRake:0, timer:null, turnEndsAt:0 };
}
for(let i=0;i<8;i++) makeTable(3,10);
for(let i=0;i<2;i++) makeTable(6,20);

app.get('/api/lobby', (req,res)=>{
  res.json(Object.values(tables).map(t=>({ id:t.id, name:t.name, seats:t.seats, players:t.players.length, state:t.state })));
});

function deck(){
  const s=['s','h','d','c'], r=['2','3','4','5','6','7','8','9','T','J','Q','K','A'], d=[];
  for(const ss of s) for(const rr of r) d.push(rr+ss);
  for(let i=d.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [d[i],d[j]]=[d[j],d[i]]; }
  return d;
}
function nextIdx(t, from){
  let i=from;
  for(let k=0;k<t.players.length*2;k++){
    i=(i+1)%t.players.length; const p=t.players[i];
    if(p && !p.folded && p.connected && (p.stack>0 || p.bet>0)) return i;
  } return -1;
}
function bcast(t){ io.to(t.id).emit('table_state', {
  id:t.id, name:t.name, seats:t.seats, bb:t.bb, board:t.board, pot:t.pot, state:t.state, maxBet:t.maxBet, dealerBtn:t.dealerBtn, currentIdx:t.currentIdx, houseRake:t.houseRake, turnEndsAt:t.turnEndsAt,
  players:t.players.map(p=>({id:p.id,name:p.name,seat:p.seat,stack:p.stack,bet:p.bet,folded:p.folded,connected:p.connected}))
});}
function startTimer(t){
  clearTimeout(t.timer);
  t.turnEndsAt = Date.now()+20000;
  t.timer = setTimeout(()=>{ const p=t.players[t.currentIdx]; if(p) p.folded=true; step(t); bcast(t); },20000);
}
function step(t){
  const alive=t.players.filter(p=>!p.folded);
  const allMatched=alive.every(p=>p.bet===t.maxBet || p.stack===0);
  if(allMatched){
    t.pot += t.players.reduce((s,p)=>s+(p.bet||0),0);
    t.players.forEach(p=>p.bet=0); t.maxBet=0;
    if(t.state==='preflop'){ t.board.push(t.deck.pop(),t.deck.pop(),t.deck.pop()); t.state='flop'; }
    else if(t.state==='flop'){ t.board.push(t.deck.pop()); t.state='turn'; }
    else if(t.state==='turn'){ t.board.push(t.deck.pop()); t.state='river'; }
    else if(t.state==='river'){
      t.state='showdown';
      const rake = Math.floor(t.pot*RAKE); t.houseRake+=rake; const win = t.pot - rake;
      const share = Math.floor(win/Math.max(1,alive.length));
      alive.forEach(p=> p.stack+=share);
      t.pot=0; t.currentIdx=-1; clearTimeout(t.timer); bcast(t); return;
    }
    t.currentIdx = nextIdx(t, t.dealerBtn); startTimer(t); return;
  }
  t.currentIdx = nextIdx(t, t.currentIdx); startTimer(t);
}
function deal(t){
  clearTimeout(t.timer);
  t.deck=deck(); t.pot=0; t.board=[]; t.maxBet=0; t.state='preflop';
  t.players.forEach(p=>{ p.bet=0; p.folded=false; p.cards=[]; });
  t.dealerBtn = (t.dealerBtn+1)%t.players.length;
  const sbI=nextIdx(t,t.dealerBtn), bbI=nextIdx(t,sbI);
  const sbP=t.players[sbI], bbP=t.players[bbI];
  const sb=Math.min(BLINDS.sb,sbP.stack), bb=Math.min(BLINDS.bb,bbP.stack);
  sbP.stack-=sb; sbP.bet=sb; bbP.stack-=bb; bbP.bet=bb; t.maxBet=bb;
  for(let r=0;r<2;r++) t.players.forEach(p=> p.cards.push(t.deck.pop()));
  t.currentIdx=nextIdx(t,bbI); startTimer(t);
}

io.on('connection', sock=>{
  sock.on('join_table', ({tableId,name})=>{
    const t=tables[tableId]; if(!t) return;
    sock.join(t.id); sock.tableId=t.id;
    if(!t.players.find(p=>p.id===sock.id)){
      if(t.players.length>=t.seats){ sock.emit('error_msg','Стол повний'); return; }
      t.players.push({ id:sock.id, name:name||'Player', seat:t.players.length+1, stack:1000, bet:0, folded:false, connected:true, cards:[] });
    } else t.players.find(p=>p.id===sock.id).connected=true;
    bcast(t);
  });
  sock.on('new_hand', ()=>{ const t=tables[sock.tableId]; if(!t||t.players.length<2) return; deal(t); bcast(t); });
  sock.on('get_hole', ()=>{ const t=tables[sock.tableId]; if(!t) return; const p=t.players.find(p=>p.id===sock.id); if(!p) return; sock.emit('hole_cards', p.cards); });
  sock.on('action', ({type})=>{
    const t=tables[sock.tableId]; if(!t) return;
    const idx=t.players.findIndex(p=>p.id===sock.id); if(idx!==t.currentIdx) return;
    const p=t.players[idx];
    if(type==='fold'){ p.folded=true;
      const alive=t.players.filter(pl=>!pl.folded);
      if(alive.length===1){ const total=t.pot+t.players.reduce((s,pl)=>s+(pl.bet||0),0); const rake=Math.floor(total*RAKE); t.houseRake+=rake; alive[0].stack+= (total - rake); t.pot=0; t.players.forEach(pl=>pl.bet=0); t.state='showdown'; t.currentIdx=-1; clearTimeout(t.timer); }
      else { t.currentIdx=nextIdx(t,idx); startTimer(t); }
    } else if(type==='check_call'){ const toCall=t.maxBet-p.bet; const pay=Math.min(toCall,p.stack); p.stack-=pay; p.bet+=pay; step(t);
    } else if(type==='bet'){ const newBet=Math.min(t.maxBet+BET_STEP,MAX_BET); const toPay=newBet-p.bet; const pay=Math.min(toPay,p.stack); p.stack-=pay; p.bet+=pay; t.maxBet=Math.max(t.maxBet,p.bet); step(t); }
    bcast(t);
  });
  sock.on('disconnect', ()=>{ const t=tables[sock.tableId]; if(!t) return; const p=t.players.find(p=>p.id===sock.id); if(p) p.connected=false; bcast(t); });
});

app.get('/api/lobby', (req,res)=> res.json(Object.values(tables).map(t=>({id:t.id,name:t.name,seats:t.seats,players:t.players.length,state:t.state}))));
app.get('/', (req,res)=> res.sendFile(process.cwd() + '/public/index.html'));

server.listen(PORT, ()=> console.log('Server listening on', PORT));
