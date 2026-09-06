"use strict";

const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const PORT = Number(process.env.PORT) || 3000;

const app = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  transports: ["websocket", "polling"],
  pingInterval: 5000,
  pingTimeout: 10000,
  perMessageDeflate: true
});

app.use(express.static(__dirname));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    players: game.players.size,
    bots: game.bots.size,
    tick: game.tickCount,
    uptime: process.uptime()
  });
});

const CONFIG = Object.freeze({
  WIDTH: 80,
  HEIGHT: 50,

  TICK_RATE: 60,
  LOG_INTERVAL: 5000,

  START_LENGTH: 5,
  MAX_PLAYERS: 32,
  BOT_COUNT: 4,

  BASE_MOVE_INTERVAL: 110,
  MIN_MOVE_INTERVAL: 55,

  FOOD_COUNT: 5,
  POWERUP_COUNT: 3,

  INPUT_BUFFER_SIZE: 2,
  POWERUP_DURATION: 6000,

  SNAPSHOT_INTERVAL: 50,

  MAX_USERNAME_LENGTH: 16
});

const DIRECTIONS = Object.freeze({
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
});

const OPPOSITE = Object.freeze({
  up: "down",
  down: "up",
  left: "right",
  right: "left"
});

const POWER_TYPES = ["speed", "reverse", "multiplier"];

function cellKey(x, y) {
  return `${x},${y}`;
}

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function validDirection(direction) {
  return Object.prototype.hasOwnProperty.call(DIRECTIONS, direction);
}

function sanitizeUsername(name) {
  return String(name || "Player")
    .replace(/[^\p{L}\p{N}_\- ]/gu, "")
    .trim()
    .slice(0, CONFIG.MAX_USERNAME_LENGTH) || "Player";
}

function distance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

class Snake {
  constructor({
    id,
    username,
    x,
    y,
    direction = "right",
    bot = false
  }) {
    this.id = id;
    this.username = username;
    this.bot = bot;

    this.body = [];

    for (let i = 0; i < CONFIG.START_LENGTH; i++) {
      this.body.push({
        x: x - DIRECTIONS[direction].x * i,
        y: y - DIRECTIONS[direction].y * i
      });
    }

    this.direction = direction;
    this.inputBuffer = [];

    this.alive = true;
    this.score = 0;

    this.growthPending = 0;

    this.moveAccumulator = 0;

    this.effects = {
      speed: 0,
      reverse: 0,
      multiplier: 0
    };

    this.lastInputAt = 0;

    this.aiCooldown = 0;
  }

  get head() {
    return this.body[0];
  }

  get moveInterval() {
    const growthSpeed = Math.max(
      0.55,
      1 - Math.max(0, this.body.length - CONFIG.START_LENGTH) * 0.012
    );

    const speedPowerup = this.effects.speed > 0 ? 0.55 : 1;

    return Math.max(
      CONFIG.MIN_MOVE_INTERVAL,
      CONFIG.BASE_MOVE_INTERVAL * growthSpeed * speedPowerup
    );
  }

  queueDirection(direction) {
    if (!validDirection(direction)) return;

    const effectiveDirection =
      this.effects.reverse > 0
        ? OPPOSITE[direction]
        : direction;

    const last =
      this.inputBuffer.length > 0
        ? this.inputBuffer[this.inputBuffer.length - 1]
        : this.direction;

    if (OPPOSITE[last] === effectiveDirection) {
      return;
    }

    if (effectiveDirection === last) {
      return;
    }

    if (this.inputBuffer.length >= CONFIG.INPUT_BUFFER_SIZE) {
      return;
    }

    this.inputBuffer.push(effectiveDirection);
  }

  consumeDirection() {
    if (this.inputBuffer.length === 0) {
      return;
    }

    const next = this.inputBuffer.shift();

    if (OPPOSITE[this.direction] !== next) {
      this.direction = next;
    }
  }

  updateEffects(dt) {
    for (const type of POWER_TYPES) {
      if (this.effects[type] > 0) {
        this.effects[type] = Math.max(
          0,
          this.effects[type] - dt
        );
      }
    }
  }

  grow(amount = 1) {
    this.growthPending += amount;
  }

  move() {
    this.consumeDirection();

    const direction = DIRECTIONS[this.direction];

    const next = {
      x: this.head.x + direction.x,
      y: this.head.y + direction.y
    };

    this.body.unshift(next);

    if (this.growthPending > 0) {
      this.growthPending--;
    } else {
      this.body.pop();
    }
  }

  die() {
    this.alive = false;
  }
}

class SnakeGame {
  constructor() {
    this.players = new Map();
    this.bots = new Map();

    this.food = new Map();
    this.powerups = new Map();

    this.tickCount = 0;

    this.lastTick = performanceNow();
    this.lastSnapshot = 0;
    this.lastLog = 0;

    this.nextEntityId = 1;

    this.previousSnapshot = null;

    this.spawnInitialWorld();
  }

  generateId(prefix) {
    return `${prefix}_${this.nextEntityId++}`;
  }

  isInside(x, y) {
    return (
      x >= 0 &&
      y >= 0 &&
      x < CONFIG.WIDTH &&
      y < CONFIG.HEIGHT
    );
  }

  getAllSnakes() {
    return [
      ...this.players.values(),
      ...this.bots.values()
    ];
  }

  getOccupiedCells({
    includeHeads = true,
    exclude = null
  } = {}) {
    const occupied = new Set();

    for (const snake of this.getAllSnakes()) {
      if (!snake.alive || snake === exclude) continue;

      const start = includeHeads ? 0 : 1;

      for (let i = start; i < snake.body.length; i++) {
        const p = snake.body[i];
        occupied.add(cellKey(p.x, p.y));
      }
    }

    return occupied;
  }

  randomFreeCell() {
    const occupied = this.getOccupiedCells();

    for (let attempt = 0; attempt < 1000; attempt++) {
      const x = randomInt(CONFIG.WIDTH);
      const y = randomInt(CONFIG.HEIGHT);
      const key = cellKey(x, y);

      if (
        !occupied.has(key) &&
        !this.food.has(key) &&
        !this.powerups.has(key)
      ) {
        return { x, y };
      }
    }

    return null;
  }

  spawnFood() {
    const position = this.randomFreeCell();

    if (!position) return;

    const id = this.generateId("food");

    this.food.set(cellKey(position.x, position.y), {
      id,
      x: position.x,
      y: position.y
    });
  }

  spawnPowerup() {
    const position = this.randomFreeCell();

    if (!position) return;

    const id = this.generateId("power");

    this.powerups.set(cellKey(position.x, position.y), {
      id,
      x: position.x,
      y: position.y,
      type: POWER_TYPES[randomInt(POWER_TYPES.length)]
    });
  }

  spawnInitialWorld() {
    for (let i = 0; i < CONFIG.FOOD_COUNT; i++) {
      this.spawnFood();
    }

    for (let i = 0; i < CONFIG.POWERUP_COUNT; i++) {
      this.spawnPowerup();
    }
  }

  findSpawnPoint() {
    for (let attempt = 0; attempt < 1000; attempt++) {
      const x = 4 + randomInt(CONFIG.WIDTH - 8);
      const y = 4 + randomInt(CONFIG.HEIGHT - 8);

      let clear = true;

      for (const snake of this.getAllSnakes()) {
        if (!snake.alive) continue;

        if (distance({ x, y }, snake.head) < 8) {
          clear = false;
          break;
        }
      }

      if (clear) {
        return { x, y };
      }
    }

    return {
      x: Math.floor(CONFIG.WIDTH / 2),
      y: Math.floor(CONFIG.HEIGHT / 2)
    };
  }

  addPlayer(socket, username) {
    if (this.players.size >= CONFIG.MAX_PLAYERS) {
      return null;
    }

    const spawn = this.findSpawnPoint();

    const snake = new Snake({
      id: socket.id,
      username,
      x: spawn.x,
      y: spawn.y,
      direction: ["up", "down", "left", "right"][randomInt(4)]
    });

    this.players.set(socket.id, snake);

    return snake;
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
  }

  createBots() {
    while (this.bots.size < CONFIG.BOT_COUNT) {
      const spawn = this.findSpawnPoint();

      const id = this.generateId("bot");

      const bot = new Snake({
        id,
        username: `BOT ${this.bots.size + 1}`,
        x: spawn.x,
        y: spawn.y,
        direction: ["up", "down", "left", "right"][randomInt(4)],
        bot: true
      });

      this.bots.set(id, bot);
    }
  }

  resetDeadBots() {
    for (const [id, bot] of this.bots) {
      if (!bot.alive) {
        const spawn = this.findSpawnPoint();

        const replacement = new Snake({
          id,
          username: bot.username,
          x: spawn.x,
          y: spawn.y,
          direction: ["up", "down", "left", "right"][randomInt(4)],
          bot: true
        });

        this.bots.set(id, replacement);
      }
    }
  }

  chooseBotDirection(bot) {
    const target = this.findNearestFood(bot);

    if (!target) return;

    const path = this.findPath(bot, target);

    if (path && path.length > 0) {
      bot.queueDirection(path[0]);
      return;
    }

    // Fallback greedy movement if BFS cannot reach food.
    const options = ["up", "down", "left", "right"]
      .filter(direction => {
        if (OPPOSITE[bot.direction] === direction) {
          return false;
        }

        const d = DIRECTIONS[direction];

        const x = bot.head.x + d.x;
        const y = bot.head.y + d.y;

        return this.isSafeCell(bot, x, y);
      })
      .sort((a, b) => {
        const da = DIRECTIONS[a];
        const db = DIRECTIONS[b];

        const pa = {
          x: bot.head.x + da.x,
          y: bot.head.y + da.y
        };

        const pb = {
          x: bot.head.x + db.x,
          y: bot.head.y + db.y
        };

        return distance(pa, target) - distance(pb, target);
      });

    if (options[0]) {
      bot.queueDirection(options[0]);
    }
  }

  findNearestFood(bot) {
    let closest = null;
    let closestDistance = Infinity;

    for (const food of this.food.values()) {
      const d = distance(bot.head, food);

      if (d < closestDistance) {
        closestDistance = d;
        closest = food;
      }
    }

    return closest;
  }

  isSafeCell(bot, x, y) {
    if (!this.isInside(x, y)) return false;

    const occupied = this.getOccupiedCells({
      includeHeads: true,
      exclude: bot
    });

    return !occupied.has(cellKey(x, y));
  }

  findPath(bot, target) {
    const startKey = cellKey(bot.head.x, bot.head.y);
    const goalKey = cellKey(target.x, target.y);

    if (startKey === goalKey) {
      return [];
    }

    const occupied = this.getOccupiedCells({
      includeHeads: true,
      exclude: bot
    });

    const queue = [{ x: bot.head.x, y: bot.head.y }];

    const visited = new Set([startKey]);
    const previous = new Map();

    const directions = [
      ["up", DIRECTIONS.up],
      ["down", DIRECTIONS.down],
      ["left", DIRECTIONS.left],
      ["right", DIRECTIONS.right]
    ];

    let cursor = 0;

    while (cursor < queue.length) {
      const current = queue[cursor++];

      for (const [direction, delta] of directions) {
        const next = {
          x: current.x + delta.x,
          y: current.y + delta.y
        };

        if (!this.isInside(next.x, next.y)) {
          continue;
        }

        const nextKey = cellKey(next.x, next.y);

        if (visited.has(nextKey)) {
          continue;
        }

        if (
          occupied.has(nextKey) &&
          nextKey !== goalKey
        ) {
          continue;
        }

        visited.add(nextKey);

        previous.set(nextKey, {
          key: cellKey(current.x, current.y),
          direction
        });

        if (nextKey === goalKey) {
          return this.reconstructPath(
            previous,
            startKey,
            goalKey
          );
        }

        queue.push(next);
      }
    }

    return null;
  }

  reconstructPath(previous, startKey, goalKey) {
    const path = [];

    let current = goalKey;

    while (current !== startKey) {
      const step = previous.get(current);

      if (!step) {
        return null;
      }

      path.push(step.direction);
      current = step.key;
    }

    path.reverse();

    return path;
  }

  updateBots(dt) {
    for (const bot of this.bots.values()) {
      if (!bot.alive) continue;

      bot.aiCooldown -= dt;

      if (bot.aiCooldown <= 0) {
        this.chooseBotDirection(bot);

        // Avoid running BFS every frame.
        bot.aiCooldown = 120;
      }
    }
  }

  moveSnakes(dt) {
    for (const snake of this.getAllSnakes()) {
      if (!snake.alive) continue;

      snake.moveAccumulator += dt;

      const interval = snake.moveInterval;

      // Catch up if server frame was delayed.
      if (snake.moveAccumulator >= interval) {
        snake.moveAccumulator %= interval;
        snake.move();
      }
    }
  }

  resolveCollisions() {
    const snakes = this.getAllSnakes();

    const deaths = new Set();

    // Wall collisions.
    for (const snake of snakes) {
      if (!snake.alive) continue;

      const h = snake.head;

      if (!this.isInside(h.x, h.y)) {
        deaths.add(snake);
      }
    }

    // Self collisions.
    for (const snake of snakes) {
      if (!snake.alive) continue;

      const h = snake.head;

      for (let i = 1; i < snake.body.length; i++) {
        const p = snake.body[i];

        if (p.x === h.x && p.y === h.y) {
          deaths.add(snake);
          break;
        }
      }
    }

    // Head-to-head collisions.
    const heads = new Map();

    for (const snake of snakes) {
      if (!snake.alive) continue;

      const key = cellKey(
        snake.head.x,
        snake.head.y
      );

      if (!heads.has(key)) {
        heads.set(key, []);
      }

      heads.get(key).push(snake);
    }

    for (const contenders of heads.values()) {
      if (contenders.length > 1) {
        for (const snake of contenders) {
          deaths.add(snake);
        }
      }
    }

    // Head-to-body collisions.
    for (const snake of snakes) {
      if (!snake.alive) continue;

      const h = snake.head;

      for (const other of snakes) {
        if (!other.alive || snake === other) continue;

        // Ignore the other snake's final tail cell if
        // that tail is about to move away this tick.
        for (let i = 1; i < other.body.length; i++) {
          const p = other.body[i];

          if (p.x === h.x && p.y === h.y) {
            deaths.add(snake);
            break;
          }
        }
      }
    }

    for (const snake of deaths) {
      snake.die();
    }
  }

  consumeItems() {
    const snakes = this.getAllSnakes();

    for (const snake of snakes) {
      if (!snake.alive) continue;

      const h = snake.head;
      const key = cellKey(h.x, h.y);

      const food = this.food.get(key);

      if (food) {
        this.food.delete(key);

        snake.grow(1);

        const multiplier =
          snake.effects.multiplier > 0 ? 2 : 1;

        snake.score += multiplier;

        this.spawnFood();
      }

      const powerup = this.powerups.get(key);

      if (powerup) {
        this.powerups.delete(key);

        snake.effects[powerup.type] =
          CONFIG.POWERUP_DURATION;

        // Power-ups themselves don't grow the snake.
        // They modify movement/scoring.
      }
    }
  }

  maintainWorld() {
    while (this.food.size < CONFIG.FOOD_COUNT) {
      this.spawnFood();
    }

    while (this.powerups.size < CONFIG.POWERUP_COUNT) {
      this.spawnPowerup();
    }

    this.resetDeadBots();
  }

  cleanupDeadPlayers() {
    // Player death is persistent until they reconnect/rejoin.
    // Their snake is simply removed from the active board.
  }

  getLeaderboard() {
    return this.getAllSnakes()
      .map(snake => ({
        id: snake.id,
        username: snake.username,
        score: snake.score,
        length: snake.body.length,
        alive: snake.alive,
        bot: snake.bot
      }))
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        return b.length - a.length;
      });
  }

  serializeSnake(snake) {
    return {
      id: snake.id,
      username: snake.username,
      body: snake.body,
      direction: snake.direction,
      score: snake.score,
      length: snake.body.length,
      alive: snake.alive,
      bot: snake.bot,
      effects: snake.effects
    };
  }

  createSnapshot() {
    return {
      tick: this.tickCount,
      grid: {
        width: CONFIG.WIDTH,
        height: CONFIG.HEIGHT
      },

      snakes: this.getAllSnakes()
        .filter(snake => snake.alive)
        .map(snake => this.serializeSnake(snake)),

      food: [...this.food.values()],

      powerups: [...this.powerups.values()],

      leaderboard: this.getLeaderboard()
    };
  }

  createDelta(previous, current) {
    // For this compact implementation, the delta contains
    // only changed entity collections. Static grid dimensions
    // are sent once with the initial state.
    if (!previous) {
      return {
        full: true,
        state: current
      };
    }

    return {
      full: false,
      tick: current.tick,
      snakes: current.snakes,
      food: current.food,
      powerups: current.powerups,
      leaderboard: current.leaderboard
    };
  }

  broadcastSnapshot(force = false) {
    const now = performanceNow();

    if (
      !force &&
      now - this.lastSnapshot < CONFIG.SNAPSHOT_INTERVAL
    ) {
      return;
    }

    this.lastSnapshot = now;

    const snapshot = this.createSnapshot();

    const delta = this.createDelta(
      this.previousSnapshot,
      snapshot
    );

    io.emit("state", delta);

    this.previousSnapshot = snapshot;
  }

  step(dt) {
    this.tickCount++;

    for (const snake of this.getAllSnakes()) {
      snake.updateEffects(dt);
    }

    this.updateBots(dt);
    this.moveSnakes(dt);

    this.resolveCollisions();
    this.consumeItems();
    this.maintainWorld();

    this.broadcastSnapshot();

    const now = performanceNow();

    if (now - this.lastLog >= CONFIG.LOG_INTERVAL) {
      this.lastLog = now;

      const activePlayers =
        [...this.players.values()]
          .filter(s => s.alive)
          .length;

      console.log(
        `[heartbeat] players=${activePlayers}/${this.players.size} ` +
        `bots=${this.bots.size} ` +
        `tick=${this.tickCount} ` +
        `food=${this.food.size} ` +
        `powerups=${this.powerups.size}`
      );
    }
  }
}

function performanceNow() {
  return Number(process.hrtime.bigint()) / 1_000_000;
}

const game = new SnakeGame();

function gameLoop() {
  const now = performanceNow();

  let dt = now - game.lastTick;

  game.lastTick = now;

  // Avoid a huge catch-up spiral after process stalls.
  dt = clamp(dt, 0, 100);

  game.step(dt);

  setImmediate(gameLoop);
}

io.on("connection", socket => {
  console.log(
    `[connection] ${socket.id} connected`
  );

  socket.emit("hello", {
    grid: {
      width: CONFIG.WIDTH,
      height: CONFIG.HEIGHT
    }
  });

  socket.on("join", payload => {
    if (game.players.has(socket.id)) {
      return;
    }

    const username =
      sanitizeUsername(payload?.username);

    const snake = game.addPlayer(
      socket,
      username
    );

    if (!snake) {
      socket.emit("joinError", {
        message: "The arena is currently full."
      });

      return;
    }

    socket.emit("joined", {
      id: snake.id,
      username: snake.username
    });

    game.broadcastSnapshot(true);

    console.log(
      `[player] ${username} joined (${socket.id}); ` +
      `active=${game.players.size}`
    );
  });

  socket.on("input", payload => {
    const snake = game.players.get(socket.id);

    if (!snake || !snake.alive) {
      return;
    }

    if (
      !payload ||
      typeof payload.direction !== "string"
    ) {
      return;
    }

    snake.queueDirection(payload.direction);
  });

  socket.on("disconnect", reason => {
    const snake = game.players.get(socket.id);

    if (snake) {
      console.log(
        `[disconnect] ${snake.username} (${socket.id}) ` +
        `reason=${reason}`
      );
    }

    game.removePlayer(socket.id);
    game.broadcastSnapshot(true);
  });
});

httpServer.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║       MULTIPLAYER SNAKE SERVER       ║
╠══════════════════════════════════════╣
║ Port: ${String(PORT).padEnd(30)}║
║ Tick: ${String(CONFIG.TICK_RATE + " Hz").padEnd(30)}║
║ Bots: ${String(CONFIG.BOT_COUNT).padEnd(30)}║
╚══════════════════════════════════════╝
`);
});

gameLoop();

process.on("SIGINT", () => {
  console.log("\nShutting down server...");
  io.close(() => {
    httpServer.close(() => {
      process.exit(0);
    });
  });
});
