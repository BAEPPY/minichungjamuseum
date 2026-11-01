"""Build a continuous photo-reference vase from recovered cameras and fitted geometry.
Original photographs are read without edits. This is approximate geometry, not a scan.
Uses NumPy, SciPy, OpenCV and Pillow; outputs an embedded, unlit, ordinary glTF2 GLB.
"""
from pathlib import Path
import argparse,json,math,hashlib,struct,time
import numpy as np,cv2
from PIL import Image
from scipy.interpolate import PchipInterpolator
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--inputs',type=Path,required=True)
parser.add_argument('--photos',type=Path,required=True)
parser.add_argument('--output',type=Path,required=True)
parser.add_argument('--texture-width',type=int,default=4096)
parser.add_argument('--texture-height',type=int,default=3072)
args=parser.parse_args();cv2.setNumThreads(2)
root=args.inputs;photos=args.photos;output=args.output;output.parent.mkdir(parents=True,exist_ok=True)
source=json.loads((photos/'source-provenance.json').read_text())
for f in source['files']:
 assert hashlib.sha256((photos/f['file']).read_bytes()).hexdigest()==f['sha256'],f['file']
profile=json.loads((root/'fitted-profile.json').read_text());calib=json.loads((root/'recovered-cameras.json').read_text())
basis=np.array(profile['basisWorldColumns']);axis=np.array(profile['axisWorld']);low=profile['lowWorld'];H=profile['heightWorld']
pz=np.array(profile['profileZ']);pr=np.array(profile['profileRadius']);pc=np.array(profile['asymmetryFourier'])
radius=PchipInterpolator(pz,pr,extrapolate=True)
base=float(radius(.004));neck=float(radius(.994));inner=neck*.74
# Counterclockwise solid vessel-wall cross section: inset foot → exterior →
# open rim → estimated dark interior → inner base. There is no lid over the mouth.
path=[]
def add(r,z,region,warp=0):path.append([r,z,region,warp])
for t in np.linspace(0,1,10):add(base*t,.006*(1-t)**2,0)
for z in np.linspace(.004,.994,224):add(float(radius(z)),z,1,max(0,(z-.975)/(.994-.975)))
for t in np.linspace(.05,np.pi,13):add((neck+inner)/2+(neck-inner)/2*np.cos(t),.994+.003*np.sin(t),2,1)
for z in np.linspace(.987,.89,16):add(inner+(.085-inner)*((.987-z)/(.987-.89)),z,3,max(0,(z-.975)/(.994-.975)))
for z in np.linspace(.88,.025,68):add(max(.01,float(radius(z))-.022),z,3)
for t in np.linspace(1,0,10):add((float(radius(.025))-.022)*t,.025,3)
path=np.array(path);path_dist=np.r_[0,np.cumsum(np.linalg.norm(np.diff(path[:,:2],axis=0),axis=1)*np.where(path[1:,2]==3,.065,1))];vpath=path_dist/path_dist[-1]

def surface(v,theta):
 r=np.interp(v,vpath,path[:,0]);z=np.interp(v,vpath,path[:,1]);region=np.interp(v,vpath,path[:,2]);warp=np.interp(v,vpath,path[:,3]);origz=z.copy()
 # Measured low-order departures from axial symmetry on the photographed body.
 outer=(region>.98)&(region<1.02)
 def smoothstep(x):
  a=np.clip(x,0,1);return a*a*(3-2*a)
 taper=smoothstep((origz-.025)/.10)*smoothstep((.91-origz)/.09)
 for k in range(3):
  ca=np.interp(origz,pz,pc[:,2*k]);cb=np.interp(origz,pz,pc[:,2*k+1]);r+=np.where(outer,.65*taper*(ca*np.cos((k+1)*theta)+cb*np.sin((k+1)*theta)),0)
 rim=np.interp(theta,np.array(profile['rimAngles']),np.array(profile['rimHeights']),period=2*np.pi)
 z+=warp*(rim-.994)
 return np.stack([r*np.cos(theta),r*np.sin(theta),z],axis=-1),region

def surface_normal(v,theta):
 e=.00003;p1,_=surface(np.clip(v+e,0,1),theta);p0,_=surface(np.clip(v-e,0,1),theta)
 q1,_=surface(v,theta+e);q0,_=surface(v,theta-e)
 n=np.cross(q1-q0,p1-p0);length=np.linalg.norm(n,axis=-1,keepdims=True);n/=np.maximum(length,1e-12)
 n=np.where(length<1e-10,np.stack([np.zeros_like(v),np.zeros_like(v),np.where(v<.5,-1,1)],axis=-1),n)
 return n
# Vertex grid contains an intentional UV seam; positions remain coincident there.
N=192;vv,tt=np.meshgrid(vpath,np.linspace(-np.pi,np.pi,N+1),indexing='ij');local,regions=surface(vv,tt);normals=surface_normal(vv,tt)
uv=np.stack([(tt+np.pi)/(2*np.pi),vv],axis=-1)
vertices=local.reshape(-1,3);normals=normals.reshape(-1,3);uv=uv.reshape(-1,2)
faces=[]
for j in range(len(vpath)-1):
 for i in range(N):
  a=j*(N+1)+i;b=a+1;c=a+N+1;d=c+1;faces.extend([(a,b,d),(a,d,c)])
faces=np.array(faces,dtype=np.uint32)
# Remove zero-area axis-fan triangles while retaining the actual opening.
a,b,c=vertices[faces[:,0]],vertices[faces[:,1]],vertices[faces[:,2]];keep=np.linalg.norm(np.cross(b-a,c-a),axis=1)>1e-10;faces=faces[keep]
# glTF Y up; photograph calibration stays in its original world frame below.
gltf_vertices=vertices[:,[0,2,1]]*np.array([1,1,-1]);gltf_normals=normals[:,[0,2,1]]*np.array([1,1,-1])

def sample(image,mx,my,nearest=False):
 x=np.clip(mx.ravel(),0,image.shape[1]-1);y=np.clip(my.ravel(),0,image.shape[0]-1)
 if nearest:return image[np.rint(y).astype(int),np.rint(x).astype(int)]
 x0=np.floor(x).astype(int);y0=np.floor(y).astype(int);x1=np.minimum(x0+1,image.shape[1]-1);y1=np.minimum(y0+1,image.shape[0]-1)
 dx=(x-x0)[:,None];dy=(y-y0)[:,None]
 return image[y0,x0]*(1-dx)*(1-dy)+image[y0,x1]*dx*(1-dy)+image[y1,x0]*(1-dx)*dy+image[y1,x1]*dx*dy

cameras=[]
for im in calib['images']:
 camera=calib['cameras'][str(im['camera_id'])];m=np.array(im['camera_from_world']);K=np.array(camera['K']);center=np.array(im['center'])
 image=cv2.cvtColor(cv2.imread(str(photos/im['name'])),cv2.COLOR_BGR2RGB)
 mask=cv2.imread(str(root/'precise-masks'/(im['name']+'.png')),0);mask=cv2.erode(mask,np.ones((7,7),np.uint8))
 cameras.append({'name':im['name'],'m':m,'K':K,'center':center,'image':image,'mask':mask})
# The inverted underside set did not register. Its original photograph is
# separately aligned to the approximate circular foot, and explicitly disclosed.
under=cv2.cvtColor(cv2.imread(str(photos/'5_4.jpg')),cv2.COLOR_BGR2RGB);umask=cv2.imread(str(root/'precise-masks/5_4.jpg.png'),0)
# Manually annotated actual foot disc, excluding the sloping body visible around it.
ucx,ucy=699.,979.;urx,ury=276.,292.
W=args.texture_width;T=args.texture_height;atlas=np.zeros((T,W,3),np.uint8);filled=0;counts={c['name']:0 for c in cameras};start=time.time()
for y0 in range(0,T,48):
 ys=np.arange(y0,min(T,y0+48));V,TH=np.meshgrid((ys+.5)/T,((np.arange(W)+.5)/W)*2*np.pi-np.pi,indexing='ij');p,reg=surface(V,TH);n=surface_normal(V,TH)
 shp=p.shape[:2];p=p.reshape(-1,3);n=n.reshape(-1,3);reg=reg.reshape(-1)
 world=(p*np.array([H,H,H])+np.array([0,0,low]))@basis.T+axis
 wn=n@basis.T;total=np.zeros(len(p),np.float32);colors=np.zeros((len(p),3),np.float32)
 outside=reg<2.6
 for cam in cameras:
  direction=cam['center']-world;direction/=np.maximum(np.linalg.norm(direction,axis=1,keepdims=True),1e-12);cos=np.einsum('ij,ij->i',wn,direction)
  ids=np.flatnonzero(outside&(cos>.32))
  if not len(ids):continue
  campt=world[ids]@cam['m'][:,:3].T+cam['m'][:,3];pix=campt@cam['K'].T;pix=pix[:,:2]/pix[:,2,None]
  valid=(campt[:,2]>0)&(pix[:,0]>3)&(pix[:,0]<cam['image'].shape[1]-4)&(pix[:,1]>3)&(pix[:,1]<cam['image'].shape[0]-4)
  ids=ids[valid];pix=pix[valid]
  if not len(ids):continue
  mx=pix[:,0].astype(np.float32).reshape(-1,1);my=pix[:,1].astype(np.float32).reshape(-1,1)
  valid=sample(cam['mask'],mx,my,nearest=True)>0
  ids=ids[valid];mx=mx[valid];my=my[valid]
  if not len(ids):continue
  samples=sample(cam['image'],mx,my)
  weights=np.power(cos[ids],24).astype(np.float32)
  colors[ids]+=samples*weights[:,None];total[ids]+=weights;counts[cam['name']]+=int(np.sum(weights>.01))
 rgb=colors/np.maximum(total[:,None],1e-15);missing=total<1e-10;rgb[missing]=[121,119,91]
 # Visible interior is an approximate neutral dark ceramic cavity, not invented motifs.
 inside=reg>=2.6;shade=np.clip((p[:,2]-.88)/.12,0,1);rgb[inside]=np.stack([30+70*shade[inside],29+64*shade[inside],22+42*shade[inside]],axis=1)
 bottom=reg<.1
 if bottom.any():
  ids=np.flatnonzero(bottom);mx=(ucx+p[ids,0]/base*urx).astype(np.float32).reshape(-1,1);my=(ucy-p[ids,1]/base*ury).astype(np.float32).reshape(-1,1)
  rgb[ids]=sample(under,mx,my)
 filled+=int(np.sum(outside&~missing));atlas[y0:y0+len(ys)]=np.clip(rgb.reshape(*shp,3),0,255).astype(np.uint8)
 if y0%384==0:print('ATLAS_ROWS',y0,'/',T,'SECONDS',round(time.time()-start,1),flush=True)
# UV origin is upper-left in glTF image coordinates; v is the path fraction.
atlas_path=output.with_suffix('.atlas.jpg');Image.fromarray(atlas).save(atlas_path,quality=93,subsampling=0)
imgbytes=atlas_path.read_bytes()
# Minimal ordinary glTF2 binary, with source photograph colors kept unlit.
chunks=[];views=[];accessors=[]
def buf(data,target=None):
 padding=(-sum(len(x)for x in chunks))%4
 if padding:chunks.append(b'\0'*padding)
 offset=sum(len(x)for x in chunks);chunks.append(data);v={'buffer':0,'byteOffset':offset,'byteLength':len(data)}
 if target:v['target']=target
 views.append(v);return len(views)-1

def acc(array,component,kind,target):
 a=np.ascontiguousarray(array);view=buf(a.tobytes(),target);x={'bufferView':view,'componentType':component,'count':len(a),'type':kind}
 if kind=='VEC3':x['min']=a.min(axis=0).tolist();x['max']=a.max(axis=0).tolist()
 accessors.append(x);return len(accessors)-1
pos=acc(gltf_vertices.astype('<f4'),5126,'VEC3',34962);normal=acc(gltf_normals.astype('<f4'),5126,'VEC3',34962);tex=acc(uv.astype('<f4'),5126,'VEC2',34962);idx=acc(faces.reshape(-1).astype('<u4'),5125,'SCALAR',34963);iv=buf(imgbytes)
extras={'sourceKind':'PHOTO_BASED_RECONSTRUCTION','notMeasuredScan':True,'registeredPhotographs':len(cameras),'geometry':'Smooth profile with low-order asymmetry fitted to sparse recovered features. Lip, inner cavity and foot are approximate.','underside':'Original5_4.jpg, unregistered manual circular projection.'}
gltf={'asset':{'version':'2.0','generator':'Museum photo-reference reconstruction pipeline'},'extensionsUsed':['KHR_materials_unlit'],'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'mesh':0,'name':'Japanese peony vase · photo-derived approximation','extras':extras}],'meshes':[{'primitives':[{'attributes':{'POSITION':pos,'NORMAL':normal,'TEXCOORD_0':tex},'indices':idx,'material':0}]}],'materials':[{'name':'Original photographs · unlit atlas','pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicFactor':0,'roughnessFactor':1},'extensions':{'KHR_materials_unlit':{}},'doubleSided':False}],'textures':[{'source':0,'sampler':0}],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':33071}],'images':[{'bufferView':iv,'mimeType':'image/jpeg'}],'bufferViews':views,'accessors':accessors,'buffers':[{'byteLength':sum(len(x)for x in chunks)}]}
js=json.dumps(gltf,separators=(',',':')).encode();js+=b' '*((-len(js))%4);binary=b''.join(chunks);binary+=b'\0'*((-len(binary))%4)
output.write_bytes(struct.pack('<III',0x46546c67,2,12+8+len(js)+8+len(binary))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary)
metrics={'vertices':len(vertices),'triangles':len(faces),'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'texture':[W,T],'registeredCameras':len(cameras),'textureContributionSamples':counts,'filledPhotographicTexels':filled,'textureSeconds':time.time()-start,'bottomProjection':{'originalPhoto':'5_4.jpg','cameraRegistered':False,'centerPixels':[ucx,ucy],'radiiPixels':[urx,ury]},'geometry':extras,'profileBounds':[vertices.min(axis=0).tolist(),vertices.max(axis=0).tolist()]}
output.with_suffix('.metrics.json').write_text(json.dumps(metrics,indent=2));np.savez(output.with_suffix('.mesh.npz'),vertices=vertices,faces=faces,normals=normals,uv=uv)
print('MODEL_COMPLETE',json.dumps(metrics),flush=True)
