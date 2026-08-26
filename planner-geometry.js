(() => {
  const PX_PER_CM = 0.2;
  const EDGE_SNAP_CM = 20;
  const nextSide = {north:'east',east:'south',south:'west',west:'north'};
  const sideLabel = {north:'Север',east:'Изток',south:'Юг',west:'Запад'};
  let activeRoomId = null;
  let guideEls = [];

  state.planSettings ||= {};
  if (typeof state.planSettings.wallSnap !== 'boolean') state.planSettings.wallSnap = true;

  function injectStyles(){
    if(document.getElementById('plannerGeometryStyles'))return;
    const style=document.createElement('style');
    style.id='plannerGeometryStyles';
    style.textContent=`
      .geometry-tools{display:grid;gap:8px}.geometry-row{display:flex;gap:8px;align-items:center}.geometry-row .btn{flex:1}.geometry-toggle{display:flex!important;flex-direction:row!important;align-items:center!important;gap:8px!important}.geometry-toggle input{width:auto}.connection-list{display:grid;gap:6px;max-height:170px;overflow:auto}.connection-chip{display:flex;flex-direction:column;gap:3px;border:1px solid rgba(34,197,94,.35);background:rgba(34,197,94,.06);border-radius:9px;padding:8px;font-size:.72rem}.connection-chip span{color:var(--muted)}.snap-guide{position:absolute;z-index:120;pointer-events:none;background:#22c55e;box-shadow:0 0 8px rgba(34,197,94,.55)}.snap-guide.vertical{top:0;bottom:0;width:1px}.snap-guide.horizontal{left:0;right:0;height:1px}.plan-room.geometry-connected{box-shadow:0 0 0 1px rgba(34,197,94,.55),0 10px 24px rgba(0,0,0,.22)}
    `;
    document.head.appendChild(style);
  }

  const roomById=id=>state.rooms.find(r=>r.id===id);
  const bounds=r=>({left:Number(r.planX||0),top:Number(r.planY||0),right:Number(r.planX||0)+Number(r.width)*PX_PER_CM,bottom:Number(r.planY||0)+Number(r.length)*PX_PER_CM});

  function connections(){
    const out=[];
    const tolerance=Math.max(1,Number(state.planSettings.snapCm||10))*PX_PER_CM*.6;
    for(let i=0;i<state.rooms.length;i++)for(let j=i+1;j<state.rooms.length;j++){
      const a=state.rooms[i],b=state.rooms[j],A=bounds(a),B=bounds(b);
      const v=Math.max(0,Math.min(A.bottom,B.bottom)-Math.max(A.top,B.top));
      const h=Math.max(0,Math.min(A.right,B.right)-Math.max(A.left,B.left));
      if(v>2&&Math.abs(A.right-B.left)<=tolerance)out.push({a,b,aSide:'east',bSide:'west',length:v/PX_PER_CM});
      else if(v>2&&Math.abs(B.right-A.left)<=tolerance)out.push({a,b,aSide:'west',bSide:'east',length:v/PX_PER_CM});
      else if(h>2&&Math.abs(A.bottom-B.top)<=tolerance)out.push({a,b,aSide:'south',bSide:'north',length:h/PX_PER_CM});
      else if(h>2&&Math.abs(B.bottom-A.top)<=tolerance)out.push({a,b,aSide:'north',bSide:'south',length:h/PX_PER_CM});
    }
    return out;
  }

  function refreshUI(){
    const planner=document.getElementById('planner2d');
    if(!planner)return;
    injectControls();
    const list=document.getElementById('plannerGeometryConnections');
    const cs=connections();
    if(list){
      list.innerHTML=cs.length?cs.map(c=>`<div class="connection-chip"><strong>${escapeHtml(c.a.name)} ↔ ${escapeHtml(c.b.name)}</strong><span>${sideLabel[c.aSide]} / ${sideLabel[c.bSide]} · ${c.length.toFixed(0)} cm обща стена</span></div>`).join(''):'<span class="muted">Няма прилепени общи стени.</span>';
    }
    document.querySelectorAll('.plan-room').forEach(el=>{
      const id=el.dataset.roomId;
      el.classList.toggle('geometry-connected',cs.some(c=>c.a.id===id||c.b.id===id));
    });
  }

  function injectControls(){
    if(document.getElementById('plannerGeometryTools'))return;
    const tools=document.querySelector('#planner2d .planner-tools');
    if(!tools)return;
    const group=document.createElement('div');
    group.className='tool-group geometry-tools';
    group.id='plannerGeometryTools';
    group.innerHTML=`<h4>Геометрия</h4><div class="geometry-row"><button id="plannerRotateRoom" class="btn secondary" type="button">Завърти 90°</button></div><label class="geometry-toggle"><input id="plannerWallSnapToggle" type="checkbox"> Прилепване към съседни стени</label><div id="plannerGeometryConnections" class="connection-list"></div><p class="planner-hint">При влачене близките ръбове се прихващат автоматично. Завъртането запазва площта и мести отворите към следващата страна.</p>`;
    tools.appendChild(group);
    document.getElementById('plannerWallSnapToggle').checked=Boolean(state.planSettings.wallSnap);
    document.getElementById('plannerWallSnapToggle').onchange=e=>{state.planSettings.wallSnap=e.target.checked;persist();refreshUI()};
    document.getElementById('plannerRotateRoom').onclick=rotateSelectedRoom;
  }

  function selectedRoom(){
    const selected=document.querySelector('.plan-room.selected');
    return selected?roomById(selected.dataset.roomId):roomById(document.getElementById('plannerRoomSelect')?.value);
  }

  function rotateSelectedRoom(){
    const r=selectedRoom();
    if(!r)return toast('Избери помещение.');
    [r.width,r.length]=[Number(r.length),Number(r.width)];
    state.planOpenings.filter(o=>o.roomId===r.id).forEach(o=>o.side=nextSide[o.side]||o.side);
    state.walls.filter(w=>w.roomId===r.id&&w.planSide).forEach(w=>{
      w.planSide=nextSide[w.planSide]||w.planSide;
      w.width=['north','south'].includes(w.planSide)?Number(r.width):Number(r.length);
      w.gross=w.width*Number(r.height||260)/10000;
      w.openingsArea=(w.openings||[]).reduce((s,o)=>s+Number(o.width)*Number(o.height)/10000,0);
      w.net=Math.max(0,w.gross-w.openingsArea);
    });
    renderAll();persist();
    document.querySelector('[data-view="planner2d"]')?.click();
    setTimeout(refreshUI,0);
  }

  function clearGuides(){guideEls.forEach(x=>x.remove());guideEls=[]}
  function addGuide(axis,value){
    const canvas=document.getElementById('plannerCanvas');if(!canvas)return;
    const el=document.createElement('span');el.className=`snap-guide ${axis==='x'?'vertical':'horizontal'}`;
    if(axis==='x')el.style.left=`${value}px`;else el.style.top=`${value}px`;
    canvas.appendChild(el);guideEls.push(el);
  }

  function applyWallSnap(r,el){
    clearGuides();
    if(!state.planSettings.wallSnap)return;
    const threshold=EDGE_SNAP_CM*PX_PER_CM;
    const w=Number(r.width)*PX_PER_CM,h=Number(r.length)*PX_PER_CM;
    let x=Number(r.planX||0),y=Number(r.planY||0),bestX=null,bestY=null;
    state.rooms.filter(o=>o.id!==r.id).forEach(o=>{
      const b=bounds(o);
      [{v:b.left,g:b.left},{v:b.right,g:b.right},{v:b.left-w,g:b.left},{v:b.right-w,g:b.right}].forEach(c=>{const d=Math.abs(c.v-x);if(d<=threshold&&(!bestX||d<bestX.d))bestX={d,v:c.v,g:c.g}});
      [{v:b.top,g:b.top},{v:b.bottom,g:b.bottom},{v:b.top-h,g:b.top},{v:b.bottom-h,g:b.bottom}].forEach(c=>{const d=Math.abs(c.v-y);if(d<=threshold&&(!bestY||d<bestY.d))bestY={d,v:c.v,g:c.g}});
    });
    if(bestX){r.planX=Math.max(0,bestX.v);el.style.left=`${r.planX}px`;addGuide('x',bestX.g)}
    if(bestY){r.planY=Math.max(0,bestY.v);el.style.top=`${r.planY}px`;addGuide('y',bestY.g)}
  }

  document.addEventListener('pointerdown',e=>{
    const room=e.target.closest?.('.plan-room');
    if(!room||e.target.matches('[data-resize-room]'))return;
    activeRoomId=room.dataset.roomId;
  },true);

  document.addEventListener('pointermove',e=>{
    if(!activeRoomId)return;
    const el=document.querySelector(`.plan-room[data-room-id="${CSS.escape(activeRoomId)}"]`);
    const r=roomById(activeRoomId);
    if(!el||!r)return;
    requestAnimationFrame(()=>applyWallSnap(r,el));
  });

  document.addEventListener('pointerup',()=>{
    if(!activeRoomId)return;
    clearGuides();
    activeRoomId=null;
    persist();
    setTimeout(refreshUI,0);
  });
  document.addEventListener('pointercancel',()=>{activeRoomId=null;clearGuides()});

  const observer=new MutationObserver(()=>refreshUI());
  observer.observe(document.body,{childList:true,subtree:true});
  injectStyles();
  refreshUI();
})();
