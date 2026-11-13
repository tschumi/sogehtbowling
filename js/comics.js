/* Hoppi Galoppi Solutions – Comic-Einblendungen (Sprechblase, Spare-/Strike-/Abschluss-Stern)
   Wird vom Spiel (game.js) und von der Vorschau (tests/vorschau.html) verwendet: window.HGComics.
   Beide Funktionen hängen ein SVG an `el` und geben {svg, fit, geo} zurück;
   fit.fallback = Text passt nicht in die Form, fit.sz = gewählte Schriftgrösse, geo.min = kleinste erlaubte. */
(function(root){
'use strict';
let bid=0;
const mctx=document.createElement('canvas').getContext('2d');
/* kind: 'spare' | 'strike' | 'end' (Abschluss-Stern mit Punktzahl als Titel) */
function title(el,kind,word,txt){
 const spare=kind==='spare',E=kind==='end',rnd=(a,b)=>a+Math.random()*(b-a),cx=200,cy=150,id='t'+(++bid);let o='';
 const ring=(rx,ry,n,lo,hi,lo2,hi2)=>{const p=[];for(let i=0;i<n*2;i++){const a=i/(n*2)*Math.PI*2+rnd(-.04,.04),k=i%2?rnd(lo,hi):rnd(lo2,hi2);p.push((cx+Math.cos(a)*rx*k).toFixed(1)+','+(cy+Math.sin(a)*ry*k).toFixed(1))}return p.join(' ')};
 const star=(x,y,s,d)=>'<path class="pow-s" style="animation-delay:'+d+'s" d="M'+x+' '+(y-s)+'L'+(x+s*.3)+' '+(y-s*.4)+'L'+(x+s)+' '+(y-s*.3)+'L'+(x+s*.45)+' '+(y+s*.15)+'L'+(x+s*.6)+' '+(y+s)+'L'+x+' '+(y+s*.5)+'L'+(x-s*.6)+' '+(y+s)+'L'+(x-s*.45)+' '+(y+s*.15)+'L'+(x-s)+' '+(y-s*.3)+'L'+(x-s*.3)+' '+(y-s*.4)+'Z" fill="#ffd23f" stroke="#14100a" stroke-width="2.2" stroke-linejoin="round"/>';
 const P=spare?ring(172,120,30,.88,.92,.99,1.05):E?ring(186,146,22,.87,.91,1,1.09):ring(176,126,13,.8,.86,1.02,1.18);
 const fill=spare?'#ffd23f':E?'#f7f2e6':'#ff7a1a',dot=spare?'#ff9a2e':E?'#ffb36b':'#d4500a';
 /* Speedlines: Spare schwarz, Strike gelb, Abschluss orange */
 {const N=spare?14:E?22:13;for(let i=0;i<N;i++){const a=spare?i/14*Math.PI*2+rnd(-.15,.15):(i+.5)/N*Math.PI*2,r1=spare?1.1:.98,r2=spare?rnd(1.2,1.3):rnd(1.16,1.28),w=spare?2.4:E?3.2:3.6,nx=-Math.sin(a)*w,ny=Math.cos(a)*w,x1=cx+Math.cos(a)*168*r1,y1=cy+Math.sin(a)*118*r1,x2=cx+Math.cos(a)*168*r2,y2=cy+Math.sin(a)*118*r2;o+='<polygon points="'+(x1+nx).toFixed(1)+','+(y1+ny).toFixed(1)+' '+x2.toFixed(1)+','+y2.toFixed(1)+' '+(x1-nx).toFixed(1)+','+(y1-ny).toFixed(1)+'" '+(spare?'fill="#14100a"':'fill="'+(E?'#ff7a1a':'#ffd23f')+'" stroke="#14100a" stroke-width="1.6" stroke-linejoin="round"')+'/>'}}
 for(let i=0;i<60;i++){const a=rnd(0,6.28),k=rnd(1.02,1.2),r=(1.28-k)*6;o+='<circle cx="'+(cx+Math.cos(a)*172*k).toFixed(1)+'" cy="'+(cy+Math.sin(a)*122*k).toFixed(1)+'" r="'+r.toFixed(1)+'" fill="#3a3530" opacity=".45"/>'}
 o+='<defs><pattern id="d'+id+'" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="3.5" cy="3.5" r="1.8" fill="'+dot+'"/></pattern><linearGradient id="g'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset=".4" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient><mask id="m'+id+'"><rect width="400" height="300" fill="url(#g'+id+')"/></mask></defs>';
 o+='<polygon points="'+P+'" transform="translate(6 7)" fill="#14100a" stroke="#14100a" stroke-width="5" stroke-linejoin="round"/>';
 o+='<polygon points="'+P+'" fill="'+fill+'" stroke="#14100a" stroke-width="5" stroke-linejoin="round"/>';
 o+='<polygon points="'+P+'" fill="url(#d'+id+')" mask="url(#m'+id+')"/>';
 if(!spare){const K=E?7:5;let st='',a0=rnd(0,6.28);for(let i=0;i<K;i++){const a=a0+i/K*Math.PI*2+rnd(-.3,.3),k=rnd(1.12,1.28);st+=star(+(cx+Math.cos(a)*172*k).toFixed(1),+(cy+Math.sin(a)*124*k).toFixed(1),+rnd(7,14).toFixed(1),(.22+i*.07).toFixed(2))}o+=st}
 /* Spruch gleich gross wie in der Sprechblase: dort 15/200 bei 84% Breite, hier ~28/400 bei 90% */
 const g=spare?{CX:200,CY:150,RX:142,RY:98,max:28,min:19}:E?{CX:200,CY:160,RX:150,RY:100,max:28,min:19,band:[136,258]}:{CX:200,CY:152,RX:136,RY:96,max:28,min:19};
 const ts=E?78:60,f=fitBubble(txt.split(/\s+/).filter(Boolean),word,g,E?0:74),ty=E?120:f.top+48,esc=l=>l.replace(/&/g,'&amp;').replace(/</g,'&lt;'),tc=spare||E?'#ff7a1a':'#ffe04a';
 o+='<g class="pow-w"><g transform="translate(200 '+ty.toFixed(1)+') rotate(-6) skewX(-8)"><text x="4" y="5" style="font-size:'+ts+'px;fill:#14100a;stroke:#14100a;stroke-width:'+(ts*.18).toFixed(1)+'px">'+esc(word)+'</text><text x="0" y="0" style="font-size:'+ts+'px;fill:'+tc+';stroke:#14100a;stroke-width:'+(ts*.12).toFixed(1)+'px">'+esc(word)+'</text></g></g>';
 o+='<g class="pow-t">'+f.lines.map((l,i)=>'<text x="200" y="'+(f.top+f.TH+i*f.lh+f.sz*.88).toFixed(1)+'" style="font:700 '+f.sz+'px \'Space Grotesk\',Arial,sans-serif;fill:#14100a;stroke:none;text-anchor:middle">'+esc(l)+'</text>').join('')
  +'</g>';
 const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 400 300');
 s.style.cssText='left:50%;top:50%;--w:'+(spare?90:E?96:94)+'%;--r:-2deg';s.innerHTML=o;el.appendChild(s);return{svg:s,fit:f,geo:g}}

/* Text in eine Ellipse einpassen: echte Breiten messen, pro Zeile die verfügbare Breite aus der Ellipse berechnen.
   g = Geometrie (Standard: Sprechblase); TH = Höhe für den Titel über dem Text */
const BUBBLE={CX:100,CY:70,RX:86,RY:57,max:15,min:10};
function fitBubble(words,title,g=BUBBLE,TH=title?26:0){
 const {CX,CY,RX,RY}=g,ew=(y0,y1)=>{const d=Math.max(Math.abs(y0-CY),Math.abs(y1-CY));return d>=RY?0:2*RX*Math.sqrt(1-(d/RY)*(d/RY))};
 for(let sz=g.max;sz>=g.min;sz-=.5){
  mctx.font='700 '+sz+'px "Space Grotesk",Arial,sans-serif';const wsp=mctx.measureText(' ').width,W=w=>mctx.measureText(w).width,lh=sz*1.18;
  for(let n=1;n<=6;n++){
   const top=g.band?(g.band[0]+g.band[1]-n*lh)/2-TH:CY-(n*lh+TH)/2;if(g.band&&top<g.band[0])continue;if(title&&g===BUBBLE){mctx.font='22px "Bowlby One","Arial Black",sans-serif';const tw=mctx.measureText(title).width;mctx.font='700 '+sz+'px "Space Grotesk",Arial,sans-serif';if(tw>ew(top,top+TH))continue}
   const lines=[];let cur='',i=0,ok=true;
   for(const wd of words){
    const y=top+TH+i*lh,max=ew(y,y+lh);
    if(W(wd)>max){ok=false;break}
    if(cur&&W(cur)+wsp+W(wd)>max){lines.push(cur);cur=wd;i++;if(i>=n){ok=false;break}const y2=top+TH+i*lh;if(W(wd)>ew(y2,y2+lh)){ok=false;break}}
    else cur=cur?cur+' '+wd:wd}
   if(ok&&i<n){if(cur)lines.push(cur);return{sz,lh,lines,top,TH,fallback:false}}
  }
 }
 /* Notlösung: passt nicht in die Form, grob umbrechen (wird in der Vorschau rot markiert) */
 const sz=g.min,lh=sz*1.18,lines=(words.join(' ').match(new RegExp('.{1,'+Math.floor(2*RX/(sz*.55))+'}(\\s|$)','g'))||[]).map(l=>l.trim());return{sz,lh,lines,top:CY-(lines.length*lh+TH)/2,TH,fallback:true}
}
function bubble(el,title,txt,{top,wd,pop}={}){
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
 el.appendChild(s);return{svg:s,fit:f,geo:BUBBLE}}
root.HGComics={title,bubble,fitBubble,BUBBLE};
})(window);
