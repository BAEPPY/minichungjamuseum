import './local-model-controls.css';
import {artifacts} from './artifacts.js';
import {getLocalModel,importLocalModel,removeLocalModel} from './local-models.js';

function safeSource(value){
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}
}
const sizeLabel=size=>`${(size/1024/1024).toFixed(size>=10*1024*1024?0:1)} MB`;

/** Mount the teacher's local-only source controls inside the settings dialog. */
export function mountLocalModelControls(host,{onChanged=()=>{},onError=()=>{}}={}){
 if(!(host instanceof HTMLElement))throw new Error('자료 등록 화면을 표시할 공간이 필요해요.');
 const root=document.createElement('section');root.id='localModelControls';root.className='local-model-controls';root.setAttribute('aria-labelledby','localModelTitle');
 const title=document.createElement('h3');title.id='localModelTitle';title.textContent='교사용 · 3D 자료 등록';
 const help=document.createElement('p');help.className='local-model-help';help.textContent='GLB 파일을 이 기기에 저장해 직접 관찰합니다. 학급 전체에 배포하려면 원본 파일을 저장소에 추가해야 합니다.';
 const label=document.createElement('label');label.htmlFor='localModelArtifact';label.textContent='자료를 등록할 유물';
 const select=document.createElement('select');select.id='localModelArtifact';
 for(const artifact of artifacts){const option=document.createElement('option');option.value=artifact.id;option.textContent=artifact.name;select.append(option);}
 select.value=artifacts.find(a=>a.nativePending||a.externalView)?.id||artifacts[0]?.id||'';
 const status=document.createElement('p');status.id='localModelStatus';status.className='local-model-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const file=document.createElement('input');file.id='localModelFile';file.type='file';file.accept='.glb,model/gltf-binary';file.hidden=true;file.setAttribute('aria-label','등록할 3D GLB 파일');
 const importButton=document.createElement('button');importButton.id='localModelImport';importButton.type='button';importButton.className='outline';importButton.textContent='3D 파일 가져오기';
 const removeButton=document.createElement('button');removeButton.id='localModelRemove';removeButton.type='button';removeButton.className='text-button';removeButton.textContent='등록한 파일 지우기';
 const links=document.createElement('div');links.className='local-model-links';
 const sourceLink=document.createElement('a');sourceLink.id='localModelSource';sourceLink.target='_blank';sourceLink.rel='noopener noreferrer';sourceLink.textContent='원본 자료 페이지 ↗';
 const downloadLink=document.createElement('a');downloadLink.id='localModelDownload';downloadLink.target='_blank';downloadLink.rel='noopener noreferrer';
 links.append(sourceLink,downloadLink);root.append(title,help,label,select,status,file,importButton,removeButton,links);host.append(root);
 let busy=false,disposed=false,pickerArtifactId=null;
 const selectedArtifact=()=>artifacts.find(a=>a.id===select.value);
 function announce(message,error=false){status.textContent=message;status.classList.toggle('is-error',error);}
 function reportError(error){try{onError(error);}catch{}}
 function refresh(message,error=false){
  if(disposed)return;
  const artifact=selectedArtifact(),local=artifact?getLocalModel(artifact.id):null;
  select.disabled=busy;importButton.disabled=busy||!artifact;removeButton.disabled=busy||!local;
  if(!artifact){announce('등록할 유물을 선택해 주세요.');return;}
  if(message)announce(message,error);
  else if(local)announce(`${local.fileName} · ${sizeLabel(local.size)} · 이 기기에 저장됨`);
  else if(artifact.model)announce('기본 3D 자료를 사용 중이에요.');
  else if(artifact.photoView)announce('기본 다각도 사진 자료를 사용 중이에요.');
  else announce('원본 3D 파일을 등록해 주세요.');
  const source=safeSource(artifact.sourceViewerUrl||artifact.referenceUrl),download=safeSource(artifact.modelDownloadUrl);
  sourceLink.hidden=!source;if(source)sourceLink.href=source;else sourceLink.removeAttribute('href');
  downloadLink.hidden=!download;if(download)downloadLink.href=download;else downloadLink.removeAttribute('href');
  downloadLink.textContent=`${artifact.kind||'유물'} 공식 3D 자료 다운로드 ↗`;links.hidden=!source&&!download;
 }
 async function changed(id){
  try{await onChanged(id);return true;}catch(error){reportError(error);return false;}
 }
 async function importSelected(selectedFile,id){
  if(disposed||busy||!selectedFile)return;
  busy=true;refresh('3D 파일을 확인하고 저장하는 중이에요.');
  let message,error=false;
  try{
   const result=await importLocalModel(id,selectedFile);
   const previewReady=await changed(id);
   message=previewReady?`${result?.fileName||selectedFile.name} · 이 기기에 저장했어요.`:'파일을 저장했어요. 미리보기를 다시 열어 확인해 주세요.';
  }catch(cause){message=cause.message||'3D 파일을 등록하지 못했어요. 기존 자료는 유지됩니다.';error=true;reportError(cause);}
  finally{busy=false;refresh(message,error);}
 }
 function chooseFile(){if(disposed||busy)return;pickerArtifactId=select.value;file.value='';file.click();}
 function fileChosen(){const selectedFile=file.files?.[0],id=pickerArtifactId||select.value;pickerArtifactId=null;file.value='';if(selectedFile)importSelected(selectedFile,id);}
 async function removeSelected(){
  const artifact=selectedArtifact();if(disposed||busy||!artifact||!getLocalModel(artifact.id))return;
  busy=true;refresh('등록한 파일을 지우는 중이에요.');let message,error=false;
  try{await removeLocalModel(artifact.id);await changed(artifact.id);message='등록한 파일을 지우고 기본 자료로 돌아왔어요.';}
  catch(cause){message=cause.message||'등록한 파일을 지우지 못했어요.';error=true;reportError(cause);}
  finally{busy=false;refresh(message,error);}
 }
 select.addEventListener('change',()=>refresh());importButton.addEventListener('click',chooseFile);file.addEventListener('change',fileChosen);removeButton.addEventListener('click',removeSelected);
 refresh();
 return {refresh,dispose(){if(disposed)return;disposed=true;importButton.removeEventListener('click',chooseFile);file.removeEventListener('change',fileChosen);removeButton.removeEventListener('click',removeSelected);root.remove();}};
}
