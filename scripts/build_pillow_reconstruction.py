"""Photo-derived mesh visualization with recovered camera projection.
This is a sparse-photo reconstruction, with explicit hole/interior corrections.
Never label it as a measured scan or fully observed geometry.
"""
from pathlib import Path
import bpy,bmesh,json,math,sys,time,argparse,hashlib
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--reconstruction',type=Path,required=True,help='Directory with recovered cameras, PCA, trim metadata and precise masks')
parser.add_argument('--photos',type=Path,required=True,help='Directory with original A01..F09 JPEG photographs')
parser.add_argument('--mesh',type=Path,required=True,help='World-coordinate trimmed sparse-Poisson mesh')
parser.add_argument('--output',type=Path,required=True,help='Destination self-contained GLB')
parser.add_argument('--preview-directory',type=Path)
parser.add_argument('--texture-size',type=int,default=4096)
parser.add_argument('--jpeg-quality',type=int,default=92)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
SFM=args.reconstruction.resolve();PHOTOS=args.photos.resolve();mesh_path=args.mesh.resolve()
ROOT=args.output.resolve().parent;ROOT.mkdir(parents=True,exist_ok=True);label=args.output.stem
if args.texture_size<256 or not 1<=args.jpeg_quality<=100:raise ValueError('Invalid atlas dimensions or quality')
def file_hash(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
originals=json.loads((PHOTOS/'source-provenance.json').read_text())
if any(file_hash(PHOTOS/frame['name'])!=frame['sha256'] for frame in originals['frames']):raise ValueError('Original photographic data changed')

data=json.loads((SFM/'recovered-cameras.json').read_text())
images=sorted(data['images'],key=lambda x:x['name'])
cams=[]
for image in images:
 camera=data['cameras'][str(image['camera_id'])]
 matrix=np.array(image['camera_from_world']);center=np.array(image['projection_center'])
 cams.append(dict(name=image['name'],matrix=matrix,center=center,K=np.array(camera['K']),width=camera['width'],height=camera['height']))
centers={c['name']:c['center'] for c in cams}
up=np.mean([c['center'] for c in cams if c['name'].startswith('A')],axis=0)-np.mean([c['center'] for c in cams if c['name'].startswith('E')],axis=0)
up/=np.linalg.norm(up)
pca=json.loads((SFM/'pointcloud-pca.json').read_text())
long=np.array(pca['worldToPCA_rowVectorBasis'])[:,0]
long-=up*np.dot(long,up);long/=np.linalg.norm(long)
if np.dot(long,centers['E03.jpg']-np.array(pca['center']))<0:long=-long
side=np.cross(up,long);side/=np.linalg.norm(side)
basis=np.column_stack([long,side,up])

bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.wm.ply_import(filepath=str(mesh_path));obj=bpy.context.object;obj.name='Pillow · camera-calibrated photo reconstruction'
obj.data.materials.clear()
unknown=bpy.data.materials.new('Unobserved or corrected region · neutral');unknown.use_nodes=True
shader=unknown.node_tree.nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=(.28,.36,.32,1);shader.inputs['Roughness'].default_value=.85
photo_masks={}
mask_dir=SFM/'precise-masks'
for c in cams:
 path=mask_dir/(c['name']+'.npz')
 if path.exists():
  record=np.load(path)
  mask=record['valid_eroded3'] if 'valid_eroded3' in record else record['mask']
  if 'nearest_valid_xy' in record:
   xy=record['nearest_valid_xy'];nx,ny=xy[...,0],xy[...,1]
  else:nx,ny=record['nearest_x'],record['nearest_y']
  photo_masks[c['name']]={'mask':mask,'x':nx,'y':ny}
uv_corrections=[]
def clamp_source_pixel(name,pixel):
 if name not in photo_masks:return pixel
 m=photo_masks[name];x=int(np.clip(round(pixel[0]),0,m['mask'].shape[1]-1));y=int(np.clip(round(pixel[1]),0,m['mask'].shape[0]-1))
 if m['mask'][y,x]:return pixel
 corrected=np.array([m['x'][y,x],m['y'][y,x]],dtype=float);uv_corrections.append(float(np.linalg.norm(corrected-pixel)));return corrected
scores=[]
# Refine only the previously inferred cap before bending it; this prevents
# long fan triangles from introducing visible creases on the neutral closure.
trim_record=json.loads((SFM/'trim-metadata.json').read_text())
trim_h=trim_record['trimHeight']
bm=bmesh.new();bm.from_mesh(obj.data)
cap_faces=[f for f in bm.faces if all(abs(np.dot(np.array(v.co),up)-trim_h)<1e-5 for v in f.verts)]
cap_edges=list({e for f in cap_faces for e in f.edges})
if cap_edges:bmesh.ops.subdivide_edges(bm,edges=cap_edges,cuts=4,use_grid_fill=True)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free();obj.data.update()

# Cut the two photographically observed end holes along the fitted long axis.
# The bore is a display correction; the unobserved interior remains approximate.
source_verts=[tuple(v.co) for v in obj.data.vertices]
source_faces=[tuple(p.vertices) for p in obj.data.polygons]
bvh=BVHTree.FromPolygons(source_verts,source_faces)
# Manual silhouette picks on the original E01 photo guide only the previously
# unobserved lower closure. This is a documented correction, not measured data.
front=next(c for c in cams if c['name']=='E01.jpg')
bottom_picks=[(320,872),(400,865),(500,850),(600,840),(700,832),(800,829),(900,834),(1000,846),(1100,862),(1220,874)]
bottom_hits=[]
for px,py in bottom_picks:
 ray_cam=np.linalg.inv(front['K'])@np.array([px,py-3,1]);direction=front['matrix'][:,:3].T@ray_cam;direction/=np.linalg.norm(direction)
 hit,n,fi,d=bvh.ray_cast(Vector(front['center']),Vector(direction))
 if hit is not None:bottom_hits.append(np.array(hit))
if len(bottom_hits)<5:raise ValueError('Insufficient lower-silhouette evidence')
bottom_hits=np.array(bottom_hits);curve=np.polyfit(bottom_hits@long,bottom_hits@up,2)
if curve[0]>=0:raise ValueError('Lower silhouette fit unexpectedly lacks concavity')
for v in obj.data.vertices:
 point=np.array(v.co);height=np.dot(point,up);target=np.polyval(curve,np.dot(point,long))-.0015
 if height<target:v.co=point+up*(target-height)
obj.data.update()
source_verts=[tuple(v.co) for v in obj.data.vertices];source_faces=[tuple(p.vertices) for p in obj.data.polygons]
bvh=BVHTree.FromPolygons(source_verts,source_faces)
print('LOWER_SILHOUETTE_CORRECTION',curve.tolist(),len(bottom_hits),flush=True)
hole_hits=[]
for name,pixel,radius in [('E03.jpg',(816,690),60),('E08.jpg',(694,687),56)]:
 c=next(x for x in cams if x['name']==name);ray_cam=np.linalg.inv(c['K'])@np.array([*pixel,1])
 direction=c['matrix'][:,:3].T@ray_cam;direction/=np.linalg.norm(direction)
 hit,normal,face,distance=bvh.ray_cast(Vector(c['center']),Vector(direction))
 if hit is None:raise ValueError('Could not locate photographed hole plane: '+name)
 world_radius=radius*distance/c['K'][0,0]
 hole_hits.append((np.array(hit),world_radius))
hole_axis=hole_hits[1][0]-hole_hits[0][0];hole_length=np.linalg.norm(hole_axis);hole_axis/=hole_length
hole_radius=sum(r for p,r in hole_hits)/2
hole_center=(hole_hits[0][0]+hole_hits[1][0])/2
bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=hole_radius,depth=hole_length*1.3,location=hole_center)
cutter=bpy.context.object;cutter.name='Observed circular end holes · approximate internal bore'
cutter.rotation_euler=Vector(hole_axis).to_track_quat('Z','Y').to_euler()
cutter.data.materials.append(unknown)
bpy.context.view_layer.objects.active=obj;obj.select_set(True);cutter.select_set(False)
mod=obj.modifiers.new('Preserve photographically observed end openings','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)

mesh=obj.data;mesh.calc_loop_triangles()
verts=np.array([v.co[:] for v in mesh.vertices]);centroids=np.array([p.center[:] for p in mesh.polygons]);normals=np.array([p.normal[:] for p in mesh.polygons])
bvh=BVHTree.FromPolygons([tuple(v) for v in verts],[tuple(p.vertices) for p in mesh.polygons])
length=np.max(verts@long)-np.min(verts@long)
scores=[]
for c in cams:
 vector=c['center'][None,:]-centroids;distance=np.linalg.norm(vector,axis=1);cos=np.sum(vector*normals,axis=1)/distance
 camera=centroids@c['matrix'][:,:3].T+c['matrix'][:,3]
 pixel=camera@c['K'].T;pixel=pixel[:,:2]/pixel[:,2,None]
 valid=(cos>.15)&(camera[:,2]>0)&(pixel[:,0]>5)&(pixel[:,0]<c['width']-5)&(pixel[:,1]>5)&(pixel[:,1]<c['height']-5)
 scores.append(np.where(valid,cos**4/distance**2,-1))
scores=np.array(scores).T;ranked=np.argsort(scores,axis=1)[:,::-1]
assignment=np.full(len(mesh.polygons),-1,dtype=int)
axis_delta=centroids-hole_center
radial=axis_delta-hole_axis*np.sum(axis_delta*hole_axis,axis=1)[:,None]
interior=(np.linalg.norm(radial,axis=1)<hole_radius*1.07)&(np.abs(normals@hole_axis)<.6)
trim_meta=json.loads((SFM/'trim-metadata.json').read_text()) if (SFM/'trim-metadata.json').exists() else {}
trim_height=trim_meta.get('trim_height',trim_meta.get('trimHeight',None))
for i,poly in enumerate(mesh.polygons):
 if interior[i] or (np.dot(normals[i],up)<-.4 and np.dot(centroids[i],up)<np.polyval(curve,np.dot(centroids[i],long))+length*.004):continue
 for k in ranked[i,:5]:
  if scores[i,k]<0:break
  camera=cams[k]['center'];direction=centroids[i]-camera;distance=np.linalg.norm(direction);direction/=distance
  hit,n,fi,hit_distance=bvh.ray_cast(Vector(camera),Vector(direction),distance+length*.005)
  if fi is not None and hit_distance>=distance-length*.003:
   assignment[i]=k;break

materials=[]
photo_uv=mesh.uv_layers.new(name='Recovered camera projections')
for k,c in enumerate(cams):
 mat=bpy.data.materials.new('Recovered camera photo · '+c['name']);mat.use_nodes=True;mat.node_tree.nodes.clear()
 output=mat.node_tree.nodes.new('ShaderNodeOutputMaterial');emit=mat.node_tree.nodes.new('ShaderNodeEmission')
 texture=mat.node_tree.nodes.new('ShaderNodeTexImage');texture.image=bpy.data.images.load(str(PHOTOS/c['name']),check_existing=False);texture.image.colorspace_settings.name='sRGB'
 uvnode=mat.node_tree.nodes.new('ShaderNodeUVMap');uvnode.uv_map=photo_uv.name
 mat.node_tree.links.new(uvnode.outputs['UV'],texture.inputs['Vector']);mat.node_tree.links.new(texture.outputs['Color'],emit.inputs['Color']);mat.node_tree.links.new(emit.outputs[0],output.inputs['Surface'])
 materials.append(mat)
unknown_bake=bpy.data.materials.new('Unobserved region bake · neutral');unknown_bake.use_nodes=True;unknown_bake.node_tree.nodes.clear()
output=unknown_bake.node_tree.nodes.new('ShaderNodeOutputMaterial');emit=unknown_bake.node_tree.nodes.new('ShaderNodeEmission');emit.inputs['Color'].default_value=(.28,.36,.32,1);unknown_bake.node_tree.links.new(emit.outputs[0],output.inputs['Surface']);materials.append(unknown_bake)
mesh.materials.clear()
for mat in materials:mesh.materials.append(mat)
counts={}
for i,p in enumerate(mesh.polygons):
 k=assignment[i];p.material_index=k if k>=0 else len(cams);p.use_smooth=True
 if k<0:continue
 c=cams[k];counts[c['name']]=counts.get(c['name'],0)+1
 for li in p.loop_indices:
  v=verts[mesh.loops[li].vertex_index];camera=c['matrix'][:,:3]@v+c['matrix'][:,3];pixel=c['K']@camera;pixel=pixel[:2]/pixel[2];original_pixel=pixel.copy();pixel=clamp_source_pixel(c['name'],pixel)
  if np.linalg.norm(pixel-original_pixel)>20:p.material_index=len(cams);assignment[i]=-1
  photo_uv.data[li].uv=(pixel[0]/c['width'],1-pixel[1]/c['height'])

bpy.context.view_layer.objects.active=obj;obj.select_set(True)
atlas=mesh.uv_layers.new(name='Baked observed photo atlas');mesh.uv_layers.active=atlas;atlas.active_render=True
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=math.radians(72),island_margin=.006);bpy.ops.object.mode_set(mode='OBJECT')
target=bpy.data.images.new('Camera-calibrated photo atlas',width=args.texture_size,height=args.texture_size,alpha=False)
for mat in materials:
 node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=target;node.select=True;mat.node_tree.nodes.active=node
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=1;scene.cycles.use_denoising=False
scene.render.bake.use_clear=True;scene.render.bake.margin=12
bpy.ops.object.bake(type='EMIT',margin=12)
atlas_path=ROOT/(label+'-atlas.jpg');target.file_format='JPEG';target.save(filepath=str(atlas_path),quality=args.jpeg_quality)
baked=bpy.data.images.load(str(atlas_path),check_existing=False)
final=bpy.data.materials.new('Actual recovered-camera photographs · reconstructed geometry');final.use_nodes=True
shader=final.node_tree.nodes.get('Principled BSDF');shader.inputs['Roughness'].default_value=.72;shader.inputs['Metallic'].default_value=0
tex=final.node_tree.nodes.new('ShaderNodeTexImage');tex.image=baked
uvnode=final.node_tree.nodes.new('ShaderNodeUVMap');uvnode.uv_map=atlas.name
final.node_tree.links.new(uvnode.outputs['UV'],tex.inputs['Vector']);final.node_tree.links.new(tex.outputs['Color'],shader.inputs['Base Color'])
mesh.materials.clear();mesh.materials.append(final)
for p in mesh.polygons:p.material_index=0

# Align a copy for the site's Y-up glTF; all source projection used world poses.
aligned=verts@basis;minimum=aligned.min(axis=0);maximum=aligned.max(axis=0);center=(minimum+maximum)/2;scale=2.2/max(maximum-minimum)
for v,q in zip(mesh.vertices,(aligned-center)*scale):v.co=q
mesh.update()
obj['sourceKind']='PHOTO_BASED_RECONSTRUCTION_WITH_SFM_CAMERA_POSES_AND_GEOMETRY_CORRECTIONS'
obj['notMeasuredScan']=True;obj['notDensePhotogrammetry']=True
obj['corrections']='End holes reconstructed from observed photo-center rays; unobserved bore/interior neutral and approximate.'
bpy.ops.export_scene.gltf(filepath=str(ROOT/(label+'.glb')),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_materials='EXPORT',export_image_format='JPEG',export_jpeg_quality=args.jpeg_quality,export_extras=True,export_animations=False)
metrics={'inputMesh':str(mesh_path),'source':'45 original photos with COLMAP recovered camera poses','notMeasuredScan':True,'notDensePhotogrammetry':True,'vertices':len(mesh.vertices),'triangles':sum(len(p.vertices)-2 for p in mesh.polygons),'photoAssignedFaces':int(np.sum(assignment>=0)),'neutralFaces':int(np.sum(assignment<0)),'candidateCameraFaceCountsBeforeBoundaryValidation':counts,'backgroundProjectionCorrection':{'method':'Clamp texture UV samples outside precise original-photo foreground masks to nearest eroded ceramic pixel; original JPEGs unchanged','maskPhotos':list(photo_masks),'maximumAcceptedUVShiftPixels':20,'correctedLoopSamples':len(uv_corrections),'maxRequestedShiftPixels':max(uv_corrections,default=0)},'lowerClosureCorrection':{'capSubdivisionCuts':4,'analyticNormalsAppliedInFinishStep':True,'originalPhoto':'E01.jpg','manuallyAnnotatedPixels':bottom_picks,'fitPolynomial':curve.tolist(),'worldCoordinatesRetained':True,'approximateRegion':True},'endHoleCorrection':{'centerWorld':hole_center.tolist(),'axisWorld':hole_axis.tolist(),'radiusWorld':float(hole_radius),'approximateInterior':True},'worldToDisplayBasis':basis.tolist(),'sourceBoundsAligned':{'min':minimum.tolist(),'max':maximum.tolist()},'normalizationScale':float(scale),'limitations':['Sparse-feature Poisson reconstruction; some surface and silhouette deviations remain.','Unobserved bottom and internal bore are approximate neutral regions.','Camera-projected photographs retain photographic lighting and may show seams.']}
(ROOT/(label+'-metrics.json')).write_text(json.dumps(metrics,ensure_ascii=False,indent=2)+'\n')
provenance=json.loads((SFM/'reconstruction-provenance.json').read_text())
provenance.pop('remainingWork',None)
provenance.update({'title':'청자 상감 모란·구름·학무늬 베개','displayLabel':'사진 기반 3D 복원 · 밑면 등 일부 형상 추정·보정 (실측 스캔 아님)','displayModel':metrics,'textureAtlas':{'dimensions':[args.texture_size,args.texture_size],'format':'JPEG','quality':args.jpeg_quality,'baking':'Original photographs projected by recovered camera poses; boundary UV samples limited to observed ceramic pixels'},'reproductionInputs':[{'file':str(path.relative_to(SFM)) if path.is_relative_to(SFM) else path.name,'sha256':file_hash(path)} for path in [mesh_path,SFM/'recovered-cameras.json',SFM/'pointcloud-pca.json',SFM/'trim-metadata.json',*sorted((SFM/'precise-masks').glob('*.npz'))]],'output':{'file':label+'.glb','bytes':(ROOT/(label+'.glb')).stat().st_size,'sha256':file_hash(ROOT/(label+'.glb'))}})
(ROOT/(label+'-source.json')).write_text(json.dumps(provenance,ensure_ascii=False,indent=2)+'\n')

if args.preview_directory:
 args.preview_directory.mkdir(parents=True,exist_ok=True)
 scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO';scene.display.shading.color_type='TEXTURE';scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=False;scene.render.film_transparent=True
 scene.render.resolution_x=1200;scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
 cam_data=bpy.data.cameras.new('Quality inspection camera');cam=bpy.data.objects.new('Quality inspection camera',cam_data);scene.collection.objects.link(cam);scene.camera=cam;cam_data.type='ORTHO';cam_data.ortho_scale=3.2
 for name,pos in [('three-quarter',(3.5,-5,3.3)),('end',(6,0,0)),('opposite',(-3.8,5,2.9)),('under',(3,-5,-3))]:
  cam.location=pos;cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(args.preview_directory/(label+'-'+name+'.png'));bpy.ops.render.render(write_still=True)
print('TEXTURED_SFM_EXPORT',json.dumps(metrics))
