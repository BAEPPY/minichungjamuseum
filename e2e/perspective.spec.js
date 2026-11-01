import {test,expect} from '@playwright/test';

test('the real case raster preserves parallel roof, floor and base edges',async({page})=>{
  await page.route('**/perspective-qa.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body><main id="surfaces"></main></body></html>'}));
  await page.goto('/perspective-qa.html');
  const result=await page.evaluate(async()=>{
    const {createSpriteRaster}=await import('/src/sprite-geometry.js');
    const image=new Image();image.src='/art/props/display-case.png';await image.decode();
    const geometry=createSpriteRaster('case',{image,rect:{x:0,y:0,w:image.naturalWidth,h:image.naturalHeight}},128);
    const sample=p=>geometry.point(...p),roof=[sample([214,171]),sample([1033,422])],floor=[sample([222,480]),sample([1031,789])],base=[sample([174,693]),sample([1034,1009])];
    const slope=edge=>(edge[1].y-edge[0].y)/(edge[1].x-edge[0].x),canvas=geometry.image;document.querySelector('#surfaces').append(canvas);
    return {slopes:[roof,floor,base].map(slope),glassHeights:roof.map((p,i)=>floor[i].y-p.y),baseHeights:floor.map((p,i)=>base[i].y-p.y),pillarX:roof.map((p,i)=>floor[i].x-p.x),layers:Boolean(geometry.backImage&&geometry.frontImage),photoPanel:geometry.anchors?.photoPanel?.length,opaquePixels:Array.from(canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data).filter((v,i)=>i%4===3&&v>128).length};
  });
  for(const slope of result.slopes)expect(slope).toBeCloseTo(.5,7);
  expect(result.glassHeights[0]).toBeCloseTo(result.glassHeights[1],7);
  expect(result.baseHeights[0]).toBeCloseTo(result.baseHeights[1],7);
  for(const x of result.pillarX)expect(x).toBeCloseTo(0,7);
  expect(result.layers).toBe(true);expect(result.photoPanel).toBe(4);expect(result.opaquePixels).toBeGreaterThan(1000);
});
