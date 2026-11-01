import {test,expect} from '@playwright/test';

test('the built-in chair has real openwork and supports native observation, photos and reports',async({page})=>{
 test.setTimeout(180000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:1440,height:960});
 await page.goto('/favicon.svg');
 await page.evaluate(async()=>{
  const {put}=await import('/src/storage.js');
  // Exercise the deployed reconstruction itself, without a local-model fixture.
  await put({id:'game-progress',visited:[],making:[],inside:true,exited:false,profileReady:true,avatarName:'투각 의자 탐험가',avatarColor:'#eccd79',avatarHair:'short',videoCompleted:true,videoId:'YM7FhGcR_5E',position:{x:8,z:2.8,inside:true}});
 });
 await page.goto('/');
 await expect(page.locator('#gameLoading')).toHaveCount(0,{timeout:45000});
 await expect(page.locator('#nearName')).toHaveText('청자 투각 의자');

 const geometry=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {artifacts}=await import('/src/artifacts.js');
  const {loadArtifactModel,disposeModel}=await import('/src/models.js');
  const {get}=await import('/src/storage.js');
  const artifact=artifacts.find(a=>a.id==='stool');
  const model=await loadArtifactModel(artifact);
  model.updateMatrixWorld(true);
  const meshes=[];model.traverse(node=>{if(node.isMesh)meshes.push(node);});
  const materials=[...new Set(meshes.flatMap(node=>[].concat(node.material)))];
  const opaque=materials.every(m=>m.opacity===1&&!m.transparent&&!m.alphaMap&&!m.alphaTest&&!m.alphaHash);
  // Check actual intersections, including both sides of every face. Transparent
  // paint or reversed face normals must not masquerade as a through-opening.
  materials.forEach(m=>m.side=THREE.DoubleSide);
  const bounds=new THREE.Box3().setFromObject(model),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
  const ray=new THREE.Raycaster(new THREE.Vector3(center.x,bounds.max.y+size.y,center.z),new THREE.Vector3(0,-1,0),0,size.y*3);
  const centralShaftIntersections=ray.intersectObjects(meshes,false).length;
  const radius=Math.max(size.x,size.z)/2;
  let sidePassages=0,samples=0;
  for(const fraction of [.43,.72])for(let i=0;i<36;i++){
   const angle=i*Math.PI*2/36,outward=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle));
   const sliceCenter=new THREE.Vector3(center.x,bounds.min.y+size.y*fraction,center.z);
   ray.set(sliceCenter.clone().addScaledVector(outward,radius*3),outward.clone().negate());ray.far=radius*6;
   const first=ray.intersectObjects(meshes,false)[0];
   if(!first||first.point.clone().sub(sliceCenter).dot(outward)<-radius*.05)sidePassages++;
   samples++;
  }
  const result={path:artifact.model,pending:Boolean(artifact.nativePending),referenceTint:artifact.referenceTint,source:artifact.sourceDescription,captureSource:artifact.captureDescription,localOverride:Boolean(await get('native-model-stool')),opaque,meshCount:meshes.length,centralShaftIntersections,sidePassages,samples};
  disposeModel(model);return result;
 });
 expect(geometry.path).toBe('/models/celadon-stool-reconstruction.glb');
 expect(geometry.pending).toBe(false);
 expect(geometry.referenceTint).toBe(false);
 expect(geometry.localOverride).toBe(false);
 expect(geometry.source).toMatch(/재현|복원|근사/);
 expect(geometry.captureSource).toMatch(/재현|참고|근사/);
 expect(geometry.source).not.toMatch(/실제 스캔|원본 질감/);
 expect(geometry.opaque).toBe(true);
 expect(geometry.meshCount).toBeGreaterThan(0);
 expect(geometry.centralShaftIntersections).toBe(0);
 expect(geometry.sidePassages).toBeGreaterThan(3);

 const open=async()=>{
  await page.keyboard.press('f');
  await expect(page.locator('#observationDialog')).toBeVisible();
  await expect(page.locator('#objectName')).toHaveText('청자 투각 의자');
  await expect(page.locator('#takePhoto')).toBeEnabled({timeout:45000});
  await expect(page.locator('#chooseForReport')).toBeEnabled();
  await expect(page.locator('#objectCanvas canvas')).toHaveCount(1);
  await expect(page.locator('#objectCanvas iframe')).toHaveCount(0);
  await expect(page.locator('#modelSource')).toContainText(/재현|복원|근사/);
  await expect(page.locator('#colorChoice')).toBeHidden();
 };
 await open();
 await page.locator('#takePhoto').click();
 await expect(page.locator('#photoTray img')).toHaveCount(1);
 const firstPhoto=await page.locator('#photoTray img').first().getAttribute('src');
 const canvas=await page.locator('#objectCanvas canvas').boundingBox();
 await page.mouse.move(canvas.x+canvas.width*.35,canvas.y+canvas.height*.5);
 await page.mouse.down();
 await page.mouse.move(canvas.x+canvas.width*.65,canvas.y+canvas.height*.4,{steps:8});
 await page.mouse.up();
 await page.locator('#zoomObjectIn').click();
 await page.locator('#takePhoto').click();
 await expect(page.locator('#photoTray img')).toHaveCount(2);
 const changedPhoto=await page.locator('#photoTray img').nth(1).getAttribute('src');
 expect(firstPhoto).toMatch(/^data:image\/jpeg;base64,/);
 expect(changedPhoto).toMatch(/^data:image\/jpeg;base64,/);
 expect(changedPhoto).not.toBe(firstPhoto);
 const note='사진을 참고한 재현 모델에서 뚫린 무늬와 위쪽 구멍을 돌려 보았어요.';
 await page.locator('#observationNote').fill(note);
 await expect(page.locator('#noteStatus')).toContainText('저장했어요');
 await page.screenshot({path:'/workspace/game-stool.png'});
 await page.locator('#chooseForReport').click();
 await expect(page.locator('#reportDialog')).toBeVisible();
 await expect(page.locator('#reportForm [name="artifactId"]')).toHaveValue('stool');
 await expect(page.locator('#reportForm [name="features"]')).toHaveValue(note);
 await expect(page.locator('#reportPhotos img')).toHaveCount(2);
 expect(await page.locator('#reportPhotos img').nth(1).getAttribute('src')).toBe(changedPhoto);
 await page.locator('#reportDialog [data-close]').click();

 await page.reload();
 await expect(page.locator('#gameLoading')).toHaveCount(0,{timeout:45000});
 await expect(page.locator('#nearName')).toHaveText('청자 투각 의자');
 await open();
 await expect(page.locator('#photoTray img')).toHaveCount(2);
 await expect(page.locator('#observationNote')).toHaveValue(note);
 expect(await page.locator('#photoTray img').nth(1).getAttribute('src')).toBe(changedPhoto);
 expect(errors).toEqual([]);
});
