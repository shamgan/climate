/* Conceptual surface circulation, not measured winds or sea-level pressure.
 * Sources: https://www.noaa.gov/jetstream/global/global-atmospheric-circulations
 * https://www.noaa.gov/jetstream/tropical/convergence-zone
 * ITCZ anchors are deliberately approximate teaching geometry. They are not
 * an observational climatology, an isobar, or a prediction of local weather.
 */
(function(root){
 'use strict';
 const anchors={
  1:[[-180,3],[-150,4],[-120,4],[-90,1],[-60,-8],[-30,0],[0,-3],[25,-12],[50,-10],[80,-7],[110,-8],[135,-14],[160,-5],[180,3]],
  7:[[-180,7],[-150,8],[-120,10],[-90,12],[-60,9],[-30,8],[0,15],[25,18],[50,18],[80,22],[110,16],[135,12],[160,8],[180,7]]
 };
 function itcz(lon,month){
  const pts=anchors[month];if(!pts||!Number.isFinite(lon)||Math.abs(lon)>180)throw new RangeError('Invalid month/longitude');
  for(let i=1;i<pts.length;i++)if(lon<=pts[i][0]){const a=pts[i-1],b=pts[i];return a[1]+(b[1]-a[1])*(lon-a[0])/(b[0]-a[0]);}
 }
 function wind(lon,lat,month){
  if(!Number.isFinite(lat)||Math.abs(lat)>90)throw new RangeError('Invalid latitude');
  const target=itcz(lon,month),a=Math.abs(lat),hem=lat>=0?1:-1;
  if(a>=60)return {east:-1,north:-hem,kind:'polar'};
  if(a>=30)return {east:1,north:hem,kind:'westerlies'};
  const north=Math.sign(target-lat);
  return {east:lat*north>0?1:-1,north,kind:lat*north>0?'crossEquatorial':'trade'};
 }
 function zone(lon,lat,month){
  const a=Math.abs(lat);
  if(Math.abs(lat-itcz(lon,month))<5)return 'convergence';
  if(a>=75)return 'polarHigh';
  if(a>=55&&a<=67)return 'subpolarLow';
  if(a>=25&&a<=36)return 'subtropicalHigh';
  if(a<30&&wind(lon,lat,month).kind==='crossEquatorial')return 'crossEquatorial';
  return a<30?'trade':a<60?'westerlies':'polar';
 }
 const api=Object.freeze({anchors,itcz,wind,zone});
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.AtlasAtmosphere=api;
})(typeof window!=='undefined'?window:null);
