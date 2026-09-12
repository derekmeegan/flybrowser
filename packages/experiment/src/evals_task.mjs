import {startMarket} from './market.mjs';
import {launch,observe,act} from './browser.mjs';
import {neuralClient} from './plastic_client.mjs';

// The upstream CLI's core surface currently uses v3. This custom task owns a
// v4 session to ensure the experiment's actions still traverse the extension.
export async function runEvalTask({assert,metrics}){
 const market=await startMarket(),b=await launch(),neural=await neuralClient();let successes=0;
 try{
  const stop=metrics.startTimer('fly_browser_ms');
  for(let i=0;i<16;i++){
   await b.page.goto(market.url+'/?heldout=1&seed='+(4100000+i));let obs=await observe(b.page);
   for(let k=0;k<3&&obs.outcome==='In progress';k++){
    const {action}=await neural.choose('trained',obs);await act(b.page,obs,action);obs=await observe(b.page);
   }
   if(obs.outcome==='Success')successes++;
  }
  stop();metrics.record('success_rate',successes/16);
  assert.equals(successes,16,'Trained internal connections complete the 16 smoke tasks');
  return {_success:successes===16,successes,total:16,interface:'Stagehand v4 extension'};
 }finally{neural.close();await b.close();await market.close();}
}
