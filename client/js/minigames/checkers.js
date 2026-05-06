/**
 * Checkers — Client UI
 * Closure-based: no shared module state between games.
 */

// ── Shared move logic (mirrors server) ─────────────
function dirs(piece) {
  if (piece.king) return [[-1,-1],[-1,1],[1,-1],[1,1]];
  return piece.color === 'red' ? [[1,-1],[1,1]] : [[-1,-1],[-1,1]];
}

function jumpsFrom(board, r, c, piece) {
  const out = [];
  for (const [dr, dc] of dirs(piece)) {
    const mr = r+dr, mc = c+dc, jr = r+dr*2, jc = c+dc*2;
    if (jr>=0&&jr<8&&jc>=0&&jc<8
      && board[mr]?.[mc]?.color && board[mr][mc].color !== piece.color
      && !board[jr]?.[jc])
      out.push({r: jr, c: jc});
  }
  return out;
}

function simplesFrom(board, r, c, piece) {
  const out = [];
  for (const [dr, dc] of dirs(piece)) {
    const nr = r+dr, nc = c+dc;
    if (nr>=0&&nr<8&&nc>=0&&nc<8 && !board[nr]?.[nc])
      out.push({r: nr, c: nc});
  }
  return out;
}

function destinations(board, r, c, myColor, mustFrom) {
  const piece = board[r]?.[c];
  if (!piece || piece.color !== myColor) return [];
  if (mustFrom && (mustFrom.r !== r || mustFrom.c !== c)) return [];
  // Mandatory capture check
  let anyJump = false;
  outer: for (let tr = 0; tr < 8; tr++)
    for (let tc = 0; tc < 8; tc++) {
      const p = board[tr]?.[tc];
      if (!p || p.color !== myColor) continue;
      if (mustFrom && (mustFrom.r !== tr || mustFrom.c !== tc)) continue;
      if (jumpsFrom(board, tr, tc, p).length > 0) { anyJump = true; break outer; }
    }
  return anyJump ? jumpsFrom(board, r, c, piece) : simplesFrom(board, r, c, piece);
}

// ── Board renderer ──────────────────────────────────
function paint(container, state, myRole, selected, validMoves) {
  const statusEl = container.querySelector('#chk-status');
  if (statusEl) {
    if (state.winner) {
      statusEl.textContent = state.winner === myRole
        ? 'Congratulations! You Win! 🎉' : 'You Lose! 💀';
      statusEl.className = 'chk-status win';
    } else {
      const mine = state.turn === myRole;
      statusEl.textContent = mine
        ? (state.mustJumpFrom ? 'Continue jumping!' : 'Your Turn')
        : "Opponent's Turn...";
      statusEl.className = `chk-status ${mine ? 'your-turn' : 'opponent-turn'}`;
    }
  }

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = container.querySelector(`[data-r="${r}"][data-c="${c}"]`);
      if (!cell) continue;
      cell.className = `chk-cell ${(r+c)%2===0 ? 'light' : 'dark'}`;
      cell.innerHTML = '';
      if (selected?.r===r && selected?.c===c)                cell.classList.add('selected');
      if (validMoves.some(m => m.r===r && m.c===c))          cell.classList.add('valid-move');
      if (state.mustJumpFrom?.r===r && state.mustJumpFrom?.c===c) cell.classList.add('must-jump');
      const piece = state.board[r]?.[c];
      if (piece) {
        const el = document.createElement('div');
        el.className = `chk-piece ${piece.color}${piece.king ? ' king' : ''}`;
        el.innerHTML = piece.king ? '♛' : '';
        cell.appendChild(el);
      }
    }
  }
}

export default {
  id: 'checkers',

  render(container, state, myRole, onMove) {
    let selected = null;
    let validMoves = [];
    let cur = state; // latest state

    container.innerHTML = `
      <div class="checkers-container">
        <details class="game-instructions">
          <summary>📖 How to Play</summary>
          <ul>
            <li>You are <strong class="chk-role-color ${myRole}">${myRole.toUpperCase()}</strong>. Red moves first, diagonally downward.</li>
            <li><strong>Click a piece</strong> to select it, then click a highlighted cell to move.</li>
            <li>Jump over an opponent's piece to <strong>capture</strong> it. Captures are mandatory!</li>
            <li>You can chain multiple jumps in one turn if available.</li>
            <li>Reach the opposite end to become a <strong>King ♛</strong> — Kings move in all 4 diagonal directions.</li>
            <li>Win by capturing all opponent pieces or leaving them with no moves.</li>
          </ul>
        </details>
        <div id="chk-status" class="chk-status"></div>
        <div class="chk-role-badge">You are <span class="chk-role-color ${myRole}">${myRole.toUpperCase()}</span></div>
        <div class="chk-board" id="chk-board">
          ${Array.from({length:8}, (_, r) =>
            Array.from({length:8}, (_, c) =>
              `<div class="chk-cell ${(r+c)%2===0?'light':'dark'}" data-r="${r}" data-c="${c}"></div>`
            ).join('')
          ).join('')}
        </div>
      </div>`;

    // Expose update hook via container so update() can reach the closure
    container._chkUpdate = (newState) => {
      cur = newState;
      // Auto-select forced piece during multi-jump
      if (newState.mustJumpFrom && newState.turn === myRole) {
        selected = { r: newState.mustJumpFrom.r, c: newState.mustJumpFrom.c };
        validMoves = destinations(newState.board, selected.r, selected.c, myRole, newState.mustJumpFrom);
      } else if (newState.turn !== myRole) {
        selected = null;
        validMoves = [];
      }
      paint(container, newState, myRole, selected, validMoves);
    };

    const boardEl = container.querySelector('#chk-board');
    boardEl.addEventListener('click', (e) => {
      const cell = e.target.closest('[data-r]');
      if (!cell) return;
      const r = parseInt(cell.dataset.r);
      const c = parseInt(cell.dataset.c);

      if (cur.winner || cur.turn !== myRole) return;

      // Clicking a valid destination → send move
      if (validMoves.some(m => m.r===r && m.c===c)) {
        onMove({ from: { r: selected.r, c: selected.c }, to: { r, c } });
        selected = null;
        validMoves = [];
        paint(container, cur, myRole, selected, validMoves);
        return;
      }

      // Clicking own piece → select
      const piece = cur.board[r]?.[c];
      if (piece && piece.color === myRole) {
        selected = { r, c };
        validMoves = destinations(cur.board, r, c, myRole, cur.mustJumpFrom);
        paint(container, cur, myRole, selected, validMoves);
        return;
      }

      // Clicking elsewhere → deselect
      selected = null;
      validMoves = [];
      paint(container, cur, myRole, selected, validMoves);
    });

    paint(container, state, myRole, selected, validMoves);
  },

  update(container, state) {
    if (container._chkUpdate) container._chkUpdate(state);
  },

  destroy(container) {
    container._chkUpdate = null;
    container.innerHTML = '';
  }
};
