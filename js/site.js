/* Hoppi Galoppi Solutions – Website: Inhalte aus content.json, Countdown, Intro, Navigation, Vollbild-Spiel, Burger-Menü */

/* Inhalte laden. Auch game.js wartet darauf (Sprüche, Endwertung). */
window.HG_CONTENT=fetch('content.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()});

/* ---------- Inhalte einsetzen (Team, Turnier, Geschichte) ----------
   Alles aus content.json wird maskiert (esc) oder per textContent eingesetzt, nie als rohes HTML. */
(()=>{
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const pad=n=>String(n).padStart(2,'0');

/* „Zum Team“-Pfeil unten im Startbild verschwindet, sobald gescrollt wird */
const scrollHint=document.querySelector('.scroll');
const onScroll=()=>scrollHint&&scrollHint.classList.toggle('hide',scrollY>60);
addEventListener('scroll',onScroll,{passive:true});onScroll();

/* Team: eine Karte pro Person mit Kugel in den eigenen Farben.
   Die Farben landen im style-Attribut: nur Hex-Farben zulassen (sonst Standardfarben) */
const KUGEL=['#ffb066','#ff7a1a','#a84300'];
const hex=v=>/^#[0-9a-f]{3,8}$/i.test(v);
function renderTeam(c){
 if(c.team_untertitel)$('teamSub').textContent=c.team_untertitel;
 $('teamList').innerHTML=(c.team||[]).map(m=>{
  const k=Array.isArray(m.kugel)&&m.kugel.length===3&&m.kugel.every(hex)?m.kugel:KUGEL;
  return `<div class="m">`
   +`<div class="ball" style="background:radial-gradient(circle at 32% 28%,${k[0]},${k[1]} 45%,${k[2]})"></div>`
   +`<h3>${esc(m.name)}</h3><div class="role">${esc(m.rolle)}</div><p>${esc(m.text)}</p></div>`;
 }).join('');
}

/* Nächstes Turnier mit Countdown (jede Sekunde). Meldung je nach Abstand: weit (über 60 Tage), nah, heute, vorbei */
function renderTurnier(c){
 const t=c.turnier||{};
 if(t.text)$('turnierText').textContent=t.text;
 const date=new Date(t.datum);
 const tick=()=>{
  const now=new Date(),d=date-now;
  const today=now.toDateString()===date.toDateString()&&t.meldung_heute;
  if(!(d>0)){
   ['D','H','M','S'].forEach(k=>$('cd'+k).textContent='00');
   $('cdmsg').textContent=today||t.meldung_vorbei||'';
   return;
  }
  const days=Math.floor(d/864e5);
  $('cdD').textContent=pad(days);
  $('cdH').textContent=pad(Math.floor(d/36e5)%24);
  $('cdM').textContent=pad(Math.floor(d/6e4)%60);
  $('cdS').textContent=pad(Math.floor(d/1e3)%60);
  $('cdmsg').textContent=today||(days>60?(t.meldung_weit||''):(t.meldung_nah||''));
 };
 tick();setInterval(tick,1000);
}

/* Geschichte: Kennzahlen und Turnierliste. Einträge mit `typ` sind Sonderfälle (Pause, Gründung …),
   alle anderen normale Turniere mit Rang; Rang 1–3 wird hervorgehoben */
function renderGeschichte(c){
 const g=c.geschichte||{};
 if(g.untertitel)$('histSub').textContent=g.untertitel;
 $('stats').innerHTML=(g.zahlen||[]).map(s=>`<div><b>${esc(s.wert)}</b><span>${esc(s.text)}</span></div>`).join('');
 $('hist').innerHTML=(g.eintraege||[]).map(e=>{
  if(e.typ){
   const cls=e.typ==='pause'?'pause':'gr';
   return `<li class="${cls}"><div class="rk">${esc(e.label)}</div>`
    +`<div><h3>${esc(e.titel)}</h3><p class="dt">${esc(e.datum)}</p><p>${esc(e.text)}</p><p class="jk">${esc(e.witz)}</p></div></li>`;
  }
  return `<li${e.rang<=3?' class="top"':''}><div class="rk">${esc(e.rang)}.<small>Rang</small></div>`
   +`<div><h3>${esc(e.liga)}</h3><p class="dt">${esc(e.datum)}</p>`
   +`<p>Das Team schliesst am ${esc(e.turnier_nr)}. Bowlingturnier der BZ Ost mit Rang ${esc(e.rang)} in der ${esc(e.liga)} ab.</p>`
   +`<p class="jk">${esc(e.witz)}</p></div></li>`;
 }).join('');
}

HG_CONTENT.then(c=>{
 renderTeam(c);
 renderTurnier(c);
 renderGeschichte(c);
}).catch(err=>{
 console.warn('content.json konnte nicht geladen werden',err);
 ['teamList','hist'].forEach(id=>{const el=$(id);if(el)el.innerHTML='<p class="sub">Inhalte konnten nicht geladen werden.</p>'});
});
})();

/* ---------- Intro: Bahn geht an ----------
   Beim Laden ist die Bahn dunkel (Klasse lane-off, gesetzt im Kopf von index.html, nicht bei reduzierter Bewegung).
   Sie geht an, sobald die Leuchtschrift brennt, spätestens nach 4.5 s. Jede Interaktion überspringt das Intro. */
(()=>{
const root=document.documentElement,neon=document.querySelector('.tag em');
const monitor=document.querySelector('.monitor'),playBtn=document.querySelector('.playbtn');
const lightUp=()=>{
 if(!root.classList.contains('lane-off'))return;
 root.classList.remove('lane-off');root.classList.add('lit');
};
addEventListener('neon-on',lightUp);
if(!root.classList.contains('lane-off'))return;
setTimeout(lightUp,4500);
const skip=()=>{
 if(neon&&!neon.classList.contains('on')){neon.classList.add('on');dispatchEvent(new Event('neon-start'))}
 lightUp();
};
['scroll','wheel','touchstart','keydown','pointerdown'].forEach(t=>addEventListener(t,skip,{once:true,passive:true}));
if(monitor)monitor.addEventListener('pointerdown',lightUp);
if(playBtn)playBtn.addEventListener('click',lightUp);
})();

/* ---------- Leuchtschrift „So geht Bowling!“ ----------
   Geht an (Animation neon, meldet dann neon-on) und flackert danach ab und zu kurz (zap, alle 9–25 s) */
(()=>{
const neon=document.querySelector('.tag em');
if(!neon||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
const nextZap=t=>setTimeout(()=>{
 neon.classList.remove('zap');void neon.offsetWidth; // Animation neu starten
 neon.classList.add('zap');
},t??9000+Math.random()*16000);
let started=false;
const start=()=>{if(started)return;started=true;neon.classList.add('on');nextZap(1000)};
addEventListener('neon-start',start);
neon.addEventListener('animationend',e=>{
 if(e.animationName==='neon'){start();dispatchEvent(new Event('neon-on'))}
 else if(e.animationName==='zap'){neon.classList.remove('zap');nextZap()}
});
})();

/* ---------- Navigation: aktuellen Abschnitt hervorheben ----------
   Aktiv ist der letzte Abschnitt, dessen Oberkante die obersten 40 % des Fensters erreicht hat; ganz unten der letzte */
(()=>{
const links=[...document.querySelectorAll('.bar nav a')]
 .map(a=>({a,section:document.querySelector(a.getAttribute('href'))}))
 .filter(l=>l.section);
let raf=0;
const update=()=>{
 raf=0;
 const y=innerHeight*.4;let cur=null;
 for(const l of links)if(l.section.getBoundingClientRect().top<=y)cur=l;
 if(innerHeight+scrollY>=document.documentElement.scrollHeight-4)cur=links[links.length-1];
 for(const l of links){
  l.a.classList.toggle('act',l===cur);
  if(l===cur)l.a.setAttribute('aria-current','true');else l.a.removeAttribute('aria-current');
 }
};
addEventListener('scroll',()=>{raf||(raf=requestAnimationFrame(update))},{passive:true});
addEventListener('resize',update);
update();
})();

/* ---------- Spiel im Vollbild (Handy) ----------
   „Zur Bowlingbahn“ öffnet, × oder Escape schliesst. Der Fokus springt jeweils auf den Gegenknopf. */
(()=>{
const playBtn=document.querySelector('.playbtn'),closeBtn=document.querySelector('.xbtn');
if(!playBtn||!closeBtn)return;
const setPlay=on=>{document.body.classList.toggle('play',on);(on?closeBtn:playBtn).focus()};
playBtn.addEventListener('click',()=>setPlay(true));
closeBtn.addEventListener('click',()=>setPlay(false));
addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('play'))setPlay(false)});
})();

/* ---------- Burger-Menü (nur auf schmalen Bildschirmen sichtbar) ----------
   Schliesst bei Klick auf einen Link, Klick daneben oder Escape */
(()=>{
const nav=document.querySelector('.nav'),burger=nav&&nav.querySelector('.burger');
if(!burger)return;
const isOpen=()=>nav.classList.contains('open');
const setOpen=on=>{
 nav.classList.toggle('open',on);
 burger.setAttribute('aria-expanded',String(on));
 burger.setAttribute('aria-label',on?'Menü schliessen':'Menü');
};
burger.addEventListener('click',()=>setOpen(!isOpen()));
nav.querySelectorAll('nav a').forEach(a=>a.addEventListener('click',()=>setOpen(false)));
document.addEventListener('click',e=>{if(isOpen()&&!nav.contains(e.target))setOpen(false)});
addEventListener('keydown',e=>{if(e.key==='Escape'&&isOpen()){setOpen(false);burger.focus()}});
})();
