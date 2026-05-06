export default {
  id: 'tictactoe',
  name: 'Tic-Tac-Toe',

  render: (container, state, myRole, onMove) => {
    container.innerHTML = `
      <div class="tictactoe-container">
        <details class="game-instructions">
          <summary>📖 How to Play</summary>
          <ul>
            <li>You are <strong>${myRole}</strong>. ${myRole === 'X' ? 'X goes first.' : 'O goes second.'}</li>
            <li>Click any empty cell to place your mark.</li>
            <li>Get <strong>3 in a row</strong> — horizontally, vertically, or diagonally — to win!</li>
            <li>If all 9 cells fill up with no winner, it's a <strong>Draw</strong>.</li>
          </ul>
        </details>
        <div id="ttt-status" class="ttt-status"></div>
        <div class="ttt-board" id="ttt-board">
          ${Array(9).fill(0).map((_, i) => `<div class="ttt-cell" data-index="${i}"></div>`).join('')}
        </div>
      </div>
    `;

    const boardEl = container.querySelector('#ttt-board');
    boardEl.addEventListener('click', (e) => {
      const cell = e.target.closest('.ttt-cell');
      if (!cell) return;
      const index = parseInt(cell.dataset.index, 10);
      onMove({ cell: index });
    });

    // Initial update to populate board
    update(container, state, myRole);
  },

  update: (container, state, myRole) => {
    const statusEl = container.querySelector('#ttt-status');
    const cells = container.querySelectorAll('.ttt-cell');

    // Update board cells
    for (let i = 0; i < 9; i++) {
      const val = state.board[i];
      cells[i].textContent = val || '';
      cells[i].className = 'ttt-cell'; // reset classes
      if (val) {
        cells[i].classList.add(val.toLowerCase());
        cells[i].classList.add('taken');
      }
    }

    // Highlight winning line
    if (state.winningLine) {
      for (const i of state.winningLine) {
        cells[i].style.background = 'var(--accent-glow)';
      }
    }

    // Update status text
    if (state.winner) {
      statusEl.textContent = state.winner === myRole ? 'Congratulations! You Win! 🎉' : 'You Lose! 💀';
      statusEl.className = 'ttt-status win';
    } else if (state.isDraw) {
      statusEl.textContent = 'Draw! 🤝';
      statusEl.className = 'ttt-status';
    } else {
      const isMyTurn = state.turn === myRole;
      statusEl.textContent = isMyTurn ? 'Your Turn' : 'Waiting for opponent...';
      statusEl.className = `ttt-status ${isMyTurn ? 'your-turn' : 'opponent-turn'}`;
    }
  },

  destroy: (container) => {
    container.innerHTML = '';
  }
};

// Exporting update specifically since we need it in the object but also need to call it inside render
function update(container, state, myRole) {
  const statusEl = container.querySelector('#ttt-status');
  const cells = container.querySelectorAll('.ttt-cell');

  for (let i = 0; i < 9; i++) {
    const val = state.board[i];
    cells[i].textContent = val || '';
    cells[i].className = 'ttt-cell';
    if (val) {
      cells[i].classList.add(val.toLowerCase());
      cells[i].classList.add('taken');
    }
  }

  if (state.winningLine) {
    for (const i of state.winningLine) {
      cells[i].style.background = 'var(--accent-glow)';
    }
  }

  if (state.winner) {
    statusEl.textContent = state.winner === myRole ? 'Congratulations! You Win! 🎉' : 'You Lose! 💀';
    statusEl.className = 'ttt-status win';
  } else if (state.isDraw) {
    statusEl.textContent = 'Draw! 🤝';
    statusEl.className = 'ttt-status';
  } else {
    const isMyTurn = state.turn === myRole;
    statusEl.textContent = isMyTurn ? 'Your Turn' : 'Waiting for opponent...';
    statusEl.className = `ttt-status ${isMyTurn ? 'your-turn' : 'opponent-turn'}`;
  }
}
