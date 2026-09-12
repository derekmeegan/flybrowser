import {Stagehand,localBrowser} from '../vendor/stagehand/packages/sdk-ts/dist/index.mjs';
import {FRUITS,RIPENESS} from './market.mjs';

export async function launch(){
 const browser=await localBrowser.launch({headless:true,viewport:{width:1000,height:680},deviceScaleFactor:1});
 const stagehand=await Stagehand.create({browser,logging:{level:'off'}});
 const page=(await stagehand.browser.context.pages())[0];
 return {stagehand,page,browser,close:async()=>{await stagehand.close();await browser.close();}};
}
// The policy receives only text visibly rendered on the page, never the site's
// goal variables, reward code, seed, correct option index, or internal state.
export async function observe(page){
 const visible=await page.evaluate(()=>({
  cue:document.querySelector('#cue')?.textContent,
  step:document.querySelector('#step').textContent,
  labels:Array.from(document.querySelectorAll('.option b'),x=>x.textContent),
  reward:document.querySelector('#feedback').textContent,
  outcome:document.querySelector('#outcome').textContent,
 }));
 const phase=visible.step.startsWith('01')?0:visible.step.startsWith('02')?1:2;
 const vocabulary=phase===2?RIPENESS:FRUITS;
 const labels=phase===0?FRUITS:visible.labels;
 return {...visible,phase,goal:vocabulary.indexOf(visible.cue),candidates:labels.map(v=>vocabulary.indexOf(v)),labels};
}
// Finite browser action vocabulary. The learned score selects the query string
// or card. The adapter handles filling/submitting and deterministic selectors.
export async function act(page,obs,index){
 if(obs.phase===0){await page.locator('#query').fill(FRUITS[index]);await page.locator('#search').click();}
 else await page.locator('#option-'+index).click();
}
export const rewardOf=obs=>Number(obs.reward.replace('Reward ',''));
