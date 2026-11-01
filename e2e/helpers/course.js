import {expect} from '@playwright/test';

/** Isolate a later viewer/report test from the already-tested comparison UI.
 * These are explicit stored-progress fixtures, not proof of the real 3-vase
 * journey and not substitute models for the Japanese comparison exhibit. */
export async function seedCompletedComparison(page,{position,avatarName='청자 탐험가',galleryReady=false,visited,entries={},progressOverrides={}}={}){
 await page.goto('/favicon.svg');
 await page.evaluate(async options=>{
  const {put,get}=await import('/src/storage.js');
  const {COURSE_VERSION}=await import('/src/course.js');
  const {comparisonIds}=await import('/src/comparison-artifacts.js');
  const {artifacts}=await import('/src/artifacts.js');
  const notebook=await get('notebook')||{id:'notebook',entries:{}};
  notebook.entries||={};
  for(const id of comparisonIds)notebook.entries[id]={photos:[],features:'격리된 뷰어 검사를 위한 기존 비교 관찰 기록',...notebook.entries[id]};
  if(options.galleryReady)for(const artifact of artifacts)notebook.entries[artifact.id]={photos:[],features:'격리된 보고서 검사를 위한 기존 청자 특징 기록',...notebook.entries[artifact.id]};
  for(const [id,record] of Object.entries(options.entries))notebook.entries[id]={...notebook.entries[id],...record};
  await put(notebook);
  const savedComparison=await get('comparison-draft');
  await put({id:'comparison-draft',excellence:'격리 검사를 위한 기존 고려청자 비교 생각',evidence:'격리 검사를 위한 기존 관찰 근거',...savedComparison});
  await put({id:'game-progress',making:[],inside:true,exited:false,profileReady:true,avatarHair:'short',avatarName:options.avatarName,avatarColor:'#eccd79',collectionVersion:'selected-celadon-v1',courseVersion:COURSE_VERSION,comparisonVisited:[...comparisonIds],comparisonCompleted:true,visited:options.visited??(options.galleryReady?artifacts.map(a=>a.id):[]),position:options.position,...options.progressOverrides});
 },{position,avatarName,galleryReady,visited,entries,progressOverrides});
}

export async function moveToCourseDestination(page,id,name){
 await page.locator('#mapButton').click();
 await page.locator(`[data-destination="${id}"]`).click();
 await expect(page.locator('#mapDialog')).not.toBeVisible();
 if(name)await expect(page.locator('#nearName')).toHaveText(name,{timeout:20000});
 await expect(page.locator('#interactButton')).toBeVisible();
}
