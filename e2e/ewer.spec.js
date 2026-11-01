import {test,expect} from '@playwright/test';

test('the supplied textured ewer is native, rotates and zooms, and keeps its photos and notes',async({page})=>{
 test.setTimeout(150000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:1440,height:960});
 await page.goto('/favicon.svg');
 await page.evaluate(async()=>{
  const {put}=await import('/src/storage.js');
  // No locally uploaded model substitutes for the actual deployed ewer.
  await put({id:'game-progress',visited:[],making:[],inside:true,exited:false,profileReady:true,avatarName:'주전자 탐험가',avatarColor:'#eccd79',avatarHair:'short',videoCompleted:true,videoId:'YM7FhGcR_5E',position:{x:6,z:-6.2,inside:true}});
 });
 await page.goto('/');
 await expect(page.locator('#gameLoading')).toHaveCount(0,{timeout:45000});
 await expect(page.locator('#nearName')).toHaveText('청자 어룡형 주전자');

 const source=await page.evaluate(async()=>{
  const {artifacts}=await import('/src/artifacts.js');
  const {loadArtifactModel,disposeModel}=await import('/src/models.js');
  const {get}=await import('/src/storage.js');
  const artifact=artifacts.find(a=>a.id==='ewer');
  const model=await loadArtifactModel(artifact);
  const meshes=[];model.traverse(node=>{if(node.isMesh)meshes.push(node);});
  const maps=[...new Set(meshes.flatMap(node=>[].concat(node.material)).map(m=>m.map).filter(Boolean))];
  const sampled=maps.map(map=>{
   const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(map.image,0,0,32,32);
   const pixels=ctx.getImageData(0,0,32,32).data;let nonWhite=0,low=255,high=0;
   for(let i=0;i<pixels.length;i+=4){const value=(pixels[i]+pixels[i+1]+pixels[i+2])/3;low=Math.min(low,value);high=Math.max(high,value);if(Math.min(pixels[i],pixels[i+1],pixels[i+2])<230)nonWhite++;}
   return {width:map.image.width,height:map.image.height,nonWhite,range:high-low};
  });
  const result={path:artifact.model,pending:Boolean(artifact.nativePending),referenceTint:artifact.referenceTint,localOverride:Boolean(await get('native-model-ewer')),meshCount:meshes.length,texturedMeshes:meshes.filter(node=>[].concat(node.material).some(m=>m.map)).length,sampled};
  disposeModel(model);return result;
 });
 expect(source.path).toBe('/models/celadon-ewer.glb');
 expect(source.pending).toBe(false);
 expect(source.referenceTint).toBe(false);
 expect(source.localOverride).toBe(false);
 expect(source.meshCount).toBeGreaterThanOrEqual(2);
 expect(source.texturedMeshes).toBe(source.meshCount);
 expect(source.sampled).toHaveLength(2);
 for(const texture of source.sampled){
  expect(texture.width).toBeGreaterThanOrEqual(1024);
  expect(texture.height).toBeGreaterThanOrEqual(1024);
  expect(texture.nonWhite).toBeGreaterThan(30);
  expect(texture.range).toBeGreaterThan(25);
 }

 const open=async()=>{
  await page.keyboard.press('f');
  await expect(page.locator('#observationDialog')).toBeVisible();
  await expect(page.locator('#objectName')).toHaveText('청자 어룡형 주전자');
  await expect(page.locator('#takePhoto')).toBeEnabled({timeout:30000});
  await expect(page.locator('#objectCanvas canvas')).toHaveCount(1);
  await expect(page.locator('#objectCanvas iframe')).toHaveCount(0);
  await expect(page.locator('#colorChoice')).toBeHidden();
  await expect(page.locator('#modelSource')).not.toContainText('등록 대기');
 };
 await open();
 await page.locator('#takePhoto').click();
 await expect(page.locator('#photoTray img')).toHaveCount(1);
 const firstPhoto=await page.locator('#photoTray img').first().getAttribute('src');
 const canvas=await page.locator('#objectCanvas canvas').boundingBox();
 await page.mouse.move(canvas.x+canvas.width*.35,canvas.y+canvas.height*.5);
 await page.mouse.down();
 await page.mouse.move(canvas.x+canvas.width*.65,canvas.y+canvas.height*.42,{steps:8});
 await page.mouse.up();
 await page.locator('#zoomObjectIn').click();
 await page.locator('#takePhoto').click();
 await expect(page.locator('#photoTray img')).toHaveCount(2);
 const secondPhoto=await page.locator('#photoTray img').nth(1).getAttribute('src');
 expect(firstPhoto).toMatch(/^data:image\/jpeg;base64,/);
 expect(secondPhoto).toMatch(/^data:image\/jpeg;base64,/);
 expect(secondPhoto).not.toBe(firstPhoto);
 const note='물고기를 닮은 몸통과 용을 닮은 머리, 손잡이의 모양을 관찰했어요.';
 await page.locator('#observationNote').fill(note);
 await expect(page.locator('#noteStatus')).toContainText('저장했어요');
 await page.screenshot({path:'/workspace/game-ewer.png'});
 await page.locator('#chooseForReport').click();
 await expect(page.locator('#reportDialog')).toBeVisible();
 await expect(page.locator('#reportForm [name="artifactId"]')).toHaveValue('ewer');
 await expect(page.locator('#reportForm [name="features"]')).toHaveValue(note);
 await expect(page.locator('#reportPhotos img')).toHaveCount(2);
 expect(await page.locator('#reportPhotos img').nth(1).getAttribute('src')).toBe(secondPhoto);
 await page.locator('#reportDialog [data-close]').click();

 await page.reload();
 await expect(page.locator('#gameLoading')).toHaveCount(0,{timeout:45000});
 await expect(page.locator('#nearName')).toHaveText('청자 어룡형 주전자');
 await open();
 await expect(page.locator('#photoTray img')).toHaveCount(2);
 await expect(page.locator('#observationNote')).toHaveValue(note);
 expect(await page.locator('#photoTray img').nth(1).getAttribute('src')).toBe(secondPhoto);
 expect(errors).toEqual([]);
});
