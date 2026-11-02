import {test,expect} from '@playwright/test';
import {seedCompletedComparison,openReportAtDesk,moveToCourseDestination} from './helpers/course.js';
import {mkdir,writeFile} from 'node:fs/promises';

test('the built-in chair has real openwork and supports native observation, photos and reports',async({page})=>{
 test.setTimeout(180000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const consoleErrors=[];page.on('console',event=>{if(event.type()==='error')consoleErrors.push({text:event.text(),location:event.location()});});
 const attachJSON=async(name,data)=>{
  const path=test.info().outputPath(`${name}.json`);
  await mkdir(test.info().outputDir,{recursive:true});
  await writeFile(path,JSON.stringify(data,null,2));
  await test.info().attach(name,{path,contentType:'application/json'});
 };
 await page.setViewportSize({width:1440,height:960});
 await seedCompletedComparison(page,{destination:'stool',avatarName:'투각 의자 탐험가',galleryReady:true});
 await page.goto('/');
 await expect(page.locator('#gameLoading')).toHaveCount(0,{timeout:45000});
 await expect(page.locator('#nearName')).toHaveText('청자 투각 의자');

 const geometry=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {artifacts}=await import('/src/artifacts.js');
  const {loadArtifactModel,disposeModel}=await import('/src/models.js');
  const {get}=await import('/src/storage.js');
  const artifact=artifacts.find(a=>a.id==='stool'),model=await loadArtifactModel(artifact);
  model.updateMatrixWorld(true);
  const meshes=[];model.traverse(node=>{if(node.isMesh)meshes.push(node);});
  const materials=[...new Set(meshes.flatMap(node=>[].concat(node.material)))];
  let vertices=0,triangles=0,finiteColors=true,opaqueVertexAlpha=true;
  const colorMinimum=[1,1,1],colorMaximum=[0,0,0],colorAttributes=[];
  for(const mesh of meshes){
   const position=mesh.geometry.getAttribute('position'),color=mesh.geometry.getAttribute('color');
   vertices+=position.count;triangles+=(mesh.geometry.index?.count||position.count)/3;
   colorAttributes.push({present:Boolean(color),normalized:color?.normalized,arrayType:color?.array?.constructor.name,count:color?.count,positionCount:position.count});
   if(!color){finiteColors=false;continue;}
   for(let i=0;i<color.count;i++){
    const values=[color.getX(i),color.getY(i),color.getZ(i)];
    for(let c=0;c<3;c++){finiteColors&&=Number.isFinite(values[c])&&values[c]>=0&&values[c]<=1;colorMinimum[c]=Math.min(colorMinimum[c],values[c]);colorMaximum[c]=Math.max(colorMaximum[c],values[c]);}
    if(color.itemSize===4)opaqueVertexAlpha&&=color.getW(i)>.9999;
   }
  }
  const surfaceMaterials=materials.map(m=>({metallic:m.metalness,roughness:m.roughness,clearcoat:m.clearcoat,vertexColors:m.vertexColors,hasSyntheticMaps:Boolean(m.map||m.normalMap||m.roughnessMap)}));
  const opaque=materials.every(m=>m.opacity===1&&!m.transparent&&!m.alphaMap&&!m.alphaTest&&!m.alphaHash);
  materials.forEach(m=>m.side=THREE.DoubleSide);
  const bounds=new THREE.Box3().setFromObject(model),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
  const ray=new THREE.Raycaster(new THREE.Vector3(center.x,bounds.max.y+size.y,center.z),new THREE.Vector3(0,-1,0),0,size.y*3);
  const centralShaftIntersections=ray.intersectObjects(meshes,false).length,radius=Math.max(size.x,size.z)/2;
  const frontDistancesAt=(fraction,resolution,phase=0)=>{
   const distances=[];
   for(let i=0;i<resolution;i++){
    const angle=phase+i*Math.PI*2/resolution,outward=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle));
    const sliceCenter=new THREE.Vector3(center.x,bounds.min.y+size.y*fraction,center.z);
    ray.set(sliceCenter.clone().addScaledVector(outward,radius*3),outward.clone().negate());ray.far=radius*6;
    const first=ray.intersectObjects(meshes,false)[0];
    distances.push(first?first.point.clone().sub(sliceCenter).dot(outward)/radius:null);
   }
   return distances;
  };
  // The supplied mesh has narrow real openings centered at 25+30k degrees.
  // A 10-degree phase samples those rather than only the ceramic ribs.
  const bodyOpeningCounts=[.50,.55].map(fraction=>frontDistancesAt(fraction,24,Math.PI/18).filter(distance=>distance===null||distance<-.05).length);
  const upperBandFrontHits=frontDistancesAt(.90,36).filter(distance=>distance!==null&&distance>.4).length;
  const result={path:artifact.model,pending:Boolean(artifact.nativePending),referenceTint:artifact.referenceTint,source:artifact.sourceDescription,captureSource:artifact.captureDescription,localOverride:Boolean(await get('native-model-stool')),vertices,triangles,colorAttributes,finiteColors,opaqueVertexAlpha,colorMinimum,colorMaximum,opaque,surfaceMaterials,centralShaftIntersections,bodyOpeningCounts,upperBandFrontHits};
  disposeModel(model);return result;
 });
 await attachJSON('chair-material-and-geometry',geometry);
 expect(geometry.path).toBe('/models/celadon-stool-wrl.glb');
 expect(geometry.pending).toBe(false);
 expect(geometry.referenceTint).toBe(false);
 expect(geometry.localOverride).toBe(false);
 expect(geometry.source).toMatch(/원본 형상.*색상/);
 expect(geometry.captureSource).toMatch(/원본 형상.*색상/);
 expect(geometry.source).toMatch(/광택.*참고/);
 expect(geometry.captureSource).toMatch(/광택.*참고/);
 expect(geometry.vertices).toBe(388424);
 expect(geometry.triangles).toBe(777108);
 expect(geometry.finiteColors).toBe(true);
 expect(geometry.opaqueVertexAlpha).toBe(true);
 for(const color of geometry.colorAttributes){
  expect(color.present).toBe(true);expect(color.normalized).toBe(true);
  expect(color.arrayType).toBe('Uint16Array');expect(color.count).toBe(color.positionCount);
 }
 expect(Math.max(...geometry.colorMaximum.map((value,i)=>value-geometry.colorMinimum[i]))).toBeGreaterThan(.05);
 expect(geometry.opaque).toBe(true);
 for(const material of geometry.surfaceMaterials){
  expect(material.metallic).toBe(0);expect(material.vertexColors).toBe(true);
  expect(material.hasSyntheticMaps).toBe(false);
  expect(material.roughness).toBeGreaterThan(.05);expect(material.roughness).toBeLessThan(.8);
  expect(material.clearcoat).toBeGreaterThan(0);expect(material.clearcoat).toBeLessThanOrEqual(1);
 }
 expect(geometry.centralShaftIntersections).toBe(0);
 expect(Math.min(...geometry.bodyOpeningCounts)).toBeGreaterThan(0);
 expect(geometry.upperBandFrontHits).toBe(36);

 const open=async()=>{
  await page.keyboard.press('f');
  await expect(page.locator('#observationDialog')).toBeVisible();
  await expect(page.locator('#objectName')).toHaveText('청자 투각 의자');
  await expect(page.locator('#takePhoto')).toBeEnabled({timeout:45000});
  await expect(page.locator('#chooseForReport')).toBeEnabled();
  await expect(page.locator('#objectCanvas canvas')).toHaveCount(1);
  await expect(page.locator('#objectCanvas iframe')).toHaveCount(0);
  await expect(page.locator('#modelSource')).toContainText(/원본 형상.*색상/);
  await expect(page.locator('#colorChoice')).toBeHidden();
 };
 await open();
 await page.locator('#takePhoto').click();
 await expect(page.locator('#photoTray img')).toHaveCount(1);
 const firstPhoto=await page.locator('#photoTray img').first().getAttribute('src');
 const canvas=await page.locator('#objectCanvas canvas').boundingBox();
 await page.mouse.move(canvas.x+canvas.width*.35,canvas.y+canvas.height*.5);
 await page.mouse.down();
 await page.mouse.move(canvas.x+canvas.width*.65,canvas.y+canvas.height*.4,{steps:2});
 await page.mouse.up();
 await page.locator('#zoomObjectIn').click();
 await page.locator('#takePhoto').click();
 await expect(page.locator('#photoTray img')).toHaveCount(2);
 const changedPhoto=await page.locator('#photoTray img').nth(1).getAttribute('src');
 expect(firstPhoto).toMatch(/^data:image\/jpeg;base64,/);
 expect(changedPhoto).toMatch(/^data:image\/jpeg;base64,/);
 expect(changedPhoto).not.toBe(firstPhoto);
 const note='제공된 WRL 모델에서 뚫린 고리와 윗면 구멍, 정점색을 살펴보았어요.';
 await page.locator('#observationNote').fill(note);
 await expect(page.locator('#noteStatus')).toContainText('저장했어요');
 await page.screenshot({path:'/workspace/game-stool.png'});
 // Inspect the newly refined seat and upper rim from above without adding a
 // third report photo or depending on a separate decorative screenshot asset.
 await page.locator('#resetObject').click();
 await page.mouse.move(canvas.x+canvas.width*.5,canvas.y+canvas.height*.28);
 await page.mouse.down();
 await page.mouse.move(canvas.x+canvas.width*.5,canvas.y+canvas.height*.43,{steps:2});
 await page.mouse.up();
 await page.locator('#zoomObjectIn').click();
 await page.screenshot({path:'/workspace/game-stool-top.png'});
 await openReportAtDesk(page);
 await expect(page.locator('#reportForm [name="artifactId"]')).toHaveValue('stool');
 await expect(page.locator('#reportForm [data-gallery-note="stool"]')).toHaveValue(note);
 await expect(page.locator('#reportPhotos img')).toHaveCount(2);
 expect(await page.locator('#reportPhotos img').nth(1).getAttribute('src')).toBe(changedPhoto);
 await page.locator('#reportDialog [data-close]').click();
 await moveToCourseDestination(page,'stool');

 await page.reload();
 await expect(page.locator('#gameLoading')).toHaveCount(0,{timeout:45000});
 await expect(page.locator('#nearName')).toHaveText('청자 투각 의자');
 await open();
 await expect(page.locator('#photoTray img')).toHaveCount(2);
 await expect(page.locator('#observationNote')).toHaveValue(note);
 expect(await page.locator('#photoTray img').nth(1).getAttribute('src')).toBe(changedPhoto);
 await attachJSON('browser-console-errors',consoleErrors);
 expect(errors).toEqual([]);
});
