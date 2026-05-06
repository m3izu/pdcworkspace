/**
 * Tong-its — Server-side game logic
 * Filipino rummy card game for 3 players.
 *
 * Rules implemented:
 * - 52-card deck, 3 players: dealer gets 13 cards, others get 12
 * - On your turn: draw from stock OR pick up discard pile top
 * - Optionally meld (set of 3-4 same rank, or run of 3+ consecutive same suit)
 * - Optionally lay off cards onto existing melds (yours or opponents')
 * - Discard 1 card to end turn
 * - Win: empty hand ("Tong-its"), or lowest deadwood when stock runs out
 * - "Fight" call: player can call fight to end game early, lowest deadwood wins
 */

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RANK_VALUES = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 10, Q: 10, K: 10 };

function makeDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let i = 0; i < RANKS.length; i++) {
      deck.push({ suit, rank: RANKS[i], value: RANK_VALUES[RANKS[i]], order: i });
    }
  }
  // Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cardId(card) {
  return `${card.rank}${card.suit}`;
}

function handScore(hand) {
  return hand.reduce((sum, c) => sum + c.value, 0);
}

function isValidMeld(cards) {
  if (cards.length < 3) return false;

  // Check set: same rank, different suits
  if (cards.every(c => c.rank === cards[0].rank)) {
    const suits = new Set(cards.map(c => c.suit));
    return suits.size === cards.length && cards.length <= 4;
  }

  // Check run: same suit, consecutive
  if (cards.every(c => c.suit === cards[0].suit)) {
    const sorted = [...cards].sort((a, b) => a.order - b.order);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].order !== sorted[i - 1].order + 1) return false;
    }
    return true;
  }

  return false;
}

function canLayOff(card, meld) {
  // Try adding card to meld and check if still valid
  const test = [...meld, card];
  return isValidMeld(test);
}

module.exports = {
  id: 'tongits',
  name: 'Tong-its',
  playerCount: 3,
  roles: ['player1', 'player2', 'player3'],

  createState: () => {
    const deck = makeDeck();
    // Deal: player1 (dealer) gets 13, others get 12
    const hands = {
      player1: deck.splice(0, 13),
      player2: deck.splice(0, 12),
      player3: deck.splice(0, 12),
    };

    return {
      hands,
      stock: deck,
      discard: [],
      melds: [],          // { owner: role, cards: [...] }
      turn: 'player1',    // dealer goes first
      phase: 'draw',      // 'draw' | 'action' | 'discard'
      winner: null,
      isDraw: false,
      drawnCard: null,     // card just drawn (for highlighting)
      lastAction: null,    // description of last action for UI
      scores: null,        // set on game end
    };
  },

  handleMove(state, playerRole, data) {
    if (state.winner) return { state, events: [] };
    if (state.turn !== playerRole) return { state, events: [] };

    const hand = state.hands[playerRole];
    const { action } = data;

    switch (action) {
      case 'draw-stock': {
        if (state.phase !== 'draw') return { state, events: [] };
        if (state.stock.length === 0) return { state, events: [] };
        const card = state.stock.pop();
        hand.push(card);
        state.drawnCard = cardId(card);
        state.phase = 'action';
        state.lastAction = `${playerRole} drew from stock`;
        break;
      }

      case 'draw-discard': {
        if (state.phase !== 'draw') return { state, events: [] };
        if (state.discard.length === 0) return { state, events: [] };
        const card = state.discard.pop();
        hand.push(card);
        state.drawnCard = cardId(card);
        state.phase = 'action';
        state.lastAction = `${playerRole} picked up ${cardId(card)}`;
        break;
      }

      case 'meld': {
        if (state.phase !== 'action') return { state, events: [] };
        const { cardIds } = data; // array of card IDs to meld
        if (!cardIds || cardIds.length < 3) return { state, events: [] };

        const meldCards = [];
        for (const cid of cardIds) {
          const idx = hand.findIndex(c => cardId(c) === cid);
          if (idx === -1) return { state, events: [] };
          meldCards.push(hand[idx]);
        }

        if (!isValidMeld(meldCards)) return { state, events: [] };

        // Remove cards from hand
        for (const cid of cardIds) {
          const idx = hand.findIndex(c => cardId(c) === cid);
          hand.splice(idx, 1);
        }

        state.melds.push({ owner: playerRole, cards: meldCards });
        state.lastAction = `${playerRole} melded ${cardIds.join(', ')}`;

        // Check for Tong-its (empty hand after meld)
        if (hand.length === 0) {
          state.winner = playerRole;
          state.lastAction = `${playerRole} wins with TONG-ITS! 🎉`;
        }
        break;
      }

      case 'layoff': {
        if (state.phase !== 'action') return { state, events: [] };
        const { cardId: cid, meldIndex } = data;
        const idx = hand.findIndex(c => cardId(c) === cid);
        if (idx === -1) return { state, events: [] };
        if (meldIndex < 0 || meldIndex >= state.melds.length) return { state, events: [] };

        const card = hand[idx];
        if (!canLayOff(card, state.melds[meldIndex].cards)) return { state, events: [] };

        hand.splice(idx, 1);
        state.melds[meldIndex].cards.push(card);
        state.lastAction = `${playerRole} laid off ${cardId(card)}`;

        if (hand.length === 0) {
          state.winner = playerRole;
          state.lastAction = `${playerRole} wins with TONG-ITS! 🎉`;
        }
        break;
      }

      case 'discard': {
        if (state.phase !== 'action') return { state, events: [] };
        const { cardId: cid } = data;
        const idx = hand.findIndex(c => cardId(c) === cid);
        if (idx === -1) return { state, events: [] };

        const card = hand.splice(idx, 1)[0];
        state.discard.push(card);
        state.drawnCard = null;
        state.lastAction = `${playerRole} discarded ${cardId(card)}`;

        if (hand.length === 0) {
          state.winner = playerRole;
          state.lastAction = `${playerRole} wins with TONG-ITS! 🎉`;
          break;
        }

        // Next player
        const order = ['player1', 'player2', 'player3'];
        const nextIdx = (order.indexOf(playerRole) + 1) % 3;
        state.turn = order[nextIdx];
        state.phase = 'draw';
        break;
      }

      case 'fight': {
        // Can only call fight during action phase (after drawing)
        if (state.phase !== 'action') return { state, events: [] };

        // Calculate scores
        const scores = {};
        for (const role of ['player1', 'player2', 'player3']) {
          scores[role] = handScore(state.hands[role]);
        }
        state.scores = scores;

        // Lowest deadwood wins
        let minScore = Infinity;
        let winner = null;
        for (const [role, score] of Object.entries(scores)) {
          if (score < minScore) {
            minScore = score;
            winner = role;
          }
        }
        state.winner = winner;
        state.lastAction = `${playerRole} called FIGHT! ${winner} wins with ${minScore} points`;
        break;
      }

      default:
        return { state, events: [] };
    }

    return { state, events: [] };
  },

  checkEnd(state) {
    if (state.winner) {
      return { ended: true, winner: state.winner, state };
    }

    // Stock empty → auto-end with scoring
    if (state.stock.length === 0 && state.phase === 'draw') {
      const scores = {};
      for (const role of ['player1', 'player2', 'player3']) {
        scores[role] = handScore(state.hands[role]);
      }
      state.scores = scores;

      let minScore = Infinity;
      let winner = null;
      for (const [role, score] of Object.entries(scores)) {
        if (score < minScore) { minScore = score; winner = role; }
      }
      state.winner = winner;
      state.lastAction = `Stock is empty! ${winner} wins with ${minScore} points`;
      return { ended: true, winner, state };
    }

    return { ended: false };
  }
};
