/* Layout-Test: öffnet tests/vorschau.html in Chrome (headless) und prüft, ob jeder Spruch in seine Einblendung passt.
   Speichert dazu ein Bild aller Einblendungen unter tests/vorschau.png.
   Ohne Chrome wird der Test übersprungen. Eigener Pfad: CHROME_PATH=/pfad/zu/chrome node --test */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {execFile,execFileSync}=require('node:child_process');

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

function chrome(bin,args){
 /* Hinweis: kein eigenes --user-data-dir, sonst beendet sich Chrome nach --dump-dom nicht */
 return new Promise((res,rej)=>{
  execFile(bin,['--headless','--disable-gpu','--hide-scrollbars','--no-first-run',...args],
   {encoding:'utf8',maxBuffer:64*1024*1024,timeout:90000},(err,stdout)=>err&&!stdout?rej(err):res(stdout));
 });
}

const decode=s=>s.replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');

const bin=findChrome();
test('alle Sprüche passen in ihre Einblendung',{skip:bin?false:'Chrome nicht gefunden (CHROME_PATH setzen)',timeout:180000},async t=>{
 const srv=await serve(),url='http://127.0.0.1:'+srv.address().port+'/tests/vorschau.html';
 try{
  const dom=await chrome(bin,['--dump-dom','--virtual-time-budget=10000',url]);
  const tag=(dom.match(/<div id="ergebnis"[^>]*>/)||[''])[0],raw=(tag.match(/data-result="([^"]*)"/)||[])[1];
  assert.ok(raw,'Vorschau hat kein Ergebnis geliefert (lädt sie fehlerfrei?)');
  const r=JSON.parse(decode(raw));
  assert.ok(!r.error,'Vorschau-Fehler: '+r.error);

  /* Bild aller Einblendungen zum Anschauen */
  await chrome(bin,['--screenshot='+BILD,'--window-size=1300,'+Math.min(r.height+40,30000),'--virtual-time-budget=10000',url]);
  t.diagnostic(r.total+' Einblendungen geprüft, Bild: '+path.relative(ROOT,BILD));
  for(const w of r.warn)t.diagnostic('Mindestgrösse: '+w);

  assert.ok(r.total>0,'keine Einblendungen gefunden');
  assert.deepEqual(r.fehler,[],'Diese Sprüche passen nicht in ihre Einblendung (siehe '+path.relative(ROOT,BILD)+')');
 }finally{srv.close()}
});
