export const COLORS = {
  darkGreen: '#1E3A2E',
  green: '#2D4A3E',
  lightGreen: '#3B5E4F',
  fairwayGreen: '#7CDB8E',
  gold: '#FFD700',
  softGold: '#C8B88A',
  azaleaPink: '#D4729C',
  azaleaLight: '#E8A0BF',
  azaleaSoft: 'rgba(212, 114, 156, 0.15)',
  azaleaGlow: 'rgba(232, 160, 191, 0.06)',
  cream: '#F5F0E1',
  cardBg: 'rgba(255, 255, 255, 0.05)',
  cardBgHover: 'rgba(255, 255, 255, 0.08)',
  underPar: '#7CDB8E',
  overPar: '#E8A07A',
  evenPar: '#C8B88A',
  divider: 'rgba(255, 215, 0, 0.08)',
  subtleBorder: 'rgba(255, 255, 255, 0.05)',
};

// Tier 1: Playfair Display — big display moments (title, welcome screen name)
export const DISPLAY_FONTS = {
  regular: 'PlayfairDisplay_400Regular',
  medium: 'PlayfairDisplay_500Medium',
  semiBold: 'PlayfairDisplay_600SemiBold',
  bold: 'PlayfairDisplay_700Bold',
  italic: 'PlayfairDisplay_400Regular_Italic',
};

// Tier 2: Cormorant Garamond — player names, pool member names (elegant, readable)
export const NAME_FONTS = {
  regular: 'CormorantGaramond_400Regular',
  medium: 'CormorantGaramond_500Medium',
  semiBold: 'CormorantGaramond_600SemiBold',
  bold: 'CormorantGaramond_700Bold',
  italic: 'CormorantGaramond_400Regular_Italic',
};

// Tier 3: Source Serif 4 — all numbers (scores, rounds, prices, %, positions)
export const NUM_FONTS = {
  regular: 'SourceSerif4_400Regular',
  medium: 'SourceSerif4_500Medium',
  semiBold: 'SourceSerif4_600SemiBold',
  bold: 'SourceSerif4_700Bold',
};

// Tier 4: DM Sans — UI chrome (tabs, column headers, section labels, buttons)
export const UI_FONTS = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semiBold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
};

// Legacy alias — only used in welcome screen / title
export const FONTS = DISPLAY_FONTS;

export const POOL_MEMBERS = [
  { id: 'semmer', first: 'Will', last: 'Semmer', photo: require('../../assets/images/semmer.jpg') },
  { id: 'loeb', first: 'Chuck', last: 'Loeb', photo: require('../../assets/images/loeb.jpg') },
  { id: 'marquis', first: 'Griffin', last: 'Marquis', photo: require('../../assets/images/marquis.jpg') },
  { id: 'pearlman', first: 'Alex', last: 'Pearlman', photo: require('../../assets/images/pearlman.jpg') },
  { id: 'forde', first: 'Sam', last: 'Forde', photo: require('../../assets/images/forde.jpg') },
];

export const AUCTION = {
  totalBudget: 100,
  maxBidPerPlayer: 70,
  minBid: 1,
  rounds: 5,
  bidWindowHours: 12,
  rosterSize: 5,
  autoProposeAfterHours: 6,
};

// Draft round schedule — all times Eastern (America/New_York)
export const DRAFT_SCHEDULE = [
  { round: 1, open: '2026-04-06T09:00:00-04:00', close: '2026-04-06T21:00:00-04:00' },
  { round: 2, open: '2026-04-06T21:30:00-04:00', close: '2026-04-07T09:00:00-04:00' },
  { round: 3, open: '2026-04-07T09:30:00-04:00', close: '2026-04-07T21:00:00-04:00' },
  { round: 4, open: '2026-04-07T21:30:00-04:00', close: '2026-04-08T09:00:00-04:00' },
  { round: 5, open: '2026-04-08T09:30:00-04:00', close: '2026-04-08T21:00:00-04:00' },
];

export const FREE_AGENCY = {
  open: '2026-04-08T07:30:00-04:00',
  close: '2026-04-08T19:30:00-04:00',
};

// Points awarded by leaderboard position at end of each round
// Ties: average the points across the tied positions
// Missed cut: -15 applied once (Friday), then 0 for Sat/Sun
// After cut (Sat/Sun): no negative points possible — worst is 0
export const SCORING = {
  // [Thu, Fri, Sat, Sun]
  positionPoints: [
    { pos: 1,        pts: [20, 25, 40, 75] },
    { pos: 2,        pts: [15, 20, 32, 55] },
    { pos: 3,        pts: [12, 16, 26, 45] },
    { pos: [4, 5],   pts: [10, 13, 20, 35] },
    { pos: [6, 10],  pts: [7,  9,  14, 22] },
    { pos: [11, 20], pts: [4,  5,  8,  12] },
    { pos: [21, 30], pts: [1,  2,  3,  5]  },
    { pos: [31, 50], pts: [0,  0,  0,  0]  },
  ],
  belowFifty: [-3, -4, 0, 0],  // Thu/Fri only; after cut no negatives
  missedCut: -15,               // applied once on Friday
};

export const IMAGES = {
  clubhouse: require('../../assets/images/clubhouse.jpg'),
  bridge: require('../../assets/images/bridge.jpg'),
  hole12: require('../../assets/images/hole12.jpg'),
  hole10: require('../../assets/images/hole10.jpg'),
};
