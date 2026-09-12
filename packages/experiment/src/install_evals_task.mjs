import {mkdir,writeFile} from 'node:fs/promises';
const dir=new URL('../vendor/stagehand/packages/evals/core/tasks/fly/',import.meta.url);
await mkdir(dir,{recursive:true});
await writeFile(new URL('fruit_market.ts',dir),`import { defineCoreTask } from '../../../framework/defineTask.js';
import { pathToFileURL } from 'node:url';
export default defineCoreTask({name:'fruit_market',tags:['connectome','local']},async (ctx)=>{
 const root=process.env.FLY_LAB_ROOT;
 if(!root) throw new Error('Set FLY_LAB_ROOT to the packages/experiment directory');
 const {runEvalTask}=await import(pathToFileURL(root+'/src/evals_task.mjs').href);
 return runEvalTask(ctx);
});\n`);
console.log('Installed core:fly/fruit_market');
