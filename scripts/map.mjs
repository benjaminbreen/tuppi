// Project the basemap (Natural Earth via world-atlas / sane-topojson, public domain) and the place index
// onto one fixed conic projection, and write public/data/map.json with ready-to-draw SVG paths.
// The browser then needs no mapping library.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { geoConicConformal, geoPath } from "d3-geo";
import * as topo from "topojson-client";

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.join(here, "..");
const nm = (p) => path.join(site, "node_modules", p);
const W = 1000;
const FRAME = { w: 24.6, e: 44.9, s: 33.3, n: 42.7 };

const frame = {
  type: "MultiPoint",
  coordinates: [
    [FRAME.w, FRAME.s], [FRAME.e, FRAME.s], [FRAME.w, FRAME.n], [FRAME.e, FRAME.n],
    [(FRAME.w + FRAME.e) / 2, FRAME.s], [(FRAME.w + FRAME.e) / 2, FRAME.n],
  ],
};
const proj = geoConicConformal().parallels([35, 41]).rotate([-34.75, 0]).center([0, 38]);
proj.fitWidth(W, frame);
const [[, y0], [, y1]] = geoPath(proj).bounds(frame);
const H = Math.round(y1 - y0);
proj.translate([proj.translate()[0], proj.translate()[1] - y0]).clipExtent([[0, 0], [W, H]]);
const pathOf = geoPath(proj).digits(1);

const land10 = JSON.parse(fs.readFileSync(nm("world-atlas/land-10m.json")));
const w50 = JSON.parse(fs.readFileSync(nm("sane-topojson/dist/world_50m.json")));
const land = pathOf(topo.feature(land10, land10.objects.land)) || "";
const lakes = pathOf(topo.feature(w50, w50.objects.lakes)) || "";
const riversFc = topo.feature(w50, w50.objects.rivers);
const rivers = pathOf(riversFc) || "";

// vertices of rivers inside the frame, for snapping river names onto their river
const riverPts = [];
for (const f of riversFc.features) {
  const lines = f.geometry.type === "LineString" ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const ln of lines) for (const c of ln) {
    const p = proj(c);
    if (p && p[0] >= 0 && p[0] <= W && p[1] >= 0 && p[1] <= H) riverPts.push(p);
  }
}

const P = JSON.parse(fs.readFileSync(path.join(site, "build", "places.json")));
const r1 = (v) => Math.round(v * 10) / 10;
const cx = W / 2, cy = H / 2, INSET = 26;
for (const p of P.places) {
  if (p.lat == null) continue;
  let [x, y] = proj.clipExtent(null)([p.lon, p.lat]);
  proj.clipExtent([[0, 0], [W, H]]);
  if (p.conf === "river") {
    let best = null, bd = Infinity;
    for (const q of riverPts) {
      const d = (q[0] - x) ** 2 + (q[1] - y) ** 2;
      if (d < bd) { bd = d; best = q; }
    }
    if (best && bd < 40 ** 2) [x, y] = best;
  }
  if (p.conf === "offmap" || x < 0 || x > W || y < 0 || y > H) {
    // clamp to the frame along the ray from the centre; remember the direction for the arrow
    const dx = x - cx, dy = y - cy;
    const t = Math.min((cx - INSET) / Math.abs(dx || 1e-9), (cy - INSET) / Math.abs(dy || 1e-9));
    p.edge = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
    x = cx + dx * t;
    y = cy + dy * t;
    p.conf = "offmap";
  }
  p.x = r1(x);
  p.y = r1(y);
}

const out = { w: W, h: H, frame: FRAME, land, lakes, rivers, ...P };
fs.writeFileSync(path.join(site, "public", "data", "map.json"), JSON.stringify(out));
console.log(`map.json: ${W}×${H}, land ${(land.length / 1024).toFixed(0)} KB, rivers ${(rivers.length / 1024).toFixed(0)} KB, lakes ${(lakes.length / 1024).toFixed(0)} KB, total ${(JSON.stringify(out).length / 1024).toFixed(0)} KB`);
