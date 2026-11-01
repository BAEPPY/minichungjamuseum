import * as THREE from 'three';
import {disposeModel,loadArtifactModel} from './models.js';
import {pottery} from './museum.js';
import {artifacts} from './artifacts.js';
import {makingSteps} from './journey.js';
const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.8,...extra});
export function createGameWorld(el,{onInteract,onNear,onMove,inside=false,avatarColor='#eccd79',avatarName='나의 탐험가'}){
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;el.append(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color(0xc0cc8c);const camera=new THREE.OrthographicCamera(-12,12,7, -7,.1,150);
 scene.add(new THREE.HemisphereLight(0xfff5df,0x5e7650,2.5));const sun=new THREE.DirectionalLight(0xfff4dc,3);sun.position.set(-15,28,18);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-35,right:35,top:35,bottom:-35,far:100});sun.shadow.bias=-.001;scene.add(sun);scene.add(sun.target);
 const objects=[],obstacles=[],hotspots=new Map(),reportObjects=[];let destroyed=false,indoors=inside,near=null,outline=null,previousNear=null,waypoints=[],target=null,span=7.5,frame,paused=false;
 const add=(geometry,mat,parent=scene,x=0,y=0,z=0)=>{const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
 const box=(w,h,d,color,x,y,z,parent=scene)=>add(new THREE.BoxGeometry(w,h,d),typeof color==='number'?material(color):color,parent,x,y,z);
 function plaque(text,width=2.5,height=.5,dark=false){const c=document.createElement('canvas');c.width=768;c.height=180;const ctx=c.getContext('2d');ctx.fillStyle=dark?'#253e35':'#f6f0d9';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle=dark?'#fff4ce':'#354736';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`bold ${text.length>15?42:54}px sans-serif`;ctx.fillText(text,384,92,720);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,toneMapped:false}));sprite.scale.set(width,height,1);return sprite;}
 function sign(text,x,y,z,w=3){const p=plaque(text,w,.5,true);p.position.set(x,y,z);scene.add(p);return p;}
 function hot(id,type,name,position,group,data={}){const item={id,type,name,position,...data};hotspots.set(id,item);if(group){group.traverse(n=>{if(n.isMesh){n.userData.hotspot=id;objects.push(n);}});item.group=group;}return item;}
 function pedestal(x,z,w=1.7,d=1.5){const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);box(w,.8,d,0xd5c6a2,0,.4,0,g);box(w+.12,.08,d+.12,0x443e34,0,.84,0,g);obstacles.push({x,z,w:w/2+.2,d:d/2+.2});return g;}
 function tiles(positions,w,d){const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(w,.025,d),material(0xffffff),positions.length);const transform=new THREE.Matrix4();positions.forEach(([x,y,z,color],i)=>{transform.makeTranslation(x,y,z);mesh.setMatrixAt(i,transform);mesh.setColorAt(i,new THREE.Color(color));});mesh.receiveShadow=true;scene.add(mesh);}
 // Outdoor square: grass, stone paving, water and a cutaway museum facade.
 box(45,.4,42,0x9db775,7,-.3,5);
 const courtyardTiles=[];for(let z=5;z<=23;z++)for(let x=-11;x<=25;x++)courtyardTiles.push([x,.01,z,(x+z)%2?0xe9e0b8:0xe0d7aa]);tiles(courtyardTiles,.98,.98);
 box(6,.15,7,0x7f9862,-10,.03,15);box(5.6,.08,6.6,0x9ed3d2,-10,.12,15);
 function tree(x,z,size=1){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(size);scene.add(g);add(new THREE.CylinderGeometry(.2,.27,2.1,10),material(0x745340),g,0,1.05,0);for(let i=0;i<7;i++)add(new THREE.IcosahedronGeometry(.95,1),material([0xc0cd7c,0xb4c473,0x9fb86e][i%3]),g,Math.cos(i*2)*.7,2.6+Math.sin(i)*.4,Math.sin(i*2)*.7);obstacles.push({x,z,w:.65,d:.65});}
 for(const [x,z,size]of [[-8,8,1.2],[-8,22,1.1],[9,22,1.1],[25,7,1.3],[25,22,1.2],[-12,-10,1.2]])tree(x,z,size);
 for(let x=-7;x<12;x+=.55){box(.5,.15,.45,0x9a8f5e,x,.1,23);add(new THREE.IcosahedronGeometry(.11,0),material(x%2?0xe6c376:0xe3a37d),scene,x,.45,23);}
 // A blue-walled museum, with its roof removed so that the player can see inside.
 box(24,.22,20,0xae865b,0,0,-5.5);
 const indoorTiles=[];for(let z=-15;z<4.5;z+=.65)for(let x=-11.5;x<12;x+=2)indoorTiles.push([x,.12,z,[0xb89568,0xc29d70,0xcba87a][Math.abs(Math.round(x+z))%3]]);tiles(indoorTiles,1.96,.62);
 box(24,3.4,.2,0x194d7b,0,1.8,-15.6);box(.2,3.4,20,0x194d7b,-12,1.8,-5.5);
 box(24,.12,.3,0xd0b991,0,3.55,-15.6);box(.3,.12,20,0xd0b991,-12,3.55,-5.5);
 for(const x of [-11.8,-.3,11.6])box(.45,3,.45,0x17446d,x,1.6,4.35);
 box(8.4,.9,.3,0xe8ddba,-7.3,.6,4.35);box(8.4,.9,.3,0xe8ddba,7.3,.6,4.35);
 // Entrance roof and glowing portal.
 const roof=add(new THREE.ConeGeometry(4.4,1.2,4),material(0x284963),scene,0,3.8,5.15);roof.rotation.y=Math.PI/4;roof.scale.z=.42;
 sign('고려청자박물관',0,2.9,5.8,4.3);sign('01  청자 제작 공방',-6,2.8,-14.9,4);sign('02  다섯 점의 청자',6,2.8,-14.9,4);
 const ring=(x,z,color=0xf0d37b)=>{const mesh=add(new THREE.RingGeometry(.6,.85,48),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}),scene,x,.16,z);mesh.rotation.x=-Math.PI/2;return mesh;};
 const entrance=ring(0,7);sign('입장 · F',0,.8,7,1.9);hot('entrance','entrance','박물관 입장',[0,7],entrance);
 const exit=ring(0,3.4);sign('출구 · F',0,.8,3.4,1.9);hot('exit','exit','관람을 마치고 나가기',[0,3.4],exit);
 // Workshop stations are objects in the room, not separate web pages.
 const stationPositions=[[-8,1],[-4,1],[-8,-3.5],[-4,-3.5],[-8,-8],[-4,-8]];
 makingSteps.forEach((step,i)=>{const [x,z]=stationPositions[i],g=pedestal(x,z,1.8,1.55);if(i===0){for(let j=0;j<3;j++)add(new THREE.SphereGeometry(.25,16,12),material(0xa98460),g,(j-1)*.3,1,0);}else if(i===5){box(1.1,1.4,1,0xa16f4e,0,1.6,0,g);box(.68,.7,.05,0x453c31,0,1.3,.52,g);add(new THREE.ConeGeometry(.28,.55,8),material(0xeab06c,{emissive:0xb66b27,emissiveIntensity:.4}),g,0,1.2,.6);}else {const p=pottery(artifacts[0]);p.scale.setScalar(.58);p.position.y=.88;if(i<4)p.traverse(n=>{if(n.isMesh)n.material.color.set(0xc6a27d);});g.add(p);if(i===1)add(new THREE.CylinderGeometry(.65,.65,.08,32),material(0x6e7467),g,0,.91,0);}sign(`${i+1}. ${step.name}`,x,.63,z+1.1,2.3);hot(`making-${i}`,'making',step.name,[x,z],g,{step:i});});
 // Five celadon exhibits. A glass case and floor route evoke a walkable museum.
 const collectionPositions=[[4,1],[8,1],[4,-3.5],[8,-3.5],[6,-8]];
 artifacts.forEach((a,i)=>{const [x,z]=collectionPositions[i],g=pedestal(x,z,1.7,1.5),p=pottery(a);p.scale.setScalar(.72);p.position.y=.91;g.add(p);
  const glass=add(new THREE.BoxGeometry(1.75,1.75,1.55),new THREE.MeshPhysicalMaterial({color:0xdbf1df,transparent:true,opacity:.08,roughness:.1,depthWrite:false,side:THREE.DoubleSide}),g,0,1.7,0);glass.castShadow=false;
  const frame=new THREE.LineSegments(new THREE.EdgesGeometry(glass.geometry),new THREE.LineBasicMaterial({color:0x8c9b86,transparent:true,opacity:.45}));frame.position.copy(glass.position);g.add(frame);
  sign(`${i+1}. ${a.name.replace('청자 투각 칠보무늬 향로','투각 칠보무늬 향로')}`,x,.62,z+1.1,2.4);hot(a.id,'artifact',a.name,[x,z],g,{artifact:a});
  if(a.photoPoster)new THREE.TextureLoader().load(a.photoPoster,texture=>{if(destroyed){texture.dispose();return;}texture.colorSpace=THREE.SRGBColorSpace;const photo=new THREE.Group();photo.position.set(0,1.65,0);photo.rotation.y=Math.atan2(12,16);const backing=new THREE.Mesh(new THREE.BoxGeometry(1.5,1.18,.06),material(0xb8a57d));photo.add(backing);const image=new THREE.Mesh(new THREE.PlaneGeometry(1.4,1.08),new THREE.MeshBasicMaterial({map:texture,toneMapped:false,side:THREE.DoubleSide}));image.position.z=.035;photo.add(image);photo.traverse(n=>{if(n.isMesh){n.userData.hotspot=a.id;objects.push(n);}});g.remove(p);p.traverse(n=>{const index=objects.indexOf(n);if(index>=0)objects.splice(index,1);});disposeModel(p);g.add(photo);});
  if(a.model)loadArtifactModel(a,1.5).then(model=>{if(destroyed){disposeModel(model);return;}model.position.y+=.91;model.traverse(n=>{if(n.isMesh){n.userData.hotspot=a.id;objects.push(n);}});g.remove(p);p.traverse(n=>{const index=objects.indexOf(n);if(index>=0)objects.splice(index,1);});disposeModel(p);g.add(model);}).catch(()=>{});
 });
 // A writing desk and the outdoor report exhibition area.
 const desk=new THREE.Group();desk.position.set(0,0,-12);scene.add(desk);box(3,.2,1.4,0x6e614b,0,1,0,desk);for(const x of [-1.2,1.2])box(.12,1,.12,0x464b3c,x,.5,0,desk);box(.6,.06,.8,0xfff6db,0,1.15,0,desk);sign('관람 보고서 쓰기',0,1.85,-12,3);hot('desk','desk','관람 보고서 작성',[0,-12],desk);obstacles.push({x:0,z:-12,w:1.6,d:.9});
 sign('우리들의 발견 전시 마당',18,2.7,8,6);
 const stand=pedestal(14,17,1.7,1.3);box(1.2,.1,1,0xf3e6bd,0,.94,0,stand);sign('내 보고서 전시하기',14,1.9,17,3);hot('publish','publish','내 보고서 전시하기',[14,17],stand);
 sign('다른 탐험가의 발견을 읽어 보세요',19,.8,20.5,5);
 // Dotted floor paths leave comfortable circulation around the showcases.
 for(const z of [2.7,-1.3,-6])for(let x=-10;x<11;x+=.4){const dot=add(new THREE.CircleGeometry(.022,7),material(0x75664f),scene,x,.15,z);dot.rotation.x=-Math.PI/2;}
 const player=new THREE.Group();scene.add(player);player.position.set(inside?-2:0,.15,inside?2.7:11);
 const coat=add(new THREE.CapsuleGeometry(.18,.28,5,12),material(avatarColor),player,0,.52,0);add(new THREE.SphereGeometry(.2,20,14),material(0xefcdb1),player,0,.98,0);add(new THREE.SphereGeometry(.21,20,14,0,Math.PI*2,0,Math.PI*.62),material(0x4c3a42),player,0,1.03,0);for(const x of [-.1,.1])box(.12,.26,.13,0x334757,x,.15,0,player);
 const playerTag=plaque(avatarName,1.6,.3,true);playerTag.position.set(0,1.6,0);player.add(playerTag);
 const playerRing=ring(0,11,0xf5e4a7);playerRing.geometry.dispose();playerRing.geometry=new THREE.RingGeometry(.27,.34,32);target=player.position.clone();target.y=.15;const look=player.position.clone(),keys={};let touchMove={x:0,y:0};
 function blocked(x,z){if(x< -11.1||x>25||z< -14.6||z>24)return true;if(!indoors&&z<5.2)return true;if(indoors&&(z>4.1||x>11.1))return true;return obstacles.some(o=>Math.abs(x-o.x)<o.w&&Math.abs(z-o.z)<o.d);}
 function route(x,z){const step=.5,start=[Math.round((player.position.x+11)/step),Math.round((player.position.z+15)/step)],end=[Math.round((x+11)/step),Math.round((z+15)/step)],key=(x,z)=>x+','+z;const q=[start],parents=new Map([[key(...start),null]]);let found=null;
  for(let i=0;i<q.length;i++){const [cx,cz]=q[i];if(cx===end[0]&&cz===end[1]){found=q[i];break;}for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=cx+dx,nz=cz+dz;if(parents.has(key(nx,nz))||blocked(nx*step-11,nz*step-15))continue;parents.set(key(nx,nz),[cx,cz]);q.push([nx,nz]);}}
  waypoints=[];while(found){waypoints.unshift(new THREE.Vector3(found[0]*step-11,.15,found[1]*step-15));found=parents.get(key(...found));}if(waypoints.length){waypoints.shift();target.copy(waypoints.shift()||player.position);return true;}return false;
 }
 function moveTo(id){const item=hotspots.get(id);if(!item)return false;return route(item.position[0],item.position[1]+1.6);}
 function interact(){if(near&&!paused)onInteract(near);}
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),-.15);
 function click(e){if(paused)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);const hits=ray.intersectObjects(objects,false);if(hits.length){const item=hotspots.get(hits[0].object.userData.hotspot);if(item){if(near?.id===item.id)interact();else moveTo(item.id);return;}}const p=new THREE.Vector3();if(ray.ray.intersectPlane(plane,p)&&!blocked(p.x,p.z))route(p.x,p.z);}
 function keydown(e){if(paused||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;const k=e.key.toLowerCase();if(k==='f'){e.preventDefault();interact();return;}if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'].includes(k)){e.preventDefault();keys[k]=true;waypoints=[];}}
 function keyup(e){keys[e.key.toLowerCase()]=false;}
 function clearKeys(){for(const k of Object.keys(keys))delete keys[k];touchMove={x:0,y:0};}
 renderer.domElement.addEventListener('click',click);window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',clearKeys);
 const observer=new ResizeObserver(resize);observer.observe(el);function resize(){const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;camera.left=-span*w/h;camera.right=span*w/h;camera.top=span;camera.bottom=-span;camera.updateProjectionMatrix();renderer.setSize(w,h,false);}resize();
 let last=performance.now(),walkTime=0,lastSaved=0;
 function tick(now){frame=requestAnimationFrame(tick);const dt=THREE.MathUtils.clamp((now-last)/1000,0,.05);last=now;
  if(!paused){const sx=(keys.arrowright||keys.d?1:0)-(keys.arrowleft||keys.a?1:0)+touchMove.x,sy=(keys.arrowdown||keys.s?1:0)-(keys.arrowup||keys.w?1:0)+touchMove.y;
   if(sx||sy){waypoints=[];const dx=sx*.76+sy*.65,dz=sy*.76-sx*.65;target.set(player.position.x+dx,.15,player.position.z+dz);}
   const delta=target.clone().sub(player.position),distance=delta.length();if(distance>.035){const velocity=delta.normalize().multiplyScalar(Math.min(dt*4.5,distance));const nx=player.position.x+velocity.x,nz=player.position.z+velocity.z;if(!blocked(nx,player.position.z))player.position.x=nx;if(!blocked(player.position.x,nz))player.position.z=nz;player.rotation.y=Math.atan2(velocity.x,velocity.z);playerTag.quaternion.copy(player.quaternion.clone().invert());walkTime+=dt;coat.position.y=.52+Math.sin(walkTime*15)*.028;}if(player.position.distanceTo(target)<.06&&waypoints.length)target.copy(waypoints.shift());
   let next=null,distanceTo=2.7;for(const item of hotspots.values()){if(indoors===['entrance','publish','report'].includes(item.type))continue;const distance=player.position.distanceTo(new THREE.Vector3(item.position[0],.15,item.position[1]));if(distance<distanceTo){distanceTo=distance;next=item;}}near=next;
   if(near?.id!==previousNear){previousNear=near?.id;if(outline){scene.remove(outline);outline.geometry.dispose();outline.material.dispose();outline=null;}if(near?.group){outline=new THREE.BoxHelper(near.group,0xf8df35);outline.material.depthTest=false;outline.renderOrder=20;scene.add(outline);}onNear(near);}
   if(now-lastSaved>1600){lastSaved=now;onMove?.({x:player.position.x,z:player.position.z,inside:indoors});}
  }
  look.lerp(player.position,1-Math.exp(-dt*7));camera.position.set(look.x+12,14,look.z+16);camera.lookAt(look.x,0,look.z);playerRing.position.set(player.position.x,.16,player.position.z);renderer.render(scene,camera);
 }tick(last);
 function teleport(x,z,isInside){indoors=isInside;player.position.set(x,.15,z);look.copy(player.position);target.copy(player.position);waypoints=[];clearKeys();previousNear=null;onNear(null);onMove?.({x:player.position.x,z:player.position.z,inside:indoors});}
 async function updateReports(reports){for(const node of reportObjects){scene.remove(node);node.traverse(n=>{n.geometry?.dispose();n.material?.map?.dispose();n.material?.dispose();});}reportObjects.length=0;for(const id of [...hotspots.keys()])if(id.startsWith('report-'))hotspots.delete(id);for(let i=objects.length-1;i>=0;i--)if(objects[i].userData.hotspot?.startsWith('report-'))objects.splice(i,1);
  reports.slice(0,6).forEach((report,i)=>{const x=17+(i%3)*3.1,z=10+Math.floor(i/3)*3.6;const group=new THREE.Group();group.position.set(x,0,z);scene.add(group);reportObjects.push(group);box(2.5,.15,.7,0x797756,0,.1,0,group);box(.12,2.3,.12,0x6c6752,-.85,1.15,0,group);box(.12,2.3,.12,0x6c6752,.85,1.15,0,group);
   const canvas=document.createElement('canvas');canvas.width=512;canvas.height=640;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff8e4';ctx.fillRect(0,0,512,640);ctx.fillStyle='#31513c';ctx.font='bold 24px sans-serif';ctx.fillText(report.title.slice(0,18),22,46);ctx.font='18px sans-serif';ctx.fillText(`${report.name} 탐험가`,22,600);ctx.fillStyle='#8e9a7a';ctx.font='18px sans-serif';ctx.fillText('다가가서 F · 보고서 읽기',22,628);
   const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const paper=add(new THREE.PlaneGeometry(2.2,2.75),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,toneMapped:false}),group,0,1.8,.08);const frame=box(2.35,2.9,.08,0xb8a57d,0,1.8,0,group);const image=new Image();image.onload=()=>{ctx.drawImage(image,22,75,468,370);ctx.fillStyle='#6b7c5d';ctx.font='18px sans-serif';const lines=(report.features||'').match(/.{1,24}/g)||[];lines.slice(0,4).forEach((line,j)=>ctx.fillText(line,22,485+j*24));texture.needsUpdate=true;};image.src=report.photos[0];hot(`report-${report.id}`,'report',report.title,[x,z],group,{report});
  });
 }
 return {moveTo,interact,teleport,updateReports,getPosition:()=>({x:player.position.x,z:player.position.z,inside:indoors}),pause(value){paused=value;clearKeys();if(value){waypoints=[];target.copy(player.position);}},setTouch(x,y){touchMove={x,y};},zoom(delta){span=THREE.MathUtils.clamp(span+delta,4.5,12);resize();},setAvatar(color,name){coat.material.color.set(color);const replacement=plaque(name||'나의 탐험가',1.6,.3,true);playerTag.material.map.dispose();playerTag.material.map=replacement.material.map;},dispose(){destroyed=true;cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',clearKeys);renderer.domElement.removeEventListener('click',click);disposeModel(scene);renderer.dispose();}};
}
