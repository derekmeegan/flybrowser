"""Rebuild the bundled MaleCNS circuit from the checksummed original downloads."""
import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow.feather as feather
import pyarrow.ipc as ipc
from scipy import sparse

ROOT = Path(__file__).resolve().parents[1]
DATA, OUT = ROOT / 'data', ROOT / 'artifacts'
OUT.mkdir(exist_ok=True)
provenance_path = ROOT / 'circuit/provenance.json'
provenance = json.loads(provenance_path.read_text())
for name, expected in provenance['source_sha256'].items():
    with (DATA / name).open('rb') as stream:
        actual = hashlib.file_digest(stream, 'sha256').hexdigest()
    if actual != expected:
        raise ValueError(f'Source checksum mismatch: {name}')
ann = feather.read_feather(DATA / 'body-annotations-male-cns-v1.0-minconf-0.5.feather')
ann = ann[ann.superclass.notna()].sort_values('bodyId').reset_index(drop=True)
ids = pd.Index(ann.bodyId)
n = len(ids)
nt = feather.read_feather(DATA / 'body-neurotransmitters-male-cns-v1.0.feather').set_index('body')
nts = nt.reindex(ids).consensus_nt.fillna('unknown')
sign = np.where(nts.isin(['gaba', 'glutamate']), -1., 1.).astype(np.float32)
matrix_path = DATA / 'malecns-signed-normalized.npz'
rows, cols, vals = [], [], []
reader = ipc.open_file(DATA / 'connectome-weights-male-cns-v1.0-minconf-0.5.feather')
for k in range(reader.num_record_batches):
    b = reader.get_batch(k)
    pre = ids.get_indexer(b.column('body_pre').to_numpy())
    post = ids.get_indexer(b.column('body_post').to_numpy())
    keep = (pre >= 0) & (post >= 0)
    rows.append(post[keep].astype(np.int32))
    cols.append(pre[keep].astype(np.int32))
    vals.append(b.column('weight').to_numpy()[keep].astype(np.float32))
    if k % 300 == 0:
        print(f'Filtering graph: {k}/{reader.num_record_batches} batches', flush=True)
r, c, v = map(np.concatenate, [rows, cols, vals])
del rows, cols, vals
weight_sum = float(v.sum())
w = sparse.csr_matrix((v * sign[c], (r, c)), shape=(n, n))
del r, c, v
incoming = np.asarray(abs(w).sum(axis=1)).ravel()
w = sparse.diags(1 / np.maximum(incoming, 1)).dot(w).tocsr().astype(np.float32)
sparse.save_npz(matrix_path, w)
(DATA / 'graph-stats.json').write_text(json.dumps({'weight_sum':weight_sum,'edges':int(w.nnz)}))

keep = np.flatnonzero(ann['class'].isin(['ALPN', 'Kenyon_Cell', 'MBON', 'DAN']))
subset = ann.iloc[keep].reset_index(drop=True)
weights = w[keep][:, keep].tocsr()
feather.write_feather(subset, ROOT / 'circuit/neurons.feather')
sparse.save_npz(ROOT / 'circuit/weights.npz', weights)
provenance['neurons'] = len(subset)
provenance['edges'] = int(weights.nnz)
for name in provenance['files']:
    provenance['files'][name] = hashlib.sha256((ROOT / 'circuit' / name).read_bytes()).hexdigest()
provenance_path.write_text(json.dumps(provenance, indent=2) + '\n')
print(f'Exported {len(subset):,} neurons and {weights.nnz:,} edges to circuit/.', flush=True)
