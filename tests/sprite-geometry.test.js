import test from 'node:test';
import assert from 'node:assert/strict';
import {getSpriteGeometry,SPRITE_GEOMETRY} from '../src/sprite-geometry.js';

const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} differs from ${expected}`);
const assetFor=(metadata,rect)=>({image:{naturalWidth:metadata.size[0],naturalHeight:metadata.size[1]},rect:rect||{x:0,y:0,w:metadata.size[0],h:metadata.size[1]}});

test('calibrated ground axes follow the map while walls remain vertical',()=>{
  for(const [kind,metadata] of Object.entries(SPRITE_GEOMETRY)) {
    if(!metadata.slopes)continue;
    const geometry=getSpriteGeometry(kind,assetFor(metadata),300);
    const [x,y]=metadata.ground,origin=geometry.point(x,y);
    close(origin.x,0);close(origin.y,0);
    for(const [slope,targetSlope] of [[metadata.slopes[0],.5],[metadata.slopes[1],-.5]]) {
      const endpoint=geometry.point(x+100,y+100*slope);
      close(endpoint.y/endpoint.x,targetSlope);
    }
    close(geometry.point(x,y-100).x,0);
  }
});

test('sheared crop bounds contain all four source corners and retain ground anchoring',()=>{
  const metadata=SPRITE_GEOMETRY.case,asset=assetFor(metadata,{x:167,y:18,w:1213,h:1006});
  const geometry=getSpriteGeometry('case',asset,145),r=asset.rect;
  const corners=[[r.x,r.y],[r.x+r.w,r.y],[r.x+r.w,r.y+r.h],[r.x,r.y+r.h]].map(p=>geometry.point(...p));
  close(geometry.width,145);
  close(Math.min(...corners.map(p=>p.x)),geometry.left);
  close(Math.max(...corners.map(p=>p.x)),geometry.left+geometry.width);
  close(Math.min(...corners.map(p=>p.y)),geometry.top);
  close(Math.max(...corners.map(p=>p.y)),geometry.top+geometry.height);
  assert.ok(geometry.top<0&&geometry.top+geometry.height>0);
});

test('already aligned artwork preserves its aspect and a resized source preserves calibration',()=>{
  const metadata=SPRITE_GEOMETRY.flowers,asset=assetFor(metadata,{x:155,y:141,w:1231,h:811});
  const geometry=getSpriteGeometry('flowers',asset,104);
  close(geometry.height,104*811/1231);
  close(geometry.shear,0);close(geometry.verticalScale,1);
  const building=SPRITE_GEOMETRY.building;
  const resized={image:{naturalWidth:768,naturalHeight:256},rect:{x:0,y:0,w:768,h:256}};
  const resizedGeometry=getSpriteGeometry('building',resized,300);
  const [x,y]=building.ground;
  const a=resizedGeometry.point(x/2,y/4);
  close(a.x,0);close(a.y,0);
  const end=resizedGeometry.point((x+100)/2,(y+100*building.slopes[0])/4);
  close(end.y/end.x,.5);
});
