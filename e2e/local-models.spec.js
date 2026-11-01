import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('a native GLB survives reload, a bad replacement preserves it, and removal preserves notes',async({page})=>{
 test.setTimeout(210000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 // This is a plumbing fixture only. An incense model is not an authentic stool
 // and is never added to the application's default collection by this test.
 const fixture=await readFile(new URL('../public/models/celadon-incense.glb',import.meta.url));
 const fileName='native-upload-fixture.glb';
 await page.goto('/favicon.svg');
 await page.evaluate(async()=>{
  const storage=await import('/src/storage.js');
  // Old prototype placeholders must not count as observing the current collection.
  await storage.put({id:'game-progress',making:[],visited:['stool','ewer'],inside:true,exited:false,profileReady:true,avatarHair:'short',videoCompleted:true,videoId:'YM7FhGcR_5E',position:{x:8,z:2.8,inside:true},avatarName:'원본 자료 탐험가',avatarColor:'#e8cf91'});
 });
 await page.goto('/');
 await expect(page.locator('#gameLoading')).toHaveCount(0,{timeout:45000});
 await expect(page.locator('#nearName')).toHaveText('청자 투각 의자');
 const openStool=async()=>{
  await page.keyboard.press('f');
  await expect(page.locator('#observationDialog')).toBeVisible();
  await expect(page.locator('#objectName')).toHaveText('청자 투각 의자');
 };
 const closeObservation=()=>page.locator('#observationDialog [data-close]').first().click();
 const openSettings=async()=>{
  await page.locator('#settingsButton').click();
  await expect(page.locator('#localModelArtifact')).toBeVisible();
  await page.locator('#localModelArtifact').selectOption('stool');
 };
 const closeSettings=()=>page.locator('#settingsDialog [data-close]').first().click();
 const chooseFile=async payload=>{
  const chooserPromise=page.waitForEvent('filechooser');
  await page.locator('#localModelImport').click();
  const chooser=await chooserPromise;
  await chooser.setFiles(payload);
 };
 const storedModel=()=>page.evaluate(async()=>{
  const {get}=await import('/src/storage.js');const record=await get('native-model-stool');
  return record?{fileName:record.fileName,bytes:record.blob?.size,isBlob:record.blob instanceof Blob}:null;
 });

 // Migration clears the old generic chair/ewer before either current work is opened.
 await expect(page.locator('#visitProgress')).toHaveText('유물 관찰 0/5');
 await openStool();
 await expect(page.locator('#takePhoto')).toBeEnabled({timeout:30000});
 await expect(page.locator('#chooseForReport')).toBeEnabled();
 await expect(page.locator('#objectCanvas canvas')).toHaveCount(1);
 await expect(page.locator('#objectCanvas iframe')).toHaveCount(0);
 await expect(page.locator('#modelSource')).toContainText(/재현|복원|근사/);
 await expect(page.locator('#visitProgress')).toHaveText('유물 관찰 1/5');
 expect(await storedModel()).toBeNull();
 await closeObservation();

 await openSettings();
 await expect(page.locator('#localModelRemove')).toBeDisabled();
 await chooseFile({name:fileName,mimeType:'model/gltf-binary',buffer:fixture});
 await expect(page.locator('#localModelStatus')).toContainText(fileName,{timeout:45000});
 await expect(page.locator('#localModelStatus')).toContainText('저장');
 await expect(page.locator('#localModelImport')).toBeEnabled();
 await expect(page.locator('#localModelRemove')).toBeEnabled();
 expect(await storedModel()).toEqual({fileName,bytes:fixture.byteLength,isBlob:true});
 await closeSettings();
 await openStool();
 await expect(page.locator('#takePhoto')).toBeEnabled({timeout:30000});
 await expect(page.locator('#objectCanvas canvas')).toHaveCount(1);
 await expect(page.locator('#objectCanvas iframe')).toHaveCount(0);
 await expect(page.locator('#modelSource')).toContainText(fileName);
 await page.locator('#takePhoto').click();
 await expect(page.locator('#photoTray img')).toHaveCount(1);
 await expect(page.locator('#photoTray img')).toHaveAttribute('src',/^data:image\/jpeg;base64,/);
 await page.locator('#observationNote').fill('이 기기에 등록한 원본 파일을 관찰하며 남긴 기록');
 await expect(page.locator('#noteStatus')).toContainText('저장했어요');

 await page.reload();
 await expect(page.locator('#gameLoading')).toHaveCount(0,{timeout:45000});
 await expect(page.locator('#nearName')).toHaveText('청자 투각 의자');
 await openStool();
 await expect(page.locator('#takePhoto')).toBeEnabled({timeout:30000});
 await expect(page.locator('#modelSource')).toContainText(fileName);
 await expect(page.locator('#photoTray img')).toHaveCount(1);
 await expect(page.locator('#observationNote')).toHaveValue('이 기기에 등록한 원본 파일을 관찰하며 남긴 기록');
 await page.locator('#takePhoto').click();
 await expect(page.locator('#photoTray img')).toHaveCount(2);
 await closeObservation();

 await openSettings();
 await expect(page.locator('#localModelStatus')).toContainText(fileName);
 await chooseFile({name:'corrupt-model.glb',mimeType:'model/gltf-binary',buffer:Buffer.from('This is not a valid binary glTF model container.')});
 await expect(page.locator('#localModelStatus')).toHaveClass(/is-error/);
 await expect(page.locator('#localModelImport')).toBeEnabled();
 await expect(page.locator('#localModelRemove')).toBeEnabled();
 expect(await storedModel()).toEqual({fileName,bytes:fixture.byteLength,isBlob:true});
 await closeSettings();
 await openStool();
 await expect(page.locator('#takePhoto')).toBeEnabled({timeout:30000});
 await expect(page.locator('#modelSource')).toContainText(fileName);
 await page.locator('#takePhoto').click();
 await expect(page.locator('#photoTray img')).toHaveCount(3);
 await closeObservation();

 await openSettings();
 await page.locator('#localModelRemove').click();
 await expect(page.locator('#localModelStatus')).toContainText('기본 자료로 돌아왔어요.');
 await expect(page.locator('#localModelImport')).toBeEnabled();
 await expect(page.locator('#localModelRemove')).toBeDisabled();
 expect(await storedModel()).toBeNull();
 await closeSettings();
 await openStool();
 await expect(page.locator('#takePhoto')).toBeEnabled({timeout:30000});
 await expect(page.locator('#chooseForReport')).toBeEnabled();
 await expect(page.locator('#objectCanvas canvas')).toHaveCount(1);
 await expect(page.locator('#objectCanvas iframe')).toHaveCount(0);
 await expect(page.locator('#modelSource')).toContainText(/재현|복원|근사/);
 await expect(page.locator('#modelSource')).not.toContainText(fileName);
 expect(await page.evaluate(async()=>{const {artifacts}=await import('/src/artifacts.js');return artifacts.find(a=>a.id==='stool').model;})).toBe('/models/celadon-stool-reconstruction.glb');
  // Removing the local file does not invalidate its genuine observation history.
  await expect(page.locator('#visitProgress')).toHaveText('유물 관찰 1/5');
 await expect(page.locator('#photoTray img')).toHaveCount(3);
 await expect(page.locator('#observationNote')).toHaveValue('이 기기에 등록한 원본 파일을 관찰하며 남긴 기록');
 expect(errors).toEqual([]);
});
