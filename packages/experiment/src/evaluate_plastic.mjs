import {writeFile,appendFile} from 'node:fs/promises';
import {startMarket,rng} from './market.mjs';
import {launch,observe,act} from './browser.mjs';
import {neuralClient} from './plastic_client.mjs';
const n=Number(process.argv[2]||200),market=await startMarket(),browser=await launch(),neural=await neuralClient();
const conditions=['random','untrained','trained','reverted','shuffled'];
const directory='artifacts/plastic';const firstSeed=3100000;
await writeFile(directory+'/evaluation_protocol.json',JSON.stringify({n,firstSeed,conditions,layout:'2 columns, shuffled card positions',selection:'Final 300-update checkpoints fixed before evaluation',retries:0,learningDuringEvaluation:false,inference:'Live PyTorch recurrent rate simulation for each decision; no response cache'},null,2));
await writeFile(directory+'/episodes.jsonl','');const summary=[];
try{
 for(const condition of conditions){
  const random=rng(381),episodes=[],started=Date.now();
  for(let i=0;i<n;i++){
   const seed=firstSeed+i;await browser.page.goto(market.url+'/?heldout=1&seed='+seed);
   const steps=[],t=Date.now();let o=await observe(browser.page);
   while(o.outcome==='In progress'&&steps.length<3){
    const pick=condition==='random'?{action:Math.floor(random()*4)}:await neural.choose(condition,o);
    const before=o;await act(browser.page,before,pick.action);o=await observe(browser.page);
    steps.push({observation:before,action:pick.action,scores:pick.scores,selected:before.labels[pick.action],reward:o.reward,neural_steps:pick.neural_steps});
   }
   const row={condition,index:i,seed,success:o.outcome==='Success',outcome:o.outcome,elapsed_ms:Date.now()-t,steps};
   episodes.push(row);await appendFile(directory+'/episodes.jsonl',JSON.stringify(row)+'\n');
   if((i+1)%25===0)console.log(condition,i+1,'/',n,'success',episodes.filter(e=>e.success).length,'elapsed',((Date.now()-started)/1000).toFixed(1),'s');
  }
  const successes=episodes.filter(e=>e.success).length;
  summary.push({condition,n,successes,success_rate:successes/n,mean_steps:episodes.reduce((s,e)=>s+e.steps.length,0)/n,mean_elapsed_ms:episodes.reduce((s,e)=>s+e.elapsed_ms,0)/n});
  await writeFile(directory+'/evaluation_summary.json',JSON.stringify({summary,protocol:'Fresh prespecified seeds; all conditions identical; live neural inference, no retries or updates'},null,2));
 }
}finally{neural.close();await browser.close();await market.close();}
console.log(JSON.stringify(summary,null,2));
