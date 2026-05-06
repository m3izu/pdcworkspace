/**
 * Tong-its — Client UI
 * Filipino rummy card game renderer.
 */

const SUIT_COLORS = { '♠': '#1a1a2e', '♣': '#1a1a2e', '♥': '#e74c3c', '♦': '#e74c3c' };

function cid(card) { return `${card.rank}${card.suit}`; }

function renderCard(card, selected, isNew) {
  const color = SUIT_COLORS[card.suit] || '#000';
  const sel = selected ? ' selected' : '';
  const glow = isNew ? ' new-card' : '';
  return `<div class="ti-card${sel}${glow}" data-card="${cid(card)}" style="color:${color}">
    <span class="ti-rank">${card.rank}</span>
    <span class="ti-suit">${card.suit}</span>
  </div>`;
}

function renderMeld(meld, meldIdx) {
  const cards = meld.cards.map(c =>
    `<div class="ti-card mini" data-meld="${meldIdx}" style="color:${SUIT_COLORS[c.suit]||'#000'}">
      <span class="ti-rank">${c.rank}</span><span class="ti-suit">${c.suit}</span>
    </div>`
  ).join('');
  return `<div class="ti-meld" data-meld-idx="${meldIdx}">
    <div class="ti-meld-owner">${meld.owner}</div>
    <div class="ti-meld-cards">${cards}</div>
  </div>`;
}

export default {
  id: 'tongits',
  name: 'Tong-its',

  render(container, state, myRole, onMove) {
    let cur = state;
    let selectedCards = new Set();
    let layoffMode = false;

    function getMyHand() {
      return cur.hands[myRole] || [];
    }

    function paint() {
      const hand = getMyHand();
      const isMyTurn = cur.turn === myRole;
      const phase = cur.phase;
      const topDiscard = cur.discard.length > 0 ? cur.discard[cur.discard.length - 1] : null;

      // Role label
      const roleNum = myRole.replace('player', 'Player ');

      // Status
      let statusText = '';
      let statusClass = '';
      if (cur.winner) {
        statusText = cur.winner === myRole ? '🎉 You Win!' : `💀 ${cur.winner} Wins!`;
        statusClass = cur.winner === myRole ? 'win' : 'lose';
      } else if (isMyTurn) {
        if (phase === 'draw') statusText = 'Draw a card from Stock or Discard pile';
        else statusText = 'Meld, Lay Off, or Discard to end turn';
        statusClass = 'your-turn';
      } else {
        statusText = `Waiting for ${cur.turn}...`;
        statusClass = 'opponent-turn';
      }

      // Scores display
      let scoresHTML = '';
      if (cur.scores) {
        scoresHTML = `<div class="ti-scores">
          ${Object.entries(cur.scores).map(([r, s]) =>
            `<div class="ti-score-item ${r === cur.winner ? 'winner' : ''}">${r.replace('player', 'P')}: ${s} pts</div>`
          ).join('')}
        </div>`;
      }

      container.innerHTML = `
        <div class="tongits-container">
          <details class="game-instructions">
            <summary>📖 How to Play Tong-its</summary>
            <ul>
              <li>You are <strong>${roleNum}</strong>. Player 1 (dealer) gets 13 cards, others get 12.</li>
              <li><strong>Draw:</strong> Take from Stock (face-down) or Discard pile (top card).</li>
              <li><strong>Meld:</strong> Select 3+ cards → click "Meld" to lay down a set (same rank) or run (consecutive same suit).</li>
              <li><strong>Lay Off:</strong> Select 1 card → click a meld to add your card to it.</li>
              <li><strong>Discard:</strong> Select 1 card → click "Discard" to end your turn.</li>
              <li><strong>Tong-its:</strong> Empty your hand to win instantly!</li>
              <li><strong>Fight:</strong> Call "Fight" to end the game — lowest deadwood score wins.</li>
            </ul>
          </details>

          <div class="ti-status ${statusClass}">${statusText}</div>
          ${cur.lastAction ? `<div class="ti-last-action">${cur.lastAction}</div>` : ''}
          ${scoresHTML}

          <div class="ti-role-badge">${roleNum}</div>

          <div class="ti-table">
            <div class="ti-piles">
              <div class="ti-pile-group">
                <div class="ti-pile-label">Stock (${cur.stock.length})</div>
                <div class="ti-stock ${isMyTurn && phase === 'draw' ? 'clickable' : ''}" id="ti-stock">
                  <div class="ti-card back">🂠</div>
                </div>
              </div>
              <div class="ti-pile-group">
                <div class="ti-pile-label">Discard (${cur.discard.length})</div>
                <div class="ti-discard ${isMyTurn && phase === 'draw' && topDiscard ? 'clickable' : ''}" id="ti-discard">
                  ${topDiscard
                    ? `<div class="ti-card" style="color:${SUIT_COLORS[topDiscard.suit]}">
                        <span class="ti-rank">${topDiscard.rank}</span>
                        <span class="ti-suit">${topDiscard.suit}</span>
                      </div>`
                    : '<div class="ti-card empty">—</div>'}
                </div>
              </div>
            </div>

            <div class="ti-melds-area">
              <div class="ti-melds-label">Melds</div>
              <div class="ti-melds" id="ti-melds">
                ${cur.melds.length > 0
                  ? cur.melds.map((m, i) => renderMeld(m, i)).join('')
                  : '<div class="ti-no-melds">No melds yet</div>'}
              </div>
            </div>
          </div>

          <div class="ti-hand-area">
            <div class="ti-hand-label">Your Hand (${hand.length} cards) — Deadwood: ${hand.reduce((s, c) => s + c.value, 0)}</div>
            <div class="ti-hand" id="ti-hand">
              ${hand.map(c => renderCard(c, selectedCards.has(cid(c)), cur.drawnCard === cid(c))).join('')}
            </div>
          </div>

          <div class="ti-actions" id="ti-actions">
            ${isMyTurn && phase === 'action' ? `
              <button class="btn ti-btn meld-btn" id="ti-btn-meld" ${selectedCards.size < 3 ? 'disabled' : ''}>Meld (${selectedCards.size})</button>
              <button class="btn ti-btn discard-btn" id="ti-btn-discard" ${selectedCards.size !== 1 ? 'disabled' : ''}>Discard</button>
              <button class="btn ti-btn fight-btn" id="ti-btn-fight">⚔️ Fight</button>
            ` : ''}
          </div>

          <div class="ti-other-hands">
            ${['player1','player2','player3'].filter(r => r !== myRole).map(r => `
              <div class="ti-other-player ${cur.turn === r ? 'active-turn' : ''}">
                <span class="ti-other-name">${r.replace('player', 'P')}</span>
                <span class="ti-other-count">${(cur.hands[r]||[]).length} cards</span>
              </div>
            `).join('')}
          </div>
        </div>`;

      // Bind events
      bindEvents();
    }

    function bindEvents() {
      const isMyTurn = cur.turn === myRole;
      const phase = cur.phase;

      // Hand card selection
      const handEl = container.querySelector('#ti-hand');
      if (handEl) {
        handEl.addEventListener('click', (e) => {
          const cardEl = e.target.closest('.ti-card');
          if (!cardEl || !isMyTurn || phase !== 'action') return;
          const id = cardEl.dataset.card;
          if (selectedCards.has(id)) selectedCards.delete(id);
          else selectedCards.add(id);
          paint();
        });
      }

      // Stock draw
      const stockEl = container.querySelector('#ti-stock');
      if (stockEl && isMyTurn && phase === 'draw') {
        stockEl.addEventListener('click', () => {
          onMove({ action: 'draw-stock' });
          selectedCards.clear();
        });
      }

      // Discard pile draw
      const discardEl = container.querySelector('#ti-discard');
      if (discardEl && isMyTurn && phase === 'draw' && cur.discard.length > 0) {
        discardEl.addEventListener('click', () => {
          onMove({ action: 'draw-discard' });
          selectedCards.clear();
        });
      }

      // Meld button
      const meldBtn = container.querySelector('#ti-btn-meld');
      if (meldBtn) {
        meldBtn.addEventListener('click', () => {
          onMove({ action: 'meld', cardIds: [...selectedCards] });
          selectedCards.clear();
        });
      }

      // Discard button
      const discardBtn = container.querySelector('#ti-btn-discard');
      if (discardBtn) {
        discardBtn.addEventListener('click', () => {
          const id = [...selectedCards][0];
          onMove({ action: 'discard', cardId: id });
          selectedCards.clear();
        });
      }

      // Fight button
      const fightBtn = container.querySelector('#ti-btn-fight');
      if (fightBtn) {
        fightBtn.addEventListener('click', () => {
          if (confirm('Call FIGHT? Game will end and lowest deadwood wins.')) {
            onMove({ action: 'fight' });
          }
        });
      }

      // Lay off: click a meld to lay off selected card
      const meldsEl = container.querySelector('#ti-melds');
      if (meldsEl && isMyTurn && phase === 'action' && selectedCards.size === 1) {
        meldsEl.addEventListener('click', (e) => {
          const meldEl = e.target.closest('.ti-meld');
          if (!meldEl) return;
          const meldIdx = parseInt(meldEl.dataset.meldIdx);
          const cardId = [...selectedCards][0];
          onMove({ action: 'layoff', cardId, meldIndex: meldIdx });
          selectedCards.clear();
        });
      }
    }

    container._tiUpdate = (newState) => {
      cur = newState;
      // Clear selection on turn change
      if (newState.turn !== myRole) selectedCards.clear();
      paint();
    };

    paint();
  },

  update(container, state, myRole) {
    if (container._tiUpdate) container._tiUpdate(state);
  },

  destroy(container) {
    container._tiUpdate = null;
    container.innerHTML = '';
  }
};
