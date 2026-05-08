const SHIPS = [
  { name: 'Carrier',    size: 5 },
  { name: 'Battleship', size: 4 },
  { name: 'Cruiser',    size: 3 },
  { name: 'Submarine',  size: 3 },
  { name: 'Destroyer',  size: 2 },
];

const emptyGrid = () => Array(10).fill(null).map(() => Array(10).fill(null));

function validateShips(data) {
  if (!Array.isArray(data) || data.length !== SHIPS.length) return null;
  const occupied = new Set();
  const built = [];
  for (const def of SHIPS) {
    const sd = data.find(s => s.name === def.name);
    if (!sd || !Array.isArray(sd.cells) || sd.cells.length !== def.size) return null;
    if (!sd.cells.every(({ r, c }) => r >= 0 && r < 10 && c >= 0 && c < 10)) return null;
    const rows = new Set(sd.cells.map(p => p.r));
    const cols = new Set(sd.cells.map(p => p.c));
    if (rows.size > 1 && cols.size > 1) return null;
    if (rows.size === 1) {
      const s = [...sd.cells].sort((a, b) => a.c - b.c);
      for (let i = 1; i < s.length; i++) if (s[i].c !== s[i - 1].c + 1) return null;
    } else {
      const s = [...sd.cells].sort((a, b) => a.r - b.r);
      for (let i = 1; i < s.length; i++) if (s[i].r !== s[i - 1].r + 1) return null;
    }
    for (const { r, c } of sd.cells) {
      const k = `${r},${c}`;
      if (occupied.has(k)) return null;
      occupied.add(k);
    }
    built.push({ name: def.name, size: def.size, cells: sd.cells, sunk: false });
  }
  return built;
}

module.exports = {
  id: 'battleship',
  name: 'Battleship',
  minPlayers: 2,
  maxPlayers: 2,
  flexibleStart: true,
  playerCount: 2,
  roles: ['A', 'B'],

  createState: () => ({
    phase: 'placement',
    grids: { A: emptyGrid(), B: emptyGrid() },
    shots: { A: emptyGrid(), B: emptyGrid() }, // shots fired AT A / AT B
    ships: { A: [], B: [] },
    ready: { A: false, B: false },
    turn: 'A',
    winner: null,
  }),

  handleMove(state, role, data) {
    if (state.winner) return { state, events: [] };

    if (data.type === 'place' && state.phase === 'placement' && !state.ready[role]) {
      const ships = validateShips(data.ships);
      if (!ships) return { state, events: [] };
      state.grids[role] = emptyGrid();
      for (const ship of ships)
        for (const { r, c } of ship.cells) state.grids[role][r][c] = 'ship';
      state.ships[role] = ships;
      state.ready[role] = true;
      if (state.ready.A && state.ready.B) state.phase = 'battle';
    }

    if (data.type === 'fire' && state.phase === 'battle' && state.turn === role) {
      const opp = role === 'A' ? 'B' : 'A';
      const { r, c } = data;
      if (r < 0 || r > 9 || c < 0 || c > 9 || state.shots[opp][r][c] !== null)
        return { state, events: [] };
      const hit = state.grids[opp][r][c] === 'ship';
      state.shots[opp][r][c] = hit ? 'hit' : 'miss';
      if (hit)
        for (const ship of state.ships[opp])
          if (!ship.sunk)
            ship.sunk = ship.cells.every(({ r: sr, c: sc }) => state.shots[opp][sr][sc] === 'hit');
      state.turn = role === 'A' ? 'B' : 'A';
    }

    return { state, events: [] };
  },

  checkEnd(state) {
    if (state.winner || state.phase !== 'battle') return { ended: false };
    for (const role of ['A', 'B']) {
      if (state.ships[role].length > 0 && state.ships[role].every(s => s.sunk)) {
        const winner = role === 'A' ? 'B' : 'A';
        state.winner = winner;
        return { ended: true, winner, state };
      }
    }
    return { ended: false };
  }
};
