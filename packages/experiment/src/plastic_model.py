"""Reward-trained anatomical connections, with frozen browser interfaces.

Uses Flyhard's MIT-licensed SparseConnectome directly. The MaleCNS extract
retains ALPN, Kenyon cells, MBON and DAN classes. Only measured KC->MBON
edge gains may train. This is an engineered rate model, not measured
physiology or a biological plasticity-rule reproduction.
"""
from pathlib import Path
import sys, json
import numpy as np
import torch
from torch import nn
from scipy import sparse
import pyarrow.feather as feather

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'third_party'))
from flyhard.connectome import SparseConnectome

STATES=[(p,g,c) for p in range(3) for g in range(4) for c in range(4)]
class PlasticFly(nn.Module):
    def __init__(self,shuffled=False):
        super().__init__()
        self.ann=feather.read_feather(ROOT/'circuit/neurons.feather')
        keep=np.arange(len(self.ann))
        w=sparse.load_npz(ROOT/'circuit/weights.npz').tocsr()
        incoming=np.asarray(abs(w).sum(axis=1)).ravel()
        w=sparse.diags(1/np.maximum(incoming,1e-12)).dot(w).tocsr()
        cls=self.ann['class'].to_numpy();rows=np.repeat(np.arange(len(keep)),np.diff(w.indptr))
        if shuffled:
            # Within-class source permutation retains the number of KC->MBON
            # plastic edges, signs, weights and per-target incoming totals.
            rng=np.random.default_rng(7731);permutation=np.arange(len(keep))
            for label in ['ALPN','Kenyon_Cell','MBON','DAN']:
                pop=np.flatnonzero(cls==label);permutation[pop]=rng.permutation(pop)
            w.indices=permutation[w.indices].astype(np.int32);w.sort_indices()
        self.core=SparseConnectome(w.indptr,w.indices,abs(w.data))
        with torch.no_grad():self.core.base.copy_(torch.tensor(w.data*3.2))
        self.core.leak.requires_grad_(False)
        mask=(cls[rows]=='MBON')&(cls[w.indices]=='Kenyon_Cell')
        self.register_buffer('plastic_mask',torch.tensor(mask))
        rng=np.random.default_rng(20260913)
        sensory=np.flatnonzero(cls=='ALPN');outputs=np.flatnonzero(cls=='MBON')
        projection=np.zeros((len(keep),11),np.float32)
        projection[sensory]=rng.normal(0,.85,(len(sensory),11))
        bias=rng.uniform(-.35,.35,(len(keep),1)).astype(np.float32)
        self.register_buffer('projection',torch.tensor(projection))
        self.register_buffer('bias',torch.tensor(bias))
        self.register_buffer('outputs',torch.tensor(outputs))
        self.register_buffer('decoder',torch.tensor(rng.normal(0,1/np.sqrt(len(outputs)),len(outputs)).astype(np.float32)))
        self.register_buffer('center',torch.tensor(0.))
        self.register_buffer('scale',torch.tensor(1.))
        x=np.zeros((11,48),np.float32)
        for k,(p,g,c) in enumerate(STATES):x[g,k]=1;x[4+c,k]=1;x[8+p,k]=1
        self.register_buffer('inputs',torch.tensor(x))
        self.steps=6
        self.description={'neurons':len(keep),'edges':w.nnz,'plastic_edges':int(mask.sum()),
          'classes':self.ann['class'].value_counts().to_dict(),'steps':self.steps,'shuffled':shuffled,
          'model':'Flyhard SparseConnectome; signed normalized graph, 6 rate updates, frozen leaks and bias',
          'plasticity':'Only existing Kenyon_Cell -> MBON edge gains, bounded and sign-preserving; reward-loss gradients',
          'interfaces':'Fixed seeded 11-channel browser-text drive to ALPN cells; fixed random MBON scalar decoder',
          'omissions':'All other neurons and all edges to/from outside the extract omitted. No recovered browser perception or biological timing.'}
    def forward(self,indices=None,return_states=False):
        x=self.inputs if indices is None else self.inputs[:,indices]
        drive=self.projection@x+self.bias
        state=torch.zeros_like(drive)
        if return_states:
            history=[state]
            for _ in range(self.steps):state=self.core(state,steps=1,drive=drive);history.append(state)
        else:state=self.core(state,steps=self.steps,drive=drive)
        values=state[self.outputs].T@self.decoder
        scores=(values-self.center)*self.scale
        return (scores,torch.stack(history)) if return_states else scores
    def calibrate(self):
        # Unlabelled stimuli only; both constants remain frozen during training.
        with torch.no_grad():
            values=self.forward();self.center.copy_(values.mean());self.scale.copy_(.15/values.std().clamp_min(1e-5))
    def mask_gradients(self):
        self.core.edge_gain.grad.mul_(self.plastic_mask)
