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
    return '<div style="' + dims + 'background:rgba(0,0,0,0.15);border:4px solid rgba(255,255,255,0.1);margin:0 2px;flex-shrink:0;"></div>';
  }

  var url = getSpriteUrl(card, isHidden);
  return '<div style="' + dims + 'margin:0 2px;flex-shrink:0;">' +
    '<img src="' + url + '" style="width:100%;height:100%;object-fit:contain;border:4px solid #fff;box-shadow:4px 4px 0 #000;">' +
    '</div>';
}

var POKER_CSS = [
  '.pk-wrap{display:flex;flex-direction:column;height:100%;gap:8px;padding:8px;box-sizing:border-box;color:#fff;font-family:var(--font-body)}',
  '.pk-guide{background:#000;border:2px solid #fff;padding:6px 10px;font-size:14px;margin-bottom:2px;box-shadow:4px 4px 0 rgba(0,0,0,0.5)}',
  '.pk-guide summary{cursor:pointer;color:var(--accent);font-family:var(--font-main);font-size:10px}',
  '.pk-guide ul{margin:4px 0;padding-left:16px;color:#bbb;line-height:1.2}',

  '.pk-table{flex:1;background:#063b21;border:8px solid #5c3a21;box-shadow:8px 8px 0 rgba(0,0,0,0.8);position:relative;display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:280px;padding:15px;image-rendering:pixelated}',
  '.pk-table::before{content:"";position:absolute;top:10px;bottom:10px;left:10px;right:10px;border:4px solid rgba(255,255,255,0.1);pointer-events:none}',
  '.pk-center{text-align:center;z-index:2;width:100%}',
  '.pk-pot{font-size:18px;color:var(--accent);font-family:var(--font-main);margin-bottom:8px;background:#000;padding:8px 16px;border:4px solid var(--accent);display:inline-block;box-shadow:6px 6px 0 rgba(0,0,0,0.5)}',
  '.pk-cc{display:flex;justify-content:center;gap:4px;flex-wrap:nowrap}',
  '.pk-action{font-size:12px;color:var(--accent);text-align:center;margin-top:4px;min-height:14px;font-family:var(--font-body)}',

  '.pk-opp{position:absolute;background:#000;padding:8px 12px;border:4px solid #fff;text-align:center;box-shadow:6px 6px 0 rgba(0,0,0,0.5);z-index:5;min-width:80px}',
  '.pk-opp.on{border-color:var(--accent);box-shadow:0 0 16px var(--accent)}',
  '.pk-opp.out{opacity:0.4;filter:grayscale(1)}',
  '.pk-opp-cards{display:flex;justify-content:center;gap:2px;margin-bottom:4px}',
  '.pk-dash{background:#000;padding:12px;border:4px solid #fff;box-shadow:8px 8px 0 rgba(0,0,0,0.6);display:flex;flex-direction:column;gap:8px}',
  '.pk-me-top{display:flex;justify-content:space-between;align-items:center}',
  '.pk-me-info{text-align:left;font-family:var(--font-body)}',
  '.pk-hole{display:flex;gap:4px}',

  '.pk-ctrls{display:flex;gap:6px;width:100%}',
  '.pk-btn{color:#fff;border:4px solid #fff;border-bottom:6px solid #000;border-right:6px solid #000;padding:10px 6px;font-family:var(--font-main);font-size:10px;cursor:pointer;text-transform:uppercase;flex:1;text-align:center}',
  '.pk-btn:disabled{opacity:0.3;cursor:not-allowed}',
  '.pk-btn:active:not(:disabled){transform:translate(2px,2px);border-bottom-width:2px;border-right-width:2px}',
  '.pk-fold{background:#e74c3c}',
  '.pk-call{background:#2ecc71}',
  '.pk-raise{background:#f39c12}',
  '.pk-stand{background:#95a5a6}',
  '.pk-raise-row{display:flex;gap:6px;align-items:center;background:#222;padding:6px 10px;border:2px solid #fff}',
  '.pk-raise-row input[type=range]{flex:1;margin:0;cursor:pointer}',
  '.pk-chips{color:var(--accent);font-family:var(--font-main);font-size:12px}',
  '.pk-bet{color:#3498db;font-family:var(--font-main);font-size:8px;background:#000;border:1px solid #3498db;padding:2px 6px;display:inline-block;margin-top:2px}',
  '.pk-msg{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--bg-window);border:8px solid #fff;color:#fff;padding:24px;text-align:center;z-index:100;font-family:var(--font-main);font-size:12px;width:78%;box-shadow:12px 12px 0 rgba(0,0,0,0.8)}',
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
