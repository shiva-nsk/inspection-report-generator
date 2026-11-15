// Visual constants measured from the original (manually made) report.
// Units are PDF points (1/72 inch). Page is A4.

export const PAGE = { w: 595.28, h: 841.89 };

export const COLORS = {
  blue: '#1268EB',
  ink: '#090909',
  text: '#2D2E33',
  muted: '#6B6C6F',
  faint: '#9A9C9F',
  card: '#EDF4FC',
  rule: '#E2E6EA',
  cardRule: '#D2DEF5',
  white: '#FFFFFF',
  coverSoft: '#D2E0FC',
  coverSofter: '#E6ECFF',
  coverRule: '#7BAAF8',
  placeholder: '#E9ECF0',
  major: '#C52828',
  minor: '#E68800',
  cosmetic: '#D4A700',
};

export const FONT = { family: 'InstrumentSans' };

// Letter spacing used for the small UPPERCASE labels.
export const TRACK = 1.8;

export const MARGIN = { left: 56.9, right: 539.6 };
export const CONTENT_W = MARGIN.right - MARGIN.left;

export const HEADER = {
  y: 27.9, h: 27.9,
  logoCellRight: 206.8,
  logo: { x: 66.8, y: 34.0, w: 72.7, h: 15.5 },
  textBaseline: 43.7,
  projectCenter: 302.5,
  unitCenter: 468,
  fontSize: 6.96,
};

export const FOOTER = {
  y: 792.8, h: 21.1,
  baseline: 806.2,
  phoneX: 66.9,
  emailCenter: 287.3,
  pageX: 491.4,
};

// Section heading (kicker + big title + subtitle) on the first page of a section.
export const HEADING = {
  kickerBaseline: 83.2,
  kickerLabelX: 83.8,
  titleBaseline: 117.3,
  titleSize: 27,
  subtitleBaseline: 138.4,
};

// Observation pages.
export const OBS = {
  contentTop: 96.8,         // first block top on a continuation page
  bottom: 782,              // nothing may go below this
  blockGap: 26,
  photoX: 57.4,
  photoW: 299.1,
  photoH: 186,              // height of a 1- or 2-photo block
  gridRowH: 118,            // row height when 3+ photos are shown in a 2-column grid
  gridGap: 4,
  maxPhotosPerBlock: 10,    // more photos continue in a second block
  cardX: 356.5,
  cardRight: 539.8,
  textX: 367.6,
  textW: 166,
  ruleX: 366,
  ruleRight: 528.7,
  descSize: 12.96,
  descLine: 17.3,
  locSize: 9,
  locLine: 11.5,
  // first page of a room
  spaceLabelBaseline: 152,
  spaceTop: 158,
  spaceRowH: 186,
  spaceGap: 10,
  afterSpaceGap: 34,
  afterHeadingGap: 26,      // when a room has no space images
};
