import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.181.1/build/three.module.js";
import { BLOCKS } from "./blocks.js";

export const WORLD_SIZE = 64;
export const WORLD_HEIGHT = 24;
export const CHUNK_SIZE = 16;
export const chunks = new Map(); // Key: "cx,cz", Value: Map of local blocks

export function key(x, y, z) { return `${x},${y},${z}`; }

export function getBlock(x, y, z) {
  if (y < 0 || y >= WORLD_HEIGHT) return undefined;
  const cx = Math.floor(x / CHUNK_SIZE);
  const cz = Math.floor(z / CHUNK_SIZE);
  const chunk = chunks.get(`${cx},${cz}`);
  if (!chunk) return undefined;
  
  const lx = x - cx * CHUNK_SIZE;
  const lz = z - cz * CHUNK_SIZE;
  return chunk.get(key(lx, y, lz));
}

export function setBlock(x, y, z, type) {
  if (y < 0 || y >= WORLD_HEIGHT) return;
  const cx = Math.floor(x / CHUNK_SIZE);
  const cz = Math.floor(z / CHUNK_SIZE);
  const chunkKey = `${cx},${cz}`;
  
  if (!chunks.has(chunkKey)) {
    if (!type) return;
    chunks.set(chunkKey, new Map());
  }
  
  const chunk = chunks.get(chunkKey);
  const lx = x - cx * CHUNK_SIZE;
  const lz = z - cz * CHUNK_SIZE;
  const k = key(lx, y, lz);
  
  if (type) chunk.set(k, type);
  else chunk.delete(k);
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
  chunks.clear();
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

const FACES = [
  { dir: [1, 0, 0], corners: [[0,1,1],[0,1,0],[0,0,0],[0,0,1]] },
  { dir: [-1, 0, 0], corners: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]] },
  { dir: [0, 1, 0], corners: [[0,1,0],[1,1,0],[1,0,0],[0,0,0]] },
  { dir: [0, -1, 0], corners: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]] },
  { dir: [0, 0, 1], corners: [[0,1,0],[0,0,0],[1,0,0],[1,1,0]] },
  { dir: [0, 0, -1], corners: [[1,1,1],[1,0,1],[0,0,1],[0,1,1]] }
];

export function buildMeshes(scene) {
  // Clear old meshes
  for (const child of [...scene.children]) {
    if (child.userData.blockMesh) scene.remove(child);
  }

  // Loop through individual chunks instead of processing everything globally
  for (const [chunkKey, chunkBlocks] of chunks) {
    const [cx, cz] = chunkKey.split(",").map(Number);
    const worldStartX = cx * CHUNK_SIZE;
    const worldStartZ = cz * CHUNK_SIZE;

    const materialGroups = {};

    for (const [k, type] of chunkBlocks) {
      const [lx, y, lz] = k.split(",").map(Number);
      const x = worldStartX + lx;
      const z = worldStartZ + lz;

      FACES.forEach((f) => {
        const nx = x + f.dir[0];
        const ny = y + f.dir[1];
        const nz = z + f.dir[2];

        // Check global neighbor (handles cross-chunk boundaries perfectly)
        if (!getBlock(nx, ny, nz)) {
          if (!materialGroups[type]) materialGroups[type] = [];
          const vertices = f.corners.map(c => [lx + c[0], y + c[1], lz + c[2]]);
          materialGroups[type].push({ vertices, dir: f.dir });
        }
      });
    }

    // Build one mesh per material per chunk
    for (const [type, faces] of Object.entries(materialGroups)) {
      const positions = [];
      const normals = [];
      const indices = [];
      let indexOffset = 0;

      faces.forEach(face => {
        face.vertices.forEach(v => positions.push(...v));
        for (let i = 0; i < 4; i++) normals.push(...face.dir);

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
      // Position the chunk mesh precisely in world space
      mesh.position.set(worldStartX, 0, worldStartZ);
      mesh.userData.blockMesh = true;
      scene.add(mesh);
    }
  }
}
