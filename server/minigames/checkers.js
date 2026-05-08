/**
 * Checkers — Server-side game logic
 * - Red pieces start at top (rows 0–2), move downward
 * - Black pieces start at bottom (rows 5–7), move upward
 * - Kings can move in all 4 diagonal directions
 * - Mandatory captures enforced
 * - Multi-jump chains supported
 */

function createBoard() {
  const board = Array(8).fill(null).map(() => Array(8).fill(null));
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 8; c++)
      if ((r + c) % 2 === 1) board[r][c] = { color: 'red', king: false };
  for (let r = 5; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if ((r + c) % 2 === 1) board[r][c] = { color: 'black', king: false };
  return board;
}

function dirs(piece) {
  if (piece.king) return [[-1,-1],[-1,1],[1,-1],[1,1]];
  return piece.color === 'red' ? [[1,-1],[1,1]] : [[-1,-1],[-1,1]];
}

function getJumpsFrom(board, r, c, piece) {
  const jumps = [];
  for (const [dr, dc] of dirs(piece)) {
    const mr = r+dr, mc = c+dc, jr = r+dr*2, jc = c+dc*2;
    if (jr >= 0 && jr < 8 && jc >= 0 && jc < 8
      && board[mr]?.[mc]?.color && board[mr][mc].color !== piece.color
      && !board[jr][jc]) {
      jumps.push({ from:{r,c}, to:{r:jr,c:jc}, cap:{r:mr,c:mc} });
    }
  }
  return jumps;
}

function getSimpleMovesFrom(board, r, c, piece) {
  const moves = [];
  for (const [dr, dc] of dirs(piece)) {
    const nr = r+dr, nc = c+dc;
    if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && !board[nr][nc]) {
      moves.push({ from:{r,c}, to:{r:nr,c:nc}, cap:null });
    }
  }
  return moves;
}

function getAllMoves(board, color, mustFrom) {
  const allJumps = [], allSimple = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.color !== color) continue;
      if (mustFrom && (r !== mustFrom.r || c !== mustFrom.c)) continue;
      allJumps.push(...getJumpsFrom(board, r, c, p));
      allSimple.push(...getSimpleMovesFrom(board, r, c, p));
    }
  }
  return allJumps.length ? allJumps : allSimple;
}

module.exports = {
  id: 'checkers',
  name: 'Checkers',
  minPlayers: 2,
  maxPlayers: 2,
  flexibleStart: true,
  playerCount: 2,
  roles: ['red', 'black'],

  createState: () => ({
    board: createBoard(),
    turn: 'red',
    winner: null,
    mustJumpFrom: null, // {r, c} — locked piece for multi-jump
  }),

  handleMove: (state, playerRole, data) => {
    if (state.winner || state.turn !== playerRole) return { state, events: [] };

    const { from, to } = data; // { from:{r,c}, to:{r,c} }
    const piece = state.board[from.r]?.[from.c];
    if (!piece || piece.color !== playerRole) return { state, events: [] };

    const validMoves = getAllMoves(state.board, playerRole, state.mustJumpFrom);
    const move = validMoves.find(m =>
      m.from.r === from.r && m.from.c === from.c &&
      m.to.r === to.r && m.to.c === to.c
    );
    if (!move) return { state, events: [] };

    // Execute move
    state.board[to.r][to.c] = piece;
    state.board[from.r][from.c] = null;

    // Remove captured piece
    if (move.cap) {
      state.board[move.cap.r][move.cap.c] = null;
    }

    // King promotion
    if (playerRole === 'red'   && to.r === 7) piece.king = true;
    if (playerRole === 'black' && to.r === 0) piece.king = true;

    // Multi-jump check
    if (move.cap) {
      const moreJumps = getJumpsFrom(state.board, to.r, to.c, piece);
      if (moreJumps.length > 0) {
        state.mustJumpFrom = { r: to.r, c: to.c };
        return { state, events: [] };
      }
    }

    state.mustJumpFrom = null;
    state.turn = playerRole === 'red' ? 'black' : 'red';
    return { state, events: [] };
  },

  checkEnd: (state) => {
    if (state.winner) return { ended: true, winner: state.winner };

    let red = 0, black = 0;
    for (const row of state.board)
      for (const cell of row)
        if (cell) cell.color === 'red' ? red++ : black++;

    if (red === 0)   { state.winner = 'black'; return { ended: true, winner: 'black', state }; }
    if (black === 0) { state.winner = 'red';   return { ended: true, winner: 'red',   state }; }

    // No valid moves = loss
    const moves = getAllMoves(state.board, state.turn, state.mustJumpFrom);
    if (moves.length === 0) {
      state.winner = state.turn === 'red' ? 'black' : 'red';
      return { ended: true, winner: state.winner, state };
    }

    return { ended: false };
  }
};
