import {test,expect} from '@playwright/test';
import {seedCompletedComparison} from './helpers/course.js';

test.setTimeout(120000);

test.beforeEach(async({page})=>{
 await seedCompletedComparison(page,{position:{x:8,z:-1.7,inside:true},avatarName:'매병 탐험가',galleryReady:true});
});

async function loadMaebyeongRoom(page){
 await page.goto('/');
 await expect(page.locator('#gameLoading')).toHaveCount(0);
 await expect(page.locator('#nearName')).toHaveText('청자 상감 운학문 매병');
 await expect(page.locator('#interactButton')).toBeVisible();
}

test('maebyeong preserves authored PBR maps and independent texture ownership',async({page})=>{
 await page.goto('/');
 await expect(page.locator('#gameLoading')).toHaveCount(0);
 const result=await page.evaluate(async()=>{
  const {artifacts}=await import('/src/artifacts.js');
  const {loadArtifactModel,disposeModel}=await import('/src/models.js');
  const artifact=artifacts.find(a=>a.id==='maebyeong');
  const first=await loadArtifactModel(artifact);
  const second=await loadArtifactModel(artifact);
  const materials=object=>{
   const found=[];
   object.traverse(node=>{if(node.isMesh)found.push(...[].concat(node.material));});
   return found;
  };
  const firstMaterial=materials(first).find(m=>m.map&&m.normalMap&&m.roughnessMap);
  const secondMaterial=materials(second).find(m=>m.map&&m.normalMap&&m.roughnessMap);
  if(!firstMaterial||!secondMaterial){
   disposeModel(first);disposeModel(second);
   return {hasMaps:false};
  }
  const values={
   hasMaps:true,
   referenceTint:artifact.referenceTint,
   color:firstMaterial.color.toArray(),
   clearcoat:firstMaterial.clearcoat,
   ior:firstMaterial.ior,
   independentMaterial:firstMaterial!==secondMaterial,
   independentMaps:['map','normalMap','roughnessMap'].every(key=>firstMaterial[key]!==secondMaterial[key]),
   originalImageSources:['map','normalMap','roughnessMap'].every(key=>firstMaterial[key].source===secondMaterial[key].source),
   sameValues:['roughness','metalness','clearcoat','ior'].every(key=>firstMaterial[key]===secondMaterial[key])
  };
  let secondTexturesDisposed=0;
  for(const texture of new Set([secondMaterial.map,secondMaterial.normalMap,secondMaterial.roughnessMap])){
   texture.addEventListener('dispose',()=>secondTexturesDisposed++);
  }
  disposeModel(first);
  values.secondTexturesDisposedByFirst=secondTexturesDisposed;
  values.secondImagesRemain=['map','normalMap','roughnessMap'].every(key=>Boolean(secondMaterial[key].image));
  const reopened=await loadArtifactModel(artifact);
  const reopenedMaterial=materials(reopened).find(m=>m.map&&m.normalMap&&m.roughnessMap);
  values.reopenedMaps=Boolean(reopenedMaterial);
  values.reopenedColor=reopenedMaterial?.color.toArray();
  disposeModel(second);disposeModel(reopened);
  return values;
 });
 expect(result.hasMaps).toBeTruthy();
 expect(result.referenceTint).toBe(false);
 expect(result.color).toEqual([1,1,1]);
 expect(result.clearcoat).toBeCloseTo(.23,4);
 expect(result.ior).toBeCloseTo(1.48,4);
 expect(result.independentMaterial).toBeTruthy();
 expect(result.independentMaps).toBeTruthy();
 expect(result.originalImageSources).toBeTruthy();
 expect(result.sameValues).toBeTruthy();
 expect(result.secondTexturesDisposedByFirst).toBe(0);
 expect(result.secondImagesRemain).toBeTruthy();
 expect(result.reopenedMaps).toBeTruthy();
 expect(result.reopenedColor).toEqual([1,1,1]);
});

test('textured maebyeong can be observed, photographed, inserted into a report and reopened',async({page})=>{
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await loadMaebyeongRoom(page);
 await page.waitForTimeout(600);
 await page.screenshot({path:'/workspace/game-maebyeong-world.png'});
 await page.keyboard.press('f');
 await expect(page.locator('#observationDialog')).toBeVisible();
 await expect(page.locator('#objectName')).toHaveText('청자 상감 운학문 매병');
 await expect(page.locator('#takePhoto')).toBeEnabled();
 await expect(page.locator('#modelSource')).toContainText('사진 참고 재현 모델');
 await expect(page.locator('#colorChoice')).toBeHidden();
 await expect(page.locator('#referenceColor')).toBeHidden();
 const canvas=await page.locator('#objectCanvas canvas').boundingBox();
 await page.mouse.move(canvas.x+canvas.width*.35,canvas.y+canvas.height*.5);
 await page.mouse.down();
 await page.mouse.move(canvas.x+canvas.width*.6,canvas.y+canvas.height*.45,{steps:6});
 await page.mouse.up();
 await page.locator('#takePhoto').click();
 await expect(page.locator('#photoTray img')).toHaveCount(1);
 await page.locator('#observationNote').fill('매병의 둥근 어깨와 표면 무늬를 관찰했어요.');
 await expect(page.locator('#noteStatus')).toContainText('저장했어요');
 const photo=await page.locator('#photoTray img').getAttribute('src');
 expect(photo.startsWith('data:image/jpeg;base64,')).toBeTruthy();
 expect(photo.length).toBeLessThan(220000);
 await page.screenshot({path:'/workspace/game-maebyeong-v2.png'});
 await page.locator('#chooseForReport').click();
 await expect(page.locator('#reportDialog')).toBeVisible();
 await expect(page.locator('#reportForm [name="artifactId"]')).toHaveValue('maebyeong');
 await expect(page.locator('#reportForm [data-gallery-note="maebyeong"]')).toHaveValue('매병의 둥근 어깨와 표면 무늬를 관찰했어요.');
 await expect(page.locator('#reportPhotos img')).toHaveCount(1);
 expect(await page.locator('#reportPhotos img').getAttribute('src')).toBe(photo);
 await page.locator('#reportDialog [data-close]').click();
 await expect(page.locator('#nearName')).toHaveText('청자 상감 운학문 매병');
 await page.keyboard.press('f');
 await expect(page.locator('#observationDialog')).toBeVisible();
 await expect(page.locator('#takePhoto')).toBeEnabled();
 await expect(page.locator('#modelSource')).toContainText('사진 참고 재현 모델');
 await expect(page.locator('#colorChoice')).toBeHidden();
 await expect(page.locator('#photoTray img')).toHaveCount(1);
 await expect(page.locator('#observationNote')).toHaveValue('매병의 둥근 어깨와 표면 무늬를 관찰했어요.');
 await page.screenshot({path:'/workspace/game-maebyeong-reopened.png'});
 expect(errors).toEqual([]);
});
