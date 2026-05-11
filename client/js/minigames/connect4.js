export default {
  id: 'connect4',
  name: 'Connect 4',

  render: (container, state, myRole, onMove) => {
    container.innerHTML = `
      <div class="connect4-container">
        <details class="game-instructions">
          <summary>📖 How to Play</summary>
          <ul>
            <li>You are <strong>${myRole}</strong>. ${myRole === 'Red' ? 'Red goes first.' : 'Yellow goes second.'}</li>
            <li>Click any column to drop your piece.</li>
            <li>Get <strong>4 in a row</strong> — horizontally, vertically, or diagonally — to win!</li>
          </ul>
        </details>
        <div id="c4-status" class="c4-status"></div>
        <div class="c4-board" id="c4-board">
          ${Array(7).fill(0).map((_, col) => `
            <div class="c4-col" data-col="${col}">
              ${Array(6).fill(0).map((_, row) => `
                <div class="c4-cell" data-index="${row * 7 + col}">
                  <div class="c4-piece-slot"></div>
                </div>
              `).join('')}
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const boardEl = container.querySelector('#c4-board');
    boardEl.addEventListener('click', (e) => {
      const colEl = e.target.closest('.c4-col');
      if (!colEl) return;
      const col = parseInt(colEl.dataset.col, 10);
      onMove({ column: col });
    });

    update(container, state, myRole);
  },

  update: (container, state, myRole) => {
    update(container, state, myRole);
  },

  destroy: (container) => {
    container.innerHTML = '';
  }
};

function update(container, state, myRole) {
  const statusEl = container.querySelector('#c4-status');
  const pieceSlots = container.querySelectorAll('.c4-piece-slot');

  for (let i = 0; i < 42; i++) {
    // Determine row and col for indexing back to our DOM structure
    // Wait, the DOM structure is columns first, then rows!
    // DOM indexing inside querySelectorAll might follow document flow.
    // Each .c4-col contains 6 .c4-cell elements.
    // So slot indices in DOM: 0 to 5 are col 0 (rows 0-5), 6 to 11 are col 1 (rows 0-5), etc.
  }

  // Actually, to make it easier to map from state array (row major) to DOM elements,
  // we can just use querySelector by data-index!
  for (let i = 0; i < 42; i++) {
    const val = state.board[i];
    const cellEl = container.querySelector(`.c4-cell[data-index="${i}"] .c4-piece-slot`);
    
    if (val) {
      if (!cellEl.classList.contains(val.toLowerCase())) {
        cellEl.className = 'c4-piece-slot ' + val.toLowerCase();
        // If this was the last move, animate it
        if (state.lastMove && state.lastMove.row * 7 + state.lastMove.col === i) {
          // Remove and re-add class to trigger animation
          cellEl.classList.add('dropping');
        }
      }
    } else {
      cellEl.className = 'c4-piece-slot empty';
    }
    cellEl.parentElement.style.background = ''; // reset win highlight
  }

  if (state.winningCells) {
    for (const i of state.winningCells) {
      const cellEl = container.querySelector(`.c4-cell[data-index="${i}"]`);
      cellEl.style.background = 'var(--accent-glow)';
    }
  }

  if (state.winner) {
    statusEl.textContent = state.winner === myRole ? 'Congratulations! You Win! 🎉' : 'You Lose! 💀';
    statusEl.className = 'c4-status win';
  } else if (state.isDraw) {
    statusEl.textContent = 'Draw! 🤝';
    statusEl.className = 'c4-status';
  } else {
    const isMyTurn = state.turn === myRole;
    statusEl.textContent = isMyTurn ? 'Your Turn' : 'Waiting for opponent...';
    statusEl.className = `c4-status ${isMyTurn ? 'your-turn' : 'opponent-turn'}`;
  }
}
