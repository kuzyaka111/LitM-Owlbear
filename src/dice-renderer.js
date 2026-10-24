import {trayMaterials} from './dice-materials.js';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import RAPIER from '@dimforge/rapier3d-compat';
import {initPhysics,createDiceWorld} from './dice-physics.js';
export async function createDiceRenderer(host,{onStart,onResult,onError,onImpact=()=>{}}){
 await initPhysics();
 const doc=host.ownerDocument,win=doc.defaultView,renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(win.devicePixelRatio||1,1.5));renderer.setClearColor(0x302219);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
 host.replaceChildren(renderer.domElement);const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(39,1,.1,60);camera.position.set(0,14,9);camera.lookAt(0,0,0);
 scene.add(new THREE.HemisphereLight(0xfff4dd,0x403426,2));const light=new THREE.DirectionalLight(0xfff4dd,3);light.position.set(-3,9,5);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-7;light.shadow.camera.right=7;light.shadow.camera.top=6;light.shadow.camera.bottom=-6;scene.add(light);
 const surfaces=trayMaterials(doc),wood=surfaces.wood,felt=surfaces.leather;
 function box(w,h,d,x,y,z,mat){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.receiveShadow=true;scene.add(mesh);return mesh;}
 box(10.5,.3,7.5,0,-.15,0,felt);box(.28,.6,7.8,-5.13,.15,0,wood);box(.28,.6,7.8,5.13,.15,0,wood);box(10.5,.6,.28,0,.15,-3.63,wood);box(10.5,.6,.28,0,.15,3.63,wood);
 const pattern={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
 const materials=[2,5,1,6,3,4].map(n=>{const c=doc.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');const ivory=ctx.createRadialGradient(45,35,4,64,64,90);ivory.addColorStop(0,'#fff9e9');ivory.addColorStop(1,'#cfb98f');ctx.fillStyle=ivory;ctx.fillRect(0,0,128,128);ctx.fillStyle='#402b20';ctx.shadowColor='#af956e';ctx.shadowBlur=2;for(const i of pattern[n]){ctx.beginPath();ctx.arc(32+(i%3)*32,32+Math.floor(i/3)*32,9,0,Math.PI*2);ctx.fill();}const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;return new THREE.MeshStandardMaterial({map,roughness:.28,metalness:0});});
 const physics=createDiceWorld(Math.random,onImpact),geometry=new RoundedBoxGeometry(1,1,1,3,.07),meshes=physics.bodies.map(()=>{const mesh=new THREE.Mesh(geometry,materials);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh;});
 let frame=0,last=0,accumulator=0,running=false,disposed=false,drag=null;
 function sync(){meshes.forEach((m,i)=>{m.position.copy(physics.bodies[i].translation());m.quaternion.copy(physics.bodies[i].rotation());});renderer.render(scene,camera);}
 function tick(now){frame=0;if(disposed)return;try{const dt=Math.min((now-last)/1000,.1);last=now;accumulator+=dt;let result;
  while(accumulator>=1/60){if(drag)drag.body.setNextKinematicTranslation(drag.target);result=physics.step();accumulator-=1/60;if(result&&!drag){running=false;break;}}
  sync();if(result&&!drag){host.dataset.values=result.join(',');onResult(result);}else frame=win.requestAnimationFrame(tick);
  }catch(error){running=false;onError(error);}
 }
 function start(){if(disposed)return;onStart();delete host.dataset.values;running=true;accumulator=0;last=win.performance.now();if(!frame)frame=win.requestAnimationFrame(tick);}
 function roll(){if(running||disposed)return;physics.throwDice();start();}
 function resize(){if(disposed)return;const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/Math.max(1,h);camera.position.set(0,camera.aspect<1?20:14,camera.aspect<1?12:9);camera.updateProjectionMatrix();camera.lookAt(0,0,0);sync();}
 const observer=new win.ResizeObserver(resize);observer.observe(host);resize();
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),-1.8);
 function point(e){const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const v=new THREE.Vector3();ray.ray.intersectPlane(plane,v);return {x:Math.max(-4.3,Math.min(4.3,v.x)),y:1.8,z:Math.max(-2.8,Math.min(2.8,v.z))};}
 function down(e){if(running||disposed||e.isPrimary===false||e.button!==0)return;point(e);const hit=ray.intersectObjects(meshes)[0];if(!hit)return;const body=physics.bodies[meshes.indexOf(hit.object)];drag={body,target:point(e),pointerId:e.pointerId};body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true);renderer.domElement.setPointerCapture(e.pointerId);start();}
 function move(e){if(drag&&drag.pointerId===e.pointerId)drag.target=point(e);}
 function up(e){if(!drag||drag.pointerId!==e.pointerId)return;drag.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);drag=null;
  // The rules found permit rerolling the pair, not keeping one die.
  for(const b of physics.bodies){b.applyImpulse({x:(Math.random()-.5)*4,y:4,z:(Math.random()-.5)*4},true);b.applyTorqueImpulse({x:Math.random()-.5,y:Math.random()-.5,z:Math.random()-.5},true);}
 }
 renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',up);renderer.domElement.addEventListener('lostpointercapture',up);
 function contextLost(e){e.preventDefault();if(disposed)return;running=false;win.cancelAnimationFrame(frame);frame=0;onError(new Error('Графический контекст потерян.'));}
 renderer.domElement.addEventListener('webglcontextlost',contextLost);
 return {roll,dispose(){
  if(disposed)return;disposed=true;win.cancelAnimationFrame(frame);frame=0;observer.disconnect();
  for(const [name,handler] of [['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',up],['lostpointercapture',up],['webglcontextlost',contextLost]])renderer.domElement.removeEventListener(name,handler);
  drag=null;physics.free();
  const geometries=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});geometries.forEach(g=>g.dispose());
  materials.forEach(m=>{m.map.dispose();m.dispose();});surfaces.dispose();light.shadow.dispose();renderer.dispose();renderer.forceContextLoss();
 }};
}
