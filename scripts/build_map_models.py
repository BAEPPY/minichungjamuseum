"""Create small map-only derivatives; detail-view source GLBs are never modified.
Run: blender --background --python scripts/build_map_models.py -- [repo-root]
"""
import bpy, hashlib, json, pathlib, struct, sys
root = pathlib.Path(sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else '.').resolve()
output = root / 'public/models/map'
output.mkdir(parents=True, exist_ok=True)
models = {
 'celadon-incense.glb': 24000,
 'celadon-ewer.glb': 26000,
 'celadon-maebyeong-v2.glb': 14000,
 'japan-peony-reconstruction.glb': 14000,
 'celadon-stool-wrl.glb': 32000,
 'yuan-celadon-vase.glb': 16000,
 'celadon-pillow-reconstruction.glb': 18000,
}
records=[]
def describe(path):
 data=path.read_bytes();length=struct.unpack_from('<I',data,12)[0];g=json.loads(data[20:20+length]);accessors=g['accessors']
 return {'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'triangles':sum(accessors[p['indices']]['count']//3 for mesh in g.get('meshes',[]) for p in mesh['primitives'] if 'indices' in p),'extensions':g.get('extensionsUsed',[])}
for filename, target in models.items():
 bpy.ops.wm.read_factory_settings(use_empty=True)
 source=root/'public/models'/filename
 bpy.ops.import_scene.gltf(filepath=str(source))
 meshes=[obj for obj in bpy.context.scene.objects if obj.type=='MESH']
 triangles=sum(sum(len(face.vertices)-2 for face in obj.data.polygons) for obj in meshes)
 ratio=min(1,target/triangles)
 for obj in meshes:
  bpy.context.view_layer.objects.active=obj
  if ratio < 1:
   modifier=obj.modifiers.new('Map-only reduced mesh','DECIMATE');modifier.ratio=ratio;modifier.use_collapse_triangulate=True
   bpy.ops.object.modifier_apply(modifier=modifier.name)
 for image in bpy.data.images:
  if image.size[0] and image.size[1] and max(image.size)>512:
   scale=512/max(image.size);image.scale(max(1,round(image.size[0]*scale)),max(1,round(image.size[1]*scale)))
 target_path=output/filename
 bpy.ops.export_scene.gltf(filepath=str(target_path),export_format='GLB',export_image_format='JPEG',export_jpeg_quality=85,export_cameras=False,export_lights=False,export_animations=False,export_extras=True)
 record={'source':f'/models/{filename}','map':f'/models/map/{filename}','original':describe(source),'optimized':describe(target_path),'maximumTextureDimension':512}
 records.append(record)
 print('MAP_MODEL_RESULT '+json.dumps(record),flush=True)
(output/'manifest.json').write_text(json.dumps({'purpose':'Small derived meshes for in-map display only. Detailed observations use unchanged original models.','method':'Blender decimation with retained materials/vertex colors/UVs and textures resized to at most 512px, JPEG quality85. No new decoration or color tint.','models':records},ensure_ascii=False,indent=2)+'\n')
