"""Prepare OFL fonts and low-poly derivatives of Flybody's mesh assets."""
from pathlib import Path
import json, shutil
import trimesh
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts'
FONTS=OUT/'fonts';FONTS.mkdir(exist_ok=True)
for name in ['Inter.ttf','Inter-OFL.txt','JetBrainsMono.ttf','JetBrainsMono-OFL.txt']:
 shutil.copy2(ROOT.parents[1]/'apps/web/public/assets'/name,FONTS/name)
source=ROOT/'vendor/flybody/flybody/fruitfly/assets';dest=OUT/'lowpoly-meshes';dest.mkdir(exist_ok=True)
if not (source/'fruitfly.xml').exists():raise SystemExit('Run npm run experiment:browser to fetch Flybody first.')
report=[]
for path in sorted(source.glob('*.obj')):
 mesh=trimesh.load(path,force='mesh',process=False);before=len(mesh.faces)
 # Source OBJ files duplicate corners for normals. Weld before decimation;
 # otherwise the decimator sees thousands of disconnected triangles.
 mesh.merge_vertices(merge_norm=True,merge_tex=True)
 budget=240 if any(k in path.name for k in ['head_body','head_red','thorax_body']) else 100
 if any(k in path.name for k in ['wing','black','bristle']):budget=before
 if before>budget:mesh=mesh.simplify_quadric_decimation(face_count=budget)
 (dest/path.name).write_text(trimesh.exchange.obj.export_obj(mesh,include_normals=False,include_texture=False))
 report.append({'file':path.name,'original_faces':before,'derived_faces':len(mesh.faces)})
(OUT/'mesh-derivation.json').write_text(json.dumps(report,indent=2))
print('Prepared fonts and',len(report),'Flybody mesh derivatives')
