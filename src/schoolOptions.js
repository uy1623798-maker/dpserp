const grades=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];

export const SCHOOL_CLASSES=[
  'Nursery',
  'LKG',
  'UKG',
  ...grades.flatMap(grade=>['A','B'].map(section=>`Class ${grade}-${section}`)),
];
