import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {disposeModel} from './models.js';
import {MAP_CAMERA_DIRECTION} from './projection.js';
import {mapModelPath} from './map-models.js';

const SIZE=192,RESIDENT_LIMIT=4,FRAME_INTERVAL=1000/30;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

/** One small WebGL context serves every map display, including repeated works.
 * Only the nearest visible work animates. Other works retain cheap 2D copies;
 * no detailed observation model is fetched for the ordinary map.
 */
export function createMapArtifactViewer({onChange=()=>{}}={}){
 const loader=new GLTFLoader(),states=new Map(),requestedPaths=new Set(),failedPaths=new Set();
 let renderer=null,destroyed=false,disabled=false,paused=true,visible=[],activeId=null;
 let loading=null,lastFrame=0,renderCount=0,lastRenderMs=0,renderMs=0,evictions=0;
 let compileCount=0,lastCompileMs=0,compileMs=0,parallelShaderCompileAvailable=false;
 const point=new THREE.Vector3();
 function visibilityChanged(){if(document.hidden){paused=true;activeId=null;loading?.abort.abort();emit();}}
 document.addEventListener('visibilitychange',visibilityChanged);
 function emit(){if(!destroyed)onChange();}
 function ensureRenderer(){
  if(renderer||disabled||destroyed)return renderer;
  try{
   renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:false,powerPreference:'low-power'});
   renderer.setPixelRatio(1);renderer.setSize(SIZE,SIZE,false);renderer.setClearColor(0,0);
   renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
   parallelShaderCompileAvailable=renderer.extensions.has('KHR_parallel_shader_compile');
   renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();disabled=true;paused=true;activeId=null;emit();});
  }catch{disabled=true;}
  return renderer;
 }
 function dropResident(state){
  if(!state.resident)return;
  disposeModel(state.resident.scene);state.resident=null;evictions++;
 }
 function residents(){return [...states.values()].filter(state=>state.resident);}
 function makeSpace(keepId){
  const current=residents();if(current.length<RESIDENT_LIMIT)return;
  const priorities=new Map(visible.map(entry=>[entry.artifact.id,entry.priority||0]));
  current.filter(state=>state.id!==keepId).sort((a,b)=>(priorities.has(a.id)?1:0)-(priorities.has(b.id)?1:0)||(priorities.get(a.id)||0)-(priorities.get(b.id)||0)||a.lastUsed-b.lastUsed).slice(0,current.length-RESIDENT_LIMIT+1).forEach(dropResident);
 }
 function fallback(state){
  const url=state.artifact.mapPreview||state.artifact.photoPoster;if(!url||state.snapshot)return;
  const image=new Image();image.onload=()=>{if(destroyed||states.get(state.id)!==state)return;state.snapshot={image,rect:{x:0,y:0,w:image.naturalWidth,h:image.naturalHeight},groundAnchor:{x:image.naturalWidth/2,y:image.naturalHeight}};image.groundAnchor=state.snapshot.groundAnchor;emit();};image.src=url;
 }
 function stateFor(artifact){
  const path=mapModelPath(artifact),key=path||artifact.mapPreview||artifact.photoPoster||'';
  let state=states.get(artifact.id);
  if(state&&state.key!==key){dropResident(state);states.delete(artifact.id);state=null;}
  if(!state){state={id:artifact.id,key,path,artifact:{...artifact},snapshot:null,resident:null,failed:false,angle:0,lastUsed:0};states.set(state.id,state);if(!path)fallback(state);}
  return state;
 }
 function setup(state,model){
  model.traverse(node=>{if(!node.isMesh)return;node.castShadow=false;node.receiveShadow=false;for(const material of [].concat(node.material||[])){if(state.artifact.referenceTint&&material.color)material.color.set(0x79a78e);if(state.artifact.preservePhotoColors&&material.isMeshBasicMaterial&&material.map)material.toneMapped=false;}});
  const rawBounds=new THREE.Box3().setFromObject(model),size=rawBounds.getSize(new THREE.Vector3()),center=rawBounds.getCenter(new THREE.Vector3());
  if(!Number.isFinite(size.y)||size.y<=0)throw Error('Invalid map model bounds');
  model.position.sub(center);
  const turntable=new THREE.Group();turntable.add(model);turntable.scale.setScalar(1.7/size.y);turntable.position.y=.85;
  const scene=new THREE.Scene();scene.add(turntable);
  const neutral=state.artifact.observationLighting==='neutral-studio';
  scene.add(new THREE.HemisphereLight(neutral?0xf1f4f5:0xfff5e4,neutral?0x858979:0x61775b,neutral?.7:2.6));
  const light=new THREE.DirectionalLight(neutral?0xffffff:0xfff4dd,neutral?2.8:3);light.position.set(-3,7,5);scene.add(light);
  if(neutral){const fill=new THREE.DirectionalLight(0xd4e0db,.6);fill.position.set(4,3,-3);scene.add(fill);}
  const radial=Math.hypot(size.x,size.z)/size.y*1.7/2,extent=Math.max(1.4,Math.hypot(radial,.85)*1.22);
  const camera=new THREE.OrthographicCamera(-extent,extent,extent, -extent,.05,30);
  camera.position.set(0,.85,0).add(new THREE.Vector3(...MAP_CAMERA_DIRECTION).multiplyScalar(4));camera.lookAt(0,.85,0);camera.updateMatrixWorld();
  // Fit one rotational envelope once, so the work does not grow/shrink while
  // turning as it would if each frame were cropped to a different silhouette.
  let left=SIZE,top=SIZE,right=0,bottom=0;
  for(let i=0;i<64;i++)for(const y of [0,1.7]){
   const angle=i*Math.PI/32;point.set(Math.cos(angle)*radial,y,Math.sin(angle)*radial).project(camera);
   const px=(point.x+1)*SIZE/2,py=(1-point.y)*SIZE/2;left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py);
  }
  const x=clamp(Math.floor(left)-1,0,SIZE-1),y=clamp(Math.floor(top)-1,0,SIZE-1);
  const rect={x,y,w:clamp(Math.ceil(right)+1,1,SIZE)-x,h:clamp(Math.ceil(bottom)+1,1,SIZE)-y};
  point.set(0,0,0).project(camera);const groundAnchor={x:(point.x+1)*SIZE/2,y:(1-point.y)*SIZE/2};
  state.resident={scene,turntable,camera,rect,groundAnchor,ready:false};state.lastUsed=performance.now();
 }
 function render(state){
  if(!renderer||!state.resident?.ready||paused||document.hidden)return;
  const start=performance.now(),{scene,turntable,camera,rect,groundAnchor}=state.resident;
  turntable.rotation.y=state.angle;turntable.updateMatrixWorld(true);renderer.render(scene,camera);
  let snapshot=state.snapshot;
  if(!snapshot||!(snapshot.image instanceof HTMLCanvasElement)){const image=document.createElement('canvas');image.width=SIZE;image.height=SIZE;snapshot={image,rect:{x:0,y:0,w:SIZE,h:SIZE}};state.snapshot=snapshot;}
  const context=snapshot.image.getContext('2d');context.clearRect(0,0,SIZE,SIZE);context.drawImage(renderer.domElement,0,0);
  snapshot.rect=rect;snapshot.groundAnchor=groundAnchor;snapshot.image.groundAnchor=groundAnchor;
  state.lastUsed=performance.now();renderCount++;lastRenderMs=performance.now()-start;renderMs+=lastRenderMs;
 }
 async function load(state){
  if(!ensureRenderer()){state.failed=true;fallback(state);return;}
  const job={state,abort:new AbortController()};loading=job;requestedPaths.add(state.path);
  let model,prepared;
  try{
   const response=await fetch(state.path,{signal:job.abort.signal});if(!response.ok)throw Error('Map model unavailable');
   const basePath=state.path.startsWith('blob:')?location.href:new URL('.',new URL(state.path,location.href)).href;
   const gltf=await loader.parseAsync(await response.arrayBuffer(),basePath);model=gltf.scene;
   if(destroyed||job.abort.signal.aborted||states.get(state.id)!==state){disposeModel(model);return;}
   makeSpace(state.id);setup(state,model);model=null;prepared=state.resident;
   // Do not make a first synchronous render compile shaders during walking.
   // With KHR_parallel_shader_compile this yields until programs are ready.
   // The ready flag also prevents update() from drawing this scene meanwhile.
   const started=performance.now();
   await renderer.compileAsync(prepared.scene,prepared.camera);
   lastCompileMs=performance.now()-started;compileMs+=lastCompileMs;compileCount++;
   if(destroyed||job.abort.signal.aborted||states.get(state.id)!==state||state.resident!==prepared){if(state.resident===prepared)dropResident(state);return;}
   prepared.ready=true;
   if(!paused&&!document.hidden){render(state);emit();}
  }catch(error){
   if(model)disposeModel(model);
   if(prepared&&state.resident===prepared)dropResident(state);
   if(!destroyed&&states.get(state.id)===state&&error.name!=='AbortError'){state.failed=true;failedPaths.add(state.path);fallback(state);emit();}
  }finally{if(loading===job)loading=null;}
 }
 function update(entries,{now=performance.now(),paused:pauseRequested=false}={}){
  if(destroyed)return;
  paused=Boolean(pauseRequested||document.hidden||disabled);
  const unique=new Map();for(const entry of entries){const id=entry.artifact?.id;if(id&&(!unique.has(id)||(entry.priority||0)>(unique.get(id).priority||0)))unique.set(id,entry);}
  visible=[...unique.values()].sort((a,b)=>(b.priority||0)-(a.priority||0));
  activeId=paused?null:visible[0]?.artifact.id||null;
  if(paused){loading?.abort.abort();lastFrame=now;return;}
  for(const entry of visible)stateFor(entry.artifact);
  // Loaded scenes outside the viewport have a short grace period for walking
  // past a screen edge, then release GPU geometry/textures; snapshots remain.
  const ids=new Set(visible.map(entry=>entry.artifact.id));
  for(const state of states.values())if(state.resident&&loading?.state!==state&&!ids.has(state.id)&&now-state.lastUsed>8000)dropResident(state);
  if(!loading){
   const active=states.get(activeId);
   const missing=active?.path&&!active.resident&&!active.failed?active:visible.map(entry=>states.get(entry.artifact.id)).find(state=>state.path&&!state.resident&&!state.snapshot&&!state.failed);
   if(missing)void load(missing);
  }
  if(now-lastFrame<FRAME_INTERVAL)return;
  const elapsed=clamp((now-lastFrame)/1000,0,.1);lastFrame=now;
  let changed=false;
  for(const state of residents())if(state.resident.ready&&ids.has(state.id)&&(!state.snapshot||state.id===activeId)){
   if(state.id===activeId)state.angle+=elapsed*.22;
   render(state);changed=true;
  }
  if(changed)emit();
 }
 return {update,getSnapshot(id){return states.get(id)?.snapshot||null;},reload(id){const state=states.get(id);if(state){dropResident(state);states.delete(id);}if(loading?.state.id===id)loading.abort.abort();emit();},getStats(){return {contexts:renderer&&!disabled?1:0,loadedModels:residents().length,loadingModels:loading?1:0,residentLimit:RESIDENT_LIMIT,renderCount,lastRenderMs,averageRenderMs:renderCount?renderMs/renderCount:0,compileCount,lastCompileMs,averageCompileMs:compileCount?compileMs/compileCount:0,compilingModels:residents().filter(state=>!state.resident.ready).length,parallelShaderCompileAvailable,activeId,paused,visibleCount:visible.length,requestedPaths:[...requestedPaths],failedPaths:[...failedPaths],evictions,snapshots:[...states.values()].filter(state=>state.snapshot).length};},dispose(){destroyed=true;document.removeEventListener('visibilitychange',visibilityChanged);loading?.abort.abort();for(const state of states.values())dropResident(state);states.clear();if(renderer){renderer.dispose();renderer.forceContextLoss();renderer=null;}}};
}
