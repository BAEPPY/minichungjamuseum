// The lesson uses the teacher's original YouTube video. Completion is based on
// real player events and observed playback intervals, never elapsed wall time.
export const VIDEO_ID = 'YM7FhGcR_5E';
export const VIDEO_URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`;
let apiPromise;

function loadYouTubeAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const previousReady = window.onYouTubeIframeAPIReady;
    let settled = false;
    const finish = error => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      script.onerror = null;
      if (error) {
        script.remove();
        apiPromise = null;
        reject(error);
      } else resolve(window.YT);
    };
    window.onYouTubeIframeAPIReady = () => {
      try { previousReady?.(); } finally {
        finish(window.YT?.Player ? null : new Error('YouTube 재생기를 불러오지 못했어요.'));
      }
    };
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => finish(new Error('YouTube 연결이 차단되어 영상을 불러오지 못했어요.'));
    const timeout = setTimeout(() => finish(new Error('YouTube 연결이 지연되고 있어요. 네트워크를 확인하고 다시 열어 주세요.')), 15000);
    document.head.append(script);
  });
  return apiPromise;
}

export function createVideoLesson({host, onComplete = () => {}, onState = () => {}}) {
  if (!(host instanceof HTMLElement)) throw new Error('영상을 표시할 공간이 필요해요.');
  const root = document.createElement('section');
  root.className = 'video-lesson';
  root.dataset.state = 'loading';
  root.innerHTML = `<div class="video-lesson-frame" style="position:relative;aspect-ratio:16/9;min-height:220px;background:#17241f;border-radius:8px;overflow:hidden"><div class="video-lesson-player" style="position:absolute;inset:0"></div></div><p class="video-lesson-status" role="status" aria-live="polite">영상을 불러오고 있어요.</p><a class="video-lesson-external" href="${VIDEO_URL}" target="_blank" rel="noopener noreferrer">YouTube에서 영상 열기 ↗</a><p class="video-lesson-help">이 창에서 영상을 끝까지 시청하면 작품 관찰이 열려요.</p>`;
  host.replaceChildren(root);
  const mount = root.querySelector('.video-lesson-player');
  const status = root.querySelector('.video-lesson-status');
  let player = null, disposed = false, completed = false, playerState = -1;
  let timer = null, readyTimeout = null, previousSample = null, intervals = [];
  let readySettled = false, resolveReady, rejectReady;
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  // Avoid an unhandled rejection when a caller only uses onState for errors.
  ready.catch(() => {});
  const constants = {ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5};
  const safeNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const read = (method, fallback = 0) => {
    try { return player?.[method] ? safeNumber(player[method]()) : fallback; } catch { return fallback; }
  };
  const duration = () => Math.max(0, read('getDuration'));
  const watchedSeconds = () => intervals.reduce((sum, [start, end]) => sum + end - start, 0);
  const coverage = () => duration() ? Math.min(1, watchedSeconds() / duration()) : 0;
  function publish(state, message) {
    if (disposed) return;
    root.dataset.state = state;
    root.dataset.completed = String(completed);
    root.dataset.coverage = coverage().toFixed(4);
    status.textContent = message;
    onState({state, message, completed, coverage: coverage(), duration: duration(), currentTime: read('getCurrentTime'), watchedSeconds: watchedSeconds()});
  }
  function addInterval(start, end) {
    const total = duration();
    start = Math.max(0, start); end = Math.min(total, end);
    if (end <= start) return;
    const next = [...intervals, [start, end]].sort((a, b) => a[0] - b[0]);
    intervals = [];
    for (const range of next) {
      const previous = intervals[intervals.length - 1];
      if (previous && range[0] <= previous[1] + .03) previous[1] = Math.max(previous[1], range[1]);
      else intervals.push([...range]);
    }
  }
  function sample() {
    if (disposed || playerState !== constants.PLAYING || !player) return;
    const mediaTime = Math.max(0, read('getCurrentTime'));
    const wallTime = performance.now();
    const rate = Math.max(.1, Math.min(16, read('getPlaybackRate', 1) || 1));
    if (previousSample) {
      const mediaDelta = mediaTime - previousSample.mediaTime;
      const wallDelta = Math.max(0, (wallTime - previousSample.wallTime) / 1000);
      // Forward jumps do not count as watched. A small allowance accommodates
      // YouTube's quantized clock and playback-rate changes between samples.
      const expected = wallDelta * Math.max(rate, previousSample.rate);
      if (mediaDelta > 0 && mediaDelta <= expected + .4) addInterval(previousSample.mediaTime, mediaTime);
    }
    previousSample = {mediaTime, wallTime, rate};
    root.dataset.coverage = coverage().toFixed(4);
  }
  function stopSampling() {
    if (timer !== null) clearInterval(timer);
    timer = null; previousSample = null;
  }
  function settleReady(error) {
    if (readySettled) return;
    readySettled = true;
    clearTimeout(readyTimeout);
    error ? rejectReady(error) : resolveReady(player);
  }
  function fail(message) {
    if (disposed) return;
    stopSampling(); playerState = -1;
    settleReady(new Error(message));
    publish('error', message);
  }
  function changeState(event) {
    if (disposed) return;
    // Capture the final uninterrupted fraction before pause/buffer/end.
    sample(); stopSampling(); playerState = event.data;
    if (event.data === constants.PLAYING) {
      sample(); timer = setInterval(sample, 250);
      publish('playing', '시청 중이에요. 영상이 끝난 뒤 작품을 만나러 가요.');
    } else if (event.data === constants.ENDED) {
      if (duration() > 0 && coverage() >= .9) {
        const firstCompletion = !completed;
        completed = true;
        publish('completed', '영상을 끝까지 시청했어요. 이제 작품을 관찰할 수 있어요.');
        if (firstCompletion) onComplete({videoId: VIDEO_ID, duration: duration(), watchedSeconds: watchedSeconds(), coverage: coverage()});
      } else publish('incomplete', '건너뛴 부분이 있어요. 영상을 처음부터 끝까지 시청한 뒤 작품을 만나러 가요.');
    } else if (event.data === constants.PAUSED) publish('paused', '일시정지했어요. 준비되면 이어서 시청해 주세요.');
    else if (event.data === constants.BUFFERING) publish('buffering', '영상을 불러오는 중이에요. 잠시 기다려 주세요.');
    else publish('ready', '재생 버튼을 눌러 영상을 시청해 주세요.');
  }
  loadYouTubeAPI().then(YT => {
    if (disposed) return;
    readyTimeout = setTimeout(() => fail('영상을 열지 못했어요. YouTube 연결이나 학교 네트워크 설정을 확인해 주세요.'), 15000);
    player = new YT.Player(mount, {
      host: 'https://www.youtube-nocookie.com',
      width: '100%', height: '100%', videoId: VIDEO_ID,
      playerVars: {playsinline: 1, rel: 0, autoplay: 0, origin: window.location.origin},
      events: {
        onReady(event) {
          if (disposed) return;
          // event.target is authoritative even for synchronously-created mocks.
          player = event.target || player;
          const iframe = player?.getIframe?.();
          if (iframe) {
            iframe.title = '선생님이 고른 청자 학습 영상';
            iframe.referrerPolicy = 'strict-origin-when-cross-origin';
            iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0';
          }
          settleReady(); publish('ready', '재생 버튼을 눌러 영상을 시청해 주세요.');
        },
        onStateChange: changeState,
        onError(event) {
          const messages = {
            2: '영상 주소를 읽지 못했어요. 선생님께 영상 주소를 확인해 주세요.',
            5: '이 브라우저에서 영상을 재생하지 못했어요. 다른 브라우저나 네트워크를 확인해 주세요.',
            100: '영상이 삭제되었거나 비공개로 설정되어 있어요. 선생님께 확인해 주세요.',
            101: '영상 제공자가 외부 재생을 허용하지 않았어요. 선생님께 확인해 주세요.',
            150: '영상 제공자가 외부 재생을 허용하지 않았어요. 선생님께 확인해 주세요.',
            153: 'YouTube에서 이 사이트의 재생 요청을 확인하지 못했어요. 배포 주소에서 다시 열어 주세요.'
          };
          fail(messages[event.data] || '영상을 재생하지 못했어요. 네트워크를 확인하고 다시 열어 주세요.');
        },
        onAutoplayBlocked() { publish('ready', '영상의 재생 버튼을 직접 눌러 주세요.'); }
      }
    });
  }).catch(error => fail(error.message || 'YouTube에 연결하지 못했어요.'));

  return {
    ready,
    play() { if (!disposed) player?.playVideo?.(); },
    replay() {
      if (disposed || !player) return;
      stopSampling(); playerState = -1;
      player.seekTo?.(0, true); player.playVideo?.();
    },
    destroy() {
      if (disposed) return;
      disposed = true; stopSampling(); clearTimeout(readyTimeout);
      // Closing the dialog while the API loads is a normal cancellation.
      if (!readySettled) { readySettled = true; resolveReady(null); }
      try { player?.destroy?.(); } catch {}
      player = null; root.remove();
    }
  };
}
