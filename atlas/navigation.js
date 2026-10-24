'use strict';
/* Optional cartographic context and anchored zoom. Existing layer state is never
 * modified. All map geometry uses the atlas projection and its existing view. */
(() => {
 const q=s=>document.querySelector(s);
 const settings={borders:false,names:true,desert:false};
 const initial={map:structuredClone(state),climate:structuredClone(climateLayers.settings),learning:structuredClone(atlasLearning.settings)};
 const shortcuts=document.createElement('section');shortcuts.className='navigation-shortcuts';
 shortcuts.innerHTML='<h3>תצוגות מהירות</h3><button id="atlasReset" title="כל אזורי האקלים במפת העולם, ללא שכבות נוספות">↺ איפוס מלא</button><button id="desertBelt" aria-pressed="false" aria-describedby="desertBeltNote">אזורי מדבר</button><p id="desertBeltNote" class="control-hint" hidden>המילוי הוורוד מסמן את אזורי האקלים המדברי BWh ו־BWk במפה, ללא ערבות. נכללים גם מדבריות קרים שמחוץ לרצועה הסובטרופית. הסימון נשאר מעל כל שכבה עד לכיבוי המתג או לאיפוס מלא. המילוי משנה את הצבע המוצג; לצבעי הנתונים המקוריים כבו את המתג.</p>';
 q('#dockLayers').prepend(shortcuts);
 const controls=document.createElement('section');controls.className='navigation-controls';
 controls.innerHTML=`<h3>ניווט במפה</h3>
  <div class="navigation-zoom" role="group" aria-label="הגדלה והקטנה של המפה">
   <button id="navZoomOut" aria-label="הקטנת המפה">−</button><output id="navZoomValue" aria-label="שיעור הגדלת המפה">100%</output><button id="navZoomIn" aria-label="הגדלת המפה">+</button>
  </div><button id="navWorld" class="navigation-world">חזרה למפת העולם</button>
  <p class="control-hint">במחשב: גלגלת להגדלה וגרירה לתזוזה. בטלפון: צביטה בשתי אצבעות. במקלדת: מיקוד במפה, ‎+ / − וחצים.</p>
  <button id="bordersToggle" class="navigation-borders" aria-pressed="false" aria-controls="borderOptions">גבולות מדינות</button>
  <div id="borderStatus" class="navigation-status" role="status" hidden></div>
  <div id="borderOptions" class="navigation-options" hidden>
   <label><input id="countryNames" type="checkbox" checked>שמות מדינות בהגדלה</label>
   <p><span class="navigation-line"></span>גבול יבשתי <span class="navigation-line disputed"></span>קו מחלוקת או הפסקת אש</p>
   <p>השמות מופיעים לפי המקום הפנוי, מהגדלה של 220%. קווי החוף מוצגים במפה הקיימת.</p>
   <details><summary>מקור הגבולות</summary><p>Natural Earth, קנה מידה 1:50 מיליון. בתצוגת מפה זו בוצעה התאמה מקומית של קווים ושמות באזור ישראל. זהו מידע מוכלל לפי מדיניות המקור, אינו מפת גבולות משפטית או עדכון בזמן אמת. קווי מחלוקת מסומנים בקו מקווקו.</p><p><a href="https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-boundary-lines-2/" target="_blank" rel="noopener">נתוני הגבולות</a> · <a href="https://www.naturalearthdata.com/about/disputed-boundaries-policy/" target="_blank" rel="noopener">מדיניות התיחום</a> · <a href="data/boundaries/countries.json" target="_blank" rel="noopener">פרטי הנתונים והגרסה</a></p></details>
  </div>`;
 q('#dockLayers .display-settings').before(controls);
 const borderControls=document.createElement('div');borderControls.id='bordersControl';borderControls.className='navigation-overlay';
 borderControls.append(q('#bordersToggle'),q('#borderStatus'),q('#borderOptions'));
 q('#currentsControl').after(borderControls);
 let data=null,pending=null,error='',labelBoxes=[],desertRaster=null;
 const desertActive=()=>settings.desert;
 const desertKey=document.createElement('div');desertKey.id='desertMapKey';desertKey.className='desert-map-key';desertKey.hidden=true;
 desertKey.innerHTML='<span class="desert-swatch" aria-hidden="true"></span><span>אזורי מדבר · מילוי ורוד בולט</span>';
 q('.map-key').after(desertKey);
 function sync(){
  q('#navZoomIn').disabled=state.zoom>=6;q('#navZoomOut').disabled=state.zoom<=1;
  q('#navZoomValue').value=Math.round(state.zoom*100)+'%';
  q('#desertBelt').setAttribute('aria-pressed',desertActive());q('#desertBeltNote').hidden=!desertActive();desertKey.hidden=!desertActive();
  q('#bordersToggle').setAttribute('aria-pressed',settings.borders);
  q('#borderOptions').hidden=!settings.borders;
  const status=q('#borderStatus');status.hidden=!settings.borders||(!pending&&!error);
  status.replaceChildren();
  if(error){status.append(document.createTextNode('גבולות המדינות לא נטענו. שאר השכבות זמינות.'));const b=document.createElement('button');b.textContent='ניסיון נוסף';b.id='retryBorders';b.onclick=loadData;status.append(b);}
  else if(pending)status.textContent='טוען גבולות מדינות…';
 }
 async function loadData(){
  if(data||pending)return pending;error='';
  pending=(async()=>{
   const response=await fetch('data/boundaries/countries.json?v=20261024-1');if(!response.ok)throw Error('Boundary HTTP '+response.status);
   const value=await response.json();
   if(value.type!=='FeatureCollection'||!Array.isArray(value.features)||!value.features.length||!Array.isArray(value.labels))throw Error('Invalid boundary data');
   for(const f of value.features)if(!['LineString','MultiLineString'].includes(f.geometry?.type)||!['boundary','disputed','other'].includes(f.properties?.kind))throw Error('Invalid boundary feature');
   // Display-only customization: Gaza/West Bank internal lines and the
   // western Golan claim line. Keep all surrounding outer boundary segments.
   const omittedLines=new Set(['land:1746705323','land:1746709121','disputed:1746705871']);
   value.features=value.features.filter(f=>!omittedLines.has(f.properties.sourceLayer+':'+f.properties.id));
   value.labels=value.labels.filter(p=>p.code!=='PS');
   let display=null;try{display=new Intl.DisplayNames(['he'],{type:'region'});}catch{}
   value.labels=value.labels.map(p=>({...p,name:display&&/^[A-Z]{2}$/.test(p.code)?display.of(p.code)||p.name:p.name}));
   data=value;
  })().catch(()=>{error='load';}).finally(()=>{pending=null;sync();draw();});
  sync();return pending;
 }
 function drawDesert(){
  if(!desertActive())return;
  if(!desertRaster){
   desertRaster=document.createElement('canvas');desertRaster.width=W;desertRaster.height=H;
   const c=desertRaster.getContext('2d'),im=c.createImageData(W,H);
   const isDesert=i=>grid[i]===4||grid[i]===5;
   // Fill every existing desert cell with a prominent translucent color.
   // Oceans and steppe cells remain transparent; map values are unchanged.
   for(let i=0;i<grid.length;i++){
    if(!isDesert(i))continue;const k=i*4,x=i%W,y=Math.floor(i/W);
    const edge=x===0||x===W-1||y===0||y===H-1||!isDesert(i-1)||!isDesert(i+1)||!isDesert(i-W)||!isDesert(i+W);
    im.data[k]=edge?118:224;im.data[k+1]=0;im.data[k+2]=edge?76:156;im.data[k+3]=edge?255:190;
   }
   c.putImageData(im,0,0);
  }
  ctx.drawImage(desertRaster,0,0);
 }
 function stopLearning(){
  q('#orographicReset').click();
  Object.assign(atlasLearning.settings,{atmosphere:false,solar:false,terrain:false,inspect:false});
 }
 function fullReset(){
  stopLearning();Object.assign(state,structuredClone(initial.map));Object.assign(climateLayers.settings,structuredClone(initial.climate));Object.assign(atlasLearning.settings,structuredClone(initial.learning));
  Object.assign(settings,{borders:false,names:true,desert:false});q('#countryNames').checked=true;
  q('#learningPlace').value='0';q('#terrainOpacity').value='65';q('#orographicMoist').checked=true;
  if(document.body.classList.contains('large'))q('#fontSize').click();if(document.body.classList.contains('projection'))q('#project').click();
  pointers.clear();pinch=null;gesture=false;drag=null;q('#tooltip').hidden=true;
  render();atlasInterface.open('layers');if(innerWidth<=900)atlasInterface.close();
  q('#mapTitle').scrollIntoView({block:'nearest'});
 }
 function showDeserts(enabled=true){
  settings.desert=Boolean(enabled);sync();draw();
 }
 function drawBorders(){
  if(!settings.borders||!data)return;
  const path=d3.geoPath(projection,ctx);ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  // A pale casing keeps the thin boundary legible on every climate color.
  for(const kind of ['boundary','other','disputed']){
   const features=data.features.filter(f=>f.properties.kind===kind);if(!features.length)continue;
   const dashed=kind!=='boundary';ctx.setLineDash(dashed?[4/view.s,3/view.s]:[]);
   ctx.beginPath();path({type:'FeatureCollection',features});ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=2.5/view.s;ctx.stroke();
   ctx.strokeStyle=kind==='disputed'?'#674c60':'#38445a';ctx.lineWidth=1/view.s;ctx.stroke();
  }
  ctx.restore();
 }
 const overlaps=(a,b)=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];
 function drawNames(){
  labelBoxes=[];if(!settings.borders||!settings.names||!data||state.zoom<2.2)return;
  ctx.save();const fontSize=12*atlasTextScale();
  ctx.font='600 '+fontSize/view.s+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.direction='rtl';ctx.lineJoin='round';
  const taken=[];
  // Reserve existing continent captions and the visible latitude edge labels.
  if(state.labels)for(const [lon,lat] of [[-104,47],[-60,-16],[20,51],[21,4],[92,44],[135,-26],[0,-80]]){
   const p=projection([lon,lat]),x=p[0]*view.s+view.x,y=p[1]*view.s+view.y;taken.push([x-58,y-11,x+58,y+11]);
  }
  if(state.latitudes)for(const line of latitudeLines){const y=projection([0,line.lat])[1]*view.s+view.y;const labelMargin=(line.subtitle?26:16)*atlasTextScale();if(y<labelMargin||y>cssH-labelMargin)continue;const width=(cssW<600?150:205)*atlasTextScale();const bottom=y+(line.subtitle?34:15)*atlasTextScale();taken.push([0,y-15,width,bottom],[cssW-width,y-15,cssW,bottom]);}
  for(const label of data.labels){
   if(!label.name||!Number.isFinite(label.lon)||!Number.isFinite(label.lat))continue;
   const p=projection([label.lon,label.lat]);if(!p)continue;
   const x=p[0]*view.s+view.x,y=p[1]*view.s+view.y,w=ctx.measureText(label.name).width*view.s;
   const b=[x-w/2-4,y-fontSize/2-4,x+w/2+4,y+fontSize/2+4];
   if(b[0]<5||b[2]>cssW-5||b[1]<5||b[3]>cssH-5||taken.some(a=>overlaps(a,b)))continue;
   taken.push(b);labelBoxes.push({name:label.name,code:label.code,box:b});
   ctx.strokeStyle='rgba(255,255,255,.96)';ctx.lineWidth=3.5/view.s;ctx.strokeText(label.name,...p);ctx.fillStyle='#243747';ctx.fillText(label.name,...p);
  }
  ctx.restore();
 }
 function zoomAt(factor,clientX,clientY){
  if(!ready||!Number.isFinite(factor)||factor<=0)return;
  const rect=canvas.getBoundingClientRect(),x=clientX===undefined?rect.width/2:clientX-rect.left,y=clientY===undefined?rect.height/2:clientY-rect.top;
  const next=Math.min(6,Math.max(1,state.zoom*factor));if(next===state.zoom)return;
  const mapX=(x-view.x)/view.s,mapY=(y-view.y)/view.s,s=view.s*next/state.zoom;
  state.zoom=next;state.panX=x-mapX*s-(rect.width-W*s)/2;state.panY=y-mapY*s-(rect.height-H*s)/2;
  q('#tooltip').hidden=true;draw();
 }
 q('#navZoomIn').onclick=()=>zoomAt(1.3);q('#navZoomOut').onclick=()=>zoomAt(1/1.3);q('#navWorld').onclick=()=>reset();
 q('#atlasReset').onclick=fullReset;q('#desertBelt').onclick=()=>showDeserts(!settings.desert);
 q('#bordersToggle').onclick=()=>{settings.borders=!settings.borders;if(settings.borders)loadData();sync();draw();};
 q('#countryNames').onchange=e=>{settings.names=e.target.checked;draw();};
 canvas.addEventListener('wheel',e=>{
  if(!ready)return;e.preventDefault();const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?cssH:1);
  zoomAt(Math.exp(-Math.max(-160,Math.min(160,delta))*.0025),e.clientX,e.clientY);
 },{passive:false});
 // Capture only multi-touch gestures. Existing single-pointer drag and click
 // handlers, climate selection, current selection and teaching inspection stay intact.
 const pointers=new Map();let pinch=null,gesture=false;
 function pinchState(){
  const p=[...pointers.values()];if(p.length<2)return null;
  const rect=canvas.getBoundingClientRect(),cx=(p[0].x+p[1].x)/2,cy=(p[0].y+p[1].y)/2;
  return {distance:Math.max(1,Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)),cx,cy,mapX:(cx-rect.left-view.x)/view.s,mapY:(cy-rect.top-view.y)/view.s,zoom:state.zoom,s:view.s};
 }
 function stop(e){e.preventDefault();e.stopImmediatePropagation();q('#tooltip').hidden=true;}
 canvas.addEventListener('pointerdown',e=>{
  if(e.pointerType!=='touch')return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size>=2){gesture=true;drag=null;canvas.setPointerCapture(e.pointerId);pinch=pinchState();stop(e);}
 },{capture:true});
 canvas.addEventListener('pointermove',e=>{
  if(e.pointerType!=='touch'||!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(!gesture)return;
  if(pinch&&pointers.size>=2){
   const now=pinchState(),rect=canvas.getBoundingClientRect();state.zoom=Math.min(6,Math.max(1,pinch.zoom*now.distance/pinch.distance));const s=pinch.s*state.zoom/pinch.zoom;
   state.panX=now.cx-rect.left-pinch.mapX*s-(rect.width-W*s)/2;state.panY=now.cy-rect.top-pinch.mapY*s-(rect.height-H*s)/2;draw();stop(e);
  }
 },{capture:true});
 function endPointer(e){
  if(e.pointerType!=='touch')return;pointers.delete(e.pointerId);if(!gesture)return;stop(e);drag=null;
  if(pointers.size>=2)pinch=pinchState();
  else if(pointers.size===1){pinch=null;const p=[...pointers.values()][0];drag={x:p.x,y:p.y,px:state.panX,py:state.panY,moved:true};}
  else {pinch=null;gesture=false;}
 }
 canvas.addEventListener('pointerup',endPointer,{capture:true});canvas.addEventListener('pointercancel',endPointer,{capture:true});
 canvas.addEventListener('lostpointercapture',e=>{if(pointers.has(e.pointerId))endPointer(e);},{capture:true});
 window.addEventListener('blur',()=>{pointers.clear();pinch=null;gesture=false;drag=null;});
 window.atlasNavigation={settings,drawBorders,drawNames,drawDesert,sync,zoomAt,reset:fullReset,showDeserts,ready:()=>!!data,labels:()=>labelBoxes.map(l=>({...l,box:[...l.box]}))};
 sync();if(ready)draw();
})();
