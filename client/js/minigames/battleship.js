/**
 * Battleship — Client UI
 * Phase 1: Placement — place 5 ships on your 10×10 grid
 * Phase 2: Battle   — alternate firing at opponent's grid
 */

const SHIP_DEFS = [
  { name: 'Carrier',    size: 5 },
  { name: 'Battleship', size: 4 },
  { name: 'Cruiser',    size: 3 },
  { name: 'Submarine',  size: 3 },
  { name: 'Destroyer',  size: 2 },
];

function shipCells(r, c, size, orient) {
  return Array.from({ length: size }, (_, i) =>
    orient === 'H' ? { r, c: c + i } : { r: r + i, c });
}

function inBounds(cells) {
  return cells.every(({ r, c }) => r >= 0 && r < 10 && c >= 0 && c < 10);
}

function overlaps(cells, placed) {
  const occ = new Set(placed.flatMap(s => s.cells.map(p => `${p.r},${p.c}`)));
  return cells.some(({ r, c }) => occ.has(`${r},${c}`));
}

// ── Grid HTML builder ──────────────────────────────
function buildGrid(id, label) {
  return `
    <div class="bs-grid-wrap">
      <div class="bs-grid-label">${label}</div>
      <div class="bs-grid" id="${id}">
        ${Array.from({ length: 10 }, (_, r) =>
          Array.from({ length: 10 }, (_, c) =>
            `<div class="bs-cell" data-r="${r}" data-c="${c}"></div>`
          ).join('')
        ).join('')}
      </div>
    </div>`;
}

// ── Paint a single grid ────────────────────────────
function paintGrid(el, myGrid, shotGrid, showShips, interactive, previewCells, previewValid) {
  el.querySelectorAll('.bs-cell').forEach(cell => {
    const r = +cell.dataset.r, c = +cell.dataset.c;
    const shot = shotGrid?.[r]?.[c];
    const hasShip = myGrid?.[r]?.[c] === 'ship';
    const isPrev = previewCells?.some(p => p.r === r && p.c === c);

    let cls = 'bs-cell';
    if (isPrev)           cls += previewValid ? ' preview' : ' preview-invalid';
    else if (shot === 'hit')  cls += ' hit';
    else if (shot === 'miss') cls += ' miss';
    else if (showShips && hasShip) cls += ' ship';

    if (interactive) cls += ' interactive';
    cell.className = cls;
  });
}

export default {
  id: 'battleship',
  name: 'Battleship',

  render(container, state, myRole, onMove) {
    let cur = state;
    let orient = 'H';
    let shipIdx = 0;
    let placed = [];      // ships placed during placement phase
    let hoverCell = null; // {r,c} for preview

    // ── Build initial HTML ─────────────────────────
    container.innerHTML = `
      <div class="battleship-container">
        <details class="game-instructions">
          <summary>📖 How to Play</summary>
          <ul>
            <li>You are Player <strong>${myRole}</strong>.</li>
            <li><strong>Placement:</strong> Hover over your grid to preview ships. Click to place. Use the H/V button to rotate.</li>
            <li><strong>Battle:</strong> Click cells on the Enemy grid to fire.</li>
            <li><strong>Hit 🔴</strong> = you struck a ship. <strong>Miss ⬜</strong> = open water.</li>
            <li>Sink all 5 enemy ships to win!</li>
          </ul>
        </details>
        <div id="bs-status" class="bs-status"></div>
        <div id="bs-content"></div>
      </div>`;

    // ── Expose update hook ─────────────────────────
    container._bsUpdate = (newState) => {
      cur = newState;
      drawPhase();
    };

    function drawPhase() {
      const content = container.querySelector('#bs-content');
      if (!content) return;

      if (cur.phase === 'placement') {
        drawPlacement(content);
      } else {
        drawBattle(content);
      }
      updateStatus();
    }

    // ── STATUS ─────────────────────────────────────
    function updateStatus() {
      const el = container.querySelector('#bs-status');
      if (!el) return;
      if (cur.winner) {
        el.textContent = cur.winner === myRole
          ? 'Congratulations! You Win! 🎉' : 'You Lose! 💀';
        el.className = 'bs-status win';
        return;
      }
      if (cur.phase === 'placement') {
        el.textContent = cur.ready[myRole]
          ? 'Waiting for opponent to finish placement...'
          : `Place your ships (${shipIdx}/${SHIP_DEFS.length} done)`;
        el.className = 'bs-status';
      } else {
        const mine = cur.turn === myRole;
        el.textContent = mine ? 'Your Turn — Fire!' : "Opponent's Turn...";
        el.className = `bs-status ${mine ? 'your-turn' : 'opponent-turn'}`;
      }
    }

    // ── PLACEMENT PHASE ────────────────────────────
    function drawPlacement(content) {
      if (cur.ready[myRole]) {
        content.innerHTML = `<div class="bs-waiting">Waiting for opponent to finish placement… ⏳</div>`;
        return;
      }

      const def = SHIP_DEFS[shipIdx];

      content.innerHTML = `
        <div class="bs-placement-controls">
          <span class="bs-ship-name">${def ? `Placing: <strong>${def.name}</strong> (${def.size} cells)` : 'All ships placed!'}</span>
          <button id="bs-orient" class="bs-btn-orient">Orientation: <strong id="bs-orient-val">${orient}</strong></button>
        </div>
        ${buildGrid('bs-own-grid', 'YOUR FLEET')}
        <div class="bs-ship-queue" id="bs-queue"></div>
        <div class="bs-placement-actions">
          <button id="bs-reset" class="bs-btn-secondary">🔄 Reset</button>
          <button id="bs-ready" class="bs-btn-primary" ${placed.length < SHIP_DEFS.length ? 'disabled' : ''}>✓ Ready!</button>
        </div>`;

      renderQueue(content);
      paintOwnGrid(content);
      bindPlacementEvents(content);
    }

    function renderQueue(content) {
      const q = content.querySelector('#bs-queue');
      if (!q) return;
      q.innerHTML = SHIP_DEFS.map((def, i) => {
        const done = i < shipIdx;
        const active = i === shipIdx;
        return `<div class="bs-ship-item ${done ? 'done' : ''} ${active ? 'active' : ''}">
          <span class="bs-ship-label">${def.name}</span>
          <span class="bs-ship-blocks">${Array(def.size).fill('<span class="bs-block"></span>').join('')}</span>
        </div>`;
      }).join('');
    }

    function paintOwnGrid(content) {
      const grid = content.querySelector('#bs-own-grid');
      if (!grid) return;
      const def = SHIP_DEFS[shipIdx];
      let previewCells = null, previewValid = false;
      if (def && hoverCell) {
        previewCells = shipCells(hoverCell.r, hoverCell.c, def.size, orient);
        previewValid = inBounds(previewCells) && !overlaps(previewCells, placed);
      }
      const myGrid = Array(10).fill(null).map(() => Array(10).fill(null));
      for (const ship of placed)
        for (const { r, c } of ship.cells) myGrid[r][c] = 'ship';
      paintGrid(grid, myGrid, null, true, false, previewCells, previewValid);
    }

    function bindPlacementEvents(content) {
      content.querySelector('#bs-orient')?.addEventListener('click', () => {
        orient = orient === 'H' ? 'V' : 'H';
        content.querySelector('#bs-orient-val').textContent = orient;
        paintOwnGrid(content);
      });

      content.querySelector('#bs-reset')?.addEventListener('click', () => {
        placed = [];
        shipIdx = 0;
        drawPlacement(content);
        updateStatus();
      });

      content.querySelector('#bs-ready')?.addEventListener('click', () => {
        if (placed.length < SHIP_DEFS.length) return;
        onMove({ type: 'place', ships: placed });
      });

      const grid = content.querySelector('#bs-own-grid');
      if (!grid) return;
      grid.addEventListener('mouseover', e => {
        const cell = e.target.closest('.bs-cell');
        if (!cell) return;
        hoverCell = { r: +cell.dataset.r, c: +cell.dataset.c };
        paintOwnGrid(content);
      });
      grid.addEventListener('mouseleave', () => { hoverCell = null; paintOwnGrid(content); });
      grid.addEventListener('click', e => {
        const cell = e.target.closest('.bs-cell');
        if (!cell || shipIdx >= SHIP_DEFS.length) return;
        const def = SHIP_DEFS[shipIdx];
        const cells = shipCells(+cell.dataset.r, +cell.dataset.c, def.size, orient);
        if (!inBounds(cells) || overlaps(cells, placed)) return;
        placed.push({ name: def.name, cells });
        shipIdx++;
        hoverCell = null;
        drawPlacement(content);
        updateStatus();
      });
    }

    // ── BATTLE PHASE ───────────────────────────────
    function drawBattle(content) {
      const opp = myRole === 'A' ? 'B' : 'A';
      content.innerHTML = `
        <div class="bs-battle-grids">
          ${buildGrid('bs-own-grid',  'YOUR FLEET')}
          ${buildGrid('bs-enemy-grid','ENEMY WATERS')}
        </div>
        <div class="bs-ships-status" id="bs-ship-status"></div>`;

      paintBattle(content);
      bindBattleEvents(content);
    }

    function paintBattle(content) {
      const opp = myRole === 'A' ? 'B' : 'A';

      // Own grid: show my ships + where opponent has shot at me
      const ownGrid = content.querySelector('#bs-own-grid');
      if (ownGrid) paintGrid(ownGrid, cur.grids[myRole], cur.shots[myRole], true, false);

      // Enemy grid: show only what I've fired (clicks here to fire)
      const enemyGrid = content.querySelector('#bs-enemy-grid');
      if (enemyGrid) paintGrid(enemyGrid, null, cur.shots[opp], false, cur.turn === myRole && !cur.winner);

      // Ships remaining
      const shipStatus = content.querySelector('#bs-ship-status');
      if (shipStatus) {
        const myShips = cur.ships[myRole] || [];
        const oppShips = cur.ships[opp] || [];
        shipStatus.innerHTML = `
          <div class="bs-fleet-summary">
            <span>Your fleet: ${myShips.filter(s => !s.sunk).length}/${myShips.length} ships remaining</span>
            <span>Enemy fleet: ${oppShips.filter(s => !s.sunk).length}/${oppShips.length} ships remaining</span>
          </div>`;
      }
    }

    function bindBattleEvents(content) {
      const opp = myRole === 'A' ? 'B' : 'A';
      const enemyGrid = content.querySelector('#bs-enemy-grid');
      if (!enemyGrid) return;
      enemyGrid.addEventListener('click', e => {
        const cell = e.target.closest('.bs-cell');
        if (!cell || cur.turn !== myRole || cur.winner) return;
        const r = +cell.dataset.r, c = +cell.dataset.c;
        if (cur.shots[opp][r][c] !== null) return;
        onMove({ type: 'fire', r, c });
      });
    }

    // Initial draw
    drawPhase();
  },

  update(container, state) {
    if (container._bsUpdate) container._bsUpdate(state);
  },

  destroy(container) {
    container._bsUpdate = null;
    container.innerHTML = '';
  }
};
