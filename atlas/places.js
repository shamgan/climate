'use strict';
/* Country/area names are polygon matches from a pinned, attributed Natural Earth
 * source, never nearest-centroid guesses. Raw antimeridian splits and holes stay. */
(() => {
 const dataUrl='data/places/countries.json?v=20261024-ux2';
 let data=null,pending=null,retryAt=0;
 const displayNames=typeof Intl.DisplayNames==='function'?new Intl.DisplayNames(['he'],{type:'region'}):null;
 function validPoint(point){return Array.isArray(point)&&point.length===2&&point.every(Number.isFinite)&&Math.abs(point[1])<=90;}
 function fallback(point){
  if(!validPoint(point))return 'מיקום לא מזוהה';
  return Math.abs(point[1])<=5?'סביב קו המשווה':point[1]>0?'חצי הכדור הצפוני':'חצי הכדור הדרומי';
 }
 function decodeRing(encoded,scale){
  const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)),ring=[];
  let offset=0,x=0,y=0;
  function next(){
   let value=0,shift=0,byte;
   do{if(offset>=bytes.length||shift>28)throw Error('Invalid place coordinate');byte=bytes[offset++];value|=(byte&127)<<shift;shift+=7;}while(byte&128);
   return value&1?-(value+1)/2:value/2;
  }
  while(offset<bytes.length){x+=next();y+=next();ring.push([x/scale,y/scale]);}
  if(ring.length<4||ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1])throw Error('Unclosed place polygon');
  return ring;
 }
 // Coordinates use the dataset's antimeridian-cut planar rings. Orientation is
 // immaterial to ray casting, unlike spherical geoContains winding conventions.
 function inRing(point,ring){
  const [x,y]=point;let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
   const [ax,ay]=ring[j],[bx,by]=ring[i],cross=(x-ax)*(by-ay)-(y-ay)*(bx-ax);
   if(Math.abs(cross)<1e-9&&x>=Math.min(ax,bx)-1e-9&&x<=Math.max(ax,bx)+1e-9&&y>=Math.min(ay,by)-1e-9&&y<=Math.max(ay,by)+1e-9)return true;
   if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
  }
  return inside;
 }
 function inPolygon(point,polygon){
  const [bounds,rings]=polygon,[x,y]=point;
  if(x<bounds[0]||y<bounds[1]||x>bounds[2]||y>bounds[3])return false;
  return inRing(point,rings[0])&&!rings.slice(1).some(ring=>inRing(point,ring));
 }
 function prepare(value){
  if(value.schemaVersion!==1||value.coordinateScale!==10000||!Array.isArray(value.features)||value.features.length!==242)throw Error('Unexpected place dataset');
  return {source:value.source,features:value.features.map(feature=>{
   if(typeof feature.code!=='string'||typeof feature.name!=='string'||!Array.isArray(feature.polygons))throw Error('Invalid place record');
   let name=feature.code==='PS'?'הלבנט':feature.name;
   if(!name&&/^[A-Z]{2}$/.test(feature.code))try{name=displayNames?.of(feature.code)||'';}catch{}
   if(!name)name=feature.fallback||fallback([0,0]);
   return {code:feature.code,name,polygons:feature.polygons.map(([bounds,rings])=>{
    if(bounds.length!==4||!bounds.every(Number.isFinite)||!rings.length)throw Error('Invalid place extent');
    return [bounds.map(n=>n/value.coordinateScale),rings.map(ring=>decodeRing(ring,value.coordinateScale))];
   })};
  })};
 }
 async function load(){
  if(data)return data;if(pending)return pending;if(Date.now()<retryAt)return null;
  pending=(async()=>{
   const response=await fetch(dataUrl);if(!response.ok)throw Error('Place data HTTP '+response.status);
   data=prepare(await response.json());retryAt=0;
   document.dispatchEvent(new Event('atlas:places-ready'));
   return data;
  })().catch(()=>{retryAt=Date.now()+3000;return null;}).finally(()=>{pending=null;});
  return pending;
 }
 function featureAt(point){
  if(!validPoint(point)||!data)return null;
  const longitude=((point[0]+180)%360+360)%360-180,normalized=[longitude,point[1]];
  for(const feature of data.features)if(feature.polygons.some(polygon=>inPolygon(normalized,polygon)))return feature;
  // +180 and -180 identify the same meridian; either cut edge may own it.
  if(longitude===-180)for(const feature of data.features)if(feature.polygons.some(polygon=>inPolygon([180,point[1]],polygon)))return feature;
  return null;
 }
 function nameAt(point){if(!validPoint(point))return fallback(point);if(!data)void load();return featureAt(point)?.name||fallback(point);}
 window.atlasPlaceName=nameAt;
 window.atlasPlaces={load,ready:()=>!!data,source:()=>data?.source||null,codeAt:point=>featureAt(point)?.code||null};
 if(typeof module==='object'&&module.exports)module.exports={decodeRing,inRing,inPolygon,prepare,fallback};
})();
