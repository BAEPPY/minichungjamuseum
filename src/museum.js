import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {disposeModel,loadArtifactModel} from './models.js';

const mat = (color, extras={}) => new THREE.MeshStandardMaterial({color,roughness:.7,...extras});
function mesh(g,m,parent,x=0,y=0,z=0){const a=new THREE.Mesh(g,m);a.position.set(x,y,z);a.castShadow=true;a.receiveShadow=true;parent.add(a);return a;}
function box(parent,w,h,d,m,x,y,z){return mesh(new THREE.BoxGeometry(w,h,d),m,parent,x,y,z);}
export function pottery(a){
 const root=new THREE.Group();
 const glaze=mat(a.color,{roughness:.23,metalness:.14});
 const dark=mat(0x2f695a,{roughness:.35});
 const lathe=(pts,y=0,scale=1)=>{const m=mesh(new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(...p)),64),glaze,root,0,y,0);m.scale.setScalar(scale);return m;};
 if(a.shape==='vase')lathe([[.06,0],[.26,.04],[.28,.17],[.3,.4],[.41,.78],[.49,1.08],[.46,1.25],[.35,1.38],[.17,1.46],[.12,1.57],[.17,1.6],[.17,1.65],[.1,1.65],[.095,1.55],[.12,1.43],[.3,1.29],[.39,1.13],[.36,.8],[.25,.4],[.2,.13],[.06,.1]]);
 if(a.shape==='ewer'){
  lathe([[0,0],[.25,.04],[.29,.15],[.47,.45],[.45,.72],[.32,.92],[.21,.98],[.19,1.03],[.14,1.04],[.13,.96],[.25,.88],[.36,.68],[.36,.4],[.2,.12],[0,.1]]);
  mesh(new THREE.SphereGeometry(.19,32,16),glaze,root,0,1.02,0).scale.y=.3;
  mesh(new THREE.SphereGeometry(.055,16,16),glaze,root,0,1.11,0);
  const handle=mesh(new THREE.TorusGeometry(.32,.055,12,48,Math.PI*1.7),glaze,root,-.36,.65,0);handle.rotation.z=.48;
  const path=new THREE.CatmullRomCurve3([new THREE.Vector3(.32,.3,0),new THREE.Vector3(.63,.53,0),new THREE.Vector3(.75,.96,0)]);
  mesh(new THREE.TubeGeometry(path,32,.075,16,false),glaze,root);
 }
 if(a.shape==='bowl')lathe([[0,0],[.22,0],[.24,.12],[.39,.2],[.58,.39],[.7,.62],[.67,.64],[.54,.41],[.35,.23],[.18,.17],[0,.17]],0,1.15);
 if(a.shape==='incense'){
  lathe([[0,.12],[.32,.15],[.46,.35],[.49,.65],[.43,.75],[.37,.76],[.38,.64],[.35,.37],[.25,.23],[0,.22]]);
  lathe([[0,.9],[.15,.9],[.28,.82],[.49,.77],[.5,.81],[.29,.9],[.13,1.04],[0,1.07]]);
  mesh(new THREE.SphereGeometry(.09,20,16),glaze,root,0,1.1,0);
  for(let i=0;i<3;i++){const t=i*Math.PI*2/3;mesh(new THREE.CylinderGeometry(.06,.08,.25,16),glaze,root,Math.cos(t)*.28,.1,Math.sin(t)*.28);}
 }
 if(a.shape==='pillow'){
  const shape=new THREE.Shape();shape.moveTo(-.65,.1);shape.lineTo(.65,.1);shape.lineTo(.58,.65);shape.quadraticCurveTo(0,.44,-.58,.65);shape.closePath();
  const body=mesh(new THREE.ExtrudeGeometry(shape,{depth:.7,bevelEnabled:true,bevelSize:.06,bevelThickness:.06,bevelSegments:4,steps:1}),glaze,root,0,0,-.35);
  body.rotation.y=.15;
 }
 if(a.shape==='stool')lathe([[0,0],[.48,.02],[.5,.1],[.37,.22],[.32,.65],[.4,.93],[.52,1.02],[.52,1.1],[0,1.1]]);
 // Decorative bands are conceptual motifs, not a historical reproduction.
 if(['vase','stool','ewer'].includes(a.shape)){
  const rad=a.shape==='vase'?.45:a.shape==='stool'?.34:.46;
  const y=a.shape==='vase'?1.04:a.shape==='stool'?.55:.6;
  for(let i=0;i<8;i++){
   const t=i*Math.PI/4;
   const ring=mesh(new THREE.TorusGeometry(.065,.008,6,24),dark,root,Math.cos(t)*rad,y,Math.sin(t)*rad);
   ring.rotation.y=Math.PI/2-t;
  }
 }
 return root;
}
function renderer(el){const r=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,alpha:true});r.setPixelRatio(Math.min(devicePixelRatio,2));r.shadowMap.enabled=true;r.shadowMap.type=THREE.PCFSoftShadowMap;r.outputColorSpace=THREE.SRGBColorSpace;r.toneMapping=THREE.ACESFilmicToneMapping;el.append(r.domElement);return r;}
function lights(s){s.add(new THREE.HemisphereLight(0xfff7e6,0x64786d,3));const sun=new THREE.DirectionalLight(0xffedcf,4);sun.position.set(-5,12,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-12,right:12,top:12,bottom:-12});sun.shadow.bias=-.001;s.add(sun);}
function label(text,width=3,height=.55){const c=document.createElement('canvas');c.width=768;c.height=140;const x=c.getContext('2d');x.fillStyle='#ece4ce';x.fillRect(0,0,c.width,c.height);x.fillStyle='#25473c';x.font='bold 58px sans-serif';x.textAlign='center';x.fillText(text,384,91);const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c)}));sp.scale.set(width,height,1);return sp;}
export function createViewer(el,a){
 const r=renderer(el),s=new THREE.Scene();s.background=new THREE.Color(0xe8e9e0);lights(s);
 const cam=new THREE.PerspectiveCamera(38,1,.05,100);cam.position.set(2.8,1.9,3.5);
 const controls=new OrbitControls(cam,r.domElement);controls.target.set(0,.7,0);controls.enableDamping=true;controls.minDistance=1.5;controls.maxDistance=9;controls.maxPolarAngle=Math.PI*.86;
 let object=pottery(a);s.add(object);let active=true;
 const ready=a.model?loadArtifactModel(a,a.viewHeight??1.7).then(model=>{if(!active){disposeModel(model);return;}s.remove(object);disposeModel(object);object=model;s.add(model);}):Promise.resolve();
 const base=a.hidePedestal?null:mesh(new THREE.CylinderGeometry(1.3,1.3,.08,64),mat(0xd6d8c9),s,0,-.08,0);
 const observer=new ResizeObserver(()=>{const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;r.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();});observer.observe(el);
 let frame;const loop=()=>{frame=requestAnimationFrame(loop);controls.update();r.render(s,cam);};loop();
 return {ready,setReferenceColor(enabled){if(!a.referenceTint)return;object.traverse(n=>{if(n.isMesh)for(const m of [].concat(n.material))m.color.set(enabled?0x79a78e:0xffffff);});},capture(){r.render(s,cam);return r.domElement.toDataURL('image/jpeg',.8);},zoom(n){cam.position.sub(controls.target).multiplyScalar(n).add(controls.target);controls.update();},reset(){cam.position.set(2.8,1.9,3.5);controls.target.set(0,.7,0);controls.update();},async loadFile(file){if(file.size>30*1024*1024)throw Error('30MB 이하의 GLB 파일을 선택해 주세요.');const data=await file.arrayBuffer();const gltf=await new GLTFLoader().parseAsync(data,'');const replacement=gltf.scene;const bounds=new THREE.Box3().setFromObject(replacement);const size=bounds.getSize(new THREE.Vector3());const max=Math.max(size.x,size.y,size.z);if(!max||!Number.isFinite(max))throw Error('표시할 수 있는 모델이 없어요.');const center=bounds.getCenter(new THREE.Vector3());replacement.position.sub(center);const wrap=new THREE.Group();wrap.add(replacement);wrap.scale.setScalar(1.6/max);wrap.position.y=.8;s.remove(object);object.traverse(n=>{n.geometry?.dispose();if(n.material)for(const m of [].concat(n.material))m.dispose();});object=wrap;s.add(wrap);},dispose(){active=false;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();disposeModel(s);r.dispose();r.domElement.remove();}};
}
