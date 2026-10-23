'use strict';
(() => {
 const q = s => document.querySelector(s);
 const workspace = q('#workspace'), mapSection = q('.map-section');
 const narrow = matchMedia('(max-width: 900px)');
 const make = (tag, cls, html='') => { const n=document.createElement(tag);n.className=cls;n.innerHTML=html;return n; };
 const drawer = make('dialog','map-drawer',`
  <div class="drawer-head"><div><span class="eyebrow">התאימו את התצוגה</span><h2 id="drawerTitle">כלי המפה</h2></div><button id="closeDrawer" aria-label="סגירת כלי המפה">×</button></div>
  <nav class="drawer-tabs" aria-label="כלי המפה" role="tablist">
   <button id="tabLayers" role="tab" data-dock="layers" aria-controls="dockLayers" aria-selected="true">שכבות</button>
   <button id="tabLegend" role="tab" data-dock="legend" aria-controls="dockLegend" aria-selected="false" tabindex="-1">מקרא</button>
   <button id="tabInfo" role="tab" data-dock="info" aria-controls="dockInfo" aria-selected="false" tabindex="-1">מידע וחקר</button>
  </nav>
  <div class="drawer-scroll">
   <section id="dockLayers" class="dock-pane" role="tabpanel" aria-labelledby="tabLayers">
    <div class="control-section"><h3>מה מציגים במפה?</h3><div id="baseLayers" class="base-layers" role="group" aria-label="בחירת שכבת צבע"><button id="climateBase" aria-pressed="true"><span class="layer-symbol" aria-hidden="true">◉</span><span>אזורי אקלים<small>החלוקה לאזורים בעולם</small></span></button></div><div id="climateDetail"></div></div>
    <div class="control-section"><h3>מוסיפים למפה</h3><div id="currentsControl"></div><button id="openCurrents" class="inline-link" hidden>בחירת זרם והסבר ←</button></div>
    <div id="monthControl" class="control-section" hidden><h3>חודש להשוואה</h3><div id="monthSlot"></div><p class="control-hint">עברו בין ינואר ליולי והשוו את הדפוסים.</p></div>
    <details class="display-settings"><summary>סימונים במפה</summary><div id="displaySlot"></div></details>
    <p class="control-hint">שכבת צבע אחת בכל פעם. אפשר להוסיף זרמי ים לכל שכבה.</p>
   </section>
   <section id="dockLegend" class="dock-pane" role="tabpanel" aria-labelledby="tabLegend" hidden><div class="legend-actions"><h3>צבעי המפה</h3></div><p id="legendHint" class="control-hint">לחצו על צבע כדי להבליט את האזור ולקרוא עליו.</p></section>
   <section id="dockInfo" class="dock-pane" role="tabpanel" aria-labelledby="tabInfo" hidden><div id="infoChoices" class="info-choices" role="group" aria-label="סוג המידע" hidden><button id="dataInfo" aria-pressed="true">אקלים ונתונים</button><button id="currentInfo" aria-pressed="false">זרמי ים</button></div><div id="dataInfoPanel"></div><div id="currentInfoPanel" hidden></div></section>
  </div><div class="drawer-bottom"><button id="applyDrawer">הצגת המפה ←</button></div>`);
 drawer.id='mapDrawer';drawer.setAttribute('aria-labelledby','drawerTitle');workspace.prepend(drawer);
 q('#dataInfoPanel').append(q('.explorer'));
 q('#currentInfoPanel').append(q('#currentLegend'));
 q('#dockLegend').append(q('.legend'),q('#fieldLegend'));
 q('.legend-actions').append(q('#clear'));
 q('#climateDetail').append(q('.detail-bar'));
 const temp=q('[data-field="temperature"]'), rain=q('[data-field="precipitation"]');
 temp.innerHTML='<span class="layer-symbol temperature-symbol" aria-hidden="true">°C</span><span>טמפרטורות<small>ממוצע חודשי</small></span>';
 rain.innerHTML='<span class="layer-symbol rain-symbol" aria-hidden="true">◌</span><span>משקעים<small>כמות חודשית ממוצעת</small></span>';
 q('#baseLayers').append(temp,rain);
 q('#currentsControl').append(q('#currentsToggle'));
 q('#monthSlot').append(q('.month-buttons'));
 q('#displaySlot').append(q('.map-options'),q('#currentLabelsToggle'));
 const status=q('#layerStatus');status.classList.add('load-status');
 q('.layer-controls').remove();
 q('.intro').remove();
 const head=q('.map-head');head.querySelector('.eyebrow').textContent='מבט על העולם';
 const open=make('button','drawer-toggle','<span aria-hidden="true">☷</span> שכבות ומקרא');open.id='openDrawer';open.setAttribute('aria-controls','mapDrawer');open.setAttribute('aria-expanded','false');head.append(open);
 head.after(status);
 const foot=q('.map-foot');
 foot.querySelector(':scope > span:last-child')?.remove();
 const tools=q('.map-tools');foot.append(tools);
 q('#resetView').textContent='איפוס';q('#resetView').title='חזרה למפת העולם';
 q('#zoomIn').title='הגדלה';q('#zoomOut').title='הקטנה';
 const note=q('#mapNote');note.className='map-guidance';foot.firstElementChild.after(note);
 const key=make('div','map-key','<div id="compactLegend"></div><button id="openLegend" class="key-link">מקרא מלא ←</button>');mapSection.append(key);
 const readoutButton=make('button','selection-info','מידע על הבחירה ←');readoutButton.id='openInfo';foot.prepend(readoutButton);
 const options=make('details','header-menu','<summary>אפשרויות <span aria-hidden="true">⌄</span></summary><div class="header-menu-items"></div>');
 const actions=q('.header-actions');options.querySelector('div').append(...actions.children);actions.append(options);
 q('#sources').textContent='מקורות ומידע';
 let dock='layers',info='data',lastSelection=0,lastCurrent='',lastPoint=null;
 let focusReturn=null;
 function showTab(name,focus=false){
  dock=name;
  drawer.querySelectorAll('[data-dock]').forEach(b=>{const on=b.dataset.dock===name;b.setAttribute('aria-selected',on);b.tabIndex=on?0:-1;if(on&&focus)b.focus();});
  ['layers','legend','info'].forEach(n=>q('#dock'+n[0].toUpperCase()+n.slice(1)).hidden=n!==name);
  q('.drawer-scroll').scrollTop=0;
 }
 function syncOpen(){workspace.classList.toggle('drawer-open',drawer.open&&!narrow.matches);open.setAttribute('aria-expanded',drawer.open);if(ready)requestAnimationFrame(draw);}
 function openDrawer(name=dock){
  showTab(name);if(!drawer.open){focusReturn=document.activeElement;narrow.matches?drawer.showModal():drawer.show();}
  syncOpen();q('[data-dock="'+name+'"]').focus({preventScroll:true});
 }
 function closeDrawer(){drawer.close();syncOpen();if(focusReturn?.isConnected)focusReturn.focus({preventScroll:true});else open.focus({preventScroll:true});}
 function showInfo(which='data',openIt=true){info=which;syncInfo();if(openIt)openDrawer('info');}
 function syncInfo(){
  if(!climateLayers.settings.currents)info='data';
  q('#infoChoices').hidden=!climateLayers.settings.currents;
  q('#dataInfoPanel').hidden=info!=='data';q('#currentInfoPanel').hidden=info!=='current';
  q('#dataInfo').setAttribute('aria-pressed',info==='data');q('#currentInfo').setAttribute('aria-pressed',info==='current');
 }
 function sync(){
  const s=climateLayers.settings;
  q('#climateBase').setAttribute('aria-pressed',!s.field);
  q('#climateDetail').hidden=!!s.field;q('#monthControl').hidden=!s.field&&!s.currents;
  q('#openCurrents').hidden=!s.currents;q('#currentLabelsToggle').hidden=!s.currents;
  q('#legendHint').hidden=!!s.field;q('.legend-actions').hidden=!!s.field;
  readoutButton.hidden=!(s.field||s.current||state.selected||state.tab!=='explore');
  const compact=q('#compactLegend');
  if(s.field){
   const legend=q('#fieldLegend');compact.innerHTML='<div class="compact-field"><div class="scale-caption">'+(s.field==='temperature'?'מעלות צלזיוס <bdi>°C</bdi>':'מ״מ לחודש')+' · ממוצע <bdi>1991–2020</bdi></div>'+legend.querySelector('.field-gradient').outerHTML+legend.querySelector('.field-ticks').outerHTML+'</div>';
   compact.setAttribute('aria-label',legend.querySelector('h3').textContent);
  }else{
   compact.innerHTML='<div class="compact-climate">'+activeItems().map(r=>'<button data-key-region="'+r.id+'" title="'+r.name+'" aria-label="'+r.name+'" aria-pressed="'+highlighted().includes(r.id)+'">'+swatch(r)+'<span>'+r.short+'</span></button>').join('')+'</div>';
   compact.setAttribute('aria-label','מקרא צבעי האקלים');
  }
  let currentKey=q('#compactCurrents');
  if(s.currents){if(!currentKey){currentKey=make('div','compact-currents');currentKey.id='compactCurrents';key.after(currentKey);}currentKey.innerHTML=q('.current-key').innerHTML+'<span class="current-map-caption">זרמי ים · תרשים סכמטי · '+(s.month===1?'ינואר':'יולי')+'</span>';}else currentKey?.remove();
  syncInfo();
 }
 open.onclick=()=>drawer.open?closeDrawer():openDrawer();
 q('#closeDrawer').onclick=closeDrawer;q('#applyDrawer').onclick=closeDrawer;
 q('#openLegend').onclick=()=>openDrawer('legend');readoutButton.onclick=()=>showInfo(climateLayers.settings.current?'current':'data');
 q('#openCurrents').onclick=()=>showInfo('current');
 q('#dataInfo').onclick=()=>showInfo('data',false);q('#currentInfo').onclick=()=>showInfo('current',false);
 q('#climateBase').onclick=()=>{climateLayers.clearField();render();};
 drawer.querySelectorAll('[data-dock]').forEach(b=>b.onclick=()=>showTab(b.dataset.dock));
 drawer.querySelector('.drawer-tabs').onkeydown=e=>{
  const tabs=[...drawer.querySelectorAll('[data-dock]')],i=tabs.indexOf(document.activeElement);if(i<0)return;
  let next;if(e.key==='ArrowLeft')next=(i+1)%3;else if(e.key==='ArrowRight')next=(i+2)%3;else if(e.key==='Home')next=0;else if(e.key==='End')next=2;else return;
  e.preventDefault();showTab(tabs[next].dataset.dock,true);
 };
 drawer.addEventListener('close',syncOpen);
 drawer.addEventListener('cancel',e=>{e.preventDefault();closeDrawer();});
 drawer.addEventListener('keydown',e=>{
  if(e.key!=='Tab'||!narrow.matches)return;
  const stops=[...drawer.querySelectorAll('button,a[href],input,select,textarea,summary,[tabindex]')].filter(el=>el.tabIndex>=0&&!el.disabled&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
  const first=stops[0],last=stops.at(-1);if(!first)return;
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
 });
 drawer.addEventListener('click',e=>{if(e.target===drawer&&narrow.matches){const r=drawer.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDrawer();}});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&drawer.open&&!narrow.matches&&!q('#sourceDialog').open){e.preventDefault();closeDrawer();}});
 document.addEventListener('click',e=>{
  if(!options.contains(e.target))options.open=false;
  if(e.target.closest('.header-menu-items button'))options.open=false;
  const chip=e.target.closest('[data-key-region]');if(chip){select(Number(chip.dataset.keyRegion));showInfo();}
 });
 q('#legendItems').addEventListener('click',e=>{if(e.target.closest('[data-region]'))queueMicrotask(()=>showInfo());},true);
 q('#map').addEventListener('pointerdown',()=>{lastSelection=state.selected;lastCurrent=climateLayers.settings.current;lastPoint=climateLayers.settings.point;});
 q('#map').addEventListener('pointerup',()=>{const s=climateLayers.settings;if(s.current&&s.current!==lastCurrent)showInfo('current');else if(state.selected!==lastSelection||s.point!==lastPoint)showInfo('data');});
 q('#project').addEventListener('click',()=>{if(document.body.classList.contains('projection')&&drawer.open)closeDrawer();});
 q('#focusCurrent').addEventListener('click',()=>{if(narrow.matches)closeDrawer();});
 let wasNarrow=narrow.matches;
 // Headless capture can briefly set a 1px viewport; this is not a real layout change.
 narrow.addEventListener('change',()=>{if(innerWidth<240||narrow.matches===wasNarrow)return;wasNarrow=narrow.matches;const wasOpen=drawer.open;if(wasOpen)drawer.close();syncOpen();if(wasOpen&&!narrow.matches)openDrawer();});
 document.addEventListener('atlas:render',sync);
 document.body.classList.add('atlas-ui');sync();
 if(!narrow.matches){drawer.show();syncOpen();document.activeElement?.blur();}
 window.atlasInterface={open:openDrawer,close:closeDrawer,showInfo};
})();
