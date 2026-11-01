"""Photo-reference reconstruction of the pierced celadon stool. Not a scan.
Run: blender -b --python build_chair.py -- --output chair-reference.glb --preview-dir previews
"""
import bpy,math,json,sys,argparse,hashlib
import numpy as np
from pathlib import Path
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);p.add_argument('--preview-dir',type=Path);p.add_argument('--loops',type=int,default=12);p.add_argument('--preview-views',default='');a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);a.output.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
V=[];F=[];UV=[];MI=[]
def add(points,faces,uv=None,mat=0):
 o=len(V);V.extend(points);F.extend([tuple(o+i for i in q) for q in faces]);MI.extend([mat]*len(faces))
 if uv is None:uv=[((math.atan2(y,x)/(2*math.pi))%1,z/1.7) for x,y,z in points]
 UV.extend(uv)
def foot_factor(z):return .94 if z<=.18 else .94+.06*min(1,(z-.18)/.12)
def lathe(profile,n=144,mat=0,planar_uv=False):
 if max(z for r,z in profile)<.5:profile=[(r*foot_factor(z),z) for r,z in profile]
 pts=[];faces=[];uv=[]
 for r,z in profile:
  for i in range(n):
   t=2*math.pi*i/n;pts.append((r*math.cos(t),r*math.sin(t),z));uv.append((.5+r*math.cos(t),.5+r*math.sin(t)) if planar_uv else (i/n,z/1.7))
 for j in range(len(profile)):
  jj=(j+1)%len(profile)
  for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,jj*n+(i+1)%n,jj*n+i))
 add(pts,faces,uv,mat)
def sweep(points,width,depth=None,closed=False,mat=0,sides=10,exponent=.58):
 depth=depth or width;pts=[];faces=[]
 for i,co in enumerate(points):
  q=Vector(co);prev=Vector(points[(i-1)%len(points)] if closed or i else points[i]);nex=Vector(points[(i+1)%len(points)] if closed or i<len(points)-1 else points[i]);t=(nex-prev).normalized();normal=Vector((q.x,q.y,0)).normalized();side=normal.cross(t).normalized();normal=t.cross(side).normalized()
  if normal.dot(Vector((q.x,q.y,0)))<0:normal=-normal
  for k in range(sides):
   ang=2*math.pi*k/sides;c=math.cos(ang);s=math.sin(ang);u=math.copysign(abs(c)**exponent,c)*width/2;v=math.copysign(abs(s)**exponent,s)*depth/2;pt=q+side*u+normal*v;pts.append(tuple(pt))
 count=len(points) if closed else len(points)-1
 for i in range(count):
  j=(i+1)%len(points)
  for k in range(sides):faces.append((i*sides+k,i*sides+(k+1)%sides,j*sides+(k+1)%sides,j*sides+k))
 if not closed:faces.extend([tuple(reversed(tuple(range(sides)))),tuple((len(points)-1)*sides+k for k in range(sides))])
 add(pts,faces,mat=mat)
def circle(r,z,w,d=None,mat=0):sweep([(r*math.cos(2*math.pi*i/144),r*math.sin(2*math.pi*i/144),z) for i in range(144)],w,d,True,mat)
def radius(z):return .447+.021*math.sin(math.pi*(z-.58)/.91)
# Hollow lower body and ring foot. No centre closure.
lathe([(.281,.025),(.365,.025),(.389,.045),(.394,.073),(.384,.112),(.348,.146),(.348,.178),(.393,.257),(.432,.342),(.452,.425),(.454,.47),(.432,.47),(.411,.353),(.372,.274),(.317,.184),(.313,.147),(.284,.102),(.278,.058)])
# Raised lotus-petal outlines, seen on the lower bowl.
for j in range(10):
 phi=2*math.pi*j/10;points=[]
 def bezier(t,p0,p1,p2,p3):return (1-t)**3*np.array(p0)+3*(1-t)**2*t*np.array(p1)+3*(1-t)*t*t*np.array(p2)+t**3*np.array(p3)
 outline=[]
 for t in np.linspace(0,1,26,endpoint=False):outline.append(bezier(t,(0,.190),(-.32,.232),(-.20,.290),(0,.405)))
 for t in np.linspace(0,1,26,endpoint=False):outline.append(bezier(t,(0,.405),(.20,.290),(.32,.232),(0,.190)))
 for u,z in outline:
  th=phi+u;r=np.interp(z,[.18,.257,.342,.425],[.350,.393,.432,.452])*foot_factor(z)+.003;points.append((r*math.cos(th),r*math.sin(th),z))
 sweep(points,.0095,.0065,True,1,8)
# Lower solid strip consists of actual pierced alternating panels.
N=12;R=.455;zmid=.51;halfH=.050
for j in range(N):
 center=2*math.pi*j/N;halfU=math.pi/N
 if j%2:
  lathe_dummy=None
  pts=[]
  for r in [R,R-.024]:
   for z in [zmid-halfH,zmid+halfH]:
    for th in [center-halfU,center+halfU]:pts.append((r*math.cos(th),r*math.sin(th),z))
  add(pts,[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)])
 else:
  angles=sorted(set([2*math.pi*i/40 for i in range(40)]+[math.atan2(sy*halfH,sx*R*halfU)%(2*math.pi) for sx in [-1,1] for sy in [-1,1]]));pts=[];faces=[]
  for rr in [R,R-.024]:
   for ring in [0,1]:
    for t in angles:
     c,s=math.cos(t),math.sin(t)
     if ring==0:
      factor=min((R*halfU)/max(abs(c),1e-9),halfH/max(abs(s),1e-9));u=c*factor;zz=s*factor
     else:u=.045*c;zz=.0145*s*(.82+.18*math.cos(2*t))
     th=center+u/R;pts.append((rr*math.cos(th),rr*math.sin(th),zmid+zz))
  m=len(angles)
  for k in range(m):
   q=(k+1)%m;faces.extend([(k,q,m+q,m+k),(2*m+k,3*m+k,3*m+q,2*m+q),(m+k,m+q,3*m+q,3*m+k),(k,2*m+k,2*m+q,q)])
  add(pts,faces)
for z,r in [(.457,.455),(.568,.457)]:circle(r,z,.014,.018,1)
# Main interlocking vertical oval ribbons. Twelve centres are inferred from screenshots.
for j in range(a.loops):
 phi=2*math.pi*j/a.loops;points=[]
 for i in range(100):
  t=2*math.pi*i/100;z=1.025+.412*math.cos(t);th=phi+.43*math.sin(t);r=radius(z)+.008*math.cos(2*t+j*math.pi);points.append((r*math.cos(th),r*math.sin(th),z))
 sweep(points,.095,.050,True,0,14,exponent=.9)
 # Fine parallel rounded edge moulding follows the visible ribbon borders.
 for edge in [-1,1]:
  edgepoints=[]
  for i,co in enumerate(points):
   q=Vector(co);prev=Vector(points[(i-1)%len(points)]);nex=Vector(points[(i+1)%len(points)]);t=(nex-prev).normalized();n=Vector((q.x,q.y,0)).normalized();side=n.cross(t).normalized();q+=side*edge*.035+n*.019;edgepoints.append(tuple(q))
  sweep(edgepoints,.008,.007,True,1,8)
# Narrow twin circumferential middle lines and vertical binding details.
for z in [.986,1.016]:circle(.502,z,.014,.016,1)
for j in range(a.loops):
 theta=2*math.pi*j/a.loops+.43
 for offset in [-.012,0,.012]:
  th=theta+offset/.516;points=[(.516*math.cos(th),.516*math.sin(th),z) for z in np.linspace(.955,1.047,8)];sweep(points,.010,.010,False,1,8)
# Pierced scrolling upper rim, bounded by actual narrow rings.
for z in [1.481,1.604]:circle(.456,z,.014,.020,1)
for j in range(18):
 center=2*math.pi*j/18;pts=[]
 for i in range(51):
  t=i/50;th=center+(.145*(2*t-1))/.456;z=1.542+.038*math.sin(2*math.pi*t);pts.append((.457*math.cos(th),.457*math.sin(th),z))
 sweep(pts,.012,.014,False,1,8)
 # Small inward curl on alternating ends, a simplified observed scroll form.
 for direction in [-1,1]:
  pts=[]
  for i in range(27):
   t=i/26;ang=direction*(math.pi*.1+math.pi*1.55*t);rad=.022*(1-.72*t);u=direction*.085+rad*math.cos(ang);zz=1.542+rad*math.sin(ang);th=center+u/.456;pts.append((.457*math.cos(th),.457*math.sin(th),zz))
  sweep(pts,.009,.012,False,1,7)
# Solid annular, gently convex seat with a real central circular opening.
lathe([(.149,1.606),(.446,1.606),(.470,1.625),(.478,1.638),(.474,1.650),(.445,1.659),(.380,1.657),(.290,1.659),(.205,1.656),(.155,1.652),(.146,1.638)],192,planar_uv=True)
# Single baked procedural colour map: reference glaze only, never a source-photo texture.
rng=np.random.default_rng(3752989);n=1024
x,y=np.meshgrid(np.arange(n)/n,np.arange(n)/n);field=np.zeros((n,n))
for k in range(1,8):
 for _ in range(3):
  ax,ay=rng.integers(1,6,size=2)*2**(k-1);phase=rng.random()*2*math.pi;field+=np.sin(2*math.pi*(ax*x+ay*y)+phase)/(k*k*5)
field+=rng.normal(0,.08,(n,n));specks=rng.random((n,n))<.016
base=np.array([.39,.414,.316]);rgb=np.clip(base[None,None,:]+field[:,:,None]*np.array([.14,.13,.105])[None,None,:]-specks[:,:,None]*.12,0,1)
rgba=np.concatenate([rgb,np.ones((n,n,1))],axis=2).astype(np.float32)
image=bpy.data.images.new('Reference olive celadon glaze · procedural approximation',width=n,height=n);image.pixels.foreach_set(rgba.ravel());image.file_format='PNG';texture=a.output.with_name('chair-reference-glaze.png');image.filepath_raw=str(texture);image.save()
materials=[]
for name,factor in [('Reference celadon glaze',1.0),('Raised reference ceramic details',1.035)]:
 mat=bpy.data.materials.new(name);mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.57;bs.inputs['Metallic'].default_value=0;tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color']);materials.append(mat)
mesh=bpy.data.meshes.new('Pierced stool photo-reference geometry');mesh.from_pydata(V,[],F);mesh.update();obj=bpy.data.objects.new('Celadon pierced stool · photo-reference reconstruction',mesh);bpy.context.collection.objects.link(obj);bpy.context.view_layer.objects.active=obj;obj.select_set(True)
for m in materials:mesh.materials.append(m)
for poly,idx in zip(mesh.polygons,MI):poly.material_index=idx;poly.use_smooth=True
uv=mesh.uv_layers.new(name='Reference glaze coordinates')
for poly in mesh.polygons:
 for li in poly.loop_indices:uv.data[li].uv=UV[mesh.loops[li].vertex_index]
obj['sourceKind']='MANUAL_PHOTO_REFERENCE_RECONSTRUCTION';obj['notMeasuredScan']=True;obj['surfaceColor']='Procedural reference olive glaze; not original scan or photo colour';obj['loopCountInferred']=a.loops
bpy.ops.export_scene.gltf(filepath=str(a.output.resolve()),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_materials='EXPORT',export_image_format='AUTO',export_extras=True,export_animations=False)
mesh.calc_loop_triangles();meta={'title':'청자 투각 의자','sourceKind':'manual-photo-reference-reconstruction','sourceReference':'User supplied front, back, left, right, top, bottom, underside oblique and later upper oblique screenshots in chat','sourceImagesAvailableAsFiles':False,'notMeasuredScan':True,'geometry':{'heightRelative':max(v[2] for v in V)-min(v[2] for v in V),'maximumDiameterRelative':2*max(math.hypot(v[0],v[1]) for v in V),'mainOvalLoopCount':a.loops,'mainRibbonWidthRelative':.095,'mainRibbonRadialThicknessRelative':.050,'mainRibbonAngularHalfWidthRadians':.43,'mainRibbonVerticalHalfHeightRelative':.412,'ribbonCrossSectionExponent':.9,'loopCountIsInferred':True,'mainBodyHollow':True,'topCentralHoleDiameterRatio':.31,'bottomFootOpeningDiameterRatio':.71,'openingsAreGeometry':True,'vertices':len(mesh.vertices),'triangles':len(mesh.loop_triangles)},'appearance':{'color':'reference procedural olive-grey glaze','notOriginalPhotoTexture':True,'seatUV':'Planar XY reference glaze mapping, avoiding artificial radial streaks','roughness':.57,'surfaceWeathering':'subtle procedural reference variation; no invented symbols'},'limitations':['Loop count, hidden weave and fine scroll/petal details are inferred from screenshots.','No original scan, measured dimensions, surface texture or calibrated cameras were provided.','Top and foot opening geometry is reconstructed approximately from the supplied views.'],'output':{'file':a.output.name,'bytes':a.output.stat().st_size,'sha256':hashlib.sha256(a.output.read_bytes()).hexdigest()}}
a.output.with_suffix('.source.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
print('CHAIR_RESULT',json.dumps(meta,ensure_ascii=False))
if a.preview_dir:
 a.preview_dir.mkdir(parents=True,exist_ok=True);scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO';scene.display.shading.color_type='TEXTURE';scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True;scene.render.resolution_x=700;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.world.color=(.35,.35,.35);scene.render.film_transparent=True;scene.view_settings.view_transform='Standard';scene.view_settings.look='Medium High Contrast';scene.view_settings.exposure=-.3
 def area(name,loc,power,size):
  data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;light=bpy.data.objects.new(name,data);scene.collection.objects.link(light);light.location=loc;light.rotation_euler=(Vector((0,0,.85))-light.location).to_track_quat('-Z','Y').to_euler()
 area('Soft key',(3,-4,5),350,5);area('Soft fill',(-4,-1,3),200,4);area('Top',(0,3,4),180,4)
 camera_data=bpy.data.cameras.new('Reference inspection camera');camera=bpy.data.objects.new('Reference inspection camera',camera_data);scene.collection.objects.link(camera);scene.camera=camera;camera_data.type='ORTHO';camera_data.ortho_scale=2.05
 target=Vector((0,0,.84));poses={'front':(0,-4,1.4),'back':(0,4,1.4),'left':(-4,0,1.4),'right':(4,0,1.4),'top':(0,-.001,5),'bottom':(0,-.001,-5),'underside-oblique':(1,-3,-1),'top-oblique':(1,-3,3.7)}
 for name,loc in poses.items():
  if a.preview_views and name not in a.preview_views.split(','):continue
  camera.location=loc;camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str((a.preview_dir/(name+'.png')).resolve());bpy.ops.render.render(write_still=True)
