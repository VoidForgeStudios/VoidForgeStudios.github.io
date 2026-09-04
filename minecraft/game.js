import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.181.1/build/three.module.js";
import { generateWorld, buildMeshes, chunks, key, getBlock, setBlock, WORLD_HEIGHT } from "./world.js";
import { Player } from "./player.js";
import { setupHotbar } from "./inventory.js";

const game = document.getElementById("game");
const start = document.getElementById("start");
const play = document.getElementById("play");
const status = document.getElementById("status");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 18, 55);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, .05, 100);
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
game.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xbfe8ff, 0x5b4632, 2));
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(20, 35, 10); 
scene.add(sun);

generateWorld(); 
buildMeshes(scene);

const player = new Player(camera, renderer.domElement);
const getSelected = setupHotbar();

renderer.domElement.addEventListener("contextmenu", e => e.preventDefault());
play.addEventListener("click", () => renderer.domElement.requestPointerLock());
renderer.domElement.addEventListener("click", () => renderer.domElement.requestPointerLock());
document.pointerLockElement === renderer.domElement ? start.classList.add("hidden") : null;
document.addEventListener("pointerlockchange", () => {
  start.classList.toggle("hidden", document.pointerLockElement === renderer.domElement);
});

const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);

function target() {
  raycaster.setFromCamera(center, camera);
  return raycaster.intersectObjects(scene.children.filter(o => o.userData.blockMesh), false)[0];
}

window.addEventListener("mousedown", e => {
  if (document.pointerLockElement !== renderer.domElement) return;
  const hit = target(); 
  if (!hit) return;

  if (e.button === 0) {
    // Break block: step slightly backward along the face normal into the block
    const p = hit.point.clone().addScaledVector(hit.face.normal, -0.5);
    const x = Math.floor(p.x), y = Math.floor(p.y), z = Math.floor(p.z);
    if (y > 0 && getBlock(x, y, z)) {
      setBlock(x, y, z, null); 
      rebuild();
    }
  } else if (e.button === 2) {
    // Place block: step slightly forward along the face normal into empty space
    const p = hit.point.clone().addScaledVector(hit.face.normal, 0.5);
    const x = Math.floor(p.x), y = Math.floor(p.y), z = Math.floor(p.z);
    if (!getBlock(x, y, z) && y >= 0 && y < WORLD_HEIGHT) {
      setBlock(x, y, z, getSelected()); 
      rebuild();
    }
  }
});

function rebuild() { 
  buildMeshes(scene); 
}

// Calculate total block count across all chunks for the HUD status
function getTotalBlocks() {
  let count = 0;
  for (const [, chunkBlocks] of chunks) {
    count += chunkBlocks.size;
  }
  return count;
}

let last = performance.now(), frames = 0;
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - last) / 1000, .05); 
  last = now;
  player.update(dt);
  frames++;
  if (frames % 30 === 0) {
    status.textContent = `BlockWorld v0.2 (Chunked) • Blocks: ${getTotalBlocks()}`;
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight; 
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
