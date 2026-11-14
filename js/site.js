/* Hoppi Galoppi Solutions – Website (Inhalte, Countdown, Intro, Navigation) */
window.HG_CONTENT=fetch('content.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()});
(()=>{
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const sc=document.querySelector('.scroll'),onS=()=>sc&&sc.classList.toggle('hide',scrollY>60);addEventListener('scroll',onS,{passive:true});onS();
HG_CONTENT.then(c=>{
 // Team
 if(c.team_untertitel)$('teamSub').textContent=c.team_untertitel;
 $('teamList').innerHTML=(c.team||[]).map(m=>{const k=m.kugel||['#ffb066','#ff7a1a','#a84300'];
  return `<div class="m"><div class="ball" style="background:radial-gradient(circle at 32% 28%,${esc(k[0])},${esc(k[1])} 45%,${esc(k[2])})"></div><h3>${esc(m.name)}</h3><div class="role">${esc(m.rolle)}</div><p>${esc(m.text)}</p></div>`}).join('');
 // Turnier + Countdown
 const t=c.turnier||{};if(t.text)$('turnierText').textContent=t.text;
 const T=new Date(t.datum);
 const tick=()=>{let d=T-new Date();
  const heute=new Date().toDateString()===T.toDateString()&&t.meldung_heute;
  if(!(d>0)){['D','H','M','S'].forEach(k=>$('cd'+k).textContent='00');$('cdmsg').textContent=heute||t.meldung_vorbei||'';return}
  const D=Math.floor(d/864e5),p=n=>String(n).padStart(2,'0');$('cdD').textContent=p(D);$('cdH').textContent=p(Math.floor(d/36e5)%24);$('cdM').textContent=p(Math.floor(d/6e4)%60);$('cdS').textContent=p(Math.floor(d/1e3)%60);
  $('cdmsg').textContent=heute||(D>60?(t.meldung_weit||''):(t.meldung_nah||''))};
 tick();setInterval(tick,1000);
 // Geschichte
 const g=c.geschichte||{};if(g.untertitel)$('histSub').textContent=g.untertitel;
 $('stats').innerHTML=(g.zahlen||[]).map(s=>`<div><b>${esc(s.wert)}</b><span>${esc(s.text)}</span></div>`).join('');
 $('hist').innerHTML=(g.eintraege||[]).map(e=>{
  if(e.typ){const cls=e.typ==='pause'?'pause':'gr';return `<li class="${cls}"><div class="rk">${esc(e.label)}</div><div><h3>${esc(e.titel)}</h3><p class="dt">${esc(e.datum)}</p><p>${esc(e.text)}</p><p class="jk">${esc(e.witz)}</p></div></li>`}
  return `<li${e.rang<=3?' class="top"':''}><div class="rk">${esc(e.rang)}.<small>Rang</small></div><div><h3>${esc(e.liga)}</h3><p class="dt">${esc(e.datum)}</p><p>Das Team schliesst am ${esc(e.turnier_nr)}. Bowlingturnier der BZ Ost mit Rang ${esc(e.rang)} in der ${esc(e.liga)} ab.</p><p class="jk">${esc(e.witz)}</p></div></li>`}).join('');
}).catch(err=>{console.warn('content.json konnte nicht geladen werden',err);
 ['teamList','hist'].forEach(id=>{const el=$(id);if(el)el.innerHTML='<p class="sub">Inhalte konnten nicht geladen werden.</p>'})});
})();
(()=>{const root=document.documentElement,e=document.querySelector('.tag em'),mon=document.querySelector('.monitor'),pb=document.querySelector('.playbtn');
const lit=()=>{if(!root.classList.contains('lane-off'))return;root.classList.remove('lane-off');root.classList.add('lit');};
addEventListener('neon-on',lit);
if(!root.classList.contains('lane-off'))return;
setTimeout(lit,4500);
const skip=()=>{if(e&&!e.classList.contains('on')){e.classList.add('on');dispatchEvent(new Event('neon-start'))}lit()};
['scroll','wheel','touchstart','keydown','pointerdown'].forEach(t=>addEventListener(t,skip,{once:true,passive:true}));
if(mon)mon.addEventListener('pointerdown',lit);if(pb)pb.addEventListener('click',lit);
})();
(()=>{const e=document.querySelector('.tag em');if(!e||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
const next=t=>setTimeout(()=>{e.classList.remove('zap');void e.offsetWidth;e.classList.add('zap')},t??9000+Math.random()*16000);
let started=0;const start=()=>{if(started)return;started=1;e.classList.add('on');next(1000)};
addEventListener('neon-start',start);
e.addEventListener('animationend',ev=>{if(ev.animationName==='neon'){start();dispatchEvent(new Event('neon-on'))}else if(ev.animationName==='zap'){e.classList.remove('zap');next()}});
})();
(()=>{const links=[...document.querySelectorAll('.bar nav a')].map(a=>({a,s:document.querySelector(a.getAttribute('href'))})).filter(l=>l.s);
let raf=0;const upd=()=>{raf=0;const y=innerHeight*.4;let cur=null;
for(const l of links)if(l.s.getBoundingClientRect().top<=y)cur=l;
if(innerHeight+scrollY>=document.documentElement.scrollHeight-4)cur=links[links.length-1];
for(const l of links){l.a.classList.toggle('act',l===cur);l===cur?l.a.setAttribute('aria-current','true'):l.a.removeAttribute('aria-current')}};
addEventListener('scroll',()=>{raf||(raf=requestAnimationFrame(upd))},{passive:true});addEventListener('resize',upd);upd();
})();
(()=>{const b=document.querySelector('.playbtn'),x=document.querySelector('.xbtn');if(!b||!x)return;
const set=on=>{document.body.classList.toggle('play',on);(on?x:b).focus()};
b.addEventListener('click',()=>set(true));x.addEventListener('click',()=>set(false));
addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('play'))set(false)});
})();
/* Hamburger-Menü (nur auf schmalen Bildschirmen sichtbar) */
(()=>{const nav=document.querySelector('.nav'),b=nav&&nav.querySelector('.burger');if(!b)return;
const set=on=>{nav.classList.toggle('open',on);b.setAttribute('aria-expanded',String(on));b.setAttribute('aria-label',on?'Menü schliessen':'Menü')};
b.addEventListener('click',()=>set(!nav.classList.contains('open')));
nav.querySelectorAll('nav a').forEach(a=>a.addEventListener('click',()=>set(false)));
document.addEventListener('click',e=>{if(nav.classList.contains('open')&&!nav.contains(e.target))set(false)});
addEventListener('keydown',e=>{if(e.key==='Escape'&&nav.classList.contains('open')){set(false);b.focus()}});
})();
