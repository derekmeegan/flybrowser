"""Fit internal KC->MBON gains from recorded browser rewards, no teacher actions."""
import json,time,sys,hashlib
from pathlib import Path
import numpy as np
import torch
from plastic_model import PlasticFly,STATES,ROOT

torch.set_num_threads(4);torch.manual_seed(131)
OUT=ROOT/'artifacts/plastic';OUT.mkdir(exist_ok=True)
rows=[json.loads(s) for s in (ROOT/'artifacts/training_transitions.jsonl').read_text().splitlines()]
keys={s:i for i,s in enumerate(STATES)}
count=np.zeros(48,np.float32);sums=np.zeros(48,np.float32)
for r in rows:
    k=keys[(r['obs']['phase'],r['obs']['goal'],r['selected'])];count[k]+=1;sums[k]+=r['reward']
assert np.all(count>0)
target=torch.tensor(sums/count);weights=torch.tensor(count/count.sum())
condition=sys.argv[1] if len(sys.argv)>1 else 'connectome'
steps=int(sys.argv[2]) if len(sys.argv)>2 else 300
model=PlasticFly(shuffled=condition=='shuffled');model.calibrate()
initial={k:v.detach().clone() for k,v in model.state_dict().items()}
torch.save(initial,OUT/f'{condition}-initial.pt')
print(json.dumps(model.description),flush=True)
opt=torch.optim.Adam([model.core.edge_gain],lr=.075)
history=[];start=time.time()
def measure(step,scores):
    values=scores.detach().numpy().reshape(3,4,4)
    acc=float((values.argmax(axis=-1)==np.arange(4)[None]).mean())
    record={'step':step,'decision_accuracy':acc,'reward_mse':float(((scores.detach()-target)**2*weights).sum()),'elapsed_s':time.time()-start}
    history.append(record);print(json.dumps(record),flush=True)
    (OUT/f'{condition}-history.json').write_text(json.dumps(history,indent=2))
with torch.no_grad():measure(0,model())
for step in range(1,steps+1):
    opt.zero_grad();scores=model();loss=((scores-target)**2*weights).sum()
    loss.backward();model.mask_gradients();opt.step()
    if step%10==0 or step==steps:
        with torch.no_grad():measure(step,model())
torch.save(model.state_dict(),OUT/f'{condition}-trained.pt')
with torch.no_grad():
    scores,activity=model(return_states=True)
    delta=model.core.edge_gain-initial['core.edge_gain']
    frozen=[k for k,v in model.state_dict().items() if k!='core.edge_gain' and not torch.equal(v,initial[k])]
    assert not frozen,frozen
    assert torch.all(delta[~model.plastic_mask]==0)
    actual=((delta.abs()>1e-7)&model.plastic_mask)
    metadata={**model.description,'updates':steps,'unique_reward_samples':len(rows),'distinct_stimuli':48,
      'optimizer':'Adam lr=.075; weighted mean-square chosen-action reward loss; all 1200 logged samples reused per update',
      'changed_edges':int(actual.sum()),'frozen_tensor_checks':True,'max_logit_change':float(delta.abs().max()),
      'gain_initial':.5,'gain_final_min':float((.05+.9*model.core.edge_gain.sigmoid())[model.plastic_mask].min()),
      'gain_final_max':float((.05+.9*model.core.edge_gain.sigmoid())[model.plastic_mask].max()),
      'final_diagnostic':history[-1],'neuron_body_ids':model.ann.bodyId.astype(int).tolist()}
    (OUT/f'{condition}-metadata.json').write_text(json.dumps(metadata,indent=2))
    (OUT/f'{condition}-scores.json').write_text(json.dumps({','.join(map(str,s)):float(v) for s,v in zip(STATES,scores)}))
    np.savez_compressed(OUT/f'{condition}-activity.npz',activity=activity.numpy(),body_ids=model.ann.bodyId.to_numpy())
    # Reverting only the learned internal gains is a causal ablation.
    model.core.edge_gain.copy_(initial['core.edge_gain']);reverted=model()
    (OUT/f'{condition}-initial-scores.json').write_text(json.dumps({','.join(map(str,s)):float(v) for s,v in zip(STATES,reverted)}))
print('Saved trained internal connections, exact response cache, activity and freeze checks.',flush=True)
