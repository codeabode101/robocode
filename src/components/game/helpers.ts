import type { Hitbox, CustomerRequest, Vec2 } from './types';

export function isInsideHitbox(point: Vec2, hitbox: Hitbox) {
  if (hitbox.shape === 'circle') {
    const dx = point.x - hitbox.center.x;
    const dy = point.y - hitbox.center.y;
    return Math.hypot(dx, dy) <= hitbox.radius;
  }
  const dx = Math.abs(point.x - hitbox.center.x);
  const dy = Math.abs(point.y - hitbox.center.y);
  return dx <= hitbox.halfWidth && dy <= hitbox.halfHeight;
}

export function collidesWithAny(point: Vec2, hitboxes: Hitbox[]) {
  return hitboxes.some(h => isInsideHitbox(point, h));
}

export function escapeHtml(input: string) {
  return input.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export function highlightJava(input: string) {
  const re = /"(?:[^"\\\n]|\\.)*"|\b(String|int|double|boolean|char|float|long|short|byte)\b|\b([A-Za-z_][A-Za-z0-9_]*)\b(?=\s*=)/g;
  let out = '', last = 0;
  for (const m of input.matchAll(re)) {
    const v = m[0], i = m.index ?? 0;
    out += escapeHtml(input.slice(last, i));
    if (v.startsWith('"')) out += `<span style="color:#f59e0b">${escapeHtml(v)}</span>`;
    else if (m[1]) out += `<span style="color:#60a5fa">${escapeHtml(v)}</span>`;
    else out += `<span style="color:#a78bfa">${escapeHtml(v)}</span>`;
    last = i + v.length;
  }
  return out + escapeHtml(input.slice(last));
}

export function pickRandom<T>(items: T[]) { return items[Math.floor(Math.random() * items.length)]; }

export function getWorkshopRequestSignature(request: CustomerRequest) {
  return `${request.required.slice().sort().join('+')}|${request.petName}|${request.petColor}|${request.petSize}`;
}

export function validateWorkshopCode(input: string, request: CustomerRequest) {
  const n = input.replace(/\s+/g, ' ').trim();
  const en = request.petName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ec = request.petColor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const nameP = new RegExp(`String\\s+[A-Za-z_][A-Za-z0-9_]*\\s*=\\s*"${en}"\\s*;`, 'i');
  const colorP = new RegExp(`String\\s+[A-Za-z_][A-Za-z0-9_]*\\s*=\\s*"${ec}"\\s*;`, 'i');
  const sizeP = new RegExp(`int\\s+[A-Za-z_][A-Za-z0-9_]*\\s*=\\s*${request.petSize}\\s*;`);
  for (const req of request.required) {
    if (req === 'name' && !nameP.test(n)) return { valid: false, error: `Need a String for pet name "${request.petName}".` };
    if (req === 'color' && !colorP.test(n)) return { valid: false, error: `Need a String for pet color "${request.petColor}".` };
    if (req === 'size' && !sizeP.test(n)) return { valid: false, error: `Need an int for pet size ${request.petSize}.` };
  }
  return { valid: true, error: '' };
}

export function hashColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(h) % 360}, 72%, 58%)`;
}
