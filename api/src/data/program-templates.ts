export interface TemplateExercise {
  exerciseId: string;
  exerciseName: string;
  muscleGroups: string[];
  category: string;
  sets: number;
  reps: number;
}

export interface TemplateDay {
  name: string;
  isRest?: boolean;
  exercises: TemplateExercise[];
}

export interface ProgramTemplate {
  key: string;
  name: string;
  description: string;
  split: string;
  daysPerWeek: number;
  days: TemplateDay[];
}

const e = (
  exerciseId: string,
  exerciseName: string,
  muscleGroups: string[],
  category: string,
  sets: number,
  reps: number,
): TemplateExercise => ({ exerciseId, exerciseName, muscleGroups, category, sets, reps });

export const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  // ── PPL ────────────────────────────────────────────────────────────────────
  {
    key: 'ppl',
    name: 'PPL',
    description: 'Push / Pull / Legs. Classic 3-day split targeting every muscle group. Run it 3–6×/week.',
    split: 'Push · Pull · Legs',
    daysPerWeek: 3,
    days: [
      {
        name: 'Push',
        exercises: [
          e('bench-press',        'Bench Press',                          ['Chest','Triceps','Shoulders'], 'compound',  4, 6 ),
          e('incline-dumbbell-press', 'Incline Dumbbell Press',           ['Upper Chest','Triceps','Shoulders'], 'compound', 3, 10),
          e('overhead-press',     'Overhead Press',                       ['Shoulders','Triceps'],         'compound',  3, 8 ),
          e('dumbbell-lateral-raise', 'Dumbbell Lateral Raise',           ['Side Delts'],                  'isolation', 4, 15),
          e('tricep-pushdown-bar', 'Tricep Pushdown With Bar',            ['Triceps'],                     'isolation', 3, 12),
          e('overhead-cable-triceps-ext-upper', 'Overhead Cable Triceps Extension (Upper Position)', ['Triceps'], 'isolation', 3, 12),
        ],
      },
      {
        name: 'Pull',
        exercises: [
          e('deadlift',               'Deadlift',                         ['Lower Back','Glutes','Hamstrings','Traps'], 'compound', 3, 5 ),
          e('pull-up',                'Pull-Up',                          ['Lats','Biceps'],               'bodyweight', 3, 8 ),
          e('barbell-row',            'Barbell Row',                      ['Lats','Rhomboids','Biceps'],   'compound',  4, 8 ),
          e('lat-pulldown-pronated',  'Lat Pulldown With Pronated Grip',  ['Lats','Biceps'],               'compound',  3, 12),
          e('barbell-curl',           'Barbell Curl',                     ['Biceps','Forearms'],           'isolation', 3, 10),
          e('hammer-curl',            'Hammer Curl',                      ['Biceps','Forearms'],           'isolation', 3, 12),
        ],
      },
      {
        name: 'Legs',
        exercises: [
          e('squat',              'Squat',                    ['Quads','Glutes','Hamstrings'], 'compound',  4, 6 ),
          e('romanian-deadlift',  'Romanian Deadlift',        ['Hamstrings','Glutes','Lower Back'], 'compound', 3, 10),
          e('leg-press',          'Leg Press',                ['Quads','Glutes','Hamstrings'], 'compound',  3, 12),
          e('leg-extension',      'Leg Extension',            ['Quads'],                       'isolation', 3, 15),
          e('seated-leg-curl',    'Seated Leg Curl',          ['Hamstrings'],                  'isolation', 3, 12),
          e('seated-calf-raise',  'Seated Calf Raise',        ['Calves'],                      'isolation', 4, 15),
        ],
      },
    ],
  },

  // ── PPLXA ──────────────────────────────────────────────────────────────────
  {
    key: 'pplxa',
    name: 'PPLXA',
    description: 'Push / Pull / Legs / Arms / Shoulders. 5-day split adding dedicated arm and shoulder days for lagging muscles.',
    split: 'Push · Pull · Legs · Arms · Shoulders',
    daysPerWeek: 5,
    days: [
      {
        name: 'Push',
        exercises: [
          e('bench-press',         'Bench Press',               ['Chest','Triceps','Shoulders'], 'compound',  4, 6 ),
          e('incline-bench-press', 'Incline Bench Press',       ['Upper Chest','Triceps','Shoulders'], 'compound', 3, 10),
          e('dumbbell-chest-fly',  'Dumbbell Chest Fly',        ['Chest'],                       'isolation', 3, 15),
          e('tricep-pushdown-bar', 'Tricep Pushdown With Bar',  ['Triceps'],                     'isolation', 3, 12),
          e('barbell-lying-triceps-extension', 'Barbell Lying Triceps Extension', ['Triceps'],   'isolation', 3, 10),
          e('bar-dip',             'Bar Dip',                   ['Chest','Triceps','Shoulders'], 'bodyweight', 3, 10),
        ],
      },
      {
        name: 'Pull',
        exercises: [
          e('deadlift',                    'Deadlift',                        ['Lower Back','Glutes','Hamstrings','Traps'], 'compound', 3, 5 ),
          e('pull-up',                     'Pull-Up',                         ['Lats','Biceps'],             'bodyweight', 3, 8 ),
          e('barbell-row',                 'Barbell Row',                     ['Lats','Rhomboids','Biceps'], 'compound',  4, 8 ),
          e('cable-close-grip-seated-row', 'Cable Close Grip Seated Row',     ['Lats','Rhomboids','Biceps'], 'compound',  3, 12),
          e('barbell-curl',                'Barbell Curl',                    ['Biceps','Forearms'],         'isolation', 3, 10),
          e('dumbbell-curl',               'Dumbbell Curl',                   ['Biceps','Forearms'],         'isolation', 3, 12),
        ],
      },
      {
        name: 'Legs',
        exercises: [
          e('squat',                  'Squat',                    ['Quads','Glutes','Hamstrings'], 'compound',  4, 6 ),
          e('bulgarian-split-squat',  'Bulgarian Split Squat',    ['Quads','Glutes','Hamstrings'], 'compound',  3, 10),
          e('leg-press',              'Leg Press',                ['Quads','Glutes','Hamstrings'], 'compound',  3, 12),
          e('leg-extension',          'Leg Extension',            ['Quads'],                       'isolation', 3, 15),
          e('lying-leg-curl',         'Lying Leg Curl',           ['Hamstrings'],                  'isolation', 3, 12),
          e('seated-calf-raise',      'Seated Calf Raise',        ['Calves'],                      'isolation', 4, 15),
        ],
      },
      {
        name: 'Arms',
        exercises: [
          e('ez-curl',                            'EZ Curl',                                       ['Biceps','Forearms'], 'isolation', 4, 12),
          e('incline-dumbbell-curl',              'Incline Dumbbell Curl',                         ['Biceps'],            'isolation', 3, 12),
          e('hammer-curl',                        'Hammer Curl',                                   ['Biceps','Forearms'], 'isolation', 3, 15),
          e('tricep-pushdown-rope',               'Tricep Pushdown With Rope',                     ['Triceps'],           'isolation', 4, 12),
          e('overhead-cable-triceps-ext-upper',   'Overhead Cable Triceps Extension (Upper Position)', ['Triceps'],       'isolation', 3, 12),
          e('dumbbell-lying-triceps-extension',   'Dumbbell Lying Triceps Extension',              ['Triceps'],           'isolation', 3, 12),
        ],
      },
      {
        name: 'Shoulders',
        exercises: [
          e('overhead-press',            'Overhead Press',             ['Shoulders','Triceps'], 'compound',  4, 6 ),
          e('seated-dumbbell-shoulder-press', 'Seated Dumbbell Shoulder Press', ['Shoulders','Triceps'], 'compound', 3, 10),
          e('dumbbell-lateral-raise',    'Dumbbell Lateral Raise',     ['Side Delts'],          'isolation', 4, 15),
          e('cable-lateral-raise',       'Cable Lateral Raise',        ['Side Delts'],          'isolation', 3, 15),
          e('reverse-dumbbell-flyes',    'Reverse Dumbbell Flyes',     ['Rear Delts'],          'isolation', 3, 15),
          e('face-pull',                 'Face Pull',                  ['Rear Delts','Rotator Cuff'], 'isolation', 3, 15),
        ],
      },
    ],
  },

  // ── Upper / Lower ──────────────────────────────────────────────────────────
  {
    key: 'upper-lower',
    name: 'Upper / Lower',
    description: 'Classic 4-day split. Two upper days (strength + hypertrophy) and two lower days for balanced development.',
    split: 'Upper A · Lower A · Upper B · Lower B',
    daysPerWeek: 4,
    days: [
      {
        name: 'Upper A',
        exercises: [
          e('bench-press',           'Bench Press',                        ['Chest','Triceps','Shoulders'], 'compound',  4, 5 ),
          e('barbell-row',           'Barbell Row',                        ['Lats','Rhomboids','Biceps'],  'compound',  4, 5 ),
          e('overhead-press',        'Overhead Press',                     ['Shoulders','Triceps'],        'compound',  3, 8 ),
          e('pull-up',               'Pull-Up',                            ['Lats','Biceps'],              'bodyweight', 3, 8),
          e('dumbbell-curl',         'Dumbbell Curl',                      ['Biceps','Forearms'],          'isolation', 3, 10),
          e('tricep-pushdown-bar',   'Tricep Pushdown With Bar',           ['Triceps'],                    'isolation', 3, 10),
        ],
      },
      {
        name: 'Lower A',
        exercises: [
          e('squat',              'Squat',              ['Quads','Glutes','Hamstrings'], 'compound',  4, 5 ),
          e('romanian-deadlift',  'Romanian Deadlift',  ['Hamstrings','Glutes','Lower Back'], 'compound', 3, 8),
          e('leg-press',          'Leg Press',          ['Quads','Glutes','Hamstrings'], 'compound',  3, 12),
          e('leg-extension',      'Leg Extension',      ['Quads'],                       'isolation', 3, 12),
          e('seated-leg-curl',    'Seated Leg Curl',    ['Hamstrings'],                  'isolation', 3, 12),
          e('seated-calf-raise',  'Seated Calf Raise',  ['Calves'],                      'isolation', 3, 15),
        ],
      },
      {
        name: 'Upper B',
        exercises: [
          e('incline-dumbbell-press',          'Incline Dumbbell Press',          ['Upper Chest','Triceps','Shoulders'], 'compound',  4, 10),
          e('dumbbell-row',                    'Dumbbell Row',                    ['Lats','Rhomboids','Biceps'],        'compound',  4, 10),
          e('seated-dumbbell-shoulder-press',  'Seated Dumbbell Shoulder Press',  ['Shoulders','Triceps'],             'compound',  3, 12),
          e('lat-pulldown-pronated',           'Lat Pulldown With Pronated Grip', ['Lats','Biceps'],                   'compound',  3, 12),
          e('barbell-curl',                    'Barbell Curl',                    ['Biceps','Forearms'],               'isolation', 3, 12),
          e('overhead-cable-triceps-ext-upper','Overhead Cable Triceps Extension (Upper Position)', ['Triceps'],       'isolation', 3, 12),
        ],
      },
      {
        name: 'Lower B',
        exercises: [
          e('deadlift',              'Deadlift',              ['Lower Back','Glutes','Hamstrings','Traps'], 'compound',  3, 5 ),
          e('bulgarian-split-squat', 'Bulgarian Split Squat', ['Quads','Glutes','Hamstrings'],             'compound',  3, 10),
          e('hack-squat-machine',    'Hack Squat Machine',    ['Quads','Glutes'],                          'compound',  3, 12),
          e('lying-leg-curl',        'Lying Leg Curl',        ['Hamstrings'],                              'isolation', 3, 12),
          e('leg-extension',         'Leg Extension',         ['Quads'],                                   'isolation', 3, 15),
          e('seated-calf-raise',     'Seated Calf Raise',     ['Calves'],                                  'isolation', 4, 15),
        ],
      },
    ],
  },

  // ── Full Body ──────────────────────────────────────────────────────────────
  {
    key: 'full-body',
    name: 'Full Body',
    description: 'Hit every major muscle group 3× a week. Great for beginners and athletes who want frequency over volume.',
    split: 'Full Body A · Full Body B · Full Body C',
    daysPerWeek: 3,
    days: [
      {
        name: 'Full Body A',
        exercises: [
          e('squat',               'Squat',                    ['Quads','Glutes','Hamstrings'], 'compound',  3, 5 ),
          e('bench-press',         'Bench Press',              ['Chest','Triceps','Shoulders'], 'compound',  3, 5 ),
          e('barbell-row',         'Barbell Row',              ['Lats','Rhomboids','Biceps'],  'compound',  3, 5 ),
          e('overhead-press',      'Overhead Press',           ['Shoulders','Triceps'],        'compound',  3, 8 ),
          e('barbell-curl',        'Barbell Curl',             ['Biceps','Forearms'],          'isolation', 3, 10),
          e('tricep-pushdown-bar', 'Tricep Pushdown With Bar', ['Triceps'],                    'isolation', 3, 10),
        ],
      },
      {
        name: 'Full Body B',
        exercises: [
          e('deadlift',                        'Deadlift',                                         ['Lower Back','Glutes','Hamstrings','Traps'], 'compound',  3, 5 ),
          e('incline-dumbbell-press',          'Incline Dumbbell Press',                           ['Upper Chest','Triceps','Shoulders'],        'compound',  3, 10),
          e('pull-up',                         'Pull-Up',                                          ['Lats','Biceps'],                           'bodyweight', 3, 8),
          e('dumbbell-shoulder-press',         'Dumbbell Shoulder Press',                          ['Shoulders','Triceps'],                     'compound',  3, 10),
          e('hammer-curl',                     'Hammer Curl',                                      ['Biceps','Forearms'],                       'isolation', 3, 12),
          e('overhead-cable-triceps-ext-upper','Overhead Cable Triceps Extension (Upper Position)', ['Triceps'],                                'isolation', 3, 12),
        ],
      },
      {
        name: 'Full Body C',
        exercises: [
          e('squat',                  'Squat',                            ['Quads','Glutes','Hamstrings'], 'compound',  3, 8 ),
          e('dumbbell-chest-press',   'Dumbbell Chest Press',             ['Chest','Triceps','Shoulders'], 'compound',  3, 10),
          e('lat-pulldown-pronated',  'Lat Pulldown With Pronated Grip',  ['Lats','Biceps'],              'compound',  3, 10),
          e('dumbbell-lateral-raise', 'Dumbbell Lateral Raise',           ['Side Delts'],                 'isolation', 3, 15),
          e('dumbbell-curl',          'Dumbbell Curl',                    ['Biceps','Forearms'],          'isolation', 3, 12),
          e('dumbbell-lying-triceps-extension', 'Dumbbell Lying Triceps Extension', ['Triceps'],          'isolation', 3, 12),
        ],
      },
    ],
  },

  // ── Bro Split ──────────────────────────────────────────────────────────────
  {
    key: 'bro-split',
    name: 'Bro Split',
    description: 'One muscle group per day, trained once a week. High volume per session. 5-day classic bodybuilding staple.',
    split: 'Chest · Back · Shoulders · Arms · Legs',
    daysPerWeek: 5,
    days: [
      {
        name: 'Chest',
        exercises: [
          e('bench-press',           'Bench Press',               ['Chest','Triceps','Shoulders'], 'compound',  4, 8 ),
          e('incline-dumbbell-press','Incline Dumbbell Press',     ['Upper Chest','Triceps','Shoulders'], 'compound', 3, 10),
          e('decline-bench-press',   'Decline Bench Press',       ['Chest','Triceps'],            'compound',  3, 10),
          e('dumbbell-chest-fly',    'Dumbbell Chest Fly',        ['Chest'],                      'isolation', 3, 12),
          e('standing-cable-chest-fly','Standing Cable Chest Fly',['Chest'],                      'isolation', 3, 15),
          e('bar-dip',               'Bar Dip',                   ['Chest','Triceps','Shoulders'],'bodyweight', 3, 10),
        ],
      },
      {
        name: 'Back',
        exercises: [
          e('deadlift',              'Deadlift',                   ['Lower Back','Glutes','Hamstrings','Traps'], 'compound',  3, 5 ),
          e('pull-up',               'Pull-Up',                   ['Lats','Biceps'],               'bodyweight', 3, 8),
          e('barbell-row',           'Barbell Row',               ['Lats','Rhomboids','Biceps'],   'compound',  4, 8 ),
          e('lat-pulldown-pronated', 'Lat Pulldown With Pronated Grip', ['Lats','Biceps'],         'compound',  3, 12),
          e('cable-close-grip-seated-row','Cable Close Grip Seated Row',['Lats','Rhomboids','Biceps'],'compound', 3, 12),
          e('dumbbell-row',          'Dumbbell Row',              ['Lats','Rhomboids','Biceps'],   'compound',  3, 10),
        ],
      },
      {
        name: 'Shoulders',
        exercises: [
          e('overhead-press',             'Overhead Press',             ['Shoulders','Triceps'],       'compound',  4, 6 ),
          e('seated-dumbbell-shoulder-press','Seated Dumbbell Shoulder Press',['Shoulders','Triceps'],'compound',  3, 10),
          e('dumbbell-lateral-raise',     'Dumbbell Lateral Raise',     ['Side Delts'],               'isolation', 4, 15),
          e('cable-lateral-raise',        'Cable Lateral Raise',        ['Side Delts'],               'isolation', 3, 15),
          e('reverse-dumbbell-flyes',     'Reverse Dumbbell Flyes',     ['Rear Delts'],               'isolation', 3, 15),
          e('face-pull',                  'Face Pull',                  ['Rear Delts','Rotator Cuff'],'isolation', 4, 15),
        ],
      },
      {
        name: 'Arms',
        exercises: [
          e('barbell-curl',                          'Barbell Curl',                                  ['Biceps','Forearms'], 'isolation', 4, 10),
          e('incline-dumbbell-curl',                 'Incline Dumbbell Curl',                         ['Biceps'],            'isolation', 3, 12),
          e('hammer-curl',                           'Hammer Curl',                                   ['Biceps','Forearms'], 'isolation', 3, 12),
          e('concentration-curl',                    'Concentration Curl',                            ['Biceps'],            'isolation', 3, 12),
          e('tricep-pushdown-bar',                   'Tricep Pushdown With Bar',                      ['Triceps'],           'isolation', 4, 12),
          e('overhead-cable-triceps-ext-upper',      'Overhead Cable Triceps Extension (Upper Position)',['Triceps'],         'isolation', 3, 12),
          e('barbell-lying-triceps-extension',       'Barbell Lying Triceps Extension',               ['Triceps'],           'isolation', 3, 10),
        ],
      },
      {
        name: 'Legs',
        exercises: [
          e('squat',             'Squat',              ['Quads','Glutes','Hamstrings'], 'compound',  4, 6 ),
          e('romanian-deadlift', 'Romanian Deadlift',  ['Hamstrings','Glutes','Lower Back'], 'compound', 3, 10),
          e('hack-squat-machine','Hack Squat Machine', ['Quads','Glutes'],              'compound',  3, 12),
          e('leg-extension',     'Leg Extension',      ['Quads'],                       'isolation', 3, 15),
          e('lying-leg-curl',    'Lying Leg Curl',      ['Hamstrings'],                  'isolation', 3, 12),
          e('seated-calf-raise', 'Seated Calf Raise',  ['Calves'],                      'isolation', 4, 15),
        ],
      },
    ],
  },

  // ── APEX ───────────────────────────────────────────────────────────────────
  {
    key: 'apex',
    name: 'APEX',
    description: 'The most complete 6-day program ever assembled. Every major muscle group hit with high volume, balanced across Chest, Back, Quads, Hamstrings, Shoulders, Arms, Glutes, Calves, Traps, and Abs. Built for the heatmap.',
    split: 'Chest · Back & Traps · Legs (Quad) · Shoulders · Arms · Legs (Posterior)',
    daysPerWeek: 6,
    days: [
      {
        name: 'Chest',
        exercises: [
          e('bench-press',             'Bench Press',               ['Chest','Triceps','Shoulders'],       'compound',  4, 6 ),
          e('incline-bench-press',     'Incline Bench Press',       ['Upper Chest','Triceps','Shoulders'], 'compound',  3, 8 ),
          e('incline-dumbbell-press',  'Incline Dumbbell Press',    ['Upper Chest','Triceps','Shoulders'], 'compound',  3, 10),
          e('decline-bench-press',     'Decline Bench Press',       ['Chest','Triceps'],                   'compound',  3, 10),
          e('dumbbell-chest-fly',      'Dumbbell Chest Fly',        ['Chest'],                             'isolation', 3, 12),
          e('standing-cable-chest-fly','Standing Cable Chest Fly',  ['Chest'],                             'isolation', 3, 15),
          e('bar-dip',                 'Bar Dip',                   ['Chest','Triceps','Shoulders'],       'bodyweight', 3, 10),
        ],
      },
      {
        name: 'Back & Traps',
        exercises: [
          e('deadlift',                    'Deadlift',                          ['Lower Back','Glutes','Hamstrings','Traps'], 'compound',  4, 4 ),
          e('pull-up',                     'Pull-Up',                           ['Lats','Biceps'],                           'bodyweight', 4, 8 ),
          e('barbell-row',                 'Barbell Row',                       ['Lats','Rhomboids','Biceps'],               'compound',  4, 8 ),
          e('lat-pulldown-pronated',       'Lat Pulldown With Pronated Grip',   ['Lats','Biceps'],                           'compound',  3, 12),
          e('cable-close-grip-seated-row', 'Cable Close Grip Seated Row',       ['Lats','Rhomboids','Biceps'],               'compound',  3, 12),
          e('dumbbell-row',                'Dumbbell Row',                      ['Lats','Rhomboids','Biceps'],               'compound',  3, 10),
          e('straight-arm-lat-pulldown',   'Straight Arm Lat Pulldown',         ['Lats'],                                    'isolation', 3, 12),
          e('barbell-shrug',               'Barbell Shrug',                     ['Traps'],                                   'compound',  4, 12),
        ],
      },
      {
        name: 'Legs (Quad Focus)',
        exercises: [
          e('squat',                 'Squat',                   ['Quads','Glutes','Hamstrings'], 'compound',  5, 5 ),
          e('bulgarian-split-squat', 'Bulgarian Split Squat',   ['Quads','Glutes','Hamstrings'], 'compound',  3, 10),
          e('hack-squat-machine',    'Hack Squat Machine',      ['Quads','Glutes'],              'compound',  3, 12),
          e('leg-press',             'Leg Press',               ['Quads','Glutes','Hamstrings'], 'compound',  3, 12),
          e('leg-extension',         'Leg Extension',           ['Quads'],                       'isolation', 4, 15),
          e('romanian-deadlift',     'Romanian Deadlift',       ['Hamstrings','Glutes','Lower Back'], 'compound', 3, 10),
          e('seated-calf-raise',     'Seated Calf Raise',       ['Calves'],                      'isolation', 5, 15),
        ],
      },
      {
        name: 'Shoulders',
        exercises: [
          e('overhead-press',                 'Overhead Press',                ['Shoulders','Triceps'],       'compound',  4, 6 ),
          e('arnold-press',                   'Arnold Press',                  ['Shoulders','Triceps'],       'compound',  3, 10),
          e('seated-dumbbell-shoulder-press', 'Seated Dumbbell Shoulder Press',['Shoulders','Triceps'],       'compound',  3, 10),
          e('dumbbell-lateral-raise',         'Dumbbell Lateral Raise',        ['Side Delts'],                'isolation', 5, 15),
          e('cable-lateral-raise',            'Cable Lateral Raise',           ['Side Delts'],                'isolation', 3, 15),
          e('face-pull',                      'Face Pull',                     ['Rear Delts','Rotator Cuff'], 'isolation', 4, 15),
          e('reverse-dumbbell-flyes',         'Reverse Dumbbell Flyes',        ['Rear Delts'],                'isolation', 4, 15),
        ],
      },
      {
        name: 'Arms',
        exercises: [
          e('ez-curl',                          'EZ Curl',                                        ['Biceps','Forearms'], 'isolation', 4, 12),
          e('incline-dumbbell-curl',            'Incline Dumbbell Curl',                          ['Biceps'],            'isolation', 3, 12),
          e('hammer-curl',                      'Hammer Curl',                                    ['Biceps','Forearms'], 'isolation', 3, 15),
          e('concentration-curl',               'Concentration Curl',                             ['Biceps'],            'isolation', 3, 12),
          e('tricep-pushdown-bar',              'Tricep Pushdown With Bar',                       ['Triceps'],           'isolation', 4, 12),
          e('tricep-pushdown-rope',             'Tricep Pushdown With Rope',                      ['Triceps'],           'isolation', 3, 12),
          e('overhead-cable-triceps-ext-upper', 'Overhead Cable Triceps Extension (Upper Position)', ['Triceps'],        'isolation', 3, 12),
          e('barbell-lying-triceps-extension',  'Barbell Lying Triceps Extension',                ['Triceps'],           'isolation', 3, 10),
          e('wrist-curl',                       'Wrist Curl',                                     ['Forearms'],          'isolation', 3, 20),
        ],
      },
      {
        name: 'Legs (Posterior Focus)',
        exercises: [
          e('hip-thrust',        'Hip Thrust',          ['Glutes','Hamstrings'],              'compound',  5, 12),
          e('romanian-deadlift', 'Romanian Deadlift',   ['Hamstrings','Glutes','Lower Back'], 'compound',  4, 10),
          e('lying-leg-curl',    'Lying Leg Curl',      ['Hamstrings'],                       'isolation', 4, 12),
          e('seated-leg-curl',   'Seated Leg Curl',     ['Hamstrings'],                       'isolation', 3, 12),
          e('bulgarian-split-squat','Bulgarian Split Squat',['Quads','Glutes','Hamstrings'],  'compound',  3, 10),
          e('seated-calf-raise', 'Seated Calf Raise',   ['Calves'],                           'isolation', 4, 15),
          e('cable-crunch',      'Cable Crunch',        ['Abs'],                              'isolation', 4, 15),
        ],
      },
    ],
  },

  // ── Arnold Split ───────────────────────────────────────────────────────────
  {
    key: 'arnold-split',
    name: 'Arnold Split',
    description: "6-day split popularized by Arnold Schwarzenegger. Chest+Back, Shoulders+Arms, and Legs — each trained twice a week.",
    split: 'Chest & Back · Shoulders & Arms · Legs',
    daysPerWeek: 6,
    days: [
      {
        name: 'Chest & Back',
        exercises: [
          e('bench-press',               'Bench Press',                    ['Chest','Triceps','Shoulders'],   'compound',  4, 8 ),
          e('pull-up',                   'Pull-Up',                        ['Lats','Biceps'],                 'bodyweight', 3, 8),
          e('incline-dumbbell-press',    'Incline Dumbbell Press',         ['Upper Chest','Triceps','Shoulders'],'compound', 3, 10),
          e('barbell-row',               'Barbell Row',                    ['Lats','Rhomboids','Biceps'],     'compound',  4, 8 ),
          e('standing-cable-chest-fly',  'Standing Cable Chest Fly',       ['Chest'],                         'isolation', 3, 15),
          e('straight-arm-lat-pulldown', 'Straight Arm Lat Pulldown',      ['Lats'],                          'isolation', 3, 12),
          e('dumbbell-pullover',         'Dumbbell Pullover',               ['Chest','Lats'],                  'isolation', 3, 12),
        ],
      },
      {
        name: 'Shoulders & Arms',
        exercises: [
          e('arnold-press',                       'Arnold Press',                                ['Shoulders','Triceps'],  'compound',  4, 10),
          e('barbell-curl',                       'Barbell Curl',                                ['Biceps','Forearms'],    'isolation', 4, 10),
          e('tricep-pushdown-bar',                'Tricep Pushdown With Bar',                    ['Triceps'],              'isolation', 4, 12),
          e('dumbbell-lateral-raise',             'Dumbbell Lateral Raise',                      ['Side Delts'],           'isolation', 4, 15),
          e('hammer-curl',                        'Hammer Curl',                                 ['Biceps','Forearms'],    'isolation', 3, 12),
          e('overhead-cable-triceps-ext-upper',   'Overhead Cable Triceps Extension (Upper Position)',['Triceps'],         'isolation', 3, 12),
          e('reverse-dumbbell-flyes',             'Reverse Dumbbell Flyes',                      ['Rear Delts'],           'isolation', 3, 15),
        ],
      },
      {
        name: 'Legs',
        exercises: [
          e('squat',             'Squat',              ['Quads','Glutes','Hamstrings'],        'compound',  4, 6 ),
          e('romanian-deadlift', 'Romanian Deadlift',  ['Hamstrings','Glutes','Lower Back'],   'compound',  3, 10),
          e('leg-press',         'Leg Press',          ['Quads','Glutes','Hamstrings'],        'compound',  3, 12),
          e('leg-extension',     'Leg Extension',      ['Quads'],                              'isolation', 3, 15),
          e('lying-leg-curl',    'Lying Leg Curl',      ['Hamstrings'],                         'isolation', 3, 12),
          e('hip-thrust',        'Hip Thrust',         ['Glutes','Hamstrings'],                'compound',  3, 12),
          e('seated-calf-raise', 'Seated Calf Raise',  ['Calves'],                             'isolation', 4, 15),
        ],
      },
    ],
  },
];
