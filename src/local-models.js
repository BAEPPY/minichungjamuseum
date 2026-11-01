import {allObservationArtifacts as artifacts} from './comparison-artifacts.js';
import * as storage from './storage.js';
import * as models from './models.js';
import {Box3} from 'three';

const MAX_BYTES=30*1024*1024;
const definitions=new Map(artifacts.map(artifact=>[artifact.id,{...artifact}]));
const active=new Map();
let operations=Promise.resolve();

function serialize(task){
 const result=operations.catch(()=>{}).then(task);
 operations=result.catch(()=>{});
 return result;
}

function artifactFor(id){
 const artifact=artifacts.find(item=>item.id===id);
 if(!artifact||!definitions.has(id))throw new Error('선택한 유물을 찾지 못했어요.');
 return artifact;
}

function cleanName(value){
 return String(value||'model.glb').normalize('NFC').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,160)||'model.glb';
}

function disposeURL(url){
 if(!url)return;
 URL.revokeObjectURL(url);
 // Only private upload URLs are passed here. The built-in collection files
 // remain shared and cached by the model loader.
 if(url.startsWith('blob:'))models.releaseModelSource?.(url);
}

/** Check the binary container and resource references before GLTFLoader can
 * request anything. A single GLB must carry its buffers and images inside it. */
export function validateGlbContainer(buffer){
 if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<20)throw new Error('단일 GLB 형식의 3D 파일을 선택해 주세요.');
 const view=new DataView(buffer);
 if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==buffer.byteLength)throw new Error('완전한 GLB 2.0 파일인지 확인해 주세요.');
 let offset=12,json,binChunks=0,chunkIndex=0;
 while(offset<buffer.byteLength){
  if(offset+8>buffer.byteLength)throw new Error('GLB 파일의 일부가 손상되었어요.');
  const length=view.getUint32(offset,true),type=view.getUint32(offset+4,true);
  if(length%4!==0||offset+8+length>buffer.byteLength)throw new Error('GLB 파일의 일부가 손상되었어요.');
  if(chunkIndex===0&&type!==0x4e4f534a)throw new Error('GLB 모델 설명을 찾지 못했어요.');
  if(type===0x4e4f534a){
   if(json!==undefined)throw new Error('GLB 모델 설명이 중복되어 있어요.');
   try{json=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array(buffer,offset+8,length)).replace(/\0+$/g,'').trim());}
   catch{throw new Error('GLB 모델 설명을 읽지 못했어요.');}
  }else if(type===0x004e4942&&++binChunks>1)throw new Error('하나로 묶인 GLB 파일을 선택해 주세요.');
  offset+=8+length;chunkIndex++;
 }
 if(!json||typeof json!=='object'||Array.isArray(json))throw new Error('GLB 모델 설명을 읽지 못했어요.');
 for(const key of ['buffers','images']){
  const resources=json[key]??[];
  if(!Array.isArray(resources))throw new Error('GLB 자료 구성이 올바르지 않아요.');
  for(const resource of resources){
   if(!resource||typeof resource!=='object')throw new Error('GLB 자료 구성이 올바르지 않아요.');
   if(resource.uri!==undefined&&(typeof resource.uri!=='string'||!/^data:/i.test(resource.uri)))throw new Error('이미지와 모델 데이터가 함께 포함된 단일 GLB 파일을 선택해 주세요.');
  }
 }
 return json;
}

async function validateBlob(id,blob){
 if(!(blob instanceof Blob)||!blob.size||blob.size>MAX_BYTES)throw new Error('30MB 이하의 단일 GLB 파일을 선택해 주세요.');
 validateGlbContainer(await blob.arrayBuffer());
 const url=URL.createObjectURL(blob);
 let object;
 try{
  object=await models.loadArtifactModel({...definitions.get(id),model:url,referenceTint:false});
  let meshFound=false;
  object.traverse(node=>{if(node.isMesh&&node.geometry?.getAttribute('position')?.count>0)meshFound=true;});
  const bounds=new Box3().setFromObject(object);
  if(!meshFound||![...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite))throw new Error('표시할 수 있는 유물 모양이 없어요.');
  return url;
 }catch(error){
  disposeURL(url);
  if(/DRACO/i.test(error?.message||''))throw new Error('이 파일은 추가 압축 해제가 필요해요. 압축되지 않은 단일 GLB 파일을 사용해 주세요.');
  throw new Error('3D 모델을 읽지 못했어요. 이미지가 포함된 정상적인 GLB 파일인지 확인해 주세요.');
 }finally{if(object)models.disposeModel(object);}
}

function restoreDefinition(id){
 const artifact=artifactFor(id);
 for(const key of Object.keys(artifact))delete artifact[key];
 Object.assign(artifact,definitions.get(id));
 return artifact;
}

function apply(id,url,metadata){
 const previous=active.get(id),artifact=restoreDefinition(id);
 for(const key of ['photoView','photoPoster','mapPreview','preferMapPreview','hybridView','reconstructionModel','photoSourceDescription','photoCaptureDescription','externalView','nativePending','modelPending','licenseUrl','licenseLabel'])delete artifact[key];
 Object.assign(artifact,{model:url,referenceTint:false,sourceDescription:`이 기기에 등록한 3D 모델 · ${metadata.fileName}`,captureDescription:`이 기기에 등록한 3D 모델 · ${metadata.fileName}`});
 active.set(id,{...metadata,model:url});
 if(previous?.model!==url)disposeURL(previous?.model);
}

/** Local status only: no file data or browser storage record escapes here. */
export function getLocalModel(id){
 const record=active.get(id);
 return record?{...record}:null;
}

/** Validate and persist before replacing the currently usable collection data. */
export function importLocalModel(id,file){
 return serialize(async()=>{
  artifactFor(id);
  const url=await validateBlob(id,file),metadata={artifactId:id,fileName:cleanName(file.name),size:file.size,registeredAt:new Date().toISOString()};
  try{await storage.put({id:`native-model-${id}`,type:'native-model',...metadata,blob:file});}
  catch{disposeURL(url);throw new Error('이 기기에 모델을 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.');}
  apply(id,url,metadata);
  return getLocalModel(id);
 });
}

export function removeLocalModel(id){
 return serialize(async()=>{
  artifactFor(id);
  try{await storage.remove(`native-model-${id}`);}
  catch{throw new Error('등록한 모델을 지우지 못했어요. 다시 시도해 주세요.');}
  const previous=active.get(id);
  restoreDefinition(id);active.delete(id);disposeURL(previous?.model);
  return null;
 });
}

/** Restore records independently so a bad upload cannot block the museum. */
export function restoreLocalModels(){
 return serialize(async()=>{
  const result={restored:[],errors:[]};
  for(const id of definitions.keys()){
   let url;
   try{
    const record=await storage.get(`native-model-${id}`);
    if(!record)continue;
    if((record.type&&record.type!=='native-model')||(record.artifactId&&record.artifactId!==id))throw new Error('등록한 유물 자료의 정보가 올바르지 않아요.');
    const blob=record.blob||record.file;
    url=await validateBlob(id,blob);
    const metadata={artifactId:id,fileName:cleanName(record.fileName||blob.name),size:blob.size,registeredAt:typeof record.registeredAt==='string'?record.registeredAt:new Date().toISOString()};
    apply(id,url,metadata);url=null;result.restored.push(id);
   }catch(error){
    disposeURL(url);
    result.errors.push({artifactId:id,message:error?.message||'등록한 3D 자료를 불러오지 못했어요.'});
   }
  }
  return result;
 });
}
