/* Hoppi Galoppi Solutions – Bowling-Spiel (Canvas)

   Aufbau:
   - physics.js  Kugel, Pins, Zusammenstösse (ohne Grafik)
   - rules.js    Zählung, Frame-Ablauf, Spruchauswahl
   - comics.js   Comic-Einblendungen (Strike, Spare, Sprechblase, Abschluss-Stern)
   - game.js     (diese Datei) Ablauf eines Wurfs, Pinsetter, Zeichnen, Eingabe */
(()=>{

/* ========== Grundlagen ========== */

const P=window.HGPhysics,TUNING=P.TUNING,{W,H,MID,SPOTS,HEAD_Y}=P;
const {marks,scores,total,nextStep,spruchKey,createSay,rating,bestmarke}=window.HGRules;

const canvas=document.getElementById('lane'),ctx=canvas.getContext('2d');
const dpr=Math.min(window.devicePixelRatio||1,2);
canvas.width=W*dpr;canvas.height=H*dpr;ctx.scale(dpr,dpr);

const $=id=>document.getElementById(id);
const toast=$('toast'),overlay=$('pow'),laneWrap=document.querySelector('.lw'),shareBtn=$('share');
const R=(a,b)=>a+Math.random()*(b-a);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const REDUCED=matchMedia('(prefers-reduced-motion:reduce)').matches;

/* ========== Einstellungen ==========
   Ablauf und Grafik. Das Spielgefühl (Schwierigkeit, Physik, Ziehen, Zittern) steht in TUNING in physics.js.
   Zeiten in Millisekunden (…_MS), Dauern in Schritten (…_STEPS, 60 pro Sekunde), Lagen und Grössen in Bahn-Einheiten:
   Bahn 360 × 560, Holz von x=64 bis 296, Mitte 180; in y: Kopfpin 168, Zielpfeile 308–364, Foul-Linie 482. */

/* Kugel auf der Bahn und Eingabe */
const BALL_Y=P.BALL_START_Y;        // y der Kugel vor dem Wurf
const SPOT_MIN=84,SPOT_MAX=276;     // so weit lässt sie sich seitlich verschieben
const GRAB=30;                      // Trefferzone um die Kugel und um die Mulde im Rücklauf
const GRAB_MOVE=6;                  // ab so viel Bewegung wird die Kugel aus dem Rücklauf gezogen statt angeklickt
const DOUBLE_TAP_MS=350;            // Doppeltipp auf die Kugel: zurück in die Mitte
const TARGET_MIN=28,TARGET_MAX=332; // Ziel-x beim Wurf wird darauf begrenzt
const KMH=2.8;                      // Umrechnung Tempo → km/h in der Anzeige

/* Meldungen */
const HINT_MS=3500;                 // Hinweisband ohne Kugel; ein Klick schliesst es vorher
const MSG_MS={big:[4500,50],bubble:[2600,42]}; // Spruch nach dem Wurf (Stern bzw. Sprechblase): Grundzeit + pro Zeichen
const RESET_DELAY_MS=900;           // so lange nach dem Spruch, bis der Pinsetter loslegt
const SETTLE_STEPS=20;              // so lange muss alles ruhig sein, bevor der Wurf gezählt wird
const HOWTO_DELAY_MS=6000;          // erster Besuch: Anleitung geht so lange nach dem Sichtbarwerden der Bahn auf

/* Pinsetter */
const TABLE_DOWN=44;                // Tisch unten: Pins abgesetzt
const TABLE_UP=TABLE_DOWN-HEAD_Y-30;// Tisch oben: ganz ausserhalb des Bildes
const TABLE_SPEED=2.2,RAKE_SPEED=6; // Tempo von Tisch und Rechen pro Schritt

/* Kugelrücklauf rechts neben der Bahn */
const RET_X=340,RET_HOOD_Y=432,RET_RACK_Y=528; // Mitte der Schiene, Haube, Mulde
const UNDER_STEPS=REDUCED?40:50;    // unterirdisch unterwegs (mindestens)
const ROLL_STEPS=REDUCED?1:55;      // von der Haube in die Mulde rollen
const PICK_STEPS=REDUCED?1:18;      // gezogene Kugel gleitet an ihren Platz
/* Kugel per Klick aus dem Rücklauf holen: anheben, rechts über die Bahn tragen und mit etwas Schwung
   fallen lassen. Seitwärts wird sie ab dem Loslassen gleichmässig langsamer, bis sie an ihrem Platz steht;
   dabei schlägt sie auf, hüpft zweimal nach (der erste Hüpfer trägt weiter) und rollt aus. */
const DROP_X=270;                   // hier wird sie über der Bahn losgelassen
const DROP={lift:12,fall:12,hop1:18,hop2:12,roll:48}; // Dauer der Abschnitte (Schritte); roll: Ausrollen nach dem zweiten Hüpfer
const DROP_HOPS=[.5,.22];           // Höhe der zwei Nachhüpfer (1 = Fallhöhe)
const DROP_SCALE=.45,DROP_SHADOW=10,DROP_RING=14; // Grösse in der Luft, Schattenversatz, Dauer eines Aufschlagrings
const DROP_SHAKE=1.8;               // so stark wackelt der Boden beim ersten Aufschlag, bei den Hüpfern weniger

/* Logo auf der Bahn, wie bei echten Bahnen unter der Oberfläche (oder beim Eishockey unter dem Eis).
   Zwischen Zielpfeilen und Foul-Linie, ohne Claim, Feenstaub statisch. */
const LANE_LOGO={
 x:180,         // Mitte des Logos, waagrecht (kleiner = nach links)
 bottom:456,    // Unterkante des Logos ohne Feenstaub (kleiner = weiter nach oben)
 w:176,         // Breite des Logos (ohne Feenstaub), die Höhe passt sich an
 alpha:.24,     // Deckkraft: wie stark das Logo durch den Lack scheint
 dustAlpha:.00, // Deckkraft des Feenstaubs (weiss auf hellem Holz braucht mehr)
 brown:true,    // true = in Brauntönen (wie eingelegt ins Holz), false = Originalfarben
 diamond:false, // true = mit Raute, false = ohne
 pins:true,     // true = mit Kugel und Pins, false = nur Schriftzug
 dark:[160,110,58],light:[255,236,200] // Brauntöne: Helligkeit des Logos wird auf diese Skala abgebildet
};

const MAX_PARTICLES=400;            // Obergrenze für Funken und Feenstaub

/* Bestmarke und Teilen am Spielende */
const BEST_KEY='hg-bestmarke';      // Eintrag im localStorage mit der persönlichen Bestmarke (nur in diesem Browser)
const RECORD_SPARKS=6,RECORD_SPARK_N=28,RECORD_SPARK_MS=220; // neuer Rekord: so viele Funkenregen, je so viele Funken, im Abstand von
const SHARE_DONE_MS=2200;           // so lange steht „Bild kopiert!“ o.ä. auf dem Teilen-Knopf, wenn das Gerät kein Teilen-Menü hat

/* Sprüche, Bewertung, Rekord- und Teilen-Texte kommen aus content.json (geladen von site.js) */
let sprueche={},wertung=[],rekordTexte=[],teilen='';
(window.HG_CONTENT||Promise.resolve({})).then(c=>{
 if(c&&c.sprueche)sprueche=c.sprueche;
 if(c&&Array.isArray(c.endwertung))wertung=c.endwertung;
 if(c&&Array.isArray(c.rekord))rekordTexte=c.rekord;
 if(c&&typeof c.teilen==='string')teilen=c.teilen;
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
let rekordAlt=null;    // bisherige Bestmarke, wenn dieses Spiel sie übertroffen hat, sonst null
let msgOpen=false,msgTimer=0;

/* ========== Partikel (nur Grafik) ========== */

function trail(x,y){
 for(let i=0;i<2;i++)particles.push({x:x+R(-5,5),y:y+10,vx:R(-.5,.5),vy:R(.3,1),l:.8,s:R(6,12),w:Math.random()<.5});
}
function burst(x,y,n){
 for(let i=0;i<n&&particles.length<MAX_PARTICLES;i++)particles.push({x,y,vx:R(-2.2,2.2),vy:R(-2.2,2.2),l:1,s:R(8,16),w:Math.random()<.5});
}
function moveParticles(){
 particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.l-=.025});
 for(let i=particles.length-1;i>=0;i--)if(particles[i].l<=0)particles.splice(i,1);
}

/* ========== Einblendungen ========== */

function hideOverlays(){
 overlay.querySelectorAll('svg').forEach(s=>{s.classList.add('out');setTimeout(()=>s.remove(),300)});
}
/* Comic-Stern (Strike, Spare, Abschluss) mit kurzem Wackeln der Bahn */
function comicTitle(kind,word,txt){
 const r=HGComics.title(overlay,kind,word,txt);
 laneWrap.classList.remove('shake');void laneWrap.offsetWidth;laneWrap.classList.add('shake');
 return r;
}
/* Hinweisband, das nach HINT_MS von selbst verschwindet */
let hintTimer=0;
function hint(a,b){
 toast.firstChild.textContent=a;toast.lastChild.textContent=b;toast.classList.add('on');
 clearTimeout(hintTimer);hintTimer=setTimeout(clearToast,HINT_MS);
}
function clearToast(){clearTimeout(hintTimer);hintTimer=0;toast.classList.remove('on')}
/* alles weg: Hinweisband und Comic-Einblendungen */
function clearMessages(){clearToast();hideOverlays()}

/* ========== Pinsetter ==========
   Der Tisch fährt herunter, hebt stehende Pins an, der Rechen räumt gefallene Pins ab,
   der Tisch setzt die Pins wieder ab (oder stellt zehn neue auf).
   Die Schritte stehen als Aufträge in einer Warteschlange und laufen nacheinander ab. */

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
 rake.t++;rake.y-=RAKE_SPEED;
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
 frameNo=1;ballInFrame=1;gameOver=false;rekordAlt=null;shareImg=null;
 shareBtn.hidden=true;
 renderSheet();
}

/* Wurf starten: tx = Ziel-x, v = Tempo (TUNING.speedMin bis speedMax), von der Startposition spotX aus */
function throwBall(tx,v){
 if(state!==READY)return;
 if(gameOver)newGame();
 state=ROLLING;settle=0;
 clearMessages();
 lane.launch(tx,lastV=v,spotX);
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
 else HGComics.bubble(overlay,(lane.gutter&&n===0)?'RINNE!':all+' von 10',t);
 const [ms,perChar]=strike||spare?MSG_MS.big:MSG_MS.bubble;
 clearTimeout(msgTimer);msgTimer=setTimeout(dismiss,ms+t.length*perChar);
 if(next==='end'){gameOver=true;finalScore=renderSheet();rekordAlt=saveBest(finalScore)}
 else renderSheet();

 const startReset=()=>{
  reset=RESET_RUNNING;
  if(next==='frame'){planReset(false);ballInFrame=1;frameNo++}
  else if(next==='end'){planReset(false);ballInFrame=1}
  else{planReset(next==='keep');ballInFrame++}
  renderSheet();
 };
 state=SHOWING;msgOpen=true;reset=RESET_PENDING;
 setTimeout(startReset,RESET_DELAY_MS);
}

/* Meldung schliessen (Tipp auf die Bahn oder nach Ablauf der Zeit) */
const dismiss=()=>{
 if(state!==SHOWING||!msgOpen)return;
 clearMessages();clearTimeout(msgTimer);msgOpen=false;
};

/* Ein Schritt (1/60 s): Pinsetter, Ablauf, Physik, Partikel */
function step(){
 runPinsetter();
 if(reset===RESET_RUNNING&&!jobs.length)reset=RESET_NONE;
 /* bereit für den nächsten Wurf, wenn Pinsetter fertig, Meldung zu und die Kugel zurück
    (in der Mulde oder schon vom Spieler geholt) */
 if(state===SHOWING&&!reset&&!msgOpen&&(ret.phase==='rack'||ballPlaced())){
  state=READY;
  if(gameOver)showEnd();
 }
 tick++;
 moveReturn();
 lane.step(!!rake);
 moveParticles();
 if(state===ROLLING&&!lane.ball){
  settle=lane.moving()?0:settle+1;
  if(settle>SETTLE_STEPS)scoreThrow();
 }
}

/* ========== Spielende: Bestmarke, Abschluss-Stern, Teilen ========== */

/* Bestmarke im Browser nachführen; gibt die alte zurück, wenn sie übertroffen wurde, sonst null.
   Ohne localStorage (privates Fenster, gesperrt) gibt es einfach keine Rekorde. */
function saveBest(score){
 let alt=null;
 try{const v=localStorage.getItem(BEST_KEY);if(v!==null)alt=parseInt(v,10)}catch(_){}
 const r=bestmarke(alt,score);
 try{localStorage.setItem(BEST_KEY,String(r.best))}catch(_){}
 return r.neu?alt:null;
}

/* Abschluss-Stern, bei neuem Rekord golden mit Funkenregen; dazu der Teilen-Knopf.
   Das Bild zum Teilen wird gleich jetzt erzeugt: Safari erlaubt das Teilen nur direkt nach dem Klick. */
let shareImg=null;     // Promise mit dem PNG (Blob) des aktuellen Spielendes
function showEnd(){
 const s=String(finalScore);let c;
 if(rekordAlt!==null){
  const t=rekordTexte.length?rekordTexte[Math.floor(Math.random()*rekordTexte.length)]:'Neuer persönlicher Rekord!';
  c=comicTitle('rekord',s,'Punkte! '+t.replace('{bisher}',rekordAlt));
  if(!REDUCED)for(let i=0;i<RECORD_SPARKS;i++)setTimeout(()=>burst(R(90,270),R(110,450),RECORD_SPARK_N),i*RECORD_SPARK_MS);
 }
 else c=comicTitle('end',s,('Punkte! '+rating(wertung,finalScore)).trim());
 shareImg=window.HGShare?HGShare.card({lane:canvas,w:W,h:H,star:c&&c.svg,frames,marks,scores,
  site:siteUrl().replace(/^https?:\/\/|\/$/g,'')}).catch(()=>null):Promise.resolve(null);
 shareBtn.textContent='Teilen';shareBtn.hidden=false;
}

const siteUrl=()=>(document.querySelector('meta[property="og:url"]')||{}).content||location.href;

/* Ergebnis teilen: Bild und Text (kurzer Satz aus content.json und Link; Punkte und Rekord stehen im Bild)
   über das Teilen-Menü des Geräts. Ohne Teilen-Menü für Bilder:
   Bild in die Zwischenablage, sonst herunterladen. Ganz ohne Bild: nur Text und Link. */
let shareTimer=0;
function shareDone(t){
 shareBtn.textContent=t;clearTimeout(shareTimer);
 shareTimer=setTimeout(()=>{shareBtn.textContent='Teilen'},SHARE_DONE_MS);
}
async function share(){
 const url=siteUrl(),score=finalScore;
 const text=((teilen||'Schaffst du mehr?').replace('{punkte}',score)+' '+url).trim();
 const blob=await shareImg,file=blob&&new File([blob],'hoppi-galoppi-'+score+'.png',{type:'image/png'});
 if(file&&navigator.canShare&&navigator.canShare({files:[file]})){
  try{await navigator.share({files:[file],text})}catch(_){} /* abgebrochen: nichts tun */
  return;
 }
 if(blob&&navigator.clipboard&&navigator.clipboard.write&&window.ClipboardItem){
  try{await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);shareDone('Bild kopiert!');return}catch(_){}
 }
 if(blob){
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=file.name;
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  shareDone('Bild gespeichert');return;
 }
 if(navigator.share){try{await navigator.share({text})}catch(_){}return}
 try{await navigator.clipboard.writeText(text);shareDone('Kopiert!')}catch(_){hint('Teilen',text)}
}
shareBtn.addEventListener('click',share);

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

/* Bahnlogo (Einstellungen in LANE_LOGO): wird einmal aus assets/logo.svg erzeugt */
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
 /* ?v= wie in index.html: bei Änderungen am Logo beide hochzählen, damit Browser die neue Datei laden.
    Eigene Adresse (&bahn): Holt fetch dieselbe Adresse wie das Logo oben auf der Seite, hört dieses
    in Safari auf dem iPhone auf zu funkeln. Animationen braucht die Bahn nicht, darum werden sie entfernt. */
 const still=svg=>svg.replace(/<style>[\s\S]*?<\/style>/,'<style></style>').replace(/animation:[^;"]*;?/g,'');
 fetch('assets/logo.svg?v=2&bahn').then(r=>r.text()).then(still).then(svg=>Promise.all([
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
    for(let j=0;j<3;j++)d[i+j]=LANE_LOGO.dark[j]+(LANE_LOGO.light[j]-LANE_LOGO.dark[j])*l;
   }
   g.putImageData(id,0,0);
  }
  laneLogo={img:c,w,h,x:LANE_LOGO.x-LANE_LOGO.w/2-(L.x0-F.x0)*k,y:LANE_LOGO.bottom-(L.y1-F.y0)*k};
  laneBg=null; // Bahn mit Logo neu vorzeichnen
 }).catch(()=>{});
})();

/* Die Bahn selbst (Holz, Logo, Zielpfeile, Linien) bewegt sich nie: einmal in eine eigene Canvas vorzeichnen,
   danach kostet sie pro Bild nur ein drawImage */
let laneBg=null;
function renderLaneBg(){
 const c=document.createElement('canvas');c.width=W*dpr;c.height=H*dpr;
 const g=c.getContext('2d');g.scale(dpr,dpr);
 g.fillStyle='#0b0e1c';g.fillRect(0,0,W,H);
 /* Rinnen */
 g.fillStyle='#04050b';g.fillRect(42,0,22,H);g.fillRect(296,0,22,H);
 /* Holz mit Dielen */
 const wood=g.createLinearGradient(0,0,0,H);
 wood.addColorStop(0,'#a97639');wood.addColorStop(.35,'#e2ad63');wood.addColorStop(1,'#d19a52');
 g.fillStyle=wood;g.fillRect(64,0,232,H);
 g.strokeStyle='rgba(60,30,0,.18)';g.lineWidth=1;
 for(let i=1;i<8;i++){g.beginPath();g.moveTo(64+i*29,0);g.lineTo(64+i*29,H);g.stroke()}
 if(laneLogo)g.drawImage(laneLogo.img,laneLogo.x,laneLogo.y,laneLogo.w,laneLogo.h);
 /* Zielpfeile */
 g.fillStyle='rgba(90,45,10,.5)';
 for(let i=0;i<7;i++){
  const x=64+(i+.5)*232/7,y=360-(3-Math.abs(i-3))*14;
  g.beginPath();g.moveTo(x,y-10);g.lineTo(x-6,y+4);g.lineTo(x+6,y+4);g.fill();
 }
 /* Foul-Linie, Bahnrand, Grube hinter den Pins */
 g.fillStyle='rgba(255,255,255,.55)';g.fillRect(64,H-78,232,2);
 g.fillStyle='#ff7a1a';g.fillRect(40,0,2,H);g.fillRect(318,0,2,H);
 g.fillStyle='#000';g.fillRect(64,0,232,12);
 return c;
}
function drawLane(){ctx.drawImage(laneBg||(laneBg=renderLaneBg()),0,0,W,H)}

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

/* Pfeil ab der Kugel Richtung Ziel, solange gezogen wird; Länge zeigt die Wucht */
function drawAim(){
 const s=push&&pushShot();if(!s)return;
 const ty=HEAD_Y+24,dx=s.tx-spotX,dy=ty-BALL_Y,d=Math.hypot(dx,dy),len=50+170*s.p;
 const ex=spotX+dx/d*len,ey=BALL_Y+dy/d*len,ux=dx/d,uy=dy/d;
 ctx.save();
 ctx.strokeStyle='rgba(255,122,26,.85)';ctx.lineWidth=3;ctx.setLineDash([6,7]);
 ctx.beginPath();ctx.moveTo(spotX,BALL_Y);ctx.lineTo(ex,ey);ctx.stroke();
 ctx.setLineDash([]);ctx.fillStyle='rgba(255,122,26,.85)';
 ctx.beginPath();ctx.moveTo(ex+ux*10,ey+uy*10);ctx.lineTo(ex-uy*6,ey+ux*6);ctx.lineTo(ex+uy*6,ey-ux*6);ctx.fill();
 ctx.restore();
}

function draw(){
 /* Boden wackelt kurz, wenn die Kugel aus dem Rücklauf auf die Bahn fällt (die Kugel selbst nicht) */
 const ring=ret.phase==='drop'&&dropBall(ret.t).ring,q=ring?DROP_SHAKE*ring.w*(1-ring.k)**2:0;
 ctx.fillStyle='#0b0e1c';ctx.fillRect(0,0,W,H);
 ctx.save();
 if(q)ctx.translate(q*.4*Math.sin(tick*1.7),q*Math.sin(tick*2.3));
 drawLane();
 drawReturn();
 drawAim();
 lane.pins.forEach(drawPin);
 drawTable();
 drawRake();
 ctx.restore();
 drawBall();
 drawParticles();
}

/* ========== Kugelrücklauf ==========
   Rechts neben der Bahn: Nach dem Wurf läuft die Kugel unterirdisch zurück. Sobald der Pinsetter die Pins
   absetzt, taucht sie unter der Haube auf und rollt sanft in die Mulde. Erst dann kann wieder geworfen werden.
   Dort holt der Spieler sie selbst ab und legt sie auf die Bahn (siehe Eingabe).
   Phasen: rack (in der Mulde) → out (rollt auf der Bahn) → under (unterirdisch) → roll (aus der Haube) → rack
           beim Hinlegen zusätzlich: rack → pick (gezogen) bzw. drop (angeklickt: fällt und rollt) → held (liegt auf der Bahn) → out */

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
 setSpot(x);
 ret.phase=from||REDUCED?'pick':'drop';ret.t=0;ret.fx=from?from.x:RET_X;ret.fy=from?from.y:RET_RACK_Y;
}
const inRack=p=>ret.phase==='rack'&&Math.hypot(p.x-RET_X,p.y-RET_RACK_Y)<GRAB;
/* Kugel liegt auf der Bahn oder ist auf dem Weg dorthin */
const ballPlaced=()=>ret.phase==='held'||ret.phase==='pick'||ret.phase==='drop';

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
let acc=0,last=0;
/* Bahn nicht zu sehen (weggescrollt, auf dem Handy nicht im Vollbild, Tab im Hintergrund): Spiel pausiert */
let visible=true;
if('IntersectionObserver' in window)new IntersectionObserver(es=>{visible=es[es.length-1].isIntersecting}).observe(canvas);
function loop(ts){
 if(visible&&!document.hidden&&last){
  acc+=Math.min(ts-last,250);
  let k=0;
  while(acc>=STEP&&k<15){step();acc-=STEP;k++}
  if(k===15)acc=0;
  draw();updateMeter();
 }
 last=ts;
 requestAnimationFrame(loop);
}

/* ========== Eingabe ==========
   Kugel holen: Nach jedem Wurf liegt sie im Rücklauf. Ein Klick darauf lässt sie in die Mitte der Bahn fallen,
   anfassen und auf die Bahn ziehen legt sie an die gewünschte Stelle. Auf der Bahn lässt sie sich seitlich verschieben,
   Doppeltipp stellt sie zurück in die Mitte.
   Werfen (Schieben): Irgendwo auf der Bahn drücken und nach vorne ziehen. Die Kugel zielt in die Zugrichtung
   (nach links gezogen = nach links), die Länge des Zugs bestimmt die Wucht. Ein Pfeil zeigt Richtung und Wucht,
   bei viel Wucht zittert er. Loslassen wirft, zu kurz gezogen = abgebrochen.
   Gespielt wird mit Maus oder Touch, eine Tastatursteuerung gibt es bewusst nicht. */

const powerFill=$('pf'),powerValue=$('pv');
/* Im Balken: beim Ziehen das Tempo, erst wenn wirklich aufgezogen wird (wie beim Loslassen: genug weit nach vorne).
   Ob geworfen werden kann, zeigt die Kugel (zurück aus dem Rücklauf). Nur bei Änderungen ins DOM schreiben. */
let meterP=-1;
const updateMeter=()=>{
 const p=pushLevel();if(p===meterP)return;meterP=p;
 powerFill.style.width=p*100+'%';
 powerValue.textContent=p?Math.round(speed(p)*KMH)+' km/h':'';
};
/* Wucht 0–1 → Tempo der Kugel */
const speed=p=>TUNING.speedMin+(TUNING.speedMax-TUNING.speedMin)*p;
/* nach Spielende: erster Klick/Tipp schliesst die Meldung und startet ein neues Spiel, wirft aber nicht */
const restart=()=>{newGame();clearMessages()};

let push=null;    // {sx,sy,x,y,t,phase} solange gezogen wird (Bahn-Koordinaten)
let spotX=MID;    // Startposition der Kugel
let moving=null;  // {dx} solange die Kugel auf der Bahn verschoben wird
let grabbed=null; // {x,y,moved} solange die Kugel aus dem Rücklauf geholt wird
let lastBallTap=0;
const setSpot=x=>{spotX=clamp(x,SPOT_MIN,SPOT_MAX)};
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
/* Zug: Wucht p (0–1) und Ziel-x; null, solange nicht nach vorne gezogen.
   fx: seitlich (rechts positiv), fy: nach vorne (positiv) */
function pushShot(){
 const fx=push.x-push.sx,fy=push.sy-push.y,len=Math.hypot(fx,fy);
 if(fy<=0||len<TUNING.pushMin)return null;
 const p=Math.min(1,len/TUNING.pushLen);
 /* Zittern: unregelmässige Mischung zweier Schwingungen, wächst mit der Wucht */
 const t=(performance.now()-push.t)/1000+push.phase;
 const wob=TUNING.pushWobble*p*p*(Math.sin(t*5.3)+.6*Math.sin(t*8.9+1.7))/1.6;
 const tx=spotX+fx/fy*(BALL_Y-HEAD_Y)*TUNING.pushAim+wob;
 return {p,tx:clamp(tx,TARGET_MIN,TARGET_MAX)};
}
const pushLevel=()=>{const s=push&&pushShot();return s?s.p:0};
function pushRelease(){
 const s=pushShot();push=null;
 if(s)throwBall(s.tx,speed(s.p));
}
/* ---------- Spielanleitung (Info-Knopf) ----------
   Klick oder Tipp öffnet und schliesst, mit der Maus öffnet auch Darüberfahren.
   Escape oder ein Klick auf die Anleitung oder daneben schliesst. Beim allerersten Besuch geht sie einmal von selbst auf. */
const infoBtn=document.querySelector('.hint .info'),howto=$('howto');
let howtoPinned=false; // per Klick geöffnet (bleibt offen, bis man schliesst)
function setHowto(open,pinned){
 howto.classList.toggle('open',open);infoBtn.setAttribute('aria-expanded',String(open));howtoPinned=open&&pinned;
}
if(infoBtn&&howto){
 infoBtn.addEventListener('click',()=>setHowto(!howtoPinned,true));
 infoBtn.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'&&!howtoPinned)setHowto(true,false)});
 infoBtn.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'&&!howtoPinned)setHowto(false,false)});
 /* Klick oder Tipp auf die Anleitung oder daneben schliesst sie. Auf der Bahn löst dieser Klick nichts weiter aus
    (kein Wurf, Kugel wird nicht geholt), darum schon in der Capture-Phase abfangen. Der Info-Knopf schaltet selbst um. */
 document.addEventListener('pointerdown',e=>{
  if(!howto.classList.contains('open')||infoBtn.contains(e.target))return;
  setHowto(false,false);
  if(laneWrap.contains(e.target)){e.stopPropagation();e.preventDefault()}
 },true);
 /* Escape schliesst nur die Anleitung (nicht gleich das ganze Spiel auf dem Handy) */
 addEventListener('keydown',e=>{
  if(e.key==='Escape'&&howto.classList.contains('open')){e.stopPropagation();setHowto(false,false)}
 },true);
 try{
  if(!localStorage.getItem('hg-anleitung')&&'IntersectionObserver' in window){
   const io=new IntersectionObserver(es=>{
    if(!es.some(x=>x.isIntersecting))return;
    io.disconnect();
    setTimeout(()=>setHowto(true,true),HOWTO_DELAY_MS);
    try{localStorage.setItem('hg-anleitung','1')}catch(_){}
   },{threshold:.6});
   io.observe(canvas);
  }
 }catch(_){}
}

canvas.addEventListener('pointerdown',e=>{
 /* Kugel holen und auf der Bahn verschieben geht schon, während der Pinsetter noch arbeitet;
    werfen erst, wenn alles bereit ist */
 const p=toLane(e),busy=state!==READY,hintOpen=hintTimer>0;
 if(busy&&!inRack(p)&&!onBall(p))return;
 e.preventDefault();
 if(!busy&&gameOver){restart();return}
 try{canvas.setPointerCapture(e.pointerId)}catch(_){}
 if(!busy)clearMessages();
 /* Kugel aus dem Rücklauf holen */
 if(inRack(p)){grabbed={x:p.x,y:p.y,sx:p.x,sy:p.y,moved:false};return}
 /* noch keine Kugel auf der Bahn: Spruch als Hinweis. Stand er noch, hat der Klick ihn nur geschlossen */
 if(!ballPlaced()){
  if(!hintOpen)hint('Kugel',say('keinekugel')||'Zuerst die Kugel aus dem Rücklauf rechts holen.');
  return;
 }
 if(onBall(p)){
  /* Doppeltipp: zurück in die Mitte */
  if(performance.now()-lastBallTap<DOUBLE_TAP_MS){setSpot(MID);lastBallTap=0;return}
  lastBallTap=performance.now();
  moving={dx:p.x-spotX};return;
 }
 /* sonst: Zug zum Werfen beginnen */
 push={sx:p.x,sy:p.y,x:p.x,y:p.y,t:performance.now(),phase:Math.random()*100};
});
canvas.addEventListener('pointermove',e=>{
 if(push)Object.assign(push,toLane(e));
 else if(grabbed){
  const p=toLane(e);grabbed.x=p.x;grabbed.y=p.y;
  if(Math.hypot(p.x-grabbed.sx,p.y-grabbed.sy)>GRAB_MOVE)grabbed.moved=true;
 }
 else if(moving)setSpot(toLane(e).x-moving.dx);
 else if(e.pointerType==='mouse'){const p=toLane(e);canvas.style.cursor=onBall(p)||inRack(p)?'grab':''}
});
canvas.addEventListener('pointerup',e=>{
 if(grabbed){
  /* Klick = Mitte, gezogen = dort, wo losgelassen (seitlich auf die Bahn begrenzt) */
  const g=grabbed;grabbed=null;
  placeBall(g.moved?g.x:MID,g.moved?g:null);return;
 }
 if(moving){moving=null;return}
 if(push){Object.assign(push,toLane(e));pushRelease()}
});
canvas.addEventListener('pointercancel',()=>{push=null;moving=null;grabbed=null});
laneWrap.addEventListener('pointerdown',dismiss);

/* ========== Start ========== */

lane.rack();
newGame();
requestAnimationFrame(loop);

/* ========== Nur lokal: direkt ans Spielende ==========
   Zum Ausprobieren von Abschluss-Stern und Teilen-Bild, ohne zehn Frames zu spielen (nur lokal: localhost,
   0.0.0.0 bzw. [::] wie von python3 -m http.server angezeigt, *.local und Adressen im eigenen Netz, z.B. fürs Handy):
   index.html?ende = zufälliges Spiel, ?ende=rekord = mit neuem Rekord, ?ende=300 = perfektes Spiel.
   Die gespeicherte Bestmarke bleibt unberührt. */
const LOCAL=/^(localhost|0\.0\.0\.0|\[::1?\]|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|.+\.local)$/;
const TEST=LOCAL.test(location.hostname)&&new URLSearchParams(location.search).get('ende');
const TEST_WAIT_MS=800;             // erst Inhalte, Schriften und Bahnlogo laden lassen
if(typeof TEST==="string"){
 /* Zufallsspiel, Würfe eher hoch (mehr Strikes und Spares als beim reinen Zufall) */
 const r=n=>TEST==='300'?n:Math.round(n*Math.sqrt(Math.random()));
 const testGame=()=>{
  const fr=[];
  for(let f=0;f<9;f++){const a=r(10);fr.push(a===10?[10]:[a,r(10-a)])}
  const a=r(10),b=r(a===10?10:10-a),t=[a,b];
  if(a===10||a+b===10)t.push(r(a===10&&b<10?10-b:10));
  fr.push(t);return fr;
 };
 (window.HG_CONTENT||Promise.resolve()).catch(()=>{}).then(()=>setTimeout(()=>{
  frames=testGame();frameNo=10;gameOver=true;finalScore=renderSheet();
  rekordAlt=TEST==='rekord'?Math.max(0,finalScore-1-Math.floor(Math.random()*30)):null;
  canvas.scrollIntoView({block:'center'});
  draw();showEnd();
 },TEST_WAIT_MS));
}
})();
