/**
 * The design system, lifted from the approved mockups.
 *
 * The governing idea: the interface borrows the cartoons' own drawing style —
 * a 2px near-black outline and a flat fill on every surface, with hard offset
 * shadows rather than blurred ones. That is what stops Pepe looking pasted on
 * top of a generic app.
 */
export const colour = {
  ground: '#FBF6EC',
  surface: '#FFFFFF',
  ink: '#1C1714',
  muted: '#6B6259',
  chile: '#D1453B',
  cactus: '#2E7D5B',
  marigold: '#E9A020',
} as const;

export const font = {
  display: 'Fraunces_800ExtraBold',
  displayHeavy: 'Fraunces_900Black',
  body: 'Figtree_600SemiBold',
  bodyHeavy: 'Figtree_800ExtraBold',
} as const;

export const radius = { pill: 999, card: 16, button: 14 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;

/** Borders are always this. Fills vary; the outline does not. */
export const outline = { borderWidth: 2, borderColor: colour.ink } as const;
