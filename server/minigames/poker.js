const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_VALUES = { '2':2, '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9, '10':10, 'J':11, 'Q':12, 'K':13, 'A':14 };

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, value: RANK_VALUES[rank] });
    }
  }
  // Fisher-Yates shuffle for proper randomness
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function evaluateHand(cards) {
  if (!cards || cards.length === 0) return { score: 0, name: 'High Card' };
  
  const sorted = [...cards].sort((a, b) => b.value - a.value);
  const suits = {};
  const ranks = {};
  
  for (const c of sorted) {
    suits[c.suit] = (suits[c.suit] || 0) + 1;
    ranks[c.value] = (ranks[c.value] || 0) + 1;
  }
  
  let flushSuit = null;
  for (const s in suits) {
    if (suits[s] >= 5) flushSuit = s;
  }
  
  const rankCounts = Object.entries(ranks)
    .map(([val, count]) => ({ val: parseInt(val), count }))
    .sort((a, b) => b.count - a.count || b.val - a.val);
  
  // Proper straight detection — check that all 5 values are consecutive
  const hasStraight = (cardsArr) => {
    let vals = [...new Set(cardsArr.map(c => c.value))].sort((a, b) => b - a);
    if (vals.includes(14)) vals.push(1); // Ace can be low
    for (let i = 0; i <= vals.length - 5; i++) {
      let isStraight = true;
      for (let j = 0; j < 4; j++) {
        if (vals[i + j] - vals[i + j + 1] !== 1) { isStraight = false; break; }
      }
      if (isStraight) return vals[i];
    }
    return null;
  };

  const straightHigh = hasStraight(sorted);
  let flushStraightHigh = null;
  if (flushSuit) {
    flushStraightHigh = hasStraight(sorted.filter(c => c.suit === flushSuit));
  }

  if (flushStraightHigh) {
    return { score: 8000000 + flushStraightHigh, name: flushStraightHigh === 14 ? 'Royal Flush' : 'Straight Flush' };
  }
  if (rankCounts[0].count === 4) {
    return { score: 7000000 + rankCounts[0].val * 100 + (rankCounts[1] ? rankCounts[1].val : 0), name: 'Four of a Kind' };
  }
  if (rankCounts[0].count === 3 && rankCounts[1] && rankCounts[1].count >= 2) {
    return { score: 6000000 + rankCounts[0].val * 100 + rankCounts[1].val, name: 'Full House' };
  }
  if (flushSuit) {
    const fCards = sorted.filter(c => c.suit === flushSuit).slice(0, 5);
    let s = 5000000;
    for (let i = 0; i < fCards.length; i++) s += fCards[i].value * Math.pow(16, 4 - i);
    return { score: s, name: 'Flush' };
  }
  if (straightHigh) {
    return { score: 4000000 + straightHigh, name: 'Straight' };
  }
  if (rankCounts[0].count === 3) {
    let s = 3000000 + rankCounts[0].val * 10000;
    const kickers = sorted.filter(c => c.value !== rankCounts[0].val).slice(0, 2);
    s += (kickers[0] ? kickers[0].value : 0) * 16 + (kickers[1] ? kickers[1].value : 0);
    return { score: s, name: 'Three of a Kind' };
  }
  if (rankCounts[0].count === 2 && rankCounts[1] && rankCounts[1].count === 2) {
    let s = 2000000 + rankCounts[0].val * 10000 + rankCounts[1].val * 100;
    const kicker = sorted.find(c => c.value !== rankCounts[0].val && c.value !== rankCounts[1].val);
    s += kicker ? kicker.value : 0;
    return { score: s, name: 'Two Pair' };
  }
  if (rankCounts[0].count === 2) {
    let s = 1000000 + rankCounts[0].val * 100000;
    const kickers = sorted.filter(c => c.value !== rankCounts[0].val).slice(0, 3);
    for (let i = 0; i < kickers.length; i++) s += kickers[i].value * Math.pow(16, 2 - i);
    return { score: s, name: 'Pair' };
  }
  let s = 0;
  for (let i = 0; i < 5 && i < sorted.length; i++) {
    s += sorted[i].value * Math.pow(16, 4 - i);
  }
  return { score: s, name: 'High Card' };
}

function startHand(state) {
  state.deck = createDeck();
  state.communityCards = [];
  state.pot = 0;
  state.currentBet = 0;
  state.phase = 'pre-flop';
  state.message = '';
  state.lastAction = '';
  
  // Count only the active roles (alive players)
  state.activeCount = state.roles.length;
  
  // Reset each player's per-hand state
  for (const r of state.roles) {
    const p = state.players[r];
    p.holeCards = [state.deck.pop(), state.deck.pop()];
    p.currentBet = 0;
    p.folded = false;
    p.allIn = false;
    p.actedThisRound = false;
    p.bestHand = null;
  }
  
  // Dealer rotation
  if (state.dealerIdx === undefined) {
    state.dealerIdx = 0;
  } else {
    state.dealerIdx = (state.dealerIdx + 1) % state.roles.length;
  }
  
  // Blinds — heads-up has special rules
  let sbIdx, bbIdx;
  if (state.roles.length === 2) {
    sbIdx = state.dealerIdx;
    bbIdx = (state.dealerIdx + 1) % state.roles.length;
  } else {
    sbIdx = (state.dealerIdx + 1) % state.roles.length;
    bbIdx = (state.dealerIdx + 2) % state.roles.length;
  }
  
  const sbAmount = 10;
  const bbAmount = 20;
  const sbRole = state.roles[sbIdx];
  const bbRole = state.roles[bbIdx];
  
  // Post small blind
  const actualSb = Math.min(sbAmount, state.players[sbRole].chips);
  state.players[sbRole].chips -= actualSb;
  state.players[sbRole].currentBet = actualSb;
  if (state.players[sbRole].chips === 0) state.players[sbRole].allIn = true;
  
  // Post big blind
  const actualBb = Math.min(bbAmount, state.players[bbRole].chips);
  state.players[bbRole].chips -= actualBb;
  state.players[bbRole].currentBet = actualBb;
  if (state.players[bbRole].chips === 0) state.players[bbRole].allIn = true;
  
  state.pot = actualSb + actualBb;
  state.currentBet = actualBb;
  
  // First to act is after the big blind
  state.turnIdx = (bbIdx + 1) % state.roles.length;
  
  // Check if everyone except one is already all-in
  const canActCount = state.roles.filter(r => !state.players[r].folded && !state.players[r].allIn).length;
  if (canActCount <= 1) {
    // Everyone is all-in from blinds; run out the board
    runOutBoard(state);
    return;
  }
  
  skipInactive(state);
}

// Skip past folded and all-in players to find the next person who can act
function skipInactive(state) {
  for (let i = 0; i < state.roles.length; i++) {
    const r = state.roles[state.turnIdx];
    const p = state.players[r];
    if (!p.folded && !p.allIn) return; // found someone who can act
    state.turnIdx = (state.turnIdx + 1) % state.roles.length;
  }
  // Nobody can act — run out the board
  runOutBoard(state);
}

// Deal remaining community cards and resolve
function runOutBoard(state) {
  while (state.communityCards.length < 5 && state.deck.length > 0) {
    state.communityCards.push(state.deck.pop());
  }
  state.phase = 'showdown';
  resolveShowdown(state);
}

function advancePhase(state) {
  // Reset per-round state
  for (const r of state.roles) {
    state.players[r].currentBet = 0;
    state.players[r].actedThisRound = false;
  }
  state.currentBet = 0;
  
  if (state.phase === 'pre-flop') {
    state.phase = 'flop';
    state.communityCards.push(state.deck.pop(), state.deck.pop(), state.deck.pop());
  } else if (state.phase === 'flop') {
    state.phase = 'turn';
    state.communityCards.push(state.deck.pop());
  } else if (state.phase === 'turn') {
    state.phase = 'river';
    state.communityCards.push(state.deck.pop());
  } else if (state.phase === 'river') {
    state.phase = 'showdown';
    resolveShowdown(state);
    return;
  }
  
  // First to act post-flop is left of dealer
  state.turnIdx = (state.dealerIdx + 1) % state.roles.length;
  
  // Check if anyone can even act
  const canActCount = state.roles.filter(r => !state.players[r].folded && !state.players[r].allIn).length;
  if (canActCount <= 1) {
    runOutBoard(state);
    return;
  }
  
  skipInactive(state);
}

function resolveShowdown(state) {
  const activeRoles = state.roles.filter(r => !state.players[r].folded);
  
  if (activeRoles.length === 1) {
    const winner = activeRoles[0];
    state.players[winner].chips += state.pot;
    state.message = winner + ' wins ' + state.pot + ' chips.';
  } else {
    let bestScore = -1;
    let winners = [];
    
    for (const r of activeRoles) {
      const allCards = [...state.players[r].holeCards, ...state.communityCards];
      const hand = evaluateHand(allCards);
      state.players[r].bestHand = hand;
      
      if (hand.score > bestScore) {
        bestScore = hand.score;
        winners = [r];
      } else if (hand.score === bestScore) {
        winners.push(r);
      }
    }
    
    const split = Math.floor(state.pot / winners.length);
    for (const w of winners) {
      state.players[w].chips += split;
    }
    
    const handName = state.players[winners[0]].bestHand.name;
    if (winners.length === 1) {
      state.message = winners[0] + ' wins ' + split + ' chips with ' + handName + '!';
    } else {
      state.message = winners.join(' & ') + ' split ' + state.pot + ' chips (' + handName + ')';
    }
  }
  
  state.pot = 0;
  state.phase = 'showdown';
  
  // Set turnIdx to the first active player so someone can press "Next Hand"
  // Any non-broke active player should be able to press it
  for (let i = 0; i < state.roles.length; i++) {
    if (!state.players[state.roles[i]].folded) {
      state.turnIdx = i;
      break;
    }
  }
}

function getSanitizedState(state, role) {
  // Deep copy everything except deck
  const sanitized = JSON.parse(JSON.stringify(state));
  delete sanitized.deck;
  
  // Hide opponent hole cards unless showdown
  for (const r of sanitized.roles) {
    if (r !== role && sanitized.phase !== 'showdown') {
      sanitized.players[r].holeCards = [{ rank: '?', suit: '?' }, { rank: '?', suit: '?' }];
    }
  }
  
  return sanitized;
}

function isBettingRoundOver(state) {
  for (const r of state.roles) {
    const p = state.players[r];
    if (p.folded || p.allIn) continue;
    // Player must have acted and matched the current bet
    if (!p.actedThisRound) return false;
    if (p.currentBet < state.currentBet) return false;
  }
  return true;
}

module.exports = {
  id: 'poker',
  flexibleStart: true,
  minPlayers: 2,
  maxPlayers: 5,

  createState(playerCount) {
    const roles = [];
    for (let i = 0; i < playerCount; i++) {
      roles.push('p' + (i + 1));
    }
    const state = {
      roles,
      players: {},
      dealerIdx: undefined,
      communityCards: [],
      pot: 0,
      currentBet: 0,
      phase: 'pre-flop',
      turnIdx: 0,
      activeCount: playerCount,
      message: '',
      lastAction: ''
    };
    for (const r of roles) {
      state.players[r] = {
        chips: 1000,
        holeCards: [],
        currentBet: 0,
        folded: false,
        allIn: false,
        actedThisRound: false,
        bestHand: null
      };
    }
    startHand(state);
    return state;
  },

  handleMove(state, role, actionData) {
    if (!actionData || !actionData.action) return { state };
    
    // During showdown, any non-folded player can press "Next Hand"
    if (state.phase === 'showdown') {
      if (actionData.action === 'next') {
        // Remove broke players
        const aliveRoles = state.roles.filter(r => state.players[r].chips > 0);
        if (aliveRoles.length < 2) {
          state.winner = aliveRoles[0] || 'Nobody';
          return { state };
        }
        // Clean up broke players from state
        state.roles = aliveRoles;
        startHand(state);
      }
      return { state };
    }
    
    // Only the current player can act during betting
    if (!role || state.roles[state.turnIdx] !== role) return { state };
    
    const p = state.players[role];
    
    // Can't act if folded or all-in
    if (p.folded || p.allIn) return { state };
    
    const callAmount = state.currentBet - p.currentBet;
    
    switch (actionData.action) {
      case 'fold':
        p.folded = true;
        state.activeCount--;
        state.lastAction = role + ' folded';
        
        // Check if only one player remains
        if (state.activeCount <= 1) {
          state.phase = 'showdown';
          resolveShowdown(state);
          return { state };
        }
        break;
        
      case 'call':
      case 'check': {
        const actualCall = Math.min(callAmount, p.chips);
        p.chips -= actualCall;
        p.currentBet += actualCall;
        state.pot += actualCall;
        if (p.chips === 0) p.allIn = true;
        state.lastAction = actualCall > 0 ? (role + ' called ' + actualCall) : (role + ' checked');
        break;
      }
        
      case 'raise': {
        const raiseTo = parseInt(actionData.amount) || 0;
        if (raiseTo <= state.currentBet) return { state }; // Must raise above current bet
        
        const totalToPutIn = raiseTo - p.currentBet;
        if (totalToPutIn <= 0 || totalToPutIn > p.chips) {
          // If they can't afford it, treat as all-in
          const allInAmount = p.chips;
          state.pot += allInAmount;
          p.currentBet += allInAmount;
          p.chips = 0;
          p.allIn = true;
          if (p.currentBet > state.currentBet) {
            state.currentBet = p.currentBet;
            // Reset acted flags — everyone needs to respond to the new bet
            for (const r of state.roles) {
              if (r !== role) state.players[r].actedThisRound = false;
            }
          }
          state.lastAction = role + ' went all-in (' + p.currentBet + ')';
          break;
        }
        
        p.chips -= totalToPutIn;
        p.currentBet += totalToPutIn;
        state.pot += totalToPutIn;
        state.currentBet = p.currentBet;
        if (p.chips === 0) p.allIn = true;
        state.lastAction = role + ' raised to ' + p.currentBet;
        
        // Everyone else needs to act again
        for (const r of state.roles) {
          if (r !== role) state.players[r].actedThisRound = false;
        }
        break;
      }
        
      default:
        return { state };
    }
    
    // Mark this player as having acted
    p.actedThisRound = true;
    
    // Move to next player
    state.turnIdx = (state.turnIdx + 1) % state.roles.length;
    skipInactive(state);
    
    // If we're still in a betting phase, check if the round is over
    if (state.phase !== 'showdown') {
      if (isBettingRoundOver(state)) {
        advancePhase(state);
      }
    }
    
    return { state };
  },

  checkEnd(state) {
    if (state.winner) {
      return { ended: true, winner: state.winner };
    }
    return { ended: false };
  },

  getSanitizedState(state, role) {
    return getSanitizedState(state, role);
  }
};
