import { decodeAnyRitualRecipe } from "../src/lib/ritualShare.js";
import { compileRitualSteps } from "../src/lib/ritualExecution.js";

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
    const names = compileRitualSteps(recipe).filter((step) => recipe.engine !== "grammar" || step.kind === "source").map((step) => step.instruction);
    const description = `${names.join(" → ")}. A source-linked ritual sequence for ${recipe.goal}.`;
    const origin = url.origin;
    const shareUrl = `${origin}/r/${token}`;
    const destination = `/rituals/create?recipe=${token}`;
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta property="og:type" content="website"><meta property="og:site_name" content="tuppi"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(shareUrl)}"><meta property="og:image" content="${escapeHtml(`${origin}/ritual-share.png`)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta http-equiv="refresh" content="0;url=${escapeHtml(destination)}"><script>location.replace(${JSON.stringify(destination)})</script></head><body><p><a href="${escapeHtml(destination)}">Open this ritual on tuppi</a></p></body></html>`;
    return new Response(request.method === "HEAD" ? null : html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
  },
};
