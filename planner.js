(() => {
  const PX_PER_CM = 0.2; // 5 cm = 1 px at 100% zoom
  const sides = {north:'Север',east:'Изток',south:'Юг',west:'Запад'};
  let selectedRoomId = null;
  let selectedWall = 'north';
  let zoom = 1;
  let interaction = null;

  state.planOpenings ||= [];
  state.planSettings ||= {snapCm:10};

  const q = id => document.getElementById(id);
  const snap = value => {
    const s = Math.max(1, Number(state.planSettings.snapCm || 10));
    return Math.round(value / s) * s;
  };
  const roomById = id => state.rooms.find(r => r.id === id);
  const roomArea = r => (Number(r.width) * Number(r.length)) / 10000;
  const wallLength = (r, side) => ['north','south'].includes(side) ? Number(r.width) : Number(r.length);
  const openingsFor = (roomId, side) => state.planOpenings.filter(o => o.roomId === roomId && (!side || o.side === side));

  function ensurePositions(){
    state.rooms.forEach((r,i) => {
      if (!Number.isFinite(Number(r.planX))) r.planX = 80 + (i % 4) * 360;
      if (!Number.isFinite(Number(r.planY))) r.planY = 80 + Math.floor(i / 4) * 300;
    });
  }

  function injectPlanner(){
    if (q('planner2d')) return;
    const roomNav = document.querySelector('[data-view="rooms"]');
    const nav = document.createElement('button');
    nav.className = 'nav-link';
    nav.dataset.view = 'planner2d';
    nav.textContent = '2D Планер';
    roomNav.insertAdjacentElement('afterend', nav);

    const section = document.createElement('section');
    section.id = 'planner2d';
    section.className = 'view';
    section.innerHTML = `
      <div class="section-heading"><div><p class="eyebrow">2D РЕДАКТОР</p><h2>Интерактивен план на имота</h2></div></div>
      <div class="planner-metrics">
        <article class="stat-card"><span>Помещения</span><strong id="plannerRoomCount">0</strong></article>
        <article class="stat-card"><span>Обща площ</span><strong id="plannerArea">0.00 m²</strong></article>
        <article class="stat-card"><span>Отвори</span><strong id="plannerOpeningCount">0</strong></article>
        <article class="stat-card"><span>Snap</span><strong id="plannerSnapStat">10 cm</strong></article>
      </div>
      <div class="planner-layout">
        <aside class="panel planner-tools">
          <div class="tool-group">
            <h4>Помещение</h4>
            <label>Избрано помещение<select id="plannerRoomSelect"></select></label>
            <div id="plannerSelectedInfo" class="selected-info"><span class="muted">Няма избрано помещение.</span></div>
          </div>
          <div class="tool-group">
            <h4>Размери</h4>
            <div class="tool-row">
              <label>Ширина (cm)<input id="plannerWidth" type="number" min="20" step="1"></label>
              <label>Дължина (cm)<input id="plannerLength" type="number" min="20" step="1"></label>
            </div>
            <label>Височина (cm)<input id="plannerHeight" type="number" min="20" step="1"></label>
            <button id="plannerApplySize" class="btn secondary full" type="button">Приложи размерите</button>
          </div>
          <div class="tool-group">
            <h4>Стени</h4>
            <div id="plannerWallList" class="wall-list"></div>
          </div>
          <div class="tool-group">
            <h4>Врата / прозорец</h4>
            <label>Тип<select id="plannerOpeningType"><option value="door">Врата</option><option value="window">Прозорец</option></select></label>
            <div class="tool-row">
              <label>Ширина (cm)<input id="plannerOpeningWidth" type="number" min="20" value="90"></label>
              <label>Отстояние (cm)<input id="plannerOpeningOffset" type="number" min="0" value="20"></label>
            </div>
            <label>Височина (cm)<input id="plannerOpeningHeight" type="number" min="20" value="200"></label>
            <button id="plannerAddOpening" class="btn primary full" type="button">Добави към избраната стена</button>
            <div id="plannerOpeningList" class="opening-list"></div>
          </div>
          <div class="tool-group">
            <h4>Синхронизация</h4>
            <button id="plannerSyncWalls" class="btn secondary full" type="button">Създай 4 стени за помещението</button>
            <p class="planner-hint">Създава/обновява четирите стени в секцията „Стени и отвори“, като изважда площта на вратите и прозорците.</p>
          </div>
        </aside>
        <article class="panel planner-stage-panel">
          <div class="planner-toolbar">
            <div class="planner-toolbar-left"><strong>План</strong><span>Влачи помещенията. Използвай дръжката долу вдясно за resize.</span></div>
            <div class="planner-toolbar-right">
              <label>Snap <select id="plannerSnap"><option value="5">5 cm</option><option value="10" selected>10 cm</option><option value="25">25 cm</option><option value="50">50 cm</option></select></label>
              <button id="plannerZoomOut" class="btn tiny" type="button">−</button><span id="plannerZoomLabel">100%</span><button id="plannerZoomIn" class="btn tiny" type="button">+</button>
              <button id="plannerFit" class="btn tiny" type="button">Fit</button>
            </div>
          </div>
          <div id="plannerViewport" class="planner-viewport"><div id="plannerCanvas" class="planner-canvas"></div></div>
        </article>
      </div>`;
    document.querySelector('.workspace').appendChild(section);

    nav.addEventListener('click', () => {
      document.querySelectorAll('.nav-link').forEach(x=>x.classList.remove('active'));
      document.querySelectorAll('.view').forEach(x=>x.classList.remove('active-view'));
      nav.classList.add('active'); section.classList.add('active-view'); renderPlanner();
    });
  }

  function renderPlanner(){
    ensurePositions();
    if (!selectedRoomId || !roomById(selectedRoomId)) selectedRoomId = state.rooms[0]?.id || null;
    q('plannerRoomCount').textContent = state.rooms.length;
    q('plannerArea').textContent = `${state.rooms.reduce((s,r)=>s+roomArea(r),0).toFixed(2)} m²`;
    q('plannerOpeningCount').textContent = state.planOpenings.length;
    q('plannerSnapStat').textContent = `${state.planSettings.snapCm || 10} cm`;
    q('plannerSnap').value = String(state.planSettings.snapCm || 10);

    q('plannerRoomSelect').innerHTML = state.rooms.length ? state.rooms.map(r=>`<option value="${r.id}" ${r.id===selectedRoomId?'selected':''}>${escapeHtml(r.name)}</option>`).join('') : '<option value="">Няма помещения</option>';
    const canvas = q('plannerCanvas');
    canvas.innerHTML = state.rooms.length ? state.rooms.map(roomMarkup).join('') : '<div class="planner-empty">Добави помещение от „План на имота“, за да започнеш.</div>';
    canvas.style.transform = `scale(${zoom})`;
    q('plannerZoomLabel').textContent = `${Math.round(zoom*100)}%`;
    bindRoomInteractions();
    renderSelectedPanel();
  }

  function roomMarkup(r){
    const w = Math.max(40, Number(r.width)*PX_PER_CM), h = Math.max(40, Number(r.length)*PX_PER_CM);
    const ops = openingsFor(r.id).map(o=>openingMarkup(o,r,w,h)).join('');
    return `<div class="plan-room ${r.id===selectedRoomId?'selected':''}" data-room-id="${r.id}" style="left:${Number(r.planX)}px;top:${Number(r.planY)}px;width:${w}px;height:${h}px">
      <div class="plan-room-label"><strong>${escapeHtml(r.name)}</strong><span>${roomArea(r).toFixed(2)} m² · ${escapeHtml(r.type)}</span></div>
      <span class="plan-dimension-x">${Number(r.width).toFixed(0)} cm</span><span class="plan-dimension-y">${Number(r.length).toFixed(0)} cm</span>
      ${ops}<span class="resize-handle" data-resize-room="${r.id}"></span>
    </div>`;
  }

  function openingMarkup(o,r,w,h){
    const sideLen = wallLength(r,o.side);
    const widthPct = Math.min(100, Number(o.width)/sideLen*100);
    const offsetPct = Math.min(100-widthPct, Math.max(0, Number(o.offset)/sideLen*100));
    if (['north','south'].includes(o.side)) return `<span class="plan-opening ${o.type} ${o.side}" style="left:${offsetPct}%;width:${widthPct}%"></span>`;
    return `<span class="plan-opening ${o.type} ${o.side}" style="top:${offsetPct}%;height:${widthPct}%"></span>`;
  }

  function bindRoomInteractions(){
    document.querySelectorAll('.plan-room').forEach(el=>{
      el.addEventListener('pointerdown', e=>{
        const id=el.dataset.roomId; selectedRoomId=id;
        if (e.target.matches('[data-resize-room]')) startResize(e,id,el); else startDrag(e,id,el);
        renderSelectedPanel();
      });
      el.addEventListener('click',()=>{selectedRoomId=el.dataset.roomId;renderPlanner()});
    });
  }

  function startDrag(e,id,el){
    e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add('dragging');
    const r=roomById(id); interaction={type:'drag',id,startX:e.clientX,startY:e.clientY,origX:Number(r.planX),origY:Number(r.planY),el};
    el.onpointermove=moveInteraction; el.onpointerup=endInteraction; el.onpointercancel=endInteraction;
  }
  function startResize(e,id,el){
    e.preventDefault(); e.stopPropagation(); el.setPointerCapture(e.pointerId);
    const r=roomById(id); interaction={type:'resize',id,startX:e.clientX,startY:e.clientY,origW:Number(r.width),origL:Number(r.length),el};
    el.onpointermove=moveInteraction; el.onpointerup=endInteraction; el.onpointercancel=endInteraction;
  }
  function moveInteraction(e){
    if(!interaction)return; const r=roomById(interaction.id); if(!r)return;
    const dx=(e.clientX-interaction.startX)/zoom,dy=(e.clientY-interaction.startY)/zoom;
    if(interaction.type==='drag'){
      r.planX=Math.max(0,snap((interaction.origX+dx)/PX_PER_CM)*PX_PER_CM);
      r.planY=Math.max(0,snap((interaction.origY+dy)/PX_PER_CM)*PX_PER_CM);
      interaction.el.style.left=`${r.planX}px`;interaction.el.style.top=`${r.planY}px`;
    }else{
      r.width=Math.max(20,snap(interaction.origW+dx/PX_PER_CM));
      r.length=Math.max(20,snap(interaction.origL+dy/PX_PER_CM));
      interaction.el.style.width=`${Math.max(40,r.width*PX_PER_CM)}px`;interaction.el.style.height=`${Math.max(40,r.length*PX_PER_CM)}px`;
      const x=interaction.el.querySelector('.plan-dimension-x'),y=interaction.el.querySelector('.plan-dimension-y'); if(x)x.textContent=`${r.width} cm`;if(y)y.textContent=`${r.length} cm`;
    }
  }
  function endInteraction(){
    if(!interaction)return; interaction.el.classList.remove('dragging'); interaction.el.onpointermove=null;interaction.el.onpointerup=null;interaction.el.onpointercancel=null; interaction=null; renderAll(); persist(); renderPlanner();
  }

  function renderSelectedPanel(){
    const r=roomById(selectedRoomId); const info=q('plannerSelectedInfo');
    if(!r){info.innerHTML='<span class="muted">Няма избрано помещение.</span>';q('plannerWallList').innerHTML='';q('plannerOpeningList').innerHTML='';return}
    info.innerHTML=`<div><span>Помещение</span><strong>${escapeHtml(r.name)}</strong></div><div><span>Площ</span><strong>${roomArea(r).toFixed(2)} m²</strong></div><div><span>Позиция</span><strong>${Math.round(r.planX/PX_PER_CM)} × ${Math.round(r.planY/PX_PER_CM)} cm</strong></div>`;
    q('plannerWidth').value=r.width;q('plannerLength').value=r.length;q('plannerHeight').value=r.height;
    q('plannerWallList').innerHTML=Object.keys(sides).map(side=>`<button type="button" data-plan-wall="${side}" class="${side===selectedWall?'active':''}"><span>${sides[side]}</span><strong>${wallLength(r,side)} cm</strong></button>`).join('');
    q('plannerOpeningList').innerHTML=openingsFor(r.id).map(o=>`<div class="opening-chip"><div><strong>${o.type==='door'?'Врата':'Прозорец'}</strong><span> · ${sides[o.side]} · ${o.width} cm</span></div><button class="icon-btn" type="button" data-remove-opening="${o.id}">×</button></div>`).join('') || '<span class="muted">Няма отвори.</span>';
    document.querySelectorAll('[data-plan-wall]').forEach(b=>b.onclick=()=>{selectedWall=b.dataset.planWall;renderSelectedPanel()});
    document.querySelectorAll('[data-remove-opening]').forEach(b=>b.onclick=()=>{state.planOpenings=state.planOpenings.filter(o=>o.id!==b.dataset.removeOpening);persist();renderPlanner()});
  }

  function syncSelectedWalls(){
    const r=roomById(selectedRoomId); if(!r)return toast('Избери помещение.');
    const h=Number(r.height||260);
    Object.keys(sides).forEach(side=>{
      const width=wallLength(r,side), ops=openingsFor(r.id,side), holes=ops.reduce((s,o)=>s+(Number(o.width)*Number(o.height)/10000),0),gross=width*h/10000;
      const name=`${sides[side]}на стена`;
      const mapped=ops.map(o=>({type:o.type==='door'?'Врата':'Прозорец',width:Number(o.width),height:Number(o.height)}));
      const existing=state.walls.find(w=>w.roomId===r.id&&w.planSide===side);
      const data={roomId:r.id,name,width,height:gross? h: h,gross,openingsArea:holes,net:Math.max(0,gross-holes),openings:mapped,planSide:side};
      if(existing)Object.assign(existing,data);else state.walls.push({id:uid(),...data});
    });
    renderAll();persist();toast('Четирите стени са синхронизирани.');
  }

  function bindControls(){
    q('plannerRoomSelect').onchange=e=>{selectedRoomId=e.target.value||null;renderPlanner()};
    q('plannerApplySize').onclick=()=>{const r=roomById(selectedRoomId);if(!r)return;r.width=Math.max(20,Number(q('plannerWidth').value||r.width));r.length=Math.max(20,Number(q('plannerLength').value||r.length));r.height=Math.max(20,Number(q('plannerHeight').value||r.height));renderAll();persist();renderPlanner()};
    q('plannerAddOpening').onclick=()=>{const r=roomById(selectedRoomId);if(!r)return toast('Избери помещение.');const width=Number(q('plannerOpeningWidth').value||0),height=Number(q('plannerOpeningHeight').value||0),offset=Number(q('plannerOpeningOffset').value||0),limit=wallLength(r,selectedWall);if(width<=0||height<=0)return toast('Въведи размери на отвора.');if(offset+width>limit)return toast('Отворът излиза извън дължината на стената.');state.planOpenings.push({id:uid(),roomId:r.id,side:selectedWall,type:q('plannerOpeningType').value,width,height,offset});persist();renderPlanner()};
    q('plannerSyncWalls').onclick=syncSelectedWalls;
    q('plannerSnap').onchange=e=>{state.planSettings.snapCm=Number(e.target.value);persist();renderPlanner()};
    q('plannerZoomIn').onclick=()=>{zoom=Math.min(1.75,zoom+.25);renderPlanner()};
    q('plannerZoomOut').onclick=()=>{zoom=Math.max(.5,zoom-.25);renderPlanner()};
    q('plannerFit').onclick=()=>{const vp=q('plannerViewport');if(!state.rooms.length)return;const maxX=Math.max(...state.rooms.map(r=>Number(r.planX)+Number(r.width)*PX_PER_CM))+100;const maxY=Math.max(...state.rooms.map(r=>Number(r.planY)+Number(r.length)*PX_PER_CM))+100;zoom=Math.max(.5,Math.min(1,Math.min(vp.clientWidth/maxX,vp.clientHeight/maxY)));renderPlanner();vp.scrollTo({top:0,left:0,behavior:'smooth'})};
  }

  injectPlanner();
  bindControls();
  renderPlanner();
})();
