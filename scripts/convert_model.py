"""Convert the user-provided, colored PLY scan to a compact self-contained GLB.
Run: blender -b --python scripts/convert_model.py -- /path/to/ply-directory
Original source files stay outside the repository.
"""
import bpy,sys,os,json
from mathutils import Vector
source=sys.argv[sys.argv.index('--')+1]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
objects=[]
for name in sorted(os.listdir(source)):
 if not name.endswith('.ply'):continue
 bpy.ops.wm.ply_import(filepath=os.path.join(source,name))
 obj=bpy.context.object;objects.append(obj)
 print('SCAN',name,'vertices',len(obj.data.vertices),'bounds',tuple(obj.dimensions),'location',tuple(obj.location))
 print('COLORS',[(c.name,c.domain) for c in obj.data.color_attributes])
 material=bpy.data.materials.new('Original PLY vertex colors');material.use_nodes=True
 bsdf=material.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Roughness'].default_value=.57;bsdf.inputs['Metallic'].default_value=0
 if obj.data.color_attributes:
  attr=material.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name=obj.data.color_attributes[0].name
  material.node_tree.links.new(attr.outputs['Color'],bsdf.inputs['Base Color'])
 obj.data.materials.clear();obj.data.materials.append(material)
 for poly in obj.data.polygons:poly.use_smooth=True
 mod=obj.modifiers.new('Web optimization','DECIMATE');mod.ratio=.28
 bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
# PLY coordinates are shared by the two parts; keep their relative positions.
points=[obj.matrix_world@Vector(v) for obj in objects for v in obj.bound_box]
lo=Vector(tuple(min(v[i] for v in points) for i in range(3)));hi=Vector(tuple(max(v[i] for v in points) for i in range(3)))
print('COMBINED BOUNDS',tuple(lo),tuple(hi))
center=(lo+hi)*.5;scale=2.2/max(hi-lo)
for obj in objects:
 obj.location-=center;obj.location*=scale;obj.scale*=scale
bpy.ops.export_scene.gltf(filepath=os.path.abspath('public/models/celadon-incense.glb'),export_format='GLB',export_yup=True,export_apply=True,export_materials='EXPORT')
print('EXPORTED',os.path.getsize('public/models/celadon-incense.glb'))
