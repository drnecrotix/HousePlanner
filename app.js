const STORAGE_KEY = 'houseplanner-project-v1';
const state = loadState();
let openingDraft = [];

const $ = (id) => document.getElementById(id);
const money = (n) => `${Number(n || 0).toFixed(2)} лв.`;
const area = (n) => `${Number(n || 0).toFixed(2)} m²`;
const cm2m2 = (a, b) => (Number(a) * Number(b)) / 10000;
const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function defaultState(){return {projectName:'Моят ремонт',rooms:[],walls:[],floors:[],materials:[],extras:[],budgetReserve:10};}
function loadState(){try{return {...defaultState(),...JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}}catch{return defaultState()}}
function persist(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));toast('Проектът е запазен локално.');}
function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.classList.remove('show'),2200)}

function initNav(){document.querySelectorAll('.nav-link').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.nav-link').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.view').forEach(x=>x.classList.remove('active-view'));btn.classList.add('active');$(btn.dataset.view).classList.add('active-view')}));}

function renderRooms(){
  $('roomsTable').innerHTML = state.rooms.map(r=>`<tr><td><strong>${escapeHtml(r.name)}</strong></td><td>${escapeHtml(r.type)}</td><td>${r.width} × ${r.length} × ${r.height} cm</td><td>${area(cm2m2(r.width,r.length))}</td><td>${((2*(Number(r.width)+Number(r.length)))/100).toFixed(2)} m</td><td><button class="icon-btn" data-delete-room="${r.id}">Премахни</button></td></tr>`).join('');
  $('roomCountLabel').textContent=`${state.rooms.length} общо`;
  const roomBlocks = state.rooms.map(r=>`<div class="room-block"><strong>${escapeHtml(r.name)}</strong><span>${escapeHtml(r.type)} · ${area(cm2m2(r.width,r.length))}</span></div>`).join('');
  ['roomPlan','propertyPreview'].forEach(id=>{const el=$(id);el.innerHTML=roomBlocks || (id==='roomPlan'?'Няма помещения.':'Добави помещение, за да се появи схема.');el.classList.toggle('empty-state',!roomBlocks)});
  $('wallRoom').innerHTML = state.rooms.length ? state.rooms.map(r=>`<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('') : '<option value="">Без помещение</option>';
  document.querySelectorAll('[data-delete-room]').forEach(b=>b.onclick=()=>{state.rooms=state.rooms.filter(x=>x.id!==b.dataset.deleteRoom);state.walls=state.walls.filter(x=>x.roomId!==b.dataset.deleteRoom);renderAll();persist()});
}

function renderOpeningEditor(){
  $('openingEditor').innerHTML=openingDraft.map((o,i)=>`<div class="opening-row"><select data-open-type="${i}"><option ${o.type==='Врата'?'selected':''}>Врата</option><option ${o.type==='Прозорец'?'selected':''}>Прозорец</option><option ${o.type==='Друг отвор'?'selected':''}>Друг отвор</option></select><input data-open-width="${i}" type="number" min="1" step="0.1" value="${o.width}" placeholder="Ширина cm"><input data-open-height="${i}" type="number" min="1" step="0.1" value="${o.height}" placeholder="Височина cm"><button type="button" class="icon-btn" data-open-delete="${i}">×</button></div>`).join('');
  document.querySelectorAll('[data-open-type]').forEach(el=>el.oninput=()=>{openingDraft[el.dataset.openType].type=el.value;updateWallPreview()});
  document.querySelectorAll('[data-open-width]').forEach(el=>el.oninput=()=>{openingDraft[el.dataset.openWidth].width=Number(el.value);updateWallPreview()});
  document.querySelectorAll('[data-open-height]').forEach(el=>el.oninput=()=>{openingDraft[el.dataset.openHeight].height=Number(el.value);updateWallPreview()});
  document.querySelectorAll('[data-open-delete]').forEach(el=>el.onclick=()=>{openingDraft.splice(Number(el.dataset.openDelete),1);renderOpeningEditor();updateWallPreview()});
}

function updateWallPreview(){
  const w=Number($('wallWidth').value),h=Number($('wallHeight').value);const el=$('wallPreview');
  if(!w||!h){el.className='wall-preview empty-state';el.innerHTML='Въведи размери на стена.';return}
  const openings=openingDraft.filter(o=>o.width>0&&o.height>0);let cursor=6;
  const shapes=openings.map(o=>{const pw=Math.max(10,Math.min(45,o.width/w*80));const ph=Math.max(15,Math.min(75,o.height/h*70));const left=cursor;cursor=Math.min(82,cursor+pw+4);return `<div class="opening-shape ${o.type==='Прозорец'?'opening-window':''}" style="width:${pw}%;height:${ph}%;left:${left}%">${escapeHtml(o.type)}</div>`}).join('');
  const gross=cm2m2(w,h),holes=openings.reduce((s,o)=>s+cm2m2(o.width,o.height),0);
  el.className='wall-preview';el.innerHTML=`<div class="wall-shape"><span class="wall-label">${w} × ${h} cm · нето ${area(Math.max(0,gross-holes))}</span>${shapes}</div>`;
}

function renderWalls(){
  const total=state.walls.reduce((s,w)=>s+w.net,0);$('wallAreaTotal').textContent=`${area(total)} нето`;
  $('wallsTable').innerHTML=state.walls.map(w=>`<tr><td>${escapeHtml(roomName(w.roomId))}</td><td><strong>${escapeHtml(w.name)}</strong></td><td>${area(w.gross)}</td><td>${area(w.openingsArea)}</td><td>${area(w.net)}</td><td><button class="icon-btn" data-delete-wall="${w.id}">Премахни</button></td></tr>`).join('');
  document.querySelectorAll('[data-delete-wall]').forEach(b=>b.onclick=()=>{state.walls=state.walls.filter(x=>x.id!==b.dataset.deleteWall);renderAll();persist()});
}

function renderFloors(){
  $('floorTable').innerHTML=state.floors.map(f=>`<tr><td><strong>${escapeHtml(f.name)}</strong></td><td>${f.width} × ${f.length} cm</td><td>${area(f.area)}</td><td>${f.waste}%</td><td>${area(f.purchaseArea)}</td><td><button class="icon-btn" data-delete-floor="${f.id}">Премахни</button></td></tr>`).join('');
  $('floorAreaTotal').textContent=area(state.floors.reduce((s,f)=>s+f.area,0));
  document.querySelectorAll('[data-delete-floor]').forEach(b=>b.onclick=()=>{state.floors=state.floors.filter(x=>x.id!==b.dataset.deleteFloor);renderAll();persist()});
}

function paintCalc(){
  const a=Number($('paintArea').value||0),c=Number($('paintCoverage').value||0),coats=Number($('paintCoats').value||0),waste=Number($('paintWaste').value||0),can=Number($('paintCanSize').value||0),price=Number($('paintCanPrice').value||0);
  const base=c>0?a*coats/c:0, withWaste=base*(1+waste/100), cans=can>0?Math.ceil(withWaste/can):0, purchased=cans*can,cost=cans*price;
  $('paintBase').textContent=`${base.toFixed(2)} L`;$('paintWithWaste').textContent=`${withWaste.toFixed(2)} L`;$('paintLiters').textContent=`${purchased.toFixed(2)} L`;$('paintCans').textContent=`${cans} разфасовки × ${can||0} L`;$('paintCost').textContent=money(cost);
  return {base,withWaste,cans,purchased,cost,can,price,area:a};
}

function renderMaterials(){
  $('materialsTable').innerHTML=state.materials.map(m=>`<tr><td>${escapeHtml(m.activity)}</td><td><strong>${escapeHtml(m.name)}</strong></td><td>${m.qty} ${escapeHtml(m.unit)}</td><td>${money(m.price)}</td><td>${money(m.qty*m.price)}</td><td class="muted">${escapeHtml(m.note||'')}</td><td><button class="icon-btn" data-delete-material="${m.id}">Премахни</button></td></tr>`).join('');
  $('materialTotal').textContent=money(materialsTotal());
  document.querySelectorAll('[data-delete-material]').forEach(b=>b.onclick=()=>{state.materials=state.materials.filter(x=>x.id!==b.dataset.deleteMaterial);renderAll();persist()});
}
function materialsTotal(){return state.materials.reduce((s,m)=>s+(Number(m.qty)*Number(m.price)),0)}
function extrasTotal(){return state.extras.reduce((s,e)=>s+Number(e.amount),0)}
function renderBudget(){
  $('extrasTable').innerHTML=state.extras.map(e=>`<tr><td><strong>${escapeHtml(e.name)}</strong></td><td>${money(e.amount)}</td><td><button class="icon-btn" data-delete-extra="${e.id}">Премахни</button></td></tr>`).join('');
  document.querySelectorAll('[data-delete-extra]').forEach(b=>b.onclick=()=>{state.extras=state.extras.filter(x=>x.id!==b.dataset.deleteExtra);renderAll();persist()});
  $('budgetReserve').value=state.budgetReserve;const mt=materialsTotal(),et=extrasTotal(),total=mt+et,res=total*(Number(state.budgetReserve)/100);$('budgetMaterials').textContent=money(mt);$('budgetExtras').textContent=money(et);$('budgetGrand').textContent=money(total);$('budgetReserveAmount').textContent=money(res);$('budgetWithReserve').textContent=money(total+res);
}
function renderDashboard(){
  $('projectName').value=state.projectName;$('statRooms').textContent=state.rooms.length;$('statFloor').textContent=area(state.rooms.reduce((s,r)=>s+cm2m2(r.width,r.length),0));$('statWalls').textContent=area(state.walls.reduce((s,w)=>s+w.net,0));$('statBudget').textContent=money(materialsTotal()+extrasTotal());
  const items=[['Помещения',state.rooms.length?`${state.rooms.length} добавени`:'Добави стаите и помещенията'],['Стени',state.walls.length?`${state.walls.length} измерени`:'Добави стени, врати и прозорци'],['Материали',state.materials.length?`${state.materials.length} позиции`:'Създай списък за ремонта']];$('activitySummary').innerHTML=items.map(x=>`<div class="summary-item"><strong>${x[0]}</strong><span>${x[1]}</span></div>`).join('');
}
function renderAll(){renderRooms();renderWalls();renderFloors();renderMaterials();renderBudget();renderDashboard();paintCalc()}
function roomName(id){return state.rooms.find(r=>r.id===id)?.name||'Без помещение'}
function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

function addTemplate(name){
 const sets={painting:[['Боядисване','Грунд',1,'оп.',0],['Боядисване','Валяк',1,'бр.',0],['Боядисване','Четка',2,'бр.',0],['Боядисване','Бояджийска лента',2,'бр.',0],['Боядисване','Покривно фолио',1,'оп.',0]],flooring:[['Подова настилка','Ламинат',1,'m²',0],['Подова настилка','Подложка',1,'m²',0],['Подова настилка','Первази',1,'m',0],['Подова настилка','Преходна лайсна',1,'бр.',0]],plaster:[['Шпакловка','Грунд',1,'оп.',0],['Шпакловка','Шпакловка',1,'kg',0],['Шпакловка','Армираща мрежа',1,'m²',0],['Шпакловка','Шкурка',5,'бр.',0]],drywall:[['Гипсокартон','Гипсокартонени плоскости',1,'бр.',0],['Гипсокартон','Метални профили',1,'m',0],['Гипсокартон','Винтове',1,'оп.',0],['Гипсокартон','Фугопълнител',1,'kg',0],['Гипсокартон','Лента за фуги',1,'бр.',0]]};
 (sets[name]||[]).forEach(([activity,n,qty,unit,price])=>state.materials.push({id:uid(),activity,name:n,qty,unit,price,note:''}));renderAll();persist();
}

function bindForms(){
 $('roomForm').onsubmit=e=>{e.preventDefault();state.rooms.push({id:uid(),name:$('roomName').value.trim(),type:$('roomType').value,width:Number($('roomWidth').value),length:Number($('roomLength').value),height:Number($('roomHeight').value)});e.target.reset();$('roomHeight').value=260;renderAll();persist()};
 $('addOpeningBtn').onclick=()=>{openingDraft.push({type:'Врата',width:90,height:200});renderOpeningEditor();updateWallPreview()};
 ['wallWidth','wallHeight'].forEach(id=>$(id).oninput=updateWallPreview);
 $('wallForm').onsubmit=e=>{e.preventDefault();const width=Number($('wallWidth').value),height=Number($('wallHeight').value),gross=cm2m2(width,height),holes=openingDraft.reduce((s,o)=>s+cm2m2(o.width,o.height),0);state.walls.push({id:uid(),roomId:$('wallRoom').value,name:$('wallName').value.trim(),width,height,gross,openingsArea:holes,net:Math.max(0,gross-holes),openings:structuredClone(openingDraft)});openingDraft=[];e.target.reset();$('wallHeight').value=260;renderOpeningEditor();updateWallPreview();renderAll();persist()};
 const floorLive=()=>{const a=cm2m2($('floorWidth').value,$('floorLength').value),w=Number($('floorWaste').value||0);$('floorLiveArea').textContent=area(a);$('floorLiveWaste').textContent=`С резерв: ${area(a*(1+w/100))}`};['floorWidth','floorLength','floorWaste'].forEach(id=>$(id).oninput=floorLive);
 $('floorForm').onsubmit=e=>{e.preventDefault();const a=cm2m2($('floorWidth').value,$('floorLength').value),w=Number($('floorWaste').value||0);state.floors.push({id:uid(),name:$('floorName').value.trim(),width:Number($('floorWidth').value),length:Number($('floorLength').value),area:a,waste:w,purchaseArea:a*(1+w/100)});e.target.reset();$('floorWaste').value=10;floorLive();renderAll();persist()};
 ['paintArea','paintCoverage','paintCoats','paintWaste','paintCanSize','paintCanPrice'].forEach(id=>$(id).oninput=paintCalc);
 $('useWallsAreaBtn').onclick=()=>{$('paintArea').value=state.walls.reduce((s,w)=>s+w.net,0).toFixed(2);paintCalc()};
 $('addPaintMaterialsBtn').onclick=()=>{const p=paintCalc();if(!p.cans)return toast('Първо въведи площ и параметри за боята.');state.materials.push({id:uid(),activity:'Боядисване',name:'Боя',qty:p.cans,unit:'бр.',price:p.price,note:`${p.can} L/разфасовка · ${p.area.toFixed(2)} m²`});renderAll();persist()};
 $('materialForm').onsubmit=e=>{e.preventDefault();state.materials.push({id:uid(),activity:$('materialActivity').value,name:$('materialName').value.trim(),qty:Number($('materialQty').value),unit:$('materialUnit').value,price:Number($('materialPrice').value||0),note:$('materialNote').value.trim()});e.target.reset();renderAll();persist()};
 document.querySelectorAll('[data-template]').forEach(b=>b.onclick=()=>addTemplate(b.dataset.template));
 $('extraCostForm').onsubmit=e=>{e.preventDefault();state.extras.push({id:uid(),name:$('extraName').value.trim(),amount:Number($('extraAmount').value)});e.target.reset();renderAll();persist()};
 $('budgetReserve').oninput=()=>{state.budgetReserve=Number($('budgetReserve').value||0);renderBudget()};$('budgetReserve').onchange=persist;
 $('projectName').oninput=()=>{state.projectName=$('projectName').value};$('projectName').onchange=persist;
 $('saveProjectBtn').onclick=persist;$('exportPdfBtn').onclick=exportPdf;
}

function exportPdf(){
  if(!window.jspdf?.jsPDF){return toast('PDF библиотеката не е заредена. Провери интернет връзката.');}
  const {jsPDF}=window.jspdf;const doc=new jsPDF();let y=18;doc.setFontSize(18);doc.text('HousePlanner - Renovation Report',14,y);y+=8;doc.setFontSize(11);doc.text(`Project: ${state.projectName||'Untitled'}`,14,y);y+=6;doc.text(`Generated: ${new Date().toLocaleString('bg-BG')}`,14,y);y+=10;
  const addTable=(title,head,body)=>{doc.setFontSize(13);doc.text(title,14,y);y+=4;doc.autoTable({startY:y,head:[head],body:body.length?body:[['-']],styles:{fontSize:8},margin:{left:14,right:14}});y=doc.lastAutoTable.finalY+10;if(y>260){doc.addPage();y=18}};
  addTable('Rooms',['Name','Type','Dimensions cm','Floor m2'],state.rooms.map(r=>[r.name,r.type,`${r.width} x ${r.length} x ${r.height}`,cm2m2(r.width,r.length).toFixed(2)]));
  addTable('Walls',['Room','Wall','Gross m2','Openings m2','Net m2'],state.walls.map(w=>[roomName(w.roomId),w.name,w.gross.toFixed(2),w.openingsArea.toFixed(2),w.net.toFixed(2)]));
  addTable('Floor zones',['Zone','Dimensions cm','Area m2','Purchase m2'],state.floors.map(f=>[f.name,`${f.width} x ${f.length}`,f.area.toFixed(2),f.purchaseArea.toFixed(2)]));
  addTable('Materials',['Activity','Material','Qty','Unit price','Total'],state.materials.map(m=>[m.activity,m.name,`${m.qty} ${m.unit}`,money(m.price),money(m.qty*m.price)]));
  addTable('Extra costs',['Description','Amount'],state.extras.map(e=>[e.name,money(e.amount)]));
  const total=materialsTotal()+extrasTotal();doc.setFontSize(12);doc.text(`Materials: ${money(materialsTotal())}`,14,y);y+=6;doc.text(`Extra costs: ${money(extrasTotal())}`,14,y);y+=6;doc.text(`Subtotal: ${money(total)}`,14,y);y+=6;doc.text(`Reserve (${state.budgetReserve}%): ${money(total*state.budgetReserve/100)}`,14,y);y+=6;doc.text(`Recommended total: ${money(total*(1+state.budgetReserve/100))}`,14,y);
  doc.save(`${(state.projectName||'houseplanner').replace(/[^a-z0-9а-я_-]+/gi,'-')}.pdf`);
}

function loadPlannerModule(){
  if(document.querySelector('link[data-houseplanner-2d]'))return;
  const css=document.createElement('link');css.rel='stylesheet';css.href='planner.css';css.dataset.houseplanner2d='true';document.head.appendChild(css);
  const script=document.createElement('script');script.src='planner.js';script.onload=()=>{const geometry=document.createElement('script');geometry.src='planner-geometry.js';document.body.appendChild(geometry)};document.body.appendChild(script);
}

initNav();bindForms();renderOpeningEditor();renderAll();loadPlannerModule();