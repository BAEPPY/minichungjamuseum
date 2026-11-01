// Calibrated ground-plane geometry for the original generated PNGs. Source
// coordinates include the full image, not only its alpha-trimmed rectangle.
// Keeping vertical source lines vertical avoids leaning walls and furniture.
export const SPRITE_GEOMETRY = Object.freeze({
  building: {size:[1536,1024],ground:[770,703],slopes:[.309,-.487]},
  gate: {size:[1536,1024],ground:[770,830],slopes:[.264,-.486]},
  case: {size:[1536,1024],ground:[776,775],slopes:[.3065,-.512]},
  screen: {size:[1536,1024],ground:[770,825],slopes:[.417,-.416]},
  desk: {size:[1536,1024],ground:[760,724],slopes:[.469,-.576]},
  bench: {size:[1774,887],ground:[885,615]},
  flowers: {size:[1536,1024],ground:[770,625]},
  frame: {size:[1274,1235],ground:[646,1048]},
  tree: {size:[1266,1243],ground:[632,1160]}
});

// Quads run top-left, top-right, bottom-right, bottom-left. The case support
// plane uses rear-left, rear-right, front-right, front-left in the same order.
// World rendering must pass these points through the same raster.point()
// transform as the sprite, then mirror them together when changing direction.
export const SPRITE_MARKERS = Object.freeze({
  building: {entrance:[595,875]},
  gate: {opening:[710,850]},
  case: {
    modelBase:[770,574],
    innerFloor:[[494,362],[1314,636],[1031,789],[222,480]]
  },
  screen: {
    play:[765,493],
    board:[[418,135],[1112,420],[1112,852],[418,543]]
  },
  frame: {paper:[[451,153],[816,350],[816,953],[451,749]]}
});

/** Geometry is separate from rasterization so the ground-plane invariants can
 * be checked without a browser or a second copy of the projection formula. */
export function getSpriteGeometry(kind,asset,displayWidth) {
  const {image,rect:r}=asset;
  if(!image||!r||![r.x,r.y,r.w,r.h,displayWidth].every(Number.isFinite)||r.w<=0||r.h<=0||displayWidth<=0) {
    throw new RangeError('A sprite needs a valid image, crop and positive display width.');
  }
  const metadata=SPRITE_GEOMETRY[kind];
  let anchorX=r.x+r.w/2,anchorY=r.y+r.h,b=0,d=1;
  if(metadata) {
    const sourceWidth=image.naturalWidth||image.width||metadata.size[0];
    const sourceHeight=image.naturalHeight||image.height||metadata.size[1];
    const ratioX=sourceWidth/metadata.size[0],ratioY=sourceHeight/metadata.size[1];
    anchorX=metadata.ground[0]*ratioX;anchorY=metadata.ground[1]*ratioY;
    if(metadata.slopes) {
      const positive=metadata.slopes[0]*ratioY/ratioX;
      const negative=metadata.slopes[1]*ratioY/ratioX;
      d=1/(positive-negative);b=.5-d*positive;
    }
  }
  const scale=displayWidth/r.w;
  const point=(sourceX,sourceY)=>({
    x:scale*(sourceX-anchorX),
    y:scale*(b*(sourceX-anchorX)+d*(sourceY-anchorY))
  });
  const corners=[[r.x,r.y],[r.x+r.w,r.y],[r.x+r.w,r.y+r.h],[r.x,r.y+r.h]].map(p=>point(...p));
  const left=Math.min(...corners.map(p=>p.x)),right=Math.max(...corners.map(p=>p.x));
  const top=Math.min(...corners.map(p=>p.y)),bottom=Math.max(...corners.map(p=>p.y));
  return {left,top,width:right-left,height:bottom-top,point,scale,shear:b,verticalScale:d,anchor:{x:anchorX,y:anchorY}};
}

/** Create a cached-use drawing of a sprite at its calibrated native aspect.
 * All returned geometry is in logical, unzoomed world-screen pixels, relative
 * to its ground center. The source PNG is never modified. */
export function createSpriteRaster(kind,asset,displayWidth) {
  const geometry=getSpriteGeometry(kind,asset,displayWidth);
  const {left,top,width,height,point,scale,shear,verticalScale,anchor}=geometry;
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.ceil(width*1.5));
  canvas.height=Math.max(1,Math.ceil(height*1.5));
  const context=canvas.getContext('2d');
  if(!context)throw new Error('The sprite drawing canvas is unavailable.');
  const densityX=canvas.width/width,densityY=canvas.height/height;
  context.setTransform(
    densityX*scale,densityY*scale*shear,
    0,densityY*scale*verticalScale,
    densityX*(-scale*anchor.x-left),
    densityY*(-scale*(shear*anchor.x+verticalScale*anchor.y)-top)
  );
  context.imageSmoothingEnabled=true;
  const {x,y,w,h}=asset.rect;
  context.drawImage(asset.image,x,y,w,h,x,y,w,h);
  return {image:canvas,left,top,width,height,point};
}
