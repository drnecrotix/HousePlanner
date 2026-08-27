(() => {
  const EUR_RATE = 1.95583;
  const eur = n => `${Number(n || 0).toFixed(2)} €`;

  function migrateCurrency(){
    if(state.currency === 'EUR') return false;
    state.materials = (state.materials || []).map(m => ({...m, price:Number(m.price || 0) / EUR_RATE}));
    state.extras = (state.extras || []).map(e => ({...e, amount:Number(e.amount || 0) / EUR_RATE}));
    state.currency = 'EUR';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  }

  function replaceStaticCurrencyLabels(){
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      if(node.parentElement?.closest('script,style')) return;
      if(node.nodeValue.includes('лв.')) node.nodeValue=node.nodeValue.replaceAll('лв.','€');
    });
  }

  function surfacePreset(){
    const type=$('paintSurface')?.value || 'painted';
    const presets={
      painted:{coverage:10,primer:false,title:'Боядисана и здрава стена',tips:['Измий прах и мазнини преди боядисване.','Матирай леко много гладки или лъскави покрития.','Грунд обикновено не е необходим, ако основата е здрава и цветът е сходен.']},
      plaster:{coverage:8,primer:true,title:'Нова шпакловка / мазилка / гипсокартон',tips:['Основата трябва да е напълно суха и обезпрашена.','Нанеси подходящ дълбокопроникващ грунд преди боята.','Следвай времето за изсъхване от етикета на грунда преди първата ръка боя.']},
      repaired:{coverage:9,primer:true,title:'Кърпена или неравномерно попиваща стена',tips:['Шлайфай и обезпраши поправените места.','Грундирай поправките, а при силно различна попиваемост - цялата стена.','Провери дали петната и поправките не прозират преди финалната ръка.']},
      dark:{coverage:9,primer:true,title:'Тъмен към светъл цвят',tips:['Подходящ оцветен или бял грунд може да намали нужните ръце боя.','Планирай поне две ръце; при силен контраст може да са нужни повече.','Оставяй всяка ръка да изсъхне според указанията на производителя.']},
      damp:{coverage:9,primer:true,title:'Петна, мухъл или следи от влага',tips:['Не боядисвай върху активна влага - първо отстрани причината.','Почисти и обработи основата с продукт, предназначен за конкретния проблем.','Боядисвай едва след като стената е суха и стабилна.']}
    };
    return presets[type] || presets.painted;
  }

  paintCalc = function(){
    const a=Number($('paintArea')?.value||0);
    const preset=surfacePreset();
    const coverage=Number($('paintCoverage')?.value||preset.coverage);
    const coats=Number($('paintCoats')?.value||2);
    const waste=Number($('paintWaste')?.value||10);
    const can=Number($('paintCanSize')?.value||5);
    const price=Number($('paintCanPrice')?.value||0);
    const base=coverage>0?a*coats/coverage:0;
    const withWaste=base*(1+waste/100);
    const cans=can>0?Math.ceil(withWaste/can):0;
    const purchased=cans*can;
    const cost=cans*price;

    const primerEnabled=Boolean($('paintPrimer')?.checked);
    const primerCoverage=Number($('primerCoverage')?.value||10);
    const primerCan=Number($('primerCanSize')?.value||5);
    const primerPrice=Number($('primerCanPrice')?.value||0);
    const primerNeeded=primerEnabled&&primerCoverage>0?a*1.05/primerCoverage:0;
    const primerCans=primerEnabled&&primerCan>0?Math.ceil(primerNeeded/primerCan):0;
    const primerPurchased=primerCans*primerCan;
    const primerCost=primerCans*primerPrice;

    if($('paintCoverage') && document.activeElement!==$('paintCoverage')) $('paintCoverage').value=preset.coverage;
    if($('paintLiters')) $('paintLiters').textContent=`${purchased.toFixed(1)} L`;
    if($('paintCans')) $('paintCans').textContent=cans?`${cans} × ${can} L боя`:'Въведи площ, за да изчислим боята';
    if($('paintBase')) $('paintBase').textContent=`${withWaste.toFixed(1)} L`;
    if($('paintWithWaste')) $('paintWithWaste').textContent=primerEnabled?`${primerPurchased.toFixed(1)} L (${primerCans} разф.)`:'Не е включен';
    if($('paintCost')) $('paintCost').textContent=eur(cost+primerCost);
    if($('paintRecommendation')) $('paintRecommendation').innerHTML=`<strong>${preset.title}</strong>${preset.tips.map(t=>`<span>${escapeHtml(t)}</span>`).join('')}`;
    if($('primerHint')) $('primerHint').textContent=primerEnabled?'Грундът е включен в сметката. Обичайно се нанася 1 равномерна ръка върху чиста и суха основа.':'Грундът е изключен. Включи го при нова, кърпена или силно попиваща основа.';

    return {base,withWaste,cans,purchased,cost,can,price,area:a,primerEnabled,primerCans,primerPurchased,primerCost};
  };

  renderMaterials = function(){
    $('materialsTable').innerHTML=state.materials.map(m=>`<tr><td>${escapeHtml(m.activity)}</td><td><strong>${escapeHtml(m.name)}</strong></td><td>${m.qty} ${escapeHtml(m.unit)}</td><td>${eur(m.price)}</td><td>${eur(m.qty*m.price)}</td><td class="muted">${escapeHtml(m.note||'')}</td><td><button class="icon-btn" data-delete-material="${m.id}">Премахни</button></td></tr>`).join('');
    $('materialTotal').textContent=eur(materialsTotal());
    document.querySelectorAll('[data-delete-material]').forEach(b=>b.onclick=()=>{state.materials=state.materials.filter(x=>x.id!==b.dataset.deleteMaterial);renderAll();persist()});
  };

  renderBudget = function(){
    $('extrasTable').innerHTML=state.extras.map(e=>`<tr><td><strong>${escapeHtml(e.name)}</strong></td><td>${eur(e.amount)}</td><td><button class="icon-btn" data-delete-extra="${e.id}">Премахни</button></td></tr>`).join('');
    document.querySelectorAll('[data-delete-extra]').forEach(b=>b.onclick=()=>{state.extras=state.extras.filter(x=>x.id!==b.dataset.deleteExtra);renderAll();persist()});
    $('budgetReserve').value=state.budgetReserve;
    const mt=materialsTotal(),et=extrasTotal(),total=mt+et,res=total*(Number(state.budgetReserve)/100);
    $('budgetMaterials').textContent=eur(mt);$('budgetExtras').textContent=eur(et);$('budgetGrand').textContent=eur(total);$('budgetReserveAmount').textContent=eur(res);$('budgetWithReserve').textContent=eur(total+res);
  };

  renderDashboard = function(){
    $('projectName').value=state.projectName;
    $('statRooms').textContent=state.rooms.length;
    $('statFloor').textContent=area(state.rooms.reduce((s,r)=>s+cm2m2(r.width,r.length),0));
    $('statWalls').textContent=area(state.walls.reduce((s,w)=>s+w.net,0));
    $('statBudget').textContent=eur(materialsTotal()+extrasTotal());
    const items=[['Помещения',state.rooms.length?`${state.rooms.length} добавени`:'Добави стаите и помещенията'],['Стени',state.walls.length?`${state.walls.length} измерени`:'Добави стени, врати и прозорци'],['Материали',state.materials.length?`${state.materials.length} позиции`:'Създай списък за ремонта']];
    $('activitySummary').innerHTML=items.map(x=>`<div class="summary-item"><strong>${x[0]}</strong><span>${x[1]}</span></div>`).join('');
  };

  function rebuildPaintUI(){
    const section=$('paint');
    if(!section)return;
    section.innerHTML=`
      <div class="section-heading"><div><p class="eyebrow">БОЯДИСВАНЕ</p><h2>Колко боя ми трябва?</h2><p class="paint-lead">Въведи площта и избери състоянието на стената. Останалото HousePlanner ще предложи автоматично.</p></div></div>
      <div class="paint-simple-grid">
        <form id="paintForm" class="panel form-panel paint-main-card">
          <div class="paint-step"><span class="paint-step-no">1</span><div><strong>Площ за боядисване</strong><small>Нетна площ на стените, без врати и прозорци.</small></div></div>
          <label>Площ (m²)<input id="paintArea" type="number" min="0" step="0.01" placeholder="Напр. 42" /></label>
          <button id="useWallsAreaBtn" class="btn secondary full" type="button">Вземи площта от моите стени</button>

          <div class="paint-step"><span class="paint-step-no">2</span><div><strong>Каква е стената?</strong><small>Изборът задава разумни начални стойности.</small></div></div>
          <label>Състояние на основата<select id="paintSurface"><option value="painted">Вече боядисана и здрава</option><option value="plaster">Нова шпакловка / мазилка / гипсокартон</option><option value="repaired">Кърпена или неравномерно попиваща</option><option value="dark">Тъмен цвят → светъл цвят</option><option value="damp">Петна / мухъл / следи от влага</option></select></label>
          <label>Брой ръце боя<select id="paintCoats"><option value="1">1 ръка</option><option value="2" selected>2 ръце - стандартно</option><option value="3">3 ръце</option></select></label>

          <label class="paint-check"><input id="paintPrimer" type="checkbox"><span><strong>Добави грунд</strong><small id="primerHint"></small></span></label>

          <details class="paint-advanced"><summary>Разширени настройки и цени</summary><div class="field-grid">
            <label>Покривност боя (m²/L)<input id="paintCoverage" type="number" min="0.1" step="0.1" value="10"></label>
            <label>Резерв (%)<input id="paintWaste" type="number" min="0" step="0.1" value="10"></label>
            <label>Разфасовка боя (L)<input id="paintCanSize" type="number" min="0.1" step="0.1" value="5"></label>
            <label>Цена боя / разфасовка (€)<input id="paintCanPrice" type="number" min="0" step="0.01" value="25"></label>
            <label>Покривност грунд (m²/L)<input id="primerCoverage" type="number" min="0.1" step="0.1" value="10"></label>
            <label>Разфасовка грунд (L)<input id="primerCanSize" type="number" min="0.1" step="0.1" value="5"></label>
            <label>Цена грунд / разфасовка (€)<input id="primerCanPrice" type="number" min="0" step="0.01" value="12"></label>
          </div></details>
        </form>

        <div class="paint-result-stack">
          <article class="panel result-panel paint-result-card">
            <p class="eyebrow">ЗА ПОКУПКА</p><strong id="paintLiters" class="big-number">0.0 L</strong><span id="paintCans">Въведи площ</span>
            <div class="result-breakdown"><div><span>Необходимо количество боя</span><strong id="paintBase">0.0 L</strong></div><div><span>Грунд</span><strong id="paintWithWaste">Не е включен</strong></div><div><span>Боя + грунд</span><strong id="paintCost">0.00 €</strong></div></div>
            <button id="addPaintMaterialsBtn" class="btn primary full" type="button">Добави боя и подготовка към материалите</button>
          </article>
          <article class="panel paint-recommendations"><div class="panel-header"><h3>Как да подготвиш стената</h3><span>Практични насоки</span></div><div id="paintRecommendation" class="paint-advice"></div></article>
        </div>
      </div>

      <article class="panel paint-supplies"><div class="panel-header"><h3>Още необходими неща</h3><span>Избери какво да добавим към списъка</span></div><div class="paint-supply-grid">
        <label><input type="checkbox" data-paint-supply="Валяк" checked> Валяк</label>
        <label><input type="checkbox" data-paint-supply="Четка за ъгли" checked> Четка за ъгли</label>
        <label><input type="checkbox" data-paint-supply="Ваничка за боя" checked> Ваничка</label>
        <label><input type="checkbox" data-paint-supply="Бояджийска лента" checked> Бояджийска лента</label>
        <label><input type="checkbox" data-paint-supply="Покривно фолио" checked> Покривно фолио</label>
        <label><input type="checkbox" data-paint-supply="Шкурка"> Шкурка</label>
        <label><input type="checkbox" data-paint-supply="Шпакловка за поправки"> Шпакловка за поправки</label>
      </div><p class="planner-hint">Количествата на консумативите са ориентировъчни и се добавят с цена 0 €, за да попълниш реалната цена от магазина.</p></article>`;
  }

  function bindPaintUI(){
    const preset=surfacePreset();
    $('paintPrimer').checked=preset.primer;
    $('paintCoverage').value=preset.coverage;
    ['paintArea','paintCoats','paintPrimer','paintCoverage','paintWaste','paintCanSize','paintCanPrice','primerCoverage','primerCanSize','primerCanPrice'].forEach(id=>$(id)?.addEventListener('input',paintCalc));
    $('paintSurface').onchange=()=>{const p=surfacePreset();$('paintPrimer').checked=p.primer;$('paintCoverage').value=p.coverage;paintCalc()};
    $('useWallsAreaBtn').onclick=()=>{$('paintArea').value=state.walls.reduce((s,w)=>s+w.net,0).toFixed(2);paintCalc()};
    $('addPaintMaterialsBtn').onclick=()=>{
      const p=paintCalc();
      if(!p.cans)return toast('Първо въведи площта за боядисване.');
      state.materials.push({id:uid(),activity:'Боядисване',name:'Интериорна боя',qty:p.cans,unit:'бр.',price:p.price,note:`${p.can} L/разфасовка · ${p.area.toFixed(2)} m² · ${$('paintCoats').value} ръце`});
      if(p.primerEnabled&&p.primerCans) state.materials.push({id:uid(),activity:'Боядисване',name:'Грунд',qty:p.primerCans,unit:'бр.',price:Number($('primerCanPrice').value||0),note:`${Number($('primerCanSize').value||0)} L/разфасовка · 1 ръка`});
      document.querySelectorAll('[data-paint-supply]:checked').forEach(el=>state.materials.push({id:uid(),activity:'Боядисване',name:el.dataset.paintSupply,qty:1,unit:'бр.',price:0,note:'Провери количество според помещението'}));
      renderAll();persist();toast('Боята, подготовката и избраните консумативи са добавени.');
    };
    paintCalc();
  }

  function injectStyles(){
    const s=document.createElement('style');s.id='paintEuroStyles';s.textContent=`
      .paint-lead{margin:7px 0 0;color:var(--muted);max-width:760px}.paint-simple-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(330px,.95fr);gap:18px;margin-bottom:18px}.paint-result-stack{display:grid;gap:18px}.paint-step{display:flex;align-items:center;gap:10px;margin-top:6px;padding-top:10px;border-top:1px solid var(--line)}.paint-step:first-child{border-top:0;padding-top:0}.paint-step-no{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:var(--accent-soft);color:var(--accent-strong);font-weight:800;font-size:.78rem;flex:0 0 auto}.paint-step div{display:flex;flex-direction:column}.paint-step small,.paint-check small{color:var(--muted);font-weight:400}.paint-check{display:flex!important;flex-direction:row!important;align-items:flex-start!important;gap:10px!important;padding:13px;border:1px solid var(--line);border-radius:12px;background:var(--surface-2)}.paint-check input{width:auto;margin-top:3px}.paint-check span{display:flex;flex-direction:column;gap:3px}.paint-advanced{border:1px solid var(--line);border-radius:12px;padding:12px;background:var(--surface-2)}.paint-advanced summary{cursor:pointer;font-weight:700;color:var(--text)}.paint-advanced .field-grid{margin-top:12px}.paint-advice{display:grid;gap:9px}.paint-advice strong{font-size:.95rem}.paint-advice span{display:block;padding-left:16px;position:relative;color:var(--muted);font-size:.84rem}.paint-advice span:before{content:'•';position:absolute;left:2px;color:var(--accent)}.paint-supply-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.paint-supply-grid label{display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:10px;padding:10px;background:var(--surface-2);font-size:.82rem}.paint-supply-grid input{width:auto}.paint-supplies .planner-hint{margin:12px 0 0}@media(max-width:1000px){.paint-simple-grid{grid-template-columns:1fr}.paint-supply-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.paint-supply-grid{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }

  function overridePdfCurrency(){
    exportPdf = function(){
      if(!window.jspdf?.jsPDF){return toast('PDF библиотеката не е заредена. Провери интернет връзката.');}
      const {jsPDF}=window.jspdf;const doc=new jsPDF();let y=18;doc.setFontSize(18);doc.text('HousePlanner - Renovation Report',14,y);y+=8;doc.setFontSize(11);doc.text(`Project: ${state.projectName||'Untitled'}`,14,y);y+=6;doc.text(`Generated: ${new Date().toLocaleString('bg-BG')}`,14,y);y+=10;
      const addTable=(title,head,body)=>{doc.setFontSize(13);doc.text(title,14,y);y+=4;doc.autoTable({startY:y,head:[head],body:body.length?body:[['-']],styles:{fontSize:8},margin:{left:14,right:14}});y=doc.lastAutoTable.finalY+10;if(y>260){doc.addPage();y=18}};
      addTable('Rooms',['Name','Type','Dimensions cm','Floor m2'],state.rooms.map(r=>[r.name,r.type,`${r.width} x ${r.length} x ${r.height}`,cm2m2(r.width,r.length).toFixed(2)]));
      addTable('Walls',['Room','Wall','Gross m2','Openings m2','Net m2'],state.walls.map(w=>[roomName(w.roomId),w.name,w.gross.toFixed(2),w.openingsArea.toFixed(2),w.net.toFixed(2)]));
      addTable('Floor zones',['Zone','Dimensions cm','Area m2','Purchase m2'],state.floors.map(f=>[f.name,`${f.width} x ${f.length}`,f.area.toFixed(2),f.purchaseArea.toFixed(2)]));
      addTable('Materials',['Activity','Material','Qty','Unit price','Total'],state.materials.map(m=>[m.activity,m.name,`${m.qty} ${m.unit}`,eur(m.price),eur(m.qty*m.price)]));
      addTable('Extra costs',['Description','Amount'],state.extras.map(e=>[e.name,eur(e.amount)]));
      const total=materialsTotal()+extrasTotal();doc.setFontSize(12);doc.text(`Materials: ${eur(materialsTotal())}`,14,y);y+=6;doc.text(`Extra costs: ${eur(extrasTotal())}`,14,y);y+=6;doc.text(`Subtotal: ${eur(total)}`,14,y);y+=6;doc.text(`Reserve (${state.budgetReserve}%): ${eur(total*state.budgetReserve/100)}`,14,y);y+=6;doc.text(`Recommended total: ${eur(total*(1+state.budgetReserve/100))}`,14,y);
      doc.save(`${(state.projectName||'houseplanner').replace(/[^a-z0-9а-я_-]+/gi,'-')}.pdf`);
    };
  }

  const migrated=migrateCurrency();
  injectStyles();
  rebuildPaintUI();
  replaceStaticCurrencyLabels();
  overridePdfCurrency();
  bindPaintUI();
  renderMaterials();renderBudget();renderDashboard();
  if(migrated) toast('Старите цени са преобразувани от лева в евро по фиксирания курс 1 € = 1.95583 лв.');
})();