"""Apply only analytic shading normals to the explicitly inferred bottom cap."""
from pathlib import Path
import bpy,bmesh,numpy as np,json,argparse,sys,hashlib
from mathutils import Vector
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--input',type=Path,required=True)
parser.add_argument('--metrics',type=Path,required=True)
parser.add_argument('--trim-metadata',type=Path,required=True)
parser.add_argument('--output',type=Path,required=True)
parser.add_argument('--under-photo',type=Path,help='Original, unregistered F01 photograph, optional')
parser.add_argument('--preview-directory',type=Path)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
args.output.parent.mkdir(parents=True,exist_ok=True)
metrics=json.loads(args.metrics.read_text())
basis=np.array(metrics['worldToDisplayBasis']);scale=metrics['normalizationScale']
center=(np.array(metrics['sourceBoundsAligned']['min'])+np.array(metrics['sourceBoundsAligned']['max']))/2
curve=np.array(metrics['lowerClosureCorrection']['fitPolynomial']);up=basis[:,2];long=basis[:,0]
trim=json.loads(args.trim_metadata.read_text())['trimHeight']
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(args.input))
obj=next(obj for obj in bpy.context.scene.objects if obj.type=='MESH')
bpy.context.view_layer.objects.active=obj;obj.select_set(True);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
mesh=obj.data;mesh.update()
bm=bmesh.new();bm.from_mesh(mesh);degenerate=[f for f in bm.faces if f.calc_area()<1e-10];removed=len(degenerate)
if degenerate:bmesh.ops.delete(bm,geom=degenerate,context='FACES_ONLY')
bm.to_mesh(mesh);bm.free();mesh.update()
capmat=bpy.data.materials.new('Inferred bottom · plain neutral ceramic');capmat.use_nodes=True;capmat.diffuse_color=(.28,.36,.32,1);capmat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.28,.36,.32,1);capmat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.85;mesh.materials.append(capmat)
values=[(0,0,0)]*len(mesh.loops);count=0
for poly in mesh.polygons:
 display=np.array(poly.center);world=(display/scale+center)@basis.T
 x=np.dot(world,long);height=np.dot(world,up);target=np.polyval(curve,x)-.0015
 all_on_cap=True
 for vi in poly.vertices:
  pp=(np.array(mesh.vertices[vi].co)/scale+center)@basis.T;xx=np.dot(pp,long);hh=np.dot(pp,up)
  if hh>max(np.polyval(curve,xx)-.0015,trim)+.0005:all_on_cap=False;break
 if poly.normal.z<-.65 and (all_on_cap or height<max(target,trim)+.002):
  count+=1;poly.material_index=len(mesh.materials)-1
  for li in poly.loop_indices:
   point=np.array(mesh.vertices[mesh.loops[li].vertex_index].co);source=(point/scale+center)@basis.T
   xp=np.dot(source,long);slope=2*curve[0]*xp+curve[1] if np.polyval(curve,xp)-.0015>trim else 0
   normal=(slope*long-up)@basis;normal/=np.linalg.norm(normal);values[li]=tuple(normal)
mesh.normals_split_custom_set(values)
obj['inferredBottomShading']='Analytic normals on approximate lower closure; no source photograph or surface ornament changed'
if args.under_photo:
 uv=mesh.uv_layers.new(name='F01 original underside · approximate silhouette fit')
 mat=mesh.materials[-1];mat.name='Original F01 photo · inferred underside geometry';mat.node_tree.nodes.clear()
 out=mat.node_tree.nodes.new('ShaderNodeOutputMaterial');shader=mat.node_tree.nodes.new('ShaderNodeBsdfPrincipled');shader.inputs['Roughness'].default_value=.8
 texture=mat.node_tree.nodes.new('ShaderNodeTexImage');texture.image=bpy.data.images.load(str(args.under_photo));texture.image.colorspace_settings.name='sRGB';texture.extension='EXTEND'
 uvnode=mat.node_tree.nodes.new('ShaderNodeUVMap');uvnode.uv_map=uv.name
 mat.node_tree.links.new(uvnode.outputs['UV'],texture.inputs['Vector']);mat.node_tree.links.new(texture.outputs['Color'],shader.inputs['Base Color']);mat.node_tree.links.new(shader.outputs['BSDF'],out.inputs['Surface'])
 L=max(v.co.x for v in mesh.vertices)-min(v.co.x for v in mesh.vertices);W=max(v.co.y for v in mesh.vertices)-min(v.co.y for v in mesh.vertices)
 xc=(max(v.co.x for v in mesh.vertices)+min(v.co.x for v in mesh.vertices))/2;yc=(max(v.co.y for v in mesh.vertices)+min(v.co.y for v in mesh.vertices))/2
 for poly in mesh.polygons:
  if poly.material_index!=len(mesh.materials)-1:continue
  for li in poly.loop_indices:
   x,y,z=mesh.vertices[mesh.loops[li].vertex_index].co;t=max(-1,min(1,(x-xc)/(L/2)));profile=.78+.22*t*t;v=max(0,min(1,(y-yc)/(W*profile)+.5))
   px=770+460*t;top=355+60*(1-t*t);bottom=824-64*(1-t*t);py=bottom+(top-bottom)*v;uv.data[li].uv=(px/1535,1-py/1183)
 obj['undersideSource']='Original F01.jpg from the same user-provided SWF; no reference-video texture'
 obj['undersideProjection']='F row not SfM-registered; manually fitted silhouette UV on inferred geometry'
bpy.ops.export_scene.gltf(filepath=str(args.output),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_materials='EXPORT',export_image_format='AUTO',export_extras=True,export_animations=False)
report={'removedDegenerateFaces':removed,'analyticCapFaces':count,'geometryUnchangedExceptTinyFaceCleanup':True,'underPhoto':({'file':args.under_photo.name,'sha256':hashlib.sha256(args.under_photo.read_bytes()).hexdigest(),'registration':'NOT SfM registered; manual approximate silhouette projection','pixelU':'770+460*t','pixelTop':'355+60*(1-t*t)','pixelBottom':'824-64*(1-t*t)','normalizedWidthProfile':'.78+.22*t*t'} if args.under_photo else None),'output':{'file':args.output.name,'bytes':args.output.stat().st_size,'sha256':hashlib.sha256(args.output.read_bytes()).hexdigest()}}
args.output.with_suffix('.finish.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
if len(mesh.uv_layers)>1:mesh.uv_layers.active=mesh.uv_layers[-1];mesh.uv_layers[-1].active_render=True
for mat in mesh.materials:
 for node in mat.node_tree.nodes:
  if node.type=='TEX_IMAGE':mat.node_tree.nodes.active=node;break
if args.preview_directory and not args.under_photo:
 args.preview_directory.mkdir(parents=True,exist_ok=True)
 scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO';scene.display.shading.color_type='TEXTURE';scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=False;scene.render.film_transparent=True
 scene.render.resolution_x=1200;scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
 cam_data=bpy.data.cameras.new('Quality inspection camera');cam=bpy.data.objects.new('Quality inspection camera',cam_data);scene.collection.objects.link(cam);scene.camera=cam;cam_data.type='ORTHO';cam_data.ortho_scale=3.2
 for name,pos in [('under',(3,-5,-3))]:
  cam.location=pos;cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(args.preview_directory/(args.output.stem+'-'+name+'.png'));bpy.ops.render.render(write_still=True)
print('ANALYTIC_CAP_NORMALS',count,'REMOVED_DEGENERATE_FACES',removed)
