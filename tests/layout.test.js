/* Layout-Test: öffnet tests/vorschau.html in Chrome (headless) und prüft, ob jeder Spruch in seine Einblendung passt.
   Speichert dazu ein Bild aller Einblendungen unter tests/vorschau.png.
   Ohne Chrome wird der Test übersprungen. Eigener Pfad: CHROME_PATH=/pfad/zu/chrome node --test */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {spawn,execFileSync}=require('node:child_process');

const ROOT=path.join(__dirname,'..');
const BILD=path.join(__dirname,'vorschau.png');

function findChrome(){
 const cands=[process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].filter(Boolean);
 for(const c of cands)if(fs.existsSync(c))return c;
 for(const n of ['google-chrome','google-chrome-stable','chromium','chromium-browser']){
  try{return execFileSync('which',[n],{encoding:'utf8'}).trim()}catch(_){}
 }
 return null;
}

/* Minimaler Webserver für den Projektordner (fetch auf content.json braucht http://) */
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png'};
function serve(){
 return new Promise(res=>{
  const srv=http.createServer((req,rsp)=>{
   const p=path.normalize(path.join(ROOT,decodeURIComponent(new URL(req.url,'http://x').pathname)));
   if(!p.startsWith(ROOT+path.sep)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){rsp.writeHead(404);return rsp.end()}
   rsp.writeHead(200,{'Content-Type':TYPES[path.extname(p)]||'application/octet-stream'});
   fs.createReadStream(p).pipe(rsp);
  });
  srv.listen(0,'127.0.0.1',()=>res(srv));
 });
}

/* Chrome über das DevTools-Protokoll steuern (--remote-debugging-pipe: Befehle auf fd 3, Antworten auf fd 4, je mit \0 getrennt).
   Früher: --dump-dom mit --virtual-time-budget. Das wartet aber nicht auf FileReader, Bilder aus Blobs und toBlob
   (Bild zum Teilen) und lieferte darum ab und zu die Seite, bevor das Ergebnis da war. */
function chrome(bin){
 const p=spawn(bin,['--headless','--disable-gpu','--hide-scrollbars','--no-first-run','--remote-debugging-pipe','about:blank'],
  {stdio:['ignore','ignore','ignore','pipe','pipe']});
 const wait=new Map();let id=0,buf='';
 p.stdio[4].on('data',d=>{
  buf+=d;let i;
  while((i=buf.indexOf('\0'))>=0){
   const m=JSON.parse(buf.slice(0,i));buf=buf.slice(i+1);
   const w=m.id&&wait.get(m.id);if(!w)continue;
   wait.delete(m.id);m.error?w.rej(new Error(m.error.message)):w.res(m.result);
  }
 });
 const send=(method,params={},sessionId)=>new Promise((res,rej)=>{
  wait.set(++id,{res,rej});p.stdio[3].write(JSON.stringify({id,method,params,sessionId})+'\0');
 });
 return {send,close:()=>p.kill()};
}

const bin=findChrome();
test('alle Sprüche passen in ihre Einblendung',{skip:bin?false:'Chrome nicht gefunden (CHROME_PATH setzen)',timeout:180000},async t=>{
 const srv=await serve(),url='http://127.0.0.1:'+srv.address().port+'/tests/vorschau.html',c=chrome(bin);
 try{
  const {targetId}=await c.send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await c.send('Target.attachToTarget',{targetId,flatten:true});
  const s=(m,p)=>c.send(m,p,sessionId);
  await s('Emulation.setDeviceMetricsOverride',{width:1300,height:900,deviceScaleFactor:1,mobile:false});
  await s('Page.navigate',{url});

  /* warten, bis die Vorschau ihr Ergebnis in #ergebnis geschrieben hat (höchstens 60 s) */
  let raw='';
  for(const ende=Date.now()+60000;!raw&&Date.now()<ende;await new Promise(r=>setTimeout(r,200))){
   raw=(await s('Runtime.evaluate',{expression:"document.getElementById('ergebnis')?.dataset.result||''",returnByValue:true})).result.value;
  }
  assert.ok(raw,'Vorschau hat kein Ergebnis geliefert (lädt sie fehlerfrei?)');
  const r=JSON.parse(raw);
  assert.ok(!r.error,'Vorschau-Fehler: '+r.error);

  /* Bild aller Einblendungen zum Anschauen */
  const shot=await s('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:1300,height:Math.min(r.height+40,30000),scale:1}});
  fs.writeFileSync(BILD,Buffer.from(shot.data,'base64'));
  t.diagnostic(r.total+' Einblendungen geprüft, Bild: '+path.relative(ROOT,BILD));
  for(const w of r.warn)t.diagnostic('Mindestgrösse: '+w);

  assert.ok(r.total>0,'keine Einblendungen gefunden');
  assert.deepEqual(r.fehler,[],'Diese Sprüche passen nicht in ihre Einblendung (siehe '+path.relative(ROOT,BILD)+')');
 }finally{c.close();srv.close()}
});
