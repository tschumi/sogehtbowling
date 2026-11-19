/* Prüft die Sicherheitsregeln (Content-Security-Policy) in index.html – ausführen mit: node --test */
const {test,describe}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const csp=(html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)||[])[1]||'';
const dir=n=>(csp.split(';').map(x=>x.trim().split(/\s+/)).find(x=>x[0]===n)||[]).slice(1);

describe('Content-Security-Policy',()=>{
 test('ist vorhanden und steht vor allen Skripten',()=>{
  assert.ok(csp,'CSP-Meta-Tag fehlt');
  assert.ok(html.indexOf('Content-Security-Policy')<html.indexOf('<script'),'CSP muss vor dem ersten <script> stehen');
 });
 test('jedes Inline-Skript ist per Hash erlaubt',()=>{
  for(const [,code] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)){
   const h="'sha256-"+crypto.createHash('sha256').update(code).digest('base64')+"'";
   assert.ok(dir('script-src').includes(h),`Inline-Skript geändert: in script-src ${h} eintragen`);
  }
 });
 test('keine fremden Server und kein unsicheres JavaScript',()=>{
  for(const v of dir('script-src'))assert.ok(v==="'self'"||v.startsWith("'sha256-"),`script-src: ${v}`);
  assert.doesNotMatch(csp,/https?:|\*|'unsafe-eval'/,'CSP erlaubt fremde Server oder eval');
 });
 test('externe Skripte kommen nur von der eigenen Seite',()=>{
  for(const [,src] of html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g))assert.doesNotMatch(src,/^(https?:)?\/\//,src);
 });
});
