/* Hoppi Galoppi Solutions – Bowling-Spiel (Canvas) */
(()=>{
const cv=document.getElementById('lane'),c=cv.getContext('2d'),W=360,H=560,dpr=Math.min(window.devicePixelRatio||1,2);
cv.width=W*dpr;cv.height=H*dpr;c.scale(dpr,dpr);
const $=id=>document.getElementById(id),toast=$('toast');
/* Sprüche kommen aus content.json (siehe site.js) */
let SPRUECHE={};(window.HG_CONTENT||Promise.resolve({})).then(c=>{if(c&&c.sprueche)SPRUECHE=c.sprueche}).catch(()=>{});
const S={t:0,p:0,s:0,r:0,g:0},R=(a,b)=>a+Math.random()*(b-a),pick=a=>a[Math.floor(Math.random()*a.length)];
const ZAHL=['keiner','einer','zwei','drei','vier','fünf','sechs','sieben','acht','neun','zehn'];
function situation(first,n,all,left,gut){
 if(first){
  if(n===10)return'strike';
  if(n===0)return gut?'rinne1':'luft1';
  if(left===1)return'neun1';
  if(n===8&&pins.filter(p=>!p.d).every(p=>p.k<1))return'mitte1';
  return n<=3?'wenig1':n<=6?'mittel1':'viel1';
 }
 if(left===0)return'spare';
 if(n===0)return gut?'rinne2':'luft2';
 if(left===1)return'knapp2';
 return all>=7?'rest2gut':all>=4?'rest2mittel':'rest2schwach';
}
function say(key,left){
const g=SPRUECHE[key];if(!g||!g.any)return '';
 const v=lastV<6.5?'sanft':lastV>11.5?'schnell':'';
 return pick(g[v]&&Math.random()<.6?g[v]:g.any).replace('{rest}',ZAHL[left]);
}
let fc=0,pins=[],ball=null,parts=[],state=0,settle=0,gut=false,lastV=9,ballNo=1,prev=0,rd=1,tt,pend=null,msgOpen=false,resetting=0,msgT=0;
const powEl=$('pow'),lwEl=document.querySelector('.lw');let powT=[];
function hidePow(){powT.forEach(clearTimeout);powT=[];powEl.querySelectorAll('svg').forEach(s=>{s.classList.add('out');setTimeout(()=>s.remove(),300)});toast.classList.remove('low')}

function comicTitle(spare,word,txt){
 const rnd=(a,b)=>a+Math.random()*(b-a),cx=200,cy=150,id='t'+(++bid);let o='';
 const ring=(rx,ry,n,lo,hi,lo2,hi2)=>{const p=[];for(let i=0;i<n*2;i++){const a=i/(n*2)*Math.PI*2+rnd(-.04,.04),k=i%2?rnd(lo,hi):rnd(lo2,hi2);p.push((cx+Math.cos(a)*rx*k).toFixed(1)+','+(cy+Math.sin(a)*ry*k).toFixed(1))}return p.join(' ')};
 const star=(x,y,s,d)=>'<path class="pow-s" style="animation-delay:'+d+'s" d="M'+x+' '+(y-s)+'L'+(x+s*.3)+' '+(y-s*.4)+'L'+(x+s)+' '+(y-s*.3)+'L'+(x+s*.45)+' '+(y+s*.15)+'L'+(x+s*.6)+' '+(y+s)+'L'+x+' '+(y+s*.5)+'L'+(x-s*.6)+' '+(y+s)+'L'+(x-s*.45)+' '+(y+s*.15)+'L'+(x-s)+' '+(y-s*.3)+'L'+(x-s*.3)+' '+(y-s*.4)+'Z" fill="#ffd23f" stroke="#14100a" stroke-width="2.2" stroke-linejoin="round"/>';
 const P=spare?ring(168,118,30,.86,.9,.98,1.04):ring(168,120,13,.72,.8,.96,1.14);
 const fill=spare?'#ffd23f':'#ff7a1a',dot=spare?'#ff9a2e':'#d4500a';
 {const N=spare?14:13;for(let i=0;i<N;i++){const a=spare?i/14*Math.PI*2+rnd(-.15,.15):(i+.5)/13*Math.PI*2,r1=spare?1.1:.98,r2=spare?rnd(1.2,1.3):rnd(1.16,1.26),w=spare?2.4:3.6,nx=-Math.sin(a)*w,ny=Math.cos(a)*w,x1=cx+Math.cos(a)*168*r1,y1=cy+Math.sin(a)*118*r1,x2=cx+Math.cos(a)*168*r2,y2=cy+Math.sin(a)*118*r2;o+='<polygon points="'+(x1+nx).toFixed(1)+','+(y1+ny).toFixed(1)+' '+x2.toFixed(1)+','+y2.toFixed(1)+' '+(x1-nx).toFixed(1)+','+(y1-ny).toFixed(1)+'" '+(spare?'fill="#14100a"':'fill="#ffd23f" stroke="#14100a" stroke-width="1.6" stroke-linejoin="round"')+'/>'}}
 for(let i=0;i<60;i++){const a=rnd(0,6.28),k=rnd(1.02,1.2),r=(1.28-k)*6;o+='<circle cx="'+(cx+Math.cos(a)*172*k).toFixed(1)+'" cy="'+(cy+Math.sin(a)*122*k).toFixed(1)+'" r="'+r.toFixed(1)+'" fill="#3a3530" opacity=".45"/>'}
 o+='<defs><pattern id="d'+id+'" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="3.5" cy="3.5" r="1.8" fill="'+dot+'"/></pattern><linearGradient id="g'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset=".4" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient><mask id="m'+id+'"><rect width="400" height="300" fill="url(#g'+id+')"/></mask></defs>';
 o+='<polygon points="'+P+'" transform="translate(6 7)" fill="#14100a" stroke="#14100a" stroke-width="5" stroke-linejoin="round"/>';
 o+='<polygon points="'+P+'" fill="'+fill+'" stroke="#14100a" stroke-width="5" stroke-linejoin="round"/>';
 o+='<polygon points="'+P+'" fill="url(#d'+id+')" mask="url(#m'+id+')"/>';
 if(!spare){let st='',a0=rnd(0,6.28);for(let i=0;i<5;i++){const a=a0+i/5*Math.PI*2+rnd(-.3,.3),k=rnd(1.12,1.28);st+=star(+(cx+Math.cos(a)*172*k).toFixed(1),+(cy+Math.sin(a)*124*k).toFixed(1),+rnd(7,14).toFixed(1),(.22+i*.07).toFixed(2))}o+=st}
 const words=txt.split(/\s+/).filter(Boolean),maxW=spare?224:220,wrap=z=>{mctx.font='700 '+z+'px "Space Grotesk",Arial,sans-serif';const L=[];let cur='';words.forEach(wd=>{const t=cur?cur+' '+wd:wd;if(cur&&mctx.measureText(t).width>maxW){L.push(cur);cur=wd}else cur=t});if(cur)L.push(cur);return L};
 let sz=20,lines=wrap(sz);while(lines.length>2&&sz>16)lines=wrap(--sz);if(lines.length>2){sz=18;lines=wrap(sz);while(lines.length>3&&sz>13)lines=wrap(--sz)}
 const lh=sz*1.2,ty=150-(lines.length-1)*lh*.5,esc=l=>l.replace(/&/g,'&amp;').replace(/</g,'&lt;'),tc=spare?'#ff7a1a':'#ffe04a';
 o+='<g class="pow-w"><g transform="translate(200 '+ty.toFixed(1)+') rotate(-6) skewX(-8)"><text x="4" y="5" style="font-size:60px;fill:#14100a;stroke:#14100a;stroke-width:11px">'+word+'</text><text x="0" y="0" style="font-size:60px;fill:'+tc+';stroke:#14100a;stroke-width:7px">'+word+'</text></g></g>';
 o+='<g class="pow-t">'+lines.map((l,i)=>'<text x="200" y="'+(ty+42+i*lh).toFixed(1)+'" style="font:700 '+sz+'px \'Space Grotesk\',Arial,sans-serif;fill:#14100a;stroke:none;text-anchor:middle">'+esc(l)+'</text>').join('')+'</g>';
 const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 400 300');
 s.style.cssText='left:50%;top:50%;--w:'+(spare?90:94)+'%;--r:-2deg';s.innerHTML=o;powEl.appendChild(s);lwEl.classList.remove('shake');void lwEl.offsetWidth;lwEl.classList.add('shake')}
let bid=0;
const mctx=document.createElement('canvas').getContext('2d');
/* Text in die Ellipse der Blase einpassen: echte Breiten messen, pro Zeile die verfügbare Breite aus der Ellipse berechnen */
function fitBubble(words,title){
 const CX=100,CY=70,RX=86,RY=57,TH=title?26:0,ew=(y0,y1)=>{const d=Math.max(Math.abs(y0-CY),Math.abs(y1-CY));return d>=RY?0:2*RX*Math.sqrt(1-(d/RY)*(d/RY))};
 for(let sz=15;sz>=10;sz-=.5){
  mctx.font='700 '+sz+'px "Space Grotesk",Arial,sans-serif';const wsp=mctx.measureText(' ').width,W=w=>mctx.measureText(w).width,lh=sz*1.18;
  for(let n=1;n<=6;n++){
   const top=CY-(n*lh+TH)/2;if(title){mctx.font='22px "Bowlby One","Arial Black",sans-serif';const tw=mctx.measureText(title).width;mctx.font='700 '+sz+'px "Space Grotesk",Arial,sans-serif';if(tw>ew(top,top+TH))continue}
   const lines=[];let cur='',i=0,ok=true;
   for(const wd of words){
    const y=top+TH+i*lh,max=ew(y,y+lh);
    if(W(wd)>max){ok=false;break}
    if(cur&&W(cur)+wsp+W(wd)>max){lines.push(cur);cur=wd;i++;if(i>=n){ok=false;break}const y2=top+TH+i*lh;if(W(wd)>ew(y2,y2+lh)){ok=false;break}}
    else cur=cur?cur+' '+wd:wd}
   if(ok&&i<n){if(cur)lines.push(cur);return{sz,lh,lines,top,TH}}
  }
 }
 const sz=10,lh=11.8,lines=words.join(' ').match(/.{1,26}(\s|$)/g).map(l=>l.trim());return{sz,lh,lines,top:70-(lines.length*lh+TH)/2,TH}
}
function comicBubble(title,txt,top,wd,pop){
 const id='y'+(++bid),words=txt.split(/\s+/).filter(Boolean),f=fitBubble(words,title),esc=l=>l.replace(/&/g,'&amp;').replace(/</g,'&lt;');
 const body='M100 8C150 8 192 34 192 70C192 106 150 132 108 132C96 132 86 131 76 129L44 160L56 124C26 114 8 94 8 70C8 34 50 8 100 8Z';
 const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 200 170');
 if(!pop)s.classList.add('soft');s.style.cssText='left:50%;top:'+(top||50)+'%;--w:'+(wd||84)+'%;--r:-1.5deg';
 s.innerHTML='<defs><pattern id="d'+id+'" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="2.5" cy="2.5" r="1.2" fill="#ff9a2e"/></pattern><linearGradient id="g'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient><mask id="m'+id+'"><rect width="200" height="170" fill="url(#g'+id+')"/></mask></defs>'
  +'<path d="'+body+'" transform="translate(4 5)" fill="#14100a" stroke="#14100a" stroke-width="4" stroke-linejoin="round"/>'
  +'<path d="'+body+'" fill="#ffc477" stroke="#14100a" stroke-width="4" stroke-linejoin="round"/>'
  +'<path d="'+body+'" fill="url(#d'+id+')" mask="url(#m'+id+')"/>'
  +(title?'<text x="100" y="'+(f.top+20).toFixed(1)+'" style="font-size:22px;fill:#14100a;stroke:none">'+esc(title)+'</text>':'')
  +f.lines.map((l,i)=>'<text x="100" y="'+(f.top+f.TH+i*f.lh+f.sz*.88).toFixed(1)+'" style="font:700 '+f.sz+'px \'Space Grotesk\',Arial,sans-serif;fill:#14100a;stroke:none;text-anchor:middle">'+esc(l)+'</text>').join('');
 powEl.appendChild(s)}
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
 if(state)return;state=1;settle=0;gut=false;toast.classList.remove('on');hidePow();
 tx=Math.max(28,Math.min(332,tx));const v=lastV=pwr||9,N=(H-36-150)/v;
 pins.forEach(p=>{p.bh=false});if(cheat==='r'){cheat=0;tx=40}
 else if(cheat==='x'){cheat=0;pins.forEach(p=>{p.d=true;p.r=R(-1,1)})}
 else if(cheat==='s'){const st=pins.filter(p=>!p.d).sort(()=>Math.random()-.5).slice(0,ballNo===1?2:0);pins.forEach(p=>{if(!st.includes(p)){p.d=true;p.r=R(-1,1)}});if(ballNo===1)cheat='s2';else cheat=0}
 else if(cheat==='s2'&&ballNo===2){cheat=0;pins.forEach(p=>{p.d=true;p.r=R(-1,1)})}ball={x:180,y:H-36,vx:(tx-180)/N+R(-.2,.2)*v/9,vy:-v,h:R(-.012,.012),hk:.0006*9/v,c:0,a:0,g:false};
 }
function done(){
 state=2;const n=pins.filter(p=>p.d).length,left=pins.length-n,first=ballNo===1,tot=10,all=first?n:prev+n;
 S.p+=n;if(gut)S.g++;
 const strike=first&&n===10,spare=!first&&left===0;
 if(strike)S.s++;if(spare)S.r++;
 $('sP').textContent=S.p;$('sS').textContent=S.s;$('sR').textContent=S.r;$('sG').textContent=S.g;
 const t=say(situation(first,n,all,left,gut),left);
 const over=strike||!first;
  if(spare||strike)comicTitle(spare,spare?'SPARE!':'STRIKE!',t);
  else comicBubble((gut&&n===0)?'RINNE!':all+' von '+tot,t);
  clearTimeout(msgT);msgT=setTimeout(dismiss,(strike||spare)?4500+t.length*50:2600+t.length*42);
 pend=()=>{
  resetting=2;
  if(over){plan(false);ballNo=1;prev=0;rd++}
  else{prev=n;plan(true);ballNo=2}
  $('sT').textContent=rd;document.querySelectorAll('.dots i').forEach((d,i)=>d.classList.toggle('on',i<ballNo));
 };
 state=3;msgOpen=true;resetting=1;setTimeout(pend,900);
}
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
 if(state===3&&!resetting&&!msgOpen)state=0;
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
function loop(){if(!document.hidden){step();draw();meter()}requestAnimationFrame(loop)}
cv.addEventListener('pointerdown',e=>{if(state)return;e.preventDefault();try{cv.setPointerCapture(e.pointerId)}catch(_){}aimX=toX(e);charge={t:performance.now()};toast.classList.remove('on');hidePow()});
cv.addEventListener('pointerup',()=>go());
cv.addEventListener('pointercancel',()=>{charge=null});
const pf=$('pf'),pv=$('pv'),T0=1600;let charge=null,aimX=180,shown=0;
const dismiss=()=>{if(state!==3||!msgOpen)return;toast.classList.remove('on','wait');hidePow();clearTimeout(msgT);msgOpen=false};
document.querySelector('.lw').addEventListener('pointerdown',dismiss);
const toX=e=>{const r=cv.getBoundingClientRect();return Math.max(28,Math.min(332,(e.clientX-r.left)/r.width*W))};
const go=()=>{if(charge){const v=5+8*Math.min(1,(performance.now()-charge.t)/T0),x=aimX;charge=null;shown=0;throwBall(x,v)}};
const meter=()=>{const p=charge?Math.min(1,(performance.now()-charge.t)/T0):0;pf.style.width=p*100+'%';pv.textContent=charge?Math.round((5+8*p)*2.8)+' km/h':''};
cv.addEventListener('keydown',e=>{if(state===3){if(['Enter',' ','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();dismiss()}return}if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();aimX=Math.max(28,Math.min(332,aimX+(e.key==='ArrowLeft'?-14:14)));showToast('Ziel',aimX<150?'links':aimX>210?'rechts':'Mitte')}else if((e.key==='Enter'||e.key===' ')&&!e.repeat&&!state){e.preventDefault();toast.classList.remove('on');charge={t:performance.now()}}});
cv.addEventListener('keyup',e=>{if(e.key==='Enter'||e.key===' ')go()});
rack();loop();
})();
