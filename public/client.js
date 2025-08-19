const socket = io();
let currentTable = null;
let myName = 'Player ' + Math.floor(Math.random()*10000);
let timerInt = null;

const vLobby = document.getElementById('view-lobby');
const vTable = document.getElementById('view-table');
const lobbyList = document.getElementById('lobbyList');

document.getElementById('btnLobby').onclick = showLobby;
document.getElementById('btnNew').onclick = ()=> socket.emit('new_hand');
document.getElementById('btnBack').onclick = showLobby;
document.getElementById('btnFold').onclick = ()=> socket.emit('action',{type:'fold'});
document.getElementById('btnCC').onclick = ()=> socket.emit('action',{type:'check_call'});
document.getElementById('btnBet').onclick = ()=> socket.emit('action',{type:'bet'});
document.getElementById('btnHole').onclick = ()=> socket.emit('get_hole');

function showLobby(){
  vLobby.style.display='block'; vTable.style.display='none';
  fetch('/api/lobby').then(r=>r.json()).then(rows=>{
    lobbyList.innerHTML='';
    rows.forEach(r=>{
      const el = document.createElement('div');
      el.className='row';
      el.innerHTML = `<div>${r.name} — ${r.players}/${r.seats} — ${r.state}</div>
                      <button class="btn">Зайти</button>`;
      el.querySelector('button').onclick = ()=> joinTable(r.id);
      lobbyList.appendChild(el);
    });
  });
}
function joinTable(tableId){
  currentTable = tableId;
  socket.emit('join_table', {tableId, name: myName});
  vLobby.style.display='none'; vTable.style.display='block';
  document.getElementById('myHole').innerText='';
}
socket.on('connect', showLobby);
socket.on('error_msg', msg=> alert(msg));

socket.on('table_state', t=>{
  if (!currentTable || currentTable!==t.id) return;
  document.getElementById('pot').innerText = t.pot;
  document.getElementById('stage').innerText = t.state;
  document.getElementById('houseRake').innerText = t.houseRake;
  document.getElementById('board').innerText = t.board.join(' ');
  renderSeats(t);function renderCards(cards) {
  const cardsContainer = document.getElementById('cards-container');
  cardsContainer.innerHTML = '';  // очищаємо контейнер перед додаванням нових карт
  cards.forEach(card => {
    const cardImg = document.createElement('img');
    cardImg.src = `/public/cards/${card}.jpg`;  // Шлях до карт
    cardImg.alt = card;  // Опис картки для доступності
    cardsContainer.appendChild(cardImg);
  });
}

  renderCommunity(t);

  if (timerInt) clearInterval(timerInt);
  timerInt = setInterval(()=>{
    const left = Math.max(0, Math.floor((t.turnEndsAt - Date.now())/1000));
    document.getElementById('timer').innerText = t.currentIdx>=0 ? left : '--';
  }, 250);
});

socket.on('hole_cards', cards=>{
  document.getElementById('myHole').innerText = 'Мої карти: ' + cards.join(' ');
});

function renderCommunity(t){
  document.getElementById('potChips').textContent = t.pot;
  const comm = document.getElementById('community'); comm.innerHTML='';
  t.board.forEach(c=>{
    const d=document.createElement('div');
    d.textContent=c; d.style.padding='6px 8px'; d.style.background='#0e121b'; d.style.border='1px solid #2b3550'; d.style.borderRadius='8px';
    comm.appendChild(d);
  });
}

function renderSeats(t){
  const seats = document.getElementById('seats'); seats.innerHTML='';
  const pos3 = [
    { left:'calc(50% - 110px)', top:'430px' },
    { left:'80px', top:'70px' },
    { right:'80px', top:'70px' },
  ];
  const pos6 = [
    { left:'calc(50% - 110px)', top:'430px' },
    { left:'60px', top:'300px' },
    { right:'60px', top:'300px' },
    { left:'140px', top:'60px' },
    { right:'140px', top:'60px' },
    { left:'calc(50% - 110px)', top:'20px' },
  ];
  const arr = t.seats===3 ? pos3 : pos6;
  t.players.forEach((p, idx)=>{
    const d=document.createElement('div');
    d.className='seat' + (idx===t.currentIdx?' active':'') + (p.folded?' folded':'');
    const pos=arr[idx] || { left:(40+idx*150)+'px', top:'420px' };
    Object.assign(d.style, pos);
    d.innerHTML = `<div class="box">
      <div class="top"><div class="name">${p.name}</div><div class="stack">Stack: ${p.stack}</div></div>
      <div>Bet: ${p.bet}${idx===t.dealerBtn?' • (D)':''}</div>
    </div>`;
    seats.appendChild(d);
  });
}
