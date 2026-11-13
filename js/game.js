/* Hoppi Galoppi Solutions – Bowling-Spiel (Canvas) */
(()=>{
const cv=document.getElementById('lane'),c=cv.getContext('2d'),W=360,H=560,dpr=Math.min(window.devicePixelRatio||1,2);
cv.width=W*dpr;cv.height=H*dpr;c.scale(dpr,dpr);
const $=id=>document.getElementById(id),toast=$('toast');
/* Sprüche kommen aus content.json (siehe site.js) */
let SPRUECHE={},WERTUNG=[];(window.HG_CONTENT||Promise.resolve({})).then(c=>{if(c&&c.sprueche)SPRUECHE=c.sprueche;if(c&&Array.isArray(c.endwertung))WERTUNG=c.endwertung}).catch(()=>{});
const R=(a,b)=>a+Math.random()*(b-a);
/* Regeln (Zählung, Ablauf, Sprüche) liegen in rules.js */
const {marks,scores,total,nextStep,spruchKey,createSay,rating}=window.HGRules,say=createSay(()=>SPRUECHE);
let fc=0,pins=[],ball=null,parts=[],state=0,settle=0,gut=false,lastV=9,ballNo=1,rd=1,frames=[],gameOver=false,tt,pend=null,msgOpen=false,resetting=0,msgT=0;
const powEl=$('pow'),lwEl=document.querySelector('.lw');let powT=[];
function hidePow(){powT.forEach(clearTimeout);powT=[];powEl.querySelectorAll('svg').forEach(s=>{s.classList.add('out');setTimeout(()=>s.remove(),300)});toast.classList.remove('low')}

/* Comic-Einblendungen liegen in comics.js */
function comicTitle(kind,word,txt){HGComics.title(powEl,kind,word,txt);lwEl.classList.remove('shake');void lwEl.offsetWidth;lwEl.classList.add('shake')}
function comicBubble(title,txt){HGComics.bubble(powEl,title,txt)}
function showToast(a,b){toast.firstChild.textContent=a;toast.lastChild.textContent=b;toast.classList.add('on')}
function rack(){pins=[];[[4,70],[3,94],[2,118],[1,142]].forEach(([n,y])=>{for(let i=0;i<n;i++)pins.push({x:180+(i-(n-1)/2)*26,y,vx:0,vy:0,r:0,vr:0,d:false,oy:0,k:(n===4&&(i===0||i===3))?R(.3,.8):(n===3&&(i===0||i===2))?R(.5,.9):1})})}
let rake=null,T={y:-114},jobs=[];
const TR=44,TH=-130,qj=(...a)=>jobs.push(...a);
function plan(keep){
 pins.forEach(p=>{p.vx=p.vy=p.vr=0;p.wob=0});
 const stand=pins.filter(p=>!p.d);
 if(keep){
  qj({tbl:TR,sp:2.2},{wait:10},{f:()=>stand.forEach(p=>p.att=1)},{tbl:TH,sp:2.2},
   {rake:1,cb:()=>{pins=pins.filter(p=>!p.d)}},{wait:6},
   {tbl:TR,sp:2.2},{wait:10},{f:()=>pins.forEach(p=>{p.att=0;p.oy=0})},{tbl:TH,sp:2.2});
 }else{
  stand.forEach(p=>{p.d=true;p.r=R(-.5,.5)});
  qj({rake:1,cb:()=>{pins=[]}},{wait:6},{f:()=>{rack();pins.forEach(p=>{p.att=1;p.oy=TH-TR})}},{wait:14},{tbl:TR,sp:2.2},{wait:16},{f:()=>pins.forEach(p=>{p.att=0;p.oy=0})},{tbl:TH,sp:2.2});
 }
}
function burst(x,y,n){for(let i=0;i<n&&parts.length<400;i++)parts.push({x,y,vx:R(-2.2,2.2),vy:R(-2.2,2.2),l:1,s:R(8,16),w:Math.random()<.5})}
function hit(p,ix,iy,ir){if(!p.d){const m=Math.hypot(ix,iy);if(m<2.0){p.wob=Math.min(.35,.06+m*.1);if(!(m>1.3&&Math.random()<.25))return}p.d=true;p.wob=0;p.vr+=(Math.random()<.5?-1:1)*.12}p.vx+=ix;p.vy+=iy;p.vr+=ir}
/* Test-Tasten X/S/R nur mit ?test in der Adresse */
let cheat=0;const CH={x:'Strike',s:'Spare',r:'Rinne'};if(new URLSearchParams(location.search).has('test'))addEventListener('keydown',e=>{const k=(e.key||'').toLowerCase();if(CH[k]&&!e.ctrlKey&&!e.metaKey){cheat=k;if(state===0){showToast('Test','Nächster Wurf = '+CH[k]);setTimeout(()=>{if(state===0)toast.classList.remove('on')},1500)}}});
function throwBall(tx,pwr){
 if(state)return;if(gameOver)newGame();state=1;settle=0;gut=false;toast.classList.remove('on');hidePow();
 tx=Math.max(28,Math.min(332,tx));const v=lastV=pwr||9,N=(H-36-150)/v;
 pins.forEach(p=>{p.bh=false});if(cheat==='r'){cheat=0;tx=40}
 else if(cheat==='x'){cheat=0;pins.forEach(p=>{p.d=true;p.r=R(-1,1)})}
 else if(cheat==='s'){const st=pins.filter(p=>!p.d).sort(()=>Math.random()-.5).slice(0,pins.length===10?2:0);pins.forEach(p=>{if(!st.includes(p)){p.d=true;p.r=R(-1,1)}});if(pins.length===10)cheat='s2';else cheat=0}
 else if(cheat==='s2'&&pins.length<10){cheat=0;pins.forEach(p=>{p.d=true;p.r=R(-1,1)})}ball={x:180,y:H-36,vx:(tx-180)/N+R(-.2,.2)*v/9,vy:-v,h:R(-.012,.012),hk:.0006*9/v,c:0,a:0,g:false};
 }
function newGame(){frames=Array.from({length:10},()=>[]);rd=1;ballNo=1;gameOver=false;renderSheet();renderDots()}
function renderDots(){const d=document.querySelector('.dots');d.classList.toggle('three',rd===10&&ballNo===3);d.querySelectorAll('i').forEach((x,i)=>x.classList.toggle('on',i<ballNo))}
function renderSheet(){
 const sc=scores(frames),cur=gameOver?-1:rd-1;
 $('sheet').innerHTML=frames.map((r,f)=>'<div class="fr'+(f===cur?' cur':'')+(f===9?' f10':'')+'"><span class="n">'+(f+1)+'</span><span class="bx">'+marks(r,f).map(x=>'<i>'+x+'</i>').join('')+'</span><b>'+(sc[f]===null?'':sc[f])+'</b></div>').join('');
 const tot=total(frames);$('sheet').setAttribute('aria-label','Spielstand: Frame '+Math.min(rd,10)+', '+tot+' Punkte');return tot}
function done(){
 state=2;const n=pins.filter(p=>p.d).length,left=pins.length-n,fresh=pins.length===10,all=10-left,f=rd-1,r=frames[f];
 r.push(n);
 const strike=fresh&&n===10,spare=!fresh&&left===0;
 /* nächster Schritt: neuer Frame, gleiche Pins weiter, frisches Rack (10. Frame) oder Spielende */
 const next=nextStep(r,f,strike,left);
 const key=spruchKey({fresh,n,left,gut,mitte:pins.filter(p=>!p.d).every(p=>p.k<1),last:next==='end'});
 const t=say(key,left,lastV);
  if(spare||strike)comicTitle(spare?'spare':'strike',spare?'SPARE!':'STRIKE!',t);
  else comicBubble((gut&&n===0)?'RINNE!':all+' von 10',t);
  clearTimeout(msgT);msgT=setTimeout(dismiss,(strike||spare)?4500+t.length*50:2600+t.length*42);
 if(next==='end'){gameOver=true;finalScore=renderSheet()}else renderSheet();
 pend=()=>{
  resetting=2;
  if(next==='frame'){plan(false);ballNo=1;rd++}
  else if(next==='end'){plan(false);ballNo=1}
  else{plan(next==='keep');ballNo++}
  renderSheet();renderDots();
 };
 state=3;msgOpen=true;resetting=1;setTimeout(pend,900);
}
let finalScore=0;
function step(){
 if(jobs.length){const j=jobs[0];
  if(j.tbl!==undefined){if(j.n===undefined){j.a=T.y;j.n=0;j.N=Math.max(1,Math.round(Math.abs(j.tbl-T.y)/j.sp))}
   j.n++;const t=Math.min(1,j.n/j.N);let e;
   e=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
   if(j.tbl===TR&&j.a<TR&&t>.7)e+=.035*Math.sin(Math.PI*(t-.7)/.3);
   T.y=j.a+(j.tbl-j.a)*e;if(t>=1){T.y=j.tbl;jobs.shift()}
   pins.forEach(p=>{if(p.att)p.oy=T.y-TR})}
  else if(j.wait!==undefined){if(--j.wait<=0)jobs.shift()}
  else if(j.f){j.f();jobs.shift()}
  else if(j.rake){if(!rake)rake={y:178,t:0};const k=rake;k.t++;k.y-=6;pins.forEach(p=>{if(p.d&&p.y>k.y-4)p.y=k.y-4});if(k.y<-24){rake=null;j.cb&&j.cb();jobs.shift()}}
 }
 if(resetting===2&&!jobs.length)resetting=0;
 if(state===3&&!resetting&&!msgOpen){state=0;if(gameOver)comicTitle('end',String(finalScore),('Punkte! '+rating(WERTUNG,finalScore)).trim())}
 if(ball){
  ball.a+=Math.abs(ball.vy)*.06;ball.vx+=ball.h;if(!ball.c&&!ball.g&&ball.y<340)ball.vx+=(180-ball.x)*ball.hk;ball.x+=ball.vx;ball.y+=ball.vy;
  if(!ball.g&&(ball.x<66||ball.x>294)){ball.g=true;gut=true;ball.vx=0;ball.x=ball.x<180?53:307}
  for(let i=0;i<2;i++)parts.push({x:ball.x+R(-5,5),y:ball.y+10,vx:R(-.5,.5),vy:R(.3,1),l:.8,s:R(6,12),w:Math.random()<.5});
  if(!ball.g)pins.forEach(p=>{if(p.bh)return;const dx=p.x-ball.x,dy=p.y-ball.y,d=Math.hypot(dx,dy);
   if(d<17){p.bh=true;ball.c=1;const nx=d?dx/d:0,ny=d?dy/d:-1,sp=Math.min(10,Math.hypot(ball.vx,ball.vy));
    hit(p,nx*sp*.6+ball.vx*.4+R(-.6,.6)*(sp/9)**2,ny*sp*.6-1+R(-.5,.5),R(-.3,.3));
    ball.vx-=nx*sp*.22;ball.vx+=R(-1,1)*Math.max(0,lastV-10.5)*1.2;ball.vx+=Math.abs(nx)<.3?R(-1.8,1.8):0;ball.vx*=.96;ball.vy*=1-.15*ny*ny;if(ball.vy>-3)ball.vy=-3;burst(p.x,p.y,6)}});
  if(ball.y<-30)ball=null;
 }
 fc++;pins.forEach(p=>{if(p.wob){p.wob*=.94;if(p.wob<.01)p.wob=0}p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;p.vx*=.955;p.vy*=.955;p.vr*=.96;
  if(p.x<44||p.x>316){p.x=Math.max(44,Math.min(316,p.x));p.vx*=-.6}
  if(p.y<16&&!rake){p.y=16;p.vy*=-.6}
  });
 for(let i=0;i<pins.length;i++)for(let j=i+1;j<pins.length;j++){
  const a=pins[i],b=pins[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
  if(d>0&&d<22){const nx=dx/d,ny=dy/d,rel=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
   if(rel>0){const q=1.04*Math.min(a.k,b.k);hit(a,-nx*rel*q,-ny*rel*q,R(-.2,.2));hit(b,nx*rel*q,ny*rel*q,R(-.2,.2));if(!a.d){b.vx+=nx*rel*.9;b.vy+=ny*rel*.9}if(!b.d){a.vx-=nx*rel*.9;a.vy-=ny*rel*.9}if(rel>1)burst((a.x+b.x)/2,(a.y+b.y)/2,3)}}}
 parts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.l-=.025});parts=parts.filter(p=>p.l>0);
 if(state===1&&!ball){settle=pins.some(p=>Math.hypot(p.vx,p.vy)>.15)?0:settle+1;if(settle>20)done()}
}
function star(x,y,s){c.beginPath();c.moveTo(x,y-s);c.lineTo(x+s*.25,y-s*.25);c.lineTo(x+s,y);c.lineTo(x+s*.25,y+s*.25);c.lineTo(x,y+s);c.lineTo(x-s*.25,y+s*.25);c.lineTo(x-s,y);c.lineTo(x-s*.25,y-s*.25);c.closePath();c.fill()}
function draw(){
 c.clearRect(0,0,W,H);c.fillStyle='#0b0e1c';c.fillRect(0,0,W,H);
 c.fillStyle='#04050b';c.fillRect(42,0,22,H);c.fillRect(296,0,22,H);
 const g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,'#a97639');g.addColorStop(.35,'#e2ad63');g.addColorStop(1,'#d19a52');
 c.fillStyle=g;c.fillRect(64,0,232,H);
 c.strokeStyle='rgba(60,30,0,.18)';c.lineWidth=1;for(let i=1;i<8;i++){c.beginPath();c.moveTo(64+i*29,0);c.lineTo(64+i*29,H);c.stroke()}
 c.fillStyle='rgba(90,45,10,.5)';for(let i=0;i<7;i++){const x=93+i*29-29+29*0,y=360-(3-Math.abs(i-3))*14;c.beginPath();c.moveTo(64+(i+.5)*232/7,y-10);c.lineTo(64+(i+.5)*232/7-6,y+4);c.lineTo(64+(i+.5)*232/7+6,y+4);c.fill()}
 c.fillStyle='rgba(255,255,255,.55)';c.fillRect(64,H-78,232,2);
 c.fillStyle='#ff7a1a';c.fillRect(40,0,2,H);c.fillRect(318,0,2,H);
 c.fillStyle='#000';c.fillRect(64,0,232,12);
 pins.forEach(p=>{const oy=p.oy||0;if(oy<-4){c.save();c.fillStyle='rgba(0,0,0,'+Math.max(0,.28+oy/600)+')';c.beginPath();c.ellipse(p.x,p.y+9,8,3,0,0,7);c.fill();c.restore()}c.save();if(p.att){const ts=1+Math.max(0,TR-T.y)/380,sq=Math.min(1,Math.max(0,T.y-TR)/4);c.translate(180+(p.x-180)*ts,(p.y+oy)*ts);c.scale(ts*(1+.06*sq),ts*(1-.08*sq))}else{c.translate(p.x,p.y+oy);const sc=1+Math.max(0,-oy)/380;c.scale(sc,sc)}c.rotate(p.r+(p.wob?Math.sin(fc*.8)*p.wob*.5:0));c.globalAlpha=(rake&&p.y<14)?Math.max(0,(p.y+10)/24):1;
  c.fillStyle='#f7f2e6';c.beginPath();c.ellipse(0,2,7,11,0,0,7);c.fill();c.beginPath();c.ellipse(0,-10,4.5,5,0,0,7);c.fill();
  c.fillStyle='#e0383e';c.fillRect(-4.5,-5,9,2.5);c.restore()});
 if(T.y>-34){c.save();const y=T.y,dy=y-TR,hh=Math.max(0,TR-y);
        const ts=1+hh/380;c.translate(180,0);c.scale(ts,ts);c.translate(-180,0);
 c.beginPath();c.moveTo(126,y+8);c.lineTo(234,y+8);c.lineTo(194,134+dy);c.lineTo(166,134+dy);c.closePath();c.fillStyle='rgba(138,166,174,.3)';c.fill();c.lineWidth=2;c.strokeStyle='#6f8a92';c.stroke();
 const tg=c.createLinearGradient(0,y-8,0,y+8);tg.addColorStop(0,'#a9bec4');tg.addColorStop(1,'#5b737b');c.fillStyle=tg;c.beginPath();c.moveTo(124,y-8);c.lineTo(236,y-8);c.lineTo(246,y+8);c.lineTo(114,y+8);c.closePath();c.fill();c.fillStyle='#2f3f45';[132,150,168,192,210,228].forEach(x=>c.fillRect(x-2,y-1,4,4));
 c.lineWidth=3;[[4,70],[3,94],[2,118],[1,142]].forEach(([n,sy])=>{for(let i=0;i<n;i++){const sx=180+(i-(n-1)/2)*26,has=pins.some(p=>!p.d&&Math.abs(p.x-sx)<8&&Math.abs(p.y-sy)<8);c.beginPath();c.ellipse(sx,sy+dy-7,6.5,3,0,0,7);c.strokeStyle='#8aa3ab';c.stroke()}});
 c.restore()}
 if(rake){c.save();c.globalAlpha=Math.min(1,rake.t/8);c.fillStyle='rgba(0,0,0,.3)';c.fillRect(64,rake.y+5,232,5);const rg=c.createLinearGradient(0,rake.y-6,0,rake.y+6);rg.addColorStop(0,'#ffb066');rg.addColorStop(.5,'#ff7a1a');rg.addColorStop(1,'#b84a00');c.fillStyle=rg;c.fillRect(58,rake.y-6,244,12);c.restore()}
 if(ball){const b=ball,q=c.createRadialGradient(b.x-3,b.y-3,1.5,b.x,b.y,9);
  q.addColorStop(0,b.g?'#9a6a3a':'#ff9448');q.addColorStop(.65,b.g?'#7a4a1a':'#ff7a1a');q.addColorStop(1,b.g?'#6a3d14':'#e8690f');
  c.fillStyle=q;c.beginPath();c.arc(b.x,b.y,9,0,7);c.fill();c.fillStyle='#0008';
  const ca=Math.cos(b.a||0),sa=Math.sin(b.a||0);[[-.28,-.42,.86],[.34,-.28,.9],[0,.12,.99]].forEach(([hx,hy,hz])=>{const y2=hy*ca-hz*sa,z=hy*sa+hz*ca;if(z>.15){c.beginPath();c.ellipse(b.x+hx*9,b.y+y2*9,1.6,1.6*z,0,0,7);c.fill()}})}
 parts.forEach(p=>{c.fillStyle=p.w?'rgba(255,255,255,'+p.l+')':'rgba(255,170,60,'+p.l+')';star(p.x,p.y,p.s*p.l/2)});
}
/* Fester Physik-Takt (60/s), unabhängig von der Bildrate: fehlen Bilder, werden Schritte nachgeholt */
const STEP=1000/60;let acc=0,last=0,fpsN=0,fpsT=0,fpsEl=null;
if(new URLSearchParams(location.search).has('test')){fpsEl=document.createElement('div');fpsEl.style.cssText='position:absolute;right:6px;top:6px;z-index:5;font:700 11px "Space Grotesk",sans-serif;color:#fff;background:rgba(0,0,0,.55);padding:2px 6px;border-radius:4px;pointer-events:none';lwEl.appendChild(fpsEl)}
function loop(ts){
 if(!document.hidden&&last){acc+=Math.min(ts-last,250);let k=0;while(acc>=STEP&&k<15){step();acc-=STEP;k++}if(k===15)acc=0;draw();meter()}
 last=ts;
 if(fpsEl){fpsN++;if(ts-fpsT>=1000){fpsEl.textContent=Math.round(fpsN*1000/(ts-fpsT))+' fps';fpsN=0;fpsT=ts}}
 requestAnimationFrame(loop)}
/* nach Spielende: erster Klick/Tipp schliesst die Meldung und startet ein neues Spiel, wirft aber nicht */
const restart=()=>{newGame();toast.classList.remove('on');hidePow()};
cv.addEventListener('pointerdown',e=>{if(state)return;e.preventDefault();if(gameOver){restart();return}try{cv.setPointerCapture(e.pointerId)}catch(_){}aimX=toX(e);charge={t:performance.now()};toast.classList.remove('on');hidePow()});
cv.addEventListener('pointerup',()=>go());
cv.addEventListener('pointercancel',()=>{charge=null});
const pf=$('pf'),pv=$('pv'),T0=1600;let charge=null,aimX=180,shown=0;
const dismiss=()=>{if(state!==3||!msgOpen)return;toast.classList.remove('on','wait');hidePow();clearTimeout(msgT);msgOpen=false};
document.querySelector('.lw').addEventListener('pointerdown',dismiss);
const toX=e=>{const r=cv.getBoundingClientRect();return Math.max(28,Math.min(332,(e.clientX-r.left)/r.width*W))};
const go=()=>{if(charge){const v=5+8*Math.min(1,(performance.now()-charge.t)/T0),x=aimX;charge=null;shown=0;throwBall(x,v)}};
const meter=()=>{const p=charge?Math.min(1,(performance.now()-charge.t)/T0):0;pf.style.width=p*100+'%';pv.textContent=charge?Math.round((5+8*p)*2.8)+' km/h':''};
cv.addEventListener('keydown',e=>{if(state===3){if(['Enter',' ','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();dismiss()}return}if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();aimX=Math.max(28,Math.min(332,aimX+(e.key==='ArrowLeft'?-14:14)));showToast('Ziel',aimX<150?'links':aimX>210?'rechts':'Mitte')}else if((e.key==='Enter'||e.key===' ')&&!e.repeat&&!state){e.preventDefault();if(gameOver){restart();return}toast.classList.remove('on');charge={t:performance.now()}}});
cv.addEventListener('keyup',e=>{if(e.key==='Enter'||e.key===' ')go()});
rack();newGame();requestAnimationFrame(loop);
})();
