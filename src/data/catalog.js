export const categoryIcon = {
  history: 'landmark',
  geography: 'globe',
  gk: 'bulb',
  affairs: 'news',
  general: 'book',
}

export const categoryTone = {
  history: 'amber',
  geography: 'teal',
  gk: 'violet',
  affairs: 'blue',
  general: 'navy',
}

export const featureCards = [
  {
    id: 'fc-ncert',
    icon: 'book',
    tone: 'red',
    titleKey: 'cardNcertTitle',
    textKey: 'cardNcertText',
    metaKey: 'cardNcertMeta',
    path: '/ncert',
    category: 'general',
  },
  {
    id: 'fc-pyq',
    icon: 'file',
    tone: 'navy',
    titleKey: 'cardPyqTitle',
    textKey: 'cardPyqText',
    metaKey: 'cardPyqMeta',
    path: '/pyq',
    category: 'general',
  },
  {
    id: 'fc-affairs',
    icon: 'news',
    tone: 'blue',
    titleKey: 'cardAffairsTitle',
    textKey: 'cardAffairsText',
    metaKey: 'cardAffairsMeta',
    path: '/home',
    focus: 'affairs',
    category: 'affairs',
  },
  {
    id: 'fc-exams',
    icon: 'trophy',
    tone: 'amber',
    titleKey: 'cardExamsTitle',
    textKey: 'cardExamsText',
    metaKey: 'cardExamsMeta',
    path: '/kvs-nvs',
    category: 'general',
  },
]

export const helpItems = [
  { id: 'h1', q: 'hq1', a: 'ha1' },
  { id: 'h2', q: 'hq2', a: 'ha2' },
  { id: 'h3', q: 'hq3', a: 'ha3' },
]
