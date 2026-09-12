"""Install the locked Python runtime and restore the published checkpoints."""
from pathlib import Path
import gzip
import hashlib
import json
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT.parents[1] / 'apps/web/public/assets'


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def verify(path, expected):
    if digest(path) != expected:
        sys.exit(f'Checksum mismatch: {path}')


if not shutil.which('uv'):
    sys.exit('Install uv (https://docs.astral.sh/uv/), then rerun this command.')
python = ROOT / '.venv/bin/python'
if not python.exists():
    subprocess.run(['uv', 'venv', '--python', '3.12', str(ROOT / '.venv')], check=True)
subprocess.run(['uv', 'pip', 'install', '--python', str(python), '-r', str(ROOT / 'requirements.lock')], check=True)

provenance = json.loads((ROOT / 'circuit/provenance.json').read_text())
for name, sha256 in provenance['files'].items():
    verify(ROOT / 'circuit' / name, sha256)

source = json.loads((ROOT / 'sources.json').read_text())['flyhard']
verify(ROOT / source['vendored_path'], source['sha256'])

directory = ROOT / 'artifacts/plastic'
directory.mkdir(parents=True, exist_ok=True)
manifest = json.loads((ROOT / 'checkpoints/manifest.json').read_text())
for name, info in manifest.items():
    archive = ROOT / 'checkpoints' / (name + '.gz')
    verify(archive, info['gzip_sha256'])
    target = directory / name
    # Preserve local training runs; packing explicitly updates the archives.
    if target.exists():
        status = 'published' if digest(target) == info['sha256'] else 'locally modified'
        print(f'Keeping {status} checkpoint: {name}', flush=True)
        continue
    temp = target.with_suffix('.part')
    with gzip.open(archive, 'rb') as src, temp.open('wb') as dst:
        shutil.copyfileobj(src, dst)
    verify(temp, info['sha256'])
    temp.replace(target)
    print(f'Restored {name}', flush=True)

fonts = ROOT / 'artifacts/fonts'
fonts.mkdir(exist_ok=True)
for name in ['Inter.ttf', 'JetBrainsMono.ttf', 'Inter-OFL.txt', 'JetBrainsMono-OFL.txt']:
    shutil.copy2(ASSETS / name, fonts / name)
print('Python, circuit, fonts and checkpoints are ready. Browser tools are optional: npm run experiment:browser')
