// Points needed to reach each level (index 0 = level 1).
const THRESHOLDS = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000, 5000];

function rankFor(level) {
  if (level >= 12) return 'Legend';
  if (level >= 9) return 'Pioneer';
  if (level >= 7) return 'Cartographer';
  if (level >= 5) return 'Trailblazer';
  if (level >= 3) return 'Pathfinder';
  return 'Wanderer';
}

export function levelFromPoints(points = 0) {
  let level = 1;
  for (let i = 1; i < THRESHOLDS.length; i++) if (points >= THRESHOLDS[i]) level = i + 1;
  const curBase = THRESHOLDS[level - 1] ?? THRESHOLDS[THRESHOLDS.length - 1];
  const nextBase = THRESHOLDS[level] ?? (curBase + 1200);
  return {
    level,
    rank: rankFor(level),
    into: Math.max(0, points - curBase),
    span: Math.max(1, nextBase - curBase),
    toNext: Math.max(0, nextBase - points),
  };
}

// quest id -> reward (bonus points + the patch it unlocks)
export const QUEST_REWARDS = {
  streets: { points: 50, patch: 'trailblazer' },
  dist:    { points: 50, patch: 'roadrunner' },
  freq:    { points: 40, patch: 'streak' },
  sunrise: { points: 30, patch: 'sunrise' },
  weekend: { points: 30, patch: 'weekend' },
};

export const PATCHES = {
  trailblazer: { label: 'Trailblazer', color: '#e8654f' },
  roadrunner:  { label: 'Road Runner', color: '#e8a33d' },
  streak:      { label: 'On a Streak', color: '#f0a63c' },
  sunrise:     { label: 'Sunrise Club', color: '#f4c877' },
  weekend:     { label: 'Weekend Warrior', color: '#33a08f' },
};
export const PATCH_ORDER = ['trailblazer', 'roadrunner', 'streak', 'sunrise', 'weekend'];
