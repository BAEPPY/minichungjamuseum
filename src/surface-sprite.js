// Rigid surfaces share the exact map projection. Generated artwork supplies
// material and ornament inside those surfaces, rather than their camera angle.
import {projectMap} from './projection.js';
export const iso=(x,z,height=0)=>{const p=projectMap(x,z,height);return [p.x,p.y];};

export function fillPolygon(ctx,points,fill,stroke=null,lineWidth=1){
  ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth;ctx.lineJoin='miter';ctx.stroke();}
}

export function barycentric(point,triangle){
  const [[ax,ay],[bx,by],[cx,cy]]=triangle,[x,y]=point;
  const determinant=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
  if(Math.abs(determinant)<1e-10)return null;
  const a=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/determinant;
  const b=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/determinant;
  return [a,b,1-a-b];
}

function trianglesFor(source,target){
  if(source.length!==target.length||![3,4].includes(source.length))throw new Error('A textured surface needs three or four matching corners.');
  return (source.length===3?[[0,1,2]]:[[0,1,2],[0,2,3]]).map(indices=>({source:indices.map(i=>source[i]),target:indices.map(i=>target[i])}));
}

export function mapSurfacePoint(point,surfaces,markers={}){
  const marker=markers[point.join(',')];
  if(marker)return [...marker];
  let nearest=null,penalty=Infinity;
  for(const surface of surfaces){
    const weights=barycentric(point,surface.source);if(!weights)continue;
    const outside=weights.reduce((sum,w)=>sum+Math.max(0,-w),0);
    const mapped=surface.target.reduce((sum,p,i)=>[sum[0]+p[0]*weights[i],sum[1]+p[1]*weights[i]],[0,0]);
    if(outside<1e-7)return mapped;
    if(outside<penalty){penalty=outside;nearest=mapped;}
  }
  if(!nearest)throw new Error(`The sprite has no surface or marker for ${point.join(',')}.`);
  return nearest;
}

/**
 * draw/paint callbacks work in canonical logical pixels around the footprint
 * center. Textured quads use canonical source-image coordinates. Their corners
 * and all explicit anchors follow the same geometric scaffold.
 */
export function makeSurfaceSprite(asset,displayWidth,design){
  const {bounds,sourceSize,paint,front,anchors={},sourceMarkers={}}=design;
  if(!asset?.image||!Array.isArray(bounds)||bounds.length!==4||!bounds.every(Number.isFinite)||!Number.isFinite(displayWidth)||displayWidth<=0)throw new RangeError('A surface sprite needs an image, finite bounds and a positive width.');
  const [minX,minY,maxX,maxY]=bounds,referenceWidth=maxX-minX,referenceHeight=maxY-minY;
  if(referenceWidth<=0||referenceHeight<=0)throw new RangeError('Sprite bounds must enclose a positive area.');
  const scale=displayWidth/referenceWidth,left=minX*scale,top=minY*scale,width=displayWidth,height=referenceHeight*scale;
  const pixelWidth=Math.max(1,Math.ceil(width*1.5)),pixelHeight=Math.max(1,Math.ceil(height*1.5));
  const nativeWidth=asset.image.naturalWidth||asset.image.width,nativeHeight=asset.image.naturalHeight||asset.image.height;
  const imageScaleX=nativeWidth/(sourceSize?.[0]||nativeWidth),imageScaleY=nativeHeight/(sourceSize?.[1]||nativeHeight);
  const surfaces=[];
  const register=(source,target)=>{surfaces.push(...trianglesFor(source,target));};
  function layer(callback){
    const canvas=document.createElement('canvas');canvas.width=pixelWidth;canvas.height=pixelHeight;
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('The surface canvas is unavailable.');
    const densityX=pixelWidth/referenceWidth,densityY=pixelHeight/referenceHeight;
    ctx.setTransform(densityX,0,0,densityY,-minX*densityX,-minY*densityY);
    ctx.imageSmoothingEnabled=true;
    function texture(source,target,options={}){
      const expand=(polygon,amount)=>{const center=polygon.reduce((sum,p)=>[sum[0]+p[0]/polygon.length,sum[1]+p[1]/polygon.length],[0,0]);return polygon.map(p=>{const dx=p[0]-center[0],dy=p[1]-center[1],length=Math.hypot(dx,dy)||1;return [p[0]+dx/length*amount,p[1]+dy/length*amount];});};
      const clip=polygon=>{ctx.beginPath();polygon.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.clip();};
      const bleed=Math.max(0,Math.min(2,Number(options.bleed)||0));
      const segments=Math.min(12,Math.max(1,Math.floor(options.segments||1)));
      if(segments>1&&source.length===4&&target.length===4){
        const bilerp=(q,u,v)=>[(1-v)*((1-u)*q[0][0]+u*q[1][0])+v*((1-u)*q[3][0]+u*q[2][0]),(1-v)*((1-u)*q[0][1]+u*q[1][1])+v*((1-u)*q[3][1]+u*q[2][1])];
        ctx.save();clip(bleed?expand(target,bleed):target);
        for(let y=0;y<segments;y++)for(let x=0;x<segments;x++){
          const u=x/segments,v=y/segments,u1=(x+1)/segments,v1=(y+1)/segments;
          const corners=q=>[bilerp(q,u,v),bilerp(q,u1,v),bilerp(q,u1,v1),bilerp(q,u,v1)];
          texture(corners(source),corners(target),{...options,segments:1,bleed:.5});
        }
        ctx.restore();
        return;
      }
      register(source,target);
      ctx.save();clip(bleed?expand(target,bleed):target);
      for(const triangle of trianglesFor(source,target)){
        const [a,b,c]=triangle.source.map(([x,y])=>[x*imageScaleX,y*imageScaleY]);
        const [p,q,r]=triangle.target;
        const ux=b[0]-a[0],uy=b[1]-a[1],vx=c[0]-a[0],vy=c[1]-a[1],det=ux*vy-vx*uy;
        if(Math.abs(det)<1e-10)continue;
        const dx=q[0]-p[0],dy=q[1]-p[1],ex=r[0]-p[0],ey=r[1]-p[1];
        const ma=(dx*vy-ex*uy)/det,mb=(dy*vy-ey*uy)/det,mc=(ex*ux-dx*vx)/det,md=(ey*ux-dy*vx)/det;
        ctx.save();ctx.globalAlpha=options.alpha??ctx.globalAlpha;
        // Overlap only the internal triangle seam; the outer surface clip above
        // keeps the silhouette on its exact scaffold edges.
        const center=[(p[0]+q[0]+r[0])/3,(p[1]+q[1]+r[1])/3];
        const expanded=[p,q,r].map(v=>{const dx=v[0]-center[0],dy=v[1]-center[1],length=Math.hypot(dx,dy)||1;return [v[0]+dx/length*(.4+bleed),v[1]+dy/length*(.4+bleed)];});
        ctx.beginPath();expanded.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.clip();
        ctx.transform(ma,mb,mc,md,p[0]-ma*a[0]-mc*a[1],p[1]-mb*a[0]-md*a[1]);
        ctx.drawImage(asset.image,0,0);ctx.restore();
      }
      ctx.restore();
    }
    callback?.({ctx,texture,register});
    return canvas;
  }
  const base=layer(paint),overlay=front?layer(front):null;
  let image=base;
  if(overlay){image=document.createElement('canvas');image.width=pixelWidth;image.height=pixelHeight;const ctx=image.getContext('2d');ctx.drawImage(base,0,0);ctx.drawImage(overlay,0,0);}
  const scaleAnchor=value=>Array.isArray(value)&&value.length===2&&value.every(Number.isFinite)?{x:value[0]*scale,y:value[1]*scale}:Array.isArray(value)?value.map(scaleAnchor):value;
  const mappedAnchors=Object.fromEntries(Object.entries(anchors).map(([key,value])=>[key,scaleAnchor(value)]));
  const point=(sourceX,sourceY)=>{const [x,y]=mapSurfacePoint([sourceX,sourceY],surfaces,sourceMarkers);return {x:x*scale,y:y*scale};};
  return {image,left,top,width,height,point,anchors:mappedAnchors,...(overlay?{backImage:base,frontImage:overlay}:{})};
}
