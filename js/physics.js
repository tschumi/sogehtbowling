/* Hoppi Galoppi Solutions – Bowling-Physik (ohne Grafik, testbar mit `node --test`)
   Im Browser als window.HGPhysics, in Node per require('./js/physics.js').

   Koordinaten: Die Bahn ist 360 × 560 Einheiten gross, x = 180 ist die Mitte,
   y wächst nach unten. Die Kugel startet unten und rollt nach oben zu den Pins. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.HGPhysics=factory();
})(typeof self!=='undefined'?self:this,function(){
'use strict';

/* ---------- Einstellungen ----------
   Hier lässt sich das Spielgefühl anpassen. Die Prozentangaben stammen aus Simulationen
   (tests/physics.test.js prüft, dass die Strike-Quote in einem vernünftigen Bereich bleibt). */
const TUNING={
 /* Aufstellung */
 pinSpacing:40,      // Abstand der Pins in einer Reihe (in echt ~87 % der Bahnbreite, hier ~50 % für gute Lesbarkeit)
 rowSpacing:34,      // Abstand der Reihen (≈ pinSpacing × 0.866, gleichseitiges Dreieck)
 backRowY:66,        // y der hintersten Reihe (7-8-9-10)
 pinScale:1.15,      // Grösse der Pins (Faktor auf die Grundgrafik)
 ballRadius:13,      // Radius der Kugel
 ballPinContact:22,  // Abstand Kugel–Pin, ab dem sie sich berühren
 pinPinContact:25,   // Abstand Pin–Pin, ab dem sie sich berühren

 /* Pin-Action */
 pinFriction:.965,   // Bremsung der Pins pro Schritt (höher = Pins rutschen weiter)
 ballImpulse:.75,    // Stoss der Kugel auf einen Pin
 pinImpulse:1.07,    // Stoss von Pin zu Pin. Wichtigster Regler für die Strike-Quote: ±0.01 ist spürbar
 pocketCarry:1.08,   // Bonus auf den Pin-Stoss, wenn die Kugel den vordersten Pin seitlich trifft (Tasche)
 headOnCarry:.95,    // Abzug, wenn die Kugel den vordersten Pin frontal trifft (gibt oft Splits)
 angleCarry:1.03,    // zusätzlicher Bonus für einen Einschlag in die Tasche mit gutem Winkel (Kugel läuft zur Mitte hin)
 angleBest:.15,      // bester Winkel (seitlich pro Schritt nach vorne, ≈ 8.5°); Würfe aus der Mitte haben ≈ 0
 angleWidth:.11,     // wie weit vom besten Winkel es noch einen Bonus gibt

 /* Zufall beim Wurf */
 aimNoise:.1,        // seitliche Streuung
 hookNoise:.007,     // leichte zufällige Kurve

 /* Können beim Wurf: nach vorne ziehen und loslassen (Eingabe, siehe game.js) */
 pushLen:110,        // so weit ziehen (Bahn-Einheiten, Bahn = 560 hoch) für volle Wucht
 pushAim:.6,         // Zugrichtung → Ziel: 1 = Kugel läuft exakt in Zugrichtung, kleiner = gröber/verzeihender
 pushWobble:14,      // Zittern des Ziels bei voller Wucht (bei wenig Wucht kaum)
 pushMin:12,         // kürzerer Zug gilt als abgebrochen
 speedMin:5,         // Tempo der Kugel bei wenig Wucht (Bahn-Einheiten pro Schritt) …
 speedMax:13         // … und bei voller Wucht. Ab 11.5 kommen „schnelle“ Sprüche, unter 6.5 „sanfte“ (rules.js)
};

/* Feste Masse der Bahn */
const W=360,H=560,MID=180;
const BALL_START_Y=H-36;
const GUTTER_L=66,GUTTER_R=294;      // Kugel fällt in die Rinne, wenn sie diese Grenzen überschreitet
const GUTTER_X_L=53,GUTTER_X_R=307;  // x der Kugel in der Rinne
const WALL_L=44,WALL_R=316,WALL_TOP=16;
const ASSIST_Y=340;                  // ab hier zieht eine leichte Zielhilfe die Kugel Richtung Kopfpin

/* Pin-Plätze: hinterste Reihe zuerst. Jeder Eintrag: [x, y, Pins in der Reihe, Index in der Reihe] */
const SPOTS=[4,3,2,1].flatMap((n,row)=>Array.from({length:n},(_,i)=>
 [MID+(i-(n-1)/2)*TUNING.pinSpacing,TUNING.backRowY+row*TUNING.rowSpacing,n,i]));
/* y des vordersten Pins (Kopfpin) */
const HEAD_Y=TUNING.backRowY+3*TUNING.rowSpacing;

/* Eine Bahn mit Pins und Kugel.
   rand: Zufallsquelle (Standard Math.random, für Tests mit festem Startwert austauschbar)
   fx.trail(x,y): Spur hinter der Kugel, fx.burst(x,y,n): Funken bei Treffern (nur Grafik) */
function createLane({rand=()=>Math.random(),fx={}}={}){
 const R=(a,b)=>a+rand()*(b-a);
 const T=TUNING;
 const lane={pins:[],ball:null,gutter:false,carry:1};

 /* Zehn frische Pins. k = Standfestigkeit: Eckpins (7, 10) und Pins 4/6 fallen schwerer */
 lane.rack=function(){
  lane.pins=SPOTS.map(([x,y,n,i])=>({x,y,vx:0,vy:0,r:0,vr:0,d:false,oy:0,
   k:(n===4&&(i===0||i===3))?R(.3,.8):(n===3&&(i===0||i===2))?R(.5,.9):1}));
 };

 /* Impuls auf einen Pin. Ein stehender Pin fällt erst ab einer gewissen Wucht, knapp darunter wackelt er nur. */
 function hit(p,ix,iy,ir){
  if(!p.d){
   const m=Math.hypot(ix,iy);
   if(m<2.0){
    p.wob=Math.min(.35,.06+m*.1);
    if(!(m>1.3&&rand()<.25))return;
   }
   p.d=true;p.wob=0;p.vr+=(rand()<.5?-1:1)*.12;
  }
  p.vx+=ix;p.vy+=iy;p.vr+=ir;
 }

 /* Kugel losschicken: tx = Ziel-x auf Höhe der Pins, v = Tempo (speedMin bis speedMax), sx = Start-x (Standard Mitte) */
 lane.launch=function(tx,v,sx=MID){
  lane.gutter=false;lane.carry=1;
  lane.pins.forEach(p=>{p.bh=false});
  const N=(BALL_START_Y-HEAD_Y-8)/v; // Schritte bis zu den Pins
  lane.ball={x:sx,y:BALL_START_Y,sx,vx:(tx-sx)/N+R(-T.aimNoise,T.aimNoise)*v/9,vy:-v,
   h:R(-T.hookNoise,T.hookNoise),hk:.0006*9/v,c:0,a:0,g:false,v};
 };

 /* Winkelbonus in die Tasche: wie in echt trägt ein Einschlag schräg zur Mitte hin mehr Pins mit.
    s = seitliche Bewegung Richtung Mitte pro Schritt nach vorne (gerade aus der Mitte ≈ 0, über die Bahn kreuzend < 0) */
 function angleBonus(ball){
  const s=-Math.sign(ball.x-MID)*ball.vx/Math.abs(ball.vy),u=(s-T.angleBest)/T.angleWidth;
  return 1+(T.angleCarry-1)*Math.max(0,1-u*u);
 }

 /* Kugel einen Schritt bewegen und mit Pins zusammenstossen lassen */
 function stepBall(){
  const ball=lane.ball,pins=lane.pins;
  ball.a+=Math.abs(ball.vy)*.06; // Drehung (nur Grafik)
  ball.vx+=ball.h;
  /* Zielhilfe: zieht leicht zur Linie vom Startpunkt zum Kopfpin (Start in der Mitte: zur Mitte) */
  if(!ball.c&&!ball.g&&ball.y<ASSIST_Y){
   const lx=ball.sx+(MID-ball.sx)*(BALL_START_Y-ball.y)/(BALL_START_Y-HEAD_Y);
   ball.vx+=(lx-ball.x)*ball.hk;
  }
  ball.x+=ball.vx;ball.y+=ball.vy;
  if(!ball.g&&(ball.x<GUTTER_L||ball.x>GUTTER_R)){
   ball.g=true;lane.gutter=true;ball.vx=0;ball.x=ball.x<MID?GUTTER_X_L:GUTTER_X_R;
  }
  if(fx.trail)fx.trail(ball.x,ball.y);
  if(!ball.g)pins.forEach(p=>{
   if(p.bh)return;
   const dx=p.x-ball.x,dy=p.y-ball.y,d=Math.hypot(dx,dy);
   if(d>=T.ballPinContact)return;
   /* erster Kontakt auf volle Pins: Tasche (seitlich) oder frontal? */
   const a=Math.abs(dx)/(d||1);
   if(!ball.c&&pins.length===10&&pins.every(q=>!q.d||q===p))lane.carry=a<.25?T.headOnCarry:a<.75?T.pocketCarry*angleBonus(ball):1;
   p.bh=true;ball.c=1;
   const nx=d?dx/d:0,ny=d?dy/d:-1,sp=Math.min(10,Math.hypot(ball.vx,ball.vy));
   hit(p,nx*sp*T.ballImpulse+ball.vx*.4+R(-.6,.6)*(sp/9)**2,ny*sp*T.ballImpulse-1+R(-.5,.5),R(-.3,.3));
   /* Ablenkung der Kugel: weg vom Pin, bei harten Würfen mehr Streuung, frontal zufällig zur Seite */
   ball.vx-=nx*sp*.22;
   ball.vx+=R(-1,1)*Math.max(0,ball.v-10.5)*1.2;
   ball.vx+=Math.abs(nx)<.3?R(-1.8,1.8):0;
   ball.vx*=.96;ball.vy*=1-.15*ny*ny;
   if(ball.vy>-3)ball.vy=-3;
   if(fx.burst)fx.burst(p.x,p.y,6);
  });
  if(ball.y<-30)lane.ball=null;
 }

 /* Pins bewegen, an den Wänden abprallen lassen */
 function movePins(rakeActive){
  lane.pins.forEach(p=>{
   if(p.wob){p.wob*=.94;if(p.wob<.01)p.wob=0}
   p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;
   p.vx*=T.pinFriction;p.vy*=T.pinFriction;p.vr*=.96;
   if(p.x<WALL_L||p.x>WALL_R){p.x=Math.max(WALL_L,Math.min(WALL_R,p.x));p.vx*=-.6}
   if(p.y<WALL_TOP&&!rakeActive){p.y=WALL_TOP;p.vy*=-.6}
  });
 }

 /* Pin trifft Pin: Impuls entlang der Verbindungslinie, abgeschwächt durch die Standfestigkeit k */
 function collidePins(){
  const pins=lane.pins;
  for(let i=0;i<pins.length;i++)for(let j=i+1;j<pins.length;j++){
   const a=pins[i],b=pins[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
   if(!(d>0&&d<T.pinPinContact))continue;
   const nx=dx/d,ny=dy/d,rel=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
   if(rel<=0)continue;
   const q=T.pinImpulse*lane.carry*Math.min(a.k,b.k);
   hit(a,-nx*rel*q,-ny*rel*q,R(-.2,.2));
   hit(b,nx*rel*q,ny*rel*q,R(-.2,.2));
   if(!a.d){b.vx+=nx*rel*.9;b.vy+=ny*rel*.9}
   if(!b.d){a.vx-=nx*rel*.9;a.vy-=ny*rel*.9}
   if(rel>1&&fx.burst)fx.burst((a.x+b.x)/2,(a.y+b.y)/2,3);
  }
 }

 /* Ein Physik-Schritt (1/60 s). rakeActive: der Rechen räumt gerade ab, Pins dürfen oben hinaus */
 lane.step=function(rakeActive=false){
  if(lane.ball)stepBall();
  movePins(rakeActive);
  collidePins();
 };

 /* Bewegt sich noch etwas? (Der Wurf wird ausgewertet, wenn alles eine Weile ruhig ist) */
 lane.moving=function(){return !!lane.ball||lane.pins.some(p=>Math.hypot(p.vx,p.vy)>.15)};

 return lane;
}

return {TUNING,W,H,MID,SPOTS,HEAD_Y,BALL_START_Y,createLane};
});
