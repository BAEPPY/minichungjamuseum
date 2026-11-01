import {test,expect} from '@playwright/test';

test.setTimeout(30000);

async function lessonHarness(page, {duration=10, rate=1}={}) {
  await page.route('**/__video_lesson_test', route => route.fulfill({
    contentType:'text/html',
    body:'<!doctype html><html lang="ko"><head><meta charset="UTF-8"><title>영상 학습 검증</title></head><body><div id="lesson" style="width:640px"></div></body></html>'
  }));
  await page.goto('/__video_lesson_test');
  await page.clock.install();
  await page.evaluate(({duration,rate}) => {
    window.__completed = [];
    window.__states = [];
    window.__destroyed = 0;
    window.YT = {
      PlayerState:{ENDED:0,PLAYING:1,PAUSED:2,BUFFERING:3,CUED:5},
      Player:class {
        constructor(mount, options) {
          this.options=options;this.duration=duration;this.rate=rate;
          this.media=0;this.wall=performance.now();this.state=-1;
          this.iframe=document.createElement('iframe');mount.replaceWith(this.iframe);
          window.__player=this;
          queueMicrotask(()=>options.events.onReady({target:this}));
        }
        getDuration(){return this.duration;}
        getCurrentTime(){return Math.min(this.duration,this.media+(this.state===1?(performance.now()-this.wall)/1000*this.rate:0));}
        getPlaybackRate(){return this.rate;}
        getIframe(){return this.iframe;}
        emit(state){this.media=this.getCurrentTime();this.wall=performance.now();this.state=state;this.options.events.onStateChange({data:state,target:this});}
        playVideo(){this.emit(1);}
        pauseVideo(){this.emit(2);}
        seekTo(time){this.media=time;this.wall=performance.now();}
        finish(){this.media=this.duration;this.wall=performance.now();this.state=0;this.options.events.onStateChange({data:0,target:this});}
        error(code){this.options.events.onError({data:code,target:this});}
        destroy(){window.__destroyed++;this.iframe.remove();}
      }
    };
  }, {duration,rate});
  await page.evaluate(async()=>{
    const {createVideoLesson}=await import('/src/video-lesson.js');
    window.__lesson=createVideoLesson({host:document.querySelector('#lesson'),onComplete:result=>window.__completed.push(result),onState:state=>window.__states.push(state)});
    await window.__lesson.ready;
  });
  await expect(page.locator('.video-lesson')).toHaveAttribute('data-state','ready');
}

test('only actual ENDED after observed playback unlocks the original teacher video',async({page})=>{
  await lessonHarness(page);
  expect(await page.evaluate(()=>window.__player.options.videoId)).toBe('YM7FhGcR_5E');
  await expect(page.locator('.video-lesson-external')).toHaveAttribute('href','https://www.youtube.com/watch?v=YM7FhGcR_5E');
  await page.evaluate(()=>window.__lesson.play());
  await page.clock.runFor(10000);
  expect(await page.evaluate(()=>window.__completed.length)).toBe(0);
  await expect(page.locator('.video-lesson')).toHaveAttribute('data-completed','false');
  await page.evaluate(()=>window.__player.finish());
  await expect(page.locator('.video-lesson')).toHaveAttribute('data-state','completed');
  expect(await page.evaluate(()=>window.__completed.length)).toBe(1);
  expect(await page.evaluate(()=>window.__completed[0].coverage)).toBeGreaterThanOrEqual(.9);
  await page.evaluate(()=>window.__player.finish());
  expect(await page.evaluate(()=>window.__completed.length)).toBe(1);
});

test('seeking to the end cannot unlock; replaying unobserved portions can',async({page})=>{
  await lessonHarness(page);
  await page.evaluate(()=>window.__lesson.play());
  await page.clock.runFor(1000);
  await page.evaluate(()=>{window.__player.seekTo(9.8);window.__player.finish();});
  await expect(page.locator('.video-lesson')).toHaveAttribute('data-state','incomplete');
  expect(await page.evaluate(()=>window.__completed.length)).toBe(0);
  expect(await page.locator('.video-lesson').getAttribute('data-coverage').then(Number)).toBeLessThan(.3);
  await page.evaluate(()=>window.__lesson.replay());
  await page.clock.runFor(10000);
  await page.evaluate(()=>window.__player.finish());
  await expect(page.locator('.video-lesson')).toHaveAttribute('data-state','completed');
  expect(await page.evaluate(()=>window.__completed.length)).toBe(1);
});

test('paused wall time is not watch coverage and playback speed is respected',async({page})=>{
  await lessonHarness(page,{duration:12,rate:2});
  await page.evaluate(()=>window.__lesson.play());
  await page.clock.runFor(500);
  await page.evaluate(()=>window.__player.pauseVideo());
  await page.clock.runFor(20000);
  expect(await page.locator('.video-lesson').getAttribute('data-coverage').then(Number)).toBeLessThan(.2);
  expect(await page.evaluate(()=>window.__completed.length)).toBe(0);
  await page.evaluate(()=>window.__lesson.play());
  await page.clock.runFor(5500);
  await page.evaluate(()=>window.__player.finish());
  expect(await page.evaluate(()=>window.__completed.length)).toBe(1);
});

test('blocked player stays locked and disposal stops callbacks and destroys the player',async({page})=>{
  await lessonHarness(page);
  await page.evaluate(()=>window.__player.error(101));
  await expect(page.locator('.video-lesson')).toHaveAttribute('data-state','error');
  await expect(page.locator('.video-lesson-status')).toContainText('외부');
  expect(await page.evaluate(()=>window.__completed.length)).toBe(0);
  const before=await page.evaluate(()=>window.__states.length);
  await page.evaluate(()=>window.__lesson.destroy());
  await page.clock.runFor(30000);
  await page.evaluate(()=>{window.__player.playVideo();window.__player.finish();});
  expect(await page.evaluate(()=>window.__states.length)).toBe(before);
  expect(await page.evaluate(()=>window.__completed.length)).toBe(0);
  expect(await page.evaluate(()=>window.__destroyed)).toBe(1);
  await expect(page.locator('.video-lesson')).toHaveCount(0);
});
