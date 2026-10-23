const assert=require('node:assert/strict');
const A=require('../atmosphere-model.js');
for(const month of [1,7]){
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
assert.throws(()=>A.wind(0,95,1),RangeError);
assert.throws(()=>A.itcz(0,2),RangeError);
console.log('ATMOSPHERE_CHECKS_PASSED: conceptual wind directions in both hemispheres, seasonal convergence, periodic longitude, pressure zones, inputs');
