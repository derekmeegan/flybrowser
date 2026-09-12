"""Low-poly MuJoCo scene derived from Flybody, in Browserbase's design colors.

Body pose is an authored animation, driven by recorded browser event timing.
It is not a trained locomotion/leg-contact policy.
"""
from pathlib import Path
import xml.etree.ElementTree as ET
import numpy as np
import mujoco
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'vendor/flybody/flybody/fruitfly/assets'

def build_scene():
    root=ET.parse(ASSETS/'fruitfly.xml').getroot()
    root.find('compiler').set('meshdir',str(ROOT/'artifacts/lowpoly-meshes'))
    visual=ET.SubElement(root,'visual')
    ET.SubElement(visual,'global',offwidth='1600',offheight='1000')
    ET.SubElement(visual,'quality',shadowsize='4096',offsamples='4')
    ET.SubElement(visual,'headlight',ambient='.40 .40 .40',diffuse='.20 .20 .20',specular='.1 .1 .1')
    ET.SubElement(visual,'map',znear='.001',zfar='1000',shadowscale='1')
    ET.SubElement(visual,'rgba',fog='.976 .965 .957 1',haze='.976 .965 .957 1')
    asset=root.find('asset')
    for mesh in asset.findall('mesh'):mesh.set('smoothnormal','false')
    colors={'body':'.84 .82 .79 1','red':'.941 .212 .012 1','ocelli':'.063 .051 .051 1',
      'black':'.43 .40 .38 1','bristle-brown':'.43 .40 .38 1','lower':'.74 .72 .68 1',
      'brown':'.318 .310 .310 1','membrane':'.71 .70 .68 .65'}
    for mat in asset.findall('material'):
        if mat.get('name') in colors:
            mat.set('rgba',colors[mat.get('name')]);mat.set('specular','0');mat.set('shininess','0')
    screen=ROOT/'artifacts/screen-texture.png'
    Image.new('RGB',(1000,680),(237,240,230)).save(screen)
    ET.SubElement(asset,'texture',name='browser-screen',type='2d',file=str(screen))
    ET.SubElement(asset,'material',name='browser-screen',texture='browser-screen',texrepeat='1 1',texuniform='false',rgba='.8 .8 .8 1',emission='.5',specular='0',shininess='0',reflectance='0')
    ET.SubElement(asset,'texture',name='sky',type='skybox',builtin='gradient',rgb1='.976 .965 .957',rgb2='.976 .965 .957',width='128',height='128')
    ET.SubElement(asset,'material',name='desk',rgba='.91 .88 .85 1',specular='.05',reflectance='0')
    ET.SubElement(asset,'material',name='metal',rgba='.10 .085 .085 1',specular='.1',shininess='.1')
    ET.SubElement(asset,'material',name='keys',rgba='.86 .83 .79 1',specular='.1',shininess='.1')
    ET.SubElement(asset,'material',name='backdrop',rgba='.976 .965 .957 1',emission='.45',specular='0')
    ET.SubElement(asset,'material',name='orange',rgba='.941 .212 .012 1',specular='.1',shininess='.1')
    ET.SubElement(asset,'mesh',name='screen-plane',scale='1 1 1',
      vertex='-.25 0 -.17 .25 0 -.17 .25 0 .17 -.25 0 .17 -.25 .0001 -.17 .25 .0001 -.17 .25 .0001 .17 -.25 .0001 .17',
      face='0 1 2 0 2 3 4 6 5 4 7 6 0 4 5 0 5 1 3 2 6 3 6 7 0 3 7 0 7 4 1 5 6 1 6 2',
      texcoord='0 0 1 0 1 1 0 1 0 0 1 0 1 1 0 1')
    world=root.find('worldbody')
    thorax=world.find("body[@name='thorax']")
    for light in list(thorax.findall('light')):thorax.remove(light)
    for geom in root.findall('.//geom'):
        if any(k in geom.get('mesh','') for k in ['black','bristle']):geom.set('group','3')
    def box(size,pos,material):
        return ET.SubElement(world,'geom',type='box',size=size,pos=pos,material=material,contype='0',conaffinity='0')
    ET.SubElement(world,'geom',type='plane',size='100 100 .01',pos='0 0 -.5',material='backdrop')
    box('4 .01 3','0 .9 2.50','backdrop')
    for i in range(19):box('.002 .004 .75',f'{-.9+i*.105} .88 .22','desk')
    box('2 .004 .006','0 .875 -.15','orange')
    box('.38 .265 .015','.26 .012 -.148','desk')
    box('.38 .003 .005','.26 -.255 -.141','orange')
    for x in [-.08,.60]:
        for y in [-.22,.24]:box('.012 .012 .165',f'{x} {y} -.33','metal')
    box('.135 .135 .016','-.26 -.065 -.164','orange')
    box('.014 .135 .145','-.40 -.065 -.035','orange')
    box('.017 .017 .15','-.27 -.065 -.33','metal')
    for y in [-.19,.06]:box('.12 .012 .012',f'-.27 {y} -.479','metal')
    ET.SubElement(world,'geom',type='cylinder',size='.026 .037',pos='.535 -.12 -.094',material='orange')
    ET.SubElement(world,'geom',type='cylinder',size='.022 .0008',pos='.535 -.12 -.056',material='metal')
    ET.SubElement(world,'geom',type='capsule',size='.005 .025',pos='.574 -.12 -.094',material='orange')
    for z in [-.118,-.07]:box('.02 .004 .004',f'.555 -.12 {z}','orange')
    ET.SubElement(world,'light',name='key',pos='-.4 -.7 1.5',dir='.3 .4 -1',diffuse='.65 .63 .61',specular='.25 .25 .25',castshadow='true')
    ET.SubElement(world,'light',name='fill',pos='.8 -.4 .7',dir='-.5 .3 -.6',diffuse='.22 .22 .22',castshadow='false')
    ET.SubElement(world,'light',name='rim',pos='-.3 .7 1.0',dir='.2 -.5 -.8',diffuse='.25 .28 .22',castshadow='false')
    # Monitor and low keyboard are scaled to the insect's desk.
    ET.SubElement(world,'geom',type='box',size='.266 .018 .194',pos='.205 .125 .195',material='metal',contype='0',conaffinity='0')
    ET.SubElement(world,'geom',name='screen',type='mesh',mesh='screen-plane',pos='.205 .106 .20',material='browser-screen',contype='0',conaffinity='0',mass='0')
    ET.SubElement(world,'geom',type='box',size='.034 .025 .054',pos='.205 .139 -.058',material='metal')
    ET.SubElement(world,'geom',type='box',size='.115 .07 .006',pos='.205 .102 -.124',material='metal')
    ET.SubElement(world,'geom',type='box',size='.165 .075 .008',pos='.065 -.095 -.119',material='metal')
    for row in range(4):
        for col in range(11):
            ET.SubElement(world,'geom',name=f'key-{row}-{col}',type='box',size='.012 .012 .004',
              pos=f'{-.082+col*.029} {-.147+row*.033} -.107',material='orange' if col==10 or (row==0 and col==0) else 'keys')
    ET.SubElement(world,'geom',type='ellipsoid',size='.029 .042 .013',pos='.367 -.086 -.119',material='keys')
    xml=ET.tostring(root,encoding='unicode')
    (ROOT/'artifacts/scene.xml').write_text(xml)
    return mujoco.MjModel.from_xml_string(xml)

class FlyScene:
    def __init__(self,width=1440,height=810):
        self.model=build_scene();self.data=mujoco.MjData(self.model)
        self.renderer=mujoco.Renderer(self.model,height,width)
        self.options=mujoco.MjvOption();self.options.geomgroup[3:]=0
        self.camera=mujoco.MjvCamera()
        self.camera.lookat[:]=[.045,.035,-.025];self.camera.distance=1.21
        self.camera.azimuth=108;self.camera.elevation=-21
        self.texture=self.model.texture('browser-screen').id
        self.last_screen=None

    def set_screen(self,path):
        if path==self.last_screen:return
        im=Image.open(path).convert('RGB').resize((1000,680))
        adr=self.model.tex_adr[self.texture];size=1000*680*3
        self.model.tex_data[adr:adr+size]=np.flipud(np.asarray(im)).ravel()
        mujoco.mjr_uploadTexture(self.model,self.renderer._mjr_context,self.texture)
        self.last_screen=path

    def render(self,t=0,typing=False,celebrate=False):
        d=self.data;m=self.model;d.qpos[:]=m.qpos0
        d.qpos[:3]=[-.19,-.07,.005+(.002*np.sin(t*2))]
        d.qpos[3:7]=[1,0,0,0]
        def pose(name,value):
            j=m.joint(name);d.qpos[j.qposadr[0]]=value
        # Fold both wings over the abdomen. Small motion is purely presentational.
        for side in ['left','right']:
            pose('wing_yaw_'+side,1.5 - (.10*abs(np.sin(t*25)) if celebrate else 0))
            pose('wing_roll_'+side,.7)
            pose('wing_pitch_'+side,-1.0)
            pose('antenna_'+side,.1+.08*np.sin(t*4+(0 if side=='left' else 1)))
        pose('head',-.05+.05*np.sin(t*2.5))
        if typing:
            for k,side in enumerate(['left','right']):
                pulse=(np.sin(t*17+k*np.pi)+1)/2
                pose('coxa_T1_'+side,.2+.10*pulse)
                pose('femur_T1_'+side,.2+.25*pulse)
                pose('tibia_T1_'+side,-.2-.15*pulse)
        if celebrate:pose('abdomen',.1*np.sin(t*14))
        mujoco.mj_forward(m,d)
        self.camera.azimuth=108+3*np.sin(t*.18)
        self.renderer.update_scene(d,camera=self.camera,scene_option=self.options)
        return Image.fromarray(self.renderer.render())

    def close(self):self.renderer.close()

if __name__=='__main__':
    s=FlyScene()
    captures=list((ROOT/'artifacts/browser-captures').glob('after-start.png'))
    if captures:s.set_screen(captures[0])
    s.render(1,typing=True).save(ROOT/'artifacts/scene-preview.png');s.close()
