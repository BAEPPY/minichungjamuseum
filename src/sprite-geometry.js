import {createDisplaySurface} from './display-surfaces.js';
import {createFurnitureSurface} from './furniture-surfaces.js';
import {createArchitectureSurface} from './architecture-surfaces.js';

// Source markers connect the original material images to exact surface
// anchors. Structural objects never fall back to a whole-picture shear.
export const SPRITE_MARKERS=Object.freeze({
 building:{entrance:[595,875]},gate:{opening:[710,850]},
 case:{modelBase:[770,574],innerFloor:[[494,362],[1314,636],[1031,789],[222,480]]},
 screen:{play:[765,493],board:[[418,135],[1112,420],[1112,852],[418,543]]},
 frame:{paper:[[451,153],[816,350],[816,953],[451,749]]}
});

export function createSpriteRaster(kind,asset,displayWidth){
 const rigid=createDisplaySurface(kind,asset,displayWidth)||createFurnitureSurface(kind,asset,displayWidth)||createArchitectureSurface(kind,asset,displayWidth);
 if(rigid)return rigid;
 if(kind!=='tree')throw new Error(`Missing rigid surface renderer: ${kind}`);
 // Organic foliage keeps its generated silhouette, anchored at the pot foot.
 const {image,rect:r}=asset,scale=displayWidth/r.w;
 const anchor={x:632*(image.naturalWidth||image.width)/1266,y:1160*(image.naturalHeight||image.height)/1243};
 const left=(r.x-anchor.x)*scale,top=(r.y-anchor.y)*scale,width=displayWidth,height=r.h*scale;
 const canvas=document.createElement('canvas');canvas.width=Math.ceil(width*1.5);canvas.height=Math.ceil(height*1.5);
 const context=canvas.getContext('2d');context.imageSmoothingEnabled=true;context.drawImage(image,r.x,r.y,r.w,r.h,0,0,canvas.width,canvas.height);
 return {image:canvas,left,top,width,height,point:(x,y)=>({x:(x-anchor.x)*scale,y:(y-anchor.y)*scale}),anchors:{ground:{x:0,y:0}}};
}
