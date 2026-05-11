module.exports = {
  id: 'connect4',
  name: 'Connect 4',
  minPlayers: 2,
  maxPlayers: 2,
  flexibleStart: true,
  playerCount: 2,
  roles: ['Red', 'Yellow'],

  createState: () => ({
    board: Array(42).fill(null),
    turn: 'Red',
    winner: null,
    isDraw: false,
    winningCells: null,
    lastMove: null
  }),

  handleMove(state, playerRole, data) {
    if (state.winner || state.isDraw) return { state, events: [] };
    if (state.turn !== playerRole) return { state, events: [] };

    const { column } = data;
    if (column < 0 || column > 6) return { state, events: [] };

    // Find lowest empty row
    let targetRow = -1;
    for (let r = 5; r >= 0; r--) {
      if (state.board[r * 7 + column] === null) {
        targetRow = r;
        break;
      }
    }

    if (targetRow === -1) return { state, events: [] };

    const cellIndex = targetRow * 7 + column;
    state.board[cellIndex] = playerRole;
    state.lastMove = { row: targetRow, col: column, role: playerRole };
    state.turn = playerRole === 'Red' ? 'Yellow' : 'Red';
    return { state, events: [] };
  },

  checkEnd(state) {
    const cols = 7;
    const rows = 6;
    const board = state.board;

    const checkLine = (r, c, dr, dc) => {
      const val = board[r * cols + c];
      if (!val) return null;
      for (let i = 1; i < 4; i++) {
        const nr = r + dr * i;
        const nc = c + dc * i;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || board[nr * cols + nc] !== val) {
          return null;
        }
      }
      return [
        r * cols + c,
        (r + dr) * cols + (c + dc),
        (r + dr * 2) * cols + (c + dc * 2),
        (r + dr * 3) * cols + (c + dc * 3)
      ];
    };

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (c <= cols - 4) {
          const win = checkLine(r, c, 0, 1);
          if (win) { state.winner = board[win[0]]; state.winningCells = win; return { ended: true, winner: state.winner, state }; }
        }
        if (r <= rows - 4) {
          const win = checkLine(r, c, 1, 0);
          if (win) { state.winner = board[win[0]]; state.winningCells = win; return { ended: true, winner: state.winner, state }; }
        }
        if (r >= 3 && c <= cols - 4) {
          const win = checkLine(r, c, -1, 1);
          if (win) { state.winner = board[win[0]]; state.winningCells = win; return { ended: true, winner: state.winner, state }; }
        }
        if (r <= rows - 4 && c <= cols - 4) {
          const win = checkLine(r, c, 1, 1);
          if (win) { state.winner = board[win[0]]; state.winningCells = win; return { ended: true, winner: state.winner, state }; }
        }
      }
    }

    if (!board.includes(null)) {
      state.isDraw = true;
      return { ended: true, winner: null, state };
    }
    return { ended: false };
  }
};
