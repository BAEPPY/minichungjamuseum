import {test,expect} from '@playwright/test';
import {installNativeVideoFixture} from './helpers/native-video.js';

test.setTimeout(30000);
async function harnessPage(page){
 await page.route('**/__video_lesson_test',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><head><meta charset="UTF-8"><title>영상 학습 검증</title></head><body><div id="lesson" style="width:640px"></div></body></html>'}));
 await page.goto('/__video_lesson_test');
}
async function lessonHarness(page,{duration=10,rate=1}={}){
 await harnessPage(page);await page.clock.install();
 await page.evaluate(({duration,rate})=>{
  const state={media:0,wall:performance.now(),running:false,ended:false,seeking:false,rate,src:''};
  window.__completed=[];window.__states=[];
  const current=()=>Math.min(duration,state.media+(state.running?(performance.now()-state.wall)/1000*state.rate:0));
  const proto=HTMLMediaElement.prototype;
  Object.defineProperties(proto,{
   duration:{configurable:true,get:()=>duration},currentTime:{configurable:true,get:current,set(value){state.running=false;state.seeking=true;this.dispatchEvent(new Event('seeking'));state.media=value;state.wall=performance.now();state.ended=false;state.seeking=false;this.dispatchEvent(new Event('seeked'));}},
   playbackRate:{configurable:true,get:()=>state.rate,set(value){state.media=current();state.wall=performance.now();state.rate=value;this.dispatchEvent(new Event('ratechange'));}},
   paused:{configurable:true,get:()=>!state.running},ended:{configurable:true,get:()=>state.ended},seeking:{configurable:true,get:()=>state.seeking},
   src:{configurable:true,get:()=>state.src,set(value){state.src=value;}}
  });
  proto.load=function(){if(state.src)queueMicrotask(()=>this.dispatchEvent(new Event('loadedmetadata')));};
  proto.play=function(){state.media=current();state.wall=performance.now();state.running=true;state.ended=false;this.dispatchEvent(new Event('playing'));return Promise.resolve();};
  proto.pause=function(){state.media=current();state.wall=performance.now();state.running=false;this.dispatchEvent(new Event('pause'));};
  window.__finish=()=>{state.media=duration;state.running=false;state.ended=true;document.querySelector('video').dispatchEvent(new Event('ended'));};
 },{duration,rate});
 await page.evaluate(async()=>{const {createVideoLesson}=await import('/src/video-lesson.js');window.__lesson=createVideoLesson({host:document.querySelector('#lesson'),onComplete:result=>window.__completed.push(result),onState:state=>window.__states.push(state)});await window.__lesson.ready;});
 await expect(page.locator('.video-lesson')).toHaveAttribute('data-state','ready');
}

test('native lesson requires ended plus watched coverage and credits the original source',async({page})=>{
 await lessonHarness(page);
 await expect(page.locator('video')).toHaveJSProperty('src','/videos/celadon-inlay.mp4');
 await expect(page.locator('video')).toHaveAttribute('controls','');
 await expect(page.locator('.video-lesson-external')).toHaveAttribute('href','https://www.youtube.com/watch?v=YM7FhGcR_5E');
 await expect(page.locator('.video-lesson-external')).toContainText('상감청자는 어떻게 만들까?');
 await page.evaluate(()=>window.__lesson.play());await page.clock.runFor(10000);
 expect(await page.evaluate(()=>window.__completed.length)).toBe(0);
 await expect(page.locator('.video-lesson')).toHaveAttribute('data-completed','false');
 await page.evaluate(()=>window.__finish());
 await expect(page.locator('.video-lesson')).toHaveAttribute('data-state','completed');
 expect(await page.evaluate(()=>window.__completed[0].coverage)).toBeGreaterThanOrEqual(.9);
 await page.evaluate(()=>window.__finish());expect(await page.evaluate(()=>window.__completed.length)).toBe(1);
});

test('native seeking to the end does not unlock and replay covers skipped portions',async({page})=>{
 await lessonHarness(page);await page.evaluate(()=>window.__lesson.play());await page.clock.runFor(1000);
 await page.evaluate(()=>{document.querySelector('video').currentTime=9.8;window.__finish();});
 await expect(page.locator('.video-lesson')).toHaveAttribute('data-state','incomplete');
 expect(await page.evaluate(()=>window.__completed.length)).toBe(0);
 expect(Number(await page.locator('.video-lesson').getAttribute('data-coverage'))).toBeLessThan(.3);
 await page.evaluate(()=>window.__lesson.replay());await page.clock.runFor(10000);await page.evaluate(()=>window.__finish());
 expect(await page.evaluate(()=>window.__completed.length)).toBe(1);
});

test('native pause time is not watch time and faster playback remains valid',async({page})=>{
 await lessonHarness(page,{duration:12,rate:2});await page.evaluate(()=>window.__lesson.play());await page.clock.runFor(500);
 await page.evaluate(()=>document.querySelector('video').pause());await page.clock.runFor(20000);
 expect(Number(await page.locator('.video-lesson').getAttribute('data-coverage'))).toBeLessThan(.2);
 await page.evaluate(()=>window.__lesson.play());await page.clock.runFor(5500);await page.evaluate(()=>window.__finish());
 expect(await page.evaluate(()=>window.__completed.length)).toBe(1);
});

test('media errors remain locked and closing releases playback without late completion',async({page})=>{
 await lessonHarness(page);await page.evaluate(()=>document.querySelector('video').dispatchEvent(new Event('error')));
 await expect(page.locator('.video-lesson')).toHaveAttribute('data-state','error');
 expect(await page.evaluate(()=>window.__completed.length)).toBe(0);
 const count=await page.evaluate(()=>window.__states.length);
 await page.evaluate(()=>{window.__savedVideo=document.querySelector('video');window.__lesson.destroy();});
 await page.clock.runFor(30000);await page.evaluate(()=>window.__savedVideo.dispatchEvent(new Event('ended')));
 expect(await page.evaluate(()=>window.__states.length)).toBe(count);
 expect(await page.evaluate(()=>window.__completed.length)).toBe(0);
 await expect(page.locator('.video-lesson')).toHaveCount(0);
});

test('a real native MP4 reaches ended and unlocks without any YouTube request',async({page})=>{
 await installNativeVideoFixture(page);await harnessPage(page);
 const external=[];page.on('request',r=>{if(/youtube|googlevideo/.test(r.url()))external.push(r.url());});
 await page.evaluate(async()=>{const {createVideoLesson}=await import('/src/video-lesson.js');window.__completed=[];window.__lesson=createVideoLesson({host:document.querySelector('#lesson'),onComplete:r=>window.__completed.push(r)});await window.__lesson.ready;});
 await page.locator('video').evaluate(v=>{v.muted=true;return v.play();});
 await expect(page.locator('.video-lesson')).toHaveAttribute('data-state','completed',{timeout:10000});
 expect(await page.locator('video').evaluate(v=>v.ended)).toBe(true);
 expect(await page.evaluate(()=>window.__completed[0].coverage)).toBeGreaterThanOrEqual(.9);
 expect(external).toEqual([]);
});

test('the uploaded 1080p H264 AAC lesson decodes actual frames from this site',async({page})=>{
 await harnessPage(page);
 await page.evaluate(async()=>{const {createVideoLesson}=await import('/src/video-lesson.js');window.__lesson=createVideoLesson({host:document.querySelector('#lesson')});await window.__lesson.ready;});
 const video=page.locator('video');
 expect(await video.evaluate(v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight}))).toMatchObject({width:1920,height:1080});
 expect(await video.evaluate(v=>v.duration)).toBeGreaterThan(132);
 await video.evaluate(v=>{v.muted=true;return v.play();});
 await expect.poll(()=>video.evaluate(v=>v.currentTime),{timeout:10000}).toBeGreaterThan(.5);
 expect(await video.evaluate(v=>v.getVideoPlaybackQuality().totalVideoFrames)).toBeGreaterThan(0);
 expect(await video.evaluate(v=>v.audioTracks?.length??v.webkitAudioDecodedByteCount??0)).toBeGreaterThan(0);
 await page.screenshot({path:'/workspace/game-native-lesson.png'});
 await page.evaluate(()=>window.__lesson.destroy());
 await expect(page.locator('video')).toHaveCount(0);
});
