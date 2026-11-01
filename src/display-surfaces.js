import {iso,makeSurfaceSprite,fillPolygon} from './surface-sprite.js';

// Rigid display furniture is assembled from planes, not a transformed picture.
// Every rail and vertical level uses the same projection as the museum floor.
const q=(x0,z0,x1,z1,h)=>[iso(x0,z0,h),iso(x1,z0,h),iso(x1,z1,h),iso(x0,z1,h)];
const front=(x0,x1,z,top,bottom)=>[iso(x0,z,top),iso(x1,z,top),iso(x1,z,bottom),iso(x0,z,bottom)];
const side=(x,z0,z1,top,bottom)=>[iso(x,z0,top),iso(x,z1,top),iso(x,z1,bottom),iso(x,z0,bottom)];
const line=(ctx,points,color='#304451',width=1)=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineJoin='miter';ctx.stroke();};
function box(ctx,x0,z0,x1,z1,top,bottom,colors=['#e4d2a9','#d4c19a','#f5e7c9']){
 fillPolygon(ctx,front(x0,x1,z1,top,bottom),colors[0],'#3e4a4c',.65);
 fillPolygon(ctx,side(x1,z0,z1,top,bottom),colors[1],'#3e4a4c',.65);
 fillPolygon(ctx,q(x0,z0,x1,z1,top),colors[2],'#3e4a4c',.65);
}
const floorSource=[[494,362],[1314,636],[1031,789],[222,480]];
const roofSource=[[494,32],[1322,274],[1033,422],[214,171]];

function caseSurface(asset,width){
 const floor=q(-1.5,-.5,1.5,.5,32),roof=q(-1.5,-.5,1.5,.5,76);
 const markers={'770,574':[0,-32],'770,225':[0,-76]};
 floorSource.forEach((p,i)=>markers[p.join(',')]=floor[i]);
 const rail=(ctx,a,b,height=1.1)=>{line(ctx,[a,b],'#243e4c',height+1);line(ctx,[[a[0],a[1]-.55],[b[0],b[1]-.55]],'#ead6a6',height);};
 const post=(ctx,x,z)=>box(ctx,x-.022,z-.022,x+.022,z+.022,76.7,31.6,['#c2a76c','#a58c59','#f1e0b6']);
 return makeSurfaceSprite(asset,width,{
  sourceSize:[1536,1024],bounds:[-67,-112,67,35],
  anchors:{modelBase:[0,-32],modelCeiling:[0,-76],innerFloor:floor,photoPanel:front(-.7,.7,0,62,32),hitPolygon:[iso(-1.5,.5,76),iso(-1.5,-.5,76),iso(1.5,-.5,76),iso(1.5,-.5,0),iso(1.5,.5,0),iso(-1.5,.5,0)]},sourceMarkers:markers,
  paint({ctx,texture,register}){
   // Map each moulding band independently so all levels stay parallel.
   const frontBands=[
    {src:[[175,503],[1040,806],[1040,834],[179,529]],top:32,bottom:28},
    {src:[[179,529],[1040,834],[1034,978],[177,668]],top:28,bottom:5},
    {src:[[177,668],[1034,978],[1034,1009],[174,693]],top:5,bottom:0}
   ];
   const sideBands=[
    {src:[[1040,806],[1369,651],[1370,676],[1040,834]],top:32,bottom:28},
    {src:[[1040,834],[1370,676],[1377,823],[1034,978]],top:28,bottom:5},
    {src:[[1034,978],[1377,823],[1378,849],[1034,1009]],top:5,bottom:0}
   ];
   for(const band of frontBands)texture(band.src,front(-1.5,1.5,.5,band.top,band.bottom));
   for(const band of sideBands)texture(band.src,side(1.5,-.5,.5,band.top,band.bottom));
   texture(floorSource,floor);register(roofSource,roof);
   for(const h of [0,5,28,32]){
    line(ctx,[iso(-1.5,.5,h),iso(1.5,.5,h),iso(1.5,-.5,h)],h===5||h===28?'#d7bf8b':'#304654',h===0?1.15:.7);
   }
   fillPolygon(ctx,[roof[0],roof[1],floor[1],floor[0]],'#b8d9dd16');
   fillPolygon(ctx,roof,'#e4f4ef14');
   // Back posts and rails are behind the actual collection thumbnail.
   post(ctx,-1.5,-.5);post(ctx,1.5,-.5);
   rail(ctx,roof[0],roof[1]);rail(ctx,roof[0],roof[3]);
   line(ctx,[iso(-1.48,-.48,73),iso(.4,-.48,45)],'#ffffff55',.9);
  },
  front({ctx}){
   const a=iso(-1.5,.5,76),b=iso(1.5,.5,76),c=iso(1.5,.5,32),d=iso(-1.5,.5,32);
   fillPolygon(ctx,[a,b,c,d],'#b7d6df12');
   fillPolygon(ctx,[iso(1.5,-.5,76),b,c,iso(1.5,-.5,32)],'#9bbfc415');
   post(ctx,-1.5,.5);post(ctx,1.5,.5);
   rail(ctx,a,b);rail(ctx,b,iso(1.5,-.5,76));
   rail(ctx,iso(-1.5,.5,32),iso(1.5,.5,32),.8);
   rail(ctx,iso(1.5,.5,32),iso(1.5,-.5,32),.8);
   line(ctx,[iso(-1.40,.5,72),iso(-1.40,.5,37)],'#ffffff77',.75);
  }
 });
}

function screenSurface(asset,width){
 const board=front(-1.78,1.78,.03,139,35);
 const boardSource=[[418,135],[1112,420],[1112,852],[418,543]];
 const markers={};boardSource.forEach((p,i)=>markers[p.join(',')]=board[i]);
 markers['765,493']=iso(0,.03,87);
 return makeSurfaceSprite(asset,width,{
  sourceSize:[1536,1024],bounds:[-88,-188,88,46],anchors:{boardQuad:board},sourceMarkers:markers,
  paint({ctx,texture}){
   // Exact base prism and pilasters retain the generated cream/gold/navy trim.
   box(ctx,-2.18,-.42,2.18,.42,8,0,['#28404d','#24343d','#eee1bb']);
   texture([[317,645],[1100,975],[1100,1005],[317,675]],front(-2.18,2.18,.42,8,0));
   texture([[1100,975],[1221,925],[1221,955],[1100,1005]],side(2.18,-.42,.42,8,0));
   texture(boardSource,board);
   const posts=[{u:-1.94,src:[[340,126],[391,146],[391,556],[340,536]]},{u:1.94,src:[[1122,437],[1178,461],[1178,854],[1122,832]]}];
   for(const {u,src}of posts){
    box(ctx,u-.13,-.13,u+.13,.13,148,9,['#d3bd8c','#a89976','#e5d4ac']);
    texture(src,front(u-.13,u+.13,.13,132,29));
    box(ctx,u-.19,-.19,u+.19,.19,151,139,['#bba16d','#7b714d','#e7d4a0']);
    texture([[340,47],[392,69],[392,115],[340,95]],front(u-.19,u+.19,.19,148,140));
    texture([[337,27],[381,9],[428,28],[382,49]],q(u-.19,-.19,u+.19,.19,151));
    box(ctx,u-.22,-.22,u+.22,.22,27,11,['#c4a974','#847652','#ebddbb']);
    texture([[340,571],[395,592],[395,635],[340,614]],front(u-.22,u+.22,.22,26,12));
   }
   texture([[392,66],[1111,358],[1111,390],[392,98]],front(-1.78,1.78,.07,146,139));
   texture([[395,553],[1112,854],[1112,879],[395,580]],front(-1.78,1.78,.07,35,29));
   fillPolygon(ctx,q(-1.78,-.11,1.78,.07,146),'#f5e6bf','#796f4d',.6);
   line(ctx,[...board,board[0]],'#263c4a',1.2);
   line(ctx,[board[0],board[1]],'#d4be87',.7);
  }
 });
}

function frameSurface(asset,width){
 const paper=front(-.76,.76,.06,171,57),paperSource=[[451,153],[816,350],[816,953],[451,749]];
 const markers={};paperSource.forEach((p,i)=>markers[p.join(',')]=paper[i]);
 const strip=(ctx,texture,source,destination)=>{texture(source,destination);line(ctx,[...destination,destination[0]],'#6e644a',.65);};
 return makeSurfaceSprite(asset,width,{
  sourceSize:[1274,1235],bounds:[-53,-205,53,31],anchors:{paperQuad:paper},sourceMarkers:markers,
  paint({ctx,texture}){
   // Two A-shaped feet, each using projected endpoints at ground and board.
   for(const u of [-.90,.90]){
    const frontLeg=[iso(u-.12,.63,0),iso(u+.12,.63,0),iso(u+.12,.02,45),iso(u-.12,.02,45)];
    const backLeg=[iso(u-.11,-.60,0),iso(u+.11,-.60,0),iso(u+.11,-.02,45),iso(u-.11,-.02,45)];
    fillPolygon(ctx,backLeg,'#293e4a','#142c37',1);
    fillPolygon(ctx,frontLeg,'#334d59','#142c37',1);
    texture([[734,1035],[781,1055],[750,1161],[708,1145]],frontLeg);
    fillPolygon(ctx,q(u-.16,.48,u+.16,.72,2),'#dac392','#324653',.7);
    fillPolygon(ctx,q(u-.16,-.70,u+.16,-.46,2),'#dbc99f','#324653',.7);
    line(ctx,[iso(u,.04,33),iso(u,.52,5)],'#a8b2a4',1.2);
   }
   fillPolygon(ctx,front(-.86,.86,.02,179,48),'#eddfbd','#6b5f40',1);
   texture(paperSource,paper);
   strip(ctx,texture,[[441,92],[828,290],[828,349],[441,150]],front(-.78,.78,.09,181,171));
   strip(ctx,texture,[[442,746],[826,948],[826,1003],[442,800]],front(-.78,.78,.09,57,47));
   strip(ctx,texture,[[390,116],[444,145],[444,751],[390,722]],front(-.96,-.78,.13,179,48));
   strip(ctx,texture,[[826,351],[884,381],[884,973],[826,943]],front(.78,.96,.13,179,48));
   fillPolygon(ctx,q(-.96,-.11,.96,.13,182),'#f1d7a0','#716443',.65);
   for(const u of [-.89,.89]){
    box(ctx,u-.14,-.12,u+.14,.15,186,174,['#c7ae78','#9e8c66','#f0d99f']);
    box(ctx,u-.14,-.12,u+.14,.15,55,43,['#c7ae78','#9e8c66','#f0d99f']);
    texture([[389,72],[443,101],[443,143],[389,115]],front(u-.14,u+.14,.15,186,174));
    texture([[381,63],[427,36],[477,61],[428,86]],q(u-.14,-.12,u+.14,.15,186));
    texture([[389,733],[442,759],[442,800],[389,774]],front(u-.14,u+.14,.15,55,43));
    const medallion=front(u-.075,u+.075,.155,181,176);fillPolygon(ctx,medallion,'#6e8e8a','#ebdfb3',.8);
   }
   line(ctx,[...paper,paper[0]],'#a69572',.65);
  }
 });
}

export function createDisplaySurface(kind,asset,width){
 if(kind==='case')return caseSurface(asset,width);
 if(kind==='screen')return screenSurface(asset,width);
 if(kind==='frame')return frameSurface(asset,width);
 return null;
}
