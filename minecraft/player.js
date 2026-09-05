import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.181.1/build/three.module.js";
import { getBlock } from "./world.js";

export class Player {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;

    // =========================
    // POSITION
    // =========================

    this.position = new THREE.Vector3(0.5, 15, 0.5);
    this.velocity = new THREE.Vector3();

    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;

    this.keys = {};

    // =========================
    // PLAYER DIMENSIONS
    // =========================

    this.radius = 0.3;
    this.height = 1.6;

    // =========================
    // HEALTH
    // =========================

    this.maxHealth = 20;
    this.health = 20;

    this.dead = false;
    this.invulnerable = false;

    // =========================
    // MOBILE
    // =========================

    this.mobile = {
      moveX: 0,
      moveZ: 0,

      lookId: null,
      moveId: null,

      lastLookX: 0,
      lastLookY: 0,

      jump: false,
      sprint: false
    };

    // =========================
    // SETUP
    // =========================

    this.createMobileControls();

    this.setupKeyboard();

    this.setupMouse();

    this.setupTouchLook();

    this.createHealthUI();
  }

  // ============================================================
  // KEYBOARD
  // ============================================================

  setupKeyboard() {
    window.addEventListener("keydown", e => {
      this.keys[e.code] = true;
    });

    window.addEventListener("keyup", e => {
      this.keys[e.code] = false;
    });

    window.addEventListener("blur", () => {
      this.keys = {};
    });
  }

  // ============================================================
  // MOUSE
  // ============================================================

  setupMouse() {
    this.dom.addEventListener("mousemove", e => {
      if (document.pointerLockElement !== this.dom)
        return;

      if (this.dead)
        return;

      this.yaw -= e.movementX * 0.0025;

      this.pitch -= e.movementY * 0.0025;

      this.pitch = Math.max(
        -1.5,
        Math.min(1.5, this.pitch)
      );
    });
  }

  // ============================================================
  // MOBILE CONTROLS
  // ============================================================

  createMobileControls() {
    const style = document.createElement("style");

    style.textContent = `
      #mobileControls {
        position: fixed;
        inset: 0;

        pointer-events: none;

        z-index: 9999;

        user-select: none;

        touch-action: none;
      }

      #joystick {
        position: absolute;

        left: 25px;
        bottom: 30px;

        width: 130px;
        height: 130px;

        border-radius: 50%;

        background: rgba(255,255,255,0.12);

        border: 2px solid rgba(255,255,255,0.3);

        pointer-events: auto;

        touch-action: none;
      }

      #stick {
        position: absolute;

        width: 60px;
        height: 60px;

        left: 35px;
        top: 35px;

        border-radius: 50%;

        background: rgba(255,255,255,0.35);

        border: 2px solid rgba(255,255,255,0.5);

        pointer-events: none;
      }

      .mobileButton {
        position: absolute;

        width: 70px;
        height: 70px;

        border-radius: 50%;

        background: rgba(255,255,255,0.15);

        border: 2px solid rgba(255,255,255,0.35);

        color: white;

        font-size: 25px;

        display: flex;

        align-items: center;
        justify-content: center;

        pointer-events: auto;

        touch-action: none;

        -webkit-tap-highlight-color: transparent;
      }

      #jumpButton {
        right: 30px;
        bottom: 115px;
      }

      #sprintButton {
        right: 115px;
        bottom: 30px;

        font-size: 20px;
      }

      .mobileButton:active {
        background: rgba(255,255,255,0.3);

        transform: scale(0.94);
      }

      @media (min-width: 800px) {
        #mobileControls {
          display: none;
        }
      }

      @media (max-width: 799px) {
        #mobileControls {
          display: block;
        }
      }
    `;

    document.head.appendChild(style);

    const controls = document.createElement("div");

    controls.id = "mobileControls";

    controls.innerHTML = `
      <div id="joystick">
        <div id="stick"></div>
      </div>

      <div id="jumpButton" class="mobileButton">
        ↑
      </div>

      <div id="sprintButton" class="mobileButton">
        ⚡
      </div>
    `;

    document.body.appendChild(controls);

    this.setupJoystick();

    this.setupButtons();
  }

  // ============================================================
  // JOYSTICK
  // ============================================================

  setupJoystick() {
    const joystick =
      document.getElementById("joystick");

    const stick =
      document.getElementById("stick");

    const radius = 45;

    const update = touch => {
      const rect =
        joystick.getBoundingClientRect();

      let x =
        touch.clientX -
        (rect.left + rect.width / 2);

      let y =
        touch.clientY -
        (rect.top + rect.height / 2);

      const distance =
        Math.sqrt(x * x + y * y);

      if (distance > radius) {
        x = (x / distance) * radius;

        y = (y / distance) * radius;
      }

      stick.style.transform =
        `translate(${x}px, ${y}px)`;

      this.mobile.moveX =
        x / radius;

      this.mobile.moveZ =
        y / radius;
    };

    joystick.addEventListener(
      "touchstart",
      e => {
        e.preventDefault();

        if (this.dead)
          return;

        const touch =
          e.changedTouches[0];

        this.mobile.moveId =
          touch.identifier;

        update(touch);
      },
      { passive: false }
    );

    joystick.addEventListener(
      "touchmove",
      e => {
        e.preventDefault();

        if (this.dead)
          return;

        for (const touch of e.changedTouches) {
          if (
            touch.identifier ===
            this.mobile.moveId
          ) {
            update(touch);
          }
        }
      },
      { passive: false }
    );

    const stop = e => {
      for (const touch of e.changedTouches) {
        if (
          touch.identifier ===
          this.mobile.moveId
        ) {
          this.mobile.moveId = null;

          this.mobile.moveX = 0;

          this.mobile.moveZ = 0;

          stick.style.transform =
            "translate(0,0)";
        }
      }
    };

    joystick.addEventListener(
      "touchend",
      stop
    );

    joystick.addEventListener(
      "touchcancel",
      stop
    );
  }

  // ============================================================
  // MOBILE BUTTONS
  // ============================================================

  setupButtons() {
    const jump =
      document.getElementById("jumpButton");

    const sprint =
      document.getElementById("sprintButton");

    jump.addEventListener(
      "touchstart",
      e => {
        e.preventDefault();

        if (this.dead)
          return;

        this.mobile.jump = true;
      },
      { passive: false }
    );

    jump.addEventListener(
      "touchend",
      e => {
        e.preventDefault();

        this.mobile.jump = false;
      },
      { passive: false }
    );

    jump.addEventListener(
      "touchcancel",
      () => {
        this.mobile.jump = false;
      }
    );

    sprint.addEventListener(
      "touchstart",
      e => {
        e.preventDefault();

        if (this.dead)
          return;

        this.mobile.sprint = true;
      },
      { passive: false }
    );

    sprint.addEventListener(
      "touchend",
      e => {
        e.preventDefault();

        this.mobile.sprint = false;
      },
      { passive: false }
    );

    sprint.addEventListener(
      "touchcancel",
      () => {
        this.mobile.sprint = false;
      }
    );
  }

  // ============================================================
  // MOBILE CAMERA LOOK
  // ============================================================

  setupTouchLook() {
    this.dom.addEventListener(
      "touchstart",
      e => {
        if (this.dead)
          return;

        for (const touch of e.changedTouches) {

          const target = touch.target;

          if (
            target.closest("#joystick") ||
            target.closest(".mobileButton")
          ) {
            continue;
          }

          if (this.mobile.lookId === null) {
            this.mobile.lookId =
              touch.identifier;

            this.mobile.lastLookX =
              touch.clientX;

            this.mobile.lastLookY =
              touch.clientY;
          }
        }
      },
      { passive: false }
    );

    this.dom.addEventListener(
      "touchmove",
      e => {
        e.preventDefault();

        if (this.dead)
          return;

        for (const touch of e.changedTouches) {

          if (
            touch.identifier !==
            this.mobile.lookId
          ) {
            continue;
          }

          const dx =
            touch.clientX -
            this.mobile.lastLookX;

          const dy =
            touch.clientY -
            this.mobile.lastLookY;

          this.yaw -=
            dx * 0.005;

          this.pitch -=
            dy * 0.005;

          this.pitch = Math.max(
            -1.5,
            Math.min(
              1.5,
              this.pitch
            )
          );

          this.mobile.lastLookX =
            touch.clientX;

          this.mobile.lastLookY =
            touch.clientY;
        }
      },
      { passive: false }
    );

    const stopLook = e => {
      for (const touch of e.changedTouches) {
        if (
          touch.identifier ===
          this.mobile.lookId
        ) {
          this.mobile.lookId = null;
        }
      }
    };

    this.dom.addEventListener(
      "touchend",
      stopLook
    );

    this.dom.addEventListener(
      "touchcancel",
      stopLook
    );
  }

  // ============================================================
  // HEALTH HUD
  // ============================================================

  createHealthUI() {
    const style =
      document.createElement("style");

    style.textContent = `
      #healthHUD {
        position: fixed;

        left: 50%;
        bottom: 25px;

        transform:
          translateX(-50%);

        display: flex;

        gap: 2px;

        z-index: 10000;

        pointer-events: none;

        user-select: none;

        font-size: 28px;

        line-height: 1;

        text-shadow:
          2px 2px 0 #000,
          -1px -1px 0 #000;
      }

      .heart {
        width: 28px;

        text-align: center;

        display: inline-block;

        transition:
          opacity 0.15s;
      }

      @media (max-width: 799px) {
        #healthHUD {
          bottom: 165px;

          font-size: 23px;
        }

        .heart {
          width: 23px;
        }
      }
    `;

    document.head.appendChild(style);

    const hud =
      document.createElement("div");

    hud.id = "healthHUD";

    for (let i = 0; i < 10; i++) {
      const heart =
        document.createElement("span");

      heart.className = "heart";

      heart.textContent = "♥";

      hud.appendChild(heart);
    }

    document.body.appendChild(hud);

    this.healthHUD = hud;

    this.updateHealthUI();
  }

  // ============================================================
  // UPDATE HEARTS
  // ============================================================

  updateHealthUI() {
    if (!this.healthHUD)
      return;

    const hearts =
      this.healthHUD.querySelectorAll(
        ".heart"
      );

    const fullHearts =
      Math.floor(
        this.health / 2
      );

    const halfHeart =
      this.health % 2;

    hearts.forEach(
      (heart, index) => {

        if (index < fullHearts) {

          heart.textContent = "♥";

          heart.style.opacity = "1";

        } else if (
          index === fullHearts &&
          halfHeart
        ) {

          heart.textContent = "♥";

          heart.style.opacity = "0.5";

        } else {

          heart.textContent = "♡";

          heart.style.opacity = "0.5";
        }
      }
    );
  }

  // ============================================================
  // DAMAGE
  // ============================================================

  damage(amount) {
    if (
      this.dead ||
      this.invulnerable
    ) {
      return;
    }

    amount =
      Number(amount) || 0;

    amount =
      Math.max(0, amount);

    this.health =
      Math.max(
        0,
        this.health - amount
      );

    this.updateHealthUI();

    // Damage protection
    this.invulnerable = true;

    setTimeout(() => {
      this.invulnerable = false;
    }, 500);

    console.log(
      `Player took ${amount} damage. Health: ${this.health}/${this.maxHealth}`
    );

    if (this.health <= 0) {
      this.die();
    }
  }

  // ============================================================
  // HEAL
  // ============================================================

  heal(amount) {
    if (this.dead)
      return;

    amount =
      Number(amount) || 0;

    amount =
      Math.max(0, amount);

    this.health =
      Math.min(
        this.maxHealth,
        this.health + amount
      );

    this.updateHealthUI();

    console.log(
      `Player healed. Health: ${this.health}/${this.maxHealth}`
    );
  }

  // ============================================================
  // SET HEALTH
  // ============================================================

  setHealth(amount) {
    if (this.dead)
      return;

    amount =
      Number(amount) || 0;

    this.health =
      Math.max(
        0,
        Math.min(
          this.maxHealth,
          amount
        )
      );

    this.updateHealthUI();

    if (this.health <= 0) {
      this.die();
    }
  }

  // ============================================================
  // DEATH
  // ============================================================

  die() {
    if (this.dead)
      return;

    this.dead = true;

    this.health = 0;

    this.velocity.set(
      0,
      0,
      0
    );

    this.mobile.moveX = 0;
    this.mobile.moveZ = 0;

    this.mobile.jump = false;
    this.mobile.sprint = false;

    this.updateHealthUI();

    console.log("Player died");

    // Optional death event
    if (typeof this.onDeath === "function") {
      this.onDeath();
    }
  }

  // ============================================================
  // RESPAWN
  // ============================================================

  respawn(x = 0.5, y = 15, z = 0.5) {
    this.position.set(
      x,
      y,
      z
    );

    this.velocity.set(
      0,
      0,
      0
    );

    this.health =
      this.maxHealth;

    this.dead = false;

    this.invulnerable = false;

    this.onGround = false;

    this.mobile.moveX = 0;
    this.mobile.moveZ = 0;

    this.mobile.jump = false;
    this.mobile.sprint = false;

    this.updateHealthUI();

    console.log("Player respawned");
  }

  // ============================================================
  // COLLISION
  // ============================================================

  checkCollision(pos) {
    const eps = 0.001;

    const minX =
      Math.floor(
        pos.x -
        this.radius +
        eps
      );

    const maxX =
      Math.floor(
        pos.x +
        this.radius -
        eps
      );

    const minY =
      Math.floor(
        pos.y + eps
      );

    const maxY =
      Math.floor(
        pos.y +
        this.height -
        eps
      );

    const minZ =
      Math.floor(
        pos.z -
        this.radius +
        eps
      );

    const maxZ =
      Math.floor(
        pos.z +
        this.radius -
        eps
      );

    for (
      let x = minX;
      x <= maxX;
      x++
    ) {
      for (
        let y = minY;
        y <= maxY;
        y++
      ) {
        for (
          let z = minZ;
          z <= maxZ;
          z++
        ) {

          if (y < 0)
            return true;

          const block =
            getBlock(
              x,
              y,
              z
            );

          if (block)
            return true;
        }
      }
    }

    return false;
  }

  // ============================================================
  // UPDATE
  // ============================================================

  update(dt) {

    // Don't move after death
    if (this.dead) {

      this.velocity.set(
        0,
        0,
        0
      );

      return;
    }

    // Prevent huge physics jumps
    dt =
      Math.min(
        dt,
        0.1
      );

    // ========================================================
    // SPEED
    // ========================================================

    const speed =
      this.keys.ShiftLeft ||
      this.mobile.sprint
        ? 7
        : 5;

    // ========================================================
    // MOVEMENT INPUT
    // ========================================================

    let moveX =
      (this.keys.KeyD ? 1 : 0) -
      (this.keys.KeyA ? 1 : 0);

    let moveZ =
      (this.keys.KeyS ? 1 : 0) -
      (this.keys.KeyW ? 1 : 0);

    // Mobile joystick overrides
    // keyboard when joystick is active

    if (
      this.mobile.moveX !== 0 ||
      this.mobile.moveZ !== 0
    ) {
      moveX =
        this.mobile.moveX;

      moveZ =
        this.mobile.moveZ;
    }

    // ========================================================
    // DIRECTION
    // ========================================================

    const dir =
      new THREE.Vector3(
        moveX,
        0,
        moveZ
      );

    if (dir.lengthSq() > 0) {

      dir
        .normalize()
        .applyAxisAngle(
          new THREE.Vector3(
            0,
            1,
            0
          ),
          this.yaw
        );
    }

    // ========================================================
    // HORIZONTAL VELOCITY
    // ========================================================

    this.velocity.x =
      dir.x * speed;

    this.velocity.z =
      dir.z * speed;

    // ========================================================
    // GRAVITY
    // ========================================================

    this.velocity.y -=
      25 * dt;

    // ========================================================
    // JUMP
    // ========================================================

    if (
      (
        this.keys.Space ||
        this.mobile.jump
      ) &&
      this.onGround
    ) {

      this.velocity.y =
        8.5;

      this.onGround =
        false;
    }

    // ========================================================
    // X COLLISION
    // ========================================================

    this.position.x +=
      this.velocity.x * dt;

    if (
      this.checkCollision(
        this.position
      )
    ) {

      this.position.x -=
        this.velocity.x * dt;

      this.velocity.x = 0;
    }

    // ========================================================
    // Z COLLISION
    // ========================================================

    this.position.z +=
      this.velocity.z * dt;

    if (
      this.checkCollision(
        this.position
      )
    ) {

      this.position.z -=
        this.velocity.z * dt;

      this.velocity.z = 0;
    }

    // ========================================================
    // Y COLLISION
    // ========================================================

    this.position.y +=
      this.velocity.y * dt;

    this.onGround = false;

    if (
      this.checkCollision(
        this.position
      )
    ) {

      this.position.y -=
        this.velocity.y * dt;

      if (
        this.velocity.y < 0
      ) {
        this.onGround = true;
      }

      this.velocity.y = 0;
    }

    // ========================================================
    // CAMERA
    // ========================================================

    this.camera.position.copy(
      this.position
    );

    this.camera.position.y +=
      this.height - 0.2;

    this.camera.rotation.order =
      "YXZ";

    this.camera.rotation.y =
      this.yaw;

    this.camera.rotation.x =
      this.pitch;
  }
}
