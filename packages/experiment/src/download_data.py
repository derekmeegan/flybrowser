"""Public MaleCNS downloads, as linked by male-cns.janelia.org/download/."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
BASE='https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/'
FILES=['body-annotations-male-cns-v1.0-minconf-0.5.feather',
       'body-neurotransmitters-male-cns-v1.0.feather',
       'connectome-weights-male-cns-v1.0-minconf-0.5.feather']
(ROOT/'data').mkdir(exist_ok=True)
def download(name):
 p=ROOT/'data'/name
 if p.exists():print('Exists:',name);return
 temp=p.with_suffix('.part')
 urllib.request.urlretrieve(BASE+name,temp)
 temp.rename(p);print('Downloaded:',name,flush=True)
with ThreadPoolExecutor(3) as pool:list(pool.map(download,FILES))
