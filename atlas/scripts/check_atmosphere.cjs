const assert=require('node:assert/strict');
const A=require('../atmosphere-model.js');
for(let month=1;month<=12;month++){
 for(const lon of [-180,-100,0,50,180]){
  assert.equal(A.itcz(-180,month),A.itcz(180,month));
  for(const lat of [-75,-45,45,75]){
   const w=A.wind(lon,lat,month);
   assert.equal(w.east,Math.abs(lat)<60?1:-1);
   assert.equal(Math.sign(w.north),Math.abs(lat)<60?Math.sign(lat):-Math.sign(lat));
  }
  const itcz=A.itcz(lon,month);
  for(const lat of [-25,25])assert.equal(Math.sign(A.wind(lon,lat,month).north),Math.sign(itcz-lat));
  assert.equal(A.zone(lon,itcz,month),'convergence');
  assert.equal(A.zone(lon,30,month),'subtropicalHigh');
  assert.equal(A.zone(lon,60,month),'subpolarLow');
  assert.equal(A.zone(lon,-80,month),'polarHigh');
 }
}
assert.ok(A.itcz(25,7)>A.itcz(25,1));
assert.equal(A.wind(25,10,7).east,1); // northward cross-equatorial summer flow turns east in NH
assert.equal(A.wind(25,-5,1).east,1); // southward cross-equatorial flow turns east in SH
assert.equal(A.zone(80,10,7),'crossEquatorial');
assert.equal(A.zone(25,-5,1),'crossEquatorial');
assert.throws(()=>A.wind(0,95,1),RangeError);
for(const month of [0,13,1.5,NaN])assert.throws(()=>A.itcz(0,month),RangeError);
for(const lon of [-180,-120,0,25,80,180]){
 const lo=Math.min(A.itcz(lon,1),A.itcz(lon,7)),hi=Math.max(A.itcz(lon,1),A.itcz(lon,7));
 for(let m=1;m<=12;m++)assert.ok(A.itcz(lon,m)>=lo-1e-9&&A.itcz(lon,m)<=hi+1e-9);
 assert.ok(Math.abs(A.itcz(lon,4)-(lo+hi)/2)<1e-9);
 assert.ok(Math.abs(A.itcz(lon,10)-(lo+hi)/2)<1e-9);
}
console.log('ATMOSPHERE_CHECKS_PASSED: conceptual wind directions in both hemispheres, seasonal convergence, periodic longitude, pressure zones, inputs');
