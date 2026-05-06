const WINNING_LINES = [
  [0,1,2],[3,4,5],[6,7,8], // rows
  [0,3,6],[1,4,7],[2,5,8], // cols
  [0,4,8],[2,4,6]          // diagonals
];

module.exports = {
  id: 'tictactoe',
  name: 'Tic-Tac-Toe',
  playerCount: 2,
  roles: ['X', 'O'],

  createState: () => ({
    board: Array(9).fill(null),
    turn: 'X',
    winner: null,
    isDraw: false,
    winningLine: null,
  }),

  handleMove(state, playerRole, data) {
    if (state.winner || state.isDraw) return { state, events: [] };
    if (state.turn !== playerRole) return { state, events: [] };

    const { cell } = data;
    if (cell < 0 || cell > 8 || state.board[cell] !== null) return { state, events: [] };

    state.board[cell] = playerRole;
    state.turn = playerRole === 'X' ? 'O' : 'X';
    return { state, events: [] };
  },

  checkEnd(state) {
    for (const [a, b, c] of WINNING_LINES) {
      if (state.board[a] && state.board[a] === state.board[b] && state.board[a] === state.board[c]) {
        state.winner = state.board[a];
        state.winningLine = [a, b, c];
        return { ended: true, winner: state.winner, state };
      }
    }
    if (!state.board.includes(null)) {
      state.isDraw = true;
      return { ended: true, winner: null, state };
    }
    return { ended: false };
  }
};
