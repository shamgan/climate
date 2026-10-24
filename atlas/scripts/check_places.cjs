'use strict';
const fs=require('fs'),assert=require('assert/strict'),path=require('path');
const root=path.resolve(__dirname,'..'),data=JSON.parse(fs.readFileSync(path.join(root,'data/places/countries.json'),'utf8'));
let fetchCount=0,events=0;
global.window={};global.document={dispatchEvent:e=>{assert.equal(e.type,'atlas:places-ready');events++;}};
global.fetch=async()=>{fetchCount++;return{ok:true,json:async()=>data};};
const helpers=require('../places.js');
(async()=>{
 assert.equal(window.atlasPlaces.ready(),false);
 assert.equal(fetchCount,0,'No initial network request');
 assert.equal(window.atlasPlaceName([20,10]),'חצי הכדור הצפוני');
 await window.atlasPlaces.load();
 assert.equal(fetchCount,1);assert.equal(events,1);assert.equal(window.atlasPlaces.ready(),true);
 const tests=[
  ['Kenya',[37,0], 'KE'],['Tanzania',[35,-6],'TZ'],['South Africa',[24,-30],'ZA'],
  ['Lesotho hole',[28.2,-29.6],'LS'],['France',[2,47],'FR'],['Germany',[10,51],'DE'],
  ['Egypt',[30,27],'EG'],['India',[78,23],'IN'],['China',[105,35],'CN'],
  ['Japan',[138,36],'JP'],['Australia',[134,-25],'AU'],['Brazil',[-53,-10],'BR'],
  ['Canada',[-105,56],'CA'],['US',[-100,40],'US'],['Argentina',[-64,-35],'AR'],
  ['Fiji east',[179.1,-16.5],'FJ'],['Dateline Russia east',[179.9,66.5],'RU'],
  ['Dateline Russia west',[-179.9,66.5],'RU'],['Antarctica',[0,-85],'AQ'],
 ];
 for(const [name,point,code]of tests)assert.equal(window.atlasPlaces.codeAt(point),code,name);
 assert.equal(window.atlasPlaces.codeAt([0,0]),null,'Ocean must not get nearest country');
 assert.equal(window.atlasPlaceName([0,0]),'סביב קו המשווה');
 assert.equal(window.atlasPlaceName([0,-30]),'חצי הכדור הדרומי');
 assert.equal(window.atlasPlaceName([35.2,31.9]),'הלבנט');
 const square=[[0,0],[10,0],[10,10],[0,10],[0,0]],hole=[[3,3],[7,3],[7,7],[3,7],[3,3]];
 assert(helpers.inPolygon([2,2],[[0,0,10,10],[square,hole]]));
 assert(!helpers.inPolygon([5,5],[[0,0,10,10],[square,hole]]),'Holes excluded');
 assert(helpers.inRing([2,2],[...square].reverse()),'Ring orientation irrelevant');
 const east=[[179,-1],[180,-1],[180,1],[179,1],[179,-1]],west=[[-180,-1],[-179,-1],[-179,1],[-180,1],[-180,-1]];
 const split=[[[179,-1,180,1],[east]],[[-180,-1,-179,1],[west]]];
 const inside=p=>split.some(poly=>helpers.inPolygon(p,poly));
 assert(inside([179.5,0])&&inside([-179.5,0])&&!inside([0,0]),'Dateline split support');
 assert.equal(events,1);assert.equal(fetchCount,1);
 const vm=require('vm');let now=0,retryFetches=0,retryEvents=0;
 const sandbox={window:{},module:{exports:{}},Intl,Uint8Array,atob,Event,Date:{now:()=>now},document:{dispatchEvent:()=>retryEvents++},fetch:async()=>{retryFetches++;return retryFetches===1?{ok:false,status:503}:{ok:true,json:async()=>data};}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'places.js'),'utf8'),sandbox);
 sandbox.window.atlasPlaceName([20,10]);await sandbox.window.atlasPlaces.load();
 assert.equal(retryFetches,1);assert.equal(retryEvents,0);assert.equal(sandbox.window.atlasPlaces.ready(),false);
 now=4000;sandbox.window.atlasPlaceName([20,10]);await sandbox.window.atlasPlaces.load();
 assert.equal(retryFetches,2);assert.equal(retryEvents,1);assert.equal(sandbox.window.atlasPlaces.ready(),true);

 console.log('PLACE_CHECKS_PASSED: lazy one-time load,19 geographic samples,water fallback,regional label,holes,ring winding,dateline,transient-failure retry');
})().catch(e=>{console.error(e);process.exitCode=1;});
