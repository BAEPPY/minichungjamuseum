"""Convert the supplied gae000002 OBJ scan and its real textures for the web.

Run with Blender 4.3+:
  blender -b --python scripts/convert_ewer.py -- /path/to/extracted-obj-files

The input directory must contain both matching OBJ/MTL/JPEG sets. Original
files remain untouched. The material files' misspelled texture references are
repaired by explicitly connecting each part's supplied JPEG to its own UVs.
"""
import argparse
import hashlib
import json
import sys
import tempfile
from pathlib import Path

import bpy
from mathutils import Vector


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('source', type=Path)
parser.add_argument('--output', type=Path, default=Path('public/models/celadon-ewer.glb'))
parser.add_argument('--texture-size', type=int, default=4096)
parser.add_argument('--jpeg-quality', type=int, default=90)
parser.add_argument('--preview', type=Path)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
source = args.source.resolve()
output = args.output.resolve()
if args.texture_size < 1 or not 1 <= args.jpeg_quality <= 100:
    raise ValueError('Invalid texture size or JPEG quality')
stems = ['gae000002-001-30000', 'gae000002-002-30000']
files = [source / (stem + extension) for stem in stems for extension in ('.obj', '.mtl', '.jpg')]
if not all(path.is_file() for path in files):
    raise FileNotFoundError('Both original OBJ/MTL/JPEG sets are required')

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
parts = []
objects = []
temporary = tempfile.TemporaryDirectory(prefix='celadon-ewer-textures-')
for stem in stems:
    before = set(bpy.data.objects)
    # The source OBJ is Y-up; Blender's importer converts it to Z-up. Export
    # converts it back to glTF Y-up, keeping the assembled scan upright.
    bpy.ops.wm.obj_import(filepath=str(source / (stem + '.obj')),
                          forward_axis='NEGATIVE_Z', up_axis='Y',
                          use_split_objects=False, use_split_groups=False)
    imported = [obj for obj in set(bpy.data.objects) - before if obj.type == 'MESH']
    if len(imported) != 1:
        raise ValueError(f'Expected one mesh for {stem}, got {len(imported)}')
    obj = imported[0]
    obj.name = stem
    objects.append(obj)
    obj.data.calc_loop_triangles()
    if not obj.data.uv_layers:
        raise ValueError(f'The source scan has no UV coordinates: {stem}')

    image = bpy.data.images.load(str(source / (stem + '.jpg')), check_existing=False)
    original_size = list(image.size)
    # Set color space before resampling: changing it afterward makes Blender
    # reload the original file and discards the resized pixel buffer.
    image.colorspace_settings.name = 'sRGB'
    image.file_format = 'JPEG'
    if max(image.size) > args.texture_size:
        ratio = args.texture_size / max(image.size)
        image.scale(round(image.size[0] * ratio), round(image.size[1] * ratio))
    processed_path = Path(temporary.name) / (stem + '.jpg')
    image.save(filepath=str(processed_path), quality=args.jpeg_quality)
    # Load the processed file explicitly so the glTF exporter cannot reuse the
    # original 8K JPEG bytes via the original image's unchanged source path.
    image = bpy.data.images.load(str(processed_path), check_existing=False)

    material = bpy.data.materials.new(stem + ' · supplied scan color')
    material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Metallic'].default_value = 0
    shader.inputs['Roughness'].default_value = .57
    texture = material.node_tree.nodes.new('ShaderNodeTexImage')
    texture.image = image
    material.node_tree.links.new(texture.outputs['Color'], shader.inputs['Base Color'])
    obj.data.materials.clear()
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    parts.append({
        'name': stem,
        'vertices': len(obj.data.vertices),
        'polygons': len(obj.data.polygons),
        'triangles': len(obj.data.loop_triangles),
        'texture': {'file': stem + '.jpg', 'originalDimensions': original_size,
                    'exportDimensions': list(image.size), 'jpegQuality': args.jpeg_quality},
    })

# Translate and uniformly scale the complete assembly; never center parts
# separately or change the lid/body relationship. No faces are decimated.
bpy.context.view_layer.update()
points = [obj.matrix_world @ Vector(point) for obj in objects for point in obj.bound_box]
minimum = Vector([min(point[i] for point in points) for i in range(3)])
maximum = Vector([max(point[i] for point in points) for i in range(3)])
center = (minimum + maximum) * .5
scale = 2.2 / max(maximum - minimum)
for obj in objects:
    obj.location = (obj.location - center) * scale
    obj.scale *= scale
    obj.select_set(True)
bpy.context.view_layer.update()
output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB',
                          export_yup=True, export_apply=True, use_selection=True,
                          export_materials='EXPORT', export_image_format='JPEG',
                          export_jpeg_quality=args.jpeg_quality,
                          export_animations=False, export_cameras=False,
                          export_lights=False, export_extras=False,
                          export_draco_mesh_compression_enable=False)
manifest = {
    'artifactId': 'ewer',
    'title': '청자 어룡형 주전자',
    'collectionNumber': '개성 2',
    'source': 'User-uploaded gae000002-000-30000.zip; two supplied OBJ/MTL/JPEG scan parts',
    'referenceUrl': 'https://www.museum.go.kr/uploadfile/relic3D/gae000002/gae000002.html',
    'inputs': [{'file': path.name, 'bytes': path.stat().st_size, 'sha256': sha256(path)} for path in files],
    'parts': parts,
    'conversion': {
        'blenderVersion': bpy.app.version_string,
        'sourceUpAxis': 'Y',
        'exportUpAxis': 'Y',
        'originalAssemblyRetained': True,
        'decimation': False,
        'sourceBoundsBlenderZUp': {'min': list(minimum), 'max': list(maximum)},
        'normalization': {'translation': list(-center), 'uniformScale': scale, 'largestDimension': 2.2},
        'material': {'baseColor': 'Supplied JPEG scan textures, no reference tint',
                     'metallic': 0, 'roughness': .57,
                     'note': 'PBR roughness is a display setting; it is not a measured surface property.'},
        'repairs': ['MTL map_Kd paths omit leading g; explicitly connected the matching supplied JPEG for each part.'],
    },
    'output': {'file': output.name, 'bytes': output.stat().st_size, 'sha256': sha256(output)},
}
output.with_name('celadon-ewer-source.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print('EWER_EXPORT', json.dumps(manifest, ensure_ascii=False))

if args.preview:
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'TEXTURE'
    scene.display.shading.show_shadows = True
    scene.display.shading.show_cavity = True
    scene.display.shading.cavity_type = 'BOTH'
    scene.render.film_transparent = True
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 1200
    scene.render.resolution_percentage = 100
    camera_data = bpy.data.cameras.new('Diagnostic camera')
    camera = bpy.data.objects.new('Diagnostic camera', camera_data)
    scene.collection.objects.link(camera)
    camera.location = (4, -6, 3)
    camera.rotation_euler = (-camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = 2.9
    scene.camera = camera
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(args.preview.resolve())
    bpy.ops.render.render(write_still=True)
temporary.cleanup()
