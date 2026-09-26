// Labeled practice content for the UI prototype. Everything here is made up.
// No real people, businesses, sources, prices or outcomes are represented.

export const questionIds = ['skill', 'hours', 'money', 'timing'] as const;
export type QuestionId = (typeof questionIds)[number];

export interface Choice {
  readonly value: string;
  readonly label: string;
}

export interface Question {
  readonly id: QuestionId;
  readonly legend: string;
  readonly hint: string | null;
  readonly choices: readonly Choice[];
}

export interface EvidenceItem {
  readonly source: string;
  readonly excerpt: string;
  readonly publishedOn: string | null;
  readonly collectedOn: string;
  readonly observation: string;
  readonly interpretation: string;
}

export interface PracticeOption {
  readonly id: string;
  readonly name: string;
  readonly skill: string;
  readonly buyer: string;
  readonly deliverable: string;
  readonly fit: string;
  readonly effort: string;
  readonly upfrontCostUsd: number;
  readonly biggestUnknown: string;
  readonly whyThisOption: string;
  readonly nextStep: string;
  readonly evidenceStatus: 'enough' | 'insufficient';
  readonly evidence: readonly EvidenceItem[];
  readonly counterevidence: readonly string[];
  readonly assumptions: readonly string[];
}

export const URGENT_TIMING = 'within-2-weeks';

/** Named practice starting points so each screen can be opened directly for review. */
export interface PracticeExample {
  readonly answers: Readonly<Record<QuestionId, string>>;
  readonly chosenOptionId: string | null;
  /** Raw record-form input, validated by the journey model like a real submission. */
  readonly outcome: { readonly kind: string; readonly amount: string; readonly note: string } | null;
}

const writer = { skill: 'writing', hours: '3-to-6', money: '50', timing: '1-to-2-months' } as const;

export const practiceExamples = {
  answered: { answers: writer, chosenOptionId: null, outcome: null },
  unsure: { answers: { skill: 'unsure', hours: 'unsure', money: 'unsure', timing: 'unsure' }, chosenOptionId: null, outcome: null },
  urgent: { answers: { ...writer, timing: URGENT_TIMING }, chosenOptionId: null, outcome: null },
  chosen: { answers: writer, chosenOptionId: 'newsletter-proofread', outcome: null },
  recorded: { answers: writer, chosenOptionId: 'newsletter-proofread', outcome: { kind: 'paid-commitment', amount: '40', note: '' } },
  thin: { answers: { skill: 'cleaning', hours: '7-to-12', money: '200', timing: 'no-fixed-date' }, chosenOptionId: 'move-out-cleaning', outcome: null },
} as const satisfies Record<string, PracticeExample>;

export const questions: readonly Question[] = [
  {
    id: 'skill',
    legend: 'What could you do for someone this month?',
    hint: 'Pick the one you are most confident doing well.',
    choices: [
      { value: 'writing', label: 'Writing or proofreading' },
      { value: 'bookkeeping', label: 'Bookkeeping or spreadsheets' },
      { value: 'tutoring', label: 'Tutoring a school subject' },
      { value: 'cleaning', label: 'Cleaning or home help' },
    ],
  },
  {
    id: 'hours',
    legend: 'How many hours a week can you spend on this?',
    hint: null,
    choices: [
      { value: 'under-3', label: 'Under 3 hours' },
      { value: '3-to-6', label: '3 to 6 hours' },
      { value: '7-to-12', label: '7 to 12 hours' },
      { value: 'over-12', label: 'More than 12 hours' },
    ],
  },
  {
    id: 'money',
    legend: 'How much money could you spend on this and be fine if you lost it?',
    hint: 'Amounts are in US dollars.',
    choices: [
      { value: '0', label: 'Nothing, $0' },
      { value: '50', label: 'Up to $50' },
      { value: '200', label: 'Up to $200' },
    ],
  },
  {
    id: 'timing',
    legend: 'When do you need income from this?',
    hint: 'Testing an offer may not bring in money in time. Your answer helps us be honest about that.',
    choices: [
      { value: URGENT_TIMING, label: 'Within 2 weeks, for a bill or essentials' },
      { value: '1-to-2-months', label: 'In 1 to 2 months' },
      { value: 'no-fixed-date', label: 'No fixed date' },
    ],
  },
];

export const practiceOptions: readonly PracticeOption[] = [
  {
    id: 'spreadsheet-tidy',
    name: 'Tidy up small-business spreadsheets',
    skill: 'bookkeeping',
    buyer: 'Owners of one-person local businesses who track money in a spreadsheet',
    deliverable: 'One cleaned-up income and expense sheet, plus a one-page note on keeping it tidy',
    fit: 'Uses spreadsheet skills you already have; can be done from home',
    effort: 'About 3 hours per sheet. No upfront cost.',
    upfrontCostUsd: 0,
    biggestUnknown: 'Whether owners will share their numbers with someone they have not worked with',
    whyThisOption: 'Two practice sources describe owners who keep messy sheets and dread tax season. The work is small enough to try once without spending money.',
    nextStep: 'Ask three business owners you already know whether their spreadsheet costs them time. Offer to tidy one sheet for $40.',
    evidenceStatus: 'enough',
    evidence: [
      {
        source: 'Neighborhood business forum post (made-up)',
        excerpt: '“I lose a whole weekend every April just figuring out what I spent.”',
        publishedOn: '2026-08-14',
        collectedOn: '2026-09-20',
        observation: 'One owner says sorting their own records takes a weekend each year.',
        interpretation: 'Some owners may pay to avoid that weekend. This has not been tested.',
      },
      {
        source: 'Community newsletter reply (made-up)',
        excerpt: '“Does anyone know someone who can fix my spreadsheet formulas?”',
        publishedOn: null,
        collectedOn: '2026-09-21',
        observation: 'One person asked for help with spreadsheet formulas.',
        interpretation: 'There may be local demand for small fixes, not full bookkeeping.',
      },
    ],
    counterevidence: ['Free spreadsheet templates are easy to find, so some owners may prefer to fix it themselves.'],
    assumptions: ['You know at least three owners you could ask.', '$40 is a starting price to test, not a proven price.'],
  },
  {
    id: 'newsletter-proofread',
    name: 'Proofread community newsletters',
    skill: 'writing',
    buyer: 'Volunteer editors of club, church or neighborhood newsletters',
    deliverable: 'One proofread issue returned within 2 days, with changes marked',
    fit: 'Uses careful reading and writing; small, repeatable pieces of work',
    effort: 'About 1 to 2 hours per issue. No upfront cost.',
    upfrontCostUsd: 0,
    biggestUnknown: 'Whether volunteer groups have any budget for this',
    whyThisOption: 'A practice source shows an editor asking for a second pair of eyes. Each issue is short, so one try fits in a week.',
    nextStep: 'Offer two newsletter editors a proofread of their next issue for $25 each.',
    evidenceStatus: 'enough',
    evidence: [
      {
        source: 'Club mailing list message (made-up)',
        excerpt: '“We keep sending issues out with typos. Could use a second pair of eyes.”',
        publishedOn: '2026-09-02',
        collectedOn: '2026-09-20',
        observation: 'One volunteer editor says typos keep slipping through.',
        interpretation: 'Editors may value a quick check. Whether they will pay is unknown.',
      },
    ],
    counterevidence: ['Volunteer groups often have little or no money to spend.'],
    assumptions: ['You can reach at least two newsletter editors.'],
  },
  {
    id: 'shop-descriptions',
    name: 'Write product descriptions for small online shops',
    skill: 'writing',
    buyer: 'People selling handmade goods online who write their own listings',
    deliverable: 'Five rewritten product descriptions in the seller\u2019s voice',
    fit: 'Uses writing skills; can be done at any hour',
    effort: 'About 2 hours per set of five. No upfront cost.',
    upfrontCostUsd: 0,
    biggestUnknown: 'Whether better descriptions lead to more sales for them',
    whyThisOption: 'A practice source shows a seller unsure how to describe their work. The task is small and easy to show as a sample.',
    nextStep: 'Rewrite one listing as a free sample for a seller you know, then offer five more for $35.',
    evidenceStatus: 'enough',
    evidence: [
      {
        source: 'Crafts group comment (made-up)',
        excerpt: '“I never know what to write under my photos.”',
        publishedOn: '2026-07-30',
        collectedOn: '2026-09-21',
        observation: 'One seller says writing descriptions is hard for them.',
        interpretation: 'Some sellers may want help. It is not known whether it changes their sales.',
      },
    ],
    counterevidence: ['Many selling sites now offer writing suggestions for free.'],
    assumptions: ['You know at least one person who sells online.'],
  },
  {
    id: 'homework-checkins',
    name: 'Weekly homework check-ins for middle schoolers',
    skill: 'tutoring',
    buyer: 'Parents of 11 to 14 year olds who want a steady weekly check-in',
    deliverable: 'One 45-minute video check-in per week, with a short note to the parent',
    fit: 'Uses a school subject you know well; regular weekly hours',
    effort: 'About 1 hour a week per student. About $30 for a background check some parents ask for.',
    upfrontCostUsd: 30,
    biggestUnknown: 'Which checks or permissions parents in your area expect before working with children',
    whyThisOption: 'A practice source shows a parent looking for steady help, not crisis tutoring. Weekly sessions are predictable to plan around.',
    nextStep: 'Before offering anything, find out what checks parents near you expect for someone working with children.',
    evidenceStatus: 'enough',
    evidence: [
      {
        source: 'School parents group post (made-up)',
        excerpt: '“Looking for someone to check in weekly on math homework, nothing intense.”',
        publishedOn: '2026-09-10',
        collectedOn: '2026-09-21',
        observation: 'One parent asked for a light weekly math check-in.',
        interpretation: 'There may be demand for low-intensity help. Requirements for working with children must be checked first.',
      },
    ],
    counterevidence: ['Schools sometimes offer free homework clubs.'],
    assumptions: ['Rules for working with children are not assumed; they must be checked.'],
  },
  {
    id: 'move-out-cleaning',
    name: 'Move-out cleaning for renters',
    skill: 'cleaning',
    buyer: 'Renters who want their deposit back when moving out',
    deliverable: 'One move-out clean of a small apartment, with a checklist',
    fit: 'Uses cleaning skills; work comes in single, clear jobs',
    effort: 'About 5 hours per apartment. About $60 for supplies.',
    upfrontCostUsd: 60,
    biggestUnknown: 'Whether renters near you would hire someone they found through friends',
    whyThisOption: 'We only found one practice source for this, so the case is thin.',
    nextStep: 'Ask two renters you know how they handled their last move-out clean.',
    evidenceStatus: 'insufficient',
    evidence: [
      {
        source: 'Apartment building notice board photo (made-up)',
        excerpt: '“Cleaner wanted for move-out, end of month.”',
        publishedOn: null,
        collectedOn: '2026-09-22',
        observation: 'One notice asked for a move-out cleaner.',
        interpretation: 'One notice is not enough to tell whether this is common.',
      },
    ],
    counterevidence: ['Large cleaning companies already advertise move-out deals.'],
    assumptions: ['You have or can borrow basic cleaning supplies.'],
  },
];
