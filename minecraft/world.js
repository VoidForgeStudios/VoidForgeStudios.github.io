import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.181.1/build/three.module.js";
import { BLOCKS } from "./blocks.js";

export const WORLD_SIZE = 32;
export const WORLD_HEIGHT = 18;
export const blocks = new Map();

export function key(x,y,z){ return `${x},${y},${z}`; }
export function getBlock(x,y,z){ return blocks.get(key(x,y,z)); }
export function setBlock(x,y,z,type){
  if(y < 0 || y >= WORLD_HEIGHT) return;
  const k=key(x,y,z);
  if(type) blocks.set(k,type); else blocks.delete(k);
}
function noise(x,z){
  const n=Math.sin(x*12.9898+z*78.233)*43758.5453;
  return n-Math.floor(n);
}
function heightAt(x,z){
  const a=Math.sin(x*.32)*1.5+Math.cos(z*.27)*1.5;
  const b=Math.sin((x+z)*.12)*2;
  return Math.max(1,Math.min(9,Math.floor(5+a+b+noise(x,z)*1.4)));
}
export function generateWorld(){
  blocks.clear();
  const half=WORLD_SIZE/2;
  for(let x=-half;x<half;x++) for(let z=-half;z<half;z++){
    const h=heightAt(x,z);
    for(let y=0;y<=h;y++){
      let type = y===h ? "grass" : y>h-3 ? "dirt" : "stone";
      setBlock(x,y,z,type);
    }
    if(noise(x*3,z*7)>.965 && h<8 && Math.abs(x)>3 && Math.abs(z)>3){
      for(let y=h+1;y<h+4;y++) setBlock(x,y,z,"wood");
      for(let dx=-1;dx<=1;dx++) for(let dz=-1;dz<=1;dz++) for(let dy=3;dy<=4;dy++)
        if(Math.abs(dx)+Math.abs(dz)<3) setBlock(x+dx,h+dy,z+dz,"grass");
    }
  }
}
function material(type, side=false){
  const d=BLOCKS[type];
  return new THREE.MeshLambertMaterial({color: side ? d.color : (d.top||d.color)});
}
export function buildMeshes(scene){
  for(const child of [...scene.children]){
    if(child.userData.blockMesh) scene.remove(child);
  }
  const geo=new THREE.BoxGeometry(1,1,1);
  for(const [k,type] of blocks){
    const [x,y,z]=k.split(",").map(Number);
    const m=new THREE.Mesh(geo, material(type));
    m.position.set(x+.5,y+.5,z+.5);
    m.userData.blockMesh=true;
    m.userData.block={x,y,z,type};
    scene.add(m);
  }
}
