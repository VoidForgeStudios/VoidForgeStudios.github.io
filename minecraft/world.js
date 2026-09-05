import { BLOCKS } from "./blocks.js";

export const WORLD_SIZE = 64;
export const WORLD_HEIGHT = 24;
export const CHUNK_SIZE = 16;

export const chunks = new Map();

/* =========================================================
   COORDINATE HELPERS
   ========================================================= */

export function key(x, y, z) {
  return `${x},${y},${z}`;
}

export function chunkKey(cx, cz) {
  return `${cx},${cz}`;
}

export function getChunkCoords(x, z) {
  const cx = Math.floor(x / CHUNK_SIZE);
  const cz = Math.floor(z / CHUNK_SIZE);

  return { cx, cz };
}

export function getLocalCoords(x, z) {
  const cx = Math.floor(x / CHUNK_SIZE);
  const cz = Math.floor(z / CHUNK_SIZE);

  return {
    lx: x - cx * CHUNK_SIZE,
    lz: z - cz * CHUNK_SIZE
  };
}


/* =========================================================
   WORLD BOUNDS
   ========================================================= */

export function inWorld(x, y, z) {
  return (
    x >= 0 &&
    x < WORLD_SIZE &&
    z >= 0 &&
    z < WORLD_SIZE &&
    y >= 0 &&
    y < WORLD_HEIGHT
  );
}


/* =========================================================
   CHUNK CREATION
   ========================================================= */

export function createChunk(cx, cz) {

  const id = chunkKey(cx, cz);

  if (chunks.has(id)) {
    return chunks.get(id);
  }

  const chunk = new Map();

  chunks.set(id, chunk);

  return chunk;
}


/* =========================================================
   GET BLOCK
   ========================================================= */

export function getBlock(x, y, z) {

  if (!inWorld(x, y, z)) {
    return undefined;
  }

  const {
    cx,
    cz
  } = getChunkCoords(x, z);

  const chunk = chunks.get(
    chunkKey(cx, cz)
  );

  if (!chunk) {
    return undefined;
  }

  const {
    lx,
    lz
  } = getLocalCoords(x, z);

  return chunk.get(
    key(lx, y, lz)
  );
}


/* =========================================================
   SET BLOCK
   ========================================================= */

export function setBlock(x, y, z, block) {

  if (!inWorld(x, y, z)) {
    return false;
  }

  const {
    cx,
    cz
  } = getChunkCoords(x, z);

  const chunk = createChunk(cx, cz);

  const {
    lx,
    lz
  } = getLocalCoords(x, z);

  const blockKey = key(lx, y, lz);

  if (
    block === undefined ||
    block === null ||
    block === 0
  ) {
    chunk.delete(blockKey);
  } else {
    chunk.set(blockKey, block);
  }

  return true;
}


/* =========================================================
   REMOVE BLOCK
   ========================================================= */

export function removeBlock(x, y, z) {

  if (!inWorld(x, y, z)) {
    return false;
  }

  const {
    cx,
    cz
  } = getChunkCoords(x, z);

  const chunk = chunks.get(
    chunkKey(cx, cz)
  );

  if (!chunk) {
    return false;
  }

  const {
    lx,
    lz
  } = getLocalCoords(x, z);

  return chunk.delete(
    key(lx, y, lz)
  );
}


/* =========================================================
   CHECK SOLID BLOCK
   ========================================================= */

export function isSolid(x, y, z) {

  const block = getBlock(x, y, z);

  if (!block) {
    return false;
  }

  /*
   * If your BLOCKS definitions contain
   * a "solid" property, use it.
   */
  if (
    typeof block === "object" &&
    "solid" in block
  ) {
    return block.solid;
  }

  return true;
}


/* =========================================================
   CHUNK BLOCK COUNT
   ========================================================= */

export function getChunkBlockCount(cx, cz) {

  const chunk = chunks.get(
    chunkKey(cx, cz)
  );

  if (!chunk) {
    return 0;
  }

  return chunk.size;
}


/* =========================================================
   CLEAR CHUNK
   ========================================================= */

export function clearChunk(cx, cz) {

  const id = chunkKey(cx, cz);

  if (!chunks.has(id)) {
    return false;
  }

  chunks.delete(id);

  return true;
}


/* =========================================================
   CLEAR ENTIRE WORLD
   ========================================================= */

export function clearWorld() {

  chunks.clear();

}


/* =========================================================
   WORLD INFORMATION
   ========================================================= */

export function getWorldInfo() {

  return {
    size: WORLD_SIZE,
    height: WORLD_HEIGHT,
    chunkSize: CHUNK_SIZE,
    chunks: chunks.size
  };

}
