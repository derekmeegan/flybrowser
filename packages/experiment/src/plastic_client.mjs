import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
export async function neuralClient(){
 const root=fileURLToPath(new URL('..',import.meta.url));
 const child=spawn(root+'/.venv/bin/python',['src/plastic_server.py'],{cwd:root,stdio:['pipe','pipe','inherit']});
 let nextId=0,readyResolve,readyReject;const pending=new Map();
 const ready=new Promise((r,j)=>{readyResolve=r;readyReject=j;});
 createInterface({input:child.stdout}).on('line',line=>{
  const r=JSON.parse(line);if(r.ready)return readyResolve(r);
  const p=pending.get(r.id);if(!p)return;
  pending.delete(r.id);r.error?p.reject(new Error(r.error)):p.resolve(r);
 });
 child.on('error',error=>{readyReject(error);for(const p of pending.values())p.reject(error);pending.clear();});
 child.on('exit',code=>{const e=new Error('Neural inference process ended: '+code);readyReject(e);for(const p of pending.values())p.reject(e);pending.clear();});
 await ready;
 return {choose(condition,observation,trace){
  if(!Number.isInteger(observation.goal)||observation.goal<0||observation.goal>3||observation.candidates.length!==4||observation.candidates.some(c=>!Number.isInteger(c)||c<0||c>3))throw new Error('Unsupported observation');
  const id=++nextId;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});child.stdin.write(JSON.stringify({id,condition,observation,trace})+'\n');});
 },close(){child.stdin.end();}};
}
