"""Convert the supplied single-shape VRML2 stool to GLB, preserving its actual mesh/colors.
No procedural reconstruction, texture invention, decimation, or hole filling is performed.
"""
import argparse,hashlib,json,math,re,struct
from pathlib import Path
import numpy as np
p=argparse.ArgumentParser();p.add_argument('--wrl',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--color-encoding',choices=['original-numeric','srgb-to-linear'],default='original-numeric');p.add_argument('--color-component',choices=['u8','u16'],default='u8');p.add_argument('--keep-source-orientation',action='store_true');a=p.parse_args()
raw=a.wrl.read_bytes();text=raw.decode('utf-8');patterns={'position':r'coord\s+Coordinate\s*\{\s*point\s*\[([^\]]+)\]','color':r'color\s+Color\s*\{\s*color\s*\[([^\]]+)\]','index':r'coordIndex\s*\[([^\]]+)\]'}
def parse(key,dtype):
 match=re.search(patterns[key],text,re.S)
 if not match:raise ValueError('Missing '+key+' array')
 return np.fromstring(match.group(1).replace(',',' '),sep=' ',dtype=dtype)
position=parse('position','<f4').reshape(-1,3);source_colors=parse('color','<f4').reshape(-1,3);index=parse('index','<i4');ends=np.flatnonzero(index==-1);face_sizes=np.diff(np.r_[-1,ends])-1
assert len(ends) and len(index)==ends[-1]+1 and np.all(face_sizes==3),'This conversion requires the supplied triangular IndexedFaceSet'
assert len(source_colors)==len(position) and np.isfinite(position).all() and np.isfinite(source_colors).all()
assert source_colors.min()>=0 and source_colors.max()<=1
assert 'colorIndex' not in text and not re.search(r'colorPerVertex\s+FALSE',text),'Unexpected VRML color mapping'
triangles=index.reshape(-1,4)[:,:3].astype('<u4');assert triangles.max()<len(position)
source_bounds=[position.min(0).tolist(),position.max(0).tolist()]
if not a.keep_source_orientation:position=position*np.array([1,-1,-1],dtype=np.float32)
position=np.asarray(position,dtype='<f4');faces=position[triangles];face_normals=np.cross(faces[:,1]-faces[:,0],faces[:,2]-faces[:,0]);areas2=np.linalg.norm(face_normals,axis=1);normals=np.zeros_like(position)
for corner in range(3):np.add.at(normals,triangles[:,corner],face_normals)
length=np.linalg.norm(normals,axis=1);zero=np.flatnonzero(length<1e-15)
if len(zero):
 # Unused/degenerate-only vertices stay present; assign finite neutral normals explicitly.
 normals[zero]=np.array([0,1,0]);length[zero]=1
normals=np.asarray(normals/length[:,None],dtype='<f4')
colors=source_colors.astype(np.float64)
if a.color_encoding=='srgb-to-linear':colors=np.where(colors<=.04045,colors/12.92,((colors+.055)/1.055)**2.4)
maximum=255 if a.color_component=='u8' else 65535;color_type=5121 if a.color_component=='u8' else 5123;packed_colors=np.column_stack([np.rint(colors*maximum),np.full(len(colors),maximum)]).astype('u1' if a.color_component=='u8' else '<u2')
blobs=[];views=[];accessors=[];offset=0
def add_array(array,component_type,kind,target,normalized=False,bounds=False):
 global offset
 padding=(-offset)%4
 if padding:blobs.append(b'\0'*padding);offset+=padding
 data=np.ascontiguousarray(array).tobytes();view_index=len(views);views.append({'buffer':0,'byteOffset':offset,'byteLength':len(data),'target':target});blobs.append(data);offset+=len(data);acc={'bufferView':view_index,'componentType':component_type,'count':int(len(array)),'type':kind}
 if normalized:acc['normalized']=True
 if bounds:acc['min']=array.min(0).astype(float).tolist();acc['max']=array.max(0).astype(float).tolist()
 accessors.append(acc);return len(accessors)-1
pos_id=add_array(position,5126,'VEC3',34962,bounds=True);norm_id=add_array(normals,5126,'VEC3',34962);color_id=add_array(packed_colors,color_type,'VEC4',34962,normalized=True);idx_id=add_array(triangles.reshape(-1),5125,'SCALAR',34963)
missing_urls=re.findall(r'ImageTexture\s*\{\s*url\s*"([^"]+)"',text);unavailable=[url for url in missing_urls if not (a.wrl.parent/url).exists()]
material={'name':'Supplied WRL vertex colors · derived ceramic PBR','pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'metallicFactor':0,'roughnessFactor':.30},'alphaMode':'OPAQUE','doubleSided':True,'extensions':{'KHR_materials_clearcoat':{'clearcoatFactor':.6,'clearcoatRoughnessFactor':.12}},'extras':{'sourceVRMLMaterial':{'ambientIntensity':.2,'diffuseColor':[.9,.9,.9],'specularColor':[.1,.1,.1],'shininess':.5},'pbrIsDerived':True,'usesOnlySuppliedVertexColors':True,'vrmlVertexColorsReplaceDiffuseColor':True,'missingExternalTexture':unavailable,'noSyntheticTexture':True}}
asset_extra={'sourceKind':'user-supplied-wrl-mesh-and-vertex-colors','sourceFileSHA256':hashlib.sha256(raw).hexdigest(),'sourceTextureMissing':unavailable,'colorEncodingInterpretation':a.color_encoding,'geometryUnchangedExceptRigidOrientation':True,'orientation':'Original VRML Y axis retained' if a.keep_source_orientation else 'Rigid 180-degree X rotation: source negative-Y annular seat displayed above positive-Y ring foot','identityNotExternallyVerified':True}
doc={'asset':{'version':'2.0','generator':'Direct VRML IndexedFaceSet conversion; no remeshing','extras':asset_extra},'extensionsUsed':['KHR_materials_clearcoat'],'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'name':'청자투각죽문걸상 · supplied WRL mesh','mesh':0}],'meshes':[{'name':'Original WRL geometry and vertex colors','primitives':[{'attributes':{'POSITION':pos_id,'NORMAL':norm_id,'COLOR_0':color_id},'indices':idx_id,'material':0,'mode':4}]}],'materials':[material],'buffers':[{'byteLength':offset}],'bufferViews':views,'accessors':accessors}
binary=b''.join(blobs);binary+=b'\0'*((-len(binary))%4);doc['buffers'][0]['byteLength']=len(binary);js=json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode();js+=b' '*((-len(js))%4);total=12+8+len(js)+8+len(binary);a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_bytes(struct.pack('<III',0x46546c67,2,total)+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary)
meta={'title':'청자투각죽문걸상(3000740)','sourceKind':'user-supplied-wrl-mesh-and-vertex-colors','notManualReconstruction':True,'identityNotExternallyVerified':True,'source':{'file':a.wrl.name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'format':'VRML2 / VCGLIB IndexedFaceSet','originalTransform':{'scale':[1,1,1],'translation':[0,0,0]},'sourceBoundsXYZ':source_bounds,'sourceUnits':'Not declared; no physical unit assertion','missingImageTextureUrls':unavailable,'textureCoordinatesPresent':'TextureCoordinate' in text},'geometry':{'vertices':len(position),'triangles':len(triangles),'allOriginalVerticesAndTrianglesPreserved':True,'decimationApplied':False,'holeFillingApplied':False,'orientationAdjustment':asset_extra['orientation'],'outputBoundsXYZ':[position.min(0).tolist(),position.max(0).tolist()],'finitePositions':bool(np.isfinite(position).all()),'finiteNormals':bool(np.isfinite(normals).all()),'maxUnitNormalError':float(np.max(abs(np.linalg.norm(normals,axis=1)-1))),'zeroAreaTriangles':int(np.count_nonzero(areas2<1e-12)),'fallbackNormalVertexCount':len(zero),'normalMethod':'Area-weighted normals generated from unchanged source triangles; source provides no Normal array','doubleSided':True,'opaque':True},'surface':{'source':'Original per-vertex RGB array, not the missing JPEG and not a synthetic glaze texture','sourceColorCount':len(source_colors),'sourceColorRGBMean':source_colors.mean(0).tolist(),'colorEncodingInterpretation':a.color_encoding,'sourceEncodingNotExplicitlyTagged':True,'outputColorComponent':a.color_component,'maxQuantizationError':float(np.max(abs(packed_colors[:,:3].astype(float)/maximum-colors))),'derivedPBR':material,'externalResourcesRequired':False},'output':{'file':a.output.name,'bytes':a.output.stat().st_size,'sha256':hashlib.sha256(a.output.read_bytes()).hexdigest()}}
archive_path=a.wrl.parent/'source-archive.json'
if archive_path.exists():
 archive=json.loads(archive_path.read_text());member=next((item for item in archive.get('members',[]) if item.get('sha256')==meta['source']['sha256']),None);meta['source']['originalArchive']={key:archive[key] for key in ['zipFile','zipBytes','zipSha256']};meta['source']['originalArchiveMember']=member
meta['source']['generatorHeader']=next((line.strip() for line in text.splitlines() if 'Generated by VCGLIB' in line),'VCGLIB header');meta['source']['acquisitionMethodVerified']=False;meta['source']['generatorDoesNotEstablishMeasuredScan']=True
meta['surface']['renderColorInterpretation']='Source RGB interpreted as sRGB, decoded to linear and stored normalized U16 for glTF' if a.color_encoding=='srgb-to-linear' else 'Original numeric RGB retained as normalized vertex attributes for comparison'
meta['source']['defaultTextureCoordinateNote']='VRML may generate default bounding-box texture coordinates, but no referenced JPEG is present to restore that texture.'
meta['geometry']['positionTransformMatrixRowMajor']=[1,0,0,0,0,-1,0,0,0,0,-1,0,0,0,0,1]
a.output.with_suffix('.source.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n');print(json.dumps(meta,ensure_ascii=False,indent=2))
