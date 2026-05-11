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
        queues: {},          // gameId -> [socketId, ...]
        readyLobby: null,    // { gameId, players: { socketId: { ready: bool } } }
        activeGame: null
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

    // Remove from ready lobby
    if (state.readyLobby && state.readyLobby.players[socketId]) {
      delete state.readyLobby.players[socketId];
      if (Object.keys(state.readyLobby.players).length === 0) {
        state.readyLobby = null;
      } else {
        this._broadcastReadyLobby(lobbyCode, state);
      }
    }

    // End active game if they are in it
    if (state.activeGame && state.activeGame.players.includes(socketId)) {
      this.handleExit(socketId, lobbyCode);
    }
  }

  // ── Queue-based system ──────────────────────────────

  handleQueue(socketId, lobbyCode, gameId) {
    const state = this._getLobbyState(lobbyCode);
    if (state.activeGame) return;

    const game = this.games[gameId];
    if (!game) return;

    // Remove from other queues/lobbies
    for (const gid of Object.keys(state.queues)) {
      state.queues[gid] = state.queues[gid].filter(id => id !== socketId);
    }

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

    // Leave ready lobby
    if (state.readyLobby && state.readyLobby.players[socketId]) {
      delete state.readyLobby.players[socketId];
      console.log(`[Minigame] ${socketId} left ready lobby in ${lobbyCode}`);
      if (Object.keys(state.readyLobby.players).length === 0) {
        state.readyLobby = null;
      } else {
        this._broadcastReadyLobby(lobbyCode, state);
      }
    }

    this.io.to(socketId).emit('minigame:waiting-cancelled');
  }

  // ── Ready-up lobby for flexible player count games ──

  _joinReadyLobby(socketId, lobbyCode, gameId, state) {
    // Create lobby if needed, or join existing one for same game
    if (!state.readyLobby || state.readyLobby.gameId !== gameId) {
      state.readyLobby = { gameId, players: {} };
    }

    const game = this.games[gameId];
    const maxPlayers = game.maxPlayers || 5;
    if (Object.keys(state.readyLobby.players).length >= maxPlayers) {
      this.io.to(socketId).emit('minigame:waiting-cancelled');
      return;
    }

    state.readyLobby.players[socketId] = { ready: false };
    console.log(`[Minigame] ${socketId} joined ready lobby for ${gameId} (${Object.keys(state.readyLobby.players).length} players)`);

    this._broadcastReadyLobby(lobbyCode, state);
  }

  handleReady(socketId, lobbyCode, ready) {
    const state = this._getLobbyState(lobbyCode);
    if (!state.readyLobby || !state.readyLobby.players[socketId]) return;

    state.readyLobby.players[socketId].ready = !!ready;
    console.log(`[Minigame] ${socketId} ready=${ready} in lobby ${lobbyCode}`);

    this._broadcastReadyLobby(lobbyCode, state);

    // Check if all ready and minimum met
    const game = this.games[state.readyLobby.gameId];
    const players = state.readyLobby.players;
    const ids = Object.keys(players);
    const minPlayers = game.minPlayers || 2;
    const allReady = ids.every(id => players[id].ready);

    if (allReady && ids.length >= minPlayers) {
      const gameId = state.readyLobby.gameId;
      state.readyLobby = null;
      this._startGame(lobbyCode, state, gameId, ids);
    }
  }

  _broadcastReadyLobby(lobbyCode, state) {
    if (!state.readyLobby) return;
    const game = this.games[state.readyLobby.gameId];
    const lobbyInfo = {
      gameId: state.readyLobby.gameId,
      gameName: game.name,
      minPlayers: game.minPlayers || 2,
      maxPlayers: game.maxPlayers || 5,
      players: Object.entries(state.readyLobby.players).map(([id, p]) => ({
        id,
        ready: p.ready,
      })),
    };
    for (const pid of Object.keys(state.readyLobby.players)) {
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

    state.activeGame = {
      id: gameId,
      players: playerIds,
      gameState,
      roles: {}
    };

    for (let i = 0; i < playerIds.length; i++) {
      state.activeGame.roles[playerIds[i]] = roles[i];
    }

    // Clear all queues & ready lobby
    state.queues = {};
    state.readyLobby = null;

    // Notify players (sanitize state per-player for card games)
    for (const pid of playerIds) {
      const role = state.activeGame.roles[pid];
      this.io.to(pid).emit('minigame:start', {
        gameId,
        role,
        state: this._sanitizeState(gameId, state.activeGame.gameState, role)
      });
    }

    console.log(`[Minigame] Started ${gameId} in lobby ${lobbyCode} with ${playerIds.length} players`);
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
    if (!state.activeGame || !state.activeGame.players.includes(socketId)) return;

    const game = this.games[state.activeGame.id];
    const role = state.activeGame.roles[socketId];

    const result = game.handleMove(state.activeGame.gameState, role, data);
    state.activeGame.gameState = result.state;

    const endCheck = game.checkEnd(state.activeGame.gameState);

    // Broadcast update to each player with sanitized state
    for (const pid of state.activeGame.players) {
      const r = state.activeGame.roles[pid];
      this.io.to(pid).emit('minigame:update',
        this._sanitizeState(state.activeGame.id, state.activeGame.gameState, r)
      );
    }

    if (endCheck.ended) {
      setTimeout(() => {
        this._endGame(lobbyCode, state, endCheck.winner, false);
      }, 2000);
    }
  }

  handleExit(socketId, lobbyCode) {
    const state = this._getLobbyState(lobbyCode);
    if (!state.activeGame || !state.activeGame.players.includes(socketId)) return;

    const game = this.games[state.activeGame.id];
    const role = state.activeGame.roles[socketId];

    // If the game supports mid-game leave (e.g. poker), fold the player out
    if (game.handlePlayerLeave && state.activeGame.players.length > 2) {
      game.handlePlayerLeave(state.activeGame.gameState, role);

      // Remove from active player list
      state.activeGame.players = state.activeGame.players.filter(p => p !== socketId);

      // Broadcast updated state to remaining players
      for (const pid of state.activeGame.players) {
        const r = state.activeGame.roles[pid];
        this.io.to(pid).emit('minigame:update',
          this._sanitizeState(state.activeGame.id, state.activeGame.gameState, r)
        );
      }

      // Notify the leaving player
      this.io.to(socketId).emit('minigame:end', { winner: null, disconnected: false });

      // Check if the game ended after the leave
      const endCheck = game.checkEnd(state.activeGame.gameState);
      if (endCheck.ended) {
        setTimeout(() => {
          this._endGame(lobbyCode, state, endCheck.winner, false);
        }, 2000);
      }

      console.log(`[Minigame] ${socketId} (${role}) left poker in lobby ${lobbyCode}`);
      return;
    }

    // Default behavior: end the game for everyone
    this._endGame(lobbyCode, state, null, true);
  }

  _endGame(lobbyCode, state, winner, disconnected) {
    if (!state.activeGame) return;

    for (const pid of state.activeGame.players) {
      this.io.to(pid).emit('minigame:end', { winner, disconnected });
    }

    console.log(`[Minigame] Ended ${state.activeGame.id} in lobby ${lobbyCode}`);
    state.activeGame = null;
  }
}

module.exports = MinigameManager;
