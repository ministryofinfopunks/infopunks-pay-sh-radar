// Local QA responses only; unchanged candidate client. No mutation forwarding.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve('dist/client');const fixture=JSON.parse(fs.readFileSync('docs/ux-hardening-2026-10-13/evidence/implementation/performance-fixture.json'));
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://127.0.0.1:5189');res.setHeader('Cache-Control','no-store');
 if(u.pathname==='/v1/search'){res.setHeader('Content-Type','application/json');return res.end('{}');}
 if(u.pathname==='/v1/4663/share/qa2-malformed-object'){res.setHeader('Content-Type','application/json');return res.end('{"data":{}}');}
 if(u.pathname.startsWith('/v1/')){const entry=fixture.responses[u.pathname+u.search];if(entry&&entry.method===req.method){res.statusCode=entry.status;res.setHeader('Content-Type',entry.contentType);return res.end(entry.body);}
  if(req.method!=='GET'){res.statusCode=405;return res.end('{}');}
  const result=await fetch('http://127.0.0.1:8812'+u.pathname+u.search,{headers:{Accept:'application/json',...(req.headers.authorization?{Authorization:req.headers.authorization}:{})}});res.statusCode=result.status;res.setHeader('Content-Type',result.headers.get('content-type')||'application/json');return res.end(await result.text());}
 const target=path.resolve(root,'.'+u.pathname);if(!target.startsWith(root+path.sep)&&target!==root){res.statusCode=403;return res.end();}const file=fs.existsSync(target)&&fs.statSync(target).isFile()?target:path.join(root,'index.html');res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
 }catch{res.statusCode=503;res.end('{}');}});server.listen(5189,'127.0.0.1',()=>console.log('QA2 controlled localhost preview; no mutation forwarding'));
