import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.181.1/build/three.module.js";
import { getBlock } from "./world.js";

export class Player {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;

    // ============================================================
    // POSITION / PHYSICS
    // ============================================================

    this.position = new THREE.Vector3(0.5, 15, 0.5);
    this.velocity = new THREE.Vector3();

    this.yaw = 0;
    this.pitch = 0;

    this.onGround = false;
    this.wasOnGround = false;

    this.keys = {};

    // ============================================================
    // PLAYER DIMENSIONS
    // ============================================================

    this.radius = 0.30;

    this.standHeight = 1.60;
    this.crouchHeight = 1.15;

    this.height = this.standHeight;

    this.crouching = false;

    // ============================================================
    // MOVEMENT
    // ============================================================

    this.walkSpeed = 5;
    this.sprintSpeed = 7;

    this.acceleration = 35;
    this.airAcceleration = 12;

    this.friction = 28;
    this.airFriction = 2;

    this.jumpVelocity = 8.5;

    // ============================================================
    // GRAVITY
    // ============================================================

    this.gravity = 25;

    // ============================================================
    // WATER
    // ============================================================

    this.inWater = false;
    this.waterSurface = false;

    this.waterGravity = 8;
    this.waterAcceleration = 12;
    this.waterSpeed = 3.2;
    this.waterJumpVelocity = 5.5;

    // ============================================================
    // FALL DAMAGE
    // ============================================================

    this.fallStartY = 0;
    this.fallDistance = 0;

    this.fallDamageStart = 3;
    this.fallDamageMultiplier = 2;

    // ============================================================
    // HEALTH
    // ============================================================

    this.maxHealth = 20;
    this.health = 20;

    this.dead = false;
    this.invulnerable = false;

    // ============================================================
    // SPRINT / STAMINA
    // ============================================================

    this.maxStamina = 100;
    this.stamina = this.maxStamina;

    this.staminaDrain = 22;
    this.staminaRegen = 18;

    this.canSprint = true;
    this.isSprinting = false;

    // ============================================================
    // KNOCKBACK
    // ============================================================

    this.knockbackVelocity = new THREE.Vector3();

    // ============================================================
    // HEAD BOB
    // ============================================================

    this.bobTime = 0;
    this.bobAmount = 0;
    this.bobTarget = 0;

    this.cameraBobX = 0;
    this.cameraBobY = 0;

    // ============================================================
    // MOBILE
    // ============================================================

    this.mobile = {
      moveX: 0,
      moveZ: 0,

      lookId: null,
      moveId: null,

      lastLookX: 0,
      lastLookY: 0,

      jumpPressed: false,
      jumpHeld: false,

      sprintPressed: false,
      sprintHeld: false,

      crouchPressed: false,
      crouchHeld: false
    };

    // ============================================================
    // INPUT
    // ============================================================

    this.jumpRequested = false;

    // ============================================================
    // SETUP
    // ============================================================

    this.createMobileControls();
    this.setupKeyboard();
    this.setupMouse();
    this.setupTouchLook();

    this.createHealthUI();
    this.createStaminaUI();
    this.createDamageEffects();

    // Make sure camera starts correctly.
    this.updateCamera(0);
  }

  // ============================================================
  // KEYBOARD
  // ============================================================

  setupKeyboard() {
    window.addEventListener("keydown", e => {
      this.keys[e.code] = true;

      // Jump only when key is initially pressed.
      if (
        e.code === "Space" &&
        !e.repeat
      ) {
        this.jumpRequested = true;
      }
    });

    window.addEventListener("keyup", e => {
      this.keys[e.code] = false;
    });

    window.addEventListener("blur", () => {
      this.keys = {};

      this.mobile.jumpHeld = false;
      this.mobile.sprintHeld = false;
      this.mobile.crouchHeld = false;

      this.mobile.moveX = 0;
      this.mobile.moveZ = 0;

      this.jumpRequested = false;
    });
  }

  // ============================================================
  // MOUSE LOOK
  // ============================================================

  setupMouse() {
    this.dom.addEventListener("mousemove", e => {
      if (
        document.pointerLockElement !==
        this.dom
      ) {
        return;
      }

      if (this.dead)
        return;

      this.yaw -=
        e.movementX * 0.0025;

      this.pitch -=
        e.movementY * 0.0025;

      this.pitch = THREE.MathUtils.clamp(
        this.pitch,
        -1.5,
        1.5
      );
    });
  }

  // ============================================================
  // MOBILE CONTROLS
  // ============================================================

  createMobileControls() {
    const style =
      document.createElement("style");

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

        background: rgba(255,255,255,0.10);

        border:
          2px solid
          rgba(255,255,255,0.30);

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

        background:
          rgba(255,255,255,0.35);

        border:
          2px solid
          rgba(255,255,255,0.5);

        pointer-events: none;

        transition:
          transform 0.04s linear;
      }

      .mobileButton {
        position: absolute;

        width: 70px;
        height: 70px;

        border-radius: 50%;

        background:
          rgba(255,255,255,0.13);

        border:
          2px solid
          rgba(255,255,255,0.35);

        color: white;

        font-size: 25px;

        display: flex;

        align-items: center;
        justify-content: center;

        pointer-events: auto;

        touch-action: none;

        -webkit-tap-highlight-color:
          transparent;

        box-sizing: border-box;

        transition:
          transform 0.08s,
          background 0.08s;
      }

      .mobileButton:active {
        background:
          rgba(255,255,255,0.32);

        transform:
          scale(0.92);
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

      #crouchButton {
        right: 30px;
        bottom: 30px;

        font-size: 20px;
      }

      #staminaHUD {
        position: fixed;

        left: 50%;
        transform: translateX(-50%);

        bottom: 58px;

        width: 220px;
        height: 8px;

        background: rgba(0,0,0,0.45);

        border:
          1px solid
          rgba(255,255,255,0.25);

        border-radius: 5px;

        overflow: hidden;

        z-index: 10001;

        pointer-events: none;
      }

      #staminaFill {
        width: 100%;
        height: 100%;

        background:
          linear-gradient(
            90deg,
            #36d65c,
            #9cff3b
          );

        transform-origin: left center;
      }

      #damageOverlay {
        position: fixed;
        inset: 0;

        background:
          radial-gradient(
            circle,
            transparent 35%,
            rgba(255,0,0,0.65)
          );

        opacity: 0;

        z-index: 10000;

        pointer-events: none;

        transition:
          opacity 0.08s ease-out;
      }

      @media (max-width: 799px) {
        #mobileControls {
          display: block;
        }

        #staminaHUD {
          bottom: 126px;
          width: 170px;
        }
      }

      @media (min-width: 800px) {
        #mobileControls {
          display: none;
        }
      }
    `;

    document.head.appendChild(style);

    const controls =
      document.createElement("div");

    controls.id = "mobileControls";

    controls.innerHTML = `
      <div id="joystick">
        <div id="stick"></div>
      </div>

      <div
        id="jumpButton"
        class="mobileButton"
      >
        ↑
      </div>

      <div
        id="sprintButton"
        class="mobileButton"
      >
        ⚡
      </div>

      <div
        id="crouchButton"
        class="mobileButton"
      >
        ▼
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
      document.getElementById(
        "joystick"
      );

    const stick =
      document.getElementById(
        "stick"
      );

    const radius = 45;

    const update = touch => {
      const rect =
        joystick.getBoundingClientRect();

      let x =
        touch.clientX -
        (rect.left +
          rect.width / 2);

      let y =
        touch.clientY -
        (rect.top +
          rect.height / 2);

      const distance =
        Math.sqrt(
          x * x +
          y * y
        );

      if (
        distance > radius
      ) {
        x =
          (x / distance) *
          radius;

        y =
          (y / distance) *
          radius;
      }

      stick.style.transform =
        `translate(${x}px, ${y}px)`;

      this.mobile.moveX =
        THREE.MathUtils.clamp(
          x / radius,
          -1,
          1
        );

      this.mobile.moveZ =
        THREE.MathUtils.clamp(
          y / radius,
          -1,
          1
        );
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

        for (
          const touch of
          e.changedTouches
        ) {
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
      for (
        const touch of
        e.changedTouches
      ) {
        if (
          touch.identifier ===
          this.mobile.moveId
        ) {
          this.mobile.moveId =
            null;

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
      document.getElementById(
        "jumpButton"
      );

    const sprint =
      document.getElementById(
        "sprintButton"
      );

    const crouch =
      document.getElementById(
        "crouchButton"
      );

    // ----------------------------------------------------------
    // JUMP
    // ----------------------------------------------------------

    jump.addEventListener(
      "touchstart",
      e => {
        e.preventDefault();

        if (this.dead)
          return;

        // Only request jump once.
        if (
          !this.mobile.jumpHeld
        ) {
          this.jumpRequested =
            true;
        }

        this.mobile.jumpHeld =
          true;
      },
      { passive: false }
    );

    jump.addEventListener(
      "touchend",
      e => {
        e.preventDefault();

        this.mobile.jumpHeld =
          false;
      },
      { passive: false }
    );

    jump.addEventListener(
      "touchcancel",
      () => {
        this.mobile.jumpHeld =
          false;
      }
    );

    // ----------------------------------------------------------
    // SPRINT
    // ----------------------------------------------------------

    sprint.addEventListener(
      "touchstart",
      e => {
        e.preventDefault();

        if (this.dead)
          return;

        this.mobile.sprintHeld =
          true;
      },
      { passive: false }
    );

    sprint.addEventListener(
      "touchend",
      e => {
        e.preventDefault();

        this.mobile.sprintHeld =
          false;
      },
      { passive: false }
    );

    sprint.addEventListener(
      "touchcancel",
      () => {
        this.mobile.sprintHeld =
          false;
      }
    );

    // ----------------------------------------------------------
    // CROUCH
    // ----------------------------------------------------------

    crouch.addEventListener(
      "touchstart",
      e => {
        e.preventDefault();

        if (this.dead)
          return;

        this.mobile.crouchHeld =
          true;
      },
      { passive: false }
    );

    crouch.addEventListener(
      "touchend",
      e => {
        e.preventDefault();

        this.mobile.crouchHeld =
          false;
      },
      { passive: false }
    );

    crouch.addEventListener(
      "touchcancel",
      () => {
        this.mobile.crouchHeld =
          false;
      }
    );
  }

  // ============================================================
  // TOUCH CAMERA
  // ============================================================

  setupTouchLook() {
    this.dom.addEventListener(
      "touchstart",
      e => {
        if (this.dead)
          return;

        for (
          const touch of
          e.changedTouches
        ) {
          const target =
            touch.target;

          if (
            target.closest(
              "#joystick"
            ) ||
            target.closest(
              ".mobileButton"
            )
          ) {
            continue;
          }

          if (
            this.mobile.lookId ===
            null
          ) {
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

        for (
          const touch of
          e.changedTouches
        ) {
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

          // Improved touch sensitivity.
          this.yaw -=
            dx * 0.0038;

          this.pitch -=
            dy * 0.0038;

          this.pitch =
            THREE.MathUtils.clamp(
              this.pitch,
              -1.5,
              1.5
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
      for (
        const touch of
        e.changedTouches
      ) {
        if (
          touch.identifier ===
          this.mobile.lookId
        ) {
          this.mobile.lookId =
            null;
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
  // HEALTH UI
  // ============================================================

  createHealthUI() {
    const style =
      document.createElement(
        "style"
      );

    style.textContent = `
      #healthHUD {
        position: fixed;

        left: 50%;
        bottom: 78px;

        transform:
          translateX(-50%);

        display: flex;

        align-items: center;
        justify-content: center;

        gap: 1px;

        width: max-content;

        height: 30px;

        z-index: 10001;

        pointer-events: none;

        user-select: none;
      }

      .heart {
        width: 28px;
        height: 28px;

        display: flex;

        align-items: center;
        justify-content: center;

        font-family: Arial, sans-serif;

        font-size: 27px;

        line-height: 28px;

        text-align: center;

        box-sizing: border-box;

        text-shadow:
          2px 2px 0 #000,
          -1px -1px 0 #000;

        transition:
          transform 0.12s,
          opacity 0.12s;
      }

      .heart.hit {
        transform:
          scale(1.35);

        filter:
          brightness(1.5);
      }

      @media (max-width: 799px) {
        #healthHUD {
          bottom: 145px;
          height: 25px;
        }

        .heart {
          width: 23px;
          height: 23px;

          font-size: 22px;
          line-height: 23px;
        }
      }
    `;

    document.head.appendChild(style);

    const hud =
      document.createElement(
        "div"
      );

    hud.id = "healthHUD";

    for (
      let i = 0;
      i < 10;
      i++
    ) {
      const heart =
        document.createElement(
          "span"
        );

      heart.className =
        "heart";

      heart.textContent = "♥";

      hud.appendChild(heart);
    }

    document.body.appendChild(hud);

    this.healthHUD = hud;

    this.updateHealthUI();
  }

  // ============================================================
  // STAMINA UI
  // ============================================================

  createStaminaUI() {
    const hud =
      document.createElement(
        "div"
      );

    hud.id = "staminaHUD";

    hud.innerHTML = `
      <div id="staminaFill"></div>
    `;

    document.body.appendChild(hud);

    this.staminaHUD = hud;

    this.staminaFill =
      document.getElementById(
        "staminaFill"
      );

    this.updateStaminaUI();
  }

  updateStaminaUI() {
    if (!this.staminaFill)
      return;

    const percent =
      THREE.MathUtils.clamp(
        this.stamina /
          this.maxStamina,
        0,
        1
      );

    this.staminaFill.style.width =
      `${percent * 100}%`;

    if (percent < 0.2) {
      this.staminaFill.style.background =
        "#ff3b30";
    } else if (percent < 0.5) {
      this.staminaFill.style.background =
        "#ffd60a";
    } else {
      this.staminaFill.style.background =
        "#42e65a";
    }
  }

  // ============================================================
  // DAMAGE EFFECTS
  // ============================================================

  createDamageEffects() {
    const overlay =
      document.createElement(
        "div"
      );

    overlay.id =
      "damageOverlay";

    document.body.appendChild(
      overlay
    );

    this.damageOverlay =
      overlay;

    // Simple generated hurt sound.
    // No external audio file required.
    this.audioContext = null;
  }

  playHurtSound() {
    try {
      if (!this.audioContext) {
        this.audioContext =
          new (
            window.AudioContext ||
            window.webkitAudioContext
          )();
      }

      const ctx =
        this.audioContext;

      const oscillator =
        ctx.createOscillator();

      const gain =
        ctx.createGain();

      oscillator.type =
        "sawtooth";

      oscillator.frequency
        .setValueAtTime(
          120,
          ctx.currentTime
        );

      oscillator.frequency
        .exponentialRampToValueAtTime(
          55,
          ctx.currentTime + 0.15
        );

      gain.gain.setValueAtTime(
        0.12,
        ctx.currentTime
      );

      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + 0.15
      );

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.start();

      oscillator.stop(
        ctx.currentTime + 0.15
      );
    } catch (err) {
      // Audio may be blocked until user interaction.
    }
  }

  showDamageEffect() {
    if (!this.damageOverlay)
      return;

    this.damageOverlay.style.opacity =
      "1";

    clearTimeout(
      this.damageEffectTimer
    );

    this.damageEffectTimer =
      setTimeout(() => {
        this.damageOverlay.style.opacity =
          "0";
      }, 120);

    // Heart animation.
    if (this.healthHUD) {
      const hearts =
        this.healthHUD.querySelectorAll(
          ".heart"
        );

      hearts.forEach(heart => {
        heart.classList.remove(
          "hit"
        );

        void heart.offsetWidth;

        heart.classList.add(
          "hit"
        );

        setTimeout(() => {
          heart.classList.remove(
            "hit"
          );
        }, 150);
      });
    }

    this.playHurtSound();
  }

  // ============================================================
  // UPDATE HEALTH
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
        if (
          index <
          fullHearts
        ) {
          heart.textContent =
            "♥";

          heart.style.opacity =
            "1";
        } else if (
          index ===
            fullHearts &&
          halfHeart
        ) {
          heart.textContent =
            "♥";

          heart.style.opacity =
            "0.5";
        } else {
          heart.textContent =
            "♡";

          heart.style.opacity =
            "0.45";
        }
      }
    );
  }

  // ============================================================
  // DAMAGE
  // ============================================================

  damage(
    amount,
    sourcePosition = null,
    knockbackStrength = 5
  ) {
    if (
      this.dead ||
      this.invulnerable
    ) {
      return;
    }

    amount =
      Number(amount) || 0;

    amount =
      Math.max(
        0,
        amount
      );

    if (
      amount <= 0
    ) {
      return;
    }

    this.health =
      Math.max(
        0,
        this.health - amount
      );

    this.updateHealthUI();

    this.showDamageEffect();

    // ----------------------------------------------------------
    // KNOCKBACK
    // ----------------------------------------------------------

    if (
      sourcePosition
    ) {
      const direction =
        new THREE.Vector3()
          .subVectors(
            this.position,
            sourcePosition
          );

      direction.y = 0;

      if (
        direction.lengthSq() <
        0.0001
      ) {
        direction.set(
          0,
          0,
          1
        );
      }

      direction.normalize();

      this.knockbackVelocity
        .addScaledVector(
          direction,
          knockbackStrength
        );

      this.knockbackVelocity.y =
        Math.max(
          this.knockbackVelocity.y,
          3
        );
    }

    this.invulnerable =
      true;

    clearTimeout(
      this.invulnerabilityTimer
    );

    this.invulnerabilityTimer =
      setTimeout(() => {
        this.invulnerable =
          false;
      }, 500);

    console.log(
      `Player took ${amount} damage. ` +
      `Health: ${this.health}/${this.maxHealth}`
    );

    if (
      this.health <= 0
    ) {
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
      Math.max(
        0,
        amount
      );

    this.health =
      Math.min(
        this.maxHealth,
        this.health + amount
      );

    this.updateHealthUI();
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
      THREE.MathUtils.clamp(
        amount,
        0,
        this.maxHealth
      );

    this.updateHealthUI();

    if (
      this.health <= 0
    ) {
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

    this.knockbackVelocity.set(
      0,
      0,
      0
    );

    this.mobile.moveX = 0;
    this.mobile.moveZ = 0;

    this.mobile.jumpHeld = false;
    this.mobile.sprintHeld = false;
    this.mobile.crouchHeld = false;

    this.updateHealthUI();

    console.log(
      "Player died"
    );

    if (
      typeof this.onDeath ===
      "function"
    ) {
      this.onDeath();
    }
  }

  // ============================================================
  // RESPAWN
  // ============================================================

  respawn(
    x = 0.5,
    y = 15,
    z = 0.5
  ) {
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

    this.knockbackVelocity.set(
      0,
      0,
      0
    );

    this.health =
      this.maxHealth;

    this.stamina =
      this.maxStamina;

    this.dead = false;

    this.invulnerable =
      false;

    this.onGround = false;

    this.fallDistance = 0;

    this.crouching = false;

    this.height =
      this.standHeight;

    this.mobile.moveX = 0;
    this.mobile.moveZ = 0;

    this.mobile.jumpHeld =
      false;

    this.mobile.sprintHeld =
      false;

    this.mobile.crouchHeld =
      false;

    this.jumpRequested =
      false;

    this.updateHealthUI();
    this.updateStaminaUI();

    console.log(
      "Player respawned"
    );
  }

  // ============================================================
  // BLOCK COLLISION
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
        pos.y +
        eps
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

          if (
            block &&
            !this.isWaterBlock(
              block
            )
          ) {
            return true;
          }
        }
      }
    }

    return false;
  }

  // ============================================================
  // WATER CHECK
  // ============================================================

  isWaterBlock(block) {
    if (!block)
      return false;

    if (
      block === "water" ||
      block === "WATER"
    ) {
      return true;
    }

    if (
      typeof block ===
      "object"
    ) {
      const type =
        String(
          block.type ??
          block.name ??
          block.id ??
          ""
        ).toLowerCase();

      return (
        type === "water" ||
        type.includes("water")
      );
    }

    return false;
  }

  isPointInWater(
    x,
    y,
    z
  ) {
    const block =
      getBlock(
        Math.floor(x),
        Math.floor(y),
        Math.floor(z)
      );

    return this.isWaterBlock(
      block
    );
  }

  updateWaterState() {
    const feetWater =
      this.isPointInWater(
        this.position.x,
        this.position.y + 0.1,
        this.position.z
      );

    const bodyWater =
      this.isPointInWater(
        this.position.x,
        this.position.y +
          this.height * 0.55,
        this.position.z
      );

    const headWater =
      this.isPointInWater(
        this.position.x,
        this.position.y +
          this.height -
          0.1,
        this.position.z
      );

    this.inWater =
      feetWater ||
      bodyWater;

    this.waterSurface =
      bodyWater &&
      !headWater;
  }

  // ============================================================
  // CROUCH
  // ============================================================

  updateCrouch() {
    const wantsCrouch =
      this.keys.ControlLeft ||
      this.keys.ControlRight ||
      this.mobile.crouchHeld;

    if (
      wantsCrouch &&
      !this.crouching
    ) {
      this.crouching =
        true;

      this.height =
        this.crouchHeight;

      return;
    }

    if (
      !wantsCrouch &&
      this.crouching
    ) {
      // Don't stand if there isn't enough
      // room above the player.
      const oldHeight =
        this.height;

      this.height =
        this.standHeight;

      if (
        this.checkCollision(
          this.position
        )
      ) {
        this.height =
          oldHeight;
      } else {
        this.crouching =
          false;
      }
    }
  }

  // ============================================================
  // MOVEMENT INPUT
  // ============================================================

  getMovementInput() {
    let moveX =
      (this.keys.KeyD ? 1 : 0) -
      (this.keys.KeyA ? 1 : 0);

    let moveZ =
      (this.keys.KeyS ? 1 : 0) -
      (this.keys.KeyW ? 1 : 0);

    if (
      this.mobile.moveX !== 0 ||
      this.mobile.moveZ !== 0
    ) {
      moveX =
        this.mobile.moveX;

      moveZ =
        this.mobile.moveZ;
    }

    const input =
      new THREE.Vector3(
        moveX,
        0,
        moveZ
      );

    // Prevent faster diagonal movement.
    if (
      input.lengthSq() > 1
    ) {
      input.normalize();
    }

    return input;
  }

  // ============================================================
  // SPRINT
  // ============================================================

  updateSprint(
    dt,
    input
  ) {
    const keyboardSprint =
      this.keys.ShiftLeft ||
      this.keys.ShiftRight;

    const mobileSprint =
      this.mobile.sprintHeld;

    const wantsSprint =
      keyboardSprint ||
      mobileSprint;

    const moving =
      input.lengthSq() >
      0.05;

    this.isSprinting =
      wantsSprint &&
      moving &&
      this.onGround &&
      !this.crouching &&
      !this.inWater &&
      this.stamina > 0;

    if (
      this.isSprinting
    ) {
      this.stamina -=
        this.staminaDrain *
        dt;

      if (
        this.stamina <= 0
      ) {
        this.stamina = 0;
        this.canSprint = false;
      }
    } else {
      this.stamina +=
        this.staminaRegen *
        dt;

      if (
        this.stamina >=
        this.maxStamina
      ) {
        this.stamina =
          this.maxStamina;

        this.canSprint = true;
      }

      // Allow sprint again once there is
      // enough stamina.
      if (
        this.stamina > 10
      ) {
        this.canSprint = true;
      }
    }

    this.stamina =
      THREE.MathUtils.clamp(
        this.stamina,
        0,
        this.maxStamina
      );

    this.updateStaminaUI();
  }

  // ============================================================
  // HORIZONTAL MOVEMENT
  // ============================================================

  updateHorizontalMovement(
    dt,
    input
  ) {
    let speed;

    if (this.inWater) {
      speed =
        this.waterSpeed;
    } else if (
      this.crouching
    ) {
      speed =
        this.walkSpeed * 0.45;
    } else if (
      this.isSprinting
    ) {
      speed =
        this.sprintSpeed;
    } else {
      speed =
        this.walkSpeed;
    }

    const direction =
      input.clone();

    if (
      direction.lengthSq() >
      0
    ) {
      direction
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

    const targetX =
      direction.x * speed;

    const targetZ =
      direction.z * speed;

    const acceleration =
      this.inWater
        ? this.waterAcceleration
        : this.onGround
          ? this.acceleration
          : this.airAcceleration;

    if (
      input.lengthSq() > 0
    ) {
      this.velocity.x =
        THREE.MathUtils.damp(
          this.velocity.x,
          targetX,
          acceleration,
          dt
        );

      this.velocity.z =
        THREE.MathUtils.damp(
          this.velocity.z,
          targetZ,
          acceleration,
          dt
        );
    } else {
      const friction =
        this.inWater
          ? 5
          : this.onGround
            ? this.friction
            : this.airFriction;

      this.velocity.x =
        THREE.MathUtils.damp(
          this.velocity.x,
          0,
          friction,
          dt
        );

      this.velocity.z =
        THREE.MathUtils.damp(
          this.velocity.z,
          0,
          friction,
          dt
        );
    }
  }

  // ============================================================
  // JUMP
  // ============================================================

  updateJump() {
    if (
      !this.jumpRequested
    ) {
      return;
    }

    this.jumpRequested =
      false;

    if (this.dead)
      return;

    if (this.inWater) {
      this.velocity.y =
        this.waterJumpVelocity;

      return;
    }

    if (this.onGround) {
      this.velocity.y =
        this.jumpVelocity;

      this.onGround =
        false;

      this.fallDistance = 0;
    }
  }

  // ============================================================
  // GRAVITY
  // ============================================================

  updateVerticalPhysics(dt) {
    if (this.inWater) {
      this.velocity.y -=
        this.waterGravity *
        dt;

      // Swimming upward when jump is held.
      if (
        this.mobile.jumpHeld ||
        this.keys.Space
      ) {
        this.velocity.y =
          THREE.MathUtils.damp(
            this.velocity.y,
            2.5,
            8,
            dt
          );
      }

      // Don't let water movement become too fast.
      this.velocity.y =
        THREE.MathUtils.clamp(
          this.velocity.y,
          -3,
          3
        );

      return;
    }

    this.velocity.y -=
      this.gravity * dt;
  }

  // ============================================================
  // KNOCKBACK
  // ============================================================

  updateKnockback(dt) {
    if (
      this.knockbackVelocity.lengthSq()
      <= 0.001
    ) {
      return;
    }

    this.position.x +=
      this.knockbackVelocity.x *
      dt;

    if (
      this.checkCollision(
        this.position
      )
    ) {
      this.position.x -=
        this.knockbackVelocity.x *
        dt;

      this.knockbackVelocity.x =
        0;
    }

    this.position.z +=
      this.knockbackVelocity.z *
      dt;

    if (
      this.checkCollision(
        this.position
      )
    ) {
      this.position.z -=
        this.knockbackVelocity.z *
        dt;

      this.knockbackVelocity.z =
        0;
    }

    this.position.y +=
      this.knockbackVelocity.y *
      dt;

    if (
      this.checkCollision(
        this.position
      )
    ) {
      this.position.y -=
        this.knockbackVelocity.y *
        dt;

      this.knockbackVelocity.y =
        0;
    }

    this.knockbackVelocity.multiplyScalar(
      Math.exp(-8 * dt)
    );
  }

  // ============================================================
  // X COLLISION
  // ============================================================

  moveX(amount) {
    if (
      amount === 0
    ) {
      return;
    }

    this.position.x +=
      amount;

    if (
      this.checkCollision(
        this.position
      )
    ) {
      this.position.x -=
        amount;

      this.velocity.x = 0;
    }
  }

  // ============================================================
  // Z COLLISION
  // ============================================================

  moveZ(amount) {
    if (
      amount === 0
    ) {
      return;
    }

    this.position.z +=
      amount;

    if (
      this.checkCollision(
        this.position
      )
    ) {
      this.position.z -=
        amount;

      this.velocity.z = 0;
    }
  }

  // ============================================================
  // Y COLLISION
  // ============================================================

  moveY(amount) {
    if (
      amount === 0
    ) {
      return;
    }

    const oldY =
      this.position.y;

    this.position.y +=
      amount;

    if (
      this.checkCollision(
        this.position
      )
    ) {
      this.position.y =
        oldY;

      if (
        amount < 0
      ) {
        this.onGround =
          true;
      }

      this.velocity.y =
        0;
    }
  }

  // ============================================================
  // FALL DAMAGE
  // ============================================================

  updateFallDamage() {
    // Started falling.
    if (
      !this.onGround &&
      this.velocity.y < 0
    ) {
      if (
        this.fallDistance <= 0
      ) {
        this.fallStartY =
          this.position.y;
      }

      this.fallDistance =
        Math.max(
          this.fallDistance,
          this.fallStartY -
            this.position.y
        );
    }

    // Landed.
    if (
      this.onGround &&
      !this.wasOnGround
    ) {
      if (
        !this.inWater &&
        this.fallDistance >
          this.fallDamageStart
      ) {
        const damage =
          Math.floor(
            (
              this.fallDistance -
              this.fallDamageStart
            ) *
            this.fallDamageMultiplier
          );

        if (
          damage > 0
        ) {
          this.damage(
            damage
          );
        }
      }

      this.fallDistance =
        0;
    }

    this.wasOnGround =
      this.onGround;
  }

  // ============================================================
  // HEAD BOB
  // ============================================================

  updateHeadBob(
    dt,
    input
  ) {
    const horizontalSpeed =
      Math.sqrt(
        this.velocity.x *
          this.velocity.x +
        this.velocity.z *
          this.velocity.z
      );

    const moving =
      this.onGround &&
      input.lengthSq() > 0.01 &&
      horizontalSpeed > 0.2;

    const target =
      moving
        ? this.isSprinting
          ? 1
          : 0.65
        : 0;

    this.bobAmount =
      THREE.MathUtils.damp(
        this.bobAmount,
        target,
        10,
        dt
      );

    if (
      this.bobAmount >
      0.01
    ) {
      const frequency =
        this.isSprinting
          ? 12
          : 9;

      this.bobTime +=
        dt * frequency;

      this.cameraBobX =
        Math.cos(
          this.bobTime
        ) *
        0.025 *
        this.bobAmount;

      this.cameraBobY =
        Math.abs(
          Math.sin(
            this.bobTime
          )
        ) *
        0.045 *
        this.bobAmount;
    } else {
      this.cameraBobX =
        THREE.MathUtils.damp(
          this.cameraBobX,
          0,
          10,
          dt
        );

      this.cameraBobY =
        THREE.MathUtils.damp(
          this.cameraBobY,
          0,
          10,
          dt
        );
    }
  }

  // ============================================================
  // CAMERA
  // ============================================================

  updateCamera(dt) {
    const targetEyeHeight =
      this.height -
      0.2;

    let cameraY =
      this.position.y +
      targetEyeHeight;

    // Crouch camera smoothing.
    if (
      dt > 0
    ) {
      const desired =
        this.position.y +
        targetEyeHeight;

      this.camera.position.y =
        THREE.MathUtils.damp(
          this.camera.position.y,
          desired +
            this.cameraBobY,
          15,
          dt
        );
    } else {
      this.camera.position.y =
        cameraY;
    }

    this.camera.position.x =
      this.position.x +
      this.cameraBobX;

    this.camera.position.z =
      this.position.z;

    this.camera.rotation.order =
      "YXZ";

    this.camera.rotation.y =
      this.yaw;

    this.camera.rotation.x =
      this.pitch;
  }

  // ============================================================
  // MAIN UPDATE
  // ============================================================

  update(dt) {
    if (this.dead) {
      this.velocity.set(
        0,
        0,
        0
      );

      this.updateCamera(dt);

      return;
    }

    // Prevent huge physics jumps.
    dt =
      Math.min(
        dt,
        0.05
      );

    // ----------------------------------------------------------
    // WATER
    // ----------------------------------------------------------

    this.updateWaterState();

    // ----------------------------------------------------------
    // CROUCH
    // ----------------------------------------------------------

    this.updateCrouch();

    // ----------------------------------------------------------
    // INPUT
    // ----------------------------------------------------------

    const input =
      this.getMovementInput();

    // ----------------------------------------------------------
    // SPRINT
    // ----------------------------------------------------------

    this.updateSprint(
      dt,
      input
    );

    // ----------------------------------------------------------
    // HORIZONTAL MOVEMENT
    // ----------------------------------------------------------

    this.updateHorizontalMovement(
      dt,
      input
    );

    // ----------------------------------------------------------
    // JUMP
    // ----------------------------------------------------------

    this.updateJump();

    // ----------------------------------------------------------
    // GRAVITY
    // ----------------------------------------------------------

    this.updateVerticalPhysics(
      dt
    );

    // ----------------------------------------------------------
    // KNOCKBACK
    // ----------------------------------------------------------

    this.updateKnockback(
      dt
    );

    // ----------------------------------------------------------
    // X
    // ----------------------------------------------------------

    this.moveX(
      this.velocity.x * dt
    );

    // ----------------------------------------------------------
    // Z
    // ----------------------------------------------------------

    this.moveZ(
      this.velocity.z * dt
    );

    // ----------------------------------------------------------
    // Y
    // ----------------------------------------------------------

    this.onGround =
      false;

    this.moveY(
      this.velocity.y * dt
    );

    // ----------------------------------------------------------
    // FALL DAMAGE
    // ----------------------------------------------------------

    this.updateFallDamage();

    // ----------------------------------------------------------
    // WATER STATE AGAIN
    // ----------------------------------------------------------

    this.updateWaterState();

    // ----------------------------------------------------------
    // HEAD BOB
    // ----------------------------------------------------------

    this.updateHeadBob(
      dt,
      input
    );

    // ----------------------------------------------------------
    // CAMERA
    // ----------------------------------------------------------

    this.updateCamera(
      dt
    );
  }
}
