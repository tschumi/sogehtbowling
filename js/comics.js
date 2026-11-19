/* Hoppi Galoppi Solutions – Comic-Einblendungen (Sprechblase, Spare-/Strike-/Abschluss-Stern)
   Wird vom Spiel (game.js) und von der Vorschau (tests/vorschau.html) verwendet: window.HGComics.
   Beide Funktionen hängen ein SVG an `el` und geben {svg, fit, geo} zurück;
   fit.fallback = Text passt nicht in die Form, fit.sz = gewählte Schriftgrösse, geo.min = kleinste erlaubte.

   Die Formen werden mit etwas Zufall gezeichnet, damit kein Stern genau gleich aussieht.
   Animationen (Aufploppen, Wackeln) stehen in styles.css unter .pow. */
(function(root){
'use strict';

const INK='#14100a';                 // Comic-Schwarz für Umrisse und Schatten
const TEXT_FONT='"Space Grotesk",Arial,sans-serif';
const TITLE_FONT='"Bowlby One","Arial Black",sans-serif';
const SVG_NS='http://www.w3.org/2000/svg';

/* Aussehen der drei Sterne. Koordinaten im SVG mit 400 × 300, Mitte bei 200/150.
   ring:   Zacken des Sterns [Radius x, Radius y, Anzahl Zacken, innen von–bis, aussen von–bis] (Faktoren auf den Radius)
   fill:   Farbe des Sterns, dot: Farbe der Rasterpunkte unten im Stern
   lines:  Anzahl Speedlines rundherum, lineW: deren Breite, lineFill: Farbe (ohne = schwarz, ohne Umriss)
   stars:  kleine Sterne rundherum, scale: Breite der Einblendung in % der Bahn, word: Farbe des Titels
   text:   Ellipse, in die der Spruch eingepasst wird (Mitte, Radien, Schriftgrösse max/min; band: nur zwischen diesen y)
   Spruch gleich gross wie in der Sprechblase: dort 15/200 bei 84 % Breite, hier ~28/400 bei 90 %. */
const KINDS={
 strike:{ring:[176,126,13,.8,.86,1.02,1.18],fill:'#ff7a1a',dot:'#d4500a',lines:13,lineW:3.6,lineFill:'#ffd23f',
  stars:5,scale:94,word:'#ffe04a',titleSize:60,text:{CX:200,CY:152,RX:136,RY:96,max:28,min:19}},
 spare:{ring:[172,120,30,.88,.92,.99,1.05],fill:'#ffd23f',dot:'#ff9a2e',lines:14,lineW:2.4,lineFill:null,
  stars:0,scale:90,word:'#ff7a1a',titleSize:60,text:{CX:200,CY:150,RX:142,RY:98,max:28,min:19}},
 /* Abschluss: Punktzahl als Titel, oben fest platziert, der Text darunter im Band */
 end:{ring:[186,146,22,.87,.91,1,1.09],fill:'#f7f2e6',dot:'#ffb36b',lines:22,lineW:3.2,lineFill:'#ff7a1a',
  stars:7,scale:96,word:'#ff7a1a',titleSize:78,text:{CX:200,CY:160,RX:150,RY:100,max:28,min:19,band:[136,258]}}
};

/* Sprechblase: Koordinaten im SVG mit 200 × 170 */
const BUBBLE={CX:100,CY:70,RX:86,RY:57,max:15,min:10};
const BUBBLE_PATH='M100 8C150 8 192 34 192 70C192 106 150 132 108 132C96 132 86 131 76 129L44 160L56 124C26 114 8 94 8 70C8 34 50 8 100 8Z';

let uid=0; // macht IDs von Mustern und Masken eindeutig, wenn mehrere Einblendungen gleichzeitig da sind
const measure=document.createElement('canvas').getContext('2d');
const rnd=(a,b)=>a+Math.random()*(b-a);
const f1=n=>n.toFixed(1);
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const words=txt=>txt.split(/\s+/).filter(Boolean);

/* Rasterpunkte, die nach unten hin sichtbar werden (Comic-Schattierung): Musterzelle cell mit Punktradius r,
   sichtbar ab der Höhe from (0–1) */
function dotShade(id,w,h,cell,r,color,from){
 return '<defs><pattern id="d'+id+'" width="'+cell+'" height="'+cell+'" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">'
  +'<circle cx="'+cell/2+'" cy="'+cell/2+'" r="'+r+'" fill="'+color+'"/></pattern>'
  +'<linearGradient id="g'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="'+from+'" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient>'
  +'<mask id="m'+id+'"><rect width="'+w+'" height="'+h+'" fill="url(#g'+id+')"/></mask></defs>';
}

/* Eingepasste Textzeilen als SVG, zentriert auf x */
function textLines(f,x){
 return f.lines.map((l,i)=>'<text x="'+x+'" y="'+f1(f.top+f.TH+i*f.lh+f.sz*.88)+'" style="font:700 '+f.sz+'px \'Space Grotesk\',Arial,sans-serif;fill:'+INK+';stroke:none;text-anchor:middle">'+esc(l)+'</text>').join('');
}

/* SVG-Element mit Inhalt anlegen und anhängen (cls: optionale Klasse) */
function mount(el,viewBox,cls,css,content){
 const s=document.createElementNS(SVG_NS,'svg');
 s.setAttribute('viewBox',viewBox);if(cls)s.classList.add(cls);s.style.cssText=css;s.innerHTML=content;
 el.appendChild(s);return s;
}

/* ---------- Stern (Strike, Spare, Abschluss) ----------
   kind: 'spare' | 'strike' | 'end' (Abschluss-Stern mit Punktzahl als Titel), word: grosser Titel, txt: Spruch */
function title(el,kind,word,txt){
 const spare=kind==='spare',end=kind==='end',K=KINDS[kind]||KINDS.strike;
 const cx=200,cy=150,id='t'+(++uid);
 let o='';

 /* Umriss des Sterns: abwechselnd innere und äussere Zacken, leicht unregelmässig */
 const [rx,ry,n,inLo,inHi,outLo,outHi]=K.ring,pts=[];
 for(let i=0;i<n*2;i++){
  const a=i/(n*2)*Math.PI*2+rnd(-.04,.04),k=i%2?rnd(inLo,inHi):rnd(outLo,outHi);
  pts.push(f1(cx+Math.cos(a)*rx*k)+','+f1(cy+Math.sin(a)*ry*k));
 }
 const shape=pts.join(' ');

 /* Speedlines: spitze Dreiecke rundherum. Spare schwarz und unregelmässig verteilt, sonst farbig mit Umriss */
 for(let i=0;i<K.lines;i++){
  const a=spare?i/K.lines*Math.PI*2+rnd(-.15,.15):(i+.5)/K.lines*Math.PI*2;
  const r1=spare?1.1:.98,r2=spare?rnd(1.2,1.3):rnd(1.16,1.28);
  const nx=-Math.sin(a)*K.lineW,ny=Math.cos(a)*K.lineW;
  const x1=cx+Math.cos(a)*168*r1,y1=cy+Math.sin(a)*118*r1,x2=cx+Math.cos(a)*168*r2,y2=cy+Math.sin(a)*118*r2;
  o+='<polygon points="'+f1(x1+nx)+','+f1(y1+ny)+' '+f1(x2)+','+f1(y2)+' '+f1(x1-nx)+','+f1(y1-ny)+'" '
   +(K.lineFill?'fill="'+K.lineFill+'" stroke="'+INK+'" stroke-width="1.6" stroke-linejoin="round"':'fill="'+INK+'"')+'/>';
 }

 /* Staubwolke: graue Punkte, je weiter aussen, desto kleiner */
 for(let i=0;i<60;i++){
  const a=rnd(0,6.28),k=rnd(1.02,1.2),r=(1.28-k)*6;
  o+='<circle cx="'+f1(cx+Math.cos(a)*172*k)+'" cy="'+f1(cy+Math.sin(a)*122*k)+'" r="'+f1(r)+'" fill="#3a3530" opacity=".45"/>';
 }

 /* Stern: Schatten, Fläche, Rasterpunkte */
 o+=dotShade(id,400,300,7,1.8,K.dot,'.4');
 o+='<polygon points="'+shape+'" transform="translate(6 7)" fill="'+INK+'" stroke="'+INK+'" stroke-width="5" stroke-linejoin="round"/>';
 o+='<polygon points="'+shape+'" fill="'+K.fill+'" stroke="'+INK+'" stroke-width="5" stroke-linejoin="round"/>';
 o+='<polygon points="'+shape+'" fill="url(#d'+id+')" mask="url(#m'+id+')"/>';

 /* kleine gelbe Sterne rundherum, die nacheinander aufploppen */
 if(K.stars){
  const a0=rnd(0,6.28);
  for(let i=0;i<K.stars;i++){
   const a=a0+i/K.stars*Math.PI*2+rnd(-.3,.3),k=rnd(1.12,1.28);
   o+=sparkle(+f1(cx+Math.cos(a)*172*k),+f1(cy+Math.sin(a)*124*k),+f1(rnd(7,14)),(.22+i*.07).toFixed(2));
  }
 }

 /* Titel (schräg, mit Schatten) und Spruch */
 const ts=K.titleSize,f=fitBubble(words(txt),word,K.text,end?0:74),ty=end?120:f.top+48;
 o+='<g class="pow-w"><g transform="translate(200 '+f1(ty)+') rotate(-6) skewX(-8)">'
  +'<text x="4" y="5" style="font-size:'+ts+'px;fill:'+INK+';stroke:'+INK+';stroke-width:'+f1(ts*.18)+'px">'+esc(word)+'</text>'
  +'<text x="0" y="0" style="font-size:'+ts+'px;fill:'+K.word+';stroke:'+INK+';stroke-width:'+f1(ts*.12)+'px">'+esc(word)+'</text></g></g>';
 o+='<g class="pow-t">'+textLines(f,200)+'</g>';

 const svg=mount(el,'0 0 400 300','','left:50%;top:50%;--w:'+K.scale+'%;--r:-2deg',o);
 return {svg,fit:f,geo:K.text};
}

/* Kleiner Stern mit fünf Zacken um x/y, Grösse s, Animation verzögert um d Sekunden */
function sparkle(x,y,s,d){
 const xs=[x,x+s*.3,x+s,x+s*.45,x+s*.6,x,x-s*.6,x-s*.45,x-s,x-s*.3];
 const ys=[y-s,y-s*.4,y-s*.3,y+s*.15,y+s,y+s*.5,y+s,y+s*.15,y-s*.3,y-s*.4];
 return '<path class="pow-s" style="animation-delay:'+d+'s" d="'+xs.map((v,i)=>(i?'L':'M')+v+' '+ys[i]).join('')+'Z" fill="#ffd23f" stroke="'+INK+'" stroke-width="2.2" stroke-linejoin="round"/>';
}

/* ---------- Text einpassen ----------
   Text in eine Ellipse einpassen: echte Breiten messen, pro Zeile die verfügbare Breite aus der Ellipse berechnen.
   Beginnt mit der grössten Schrift und möglichst wenig Zeilen und wird kleiner, bis alles passt.
   g = Geometrie (Standard: Sprechblase); TH = Höhe für den Titel über dem Text */
function fitBubble(words,title,g=BUBBLE,TH=title?26:0){
 const {CX,CY,RX,RY}=g;
 /* verfügbare Breite der Ellipse zwischen y0 und y1 (an der engeren Stelle) */
 const widthAt=(y0,y1)=>{
  const d=Math.max(Math.abs(y0-CY),Math.abs(y1-CY));
  return d>=RY?0:2*RX*Math.sqrt(1-(d/RY)*(d/RY));
 };
 /* Titel der Sprechblase muss auch hineinpassen */
 measure.font='22px '+TITLE_FONT;
 const titleW=title&&g===BUBBLE?measure.measureText(title).width:0;

 for(let sz=g.max;sz>=g.min;sz-=.5){
  measure.font='700 '+sz+'px '+TEXT_FONT;
  const W=w=>measure.measureText(w).width,space=W(' '),lh=sz*1.18;
  for(let n=1;n<=6;n++){
   /* Oberkante des Textblocks: in der Ellipse mittig, beim Abschluss-Stern mittig im Band */
   const top=g.band?(g.band[0]+g.band[1]-n*lh)/2-TH:CY-(n*lh+TH)/2;
   if(g.band&&top<g.band[0])continue;
   if(titleW>widthAt(top,top+TH))continue;
   const lines=wrap(words,W,space,n,i=>{const y=top+TH+i*lh;return widthAt(y,y+lh)});
   if(lines)return {sz,lh,lines,top,TH,fallback:false};
  }
 }
 /* Notlösung: passt nicht in die Form, grob umbrechen (wird in der Vorschau rot markiert) */
 const sz=g.min,lh=sz*1.18,perLine=Math.floor(2*RX/(sz*.55));
 const lines=(words.join(' ').match(new RegExp('.{1,'+perLine+'}(\\s|$)','g'))||[]).map(l=>l.trim());
 return {sz,lh,lines,top:CY-(lines.length*lh+TH)/2,TH,fallback:true};
}

/* Wörter auf höchstens n Zeilen verteilen; maxW(i) = verfügbare Breite der Zeile i.
   Gibt die Zeilen zurück oder null, wenn es nicht passt. */
function wrap(words,W,space,n,maxW){
 const lines=[];let cur='',i=0;
 for(const wd of words){
  if(W(wd)>maxW(i))return null;
  if(cur&&W(cur)+space+W(wd)>maxW(i)){
   lines.push(cur);cur=wd;i++;
   if(i>=n||W(wd)>maxW(i))return null;
  }
  else cur=cur?cur+' '+wd:wd;
 }
 if(cur)lines.push(cur);
 return lines;
}

/* ---------- Sprechblase ----------
   title: Kopfzeile (z.B. "7 von 10"), txt: Spruch.
   Optionen: top (Lage in % der Bahnhöhe), wd (Breite in %), pop (aufploppen wie die Sterne statt sanft einblenden) */
function bubble(el,title,txt,{top,wd,pop}={}){
 const id='y'+(++uid),f=fitBubble(words(txt),title);
 const o=dotShade(id,200,170,5,1.2,'#ff9a2e','.45')
  +'<path d="'+BUBBLE_PATH+'" transform="translate(4 5)" fill="'+INK+'" stroke="'+INK+'" stroke-width="4" stroke-linejoin="round"/>'
  +'<path d="'+BUBBLE_PATH+'" fill="#ffc477" stroke="'+INK+'" stroke-width="4" stroke-linejoin="round"/>'
  +'<path d="'+BUBBLE_PATH+'" fill="url(#d'+id+')" mask="url(#m'+id+')"/>'
  +(title?'<text x="100" y="'+f1(f.top+20)+'" style="font-size:22px;fill:'+INK+';stroke:none">'+esc(title)+'</text>':'')
  +textLines(f,100);
 const svg=mount(el,'0 0 200 170',pop?'':'soft','left:50%;top:'+(top||50)+'%;--w:'+(wd||84)+'%;--r:-1.5deg',o);
 return {svg,fit:f,geo:BUBBLE};
}

root.HGComics={title,bubble,fitBubble,BUBBLE};
})(window);
