// Furniture uses one rigid 2:1 scaffold. The generated PNGs contribute wood,
// metal and celadon ornament, while every ledge and leg keeps the map axes.
import {iso,fillPolygon,makeSurfaceSprite} from './surface-sprite.js';

const quad=(x0,x1,z0,z1,h)=>[iso(x0,z1,h),iso(x0,z0,h),iso(x1,z0,h),iso(x1,z1,h)];
const front=(x0,x1,z,h0,h1)=>[iso(x0,z,h1),iso(x1,z,h1),iso(x1,z,h0),iso(x0,z,h0)];
const side=(x,z0,z1,h0,h1)=>[iso(x,z1,h1),iso(x,z0,h1),iso(x,z0,h0),iso(x,z1,h0)];
const bilerp=(q,u,v)=>[(1-v)*((1-u)*q[0][0]+u*q[3][0])+v*((1-u)*q[1][0]+u*q[2][0]),(1-v)*((1-u)*q[0][1]+u*q[3][1])+v*((1-u)*q[1][1]+u*q[2][1])];
const strip=(q,v0,v1)=>[bilerp(q,0,v0),bilerp(q,0,v1),bilerp(q,1,v1),bilerp(q,1,v0)];

function prism(ctx,x0,x1,z0,z1,h0,h1,colors,outline='#273b3e'){
  fillPolygon(ctx,front(x0,x1,z1,h0,h1),colors[1],outline,.65);
  fillPolygon(ctx,side(x1,z0,z1,h0,h1),colors[2],outline,.65);
  fillPolygon(ctx,quad(x0,x1,z0,z1,h1),colors[0],outline,.65);
}

function bench(asset,width){
  const seat=[ [340,209],[550,87],[1443,502],[1232,625] ];
  return makeSurfaceSprite(asset,width,{
    sourceSize:[1774,887],bounds:[-66,-59,66,35],
    anchors:{ground:[0,0],seat:iso(0,0,24)},
    paint({ctx,texture}){
      // Two U-shaped steel supports. All four feet share h=0, including the
      // rear feet which the old perspective illustration placed at odd levels.
      for(const x of [-1.28,1.28]){
        prism(ctx,x-.09,x+.09,-.31,.31,0,3,['#697f87','#3d555f','#263d47']);
        for(const z of [-.27,.27]){
          prism(ctx,x-.075,x+.075,z-.065,z+.065,2,21,['#76909b','#405963','#293f48']);
          texture([[372,293],[410,313],[410,458],[372,439]],front(x-.069,x+.069,z+.066,4,20));
        }
      }
      // Five independent slats: the texture samples are inset from the old
      // dark seams. New seams are the exact projected rectangle boundaries.
      for(let i=0;i<5;i++){
        const v0=i/5,v1=(i+1)/5,z0=-.375+i*.15+.012,z1=z0+.126;
        const top=quad(-1.6,1.6,z0,z1,24);
        fillPolygon(ctx,top,'#c29145','#66451f',.45);
        // Source v runs from the front edge to the back edge.
        texture(strip(seat,1-v1+.014,1-v0-.014),top);
        fillPolygon(ctx,top,null,'#a97632',.45);
        const face=front(-1.6,1.6,z1,20,24);
        texture([[340,209],[1232,625],[1232,665],[340,250]],face);
        fillPolygon(ctx,face,null,'#775022',.55);
        fillPolygon(ctx,side(1.6,z0,z1,20,24),'#99662d','#63451f',.55);
        ctx.strokeStyle='#ebc16e';ctx.lineWidth=.45;
        const a=iso(-1.59,z0,24),b=iso(1.59,z0,24);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();
      }
    }
  });
}

function desk(asset,width){
  const x0=-1.45,x1=1.45,z0=-.625,z1=.625;
  return makeSurfaceSprite(asset,width,{
    sourceSize:[1536,1024],bounds:[-73,-88,73,39],
    anchors:{ground:[0,0],table:iso(0,0,47),writing:iso(0,0,48)},
    paint({ctx,texture}){
      const legs=[[x0+.12,z0+.12],[x1-.12,z0+.12],[x0+.12,z1-.12],[x1-.12,z1-.12]].sort((a,b)=>a[0]+a[1]-b[0]-b[1]);
      for(const [x,z]of legs){
        prism(ctx,x-.11,x+.11,z-.11,z+.11,0,43,['#51696a','#28434c','#1d3540']);
        prism(ctx,x-.13,x+.13,z-.13,z+.13,0,5,['#e7c46e','#b68a3f','#927035'],'#6d5b33');
      }
      // The decorative apron and side panel retain the teacher's generated
      // lotus/celadon woodwork, each on a true vertical plane.
      const apron=front(x0+.34,x1-.34,z1-.02,25,41);
      texture([[383,368],[836,576],[836,673],[383,475]],apron);
      fillPolygon(ctx,apron,null,'#1b3540',.75);
      const panel=side(x1-.02,z0+.22,z1-.22,7,41);
      texture([[968,623],[1240,479],[1240,725],[968,883]],panel);
      fillPolygon(ctx,panel,null,'#263e44',.8);
      // Narrow decorated faces on the two front uprights.
      texture([[281,324],[344,355],[344,633],[281,604]],front(x0+.015,x0+.225,z1-.005,6,41));
      texture([[852,639],[914,670],[914,918],[852,884]],front(x1-.225,x1-.015,z1-.005,6,41));
      // Top and its separately mapped thickness share exactly the same four
      // x/z corners; the notebook and pencil are kept in the wood texture.
      const top=quad(x0,x1,z0,z1,47);
      texture([[280,270],[553,106],[1240,404],[953,565]],top);
      fillPolygon(ctx,top,null,'#745025',.7);
      texture([[277,270],[954,580],[954,617],[277,306]],front(x0,x1,z1,43,47));
      texture([[954,580],[1252,412],[1252,448],[954,617]],side(x1,z0,z1,43,47));
      fillPolygon(ctx,front(x0,x1,z1,43,47),null,'#5d4626',.6);
      fillPolygon(ctx,side(x1,z0,z1,43,47),null,'#4d3f29',.6);
      for(const [x,z]of [[x0,z0],[x1,z0],[x0,z1],[x1,z1]])prism(ctx,x-.09,x+.09,z-.09,z+.09,47,50,['#f5d48c','#d2aa58','#a87d36'],'#725833');
    }
  });
}

// Foliage is organic artwork, so it is clipped independently from the old
// planter stone. Its source-ground plane supplies an affine mapping, while the
// rigid stone box below is rebuilt from shared projected vertices.
const foliageOutline=[
  [272,263],[301,238],[303,208],[344,210],[364,177],[392,184],[399,160],[439,184],
  [464,182],[494,211],[533,214],[555,237],[598,229],[625,250],[665,255],[686,279],
  [727,290],[753,317],[796,325],[822,350],[865,368],[896,393],[931,403],[952,429],
  [997,442],[1020,468],[1064,483],[1087,508],[1131,520],[1156,545],[1202,561],
  [1228,585],[1274,599],[1293,627],[1269,650],[1250,650],[1240,674],[1205,677],
  [1187,704],[1152,710],[1117,693],[1088,694],[1043,674],[1016,650],[974,640],
  [947,617],[906,604],[879,578],[839,565],[812,541],[771,529],[743,503],[701,490],
  [674,466],[634,452],[607,428],[564,415],[538,391],[496,378],[470,352],[429,339],
  [402,314],[360,300],[335,278],[297,274]
];

function affineMapper(source,target){
  const [a,b,c]=source,[p,q,r]=target,ux=b[0]-a[0],uy=b[1]-a[1],vx=c[0]-a[0],vy=c[1]-a[1],det=ux*vy-vx*uy;
  const ma=((q[0]-p[0])*vy-(r[0]-p[0])*uy)/det,mc=((r[0]-p[0])*ux-(q[0]-p[0])*vx)/det;
  const mb=((q[1]-p[1])*vy-(r[1]-p[1])*uy)/det,md=((r[1]-p[1])*ux-(q[1]-p[1])*vx)/det;
  return ([x,y])=>[p[0]+ma*(x-a[0])+mc*(y-a[1]),p[1]+mb*(x-a[0])+md*(y-a[1])];
}

function flowers(asset,width){
  const x0=-1.625,x1=1.625,z0=-.45,z1=.45;
  return makeSurfaceSprite(asset,width,{
    sourceSize:[1536,1024],bounds:[-69,-62,69,35],
    anchors:{ground:[0,0],bed:iso(0,0,22)},
    paint({ctx,texture}){
      // Thin plinth, decorated wall, and broad upper rim are separate levels.
      // Opaque underfills own the silhouette: chipped/transparent source pixels
      // remain surface detail and cannot tilt a supposedly straight plinth.
      const stoneFace=(source,target,fill)=>{
        fillPolygon(ctx,target,fill);
        texture(source,target);
        fillPolygon(ctx,target,null,'#a29374',.45);
      };
      stoneFace([[156,414],[1096,886],[1096,946],[156,472]],front(x0,x1,z1,0,4),'#d9caaa');
      stoneFace([[1096,886],[1380,746],[1380,797],[1096,946]],side(x1,z0,z1,0,4),'#c4b696');
      stoneFace([[192,360],[1096,812],[1096,893],[192,443]],front(x0+.07,x1-.07,z1-.04,4,17),'#e4d7b8');
      stoneFace([[1110,819],[1366,690],[1366,769],[1110,898]],side(x1-.04,z0+.06,z1-.06,4,17),'#cbbf9f');
      stoneFace([[158,274],[1096,743],[1096,810],[158,342]],front(x0,x1,z1,17,22),'#e9dbba');
      stoneFace([[1096,743],[1380,610],[1380,677],[1096,810]],side(x1,z0,z1,17,22),'#d2c4a1');
      const rim=quad(x0,x1,z0,z1,22);
      fillPolygon(ctx,rim,'#eee1bc','#a49774',.55);
      const soil=quad(x0+.16,x1-.16,z0+.14,z1-.14,22.2);
      fillPolygon(ctx,soil,'#6e5032','#a89163',.45);
      // Outer cream rim remains exact after plants are placed over the soil.
      const map=affineMapper([[445,185],[1275,600],[260,279]],[iso(x0+.16,z0+.14,22.2),iso(x1-.16,z0+.14,22.2),iso(x0+.16,z1-.14,22.2)]);
      const clip=foliageOutline.map(map),cover=[[200,120],[1400,120],[1400,750],[200,750]];
      ctx.save();ctx.beginPath();clip.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.clip();texture(cover,cover.map(map));ctx.restore();
      for(const [z,h]of [[z1,22],[z1,17],[z1-.04,4],[z1,0]]){
        const a=iso(x0,z,h),b=iso(x1,z,h);ctx.strokeStyle=h===22?'#f7edcf':'#ad9b77';ctx.lineWidth=.45;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();
      }
    }
  });
}

export function createFurnitureSurface(kind,asset,width){
  if(kind==='bench')return bench(asset,width);
  if(kind==='desk')return desk(asset,width);
  if(kind==='flowers')return flowers(asset,width);
  return null;
}
