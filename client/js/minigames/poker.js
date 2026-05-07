function getSpriteUrl(card, isHidden) {
  if (isHidden) return 'assets/cards/back_dark.png';
  if (!card || card.rank === '?') return '';
  var rankMap = { 'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A' };
  return 'assets/cards/' + card.suit + '_' + (rankMap[card.rank] || card.rank) + '.png';
}

function renderCard(card, isHidden, isSmall) {
  var w = isSmall ? 42 : 60;
  var h = isSmall ? 59 : 84;
  var dims = 'width:' + w + 'px;height:' + h + 'px;';
  
  if (!card || card.rank === '?') {
    return '<div style="' + dims + 'background:rgba(0,0,0,0.15);border:2px dashed rgba(255,255,255,0.12);border-radius:6px;margin:0 2px;flex-shrink:0;"></div>';
  }

  var url = getSpriteUrl(card, isHidden);
  return '<div style="' + dims + 'margin:0 2px;flex-shrink:0;">' +
    '<img src="' + url + '" style="width:100%;height:100%;object-fit:contain;border-radius:6px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));">' +
    '</div>';
}

var POKER_CSS = [
  '.pk-wrap{display:flex;flex-direction:column;height:100%;gap:8px;padding:8px;box-sizing:border-box;color:#fff;font-family:sans-serif}',
  '.pk-guide{background:rgba(255,255,255,0.06);border-radius:10px;padding:6px 10px;font-size:11px;margin-bottom:2px}',
  '.pk-guide summary{cursor:pointer;color:#f1c40f;font-weight:700;font-size:12px}',
  '.pk-guide ul{margin:4px 0;padding-left:16px;color:#bbb;line-height:1.6}',

  '.pk-table{flex:1;background:radial-gradient(ellipse at 50% 60%,#1e8c4e 0%,#0c3d22 100%);border-radius:30px;border:8px solid #5c3a21;box-shadow:inset 0 0 40px rgba(0,0,0,0.7),0 6px 20px rgba(0,0,0,0.4);position:relative;display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:280px;padding:15px;overflow:visible}',
  '.pk-table::before{content:"";position:absolute;top:12px;bottom:12px;left:12px;right:12px;border:2px solid rgba(255,255,255,0.08);border-radius:22px;pointer-events:none}',

  '.pk-center{text-align:center;z-index:2;width:100%}',
  '.pk-pot{font-size:20px;color:#f1c40f;font-weight:800;text-shadow:0 2px 6px rgba(0,0,0,0.7);margin-bottom:8px;background:rgba(0,0,0,0.45);padding:4px 14px;border-radius:12px;display:inline-block;border:1px solid rgba(241,196,15,0.25)}',
  '.pk-cc{display:flex;justify-content:center;gap:4px;flex-wrap:nowrap}',
  '.pk-action{font-size:11px;color:#f1c40f;font-style:italic;text-align:center;margin-top:4px;min-height:14px}',

  '.pk-opp{position:absolute;background:rgba(0,0,0,0.7);padding:6px 8px;border-radius:10px;text-align:center;border:1px solid rgba(255,255,255,0.12);backdrop-filter:blur(4px);box-shadow:0 3px 8px rgba(0,0,0,0.4);z-index:5;min-width:80px}',
  '.pk-opp.on{border-color:#f1c40f;box-shadow:0 0 12px rgba(241,196,15,0.4)}',
  '.pk-opp.out{opacity:0.45;filter:grayscale(1)}',
  '.pk-opp-cards{display:flex;justify-content:center;gap:2px;margin-bottom:4px}',

  '.pk-dash{background:rgba(0,0,0,0.85);padding:10px 12px;border-radius:16px;border:1px solid rgba(255,255,255,0.1);box-shadow:0 4px 16px rgba(0,0,0,0.5);display:flex;flex-direction:column;gap:8px}',
  '.pk-me-top{display:flex;justify-content:space-between;align-items:center}',
  '.pk-me-info{text-align:left}',
  '.pk-hole{display:flex;gap:4px}',

  '.pk-ctrls{display:flex;gap:6px;width:100%}',
  '.pk-btn{color:#fff;border:none;padding:9px 6px;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;transition:0.15s;text-transform:uppercase;flex:1;text-align:center}',
  '.pk-btn:disabled{opacity:0.35;cursor:not-allowed;filter:grayscale(1)}',
  '.pk-btn:hover:not(:disabled){filter:brightness(1.15)}',
  '.pk-fold{background:linear-gradient(180deg,#e74c3c,#c0392b)}',
  '.pk-call{background:linear-gradient(180deg,#2ecc71,#27ae60)}',
  '.pk-raise{background:linear-gradient(180deg,#f39c12,#d35400)}',
  '.pk-stand{background:linear-gradient(180deg,#95a5a6,#7f8c8d)}',
  '.pk-raise-row{display:flex;gap:6px;align-items:center;background:rgba(0,0,0,0.35);padding:6px 10px;border-radius:10px}',
  '.pk-raise-row input[type=range]{flex:1;margin:0}',

  '.pk-chips{color:#f1c40f;font-weight:700;font-size:13px}',
  '.pk-bet{color:#3498db;font-size:10px;font-weight:700;background:rgba(52,152,219,0.2);padding:1px 5px;border-radius:5px;display:inline-block;margin-top:2px}',
  '.pk-msg{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.95);border:2px solid #f1c40f;color:#fff;padding:18px 24px;border-radius:14px;text-align:center;z-index:100;font-size:15px;font-weight:700;width:78%;box-shadow:0 8px 30px rgba(0,0,0,0.7)}',
  '@media (max-width: 600px) {',
  '  .pk-table{min-height:220px;padding:10px;border-width:5px}',
  '  .pk-pot{font-size:16px;padding:3px 10px}',
  '  .pk-dash{padding:8px;gap:6px}',
  '  .pk-btn{padding:7px 4px;font-size:10px}',
  '  .pk-chips{font-size:11px}',
  '  .pk-me-info div{font-size:11px !important}',
  '  .pk-opp{min-width:70px;padding:4px 6px}',
  '  .pk-opp-cards img{width:30px;height:42px}',
  '  .pk-cc div{width:45px !important;height:63px !important}',
  '  .pk-hole div{width:45px !important;height:63px !important}',
  '}'
].join('\n');

export function createPokerUI(container, state, myRole, onMove) {
  var cur = state;
  var raiseAmount = 0;

  function paint() {
    var isMyTurn = cur.roles[cur.turnIdx] === myRole && cur.phase !== 'showdown';
    var me = cur.players[myRole];
    if (!me) return;

    var callAmt = cur.currentBet - me.currentBet;
    var canCheck = callAmt === 0;
    var minRaise = cur.currentBet > 0 ? cur.currentBet * 2 : 20;
    if (raiseAmount < minRaise) raiseAmount = minRaise;
    if (raiseAmount > me.chips + me.currentBet) raiseAmount = me.chips + me.currentBet;

    var oppRoles = cur.roles.filter(function(r) { return r !== myRole; });

    // Position opponents around the table using percentages
    function oppPos(idx, tot) {
      if (tot === 1) return 'top:12px;left:50%;transform:translateX(-50%)';
      if (tot === 2) return idx === 0 ? 'top:12px;left:12%' : 'top:12px;right:12%';
      if (tot === 3) {
        if (idx === 0) return 'top:45%;left:4%;transform:translateY(-50%)';
        if (idx === 1) return 'top:12px;left:50%;transform:translateX(-50%)';
        return 'top:45%;right:4%;transform:translateY(-50%)';
      }
      if (tot === 4) {
        if (idx === 0) return 'top:50%;left:4%;transform:translateY(-50%)';
        if (idx === 1) return 'top:12px;left:22%';
        if (idx === 2) return 'top:12px;right:22%';
        return 'top:50%;right:4%;transform:translateY(-50%)';
      }
      return '';
    }

    // Opponents
    var oppH = '';
    oppRoles.forEach(function(r, i) {
      var o = cur.players[r];
      var isTurn = cur.roles[cur.turnIdx] === r && cur.phase !== 'showdown';
      var cards = '';
      if (cur.phase === 'showdown' && !o.folded) {
        cards = '<div class="pk-opp-cards">' + renderCard(o.holeCards[0], false, true) + renderCard(o.holeCards[1], false, true) + '</div>';
      } else if (!o.folded) {
        cards = '<div class="pk-opp-cards">' + renderCard(null, true, true) + renderCard(null, true, true) + '</div>';
      }
      oppH += '<div class="pk-opp' + (isTurn ? ' on' : '') + (o.folded ? ' out' : '') + '" style="' + oppPos(i, oppRoles.length) + '">' +
        cards +
        '<div style="font-weight:700;font-size:12px;text-transform:uppercase">' + r + '</div>' +
        '<div class="pk-chips">' + o.chips + '</div>' +
        (o.currentBet > 0 ? '<div class="pk-bet">Bet:' + o.currentBet + '</div>' : '') +
        (o.folded ? '<div style="color:#e74c3c;font-size:10px;font-weight:700">FOLDED</div>' : '') +
        (o.allIn ? '<div style="color:#f1c40f;font-size:10px;font-weight:700">ALL IN</div>' : '') +
        (cur.phase === 'showdown' && !o.folded && o.bestHand ? '<div style="font-size:10px;color:#f1c40f;font-weight:700">' + o.bestHand.name + '</div>' : '') +
        '</div>';
    });

    // Community cards
    var ccH = '';
    for (var i = 0; i < 5; i++) ccH += cur.communityCards[i] ? renderCard(cur.communityCards[i]) : renderCard({ rank: '?' });

    // Hole cards
    var hcH = '';
    if (me.holeCards && me.holeCards.length === 2) hcH = renderCard(me.holeCards[0]) + renderCard(me.holeCards[1]);

    // Showdown overlay
    var sdH = '';
    if (cur.phase === 'showdown') {
      sdH = '<div class="pk-msg"><div>' + (cur.message || '') + '</div><br><button class="pk-btn pk-call" id="btn-next" style="flex:none;padding:10px 20px">Next Hand</button></div>';
    }

    // Status line
    var statusLine = '';
    if (cur.phase !== 'showdown') {
      if (isMyTurn) {
        statusLine = '<div style="text-align:center;font-size:11px;color:#2ecc71;font-weight:700;margin-bottom:2px">Your turn</div>';
      } else {
        statusLine = '<div style="text-align:center;font-size:11px;color:#aaa;margin-bottom:2px">Waiting for ' + cur.roles[cur.turnIdx] + '...</div>';
      }
    }

    container.innerHTML = '<style>' + POKER_CSS + '</style>' +
      '<div class="pk-wrap">' +
        '<details class="pk-guide"><summary>How to Play Texas Hold\'em</summary><ul>' +
          '<li><b>Blinds:</b> Small (10) and Big (20) are posted automatically.</li>' +
          '<li><b>Hand:</b> 2 hole cards + 5 community cards = best 5-card hand.</li>' +
          '<li><b>Actions:</b> Fold, Check/Call, or Raise.</li>' +
          '<li><b>Phases:</b> Pre-flop, Flop (3), Turn (+1), River (+1), Showdown.</li>' +
          '<li><b>Rankings:</b> Royal Flush &gt; Straight Flush &gt; 4 of a Kind &gt; Full House &gt; Flush &gt; Straight &gt; 3 of a Kind &gt; Two Pair &gt; Pair &gt; High Card</li>' +
        '</ul></details>' +

        statusLine +

        '<div class="pk-table">' +
          oppH +
          '<div class="pk-center">' +
            '<div class="pk-pot">POT: ' + cur.pot + '</div>' +
            '<div class="pk-cc">' + ccH + '</div>' +
            '<div class="pk-action">' + (cur.lastAction || '') + '</div>' +
          '</div>' +
          sdH +
        '</div>' +

        '<div class="pk-dash">' +
          '<div class="pk-me-top">' +
            '<div class="pk-me-info">' +
              '<div style="font-weight:700;font-size:13px">' + myRole + ' (You)</div>' +
              '<div class="pk-chips" style="font-size:15px">' + me.chips + ' chips</div>' +
              (me.currentBet > 0 ? '<div class="pk-bet">Bet: ' + me.currentBet + '</div>' : '') +
              (me.folded ? '<div style="color:#e74c3c;font-weight:700;font-size:11px">FOLDED</div>' : '') +
              (me.allIn ? '<div style="color:#f1c40f;font-weight:700;font-size:11px">ALL IN</div>' : '') +
              (cur.phase === 'showdown' && !me.folded && me.bestHand ? '<div style="color:#f1c40f;font-weight:700;font-size:11px">' + me.bestHand.name + '</div>' : '') +
            '</div>' +
            '<div class="pk-hole">' + hcH + '</div>' +
          '</div>' +
          '<div class="pk-ctrls">' +
            '<button class="pk-btn pk-fold" id="btn-fold"' + (isMyTurn ? '' : ' disabled') + '>Fold</button>' +
            '<button class="pk-btn pk-call" id="btn-call"' + (isMyTurn && me.chips > 0 ? '' : ' disabled') + '>' + (canCheck ? 'Check' : 'Call ' + Math.min(callAmt, me.chips)) + '</button>' +
            '<button class="pk-btn pk-stand" id="btn-stand">Stand</button>' +
          '</div>' +
          '<div class="pk-raise-row">' +
            '<input type="range" id="raise-slider" min="' + minRaise + '" max="' + (me.chips + me.currentBet) + '" value="' + raiseAmount + '"' + (isMyTurn && me.chips >= minRaise - me.currentBet ? '' : ' disabled') + '>' +
            '<button class="pk-btn pk-raise" id="btn-raise" style="flex:none;width:90px"' + (isMyTurn && me.chips >= minRaise - me.currentBet ? '' : ' disabled') + '>' + (me.chips + me.currentBet <= minRaise ? 'All In' : 'Raise ' + raiseAmount) + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    // Bind buttons
    if (isMyTurn) {
      var fb = container.querySelector('#btn-fold');
      if (fb) fb.onclick = function() { onMove({ action: 'fold' }); };
      var cb = container.querySelector('#btn-call');
      if (cb) cb.onclick = function() { onMove({ action: 'call' }); };
      var sl = container.querySelector('#raise-slider');
      var rb = container.querySelector('#btn-raise');
      if (sl && rb) {
        sl.oninput = function() {
          raiseAmount = parseInt(sl.value);
          rb.textContent = raiseAmount >= (me.chips + me.currentBet) ? 'All In' : 'Raise ' + raiseAmount;
        };
        rb.onclick = function() { onMove({ action: 'raise', amount: raiseAmount }); };
      }
    }

    // Stand (leave table) — always available
    var standBtn = container.querySelector('#btn-stand');
    if (standBtn) {
      standBtn.onclick = function() {
        if (confirm('Leave the poker table? Your chips will be forfeited.')) {
          // Trigger the exit event through the renderer
          var exitBtn = document.getElementById('btn-minigame-exit');
          if (exitBtn) exitBtn.click();
        }
      };
    }

    // Next Hand — any player during showdown
    if (cur.phase === 'showdown') {
      var nb = container.querySelector('#btn-next');
      if (nb) nb.onclick = function() { onMove({ action: 'next' }); };
    }
  }

  container._pokerUpdate = function(newState) {
    cur = newState;
    paint();
  };

  paint();
}
