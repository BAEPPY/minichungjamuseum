// The teacher-provided MP4 is served by this site. Only observed playback and
// a real ended event complete the lesson; seeking or elapsed wall time do not.
export const VIDEO_ID='YM7FhGcR_5E';
export const VIDEO_URL=`https://www.youtube.com/watch?v=${VIDEO_ID}`;
export const VIDEO_SRC='/videos/celadon-inlay.mp4';
export const VIDEO_TITLE='[청자실] 상감청자는 어떻게 만들까?';

export function createVideoLesson({host,onComplete=()=>{},onState=()=>{}}){
 if(!(host instanceof HTMLElement))throw new Error('영상을 표시할 공간이 필요해요.');
 const root=document.createElement('section');root.className='video-lesson';root.dataset.state='loading';
 root.innerHTML=`<div class="video-lesson-frame" style="position:relative;aspect-ratio:16/9;min-height:220px;background:#17241f;border-radius:8px;overflow:hidden"><video class="video-lesson-player" controls playsinline preload="metadata" aria-label="${VIDEO_TITLE}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain"></video></div><p class="video-lesson-status" role="status" aria-live="polite">영상을 불러오고 있어요.</p><p class="video-lesson-credit">출처: <a class="video-lesson-external" href="${VIDEO_URL}" target="_blank" rel="noopener noreferrer">${VIDEO_TITLE} · 원본 YouTube 영상 ↗</a></p><p class="video-lesson-help">이 창에서 영상을 끝까지 시청하면 작품 관찰이 열려요.</p>`;
 host.replaceChildren(root);
 const video=root.querySelector('video'),status=root.querySelector('.video-lesson-status');
 let disposed=false,failed=false,completed=false,playing=false,readySettled=false;
 let timer=null,previousSample=null,intervals=[],resolveReady,rejectReady;
 const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});ready.catch(()=>{});
 const duration=()=>Number.isFinite(video.duration)?Math.max(0,video.duration):0;
 const watchedSeconds=()=>intervals.reduce((sum,[start,end])=>sum+end-start,0);
 const coverage=()=>duration()?Math.min(1,watchedSeconds()/duration()):0;
 const listeners=[];
 function on(type,callback){video.addEventListener(type,callback);listeners.push([type,callback]);}
 function publish(state,message){
  if(disposed)return;root.dataset.state=state;root.dataset.completed=String(completed);root.dataset.coverage=coverage().toFixed(4);status.textContent=message;
  onState({state,message,completed,coverage:coverage(),duration:duration(),currentTime:video.currentTime,watchedSeconds:watchedSeconds()});
 }
 function addInterval(start,end){
  start=Math.max(0,start);end=Math.min(duration(),end);if(end<=start)return;
  const ranges=[...intervals,[start,end]].sort((a,b)=>a[0]-b[0]);intervals=[];
  for(const range of ranges){const last=intervals.at(-1);if(last&&range[0]<=last[1]+.03)last[1]=Math.max(last[1],range[1]);else intervals.push([...range]);}
 }
 function sample(){
  if(disposed||failed||!playing||video.seeking)return;
  const mediaTime=Math.max(0,video.currentTime),wallTime=performance.now(),rate=Math.max(.1,Math.min(16,video.playbackRate||1));
  if(previousSample){const mediaDelta=mediaTime-previousSample.mediaTime,wallDelta=Math.max(0,(wallTime-previousSample.wallTime)/1000),expected=wallDelta*Math.max(rate,previousSample.rate);if(mediaDelta>0&&mediaDelta<=expected+.25)addInterval(previousSample.mediaTime,mediaTime);}
  previousSample={mediaTime,wallTime,rate};root.dataset.coverage=coverage().toFixed(4);
 }
 function stopSampling(){if(timer!==null)clearInterval(timer);timer=null;previousSample=null;playing=false;}
 function settleReady(error){if(readySettled)return;readySettled=true;clearTimeout(readyTimeout);error?rejectReady(error):resolveReady(video);}
 function fail(message){if(disposed)return;failed=true;stopSampling();settleReady(new Error(message));publish('error',message);}
 function begin(){
  if(disposed||failed||video.seeking)return;
  stopSampling();playing=true;sample();timer=setInterval(sample,100);publish('playing','시청 중이에요. 영상이 끝난 뒤 작품을 만나러 가요.');
 }
 function pause(){if(disposed||failed)return;sample();stopSampling();if(!video.ended)publish('paused','일시정지했어요. 준비되면 이어서 시청해 주세요.');}
 const readyTimeout=setTimeout(()=>fail('영상을 불러오지 못했어요. 인터넷 연결을 확인하고 창을 다시 열어 주세요.'),15000);
 on('loadedmetadata',()=>{if(disposed||failed)return;if(!duration()){fail('영상의 재생 시간을 읽지 못했어요. 창을 다시 열어 주세요.');return;}settleReady();publish('ready','재생 버튼을 눌러 영상을 시청해 주세요.');});
 on('playing',begin);on('pause',pause);on('timeupdate',sample);
 on('seeking',()=>{if(disposed||failed)return;stopSampling();publish('seeking','원하는 위치를 찾고 있어요. 건너뛴 부분은 시청 기록에 포함되지 않아요.');});
 on('seeked',()=>{if(disposed||failed)return;if(!video.paused&&!video.ended)begin();else publish('paused','재생 버튼을 눌러 이어서 시청해 주세요.');});
 on('ratechange',()=>{if(playing){sample();previousSample=null;sample();}});
 on('waiting',()=>{if(disposed||failed)return;sample();stopSampling();publish('buffering','영상을 불러오는 중이에요. 잠시 기다려 주세요.');});
 on('ended',()=>{
  if(disposed||failed||!video.ended)return;sample();stopSampling();
  if(duration()>0&&coverage()>=.9){const first=!completed;completed=true;publish('completed','영상을 끝까지 시청했어요. 이제 작품을 관찰할 수 있어요.');if(first)onComplete({videoId:VIDEO_ID,duration:duration(),watchedSeconds:watchedSeconds(),coverage:coverage()});}
  else publish('incomplete','건너뛴 부분이 있어요. 영상을 처음부터 끝까지 시청한 뒤 작품을 만나러 가요.');
 });
 on('error',()=>fail('영상을 재생하지 못했어요. 인터넷 연결이나 브라우저를 확인하고 다시 열어 주세요.'));
 video.src=VIDEO_SRC;video.load();
 async function play(){if(disposed||failed)return;try{await video.play();}catch(error){if(disposed)return;if(error?.name==='NotAllowedError')publish('ready','영상의 재생 버튼을 직접 눌러 주세요.');else fail('영상을 재생하지 못했어요. 창을 다시 열어 주세요.');}}
 return {ready,play,replay(){if(disposed||failed)return;stopSampling();video.currentTime=0;return play();},destroy(){if(disposed)return;disposed=true;stopSampling();clearTimeout(readyTimeout);for(const [type,callback]of listeners)video.removeEventListener(type,callback);if(!readySettled){readySettled=true;resolveReady(null);}video.pause();video.removeAttribute('src');video.load();root.remove();}};
}
