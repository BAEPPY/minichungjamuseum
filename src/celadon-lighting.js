import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

// Neutral reflected light lets the reconstructed glaze read as ceramic. Keep
// the supplied scan materials under their existing observation lighting.
export function celadonLighting(renderer,scene,artifact){
 if(artifact.observationLighting!=='neutral-studio')return null;
 scene.add(new THREE.HemisphereLight(0xf1f4f5,0x858979,.35));
 const key=new THREE.DirectionalLight(0xffffff,2.2);key.position.set(-4,7,6);scene.add(key);
 const fill=new THREE.DirectionalLight(0xd4e0db,.35);fill.position.set(4,3,-3);scene.add(fill);
 const glint=new THREE.PointLight(0xffffff,28);glint.position.set(-2.5,3.5,4);scene.add(glint);
 const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);
 // A small reflected source produces the white glaze glints visible in the
 // photographs; the room's larger panels provide the softer window reflection.
 const reflectedLight=new THREE.Mesh(new THREE.SphereGeometry(.65,16,12),new THREE.MeshBasicMaterial({color:new THREE.Color(20,20,20)}));
 reflectedLight.position.set(-5,8,10);room.add(reflectedLight);
 let environment;
 try{environment=pmrem.fromScene(room,.025);scene.environment=environment.texture;scene.environmentIntensity=.8;}
 finally{room.dispose();pmrem.dispose();}
 return ()=>{scene.environment=null;environment?.dispose();};
}
