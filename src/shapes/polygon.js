/** 2D convex polygon helpers used by the tessellation engine. Points are [x, y]. */

export function area(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

export function centroid(poly) {
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p[0];
    y += p[1];
  }
  return [x / poly.length, y / poly.length];
}

/** Ensure counter-clockwise winding. */
export function ccw(poly) {
  return area(poly) < 0 ? poly.slice().reverse() : poly;
}

/** Clip polygon by half-plane a*x + b*y <= c (Sutherland-Hodgman). */
export function clipHalfPlane(poly, a, b, c) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const dp = a * p[0] + b * p[1] - c;
    const dq = a * q[0] + b * q[1] - c;
    if (dp <= 0) out.push(p);
    if (dp * dq < 0) {
      const t = dp / (dp - dq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

export function clipToSquare(poly, h = 0.5) {
  let p = poly;
  p = clipHalfPlane(p, 1, 0, h);
  if (p.length < 3) return p;
  p = clipHalfPlane(p, -1, 0, h);
  if (p.length < 3) return p;
  p = clipHalfPlane(p, 0, 1, h);
  if (p.length < 3) return p;
  return clipHalfPlane(p, 0, -1, h);
}

/** Drop near-duplicate consecutive points. */
export function clean(poly, eps = 1e-6) {
  const out = [];
  for (const p of poly) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last[0] - p[0]) > eps || Math.abs(last[1] - p[1]) > eps) out.push(p);
  }
  if (out.length > 1) {
    const f = out[0];
    const l = out[out.length - 1];
    if (Math.abs(f[0] - l[0]) <= eps && Math.abs(f[1] - l[1]) <= eps) out.pop();
  }
  return out;
}

/**
 * Inset a convex CCW polygon by distance d (moves every edge inward).
 * Returns null when the polygon collapses.
 */
export function inset(poly, d) {
  if (d <= 0) return poly;
  const n = poly.length;
  const lines = [];
  for (let i = 0; i < n; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    let ex = q[0] - p[0];
    let ey = q[1] - p[1];
    const len = Math.hypot(ex, ey);
    if (len < 1e-9) continue;
    ex /= len;
    ey /= len;
    // inward normal for CCW polygon is (-ey, ex)
    const nx = -ey;
    const ny = ex;
    lines.push({ px: p[0] + nx * d, py: p[1] + ny * d, ex, ey });
  }
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l1 = lines[(i - 1 + lines.length) % lines.length];
    const l2 = lines[i];
    const den = l1.ex * l2.ey - l1.ey * l2.ex;
    if (Math.abs(den) < 1e-9) {
      out.push([l2.px, l2.py]);
      continue;
    }
    const t = ((l2.px - l1.px) * l2.ey - (l2.py - l1.py) * l2.ex) / den;
    out.push([l1.px + l1.ex * t, l1.py + l1.ey * t]);
  }
  const a0 = area(poly);
  const a1 = area(out);
  if (a1 <= 0 || a1 > a0) return null;
  // check every vertex stayed inside the original polygon (convexity guarantee)
  for (let i = 0; i < n; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    for (const v of out) {
      if ((q[0] - p[0]) * (v[1] - p[1]) - (q[1] - p[1]) * (v[0] - p[0]) < -1e-9) return null;
    }
  }
  return out;
}

export function regularPolygon(cx, cy, r, sides, rot = 0) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}
