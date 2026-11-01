import {artifacts} from './artifacts.js';
import {artifactSprite} from './artifact-sprites.js';

const TILE_W=64,TILE_H=32;
const COLLECTION=[[4,1],[8,1],[4,-3.5],[8,-3.5],[6,-8]];
const ART={
 building:'/art/museum-building.png',gate:'/art/museum-gate.png',stone:'/art/stone-tile.png',wood:'/art/wood-tile.png',wall:'/art/gallery-wall.png',
 case:'/art/props/display-case.png',tree:'/art/props/tree.png',flowers:'/art/props/flower-planter.png',bench:'/art/props/bench.png',screen:'/art/props/video-screen.png',desk:'/art/props/writing-desk.png',frame:'/art/props/report-frame.png',
 short:'/art/sprites/avatar-short.png',bob:'/art/sprites/avatar-bob.png'
};
const project=(x,z)=>({x:(x-z)*TILE_W/2,y:(x+z)*TILE_H/2});
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

function alphaRect(image,source){
 const sx=source?.x||0,sy=source?.y||0,sw=source?.w||image.naturalWidth,sh=source?.h||image.naturalHeight;
 const canvas=document.createElement('canvas');canvas.width=sw;canvas.height=sh;const ctx=canvas.getContext('2d',{willReadFrequently:true});
 ctx.drawImage(image,sx,sy,sw,sh,0,0,sw,sh);
 try{
  const pixels=ctx.getImageData(0,0,sw,sh).data;let left=sw,top=sh,right=0,bottom=0;
  for(let y=0;y<sh;y++)for(let x=0;x<sw;x++)if(pixels[(y*sw+x)*4+3]>18){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
  if(left<=right&&top<=bottom)return {x:sx+left,y:sy+top,w:right-left+1,h:bottom-top+1};
 }catch{}
 return {x:sx,y:sy,w:sw,h:sh};
}

export function createGameWorld(el,{onInteract=()=>{},onNear=()=>{},onMove=()=>{},inside=false,avatarColor='#e8cf91',avatarName='나의 탐험가',avatarHair='short'}={}){
 const canvas=document.createElement('canvas');canvas.setAttribute('aria-label','캐릭터를 움직여 탐험하는 고려청자 박물관');canvas.style.cssText='display:block;width:100%;height:100%;touch-action:none';el.append(canvas);
 const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw Error('박물관 지도를 그릴 수 없어요.');
 const images=new Map(),artifactImages=new Map(),spriteFrames=new Map(),recolored=new Map(),hotspots=new Map(),obstacles=[],retryTimers=new Set(),rasters=new Map();
 let width=1,height=1,pixelRatio=1,zoom=1.12,indoors=inside,paused=false,destroyed=false,near=null,lastNear=null,frame,waypoints=[],walking=false,walkTime=0,direction='front',flip=false;
 let player={x:inside?-2:0,z:inside?2.7:11},target={...player},camera=project(player.x,player.z),touch={x:0,y:0},keys={},reports=[];
 let name=avatarName,color=avatarColor,hair=avatarHair==='bob'?'bob':'short';
 const decorations=[];

 function imageAsset(key,url,optional=false){
  return new Promise(resolve=>{if(destroyed){resolve(false);return;}const image=new Image();image.onload=()=>{if(!destroyed){images.set(key,{image,rect:alphaRect(image)});canvas.dataset.assetsReady=String(Object.keys(ART).every(name=>name==='wall'||images.has(name)));}resolve(true);};image.onerror=()=>{resolve(false);if(!destroyed&&!optional){const timer=setTimeout(()=>{retryTimers.delete(timer);imageAsset(key,url);},5000);retryTimers.add(timer);}};image.src=url;});
 }
 const assetPromises=Object.entries(ART).map(([key,url])=>imageAsset(key,url,key==='wall'));
 const ready=Promise.all(assetPromises).then(()=>{if(!destroyed)canvas.dataset.assetsReady=String(Object.keys(ART).every(name=>name==='wall'||images.has(name)));});
 for(const artifact of artifacts)artifactSprite(artifact).then(image=>{if(!destroyed)artifactImages.set(artifact.id,{image,rect:alphaRect(image)});}).catch(()=>{});
 const hot=(id,type,label,x,z,extra={})=>{const item={id,type,name:label,position:[x,z],...extra};hotspots.set(id,item);return item;};
 hot('entrance','entrance','박물관 입장',0,7);
 hot('exit','exit','관람을 마치고 나가기',0,3.4);
 hot('video','video','고려청자 제작 영상',-6,-3);
 hot('desk','desk','관람 보고서 작성',0,-12);
 hot('publish','publish','내 보고서 전시하기',14,17);
 hot('online-3d','external','온라인 3D 추가 자료',10,-12);obstacles.push({x:10,z:-12,w:1.1,d:.9});
 artifacts.forEach((artifact,i)=>{const [x,z]=COLLECTION[i];hot(artifact.id,'artifact',artifact.name,x,z,{artifact,index:i});obstacles.push({x,z,w:1.05,d:.95});});
 obstacles.push({x:-6,z:-3,w:1.7,d:1.0},{x:0,z:-12,w:1.6,d:.9},{x:14,z:17,w:1,d:.8});
 const decor=(kind,x,z,w,extra={})=>decorations.push({kind,x,z,w,...extra});
 // An entrance garden with a real illustrated building, trees and flowerbeds.
 decor('building',0,5.5,510,{outside:true});decor('building',20,6.0,340,{outside:true});decor('gate',-1,23.2,300,{outside:true});
 for(const [x,z,w]of [[-9,9,165],[-10,20,150],[9,23,158],[25,7,180],[25,22,155],[-10,-12,130]]){decor('tree',x,z,w,{outside:z>4});if(z>4)obstacles.push({x,z,w:.6,d:.6});}
 for(let x=-7;x<=11;x+=2.5)decor('flowers',x,24,104,{outside:true});
 for(let z=8;z<22;z+=3.2){decor('flowers',-6,z,92,{outside:true});decor('flowers',23,z,92,{outside:true});}
 for(const [x,z]of [[-3,16],[7,20],[20,21],[-8,-10],[-8,1],[0,-6]])decor('bench',x,z,112,{outside:z>4});
 for(const [x,z]of [[-10,-13],[10,-13],[-10,2],[10,2]])decor('flowers',x,z,95,{inside:true});

 function ground(x,z){return project(x,z);}
 function screen(x,z){const p=ground(x,z);return {x:(p.x-camera.x)*zoom+width/2,y:(p.y-camera.y)*zoom+height*.55};}
 function unscreen(px,py){const x=(px-width/2)/zoom+camera.x,y=(py-height*.55)/zoom+camera.y;return {x:x/TILE_W+y/TILE_H,z:y/TILE_H-x/TILE_W};}
 function diamond(x,z,w=1,d=1){const a=screen(x-w/2,z-d/2),b=screen(x+w/2,z-d/2),c=screen(x+w/2,z+d/2),e=screen(x-w/2,z+d/2);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.lineTo(e.x,e.y);ctx.closePath();return [a,b,c,e];}
 function region(x0,z0,x1,z1,color,edge=true){
  const points=[screen(x0,z0),screen(x1,z0),screen(x1,z1),screen(x0,z1)];
  if(edge){ctx.fillStyle='#6e864c';ctx.beginPath();ctx.moveTo(points[1].x,points[1].y);ctx.lineTo(points[2].x,points[2].y);ctx.lineTo(points[2].x,points[2].y+32*zoom);ctx.lineTo(points[1].x,points[1].y+32*zoom);ctx.closePath();ctx.fill();ctx.fillStyle='#809452';ctx.beginPath();ctx.moveTo(points[2].x,points[2].y);ctx.lineTo(points[3].x,points[3].y);ctx.lineTo(points[3].x,points[3].y+32*zoom);ctx.lineTo(points[2].x,points[2].y+32*zoom);ctx.closePath();ctx.fill();}
  ctx.fillStyle=color;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();
 }
 function raster(key,asset,logicalWidth,logicalHeight){
  const cacheKey=`${key}:${logicalWidth}:${logicalHeight}`;
  if(rasters.has(cacheKey))return rasters.get(cacheKey);
  const r=asset.rect,image=document.createElement('canvas');
  image.width=Math.min(r.w,Math.max(1,Math.ceil(logicalWidth*1.5)));image.height=Math.min(r.h,Math.max(1,Math.ceil(logicalHeight*1.5)));
  const context=image.getContext('2d');context.imageSmoothingEnabled=true;context.drawImage(asset.image,r.x,r.y,r.w,r.h,0,0,image.width,image.height);rasters.set(cacheKey,image);return image;
 }
 function floorAtlas(kind,x0,z0,x1,z1,span=1){
  const asset=images.get(kind);if(!asset)return;
  const key=`floor:${kind}:${x0}:${z0}:${x1}:${z1}:${span}`;
  let atlas=rasters.get(key);
  if(!atlas){
   const left=(x0-z1)*TILE_W/2,top=(x0+z0)*TILE_H/2,right=(x1-z0)*TILE_W/2,bottom=(x1+z1)*TILE_H/2,scale=1;
   const image=document.createElement('canvas');image.width=Math.ceil((right-left)*scale);image.height=Math.ceil((bottom-top)*scale);
   const context=image.getContext('2d');context.setTransform(scale,0,0,scale,-left*scale,-top*scale);
   context.beginPath();[[x0,z0],[x1,z0],[x1,z1],[x0,z1]].forEach(([x,z],i)=>{const p=project(x,z);i?context.lineTo(p.x,p.y):context.moveTo(p.x,p.y);});context.closePath();context.clip();
   const tile=raster(kind,asset,TILE_W*span,TILE_H*span),w=TILE_W*span,h=TILE_H*span;
   for(let z=z0+span/2;z<z1;z+=span)for(let x=x0+span/2;x<x1;x+=span){
    const p=project(x,z);context.drawImage(tile,p.x-w/2-.4,p.y-h/2-.3,w+.8,h+.6);
    context.strokeStyle=kind==='wood'?'#a98b6040':'#b7b08d40';context.lineWidth=.7;context.beginPath();context.moveTo(p.x,p.y-h/2);context.lineTo(p.x+w/2,p.y);context.lineTo(p.x,p.y+h/2);context.lineTo(p.x-w/2,p.y);context.closePath();context.stroke();
   }
   atlas={image,left,top,width:right-left,height:bottom-top};rasters.set(key,atlas);
  }
  const origin=screen(0,0);ctx.save();ctx.imageSmoothingEnabled=true;ctx.drawImage(atlas.image,origin.x+atlas.left*zoom,origin.y+atlas.top*zoom,atlas.width*zoom,atlas.height*zoom);ctx.restore();
 }
 function wallStrip(x0,z0,x1,z1){
  const a=screen(x0,z0),b=screen(x1,z1),h=115*zoom;
  ctx.fillStyle='#e6dec4';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(b.x,b.y-h);ctx.lineTo(a.x,a.y-h);ctx.closePath();ctx.fill();ctx.strokeStyle='#d2c2a2';ctx.lineWidth=5*zoom;ctx.stroke();
  ctx.strokeStyle='#bca582';ctx.lineWidth=2*zoom;ctx.beginPath();ctx.moveTo(a.x,a.y-7*zoom);ctx.lineTo(b.x,b.y-7*zoom);ctx.stroke();
  const asset=images.get('wall');
  if(asset){
   // The illustration is one L-shaped room corner. Project its flat left face
   // onto each wall plane rather than repeating the entire corner as a prop.
   const count=Math.max(1,Math.ceil(Math.hypot(x1-x0,z1-z0)/5));
   const scaleX=asset.image.naturalWidth/1536,scaleY=asset.image.naturalHeight/1024;
   const source={x:200*scaleX,y:885*scaleY,ux:578*scaleX,uy:-280*scaleY,vy:-398*scaleY};
   for(let i=0;i<count;i++){
    const t0=i/count,t1=(i+1)/count,p={x:a.x+(b.x-a.x)*t0,y:a.y+(b.y-a.y)*t0},q={x:a.x+(b.x-a.x)*t1,y:a.y+(b.y-a.y)*t1};
    const mx=(q.x-p.x)/source.ux,my=((q.y-p.y)+h*source.uy/source.vy)/source.ux,ny=-h/source.vy;
    ctx.save();ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.lineTo(q.x,q.y-h);ctx.lineTo(p.x,p.y-h);ctx.closePath();ctx.clip();ctx.imageSmoothingEnabled=false;
    ctx.transform(mx,my,0,ny,p.x-mx*source.x,p.y-my*source.x-ny*source.y);ctx.drawImage(asset.image,0,0);ctx.restore();
   }
  }
  ctx.strokeStyle='#344c5b';ctx.lineWidth=7*zoom;ctx.beginPath();ctx.moveTo(a.x,a.y-h+2*zoom);ctx.lineTo(b.x,b.y-h+2*zoom);ctx.stroke();
 }
 function drawSprite(kind,x,z,displayWidth,{height:displayHeight,offsetY=0,alpha=1,mirror=false}={}){
  const asset=images.get(kind);if(!asset)return false;const p=screen(x,z),r=asset.rect,logicalHeight=displayHeight||displayWidth*r.h/r.w,w=displayWidth*zoom,h=logicalHeight*zoom,image=raster(kind,asset,displayWidth,logicalHeight);
  ctx.save();ctx.globalAlpha=alpha;ctx.imageSmoothingEnabled=false;if(mirror){ctx.translate(p.x,p.y-offsetY*zoom);ctx.scale(-1,1);ctx.drawImage(image,-w/2,-h,w,h);}else ctx.drawImage(image,p.x-w/2,p.y-h-offsetY*zoom,w,h);ctx.restore();return true;
 }
 function shadow(x,z,w=75,h=20){const p=screen(x,z);ctx.fillStyle='#3852381a';ctx.beginPath();ctx.ellipse(p.x,p.y,w*zoom/2,h*zoom/2,0,0,Math.PI*2);ctx.fill();}
 function plaque(text,x,z,{offset=0,width:boxWidth=130,dark=false,size=10}={}){
  const p=screen(x,z);ctx.save();ctx.translate(p.x,p.y-offset*zoom);ctx.font=`${Math.max(8,size*zoom)}px "Noto Sans KR",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';const w=Math.min(boxWidth*zoom,ctx.measureText(text).width+20*zoom),h=23*zoom;
  ctx.fillStyle=dark?'#304836ed':'#fbf7e6ed';ctx.strokeStyle=dark?'#d9e6bc60':'#d9d7b3';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(-w/2,-h/2,w,h,4*zoom);ctx.fill();ctx.stroke();ctx.fillStyle=dark?'#f8efcb':'#536746';ctx.fillText(text,0,0,w-8*zoom);ctx.restore();
 }
 function portal(item){const p=screen(...item.position),pulse=.72+Math.sin(performance.now()/550)*.1;ctx.save();ctx.globalAlpha=.5;ctx.fillStyle='#fff8c9';ctx.beginPath();ctx.ellipse(p.x,p.y,38*zoom,17*zoom,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=pulse;ctx.strokeStyle='#dfbf42';ctx.lineWidth=5*zoom;ctx.beginPath();ctx.ellipse(p.x,p.y,29*zoom,13*zoom,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
 function highlight(item,w=1.95,d=1.6){ctx.save();ctx.strokeStyle='#f8dc39';ctx.lineWidth=3*zoom;ctx.shadowColor='#f4d632';ctx.shadowBlur=7*zoom;diamond(item.position[0],item.position[1],w,d);ctx.stroke();ctx.restore();}
 function drawArtifact(item){
  const [x,z]=item.position,selected=near?.id===item.id;shadow(x,z,110,30);if(selected)highlight(item);
  const asset=images.get('case');let caseHeight=140;
  if(asset){caseHeight=Math.min(165,145*asset.rect.h/asset.rect.w);drawSprite('case',x,z,145,{height:caseHeight});}
  const snapshot=artifactImages.get(item.id),p=screen(x,z);
  if(snapshot){const r=snapshot.rect;let h=item.artifact.photoPoster?55:Math.min(69,caseHeight*.5),w=h*r.w/r.h;
   if(w>85){h*=85/w;w=85;}ctx.save();ctx.imageSmoothingEnabled=true;ctx.drawImage(snapshot.image,r.x,r.y,r.w,r.h,p.x-w*zoom/2,p.y-(caseHeight*.33+h)*zoom,w*zoom,h*zoom);ctx.restore();}
  plaque(`${item.index+1}. ${item.artifact.name.replace('청자 투각 칠보무늬 향로','칠보무늬 향로')}`,x,z,{offset:-17,width:160,size:9});
 }
 function drawVideo(item){const [x,z]=item.position;if(near?.id===item.id)highlight(item,3,2);shadow(x,z,150,35);drawSprite('screen',x,z,235,{height:185});const p=screen(x,z);ctx.save();ctx.fillStyle='#fcf6d8';ctx.shadowColor='#193c35';ctx.shadowBlur=6;ctx.beginPath();ctx.moveTo(p.x-12*zoom,p.y-104*zoom);ctx.lineTo(p.x-12*zoom,p.y-68*zoom);ctx.lineTo(p.x+18*zoom,p.y-86*zoom);ctx.closePath();ctx.fill();ctx.restore();plaque('청자는 어떻게 만들어질까요?',x,z,{offset:-17,width:200,size:10,dark:true});}
 function drawExternal(item){const [x,z]=item.position;if(near?.id===item.id)highlight(item,2.3,1.6);shadow(x,z,110,25);drawSprite('screen',x,z,140,{height:120});plaque('온라인 3D 추가 자료',x,z,{offset:-16,width:160,size:9,dark:true});}
 function drawDesk(item){const [x,z]=item.position;if(near?.id===item.id)highlight(item,2.7,1.8);shadow(x,z,120,30);drawSprite('desk',x,z,175,{height:135});plaque(item.type==='publish'?'내 보고서 걸기':'나의 관람 보고서',x,z,{offset:-16,width:165,dark:true});}
 function drawReport(item){const [x,z]=item.position;if(near?.id===item.id)highlight(item,2.4,1.2);shadow(x,z,125,25);drawSprite('frame',x,z,155,{height:175});const p=screen(x,z),image=item.poster;
  if(image){ctx.save();ctx.imageSmoothingEnabled=true;ctx.fillStyle='#fff9e8';ctx.fillRect(p.x-46*zoom,p.y-137*zoom,92*zoom,102*zoom);ctx.drawImage(image,p.x-42*zoom,p.y-132*zoom,84*zoom,66*zoom);ctx.font=`${8*zoom}px sans-serif`;ctx.fillStyle='#547348';ctx.textAlign='center';ctx.fillText(item.report.name+' 탐험가',p.x,p.y-47*zoom,82*zoom);ctx.restore();}plaque(item.report.title,x,z,{offset:-16,width:160,size:9});}

 function prepareFrame(asset,row,column){
  const key=`${hair}:${row}:${column}`;if(spriteFrames.has(key))return spriteFrames.get(key);
  const w=Math.floor(asset.image.naturalWidth/4),h=Math.floor(asset.image.naturalHeight/3),rect=alphaRect(asset.image,{x:column*w,y:row*h,w,h});spriteFrames.set(key,rect);return rect;
 }
 function playerFrame(asset,row,column){
  const r=prepareFrame(asset,row,column),key=`${hair}:${row}:${column}:${color}`;
  if(recolored.has(key))return {image:recolored.get(key),rect:{x:0,y:0,w:r.w,h:r.h}};
  if(color==='#e8cf91'||color==='#eccd79')return {image:asset.image,rect:r};
  const c=document.createElement('canvas');c.width=r.w;c.height=r.h;const context=c.getContext('2d',{willReadFrequently:true});context.drawImage(asset.image,r.x,r.y,r.w,r.h,0,0,r.w,r.h);
  try{const data=context.getImageData(0,0,r.w,r.h),rgb=color.replace('#','').match(/.{2}/g).map(n=>parseInt(n,16));
   // Only warm-colored torso pixels are selectable clothing. Skin/hair/eyes and
   // the dark pixel outlines are outside this mask and retain the generated art.
   for(let y=Math.floor(r.h*.5);y<r.h*.79;y++)for(let x=0;x<r.w;x++){const i=(y*r.w+x)*4,R=data.data[i],G=data.data[i+1],B=data.data[i+2];if(data.data[i+3]>10&&R>110&&G>85&&R>B*1.22&&G>B*1.05){const luminance=(R+G+B)/3/175;for(let channel=0;channel<3;channel++)data.data[i+channel]=clamp(rgb[channel]*luminance,0,255);}}
   context.putImageData(data,0,0);
  }catch{}
  recolored.set(key,c);return {image:c,rect:{x:0,y:0,w:r.w,h:r.h}};
 }
 function drawPlayer(){
  const p=screen(player.x,player.z);shadow(player.x,player.z,37,12);ctx.strokeStyle='#fff3bc';ctx.lineWidth=2*zoom;ctx.beginPath();ctx.ellipse(p.x,p.y,17*zoom,7*zoom,0,0,Math.PI*2);ctx.stroke();
  const asset=images.get(hair);if(asset){const row=direction==='back'?1:direction==='right'?2:0,column=walking?1+Math.floor(walkTime*8)%3:0,{image,rect}=playerFrame(asset,row,column),h=65*zoom,w=h*rect.w/rect.h;
   ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(p.x,p.y-3*zoom);if(flip)ctx.scale(-1,1);ctx.drawImage(image,rect.x,rect.y,rect.w,rect.h,-w/2,-h,w,h);ctx.restore();}
  plaque(name,player.x,player.z,{offset:85,width:145,size:10,dark:true});
 }
 function paintBackground(){const gradient=ctx.createLinearGradient(0,0,0,height);gradient.addColorStop(0,indoors?'#dae0d3':'#e2f1e8');gradient.addColorStop(1,indoors?'#c7cfb8':'#c9dcc5');ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
  if(!indoors){ctx.save();ctx.globalAlpha=.38;ctx.fillStyle='#fdfbf1';for(const [x,y,w]of [[width*.12,height*.12,180],[width*.87,height*.36,230],[width*.1,height*.8,210]]){ctx.beginPath();ctx.ellipse(x,y,w,45,0,0,Math.PI*2);ctx.fill();}ctx.restore();}}
 function paint(){
  ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);paintBackground();
  if(indoors){region(-12,-16,12,4.5,'#baa179');floorAtlas('wood',-12,-16,12,4,4);wallStrip(-12,-16,12,-16);wallStrip(-12,-16,-12,4.5);
   plaque('먼저 영상을 보고 청자를 만나 보세요',-6,-12,{offset:110,width:290,dark:true,size:12});plaque('고려의 쓰임과 아름다움',6,-13,{offset:105,width:260,dark:true,size:12});
  }else{
   region(-12,5,26,25,'#9bb477');region(-8,6,23.5,24,'#e1d7ad',false);
   floorAtlas('stone',-8,6,23.5,24);
   // A lily pond is a simple ground surface; illustrated trees/planters surround it.
   region(-11,12,-7,20,'#9fcfc6',false);ctx.save();ctx.strokeStyle='#d9e9d3';ctx.lineWidth=2*zoom;const a=screen(-10.7,12.3),b=screen(-7.3,19.7);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore();
   plaque('고려청자박물관',0,6,{offset:235,width:300,dark:true,size:16});plaque('우리들의 발견 전시 마당',19,8,{offset:130,width:300,dark:true,size:14});
  }
  const visibleDecor=decorations.filter(d=>indoors?d.inside||d.z<4:!d.inside&&d.z>4);
  const commands=visibleDecor.map(d=>({depth:d.x+d.z,draw:()=>{shadow(d.x,d.z,d.w*.65,25);drawSprite(d.kind,d.x,d.z,d.w);}}));
  for(const item of hotspots.values()){
   const outdoor=['entrance','publish','report'].includes(item.type);if(indoors===outdoor)continue;
   if(item.type==='entrance'||item.type==='exit'){portal(item);plaque(item.type==='entrance'?'입장하기 · F':'관람 마치기 · F',...item.position,{offset:41,width:155,dark:true});continue;}
   commands.push({depth:item.position[0]+item.position[1],draw:()=>item.type==='artifact'?drawArtifact(item):item.type==='video'?drawVideo(item):item.type==='external'?drawExternal(item):item.type==='report'?drawReport(item):drawDesk(item)});
  }
  commands.push({depth:player.x+player.z+.12,draw:drawPlayer});commands.sort((a,b)=>a.depth-b.depth);for(const command of commands)command.draw();
 }
 function blocked(x,z){if(x< -11.1||x>25||z< -14.6||z>24)return true;if(!indoors&&z<5.2)return true;if(indoors&&(z>4.1||x>11.1))return true;return obstacles.some(o=>Math.abs(x-o.x)<o.w&&Math.abs(z-o.z)<o.d);}
 function route(x,z){
  if(blocked(x,z))return false;
  const step=.5,toCell=(x,z)=>[Math.round((x+11)/step),Math.round((z+15)/step)],start=toCell(player.x,player.z),end=toCell(x,z),key=(x,z)=>`${x},${z}`,queue=[start],parents=new Map([[key(...start),null]]);let found=null;
  for(let i=0;i<queue.length;i++){const [cx,cz]=queue[i];if(cx===end[0]&&cz===end[1]){found=queue[i];break;}for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=cx+dx,nz=cz+dz;if(parents.has(key(nx,nz))||blocked(nx*step-11,nz*step-15))continue;parents.set(key(nx,nz),[cx,cz]);queue.push([nx,nz]);}}
  waypoints=[];while(found){waypoints.unshift({x:found[0]*step-11,z:found[1]*step-15});found=parents.get(key(...found));}if(!waypoints.length)return false;waypoints.shift();waypoints.push({x,z});target=waypoints.shift()||{...player};return true;
 }
 function moveTo(id){const item=hotspots.get(id);return item?route(item.position[0],item.position[1]+(item.type==='exit'?-1.6:1.7)):false;}
 function clearKeys(){keys={};touch={x:0,y:0};waypoints=[];target={...player};}
 function interact(){if(near&&!paused)onInteract(near);}
 function pointer(event){if(paused)return;const rect=canvas.getBoundingClientRect(),p={x:event.clientX-rect.left,y:event.clientY-rect.top};
  let closest=null,distance=Infinity;
  for(const item of hotspots.values()){if(indoors===['entrance','publish','report'].includes(item.type))continue;const s=screen(...item.position),dx=Math.abs(p.x-s.x),dy=p.y-s.y;const limit=item.type==='video'?120:90;
   if(dx<limit*zoom&&dy<30*zoom&&dy>-(item.type==='video'?190:160)*zoom){const d=dx+Math.abs(dy+50*zoom)*.5;if(d<distance){distance=d;closest=item;}}}
  if(closest){if(near?.id===closest.id)interact();else moveTo(closest.id);return;}const world=unscreen(p.x,p.y);route(world.x,world.z);
 }
 function keyDown(event){if(paused||/INPUT|TEXTAREA|SELECT/.test(event.target.tagName))return;const key=event.key.toLowerCase();if(key==='f'){event.preventDefault();interact();return;}if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'].includes(key)){event.preventDefault();keys[key]=true;waypoints=[];}}
 function keyUp(event){const key=event.key.toLowerCase(),wasMoving=Boolean(keys[key]);delete keys[key];if(wasMoving&&!Object.values(keys).some(Boolean)&&!touch.x&&!touch.y){target={...player};waypoints=[];}}
 canvas.addEventListener('click',pointer);window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);window.addEventListener('blur',clearKeys);
 function resize(){const rect=el.getBoundingClientRect();width=rect.width;height=rect.height;pixelRatio=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*pixelRatio);canvas.height=Math.round(height*pixelRatio);}
 const observer=new ResizeObserver(resize);observer.observe(el);resize();
 let last=performance.now(),lastSaved=0;
 function tick(now){if(destroyed)return;frame=requestAnimationFrame(tick);const elapsed=clamp((now-last)/1000,0,.25);last=now;walking=false;
  if(!paused){const sx=(keys.arrowright||keys.d?1:0)-(keys.arrowleft||keys.a?1:0)+touch.x,sy=(keys.arrowdown||keys.s?1:0)-(keys.arrowup||keys.w?1:0)+touch.y;
   // Keep walking tied to elapsed time on slower devices. Small substeps retain
   // collision checks and visit every route waypoint even when a frame is late.
   let remaining=elapsed;
   while(remaining>0){const dt=Math.min(remaining,.05);remaining-=dt;
    if(sx||sy){waypoints=[];target={x:player.x+sx+sy,z:player.z+sy-sx};}
    const dx=target.x-player.x,dz=target.z-player.z,d=Math.hypot(dx,dz);if(d>.025){const distance=Math.min(dt*4.1,d),vx=dx/d*distance,vz=dz/d*distance;
     if(!blocked(player.x+vx,player.z))player.x+=vx;if(!blocked(player.x,player.z+vz))player.z+=vz;
     walking=true;walkTime+=dt;const screenX=vx-vz,screenY=(vx+vz)*.5;if(Math.abs(screenX)>Math.abs(screenY)*1.2){direction='right';flip=screenX<0;}else{direction=screenY<0?'back':'front';flip=false;}
    }
    if(Math.hypot(target.x-player.x,target.z-player.z)<.06&&waypoints.length)target=waypoints.shift();
   }
   let next=null,distance=2.65;for(const item of hotspots.values()){if(indoors===['entrance','publish','report'].includes(item.type))continue;const d=Math.hypot(player.x-item.position[0],player.z-item.position[1]);if(d<distance){next=item;distance=d;}}near=next;
   if(near?.id!==lastNear){lastNear=near?.id;onNear(near);}
   if(now-lastSaved>1600){lastSaved=now;onMove({x:player.x,z:player.z,inside:indoors});}
  }
  const p=project(player.x,player.z),ease=1-Math.exp(-elapsed*8);camera.x+=(p.x-camera.x)*ease;camera.y+=(p.y-camera.y)*ease;paint();
 }
 tick(last);
 return {ready,moveTo,interact,getPosition:()=>({x:player.x,z:player.z,inside:indoors}),teleport(x,z,isInside){indoors=isInside;player={x,z};target={...player};camera=project(x,z);waypoints=[];clearKeys();lastNear=null;near=null;onNear(null);onMove({x,z,inside:indoors});},pause(value){paused=value;keys={};touch={x:0,y:0};if(value){waypoints=[];target={...player};}},setTouch(x,y){const wasMoving=touch.x||touch.y;touch={x,y};if(wasMoving&&!x&&!y&&!Object.values(keys).some(Boolean)){target={...player};waypoints=[];}},zoom(delta){zoom=clamp(zoom-delta*.1,.58,1.8);},setAvatar(nextColor,nextName,nextHair=hair){color=nextColor;name=nextName||'나의 탐험가';hair=nextHair==='bob'?'bob':'short';},updateReports(nextReports){reports=nextReports.slice(0,6);for(const id of [...hotspots.keys()])if(id.startsWith('report-'))hotspots.delete(id);reports.forEach((report,i)=>{const x=17+(i%3)*3.1,z=10+Math.floor(i/3)*3.6,item=hot(`report-${report.id}`,'report',report.title,x,z,{report});const image=new Image();image.onload=()=>{if(!destroyed)item.poster=image;};image.src=report.photos[0];});},dispose(){destroyed=true;cancelAnimationFrame(frame);for(const timer of retryTimers)clearTimeout(timer);retryTimers.clear();observer.disconnect();canvas.removeEventListener('click',pointer);window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',clearKeys);images.clear();artifactImages.clear();spriteFrames.clear();recolored.clear();rasters.clear();canvas.remove();}};
}
