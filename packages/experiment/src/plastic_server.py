"""Persistent live neural inference for Stagehand. No response lookup at runtime."""
import sys,json,hashlib
import numpy as np
import torch
from plastic_model import PlasticFly,ROOT,STATES
torch.set_num_threads(2)
OUT=ROOT/'artifacts/plastic'
models={}
for name,source,checkpoint in [('untrained','connectome','initial'),('trained','connectome','trained'),('shuffled','shuffled','trained'),('reverted','connectome','trained')]:
    model=PlasticFly(shuffled=source=='shuffled')
    model.load_state_dict(torch.load(OUT/f'{source}-{checkpoint}.pt',weights_only=True))
    if name=='reverted':
        initial=torch.load(OUT/'connectome-initial.pt',weights_only=True)
        with torch.no_grad():model.core.edge_gain.copy_(initial['core.edge_gain'])
    model.eval();models[name]=model
print(json.dumps({'ready':True,'inference':'Live recurrent rate simulation, 6 updates per candidate, no response cache'}),flush=True)
for line in sys.stdin:
    try:
        request=json.loads(line);obs=request['observation'];condition=request['condition']
        p,g,candidates=obs['phase'],obs['goal'],obs['candidates']
        assert p in range(3) and g in range(4) and len(candidates)==4 and all(c in range(4) for c in candidates)
        indices=torch.tensor([STATES.index((p,g,c)) for c in candidates])
        model=models[condition]
        with torch.no_grad():
            if request.get('trace'):
                scores,history=model(indices,return_states=True)
            else:scores=model(indices)
        action=int(scores.argmax());result={'id':request['id'],'action':action,'scores':scores.tolist(),'neural_steps':6}
        if request.get('trace'):
            path=OUT/('activity-'+request['trace']+'.npz')
            np.savez_compressed(path,activity=history[:,:,action].numpy(),body_ids=model.ann.bodyId.to_numpy(),scores=scores.numpy())
            result['activity_file']=str(path.relative_to(ROOT))
        print(json.dumps(result),flush=True)
    except Exception as exc:
        print(json.dumps({'id':request.get('id'),'error':str(exc)}),flush=True)
