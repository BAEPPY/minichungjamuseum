import * as THREE from 'three';
import {pottery} from './museum.js';
import {disposeModel,loadArtifactModel} from './models.js';

// The map is a 2D sprite world. Make one transparent, cached thumbnail from each
// existing artifact model so the actual supplied objects remain recognizable.
const thumbnails=new Map();
let queue=Promise.resolve();
function loadImage(url){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=url;});}
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
    camera.position.copy(center).add(new THREE.Vector3(3,2,4));camera.lookAt(center);renderer.render(scene,camera);
    const image=await loadImage(renderer.domElement.toDataURL('image/png'));resolve(image);
   }catch(error){reject(error);}finally{if(object)disposeModel(object);if(renderer){renderer.dispose();renderer.forceContextLoss();}}
  });
 });
 thumbnails.set(artifact.id,result);return result;
}
