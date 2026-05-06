/**
 * UNO — Client UI
 * Card game renderer using individual card images from assets/unocards/.
 *
 * File naming convention:
 *   {Color}_{Value}.png  — e.g. Red_5.png, Blue_Skip.png
 *   Wild_Card_Change_Colour.png, Wild_Card_Draw_4.png, Wild_Card_Empty.png (back)
 */

const CARD_PATH = 'assets/unocards/';

function getCardImage(card) {
  if (card.rank === '?') return `${CARD_PATH}Wild_Card_Empty.png`;

  if (card.type === 'wild') {
    return card.value === 'wild4'
      ? `${CARD_PATH}Wild_Card_Draw_4.png`
      : `${CARD_PATH}Wild_Card_Change_Colour.png`;
  }

  const colorName = card.color.charAt(0).toUpperCase() + card.color.slice(1);
  const valueMap = { skip: 'Skip', reverse: 'Reverse', draw2: 'Draw_2' };
  const valueName = valueMap[card.value] || card.value;

  return `${CARD_PATH}${colorName}_${valueName}.png`;
}

function renderUnoCard(card, selected, isPlayable) {
  const sel = selected ? ' uno-selected' : '';
  const play = isPlayable ? ' uno-playable' : '';
  const src = getCardImage(card);
  const id = card.id !== undefined ? card.id : -1;

  return `<div class="uno-card${sel}${play}" data-card-id="${id}">
    <img src="${src}" alt="" draggable="false" />
  </div>`;
}

function canPlay(card, topCard, currentColor) {
  if (card.type === 'wild') return true;
  if (card.color === currentColor) return true;
  if (card.value === topCard.value) return true;
  return false;
}

const COLOR_DOT = { red: '#d63031', blue: '#0984e3', green: '#00b894', yellow: '#fdcb6e' };

export default {
  id: 'uno',
  name: 'UNO',

  render(container, state, myRole, onMove) {
    let cur = state;
    let selectedCardId = null;
    let showColorPicker = false;
    let pendingWildCardId = null;

    function getMyHand() { return cur.hands[myRole] || []; }

    function paint() {
      const hand = getMyHand();
      const isMyTurn = cur.roles[cur.turnIdx] === myRole;
      const topCard = cur.discard[cur.discard.length - 1];
      const currentPlayer = cur.roles[cur.turnIdx];
      const dirArrow = cur.direction === 1 ? '→' : '←';

      let statusText = '', statusClass = '';
      if (cur.winner) {
        statusText = cur.winner === myRole ? '🎉 You Win!' : `💀 ${cur.winner} Wins!`;
        statusClass = cur.winner === myRole ? 'win' : 'lose';
      } else if (isMyTurn) {
        if (cur.drawPending > 0) statusText = `You must draw ${cur.drawPending} cards or stack!`;
        else if (cur.hasDrawn) statusText = 'Play a card or Pass';
        else statusText = 'Play a card or Draw';
        statusClass = 'your-turn';
      } else {
        statusText = `Waiting for ${currentPlayer}...`;
        statusClass = 'opponent-turn';
      }

      const colorDot = cur.currentColor ?
        `<span class="uno-color-dot" style="background:${COLOR_DOT[cur.currentColor] || '#888'}"></span>` : '';

      container.innerHTML = `
        <div class="uno-container">
          <details class="game-instructions">
            <summary>📖 How to Play UNO</summary>
            <ul>
              <li>Match the top card by <strong>color</strong> or <strong>number/symbol</strong>.</li>
              <li><strong>Wild 🌈</strong>: Play anytime, pick a new color.</li>
              <li><strong>Wild +4</strong>: Play anytime, pick color + next player draws 4.</li>
              <li><strong>+2</strong>: Next player draws 2 cards and loses their turn.</li>
              <li><strong>⊘ Skip</strong>: Next player loses their turn.</li>
              <li><strong>⟲ Reverse</strong>: Reverses play direction.</li>
              <li>If you can't play, <strong>draw a card</strong>. You may play it or pass.</li>
              <li>Click <strong>UNO!</strong> when you have 1 card left!</li>
            </ul>
          </details>

          <div class="uno-status ${statusClass}">${statusText}</div>
          ${cur.lastAction ? `<div class="uno-last-action">${cur.lastAction}</div>` : ''}

          <div class="uno-info-bar">
            <span class="uno-role">You: ${myRole}</span>
            <span class="uno-direction">Direction: ${dirArrow}</span>
            <span class="uno-current-color">Color: ${colorDot} ${cur.currentColor || '?'}</span>
            <span class="uno-stock">Stock: ${cur.stock.length}</span>
          </div>

          <div class="uno-opponents">
            ${cur.roles.filter(r => r !== myRole).map(r => {
              const cardCount = (cur.hands[r] || []).length;
              const isTurn = cur.roles[cur.turnIdx] === r;
              return `<div class="uno-opponent ${isTurn ? 'active' : ''}">
                <span class="uno-opp-name">${r}</span>
                <span class="uno-opp-cards">${cardCount} card${cardCount !== 1 ? 's' : ''}</span>
              </div>`;
            }).join('')}
          </div>

          <div class="uno-table">
            <div class="uno-pile-group">
              <div class="uno-pile-label">Draw</div>
              <div class="uno-draw-pile ${isMyTurn && !cur.hasDrawn ? 'clickable' : ''}" id="uno-draw">
                ${renderUnoCard({ rank: '?', id: -1 }, false, false)}
                ${cur.drawPending > 0 ? `<div class="uno-pending-badge">+${cur.drawPending}</div>` : ''}
              </div>
            </div>
            <div class="uno-pile-group">
              <div class="uno-pile-label">Discard</div>
              <div class="uno-discard-pile">
                ${topCard ? renderUnoCard(topCard, false, false) : '<div class="uno-card uno-empty">—</div>'}
              </div>
            </div>
          </div>

          ${showColorPicker ? `
            <div class="uno-color-picker" id="uno-colors">
              <div class="uno-picker-title">Choose a color:</div>
              <div class="uno-picker-options">
                <button class="uno-color-btn" data-color="red" style="background:#d63031"></button>
                <button class="uno-color-btn" data-color="blue" style="background:#0984e3"></button>
                <button class="uno-color-btn" data-color="green" style="background:#00b894"></button>
                <button class="uno-color-btn" data-color="yellow" style="background:#fdcb6e"></button>
              </div>
            </div>
          ` : ''}

          <div class="uno-hand-area">
            <div class="uno-hand-label">Your Hand (${hand.length})</div>
            <div class="uno-hand" id="uno-hand">
              ${hand.map(c => {
                const playable = isMyTurn && canPlay(c, topCard, cur.currentColor);
                return renderUnoCard(c, c.id === selectedCardId, playable);
              }).join('')}
            </div>
          </div>

          <div class="uno-actions" id="uno-actions">
            ${isMyTurn && cur.hasDrawn ? '<button class="btn uno-btn pass-btn" id="uno-pass">Pass</button>' : ''}
            ${hand.length === 1 && !cur.unoCall?.[myRole] ? '<button class="btn uno-btn uno-call-btn" id="uno-call">UNO!</button>' : ''}
          </div>
        </div>`;

      bindEvents();
    }

    function bindEvents() {
      const isMyTurn = cur.roles[cur.turnIdx] === myRole;
      const topCard = cur.discard[cur.discard.length - 1];

      const handEl = container.querySelector('#uno-hand');
      if (handEl) {
        handEl.addEventListener('click', (e) => {
          const cardEl = e.target.closest('.uno-card');
          if (!cardEl || !isMyTurn) return;
          const cid = parseInt(cardEl.dataset.cardId);
          if (isNaN(cid) || cid < 0) return;

          const card = getMyHand().find(c => c.id === cid);
          if (!card) return;
          if (!canPlay(card, topCard, cur.currentColor)) return;

          if (card.type === 'wild') {
            pendingWildCardId = cid;
            showColorPicker = true;
            paint();
            return;
          }

          onMove({ action: 'play', cardId: cid });
          selectedCardId = null;
        });
      }

      const colorsEl = container.querySelector('#uno-colors');
      if (colorsEl) {
        colorsEl.addEventListener('click', (e) => {
          const btn = e.target.closest('.uno-color-btn');
          if (!btn) return;
          onMove({ action: 'play', cardId: pendingWildCardId, chosenColor: btn.dataset.color });
          showColorPicker = false;
          pendingWildCardId = null;
          selectedCardId = null;
        });
      }

      const drawEl = container.querySelector('#uno-draw');
      if (drawEl && isMyTurn) {
        drawEl.addEventListener('click', () => {
          onMove({ action: 'draw' });
          selectedCardId = null;
        });
      }

      const passBtn = container.querySelector('#uno-pass');
      if (passBtn) passBtn.addEventListener('click', () => onMove({ action: 'pass' }));

      const callBtn = container.querySelector('#uno-call');
      if (callBtn) callBtn.addEventListener('click', () => onMove({ action: 'uno' }));
    }

    container._unoUpdate = (newState) => {
      cur = newState;
      if (cur.roles[cur.turnIdx] !== myRole) {
        selectedCardId = null;
        showColorPicker = false;
      }
      paint();
    };

    paint();
  },

  update(container, state, myRole) {
    if (container._unoUpdate) container._unoUpdate(state);
  },

  destroy(container) {
    container._unoUpdate = null;
    container.innerHTML = '';
  }
};
