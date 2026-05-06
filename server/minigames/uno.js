/**
 * UNO — Server-side game logic
 * Supports 2–5 players with standard UNO rules.
 *
 * Card types:
 *   Number cards: 0-9 in Red/Blue/Green/Yellow (one 0, two each 1-9 per color = 76)
 *   Action cards: Skip, Reverse, Draw Two (two each per color = 24)
 *   Wild cards: Wild (4), Wild Draw Four (4) = 8
 *   Total: 108 cards
 */

const COLORS = ['red', 'blue', 'green', 'yellow'];
const VALUES = ['0','1','2','3','4','5','6','7','8','9','skip','reverse','draw2'];

function makeDeck() {
  const deck = [];
  let id = 0;
  for (const color of COLORS) {
    // One 0 per color
    deck.push({ id: id++, color, value: '0', type: 'number' });
    // Two each of 1-9
    for (let v = 1; v <= 9; v++) {
      deck.push({ id: id++, color, value: String(v), type: 'number' });
      deck.push({ id: id++, color, value: String(v), type: 'number' });
    }
    // Two each of skip, reverse, draw2
    for (const action of ['skip', 'reverse', 'draw2']) {
      deck.push({ id: id++, color, value: action, type: 'action' });
      deck.push({ id: id++, color, value: action, type: 'action' });
    }
  }
  // 4 Wilds, 4 Wild Draw Fours
  for (let i = 0; i < 4; i++) {
    deck.push({ id: id++, color: 'wild', value: 'wild', type: 'wild' });
    deck.push({ id: id++, color: 'wild', value: 'wild4', type: 'wild' });
  }
  // Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cardLabel(c) {
  if (c.type === 'wild') return c.value === 'wild' ? 'WILD' : 'WILD+4';
  const valMap = { skip: '⊘', reverse: '⟲', draw2: '+2' };
  return `${valMap[c.value] || c.value}`;
}

function canPlay(card, topCard, currentColor) {
  if (card.type === 'wild') return true;
  if (card.color === currentColor) return true;
  if (card.value === topCard.value) return true;
  return false;
}

module.exports = {
  id: 'uno',
  name: 'UNO',
  minPlayers: 2,
  maxPlayers: 5,
  flexibleStart: true,   // uses ready-up lobby
  playerCount: 2,        // minimum
  roles: [],             // assigned dynamically

  createState: (playerCount) => {
    const deck = makeDeck();
    const roles = [];
    const hands = {};
    for (let i = 0; i < playerCount; i++) {
      const role = `p${i + 1}`;
      roles.push(role);
      hands[role] = deck.splice(0, 7);
    }

    // Find a non-wild starting card
    let startIdx = deck.findIndex(c => c.type !== 'wild');
    if (startIdx === -1) startIdx = 0;
    const startCard = deck.splice(startIdx, 1)[0];

    // Determine initial direction and handle starting action cards
    let direction = 1; // 1 = clockwise, -1 = counter
    let turnIdx = 0;
    let drawPending = 0;

    if (startCard.value === 'reverse' && playerCount > 2) {
      direction = -1;
    } else if (startCard.value === 'skip') {
      turnIdx = 1;
    } else if (startCard.value === 'draw2') {
      drawPending = 2;
    }

    return {
      hands,
      roles,
      stock: deck,
      discard: [startCard],
      currentColor: startCard.color === 'wild' ? 'red' : startCard.color,
      direction,
      turnIdx,
      drawPending,
      winner: null,
      lastAction: null,
      mustDraw: false,   // player must draw if no playable card
      hasDrawn: false,    // player already drew this turn
      unoCall: {},        // role -> boolean (called UNO)
    };
  },

  handleMove(state, playerRole, data) {
    if (state.winner) return { state, events: [] };
    const currentRole = state.roles[state.turnIdx];
    if (currentRole !== playerRole) return { state, events: [] };

    const hand = state.hands[playerRole];
    const { action } = data;

    switch (action) {
      case 'play': {
        const { cardId, chosenColor } = data;
        const idx = hand.findIndex(c => c.id === cardId);
        if (idx === -1) return { state, events: [] };

        const card = hand[idx];
        const topCard = state.discard[state.discard.length - 1];

        // If there's a pending draw2/wild4, player must draw unless they can stack
        if (state.drawPending > 0) {
          // Can only play draw2 on draw2, or wild4
          if (card.value !== 'draw2' && card.value !== 'wild4') {
            return { state, events: [] };
          }
        }

        if (!canPlay(card, topCard, state.currentColor)) return { state, events: [] };

        // Play the card
        hand.splice(idx, 1);
        state.discard.push(card);
        state.hasDrawn = false;

        // Update color
        if (card.type === 'wild') {
          state.currentColor = chosenColor || 'red';
        } else {
          state.currentColor = card.color;
        }

        state.lastAction = `${playerRole} played ${cardLabel(card)}`;

        // Check UNO call
        if (hand.length === 1) {
          state.unoCall[playerRole] = false; // needs to call
        }

        // Check win
        if (hand.length === 0) {
          state.winner = playerRole;
          state.lastAction = `${playerRole} wins! 🎉`;
          return { state, events: [] };
        }

        // Handle action effects
        const pc = state.roles.length;
        if (card.value === 'skip') {
          // Skip next player
          state.turnIdx = (state.turnIdx + state.direction * 2 + pc * 2) % pc;
        } else if (card.value === 'reverse') {
          state.direction *= -1;
          if (pc === 2) {
            // In 2-player, reverse acts as skip
            state.turnIdx = (state.turnIdx + state.direction * 2 + pc * 2) % pc;
          } else {
            state.turnIdx = (state.turnIdx + state.direction + pc) % pc;
          }
        } else if (card.value === 'draw2') {
          state.drawPending += 2;
          state.turnIdx = (state.turnIdx + state.direction + pc) % pc;
        } else if (card.value === 'wild4') {
          state.drawPending += 4;
          state.turnIdx = (state.turnIdx + state.direction + pc) % pc;
        } else {
          state.turnIdx = (state.turnIdx + state.direction + pc) % pc;
        }

        break;
      }

      case 'draw': {
        if (state.hasDrawn && state.drawPending === 0) {
          // Already drew, must pass
          return { state, events: [] };
        }

        let drawCount = state.drawPending > 0 ? state.drawPending : 1;
        state.drawPending = 0;

        // Draw cards
        for (let i = 0; i < drawCount; i++) {
          if (state.stock.length === 0) {
            // Reshuffle discard into stock, keep top card
            const top = state.discard.pop();
            state.stock = state.discard;
            state.discard = [top];
            for (let j = state.stock.length - 1; j > 0; j--) {
              const k = Math.floor(Math.random() * (j + 1));
              [state.stock[j], state.stock[k]] = [state.stock[k], state.stock[j]];
            }
          }
          if (state.stock.length > 0) {
            hand.push(state.stock.pop());
          }
        }

        state.lastAction = `${playerRole} drew ${drawCount} card${drawCount > 1 ? 's' : ''}`;

        if (drawCount > 1) {
          // Forced draw (from +2/+4), turn passes
          const pc = state.roles.length;
          state.turnIdx = (state.turnIdx + state.direction + pc) % pc;
          state.hasDrawn = false;
        } else {
          state.hasDrawn = true;
        }

        break;
      }

      case 'pass': {
        if (!state.hasDrawn) return { state, events: [] }; // Must draw first
        state.hasDrawn = false;
        state.lastAction = `${playerRole} passed`;
        const pc = state.roles.length;
        state.turnIdx = (state.turnIdx + state.direction + pc) % pc;
        break;
      }

      case 'uno': {
        state.unoCall[playerRole] = true;
        state.lastAction = `${playerRole} called UNO! 🔴`;
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
    return { ended: false };
  }
};
