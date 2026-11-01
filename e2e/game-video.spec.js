import {test,expect} from '@playwright/test';

test.setTimeout(120000);
const VIDEO_ID='YM7FhGcR_5E';

async function seedNativeFixtures(page){
 await page.goto('/favicon.svg');
 await page.evaluate(async()=>{
  const {put}=await import('/src/storage.js');
  // Reuse provided geometry strictly as test data for the two native slots.
  // This fixture does not claim to depict the selected chair or dragonfish.
  const response=await fetch('/models/celadon-incense.glb');
  if(!response.ok)throw new Error('Native model fixture could not be loaded.');
  const blob=await response.blob();
  for(const artifactId of ['stool','ewer'])await put({id:'native-model-'+artifactId,type:'native-model',artifactId,blob,fileName:'playwright-native-fixture.glb',size:blob.size});
 });
}

async function installMockYouTube(page){
 await page.addInitScript(()=>{
  window.__videoPlayers=[];
  window.YT={
   PlayerState:{ENDED:0,PLAYING:1,PAUSED:2,BUFFERING:3,CUED:5},
   Player:class {
    constructor(mount,options){
     this.options=options;this.duration=2;this.media=0;this.wall=performance.now();this.state=-1;
     this.iframe=document.createElement('iframe');this.iframe.src='about:blank';mount.replaceWith(this.iframe);
     window.__videoPlayers.push(this);window.__videoPlayer=this;
     queueMicrotask(()=>options.events.onReady({target:this}));
    }
    getDuration(){return this.duration;}
    getCurrentTime(){return Math.min(this.duration,this.media+(this.state===1?(performance.now()-this.wall)/1000:0));}
    getPlaybackRate(){return 1;}
    getIframe(){return this.iframe;}
    emit(state){this.media=this.getCurrentTime();this.wall=performance.now();this.state=state;this.options.events.onStateChange({data:state,target:this});}
    playVideo(){this.emit(1);}
    seekTo(time){this.media=time;this.wall=performance.now();}
    finish(){this.media=this.duration;this.wall=performance.now();this.state=0;this.options.events.onStateChange({data:0,target:this});}
    destroy(){this.iframe.remove();}
   }
  };
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
 await installMockYouTube(page);
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
 expect(await page.evaluate(()=>window.__videoPlayer.options.videoId)).toBe(VIDEO_ID);
 await expect(page.locator('#videoHost .video-lesson-external')).toHaveAttribute('href',`https://www.youtube.com/watch?v=${VIDEO_ID}`);
 await expect(page.locator('#continueToCollection')).toBeDisabled();
 await page.evaluate(()=>window.__videoPlayer.playVideo());
 // Mock media actually advances through the real sampling intervals. Elapsed
 // playback alone must still leave the gate locked until a true ENDED event.
 await expect.poll(()=>page.locator('#videoHost .video-lesson').getAttribute('data-coverage').then(Number),{timeout:10000}).toBeGreaterThanOrEqual(.9);
 await expect(page.locator('#continueToCollection')).toBeDisabled();
 await page.evaluate(()=>window.__videoPlayer.finish());
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
