'use strict';
/* Independent overlays. Existing climate fields, currents, values and selections
 * are never changed by this module. Map inspection is an explicit separate mode. */
(() => {
 const q=s=>document.querySelector(s),month=()=>climateLayers.settings.month;
 const names={atmosphere:'לחץ אוויר ורוחות',terrain:'תבליט ורכסי הרים',solar:'זווית השמש ואורך היום'};
 const settings={atmosphere:false,terrain:false,solar:false,inspect:false,topic:'atmosphere',point:[35.2,31.8],terrainOpacity:.65,ridge:'himalaya',moist:true};
 const places=[['ירושלים',35.2,31.8],['קו המשווה',20,0],['לונדון',-.1,51.5],['מומבאי',72.9,19.1],['סידני',151.2,-33.9],['טרומסה',18.96,69.65],['הקוטב הצפוני',0,90],['הקוטב הדרומי',0,-90]];
 // Representative ridge axes for selection only, not surveyed boundaries.
 const ridges=[
  {id:'himalaya',name:'ההימלאיה',points:[[73,35],[78,32],[83,29],[88,28],[94,28]],center:[85,29],note:'השוו את המשקעים במדרונות הדרומיים ובמרחב שמצפון לרכס. הביאו בחשבון גם את עונת המונסון.'},
  {id:'andes',name:'האנדים',points:[[-73,9],[-77,0],[-76,-10],[-69,-22],[-70,-34],[-72,-46],[-69,-54]],center:[-70,-27],note:'כיוון הרוחות והצד הגשום משתנים לאורך האנדים. בחרו קו רוחב והשוו את שני צדי הרכס באותו חודש.'},
  {id:'rockies',name:'הרי הרוקי',points:[[-126,59],[-119,51],[-113,45],[-106,39],[-105,33]],center:[-111,44],note:'השוו גובה, טמפרטורות ומשקעים. האקלים מושפע גם מרכסים נוספים ממערב ומהמרחק מהאוקיינוס.'},
  {id:'sierra',name:'סיירה נבדה',points:[[-121,40],[-119.5,37.5],[-118,35.5]],center:[-119,38],note:'בתנאים של זרימה לחה ממערב, המדרון המערבי חשוף יותר למשקעים והצד המזרחי נמצא בצל גשם.'},
  {id:'alps',name:'האלפים',points:[[6,44],[7,46],[10,47],[14,47],[16,46]],center:[10,46],note:'השוו את הרכס לסביבתו בשכבת הטמפרטורות. הצד הפונה לרוח משתנה עם כיוון הזרימה.'},
  {id:'atlas',name:'הרי האטלס',points:[[-10,30],[-7,32],[-3,34],[3,35],[9,35]],center:[-5,32],note:'בדקו את היחס בין הים, גובה הרכס והמשקעים. קרבת הסהרה קשורה גם לרצועת הלחץ הסובטרופית.'},
  {id:'ethiopia',name:'הרמה האתיופית',points:[[37,14],[39,11],[39,8],[38,6]],center:[39,10],note:'השוו את הרמה לסביבות נמוכות באותו קו רוחב, ובחנו את השינוי במשקעים בין ינואר ליולי.'},
  {id:'great-dividing',name:'רכס החיץ הגדול',points:[[145,-16],[148,-23],[151,-29],[149,-36]],center:[149,-28],note:'בזרימה לחה מן האוקיינוס השקט, המדרונות המזרחיים חשופים יותר למשקעים. השוו אותם לפנים היבשת.'}
 ];
 const zoneText={
  convergence:['התכנסות טרופית ולחץ נמוך','אוויר מתכנס ועולה. כשהאוויר הלח מתקרר עד לרוויה, עשויים להיווצר עננים ומשקעים.','up'],
  subtropicalHigh:['לחץ גבוה סובטרופי','אוויר שוקע, נדחס ומתחמם. הלחות היחסית פוחתת ונוטה להיווצר פחות עננות. זהו אחד הגורמים לרצועת המדבריות.','down'],
  subpolarLow:['רצועת לחץ נמוך תת־קוטבית','בממוצע מתקיימת כאן התכנסות ועלייה הקשורות למערכות מזג אוויר. גבולות הרצועה ומיקומן של המערכות משתנים.','up'],
  polarHigh:['לחץ גבוה קוטבי','במודל הכללי אוויר קר וצפוף שוקע ומתפזר סמוך לפני השטח.','down'],
  trade:['תחום רוחות הסחר','רוחות סמוך לפני השטח נעות בדרך כלל מן הרמות הסובטרופיות לעבר אזור ההתכנסות. סיבוב כדור הארץ מסיט את תנועתן.','horizontal'],
  westerlies:['תחום הרוחות המערביות','הרוחות השולטות בממוצע נעות ממערב למזרח. מזג האוויר המקומי מושפע משקעים, רמות וחזיתות נעים.','horizontal'],
  polar:['תחום הרוחות המזרחיות הקוטביות','במודל הכללי האוויר נע מן האזורים הקוטביים לעבר קווי רוחב נמוכים יותר ומוסט מערבה.','horizontal']
 };
 const active=()=>Object.keys(names).filter(k=>settings[k]);
 const make=(tag,cls,html='')=>{const n=document.createElement(tag);n.className=cls;n.innerHTML=html;return n;};
 const controls=make('section','learning-controls','<h3>גורמים המשפיעים על האקלים</h3>'+Object.entries(names).map(([id,name],i)=>'<button type="button" id="'+id+'Toggle" class="learning-switch" aria-pressed="false" aria-controls="dockLearning"><span class="learning-icon" aria-hidden="true">'+['↗','△','☀'][i]+'</span><span class="learning-name">'+name+'<small>'+['מודל עונתי סכמטי','נתוני גובה אמיתיים','חישוב ל־15 בחודש'][i]+'</small></span><span class="learning-check" aria-hidden="true">✓</span></button>').join('')+'<button id="openLearning" class="learning-open" hidden>הסבר ובדיקת מיקום ←</button><div id="terrainStatus" class="learning-status" role="status" hidden></div><p class="control-hint">אפשר לשלב כל תוספת עם השכבות הקיימות. המקרא המקורי נשאר בתוקף.</p>');
 q('#monthControl').before(controls);
 const tab=make('button','','המחשות');tab.id='tabLearning';tab.hidden=true;tab.dataset.dock='learning';tab.setAttribute('role','tab');tab.setAttribute('aria-controls','dockLearning');tab.setAttribute('aria-selected','false');tab.tabIndex=-1;q('.drawer-tabs').append(tab);
 const pane=make('section','dock-pane learning-pane',`
  <label for="learningTopic">בחרו מה לחקור</label><select id="learningTopic" class="learning-topic-select"></select>
  <div id="learningMonths" class="learning-months" role="group" aria-label="חודש בשכבות ההמחשה"><button data-learning-month="1">ינואר</button><button data-learning-month="7">יולי</button></div>
  <label for="learningPlace">מיקום לבדיקה</label><select id="learningPlace" class="learning-place-select"><option value="">נקודה שנבחרה במפה</option>${places.map((p,i)=>'<option value="'+i+'">'+p[0]+'</option>').join('')}</select>
  <p id="learningLocation" class="learning-location"></p><button id="pickLearningPoint" class="learning-open">בחירת נקודה במפה ←</button>
  <div id="atmosphereLesson">
   <h3>איך האוויר נע, ואיך זה קשור לאקלים?</h3>
   <div class="learning-legend"><bdi>→</bdi> כיוון תנועת אוויר ליד פני השטח<br><bdi>H</bdi> רצועת לחץ גבוה · <bdi>L</bdi> רצועת לחץ נמוך<br><span style="color:#913f87">קו סגול מקווקו</span>: אזור ההתכנסות הבין־טרופי (ITCZ)</div>
   <p class="learning-caveat">מודל לימודי סכמטי של התבנית העולמית. אין כאן מדידות של מהירות רוח או לחץ. רצועות הלחץ, כיווני החצים ומיקום ההתכנסות מקורבים; אינם תחזית או תיאור של כל מקום.</p>
   <div class="learning-wind-key"><button data-pressure-point="0">התכנסות טרופית</button><button data-pressure-point="30">רמה סובטרופית</button><button data-pressure-point="60">שקע תת־קוטבי</button></div>
   <h3 id="pressureTitle"></h3><p id="pressureText"></p><canvas id="pressureScene" class="learning-scene" width="600" height="360" role="img" aria-label="המחשה סכמטית של תנועת האוויר באזור שנבחר"></canvas>
   <p class="learning-caveat">החתך מתאר מגמה ממוצעת. עלייה אינה מבטיחה גשם: נדרשים גם לחות ותנאים מתאימים. רוחות נקראות על שם הכיוון שממנו הן מגיעות.</p>
   <p class="learning-inquiry">הפעילו משקעים, עברו בין ינואר ליולי והשוו את רצועת הגשמים למיקום ההתכנסות הסכמטי. היכן יש התאמה והיכן נדרשים גורמים נוספים להסבר?</p>
  </div>
  <div id="terrainLesson" hidden>
   <h3>גובה, רכסים וצל גשם</h3><div class="learning-metrics"><div class="learning-metric" style="grid-column:1/-1"><strong id="terrainElevation"></strong><span>גובה בנקודת הרשת הקרובה, במטרים</span></div></div>
   <label for="terrainOpacity">עוצמת הצללת התבליט</label><input id="terrainOpacity" class="learning-opacity" type="range" min="15" max="90" step="5" value="65">
   <label for="ridgeSelect">רכס לדוגמה</label><select id="ridgeSelect" class="learning-ridge-select">${ridges.map(r=>'<option value="'+r.id+'">'+r.name+'</option>').join('')}</select><div class="learning-actions"><button id="focusRidge">התמקדות ברכס</button><button id="ridgeWorld">מפת העולם</button></div><p id="ridgeNote"></p>
   <p class="learning-caveat">תבליט: NOAA ETOPO1 משנת 2009, נדגם לרשת 0.1°. הגובה הוא ערך תא רשת ולא גובה פסגה מדוד. ההצללה מודגשת לצורכי קריאה; קווי הרכסים הם סימון מקורב. בגרינלנד ובאנטארקטיקה מוצג פני הקרח.</p>
   <h3>מה קורה לאוויר שחוצה רכס?</h3><canvas id="orographicScene" class="learning-scene" width="600" height="380" role="img" aria-label="חתך סכמטי: אוויר עולה בצד הפונה לרוח, ואחר כך יורד מעבר לרכס"></canvas>
   <label class="learning-moisture"><input id="orographicMoist" type="checkbox" checked>אוויר נכנס לח מספיק ליצירת ענן</label>
   <div class="learning-actions"><button id="orographicPlay" aria-pressed="false">הפעלה</button><button id="orographicStep">שלב הבא</button><button id="orographicReset">התחלה</button></div><p id="orographicStepText" class="learning-step" aria-live="polite"></p>
   <p class="learning-caveat">חתך עקרוני, אינו בקנה מידה ואינו חתך מדוד של הרכס הנבחר. המסלול והקצב להמחשה בלבד. האוויר נע משמאל לימין; הצד הפונה לרוח במציאות תלוי בכיוון הרוח.</p>
   <p class="learning-inquiry">בחרו רכס, שערו איזה צד גשום יותר ובדקו בשכבת המשקעים. האם כיוון הרוחות והשינוי העונתי תומכים בהסבר?</p>
  </div>
  <div id="solarLesson" hidden>
   <h3>השמש בקו הרוחב שנבחר</h3><p id="solarDate"></p><div class="learning-metrics"><div class="learning-metric"><strong id="solarDaylight"></strong><span>שעות אור</span></div><div class="learning-metric"><strong id="solarAltitude"></strong><span>גובה השמש בצוהריים מעל האופק</span></div></div><p id="solarPolar"></p>
   <canvas id="solarScene" class="learning-scene" width="600" height="360" role="img" aria-label="גובה השמש בצוהריים מעל האופק במיקום ובתאריך שנבחרו"></canvas>
   <div class="learning-legend">קו כתום: קו הרוחב שבו השמש בזנית בצוהריים באותו תאריך.<br>הצללה כחולה באזור קוטבי: לילה קוטבי. הצללה זהובה: יום קוטבי. אין זו מפת יום ולילה לשעה מסוימת.</div>
   <table class="learning-mini-table"><caption>השוואת אותו מיקום בין העונות</caption><thead><tr><th>תאריך</th><th>שעות אור</th><th>גובה בצוהריים</th></tr></thead><tbody id="solarCompare"></tbody></table>
   <p class="learning-caveat">חישוב גאומטרי ל־15 בחודש בשנה שאינה מעוברת; ללא שבירת אור, גודל דיסקת השמש או הסתרה על ידי תבליט. זהו יום מייצג ולא ממוצע חודשי. גובה שמש שלילי משמעו שהשמש מתחת לאופק גם בצוהריים.</p>
   <p class="learning-inquiry">השוו שתי נקודות באותו קו אורך בשני חצאי הכדור. מה משתנה בינואר וביולי? השוו גם לטמפרטורות: האם התגובה לחימום מיידית ואחידה?</p>
  </div>
  <details><summary>מקורות והנחות ההמחשה</summary><ul class="learning-sources"><li><a target="_blank" rel="noopener" href="https://www.noaa.gov/jetstream/global/global-atmospheric-circulations">NOAA: הסירקולציה העולמית</a></li><li><a target="_blank" rel="noopener" href="https://www.noaa.gov/jetstream/tropical/convergence-zone">NOAA: ההתכנסות הטרופית והתנועה העונתית</a></li><li><a target="_blank" rel="noopener" href="https://www.ncei.noaa.gov/products/etopo-global-relief-model">NOAA: מודל הגובה ETOPO</a></li><li><a target="_blank" rel="noopener" href="https://data.pmel.noaa.gov/socat/erddap/griddap/etopo180.html">מקור רשת הגובה ETOPO1</a></li><li><a target="_blank" rel="noopener" href="https://www.weather.gov/jkl/education">NWS: עלייה, התקררות והתעבות</a></li><li><a target="_blank" rel="noopener" href="https://gml.noaa.gov/grad/solcalc/solareqns.PDF">NOAA: נוסחאות מיקום השמש</a></li><li><a target="_blank" rel="noopener" href="https://aa.usno.navy.mil/faq/RST_defs">USNO: הגדרות זריחה ושקיעה</a></li></ul></details>`);
 pane.id='dockLearning';pane.hidden=true;pane.setAttribute('role','tabpanel');pane.setAttribute('aria-labelledby','tabLearning');q('.drawer-scroll').append(pane);
 const key=make('div','learning-key');key.id='learningKey';key.hidden=true;q('.map-section').append(key);
 const inspect=make('button','learning-inspect','בדיקת גורמי אקלים');inspect.id='learningInspect';inspect.hidden=true;inspect.setAttribute('aria-pressed','false');q('.map-foot').append(inspect);
 let terrain=null,terrainPending=null,terrainError='',terrainRaster=null,terrainRasterKey='';
 let terrainShades=null,sceneTime=0,playing=false,lastFrame=0,raf=0;
 const coord=p=>'<bdi dir="ltr">'+Math.abs(p[1]).toFixed(1)+'°'+(p[1]<0?'S':'N')+' · '+Math.abs(p[0]).toFixed(1)+'°'+(p[0]<0?'W':'E')+'</bdi>';
 const hours=h=>{const total=Math.round(h*60);return Math.floor(total/60)+':'+String(total%60).padStart(2,'0');};
 function openLesson(topic=settings.topic){settings.topic=topic;sync();atlasInterface.open('learning');drawScenes();}
 async function loadTerrain(){
  if(terrain||terrainPending)return terrainPending;terrainError='';
  terrainPending=(async()=>{
   const mr=await fetch('data/terrain/manifest.json?v=1');if(!mr.ok)throw Error('Terrain manifest HTTP '+mr.status);const m=await mr.json(),g=m.grid;
   if(g.width!==3600||g.height!==1801||g.longitudeStart!==-180||g.latitudeStart!==90||g.longitudeStep!==.1||g.latitudeStep!==-.1||m.encoding.dtype!=='int16'||m.encoding.byteOrder!=='little-endian')throw Error('Invalid terrain grid');
   const r=await fetch(m.file.url+'?v='+m.file.sha256.slice(0,12));if(!r.ok)throw Error('Terrain HTTP '+r.status);const compressed=await r.arrayBuffer();
   if(compressed.byteLength!==m.file.bytes)throw Error('Incomplete terrain');
   if(globalThis.crypto?.subtle){const h=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',compressed)),b=>b.toString(16).padStart(2,'0')).join('');if(h!==m.file.sha256)throw Error('Terrain checksum mismatch');}
   const bytes=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();if(bytes.byteLength!==g.width*g.height*2)throw Error('Invalid terrain size');
   const values=new Int16Array(bytes);if(new Uint8Array(new Uint16Array([1]).buffer)[0]!==1){const dv=new DataView(bytes);for(let i=0;i<values.length;i++)values[i]=dv.getInt16(i*2,true);}
   terrain={...m,values};buildShades();
  })().catch(e=>{console.error(e);terrainError='נתוני התבליט לא נטענו. אפשר לנסות שוב; שאר השכבות ממשיכות לפעול.';}).finally(()=>{terrainPending=null;sync();draw();});
  sync();return terrainPending;
 }
 function terrainCell(lon,lat){const g=terrain.grid;const row=Math.max(0,Math.min(g.height-1,Math.round((g.latitudeStart-lat)/-g.latitudeStep)));const col=((Math.round((lon-g.longitudeStart)/g.longitudeStep)%g.width)+g.width)%g.width;return row*g.width+col;}
 function landAt(lon,lat){if(!ready)return false;const p=projection([lon,lat]),x=Math.floor(p[0]),y=Math.floor(p[1]);return x>=0&&x<W&&y>=0&&y<H&&grid[y*W+x]>0;}
 function elevationAt(lon,lat){if(!terrain||!landAt(lon,lat))return null;const v=terrain.values[terrainCell(lon,lat)];return v===32767?null:v;}
 function buildShades(){
  const {grid:g,values:v}=terrain,n=g.width;terrainShades=new Int16Array(v.length);
  const dy=111195*Math.abs(g.latitudeStep),exaggeration=9;
  for(let row=1;row<g.height-1;row++){
   const lat=g.latitudeStart+row*g.latitudeStep,dx=dy*Math.max(.08,Math.cos(lat*Math.PI/180));
   for(let col=0;col<n;col++){
    const i=row*n+col,z=v[i];if(z===32767)continue;
    const east=(v[row*n+(col+1)%n]-v[row*n+(col+n-1)%n])/(2*dx)*exaggeration;
    const north=(v[i-n]-v[i+n])/(2*dy)*exaggeration;
    const light=(-east*-.5-north*.5+.7071)/Math.sqrt(east*east+north*north+1);
    terrainShades[i]=Math.round(Math.max(-1,Math.min(1,(light-.7071)*2.8))*255);
   }
  }
 }
 function drawTerrain(){
  if(!settings.terrain||!terrain)return;
  const pw=canvas.width,ph=canvas.height,dpr=pw/cssW,k=[pw,ph,view.s,view.x,view.y,settings.terrainOpacity].join(':');
  if(k!==terrainRasterKey){
   const out=document.createElement('canvas');out.width=pw;out.height=ph;const c=out.getContext('2d'),im=c.createImageData(pw,ph),pixels=im.data;
   const origin=projection([0,0])[0],g=terrain.grid,n=g.width;
   for(let y=0;y<ph;y++){
    const sy=((y+.5)/dpr-view.y)/view.s,p=projection.invert([origin,sy]);if(!p||Math.abs(p[1])>90||!Number.isFinite(p[1])||Math.abs(projection([0,p[1]])[1]-sy)>1)continue;
    const half=projection([180,p[1]])[0]-origin,left=(view.x+(origin-half)*view.s)*dpr,right=(view.x+(origin+half)*view.s)*dpr;
    const row=Math.max(0,Math.min(g.height-1,Math.round((g.latitudeStart-p[1])/-g.latitudeStep))),offset=row*n,gy=Math.floor(sy),step=360/(right-left);
    if(gy<0||gy>=H)continue;
    for(let x=Math.max(0,Math.ceil(left-.5));x<=Math.min(pw-1,Math.floor(right-.5));x++){
     const gx=Math.floor(((x+.5)/dpr-view.x)/view.s);if(gx<0||gx>=W||!grid[gy*W+gx])continue;
     const lon=-180+(x+.5-left)*step,col=((Math.round((lon-g.longitudeStart)/g.longitudeStep)%n)+n)%n,i=offset+col,shade=terrainShades[i],z=terrain.values[i],j=(y*pw+x)*4;
     if(z===32767)continue;
     if(shade>=0){pixels[j]=255;pixels[j+1]=255;pixels[j+2]=246;}else{pixels[j]=41;pixels[j+1]=36;pixels[j+2]=26;}
     pixels[j+3]=Math.min(200,Math.abs(shade))*settings.terrainOpacity;
    }
   }
   c.putImageData(im,0,0);terrainRaster=out;terrainRasterKey=k;
  }
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(terrainRaster,0,0);ctx.restore();
 }
 function pathLine(points,color,width=2,dash=[]){const s=view.s;ctx.save();ctx.beginPath();d3.geoPath(projection,ctx)({type:'LineString',coordinates:points});ctx.setLineDash(dash.map(x=>x/s));ctx.strokeStyle='#ffffffe0';ctx.lineWidth=(width+2.5)/s;ctx.stroke();ctx.strokeStyle=color;ctx.lineWidth=width/s;ctx.stroke();ctx.restore();}
 const latitude=lat=>Array.from({length:181},(_,i)=>[-180+i*2,lat]);
 function symbol(text,lon,lat,color,size=15){const p=projection([lon,lat]);ctx.save();ctx.font='700 '+size/view.s+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=3.5/view.s;ctx.strokeStyle='#ffffffed';ctx.strokeText(text,...p);ctx.fillStyle=color;ctx.fillText(text,...p);ctx.restore();}
 function drawAtmosphere(){
  if(!settings.atmosphere)return;
  const A=AtlasAtmosphere,m=month(),s=view.s,spacing=cssW<600?65:42;
  for(const lat of [-74,-46,-17,17,46,74])for(let lon=-160;lon<175;lon+=spacing){
   const w=A.wind(lon,lat,m),p=projection([lon,lat]),to=projection([lon+w.east*2,lat+w.north*1.2]),angle=Math.atan2(to[1]-p[1],to[0]-p[0]),len=(cssW<600?12:18)/s;
   ctx.save();ctx.translate(...p);ctx.rotate(angle);ctx.lineCap='round';ctx.lineJoin='round';
   for(const [color,width] of [['#fffffff0',4.5],['#5a3976',1.8]]){ctx.strokeStyle=color;ctx.lineWidth=width/s;ctx.beginPath();ctx.moveTo(-len/2,0);ctx.lineTo(len/2,0);ctx.moveTo(len/2-5/s,-4/s);ctx.lineTo(len/2,0);ctx.lineTo(len/2-5/s,4/s);ctx.stroke();}ctx.restore();
  }
  pathLine(Array.from({length:181},(_,i)=>{const lon=-180+i*2;return [lon,A.itcz(lon,m)]}),'#913f87',2.7,[5,4]);
  for(const lon of [-135,-35,65,155])for(const lat of [-82,-60,-30,30,60,82])symbol(Math.abs(lat)===60?'L':'H',lon,lat,'#694582',cssW<600?11:15);
  for(const lon of [-110,10,120])symbol('L',lon,A.itcz(lon,m),'#913f87',13);
 }
 function drawSolar(){
  if(!settings.solar)return;
  const delta=AtlasSolar.declinationForDate(month()),polar=90-Math.abs(delta),s=view.s;
  // Only polar day/night areas are tinted. This is not a day/night terminator.
  for(const hem of [-1,1]){
   const daylight=hem*delta>0,edge=projection([0,hem*polar])[1],pole=projection([0,hem*90])[1];
   ctx.save();ctx.beginPath();d3.geoPath(projection,ctx)({type:'Sphere'});ctx.clip();ctx.fillStyle=daylight?'#f2b53135':'#213d753d';ctx.fillRect(0,Math.min(edge,pole),W,Math.abs(edge-pole));ctx.restore();
   pathLine(latitude(hem*polar),daylight?'#b48522':'#38598c',1,[2,5]);
  }
  pathLine(latitude(delta),'#cc7621',2.5,[10,4]);
  for(const lon of [-130,0,130])symbol('☀',lon,delta,'#b85e08',18);
  const p=projection(settings.point);ctx.save();ctx.beginPath();ctx.arc(p[0],p[1],5/s,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle='#a55c15';ctx.lineWidth=2/s;ctx.stroke();ctx.restore();
 }
 function drawRidges(){if(!settings.terrain)return;for(const r of ridges)pathLine(r.points,r.id===settings.ridge?'#6d3c1c':'#746446',r.id===settings.ridge?2.5:1,[2,4]);}
 function drawOverlays(){if(!ready)return;drawTerrain();drawSolar();drawAtmosphere();drawRidges();}
 function fromEvent(e){const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left-view.x)/view.s,y=(e.clientY-r.top-view.y)/view.s;const p=projection.invert([x,y]);if(!p||!p.every(Number.isFinite)||Math.abs(p[0])>180||Math.abs(p[1])>90)return null;const v=projection(p);return Math.hypot(v[0]-x,v[1]-y)<1?p:null;}
 function ridgeAt(e){if(!settings.terrain)return null;const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;let best=null,distance=11;
  for(const ridge of ridges)for(let i=1;i<ridge.points.length;i++){
   const interpolate=d3.geoInterpolate(ridge.points[i-1],ridge.points[i]);for(let t=0;t<=1;t+=.05){const p=projection(interpolate(t)),d=Math.hypot(x-view.x-p[0]*view.s,y-view.y-p[1]*view.s);if(d<distance){distance=d;best=ridge;}}
  }return best;
 }
 function selectPoint(e){if(!active().length)return false;const ridge=ridgeAt(e);if(!settings.inspect&&!ridge)return false;const p=fromEvent(e);if(!p)return false;settings.point=p;if(ridge){settings.ridge=ridge.id;settings.topic='terrain';}q('#learningPlace').value='';openLesson(settings.topic);draw();return true;}
 function showTooltip(e){if(!active().length)return false;const ridge=ridgeAt(e);if(!settings.inspect&&!ridge)return false;const p=fromEvent(e);if(!p)return false;const t=q('#tooltip'),r=canvas.getBoundingClientRect();t.textContent=ridge?ridge.name+' · לחצו לחקירה':'לחצו לבדיקת גורמי האקלים בנקודה';t.hidden=false;t.style.left=Math.max(8,Math.min(cssW-t.offsetWidth-8,e.clientX-r.left+12))+'px';t.style.top=Math.max(8,Math.min(cssH-t.offsetHeight-8,e.clientY-r.top+16))+'px';return true;}
 function sync(){
  const on=active();tab.hidden=!on.length;inspect.hidden=!on.length;q('#openLearning').hidden=!on.length;key.hidden=!on.length;
  Object.keys(names).forEach(k=>q('#'+k+'Toggle').setAttribute('aria-pressed',settings[k]));
  if(!on.includes(settings.topic)&&on.length)settings.topic=on[0];
  q('#learningTopic').innerHTML=on.map(k=>'<option value="'+k+'">'+names[k]+'</option>').join('');q('#learningTopic').value=settings.topic;
  ['atmosphere','terrain','solar'].forEach(k=>q('#'+k+'Lesson').hidden=k!==settings.topic);
  q('#learningMonths').hidden=settings.topic==='terrain';
  if(settings.atmosphere||settings.solar)q('#monthControl').hidden=false;
  q('#learningMonths').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.learningMonth)===month()));
  if(!on.length){settings.inspect=false;if(tab.getAttribute('aria-selected')==='true'&&q('#mapDrawer').open)atlasInterface.open('layers');}
  inspect.setAttribute('aria-pressed',settings.inspect);inspect.textContent=settings.inspect?'סיום בדיקת גורמי אקלים':'בדיקת גורמי אקלים';
  key.innerHTML=(settings.atmosphere?'<span><b style="color:#694582">↗ H L</b> רוחות ולחץ · סכמטי · '+(month()===1?'ינואר':'יולי')+'</span>':'')+(settings.terrain?'<span><b>△</b> הצללת תבליט · ETOPO1 · 0.1°</span>':'')+(settings.solar?'<span><b style="color:#b85e08">☀</b> זנית וקוטב · חישוב ל־15 '+(month()===1?'בינואר':'ביולי')+'</span>':'')+'<button class="learning-key-link" id="keyLearning">הסבר ובדיקה ←</button>';
  q('#keyLearning').onclick=()=>openLesson();
  const status=q('#terrainStatus');status.hidden=!settings.terrain||!!terrain;status.innerHTML=terrainError?terrainError+' <button id="retryTerrain">ניסיון נוסף</button>':'טוען נתוני גובה (כ־10 מ״ב)…';if(q('#retryTerrain'))q('#retryTerrain').onclick=loadTerrain;
  q('#learningLocation').innerHTML=coord(settings.point);
  const z=zoneText[AtlasAtmosphere.zone(...settings.point,month())];q('#pressureTitle').textContent=z[0];q('#pressureText').textContent=z[1];
  const elev=elevationAt(...settings.point);q('#terrainElevation').textContent=!terrain?(terrainError?'לא נטען':'טוען…'):elev===null?'מחוץ ליבשה':elev.toLocaleString('he-IL');
  q('#ridgeSelect').value=settings.ridge;q('#ridgeNote').textContent=ridges.find(r=>r.id===settings.ridge).note;
  const metrics=AtlasSolar.metrics(...settings.point,month());
  q('#solarDate').textContent='15 '+(month()===1?'בינואר':'ביולי')+' · זמן צוהריים שמשי מקומי';q('#solarDaylight').textContent=hours(metrics.daylightHours);q('#solarAltitude').textContent=metrics.solarNoonAltitude.toFixed(1)+'°';
  q('#solarPolar').textContent=metrics.polarDay?'יום קוטבי: השמש מעל האופק כל היממה.':metrics.polarNight?'לילה קוטבי: השמש מתחת לאופק כל היממה.':'אורך היום מוצג בשעות ודקות. הצוהריים השמשיים אינם בהכרח 12:00 בשעון.';
  q('#solarCompare').innerHTML=[1,7].map(m=>{const v=AtlasSolar.metrics(...settings.point,m);return '<tr><th>15 '+(m===1?'בינואר':'ביולי')+'</th><td><bdi>'+hours(v.daylightHours)+'</bdi></td><td><bdi>'+v.solarNoonAltitude.toFixed(1)+'°</bdi></td></tr>';}).join('');
  drawScenes();
 }
 function sceneBase(c,w,h){const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#b9d9e8');sky.addColorStop(.75,'#f2f5e8');sky.addColorStop(1,'#d4ddc2');c.fillStyle=sky;c.fillRect(0,0,w,h);}
 function text(c,str,x,y,size=20,color='#20484a'){c.font='600 '+size+'px Arial';c.textAlign='center';c.fillStyle=color;c.fillText(str,x,y);}
 function cloud(c,x,y,alpha=1){c.save();c.globalAlpha=alpha;c.fillStyle='#faffff';c.shadowColor='#3c647a55';c.shadowBlur=12;for(const [dx,dy,r] of [[-32,4,21],[-10,-8,29],[19,-5,25],[40,8,18]]){c.beginPath();c.arc(x+dx,y+dy,r,0,Math.PI*2);c.fill();}c.restore();}
 function arrow(c,x,y,angle,len,color='#e5a34e'){c.save();c.translate(x,y);c.rotate(angle);c.strokeStyle=color;c.fillStyle=color;c.lineWidth=6;c.lineCap='round';c.beginPath();c.moveTo(-len/2,0);c.lineTo(len/2,0);c.stroke();c.beginPath();c.moveTo(len/2,0);c.lineTo(len/2-14,-9);c.lineTo(len/2-14,9);c.closePath();c.fill();c.restore();}
 function pressureScene(){const cv=q('#pressureScene'),c=cv.getContext('2d'),w=cv.width,h=cv.height,z=zoneText[AtlasAtmosphere.zone(...settings.point,month())];sceneBase(c,w,h);c.fillStyle='#9cbb87';c.beginPath();c.moveTo(0,300);for(let x=0;x<=w;x+=8)c.lineTo(x,302+Math.sin(x/110)*5);c.lineTo(w,h);c.lineTo(0,h);c.fill();text(c,'חתך עקרוני באטמוספרה',w/2,32,21);
  if(z[2]==='horizontal'){arrow(c,300,190,0,180,'#755292');text(c,'רוח סמוך לפני השטח',300,250,22);text(c,'החץ בחתך מסמל תנועה אופקית בלבד',300,280,16);return;}
  const rising=z[2]==='up';for(let i=0;i<3;i++){const y=255-i*70,r=18+i*9;const g=c.createRadialGradient(220-r/3,y-r/3,2,220,y,r);g.addColorStop(0,'#fff5c6cc');g.addColorStop(1,'#d58b4099');c.fillStyle=g;c.beginPath();c.arc(220,y,r,0,Math.PI*2);c.fill();}
  arrow(c,350,195,rising?-Math.PI/2:Math.PI/2,145);if(rising)cloud(c,220,84,.95);
  text(c,rising?'עלייה והתפשטות':'ירידה ודחיסה',440,135,19);text(c,rising?'התקררות':'התחממות',440,170,19);text(c,rising?'ענן עשוי להיווצר':'הלחות היחסית פוחתת',420,230,18);text(c,'גודל חבילות האוויר מוגזם להמחשה',300,340,16);
 }
 function mountainY(x){return 313-139*Math.exp(-Math.pow((x-320)/115,2))-34*Math.exp(-Math.pow((x-243)/42,2))+8*Math.sin(x/19)*Math.exp(-Math.pow((x-310)/150,2));}
 function parcelPosition(t){const x=50+500*t;return [x,mountainY(x)-48];}
 function orographicScene(){const cv=q('#orographicScene'),c=cv.getContext('2d'),w=cv.width,h=cv.height;sceneBase(c,w,h);
  c.fillStyle='#9baea175';c.beginPath();c.moveTo(0,315);for(let x=0;x<=w;x+=5)c.lineTo(x,270-85*Math.exp(-Math.pow((x-360)/140,2))+7*Math.sin(x/39));c.lineTo(w,h);c.lineTo(0,h);c.fill();
  const rock=c.createLinearGradient(0,140,0,h);rock.addColorStop(0,'#a2a18b');rock.addColorStop(.4,'#768768');rock.addColorStop(1,'#655b49');c.fillStyle=rock;c.beginPath();c.moveTo(0,h);for(let x=0;x<=w;x+=3)c.lineTo(x,mountainY(x));c.lineTo(w,h);c.closePath();c.fill();
  c.save();c.clip();for(let j=0;j<8;j++){c.beginPath();for(let x=0;x<=w;x+=5){const y=mountainY(x)+18+j*18+8*Math.sin(x/40+j);x?c.lineTo(x,y):c.moveTo(x,y);}c.strokeStyle=j%2?'#dae1b033':'#403c2d44';c.lineWidth=4;c.stroke();}c.restore();
  if(settings.moist&&sceneTime>.23){const strength=Math.min(1,(sceneTime-.23)*5);cloud(c,251,125,strength);if(sceneTime>.36){c.strokeStyle='#417eacaa';c.lineWidth=2;for(let i=0;i<10;i++){const x=214+i*8,y=151+(i*11+sceneTime*70)%37;c.beginPath();c.moveTo(x,y);c.lineTo(x-3,y+11);c.stroke();}}}
  c.save();c.setLineDash([4,7]);c.strokeStyle='#fff9';c.lineWidth=3;c.beginPath();for(let t=0;t<=1.001;t+=.01){const p=parcelPosition(t);t?c.lineTo(...p):c.moveTo(...p);}c.stroke();c.restore();
  for(const t of [.12,.42,.78]){const a=parcelPosition(t),b=parcelPosition(t+.02);arrow(c,a[0],a[1],Math.atan2(b[1]-a[1],b[0]-a[0]),30,'#dd983f');}
  const p=parcelPosition(sceneTime),r=14+13*Math.exp(-Math.pow((p[0]-300)/130,2));c.fillStyle='#f8c56bdd';c.strokeStyle='#8e5b1e';c.lineWidth=2;c.beginPath();c.arc(...p,r,0,Math.PI*2);c.fill();c.stroke();
  text(c,'הצד הפונה לרוח',120,37,20);text(c,'הצד שבמורד הרוח',469,37,20);text(c,'זרימת אוויר משמאל לימין',300,364,18);
  const steps=['אוויר מגיע אל המדרון. לחצו על הפעלה או התקדמו שלב אחד.','האוויר עולה במדרון, הלחץ סביבו פוחת והוא מתפשט ומתקרר.',settings.moist?'אם הושגה רוויה, אדי מים מתעבים לענן וייתכנו משקעים בצד הפונה לרוח.':'האוויר הנכנס יבש יותר. בדוגמה הזאת לא מושגת רוויה, ולכן לא נוצר ענן.', 'האוויר יורד בצד השני, נדחס ומתחמם. הלחות היחסית פוחתת; בתנאים מתאימים נוצר צל גשם.'];
  q('#orographicStepText').textContent=steps[sceneTime===0?0:sceneTime<.34?1:sceneTime<.67?2:3];
 }
 function solarScene(){const cv=q('#solarScene'),c=cv.getContext('2d'),w=cv.width,h=cv.height,v=AtlasSolar.metrics(...settings.point,month()),angle=v.solarNoonAltitude*Math.PI/180,origin=[140,258],radius=176;sceneBase(c,w,h);
  c.fillStyle='#8a9f72';c.fillRect(0,258,w,h-258);c.strokeStyle='#405d4c';c.lineWidth=2;c.beginPath();c.moveTo(25,258);c.lineTo(575,258);c.stroke();
  c.setLineDash([4,5]);c.strokeStyle='#4d6f7866';c.beginPath();c.arc(...origin,radius,-Math.PI/2,0);c.stroke();c.setLineDash([]);
  const x=origin[0]+radius*Math.cos(angle),y=origin[1]-radius*Math.sin(angle);c.strokeStyle='#d38b28';c.lineWidth=4;c.beginPath();c.moveTo(...origin);c.lineTo(x,y);c.stroke();
  c.save();c.fillStyle='#f5c35c';c.shadowColor='#f1b44499';c.shadowBlur=18;c.beginPath();c.arc(x,y,19,0,Math.PI*2);c.fill();c.restore();
  c.strokeStyle='#9d6b2c';c.lineWidth=2;c.beginPath();c.arc(...origin,65,Math.min(-angle,0),Math.max(-angle,0));c.stroke();
  text(c,'90°',140,60,18);text(c,'אופק 0°',485,246,18);text(c,v.solarNoonAltitude.toFixed(1)+'°',400,130,33,'#946020');text(c,'גובה השמש בצוהריים',412,166,19);text(c,v.polarNight?'השמש מתחת לאופק':'מבט עקרוני ביחס לאופק המקומי',300,335,19);
 }
 function drawScenes(){if(pane.hidden)return;if(settings.topic==='atmosphere')pressureScene();if(settings.topic==='terrain')orographicScene();if(settings.topic==='solar')solarScene();}
 function stop(){playing=false;cancelAnimationFrame(raf);raf=0;q('#orographicPlay').textContent='הפעלה';q('#orographicPlay').setAttribute('aria-pressed','false');}
 function frame(now){if(!playing)return;if(pane.hidden||q('#terrainLesson').hidden||!q('#mapDrawer').open){stop();return;}sceneTime=Math.min(1,sceneTime+Math.min(.06,(now-lastFrame)/1000)/9);lastFrame=now;orographicScene();if(sceneTime>=1)stop();else raf=requestAnimationFrame(frame);}
 function pick(){settings.inspect=true;sync();atlasInterface.close();canvas.focus({preventScroll:true});}
 Object.keys(names).forEach(k=>q('#'+k+'Toggle').onclick=()=>{settings[k]=!settings[k];if(settings[k])settings.topic=k;if(k==='terrain'&&settings[k])loadTerrain();render();});
 q('#openLearning').onclick=()=>openLesson();tab.onclick=()=>openLesson();q('#learningTopic').onchange=e=>{settings.topic=e.target.value;stop();sync();};
 q('#learningPlace').value='0';q('#learningPlace').onchange=e=>{if(e.target.value!==''){settings.point=places[Number(e.target.value)].slice(1);sync();draw();}};
 q('#pickLearningPoint').onclick=pick;inspect.onclick=()=>{if(settings.inspect){settings.inspect=false;sync();}else pick();};
 q('#learningMonths').querySelectorAll('button').forEach(b=>b.onclick=()=>q('[data-month="'+b.dataset.learningMonth+'"]').click());
 q('#terrainOpacity').oninput=e=>{settings.terrainOpacity=Number(e.target.value)/100;draw();};
 q('#ridgeSelect').onchange=e=>{settings.ridge=e.target.value;sync();draw();};
 q('#focusRidge').onclick=()=>{const r=ridges.find(r=>r.id===settings.ridge);settings.point=[...r.center];q('#learningPlace').value='';state.zoom=3;const s=Math.min(cssW/W,cssH/H)*state.zoom,p=projection(r.center);state.panX=(W/2-p[0])*s;state.panY=(H/2-p[1])*s;sync();if(innerWidth<=900)atlasInterface.close();draw();};
 q('#ridgeWorld').onclick=()=>{reset();if(innerWidth<=900)atlasInterface.close();};
 q('#orographicMoist').onchange=e=>{settings.moist=e.target.checked;orographicScene();};
 q('#orographicPlay').onclick=()=>{if(playing){stop();return;}if(sceneTime>=1)sceneTime=0;playing=true;lastFrame=performance.now();q('#orographicPlay').textContent='השהיה';q('#orographicPlay').setAttribute('aria-pressed','true');raf=requestAnimationFrame(frame);};
 q('#orographicStep').onclick=()=>{stop();sceneTime=Math.min(1,Math.round(sceneTime*3+1)/3);orographicScene();};q('#orographicReset').onclick=()=>{stop();sceneTime=0;orographicScene();};
 pane.querySelectorAll('[data-pressure-point]').forEach(b=>b.onclick=()=>{const lat=Number(b.dataset.pressurePoint);settings.point=[20,lat===0?AtlasAtmosphere.itcz(20,month()):lat];q('#learningPlace').value='';sync();draw();});
 document.addEventListener('atlas:render',sync);q('#mapDrawer').addEventListener('close',stop);
 new MutationObserver(()=>{if(!pane.hidden)drawScenes();else stop();}).observe(pane,{attributes:true,attributeFilter:['hidden']});
 window.atlasLearning={settings,draw:drawOverlays,selectPoint,showTooltip,elevationAt,loadTerrain,open:openLesson,terrainReady:()=>!!terrain,sceneProgress:()=>sceneTime,terrainInfo:()=>terrain?{grid:terrain.grid,sha256:terrain.file.sha256}:null};
 sync();
})();
