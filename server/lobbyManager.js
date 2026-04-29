/**
 * LobbyManager — Manages lobby creation, joining, and lifecycle.
 * 
 * Each lobby has:
 * - A unique 4-digit numeric code
 * - A host (the creator)
 * - A selected map
 * - Up to 5 players
 * - When host disconnects (after grace period), lobby is destroyed
 */

const MAX_PLAYERS = 5;
const HOST_GRACE_PERIOD_MS = 10000; // 10 seconds

class LobbyManager {
  constructor() {
    /** @type {Map<string, Lobby>} code -> Lobby */
    this.lobbies = new Map();
    /** @type {Map<string, string>} socketId -> lobbyCode */
    this.playerLobbyMap = new Map();
    /** @type {Map<string, NodeJS.Timeout>} lobbyCode -> timeout */
    this.hostGraceTimers = new Map();
  }

  /**
   * Generate a unique 4-digit code not currently in use
   */
  _generateCode() {
    let code;
    let attempts = 0;
    do {
      code = String(Math.floor(1000 + Math.random() * 9000));
      attempts++;
      if (attempts > 100) {
        throw new Error('Unable to generate unique lobby code');
      }
    } while (this.lobbies.has(code));
    return code;
  }

  /**
   * Create a new lobby
   * @param {string} hostSocketId 
   * @param {string} hostName 
   * @param {number} avatarId 
   * @param {string} mapId 
   * @returns {{ code: string, lobby: object }}
   */
  createLobby(hostSocketId, hostName, avatarId, mapId) {
    const code = this._generateCode();
    const lobby = {
      code,
      mapId,
      hostSocketId,
      players: new Map(),
      createdAt: Date.now()
    };

    // Add host as first player
    lobby.players.set(hostSocketId, {
      id: hostSocketId,
      name: hostName,
      avatarId,
      x: 0,
      y: 0,
      isHost: true,
      peerId: null
    });

    this.lobbies.set(code, lobby);
    this.playerLobbyMap.set(hostSocketId, code);

    console.log(`[Lobby] Created lobby ${code} by ${hostName} (map: ${mapId})`);
    return { code, lobby };
  }

  /**
   * Join an existing lobby
   * @param {string} code 
   * @param {string} socketId 
   * @param {string} playerName 
   * @param {number} avatarId 
   * @returns {{ success: boolean, error?: string, lobby?: object }}
   */
  joinLobby(code, socketId, playerName, avatarId) {
    const lobby = this.lobbies.get(code);

    if (!lobby) {
      return { success: false, error: 'Lobby not found. Check your code and try again.' };
    }

    if (lobby.players.size >= MAX_PLAYERS) {
      return { success: false, error: 'Lobby is full (max 5 players).' };
    }

    // Check if name is already taken in this lobby
    for (const [, player] of lobby.players) {
      if (player.name.toLowerCase() === playerName.toLowerCase()) {
        return { success: false, error: 'That name is already taken in this lobby.' };
      }
    }

    lobby.players.set(socketId, {
      id: socketId,
      name: playerName,
      avatarId,
      x: 0,
      y: 0,
      isHost: false,
      peerId: null
    });

    this.playerLobbyMap.set(socketId, code);

    // If host was in grace period and is being "replaced" — cancel timer
    // (This handles the case where host reconnects)
    if (this.hostGraceTimers.has(code)) {
      clearTimeout(this.hostGraceTimers.get(code));
      this.hostGraceTimers.delete(code);
    }

    console.log(`[Lobby] ${playerName} joined lobby ${code} (${lobby.players.size}/${MAX_PLAYERS})`);
    return { success: true, lobby };
  }

  /**
   * Remove a player from their lobby
   * @param {string} socketId 
   * @returns {{ wasHost: boolean, lobbyCode: string|null, lobby: object|null }}
   */
  removePlayer(socketId) {
    const code = this.playerLobbyMap.get(socketId);
    if (!code) return { wasHost: false, lobbyCode: null, lobby: null };

    const lobby = this.lobbies.get(code);
    if (!lobby) {
      this.playerLobbyMap.delete(socketId);
      return { wasHost: false, lobbyCode: code, lobby: null };
    }

    const player = lobby.players.get(socketId);
    const wasHost = player?.isHost || false;

    lobby.players.delete(socketId);
    this.playerLobbyMap.delete(socketId);

    console.log(`[Lobby] ${player?.name || socketId} left lobby ${code} (${lobby.players.size} remaining)`);

    return { wasHost, lobbyCode: code, lobby };
  }

  /**
   * Destroy a lobby entirely
   * @param {string} code 
   * @returns {string[]} array of remaining player socket IDs that need to be notified
   */
  destroyLobby(code) {
    const lobby = this.lobbies.get(code);
    if (!lobby) return [];

    const remainingPlayerIds = Array.from(lobby.players.keys());

    // Clean up player-lobby mappings
    for (const socketId of lobby.players.keys()) {
      this.playerLobbyMap.delete(socketId);
    }

    // Clean up grace timer if any
    if (this.hostGraceTimers.has(code)) {
      clearTimeout(this.hostGraceTimers.get(code));
      this.hostGraceTimers.delete(code);
    }

    this.lobbies.delete(code);
    console.log(`[Lobby] Destroyed lobby ${code}`);

    return remainingPlayerIds;
  }

  /**
   * Start the host grace period. If the host doesn't reconnect,
   * the lobby is destroyed after HOST_GRACE_PERIOD_MS.
   * @param {string} code 
   * @param {Function} onExpire - called with (code, remainingPlayerIds) if timer expires
   */
  startHostGracePeriod(code, onExpire) {
    if (this.hostGraceTimers.has(code)) {
      clearTimeout(this.hostGraceTimers.get(code));
    }

    console.log(`[Lobby] Host grace period started for lobby ${code} (${HOST_GRACE_PERIOD_MS / 1000}s)`);

    const timer = setTimeout(() => {
      console.log(`[Lobby] Host grace period expired for lobby ${code} — destroying`);
      const playerIds = this.destroyLobby(code);
      onExpire(code, playerIds);
    }, HOST_GRACE_PERIOD_MS);

    this.hostGraceTimers.set(code, timer);
  }

  /**
   * Update a player's position
   */
  updatePlayerPosition(socketId, x, y, direction, frame) {
    const code = this.playerLobbyMap.get(socketId);
    if (!code) return null;

    const lobby = this.lobbies.get(code);
    if (!lobby) return null;

    const player = lobby.players.get(socketId);
    if (!player) return null;

    player.x = x;
    player.y = y;
    if (direction !== undefined) player.direction = direction;
    if (frame !== undefined) player.frame = frame;

    return { code, player };
  }

  /**
   * Set a player's PeerJS peer ID
   */
  setPlayerPeerId(socketId, peerId) {
    const code = this.playerLobbyMap.get(socketId);
    if (!code) return;

    const lobby = this.lobbies.get(code);
    if (!lobby) return;

    const player = lobby.players.get(socketId);
    if (player) {
      player.peerId = peerId;
    }
  }

  /**
   * Get lobby info by code
   */
  getLobby(code) {
    return this.lobbies.get(code) || null;
  }

  /**
   * Get the lobby code for a given socket
   */
  getPlayerLobbyCode(socketId) {
    return this.playerLobbyMap.get(socketId) || null;
  }

  /**
   * Serialize lobby for client consumption
   */
  serializeLobby(code) {
    const lobby = this.lobbies.get(code);
    if (!lobby) return null;

    const players = [];
    for (const [id, player] of lobby.players) {
      players.push({
        id,
        name: player.name,
        avatarId: player.avatarId,
        x: player.x,
        y: player.y,
        isHost: player.isHost,
        peerId: player.peerId
      });
    }

    return {
      code: lobby.code,
      mapId: lobby.mapId,
      hostSocketId: lobby.hostSocketId,
      players
    };
  }
}

module.exports = LobbyManager;
