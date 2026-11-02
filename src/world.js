import {artifacts} from './artifacts.js';
import {comparisonArtifacts,comparisonPositions,allObservationArtifacts} from './comparison-artifacts.js';
import {createMapArtifactViewer} from './map-artifact-viewer.js';
import mapArtBounds from './map-art-bounds.js';
import {MAP_LAYOUT,collectionPositions,reportPosition,exhibitionBounds,revisitPosition} from './map-layout.js';
import {createSpriteRaster,SPRITE_MARKERS} from './sprite-geometry.js';
import {TILE_WIDTH as TILE_W,TILE_HEIGHT as TILE_H,projectMap as project} from './projection.js';

const CASE_WIDTH=152;
const ART={
 building:'/art/map/museum-building.webp',gate:'/art/map/museum-gate.webp',stone:'/art/map/stone-tile.webp',wood:'/art/map/wood-tile.webp',wall:'/art/map/gallery-wall.webp',
 case:'/art/map/display-case.webp',tree:'/art/map/tree.webp',flowers:'/art/map/flower-planter.webp',bench:'/art/map/bench.webp',desk:'/art/map/writing-desk.webp',frame:'/art/map/report-frame.webp',
 short:'/art/map/avatar-short.webp',bob:'/art/map/avatar-bob.webp'
};
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
 const images=new Map(),reportPapers=new Map(),spriteFrames=new Map(),recolored=new Map(),hotspots=new Map(),obstacles=[],retryTimers=new Set(),rasters=new Map(),spriteRasters=new Map();
 let dirty=true,courseStage='comparison',renderedFrames=0,lastPaint=0,visibleReportIds=new Set();
 const mapModels=createMapArtifactViewer({onChange:()=>{dirty=true;}});
 canvas.dataset.layoutVersion=MAP_LAYOUT.version;
 let width=1,height=1,pixelRatio=1,zoom=1.12,indoors=inside,paused=false,destroyed=false,near=null,lastNear=null,frame,waypoints=[],walking=false,walkTime=0,direction='front',flip=false;
 let player={x:0,z:inside?4:11},target={...player},camera=project(player.x,player.z),touch={x:0,y:0},keys={},reports=[];
 let name=avatarName,color=avatarColor,hair=avatarHair==='bob'?'bob':'short';
 const decorations=[];

 function imageAsset(key,url,optional=false){
  return new Promise(resolve=>{if(destroyed){resolve(false);return;}const image=new Image();image.onload=()=>{if(!destroyed){images.set(key,{image,rect:mapArtBounds[key]||alphaRect(image)});dirty=true;canvas.dataset.assetsReady=String(Object.keys(ART).every(name=>name==='wall'||images.has(name)));}resolve(true);};image.onerror=()=>{resolve(false);if(!destroyed&&!optional){const timer=setTimeout(()=>{retryTimers.delete(timer);imageAsset(key,url);},5000);retryTimers.add(timer);}};image.decoding='async';image.src=url;});
 }
 const assetPromises=Object.entries(ART).map(([key,url])=>imageAsset(key,url,key==='wall'));
 const ready=Promise.all(assetPromises).then(()=>{if(!destroyed)canvas.dataset.assetsReady=String(Object.keys(ART).every(name=>name==='wall'||images.has(name)));});
 async function reloadArtifact(id){mapModels.reload(id);dirty=true;}
 const sameRoom=item=>item.room===(indoors?'inside':'outside');
 const hot=(id,type,label,x,z,extra={})=>{const item={id,type,name:label,position:[x,z],room:['entrance','publish','report'].includes(type)?'outside':'inside',...extra};hotspots.set(id,item);return item;};
 for(const [id,type,label]of [['entrance','entrance','박물관 입장'],['exit','exit','관람을 마치고 전시실로'],['comparison-desk','comparison-desk','세 점 비교 기록'],['desk','desk','관람 보고서 작성'],['publish','publish','내 보고서 전시하기']])hot(id,type,label,...MAP_LAYOUT.destinations[id]);
 artifacts.forEach((artifact,i)=>{const [x,z]=collectionPositions[i];hot(artifact.id,'artifact',artifact.name,x,z,{artifact,index:i});obstacles.push({x,z,w:1.15,d:1.05,room:'inside'});});
 comparisonArtifacts.forEach((artifact,i)=>{const [x,z]=comparisonPositions[i];hot(artifact.id,'artifact',artifact.name,x,z,{artifact,index:i});obstacles.push({x,z,w:1.15,d:1.05,room:'inside'});});
 allObservationArtifacts.forEach((artifact,i)=>{const [x,z]=revisitPosition(i);hot(`revisit-${artifact.id}`,'artifact',artifact.name,x,z,{artifact,index:i,room:'outside',revisit:true});obstacles.push({x,z,w:1.1,d:1,room:'outside'});});
 for(const id of ['comparison-desk','desk','publish']){const [x,z]=MAP_LAYOUT.destinations[id];obstacles.push({x,z,w:1.6,d:.9,room:id==='publish'?'outside':'inside'});}
 const decor=(kind,x,z,w,room,extra={})=>decorations.push({kind,x,z,w,room,...extra});
 decor('building',0,3,480,'outside',{id:'main-building',align:{point:SPRITE_MARKERS.building.entrance,at:[0,6.25]},label:'고려청자박물관'});
 decor('gate',0,23,270,'outside',{align:{point:SPRITE_MARKERS.gate.opening,at:[0,22.8]}});
 for(const [x,z]of [[-9,8],[-9,23],[52,22],[52,-34]]){decor('tree',x,z,135,'outside');obstacles.push({x,z,w:.65,d:.65,room:'outside'});}
 for(const z of [10,15,20])decor('flowers',-6,z,86,'outside',{mirror:true});
 for(const x of [9,13,17])decor('flowers',x,24,86,'outside');
 decor('bench',4,16,108,'outside');
 for(const z of [-9,-19,-28])decor('bench',-8.2,z,98,'inside');
 for(const [x,z]of [[-8.5,-31],[8.5,-31],[-8.5,4.5],[8.5,4.5]])decor('flowers',x,z,76,'inside',{mirror:x>0});
 function isVisible(x,z,margin=180){const p=screen(x,z);return p.x> -margin&&p.x<width+margin&&p.y> -70&&p.y<height+margin;}
 function visibleRegion(x0,z0,x1,z1){const points=[[x0,z0],[x1,z0],[x1,z1],[x0,z1]].map(p=>screen(...p));return Math.max(...points.map(p=>p.x))>=0&&Math.min(...points.map(p=>p.x))<=width&&Math.max(...points.map(p=>p.y))>=0&&Math.min(...points.map(p=>p.y))<=height;}

 function ground(x,z){return project(x,z);}
 function screen(x,z){const p=ground(x,z);return {x:(p.x-camera.x)*zoom+width/2,y:(p.y-camera.y)*zoom+height*.55};}
 function unscreen(px,py){const x=(px-width/2)/zoom+camera.x,y=(py-height*.55)/zoom+camera.y;return {x:x/TILE_W+y/TILE_H,z:y/TILE_H-x/TILE_W};}
 function diamond(x,z,w=1,d=1){const a=screen(x-w/2,z-d/2),b=screen(x+w/2,z-d/2),c=screen(x+w/2,z+d/2),e=screen(x-w/2,z+d/2);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.lineTo(e.x,e.y);ctx.closePath();return [a,b,c,e];}
 function region(x0,z0,x1,z1,color,edge=true){
  const points=[screen(x0,z0),screen(x1,z0),screen(x1,z1),screen(x0,z1)];
  if(edge){ctx.fillStyle='#6e864c';ctx.beginPath();ctx.moveTo(points[1].x,points[1].y);ctx.lineTo(points[2].x,points[2].y);ctx.lineTo(points[2].x,points[2].y+32*zoom);ctx.lineTo(points[1].x,points[1].y+32*zoom);ctx.closePath();ctx.fill();ctx.fillStyle='#809452';ctx.beginPath();ctx.moveTo(points[2].x,points[2].y);ctx.lineTo(points[3].x,points[3].y);ctx.lineTo(points[3].x,points[3].y+32*zoom);ctx.lineTo(points[2].x,points[2].y+32*zoom);ctx.closePath();ctx.fill();}
  ctx.fillStyle=color;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();
 }
 function floorMaterial(kind,index){
  const key=`floor-material:${kind}:${index}`;if(rasters.has(key))return rasters.get(key);
  const asset=images.get(kind),wood=kind==='wood';
  // These source parallelograms lie entirely inside individual planks/pavers.
  // Their generated grain survives; none includes a painted joint or tile rim.
  const patches=wood?[[850,100],[770,142],[1044,212],[632,432],[1132,562],[852,662]]:[[880,215],[982,232],[1042,412],[742,502],[850,112]];
  const [cx,cy]=patches[index%patches.length],u=wood?[90,50.4]:[40,20.64],v=wood?[-20,10.6]:[-40,19.28];
  const rx=asset.image.naturalWidth/1774,ry=asset.image.naturalHeight/887;
  const ux=u[0]*rx,uy=u[1]*ry,vx=v[0]*rx,vy=v[1]*ry,sourceX=cx*rx-(ux+vx)/2,sourceY=cy*ry-(uy+vy)/2,det=ux*vy-vx*uy;
  const image=document.createElement('canvas');image.width=wood?128:96;image.height=wood?32:96;const context=image.getContext('2d');
  context.fillStyle=wood?'#d7ad72':'#eee2c9';context.fillRect(0,0,image.width,image.height);
  const a=image.width*vy/det,b=-image.height*uy/det,c=-image.width*vx/det,d=image.height*ux/det;
  context.setTransform(a,b,c,d,-a*sourceX-c*sourceY,-b*sourceX-d*sourceY);context.imageSmoothingEnabled=true;context.drawImage(asset.image,0,0);rasters.set(key,image);return image;
 }
 function floorTile(kind,index){
  const key=`floor-tile:${kind}:${index}`;if(rasters.has(key))return rasters.get(key);
  const wood=kind==='wood',length=wood?2:1,depth=wood?.5:1,inset=.009,material=floorMaterial(kind,index);
  // The projected plank is invariant under translation. Warp its grain and
  // stroke once, then reuse this small transparent raster for every floor cell.
  const left=-depth*TILE_W/2-1,top=-1,image=document.createElement('canvas');image.width=Math.ceil((length+depth)*TILE_W/2)+2;image.height=Math.ceil((length+depth)*TILE_H/2)+2;
  const context=image.getContext('2d');context.translate(-left,-top);
  const corners=[[inset,inset],[length-inset,inset],[length-inset,depth-inset],[inset,depth-inset]].map(([x,z])=>project(x,z)),[a,b,,d]=corners;
  context.save();context.beginPath();corners.forEach((p,i)=>i?context.lineTo(p.x,p.y):context.moveTo(p.x,p.y));context.closePath();context.clip();
  context.transform((b.x-a.x)/material.width,(b.y-a.y)/material.width,(d.x-a.x)/material.height,(d.y-a.y)/material.height,a.x,a.y);context.imageSmoothingEnabled=true;context.drawImage(material,0,0);context.restore();
  context.strokeStyle=wood?'#98724088':'#b9b098a6';context.lineWidth=wood?.55:.5;context.beginPath();corners.forEach((p,i)=>i?context.lineTo(p.x,p.y):context.moveTo(p.x,p.y));context.closePath();context.stroke();
  const tile={image,left,top};rasters.set(key,tile);return tile;
 }
 function floorAtlas(kind,x0,z0,x1,z1){
  if(!images.has(kind))return;
  const key=`floor-exact:${kind}:${x0}:${z0}:${x1}:${z1}`;let atlas=rasters.get(key);
  if(!atlas){
   const left=(x0-z1)*TILE_W/2,top=(x0+z0)*TILE_H/2,right=(x1-z0)*TILE_W/2,bottom=(x1+z1)*TILE_H/2;
   const image=document.createElement('canvas');image.width=Math.ceil(right-left);image.height=Math.ceil(bottom-top);const context=image.getContext('2d');context.translate(-left,-top);
   const outline=[[x0,z0],[x1,z0],[x1,z1],[x0,z1]].map(([x,z])=>project(x,z));
   context.beginPath();outline.forEach((p,i)=>i?context.lineTo(p.x,p.y):context.moveTo(p.x,p.y));context.closePath();context.clip();context.fillStyle=kind==='wood'?'#b58e5d':'#c8bfa8';context.fill();
   const wood=kind==='wood',length=wood?2:1,depth=wood?.5:1,count=wood?6:5;
   // Every visible joint starts as a rectangle in world x/z. Projecting its
   // corners gives exact +/-0.5 edges at every location and staggered row.
   for(let row=0,z=z0;z<z1;z+=depth,row++){
    const offset=(row%2)*length/2;
    for(let column=0,x=x0-offset;x<x1;x+=length,column++){
     const seed=(Math.imul(row+1,73856093)^Math.imul(column+1,19349663))>>>0,tile=floorTile(kind,seed%count),origin=project(x,z);
     context.drawImage(tile.image,origin.x+tile.left,origin.y+tile.top);
    }
   }
   atlas={image,left,top,width:right-left,height:bottom-top};rasters.set(key,atlas);
  }
  rasters.delete(key);rasters.set(key,atlas);
  const origin=screen(0,0);ctx.save();ctx.imageSmoothingEnabled=true;ctx.drawImage(atlas.image,origin.x+atlas.left*zoom,origin.y+atlas.top*zoom,atlas.width*zoom,atlas.height*zoom);ctx.restore();
 }
 function floorChunks(kind,{x0,z0,x1,z1}){
  for(let x=x0;x<x1;x+=16)for(let z=z0;z<z1;z+=16){const right=Math.min(x+16,x1),bottom=Math.min(z+16,z1);if(visibleRegion(x,z,right,bottom))floorAtlas(kind,x,z,right,bottom);}
  const cached=[...rasters.keys()].filter(key=>key.startsWith('floor-exact:'));for(const key of cached.slice(0,Math.max(0,cached.length-24)))rasters.delete(key);
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
    if(Math.max(p.x,q.x)<0||Math.min(p.x,q.x)>width||Math.max(p.y,q.y)<0||Math.min(p.y,q.y)-h>height)continue;
    const mx=(q.x-p.x)/source.ux,my=((q.y-p.y)+h*source.uy/source.vy)/source.ux,ny=-h/source.vy;
    ctx.save();ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.lineTo(q.x,q.y-h);ctx.lineTo(p.x,p.y-h);ctx.closePath();ctx.clip();ctx.imageSmoothingEnabled=false;
    ctx.transform(mx,my,0,ny,p.x-mx*source.x,p.y-my*source.x-ny*source.y);ctx.drawImage(asset.image,0,0);ctx.restore();
   }
  }
  ctx.strokeStyle='#344c5b';ctx.lineWidth=7*zoom;ctx.beginPath();ctx.moveTo(a.x,a.y-h+2*zoom);ctx.lineTo(b.x,b.y-h+2*zoom);ctx.stroke();
 }
 function sprite(kind,displayWidth){
  const asset=images.get(kind);if(!asset)return null;const key=`${kind}:${displayWidth}`;
  if(!spriteRasters.has(key))spriteRasters.set(key,createSpriteRaster(kind,asset,displayWidth));return spriteRasters.get(key);
 }
 function spritePoint(kind,x,z,displayWidth,sourcePoint,{mirror=false,offsetY=0}={}){
  const geometry=sprite(kind,displayWidth);if(!geometry)return screen(x,z);const p=screen(x,z),q=geometry.point(...sourcePoint);
  return {x:p.x+(mirror?-q.x:q.x)*zoom,y:p.y+(q.y-offsetY)*zoom};
 }
 function spriteBottom(kind,displayWidth){const geometry=sprite(kind,displayWidth);return geometry?geometry.top+geometry.height:16;}
 function decorPosition(item){
  if(!item.align)return item;const geometry=sprite(item.kind,item.w);if(!geometry)return item;
  const p=geometry.point(...item.align.point),[x,z]=item.align.at;
  return {...item,x:x-p.x/TILE_W-p.y/TILE_H,z:z-p.y/TILE_H+p.x/TILE_W};
 }
 function drawSprite(kind,x,z,displayWidth,{offsetY=0,alpha=1,mirror=false,layer='all'}={}){
  const geometry=sprite(kind,displayWidth);if(!geometry)return null;const p=screen(x,z);
  const image=layer==='back'?(geometry.backImage||geometry.image):layer==='front'?geometry.frontImage:geometry.image;if(!image)return geometry;
  ctx.save();ctx.globalAlpha=alpha;ctx.imageSmoothingEnabled=false;ctx.translate(p.x,p.y-offsetY*zoom);ctx.scale(mirror?-zoom:zoom,zoom);ctx.drawImage(image,geometry.left,geometry.top,geometry.width,geometry.height);ctx.restore();return geometry;
 }
 function quadPoint(quad,u,v){return {x:(1-v)*((1-u)*quad[0].x+u*quad[1].x)+v*((1-u)*quad[3].x+u*quad[2].x),y:(1-v)*((1-u)*quad[0].y+u*quad[1].y)+v*((1-u)*quad[3].y+u*quad[2].y)};}
 function spriteQuad(kind,x,z,width,points,options={}){return points.map(p=>spritePoint(kind,x,z,width,p,options));}
 function drawQuadImage(image,quad){
  const w=image.naturalWidth||image.width,h=image.naturalHeight||image.height;
  const source=[[0,0],[w,0],[w,h],[0,h]];
  for(const triangle of [[0,1,2],[0,2,3]]){
   const [i,j,k]=triangle,a=source[i],b=source[j],c=source[k],p=quad[i],q=quad[j],r=quad[k];
   const ux=b[0]-a[0],uy=b[1]-a[1],vx=c[0]-a[0],vy=c[1]-a[1],det=ux*vy-vx*uy;
   const dx=q.x-p.x,dy=q.y-p.y,ex=r.x-p.x,ey=r.y-p.y;
   const ma=(dx*vy-ex*uy)/det,mb=(dy*vy-ey*uy)/det,mc=(ex*ux-dx*vx)/det,md=(ey*ux-dy*vx)/det;
   ctx.save();ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.lineTo(r.x,r.y);ctx.closePath();ctx.clip();ctx.transform(ma,mb,mc,md,p.x-ma*a[0]-mc*a[1],p.y-mb*a[0]-md*a[1]);ctx.imageSmoothingEnabled=true;ctx.drawImage(image,0,0);ctx.restore();
  }
 }
 function reportPaper(report,image){
  const paper=document.createElement('canvas');paper.width=240;paper.height=360;const context=paper.getContext('2d');context.scale(.5,.5);context.fillStyle='#fffaf0';context.fillRect(0,0,480,720);
  context.fillStyle='#e8eee3';context.fillRect(36,38,408,328);
  if(image){const ratio=Math.min(400/(image.naturalWidth||image.width),320/(image.naturalHeight||image.height)),w=(image.naturalWidth||image.width)*ratio,h=(image.naturalHeight||image.height)*ratio;context.drawImage(image,240-w/2,202-h/2,w,h);}
  else{context.fillStyle='#6d8a68';context.textAlign='center';context.font='42px sans-serif';context.fillText('나의 발견',240,190);context.font='25px sans-serif';context.fillText('관찰 기록',240,240);}
  context.fillStyle='#375a43';context.textAlign='center';
  const wrap=(text,y,fontSize,limit)=>{context.font=`${fontSize}px sans-serif`;let line='',row=0;for(const letter of String(text||'')){if(context.measureText(line+letter).width>402){context.fillText(line,240,y+row*fontSize*1.5);line='';if(++row===limit)return;}line+=letter;}if(line)context.fillText(line,240,y+row*fontSize*1.5);};
  wrap(report.title,418,31,2);context.fillStyle='#6e8065';wrap(`${report.name} 탐험가`,535,25,1);context.strokeStyle='#d6dfcf';context.beginPath();context.moveTo(44,571);context.lineTo(436,571);context.stroke();context.fillStyle='#587050';wrap(report.features,620,21,2);return paper;
 }
 function paperFor(item){
  const id=item.report.id;let cached=reportPapers.get(id);
  if(cached){reportPapers.delete(id);reportPapers.set(id,cached);return cached.paper;}
  cached={paper:reportPaper(item.report)};reportPapers.set(id,cached);
  const source=item.report.thumbnail||item.report.photos?.[0];
  if(source){const image=new Image();image.onload=()=>{if(!destroyed&&reportPapers.get(id)===cached){cached.paper=reportPaper(item.report,image);dirty=true;}};image.src=source;}
  // Keep every visible paper stable; evict only offscreen entries. A fixed
  // budget below the visible count would recreate papers on every paint.
  for(const key of reportPapers.keys()){if(reportPapers.size<=Math.max(12,visibleReportIds.size))break;if(!visibleReportIds.has(key))reportPapers.delete(key);}
  return cached.paper;
 }
 function shadow(x,z,w=75,h=20){const p=screen(x,z);ctx.fillStyle='#3852381a';ctx.beginPath();ctx.ellipse(p.x,p.y,w*zoom/2,h*zoom/2,0,0,Math.PI*2);ctx.fill();}
 function plaque(text,x,z,{offset=0,width:boxWidth=130,dark=false,size=10}={}){
  const p=screen(x,z);ctx.save();ctx.translate(p.x,p.y-offset*zoom);ctx.font=`${Math.max(8,size*zoom)}px "Noto Sans KR",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';const w=Math.min(boxWidth*zoom,ctx.measureText(text).width+20*zoom),h=23*zoom;
  ctx.fillStyle=dark?'#304836ed':'#fbf7e6ed';ctx.strokeStyle=dark?'#d9e6bc60':'#d9d7b3';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(-w/2,-h/2,w,h,4*zoom);ctx.fill();ctx.stroke();ctx.fillStyle=dark?'#f8efcb':'#536746';ctx.fillText(text,0,0,w-8*zoom);ctx.restore();
 }
 function portal(item){const p=screen(...item.position),pulse=.72+Math.sin(performance.now()/550)*.1;ctx.save();ctx.globalAlpha=.5;ctx.fillStyle='#fff8c9';ctx.beginPath();ctx.ellipse(p.x,p.y,38*zoom,17*zoom,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=pulse;ctx.strokeStyle='#dfbf42';ctx.lineWidth=5*zoom;ctx.beginPath();ctx.ellipse(p.x,p.y,29*zoom,13*zoom,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
 function highlight(item,w=1.95,d=1.6){ctx.save();ctx.strokeStyle='#f8dc39';ctx.lineWidth=3*zoom;ctx.shadowColor='#f4d632';ctx.shadowBlur=7*zoom;diamond(item.position[0],item.position[1],w,d);ctx.stroke();ctx.restore();}
 function drawArtifact(item){
  const [x,z]=item.position,width=CASE_WIDTH,geometry=sprite('case',width);shadow(x,z,105,28);if(near?.id===item.id)highlight(item,2.8,1.5);drawSprite('case',x,z,width,{layer:'back'});
  const snapshot=mapModels.getSnapshot(item.artifact.id);
  if(snapshot&&geometry&&item.artifact.photoPoster&&!item.artifact.mapPreview&&geometry.anchors?.photoPanel){const p=screen(x,z),quad=geometry.anchors.photoPanel.map(q=>({x:p.x+q.x*zoom,y:p.y+q.y*zoom}));drawQuadImage(snapshot.image,quad);}
  else if(snapshot&&geometry){const r=snapshot.rect,base=spritePoint('case',x,z,width,SPRITE_MARKERS.case.modelBase),support=geometry.anchors?.modelBase||geometry.point(...SPRITE_MARKERS.case.modelBase),ceiling=geometry.anchors?.modelCeiling||geometry.point(770,225),floor=geometry.anchors?.innerFloor||SPRITE_MARKERS.case.innerFloor.map(p=>geometry.point(...p));
   const maxHeight=Math.max(1,support.y-ceiling.y-5),maxWidth=Math.min(90,(Math.max(...floor.map(p=>p.x))-Math.min(...floor.map(p=>p.x)))*.72),anchor=snapshot.groundAnchor||snapshot.image.groundAnchor||{x:r.x+r.w/2,y:r.y+r.h},aboveGround=Math.max(1,anchor.y-r.y);
   const scale=Math.min(80/aboveGround,maxHeight/aboveGround,maxWidth/r.w),w=r.w*scale,h=r.h*scale;
   ctx.save();ctx.imageSmoothingEnabled=true;ctx.drawImage(snapshot.image,r.x,r.y,r.w,r.h,base.x-(anchor.x-r.x)*scale*zoom,base.y-(anchor.y-r.y)*scale*zoom,w*zoom,h*zoom);ctx.restore();}
  drawSprite('case',x,z,width,{layer:'front'});
  plaque(`${item.index+1}. ${item.artifact.shortName||item.artifact.name}`,x,z,{offset:-(spriteBottom('case',width)+13),width:175,size:9});
 }
 function drawDesk(item){const [x,z]=item.position,width=150;if(near?.id===item.id)highlight(item,2.7,1.7);shadow(x,z,110,25);drawSprite('desk',x,z,width);plaque(item.type==='publish'?'내 보고서 걸기':item.type==='comparison-desk'?'세 점 비교 기록':'나의 관람 보고서',x,z,{offset:-(spriteBottom('desk',width)+14),width:165,dark:true});}
 function drawReport(item){
  const [x,z]=item.position,width=100;if(near?.id===item.id)highlight(item,1.9,1.1);shadow(x,z,90,20);drawSprite('frame',x,z,width);
  if(sprite('frame',width))drawQuadImage(paperFor(item),spriteQuad('frame',x,z,width,SPRITE_MARKERS.frame.paper));
  plaque(item.report.title,x,z,{offset:-(spriteBottom('frame',width)+14),width:145,size:9});
 }

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
 function routeArrow(x,z,active){
  if(!isVisible(x,z,80))return;const p=screen(x,z),q=screen(x,z-1),angle=Math.atan2(q.y-p.y,q.x-p.x);
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);ctx.scale(zoom,zoom);ctx.globalAlpha=active?.92:.35;ctx.fillStyle=active?'#63835c':'#76936c';ctx.strokeStyle='#f8f4d9';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(25,0);ctx.lineTo(1,-15);ctx.lineTo(1,-6);ctx.lineTo(-21,-6);ctx.lineTo(-21,6);ctx.lineTo(1,6);ctx.lineTo(1,15);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
 }
 function paint(now){
  ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);paintBackground();
  if(indoors){const b=MAP_LAYOUT.study;region(b.x0,b.z0,b.x1,b.z1,'#baa179');floorChunks('wood',b);wallStrip(b.x0,b.z0,b.x1,b.z0);wallStrip(b.x0,b.z0,b.x0,b.z1);
   plaque('01 · 세 나라의 도자기 비교',0,5,{width:270,dark:true,size:12});
   plaque('02 · 고려청자 다섯 점 탐구',0,-10,{width:280,dark:true,size:12});
   plaque('03 · 나의 관람 보고서',0,-31,{offset:130,width:260,dark:true,size:12});
   for(const z of [3,-5.5,-8,-15.5,-20.5,-25])routeArrow(0,z,courseStage==='comparison'?z> -8:courseStage==='gallery'?z<=-8&&z>-25:z<=-25);
  }else{
   const a=MAP_LAYOUT.arrival,b=exhibitionBounds(reports.length),bridge=MAP_LAYOUT.bridge;
   region(a.x0,3,a.x1,a.z1,'#9bb477');region(bridge.x0,bridge.z0,bridge.x1,bridge.z1,'#9bb477');region(b.x0,b.z0,b.x1,b.z1,'#b1aa8c');
   floorChunks('stone',{...a,x0:-8,z0:5});floorChunks('stone',bridge);floorChunks('wood',b);wallStrip(b.x0,b.z0,b.x1,b.z0);wallStrip(b.x0,b.z0,b.x0,b.z1);
   plaque('우리들의 발견 전시실',35,21,{offset:105,width:310,dark:true,size:14});
   plaque('유물 다시 관찰하기',18.8,17,{width:185,dark:true,size:11});
   plaque('한 사람의 발견이 하나의 전시가 돼요',38,19,{width:330,size:11});
   for(let row=0;row<Math.max(6,Math.ceil(reports.length/5));row++){const z=13-row*8;if(isVisible(50,z,120))plaque(`${row*5+1}–${row*5+5}`,50,z,{width:75,dark:true,size:10});}
  }
  const visibleDecor=decorations.filter(d=>d.room===(indoors?'inside':'outside')).map(decorPosition).filter(d=>isVisible(d.x,d.z,d.w+100));
  const commands=visibleDecor.map(d=>({depth:d.x+d.z,draw:()=>{shadow(d.x,d.z,d.w*.55,23);const geometry=drawSprite(d.kind,d.x,d.z,d.w,{mirror:d.mirror});if(d.label&&geometry)plaque(d.label,d.x,d.z,{offset:-geometry.top+20,width:290,dark:true,size:d.id==='main-building'?15:12});}}));
  const visibleItems=[...hotspots.values()].filter(item=>sameRoom(item)&&isVisible(...item.position));
  visibleReportIds=new Set(visibleItems.filter(item=>item.type==='report').map(item=>item.report.id));
  for(const key of reportPapers.keys()){if(reportPapers.size<=Math.max(12,visibleReportIds.size))break;if(!visibleReportIds.has(key))reportPapers.delete(key);}
  mapModels.update(visibleItems.filter(item=>item.type==='artifact').map(item=>({artifact:item.artifact,priority:near?.id===item.id?1000:100-Math.hypot(player.x-item.position[0],player.z-item.position[1])})),{now,paused:paused||document.hidden});
  for(const item of visibleItems){
   if(item.type==='entrance'||item.type==='exit'){portal(item);plaque(item.type==='entrance'?'입장하기 · F':'보고서 전시실로 · F',...item.position,{offset:item.type==='entrance'?-37:41,width:175,dark:true});continue;}
   commands.push({depth:item.position[0]+item.position[1],draw:()=>item.type==='artifact'?drawArtifact(item):item.type==='report'?drawReport(item):drawDesk(item)});
  }
  commands.push({depth:player.x+player.z+.12,draw:drawPlayer});commands.sort((a,b)=>a.depth-b.depth);for(const command of commands)command.draw();
  canvas.dataset.room=indoors?'study':player.x>=16?'exhibition':'arrival';canvas.dataset.reportCount=String(reports.length);canvas.dataset.visibleReports=String(visibleItems.filter(item=>item.type==='report').length);canvas.dataset.renderedFrames=String(++renderedFrames);
  const stats=mapModels.getStats();canvas.dataset.active3d=String(Number(Boolean(stats.activeId&&!stats.paused)));
 }
 function within(x,z,b,inset=.5){return x>=b.x0+inset&&x<=b.x1-inset&&z>=b.z0+inset&&z<=b.z1-inset;}
 function blocked(x,z){
  const inRoom=indoors?within(x,z,MAP_LAYOUT.study):[MAP_LAYOUT.arrival,MAP_LAYOUT.bridge,exhibitionBounds(reports.length)].some(b=>within(x,z,b,0));
  if(!inRoom)return true;return obstacles.some(o=>o.room===(indoors?'inside':'outside')&&Math.abs(x-o.x)<o.w&&Math.abs(z-o.z)<o.d);
 }
 function route(x,z){
  if(blocked(x,z))return false;
  const step=.5,toCell=(x,z)=>[Math.round(x/step),Math.round(z/step)],start=toCell(player.x,player.z),end=toCell(x,z),key=(x,z)=>`${x},${z}`;
  const startKey=key(...start),parents=new Map([[startKey,null]]),costs=new Map([[startKey,0]]),open=[{cell:start,score:Math.abs(start[0]-end[0])+Math.abs(start[1]-end[1])}],closed=new Set();let found=null,visited=0;
  while(open.length&&visited++<18000){let best=0;for(let i=1;i<open.length;i++)if(open[i].score<open[best].score)best=i;const {cell:[cx,cz]}=open.splice(best,1)[0],currentKey=key(cx,cz);if(closed.has(currentKey))continue;closed.add(currentKey);
   if(cx===end[0]&&cz===end[1]){found=[cx,cz];break;}
   for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=cx+dx,nz=cz+dz,nk=key(nx,nz);if(closed.has(nk)||blocked(nx*step,nz*step))continue;const cost=costs.get(currentKey)+1;if(cost>=(costs.get(nk)??Infinity))continue;costs.set(nk,cost);parents.set(nk,[cx,cz]);open.push({cell:[nx,nz],score:cost+Math.abs(nx-end[0])+Math.abs(nz-end[1])});}
  }
  if(!found)return false;waypoints=[];while(found){waypoints.unshift({x:found[0]*step,z:found[1]*step});found=parents.get(key(...found));}waypoints.shift();waypoints.push({x,z});target=waypoints.shift()||{...player};dirty=true;return true;
 }
 function moveTo(id){const item=hotspots.get(id);if(!item||!sameRoom(item))return false;const [x,z]=item.position;for(const [dx,dz]of [[0,1.8],[1.8,0],[-1.8,0],[0,-1.8]])if(route(x+dx,z+dz))return true;return false;}
 function clearKeys(){keys={};touch={x:0,y:0};waypoints=[];target={...player};}
 function interact(){if(near&&!paused)onInteract(near);}
 function pointer(event){if(paused)return;const rect=canvas.getBoundingClientRect(),point={x:event.clientX-rect.left,y:event.clientY-rect.top};
  const definitions={artifact:['case',CASE_WIDTH],'comparison-desk':['desk',150],desk:['desk',150],publish:['desk',150],report:['frame',100]};
  // Pick the foremost opaque sprite pixel. Its calibrated ground center is
  // still the movement/interaction destination; tall paper and screens click
  // correctly without stealing hits from the next exhibit's empty corners.
  const items=[...hotspots.values()].filter(item=>sameRoom(item)&&isVisible(...item.position)).sort((a,b)=>(b.position[0]+b.position[1])-(a.position[0]+a.position[1]));
  for(const item of items){
   const p=screen(...item.position),definition=definitions[item.type];let hit=false;
   if(!definition)hit=Math.abs(point.x-p.x)<40*zoom&&point.y-p.y<20*zoom&&point.y-p.y> -60*zoom;
   else{const geometry=sprite(...definition);if(geometry){const local={x:(point.x-p.x)/zoom,y:(point.y-p.y)/zoom},polygon=geometry.anchors?.hitPolygon;
    if(polygon){for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a.y>local.y)!==(b.y>local.y)&&local.x<(b.x-a.x)*(local.y-a.y)/(b.y-a.y)+a.x)hit=!hit;}}
    const x=local.x-geometry.left,y=local.y-geometry.top;
    if(!polygon&&x>=0&&x<geometry.width&&y>=0&&y<geometry.height){try{const context=geometry.image.getContext('2d'),sx=Math.floor(x/geometry.width*geometry.image.width),sy=Math.floor(y/geometry.height*geometry.image.height);hit=context.getImageData(sx,sy,1,1).data[3]>18;}catch{hit=true;}}
   }}
   if(hit){if(near?.id===item.id)interact();else moveTo(item.id);return;}
  }
  const world=unscreen(point.x,point.y);route(world.x,world.z);
 }
 function keyDown(event){if(paused||/INPUT|TEXTAREA|SELECT/.test(event.target.tagName))return;const key=event.key.toLowerCase();if(key==='f'){event.preventDefault();interact();return;}if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'].includes(key)){event.preventDefault();keys[key]=true;waypoints=[];}}
 function keyUp(event){const key=event.key.toLowerCase(),wasMoving=Boolean(keys[key]);delete keys[key];if(wasMoving&&!Object.values(keys).some(Boolean)&&!touch.x&&!touch.y){target={...player};waypoints=[];}}
 canvas.addEventListener('click',pointer);window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);window.addEventListener('blur',clearKeys);
 function resize(){const rect=el.getBoundingClientRect();width=rect.width;height=rect.height;pixelRatio=Math.min(window.devicePixelRatio||1,1.5);dirty=true;canvas.width=Math.round(width*pixelRatio);canvas.height=Math.round(height*pixelRatio);}
 const observer=new ResizeObserver(resize);observer.observe(el);resize();
 let last=performance.now(),lastSaved=0,savedPosition={...player},paintTimes=[];
 function tick(now){if(destroyed)return;frame=requestAnimationFrame(tick);const elapsed=clamp((now-last)/1000,0,.25);last=now;if(document.hidden)return;walking=false;
  if(!paused){const sx=(keys.arrowright||keys.d?1:0)-(keys.arrowleft||keys.a?1:0)+touch.x,sy=(keys.arrowdown||keys.s?1:0)-(keys.arrowup||keys.w?1:0)+touch.y;
   let remaining=elapsed;
   while(remaining>0){const dt=Math.min(remaining,.05);remaining-=dt;
    if(sx||sy){waypoints=[];target={x:player.x+sx+sy,z:player.z+sy-sx};}
    const dx=target.x-player.x,dz=target.z-player.z,d=Math.hypot(dx,dz);if(d>.025){const distance=Math.min(dt*4.1,d),vx=dx/d*distance,vz=dz/d*distance,before={...player};
     if(!blocked(player.x+vx,player.z))player.x+=vx;if(!blocked(player.x,player.z+vz))player.z+=vz;
     if(Math.hypot(player.x-before.x,player.z-before.z)>.001){walking=true;walkTime+=dt;const screenX=vx-vz,screenY=(vx+vz)*.5;if(Math.abs(screenX)>Math.abs(screenY)*1.2){direction='right';flip=screenX<0;}else{direction=screenY<0?'back':'front';flip=false;}}
    }
    if(Math.hypot(target.x-player.x,target.z-player.z)<.06&&waypoints.length)target=waypoints.shift();
   }
   let next=null,distance=2.65;for(const item of hotspots.values()){if(!sameRoom(item))continue;const d=Math.hypot(player.x-item.position[0],player.z-item.position[1]);if(d<distance){next=item;distance=d;}}near=next;
   if(near?.id!==lastNear){lastNear=near?.id;onNear(near);}
   if(now-lastSaved>1600&&Math.hypot(player.x-savedPosition.x,player.z-savedPosition.z)>.01){lastSaved=now;savedPosition={...player};onMove({x:player.x,z:player.z,inside:indoors,layoutVersion:MAP_LAYOUT.version});}
  }
  const p=project(player.x,player.z),ease=1-Math.exp(-elapsed*8);camera.x+=(p.x-camera.x)*ease;camera.y+=(p.y-camera.y)*ease;
  // One map paint at most 30 times per second, and none beneath a stable modal.
  if(now-lastPaint<1000/30||paused&&!dirty)return;lastPaint=now;const started=performance.now();paint(now);paintTimes.push(performance.now()-started);if(paintTimes.length>90)paintTimes.shift();dirty=false;
 }
 function teleport(x,z,isInside){indoors=Boolean(isInside);if(blocked(x,z)){const safe=indoors?MAP_LAYOUT.spawns.study:x>=16?MAP_LAYOUT.spawns.exhibition:MAP_LAYOUT.spawns.arrival;x=safe.x;z=safe.z;}player={x,z};target={...player};camera=project(x,z);waypoints=[];clearKeys();lastNear=null;near=null;savedPosition={...player};dirty=true;onNear(null);onMove({x,z,inside:indoors,layoutVersion:MAP_LAYOUT.version});}
 function updateReports(nextReports){
  reports=nextReports.slice(0,200);for(const id of [...hotspots.keys()])if(id.startsWith('report-'))hotspots.delete(id);for(let i=obstacles.length-1;i>=0;i--)if(obstacles[i].report)obstacles.splice(i,1);
  const ids=new Set(reports.map(report=>report.id));for(const id of reportPapers.keys())if(!ids.has(id))reportPapers.delete(id);
  reports.forEach((report,i)=>{const [x,z]=reportPosition(i);hot(`report-${report.id}`,'report',report.title,x,z,{report});obstacles.push({x,z,w:.7,d:.55,room:'outside',report:true});});dirty=true;canvas.dataset.reportCount=String(reports.length);
 }
 function getDiagnostics(){return {layoutVersion:MAP_LAYOUT.version,room:indoors?'study':player.x>=16?'exhibition':'arrival',reportCount:reports.length,visibleReports:[...hotspots.values()].filter(item=>item.type==='report'&&sameRoom(item)&&isVisible(...item.position)).length,renderedFrames,paused:paused||document.hidden,pixelRatio,floorChunks:[...rasters.keys()].filter(key=>key.startsWith('floor-exact:')).length,reportPaperCount:reportPapers.size,reportPaperBudget:Math.max(12,visibleReportIds.size),paintAverageMs:paintTimes.length?paintTimes.reduce((a,b)=>a+b,0)/paintTimes.length:0,paintMaxMs:paintTimes.length?Math.max(...paintTimes):0,hotspots:[...hotspots.values()].map(item=>({id:item.id,type:item.type,position:[...item.position],room:item.room,screen:screen(...item.position)})),map3d:mapModels.getStats()};}
 canvas.getWorldDiagnostics=getDiagnostics;
 function visibility(){if(document.hidden){clearKeys();mapModels.update([],{now:performance.now(),paused:true});}else dirty=true;}
 document.addEventListener('visibilitychange',visibility);tick(last);
 return {ready,moveTo,interact,reloadArtifact,getDiagnostics,getPosition:()=>({x:player.x,z:player.z,inside:indoors,layoutVersion:MAP_LAYOUT.version}),teleport,
  enterStudy(){const p=MAP_LAYOUT.spawns.study;teleport(p.x,p.z,true);},enterExhibition(){const p=MAP_LAYOUT.spawns.exhibition;teleport(p.x,p.z,false);},updateCourseStage(stage){courseStage=stage;dirty=true;},
  pause(value){paused=value;keys={};touch={x:0,y:0};if(value){waypoints=[];target={...player};mapModels.update([],{now:performance.now(),paused:true});}else dirty=true;},
  setTouch(x,y){const wasMoving=touch.x||touch.y;touch={x,y};if(wasMoving&&!x&&!y&&!Object.values(keys).some(Boolean)){target={...player};waypoints=[];}},zoom(delta){zoom=clamp(zoom-delta*.1,.58,1.8);dirty=true;},setAvatar(nextColor,nextName,nextHair=hair){color=nextColor;name=nextName||'나의 탐험가';hair=nextHair==='bob'?'bob':'short';dirty=true;},updateReports,
  dispose(){destroyed=true;cancelAnimationFrame(frame);mapModels.dispose();for(const timer of retryTimers)clearTimeout(timer);retryTimers.clear();observer.disconnect();canvas.removeEventListener('click',pointer);window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',clearKeys);document.removeEventListener('visibilitychange',visibility);images.clear();reportPapers.clear();spriteFrames.clear();recolored.clear();rasters.clear();spriteRasters.clear();delete canvas.getWorldDiagnostics;canvas.remove();}
 };
}
