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
  return deck.sort(() => Math.random() - 0.5);
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
  
  const rankCounts = Object.entries(ranks).map(([val, count]) => ({ val: parseInt(val), count })).sort((a, b) => b.count - a.count || b.val - a.val);
  
  const hasStraight = (cardsArr) => {
    let vals = [...new Set(cardsArr.map(c => c.value))].sort((a, b) => b - a);
    if (vals.includes(14)) vals.push(1); // Ace can be low
    for (let i = 0; i <= vals.length - 5; i++) {
      if (vals[i] - vals[i+4] === 4) return vals[i];
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
    return { score: 7000000 + rankCounts[0].val * 100 + rankCounts[1].val, name: 'Four of a Kind' };
  }
  if (rankCounts[0].count === 3 && rankCounts[1] && rankCounts[1].count >= 2) {
    return { score: 6000000 + rankCounts[0].val * 100 + rankCounts[1].val, name: 'Full House' };
  }
  if (flushSuit) {
    const fCards = sorted.filter(c => c.suit === flushSuit).slice(0, 5);
    let s = 5000000;
    for (let i=0; i<5; i++) s += fCards[i].value * Math.pow(16, 4-i);
    return { score: s, name: 'Flush' };
  }
  if (straightHigh) {
    return { score: 4000000 + straightHigh, name: 'Straight' };
  }
  if (rankCounts[0].count === 3) {
    let s = 3000000 + rankCounts[0].val * 10000;
    const kickers = sorted.filter(c => c.value !== rankCounts[0].val).slice(0, 2);
    s += (kickers[0]?.value||0)*16 + (kickers[1]?.value||0);
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
    for (let i=0; i<kickers.length; i++) s += kickers[i].value * Math.pow(16, 2-i);
    return { score: s, name: 'Pair' };
  }
  let s = 0;
  for (let i=0; i<5; i++) {
    if (sorted[i]) s += sorted[i].value * Math.pow(16, 4-i);
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
  
  for (const r of state.roles) {
    const p = state.players[r];
    p.holeCards = [state.deck.pop(), state.deck.pop()];
    p.currentBet = 0;
    p.folded = false;
    p.allIn = false;
    p.actedThisRound = false;
  }
  
  state.activeCount = state.roles.length;
  if (state.dealerIdx === undefined) state.dealerIdx = Math.floor(Math.random() * state.roles.length);
  else state.dealerIdx = (state.dealerIdx + 1) % state.roles.length;
  
  let sbIdx = (state.dealerIdx + 1) % state.roles.length;
  let bbIdx = (state.dealerIdx + 2) % state.roles.length;
  if (state.roles.length === 2) {
    sbIdx = state.dealerIdx;
    bbIdx = (state.dealerIdx + 1) % state.roles.length;
  }
  
  const sbAmount = 10;
  const bbAmount = 20;
  const sbRole = state.roles[sbIdx];
  const bbRole = state.roles[bbIdx];
  
  const actualSb = Math.min(sbAmount, state.players[sbRole].chips);
  state.players[sbRole].chips -= actualSb;
  state.players[sbRole].currentBet = actualSb;
  if (state.players[sbRole].chips === 0) state.players[sbRole].allIn = true;
  
  const actualBb = Math.min(bbAmount, state.players[bbRole].chips);
  state.players[bbRole].chips -= actualBb;
  state.players[bbRole].currentBet = actualBb;
  if (state.players[bbRole].chips === 0) state.players[bbRole].allIn = true;
  
  state.pot = actualSb + actualBb;
  state.currentBet = bbAmount;
  state.lastRaiser = bbRole;
  state.turnIdx = (bbIdx + 1) % state.roles.length;
  
  skipAllInOrFolded(state);
}

function skipAllInOrFolded(state) {
  let startIdx = state.turnIdx;
  let loops = 0;
  while (state.players[state.roles[state.turnIdx]].folded || state.players[state.roles[state.turnIdx]].allIn) {
    state.turnIdx = (state.turnIdx + 1) % state.roles.length;
    loops++;
    if (loops >= state.roles.length) {
      if (state.activeCount > 1) {
        while (state.phase !== 'showdown') advancePhase(state);
      }
      return;
    }
  }
}

function advancePhase(state) {
  for (const r of state.roles) {
    state.players[r].currentBet = 0;
    state.players[r].actedThisRound = false;
  }
  state.currentBet = 0;
  state.lastRaiser = null;
  
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
  
  state.turnIdx = (state.dealerIdx + 1) % state.roles.length;
  skipAllInOrFolded(state);
}

function resolveShowdown(state) {
  const activeRoles = state.roles.filter(r => !state.players[r].folded);
  
  if (activeRoles.length === 1) {
    const winner = activeRoles[0];
    state.players[winner].chips += state.pot;
    state.message = `${winner} wins ${state.pot} chips.`;
  } else {
    let bestScore = -1;
    let winners = [];
    
    for (const r of activeRoles) {
      const hand = evaluateHand([...state.players[r].holeCards, ...state.communityCards]);
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
    state.message = `${winners.join(', ')} won ${split} chips with ${state.players[winners[0]].bestHand.name}.`;
  }
  
  state.pot = 0;
  state.phase = 'showdown';
}

function getSanitizedState(state, role) {
  const sanitized = { ...state, players: {} };
  for (const r of state.roles) {
    sanitized.players[r] = {
      chips: state.players[r].chips,
      currentBet: state.players[r].currentBet,
      folded: state.players[r].folded,
      allIn: state.players[r].allIn,
      holeCards: (r === role || state.phase === 'showdown') ? state.players[r].holeCards : [{ rank: '?', suit: '?' }, { rank: '?', suit: '?' }],
      bestHand: state.players[r].bestHand
    };
  }
  delete sanitized.deck;
  return sanitized;
}

module.exports = {
  id: 'poker',
  flexibleStart: true,
  minPlayers: 2,
  maxPlayers: 5,

  createState(playerCount) {
    const roles = [];
    for (let i = 0; i < playerCount; i++) {
      roles.push(`p${i + 1}`);
    }
    const state = {
      roles,
      players: {},
      dealerIdx: undefined
    };
    for (const r of roles) {
      state.players[r] = { chips: 1000, holeCards: [], currentBet: 0, folded: false, allIn: false, actedThisRound: false };
    }
    startHand(state);
    return state;
  },

  handleMove(state, role, actionData) {
    if (!role || state.roles[state.turnIdx] !== role) return { state };
    if (state.phase === 'showdown') {
      if (actionData.action === 'next') {
        state.roles = state.roles.filter(r => state.players[r].chips > 0);
        if (state.roles.length < 2) {
          state.winner = state.roles[0] || 'Nobody';
        } else {
          startHand(state);
        }
        return { state };
      }
      return { state };
    }

    const p = state.players[role];
    const callAmount = state.currentBet - p.currentBet;
    p.actedThisRound = true;
    
    switch (actionData.action) {
      case 'fold':
        p.folded = true;
        state.activeCount--;
        state.lastAction = `${role} folded`;
        if (state.activeCount === 1) {
          state.phase = 'showdown';
          resolveShowdown(state);
          return { state };
        }
        break;
        
      case 'call':
      case 'check':
        const actualCall = Math.min(callAmount, p.chips);
        p.chips -= actualCall;
        p.currentBet += actualCall;
        state.pot += actualCall;
        if (p.chips === 0) p.allIn = true;
        state.lastAction = actualCall > 0 ? `${role} called ${actualCall}` : `${role} checked`;
        break;
        
      case 'raise':
        const raiseTo = parseInt(actionData.amount) || 0;
        const totalToPutIn = raiseTo - p.currentBet;
        if (totalToPutIn <= 0 || totalToPutIn > p.chips) return { state };
        
        p.chips -= totalToPutIn;
        p.currentBet += totalToPutIn;
        state.pot += totalToPutIn;
        state.currentBet = p.currentBet;
        state.lastRaiser = role;
        if (p.chips === 0) p.allIn = true;
        state.lastAction = `${role} raised to ${p.currentBet}`;
        
        // Everyone else must act again
        for (const r of state.roles) {
          if (r !== role) state.players[r].actedThisRound = false;
        }
        break;
        
      default:
        return { state };
    }
    
    // Move to next player
    state.turnIdx = (state.turnIdx + 1) % state.roles.length;
    skipAllInOrFolded(state);
    
    if (state.phase !== 'showdown') {
      // Check if betting round is over
      let allActed = true;
      let allMatched = true;
      let playersWhoCanAct = 0;
      
      for (const r of state.roles) {
        const pr = state.players[r];
        if (!pr.folded && !pr.allIn) {
          playersWhoCanAct++;
          if (!pr.actedThisRound) allActed = false;
          if (pr.currentBet < state.currentBet) allMatched = false;
        }
      }
      
      if (playersWhoCanAct <= 1 && allMatched) {
        // Only 0 or 1 player can still act, and they've matched the current bet
        advancePhase(state);
      } else if (allActed && allMatched) {
        advancePhase(state);
      }
    }
    
    return { state };
  },

  checkEnd(state) {
    if (state.winner) return { ended: true, winner: state.winner, state };
    return { ended: false };
  },

  getSanitizedState(state, role) {
    return getSanitizedState(state, role);
  }
};
