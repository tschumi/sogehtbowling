/* Tests für js/physics.js – ausführen mit: node --test
   Die Spielbarkeits-Tests werfen ein paar tausend Kugeln mit festem Zufall (immer gleiches Ergebnis)
   und schlagen fehl, wenn eine Änderung an TUNING das Spiel deutlich zu leicht oder zu schwer macht. */
const {test,describe}=require('node:test');
const assert=require('node:assert/strict');
const P=require('../js/physics.js');

/* Zufall mit festem Startwert */
function seeded(seed){
 let a=seed;
 return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
}
function gauss(rand){let u=0,v=0;while(!u)u=rand();while(!v)v=rand();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}

/* Ein Wurf auf zehn frische Pins, bis alles ruhig ist (wie im Spiel: 20 Schritte ohne Bewegung) */
function roll(lane,tx,v,sx){
 lane.rack();lane.launch(tx,v,sx);
 let calm=0,n=0;
 while(calm<=20&&n++<3000){lane.step();calm=lane.moving()?0:calm+1}
 return lane.pins.filter(p=>p.d).length;
}

/* Strike-Quote für einen Zielpunkt (Abstand zur Mitte, abwechselnd links und rechts).
   start: Startpunkt der Kugel als Abstand zur Mitte, auf derselben Seite wie das Ziel (negativ = gegenüber).
   Der simulierte Spieler streut beim Zielen etwas und wirft unterschiedlich hart. */
function strikeRate(offset,throws=800,seed=7,start=0){
 const rand=seeded(seed),lane=P.createLane({rand});
 let strikes=0;
 for(let i=0;i<throws;i++){
  const side=i%2?1:-1;
  const tx=P.MID+side*offset+gauss(rand)*5,v=Math.max(5,Math.min(13,10+gauss(rand)*1.5));
  if(roll(lane,tx,v,P.MID+side*start)===10)strikes++;
 }
 return strikes/throws;
}

describe('Aufstellung',()=>{
 test('zehn stehende Pins im Dreieck 4-3-2-1, vorderster Pin in der Mitte',()=>{
  const lane=P.createLane({rand:seeded(1)});lane.rack();
  assert.equal(lane.pins.length,10);
  assert.ok(lane.pins.every(p=>!p.d));
  const rows=[...new Set(lane.pins.map(p=>p.y))];
  assert.deepEqual(rows.map(y=>lane.pins.filter(p=>p.y===y).length),[4,3,2,1]);
  const head=lane.pins.find(p=>p.y===P.HEAD_Y);
  assert.equal(head.x,P.MID);
 });
 test('Pins passen auf die Bahn',()=>{
  for(const [x] of P.SPOTS)assert.ok(x>66&&x<294,`Pin bei x=${x} liegt in der Rinne`);
 });
});

describe('Wurf',()=>{
 test('gleicher Zufall ergibt exakt den gleichen Wurf',()=>{
  const a=P.createLane({rand:seeded(5)}),b=P.createLane({rand:seeded(5)});
  roll(a,190,10);roll(b,190,10);
  assert.deepEqual(a.pins.map(p=>[p.x,p.y,p.d]),b.pins.map(p=>[p.x,p.y,p.d]));
 });
 test('Rinnenwurf trifft keinen Pin',()=>{
  const lane=P.createLane({rand:seeded(2)});
  assert.equal(roll(lane,332,10),0);
  assert.equal(lane.gutter,true);
 });
 test('Kugel ist nach dem Wurf weg und alles kommt zur Ruhe',()=>{
  const lane=P.createLane({rand:seeded(3)});
  roll(lane,185,12);
  assert.equal(lane.ball,null);
  assert.equal(lane.moving(),false);
 });
});

describe('Spielbarkeit (Simulation mit 800 Würfen pro Zielpunkt und Startpunkt)',()=>{
 const center=strikeRate(0),pocket=strikeRate(10),wide=strikeRate(20);
 const pct=x=>Math.round(x*100)+' %';
 test(`Tasche: Strike-Quote zwischen 25 und 55 % (aktuell ${pct(pocket)})`,()=>{
  assert.ok(pocket>=.25,`Strikes zu selten (${pct(pocket)}): TUNING.pinImpulse oder pocketCarry erhöhen`);
  assert.ok(pocket<=.55,`Strikes zu häufig (${pct(pocket)}): TUNING.pinImpulse oder pocketCarry senken`);
 });
 test(`Tasche lohnt sich mehr als die Mitte (${pct(pocket)} gegenüber ${pct(center)})`,()=>{
  assert.ok(pocket>center,'In echt bringt die Tasche mehr Strikes als ein frontaler Treffer: pocketCarry/headOnCarry prüfen');
 });
 test(`deutlich daneben gibt weniger Strikes als die Tasche (${pct(wide)} gegenüber ${pct(pocket)})`,()=>{
  assert.ok(wide<pocket);
 });
 test(`auch auf die Mitte bleibt ein Strike möglich (aktuell ${pct(center)})`,()=>{
  assert.ok(center>=.1,'Mitte zu schwer: headOnCarry erhöhen');
 });
 const angled=strikeRate(10,800,7,45),crossed=strikeRate(10,800,7,-45);
 test(`Winkel in die Tasche lohnt sich: Start auf der Taschenseite ${pct(angled)}, aus der Mitte ${pct(pocket)}`,()=>{
  assert.ok(angled>pocket,'Schräger Einschlag sollte mehr Strikes bringen: TUNING.angleCarry prüfen');
  assert.ok(angled<=pocket+.15,'Winkelbonus zu stark: TUNING.angleCarry senken');
 });
 test(`über die Bahn kreuzend gibt weniger Strikes (${pct(crossed)} gegenüber ${pct(pocket)})`,()=>{
  assert.ok(crossed<pocket);
 });
});
