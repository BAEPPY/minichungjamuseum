import * as THREE from 'three';
import {pottery} from './museum.js';
import {disposeModel,loadArtifactModel} from './models.js';
import {MAP_CAMERA_DIRECTION} from './projection.js';

// The map is a 2D sprite world. Make one transparent, cached thumbnail from each
// existing artifact model so the actual supplied objects remain recognizable.
const thumbnails=new Map();
let queue=Promise.resolve();
function loadImage(url){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=url;});}
function footCenter(object,bounds){
 const foot=new THREE.Box3(),vertex=new THREE.Vector3(),threshold=bounds.min.y+(bounds.max.y-bounds.min.y)*.02;
 object.updateWorldMatrix(true,true);
 object.traverse(child=>{const positions=child.isMesh&&child.geometry?.getAttribute('position');if(!positions)return;for(let i=0;i<positions.count;i++){vertex.fromBufferAttribute(positions,i).applyMatrix4(child.matrixWorld);if(vertex.y<=threshold)foot.expandByPoint(vertex);}});
 const center=(foot.isEmpty()?bounds:foot).getCenter(new THREE.Vector3());center.y=bounds.min.y;return center;
}
export function artifactSprite(artifact){
 if(thumbnails.has(artifact.id))return thumbnails.get(artifact.id);
 const result=artifact.photoPoster?loadImage(artifact.photoPoster):new Promise((resolve,reject)=>{
  queue=queue.catch(()=>{}).then(async()=>{
   let renderer,object;
   try{
    renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
    renderer.setSize(384,384,false);renderer.setPixelRatio(1);renderer.setClearColor(0x000000,0);
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
    const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xfff5e4,0x61775b,2.6));
    const light=new THREE.DirectionalLight(0xfff4dd,3);light.position.set(-3,7,5);scene.add(light);
    object=artifact.model?await loadArtifactModel(artifact,1.7):pottery(artifact);scene.add(object);
    const bounds=new THREE.Box3().setFromObject(object),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
    const maximum=Math.max(size.x,size.y,size.z),camera=new THREE.OrthographicCamera(-maximum*.75,maximum*.75,maximum*.75,-maximum*.75,.05,30);
    camera.position.copy(center).add(new THREE.Vector3(...MAP_CAMERA_DIRECTION).multiplyScalar(4));camera.lookAt(center);renderer.render(scene,camera);
    const contact=footCenter(object,bounds).project(camera);
    const image=await loadImage(renderer.domElement.toDataURL('image/png'));
    image.groundAnchor={x:(contact.x+1)*192,y:(1-contact.y)*192};resolve(image);
   }catch(error){reject(error);}finally{if(object)disposeModel(object);if(renderer){renderer.dispose();renderer.forceContextLoss();}}
  });
 });
 thumbnails.set(artifact.id,result);return result;
}
