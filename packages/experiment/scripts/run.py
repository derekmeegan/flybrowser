"""Run experiment Python entry points from a consistent working directory."""
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
python = ROOT / '.venv/bin/python'
if not python.exists():
    sys.exit('Run npm run experiment:setup first.')
script, *args = sys.argv[1:]
sys.exit(subprocess.call([str(python), str(ROOT / 'src' / script), *args], cwd=ROOT))
