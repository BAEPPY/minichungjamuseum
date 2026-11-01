import test from 'node:test';
import assert from 'node:assert/strict';
import {validateGlbContainer} from '../src/local-models.js';

function container(json){
 const text=new TextEncoder().encode(JSON.stringify(json)),length=Math.ceil(text.length/4)*4;
 const buffer=new ArrayBuffer(20+length),bytes=new Uint8Array(buffer),view=new DataView(buffer);
 view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,buffer.byteLength,true);view.setUint32(12,length,true);view.setUint32(16,0x4e4f534a,true);
 bytes.fill(32,20);bytes.set(text,20);return buffer;
}

test('single GLB container accepts embedded resources without requesting files',()=>{
 const json={asset:{version:'2.0'},buffers:[{byteLength:0}],images:[{uri:'data:image/png;base64,AA=='}]};
 assert.deepEqual(validateGlbContainer(container(json)),json);
});

test('viewer HTML, truncated files and malformed model descriptions are rejected',()=>{
 assert.throws(()=>validateGlbContainer(new TextEncoder().encode('<iframe src="https://example.com"></iframe>').buffer),/GLB/);
 const incomplete=container({asset:{version:'2.0'}});new DataView(incomplete).setUint32(8,incomplete.byteLength+4,true);
 assert.throws(()=>validateGlbContainer(incomplete),/GLB/);
 const invalid=container({asset:{version:'2.0'}});new Uint8Array(invalid)[20]=33;
 assert.throws(()=>validateGlbContainer(invalid),/모델 설명/);
});

test('GLB resources must be embedded, including otherwise valid relative URLs',()=>{
 for(const json of [
  {asset:{version:'2.0'},buffers:[{uri:'https://example.com/private.bin'}]},
  {asset:{version:'2.0'},images:[{uri:'texture.png'}]},
  {asset:{version:'2.0'},images:[{uri:'//example.com/texture.png'}]}
 ])assert.throws(()=>validateGlbContainer(container(json)),/함께 포함된 단일 GLB/);
});
