import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// Cache the decoded source. Each instance owns its geometry, materials and texture
// wrappers; disposing a viewer must not invalidate another instance's textures.
const sources=new Map();
export function releaseModelSource(path){
 if(!path?.startsWith('blob:'))return;
 const source=sources.get(path);sources.delete(path);
 source?.then(gltf=>disposeModel(gltf.scene)).catch(()=>{});
}
export function disposeModel(object){
 const geometries=new Set(),materials=new Set(),textures=new Set();
 object.traverse(node=>{if(node.geometry)geometries.add(node.geometry);for(const material of [].concat(node.material||[])){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});
 for(const texture of textures)texture.dispose();
 for(const material of materials)material.dispose();
 for(const geometry of geometries)geometry.dispose();
}
export async function loadArtifactModel(artifact,height=1.7){
 const path=artifact.model;if(!path)throw Error('유물 모델 경로가 없어요.');
 if(!sources.has(path))sources.set(path,new GLTFLoader().loadAsync(path).catch(error=>{sources.delete(path);throw error;}));
 const source=await sources.get(path),model=source.scene.clone(true),textures=new Map(),materials=new Map();
 const cloneMaterial=original=>{
  if(materials.has(original))return materials.get(original);
  const result=original.clone();
  for(const [key,value]of Object.entries(result))if(value?.isTexture){if(!textures.has(value))textures.set(value,value.clone());result[key]=textures.get(value);}
  if(artifact.referenceTint&&result.color)result.color.set(0x79a78e);
  materials.set(original,result);return result;
 };
 model.traverse(node=>{if(node.isMesh){node.geometry=node.geometry.clone();node.material=Array.isArray(node.material)?node.material.map(cloneMaterial):cloneMaterial(node.material);node.castShadow=true;node.receiveShadow=true;}});
 const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 if(!Number.isFinite(size.y)||size.y<=0){disposeModel(model);throw Error('표시할 수 있는 유물 모델이 없어요.');}
 model.position.sub(center);const group=new THREE.Group();group.add(model);group.scale.setScalar(height/size.y);group.position.y=height/2;return group;
}
