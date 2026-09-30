// Offline evidence bindings; no model calls or source-text mutation.
import { writeFileSync } from 'node:fs';
import episodes from '../src/data/rituals/composition-episodes.json' with { type: 'json' };
import index from '../src/data/rituals/composition-index.json' with { type: 'json' };
import quotes from '../src/data/rituals/quotes.json' with { type: 'json' };
const byId = new Map(index.map(x => [`${x.ritualId}/${x.stepId}`, x]));
const records = episodes.flatMap(e => e.stepIds.map(sid => {
  const occurrenceId = `${e.ritualId}/${sid}`, x = byId.get(occurrenceId);
  const q = quotes[occurrenceId]?.find(q => q.english) ?? quotes[occurrenceId]?.[0];
  return { episodeId: e.id, occurrenceId, operations: e.operations ?? [x.function], actor: x.actor, patient: x.patient,
    recipient: x.recipient, materials: x.materials, requires: x.requires, source: x.source,
    excerpt: q?.english ?? q?.original ?? null, excerptKind: q?.english ? 'translation' : 'original-language',
    adaptation: e.adaptation };
}));
writeFileSync(new URL('../src/data/rituals/composition-vocabulary.json', import.meta.url), JSON.stringify(records, null, 2) + '\n');
console.log(`Indexed ${records.length} evidence-bound operation bindings.`);
