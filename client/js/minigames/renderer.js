import tictactoe  from './tictactoe.js';
import checkers   from './checkers.js';
import battleship from './battleship.js';
import tongits    from './tongits.js';
import uno        from './uno.js';
import * as poker from './poker.js';

class MinigameRenderer {
  constructor() {
    this.games = {
      [tictactoe.id]:  tictactoe,
      [checkers.id]:   checkers,
      [battleship.id]: battleship,
      [tongits.id]:    tongits,
      [uno.id]:        uno,
      poker:           {
        id: 'poker',
        name: "Texas Hold'em",
        render: poker.createPokerUI,
        update: (container, state, myRole) => { if (container._pokerUpdate) container._pokerUpdate(state); }
      }
    };

    this.activeGameId = null;
    this.myRole = null;
    this.socket = null;

    this.overlay = document.getElementById('minigame-overlay');
    this.container = document.getElementById('minigame-content');
    this.title = document.getElementById('minigame-title');
    this.btnExit = document.getElementById('btn-minigame-exit');

    this.btnExit.addEventListener('click', () => this.handleExit());
  }

  init(socket) {
    this.socket = socket;

    this.socket.on('minigame:start', ({ gameId, role, state }) => {
      this.startGame(gameId, role, state);
    });

    this.socket.on('minigame:update', (state) => {
      this.updateGame(state);
    });

    this.socket.on('minigame:end', ({ winner, disconnected }) => {
      if (disconnected) {
        this.showToast('Opponent disconnected. Game ended.', 'warning');
        this.endGame();
      } else {
        // The update event handles showing Win/Loss/Draw text.
        // We just change the exit button to "Close"
        this.btnExit.textContent = 'Close';
      }
    });

    this.socket.on('minigame:waiting', () => {
      this.showToast('Waiting for opponent to step on tile...', 'info');
    });

    this.socket.on('minigame:waiting-cancelled', () => {
      // Could hide a toast if we had a persistent one
    });

    // Ready-up lobby for flexible player count games
    this.socket.on('minigame:ready-lobby', (lobbyInfo) => {
      this.showReadyLobby(lobbyInfo);
    });
  }

  showReadyLobby(info) {
    const myId = this.socket.id;
    const me = info.players.find(p => p.id === myId);
    if (!me) return;

    this.title.textContent = `${info.gameName} — Waiting Room`;
    this.overlay.className = `minigame-overlay theme-${info.gameId}`;
    this.overlay.style.display = 'flex';
    this.btnExit.textContent = 'Leave';

    const readyCount = info.players.filter(p => p.ready).length;
    const canStart = readyCount === info.players.length && info.players.length >= info.minPlayers;

    this.container.innerHTML = `
      <div class="ready-lobby">
        <div class="ready-lobby-info">${info.players.length} / ${info.maxPlayers} players joined (min ${info.minPlayers})</div>
        <div class="ready-lobby-players">
          ${info.players.map(p => `
            <div class="ready-player ${p.ready ? 'is-ready' : ''}">
              <span class="ready-dot">${p.ready ? '✅' : '⬜'}</span>
              <span class="ready-name">${p.id === myId ? 'You' : p.id.slice(0, 6)}</span>
            </div>
          `).join('')}
        </div>
        <button class="btn ready-toggle-btn ${me.ready ? 'ready-on' : ''}" id="btn-ready-toggle">
          ${me.ready ? '✅ Ready!' : '☐ Click to Ready Up'}
        </button>
        ${canStart ? '<div class="ready-starting">All ready — starting...</div>' : ''}
      </div>`;

    const toggleBtn = this.container.querySelector('#btn-ready-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.socket.emit('minigame:ready', { ready: !me.ready });
      });
    }

    if (window.__gameScene) window.__gameScene.isMinigameActive = true;
  }

  startGame(gameId, role, state) {
    const game = this.games[gameId];
    if (!game) return;

    this.activeGameId = gameId;
    this.myRole = role;

    // Show overlay
    this.title.textContent = game.name || gameId;
    this.overlay.className = `minigame-overlay theme-${gameId}`;
    this.overlay.style.display = 'flex';
    this.btnExit.textContent = 'Exit Game';

    // Render game
    game.render(this.container, state, role, (data) => {
      this.socket.emit('minigame:move', data);
    });

    // Freeze player
    if (window.__gameScene) window.__gameScene.isMinigameActive = true;
  }

  updateGame(state) {
    if (!this.activeGameId) return;
    const game = this.games[this.activeGameId];
    if (game.update) game.update(this.container, state, this.myRole);
  }

  handleExit() {
    if (this.activeGameId) this.socket.emit('minigame:exit');
    this.endGame();
  }

  endGame() {
    if (this.activeGameId) {
      const game = this.games[this.activeGameId];
      if (game.destroy) game.destroy(this.container);
      this.activeGameId = null;
      this.myRole = null;
    }
    this.overlay.className = 'minigame-overlay';
    this.overlay.style.display = 'none';
    if (window.__gameScene) window.__gameScene.isMinigameActive = false;
  }

  showToast(message, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'warning' ? 'warning' : ''}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 3000);
  }
}

export default new MinigameRenderer();
