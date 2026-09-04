import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.181.1/build/three.module.js";
import { getBlock } from "./world.js";

export class Player {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.position = new THREE.Vector3(0.5, 15, 0.5); // Centered in block
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.keys = {};

    // Player dimensions
    this.radius = 0.3;
    this.height = 1.6;

    window.addEventListener("keydown", e => { this.keys[e.code] = true; });
    window.addEventListener("keyup", e => { this.keys[e.code] = false; });
    
    dom.addEventListener("mousemove", e => {
      if (document.pointerLockElement !== dom) return;
      this.yaw -= e.movementX * 0.0025;
      this.pitch -= e.movementY * 0.0025;
      this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));
    });
  }

  checkCollision(pos) {
    const eps = 0.001;
    const minX = Math.floor(pos.x - this.radius + eps);
    const maxX = Math.floor(pos.x + this.radius - eps);
    const minY = Math.floor(pos.y + eps);
    const maxY = Math.floor(pos.y + this.height - eps);
    const minZ = Math.floor(pos.z - this.radius + eps);
    const maxZ = Math.floor(pos.z + this.radius - eps);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (y < 0) return true; // World floor
          if (getBlock(x, y, z)) return true;
        }
      }
    }
    return false;
  }

  update(dt) {
    // Cap dt to prevent massive jumps during lag spikes
    dt = Math.min(dt, 0.1);

    const speed = this.keys.ShiftLeft ? 7 : 5;
    const dir = new THREE.Vector3(
      (this.keys.KeyD ? 1 : 0) - (this.keys.KeyA ? 1 : 0), 0,
      (this.keys.KeyS ? 1 : 0) - (this.keys.KeyW ? 1 : 0)
    );
    
    if (dir.lengthSq()) dir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    
    this.velocity.x = dir.x * speed;
    this.velocity.z = dir.z * speed;
    this.velocity.y -= 25 * dt; // Gravity

    if (this.keys.Space && this.onGround) {
      this.velocity.y = 8.5;
      this.onGround = false;
    }

    // --- Axis-Separated Collision Resolution ---

    // 1. Move X
    this.position.x += this.velocity.x * dt;
    if (this.checkCollision(this.position)) {
      this.position.x -= this.velocity.x * dt;
      this.velocity.x = 0;
    }

    // 2. Move Z
    this.position.z += this.velocity.z * dt;
    if (this.checkCollision(this.position)) {
      this.position.z -= this.velocity.z * dt;
      this.velocity.z = 0;
    }

    // 3. Move Y
    this.position.y += this.velocity.y * dt;
    this.onGround = false;
    if (this.checkCollision(this.position)) {
      this.position.y -= this.velocity.y * dt;
      if (this.velocity.y < 0) {
        this.onGround = true;
      }
      this.velocity.y = 0;
    }

    // Update camera position and look angles
    this.camera.position.copy(this.position);
    this.camera.position.y += this.height - 0.2; // Eye level offset
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }
}
