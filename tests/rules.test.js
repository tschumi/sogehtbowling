/* Tests für js/rules.js – ausführen mit: node --test */
const {test,describe}=require('node:test');
const assert=require('node:assert/strict');
const R=require('../js/rules.js');

/* Spielt eine Folge von Würfen (Pins pro Wurf) mit derselben Ablauflogik wie das Spiel durch */
function play(rolls){
 const frames=Array.from({length:10},()=>[]);let f=0,up=10,over=false;
 for(const n of rolls){
  if(over)throw new Error('Wurf nach Spielende');
  const r=frames[f],fresh=up===10,left=up-n;
  r.push(n);
  const next=R.nextStep(r,f,fresh&&n===10,left);
  if(next==='frame'){f++;up=10}
  else if(next==='keep')up=left;
  else if(next==='fresh')up=10;
  else over=true;
 }
 return {frames,over,scores:R.scores(frames),marks:frames.map((r,i)=>R.marks(r,i).join(''))};
}
const zeros=n=>Array(n).fill(0);

describe('Punktezählung ganzer Spiele',()=>{
 const cases=[
  ['perfektes Spiel',Array(12).fill(10),300],
  ['nur Rinnen',zeros(20),0],
  ['lauter 9-0',Array.from({length:20},(_,i)=>i%2?0:9),90],
  ['lauter 5/5',Array(21).fill(5),150],
  ['lauter Spares 9/1 mit 9',Array.from({length:21},(_,i)=>i%2?1:9),190],
  ['Beispielspiel',[10,7,3,9,0,10,0,8,8,2,0,6,10,10,10,8,1],167],
  ['Spiel aus dem Screenshot',[10,8,2,10,10,9,1,10,9,1,9,1,10,8,1],196],
  ['10. Frame: Spare + Strike',[...zeros(18),0,10,10],20],
  ['10. Frame: Strike, 4, Spare',[...zeros(18),10,4,6],20],
  ['10. Frame: Strike, 4, 3',[...zeros(18),10,4,3],17],
  ['10. Frame: drei Strikes',[...zeros(18),10,10,10],30],
 ];
 for(const [name,rolls,expected] of cases){
  test(name,()=>{
   const g=play(rolls);
   assert.equal(g.over,true,'Spiel sollte vorbei sein');
   assert.equal(g.scores[9],expected);
   assert.equal(R.total(g.frames),expected);
  });
 }
 test('Zwischenstände im Beispielspiel',()=>{
  assert.deepEqual(play([10,7,3,9,0,10,0,8,8,2,0,6,10,10,10,8,1]).scores,[20,39,48,66,74,84,90,120,148,167]);
 });
});

describe('Offene Boni',()=>{
 test('Strike bleibt leer, bis zwei weitere Würfe gemacht sind',()=>{
  assert.deepEqual(R.scores([[10],[],[],[],[],[],[],[],[],[]]).slice(0,2),[null,null]);
  assert.deepEqual(R.scores([[10],[3],[],[],[],[],[],[],[],[]]).slice(0,2),[null,null]);
  assert.deepEqual(R.scores([[10],[3,4],[],[],[],[],[],[],[],[]]).slice(0,2),[17,24]);
 });
 test('Spare wartet auf einen Wurf',()=>{
  assert.equal(R.scores([[6,4],[],[],[],[],[],[],[],[],[]])[0],null);
  assert.equal(R.scores([[6,4],[5],[],[],[],[],[],[],[],[]])[0],15);
 });
 test('nach offenem Frame zählen spätere Frames erst mit',()=>{
  assert.deepEqual(R.scores([[10],[10],[2,3],[],[],[],[],[],[],[]]).slice(0,3),[22,37,42]);
 });
 test('Gesamtpunkte = letzter bekannter Stand',()=>{
  assert.equal(R.total([[3,4],[10],[],[],[],[],[],[],[],[]]),7);
  assert.equal(R.total(Array.from({length:10},()=>[])),0);
 });
});

describe('Anzeige der Würfe',()=>{
 test('Frames 1–9',()=>{
  assert.deepEqual(R.marks([10],0),['','X']);
  assert.deepEqual(R.marks([7,3],0),['7','/']);
  assert.deepEqual(R.marks([0,10],0),['-','/']);
  assert.deepEqual(R.marks([9,0],0),['9','-']);
  assert.deepEqual(R.marks([0,0],0),['-','-']);
  assert.deepEqual(R.marks([4],0),['4','']);
  assert.deepEqual(R.marks([],0),['','']);
 });
 test('10. Frame',()=>{
  assert.deepEqual(R.marks([10,10,10],9),['X','X','X']);
  assert.deepEqual(R.marks([10,4,6],9),['X','4','/']);
  assert.deepEqual(R.marks([10,4,3],9),['X','4','3']);
  assert.deepEqual(R.marks([0,10,10],9),['-','/','X']);
  assert.deepEqual(R.marks([7,3,5],9),['7','/','5']);
  assert.deepEqual(R.marks([8,1],9),['8','1','']);
  assert.deepEqual(R.marks([10,0,0],9),['X','-','-']);
 });
});

describe('Ablauf',()=>{
 test('Frames 1–9: Strike oder zweiter Wurf beendet den Frame',()=>{
  assert.equal(R.nextStep([10],0,true,0),'frame');
  assert.equal(R.nextStep([3],0,false,7),'keep');
  assert.equal(R.nextStep([3,4],0,false,3),'frame');
  assert.equal(R.nextStep([3,7],8,false,0),'frame');
 });
 test('10. Frame: Bonuswürfe nur nach Strike oder Spare',()=>{
  assert.equal(R.nextStep([10],9,true,0),'fresh');
  assert.equal(R.nextStep([3],9,false,7),'keep');
  assert.equal(R.nextStep([3,4],9,false,3),'end');
  assert.equal(R.nextStep([3,7],9,false,0),'fresh');
  assert.equal(R.nextStep([10,10],9,true,0),'fresh');
  assert.equal(R.nextStep([10,4],9,false,6),'keep');
  assert.equal(R.nextStep([10,4,6],9,false,0),'end');
  assert.equal(R.nextStep([10,10,10],9,true,0),'end');
 });
 test('ein Spiel hat nie mehr als 21 Würfe',()=>{
  assert.throws(()=>play(Array(13).fill(10)),/Spielende/);
  assert.throws(()=>play(Array(22).fill(5)),/Spielende/);
 });
});

describe('Spruchgruppe je Situation',()=>{
 const k=o=>R.spruchKey(o);
 test('erster Wurf',()=>{
  assert.equal(k({fresh:true,n:10,left:0}),'strike');
  assert.equal(k({fresh:true,n:0,left:10,gut:true}),'rinne1');
  assert.equal(k({fresh:true,n:0,left:10}),'luft1');
  assert.equal(k({fresh:true,n:9,left:1}),'neun1');
  assert.equal(k({fresh:true,n:8,left:2,mitte:true}),'mitte1');
  assert.equal(k({fresh:true,n:8,left:2}),'viel1');
  assert.equal(k({fresh:true,n:3,left:7}),'wenig1');
  assert.equal(k({fresh:true,n:6,left:4}),'mittel1');
 });
 test('zweiter Wurf',()=>{
  assert.equal(k({fresh:false,n:3,left:0}),'spare');
  assert.equal(k({fresh:false,n:0,left:4,gut:true}),'rinne2');
  assert.equal(k({fresh:false,n:0,left:4}),'luft2');
  assert.equal(k({fresh:false,n:2,left:1}),'knapp2');
  assert.equal(k({fresh:false,n:2,left:2}),'rest2gut');
  assert.equal(k({fresh:false,n:2,left:5}),'rest2mittel');
  assert.equal(k({fresh:false,n:1,left:8}),'rest2schwach');
 });
 test('letzter Wurf auf frische Pins verspricht keinen weiteren Wurf',()=>{
  assert.equal(k({fresh:true,n:0,left:10,last:true}),'ende0');
  assert.equal(k({fresh:true,n:0,left:10,gut:true,last:true}),'ende0');
  assert.equal(k({fresh:true,n:4,left:6,last:true}),'ende_wenig');
  assert.equal(k({fresh:true,n:9,left:1,last:true}),'ende_viel');
 });
 test('Strike und Spare bleiben auch im letzten Wurf',()=>{
  assert.equal(k({fresh:true,n:10,left:0,last:true}),'strike');
  assert.equal(k({fresh:false,n:6,left:0,last:true}),'spare');
  assert.equal(k({fresh:false,n:3,left:3,last:true}),'rest2gut');
 });
 test('jede mögliche Situation führt zu einer bekannten Gruppe',()=>{
  for(const fresh of [true,false])for(const last of [true,false])for(const gut of [true,false])for(const mitte of [true,false])
   for(let up=1;up<=10;up++)for(let n=0;n<=up;n++){
    if(fresh&&up!==10)continue;
    assert.ok(R.KEYS.includes(k({fresh,n,left:up-n,gut,mitte,last})));
   }
 });
});

describe('Spruchauswahl',()=>{
 const S={
  strike:{any:['A','B'],schnell:['S1','S2'],sanft:['L']},
  viel1:{any:['Noch {rest} übrig.']},
  leer:{any:[]},
 };
 test('Tempo-Kategorien',()=>{
  assert.equal(R.tempo(6),'sanft');
  assert.equal(R.tempo(9),'');
  assert.equal(R.tempo(12),'schnell');
 });
 test('nie zweimal hintereinander derselbe Spruch',()=>{
  for(const v of [6,9,12.5]){
   const say=R.createSay(()=>S);let prev;
   for(let i=0;i<2000;i++){const t=say('strike',0,v);assert.notEqual(t,prev);prev=t}
  }
 });
 test('alle Sprüche einer Gruppe kommen vor',()=>{
  const say=R.createSay(()=>S),seen=new Set();
  for(let i=0;i<500;i++)seen.add(say('strike',0,9));
  assert.deepEqual([...seen].sort(),['A','B']);
 });
 test('Tempo-Sprüche werden bevorzugt, allgemeine bleiben möglich',()=>{
  const say=R.createSay(()=>S),seen=new Set();
  for(let i=0;i<500;i++)seen.add(say('strike',0,12.5));
  assert.deepEqual([...seen].sort(),['A','B','S1','S2']);
 });
 test('einzelner Tempo-Spruch wiederholt sich nicht, es wird auf allgemeine ausgewichen',()=>{
  const say=R.createSay(()=>S);let prev;
  for(let i=0;i<500;i++){const t=say('strike',0,6);assert.notEqual(t,prev);prev=t}
 });
 test('{rest} wird durch das Zahlwort ersetzt',()=>{
  const say=R.createSay(()=>S);
  assert.equal(say('viel1',3,9),'Noch drei übrig.');
 });
 test('fehlende oder leere Gruppe ergibt leeren Text',()=>{
  const say=R.createSay(()=>S);
  assert.equal(say('gibtsnicht',0,9),'');
  assert.equal(say('leer',0,9),'');
  assert.equal(R.createSay(()=>undefined)('strike',0,9),'');
 });
});

describe('Bewertung am Spielende',()=>{
 const L=[{ab:0,text:'a'},{ab:100,text:'b'},{ab:300,text:'c'}];
 test('höchste erreichte Stufe',()=>{
  assert.equal(R.rating(L,0),'a');
  assert.equal(R.rating(L,99),'a');
  assert.equal(R.rating(L,100),'b');
  assert.equal(R.rating(L,300),'c');
 });
 test('ohne Liste kein Text',()=>{
  assert.equal(R.rating(undefined,150),'');
  assert.equal(R.rating([],150),'');
 });
});
