import {createViewer} from './museum.js';
import {createPhotoViewer} from './photo-viewer.js';
import './pillow-viewer.css';

const MODEL_SOURCE='사진 참고 재현 모델 · 형상 근사 (실측 스캔 아님)';
const MODEL_CAPTURE='사진 참고 재현 모델 · 형상 근사';
const PHOTO_SOURCE='다각도 사진 관찰 · 제공 SWF에서 추출한 원본 사진 54장';
const PHOTO_CAPTURE='다각도 사진 관찰 · 사용자 제공 SWF 원본 이미지';

/** A site-owned adapter for a photo-reference model and its original photographs.
 * Nothing is embedded from the museum or executed from the original SWF.
 * onState is called after construction, and again while switching/ready/error.
 */
export function createPillowViewer(el,artifact,{onState=()=>{}}={}){
 if(!(el instanceof HTMLElement))throw new Error('베개 관찰 화면을 표시할 공간이 필요해요.');
 const modelPath=artifact.model||artifact.reconstructionModel;
 const hasModel=Boolean(modelPath),hasPhotos=Boolean(artifact.photoView);
 if(!hasModel&&!hasPhotos)throw new Error('베개의 모델이나 원본 사진 자료가 필요해요.');

 const root=document.createElement('section');
 root.className='pillow-viewer';root.setAttribute('aria-label',`${artifact.name} 관찰 방식`);
 const toolbar=document.createElement('div');
 toolbar.className='pillow-viewer-modes';toolbar.setAttribute('role','group');toolbar.setAttribute('aria-label','베개 관찰 방식 선택');
 const buttons=new Map();
 for(const [mode,label,available] of [['model','3D 재현',hasModel],['photos','원본 사진 54장',hasPhotos]]){
  const button=document.createElement('button');button.type='button';button.dataset.pillowMode=mode;button.textContent=label;
  button.disabled=!available;button.setAttribute('aria-pressed','false');
  if(!available)button.title=mode==='model'?'3D 재현 자료가 아직 준비되지 않았어요.':'원본 사진 자료가 없어요.';
  toolbar.append(button);buttons.set(mode,button);
 }
 const status=document.createElement('p');status.className='pillow-viewer-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const warning=document.createElement('p');warning.className='pillow-viewer-warning';warning.hidden=true;warning.setAttribute('role','status');
 const viewport=document.createElement('div');viewport.className='pillow-viewer-viewport';
 root.append(toolbar,status,warning,viewport);el.append(root);

 let disposed=false,generation=0,active=null,pendingReady=null;
 let state={mode:hasModel?'model':'photos',loading:true,error:null,fallback:false};
 const sourceFor=mode=>mode==='model'
  ? artifact.sourceDescription||MODEL_SOURCE
  : artifact.photoSourceDescription||PHOTO_SOURCE;
 const captureFor=mode=>mode==='model'
  ? artifact.captureDescription||MODEL_CAPTURE
  : artifact.photoCaptureDescription||PHOTO_CAPTURE;
 const instructionFor=mode=>mode==='model'
  ? '드래그 회전 · 휠/두 손가락 확대'
  : '드래그로 사진 시점 변경 · 확대 후 드래그로 이동';
 function snapshot(){return {...state,source:sourceFor(state.mode),captureSource:captureFor(state.mode),instruction:instructionFor(state.mode)};}
 function publish(update){
  if(disposed)return;
  state={...state,...update};root.dataset.mode=state.mode;root.dataset.state=state.loading?'loading':state.error&&!state.fallback?'error':'ready';
  root.setAttribute('aria-busy',String(state.loading));
  for(const [mode,button] of buttons)button.setAttribute('aria-pressed',String(mode===state.mode));
  status.textContent=state.loading
   ? state.mode==='model'?'3D 재현 모델을 여는 중이에요.':'원본 관찰 사진을 여는 중이에요.'
   : state.error&&!state.fallback?'관찰 자료를 열지 못했어요. 다른 관찰 방식을 선택해 주세요.'
   : state.mode==='model'?'밑면 무늬도 원본 사진을 참고했어요. 형상·배치 일부는 추정한 재현이므로 원본 사진과 비교해 보세요.':'원본 사진을 바꾸어 관찰해요. 사진 속 형태와 무늬를 확인해 보세요.';
  warning.hidden=!state.fallback;
  warning.textContent=state.fallback?'3D 재현 자료를 열지 못해 원본 사진으로 전환했어요.':'';
  onState(snapshot());
 }
 function disposeRecord(record){
  if(!record||record.disposed)return;
  record.disposed=true;record.cancel();record.viewer.dispose();
 }
 async function activate(mode,{fallback=false,error=null}={}){
  if(disposed)return;
  if(!['model','photos'].includes(mode))throw new Error('지원하지 않는 관찰 방식이에요.');
  if(mode==='model'&&!hasModel||mode==='photos'&&!hasPhotos)throw new Error('선택한 관찰 자료가 아직 준비되지 않았어요.');
  const token=++generation;
  disposeRecord(active);active=null;viewport.replaceChildren();
  publish({mode,loading:true,error,fallback});
  let record;
  try{
   const inner=mode==='model'
    ? createViewer(viewport,{...artifact,model:modelPath,photoView:undefined,referenceTint:false})
    : createPhotoViewer(viewport,artifact);
   let cancel;
   const cancelled=new Promise(resolve=>{cancel=()=>resolve(false);});
   record={viewer:inner,cancel,disposed:false};active=record;
   const loaded=await Promise.race([Promise.resolve(inner.ready).then(()=>true),cancelled]);
   if(!loaded||disposed||token!==generation)return;
   publish({mode,loading:false,error,fallback});
  }catch(cause){
   disposeRecord(record);
   if(disposed||token!==generation)return;
   active=null;viewport.replaceChildren();
   const message=cause?.message||'관찰 자료를 열지 못했어요.';
   if(mode==='model'&&hasPhotos)return activate('photos',{fallback:true,error:message});
   publish({mode,loading:false,error:message,fallback:false});
   throw cause;
  }
 }
 function switchMode(mode){
  pendingReady=activate(mode);pendingReady.catch(()=>{});return pendingReady;
 }
 for(const [mode,button] of buttons)button.addEventListener('click',()=>{switchMode(mode);});
 // Defer the first notification until the caller can assign the returned API.
 const ready=Promise.resolve().then(()=>generation?pendingReady:switchMode(hasModel?'model':'photos'));
 ready.catch(()=>{});

 return {
  ready,switchMode,
  getState:snapshot,
  getCaptureSource(){return captureFor(state.mode);},
  zoom(factor){if(!disposed&&!state.loading)active?.viewer.zoom(factor);},
  reset(){if(!disposed&&!state.loading)active?.viewer.reset();},
  setReferenceColor(){/* Photo-derived colors are never tinted. */},
  capture(){
   if(disposed||state.loading||!active||state.error&&!state.fallback)throw new Error('관찰 자료가 준비될 때까지 기다려 주세요.');
   return active.viewer.capture();
  },
  dispose(){
   if(disposed)return;disposed=true;generation++;disposeRecord(active);active=null;root.remove();
  }
 };
}
