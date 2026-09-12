import {writeFile,mkdir} from 'node:fs/promises';
import {startMarket,rng,FRUITS} from './market.mjs';
import {launch,observe,act} from './browser.mjs';
import {neuralClient} from './plastic_client.mjs';
const market=await startMarket(),b=await launch(),neural=await neuralClient();
await b.page.setViewportSize(1000,680);await mkdir('artifacts/browser-captures',{recursive:true});
const traces=[];
async function capture(name,extra={}){
 const file='artifacts/browser-captures/'+name+'.png';
 await b.page.evaluate(()=>document.fonts.ready.then(()=>true));
 await b.page.screenshot({path:file});return {file,...extra};
}
let bananaSeed=3200000;while(Math.floor(rng(bananaSeed)()*4)!==0)bananaSeed++;
try{
 for(const [name,condition,heldout,seed] of [['before','untrained',false,bananaSeed],['after','trained',false,bananaSeed],['transfer','trained',true,bananaSeed+7]]){
  await b.page.goto(market.url+'/?seed='+seed+(heldout?'&heldout=1':''));
  const frames=[];let o=await observe(b.page);frames.push(await capture(name+'-start',{observation:o}));
  for(let i=0;i<3&&o.outcome==='In progress';i++){
   const pick=await neural.choose(condition,o,name+'-'+i),before=o;let location;
   if(o.phase===0){
    location=await b.page.evaluate(()=>{const r=document.querySelector('#search').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
    await b.page.locator('#query').fill(FRUITS[pick.action]);
    frames.push(await capture(name+'-'+i+'-typed',{observation:o,action:pick.action,scores:pick.scores,cursor:location}));
    await b.page.locator('#search').click();
   }else{
    location=await b.page.evaluate(i=>{const r=document.querySelector('#option-'+i).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};},pick.action);
    await act(b.page,o,pick.action);
   }
   o=await observe(b.page);
   frames.push(await capture(name+'-'+i+'-result',{observation:o,before,action:pick.action,scores:pick.scores,cursor:location,activity_file:pick.activity_file,
    stimulus:[before.phase,before.goal,before.candidates[pick.action]].join(',')}));
  }
  traces.push({name,condition,seed,heldout,success:o.outcome==='Success',frames});
 }
 await writeFile('artifacts/demo_traces.json',JSON.stringify(traces,null,2));
 console.log(traces.map(t=>({name:t.name,success:t.success,frames:t.frames.length})));
}finally{neural.close();await b.close();await market.close();}
