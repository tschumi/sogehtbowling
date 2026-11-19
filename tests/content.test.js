/* Prüft content.json auf Fehler, die beim Bearbeiten der Texte passieren können – ausführen mit: node --test */
const {test,describe}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const R=require('../js/rules.js');

const content=JSON.parse(fs.readFileSync(path.join(__dirname,'..','content.json'),'utf8'));
const S=content.sprueche;
const TEMPI=['any','schnell','sanft'];

/* Kleinste Anzahl stehender Pins, mit der eine Gruppe vorkommen kann (für {rest}) */
function minLeft(){
 const m={};
 for(const fresh of [true,false])for(const last of [true,false])for(const gut of [true,false])for(const mitte of [true,false])
  for(let up=1;up<=10;up++)for(let n=0;n<=up;n++){
   if(fresh&&up!==10)continue;
   const left=up-n,k=R.spruchKey({fresh,n,left,gut,mitte,last});
   m[k]=Math.min(m[k]??99,left);
  }
 return m;
}

describe('Sprüche',()=>{
 test('jede Gruppe, die das Spiel verwendet, existiert und hat allgemeine Sprüche',()=>{
  for(const k of R.KEYS){
   assert.ok(S[k],`Gruppe "${k}" fehlt`);
   assert.ok(Array.isArray(S[k].any)&&S[k].any.length>0,`Gruppe "${k}" braucht mindestens einen Spruch in "any"`);
  }
 });
 test('keine unbekannten Gruppen (Tippfehler im Namen)',()=>{
  for(const k of Object.keys(S))assert.ok(R.KEYS.includes(k),`Gruppe "${k}" wird vom Spiel nie verwendet`);
 });
 test('nur bekannte Tempo-Listen, alle mit Text gefüllt',()=>{
  for(const [k,g] of Object.entries(S))for(const [t,list] of Object.entries(g)){
   assert.ok(TEMPI.includes(t),`"${k}.${t}": unbekannte Liste, erlaubt sind ${TEMPI.join(', ')}`);
   assert.ok(Array.isArray(list),`"${k}.${t}" muss eine Liste sein`);
   for(const s of list)assert.ok(typeof s==='string'&&s.trim()!=='',`"${k}.${t}" enthält einen leeren Spruch`);
  }
 });
 test('keine doppelten Sprüche innerhalb einer Gruppe',()=>{
  for(const [k,g] of Object.entries(S)){
   const all=TEMPI.flatMap(t=>g[t]||[]);
   const dup=all.filter((s,i)=>all.indexOf(s)!==i);
   assert.deepEqual(dup,[],`"${k}" enthält doppelte Sprüche`);
  }
 });
 test('keine Leerzeichen am Anfang oder Ende',()=>{
  for(const [k,g] of Object.entries(S))for(const t of TEMPI)for(const s of g[t]||[])
   assert.equal(s,s.trim(),`"${k}.${t}": "${s}"`);
 });
 test('Strike- und Spare-Sprüche wiederholen den Titel nicht',()=>{
  for(const k of ['strike','spare'])for(const t of TEMPI)for(const s of S[k][t]||[])
   assert.doesNotMatch(s,/^(Strike|Spare)[!.]/i,`"${k}.${t}": "${s}" – der Titel steht schon gross im Stern`);
 });
 test('{rest} nur dort, wo mindestens zwei Pins stehen (sonst falsche Grammatik)',()=>{
  const m=minLeft();
  for(const [k,g] of Object.entries(S))for(const t of TEMPI)for(const s of g[t]||[]){
   if(!s.includes('{rest}'))continue;
   assert.ok(m[k]>=2,`"${k}.${t}": "${s}" – hier kann {rest} "${R.ZAHL[m[k]]}" sein`);
  }
 });
 test('keine unbekannten Platzhalter',()=>{
  for(const [k,g] of Object.entries(S))for(const t of TEMPI)for(const s of g[t]||[])
   for(const p of s.match(/\{[^}]*\}/g)||[])assert.equal(p,'{rest}',`"${k}.${t}": unbekannter Platzhalter ${p}`);
 });
 test('Schweizer Schreibweise: kein ß',()=>{
  for(const [k,g] of Object.entries(S))for(const t of TEMPI)for(const s of g[t]||[])
   assert.doesNotMatch(s,/ß/,`"${k}.${t}": "${s}"`);
 });
});

describe('Bewertung am Spielende',()=>{
 const W=content.endwertung;
 test('ist eine Liste mit Punktgrenze und Text',()=>{
  assert.ok(Array.isArray(W)&&W.length>0,'"endwertung" fehlt oder ist leer');
  for(const w of W){
   assert.ok(Number.isInteger(w.ab),`"ab" muss eine ganze Zahl sein: ${JSON.stringify(w)}`);
   assert.ok(typeof w.text==='string'&&w.text.trim()!=='',`Text fehlt: ${JSON.stringify(w)}`);
  }
 });
 test('beginnt bei 0, damit jedes Ergebnis eine Bewertung bekommt',()=>{
  assert.equal(W[0].ab,0);
 });
 test('Grenzen sind aufsteigend und liegen zwischen 0 und 300',()=>{
  for(let i=0;i<W.length;i++){
   assert.ok(W[i].ab>=0&&W[i].ab<=300,`Grenze ausserhalb 0–300: ${W[i].ab}`);
   if(i)assert.ok(W[i].ab>W[i-1].ab,`Grenzen nicht aufsteigend: ${W[i-1].ab} → ${W[i].ab}`);
  }
 });
 test('jede mögliche Punktzahl ergibt einen Text',()=>{
  for(let s=0;s<=300;s++)assert.notEqual(R.rating(W,s),'',`keine Bewertung für ${s} Punkte`);
 });
});

describe('Neuer Rekord und Teilen',()=>{
 test('"rekord" ist eine Liste mit Texten, nur Platzhalter {bisher}, kein ß',()=>{
  const L=content.rekord;
  assert.ok(Array.isArray(L)&&L.length>0,'"rekord" fehlt oder ist leer');
  for(const s of L){
   assert.ok(typeof s==='string'&&s.trim()!=='',`leerer Text in "rekord"`);
   for(const p of s.match(/\{[^}]*\}/g)||[])assert.equal(p,'{bisher}',`"rekord": unbekannter Platzhalter ${p}`);
   assert.doesNotMatch(s,/ß/,`"rekord": "${s}"`);
  }
 });
 test('"teilen" ist ein Text, höchstens Platzhalter {punkte}, kein ß',()=>{
  const T=content.teilen;
  assert.ok(typeof T==='string'&&T.trim()!=='','"teilen" fehlt oder ist kein Text');
  for(const p of T.match(/\{[^}]*\}/g)||[])assert.equal(p,'{punkte}',`"teilen": unbekannter Platzhalter ${p}`);
  assert.doesNotMatch(T,/ß/,'"teilen"');
 });
});

describe('Team',()=>{
 test('Kugelfarben sind drei Hex-Farben (sonst nimmt die Seite die Standardfarben)',()=>{
  for(const m of content.team||[])if(m.kugel!==undefined){
   assert.ok(Array.isArray(m.kugel)&&m.kugel.length===3,`${m.name}: "kugel" braucht drei Farben`);
   for(const c of m.kugel)assert.match(c,/^#[0-9a-f]{3,8}$/i,`${m.name}: "${c}" ist keine Hex-Farbe wie #ff7a1a`);
  }
 });
});
