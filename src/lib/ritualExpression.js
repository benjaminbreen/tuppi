import { episodeById, actionChainById } from './ritualSemantics.js';

// These describe only mechanisms actually present in the selected source actions.
export const EXPRESSIONS = {
  'tunnawiya/wish-by-tree': {
    title: 'Increase through comparison',
    explanation: 'The tree’s fruit and new shoots give the wish a visible form: as the tree flourishes, so may the life of the person holding it.',
    central: ['Sun-god, as this tree is clothed in fruit, {wish}', 'As fruit fills this tree, Sun-god, {wish}'],
    support: ['Sun-god, see the fruit upon this tree; let this person likewise flourish.', 'As this tree bears fruit, let good increase for this person.'],
  },
  'tunnawiya/wish-for-offspring': {
    title: 'Increase through comparison',
    explanation: 'A cow filling her pen with offspring supplies the comparison: let the hoped-for good increase in the same way.',
    central: ['Sun-god, as this cow fills her pen, {wish}', 'As the herd increases, Sun-god, {wish}'],
    support: ['Sun-god, see how this cow fills her pen; let good likewise increase.', 'As the pen fills with life, let this person flourish.'],
  },
  'paskuwatti/entreat-uliliyassi': {
    title: 'An appeal to be heard',
    explanation: 'Call Uliliyašši by name, ask the deity to approach, and give voice to the wish. The appeal begins by gaining a hearing.',
    central: ['Uliliyašši, turn toward the one who calls; hear this request: {wish}', 'Come, Uliliyašši, and attend to these words: {wish}'],
    support: ['Uliliyašši, turn toward the one who calls.', 'Come, Uliliyašši; hear the calling.'],
  },
  'tunnawiya/pass-through-gate': {
    title: 'A change marked by passage',
    explanation: 'Passing beneath the gate makes a change of condition into a bodily action. The practitioner speaks the comparison as you cross.',
    central: ['As you pass beneath this cleansing gate, {wish}', 'With this passage beneath the gate, {wish}'],
    support: ['As you pass beneath the gate, let its cleansing extend to you.', 'Pass beneath the gate; let a fresh condition follow.'],
  },
  'allii/press-earth': {
    title: 'Cleansing through contact',
    explanation: 'The practitioner presses earth against the body and asks its cleansing to reach the limbs, house and hearth.',
    central: ['As this earth cleanses your limbs, {wish}', 'With the cleansing touch of this earth, {wish}'],
    support: ['As this earth cleanses, let your limbs be cleansed.', 'Let the cleansing of this earth reach your house and hearth.'],
  },
  'allii/press-dough': {
    title: 'Renewal through contact',
    explanation: 'The practitioner presses dough against the body while calling for life and strength in the limbs.',
    central: ['As this dough touches your limbs with the wish for life, {wish}', 'With this touch of dough and this wish for renewed strength, {wish}'],
    support: ['With this touch of dough, let your limbs live.', 'As the dough touches you, let your strength be renewed.'],
  },
  'zarpiya/speak-formula': {
    title: 'A boundary between harm and good',
    explanation: 'The spoken formula sets harm outside and holds good within. That boundary supplies the protective image used for this request.',
    central: ['Let harm remain outside and good within; {wish}', 'With harm shut out and good held fast, {wish}'],
    support: ['Let harm remain outside; hold good within.', 'Keep the harmful beyond the door and the good inside.'],
  },
  'tunnawiya/libate-sun-god': {
    title: 'Cleansing, then confirmation',
    explanation: 'Pour wine for the Sun-god and ask that the cleansing endure.',
    central: ['Sun-god, receive this wine and preserve the cleansing; {wish}', 'Sun-god, with this libation keep the release secure; {wish}'],
    support: ['Sun-god, receive this wine; let the cleansing endure.', 'Sun-god, keep this person released; receive the libation.'],
  },
};

export function ritualInterpretation(recipe, steps) {
  if (!['analogy', 'custom'].includes(recipe.mode)) return null;
  if (recipe.items.some(item => item.episodeId === 'offer-carry-return')) return {
    title: 'Out into the country, then home',
    explanation: 'Load soldier-bread with loaves, fruit, grain, wool, wine and clothing. A virgin girl carries the offerings into open country, with you following after a bath; on returning, the bread takes its place on a new table.',
    sourceId: 'paskuwatti/carry-offerings',
  };
  const central = steps.find(step => step.carriesWish && EXPRESSIONS[step.sourceId]);
  if (central) return { ...EXPRESSIONS[central.sourceId], sourceId: central.sourceId };
  const block = recipe.items.map(item => ({ item, block: episodeById.get(item.episodeId) ?? actionChainById.get(item.grammarId) }))
    .find(({block}) => block && !['cleansing', 'closure'].includes(block.role));
  if (block) return { title: block.block.title, explanation: `${block.block.historicalLogic}`, sourceId: block.item.id };
  return { title: 'A modern sequence of source actions', explanation: 'Preparation, action and spoken words bring the wish into a physical sequence.', sourceId: recipe.items[0]?.id };
}
