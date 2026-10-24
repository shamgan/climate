'use strict';
/* Real monthly city climatologies, separate from the existing field datasets. */
(() => {
 const q=s=>document.querySelector(s),months=['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
 // Relocate the existing shortcut and its existing explanation, without changing its action.
 q('#currentsControl').after(q('#desertBelt'));q('#desertBelt').after(q('#desertBeltNote'));
 const card=document.createElement('section');card.className='city-card';card.id='cityCard';
 const marker=document.createElement('div');marker.className='city-marker';marker.id='cityMarker';marker.hidden=true;marker.setAttribute('role','img');
 const markerLabel=document.createElement('div');markerLabel.className='city-map-label';markerLabel.id='cityMapLabel';markerLabel.hidden=true;
 q('#mapStage').append(marker,markerLabel);
 const dialog=document.createElement('dialog');dialog.className='city-chart-dialog';dialog.id='cityChartDialog';dialog.setAttribute('aria-labelledby','cityDialogTitle');
 dialog.innerHTML='<div class="dialog-top"><h2 id="cityDialogTitle">קלימוגרף</h2><button id="closeCityChart" aria-label="סגירת הקלימוגרף">×</button></div><div class="city-card" id="cityDialogContent"></div>';document.body.append(dialog);
 let data=null,pending=null,error='',graphMonth=0,selectedId='',lastMapMonth=1;
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=(n,d=1)=>Number(n).toLocaleString('he-IL',{minimumFractionDigits:d,maximumFractionDigits:d});
 function currentCity(){const p=climateLayers.settings.point;return data&&p?data.cities.find(c=>Math.abs(c.lon-p[0])<.00001&&Math.abs(c.lat-p[1])<.00001)||null:null;}
 function options(){return '<option value="">בחרו עיר לדוגמה</option>'+data.cities.map((c,i)=>'<option value="'+i+'">'+escape(c.name)+' · '+escape(c.country)+'</option>').join('');}
 function bindSelect(select){
  if(!select||!data)return;select.innerHTML=options();const c=currentCity();select.value=c?String(data.cities.indexOf(c)):'';
  select.onchange=e=>{if(e.target.value===''){climateLayers.settings.point=null;render();return;}const city=data.cities[Number(e.target.value)];if(!city)return;climateLayers.settings.point=[city.lon,city.lat];graphMonth=climateLayers.settings.month-1;bringIntoView(city,false);render();};
 }
 async function load(){
  if(data||pending)return pending;error='';
  pending=(async()=>{
   const r=await fetch('data/cities/climatology.json?v=20261024-1');if(!r.ok)throw Error('City climatology HTTP '+r.status);const d=await r.json();
   if(d.period!=='1991-2020'||!Array.isArray(d.cities)||d.cities.length<9)throw Error('Invalid city climatology');
   for(const c of d.cities){if(!c.id||!Number.isFinite(c.lon)||!Number.isFinite(c.lat)||!Array.isArray(c.temperature)||!Array.isArray(c.precipitation)||c.temperature.length!==12||c.precipitation.length!==12||!c.temperature.every(Number.isFinite)||!c.precipitation.every(v=>Number.isFinite(v)&&v>=0))throw Error('Incomplete city data');}
   data=d;
  })().catch(()=>{error='נתוני הערים לא נטענו. שאר המפה ממשיכה לפעול.';}).finally(()=>{pending=null;sync();draw();});
  sync();return pending;
 }
 function chart(city,prefix){
  const scale=atlasTextScale(),large=scale>1,w=large?420:360,h=large?360:300,left=47,right=47,top=large?46:30,bottom=large?75:43,pw=w-left-right,ph=h-top-bottom;
  const minT=Math.min(0,Math.floor((Math.min(...city.temperature)-2)/10)*10),maxT=Math.max(30,Math.ceil((Math.max(...city.temperature)+2)/10)*10);
  const maxP=Math.max(...city.precipitation),stepP=maxP<=10?2:maxP<=40?10:maxP<=100?25:maxP<=200?50:maxP<=400?100:200,pMax=Math.max(stepP*4,Math.ceil(maxP/stepP)*stepP);
  const yP=v=>top+ph-v/pMax*ph,yT=v=>top+ph-(v-minT)/(maxT-minT)*ph,x=i=>left+(i+.5)*pw/12;
  let svg='<svg class="city-graph" viewBox="0 0 '+w+' '+h+'" xmlns="http://www.w3.org/2000/svg" role="group" aria-labelledby="'+prefix+'Title '+prefix+'Desc"><title id="'+prefix+'Title">קלימוגרף '+escape(city.name)+'</title><desc id="'+prefix+'Desc">ממוצעי 1991 עד 2020. חודשים מינואר עד דצמבר, משמאל לימין. עמודות כחולות מציגות משקעים במילימטרים, קו אדום מציג טמפרטורה במעלות צלזיוס. הצירים מותאמים לעיר.</desc><rect x="'+left+'" y="'+top+'" width="'+pw+'" height="'+ph+'" fill="#fff"/>';
  svg+='<g font-family="Arial,sans-serif" font-size="'+14*scale*w/360+'"><text x="'+left+'" y="'+(large?23:17)+'" text-anchor="middle" fill="#1b6c9b">mm</text><text x="'+(w-right)+'" y="'+(large?23:17)+'" text-anchor="middle" fill="#b02730">°C</text>';
  for(let v=0;v<=pMax;v+=stepP){const y=yP(v);svg+='<path d="M'+left+' '+y+'H'+(w-right)+'" stroke="#dfe7e1" stroke-width="1"/><text x="'+(left-7)+'" y="'+(y+4)+'" text-anchor="end" fill="#1b6c9b">'+v+'</text>';}
  for(let v=minT;v<=maxT;v+=10){const y=yT(v);svg+='<path d="M'+(w-right)+' '+y+'h4" stroke="#b02730"/><text x="'+(w-right+7)+'" y="'+(y+4)+'" text-anchor="start" fill="#b02730">'+v+'</text>';}
  for(let i=0;i<12;i++){const p=city.precipitation[i],y=yP(p);svg+='<rect data-rain-month="'+(i+1)+'" x="'+(x(i)-pw/12*.34)+'" y="'+y+'" width="'+(pw/12*.68)+'" height="'+Math.max(0,top+ph-y)+'" rx="1" fill="#247caf"/><text x="'+x(i)+'" y="'+(top+ph+20)+'" text-anchor="middle" fill="#334e51">'+(i+1)+'</text>';}
  svg+='<path d="'+city.temperature.map((v,i)=>(i?'L':'M')+x(i)+' '+yT(v)).join(' ')+'" stroke="#c52f36" stroke-width="3" stroke-linejoin="round" fill="none"/>';
  for(let i=0;i<12;i++)svg+='<circle data-temperature-month="'+(i+1)+'" cx="'+x(i)+'" cy="'+yT(city.temperature[i])+'" r="3" fill="#c52f36" stroke="#fff" stroke-width="1"/>';
  svg+='<path d="M'+left+' '+top+'V'+(top+ph)+'H'+(w-right)+'V'+top+'" stroke="#7c9591" fill="none"/><text x="'+w/2+'" y="'+(large?h-10:h-4)+'" text-anchor="middle" fill="#536c6c" direction="rtl">חודש בשנה: 1 = ינואר, 12 = דצמבר</text>';
  for(let i=0;i<12;i++)svg+='<rect class="city-month-target" data-city-month="'+i+'" x="'+(left+i*pw/12)+'" y="'+top+'" width="'+pw/12+'" height="'+ph+'" fill="transparent" tabindex="0" role="button" aria-label="'+months[i]+': '+fmt(city.temperature[i])+' מעלות צלזיוס, '+fmt(city.precipitation[i])+' מילימטר משקעים"/>';
  return svg+'</g></svg>';
 }
 function graphBody(city,prefix,expanded=false){
  const total=city.precipitation.reduce((a,b)=>a+b,0),range=Math.max(...city.temperature)-Math.min(...city.temperature);
  return '<h3>'+escape(city.name)+' · '+escape(city.country)+'</h3><p class="city-subtitle">ממוצעי אקלים חודשיים · <bdi>1991–2020</bdi></p><p class="city-subtitle">ממוצע לתא רשת 0.25° בסביבת העיר, לא מדידה בתחנה.</p>'+chart(city,prefix)+'<div class="city-chart-key"><span><i class="city-rain-key"></i>משקעים: מ״מ</span><span><i class="city-temp-key"></i>טמפרטורה: <bdi>°C</bdi></span></div><p class="city-month-readout" aria-live="polite"></p><p class="city-subtitle">סולמות הצירים מותאמים לעיר. השוו ערכים מספריים בין ערים.</p>'+(expanded?'':'<div class="city-actions"><button type="button" id="focusCity">הצגת העיר במפה</button><button type="button" id="expandCityChart">הגדלת התרשים</button></div>')+'<div class="city-summary"><span>משקעים בשנה: <b>'+fmt(total,0)+' מ״מ</b></span><span>משרע טמפרטורות: <b>'+fmt(range)+'°C</b></span></div><details><summary>טבלת הנתונים החודשיים</summary><div class="city-data-wrap"><table class="city-data-table"><caption>'+escape(city.name)+' · ממוצעי 1991–2020</caption><thead><tr><th>חודש</th><th>טמפרטורה <bdi>°C</bdi></th><th>משקעים מ״מ</th></tr></thead><tbody>'+months.map((m,i)=>'<tr><th scope="row">'+m+'</th><td><bdi>'+fmt(city.temperature[i])+'</bdi></td><td><bdi>'+fmt(city.precipitation[i])+'</bdi></td></tr>').join('')+'</tbody></table></div></details><details><summary>מקור הנתונים ואופן החישוב</summary><p>ERA5 דרך פורטל האקלים של הבנק העולמי, 1991–2020. ממוצעים לתא רשת של רבע מעלה, לא מדידה בתחנה בעיר. הטמפרטורה היא בגובה 2 מטרים; המשקעים הם סך חודשי בשווה ערך מים, כולל גשם ושלג.</p><p>נקודת העיר: <bdi>'+city.lat.toFixed(2)+'°, '+city.lon.toFixed(2)+'°</bdi>. תא הנתונים: <bdi>'+city.gridLat.toFixed(2)+'°, '+city.gridLon.toFixed(2)+'°</bdi>.</p><p>משקעים שנתיים: סכום 12 הממוצעים החודשיים. משרע טמפרטורות: ממוצע החודש החם ביותר פחות ממוצע החודש הקר ביותר. ערכי החודשים מעוגלים לעשירית.</p><ul class="city-source-list"><li><a href="https://climateknowledgeportal.worldbank.org/download-data" target="_blank" rel="noopener">מקור הנתונים: World Bank CCKP</a></li><li><a href="data/cities/climatology.json" target="_blank" rel="noopener">נתונים, קישורי המקור ופרטי העיבוד</a></li></ul></details>';
 }
 function monthReadout(){const c=currentCity();if(!c)return;for(const el of document.querySelectorAll('.city-month-readout'))el.innerHTML='<strong>'+months[graphMonth]+'</strong> · <bdi>'+fmt(c.temperature[graphMonth])+'°C</bdi> · <bdi>'+fmt(c.precipitation[graphMonth])+' מ״מ</bdi>';}
 function bindGraph(host){
  for(const name of ['pointerover','focusin','click'])host.addEventListener(name,e=>{const n=e.target.closest('[data-city-month]');if(!n)return;graphMonth=Number(n.dataset.cityMonth);monthReadout();});
  host.addEventListener('keydown',e=>{const n=e.target.closest('[data-city-month]');if(!n)return;const i=Number(n.dataset.cityMonth);let next;if(e.key==='ArrowRight')next=(i+1)%12;else if(e.key==='ArrowLeft')next=(i+11)%12;else if(e.key==='Home')next=0;else if(e.key==='End')next=11;else if(e.key==='Enter'||e.key===' '){e.preventDefault();graphMonth=i;monthReadout();return;}else return;e.preventDefault();host.querySelector('[data-city-month="'+next+'"]').focus();});
 }
 bindGraph(card);bindGraph(q('#cityDialogContent'));
 function sync(){
  const original=q('#panel #sampleLocation'),readout=q('#pointReadout');
  if(original&&readout)readout.after(card);else q('#dataInfoPanel').prepend(card);
  const city=currentCity();if(city?.id!==selectedId){selectedId=city?.id||'';graphMonth=climateLayers.settings.month-1;}
  if(lastMapMonth!==climateLayers.settings.month){lastMapMonth=climateLayers.settings.month;graphMonth=lastMapMonth-1;}
  card.innerHTML=(original?'':'<label for="cityChooser">עיר לדוגמה וקלימוגרף</label><select id="cityChooser"></select>')+'<div class="city-status" role="status"></div>'+(city?graphBody(city,'cityGraph'):'<p class="city-subtitle">בחרו עיר להצגת נקודה אדומה במפה וקלימוגרף של כל חודשי השנה.</p>');
  if(data){bindSelect(original||q('#cityChooser'));card.querySelector('.city-status').hidden=true;}
  else{if(q('#cityChooser')){q('#cityChooser').innerHTML='<option>טוען ערים…</option>';q('#cityChooser').disabled=true;}const status=card.querySelector('.city-status');status.textContent=error||'טוען נתוני ערים…';if(error){const b=document.createElement('button');b.id='retryCities';b.textContent='ניסיון נוסף';b.onclick=load;status.append(b);}}
  if(city){if(original){readout.querySelector(':scope > strong')?.remove();const title=document.createElement('strong');title.textContent=city.name;readout.prepend(title);}q('#focusCity').onclick=()=>{bringIntoView(city,true);if(innerWidth<=900)atlasInterface.close();};q('#expandCityChart').onclick=()=>{q('#cityDialogTitle').textContent='קלימוגרף '+city.name;q('#cityDialogContent').innerHTML=graphBody(city,'cityExpanded',true);monthReadout();dialog.showModal();};}
  if(dialog.open){if(city){q('#cityDialogTitle').textContent='קלימוגרף '+city.name;q('#cityDialogContent').innerHTML=graphBody(city,'cityExpanded',true);}else dialog.close();}
  monthReadout();drawMarker();
 }
 function bringIntoView(city,force){
  if(!ready)return;const p=projection([city.lon,city.lat]),x=view.x+p[0]*view.s,y=view.y+p[1]*view.s;
  if(force||x<22||x>cssW-22||y<22||y>cssH-22){state.framing='manual';state.panX=(W/2-p[0])*view.s;state.panY=(H/2-p[1])*view.s;draw();}
 }
 function drawMarker(){
  const city=currentCity();marker.hidden=markerLabel.hidden=!city||!ready;if(marker.hidden)return;
  const p=projection([city.lon,city.lat]),x=view.x+p[0]*view.s,y=view.y+p[1]*view.s;
  if(x<0||x>cssW||y<0||y>cssH){marker.hidden=markerLabel.hidden=true;return;}
  marker.style.left=x+'px';marker.style.top=y+'px';marker.setAttribute('aria-label','מיקום '+city.name);markerLabel.textContent=city.name;
  const width=markerLabel.offsetWidth,height=markerLabel.offsetHeight,bounds=canvas.getBoundingClientRect();
  const blocked=[...document.querySelectorAll('.latitude-label,.current-map-label')].filter(el=>el.getClientRects().length).map(el=>{const r=el.getBoundingClientRect();return [r.left-bounds.left,r.top-bounds.top,r.right-bounds.left,r.bottom-bounds.top];});
  const candidates=[[x+16,y-height/2],[x-width-16,y-height/2],[x-width/2,y-height-17],[x-width/2,y+17]];
  const place=candidates.find(([a,b])=>a>=3&&a+width<cssW-3&&b>=3&&b+height<cssH-3&&!blocked.some(r=>a<r[2]&&a+width>r[0]&&b<r[3]&&b+height>r[1]))||[Math.max(3,Math.min(cssW-width-3,x-width/2)),Math.max(3,Math.min(cssH-height-3,y+17))];
  markerLabel.style.left=place[0]+'px';markerLabel.style.top=place[1]+'px';
 }
 q('#closeCityChart').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
 dialog.addEventListener('keydown',e=>{if(e.key==='Escape')e.stopPropagation();});
 document.addEventListener('atlas:render',sync);
 window.atlasCities={ready:()=>!!data,currentCity,drawMarker,select(id){const c=data?.cities.find(c=>c.id===id);if(!c)return false;climateLayers.settings.point=[c.lon,c.lat];bringIntoView(c,false);render();return true;},data:()=>data};
 sync();load();
})();
