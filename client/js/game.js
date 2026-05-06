import MinigameRenderer from './minigames/renderer.js';

/**
 * PDC PIT YAWA — Phaser Game Scene
 * Handles 2D world rendering, player movement, and multiplayer avatar sync.
 *
 * AVATAR SPRITESHEET FORMAT (per character):
 *   - Frame size: 32×32px
 *   - 4 columns wide
 *   - Add rows as you complete each animation:
 *
 *   Row 0  (frames  0– 3): Walk / idle strip  ← franco.png currently has this
 *   Row 1  (frames  4– 7): Walk Up
 *   Row 2  (frames  8–11): Walk Left
 *   Row 3  (frames 12–15): Walk Right
 *   Row 4  (frames 16–19): Idle Down
 *   Row 5  (frames 20–23): Idle Up
 *   Row 6  (frames 24–27): Idle Left
 *   Row 7  (frames 28–31): Idle Right
 *   Row 8  (frames 32–35): Interact Down
 *   Row 9  (frames 36–39): Interact Up
 *   Row 10 (frames 40–43): Interact Left
 *   Row 11 (frames 44–47): Interact Right
 */

const TILE_SIZE = 32;
const AVATAR_COLORS = ['#6c5ce7', '#00cec9', '#e17055', '#fdcb6e', '#00b894'];

// Avatar config — set hasSprite: true once the PNG is in assets/avatars/
const AVATARS = [
  { name: 'Franco',   key: 'franco',   hasSprite: true  },
  { name: 'Mariann',  key: 'mariann',  hasSprite: true  },
  { name: 'Gwynette', key: 'gwynette', hasSprite: true  },
  { name: 'Aldwyn',   key: 'aldwyn',   hasSprite: false },
  { name: 'Rafi',     key: 'rafi',     hasSprite: false },
];

let phaserGame = null;

// ── Map Definitions ───────────────────────────────
// Maps with a 'json' key use a real Tiled JSON tilemap.
// Maps without one fall back to procedural generation.
const MAPS = {
  office: {
    name: 'USTP', json: 'ustp',
    tilesets: [
      { key: 'room_builder', file: 'assets/maps/Room_Builder_free_32x32.png' },
      { key: 'interiors',    file: 'assets/maps/Interiors_free_32x32.png'    },
    ],
    triggers: [
      { game: 'tictactoe',  tiles: [{x: 0, y: 15}, {x: 3, y: 15}], color: 0x6c5ce7 },
      { game: 'battleship', tiles: [{x: 0, y: 17}, {x: 3, y: 17}], color: 0xe17055 },
      { game: 'checkers',   tiles: [{x: 0, y: 19}, {x: 3, y: 19}], color: 0x00cec9 },
      { game: 'tongits',    tiles: [{x: 16, y: 13}, {x: 18, y: 13}, {x: 17, y: 16}], color: 0xfdcb6e },
      { game: 'uno',        tiles: [{x: 16, y: 6}, {x: 16, y: 7}, {x: 17, y: 4}, {x: 19, y: 4}, {x: 20, y: 6}], color: 0xd63031 },
    ]
  },
  lounge: { name: 'Balay ni Aldwyn', width: 22, height: 18, color: 0x0a3d2e, floorColor: 0x2d6a4f },
  campus: { name: 'Tiyan ni Rafi',   width: 28, height: 22, color: 0x2d1b69, floorColor: 0x4a3f8a },
};

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.remotePlayers = new Map();
    this.config = null;
    this.myPlayer = null;
    this.cursors = null;
    this.wasd = null;
    this.collisionLayers = [];
    this.lastSentPos = { x: 0, y: 0 };
    this.lastDirection = 'down';
    this.isMoving = false;
    this.nameTexts = new Map();
    this.isMinigameActive = false;
    this.currentTriggerTile = null;
    this.nearbyTrigger = null;
    this.triggerPrompt = null;
    this.minigameRenderer = null;
  }

  init(data) {
    this.config = data;
  }

  // ── Preload ─────────────────────────────────────
  preload() {
    // Avatars
    for (const avatar of AVATARS) {
      if (avatar.hasSprite) {
        this.load.spritesheet(avatar.key, `assets/avatars/${avatar.key}.png`, {
          frameWidth: 32,
          frameHeight: 32,
        });
      }
    }

    // Tiled map + tilesets
    const mapDef = MAPS[this.config.mapId] || MAPS.office;
    if (mapDef.json) {
      this.load.tilemapTiledJSON(mapDef.json, `assets/maps/${mapDef.json}.json`);
      for (const ts of mapDef.tilesets) {
        this.load.image(ts.key, ts.file);
      }
    }
  }

  // ── Register animations ─────────────────────────
  _registerAnims(avatarKey) {
    if (this.anims.exists(`${avatarKey}-walk`)) return;

    this.anims.create({
      key: `${avatarKey}-walk`,
      frames: this.anims.generateFrameNumbers(avatarKey, { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1,
    });

    this.anims.create({
      key: `${avatarKey}-idle`,
      frames: [{ key: avatarKey, frame: 0 }],
      frameRate: 1,
      repeat: -1,
    });
  }

  create() {
    const mapDef = MAPS[this.config.mapId] || MAPS.office;
    let mapW, mapH, spawnX, spawnY;

    if (mapDef.json) {
      // ── TILED MAP ──────────────────────────────────
      const map = this.make.tilemap({ key: mapDef.json });

      // Build image-basename → texture-key lookup from game config
      const imageKeyMap = {};
      for (const ts of mapDef.tilesets) {
        const basename = ts.file.split('/').pop();
        imageKeyMap[basename] = ts.key;
      }

      // Read tileset names directly from the cached map JSON (no hardcoding needed)
      const rawMapData = this.cache.tilemap.get(mapDef.json);
      const rawTilesets = rawMapData?.data?.tilesets || rawMapData?.tilesets || [];

      const tilesets = [];
      for (const rawTs of rawTilesets) {
        if (!rawTs.name || !rawTs.image) continue;
        const basename = rawTs.image.split('/').pop();
        const key = imageKeyMap[basename];
        if (key) {
          const tileset = map.addTilesetImage(rawTs.name, key);
          if (tileset) tilesets.push(tileset);
        }
      }

      // Create all tile layers; Wall 1, Wall 2, and Collision layers are solid
      const COLLISION_LAYERS = ['Collision', 'Wall 1', 'Wall 2',
        'Wall 1 (wall design)', 'Wall 2 (wall frame)'];
      this.collisionLayers = [];
      for (let i = 0; i < map.layers.length; i++) {
        const layerData = map.layers[i];
        const isCollision = COLLISION_LAYERS.includes(layerData.name);
        const layer = map.createLayer(i, tilesets);
        if (layer) {
          layer.setDepth(isCollision ? 5 : 0);
          if (isCollision) {
            layer.setCollisionByExclusion([-1, 0]);
            this.collisionLayers.push(layer);
          }
        }
      }

      mapW = map.widthInPixels;
      mapH = map.heightInPixels;

      // Default spawn: center of map in open area
      spawnX = 27 * TILE_SIZE + TILE_SIZE / 2;
      spawnY = 6  * TILE_SIZE + TILE_SIZE / 2;

    } else {
      // ── PROCEDURAL FALLBACK ────────────────────────
      mapW = mapDef.width * TILE_SIZE;
      mapH = mapDef.height * TILE_SIZE;

      const floor = this.add.rectangle(mapW / 2, mapH / 2, mapW, mapH, mapDef.floorColor);
      floor.setDepth(-2);

      const grid = this.add.graphics();
      grid.lineStyle(1, 0xffffff, 0.04);
      for (let x = 0; x <= mapW; x += TILE_SIZE) { grid.moveTo(x, 0); grid.lineTo(x, mapH); }
      for (let y = 0; y <= mapH; y += TILE_SIZE) { grid.moveTo(0, y); grid.lineTo(mapW, y); }
      grid.strokePath();
      grid.setDepth(-1);

      // Border walls
      const walls = this.physics.add.staticGroup();
      for (let x = 0; x < mapDef.width; x++) {
        this._addWallRect(walls, x * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE / 2, mapDef.color);
        this._addWallRect(walls, x * TILE_SIZE + TILE_SIZE / 2, (mapDef.height - 1) * TILE_SIZE + TILE_SIZE / 2, mapDef.color);
      }
      for (let y = 1; y < mapDef.height - 1; y++) {
        this._addWallRect(walls, TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, mapDef.color);
        this._addWallRect(walls, (mapDef.width - 1) * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, mapDef.color);
      }
      this.collisionLayers = [walls];

      spawnX = 3 * TILE_SIZE + TILE_SIZE / 2;
      spawnY = 3 * TILE_SIZE + TILE_SIZE / 2;
    }

    // Draw Minigame Trigger Zones (glowing areas with labels)
    this.triggerZones = [];
    if (mapDef.triggers) {
      for (const trigger of mapDef.triggers) {
        // Draw individual tile glows
        for (const tile of trigger.tiles) {
          const gx = tile.x * TILE_SIZE + TILE_SIZE / 2;
          const gy = tile.y * TILE_SIZE + TILE_SIZE / 2;
          const glow = this.add.rectangle(gx, gy, TILE_SIZE, TILE_SIZE, trigger.color ?? 0x6c5ce7, 0.25);
          glow.setDepth(1);
          glow.setStrokeStyle(2, trigger.color ?? 0x6c5ce7, 0.6);
          this.tweens.add({ targets: glow, alpha: { from: 0.15, to: 0.45 }, duration: 1200, yoyo: true, repeat: -1 });
        }

        // Calculate bounding box center for the label and detection zone
        const xs = trigger.tiles.map(t => t.x);
        const ys = trigger.tiles.map(t => t.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const cx = ((minX + maxX) / 2) * TILE_SIZE + TILE_SIZE / 2;
        const cy = ((minY + maxY) / 2) * TILE_SIZE + TILE_SIZE / 2;

        const label = this.add.text(cx, cy, trigger.game.toUpperCase(), {
          fontSize: '9px', fontFamily: 'Inter, sans-serif', fontStyle: 'bold',
          color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.5)',
          padding: { x: 4, y: 2 },
        }).setOrigin(0.5).setDepth(2);

        this.triggerZones.push({
          game: trigger.game,
          cx, cy,
          halfW: ((maxX - minX + 1) / 2 + 1) * TILE_SIZE,
          halfH: ((maxY - minY + 1) / 2 + 1) * TILE_SIZE,
          color: trigger.color,
        });
      }
    }

    // HUD prompt (fixed to camera)
    this.triggerPrompt = this.add.text(0, 0, '', {
      fontSize: '14px', fontFamily: 'Inter, sans-serif', fontStyle: 'bold',
      color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.7)',
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setDepth(100).setScrollFactor(0).setVisible(false);

    // E key for interaction
    this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    // Spawn my player
    const myData = this.config.players.find(p => p.id === this.config.mySocketId);
    const avatarId = myData ? myData.avatarId : 0;

    this.myPlayer = this._createPlayerSprite(spawnX, spawnY, avatarId, true);

    // Add collision with all collision layers
    for (const layer of this.collisionLayers) {
      this.physics.add.collider(this.myPlayer, layer);
    }

    const myName = myData ? myData.name : 'You';
    this._addNameTag(this.config.mySocketId, this.myPlayer, myName);

    // Camera
    this.cameras.main.startFollow(this.myPlayer, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.5);
    this.cameras.main.setBounds(0, 0, mapW, mapH);
    this.physics.world.setBounds(0, 0, mapW, mapH);

    // Input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up:    Phaser.Input.Keyboard.KeyCodes.W,
      down:  Phaser.Input.Keyboard.KeyCodes.S,
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });

    // Initialize minigame renderer (client-side UI handler)
    this.minigameRenderer = MinigameRenderer;
    this.minigameRenderer.init(this.config.socket);

    // Spawn existing remote players
    for (const p of this.config.players) {
      if (p.id !== this.config.mySocketId) this._addRemotePlayer(p);
    }

    window.addEventListener('lobby:player-joined', this._onPlayerJoined);
    window.addEventListener('lobby:player-left',   this._onPlayerLeft);
    window.addEventListener('lobby:player-moved',  this._onPlayerMoved);

    window.__gameScene = this;
  }

  _addWallRect(group, x, y, color) {
    const wall = this.add.rectangle(x, y, TILE_SIZE, TILE_SIZE, color);
    this.physics.add.existing(wall, true);
    group.add(wall);
  }

  // ── Create a player sprite (animated or fallback circle) ──
  _createPlayerSprite(x, y, avatarId, isPhysics) {
    const avatar = AVATARS[avatarId] || AVATARS[0];
    let sprite;

    if (avatar.hasSprite) {
      // ── Animated sprite ──────────────────────────
      this._registerAnims(avatar.key);
      sprite = this.add.sprite(x, y, avatar.key);
      sprite.setDisplaySize(32, 32);
      sprite.setDepth(10);
      sprite.play(`${avatar.key}-idle`);
      sprite._avatarKey = avatar.key;
      sprite._isAnimated = true;
    } else {
      // ── Fallback: colored circle with initial ────
      const color = Phaser.Display.Color.HexStringToColor(AVATAR_COLORS[avatarId] || AVATAR_COLORS[0]).color;
      sprite = this.add.circle(x, y, 12, color);
      sprite.setDepth(10);
      sprite._isAnimated = false;

      const initial = avatar.name.charAt(0).toUpperCase();
      const label = this.add.text(x, y, initial, {
        fontSize: '12px',
        fontFamily: 'Inter, sans-serif',
        fontStyle: 'bold',
        color: '#ffffff',
      }).setOrigin(0.5).setDepth(11);
      sprite._label = label;
    }

    if (isPhysics) {
      this.physics.add.existing(sprite);
      sprite.body.setCollideWorldBounds(true);
      if (sprite._isAnimated) {
        sprite.body.setSize(20, 24);
        sprite.body.setOffset(6, 8);
      } else {
        sprite.body.setCircle(12);
      }
    }

    return sprite;
  }

  _addNameTag(id, sprite, name) {
    const text = this.add.text(sprite.x, sprite.y - 22, name, {
      fontSize: '10px',
      fontFamily: 'Inter, sans-serif',
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.5)',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(12);
    this.nameTexts.set(id, text);
  }

  _addRemotePlayer(playerData) {
    const spawnX = playerData.x || (4 * TILE_SIZE + TILE_SIZE / 2);
    const spawnY = playerData.y || (4 * TILE_SIZE + TILE_SIZE / 2);
    const sprite = this._createPlayerSprite(spawnX, spawnY, playerData.avatarId, false);
    sprite._targetX = spawnX;
    sprite._targetY = spawnY;
    sprite._direction = 'down';
    sprite._moving = false;
    this.remotePlayers.set(playerData.id, sprite);
    this._addNameTag(playerData.id, sprite, playerData.name);
  }

  // ── Play the correct animation on a sprite ──────
  _playAnim(sprite, state) {
    if (!sprite._isAnimated) return;
    const key = `${sprite._avatarKey}-${state}`;
    if (sprite.anims.currentAnim?.key !== key) {
      sprite.play(key, true);
    }
  }

  // ── Trigger interact anim (called by proximity.js) ──
  triggerInteract(socketId) {
    if (socketId === this.config.mySocketId) {
      if (this.myPlayer?._isAnimated) {
        const key = `${this.myPlayer._avatarKey}-interact`;
        this.myPlayer.play(key);
        // Return to idle after interact finishes
        this.myPlayer.once('animationcomplete', () => {
          this._playAnim(this.myPlayer, 'idle', this.lastDirection);
        });
      }
    } else {
      const sprite = this.remotePlayers.get(socketId);
      if (sprite?._isAnimated) {
        const key = `${sprite._avatarKey}-interact`;
        sprite.play(key);
        sprite.once('animationcomplete', () => {
          this._playAnim(sprite, 'idle', sprite._direction || 'down');
        });
      }
    }
  }

  _onPlayerJoined = (e) => {
    const { player } = e.detail;
    if (!this.remotePlayers.has(player.id)) this._addRemotePlayer(player);
  };

  _onPlayerLeft = (e) => {
    const { id } = e.detail;
    const sprite = this.remotePlayers.get(id);
    if (sprite) {
      if (sprite._label) sprite._label.destroy();
      sprite.destroy();
      this.remotePlayers.delete(id);
    }
    const nameTag = this.nameTexts.get(id);
    if (nameTag) { nameTag.destroy(); this.nameTexts.delete(id); }
  };

  _onPlayerMoved = (e) => {
    const { id, x, y } = e.detail;
    const sprite = this.remotePlayers.get(id);
    if (sprite) {
      const wasMoving = sprite._moving;
      const distMoved = Math.abs(sprite.x - x) + Math.abs(sprite.y - y);
      sprite._moving = distMoved > 2;

      // Flip based on horizontal movement
      if (sprite._isAnimated) {
        const dx = x - sprite.x;
        if (dx > 1) sprite.setFlipX(true);
        else if (dx < -1) sprite.setFlipX(false);
      }

      sprite._targetX = x;
      sprite._targetY = y;
      if (sprite._isAnimated) {
        if (sprite._moving) {
          this._playAnim(sprite, 'walk');
        } else if (wasMoving) {
          this._playAnim(sprite, 'idle');
        }
      }
    }
  };

  _onInteract = (e) => {
    const { socketId } = e.detail;
    this.triggerInteract(socketId);
  };

  update() {
    if (!this.myPlayer) return;

    // Freeze player if minigame is active
    if (this.isMinigameActive) {
      this.myPlayer.body.setVelocity(0);
      this._playAnim(this.myPlayer, 'idle');
      return;
    }

    const speed = 160;
    this.myPlayer.body.setVelocity(0);

    let vx = 0, vy = 0;
    let direction = this.lastDirection;

    if (this.cursors.left.isDown  || this.wasd.left.isDown)  { vx = -speed; direction = 'left';  }
    if (this.cursors.right.isDown || this.wasd.right.isDown) { vx =  speed; direction = 'right'; }
    if (this.cursors.up.isDown    || this.wasd.up.isDown)    { vy = -speed; direction = 'up';    }
    if (this.cursors.down.isDown  || this.wasd.down.isDown)  { vy =  speed; direction = 'down';  }

    this.myPlayer.body.setVelocity(vx, vy);

    const moving = vx !== 0 || vy !== 0;

    // Mirror sprite horizontally based on horizontal direction
    if (this.myPlayer._isAnimated) {
      if (direction === 'right') this.myPlayer.setFlipX(true);
      else if (direction === 'left') this.myPlayer.setFlipX(false);
    }

    // Play correct animation on my player
    if (this.myPlayer._isAnimated) {
      if (moving) {
        this._playAnim(this.myPlayer, 'walk');
      } else if (this.isMoving) {
        this._playAnim(this.myPlayer, 'idle');
      }
    }

    // Update label position (fallback circle)
    if (this.myPlayer._label) {
      this.myPlayer._label.setPosition(this.myPlayer.x, this.myPlayer.y);
    }

    this.lastDirection = direction;
    this.isMoving = moving;

    // Update name tag
    const myTag = this.nameTexts.get(this.config.mySocketId);
    if (myTag) myTag.setPosition(this.myPlayer.x, this.myPlayer.y - 22);

    // Emit position + direction if changed
    const dx = Math.abs(this.myPlayer.x - this.lastSentPos.x);
    const dy = Math.abs(this.myPlayer.y - this.lastSentPos.y);
    if (dx > 1 || dy > 1) {
      this.config.socket.emit('player:move', {
        x: Math.round(this.myPlayer.x),
        y: Math.round(this.myPlayer.y),
        direction,
      });
      this.lastSentPos.x = this.myPlayer.x;
      this.lastSentPos.y = this.myPlayer.y;
    }

    // ── Proximity-based minigame trigger detection ──────────
    if (this.triggerZones && this.triggerZones.length > 0) {
      const px = this.myPlayer.x;
      const py = this.myPlayer.y;
      let found = null;

      for (const zone of this.triggerZones) {
        if (Math.abs(px - zone.cx) < zone.halfW && Math.abs(py - zone.cy) < zone.halfH) {
          found = zone;
          break;
        }
      }

      if (found) {
        this.nearbyTrigger = found;
        const cam = this.cameras.main;
        this.triggerPrompt.setPosition(cam.width / 2, cam.height - 60);
        this.triggerPrompt.setText(`Press E to play ${found.game.toUpperCase()}`);
        this.triggerPrompt.setVisible(true);

        if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
          this.config.socket.emit('minigame:queue', { gameId: found.game });
          this.triggerPrompt.setText(`Queued for ${found.game.toUpperCase()} — waiting for opponent...`);
        }
      } else {
        if (this.nearbyTrigger) {
          this.nearbyTrigger = null;
          this.triggerPrompt.setVisible(false);
          this.config.socket.emit('minigame:dequeue');
        }
      }
    }

    // Lerp remote players
    for (const [id, sprite] of this.remotePlayers) {
      if (sprite._targetX !== undefined) {
        sprite.x = Phaser.Math.Linear(sprite.x, sprite._targetX, 0.15);
        sprite.y = Phaser.Math.Linear(sprite.y, sprite._targetY, 0.15);
        if (sprite._label) sprite._label.setPosition(sprite.x, sprite.y);
        const tag = this.nameTexts.get(id);
        if (tag) tag.setPosition(sprite.x, sprite.y - 22);
      }
    }
  }

  getMyPosition() {
    return this.myPlayer ? { x: this.myPlayer.x, y: this.myPlayer.y } : null;
  }

  getRemotePositions() {
    const positions = {};
    for (const [id, sprite] of this.remotePlayers) {
      positions[id] = { x: sprite.x, y: sprite.y };
    }
    return positions;
  }

  shutdown() {
    window.removeEventListener('lobby:player-joined', this._onPlayerJoined);
    window.removeEventListener('lobby:player-left',   this._onPlayerLeft);
    window.removeEventListener('lobby:player-moved',  this._onPlayerMoved);
    window.removeEventListener('lobby:interact',      this._onInteract);
    window.__gameScene = null;
  }
}

// ── Public API ───────────────────────────────────
export function initGame({ mapId, players, mySocketId, socket }) {
  if (phaserGame) phaserGame.destroy(true);

  phaserGame = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-container',
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#0a0e1a',
    physics: {
      default: 'arcade',
      arcade: { gravity: { y: 0 }, debug: false }
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: GameScene
  });

  phaserGame.scene.start('GameScene', { mapId, players, mySocketId, socket });
}

export function destroyGame() {
  if (phaserGame) {
    phaserGame.destroy(true);
    phaserGame = null;
  }
}

// Expose avatar list for app.js avatar picker
export { AVATARS };
