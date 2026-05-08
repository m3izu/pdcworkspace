/**
 * SnappyWorld — Main Server
 * 
 * Express + Socket.io + PeerJS server
 * Handles lobby management, player sync, and chat.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { ExpressPeerServer } = require('peer');
const path = require('path');
const cors = require('cors');
const LobbyManager = require('./lobbyManager');
const MinigameManager = require('./minigames/manager');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);

// ── Socket.io ────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// ── PeerJS Server ────────────────────────────────────────
const peerServer = ExpressPeerServer(server, {
  debug: process.env.NODE_ENV === 'production' ? false : true,
  path: '/',
  allow_discovery: false
});
app.use('/peerjs', peerServer);

// ── Static Files ─────────────────────────────────────────
app.use(cors());
app.use(express.static(path.join(__dirname, '..', 'client')));

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  if (req.path.startsWith('/peerjs')) return;
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

// ── Lobby Manager ────────────────────────────────────────
const lobbyManager = new LobbyManager();

// ── Minigame Manager ─────────────────────────────────────
const minigameManager = new MinigameManager(io, lobbyManager);

// ── Socket.io Events ─────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  // ── Create Lobby ───────────────────────────────────────
  socket.on('create-lobby', ({ playerName, avatarId, mapId }, callback) => {
    try {
      const { code, lobby } = lobbyManager.createLobby(
        socket.id, playerName, avatarId, mapId
      );
      socket.join(code);
      callback({
        success: true,
        code,
        lobby: lobbyManager.serializeLobby(code)
      });
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  // ── Join Lobby ─────────────────────────────────────────
  socket.on('join-lobby', ({ code, playerName, avatarId }, callback) => {
    const result = lobbyManager.joinLobby(code, socket.id, playerName, avatarId);
    if (!result.success) {
      return callback({ success: false, error: result.error });
    }

    socket.join(code);

    // Notify everyone in the lobby about the new player
    const serialized = lobbyManager.serializeLobby(code);
    socket.to(code).emit('player-joined', {
      player: serialized.players.find(p => p.id === socket.id),
      lobby: serialized
    });

    callback({ success: true, lobby: serialized });
  });

  // ── Player Movement ────────────────────────────────────
  socket.on('player:move', ({ x, y, direction, frame }) => {
    lobbyManager.updatePlayerPosition(socket.id, x, y, direction, frame);
  });

  // ── PeerJS ID Registration ─────────────────────────────
  socket.on('register-peer', ({ peerId }) => {
    lobbyManager.setPlayerPeerId(socket.id, peerId);
    const code = lobbyManager.getPlayerLobbyCode(socket.id);
    if (code) {
      socket.to(code).emit('peer-registered', {
        socketId: socket.id,
        peerId
      });
    }
  });

  // ── Chat Message ───────────────────────────────────────
  socket.on('chat:message', ({ text }) => {
    const code = lobbyManager.getPlayerLobbyCode(socket.id);
    if (!code) return;

    const lobby = lobbyManager.getLobby(code);
    if (!lobby) return;

    const player = lobby.players.get(socket.id);
    if (!player) return;

    const message = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      senderId: socket.id,
      senderName: player.name,
      text: text.trim().substring(0, 500), // Max 500 chars
      timestamp: Date.now()
    };

    io.to(code).emit('chat:message', message);
  });

  // ── Minigames ──────────────────────────────────────────
  socket.on('minigame:queue', ({ gameId }) => {
    const code = lobbyManager.getPlayerLobbyCode(socket.id);
    if (code) minigameManager.handleQueue(socket.id, code, gameId);
  });

  socket.on('minigame:dequeue', () => {
    const code = lobbyManager.getPlayerLobbyCode(socket.id);
    if (code) minigameManager.handleDequeue(socket.id, code);
  });

  socket.on('minigame:ready', ({ ready }) => {
    const code = lobbyManager.getPlayerLobbyCode(socket.id);
    if (code) minigameManager.handleReady(socket.id, code, ready);
  });

  socket.on('minigame:step-on', ({ x, y }) => {
    const code = lobbyManager.getPlayerLobbyCode(socket.id);
    if (code) minigameManager.handleStepOn(socket.id, code, x, y);
  });

  socket.on('minigame:step-off', ({ x, y }) => {
    const code = lobbyManager.getPlayerLobbyCode(socket.id);
    if (code) minigameManager.handleStepOff(socket.id, code, x, y);
  });

  socket.on('minigame:move', (data) => {
    const code = lobbyManager.getPlayerLobbyCode(socket.id);
    if (code) minigameManager.handleMove(socket.id, code, data);
  });

  socket.on('minigame:exit', () => {
    const code = lobbyManager.getPlayerLobbyCode(socket.id);
    if (code) minigameManager.handleExit(socket.id, code);
  });

  // ── Disconnect ─────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);

    const { wasHost, lobbyCode, lobby } = lobbyManager.removePlayer(socket.id);

    if (lobbyCode) {
      minigameManager.removePlayer(lobbyCode, socket.id);
    }

    if (!lobbyCode) return;

    if (wasHost) {
      // Start grace period — if host doesn't return, lobby is destroyed
      lobbyManager.startHostGracePeriod(lobbyCode, (code, remainingPlayerIds) => {
        // Cleanup minigames state
        minigameManager.cleanupLobby(code);

        // Notify all remaining players
        io.to(code).emit('host-left', {
          message: 'The host has left. Lobby is closing.'
        });

        // Force everyone out of the Socket.io room
        for (const pid of remainingPlayerIds) {
          const s = io.sockets.sockets.get(pid);
          if (s) s.leave(code);
        }
      });

      // Notify others about host disconnect (they see a warning)
      socket.to(lobbyCode).emit('host-disconnecting', {
        message: 'Host disconnected. Waiting 10 seconds for reconnection...'
      });
    } else {
      // Regular player left — just notify others
      socket.to(lobbyCode).emit('player-left', {
        id: socket.id,
        lobby: lobbyManager.serializeLobby(lobbyCode)
      });
    }
  });
});

// ── Server Sync Loop (20Hz) ──────────────────────────────
setInterval(() => {
  const dirtyCodes = lobbyManager.getAndClearDirtyLobbies();
  for (const code of dirtyCodes) {
    const lobby = lobbyManager.getLobby(code);
    if (!lobby) continue;

    const positions = [];
    for (const [id, player] of lobby.players) {
      positions.push({
        id,
        x: player.x,
        y: player.y,
        direction: player.direction,
        frame: player.frame
      });
    }

    io.to(code).emit('lobby:sync', positions);
  }
}, 50);

// ── Start Server ─────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n  🎮 SnappyWorld server running`);
  console.log(`  📡 http://localhost:${PORT}`);
  console.log(`  🔌 Socket.io ready`);
  console.log(`  📹 PeerJS server at /peerjs\n`);
});
