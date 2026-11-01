import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MAP_CAMERA_DIRECTION,projectMap} from '../src/projection.js';
import {mapSurfacePoint} from '../src/surface-sprite.js';

const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} differs from ${expected}`);

test('the 3D thumbnail camera agrees with both map ground axes',()=>{
  const eye=new THREE.Vector3(...MAP_CAMERA_DIRECTION).normalize();
  close(Math.atan2(eye.x,eye.z),Math.PI/4);
  close(Math.asin(eye.y),Math.PI/6);
  const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),eye).normalize();
  const up=new THREE.Vector3().crossVectors(eye,right).normalize();
  for(const [x,z]of [[1,0],[0,1]]){
    const axis=new THREE.Vector3(x,0,z),map=projectMap(x,z);
    close(-axis.dot(up)/axis.dot(right),map.y/map.x);
  }
});

test('a source face with unequal pillar heights maps to equal-height levels',()=>{
  // Independent source corners have different top/bottom slopes. One global
  // affine transformation cannot satisfy this regression fixture.
  const source=[[214,171],[1033,422],[1031,789],[222,480]];
  const target=[[-64,-92],[32,-44],[32,0],[-64,-48]];
  const surfaces=[[0,1,2],[0,2,3]].map(ids=>({source:ids.map(i=>source[i]),target:ids.map(i=>target[i])}));
  const [a,b,c,d]=source.map(p=>mapSurfacePoint(p,surfaces));
  close((b[1]-a[1])/(b[0]-a[0]),.5);close((c[1]-d[1])/(c[0]-d[0]),.5);
  close(d[1]-a[1],44);close(c[1]-b[1],44);close(a[0],d[0]);close(b[0],c[0]);
  const center=source[0].map((v,i)=>(v+source[2][i])/2),mapped=mapSurfacePoint(center,surfaces);
  close(mapped[0],(target[0][0]+target[2][0])/2);close(mapped[1],(target[0][1]+target[2][1])/2);
});

test('a named collection anchor stays on its scaffold',()=>{
  assert.deepEqual(mapSurfacePoint([770,574],[],{'770,574':[0,-32]}),[0,-32]);
  assert.throws(()=>mapSurfacePoint([0,0],[]),/no surface or marker/);
});
