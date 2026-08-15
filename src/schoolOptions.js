const grades=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];

export const SCHOOL_CLASSES=[
  'Nursery',
  'LKG-A','LKG-B',
  'UKG-A','UKG-B',
  ...grades.flatMap(grade=>['A','B'].map(section=>`Class ${grade}-${section}`)),
  'Class IX-C','Class X-C','Class XI-C',
];
