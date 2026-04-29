/**
 * PDC PIT YAWA — Main Application
 * Handles screen navigation, lobby flow, and game initialization.
 */

import { initGame, destroyGame } from './game.js';
import { ProximityManager } from './proximity.js';
import { ChatManager } from './chat.js';

// ── Constants ────────────────────────────────────
const AVATARS = ['Franco', 'Mariann', 'Gwynette', 'Aldwyn', 'Rafi'];

// ── State ────────────────────────────────────────
const state = {
  socket: null,
  mode: null,       // 'create' or 'join'
  selectedMap: null,
  selectedAvatar: null,
  playerName: '',
  lobbyCode: null,
  isHost: false,
  lobby: null,
  proximityManager: null,
  chatManager: null,
};

// ── Screen Management ────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('active');
    el.style.animation = 'none';
    el.offsetHeight; // trigger reflow
    el.style.animation = '';
  }
}

function showToast(text, type = '') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = text;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ── Socket Setup ─────────────────────────────────
function initSocket() {
  const socket = io(window.location.origin, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
  });
  state.socket = socket;

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Disconnected');
  });

  // Someone joined
  socket.on('player-joined', ({ player, lobby }) => {
    state.lobby = lobby;
    updatePlayerCount(lobby.players.length);
    showToast(`${player.name} joined the lobby`);
    // Game scene handles adding the sprite
    window.dispatchEvent(new CustomEvent('lobby:player-joined', { detail: { player, lobby } }));
  });

  // Someone left
  socket.on('player-left', ({ id, lobby }) => {
    state.lobby = lobby;
    updatePlayerCount(lobby.players.length);
    window.dispatchEvent(new CustomEvent('lobby:player-left', { detail: { id, lobby } }));
  });

  // Host disconnect warning
  socket.on('host-disconnecting', ({ message }) => {
    showToast(message, 'warning');
  });

  // Host left — lobby destroyed
  socket.on('host-left', ({ message }) => {
    cleanupGame();
    document.getElementById('disconnect-title').textContent = 'Lobby Closed';
    document.getElementById('disconnect-message').textContent = message;
    showScreen('screen-disconnected');
  });

  // Player movement
  socket.on('player:moved', (data) => {
    window.dispatchEvent(new CustomEvent('lobby:player-moved', { detail: data }));
  });

  // Peer registration from other players
  socket.on('peer-registered', ({ socketId, peerId }) => {
    if (state.proximityManager) {
      state.proximityManager.registerPeer(socketId, peerId);
    }
  });

  // Chat message
  socket.on('chat:message', (msg) => {
    if (state.chatManager) {
      state.chatManager.addMessage(msg);
    }
  });

  return socket;
}

// ── Avatar Grid Setup ────────────────────────────
function setupAvatarGrid() {
  const grid = document.getElementById('avatar-grid');
  grid.innerHTML = '';
  AVATARS.forEach((emoji, i) => {
    const div = document.createElement('div');
    div.className = 'avatar-option';
    div.dataset.avatarId = i;
    div.textContent = emoji;
    div.addEventListener('click', () => {
      document.querySelectorAll('.avatar-option').forEach(a => a.classList.remove('selected'));
      div.classList.add('selected');
      state.selectedAvatar = i;
      checkEnterReady();
    });
    grid.appendChild(div);
  });
}

function checkEnterReady() {
  const btn = document.getElementById('btn-enter');
  const name = document.getElementById('input-name').value.trim();
  btn.disabled = !(state.selectedAvatar !== null && name.length >= 1);
}

// ── Code Input Logic ─────────────────────────────
function setupCodeInput() {
  const digits = [0,1,2,3].map(i => document.getElementById(`input-code-${i}`));

  digits.forEach((d, i) => {
    d.addEventListener('input', () => {
      d.value = d.value.replace(/\D/g, '');
      if (d.value && i < 3) digits[i + 1].focus();
      checkCodeReady();
    });
    d.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !d.value && i > 0) {
        digits[i - 1].focus();
      }
    });
    d.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 4);
      pasted.split('').forEach((ch, idx) => {
        if (digits[idx]) digits[idx].value = ch;
      });
      checkCodeReady();
      if (pasted.length === 4) digits[3].focus();
    });
  });
}

function getCodeValue() {
  return [0,1,2,3].map(i => document.getElementById(`input-code-${i}`).value).join('');
}

function checkCodeReady() {
  document.getElementById('btn-next-join').disabled = getCodeValue().length !== 4;
}

function clearCodeInput() {
  [0,1,2,3].forEach(i => { document.getElementById(`input-code-${i}`).value = ''; });
  document.getElementById('join-error').style.display = 'none';
}

// ── Player Count ─────────────────────────────────
function updatePlayerCount(count) {
  document.getElementById('player-count-value').textContent = count;
}

// ── Cleanup ──────────────────────────────────────
function cleanupGame() {
  if (state.proximityManager) {
    state.proximityManager.destroy();
    state.proximityManager = null;
  }
  destroyGame();
  state.lobbyCode = null;
  state.lobby = null;
}

// ── Enter Game ───────────────────────────────────
function enterGame(lobbyData) {
  state.lobby = lobbyData;
  state.lobbyCode = lobbyData.code;

  // Update UI
  document.getElementById('lobby-code-value').textContent = lobbyData.code;
  updatePlayerCount(lobbyData.players.length);

  // Show game screen
  showScreen('screen-game');

  // Initialize Phaser game
  initGame({
    mapId: lobbyData.mapId,
    players: lobbyData.players,
    mySocketId: state.socket.id,
    socket: state.socket
  });

  // Initialize proximity manager
  state.proximityManager = new ProximityManager(state.socket);
  state.proximityManager.init(lobbyData.players.filter(p => p.id !== state.socket.id));

  // Initialize chat
  state.chatManager = new ChatManager(state.socket);
}

// ── Event Bindings ───────────────────────────────
function bindEvents() {
  // Landing
  document.getElementById('btn-create').addEventListener('click', () => {
    state.mode = 'create';
    showScreen('screen-map-select');
  });

  document.getElementById('btn-join').addEventListener('click', () => {
    state.mode = 'join';
    clearCodeInput();
    showScreen('screen-join');
  });

  // Map select
  document.querySelectorAll('.map-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.map-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.selectedMap = card.dataset.map;

      // Proceed to avatar screen
      state.selectedAvatar = null;
      document.querySelectorAll('.avatar-option').forEach(a => a.classList.remove('selected'));
      document.getElementById('input-name').value = '';
      document.getElementById('btn-enter').disabled = true;
      showScreen('screen-avatar');
    });
  });

  // Join code → Next
  document.getElementById('btn-next-join').addEventListener('click', () => {
    const code = getCodeValue();
    if (code.length !== 4) return;
    state.lobbyCode = code;
    state.selectedAvatar = null;
    document.querySelectorAll('.avatar-option').forEach(a => a.classList.remove('selected'));
    document.getElementById('input-name').value = '';
    document.getElementById('btn-enter').disabled = true;
    showScreen('screen-avatar');
  });

  // Avatar / name
  document.getElementById('input-name').addEventListener('input', checkEnterReady);

  document.getElementById('btn-enter').addEventListener('click', () => {
    const name = document.getElementById('input-name').value.trim();
    if (!name || state.selectedAvatar === null) return;

    state.playerName = name;
    const btn = document.getElementById('btn-enter');
    btn.disabled = true;
    btn.textContent = 'Connecting...';

    if (state.mode === 'create') {
      state.socket.emit('create-lobby', {
        playerName: name,
        avatarId: state.selectedAvatar,
        mapId: state.selectedMap
      }, (res) => {
        btn.textContent = 'Enter Lobby';
        if (res.success) {
          state.isHost = true;
          enterGame(res.lobby);
        } else {
          showToast(res.error || 'Failed to create lobby');
          btn.disabled = false;
        }
      });
    } else {
      state.socket.emit('join-lobby', {
        code: state.lobbyCode,
        playerName: name,
        avatarId: state.selectedAvatar
      }, (res) => {
        btn.textContent = 'Enter Lobby';
        if (res.success) {
          state.isHost = false;
          enterGame(res.lobby);
        } else {
          showToast(res.error || 'Failed to join lobby');
          btn.disabled = false;
        }
      });
    }
  });

  // Back buttons
  document.getElementById('btn-back-map').addEventListener('click', () => showScreen('screen-landing'));
  document.getElementById('btn-back-avatar').addEventListener('click', () => {
    showScreen(state.mode === 'create' ? 'screen-map-select' : 'screen-join');
  });
  document.getElementById('btn-back-join').addEventListener('click', () => showScreen('screen-landing'));

  // Copy code
  document.getElementById('btn-copy-code').addEventListener('click', () => {
    navigator.clipboard.writeText(state.lobbyCode || '');
    showToast('Code copied!');
  });

  // Leave
  document.getElementById('btn-leave').addEventListener('click', () => {
    if (confirm(state.isHost ? 'Leaving will close the lobby for everyone. Leave?' : 'Leave the lobby?')) {
      cleanupGame();
      state.socket.disconnect();
      state.socket = initSocket();
      showScreen('screen-landing');
    }
  });

  // Disconnect screen → home
  document.getElementById('btn-go-home').addEventListener('click', () => {
    state.socket.disconnect();
    state.socket = initSocket();
    showScreen('screen-landing');
  });
}

// ── Init ─────────────────────────────────────────
function init() {
  initSocket();
  setupAvatarGrid();
  setupCodeInput();
  bindEvents();
}

init();
