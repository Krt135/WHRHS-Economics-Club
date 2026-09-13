// ─────────────────────────────────────────────
//  points-rubric.js — Engagement Point System rubric + pure helpers
//  No Firebase imports here on purpose: this module is shared by both
//  points.js (member) and admin.js (exec board) and must stay pure/testable.
// ─────────────────────────────────────────────

// Every activity in the Economic Forum Engagement Point System.
// `options` are the selectable point tiers for that activity (base/partial/full/extra credit/etc).
// `weeklyLimit`, when present, caps how many *point-earning* instances of that
// activity count toward a member's total in a single week (Monday–Sunday).
export const RUBRIC = [
  {
    key: 'floor_post',
    label: 'The Floor Discussion Post',
    weeklyLimit: 3,
    requirements: ['Must be productive', 'Must help create meaningful conversation'],
    options: [
      { key: 'floor_post_standard', label: 'Productive Floor Post', points: 1, requirements: [] }
    ]
  },
  {
    key: 'meeting',
    label: 'Attend a Meeting',
    requirements: [],
    options: [
      {
        key: 'meeting_attend', label: 'Attended a Regular Meeting', points: 2,
        requirements: ['Attended a regular Economic Forum meeting', 'Signed in and present for the scheduled duration']
      }
    ]
  },
  {
    key: 'debate',
    label: 'Participate in a Debate',
    requirements: [],
    options: [
      {
        key: 'debate_partial', label: 'Partial Credit', points: 4,
        requirements: ['Speaks only once, relies on anecdotal evidence, OR receives a moderator warning']
      },
      {
        key: 'debate_full', label: 'Full Credit', points: 8,
        requirements: ['Speaks 2+ times', 'Uses verified statistics', 'Maintains professional decorum']
      },
      {
        key: 'debate_extra', label: 'Extra Credit', points: 12,
        requirements: ['Provides 3+ verified sources', "Expertly steel-mans the opponent's points", 'No bad faith']
      },
      {
        key: 'debate_bad_faith', label: 'Bad-Faith Participation', points: 0,
        requirements: ['Bad-faith participation receives 0 points']
      }
    ]
  },
  {
    key: 'weekly_feature',
    label: 'Weekly Feature',
    requirements: [],
    options: [
      {
        key: 'weekly_feature_base', label: 'Base', points: 10,
        requirements: ['Submitted on time', 'Logically structured', 'Factually accurate']
      },
      {
        key: 'weekly_feature_extra', label: 'Extra Credit', points: 15,
        requirements: ['Extremely compelling argumentation', "Flawless execution of the part the member was responsible for"]
      }
    ]
  },
  {
    key: 'weekly_game',
    label: 'Weekly Game',
    requirements: [],
    options: [
      {
        key: 'weekly_game_base', label: 'Base', points: 10,
        requirements: ['Submitted on time', 'Mechanics are clear', 'Accurately reflects an economic concept']
      },
      {
        key: 'weekly_game_extra', label: 'Extra Credit', points: 15,
        requirements: ['Visually appealing', 'Exceptionally engaging design', 'Incorporates economic ideas that drive high member participation']
      }
    ]
  },
  {
    key: 'academy',
    label: 'Academy Contribution',
    weeklyLimit: 2,
    requirements: [],
    options: [
      {
        key: 'academy_standard', label: 'Academy Post', points: 10,
        requirements: [
          'Submitted on time', 'Logically structured', 'Factually accurate',
          'Easily understandable for beginners', 'Must teach relevant economic concepts clearly and accurately'
        ]
      }
    ]
  },
  {
    key: 'perspective',
    label: 'Perspective Essay',
    requirements: [],
    options: [
      {
        key: 'perspective_base', label: 'Base', points: 12,
        requirements: [
          '1,000+ words (or 1,200+ words with no citations required if philosophical)',
          'Focused on an economic/political/philosophic topic',
          'At least 5 formatted citations for economic/political essays'
        ]
      },
      {
        key: 'perspective_extra', label: 'Extra Credit', points: 18,
        requirements: [
          '1,500+ words (or 1,700+ words with no citations required if philosophical)',
          '10+ peer-reviewed citations (not required for philosophical essays)',
          'Original data analysis'
        ]
      }
    ]
  },
  {
    key: 'competition',
    label: 'Official Competition',
    requirements: ['Incomplete submissions or insufficient group participation = 0 points'],
    options: [
      { key: 'competition_participation', label: 'Participation', points: 14, requirements: ['Fully submitted correctly', 'Active group participation'] },
      { key: 'competition_placing', label: 'Placing (2×)', points: 28, requirements: ['Team placed in the competition'] },
      { key: 'competition_winning', label: 'Winning (3×)', points: 42, requirements: ['Team won the competition'] },
      { key: 'competition_organizer_participation', label: 'Organizer/Showcased — Participation', points: 20, requirements: ['Served as primary team captain/organizer, OR submission was officially showcased'] },
      { key: 'competition_organizer_placing', label: 'Organizer/Showcased — Placing (2×)', points: 40, requirements: ['Organizer/showcased bonus, team placed'] },
      { key: 'competition_organizer_winning', label: 'Organizer/Showcased — Winning (3×)', points: 60, requirements: ['Organizer/showcased bonus, team won'] },
      { key: 'competition_incomplete', label: 'Incomplete / Insufficient Participation', points: 0, requirements: ['Incomplete submissions or insufficient group participation'] }
    ]
  },
  {
    key: 'podcast',
    label: 'Podcast Feature',
    requirements: [],
    options: [
      {
        key: 'podcast_standard', label: 'Podcast Feature', points: 20,
        requirements: ['Meaningful preparation and participation in an episode or segment']
      }
    ]
  }
];

// ── LOOKUPS ──────────────────────────────────────────────────────────────

export function getActivity(activityKey) {
  return RUBRIC.find(a => a.key === activityKey) || null;
}

// Given an OPTION key (what's actually stored on a pointAwards/pointRequests
// record), return { activity, option } or null if not a recognized rubric option.
export function getOption(optionKey) {
  for (const activity of RUBRIC) {
    const option = activity.options.find(o => o.key === optionKey);
    if (option) return { activity, option };
  }
  return null;
}

export function formatOptionLabel(optionKey) {
  const found = getOption(optionKey);
  if (!found) return optionKey || '(unknown activity)';
  return `${found.activity.label} — ${found.option.label}`;
}

export function isValidOptionKey(optionKey) {
  return getOption(optionKey) !== null;
}

// ── TOTALS / LEADERBOARD ─────────────────────────────────────────────────

// Display name for a raw users/{uid} record, with fallbacks for legacy rows
// that are missing displayName and/or email.
export function memberDisplayName(user) {
  if (!user) return 'Member';
  if (user.displayName) return user.displayName;
  if (user.email) return String(user.email).split('@')[0];
  return 'Member';
}

// awardsObj: the raw `pointAwards` object for one member (Firebase snapshot .val()).
export function computeMemberTotal(awardsObj) {
  if (!awardsObj || typeof awardsObj !== 'object') return 0;
  return Object.values(awardsObj).reduce((sum, a) => {
    if (!a || a.revoked) return sum;
    const pts = Number(a.points);
    return sum + (Number.isFinite(pts) ? pts : 0);
  }, 0);
}

// usersObj: the raw `users` node (Firebase snapshot .val()) — { uid: { displayName, role, pointAwards, ... } }.
// Returns [{ uid, name, role, total }], unsorted.
// Must match the exact same "approved" test the rest of the app uses
// (admin.js's Members tab, the Add Points member picker) — status === 'approved',
// not merely "not pending". A looser test here was the cause of a real bug:
// the leaderboard showed a different set of people than the admin panel's
// Members list for the same underlying data.
export function computeAllTotals(usersObj) {
  if (!usersObj || typeof usersObj !== 'object') return [];
  return Object.entries(usersObj)
    .filter(([, u]) => u && typeof u === 'object' && u.status === 'approved')
    .map(([uid, u]) => ({
      uid,
      name: memberDisplayName(u),
      role: u.role || 'member',
      total: computeMemberTotal(u.pointAwards)
    }));
}

// Dense ranking: equal points => equal rank, next distinct total gets the very
// next rank number (no gaps). Ties are ordered alphabetically for a stable,
// deterministic display order.
export function rankLeaderboard(totals) {
  const sorted = [...totals].sort(
    (a, b) => b.total - a.total || String(a.name || '').localeCompare(String(b.name || ''))
  );
  let rank = 0;
  let lastTotal = null;
  return sorted.map((entry, i) => {
    if (lastTotal === null || entry.total !== lastTotal) {
      rank = i === 0 ? 1 : rank + 1;
      lastTotal = entry.total;
    }
    return { ...entry, rank };
  });
}

// ── WEEK / WEEKLY-LIMIT HELPERS ──────────────────────────────────────────
// "Week" = Monday 00:00:00 through Sunday 23:59:59, local time.

export function getWeekStart(dateStr) {
  const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  const day = d.getDay(); // 0=Sun..6=Sat
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function isSameWeek(dateStrA, dateStrB) {
  return getWeekStart(dateStrA).getTime() === getWeekStart(dateStrB).getTime();
}

// Count this member's existing ACTIVE awards whose option belongs to the given
// parent activityKey (e.g. 'floor_post') and whose activityDate falls in the
// same week as `dateStr`. Used to warn admins before exceeding a weekly limit.
export function countActiveInWeek(awardsObj, activityKey, dateStr) {
  if (!awardsObj) return 0;
  return Object.values(awardsObj).filter(a => {
    if (a.revoked) return false;
    const found = getOption(a.activity);
    if (!found || found.activity.key !== activityKey) return false;
    if (!a.activityDate) return false;
    return isSameWeek(a.activityDate, dateStr);
  }).length;
}

export function todayDateStr() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ── INPUT VALIDATION (shared by the member request form and the admin forms,
//    so the two can never drift apart) ────────────────────────────────────

// Guards against a mistyped year (e.g. "0202-09-11") producing a nonsense week.
export const MIN_ACTIVITY_DATE = '2020-01-01';

// Highest value any rubric option can award, with headroom for an admin
// adjusting upward. Blocks a fat-fingered "1000".
export const MAX_POINTS_VALUE = 200;

// Returns an error message, or null when the date is usable.
export function validateActivityDate(dateStr) {
  if (!dateStr) return 'Please select the date of the activity.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'Please enter a valid date.';
  if (Number.isNaN(new Date(dateStr + 'T00:00:00').getTime())) return 'Please enter a valid date.';
  if (dateStr > todayDateStr()) return 'The activity date cannot be in the future.';
  if (dateStr < MIN_ACTIVITY_DATE) return `The activity date cannot be before ${MIN_ACTIVITY_DATE}.`;
  return null;
}

// Parses a raw points input string. Returns { value } or { error }.
// An empty field is an error rather than silently awarding 0 — that distinction
// matters because 0 is itself a legitimate rubric outcome (bad-faith debate,
// incomplete competition), so it must be chosen deliberately.
export function parsePointsValue(rawValue) {
  const raw = String(rawValue == null ? '' : rawValue).trim();
  if (raw === '') return { error: 'Please enter a point value.' };
  const n = Number(raw);
  if (!Number.isFinite(n)) return { error: 'Points must be a number.' };
  if (!Number.isInteger(n)) return { error: 'Points must be a whole number.' };
  if (n < 0) return { error: 'Points cannot be negative.' };
  if (n > MAX_POINTS_VALUE) return { error: `Points cannot exceed ${MAX_POINTS_VALUE}.` };
  return { value: n };
}

// Confirms an activity/option pair is a real rubric combination.
// Returns { activity, option } or { error }.
export function resolveSelection(activityKey, optionKey) {
  if (!activityKey || !getActivity(activityKey)) return { error: 'Please select an activity.' };
  const found = optionKey ? getOption(optionKey) : null;
  if (!found) return { error: 'Please select a credit level.' };
  if (found.activity.key !== activityKey) {
    return { error: 'That credit level does not belong to the selected activity.' };
  }
  return { activity: found.activity, option: found.option };
}
