import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.181.1/build/three.module.js";
import { getBlock } from "./world.js";

export class Player {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.position = new THREE.Vector3(0.5, 15, 0.5);
    this.velocity = new THREE.Vector3();

    this.width = 0.6;
    this.height = 1.8;
    this.eyeHeight = 1.62;

    this.speed = 5;
    this.sprintSpeed = 8;
    this.jumpStrength = 8;

    this.gravity = -22;
    this.onGround = false;

    this.yaw = 0;
    this.pitch = 0;

    this.keys = new Set();
    this.locked = false;

    this.health = 100;
    this.stamina = 100;

    this.setupKeyboard();
    this.setupMouse();

    this.updateCamera();
  }

  setupKeyboard() {
    window.addEventListener("keydown", e => {
      this.keys.add(e.code);

      if (
        ["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ShiftLeft", "ShiftRight"]
          .includes(e.code)
      ) {
        e.preventDefault();
      }
    });

    window.addEventListener("keyup", e => {
      this.keys.delete(e.code);
    });
  }

  setupMouse() {
    this.domElement.addEventListener("click", () => {
      if (document.pointerLockElement !== this.domElement) {
        this.domElement.requestPointerLock();
      }
    });

    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === this.domElement;
    });

    document.addEventListener("mousemove", e => {
      if (!this.locked) return;

      const sensitivity = 0.002;

      this.yaw -= e.movementX * sensitivity;
      this.pitch -= e.movementY * sensitivity;

      const limit = Math.PI / 2 - 0.01;
      this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
    });
  }

  isSolid(x, y, z) {
    if (y < 0) return true;

    return Boolean(getBlock(
      Math.floor(x),
      Math.floor(y),
      Math.floor(z)
    ));
  }

  collidesAt(position) {
    const minX = position.x - this.width / 2;
    const maxX = position.x + this.width / 2;

    const minY = position.y;
    const maxY = position.y + this.height;

    const minZ = position.z - this.width / 2;
    const maxZ = position.z + this.width / 2;

    const startX = Math.floor(minX);
    const endX = Math.floor(maxX - 0.001);

    const startY = Math.floor(minY);
    const endY = Math.floor(maxY - 0.001);

    const startZ = Math.floor(minZ);
    const endZ = Math.floor(maxZ - 0.001);

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        for (let z = startZ; z <= endZ; z++) {
          if (this.isSolid(x, y, z)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  moveAxis(axis, amount) {
    if (amount === 0) return;

    const next = this.position.clone();
    next[axis] += amount;

    if (!this.collidesAt(next)) {
      this.position[axis] = next[axis];
      return;
    }

    const steps = Math.max(1, Math.ceil(Math.abs(amount) / 0.05));
    const step = amount / steps;

    for (let i = 0; i < steps; i++) {
      const test = this.position.clone();
      test[axis] += step;

      if (this.collidesAt(test)) {
        if (axis === "y") {
          if (amount < 0) {
            this.onGround = true;
          }

          this.velocity.y = 0;
        }

        break;
      }

      this.position[axis] = test[axis];
    }
  }

  updateMovement(dt) {
    const forward = new THREE.Vector3(
      -Math.sin(this.yaw),
      0,
      -Math.cos(this.yaw)
    );

    const right = new THREE.Vector3(
      Math.cos(this.yaw),
      0,
      -Math.sin(this.yaw)
    );

    const direction = new THREE.Vector3();

    if (this.keys.has("KeyW")) {
      direction.add(forward);
    }

    if (this.keys.has("KeyS")) {
      direction.sub(forward);
    }

    if (this.keys.has("KeyD")) {
      direction.add(right);
    }

    if (this.keys.has("KeyA")) {
      direction.sub(right);
    }

    if (direction.lengthSq() > 0) {
      direction.normalize();
    }

    const sprinting =
      (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight")) &&
      direction.lengthSq() > 0 &&
      this.stamina > 0;

    const speed = sprinting ? this.sprintSpeed : this.speed;

    if (sprinting) {
      this.stamina = Math.max(0, this.stamina - 25 * dt);
    } else {
      this.stamina = Math.min(100, this.stamina + 15 * dt);
    }

    const targetX = direction.x * speed;
    const targetZ = direction.z * speed;

    const acceleration = this.onGround ? 14 : 7;

    this.velocity.x = THREE.MathUtils.damp(
      this.velocity.x,
      targetX,
      acceleration,
      dt
    );

    this.velocity.z = THREE.MathUtils.damp(
      this.velocity.z,
      targetZ,
      acceleration,
      dt
    );
  }

  updateJump() {
    if (this.keys.has("Space") && this.onGround) {
      this.velocity.y = this.jumpStrength;
      this.onGround = false;
    }
  }

  updateCamera() {
    this.camera.position.set(
      this.position.x,
      this.position.y + this.eyeHeight,
      this.position.z
    );

    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  damage(amount) {
    this.health = Math.max(0, this.health - amount);

    if (this.health <= 0) {
      this.respawn();
    }
  }

  respawn() {
    this.position.set(0.5, 15, 0.5);
    this.velocity.set(0, 0, 0);
    this.health = 100;
    this.stamina = 100;
  }

  update(dt) {
    this.updateMovement(dt);
    this.updateJump();

    this.velocity.y += this.gravity * dt;

    this.onGround = false;

    this.moveAxis("x", this.velocity.x * dt);
    this.moveAxis("z", this.velocity.z * dt);
    this.moveAxis("y", this.velocity.y * dt);

    if (this.position.y < -20) {
      this.respawn();
    }

    this.updateCamera();
  }
}
