/* Hoppi Galoppi Solutions – Bowling-Spiel (Canvas)

   Aufbau:
   - physics.js  Kugel, Pins, Zusammenstösse (ohne Grafik)
   - rules.js    Zählung, Frame-Ablauf, Spruchauswahl
   - comics.js   Comic-Einblendungen (Strike, Spare, Sprechblase, Abschluss-Stern)
   - game.js     (diese Datei) Ablauf eines Wurfs, Pinsetter, Zeichnen, Eingabe */
(()=>{

/* ========== Grundlagen ========== */

const P=window.HGPhysics,TUNING=P.TUNING,{W,H,MID,SPOTS,HEAD_Y}=P;
const {marks,scores,total,nextStep,spruchKey,createSay,rating}=window.HGRules;

const canvas=document.getElementById('lane'),ctx=canvas.getContext('2d');
const dpr=Math.min(window.devicePixelRatio||1,2);
canvas.width=W*dpr;canvas.height=H*dpr;ctx.scale(dpr,dpr);

const $=id=>document.getElementById(id);
const toast=$('toast'),overlay=$('pow'),laneWrap=document.querySelector('.lw');
const R=(a,b)=>a+Math.random()*(b-a);

/* Sprüche und Bewertung kommen aus content.json (geladen von site.js) */
let sprueche={},wertung=[];
(window.HG_CONTENT||Promise.resolve({})).then(c=>{
 if(c&&c.sprueche)sprueche=c.sprueche;
 if(c&&Array.isArray(c.endwertung))wertung=c.endwertung;
}).catch(()=>{});
const say=createSay(()=>sprueche);

/* ========== Spielzustand ========== */

/* Ablauf eines Wurfs: READY → ROLLING → (SCORING) → SHOWING → READY */
const READY=0,ROLLING=1,SCORING=2,SHOWING=3;
/* Pinsetter nach dem Wurf: NONE → PENDING (Meldung erscheint) → RUNNING (Pinsetter arbeitet) → NONE */
const RESET_NONE=0,RESET_PENDING=1,RESET_RUNNING=2;

const particles=[];
const lane=P.createLane({fx:{trail,burst}});
let state=READY,reset=RESET_NONE;
let settle=0;          // Schritte, in denen sich nichts mehr bewegt hat
let lastV=9;           // Tempo des letzten Wurfs (für Tempo-Sprüche)
let tick=0;            // Schrittzähler (für das Wackeln der Pins)
let frames=[],frameNo=1,ballInFrame=1,gameOver=false,finalScore=0;
let msgOpen=false,msgTimer=0;
let cheat=0;           // Test-Tasten (siehe unten)

/* ========== Partikel (nur Grafik) ========== */

function trail(x,y){
 for(let i=0;i<2;i++)particles.push({x:x+R(-5,5),y:y+10,vx:R(-.5,.5),vy:R(.3,1),l:.8,s:R(6,12),w:Math.random()<.5});
}
function burst(x,y,n){
 for(let i=0;i<n&&particles.length<400;i++)particles.push({x,y,vx:R(-2.2,2.2),vy:R(-2.2,2.2),l:1,s:R(8,16),w:Math.random()<.5});
}
function moveParticles(){
 particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.l-=.025});
 for(let i=particles.length-1;i>=0;i--)if(particles[i].l<=0)particles.splice(i,1);
}

/* ========== Einblendungen ========== */

function hideOverlays(){
 overlay.querySelectorAll('svg').forEach(s=>{s.classList.add('out');setTimeout(()=>s.remove(),300)});
 toast.classList.remove('low');
}
/* Comic-Stern (Strike, Spare, Abschluss) mit kurzem Wackeln der Bahn */
function comicTitle(kind,word,txt){
 HGComics.title(overlay,kind,word,txt);
 laneWrap.classList.remove('shake');void laneWrap.offsetWidth;laneWrap.classList.add('shake');
}
function comicBubble(title,txt){HGComics.bubble(overlay,title,txt)}
function showToast(a,b){toast.firstChild.textContent=a;toast.lastChild.textContent=b;toast.classList.add('on')}

/* ========== Pinsetter ==========
   Der Tisch fährt herunter, hebt stehende Pins an, der Rechen räumt gefallene Pins ab,
   der Tisch setzt die Pins wieder ab (oder stellt zehn neue auf).
   Die Schritte stehen als Aufträge in einer Warteschlange und laufen nacheinander ab. */

const TABLE_DOWN=44;                     // Tisch unten: Pins abgesetzt
const TABLE_UP=TABLE_DOWN-HEAD_Y-30;     // Tisch oben: ganz ausserhalb des Bildes
const TABLE_SPEED=2.2;
const table={y:TABLE_UP};
let rake=null;                           // Rechen, solange er läuft: {y, t}
const jobs=[];
const queue=(...a)=>jobs.push(...a);

/* keep = gleiche Pins weiter (2. Wurf), sonst zehn neue Pins */
function planReset(keep){
 lane.pins.forEach(p=>{p.vx=p.vy=p.vr=0;p.wob=0});
 const standing=lane.pins.filter(p=>!p.d);
 if(keep){
  queue({table:TABLE_DOWN},{wait:10},{run:()=>standing.forEach(p=>p.att=1)},{table:TABLE_UP},
   {rake:1,then:()=>{lane.pins=lane.pins.filter(p=>!p.d)}},{wait:6},
   {table:TABLE_DOWN},{wait:10},{run:()=>lane.pins.forEach(p=>{p.att=0;p.oy=0})},{table:TABLE_UP});
 }else{
  standing.forEach(p=>{p.d=true;p.r=R(-.5,.5)});
  queue({rake:1,then:()=>{lane.pins=[]}},{wait:6},
   {run:()=>{lane.rack();lane.pins.forEach(p=>{p.att=1;p.oy=TABLE_UP-TABLE_DOWN})}},{wait:14},
   {table:TABLE_DOWN},{wait:16},{run:()=>lane.pins.forEach(p=>{p.att=0;p.oy=0})},{table:TABLE_UP});
 }
}

/* Weiche Bewegung (ease-in-out), beim Absetzen ein kleines Nachfedern */
function moveTable(j){
 if(j.n===undefined){j.from=table.y;j.n=0;j.N=Math.max(1,Math.round(Math.abs(j.table-table.y)/TABLE_SPEED))}
 j.n++;
 const t=Math.min(1,j.n/j.N);
 let e=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
 if(j.table===TABLE_DOWN&&j.from<TABLE_DOWN&&t>.7)e+=.035*Math.sin(Math.PI*(t-.7)/.3);
 table.y=j.from+(j.table-j.from)*e;
 if(t>=1){table.y=j.table;jobs.shift()}
 lane.pins.forEach(p=>{if(p.att)p.oy=table.y-TABLE_DOWN});
}
function moveRake(j){
 if(!rake)rake={y:178,t:0};
 rake.t++;rake.y-=6;
 lane.pins.forEach(p=>{if(p.d&&p.y>rake.y-4)p.y=rake.y-4});
 if(rake.y<-24){rake=null;j.then&&j.then();jobs.shift()}
}
function runPinsetter(){
 if(!jobs.length)return;
 const j=jobs[0];
 if(j.table!==undefined)moveTable(j);
 else if(j.wait!==undefined){if(--j.wait<=0)jobs.shift()}
 else if(j.run){j.run();jobs.shift()}
 else if(j.rake)moveRake(j);
}

/* ========== Ablauf ========== */

function newGame(){
 frames=Array.from({length:10},()=>[]);
 frameNo=1;ballInFrame=1;gameOver=false;
 renderSheet();renderDots();
}

/* Wurf starten: tx = Ziel-x, pwr = Tempo (5 bis 13) */
function throwBall(tx,pwr){
 if(state!==READY)return;
 if(gameOver)newGame();
 state=ROLLING;settle=0;
 toast.classList.remove('on');hideOverlays();
 tx=Math.max(28,Math.min(332,tx));
 const v=lastV=pwr||9;
 applyCheat();
 if(cheat==='r'){cheat=0;tx=40}
 lane.launch(tx,v);
}

/* Wurf auswerten, sobald alles ruhig ist: Punkte eintragen, Spruch zeigen, Pinsetter einplanen */
function scoreThrow(){
 state=SCORING;
 const pins=lane.pins;
 const n=pins.filter(p=>p.d).length,left=pins.length-n,fresh=pins.length===10,all=10-left;
 const f=frameNo-1,r=frames[f];
 r.push(n);
 const strike=fresh&&n===10,spare=!fresh&&left===0;
 /* nächster Schritt: neuer Frame, gleiche Pins weiter, frisches Rack (10. Frame) oder Spielende */
 const next=nextStep(r,f,strike,left);
 const key=spruchKey({fresh,n,left,gut:lane.gutter,mitte:pins.filter(p=>!p.d).every(p=>p.k<1),last:next==='end'});
 const t=say(key,left,lastV);
 if(spare||strike)comicTitle(spare?'spare':'strike',spare?'SPARE!':'STRIKE!',t);
 else comicBubble((lane.gutter&&n===0)?'RINNE!':all+' von 10',t);
 clearTimeout(msgTimer);
 msgTimer=setTimeout(dismiss,(strike||spare)?4500+t.length*50:2600+t.length*42);
 if(next==='end'){gameOver=true;finalScore=renderSheet()}
 else renderSheet();

 const startReset=()=>{
  reset=RESET_RUNNING;
  if(next==='frame'){planReset(false);ballInFrame=1;frameNo++}
  else if(next==='end'){planReset(false);ballInFrame=1}
  else{planReset(next==='keep');ballInFrame++}
  renderSheet();renderDots();
 };
 state=SHOWING;msgOpen=true;reset=RESET_PENDING;
 setTimeout(startReset,900);
}

/* Meldung schliessen (Tipp auf die Bahn oder nach Ablauf der Zeit) */
const dismiss=()=>{
 if(state!==SHOWING||!msgOpen)return;
 toast.classList.remove('on','wait');hideOverlays();
 clearTimeout(msgTimer);msgOpen=false;
};

/* Ein Schritt (1/60 s): Pinsetter, Ablauf, Physik, Partikel */
function step(){
 runPinsetter();
 if(reset===RESET_RUNNING&&!jobs.length)reset=RESET_NONE;
 /* bereit für den nächsten Wurf, wenn Pinsetter fertig und Meldung zu */
 if(state===SHOWING&&!reset&&!msgOpen){
  state=READY;
  if(gameOver)comicTitle('end',String(finalScore),('Punkte! '+rating(wertung,finalScore)).trim());
 }
 tick++;
 lane.step(!!rake);
 moveParticles();
 if(state===ROLLING&&!lane.ball){
  settle=lane.moving()?0:settle+1;
  if(settle>20)scoreThrow();
 }
}

/* ========== Anzeige: Spielstand und Wurf-Punkte ========== */

function renderSheet(){
 const sc=scores(frames),cur=gameOver?-1:frameNo-1;
 $('sheet').innerHTML=frames.map((r,f)=>
  '<div class="fr'+(f===cur?' cur':'')+(f===9?' f10':'')+'">'+
  '<span class="n">'+(f+1)+'</span>'+
  '<span class="bx">'+marks(r,f).map(x=>'<i>'+x+'</i>').join('')+'</span>'+
  '<b>'+(sc[f]===null?'':sc[f])+'</b></div>').join('');
 const tot=total(frames);
 $('sheet').setAttribute('aria-label','Spielstand: Frame '+Math.min(frameNo,10)+', '+tot+' Punkte');
 return tot;
}
/* Im 10. Frame erscheint der dritte Punkt, sobald der Bonuswurf verdient ist (Strike oder Spare) */
function renderDots(){
 const d=document.querySelector('.dots'),r=frames[9]||[],bonus=r[0]===10||r[0]+r[1]>=10;
 d.classList.toggle('three',frameNo===10&&!gameOver&&(ballInFrame===3||bonus));
 d.querySelectorAll('i').forEach((x,i)=>x.classList.toggle('on',i<ballInFrame));
}

/* ========== Zeichnen ========== */

const PZ=TUNING.pinScale,BR=TUNING.ballRadius;
/* Die Pinsetter-Grafik wurde für Pin-Abstand 26 gezeichnet und wächst mit dem Abstand mit */
const XS=x=>MID+(x-MID)*TUNING.pinSpacing/26;

function drawLane(){
 ctx.clearRect(0,0,W,H);
 ctx.fillStyle='#0b0e1c';ctx.fillRect(0,0,W,H);
 /* Rinnen */
 ctx.fillStyle='#04050b';ctx.fillRect(42,0,22,H);ctx.fillRect(296,0,22,H);
 /* Holz mit Dielen */
 const g=ctx.createLinearGradient(0,0,0,H);
 g.addColorStop(0,'#a97639');g.addColorStop(.35,'#e2ad63');g.addColorStop(1,'#d19a52');
 ctx.fillStyle=g;ctx.fillRect(64,0,232,H);
 ctx.strokeStyle='rgba(60,30,0,.18)';ctx.lineWidth=1;
 for(let i=1;i<8;i++){ctx.beginPath();ctx.moveTo(64+i*29,0);ctx.lineTo(64+i*29,H);ctx.stroke()}
 /* Zielpfeile */
 ctx.fillStyle='rgba(90,45,10,.5)';
 for(let i=0;i<7;i++){
  const x=64+(i+.5)*232/7,y=360-(3-Math.abs(i-3))*14;
  ctx.beginPath();ctx.moveTo(x,y-10);ctx.lineTo(x-6,y+4);ctx.lineTo(x+6,y+4);ctx.fill();
 }
 /* Foul-Linie, Bahnrand, Grube hinter den Pins */
 ctx.fillStyle='rgba(255,255,255,.55)';ctx.fillRect(64,H-78,232,2);
 ctx.fillStyle='#ff7a1a';ctx.fillRect(40,0,2,H);ctx.fillRect(318,0,2,H);
 ctx.fillStyle='#000';ctx.fillRect(64,0,232,12);
}

function drawPin(p){
 const oy=p.oy||0;
 /* Schatten, solange der Pin angehoben ist */
 if(oy<-4){
  ctx.save();ctx.fillStyle='rgba(0,0,0,'+Math.max(0,.28+oy/600)+')';
  ctx.beginPath();ctx.ellipse(p.x,p.y+9*PZ,8*PZ,3*PZ,0,0,7);ctx.fill();ctx.restore();
 }
 ctx.save();
 if(p.att){
  /* hängt am Tisch: wird mit ihm grösser (näher), beim Aufsetzen leicht gestaucht */
  const ts=1+Math.max(0,TABLE_DOWN-table.y)/380,sq=Math.min(1,Math.max(0,table.y-TABLE_DOWN)/4);
  ctx.translate(MID+(p.x-MID)*ts,(p.y+oy)*ts);ctx.scale(ts*(1+.06*sq),ts*(1-.08*sq));
 }else{
  ctx.translate(p.x,p.y+oy);const sc=1+Math.max(0,-oy)/380;ctx.scale(sc,sc);
 }
 ctx.rotate(p.r+(p.wob?Math.sin(tick*.8)*p.wob*.5:0));
 ctx.scale(PZ,PZ);
 ctx.globalAlpha=(rake&&p.y<14)?Math.max(0,(p.y+10)/24):1;
 ctx.fillStyle='#f7f2e6';
 ctx.beginPath();ctx.ellipse(0,2,7,11,0,0,7);ctx.fill();
 ctx.beginPath();ctx.ellipse(0,-10,4.5,5,0,0,7);ctx.fill();
 ctx.fillStyle='#e0383e';ctx.fillRect(-4.5,-5,9,2.5);
 ctx.restore();
}

function drawTable(){
 if(table.y<=TABLE_DOWN-HEAD_Y-20)return; // ganz oben: nicht sichtbar
 const y=table.y,dy=y-TABLE_DOWN,ts=1+Math.max(0,TABLE_DOWN-y)/380;
 ctx.save();
 ctx.translate(MID,0);ctx.scale(ts,ts);ctx.translate(-MID,0);
 /* durchsichtiger Rahmen über dem Pin-Dreieck */
 ctx.beginPath();ctx.moveTo(XS(126),y+8);ctx.lineTo(XS(234),y+8);ctx.lineTo(194,HEAD_Y-8+dy);ctx.lineTo(166,HEAD_Y-8+dy);ctx.closePath();
 ctx.fillStyle='rgba(138,166,174,.3)';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#6f8a92';ctx.stroke();
 /* Querbalken mit Schrauben */
 const tg=ctx.createLinearGradient(0,y-8,0,y+8);tg.addColorStop(0,'#a9bec4');tg.addColorStop(1,'#5b737b');
 ctx.fillStyle=tg;ctx.beginPath();ctx.moveTo(XS(124),y-8);ctx.lineTo(XS(236),y-8);ctx.lineTo(XS(246),y+8);ctx.lineTo(XS(114),y+8);ctx.closePath();ctx.fill();
 ctx.fillStyle='#2f3f45';[132,150,168,192,210,228].forEach(x=>ctx.fillRect(XS(x)-2,y-1,4,4));
 /* Pin-Plätze */
 ctx.lineWidth=3;
 SPOTS.forEach(([sx,sy])=>{ctx.beginPath();ctx.ellipse(sx,sy+dy-7*PZ,6.5*PZ,3*PZ,0,0,7);ctx.strokeStyle='#8aa3ab';ctx.stroke()});
 ctx.restore();
}

function drawRake(){
 if(!rake)return;
 ctx.save();ctx.globalAlpha=Math.min(1,rake.t/8);
 ctx.fillStyle='rgba(0,0,0,.3)';ctx.fillRect(64,rake.y+5,232,5);
 const rg=ctx.createLinearGradient(0,rake.y-6,0,rake.y+6);
 rg.addColorStop(0,'#ffb066');rg.addColorStop(.5,'#ff7a1a');rg.addColorStop(1,'#b84a00');
 ctx.fillStyle=rg;ctx.fillRect(58,rake.y-6,244,12);
 ctx.restore();
}

function drawBall(){
 const b=lane.ball;if(!b)return;
 const q=ctx.createRadialGradient(b.x-BR/3,b.y-BR/3,BR/6,b.x,b.y,BR);
 q.addColorStop(0,b.g?'#9a6a3a':'#ff9448');q.addColorStop(.65,b.g?'#7a4a1a':'#ff7a1a');q.addColorStop(1,b.g?'#6a3d14':'#e8690f');
 ctx.fillStyle=q;ctx.beginPath();ctx.arc(b.x,b.y,BR,0,7);ctx.fill();
 /* drei Fingerlöcher, die sich mit der Kugel drehen */
 ctx.fillStyle='#0008';
 const ca=Math.cos(b.a||0),sa=Math.sin(b.a||0);
 [[-.28,-.42,.86],[.34,-.28,.9],[0,.12,.99]].forEach(([hx,hy,hz])=>{
  const y2=hy*ca-hz*sa,z=hy*sa+hz*ca;
  if(z>.15){ctx.beginPath();ctx.ellipse(b.x+hx*BR,b.y+y2*BR,1.6*BR/9,1.6*BR/9*z,0,0,7);ctx.fill()}
 });
}

function drawStar(x,y,s){
 ctx.beginPath();ctx.moveTo(x,y-s);ctx.lineTo(x+s*.25,y-s*.25);ctx.lineTo(x+s,y);ctx.lineTo(x+s*.25,y+s*.25);
 ctx.lineTo(x,y+s);ctx.lineTo(x-s*.25,y+s*.25);ctx.lineTo(x-s,y);ctx.lineTo(x-s*.25,y-s*.25);ctx.closePath();ctx.fill();
}
function drawParticles(){
 particles.forEach(p=>{ctx.fillStyle=p.w?'rgba(255,255,255,'+p.l+')':'rgba(255,170,60,'+p.l+')';drawStar(p.x,p.y,p.s*p.l/2)});
}

function draw(){
 drawLane();
 lane.pins.forEach(drawPin);
 drawTable();
 drawRake();
 drawBall();
 drawParticles();
}

/* ========== Hauptschleife ==========
   Fester Physik-Takt (60/s), unabhängig von der Bildrate: fehlen Bilder, werden Schritte nachgeholt */

const STEP=1000/60;
let acc=0,last=0,fpsN=0,fpsT=0,fpsEl=null;
function loop(ts){
 if(!document.hidden&&last){
  acc+=Math.min(ts-last,250);
  let k=0;
  while(acc>=STEP&&k<15){step();acc-=STEP;k++}
  if(k===15)acc=0;
  draw();updateMeter();
 }
 last=ts;
 if(fpsEl){fpsN++;if(ts-fpsT>=1000){fpsEl.textContent=Math.round(fpsN*1000/(ts-fpsT))+' fps';fpsN=0;fpsT=ts}}
 requestAnimationFrame(loop);
}

/* ========== Eingabe ==========
   Drücken = zielen, Halten = Wucht aufbauen (max. nach 1.6 s), Loslassen = werfen.
   Tastatur: Pfeile zielen, Enter/Leertaste halten und loslassen. */

const CHARGE_MS=1600;
const powerFill=$('pf'),powerValue=$('pv');
let charge=null,aimX=MID;

const toLaneX=e=>{const r=canvas.getBoundingClientRect();return Math.max(28,Math.min(332,(e.clientX-r.left)/r.width*W))};
const chargeLevel=()=>charge?Math.min(1,(performance.now()-charge.t)/CHARGE_MS):0;
const release=()=>{
 if(!charge)return;
 const v=5+8*chargeLevel(),x=aimX;
 charge=null;throwBall(x,v);
};
/* Im Balken: beim Laden das Tempo, sonst „Bereit“, sobald geworfen werden kann */
const powerBar=powerFill.parentElement;
let meterText='';
const updateMeter=()=>{
 const p=chargeLevel(),ready=!charge&&state===READY&&!gameOver;
 const text=charge?Math.round((5+8*p)*2.8)+' km/h':ready?'Bereit':'';
 powerFill.style.width=p*100+'%';
 if(text!==meterText){powerValue.textContent=meterText=text;powerBar.classList.toggle('ready',ready)}
};
/* nach Spielende: erster Klick/Tipp schliesst die Meldung und startet ein neues Spiel, wirft aber nicht */
const restart=()=>{newGame();toast.classList.remove('on');hideOverlays()};

canvas.addEventListener('pointerdown',e=>{
 if(state!==READY)return;
 e.preventDefault();
 if(gameOver){restart();return}
 try{canvas.setPointerCapture(e.pointerId)}catch(_){}
 aimX=toLaneX(e);charge={t:performance.now()};
 toast.classList.remove('on');hideOverlays();
});
canvas.addEventListener('pointerup',release);
canvas.addEventListener('pointercancel',()=>{charge=null});
laneWrap.addEventListener('pointerdown',dismiss);

canvas.addEventListener('keydown',e=>{
 if(state===SHOWING){
  if(['Enter',' ','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();dismiss()}
  return;
 }
 if(e.key==='ArrowLeft'||e.key==='ArrowRight'){
  e.preventDefault();
  aimX=Math.max(28,Math.min(332,aimX+(e.key==='ArrowLeft'?-14:14)));
  showToast('Ziel',aimX<150?'links':aimX>210?'rechts':'Mitte');
 }else if((e.key==='Enter'||e.key===' ')&&!e.repeat&&state===READY){
  e.preventDefault();
  if(gameOver){restart();return}
  toast.classList.remove('on');charge={t:performance.now()};
 }
});
canvas.addEventListener('keyup',e=>{if(e.key==='Enter'||e.key===' ')release()});

/* ========== Test-Modus (nur mit ?test in der Adresse) ==========
   Tasten für den nächsten Wurf: X = Strike, S = Spare, R = Rinne. Oben rechts die Bildrate. */

const TEST=new URLSearchParams(location.search).has('test');
const CHEATS={x:'Strike',s:'Spare',r:'Rinne'};
function applyCheat(){
 const pins=lane.pins;
 if(cheat==='x'){cheat=0;pins.forEach(p=>{p.d=true;p.r=R(-1,1)})}
 else if(cheat==='s'){
  /* erster Wurf: zwei Pins bleiben stehen, zweiter Wurf räumt ab */
  const st=pins.filter(p=>!p.d).sort(()=>Math.random()-.5).slice(0,pins.length===10?2:0);
  pins.forEach(p=>{if(!st.includes(p)){p.d=true;p.r=R(-1,1)}});
  cheat=pins.length===10?'s2':0;
 }
 else if(cheat==='s2'&&pins.length<10){cheat=0;pins.forEach(p=>{p.d=true;p.r=R(-1,1)})}
}
if(TEST){
 addEventListener('keydown',e=>{
  const k=(e.key||'').toLowerCase();
  if(!CHEATS[k]||e.ctrlKey||e.metaKey)return;
  cheat=k;
  if(state===READY){showToast('Test','Nächster Wurf = '+CHEATS[k]);setTimeout(()=>{if(state===READY)toast.classList.remove('on')},1500)}
 });
 fpsEl=document.createElement('div');
 fpsEl.style.cssText='position:absolute;right:6px;top:6px;z-index:5;font:700 11px "Space Grotesk",sans-serif;color:#fff;background:rgba(0,0,0,.55);padding:2px 6px;border-radius:4px;pointer-events:none';
 laneWrap.appendChild(fpsEl);
}

/* ========== Start ========== */

lane.rack();
newGame();
requestAnimationFrame(loop);
})();
