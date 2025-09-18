// ===== Util =====
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const formatDate = iso => new Date(iso).toLocaleDateString('pt-BR');
const uid = () => crypto.randomUUID ? crypto.randomUUID() : (Date.now()+Math.random()).toString(36);

async function sha256(str){
  if(window.crypto?.subtle){
    const enc = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest('SHA-256', enc);
    return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
  } else {
    // fallback (simples, não seguro)
    let h=0; for(let i=0;i<str.length;i++){h=(h<<5)-h+str.charCodeAt(i);h|=0} return String(h);
  }
}

// ===== Storage =====
const DB = {
  usersKey: 'matriculas_users',
  sessionKey: 'matriculas_session',
  dataKey: 'matriculas_registros',
  get users(){ return JSON.parse(localStorage.getItem(this.usersKey)||'[]'); },
  set users(v){ localStorage.setItem(this.usersKey, JSON.stringify(v)); },
  get session(){ return JSON.parse(localStorage.getItem(this.sessionKey)||'null'); },
  set session(v){ localStorage.setItem(this.sessionKey, JSON.stringify(v)); },
  get regs(){ return JSON.parse(localStorage.getItem(this.dataKey)||'[]'); },
  set regs(v){ localStorage.setItem(this.dataKey, JSON.stringify(v)); },
};

function updateStats(){
  const regs = DB.regs; const total = regs.length;
  const ativas = regs.filter(r=>r.status==='Ativa').length;
  $('#stats').textContent = `${total} matrículas • ${ativas} ativas`;
}

function setAuthUI(logged){
  $('#authCard').hidden = logged;
  $('#appCard').hidden = !logged;
}

function setActiveTab(containerSel, tabName){
  const container = $(containerSel);
  const tabs = container.querySelectorAll('.tab');
  tabs.forEach(t=>t.classList.toggle('active', t.dataset.tab===tabName));
  container.parentElement.querySelectorAll('.tabpanel').forEach(p=>p.hidden = (p.id!==tabName));
}

// ===== Auth =====
$$('.tabs .tab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const wrap = btn.closest('.card');
    wrap.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    wrap.querySelectorAll('.tabpanel').forEach(p=> p.hidden = (p.id !== btn.dataset.tab));
  });
});

$('#demoUser').addEventListener('click', async ()=>{
  const email = 'demo@exemplo.com';
  const pass = '123456';
  let users = DB.users;
  if(!users.find(u=>u.email===email)){
    users.push({id:uid(), name:'Usuário Demo', email, passHash: await sha256(pass)});
    DB.users = users;
  }
  $('#loginEmail').value = email; $('#loginPassword').value = pass;
});

$('#signupForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const name = $('#suName').value.trim();
  const email = $('#suEmail').value.trim().toLowerCase();
  const pass = $('#suPass').value;
  const pass2 = $('#suPass2').value;
  const msg = $('#signupMsg'); msg.textContent='';
  if(pass!==pass2){ msg.textContent='As senhas não coincidem.'; msg.className='error'; return; }
  let users = DB.users;
  if(users.some(u=>u.email===email)){ msg.textContent='Email já cadastrado.'; msg.className='error'; return; }
  users.push({id:uid(), name, email, passHash: await sha256(pass)});
  DB.users = users; msg.textContent='Conta criada! Faça login.'; msg.className='ok';
  setTimeout(()=>{
    const card = $('#authCard');
    card.querySelector('[data-tab="login"]').click();
    $('#loginEmail').value=email;
  }, 700);
});

$('#loginForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const email = $('#loginEmail').value.trim().toLowerCase();
  const pass = $('#loginPassword').value;
  const msg = $('#loginMsg'); msg.textContent='';
  const users = DB.users;
  const u = users.find(u=>u.email===email);
  if(!u){ msg.textContent='Usuário não encontrado.'; msg.className='error'; return; }
  const ok = (u.passHash === await sha256(pass));
  if(!ok){ msg.textContent='Senha incorreta.'; msg.className='error'; return; }
  DB.session = {userId: u.id, name: u.name, email: u.email};
  $('#helloUser').textContent = `Olá, ${u.name}!`;
  setAuthUI(true); renderTable(); updateStats();
});

$('#logout').addEventListener('click', ()=>{ DB.session=null; setAuthUI(false); });

// ===== Matrículas =====
function getFormData(){
  return {
    id: $('#formMat').dataset.editing || uid(),
    aluno: $('#aluno').value.trim(),
    numero: $('#numero').value.trim(),
    data: $('#data').value || new Date().toISOString().slice(0,10),
    curso: $('#curso').value.trim(),
    turma: $('#turma').value.trim(),
    status: $('#status').value,
  };
}

function setFormData(r){
  $('#formMat').dataset.editing = r?.id || '';
  $('#aluno').value = r?.aluno||'';
  $('#numero').value = r?.numero||'';
  $('#data').value = r?.data||'';
  $('#curso').value = r?.curso||'';
  $('#turma').value = r?.turma||'';
  $('#status').value = r?.status||'Ativa';
}

$('#formMat').addEventListener('submit', (e)=>{
  e.preventDefault();
  const reg = getFormData();
  const msg = $('#saveMsg'); msg.textContent='';
  if(!reg.aluno || !reg.numero || !reg.curso){ msg.textContent='Preencha os campos obrigatórios.'; msg.className='error'; return; }
  let regs = DB.regs;
  const ix = regs.findIndex(r=>r.id===reg.id);
  if(ix>=0) regs[ix] = reg; else regs.push(reg);
  DB.regs = regs; msg.textContent = ix>=0 ? 'Registro atualizado!' : 'Registro salvo!'; msg.className='ok';
  setFormData(null); renderTable(); updateStats();
});

// ===== Relatório & filtros =====
['q','dInicio','dFim','fCurso','fStatus'].forEach(id=>{
  $('#'+id).addEventListener('input', ()=> renderTable());
});

function applyFilters(list){
  const q = $('#q').value.trim().toLowerCase();
  const di = $('#dInicio').value ? new Date($('#dInicio').value) : null;
  const df = $('#dFim').value ? new Date($('#dFim').value) : null;
  const curso = $('#fCurso').value.trim().toLowerCase();
  const status = $('#fStatus').value;
  return list.filter(r=>{
    const okQ = !q || r.aluno.toLowerCase().includes(q) || r.numero.toLowerCase().includes(q);
    const okCurso = !curso || r.curso.toLowerCase().includes(curso);
    const okStatus = !status || r.status===status;
    const d = new Date(r.data);
    const okData = (!di || d>=di) && (!df || d<=df);
    return okQ && okCurso && okStatus && okData;
  });
}

function renderTable(){
  const tbody = $('#tbl tbody'); tbody.innerHTML='';
  let rows = applyFilters(DB.regs);
  $('#count').textContent = `${rows.length} registro(s) encontrado(s)`;
  rows.sort((a,b)=> a.data < b.data ? 1 : -1);
  for(const r of rows){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.aluno}</td>
      <td>${r.numero}</td>
      <td>${formatDate(r.data)}</td>
      <td>${r.curso}</td>
      <td>${r.turma||'-'}</td>
      <td><span class="status ${r.status}">${r.status}</span></td>
      <td>
        <button class="btn ghost" data-edit="${r.id}">Editar</button>
        <button class="btn ghost" data-del="${r.id}">Excluir</button>
      </td>`;
    tbody.appendChild(tr);
  }

  $$('[data-edit]').forEach(b=> b.onclick = ()=>{
    const r = DB.regs.find(x=>x.id===b.dataset.edit); setFormData(r);
    setActiveTab('#appCard .tabs','cadastro');
    $('#formMat').scrollIntoView({behavior:'smooth', block:'start'});
  });
  $$('[data-del]').forEach(b=> b.onclick = ()=>{
    if(confirm('Tem certeza que deseja excluir?')){
      DB.regs = DB.regs.filter(x=>x.id!==b.dataset.del); renderTable(); updateStats();
    }
  });
}

// ===== Exportar CSV =====
$('#btnExport').addEventListener('click', ()=>{
  const rows = applyFilters(DB.regs);
  const headers = ['Aluno','Matrícula','Data','Curso','Turma','Status'];
  const data = rows.map(r=>[r.aluno,r.numero,r.data,r.curso,r.turma||'',r.status]);
  const csv = [headers, ...data].map(row=> row.map(cell=>`"${String(cell).replaceAll('"','""')}"`).join(',')).join('\n');
  const blob = new Blob(["\ufeff"+csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='matriculas.csv'; a.click(); URL.revokeObjectURL(url);
});

// ===== Seed =====
$('#seedData').addEventListener('click', ()=>{
  if(DB.regs.length>0 && !confirm('Substituir os dados existentes por exemplos?')) return;
  const today = new Date(); const fmt = d=> d.toISOString().slice(0,10);
  const sample = [
    {aluno:'Ana Paula', numero:'2025-001', data:fmt(new Date(today-86400000*3)), curso:'Engenharia', turma:'A', status:'Ativa'},
    {aluno:'Bruno Lima', numero:'2025-002', data:fmt(new Date(today-86400000*15)), curso:'Direito', turma:'B', status:'Trancada'},
    {aluno:'Carla Nogueira', numero:'2025-003', data:fmt(new Date(today-86400000*40)), curso:'Medicina', turma:'C', status:'Ativa'},
    {aluno:'Diego Andrade', numero:'2025-004', data:fmt(new Date(today-86400000*70)), curso:'Administração', turma:'A', status:'Cancelada'},
  ].map(x=>({id:uid(),...x}));
  DB.regs = sample; renderTable(); updateStats();
});

// ===== Boot =====
(function init(){
  const s = DB.session;
  if(s){ $('#helloUser').textContent=`Olá, ${s.name}!`; setAuthUI(true); renderTable(); updateStats(); }
  $('#data').value = new Date().toISOString().slice(0,10);
})();
