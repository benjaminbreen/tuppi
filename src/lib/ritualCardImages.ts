import sourceActionImages from "../data/rituals/source-action-images.json";
import { atomById } from "./ritualPlanner";
import type { PlanItem } from "./ritualPlanner";
import type { GrammarCard } from "./ritualGrammarCards";
import { RITUAL_DEITIES, RITUAL_UNITS, RITUAL_VISUALS } from "./ritualEdition";

const detail = (name: string) => `/rituals/card-details/${name}.png`;

const doughFigures: Record<string, string> = {
  sheep: detail("dough-sheep"), ewe: detail("dough-sheep"),
  ram: detail("dough-ram"), bull: detail("dough-bull"), ox: detail("dough-bull"), cow: detail("dough-bull"),
  goat: detail("dough-goat"), kid: detail("dough-goat"), donkey: detail("dough-donkey"),
  puppy: detail("dough-puppy"), piglet: "/rituals/generated/tunnawiya-royal-hold-dough-piglet.png",
  pig: "/rituals/generated/tunnawiya-royal-hold-dough-piglet.png",
  bird: detail("dough-bird"), partridge: detail("dough-bird"), fish: detail("dough-fish"),
};

export function imageForUnit(unitId: string) {
  const unit = RITUAL_UNITS[unitId];
  if (!unit) return "/rituals/_pending.png";
  return unit.deityVisualId ? RITUAL_DEITIES[unit.deityVisualId].src : RITUAL_VISUALS[unit.visualAssetId]?.src ?? "/rituals/_pending.png";
}

/** Composer cards describe individual atoms, which can be narrower than their source unit. */
export function imageForGrammarCard(card: GrammarCard, items: PlanItem[]) {
  if (card.kind !== "source") return imageForUnit(card.unitId);
  const sourceImage = (sourceActionImages as Record<string, string>)[card.sourceId];
  if (sourceImage) return sourceImage;
  const first = card.atomIds[0];
  const planned = items.find((item) => item.atomId === first);
  const atom = atomById.get(first)?.atom;
  const substitute = planned?.substitute?.to;
  if (substitute?.class === "figure" && substitute.f?.material === "dough") {
    const name = substitute.sub?.toLowerCase() ?? "";
    return doughFigures[name] ?? detail("dough-person");
  }

  // Multiple source actions may share a unit, but their objects need distinct pictures.
  const theme = atom?.theme;
  if (card.atomIds.length === 1 && theme?.class === "garment" && theme.f?.color === "black") {
    if (theme.sub === "shirt") return detail("black-shirt");
    if (theme.sub === "leggings") return detail("black-leggings");
    if (theme.sub === "shoes") return detail("black-shoes");
  }
  if (card.unitId === "tunnawiya-hold-black-sheep" && atom?.verb === "position") return detail("reclining-patient");
  if (card.unitId === "tunnawiya-royal-conjure-round-limbs" && atom?.verb === "gesture") return "/rituals/generated/tunnawiya-royal-fit-limbs.png";

  if (card.atomIds.length === 1 && theme?.class === "animal") {
    const animal = theme.sub;
    if (theme.f?.color === "black") {
      if (animal === "sheep") return "/rituals/tunnawiya/solo-black-sheep.png";
      if (animal === "piglet") return detail("black-piglet");
      if (animal === "puppy") return detail("black-puppy");
    }
    if (["pulisa-bring-bull-ewe", "pulisa-send-animals-ahead", "uhhamuwa-bring-goat-sheep", "dandanku-bring-three-animals"].includes(card.unitId)) {
      if (animal === "bull") return "/rituals/generated/lapana-plague-bull.png";
      if (animal === "ewe" || animal === "sheep") return "/rituals/uhhamuwa/12-sheep.png";
      if (animal === "goat") return "/rituals/uhhamuwa/11-goat.png";
      if (animal === "kid") return detail("live-kid");
      if (animal === "piglet") return "/rituals/generated/tunnawiya-royal-swing-live-piglet.png";
      if (animal === "puppy") return detail("live-puppy");
    }
  }
  return imageForUnit(card.unitId);
}
