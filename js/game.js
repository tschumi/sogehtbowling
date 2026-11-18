/* Hoppi Galoppi Solutions – Bowling-Spiel (Canvas)

   Aufbau:
   - physics.js  Kugel, Pins, Zusammenstösse (ohne Grafik)
   - rules.js    Zählung, Frame-Ablauf, Spruchauswahl
   - comics.js   Comic-Einblendungen (Strike, Spare, Sprechblase, Abschluss-Stern)
   - game.js     (diese Datei) Ablauf eines Wurfs, Pinsetter, Zeichnen, Eingabe */
(()=>{

/* ========== Grundlagen ========== */

/* Steuerung: 'klassisch' = zielen, halten, im richtigen Moment loslassen (Stärkebalken)
             'schleuder' = nach hinten ziehen und loslassen wie eine Steinschleuder (Prototyp)
             'schieben'  = nach vorne ziehen, wohin die Kugel soll, und loslassen (Prototyp)
   Zum Ausprobieren ohne Änderung hier: ?klassisch, ?schleuder bzw. ?schieben in der Adresse */
const STEUERUNG='schieben';

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
   {run:returnBall},{table:TABLE_DOWN},{wait:10},{run:()=>lane.pins.forEach(p=>{p.att=0;p.oy=0})},{table:TABLE_UP});
 }else{
  standing.forEach(p=>{p.d=true;p.r=R(-.5,.5)});
  queue({rake:1,then:()=>{lane.pins=[]}},{wait:6},
   {run:()=>{lane.rack();lane.pins.forEach(p=>{p.att=1;p.oy=TABLE_UP-TABLE_DOWN})}},{wait:14},
   {run:returnBall},{table:TABLE_DOWN},{wait:16},{run:()=>lane.pins.forEach(p=>{p.att=0;p.oy=0})},{table:TABLE_UP});
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
 renderSheet();
}

/* Wurf starten: tx = Ziel-x, pwr = Tempo (5 bis 13), sx = Start-x */
function throwBall(tx,pwr,sx=MID){
 if(state!==READY)return;
 if(gameOver)newGame();
 state=ROLLING;settle=0;
 toast.classList.remove('on');hideOverlays();
 tx=Math.max(28,Math.min(332,tx));
 const v=lastV=pwr||9;
 applyCheat();
 if(cheat==='r'){cheat=0;tx=40;sx=MID}
 lane.launch(tx,v,sx);
 ret.phase='out';ret.due=false;
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
  renderSheet();
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
 if(state===SHOWING&&!reset&&!msgOpen&&ret.phase==='rack'){
  state=READY;
  if(gameOver)comicTitle('end',String(finalScore),('Punkte! '+rating(wertung,finalScore)).trim());
 }
 tick++;
 moveReturn();
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

/* ========== Zeichnen ========== */

const PZ=TUNING.pinScale,BR=TUNING.ballRadius;
/* Die Pinsetter-Grafik wurde für Pin-Abstand 26 gezeichnet und wächst mit dem Abstand mit */
const XS=x=>MID+(x-MID)*TUNING.pinSpacing/26;

/* Logo auf der Bahn, wie bei echten Bahnen unter der Oberfläche (oder beim Eishockey unter dem Eis).
   Zwischen Zielpfeilen und Foul-Linie, ohne Claim, Feenstaub statisch. Wird einmal vorgezeichnet,
   danach kostet es pro Bild nur ein drawImage. */
const LANE_LOGO={
 /* Lage auf der Bahn (Bahn-Einheiten, 360 × 560): Holz von x=64 bis 296, Mitte 180.
    Zum Vergleich in y: Kopfpin 168, Zielpfeile 308–364, Foul-Linie 482, unterer Rand 560 */
 x:180,       // Mitte des Logos, waagrecht (kleiner = nach links)
 bottom:456,  // Unterkante des Logos ohne Feenstaub (kleiner = weiter nach oben)
 w:176,       // Breite des Logos (ohne Feenstaub), die Höhe passt sich an
 alpha:.18,   // Deckkraft: wie stark das Logo durch den Lack scheint
 dustAlpha:.00, // Deckkraft des Feenstaubs (weiss auf hellem Holz braucht mehr)
 brown:true,  // true = in Brauntönen (wie eingelegt ins Holz), false = Originalfarben
 diamond:false, // true = mit Raute, false = ohne
 pins:true    // true = mit Kugel und Pins, false = nur Schriftzug
};
/* Brauntöne von dunkel bis hell: Helligkeit des Logos wird auf diese Skala abgebildet */
const LOGO_DARK=[62,30,8],LOGO_LIGHT=[255,236,200];
let laneLogo=null; // {img, x, y, w, h} in Bahn-Koordinaten
(function loadLaneLogo(){
 const BIG=1600;
 /* SVG mit zusätzlichem CSS in eine grosse Canvas zeichnen */
 const render=(svg,css)=>new Promise((ok,fail)=>{
  const img=new Image();
  img.onload=()=>{
   const c=document.createElement('canvas');c.width=BIG;c.height=Math.round(BIG*img.height/img.width);
   c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(img.src);ok(c);
  };
  img.onerror=fail;
  img.src=URL.createObjectURL(new Blob([svg.replace('<style>','<style>'+css)],{type:'image/svg+xml'}));
 });
 /* Rechteck um alle sichtbaren Pixel */
 const bounds=c=>{
  const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  let x0=c.width,y0=c.height,x1=0,y1=0;
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(d[(y*c.width+x)*4+3]>8){
   if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
  }
  return {x0,y0,x1,y1};
 };
 const HIDE='#Claim{display:none}'+(LANE_LOGO.diamond?'':'#Frame{display:none}')+(LANE_LOGO.pins?'':'#Pins,#Shadow,#Ball{display:none}');
 const DUST='#Fairy-dust path{animation:none!important;opacity:1!important}';
 fetch('assets/logo.svg').then(r=>r.text()).then(svg=>Promise.all([
  render(svg,HIDE+'#Fairy-dust{display:none}'), // ohne Feenstaub, für Grösse und Lage
  render(svg,HIDE+DUST),                         // mit Feenstaub, für den Ausschnitt
  render(svg,HIDE+DUST+'#Pins,#Frame,#Shadow,#Ball,#Text1{display:none}') // nur Feenstaub
 ])).then(([plain,full,dust])=>{
  const L=bounds(plain),F=bounds(full),k=LANE_LOGO.w/(L.x1-L.x0); // Bahn-Einheiten pro Pixel
  const w=(F.x1-F.x0)*k,h=(F.y1-F.y0)*k;
  const c=document.createElement('canvas');c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);
  const g=c.getContext('2d');
  g.globalAlpha=LANE_LOGO.alpha;g.drawImage(plain,F.x0,F.y0,F.x1-F.x0,F.y1-F.y0,0,0,c.width,c.height);
  g.globalAlpha=LANE_LOGO.dustAlpha;g.drawImage(dust,F.x0,F.y0,F.x1-F.x0,F.y1-F.y0,0,0,c.width,c.height);
  if(LANE_LOGO.brown){
   const id=g.getImageData(0,0,c.width,c.height),d=id.data;
   for(let i=0;i<d.length;i+=4){
    const l=(d[i]*.3+d[i+1]*.59+d[i+2]*.11)/255;
    for(let j=0;j<3;j++)d[i+j]=LOGO_DARK[j]+(LOGO_LIGHT[j]-LOGO_DARK[j])*l;
   }
   g.putImageData(id,0,0);
  }
  laneLogo={img:c,w,h,x:LANE_LOGO.x-LANE_LOGO.w/2-(L.x0-F.x0)*k,y:LANE_LOGO.bottom-(L.y1-F.y0)*k};
 }).catch(()=>{});
})();
function drawLaneLogo(){
 if(laneLogo)ctx.drawImage(laneLogo.img,laneLogo.x,laneLogo.y,laneLogo.w,laneLogo.h);
}

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
 drawLaneLogo();
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
 const b=lane.ball||handBall();if(b)drawBallAt(b);
}
/* b: {x, y, a (Drehung vorwärts), g (in der Rinne)}, optional s (Drehung seitwärts),
   h (Höhe über der Bahn 0–1: grösser, mit Schatten) und ring ({k: Verlauf 0–1, w: Stärke}) */
function drawBallAt(b){
 const h=b.h||0,r=BR*(1+DROP_SCALE*h);
 if(b.ring){
  const {k,w}=b.ring,rr=BR*(1+1.3*w*k);
  ctx.strokeStyle=`rgba(70,35,10,${.5*w*(1-k)})`;ctx.lineWidth=2;
  ctx.beginPath();ctx.ellipse(b.x,b.y,rr,rr*.9,0,0,7);ctx.stroke();
 }
 if(h>0){
  ctx.fillStyle=`rgba(0,0,0,${.35-.15*h})`;
  ctx.beginPath();ctx.ellipse(b.x+DROP_SHADOW*h,b.y+DROP_SHADOW*h,BR*(1-.15*h),BR*(1-.15*h)*.9,0,0,7);ctx.fill();
 }
 const q=ctx.createRadialGradient(b.x-r/3,b.y-r/3,r/6,b.x,b.y,r);
 q.addColorStop(0,b.g?'#9a6a3a':'#ff9448');q.addColorStop(.65,b.g?'#7a4a1a':'#ff7a1a');q.addColorStop(1,b.g?'#6a3d14':'#e8690f');
 ctx.fillStyle=q;ctx.beginPath();ctx.arc(b.x,b.y,r,0,7);ctx.fill();
 /* drei Fingerlöcher, die sich mit der Kugel drehen (vorwärts um a, seitwärts um s) */
 ctx.fillStyle='#0008';
 const ca=Math.cos(b.a||0),sa=Math.sin(b.a||0),cs=Math.cos(b.s||0),ss=Math.sin(b.s||0);
 [[-.28,-.42,.86],[.34,-.28,.9],[0,.12,.99]].forEach(([hx,hy,hz])=>{
  const y2=hy*ca-hz*sa,z1=hy*sa+hz*ca,x2=hx*cs+z1*ss,z=z1*cs-hx*ss;
  /* Loch auf der Kugel: zum Rand hin gestaucht */
  if(z>.15){ctx.beginPath();ctx.ellipse(b.x+x2*r,b.y+y2*r,1.6*r/9*z,1.6*r/9,Math.atan2(y2,x2),0,7);ctx.fill()}
 });
}

function drawStar(x,y,s){
 ctx.beginPath();ctx.moveTo(x,y-s);ctx.lineTo(x+s*.25,y-s*.25);ctx.lineTo(x+s,y);ctx.lineTo(x+s*.25,y+s*.25);
 ctx.lineTo(x,y+s);ctx.lineTo(x-s*.25,y+s*.25);ctx.lineTo(x-s,y);ctx.lineTo(x-s*.25,y-s*.25);ctx.closePath();ctx.fill();
}
function drawParticles(){
 particles.forEach(p=>{ctx.fillStyle=p.w?'rgba(255,255,255,'+p.l+')':'rgba(255,170,60,'+p.l+')';drawStar(p.x,p.y,p.s*p.l/2)});
}

/* Ziellinie: gestrichelter Weg von der Startposition zum Ziel, solange gezielt wird */
function drawAim(){
 if(sling){drawSling();return}
 if(!charge)return;
 const x=aimTarget(),y=HEAD_Y+24;
 ctx.save();
 ctx.strokeStyle='rgba(255,122,26,.75)';ctx.lineWidth=2;ctx.setLineDash([6,8]);
 ctx.beginPath();ctx.moveTo(startX(),H-36);ctx.lineTo(x,y);ctx.stroke();
 ctx.setLineDash([]);ctx.beginPath();ctx.arc(x,y,7,0,7);ctx.stroke();
 ctx.restore();
}

function draw(){
 drawLane();
 drawReturn();
 drawAim();
 lane.pins.forEach(drawPin);
 drawTable();
 drawRake();
 drawBall();
 drawParticles();
}

/* ========== Kugelrücklauf ==========
   Rechts neben der Bahn: Nach dem Wurf läuft die Kugel unterirdisch zurück. Sobald der Pinsetter die Pins
   absetzt, taucht sie unter der Haube auf und rollt sanft in die Mulde. Erst dann kann wieder geworfen werden.
   Dort holt der Spieler sie selbst ab und legt sie auf die Bahn (siehe Eingabe).
   Phasen: rack (in der Mulde) → out (rollt auf der Bahn) → under (unterirdisch) → roll (aus der Haube) → rack
           beim Hinlegen zusätzlich: rack → pick (gezogen) bzw. drop (angeklickt: fällt und rollt) → held (liegt auf der Bahn) → out */

const RET_X=340,RET_HOOD_Y=432,RET_RACK_Y=528;      // Mitte der Schiene, Haube, Mulde
const REDUCED=matchMedia('(prefers-reduced-motion:reduce)').matches;
const UNDER_STEPS=REDUCED?40:50,ROLL_STEPS=REDUCED?1:55,PICK_STEPS=REDUCED?1:18;
/* Kugel per Klick aus dem Rücklauf holen: anheben, rechts über die Bahn tragen und mit etwas Schwung
   fallen lassen. Seitwärts wird sie ab dem Loslassen gleichmässig langsamer, bis sie an ihrem Platz steht;
   dabei schlägt sie auf, hüpft zweimal nach (der erste Hüpfer trägt weiter) und rollt aus.
   Dauer in Schritten (60 pro Sekunde). */
const DROP_X=270;                  // hier wird sie über der Bahn losgelassen
const DROP={lift:12,fall:12,hop1:18,hop2:12,roll:48}; // roll: Ausrollen nach dem zweiten Hüpfer
const DROP_HOPS=[.5,.22];          // Höhe der zwei Nachhüpfer (1 = Fallhöhe)
const DROP_SCALE=.45,DROP_SHADOW=10,DROP_RING=14; // Grösse in der Luft, Schattenversatz, Dauer eines Aufschlagrings
const ret={phase:'rack',t:0,y:RET_RACK_Y,a:0,due:false}; // due: Pinsetter setzt ab, Kugel darf kommen
/* vom Pinsetter aufgerufen, wenn er die Pins absetzt */
function returnBall(){ret.due=true}

function moveReturn(){
 if(ret.phase==='out'&&!lane.ball){ret.phase='under';ret.t=0}
 else if(ret.phase==='under'&&++ret.t>=UNDER_STEPS&&ret.due){ret.phase='roll';ret.t=0;ret.y=RET_HOOD_Y}
 else if(ret.phase==='roll'){
  const k=Math.min(1,++ret.t/ROLL_STEPS),y=RET_HOOD_Y+(RET_RACK_Y-RET_HOOD_Y)*(1-Math.pow(1-k,3));
  ret.a-=(y-ret.y)*.08;ret.y=y; // rollt nach unten, dreht sich mit
  if(k>=1)ret.phase='rack';
 }
 else if(ret.phase==='pick'&&++ret.t>=PICK_STEPS)ret.phase='held';
 else if(ret.phase==='drop'&&dropBall(++ret.t).done)ret.phase='held';
}
/* Lage der fallenden Kugel nach t Schritten: {x, y, h, s, ring, done} */
function dropBall(t){
 const {lift:L,fall:F,hop1:B1,hop2:B2}=DROP,T=F+B1+B2+DROP.roll,d=DROP_X-spotX,v=2*d/T; // v: Tempo beim Loslassen
 /* Aufschlagring: jüngster Aufschlag zählt (zuerst der Fall, dann die zwei Hüpfer), später schwächer */
 const ring=t=>{for(const [i,at] of [F+B1+B2,F+B1,F].entries())if(t>=at)return t-at<DROP_RING?{k:(t-at)/DROP_RING,w:[.4,.6,1][i]}:null;return null};
 if(t<L){
  /* anheben und hinübertragen: aus der Ruhe heraus, beim Loslassen schon mit dem Tempo v (dreht sich in der Hand nicht) */
  const k=t/L,e=k*k*(3-2*k),x=RET_X+(DROP_X-RET_X)*e-v*L*(k*k*k-k*k);
  return {x,y:RET_RACK_Y+(BALL_Y-RET_RACK_Y)*e,h:Math.sin(Math.PI/2*Math.min(1,k*1.6)),s:d/BR};
 }
 t-=L;
 /* seitwärts: gleichmässig langsamer bis zum Platz; die Drehung endet genau in der Grundstellung */
 const k=Math.min(1,t/T),x=DROP_X-d*(1-(1-k)**2),hop=(u,a)=>a*4*u*(1-u);
 /* Höhe: fallen, aufschlagen, zweimal nachhüpfen, dann rollen */
 const h=t<F?1-(t/F)**2:t<F+B1?hop((t-F)/B1,DROP_HOPS[0]):t<F+B1+B2?hop((t-F-B1)/B2,DROP_HOPS[1]):0;
 return {x,y:BALL_Y,h,s:(x-spotX)/BR,ring:ring(t),done:k>=1};
}
/* Kugel aus der Mulde (oder von dort, wo sie gezogen wurde) an ihren Platz auf der Bahn legen */
function placeBall(x,from){
 spotX=Math.max(SPOT_MIN,Math.min(SPOT_MAX,x));
 ret.phase=from||REDUCED?'pick':'drop';ret.t=0;ret.fx=from?from.x:RET_X;ret.fy=from?from.y:RET_RACK_Y;
}
const inRack=p=>ret.phase==='rack'&&Math.hypot(p.x-RET_X,p.y-RET_RACK_Y)<GRAB;


function drawReturn(){
 ctx.save();
 /* Schiene mit zwei Laufleisten */
 ctx.fillStyle='#141a33';ctx.fillRect(RET_X-17,RET_HOOD_Y-4,34,H-RET_HOOD_Y+4);
 ctx.fillStyle='rgba(255,255,255,.08)';ctx.fillRect(RET_X-12,RET_HOOD_Y,2,H-RET_HOOD_Y);ctx.fillRect(RET_X+10,RET_HOOD_Y,2,H-RET_HOOD_Y);
 /* Mulde */
 ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse(RET_X,RET_RACK_Y+4,15,9,0,0,7);ctx.fill();
 /* Kugel im Rücklauf */
 if(ret.phase==='roll'||(ret.phase==='rack'&&!grabbed))drawBallAt({x:RET_X,y:ret.y,a:ret.a,g:false});
 /* Haube: die Kugel taucht darunter auf */
 const top=RET_HOOD_Y-30,hg=ctx.createLinearGradient(0,top,0,RET_HOOD_Y+14);
 hg.addColorStop(0,'#2b3360');hg.addColorStop(1,'#1b2142');
 ctx.fillStyle=hg;
 ctx.beginPath();ctx.moveTo(RET_X-19,RET_HOOD_Y+14);ctx.lineTo(RET_X-19,top+12);
 ctx.quadraticCurveTo(RET_X-19,top,RET_X,top);ctx.quadraticCurveTo(RET_X+19,top,RET_X+19,top+12);
 ctx.lineTo(RET_X+19,RET_HOOD_Y+14);ctx.closePath();ctx.fill();
 ctx.fillStyle='#ff7a1a';ctx.fillRect(RET_X-19,RET_HOOD_Y+12,38,2);
 ctx.restore();
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
   Drücken = zielen, Halten = der Stärkebalken pendelt zwischen 0 und 100 %, Loslassen = werfen.
   Solange man hält, zittert der Zielpunkt leicht, bei viel Stärke mehr.
   Gespielt wird mit Maus oder Touch, eine Tastatursteuerung gibt es bewusst nicht. */

const powerFill=$('pf'),powerValue=$('pv');
let charge=null,aimX=MID;

const toLaneX=e=>{const r=canvas.getBoundingClientRect();return Math.max(28,Math.min(332,(e.clientX-r.left)/r.width*W))};
const startCharge=()=>{charge={t:performance.now(),phase:Math.random()*100}};
/* Stärke 0–1: läuft hoch, dann wieder runter (Dreieck) */
const chargeLevel=()=>{
 if(!charge)return 0;
 const s=((performance.now()-charge.t)/TUNING.powerSweepMs)%2;
 return s<=1?s:2-s;
};
/* Zittern: unregelmässige Mischung zweier Schwingungen, Stärke wächst mit der Wucht */
const wobble=()=>{
 if(!charge)return 0;
 const t=(performance.now()-charge.t)/1000+charge.phase,p=chargeLevel();
 return TUNING.aimWobble*(.35+.65*p*p)*(Math.sin(t*5.3)+.6*Math.sin(t*8.9+1.7))/1.6;
};
const aimTarget=()=>Math.max(28,Math.min(332,aimX+wobble()));
const release=()=>{
 if(!charge)return;
 const v=5+8*chargeLevel(),x=aimTarget();
 charge=null;throwBall(x,v,startX());
};
/* Im Balken: beim Laden das Tempo. Ob geworfen werden kann, zeigt die Kugel (zurück aus dem Rücklauf). */
let meterText='';
const updateMeter=()=>{
 const p=sling?slingLevel():chargeLevel();
 const text=charge||sling?Math.round((5+8*p)*2.8)+' km/h':'';
 powerFill.style.width=p*100+'%';
 if(text!==meterText)powerValue.textContent=meterText=text;
};
/* nach Spielende: erster Klick/Tipp schliesst die Meldung und startet ein neues Spiel, wirft aber nicht */
const restart=()=>{newGame();toast.classList.remove('on');hideOverlays()};

/* ---------- PROTOTYPEN Steinschleuder und Schieben (STEUERUNG bzw. ?schleuder, ?schieben) ----------
   Steinschleuder: Irgendwo auf der Bahn drücken und nach hinten ziehen: Die Kugel zielt in die Gegenrichtung,
   die Länge des Zugs bestimmt die Wucht.
   Schieben: gleich, aber umgekehrt: nach vorne ziehen, die Kugel zielt in die Zugrichtung (nach links gezogen = nach links). Eine kurze Linie zeigt Richtung und Wucht, bei viel Wucht zittert sie.
   Loslassen wirft. Zu kurz gezogen = abgebrochen.
   Kugel holen: Nach jedem Wurf liegt sie im Rücklauf. Ein Klick darauf legt sie in die Mitte der Bahn,
   anfassen und auf die Bahn ziehen legt sie an die gewünschte Stelle. Auf der Bahn lässt sie sich weiter seitlich verschieben.
   Doppeltipp auf die Kugel stellt sie zurück in die Mitte. */
const URLP=new URLSearchParams(location.search);
const MODE=['klassisch','schleuder','schieben'].find(m=>URLP.has(m))||STEUERUNG;
const SLING=MODE==='schleuder'||MODE==='schieben'; // Zug-Steuerung statt Stärkebalken
const PULL=MODE==='schieben'?-1:1;                // Richtung des Zugs: 1 = nach hinten, -1 = nach vorne
const BALL_Y=P.BALL_START_Y,SPOT_MIN=84,SPOT_MAX=276,GRAB=30; // GRAB: Trefferzone um die Kugel (Bahn-Einheiten)
let sling=null;   // {sx,sy,x,y,t,phase} in Bahn-Koordinaten
let spotX=MID;    // Startposition der Kugel
let moving=null;  // {dx} solange die Kugel auf der Bahn verschoben wird
let grabbed=null; // {x,y,moved} solange die Kugel aus dem Rücklauf geholt wird
let lastBallTap=0;
const startX=()=>spotX;
const setSpot=x=>{spotX=Math.max(SPOT_MIN,Math.min(SPOT_MAX,x))};
const onBall=p=>ret.phase==='held'&&Math.hypot(p.x-spotX,p.y-BALL_Y)<GRAB;
const toLane=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H}};
/* Kugel liegt bereit, solange geworfen werden kann */
function handBall(){
 if(grabbed)return {x:grabbed.x,y:grabbed.y,a:0,g:false};
 if(ret.phase==='held')return {x:spotX,y:BALL_Y,a:0,g:false};
 if(ret.phase==='drop')return {...dropBall(ret.t),a:0,g:false};
 if(ret.phase==='pick'){
  /* an den Platz gleiten, aus der Mulde mit kleinem Bogen */
  const k=ret.t/PICK_STEPS,e=k*k*(3-2*k),arc=ret.fx===RET_X&&ret.fy===RET_RACK_Y?14:0;
  return {x:ret.fx+(spotX-ret.fx)*e,y:ret.fy+(BALL_Y-ret.fy)*e-arc*Math.sin(Math.PI*k),a:0,g:false};
 }
 return null;
}
/* Zug: Länge (0–1 = Wucht) und Ziel-x; null, solange nicht in die richtige Richtung gezogen.
   Beim Schieben wird der Zug umgedreht, dann gilt dieselbe Rechnung wie bei der Schleuder. */
function slingShot(){
 const dx=(sling.x-sling.sx)*PULL,dy=(sling.y-sling.sy)*PULL,len=Math.hypot(dx,dy);
 if(dy<=0||len<TUNING.slingMin)return null;
 const p=Math.min(1,len/TUNING.slingPull);
 const t=(performance.now()-sling.t)/1000+sling.phase;
 const wob=TUNING.slingWobble*p*p*(Math.sin(t*5.3)+.6*Math.sin(t*8.9+1.7))/1.6;
 const tx=spotX-dx/dy*(BALL_Y-HEAD_Y)*TUNING.slingAim+wob;
 return {p,tx:Math.max(28,Math.min(332,tx))};
}
const slingLevel=()=>{const s=sling&&slingShot();return s?s.p:0};
function slingRelease(){
 const s=slingShot();sling=null;
 if(s)throwBall(s.tx,5+8*s.p,spotX);
}
/* Linie ab der Kugel Richtung Ziel, Länge zeigt die Wucht */
function drawSling(){
 const s=sling&&slingShot();if(!s)return;
 const ty=HEAD_Y+24,dx=s.tx-spotX,dy=ty-BALL_Y,d=Math.hypot(dx,dy),len=50+170*s.p;
 const ex=spotX+dx/d*len,ey=BALL_Y+dy/d*len;
 ctx.save();
 ctx.strokeStyle='rgba(255,122,26,.85)';ctx.lineWidth=3;ctx.setLineDash([6,7]);
 ctx.beginPath();ctx.moveTo(spotX,BALL_Y);ctx.lineTo(ex,ey);ctx.stroke();
 ctx.setLineDash([]);ctx.fillStyle='rgba(255,122,26,.85)';
 const ux=dx/d,uy=dy/d;
 ctx.beginPath();ctx.moveTo(ex+ux*10,ey+uy*10);ctx.lineTo(ex-uy*6,ey+ux*6);ctx.lineTo(ex+uy*6,ey-ux*6);ctx.fill();
 /* Gummiband von der Kugel zum Finger (nur Schleuder) */
 if(PULL>0){ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=2;
 ctx.beginPath();ctx.moveTo(spotX,BALL_Y);ctx.lineTo(spotX+(sling.x-sling.sx),BALL_Y+(sling.y-sling.sy));ctx.stroke()}
 ctx.restore();
}
/* ---------- Spielanleitung (Info-Knopf) ----------
   Klick oder Tipp öffnet und schliesst, mit der Maus öffnet auch Darüberfahren.
   Escape oder ein Klick daneben schliesst. Beim allerersten Besuch geht sie einmal von selbst auf. */
const infoBtn=document.querySelector('.hint .info'),howto=$('howto');
let howtoPinned=false; // per Klick geöffnet (bleibt offen, bis man schliesst)
function setHowto(open,pinned){
 howto.classList.toggle('open',open);infoBtn.setAttribute('aria-expanded',String(open));howtoPinned=open&&pinned;
}
if(infoBtn&&howto&&howto.querySelectorAll){
 howto.querySelectorAll('[data-mode]').forEach(li=>{li.hidden=li.dataset.mode!==MODE});
 infoBtn.addEventListener('click',()=>setHowto(!howtoPinned,true));
 infoBtn.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'&&!howtoPinned)setHowto(true,false)});
 infoBtn.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'&&!howtoPinned)setHowto(false,false)});
 document.addEventListener('pointerdown',e=>{
  if(howto.classList.contains('open')&&!howto.contains(e.target)&&!infoBtn.contains(e.target))setHowto(false,false);
 });
 /* Escape schliesst nur die Anleitung (nicht gleich das ganze Spiel auf dem Handy) */
 addEventListener('keydown',e=>{
  if(e.key==='Escape'&&howto.classList.contains('open')){e.stopPropagation();setHowto(false,false)}
 },true);
 try{
  if(!localStorage.getItem('hg-anleitung')&&'IntersectionObserver' in window){
   const io=new IntersectionObserver(es=>{
    if(!es.some(x=>x.isIntersecting))return;
    io.disconnect();
    setTimeout(()=>setHowto(true,true),6000);
    try{localStorage.setItem('hg-anleitung','1')}catch(_){}
   },{threshold:.6});
   io.observe(canvas);
  }
 }catch(_){}
}

canvas.addEventListener('pointerdown',e=>{
 if(state!==READY)return;
 e.preventDefault();
 if(gameOver){restart();return}
 try{canvas.setPointerCapture(e.pointerId)}catch(_){}
 toast.classList.remove('on');hideOverlays();
 {
  /* Kugel holen und platzieren (beide Steuerungen) */
  const p=toLane(e);
  if(inRack(p)){grabbed={x:p.x,y:p.y,sx:p.x,sy:p.y,moved:false};return}
  if(ret.phase!=='held'&&ret.phase!=='pick'&&ret.phase!=='drop'){
   showToast('Kugel','Zuerst die Kugel aus dem Rücklauf rechts holen.');
   setTimeout(()=>{if(state===READY)toast.classList.remove('on')},1800);
   return;
  }
  if(onBall(p)){
   /* Doppeltipp: zurück in die Mitte */
   if(performance.now()-lastBallTap<350){setSpot(MID);lastBallTap=0;return}
   lastBallTap=performance.now();
   moving={dx:p.x-spotX};return;
  }
  if(SLING){sling={sx:p.x,sy:p.y,x:p.x,y:p.y,t:performance.now(),phase:Math.random()*100};return}
 }
 aimX=toLaneX(e);startCharge();
});
canvas.addEventListener('pointermove',e=>{
 if(sling)Object.assign(sling,toLane(e));
 else if(grabbed){
  const p=toLane(e);grabbed.x=p.x;grabbed.y=p.y;
  if(Math.hypot(p.x-grabbed.sx,p.y-grabbed.sy)>6)grabbed.moved=true;
 }
 else if(moving)setSpot(toLane(e).x-moving.dx);
 else if(e.pointerType==='mouse'){const p=toLane(e);canvas.style.cursor=state===READY&&(onBall(p)||inRack(p))?'grab':''}
});
canvas.addEventListener('pointerup',e=>{
 if(grabbed){
  /* Klick = Mitte, gezogen = dort, wo losgelassen (seitlich auf die Bahn begrenzt) */
  const g=grabbed;grabbed=null;
  placeBall(g.moved?g.x:MID,g.moved?g:null);return;
 }
 if(moving){moving=null;return}
 if(sling){Object.assign(sling,toLane(e));slingRelease()}else release();
});
canvas.addEventListener('pointercancel',()=>{charge=null;sling=null;moving=null;grabbed=null});
laneWrap.addEventListener('pointerdown',dismiss);

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
