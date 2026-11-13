/* Hoppi Galoppi Solutions – Bowling-Regeln (ohne DOM, testbar mit `node --test`)
   Im Browser als window.HGRules, in Node per require('./js/rules.js'). */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.HGRules=factory();
})(typeof self!=='undefined'?self:this,function(){
'use strict';

/* ---------- Zählung ---------- */

/* Anzeige der Würfe eines Frames: 'X' Strike, '/' Spare, '-' für 0, sonst die Zahl.
   Frames 1–9 haben 2 Kästchen (Strike steht im zweiten), Frame 10 hat 3. */
function marks(r,f){
 const m=v=>v===0?'-':String(v);
 if(f<9)return r[0]===10?['','X']:[r[0]===undefined?'':m(r[0]),r[1]===undefined?'':r[0]+r[1]===10?'/':m(r[1])];
 const o=[];let up=10,fresh=true;
 r.forEach(v=>{
  if(fresh&&v===10)o.push('X');
  else if(!fresh&&v===up){o.push('/');up=10;fresh=true}
  else{o.push(m(v));if(fresh){up=10-v;fresh=false}else{up=10;fresh=true}}
 });
 while(o.length<3)o.push('');
 return o;
}

/* Laufende Punktzahl pro Frame. null, solange der Bonus eines Frames (oder eines früheren) noch offen ist. */
function scores(frames){
 const flat=[].concat(...frames),out=[];let i=0,cum=0,known=true;
 frames.forEach((r,f)=>{
  let v=null;
  if(f<9){
   if(r[0]===10){if(flat[i+2]!==undefined)v=10+flat[i+1]+flat[i+2]}
   else if(r.length===2){const s=r[0]+r[1];if(s<10)v=s;else if(flat[i+2]!==undefined)v=10+flat[i+2]}
  }
  else if(r.length===3||(r.length===2&&r[0]+r[1]<10))v=r.reduce((a,b)=>a+b,0);
  i+=r.length;
  if(v===null)known=false;
  if(known){cum+=v;out.push(cum)}else out.push(null);
 });
 return out;
}

/* Letzte bekannte Gesamtpunktzahl */
function total(frames){return scores(frames).filter(x=>x!==null).pop()||0}

/* ---------- Ablauf ---------- */

/* Was nach einem Wurf passiert. r = Würfe des aktuellen Frames (inkl. diesem), f = Frame-Index 0–9,
   strike = alle 10 auf frischen Pins, left = stehende Pins nach dem Wurf.
   'frame' nächster Frame · 'keep' gleiche Pins weiter · 'fresh' neue Pins im 10. Frame · 'end' Spielende */
function nextStep(r,f,strike,left){
 if(f<9)return strike||r.length===2?'frame':'keep';
 if(r.length===1)return strike?'fresh':'keep';
 if(r.length===2&&r[0]+r[1]>=10)return left===0?'fresh':'keep';
 return 'end';
}

/* ---------- Sprüche ---------- */

const ZAHL=['keiner','einer','zwei','drei','vier','fünf','sechs','sieben','acht','neun','zehn'];

/* Alle Spruchgruppen, die das Spiel verwenden kann */
const KEYS=['strike','rinne1','luft1','wenig1','mittel1','mitte1','viel1','neun1',
 'spare','rinne2','luft2','knapp2','rest2gut','rest2mittel','rest2schwach',
 'ende0','ende_wenig','ende_viel'];

/* Welche Spruchgruppe passt?
   fresh = Wurf auf 10 stehende Pins, n = umgefallen, left = stehen noch, gut = Rinne,
   mitte = nur Aussenpins stehen (nach 8), last = letzter Wurf des Spiels */
function spruchKey({fresh,n,left,gut=false,mitte=false,last=false}){
 const all=10-left;
 if(last&&fresh&&n<10)return n===0?'ende0':n<=5?'ende_wenig':'ende_viel';
 if(fresh){
  if(n===10)return'strike';
  if(n===0)return gut?'rinne1':'luft1';
  if(left===1)return'neun1';
  if(n===8&&mitte)return'mitte1';
  return n<=3?'wenig1':n<=6?'mittel1':'viel1';
 }
 if(left===0)return'spare';
 if(n===0)return gut?'rinne2':'luft2';
 if(left===1)return'knapp2';
 return all>=7?'rest2gut':all>=4?'rest2mittel':'rest2schwach';
}

/* Tempo-Kategorie aus der Wurfgeschwindigkeit */
function tempo(v){return v<6.5?'sanft':v>11.5?'schnell':''}

/* Spruchauswahl mit Gedächtnis: nie zweimal hintereinander derselbe Spruch pro Gruppe.
   getSprueche liefert das Objekt aus content.json (kann später nachgeladen werden). */
function createSay(getSprueche,rand=Math.random){
 const last={},pick=a=>a[Math.floor(rand()*a.length)];
 return function say(key,left,v){
  const g=(getSprueche()||{})[key];if(!g||!g.any||!g.any.length)return '';
  const t0=tempo(v),pool=g[t0]&&g[t0].length&&rand()<.6?g[t0]:g.any,no=x=>x!==last[key];
  const a=pool.filter(no),b=g.any.filter(no);
  const t=pick(a.length?a:b.length?b:pool);last[key]=t;
  return t.replace('{rest}',ZAHL[left]);
 };
}

/* Bewertung am Spielende: höchster Eintrag mit ab <= score */
function rating(list,score){const w=(list||[]).filter(x=>score>=x.ab).pop();return w?w.text:''}

return {marks,scores,total,nextStep,ZAHL,KEYS,spruchKey,tempo,createSay,rating};
});
