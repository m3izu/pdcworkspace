const tictactoe  = require('./tictactoe');
const checkers   = require('./checkers');
const battleship = require('./battleship');
const tongits    = require('./tongits');
const uno        = require('./uno');
const poker      = require('./poker');
const connect4   = require('./connect4');

class MinigameManager {
  constructor(io, lobbyManager) {
    this.io = io;
    this.lobbyManager = lobbyManager;

    // Registry of available minigames
    this.games = {
      [tictactoe.id]:  tictactoe,
      [checkers.id]:   checkers,
      [battleship.id]: battleship,
      [tongits.id]:    tongits,
      [uno.id]:        uno,
      [poker.id]:      poker,
      [connect4.id]:   connect4,
    };

    // State tracking per lobby
    this.lobbyStates = new Map();
  }

  _getLobbyState(lobbyCode) {
    if (!this.lobbyStates.has(lobbyCode)) {
      this.lobbyStates.set(lobbyCode, {
        queues: {},            // gameId -> [socketId, ...]
        readyLobbies: {},      // gameId -> { gameId, players: { socketId: { ready: bool } } }
        activeGames: new Map(), // instanceId -> { id, players, gameState, roles }
        playerGameMap: new Map() // socketId -> instanceId
      });
    }
    return this.lobbyStates.get(lobbyCode);
  }

  cleanupLobby(lobbyCode) {
    this.lobbyStates.delete(lobbyCode);
  }

  removePlayer(lobbyCode, socketId) {
    const state = this._getLobbyState(lobbyCode);

    // Remove from all queues
    for (const gameId of Object.keys(state.queues)) {
      state.queues[gameId] = state.queues[gameId].filter(id => id !== socketId);
    }

    // Remove from ready lobbies
    for (const gameId of Object.keys(state.readyLobbies)) {
      const readyLobby = state.readyLobbies[gameId];
      if (readyLobby && readyLobby.players[socketId]) {
        delete readyLobby.players[socketId];
        if (Object.keys(readyLobby.players).length === 0) {
          delete state.readyLobbies[gameId];
        } else {
          this._broadcastReadyLobby(lobbyCode, state, gameId);
        }
      }
    }

    // End active game if they are in it
    const instanceId = state.playerGameMap.get(socketId);
    if (instanceId) {
      this.handleExit(socketId, lobbyCode);
    }
  }

  // ── Queue-based system ──────────────────────────────

  handleQueue(socketId, lobbyCode, gameId) {
    const state = this._getLobbyState(lobbyCode);
    
    // Check if player is already in a game
    if (state.playerGameMap.has(socketId)) {
      this.io.to(socketId).emit('minigame:error', { message: 'You are already in a game!' });
      return;
    }

    const game = this.games[gameId];
    if (!game) return;

    // Remove from other queues/lobbies
    this.handleDequeue(socketId, lobbyCode);

    // If this game uses flexible start (ready-up lobby)
    if (game.flexibleStart) {
      this._joinReadyLobby(socketId, lobbyCode, gameId, state);
      return;
    }

    // Fixed player count games
    if (!state.queues[gameId]) state.queues[gameId] = [];
    state.queues[gameId].push(socketId);

    console.log(`[Minigame] ${socketId} queued for ${gameId} in lobby ${lobbyCode} (${state.queues[gameId].length} waiting)`);

    const needed = game.playerCount || 2;
    if (state.queues[gameId].length >= needed) {
      const playerIds = state.queues[gameId].splice(0, needed);
      this._startGame(lobbyCode, state, gameId, playerIds);
    } else {
      this.io.to(socketId).emit('minigame:waiting');
    }
  }

  handleDequeue(socketId, lobbyCode) {
    const state = this._getLobbyState(lobbyCode);

    for (const gameId of Object.keys(state.queues)) {
      state.queues[gameId] = state.queues[gameId].filter(id => id !== socketId);
    }

    // Leave ready lobbies
    for (const gameId of Object.keys(state.readyLobbies)) {
      const readyLobby = state.readyLobbies[gameId];
      if (readyLobby && readyLobby.players[socketId]) {
        delete readyLobby.players[socketId];
        console.log(`[Minigame] ${socketId} left ready lobby ${gameId} in ${lobbyCode}`);
        if (Object.keys(readyLobby.players).length === 0) {
          delete state.readyLobbies[gameId];
        } else {
          this._broadcastReadyLobby(lobbyCode, state, gameId);
        }
      }
    }

    this.io.to(socketId).emit('minigame:waiting-cancelled');
  }

  // ── Ready-up lobby for flexible player count games ──

  _joinReadyLobby(socketId, lobbyCode, gameId, state) {
    // Create lobby if needed for this gameId
    if (!state.readyLobbies[gameId]) {
      state.readyLobbies[gameId] = { gameId, players: {} };
    }

    const readyLobby = state.readyLobbies[gameId];
    const game = this.games[gameId];
    const maxPlayers = game.maxPlayers || 5;
    
    if (Object.keys(readyLobby.players).length >= maxPlayers) {
      this.io.to(socketId).emit('minigame:error', { message: 'This lobby is full!' });
      return;
    }

    readyLobby.players[socketId] = { ready: false };
    console.log(`[Minigame] ${socketId} joined ready lobby for ${gameId} (${Object.keys(readyLobby.players).length} players)`);

    this._broadcastReadyLobby(lobbyCode, state, gameId);
  }

  handleReady(socketId, lobbyCode, ready) {
    const state = this._getLobbyState(lobbyCode);
    
    // Find which ready lobby the player is in
    let gameId = null;
    for (const gid of Object.keys(state.readyLobbies)) {
      if (state.readyLobbies[gid].players[socketId]) {
        gameId = gid;
        break;
      }
    }
    if (!gameId) return;

    const readyLobby = state.readyLobbies[gameId];
    readyLobby.players[socketId].ready = !!ready;
    console.log(`[Minigame] ${socketId} ready=${ready} in lobby ${lobbyCode} for ${gameId}`);

    this._broadcastReadyLobby(lobbyCode, state, gameId);

    // Check if all ready and minimum met
    const game = this.games[gameId];
    const players = readyLobby.players;
    const ids = Object.keys(players);
    const minPlayers = game.minPlayers || 2;
    const allReady = ids.every(id => players[id].ready);

    if (allReady && ids.length >= minPlayers) {
      delete state.readyLobbies[gameId];
      this._startGame(lobbyCode, state, gameId, ids);
    }
  }

  _broadcastReadyLobby(lobbyCode, state, gameId) {
    const readyLobby = state.readyLobbies[gameId];
    if (!readyLobby) return;
    const game = this.games[gameId];
    const lobbyInfo = {
      gameId: gameId,
      gameName: game.name,
      minPlayers: game.minPlayers || 2,
      maxPlayers: game.maxPlayers || 5,
      players: Object.entries(readyLobby.players).map(([id, p]) => ({
        id,
        ready: p.ready,
      })),
    };
    for (const pid of Object.keys(readyLobby.players)) {
      this.io.to(pid).emit('minigame:ready-lobby', lobbyInfo);
    }
  }

  // ── Legacy step-on/step-off ──

  handleStepOn() {}
  handleStepOff() {}

  // ── Game lifecycle ──────────────────────────────────────

  _startGame(lobbyCode, state, gameId, playerIds) {
    const game = this.games[gameId];
    if (!game) return;

    // For games with dynamic player count, pass count to createState
    const gameState = game.flexibleStart
      ? game.createState(playerIds.length)
      : game.createState();

    // Build roles
    let roles;
    if (game.flexibleStart) {
      roles = gameState.roles || game.roles || playerIds.map((_, i) => `p${i + 1}`);
    } else {
      roles = game.roles || ['X', 'O'];
    }

    const instanceId = `${gameId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const activeGame = {
      id: gameId,
      instanceId,
      players: playerIds,
      gameState,
      roles: {}
    };

    for (let i = 0; i < playerIds.length; i++) {
      const pid = playerIds[i];
      activeGame.roles[pid] = roles[i];
      state.playerGameMap.set(pid, instanceId);
    }

    state.activeGames.set(instanceId, activeGame);

    // Notify players (sanitize state per-player for card games)
    for (const pid of playerIds) {
      const role = activeGame.roles[pid];
      this.io.to(pid).emit('minigame:start', {
        gameId,
        instanceId,
        role,
        state: this._sanitizeState(gameId, activeGame.gameState, role)
      });
    }

    console.log(`[Minigame] Started ${gameId} (${instanceId}) in lobby ${lobbyCode} with ${playerIds.length} players`);
  }

  // Sanitize state so each player only sees their own hand
  _sanitizeState(gameId, gameState, role) {
    const game = this.games[gameId];
    if (game && game.getSanitizedState) {
      return game.getSanitizedState(gameState, role);
    }

    if (!gameState.hands) return gameState;
    // Only sanitize card games (tongits, uno, etc.)
    if (gameId !== 'tongits' && gameId !== 'uno') return gameState;

    const copy = JSON.parse(JSON.stringify(gameState));
    for (const r of Object.keys(copy.hands)) {
      if (r !== role && copy.hands[r]) {
        copy.hands[r] = copy.hands[r].map(() => ({ rank: '?', suit: '?', value: 0, order: -1, id: -1 }));
      }
    }
    // Hide stock contents
    copy.stock = new Array(copy.stock.length);
    return copy;
  }

  handleMove(socketId, lobbyCode, data) {
    const state = this._getLobbyState(lobbyCode);
    const instanceId = state.playerGameMap.get(socketId);
    if (!instanceId) return;

    const activeGame = state.activeGames.get(instanceId);
    if (!activeGame || !activeGame.players.includes(socketId)) return;

    const game = this.games[activeGame.id];
    const role = activeGame.roles[socketId];

    const result = game.handleMove(activeGame.gameState, role, data);
    activeGame.gameState = result.state;

    const endCheck = game.checkEnd(activeGame.gameState);

    // Broadcast update to each player with sanitized state
    for (const pid of activeGame.players) {
      const r = activeGame.roles[pid];
      this.io.to(pid).emit('minigame:update',
        this._sanitizeState(activeGame.id, activeGame.gameState, r)
      );
    }

    if (endCheck.ended) {
      setTimeout(() => {
        this._endGame(lobbyCode, state, instanceId, endCheck.winner, false);
      }, 2000);
    }
  }

  handleExit(socketId, lobbyCode) {
    const state = this._getLobbyState(lobbyCode);
    const instanceId = state.playerGameMap.get(socketId);
    if (!instanceId) return;

    const activeGame = state.activeGames.get(instanceId);
    if (!activeGame || !activeGame.players.includes(socketId)) return;

    const game = this.games[activeGame.id];
    const role = activeGame.roles[socketId];

    // If the game supports mid-game leave (e.g. poker), fold the player out
    if (game.handlePlayerLeave && activeGame.players.length > 2) {
      game.handlePlayerLeave(activeGame.gameState, role);

      // Remove from active player list
      activeGame.players = activeGame.players.filter(p => p !== socketId);
      state.playerGameMap.delete(socketId);

      // Broadcast updated state to remaining players
      for (const pid of activeGame.players) {
        const r = activeGame.roles[pid];
        this.io.to(pid).emit('minigame:update',
          this._sanitizeState(activeGame.id, activeGame.gameState, r)
        );
      }

      // Notify the leaving player
      this.io.to(socketId).emit('minigame:end', { winner: null, disconnected: false });

      // Check if the game ended after the leave
      const endCheck = game.checkEnd(activeGame.gameState);
      if (endCheck.ended) {
        setTimeout(() => {
          this._endGame(lobbyCode, state, instanceId, endCheck.winner, false);
        }, 2000);
      }

      console.log(`[Minigame] ${socketId} (${role}) left ${activeGame.id} in lobby ${lobbyCode}`);
      return;
    }

    // Default behavior: end the game for everyone
    this._endGame(lobbyCode, state, instanceId, null, true);
  }

  _endGame(lobbyCode, state, instanceId, winner, disconnected) {
    const activeGame = state.activeGames.get(instanceId);
    if (!activeGame) return;

    for (const pid of activeGame.players) {
      this.io.to(pid).emit('minigame:end', { winner, disconnected });
      state.playerGameMap.delete(pid);
    }

    console.log(`[Minigame] Ended ${activeGame.id} (${instanceId}) in lobby ${lobbyCode}`);
    state.activeGames.delete(instanceId);
  }
}

module.exports = MinigameManager;
