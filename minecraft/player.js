import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.181.1/build/three.module.js";

export class Player{
  constructor(camera,dom){
    this.camera=camera; this.dom=dom;
    this.position=new THREE.Vector3(0,12,0);
    this.velocity=new THREE.Vector3();
    this.yaw=0; this.pitch=0; this.onGround=false;
    this.keys={};
    window.addEventListener("keydown",e=>{this.keys[e.code]=true});
    window.addEventListener("keyup",e=>{this.keys[e.code]=false});
    dom.addEventListener("mousemove",e=>{
      if(document.pointerLockElement!==dom) return;
      this.yaw-=e.movementX*.0025;
      this.pitch-=e.movementY*.0025;
      this.pitch=Math.max(-1.5,Math.min(1.5,this.pitch));
    });
  }
  update(dt){
    const speed=this.keys.ShiftLeft?7:5;
    const dir=new THREE.Vector3(
      (this.keys.KeyD?1:0)-(this.keys.KeyA?1:0),0,
      (this.keys.KeyS?1:0)-(this.keys.KeyW?1:0)
    );
    if(dir.lengthSq()) dir.normalize().applyAxisAngle(new THREE.Vector3(0,1,0),this.yaw);
    this.velocity.x=dir.x*speed; this.velocity.z=dir.z*speed;
    this.velocity.y-=22*dt;
    if(this.keys.Space && this.onGround){this.velocity.y=8;this.onGround=false}
    this.position.addScaledVector(this.velocity,dt);
    if(this.position.y<1.1){this.position.y=1.1;this.velocity.y=0;this.onGround=true}
    this.camera.position.copy(this.position);
    this.camera.position.y+=.55;
    this.camera.rotation.order="YXZ";
    this.camera.rotation.y=this.yaw;
    this.camera.rotation.x=this.pitch;
  }
}
