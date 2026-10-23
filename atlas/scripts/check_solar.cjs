'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const solar = require('../solar-model.js');
const near = (actual, expected, tolerance=1e-10) => assert.ok(Math.abs(actual-expected)<=tolerance, `${actual} != ${expected} +/- ${tolerance}`);

// Independent geometrical check: rotate the observer's surface normal through
// one day and count positive dot products with a fixed unit solar vector.
// It does not use the analytical inverse-cosine day-length solution.
function sampledDaylight(latitude, declination) {
 const r=Math.PI/180, n=144000, sun=[Math.cos(declination*r),0,Math.sin(declination*r)];
 let lit=0;
 for(let i=0;i<n;i++){
  const rotation=2*Math.PI*(i+.5)/n;
  const normal=[Math.cos(latitude*r)*Math.cos(rotation),Math.cos(latitude*r)*Math.sin(rotation),Math.sin(latitude*r)];
  if(normal[0]*sun[0]+normal[1]*sun[1]+normal[2]*sun[2]>1e-12)lit++;
 }
 return lit*24/n;
}
assert.equal(solar.dayOfYear(1,1),1);
assert.equal(solar.dayOfYear(3,1),60);
assert.equal(solar.dayOfYear(12,31),365);
near(solar.declinationForDate(6,21),23.44,.1);
near(solar.declinationForDate(12,21),-23.44,.1);
near(solar.declinationForDate(3,21),0,.15);
near(solar.declinationForDate(9,23),0,.35);
near(solar.declinationForDate(1,15),-21.3,.2);
near(solar.declinationForDate(7,15),21.6,.2);

for(const d of [-23.44,0,23.44]){
 for(const lat of [-90,-80,-66.5,-45,-23.44,0,23.44,45,66.5,80,90]){
  const hours=solar.daylightHoursAt(lat,d);
  near(hours,sampledDaylight(lat,d),.0004);
  near(hours,solar.daylightHoursAt(-lat,-d));
  if(Math.abs(lat)<90)near(hours+solar.daylightHoursAt(-lat,d),24);
  const p=lat*Math.PI/180,dec=d*Math.PI/180;
  const noonFromVector=Math.asin(Math.sin(p)*Math.sin(dec)+Math.cos(p)*Math.cos(dec))*180/Math.PI;
  near(solar.solarNoonAltitudeAt(lat,d),noonFromVector,1e-6);
 }
}
near(solar.daylightHoursAt(0,23.44),12);
near(solar.daylightHoursAt(45,0),12);
near(solar.solarNoonAltitudeAt(23.44,23.44),90);
assert.equal(solar.daylightHoursAt(90,0),0); // Centre remains on horizon.
assert.equal(solar.daylightHoursAt(-90,0),0);

for(const month of [1,7]){
 for(const lat of [-90,-80,-45,0,31.8,45,80,90]){
  const m=solar.metrics(35.2,lat,month);
  near(m.daylightHours,sampledDaylight(lat,m.declination),.0004);
  assert.ok(Number.isFinite(m.solarNoonAltitude));
  assert.ok(m.daylightHours>=0&&m.daylightHours<=24);
  assert.equal(m.noonSunVisible,m.solarNoonAltitude>0);
  assert.equal(m.daylightHours,solar.metrics(-160,lat,month).daylightHours);
 }
}
assert.ok(solar.metrics(35.2,31.8,7).daylightHours>solar.metrics(35.2,31.8,1).daylightHours);
assert.ok(solar.metrics(35.2,-31.8,7).daylightHours<solar.metrics(35.2,-31.8,1).daylightHours);
assert.equal(solar.metrics(0,90,1).polarNight,true);
assert.equal(solar.metrics(0,90,7).polarDay,true);
assert.equal(solar.metrics(0,-90,1).polarDay,true);
assert.equal(solar.metrics(0,-90,7).polarNight,true);
assert.ok(solar.metrics(0,90,1).solarNoonAltitude<0);
for(let month=1;month<=12;month++)for(let day=1;day<=28;day++)assert.ok(Math.abs(solar.declinationForDate(month,day))<23.5);

for(const bad of [NaN,Infinity,-Infinity,undefined,null,'45']){
 assert.throws(()=>solar.metrics(bad,0,1),RangeError);
 assert.throws(()=>solar.metrics(0,bad,1),RangeError);
}
for(const args of [[181,0,1],[-181,0,1],[0,90.1,1],[0,-90.1,1],[0,0,0],[0,0,13],[0,0,1.5],[0,0,2,29],[0,0,4,31]])assert.throws(()=>solar.metrics(...args),RangeError);

// Also run the exact browser module in an isolated Window-like context.
const context=vm.createContext({window:{}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../solar-model.js'),'utf8'),context);
near(context.window.AtlasSolar.metrics(35.2,31.8,7).daylightHours,solar.metrics(35.2,31.8,7).daylightHours);
console.log('SOLAR_CHECKS_PASSED: equinoxes/solstices, date validation, independent vector sampling, hemispheres, poles, longitude invariance, browser/CommonJS exports');
console.log(JSON.stringify({jerusalemJanuary:solar.metrics(35.2,31.8,1),jerusalemJuly:solar.metrics(35.2,31.8,7)}));
