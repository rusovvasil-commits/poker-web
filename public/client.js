/* ==== Socket & UI refs ==== */
const socket = io();
let currentTable = null;
let myName = 'Player ' + Math.floor(Math.random()*10000);

const vLobby   = document.getElementById('view-lobby');
const vTable   = document.getElementById('view-table');
const lobbyEl  = document.getElementById('lobbyList');
const boardEl  = document.getElementById('board');
const holeEl   = document.getElementById('hole');

/* Кнопки */
document.getElementById('btnLobby').onclick = showLobby;
document.getElementById('btnNew').onclick   = () => socket.emit('new_hand');
document.getElementById('btnFold').onclick  = () => socket.emit('action',{ type:'fold' });
document.getElementById('btnCC').onclick    = () => socket.emit('action',{ type:'check_call' });
document.getElementById('btnBet').onclick   = () => socket.emit('action',{ type:'bet', amt:10 });
document.getElementById('btnHole').onclick  = () => socket.emit('get_hole');

/* ==== Cards rendering ==== */
function svgCard({r,s}) {
  // r: 'A','K','Q','J','T','9'... ; s: 'c','d','h','s'
  const suitSymbol = { c:'♣', d:'♦', h:'♥', s:'♠' }[s];
  const col = (s==='d'||s==='h') ? '#cc2e2e' : '#1a1a1a';

  // 80x120 viewBox під розміри .pkr-card
  return `
<svg viewBox="0 0 200 300" xmlns="http://www.w3.org/2000/svg" aria-label="${r}${s}">
  <rect x="3" y="3" width="194" height="294" rx="16" ry="16" fill="#fff" stroke="rgba(0,0,0,.25)"/>
  <!-- кути -->
  <g fill="${col}" font-family="system-ui,Segoe UI,Roboto,Arial" font-weight="700">
    <text x="16" y="36" font-size="30">${r}${suitSymbol}</text>
    <g transform="rotate(180 100 150)">
      <text x="16" y="36" font-size="30">${r}${suitSymbol}</text>
    </g>
  </g>
  <!-- велика масть по центру -->
  <text x="100" y="175" text-anchor="middle" fill="${col}" font-family="system-ui,Segoe UI,Roboto,Arial" font-size="96" opacity=".10">${suitSymbol}</text>
</svg>`;
}

function createCardEl(card, hidden=false){
  const wrap = document.createElement('div');
  wrap.className = 'pkr-card';
  if (hidden) {
    wrap.classList.add('back');
    wrap.innerHTML = ''; // рубашка без лицьової сторони
  } else {
    wrap.classList.remove('back');
    wrap.innerHTML = svgCard(card);
  }
  return wrap;
}

function renderCards(containerEl, cards, {hidden=false} = {}){
  containerEl.innerHTML = '';
  (cards||[]).forEach(c => containerEl.appendChild(createCardEl(c, hidden)));
}

/* ==== Views ==== */
function showLobby(){
  vLobby.style.display='block';
  vTable.style.display='none';
  socket.emit('leave_table', { tableId: currentTable });
  currentTable = null;
}

function showTable(){
  vLobby.style.display='none';
  vTable.style.display='block';
}

/* ==== Lobby & Table state ==== */
function renderLobby(tables){
  lobbyEl.innerHTML = '';
  tables.forEach(t=>{
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <div>3-max BB${t.bb} — ${t.players.length}/${t.seats}</div>
      <button class="btn">Зайти</button>`;
    row.querySelector('button').onclick = ()=>{
      currentTable = t.id;
      socket.emit('join_table',{ tableId:t.id, name: myName });
    };
    lobbyEl.appendChild(row);
  });
}

function applyTableState(state){
  // Борд (карти на столі)
  renderCards(boardEl, state.board, { hidden:false });

  // Мої карти
  const me = state.players.find(p=>p.id===state.meId);
  const myHole = me?.hole || [];
  renderCards(holeEl, myHole, { hidden:false });
}

/* ==== Socket events ==== */
socket.on('lobby', data => renderLobby(data.tables||[]));

socket.on('table_state', state=>{
  currentTable = state.tableId;
  showTable();
  applyTableState(state);
});

// інші повідомлення (оновлення борду/руки)
socket.on('board', cards => renderCards(boardEl, cards, {hidden:false}));
socket.on('hole',  cards => renderCards(holeEl,  cards, {hidden:false}));

/* на старті просимо лобі */
socket.emit('get_lobby');

/* безпека: при закритті вкладки — залишаємо стіл */
window.addEventListener('beforeunload',()=>{
  if (currentTable) socket.emit('leave_table',{ tableId: currentTable });
});
