"""Compress trained checkpoints without losing any tensor data."""
from pathlib import Path
import gzip
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
manifest = {}
for condition in ['connectome', 'shuffled']:
    for state in ['initial', 'trained']:
        name = f'{condition}-{state}.pt'
        data = (ROOT / 'artifacts/plastic' / name).read_bytes()
        packed = gzip.compress(data, compresslevel=9, mtime=0)
        (ROOT / 'checkpoints' / (name + '.gz')).write_bytes(packed)
        manifest[name] = {
            'sha256': hashlib.sha256(data).hexdigest(),
            'bytes': len(data),
            'gzip_sha256': hashlib.sha256(packed).hexdigest(),
        }
(ROOT / 'checkpoints/manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print('Packed four checkpoints and updated their checksums.')
