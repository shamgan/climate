'use strict';
/* Monthly NOAA climate normals and independently drawn schematic major currents. */
function createClimateLayers({getMap,refresh,focus}) {
 const $=s=>document.querySelector(s);
 const settings={field:null,month:1,currents:false,current:'',point:null,currentLabels:true,currentBasin:'all',currentType:'all'};
 const months={1:'ינואר',7:'יולי'};
 const fields={
  temperature:{name:'ממוצע טמפרטורות',unit:'°C',description:'טמפרטורת האוויר בגובה 2 מטרים',ticks:[-65,-40,-20,0,10,20,30,40],colors:['#36205b','#5055a0','#4d9dcc','#e6f2f0','#f9e49b','#eead60','#d95e3d','#9a1830']},
  precipitation:{name:'ממוצע משקעים',unit:'מ״מ לחודש',description:'כמות המשקעים החודשית הממוצעת',ticks:[0,25,50,100,200,400,600,900],colors:['#fff4d5','#e3e7b1','#accf9f','#69b7aa','#369ab6','#386caa','#514789','#35204f']}
 };
 const cities=[['ירושלים',35.2,31.8],['לונדון',-.1,51.5],['קהיר',31.2,30],['מומבאי',72.9,19.1],['מנאוס',-60,-3.1],['סידני',151.2,-33.9],['ניו יורק',-74,40.7],['קייפטאון',18.4,-33.9]];
 const currents=[
  ['gulf','זרם הגולף','warm',[[-80,25],[-78,30],[-73,35],[-62,40],[-48,43]]],
  ['atlantic','הזרם הצפון אטלנטי','warm',[[-46,44],[-33,48],[-20,53],[-10,58]]],
  ['norway','זרם נורווגיה','warm',[[-8,59],[1,63],[8,68],[15,72]]],
  ['canary','זרם קנריה','cold',[[-14,34],[-18,28],[-21,21],[-23,15]]],
  ['labrador','זרם לברדור','cold',[[-58,59],[-57,54],[-51,48],[-49,44]]],
  ['greenland','זרם מזרח גרינלנד','cold',[[-8,77],[-17,72],[-24,67],[-38,61]]],
  ['brazil','זרם ברזיל','warm',[[-33,-8],[-36,-16],[-39,-22],[-45,-28],[-49,-34]]],
  ['benguela','זרם בנגואלה','cold',[[15,-34],[11,-28],[10,-21],[10,-15]]],
  ['falkland','זרם פוקלנד (מלווינס)','cold',[[-61,-53],[-60,-47],[-57,-41],[-53,-37]]],
  ['kuroshio','זרם קורושיו','warm',[[123,20],[126,26],[131,30],[139,33],[148,36]]],
  ['oyashio','זרם אויאשיו','cold',[[161,56],[156,49],[149,43],[145,38]]],
  ['california','זרם קליפורניה','cold',[[-129,46],[-127,39],[-124,32],[-117,25]]],
  ['alaska','זרם אלסקה','warm',[[-140,49],[-135,54],[-142,58],[-152,57]]],
  ['peru','זרם פרו (הומבולדט)','cold',[[-77,-44],[-78,-34],[-76,-24],[-80,-13],[-84,-4]]],
  ['australia','זרם מזרח אוסטרליה','warm',[[152,-17],[155,-24],[155,-32],[152,-38]]],
  ['west-australia','זרם מערב אוסטרליה','cold',[[109,-36],[108,-29],[108,-22],[105,-16]]],
  ['agulhas','זרם אגולהס','warm',[[38,-23],[35,-29],[29,-35],[22,-38],[25,-41],[39,-40]]],
  ['north-equatorial-atlantic','הזרם המשווני הצפוני, אטלנטי','warm',[[-25,13],[-37,12],[-50,12],[-60,14]]],
  ['south-equatorial-atlantic','הזרם המשווני הדרומי, אטלנטי','warm',[[3,-5],[-10,-5],[-22,-6],[-31,-7]]],
  ['north-equatorial-pacific','הזרם המשווני הצפוני, שקט','warm',[[-120,13],[-145,13],[-170,13],[170,13],[145,13],[130,13]]],
  ['south-equatorial-pacific','הזרם המשווני הדרומי, שקט','warm',[[-90,-8],[-115,-8],[-145,-8],[-175,-8],[160,-8]]],
  ['south-equatorial-indian','הזרם המשווני הדרומי, הודי','warm',[[100,-13],[83,-13],[65,-13],[52,-14]]],
  ['circumpolar','הזרם המקיף את אנטארקטיקה','cold',[[-178,-57],[-140,-57],[-100,-57],[-65,-59],[-30,-55],[10,-53],[50,-52],[90,-53],[130,-55],[178,-57]]],
  ['somali','הזרם הסומלי','seasonal',[[44,-1],[47,3],[50,7],[53,11]]],
  ['monsoon','זרם המונסון מדרום להודו','seasonal',[[60,5],[70,5],[79,4],[85,6],[88,10]]]
 ].map(([id,name,type,points])=>({id,name,type,points})).concat(extraAtlasCurrents);
 const currentColors={warm:'#c63532',cold:'#1265ad',seasonal:'#76439c'};
 const currentTypes={warm:'זרם חם',cold:'זרם קר',seasonal:'זרם המשנה כיוון לפי העונה'};
 let data=null,pending=null,error='',rasters=new Map(),currentPaths=[],palettes=new Map();
 const littleEndian=new Uint8Array(new Uint32Array([0x01020304]).buffer)[0]===4;
 const basins={atlantic:'האוקיינוס האטלנטי',pacific:'האוקיינוס השקט',indian:'האוקיינוס ההודי',southern:'האוקיינוס הדרומי'};
 const visibleCurrents=()=>currents.filter(c=>(settings.currentBasin==='all'||currentFacts[c.id][0]===settings.currentBasin)&&(settings.currentType==='all'||c.type===settings.currentType));
 const scales=Object.fromEntries(Object.entries(fields).map(([key,f])=>[key,d3.scaleLinear().domain(f.ticks).range(f.colors).clamp(true)]));
 function currentPoints(c){return c.type==='seasonal'&&settings.month===1?[...c.points].reverse():c.points;}
 function currentExplanation(c){
  if(c.id==='somali')return 'הזרם הסומלי: בינואר מודגם כיוון דרומה; ביולי כיוון צפונה. בקיץ מתרחשת עליית מים קרים מול חופי סומליה.';
  if(c.id==='monsoon')return 'מדרום להודו ולסרי לנקה: בינואר הזרימה מערבה; ביולי מזרחה, בהשפעת חילופי רוחות המונסון.';
  return c.name+' · '+currentTypes[c.type]+'. חם או קר ביחס למים באזור שאליו הוא מגיע.';
 }
 function nearest(values,value,descending=false){
  let lo=0,hi=values.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(descending?values[mid]>value:values[mid]<value)lo=mid+1;else hi=mid;}
  return lo>0&&Math.abs(values[lo-1]-value)<Math.abs(values[lo]-value)?lo-1:lo;
 }
 function cellAt(layer,lon,lat){
  const n=layer.longitudes.length,row=Math.max(0,Math.min(layer.latitudes.length-1,Math.round((layer.latitudes[0]-lat)/.25)));
  const col=((Math.round((lon-layer.longitudes[0])/.25)%n)+n)%n;
  return row*n+col;
 }
 function valueAt(key,month,point){if(!data||!point)return null;const layer=data.layers[key],v=layer.values[month][cellAt(layer,...point)];return v==null||v===65535?null:v*layer.scale+layer.offset;}
 function formatValue(key,v){return v==null?'אין נתון':(key==='temperature'?v.toFixed(1):Math.round(v))+' '+fields[key].unit;}
 function coordinate(point){return '<bdi dir="ltr">'+Math.abs(point[1]).toFixed(1)+'°'+(point[1]<0?'S':'N')+' · '+Math.abs(point[0]).toFixed(1)+'°'+(point[0]<0?'W':'E')+'</bdi>';}
 function validateDataset(d){
  if(d.schemaVersion!==2||d.period!=='1991–2020'||d.gridStepDegrees!==.25)throw Error('Unexpected ERA5 dataset');
  for(const key of Object.keys(fields)){
   const l=d.layers[key];if(!l||l.scale!==.1||![720,721].includes(l.latitudes.length)||l.longitudes.length!==1440)throw Error('Invalid quarter-degree grid');
   if(!l.latitudes.every((v,i,a)=>Number.isFinite(v)&&(!i||Math.abs(v-a[i-1]+.25)<1e-5))||!l.longitudes.every((v,i,a)=>Number.isFinite(v)&&(!i||Math.abs(v-a[i-1]-.25)<1e-5)))throw Error('Invalid coordinates');
   for(const month of [1,7])if(!l.frames[month]?.url)throw Error('Missing monthly frame');
  }
  return d;
 }
 async function loadData(){
  if(data||pending)return pending;error='';
  pending=(async()=>{
   const response=await fetch('data/era5/manifest.json?v=2');if(!response.ok)throw Error('HTTP '+response.status);
   const d=validateDataset(await response.json());
   await Promise.all(Object.keys(fields).flatMap(key=>[1,7].map(async month=>{
    const layer=d.layers[key],frame=layer.frames[month],r=await fetch(frame.url+'?v='+frame.sha256.slice(0,12));if(!r.ok)throw Error('HTTP '+r.status);
    const compressed=await r.arrayBuffer();
    if(compressed.byteLength!==frame.bytes)throw Error('Incomplete climate data');
    if(globalThis.crypto?.subtle){const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',compressed)),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==frame.sha256)throw Error('Climate data checksum mismatch');}
    const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
    const bytes=await new Response(stream).arrayBuffer();if(bytes.byteLength!==layer.latitudes.length*layer.longitudes.length*2)throw Error('Invalid climate data size');
    const values=new Uint16Array(bytes);if(!littleEndian){const dv=new DataView(bytes);for(let i=0;i<values.length;i++)values[i]=dv.getUint16(i*2,true);}
    layer.values??={};layer.values[month]=values;
   })));
   data=d;
  })().catch(e=>{error='לא ניתן לטעון את נתוני השכבה. אפשר לנסות שוב בדפדפן מעודכן.';console.error(e);}).finally(()=>{pending=null;refresh();});
  return pending;
 }
 function palette(){
  if(palettes.has(settings.field))return palettes.get(settings.field);
  const table=new Uint32Array(65536);
  const offset=data.layers[settings.field].offset,max=settings.field==='temperature'?1650:60000;
  for(let v=0;v<=max;v++){const c=d3.color(scales[settings.field](v/10+offset));table[v]=littleEndian?((255<<24)|(c.b<<16)|(c.g<<8)|c.r):((c.r<<24)|(c.g<<16)|(c.b<<8)|255);}
  palettes.set(settings.field,table);return table;
 }
 function raster(){
  const {projection,canvas,view,cssW,cssH}=getMap(),pw=canvas.width,ph=canvas.height,dpr=pw/cssW;
  const key=[settings.field,settings.month,pw,ph,view.s,view.x,view.y].join(':');if(rasters.has(key))return rasters.get(key);
  const out=document.createElement('canvas');out.width=pw;out.height=ph;
  const c=out.getContext('2d'),im=c.createImageData(pw,ph),pixels=new Uint32Array(im.data.buffer),l=data.layers[settings.field],values=l.values[settings.month],colors=palette(),n=l.longitudes.length;
  // Natural Earth 1 is linear in longitude at each latitude. Invert once per screen row.
  const origin=projection([0,0])[0];
  for(let y=0;y<ph;y++){
   const sourceY=((y+.5)/dpr-view.y)/view.s,p=projection.invert([origin,sourceY]);
   if(!p||!Number.isFinite(p[1])||Math.abs(p[1])>90||Math.abs(projection([0,p[1]])[1]-sourceY)>1)continue;
   const half=projection([180,p[1]])[0]-origin,row=Math.max(0,Math.min(l.latitudes.length-1,Math.round((l.latitudes[0]-p[1])/.25))),offset=row*n;
   const left=(view.x+(origin-half)*view.s)*dpr,right=(view.x+(origin+half)*view.s)*dpr;
   const first=Math.max(0,Math.ceil(left-.5)),last=Math.min(pw-1,Math.floor(right-.5)),lonStep=360/(right-left);
   for(let x=first;x<=last;x++){
    const lon=-180+(x+.5-left)*lonStep,col=((Math.round((lon-l.longitudes[0])/.25)%n)+n)%n;
    pixels[y*pw+x]=colors[values[offset+col]];
   }
  }
  c.putImageData(im,0,0);rasters.clear();rasters.set(key,out);return out;
 }
 function drawField(){
  if(!settings.field)return false;
  const {ctx}=getMap();
  if(data){ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(raster(),0,0);ctx.restore();}
  return true;
 }
 function drawCurrents(){
  const {ctx,projection,view}=getMap();currentPaths=[];if(!settings.currents)return;
  const s=view.s,path=d3.geoPath(projection,ctx);
  for(const c of visibleCurrents()){
   const points=currentPoints(c),line={type:'LineString',coordinates:points},selected=settings.current===c.id;
   ctx.save();ctx.globalAlpha=settings.current&&!selected ? 0.38 : 1;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();path(line);ctx.strokeStyle='#ffffffeb';ctx.lineWidth=(selected?7:5)/s;ctx.stroke();
   ctx.beginPath();path(line);ctx.strokeStyle=currentColors[c.type];ctx.lineWidth=(selected?3.8:2.6)/s;if(c.type==='seasonal')ctx.setLineDash([7/s,3/s]);ctx.stroke();ctx.setLineDash([]);
   const dense=[];
   for(let j=1;j<points.length;j++){
    const interpolate=d3.geoInterpolate(points[j-1],points[j]);
    for(let k=0;k<=12;k++)dense.push(projection(interpolate(k/12)));
    if(j===points.length-1||j%2===0){
     const p=projection(interpolate(.7)),q=projection(interpolate(.72)),angle=Math.atan2(q[1]-p[1],q[0]-p[0]);
     ctx.save();ctx.translate(...p);ctx.rotate(angle);ctx.beginPath();ctx.moveTo(7/s,0);ctx.lineTo(-5/s,-4.5/s);ctx.lineTo(-5/s,4.5/s);ctx.closePath();ctx.fillStyle=currentColors[c.type];ctx.strokeStyle='#fff';ctx.lineWidth=1/s;ctx.stroke();ctx.fill();ctx.restore();
    }
   }
   currentPaths.push({current:c,points:dense});ctx.restore();
  }
 }
 function eventLocation(e){
  const {canvas,projection,view,ready}=getMap();if(!ready)return null;
  const r=canvas.getBoundingClientRect(),xy=[(e.clientX-r.left-view.x)/view.s,(e.clientY-r.top-view.y)/view.s],p=projection.invert(xy);
  if(!p||!p.every(Number.isFinite)||Math.abs(p[0])>180||Math.abs(p[1])>90)return null;
  const q=projection(p);return Math.hypot(q[0]-xy[0],q[1]-xy[1])<2?p:null;
 }
 function currentAt(e){
  if(!settings.currents)return null;const {canvas,view}=getMap(),r=canvas.getBoundingClientRect();
  const x=(e.clientX-r.left-view.x)/view.s,y=(e.clientY-r.top-view.y)/view.s;let best=null,distance=9/view.s;
  for(const path of currentPaths)for(let i=1;i<path.points.length;i++){
   const a=path.points[i-1],b=path.points[i],dx=b[0]-a[0],dy=b[1]-a[1];if(Math.abs(dx)>500)continue;
   const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);
   if(d<distance){best=path.current;distance=d;}
  }
  return best;
 }
 function showTooltip(e){
  const current=currentAt(e);if(!settings.field&&!current)return false;
  const p=eventLocation(e),tip=$('#tooltip');if(!p){tip.hidden=true;return true;}
  tip.textContent=current?current.name+' · '+currentTypes[current.type]:data?months[settings.month]+' · '+formatValue(settings.field,valueAt(settings.field,settings.month,p)):'טוענים נתוני אקלים…';
  tip.hidden=false;const {canvas,cssW,cssH}=getMap(),r=canvas.getBoundingClientRect();
  tip.style.left=Math.max(8,Math.min(cssW-tip.offsetWidth-8,e.clientX-r.left+12))+'px';tip.style.top=Math.max(8,Math.min(cssH-tip.offsetHeight-8,e.clientY-r.top+16))+'px';return true;
 }
 function selectPoint(e){
  const current=currentAt(e);if(current){settings.current=current.id;refresh();return true;}
  if(!settings.field)return false;const p=eventLocation(e);if(p){settings.point=p;refresh();}return true;
 }
 function renderPanel(){
  const f=fields[settings.field];
  $('#panel').innerHTML='<span class="eyebrow">ממוצעים חודשיים · 1991–2020</span><h2>'+f.name+'</h2><p class="lead">'+f.description+' ב'+months[settings.month]+'. החליפו חודש כדי להשוות בין העונות.</p><label class="sample-label" for="sampleLocation">בחירת מקום להשוואה</label><select id="sampleLocation"><option value="">בחרו עיר לדוגמה</option>'+cities.map((c,i)=>'<option value="'+i+'">'+c[0]+'</option>').join('')+'</select><p class="tiny">אפשר גם ללחוץ בכל מקום במפה.</p><div id="pointReadout">'+pointReadout()+'</div><div class="think"><h3>רגע למחשבה</h3><p>'+(settings.field==='temperature'?'כיצד משתנה הטמפרטורה בין ינואר ליולי בחצי הכדור הצפוני ובחצי הכדור הדרומי?':'השוו את ינואר ויולי במומבאי ובירושלים. באיזה חודש מופיעה העונה הגשומה בכל מקום?')+'</p></div><p class="tiny">רשת נתונים של רבע מעלה, כ־28 ק״מ בכיוון צפון–דרום. ממוצע לתא השטח, לא מדידה בתחנה בעיר. הטמפרטורה מתייחסת לאוויר גם מעל הים. המשקעים כוללים גשם ושלג בשווה ערך מים.</p><button id="backToClimate" class="secondary">חזרה לאזורי האקלים</button>';
  $('#sampleLocation').onchange=e=>{if(e.target.value!==''){const city=cities[Number(e.target.value)];settings.point=city.slice(1);$('#pointReadout').innerHTML='<strong>'+city[0]+'</strong>'+pointReadout();}};
  $('#backToClimate').onclick=()=>{settings.field=null;refresh();};
 }
 function pointReadout(){
  if(!settings.point)return '<p>בחרו מקום להצגת הערכים בשני החודשים.</p>';
  if(!data)return '<p>הערכים יוצגו לאחר טעינת הנתונים.</p>';
  return '<p>'+coordinate(settings.point)+'</p><table class="monthly-table"><caption>השוואת ממוצעים לתא השטח שנבחר</caption><thead><tr><th scope="col">מדד</th><th scope="col">ינואר</th><th scope="col">יולי</th></tr></thead><tbody>'+Object.entries(fields).map(([key,f])=>'<tr><th scope="row">'+(key==='temperature'?'טמפרטורה':'משקעים')+'</th>'+[1,7].map(m=>'<td><bdi>'+formatValue(key,valueAt(key,m,settings.point))+'</bdi></td>').join('')+'</tr>').join('')+'</tbody></table>';
 }
 function render(){
  const active=!!settings.field,f=fields[settings.field];
  document.querySelectorAll('[data-field]').forEach(b=>b.setAttribute('aria-pressed',settings.field===b.dataset.field));
  document.querySelectorAll('[data-month]').forEach(b=>b.setAttribute('aria-pressed',settings.month===Number(b.dataset.month)));
  $('#currentsToggle').setAttribute('aria-pressed',settings.currents);
  $('.legend').hidden=active;$('.tabs').hidden=active;$('#fieldLegend').hidden=!active;$('#currentLegend').hidden=!settings.currents;
  $('#layerStatus').hidden=!active||!!data;$('#layerStatus').innerHTML=error?error+' <button id="retryLayer">ניסיון נוסף</button>':'טוענים ממוצעים חודשיים…';
  if($('#retryLayer'))$('#retryLayer').onclick=()=>{loadData();refresh();};
  if(active){
   $('#mapTitle').textContent=f.name+' · '+months[settings.month];$('#clear').setAttribute('aria-pressed','false');
   $('#selectionKey').textContent=f.description+' · '+f.unit;$('#mapNote').textContent='ממוצע 1991–2020 · לחצו במפה להצגת ערכים';
   const percent=v=>100*(v-f.ticks[0])/(f.ticks.at(-1)-f.ticks[0]);
   const gradient=f.colors.map((color,i)=>color+' '+percent(f.ticks[i])+'%').join(',');
   const legendTicks=settings.field==='temperature'?[-65,-40,-20,0,20,40]:[0,100,200,400,600,900];
   $('#fieldLegend').innerHTML='<h3>'+f.name+' · '+months[settings.month]+' <bdi>'+f.unit+'</bdi></h3><div class="field-gradient" style="background:linear-gradient(to right,'+gradient+')"></div><div class="field-ticks">'+legendTicks.map(v=>'<span style="left:'+percent(v)+'%">'+(v===f.ticks.at(-1)?v+'+':v)+'</span>').join('')+'</div><p class="tiny">'+(settings.field==='temperature'?'טמפרטורת אוויר סמוך לפני השטח · ERA5':'ממוצע כמות חודשית · ERA5')+' · Copernicus / World Bank CCKP · 1991–2020. רשת 0.25° × 0.25°. אותו סולם צבעים בשני החודשים. הגדילו לצפייה בפרטים. סימן + מציין גם ערכים גבוהים מסף הסולם.</p>';
   renderPanel();
  }
  if(settings.currents){
   const available=visibleCurrents();
   $('#currentSelect').innerHTML='<option value="">כל הזרמים בתצוגה ('+available.length+')</option>'+available.map(c=>'<option value="'+c.id+'">'+c.name+'</option>').join('');
   $('#currentSelect').value=settings.current;
   $('#currentLabelsToggle').setAttribute('aria-pressed',settings.currentLabels);
   $('#currentBasin').value=settings.currentBasin;$('#currentType').value=settings.currentType;
   const current=currents.find(c=>c.id===settings.current);
   $('#currentDescription').textContent=current?currentExplanation(current):'לחצו על זרם במפה או בחרו אותו ברשימה. בשמו, בכיוון ובכרטיס ההסבר מופיע המידע על אותו זרם.';
   $('#currentDetails').innerHTML=current?currentCard(current):'<div class="current-intro"><p><strong>מה לומדים מהחצים?</strong> הכיוון מציין לאן המים זורמים. חם וקר הם תיאורים יחסיים לסביבה.</p><p>זרם חם מסיע חום; מים קרים עשויים לקרר את האוויר שמעליהם ולעודד ערפל בתנאים מתאימים. זרם לבדו אינו קובע את כמות המשקעים בחוף.</p><p class="tiny">שמות נוספים מופיעים בהגדלה. אפשר לסנן לפי אוקיינוס ולפי אופי הזרם.</p></div>';
   $('#focusCurrent').hidden=!current;$('#resetCurrent').hidden=!current;
   $('#seasonalNote').textContent='תצוגת '+months[settings.month]+': '+(settings.month===1?'הזרם הסומלי דרומה וזרם המונסון מערבה.':'הזרם הסומלי צפונה וזרם המונסון מזרחה.')+' המסלולים סכמטיים; אין כאן מדידת מהירות חודשית.';
  }

  $('#map').setAttribute('aria-label',active?f.name+' ב'+months[settings.month]+'. ניתן לבחור עיר ברשימה לקבלת ערכים. חיצים להזזה, פלוס ומינוס לזום, Home לאיפוס.':'מפת אזורי אקלים. בחירת אזור במקרא. חיצים להזזה, פלוס ומינוס לזום, Home לאיפוס.');
 }
 function currentCard(c){
  const [basin,route,direction,influence,sources]=currentFacts[c.id];
  return '<article class="current-card" style="--current-color:'+currentColors[c.type]+'"><div class="current-card-title"><h4>'+c.name+'</h4><span>'+currentTypes[c.type]+'</span></div><dl><div><dt>איפה?</dt><dd>'+basins[basin]+'. '+route+'</dd></div><div><dt>לאיזה כיוון?</dt><dd>'+direction+'</dd></div><div><dt>מה ההשפעה?</dt><dd>'+influence+'</dd></div><div><dt>ינואר ויולי</dt><dd>'+(currentSeasonNotes[c.id]||'מוצג הכיוון הכללי בשני החודשים. בפועל המיקום והעוצמה משתנים; אין להסיק שהזרם קבוע במשך השנה.')+'</dd></div></dl><p class="current-source">מקורות: '+sources.map(key=>'<a href="'+currentSourceLinks[key][1]+'" target="_blank" rel="noopener">'+currentSourceLinks[key][0]+'</a>').join(' · ')+'</p></article>';
 }
 function drawAnnotations(){
  const host=$('#currentMapLabels');host.innerHTML='';host.hidden=!settings.currents||!settings.currentLabels;if(host.hidden)return;
  const {projection,view,cssW,cssH,canvas}=getMap(),bounds=canvas.getBoundingClientRect();
  const blocked=Array.from(document.querySelectorAll('.latitude-label,.map-tools,.map-options,.map-note')).filter(el=>el.getClientRects().length).map(el=>{const r=el.getBoundingClientRect();return{x:r.left-bounds.left-3,y:r.top-bounds.top-3,w:r.width+6,h:r.height+6};});
  const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  const priorities=['gulf','peru','benguela','kuroshio','california','atlantic','brazil','australia','somali','monsoon','canary','labrador','leeuwin','north-pacific'];
  const list=visibleCurrents().sort((a,b)=>(a.id===settings.current?-100:priorities.includes(a.id)?priorities.indexOf(a.id):99)-(b.id===settings.current?-100:priorities.includes(b.id)?priorities.indexOf(b.id):99));
  const font=cssW<500?10:12;host.style.fontSize=font+'px';let placed=0;
  for(const c of list){
   if(placed>=(cssW<500?5:14)&&getMap().view.s<.9&&c.id!==settings.current)continue;
   const pts=currentPoints(c),anchor=pts[Math.floor((pts.length-1)/2)],p=projection(anchor),x=view.x+p[0]*view.s,y=view.y+p[1]*view.s;
   if(x<0||x>cssW||y<0||y>cssH)continue;
   const label=document.createElement('span');label.className='current-map-label'+(c.id===settings.current?' chosen':'');label.textContent=c.name;label.style.borderColor=currentColors[c.type];host.append(label);
   const w=label.offsetWidth,h=label.offsetHeight,candidates=[[8,-h-5],[8,6],[-w-8,-h-5],[-w-8,6],[-w/2,-h-16],[-w/2,16]];
   let position=null;for(const [dx,dy] of candidates){const b={x:x+dx,y:y+dy,w,h};if(b.x<4||b.x+w>cssW-4||b.y<47||b.y+h>cssH-31||blocked.some(r=>overlaps(b,r)))continue;position=b;break;}
   if(!position){label.remove();continue;}
   label.style.left=position.x+'px';label.style.top=position.y+'px';blocked.push(position);placed++;
  }
 }
 $('#currentLabelsToggle').onclick=()=>{settings.currentLabels=!settings.currentLabels;refresh();};
 $('#currentBasin').onchange=e=>{settings.currentBasin=e.target.value;settings.current='';refresh();};
 $('#currentType').onchange=e=>{settings.currentType=e.target.value;settings.current='';refresh();};
 $('#focusCurrent').onclick=()=>{const c=currents.find(c=>c.id===settings.current);if(c){const p=c.points[Math.floor(c.points.length/2)];focus(p[0],p[1],3);}};
 $('#resetCurrent').onclick=()=>{settings.current='';refresh();};
 $('#currentSelect').innerHTML='<option value="">כל הזרמים</option>'+currents.map(c=>'<option value="'+c.id+'">'+c.name+'</option>').join('');
 $('#currentSelect').onchange=e=>{settings.current=e.target.value;refresh();};
 $('#currentsToggle').onclick=()=>{settings.currents=!settings.currents;refresh();};
 document.querySelectorAll('[data-field]').forEach(b=>b.onclick=()=>{settings.field=settings.field===b.dataset.field?null:b.dataset.field;if(settings.field)loadData();refresh();});
 document.querySelectorAll('[data-month]').forEach(b=>b.onclick=()=>{settings.month=Number(b.dataset.month);refresh();});
 return {render,drawField,drawCurrents,drawAnnotations,showTooltip,selectPoint,clearField(){settings.field=null;},settings};
}
