import {mkdir,writeFile,appendFile} from 'node:fs/promises';
import {startMarket,rng} from './market.mjs';
import {launch,observe,act,rewardOf} from './browser.mjs';

await mkdir('artifacts',{recursive:true});
const market=await startMarket(),b=await launch(),r=rng(672);
const path='artifacts/training_transitions.jsonl';await writeFile(path,'');
const count=Number(process.argv[2]||1200),t=Date.now();
try{
 for(let i=0;i<count;i++){
  const phase=i%3,seed=10000+i;
  await b.page.goto(market.url+'/?seed='+seed+'&start='+phase);
  const obs=await observe(b.page),action=Math.floor(r()*4);
  await act(b.page,obs,action);const after=await observe(b.page);
  const row={i,seed,obs,action,selected:obs.candidates[action],reward:rewardOf(after),after:{step:after.step,outcome:after.outcome,reward:after.reward}};
  await appendFile(path,JSON.stringify(row)+'\n');
  if((i+1)%50===0)console.log('Browser reward samples',i+1,'/',count,'elapsed',((Date.now()-t)/1000).toFixed(1),'s');
 }
 await writeFile('artifacts/collection_metadata.json',JSON.stringify({count,elapsed_s:(Date.now()-t)/1000,interface:'Stagehand v4 Chrome extension',policy:'uniform random exploration',curriculum:'reset equally often to each of 3 phases',seed:672},null,2));
}finally{await b.close();await market.close();}
