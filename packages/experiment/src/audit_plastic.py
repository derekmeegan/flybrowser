"""Verify neural provenance, frozen interfaces, causal ablation and logged choices."""
from pathlib import Path
import json,hashlib
import numpy as np
import torch
from plastic_model import PlasticFly,STATES,ROOT
torch.set_num_threads(2);OUT=ROOT/'artifacts/plastic'
episodes=[json.loads(s) for s in (OUT/'episodes.jsonl').read_text().splitlines()]
train=[json.loads(s) for s in (ROOT/'artifacts/training_transitions.jsonl').read_text().splitlines()]
score_maps={};checks={};fingerprints={}
for condition in ['connectome','shuffled']:
    model=PlasticFly(shuffled=condition=='shuffled')
    before=torch.load(OUT/f'{condition}-initial.pt',weights_only=True)
    after=torch.load(OUT/f'{condition}-trained.pt',weights_only=True)
    assert torch.equal(model.core.base,before['core.base']), 'Bundled circuit differs from checkpoint adjacency'
    metadata=json.loads((OUT/f'{condition}-metadata.json').read_text())
    assert model.ann.bodyId.astype(int).tolist()==metadata['neuron_body_ids']
    frozen=[key for key in before if key!='core.edge_gain']
    assert all(torch.equal(before[key],after[key]) for key in frozen)
    delta=after['core.edge_gain']-before['core.edge_gain']
    assert torch.count_nonzero(delta[~model.plastic_mask])==0
    assert torch.count_nonzero(delta[model.plastic_mask])==int(model.plastic_mask.sum())
    model.load_state_dict(after)
    assert torch.equal(torch.sign(model.core.edge_values()),torch.sign(model.core.base))
    with torch.no_grad():scores=model().numpy()
    label='trained' if condition=='connectome' else 'shuffled'
    score_maps[label]={s:v for s,v in zip(STATES,scores)}
    model.load_state_dict(before)
    with torch.no_grad():initial=model().numpy()
    if condition=='connectome':
        score_maps['untrained']={s:v for s,v in zip(STATES,initial)}
        model.load_state_dict(after)
        with torch.no_grad():model.core.edge_gain.copy_(before['core.edge_gain']);reverted=model().numpy()
        assert np.array_equal(initial,reverted)
        score_maps['reverted']={s:v for s,v in zip(STATES,reverted)}
    checks[condition]={'only_KC_to_MBON_gains_changed':True,'frozen_input_output_and_leaks':True,
      'measured_adjacency_unchanged':True,'signs_preserved':True,'changed_edges':int(torch.count_nonzero(delta)),
      'frozen_tensor_count':len(frozen)}
    for state in ['initial','trained']:
        path=OUT/f'{condition}-{state}.pt';fingerprints[path.name]=hashlib.sha256(path.read_bytes()).hexdigest()
groups={};decisions=0
for row in episodes:
    groups.setdefault(row['condition'],[]).append(row)
    assert row['seed'] not in {x['seed'] for x in train}
    assert row['success']==(len(row['steps'])==3 and all(s['reward']=='Reward +1' for s in row['steps']))
    for step in row['steps']:
        assert step['selected']==step['observation']['labels'][step['action']]
        if row['condition']=='random':continue
        obs=step['observation'];expected=np.array([score_maps[row['condition']][(obs['phase'],obs['goal'],c)] for c in obs['candidates']])
        np.testing.assert_allclose(expected,step['scores'],atol=2e-5,rtol=2e-5)
        assert int(expected.argmax())==step['action'] and step['neural_steps']==6
        decisions+=1
assert set(groups)=={'random','untrained','trained','reverted','shuffled'}
for rows in groups.values():assert [r['seed'] for r in rows]==list(range(3100000,3100200))
for a,b in zip(groups['untrained'],groups['reverted']):
    assert a['success']==b['success'] and [s['action'] for s in a['steps']]==[s['action'] for s in b['steps']]
report={'passed':True,'training_samples':len(train),'evaluation_episodes':len(episodes),'neural_decisions_recomputed_and_verified':decisions,
 'tensor_checks':checks,'initial_equals_reverted_exactly':True,'fresh_seeds_matched_across_conditions':True,
 'runtime':'Every nonrandom evaluation decision was live recurrent inference. Audit batches identical inputs for numerical comparison.',
 'checkpoint_sha256':fingerprints}
(OUT/'audit.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
