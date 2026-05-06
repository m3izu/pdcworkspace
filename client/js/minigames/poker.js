function getSpriteUrl(card, isHidden = false) {
  if (isHidden) return 'assets/cards/back_dark.png';
  if (!card || card.rank === '?') return ''; // Empty placeholder
  
  const rankMap = { 'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A' };
  const filename = `${card.suit}_${rankMap[card.rank] || card.rank}.png`;
  return `assets/cards/${filename}`;
}

function renderPokerCard(card, isHidden = false, isSmall = false) {
  const url = getSpriteUrl(card, isHidden);
  const dims = isSmall ? 'width: 45px; height: 63px;' : 'width: 65px; height: 91px;';
  
  if (!card || card.rank === '?') {
    return `
      <div style="${dims} background: rgba(0,0,0,0.2); border: 2px dashed rgba(255,255,255,0.15); border-radius: 5px; margin: 0 2px;"></div>
    `;
  }

  return `
    <div class="ti-card" style="padding: 0; background: none; box-shadow: none; border: none; margin: 0 2px; ${dims}">
      <img src="${url}" style="width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.5)); border-radius: 5px;">
    </div>
  `;
}

export function createPokerUI(container, state, myRole, onMove) {
  let cur = state;
  let raiseAmount = 0;

  const paint = () => {
    const isMyTurn = cur.roles[cur.turnIdx] === myRole && cur.phase !== 'showdown';
    const me = cur.players[myRole];
    
    // Pot and Bet details
    const callAmount = cur.currentBet - me.currentBet;
    const canCheck = callAmount === 0;
    const minRaise = cur.currentBet > 0 ? cur.currentBet * 2 : 20;
    
    if (raiseAmount < minRaise) raiseAmount = minRaise;
    if (raiseAmount > me.chips) raiseAmount = me.chips;

    const oppRoles = cur.roles.filter(r => r !== myRole);
    
    const getOppPosition = (index, total) => {
      if (total === 1) return 'top: 10px; left: 50%; transform: translateX(-50%);';
      if (total === 2) {
        if (index === 0) return 'top: 20px; left: 5%;';
        return 'top: 20px; right: 5%;';
      }
      if (total === 3) {
        if (index === 0) return 'top: 120px; left: 5%; transform: translateY(-50%);';
        if (index === 1) return 'top: 10px; left: 50%; transform: translateX(-50%);';
        return 'top: 120px; right: 5%; transform: translateY(-50%);';
      }
      if (total === 4) {
        if (index === 0) return 'top: 160px; left: 5%;';
        if (index === 1) return 'top: 10px; left: 15%;';
        if (index === 2) return 'top: 10px; right: 15%;';
        return 'top: 160px; right: 5%;';
      }
    };

    container.innerHTML = `
      <style>
        .poker-wrapper { display: flex; flex-direction: column; height: 100%; justify-content: space-between; gap: 10px; padding: 10px; box-sizing: border-box; color: white; }
        
        .poker-table { 
          flex-grow: 1;
          background: radial-gradient(ellipse at center, #218c53 0%, #0d4a2a 100%); 
          border-radius: 40px; 
          padding: 20px; 
          box-shadow: inset 0 0 30px rgba(0,0,0,0.8), 0 10px 20px rgba(0,0,0,0.3); 
          border: 10px solid #5c3a21; 
          position: relative; 
          display: flex; 
          flex-direction: column; 
          justify-content: center;
          align-items: center;
          min-height: 300px;
        }
        
        .poker-table::before {
          content: ''; position: absolute; top: 15px; bottom: 15px; left: 15px; right: 15px;
          border: 2px solid rgba(255,255,255,0.1); border-radius: 30px; pointer-events: none;
        }

        .poker-center { text-align: center; z-index: 2; width: 100%; }
        .poker-pot { font-size: 22px; color: #f1c40f; font-weight: 800; text-shadow: 0 4px 8px rgba(0,0,0,0.8); margin-bottom: 10px; background: rgba(0,0,0,0.5); padding: 5px 15px; border-radius: 15px; display: inline-block; border: 1px solid rgba(241,196,15,0.3); }
        .poker-community { display: flex; justify-content: center; width: 100%; flex-wrap: wrap; }
        
        .poker-opp { position: absolute; background: rgba(0,0,0,0.75); padding: 8px; border-radius: 12px; text-align: center; border: 1px solid rgba(255,255,255,0.15); backdrop-filter: blur(5px); box-shadow: 0 4px 10px rgba(0,0,0,0.5); width: 90px; z-index: 5; }
        .poker-opp.active { border-color: #f1c40f; box-shadow: 0 0 15px rgba(241,196,15,0.5); transform: scale(1.05); transition: 0.3s; z-index: 6; }
        .poker-opp.folded { opacity: 0.5; filter: grayscale(1); }
        .poker-opp-cards { display: flex; justify-content: center; margin-top: -20px; margin-bottom: 5px; }
        .poker-opp-cards .ti-card { margin: 0 -10px; }
        
        .poker-me-dashboard { 
          background: rgba(0,0,0,0.85); 
          padding: 12px; 
          border-radius: 20px; 
          border: 1px solid rgba(255,255,255,0.1); 
          box-shadow: 0 5px 20px rgba(0,0,0,0.5); 
          display: flex; 
          flex-direction: column; 
          gap: 10px;
        }
        
        .poker-me-top { display: flex; justify-content: space-between; align-items: center; }
        .poker-hole-cards { display: flex; justify-content: center; }
        .poker-hole-cards .ti-card:nth-child(1) { transform: rotate(-8deg); z-index: 1; }
        .poker-hole-cards .ti-card:nth-child(2) { transform: rotate(8deg) translateY(5px); z-index: 2; margin-left: -20px; }
        
        .poker-controls { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%; }
        .poker-controls-top { display: flex; gap: 8px; width: 100%; grid-column: 1 / -1; }
        .poker-btn { color: white; border: none; padding: 10px; border-radius: 10px; font-weight: bold; font-size: 13px; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 6px rgba(0,0,0,0.3); text-transform: uppercase; flex: 1; }
        .poker-btn:hover:not(:disabled) { transform: translateY(-1px); }
        .poker-btn:disabled { opacity: 0.4; cursor: not-allowed; filter: grayscale(1); }
        
        .btn-fold { background: linear-gradient(to bottom, #e74c3c, #c0392b); }
        .btn-call { background: linear-gradient(to bottom, #2ecc71, #27ae60); }
        .btn-raise { background: linear-gradient(to bottom, #f39c12, #d35400); width: 100%; }
        
        .raise-container { grid-column: 1 / -1; display: flex; align-items: center; gap: 10px; background: rgba(0,0,0,0.4); padding: 8px 12px; border-radius: 12px; }
        
        .poker-chips { color: #f1c40f; font-weight: bold; font-size: 14px; }
        .poker-bet { color: #3498db; font-size: 11px; font-weight: bold; background: rgba(52, 152, 219, 0.2); padding: 2px 6px; border-radius: 6px; display: inline-block; }
        
        .poker-message { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.95); border: 2px solid #f1c40f; color: white; padding: 20px; border-radius: 15px; text-align: center; z-index: 100; font-size: 16px; font-weight: bold; width: 80%; box-shadow: 0 10px 40px rgba(0,0,0,0.8); }
        
        .game-instructions { background: rgba(255,255,255,0.05); border-radius: 10px; padding: 5px 10px; font-size: 12px; }
        .game-instructions summary { cursor: pointer; color: #f1c40f; font-weight: bold; }
        .game-instructions ul { margin: 5px 0; padding-left: 15px; color: #ccc; }
        
        .poker-last-action { font-size: 12px; color: #f1c40f; font-style: italic; text-align: center; margin-top: 5px; height: 15px; }
      </style>

      <div class="poker-wrapper">
        <details class="game-instructions">
          <summary>📖 How to Play Poker</summary>
          <ul>
            <li><strong>Blinds:</strong> Small and Big blinds are posted automatically to start the pot.</li>
            <li><strong>Betting:</strong> Match the current bet to stay in. Raise to increase the price.</li>
            <li><strong>The Goal:</strong> Make the best 5-card hand using your 2 hole cards and 5 community cards.</li>
            <li><strong>Phases:</strong> Pre-flop, Flop (3 cards), Turn (1 card), River (1 card), and Showdown.</li>
          </ul>
        </details>

        <div class="poker-table">
          ${oppRoles.map((r, index) => {
            const opp = cur.players[r];
            const isTurn = cur.roles[cur.turnIdx] === r && cur.phase !== 'showdown';
            return `
              <div class="poker-opp ${isTurn ? 'active' : ''} ${opp.folded ? 'folded' : ''}" style="${getOppPosition(index, oppRoles.length)}">
                ${cur.phase === 'showdown' && !opp.folded ? `
                  <div class="poker-opp-cards">
                    ${renderPokerCard(opp.holeCards[0], false, true)}
                    ${renderPokerCard(opp.holeCards[1], false, true)}
                  </div>
                ` : `
                  ${!opp.folded ? `
                    <div class="poker-opp-cards">
                      ${renderPokerCard(null, true, true)}
                      ${renderPokerCard(null, true, true)}
                    </div>
                  ` : ''}
                `}
                <div style="font-weight: 800; color: white; font-size: 13px; text-transform: uppercase;">${r}</div>
                <div class="poker-chips">${opp.chips} 🪙</div>
                ${opp.currentBet > 0 ? `<div class="poker-bet">Bet: ${opp.currentBet}</div>` : ''}
                ${opp.folded ? `<div style="color:#e74c3c; font-size:11px; font-weight:bold;">FOLDED</div>` : ''}
                ${cur.phase === 'showdown' && !opp.folded && opp.bestHand ? `<div style="font-size: 10px; color: #f1c40f; font-weight:bold;">${opp.bestHand.name}</div>` : ''}
              </div>
            `;
          }).join('')}

          <div class="poker-center">
            <div class="poker-pot">POT: ${cur.pot} 🪙</div>
            <div class="poker-community">
              ${[0,1,2,3,4].map(i => cur.communityCards[i] ? renderPokerCard(cur.communityCards[i]) : renderPokerCard({rank:'?'})).join('')}
            </div>
            <div class="poker-last-action">${cur.lastAction || ''}</div>
          </div>

          ${cur.phase === 'showdown' ? `
            <div class="poker-message">
              ${cur.message}
              <br><br>
              <button class="poker-btn btn-call" id="btn-next">Next Hand</button>
            </div>
          ` : ''}
        </div>

        <div class="poker-me-dashboard ${me.folded ? 'folded' : ''}">
          <div class="poker-me-top">
            <div class="poker-me-info">
              <div style="color: white; font-weight: bold; font-size: 14px;">${myRole} (You)</div>
              <div class="poker-chips" style="font-size: 16px;">${me.chips} 🪙</div>
              ${me.currentBet > 0 ? `<div class="poker-bet">Bet: ${me.currentBet}</div>` : ''}
              ${cur.phase === 'showdown' && !me.folded && me.bestHand ? `<div style="color:#f1c40f; font-weight:bold; font-size: 11px;">${me.bestHand.name}</div>` : ''}
            </div>
            
            <div class="poker-hole-cards">
              ${me.holeCards && me.holeCards.length === 2 ? renderPokerCard(me.holeCards[0]) : ''}
              ${me.holeCards && me.holeCards.length === 2 ? renderPokerCard(me.holeCards[1]) : ''}
            </div>
          </div>

          <div class="poker-controls">
            <div class="poker-controls-top">
              <button class="poker-btn btn-fold" id="btn-fold" ${!isMyTurn ? 'disabled' : ''}>Fold</button>
              <button class="poker-btn btn-call" id="btn-call" ${!isMyTurn || me.chips === 0 ? 'disabled' : ''}>
                ${canCheck ? 'Check' : 'Call ' + Math.min(callAmount, me.chips)}
              </button>
            </div>
            <div class="raise-container">
              <input type="range" class="raise-slider" id="raise-slider" min="${minRaise}" max="${me.chips + me.currentBet}" value="${raiseAmount}" ${!isMyTurn || me.chips < minRaise ? 'disabled' : ''}>
              <button class="poker-btn btn-raise" id="btn-raise" ${!isMyTurn || me.chips < minRaise ? 'disabled' : ''}>
                ${me.chips + me.currentBet <= minRaise ? 'All In' : 'Raise to ' + raiseAmount}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    if (isMyTurn) {
      const foldBtn = container.querySelector('#btn-fold');
      if (foldBtn) foldBtn.addEventListener('click', () => onMove({ action: 'fold' }));

      const callBtn = container.querySelector('#btn-call');
      if (callBtn) callBtn.addEventListener('click', () => onMove({ action: 'call' }));

      const slider = container.querySelector('#raise-slider');
      const raiseBtn = container.querySelector('#btn-raise');
      
      if (slider && raiseBtn) {
        slider.addEventListener('input', (e) => {
          raiseAmount = parseInt(e.target.value);
          raiseBtn.textContent = raiseAmount >= (me.chips + me.currentBet) ? 'All In' : 'Raise to ' + raiseAmount;
        });
        raiseBtn.addEventListener('click', () => onMove({ action: 'raise', amount: raiseAmount }));
      }
    }

    if (cur.phase === 'showdown' && cur.roles[cur.turnIdx] === myRole) {
      const nextBtn = container.querySelector('#btn-next');
      if (nextBtn) nextBtn.addEventListener('click', () => onMove({ action: 'next' }));
    }
  };

  container._pokerUpdate = (newState) => {
    cur = newState;
    paint();
  };

  paint();
}
