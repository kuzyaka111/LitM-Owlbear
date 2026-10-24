import RAPIER from '@dimforge/rapier3d-compat';
let ready;
export const initPhysics=()=>ready??=RAPIER.init().catch(error=>{ready=undefined;throw error;});
export const faceNormals=[[2,1,0,0],[5,-1,0,0],[1,0,1,0],[6,0,-1,0],[3,0,0,1],[4,0,0,-1]];
export function upperFace(q){
 let value=1,height=-2;
 for(const [n,x,y,z] of faceNormals){
  const up=2*(q.x*q.y+q.w*q.z)*x+(1-2*(q.x*q.x+q.z*q.z))*y+2*(q.y*q.z-q.w*q.x)*z;
  if(up>height){height=up;value=n;}
 }return {value,height};
}
export function createDiceWorld(random=Math.random,onImpact=()=>{}){
 const world=new RAPIER.World({x:0,y:-20,z:0});world.timestep=1/60;const events=new RAPIER.EventQueue(true);let clock=0;const lastContacts=new Map();
 const wall=(x,y,z,hx,hy,hz)=>world.createCollider(RAPIER.ColliderDesc.cuboid(hx,hy,hz).setTranslation(x,y,z).setFriction(.65).setRestitution(.3));
 wall(0,-.2,0,5.5,.2,4);wall(-5.25,2,0,.25,2,4);wall(5.25,2,0,.25,2,4);wall(0,2,-3.75,5.5,2,.25);wall(0,2,3.75,5.5,2,.25);wall(0,10,0,5.5,.2,4);
 const bodies=[-1,1].map(x=>{const b=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x,3,0).setCcdEnabled(true).setLinearDamping(.18).setAngularDamping(.18));world.createCollider(RAPIER.ColliderDesc.roundCuboid(.43,.43,.43,.07).setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(45).setDensity(1).setFriction(.65).setRestitution(.38),b);return b;});
 const rand=(min,max)=>min+random()*(max-min);
 function throwDice(){for(const [i,b] of bodies.entries()){
  b.setBodyType(RAPIER.RigidBodyType.Dynamic,true);b.setTranslation({x:(i?1:-1)*rand(1,3.5),y:rand(2.3,4),z:rand(-2.2,2.2)},true);
  const u=random(),a=2*Math.PI*random(),c=2*Math.PI*random();b.setRotation({x:Math.sqrt(1-u)*Math.sin(a),y:Math.sqrt(1-u)*Math.cos(a),z:Math.sqrt(u)*Math.sin(c),w:Math.sqrt(u)*Math.cos(c)},true);
  b.setLinvel({x:rand(-8,8),y:rand(1,4),z:rand(-7,7)},true);b.setAngvel({x:rand(-18,18),y:rand(-18,18),z:rand(-18,18)},true);
 }}
 function step(){world.step(events);clock+=1/60;
  events.drainContactForceEvents(event=>{const a=event.collider1(),b=event.collider2(),key=a<b?a+':'+b:b+':'+a;
   if(clock-(lastContacts.get(key)??-Infinity)<.075)return;
   lastContacts.set(key,clock);onImpact(event.totalForceMagnitude());
  });if(!bodies.every(b=>b.isSleeping()))return null;
  const faces=bodies.map(b=>upperFace(b.rotation()));if(faces.some(f=>f.height<.96)){
   bodies.forEach(b=>{b.applyImpulse({x:rand(-.4,.4),y:1.6,z:rand(-.4,.4)},true);b.applyTorqueImpulse({x:.2,y:0,z:.13},true);});return null;
  }return faces.map(f=>f.value);
 }
 return {world,bodies,throwDice,step,free:()=>{events.free();world.free();}};
}
