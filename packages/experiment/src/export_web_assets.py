"""Export the existing Flybody-derived scene and recorded experiment to the SPA.

Body transforms are authored presentation, sampled from the same MuJoCo rig.
Browser frames, choices and neural traces are recorded experiment artifacts.
"""
from pathlib import Path
import json, shutil
import numpy as np
import mujoco
from scene import FlyScene,ROOT
import pyarrow.feather as feather

OUT=ROOT.parents[1]/'apps/web/public/assets';OUT.mkdir(parents=True,exist_ok=True)
scene=FlyScene(320,200);scene.render(0)
m,d=scene.model,scene.data
chunks=[];offset=0;meshes={}
for mid in range(m.nmesh):
    va,vc=int(m.mesh_vertadr[mid]),int(m.mesh_vertnum[mid]);fa,fc=int(m.mesh_faceadr[mid]),int(m.mesh_facenum[mid])
    vertices=np.asarray(m.mesh_vert[va:va+vc],dtype='<f4');faces=np.asarray(m.mesh_face[fa:fa+fc],dtype='<u4')
    meshes[str(mid)]={'vertexOffset':offset,'vertexCount':int(vertices.size)}
    chunks.append(vertices.tobytes());offset+=vertices.nbytes
    meshes[str(mid)].update(indexOffset=offset,indexCount=int(faces.size))
    chunks.append(faces.tobytes());offset+=faces.nbytes
(OUT/'geometry.bin').write_bytes(b''.join(chunks))
geoms=[]
for i in range(m.ngeom):
    if m.geom_group[i]>=3:continue
    mat=int(m.geom_matid[i]);rgba=(m.mat_rgba[mat] if mat>=0 else m.geom_rgba[i]).tolist()
    if rgba[3]<=0:continue
    geoms.append({'id':i,'name':mujoco.mj_id2name(m,mujoco.mjtObj.mjOBJ_GEOM,i) or f'geom-{i}',
      'type':int(m.geom_type[i]),'mesh':int(m.geom_dataid[i]),'body':int(m.geom_bodyid[i]),
      'position':m.geom_pos[i].round(7).tolist(),'quaternion':m.geom_quat[i].round(7).tolist(),
      'size':m.geom_size[i].round(7).tolist(),'rgba':rgba})
frames=[];fps=15;duration=18
for t in np.arange(0,duration+1/fps,1/fps):
    scene.render(float(t),typing=(1<t<13.2),celebrate=(13.2<t<17))
    frames.append(np.column_stack((d.xpos,d.xquat)).astype('<f4'))
tracks=np.asarray(frames,dtype='<f4');(OUT/'body-motion.bin').write_bytes(tracks.tobytes())
manifest={'meshes':meshes,'geoms':geoms,'bodyCount':m.nbody,'motionFrames':len(frames),'motionFps':fps,'duration':duration,
 'coordinates':'MuJoCo Z-up; quaternion order wxyz; body transforms are global within scene group',
 'bodyMotion':'Authored Flybody pose animation; no learned locomotion or keyboard-contact controller'}
(OUT/'scene.json').write_text(json.dumps(manifest,separators=(',',':')))
scene.close()

traces=json.loads((ROOT/'artifacts/demo_traces.json').read_text())
ann=feather.read_feather(ROOT/'circuit/neurons.feather').set_index('bodyId')
replays=[]
wrote_positions=False
for tr in traces:
    if tr['name']!='after':continue
    frames=[];actions=[];activity={}
    for fr in tr['frames']:
        name=Path(fr['file']).name;shutil.copy2(ROOT/fr['file'],OUT/name)
        frames.append({**fr,'file':'/assets/'+name})
        if 'before' in fr:
            selected=fr['before']['labels'][fr['action']]
            actions.append({'phase':fr['before']['phase'],'selected':selected,'cursor':fr['cursor'],
              'scores':fr['scores'],'labels':fr['before']['labels'],'action':fr['action'],'stimulus':fr['stimulus']})
            z=np.load(ROOT/fr['activity_file']);locations=ann.loc[z['body_ids']].somaLocation
            valid=np.array([v is not None and len(v)==3 for v in locations])
            # Evenly spaced subset of measured cells keeps the interactive view light.
            subset=np.flatnonzero(valid)[::4]
            values=z['activity'][:,subset]
            activity[str(fr['before']['phase'])]=values.round(5).tolist()
            if not wrote_positions:
                positions=np.array([locations.iloc[i] for i in subset],float)
                positions-=np.median(positions,axis=0);positions/=np.quantile(abs(positions),.98)
                (OUT/'neurons.json').write_text(json.dumps({'positions':positions.round(5).tolist(),'bodyIds':z['body_ids'][subset].astype(int).tolist()},separators=(',',':')))
                wrote_positions=True
    initial=frames[0]['observation']
    goalFruit=initial['cue'];ripeness=next((a['selected'] for a in actions if a['phase']==2),'Green')
    replays.append({'id':tr['name'],'name':{'before':'Before training','after':'After training','transfer':'New layout'}[tr['name']],
        'seed':tr['seed'],'success':tr['success'],'heldout':tr['heldout'],'task':f'Find a {ripeness.lower()} {goalFruit.lower()}.',
        'fruit':goalFruit,'ripeness':ripeness,'frames':frames,'actions':actions,'activity':activity})
(OUT/'replays.json').write_text(json.dumps(replays,separators=(',',':')))
print('Exported',len(geoms),'scene objects;',m.nbody,'animated bodies;',len(tracks),'motion samples;',len(replays),'recorded browser runs')
print('Geometry bytes:',offset,'motion bytes:',tracks.nbytes)
