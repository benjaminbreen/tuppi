import { decodeAnyRitualRecipe } from "../src/lib/ritualShare.js";
import { compileRitualSteps } from "../src/lib/ritualExecution.js";
import units from "../src/data/rituals/units.json" with { type: "json" };
import visuals from "../src/data/rituals/visual-assets.json" with { type: "json" };
import deities from "../src/data/rituals/deity-visuals.json" with { type: "json" };
import sourceActionImages from "../src/data/rituals/source-action-images.json" with { type: "json" };

// The preview shows the ritual's first pictured act; placeholders fall back to the site image.
function previewImage(steps) {
  for (const step of steps) {
    if (step.kind !== "source") continue;
    const unit = units[step.unitId];
    const src = sourceActionImages[step.sourceId] ?? (unit?.deityVisualId ? deities[unit.deityVisualId]?.src : visuals[unit?.visualAssetId]?.src);
    if (src && !src.includes("_pending")) return src;
  }
  return "/ritual-share.png";
}

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

export default {
  async fetch(request) {
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
    const url = new URL(request.url);
    const token = url.searchParams.get("recipe") || url.pathname.split("/").filter(Boolean).at(-1) || "";
    let recipe;
    try { recipe = decodeAnyRitualRecipe(token); }
    catch { return new Response("This ritual link is invalid or no longer supported.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } }); }
    const title = `${recipe.goalFrame?.title ?? `A ritual for ${recipe.goal}`} · tuppi`;
    const steps = compileRitualSteps(recipe);
    const image = previewImage(steps);
    const names = steps.filter((step) => recipe.engine !== "grammar" || step.kind === "source").map((step) => step.instruction);
    const description = `${names.join(" → ")}. A source-linked ritual sequence for ${recipe.goal}.`;
    const origin = url.origin;
    const shareUrl = `${origin}/r/${token}`;
    const destination = `/rituals/create?recipe=${token}`;
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta property="og:type" content="website"><meta property="og:site_name" content="tuppi"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(shareUrl)}"><meta property="og:image" content="${escapeHtml(`${origin}${encodeURI(image)}`)}"><meta property="og:image:alt" content="${escapeHtml(names[0] ?? title)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta http-equiv="refresh" content="0;url=${escapeHtml(destination)}"><script>location.replace(${JSON.stringify(destination)})</script></head><body><p><a href="${escapeHtml(destination)}">Open this ritual on tuppi</a></p></body></html>`;
    return new Response(request.method === "HEAD" ? null : html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
  },
};
