import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.181.1/build/three.module.js";
import { BLOCKS } from "./blocks.js";

export const WORLD_SIZE = 64; // Can scale much higher now!
export const WORLD_HEIGHT = 24;
export const blocks = new Map();

export function key(x, y, z) { return `${x},${y},${z}`; }
export function getBlock(x, y, z) { return blocks.get(key(x, y, z)); }
export function setBlock(x, y, z, type) {
  if (y < 0 || y >= WORLD_HEIGHT) return;
  const k = key(x, y, z);
  if (type) blocks.set(k, type); else blocks.delete(k);
}

function noise(x, z) {
  const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function heightAt(x, z) {
  const a = Math.sin(x * .32) * 1.5 + Math.cos(z * .27) * 1.5;
  const b = Math.sin((x + z) * .12) * 2;
  return Math.max(1, Math.min(12, Math.floor(7 + a + b + noise(x, z) * 1.4)));
}

export function generateWorld() {
  blocks.clear();
  const half = WORLD_SIZE / 2;
  for (let x = -half; x < half; x++) {
    for (let z = -half; z < half; z++) {
      const h = heightAt(x, z);
      for (let y = 0; y <= h; y++) {
        let type = y === h ? "grass" : y > h - 3 ? "dirt" : "stone";
        setBlock(x, y, z, type);
      }
      if (noise(x * 3, z * 7) > 0.96 && h < 10 && Math.abs(x) > 3 && Math.abs(z) > 3) {
        for (let y = h + 1; y < h + 5; y++) setBlock(x, y, z, "wood");
        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            for (let dy = 4; dy <= 5; dy++) {
              if (Math.abs(dx) + Math.abs(dz) < 3) setBlock(x + dx, h + dy, z + dz, "grass");
            }
          }
        }
      }
    }
  }
}

// Face definitions with directional normals and offsets for greedy culling
const FACES = [
  { dir: [1, 0, 0], corners: [[0,1,1],[0,1,0],[0,0,0],[0,0,1]] },   // Right
  { dir: [-1, 0, 0], corners: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]] }, // Left
  { dir: [0, 1, 0], corners: [[0,1,0],[1,1,0],[1,0,0],[0,0,0]] },   // Top
  { dir: [0, -1, 0], corners: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]] }, // Bottom
  { dir: [0, 0, 1], corners: [[0,1,0],[0,0,0],[1,0,0],[1,1,0]] },   // Front
  { dir: [0, 0, -1], corners: [[1,1,1],[1,0,1],[0,0,1],[0,1,1]] }  // Back
];

export function buildMeshes(scene) {
  // Clear old optimized meshes
  for (const child of [...scene.children]) {
    if (child.userData.blockMesh) scene.remove(child);
  }

  // Group geometries by material type
  const materialGroups = {};

  for (const [k, type] of blocks) {
    const [x, y, z] = k.split(",").map(Number);

    // Check all 6 directions; only render a face if the adjacent block is empty (Face Culling)
    FACES.forEach((f, faceIndex) => {
      const nx = x + f.dir[0];
      const ny = y + f.dir[1];
      const nz = z + f.dir[2];

      if (!getBlock(nx, ny, nz)) {
        if (!materialGroups[type]) materialGroups[type] = [];

        // Build face vertices relative to block position
        const vertices = f.corners.map(c => [x + c[0], y + c[1], z + c[2]]);
        materialGroups[type].push(vertices);
      }
    });
  }

  // Generate merged BufferGeometries per block type
  for (const [type, faces] of Object.entries(materialGroups)) {
    const positions = [];
    const normals = [];
    const indices = [];
    let indexOffset = 0;

    faces.forEach(face => {
      // Each face has 4 vertices, forming 2 triangles
      face.forEach(v => positions.push(...v));
      
      // Calculate normal based on face direction
      const [dx, dy, dz] = FACES[faces.indexOf(face) % 6].dir; // Simplified lookup
      // Push placeholder normal data (or exact face normal)
      for(let i=0; i<4; i++) normals.push(dx, dy, dz);

      indices.push(
        indexOffset, indexOffset + 1, indexOffset + 2,
        indexOffset, indexOffset + 2, indexOffset + 3
      );
      indexOffset += 4;
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setIndex(indices);

    const d = BLOCKS[type];
    const material = new THREE.MeshLambertMaterial({ color: d.top || d.color });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.blockMesh = true;
    scene.add(mesh);
  }
}
