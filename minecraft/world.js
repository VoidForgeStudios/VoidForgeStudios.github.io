import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.181.1/build/three.module.js";
import { BLOCKS } from "./blocks.js";

export const WORLD_SIZE = 64;
export const WORLD_HEIGHT = 24;
export const CHUNK_SIZE = 16;

export const chunks = new Map();
// Key: "cx,cz"
// Value: Map of local block coordinates -> block type

export function key(x, y, z) {
  return `${x},${y},${z}`;
}

/* =========================================================
   BLOCK ACCESS
   ========================================================= */

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

  const blockKey = key(lx, y, lz);

  if (type) {
    chunk.set(blockKey, type);
  } else {
    chunk.delete(blockKey);
  }
}

/* =========================================================
   WORLD GENERATION
   ========================================================= */

function noise(x, z) {
  const n =
    Math.sin(x * 12.9898 + z * 78.233) *
    43758.5453;

  return n - Math.floor(n);
}

function heightAt(x, z) {
  const a =
    Math.sin(x * 0.32) * 1.5 +
    Math.cos(z * 0.27) * 1.5;

  const b =
    Math.sin((x + z) * 0.12) * 2;

  return Math.max(
    1,
    Math.min(
      12,
      Math.floor(7 + a + b + noise(x, z) * 1.4)
    )
  );
}

export function generateWorld() {
  chunks.clear();

  const half = WORLD_SIZE / 2;

  for (let x = -half; x < half; x++) {
    for (let z = -half; z < half; z++) {
      const h = heightAt(x, z);

      // Terrain
      for (let y = 0; y <= h; y++) {
        let type;

        if (y === h) {
          type = "grass";
        } else if (y > h - 3) {
          type = "dirt";
        } else {
          type = "stone";
        }

        setBlock(x, y, z, type);
      }

      // Trees
      if (
        noise(x * 3, z * 7) > 0.96 &&
        h < 10 &&
        Math.abs(x) > 3 &&
        Math.abs(z) > 3
      ) {
        // Trunk
        for (let y = h + 1; y < h + 5; y++) {
          setBlock(x, y, z, "wood");
        }

        // Leaves
        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            for (let dy = 4; dy <= 5; dy++) {
              if (Math.abs(dx) + Math.abs(dz) < 3) {
                // Use grass for leaves because your current
                // blocks.js does not define a "leaves" block.
                setBlock(
                  x + dx,
                  h + dy,
                  z + dz,
                  "grass"
                );
              }
            }
          }
        }
      }
    }
  }
}

/* =========================================================
   FACE DEFINITIONS
   =========================================================

   Every face uses counter-clockwise winding when viewed
   from OUTSIDE the block.

   Coordinates are local block coordinates:

       y=1
        +-------+
       /       /|
      +-------+ |
      |       | |
      |       | +
      |       |/
      +-------+
       y=0

   ========================================================= */

const FACES = [
  // +X
  {
    dir: [1, 0, 0],
    corners: [
      [1, 0, 1],
      [1, 1, 1],
      [1, 1, 0],
      [1, 0, 0]
    ]
  },

  // -X
  {
    dir: [-1, 0, 0],
    corners: [
      [0, 0, 0],
      [0, 1, 0],
      [0, 1, 1],
      [0, 0, 1]
    ]
  },

  // +Y / TOP
  {
    dir: [0, 1, 0],
    corners: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0]
    ]
  },

  // -Y / BOTTOM
  {
    dir: [0, -1, 0],
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1]
    ]
  },

  // +Z
  {
    dir: [0, 0, 1],
    corners: [
      [0, 0, 1],
      [0, 1, 1],
      [1, 1, 1],
      [1, 0, 1]
    ]
  },

  // -Z
  {
    dir: [0, 0, -1],
    corners: [
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
      [0, 0, 0]
    ]
  }
];

/* =========================================================
   FACE COLOR
   ========================================================= */

function getFaceColor(type, dir) {
  const block = BLOCKS[type];

  if (!block) {
    return 0xffffff;
  }

  // Top
  if (dir[1] === 1 && block.top !== undefined) {
    return block.top;
  }

  // Bottom
  if (dir[1] === -1 && block.bottom !== undefined) {
    return block.bottom;
  }

  // Sides
  return block.color;
}

/* =========================================================
   BUILD ONE CHUNK
   ========================================================= */

function buildChunkMesh(scene, cx, cz, chunkBlocks) {
  const worldStartX = cx * CHUNK_SIZE;
  const worldStartZ = cz * CHUNK_SIZE;

  /*
   * Group faces by block type AND face color.
   *
   * This lets grass have:
   * - green top
   * - brown sides
   * - brown bottom
   */

  const materialGroups = new Map();

  for (const [blockKey, type] of chunkBlocks) {
    const parts = blockKey.split(",").map(Number);

    const lx = parts[0];
    const y = parts[1];
    const lz = parts[2];

    const x = worldStartX + lx;
    const z = worldStartZ + lz;

    for (const face of FACES) {
      const nx = x + face.dir[0];
      const ny = y + face.dir[1];
      const nz = z + face.dir[2];

      // Don't render faces touching another block.
      if (getBlock(nx, ny, nz)) {
        continue;
      }

      const color = getFaceColor(type, face.dir);

      const groupKey = `${type}:${color}`;

      if (!materialGroups.has(groupKey)) {
        materialGroups.set(groupKey, {
          type,
          color,
          faces: []
        });
      }

      /*
       * Store the local chunk coordinates.
       */
      const vertices = face.corners.map(c => [
        lx + c[0],
        y + c[1],
        lz + c[2]
      ]);

      materialGroups.get(groupKey).faces.push({
        vertices,
        dir: face.dir
      });
    }
  }

  /*
   * Create one mesh for each material group.
   */
  for (const group of materialGroups.values()) {
    const positions = [];
    const normals = [];
    const indices = [];

    let vertexOffset = 0;

    for (const face of group.faces) {
      /*
       * Add vertices.
       */
      for (const vertex of face.vertices) {
        positions.push(
          vertex[0],
          vertex[1],
          vertex[2]
        );

        normals.push(
          face.dir[0],
          face.dir[1],
          face.dir[2]
        );
      }

      /*
       * Correct winding.
       */
      indices.push(
        vertexOffset,
        vertexOffset + 1,
        vertexOffset + 2,

        vertexOffset,
        vertexOffset + 2,
        vertexOffset + 3
      );

      vertexOffset += 4;
    }

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        positions,
        3
      )
    );

    geometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(
        normals,
        3
      )
    );

    geometry.setIndex(indices);

    geometry.computeBoundingSphere();

    const material =
      new THREE.MeshLambertMaterial({
        color: group.color,
        side: THREE.FrontSide
      });

    const mesh = new THREE.Mesh(
      geometry,
      material
    );

    mesh.position.set(
      worldStartX,
      0,
      worldStartZ
    );

    mesh.userData.blockMesh = true;
    mesh.userData.chunkX = cx;
    mesh.userData.chunkZ = cz;

    scene.add(mesh);
  }
}

/* =========================================================
   BUILD ALL CHUNKS
   ========================================================= */

export function buildMeshes(scene) {
  /*
   * Remove old block meshes.
   */
  for (const child of [...scene.children]) {
    if (child.userData.blockMesh) {
      child.geometry?.dispose();
      child.material?.dispose();
      scene.remove(child);
    }
  }

  /*
   * Build every chunk.
   */
  for (const [chunkKey, chunkBlocks] of chunks) {
    const [cx, cz] =
      chunkKey.split(",").map(Number);

    buildChunkMesh(
      scene,
      cx,
      cz,
      chunkBlocks
    );
  }
}
