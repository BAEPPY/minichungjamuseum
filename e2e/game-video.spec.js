import {test,expect} from '@playwright/test';
import {installNativeVideoFixture,playNativeVideo,waitForNativeVideoEnd} from './helpers/native-video.js';

test.setTimeout(120000);
const VIDEO_ID='YM7FhGcR_5E';

async function seedNativeFixtures(page){
 await page.goto('/favicon.svg');
 await page.evaluate(async()=>{
  const {put}=await import('/src/storage.js');
  // The chair still lacks its original file. This fixture exercises its native
  // controls only; the ewer uses its actual built-in scan and original textures.
  const response=await fetch('/models/celadon-incense.glb');
  if(!response.ok)throw new Error('Native model fixture could not be loaded.');
  const blob=await response.blob();
  for(const artifactId of ['stool'])await put({id:'native-model-'+artifactId,type:'native-model',artifactId,blob,fileName:'playwright-native-fixture.glb',size:blob.size});
 });
}

async function jump(page,id,name){
 await page.locator('#mapButton').click();
 await page.locator(`[data-destination="${id}"]`).click();
 await expect(page.locator('#mapDialog')).not.toBeVisible();
 await expect(page.locator('#nearName')).toHaveText(name,{timeout:20000});
 await expect(page.locator('#interactButton')).toBeVisible();
}

test('nickname entry and actual video completion precede native artifact observation',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await installNativeVideoFixture(page);
 await seedNativeFixtures(page);
 await page.goto('/');
 await expect(page.locator('#profileDialog')).toBeVisible();
 await expect(page.locator('#profileEnter')).toBeDisabled();
 await page.keyboard.press('Escape');
 await expect(page.locator('#profileDialog')).toBeVisible();
 await expect(page.locator('#profileDialog').getByText(/이용약관|개인정보처리방침/)).toHaveCount(0);
 await expect(page.locator('[data-profile-color]')).toHaveCount(3);
 await expect(page.locator('[data-profile-hair]')).toHaveCount(2);
 await page.locator('#profileNickname').fill('청자 영상 탐험가');
 await page.locator('#profileEnter').click();
 await expect(page.locator('#profileDialog')).toHaveCount(0);
 await expect(page.locator('#gameLoading')).toHaveCount(0,{timeout:30000});
 await jump(page,'entrance','박물관 입장');
 await page.locator('#interactButton').click();
 await expect(page.locator('#welcomeDialog')).toBeVisible();
 await page.locator('#enterGame').click();
 await expect(page.locator('#locationName')).toContainText('영상관');

 // The map cannot bypass the lesson to reach either supplied or locally stored works.
 await page.locator('#mapButton').click();
 await page.locator('[data-destination="maebyeong"]').click();
 await expect(page.locator('#mapDialog')).toBeVisible();
 await expect(page.locator('#gameToast')).toContainText('제작 영상을 끝까지');
 await expect(page.locator('#observationDialog')).not.toBeVisible();
 await page.locator('[data-destination="stool"]').click();
 await expect(page.locator('#mapDialog')).toBeVisible();
 await expect(page.locator('#objectCanvas canvas')).toHaveCount(0);
 await page.locator('#mapDialog [data-close]').click();

 await jump(page,'video','고려청자 제작 영상');
 await page.keyboard.press('f');
 await expect(page.locator('#videoDialog')).toBeVisible();
 await expect(page.locator('#videoHost .video-lesson')).toHaveAttribute('data-state','ready');
 await expect(page.locator('#videoHost video')).toHaveAttribute('src','/videos/celadon-inlay.mp4');
 await expect(page.locator('#videoHost iframe')).toHaveCount(0);
 await expect(page.locator('#videoHost .video-lesson-external')).toHaveAttribute('href',`https://www.youtube.com/watch?v=${VIDEO_ID}`);
 await expect(page.locator('#continueToCollection')).toBeDisabled();
 await playNativeVideo(page);
 // A real short MP4 advances in the native player. Playback cannot unlock
 // observation before the media's actual ended event and watched coverage.
 await expect(page.locator('#continueToCollection')).toBeDisabled();
 await waitForNativeVideoEnd(page);
 expect(await page.locator('#videoHost video').evaluate(video=>video.ended)).toBe(true);
 expect(Number(await page.locator('#videoHost .video-lesson').getAttribute('data-coverage'))).toBeGreaterThanOrEqual(.9);
 await expect(page.locator('#continueToCollection')).toBeEnabled();
 await expect(page.locator('#makingProgress')).toHaveText('제작 영상 ✓');
 await expect.poll(()=>page.evaluate(async()=>{const {get}=await import('/src/storage.js');const state=await get('game-progress');return {completed:state?.videoCompleted,id:state?.videoId};})).toEqual({completed:true,id:VIDEO_ID});
 const videoPosition=await page.evaluate(async()=>{const {get}=await import('/src/storage.js');return (await get('game-progress')).position;});
 expect(videoPosition).toMatchObject({inside:true});
 await page.locator('#continueToCollection').click();
 await expect(page.locator('#videoDialog')).not.toBeVisible();
 // The continuation button must walk to the first work by itself. Opening
 // another map destination here would conceal a cancelled navigation route.
 await expect.poll(()=>page.evaluate(async from=>{const {get}=await import('/src/storage.js');const position=(await get('game-progress'))?.position;return position?Math.hypot(position.x-from.x,position.z-from.z):0;},videoPosition),{timeout:20000}).toBeGreaterThan(.75);
 await expect(page.locator('#nearName')).toHaveText('청자 상감 모란·구름·학무늬 베개',{timeout:20000});

 await jump(page,'ewer','청자 어룡형 주전자');
 await page.locator('#interactButton').click();
 await expect(page.locator('#observationDialog')).toBeVisible();
 await expect(page.locator('#objectName')).toHaveText('청자 어룡형 주전자');
 await expect(page.locator('#takePhoto')).toBeEnabled();
 await expect(page.locator('#objectCanvas canvas')).toBeVisible();
 await expect(page.locator('#objectCanvas iframe')).toHaveCount(0);
 await page.locator('#observationDialog [data-close]').first().click();

 await jump(page,'stool','청자 투각 의자');
 await page.locator('#interactButton').click();
 await expect(page.locator('#observationDialog')).toBeVisible();
 await expect(page.locator('#objectCanvas canvas')).toBeVisible();
 await expect(page.locator('#takePhoto')).toBeEnabled();
 await expect(page.locator('#objectCanvas iframe')).toHaveCount(0);
 await page.locator('#observationDialog [data-close]').first().click();
 await expect(page.locator('#objectCanvas canvas')).toHaveCount(0);
 expect(errors).toEqual([]);
});
