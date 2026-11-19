/* Hoppi Galoppi Solutions – Bild zum Teilen am Spielende: window.HGShare
   Setzt Spieltafel, Bahn (so wie sie gerade aussieht) mit Abschluss-Stern und Adresse zu einem PNG zusammen.
   Der Stern ist ein SVG aus comics.js. Als Bild gezeichnet sieht ein SVG die Schriften der Seite nicht,
   darum werden sie (einmal geladen) als data:-Adresse in das SVG eingebettet.
   Masse in CSS-Pixeln wie auf der Seite, das Bild wird mit SCALE hochgerechnet. */
(function(root){
'use strict';

const SCALE=2;                       // Auflösung des Bildes (×2 = 784 × 1416 Pixel)
const PAD=16,GAP=10;                 // Rand rundherum, Abstand Tafel–Bahn
const SHEET_H=56,FOOT_H=46;          // Höhe der Spieltafel und der Fusszeile
const STAR_BLEED=60;                 // Zacken, Speedlines und Sternchen ragen so weit über das SVG (400 × 300) hinaus
const C={bg:'#0b0e1c',acc:'#ff7a1a',cream:'#f7f2e6',dim:'#a9b0cf',line:'#2e365c',sheet:'#11162b'};
/* Schriften relativ zu diesem Skript (js/…), damit es auch aus Unterordnern wie tests/ klappt */
const BASE=document.currentScript?new URL('../',document.currentScript.src).href:'';
const FONTS=[['Bowlby One','assets/fonts/BowlbyOne-Regular.ttf','400'],
 ['Space Grotesk','assets/fonts/SpaceGrotesk-VariableFont_wght.ttf','300 700']];
/* wie .pow text in styles.css; Animationen aus, damit alles im Endzustand steht */
const STAR_CSS='text{font:400 46px "Bowlby One","Arial Black",sans-serif;text-anchor:middle;stroke-linejoin:round;paint-order:stroke}*{animation:none!important}';

/* Schriften einmal laden und als @font-face mit data:-Adresse bereitstellen (ohne Schriften: Ersatzschrift) */
let fontCss=null;
function embedFonts(){
 if(!fontCss)fontCss=Promise.all(FONTS.map(([name,url,w])=>fetch(BASE+url).then(r=>r.blob()).then(b=>new Promise((ok,fail)=>{
  const fr=new FileReader();
  fr.onload=()=>ok('@font-face{font-family:"'+name+'";src:url('+fr.result+') format("truetype");font-weight:'+w+'}');
  fr.onerror=fail;fr.readAsDataURL(b);
 })))).then(a=>a.join('')).catch(()=>{fontCss=null;return ''});
 return fontCss;
}

/* Kopie des Stern-SVG fürs Bild (ohne Klasse und Stil der Seite). Auf der Seite ragt der Stern über das SVG hinaus
   (overflow:visible), als Bild würde er am Rand abgeschnitten: darum rundherum um STAR_BLEED grösser */
function starCopy(svg){
 const s=svg.cloneNode(true),b=STAR_BLEED;
 s.removeAttribute('class');s.removeAttribute('style');
 s.setAttribute('xmlns','http://www.w3.org/2000/svg');
 s.setAttribute('viewBox',-b+' '+-b+' '+(400+2*b)+' '+(300+2*b));s.setAttribute('width',400+2*b);s.setAttribute('height',300+2*b);
 return s;
}

/* SVG als Bild laden, mit eingebetteten Schriften */
function svgImage(s,css){
 const st=document.createElementNS('http://www.w3.org/2000/svg','style');st.textContent=css+STAR_CSS;s.prepend(st);
 const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(s)],{type:'image/svg+xml'}));
 return new Promise((ok,fail)=>{
  const img=new Image();
  img.onload=()=>{URL.revokeObjectURL(url);ok(img)};
  img.onerror=e=>{URL.revokeObjectURL(url);fail(e)};
  img.src=url;
 });
}

function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect?ctx.roundRect(x,y,w,h,r):ctx.rect(x,y,w,h)}

/* Spieltafel wie .sheet in styles.css: neun Frames, der zehnte 1.5-mal so breit */
function drawSheet(ctx,x,y,w,frames,marks,scores){
 const u=w/10.5,sc=scores(frames),nH=15,bH=17;
 ctx.save();
 roundRect(ctx,x,y,w,SHEET_H,6);ctx.fillStyle=C.sheet;ctx.fill();ctx.clip();
 ctx.strokeStyle=C.line;ctx.lineWidth=1;ctx.textAlign='center';ctx.textBaseline='middle';
 const line=(x1,y1,x2,y2)=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()};
 for(let f=0;f<10;f++){
  const fx=x+f*u,fw=f===9?u*1.5:u;
  if(f)line(fx,y,fx,y+SHEET_H);
  line(fx,y+nH,fx+fw,y+nH);
  ctx.fillStyle=C.dim;ctx.font='400 9.6px "Space Grotesk",sans-serif';ctx.fillText(String(f+1),fx+fw/2,y+nH/2+.5);
  /* Wurf-Kästchen: rechts eines (Frame 1–9) bzw. drei gleich breite (Frame 10), mit Rahmen links und unten */
  const m=marks(frames[f]||[],f),bw=f===9?fw/3:fw/2;
  ctx.font='700 11.2px "Space Grotesk",sans-serif';ctx.fillStyle=C.cream;
  m.forEach((t,i)=>{
   const bx=f===9?fx+i*bw:fx+fw/2*i;
   if(i){line(bx,y+nH,bx,y+nH+bH);line(bx,y+nH+bH,bx+bw,y+nH+bH)}
   if(t)ctx.fillText(t,bx+bw/2,y+nH+bH/2+.5);
  });
  if(sc[f]!==null){ctx.fillStyle=C.acc;ctx.font='700 13.6px "Space Grotesk",sans-serif';ctx.fillText(String(sc[f]),fx+fw/2,y+nH+bH+12)}
 }
 ctx.restore();
 roundRect(ctx,x+.75,y+.75,w-1.5,SHEET_H-1.5,6);ctx.strokeStyle=C.line;ctx.lineWidth=1.5;ctx.stroke();
}

/* Bild erzeugen. o: {lane: Canvas der Bahn, w/h: Bahn-Masse, star: SVG des Abschluss-Sterns (oder null),
   frames, marks, scores (aus HGRules), site: Adresse für die Fusszeile}
   Ergibt ein Promise mit dem PNG als Blob. */
async function card(o){
 const W=o.w+PAD*2,H=PAD+SHEET_H+GAP+o.h+FOOT_H+PAD/2;
 /* Bahn, Stern und Spielstand sofort festhalten: bis die Schriften geladen sind, läuft das Spiel weiter
    (Funkenregen, neues Spiel, Stern wird ausgeblendet) */
 const lane=document.createElement('canvas');lane.width=o.lane.width;lane.height=o.lane.height;
 lane.getContext('2d').drawImage(o.lane,0,0);
 const st=o.star&&o.star.style,star=o.star&&starCopy(o.star),frames=o.frames.map(r=>r.slice());
 const sw=o.w*(st&&parseFloat(st.getPropertyValue('--w'))||96)/100,k=sw/400; /* k: SVG-Einheit → Bild */
 const rot=(st&&parseFloat(st.getPropertyValue('--r'))||0)*Math.PI/180;

 const [css]=await Promise.all([embedFonts(),document.fonts?document.fonts.ready:null]);
 const img=star?await svgImage(star,css).catch(()=>null):null;

 const c=document.createElement('canvas');c.width=W*SCALE;c.height=H*SCALE;
 const ctx=c.getContext('2d');ctx.scale(SCALE,SCALE);
 /* Hintergrund wie .monitor: dunkel mit orangem Rahmen */
 ctx.fillStyle=C.bg;ctx.fillRect(0,0,W,H);
 roundRect(ctx,1.5,1.5,W-3,H-3,16);ctx.strokeStyle=C.acc;ctx.lineWidth=3;ctx.stroke();

 drawSheet(ctx,PAD,PAD,o.w,frames,o.marks,o.scores);

 /* Bahn mit abgerundeten Ecken, darauf der Stern wie in .pow (Mitte, Breite --w, gedreht um --r, mit Schatten) */
 const ly=PAD+SHEET_H+GAP;
 ctx.save();roundRect(ctx,PAD,ly,o.w,o.h,8);ctx.clip();
 ctx.drawImage(lane,PAD,ly,o.w,o.h);
 if(img){
  ctx.translate(PAD+o.w/2,ly+o.h/2);ctx.rotate(rot);
  ctx.shadowColor='rgba(0,0,0,.35)';ctx.shadowOffsetY=4*SCALE;
  ctx.drawImage(img,-(200+STAR_BLEED)*k,-(150+STAR_BLEED)*k,(400+2*STAR_BLEED)*k,(300+2*STAR_BLEED)*k);
 }
 ctx.restore();

 /* Fusszeile: nur die Adresse, mittig */
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=C.acc;ctx.font='400 17px "Bowlby One","Arial Black",sans-serif';
 ctx.fillText(o.site,W/2,ly+o.h+FOOT_H/2+2);

 return new Promise((ok,fail)=>c.toBlob(b=>b?ok(b):fail(new Error('kein Bild')),'image/png'));
}

root.HGShare={card};
})(window);
