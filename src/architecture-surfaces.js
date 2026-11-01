import {iso,fillPolygon,makeSurfaceSprite} from './surface-sprite.js';

// Architecture is assembled from separately textured, rigid surface levels.
// The source artwork contributes its stone, woodwork and tiled roof detail;
// its inconsistent foundation/eave perspective is never used as geometry.
const FRONT=2,BACK=-2,LEFT=-5,RIGHT=5;
const buildingLevels=[
  {h:0,a:[106,671],b:[1051,946],c:[1432,755]},
  {h:12,a:[106,635],b:[1051,910],c:[1432,718]},
  {h:32,a:[151,577],b:[1051,841],c:[1392,657]},
  {h:128,a:[151,452],b:[1051,680],c:[1392,521]},
  {h:148,a:[131,410],b:[1053,643],c:[1410,488]}
];
function bilinear(quad,u,v){return [(1-v)*((1-u)*quad[0][0]+u*quad[1][0])+v*((1-u)*quad[3][0]+u*quad[2][0]),(1-v)*((1-u)*quad[0][1]+u*quad[1][1])+v*((1-u)*quad[3][1]+u*quad[2][1])];}
function tilePlane(texture,source,target,columns=3,rows=3){
  for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
    const u0=column/columns,u1=(column+1)/columns,v0=row/rows,v1=(row+1)/rows;
    texture(source,[bilinear(target,u0,v0),bilinear(target,u1,v0),bilinear(target,u1,v1),bilinear(target,u0,v1)],{bleed:.45});
  }
}
function tiledRoof({ctx,texture},{left,right,depth,ridgeLeft,ridgeRight,eaveHeight,ridgeHeight,tile,side,ridge,frontBand,sideBand}){
  const a=iso(ridgeLeft,0,ridgeHeight),b=iso(ridgeRight,0,ridgeHeight),c=iso(right,depth,eaveHeight),d=iso(left,depth,eaveHeight),rear=iso(right,-depth,eaveHeight);
  // Roof planes are genuine coplanar surfaces. Tile texture is repeated
  // inside their boundary; no source ridge/eave angle becomes geometry.
  fillPolygon(ctx,[a,b,c,d],'#2a3e55');
  ctx.save();ctx.beginPath();[a,b,c,d].forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.clip();tilePlane(texture,tile,[a,b,c,d]);ctx.restore();
  fillPolygon(ctx,[b,rear,c],'#24374c');texture(side,[b,rear,c]);
  texture(ridge,[iso(ridgeLeft,0,ridgeHeight+9),iso(ridgeRight,0,ridgeHeight+9),b,a],{segments:6});
  texture(frontBand,[d,c,iso(right,depth,eaveHeight-9),iso(left,depth,eaveHeight-9)],{segments:8});
  texture(sideBand,[c,rear,iso(right,-depth,eaveHeight-9),iso(right,depth,eaveHeight-9)],{segments:5});
  outline(ctx,[a,b],'#182f45',1.4);outline(ctx,[d,c,rear],'#1b3047',1.3);
}
function outline(ctx,points,color='#a38c69',width=1){
  ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineJoin='miter';ctx.stroke();
}
function building(asset,width){
  const entrance=iso(.5,3.9,0);
  return makeSurfaceSprite(asset,width,{
    sourceSize:[1536,1024],bounds:[-286,-320,286,142],
    anchors:{entrance},sourceMarkers:{'595,875':entrance},
    paint({ctx,texture}){
      // Every source strip terminates at the same exact vertical scaffold.
      // Subdivision rectifies the source's unequal left/right wall heights.
      for(let i=0;i<buildingLevels.length-1;i++){
        const low=buildingLevels[i],high=buildingLevels[i+1];
        texture([high.a,high.b,low.b,low.a],[iso(LEFT,FRONT,high.h),iso(RIGHT,FRONT,high.h),iso(RIGHT,FRONT,low.h),iso(LEFT,FRONT,low.h)],{segments:6});
        texture([high.b,high.c,low.c,low.b],[iso(RIGHT,FRONT,high.h),iso(RIGHT,BACK,high.h),iso(RIGHT,BACK,low.h),iso(RIGHT,FRONT,low.h)],{segments:6});
      }
      // The foundation courses/eave beam remain genuinely parallel at every
      // level, including the short return face around the corner.
      for(const h of [0,12,32,128,148])outline(ctx,[iso(LEFT,FRONT,h),iso(RIGHT,FRONT,h),iso(RIGHT,BACK,h)],h===148?'#9d815b':'#b29b7c',h===32?1.5:1);
      outline(ctx,[iso(LEFT,FRONT,0),iso(LEFT,FRONT,128)],'#b7a48a',1);
      outline(ctx,[iso(RIGHT,FRONT,0),iso(RIGHT,FRONT,148)],'#a38b6f',1);
      outline(ctx,[iso(RIGHT,BACK,0),iso(RIGHT,BACK,128)],'#a38b6f',1);

      tiledRoof({ctx,texture},{
        left:-5.8,right:5.8,depth:2.8,ridgeLeft:-3.5,ridgeRight:3.5,eaveHeight:153,ridgeHeight:240,
        tile:[[790,160],[1008,265],[936,395],[715,290]],
        side:[[1070,262],[1460,428],[1055,620]],
        ridge:[[710,34],[1063,235],[1063,264],[710,63]],
        frontBand:[[145,399],[1055,620],[1055,644],[145,424]],
        sideBand:[[1055,620],[1460,420],[1460,444],[1055,644]]
      });
      // The original jade-painted pediment sits on its own exact vertical
      // plane, rather than being stretched across the sloping tile material.
      const pediment=[iso(.5,3,229),iso(2.2,3,153),iso(-1.2,3,153)];
      texture([[657,347],[861,526],[511,435]],pediment);
      outline(ctx,[pediment[2],pediment[0],pediment[1]],'#243c50',3);
      // Six stone treads use true horizontal levels. Original stone grain is
      // mapped inside each plane rather than bringing along its baked seams.
      const stone=[[521,786],[653,825],[632,839],[501,801]];
      const riser=[[503,802],[634,841],[634,853],[503,813]];
      const count=6,depth=1.9/count;
      for(let i=0;i<count;i++){
        const z0=FRONT+i*depth,z1=FRONT+(i+1)*depth,h=32-i*32/count,next=32-(i+1)*32/count;
        texture(stone,[iso(-.8,z0,h),iso(1.8,z0,h),iso(1.8,z1,h),iso(-.8,z1,h)]);
        texture(riser,[iso(-.8,z1,h),iso(1.8,z1,h),iso(1.8,z1,next),iso(-.8,z1,next)]);
        outline(ctx,[iso(-.8,z1,h),iso(1.8,z1,h)],'#eee1c6',1.2);
        outline(ctx,[iso(-.8,z1,next),iso(1.8,z1,next)],'#aa987a',.8);
      }
      // Low side guards follow the same stepped profile as the stair treads.
      for(const u of [-1.05,1.9])for(let i=0;i<3;i++){
        const z0=FRONT+i*.63,z1=z0+.63,h=32-i*8;
        const top=[iso(u,z0,h),iso(u+.25,z0,h),iso(u+.25,z1,h),iso(u,z1,h)];
        const side=[iso(u+.25,z0,h),iso(u+.25,z1,h),iso(u+.25,z1,0),iso(u+.25,z0,0)];
        texture([[501,775],[541,787],[518,800],[479,787]],top);
        texture([[1051,846],[1104,820],[1104,877],[1051,904]],side,{segments:3});
        outline(ctx,[...top,top[0]],'#b3a184',.9);
      }
    }
  });
}

function gate(asset,width){
  const opening=iso(0,.8,0);
  return makeSurfaceSprite(asset,width,{
    sourceSize:[1536,1024],bounds:[-205,-290,205,112],
    anchors:{opening},sourceMarkers:{'710,850':opening},
    paint({ctx,texture}){
      const front=.5,back=-.35;
      const wallFront=[[193,548],[473,623],[473,792],[185,720]],wallReturn=[[1298,803],[1352,777],[1352,968],[1298,991]];
      for(const [a,b]of [[-5.3,-2.4],[2.4,5.3]]){
        const target=[iso(a,front,58),iso(b,front,58),iso(b,front,0),iso(a,front,0)];
        texture(wallFront,target,{segments:6});
        texture(wallReturn,[iso(b,front,58),iso(b,back,58),iso(b,back,0),iso(b,front,0)],{segments:3});
        for(const h of [0,13,58])outline(ctx,[iso(a,front,h),iso(b,front,h),iso(b,back,h)],'#ad9b7e',1);
        // Blue tiled wing caps have exact ridge/eave axes as well.
        fillPolygon(ctx,[iso(a,0,79),iso(b,0,79),iso(b,.8,62),iso(a,.8,62)],'#293e55');
        fillPolygon(ctx,[iso(a,.8,62),iso(b,.8,62),iso(b,.8,58),iso(a,.8,58)],'#263b50');
        texture([[203,451],[476,525],[476,620],[192,544]],[iso(a,0,79),iso(b,0,79),iso(b,.8,62),iso(a,.8,62)],{segments:5});
        outline(ctx,[iso(a,0,79),iso(b,0,79)],'#283d51',1.5);
      }
      for(const u of [-2,2]){
        const x0=u-.48,x1=u+.48,z0=-.45,z1=.65;
        const pedestalFront=[iso(x0,z1,30),iso(x1,z1,30),iso(x1,z1,0),iso(x0,z1,0)];
        const pedestalSide=[iso(x1,z1,30),iso(x1,z0,30),iso(x1,z0,0),iso(x1,z1,0)];
        texture([[805,776],[938,810],[939,925],[805,889]],pedestalFront,{segments:5});
        texture([[938,810],[975,789],[976,905],[939,925]],pedestalSide,{segments:3});
        texture([[805,776],[843,756],[975,789],[938,810]],[iso(x0,z1,30),iso(x0,z0,30),iso(x1,z0,30),iso(x1,z1,30)]);
        for(const h of [0,8,30])outline(ctx,[iso(x0,z1,h),iso(x1,z1,h),iso(x1,z0,h)],'#b5a184',1);
        const stemLeft=u-.27,stemRight=u+.27;
        texture([[846,624],[922,646],[922,777],[846,753]],[iso(stemLeft,.4,115),iso(stemRight,.4,115),iso(stemRight,.4,30),iso(stemLeft,.4,30)],{segments:6});
        texture([[922,646],[961,623],[961,754],[922,777]],[iso(stemRight,.4,115),iso(stemRight,-.25,115),iso(stemRight,-.25,30),iso(stemRight,.4,30)],{segments:4});
        outline(ctx,[iso(stemLeft,.4,30),iso(stemLeft,.4,115)],'#8a603d',.9);
        outline(ctx,[iso(stemRight,.4,30),iso(stemRight,.4,115)],'#6e4f34',.9);
      }
      // Original jade-painted brackets form independent exact front/side
      // planes below the roof, preserving the generated ornamental detail.
      texture([[311,354],[929,556],[929,645],[311,443]],[iso(-3,.7,132),iso(3,.7,132),iso(3,.7,100),iso(-3,.7,100)],{segments:8});
      texture([[929,556],[1232,481],[1232,570],[929,645]],[iso(3,.7,132),iso(3,-.7,132),iso(3,-.7,100),iso(3,.7,100)],{segments:6});
      tiledRoof({ctx,texture},{
        left:-3.4,right:3.4,depth:1.4,ridgeLeft:-2,ridgeRight:2,eaveHeight:141,ridgeHeight:214,
        tile:[[530,163],[728,226],[652,348],[455,285]],
        side:[[1050,290],[1267,390],[928,520]],
        ridge:[[540,91],[1010,244],[1010,262],[540,111]],
        frontBand:[[311,332],[929,533],[929,556],[311,354]],
        sideBand:[[929,533],[1232,458],[1232,481],[929,556]]
      });
      for(const [source,u]of [[[[491,23],[575,23],[575,132],[491,132]],-2],[[[1025,202],[1113,202],[1113,312],[1025,312]],2]]){
        const [x,y]=iso(u,0,223);texture(source,[[x-11,y-31],[x+11,y-31],[x+11,y+1],[x-11,y+1]]);
      }
    }
  });
}

export function createArchitectureSurface(kind,asset,width){
  if(kind==='building')return building(asset,width);
  if(kind==='gate')return gate(asset,width);
  return null;
}
