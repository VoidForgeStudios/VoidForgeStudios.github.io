import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.181.1/build/three.module.js";
import { generateWorld, buildMeshes, blocks, key, getBlock, setBlock } from "./world.js";
import { HOTBAR } from "./blocks.js";
import { Player } from "./player.js";
import { setupHotbar } from "./inventory.js";

const game=document.getElementById("game");
const start=document.getElementById("start");
const play=document.getElementById("play");
const status=document.getElementById("status");

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x87ceeb);
scene.fog=new THREE.Fog(0x87ceeb,18,55);

const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.05,100);
const renderer=new THREE.WebGLRenderer({antialias:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
game.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xbfe8ff,0x5b4632,2));
const sun=new THREE.DirectionalLight(0xffffff,2);
sun.position.set(20,35,10); scene.add(sun);

generateWorld(); buildMeshes(scene);
const player=new Player(camera,renderer.domElement);
const getSelected=setupHotbar();

renderer.domElement.addEventListener("contextmenu",e=>e.preventDefault());
play.addEventListener("click",()=>renderer.domElement.requestPointerLock());
renderer.domElement.addEventListener("click",()=>renderer.domElement.requestPointerLock());
document.addEventListener("pointerlockchange",()=>{
  start.classList.toggle("hidden",document.pointerLockElement===renderer.domElement);
});

const raycaster=new THREE.Raycaster();
const center=new THREE.Vector2(0,0);

function target(){
  raycaster.setFromCamera(center,camera);
  return raycaster.intersectObjects(scene.children.filter(o=>o.userData.blockMesh),false)[0];
}
window.addEventListener("mousedown",e=>{
  if(document.pointerLockElement!==renderer.domElement)return;
  const hit=target(); if(!hit)return;
  const b=hit.object.userData.block;
  if(e.button===0){
    if(b.y>0){setBlock(b.x,b.y,b.z,null); rebuild();}
  }else if(e.button===2){
    const p=hit.point.clone().addScaledVector(hit.face.normal,.51);
    const x=Math.floor(p.x),y=Math.floor(p.y),z=Math.floor(p.z);
    if(!getBlock(x,y,z) && y>=0 && y<18){setBlock(x,y,z,getSelected()); rebuild();}
  }
});
function rebuild(){buildMeshes(scene)}

let last=performance.now(),fps=0,frames=0;
function animate(now){
  requestAnimationFrame(animate);
  const dt=Math.min((now-last)/1000,.05); last=now;
  player.update(dt);
  frames++;
  if(now%500<20){status.textContent=`BlockWorld v0.1 • Blocks: ${blocks.size}`;}
  renderer.render(scene,camera);
}
requestAnimationFrame(animate);

addEventListener("resize",()=>{
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});
