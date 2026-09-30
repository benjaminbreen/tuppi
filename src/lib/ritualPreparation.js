// Explicit preparations inferred from the participants required in KUB 7.8 §3.
// They remain attached to that source action rather than acquiring invented attestations.
export function expandRitualPreparations(steps) {
  return steps.flatMap(step => {
    if (step.kind !== 'source') return [step];
    if (step.sourceId === 'paskuwatti/arrange-offerings') return [{...step,
      instruction: 'Arrange three thick loaves, figs, raisins, cereals, ewe’s wool, wine and your clothing on soldier-bread',
      note: 'The food list names kallaktar, parḫuena-grain and the god’s groats, a little of each; the loaves use moist, sweet flour.'}];
    if (step.sourceId === 'paskuwatti/set-home-table') return [{...step,
      instruction: 'Bring the soldier-bread home, place it on a new table, and set the wine jug in front'}];
    if (step.sourceId !== 'paskuwatti/carry-offerings') return [step];
    return [
      {...step, id: 'preparation/paskuwatti/guide', instruction: 'Choose a virgin girl to carry the offerings and lead you',
        note: 'Preparation drawn from the guide specified in KUB 7.8 §3.', accompanies: step.sourceId},
      {...step, id: 'preparation/paskuwatti/bathe', unitId: 'tunnawiya-wash-with-water', instruction: 'Bathe before following the guide into the open country',
        note: 'KUB 7.8 §3 describes the offerant as already bathed. This card makes that preparation explicit.', accompanies: step.sourceId},
      {...step, instruction: 'Have the girl lift the soldier-bread and offerings; follow her to a fresh place in the open country'},
    ];
  });
}
