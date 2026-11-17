(function (global) {
  'use strict';
  const ranks = '23456789TJQKA';
  const suits = 'SHDC';
  const names = ['High card', 'One pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];
  function shuffledDeck() {
    const cards = [];
    for (const suit of suits) for (const rank of ranks) cards.push(rank + suit);
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }
  function deal() {
    const cards = shuffledDeck();
    return { board: cards.slice(0, 16), shared: cards.slice(16, 19) };
  }
  function evaluate(cards) {
    if (!Array.isArray(cards) || cards.length !== 5 || new Set(cards).size !== 5) throw new Error('Exactly five distinct cards are required');
    const values = cards.map(c => ranks.indexOf(c[0]) + 2);
    if (values.some(x => x < 2)) throw new Error('Invalid card');
    const counts = new Map();
    for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
    const unique = [...counts.keys()].sort((a, b) => b - a);
    const withAceLow = unique.includes(14) ? [...unique, 1] : unique;
    let straight = 0;
    for (let i = 0; i <= withAceLow.length - 5; i++) {
      if (withAceLow[i] - withAceLow[i + 4] === 4) { straight = withAceLow[i]; break; }
    }
    const flush = cards.every(c => c[1] === cards[0][1]);
    const groups = [...counts.entries()].map(([rank, size]) => ({rank, size})).sort((a,b) => b.size - a.size || b.rank - a.rank);
    const desc = [...values].sort((a,b) => b-a);
    let score;
    if (straight && flush) score = [8, straight];
    else if (groups[0].size === 4) score = [7, groups[0].rank, groups[1].rank];
    else if (groups[0].size === 3 && groups[1].size === 2) score = [6, groups[0].rank, groups[1].rank];
    else if (flush) score = [5, ...desc];
    else if (straight) score = [4, straight];
    else if (groups[0].size === 3) score = [3, groups[0].rank, ...groups.filter(g => g.size === 1).map(g => g.rank).sort((a,b) => b-a)];
    else if (groups[0].size === 2 && groups[1].size === 2) score = [2, Math.max(groups[0].rank,groups[1].rank), Math.min(groups[0].rank,groups[1].rank), groups[2].rank];
    else if (groups[0].size === 2) score = [1, groups[0].rank, ...groups.filter(g => g.size === 1).map(g => g.rank).sort((a,b) => b-a)];
    else score = [0, ...desc];
    return {name: names[score[0]], score};
  }
  function compare(a,b) {
    const x = Array.isArray(a) ? a : a.score, y = Array.isArray(b) ? b : b.score;
    for (let i = 0; i < Math.max(x.length,y.length); i++) if ((x[i]||0) !== (y[i]||0)) return (x[i]||0) - (y[i]||0);
    return 0;
  }
  function best(board,shared) {
    if (board.length !== 16 || shared.length !== 3) throw new Error('Expected sixteen board cards and three shared cards');
    let result;
    for (let i=0;i<15;i++) for(let j=i+1;j<16;j++){
      const hand=[board[i],board[j],...shared], evaluation=evaluate(hand);
      if(!result||compare(evaluation,result.evaluation)>0) result={indices:[i,j],hand,evaluation};
    }
    return result;
  }
  global.DP3Poker = Object.freeze({ranks,suits,names,deal,evaluate,compare,best});
})(globalThis);
