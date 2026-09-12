import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';

export const FRUITS=['Banana','Apple','Grape','Kiwi'];
export const RIPENESS=['Green','Ripe','Spotted','Soft'];
export function rng(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function marketHtml(seed=1,start=0,heldout=false){
 const r=rng(seed), fruit=Math.floor(r()*4), ripe=Math.floor(r()*4);
 const shuffle=()=>[0,1,2,3].map(v=>({v,k:r()})).sort((a,b)=>a.k-b.k).map(v=>v.v);
 const orders=[shuffle(),shuffle(),shuffle()];
 return `<!doctype html><html><head><meta charset="UTF-8"><title>FlyMart · browser training arena</title>
 <style>@font-face{font-family:Inter;src:url(/fonts/Inter.ttf)}@font-face{font-family:JetBrains;src:url(/fonts/JetBrainsMono.ttf)}*{box-sizing:border-box}body{margin:0;background:#F9F6F4;color:#100D0D;font:19px Inter,Arial,sans-serif}header{height:80px;background:#fff;border-bottom:1px solid #EDEBEB;padding:22px 45px;display:flex;justify-content:space-between;align-items:center}.logo{font-size:29px;font-weight:800;letter-spacing:-1px}.logo span{color:#F03603}header small{font:13px JetBrains,monospace;color:#514F4F}.wrap{padding:32px 45px}.eyebrow{font:13px JetBrains,monospace;letter-spacing:2px;color:#514F4F}h1{font-size:37px;line-height:1.1;margin:14px 0 12px;letter-spacing:-1px}.brief{display:flex;justify-content:space-between;align-items:center;margin-bottom:27px}.goal{background:#F0E9E5;color:#100D0D;padding:13px 22px;border-radius:2px;font-weight:700}p{color:#514F4F;margin:10px 0 23px}.search{display:flex;gap:12px;margin:32px 0}input{border:1px solid #514F4F;background:white;border-radius:4px;padding:20px;font-size:23px;width:75%}button{font:inherit;cursor:pointer;border:0}#search{background:#F03603;color:#fff;padding:18px 30px;border-radius:4px}.grid{display:grid;grid-template-columns:repeat(${heldout?'2':'4'},1fr);gap:${heldout?'16':'18'}px}.option{min-height:${heldout?'133':'205'}px;text-align:center;border:1px solid #E0DCDA;border-radius:4px;background:white;display:flex;flex-direction:${heldout?'row':'column'};gap:18px;align-items:center;justify-content:center}.option:hover{border-color:#F03603;background:#FBEEE8}.art{font-size:${heldout?'49':'65'}px;line-height:1.1}.option b{font-size:23px}.option small{font-size:13px;color:#514F4F}.token-list{display:flex;gap:12px;margin-top:32px}.token-list span{padding:10px 18px;background:#EDEBEB;border-radius:2px}footer{position:absolute;bottom:0;width:100%;height:51px;border-top:1px solid #E0DCDA;background:#F9F6F4;padding:16px 45px;font:13px JetBrains,monospace;color:#514F4F;display:flex;justify-content:space-between}#feedback{font-weight:700;color:#417D19}.result{background:#E7F2DB;padding:35px;border-radius:4px;margin-top:24px}.result.fail{background:#FFDFD3;color:#A72A09}.result h1{font-size:48px}.result .art{font-size:85px}.badge{font:13px JetBrains,monospace;letter-spacing:1px;color:#514F4F}</style></head>
 <body><header><div class="logo">fly<span>mart</span><span style="font-size:18px"> ↗</span></div><small>LOCAL RESEARCH ARENA · NO REAL ORDERS</small></header><main class="wrap"></main><footer><span id="step"></span><span id="feedback">Reward 0</span><span id="outcome">In progress</span></footer>
 <script>(()=>{
 const fruits=${JSON.stringify(FRUITS)}, ripeness=${JSON.stringify(RIPENESS)}, icons=['🍌','🍎','🍇','🥝'],orders=${JSON.stringify(orders)};
 const goalFruit=${fruit},goalRipe=${ripe};let phase=${start},done=false,feedback=0;
 const main=document.querySelector('main');
 function render(){
  document.querySelector('#step').textContent=['01 / Search','02 / Select fruit','03 / Choose ripeness'][phase]||'Complete';
  document.querySelector('#feedback').textContent='Reward '+(feedback>0?'+':'')+feedback;
  if(done){main.innerHTML=feedback>0?'<div class="badge">TASK COMPLETE</div><div class="result"><span class="art">'+icons[goalFruit]+'</span><h1>Snack secured.</h1><p>'+ripeness[goalRipe]+' '+fruits[goalFruit].toLowerCase()+'. Three decisions. One very small shopper.</p></div>':'<div class="badge">TRIAL ENDED</div><div class="result fail"><h1>Wrong snack.</h1><p>The browser action did not match the requested item.</p></div>';document.querySelector('#outcome').textContent=feedback>0?'Success':'Failure';return;}
  const cue=phase===2?ripeness[goalRipe]:fruits[goalFruit];
  main.innerHTML='<div class="eyebrow">A LITTLE SHOPPING FOR A LITTLE BRAIN</div><div class="brief"><h1>'+['Find a snack.','Pick your fruit.','Make it just right.'][phase]+'</h1><span class="goal">Target: <span id="cue">'+cue+'</span></span></div><p>'+['Search the market for the requested fruit.','The results moved. Choose the requested fruit.','Choose the ripeness on your snack list.'][phase]+'</p>';
  if(phase===0){main.innerHTML+='<form class="search"><input id="query" aria-label="Search fruits" placeholder="Search fruits…" autocomplete="off"><button id="search" type="submit">Search →</button></form><p style="margin-top:44px;font-size:15px">ON THE SHELVES</p><div class="token-list">'+fruits.map((f,i)=>'<span>'+icons[i]+' '+f+'</span>').join('')+'</div>';main.querySelector('form').onsubmit=e=>{e.preventDefault();act(fruits.indexOf(document.querySelector('#query').value.trim()));};}
  else{const labels=phase===1?fruits:ripeness;main.innerHTML+='<div class="grid">'+orders[phase].map((v,i)=>'<button class="option" id="option-'+i+'"><span class="art">'+(phase===1?icons[v]:['🟢','🟡','🟤','🟠'][v])+'</span><b>'+labels[v]+'</b><small>'+ (phase===1?'View fruit →':'Pick this →')+'</small></button>').join('')+'</div>';main.querySelectorAll('.option').forEach((b,i)=>b.onclick=()=>act(orders[phase][i]));}
 }
 function act(choice){if(done)return;const correct=choice===(phase===2?goalRipe:goalFruit);feedback=correct?1:-1;if(!correct){done=true;}else if(phase===2){done=true;}else{phase++;}render();}
 render();})();</script></body></html>`;
}
export async function startMarket(port=0){
 const server=createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost');
  if(['/fonts/Inter.ttf','/fonts/JetBrainsMono.ttf'].includes(u.pathname)){res.writeHead(200,{'content-type':'font/ttf','cache-control':'public,max-age=86400'});res.end(readFileSync(new URL('../artifacts'+u.pathname,import.meta.url)));return;}
  if(u.pathname!=='/'){res.writeHead(404);res.end();return;}
  const seed=Number(u.searchParams.get('seed')||1)>>>0;
  const start=Math.min(2,Math.max(0,Number(u.searchParams.get('start')||0)|0));
  res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
  res.end(marketHtml(seed,start,u.searchParams.get('heldout')==='1'));
 });
 await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
 return {url:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(resolve=>server.close(resolve))};
}
if(process.argv[1]===new URL(import.meta.url).pathname){const s=await startMarket(8765);console.log(s.url);}
