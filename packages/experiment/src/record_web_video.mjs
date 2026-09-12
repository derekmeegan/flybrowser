// Render the requested video at deterministic timestamps from the Next.js scene.
// Browser actions and screenshots are from the recorded neural-policy episode.
import {mkdir,copyFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {launch} from './browser.mjs';

const preview=process.argv.includes('--preview');
const poster=process.argv.includes('--poster');
const b=await launch();
const directory='artifacts/web-video-frames';
await mkdir(directory,{recursive:true});
try {
 await b.page.setViewportSize(1600,900);
 await b.page.goto((process.env.FLYBROWSER_URL || 'http://127.0.0.1:3026')+'/?video=1');
 let ready=false;
 for(let attempt=0;attempt<150;attempt++){
  ready=await b.page.evaluate(()=>Boolean(window.flyVideo?.ready));
  if(ready)break;
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 if(!ready)throw new Error('The video scene did not finish loading in 30 seconds.');
 await b.page.evaluate(()=>document.fonts.ready.then(()=>true));
 // Let the loading poster's 300 ms fade finish before the first film frame.
 await new Promise(resolve=>setTimeout(resolve,400));
 if(poster)await b.page.evaluate(()=>{
  const inset=document.querySelector('.browser-peek');
  if(inset instanceof HTMLElement)inset.style.visibility='hidden';
 });
 const times=poster?[0]:preview?[2000,10000,14000]:Array.from({length:540},(_,i)=>i/30*1000);
 for(let i=0;i<times.length;i++){
  await b.page.evaluate(t=>window.flyVideo.frame(t),times[i]);
  const path=poster?fileURLToPath(new URL('../../../apps/web/public/assets/scene-poster.png',import.meta.url)):preview?`artifacts/video-preview-${times[i]}.png`:`${directory}/${String(i).padStart(5,'0')}.png`;
  await b.page.screenshot({path});
  if(i%90===0)console.log(`Recorded ${i+1}/${times.length} frames`);
 }
 if(!preview&&!poster){
  await new Promise((resolve,reject)=>{
   const ffmpeg=spawn('ffmpeg',['-y','-framerate','30','-i',directory+'/%05d.png','-c:v','libx264','-preset','slow','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart','-an','artifacts/fly-browser-demo.mp4'],{stdio:['ignore','ignore','inherit']});
   ffmpeg.on('error',reject);ffmpeg.on('exit',code=>code===0?resolve():reject(new Error(`ffmpeg exited ${code}`)));
  });
  await copyFile('artifacts/fly-browser-demo.mp4', new URL('../../../apps/web/public/assets/fly-browser-demo.mp4', import.meta.url));
 }
} finally { await b.close(); }
