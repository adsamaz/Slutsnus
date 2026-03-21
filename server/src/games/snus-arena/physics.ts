import type { ArenaObstacle } from '@slutsnus/shared';

const WORLD_W = 800;
const WORLD_H = 600;

/** Resolves a circle position against all AABB obstacles, pushing it out of overlaps.
 *  Runs multiple passes to handle corners, then hard-clamps to world bounds. */
export function resolveCircleVsObstacles(
    x: number, y: number, radius: number,
    obstacles: ArenaObstacle[],
): { x: number; y: number } {
    let rx = x, ry = y;
    for (let pass = 0; pass < 3; pass++) {
        for (const obs of obstacles) {
            const cx = Math.max(obs.x, Math.min(rx, obs.x + obs.w));
            const cy = Math.max(obs.y, Math.min(ry, obs.y + obs.h));
            const dx = rx - cx;
            const dy = ry - cy;
            const distSq = dx * dx + dy * dy;
            if (distSq < radius * radius && distSq > 0) {
                const dist = Math.sqrt(distSq);
                const overlap = radius - dist;
                rx += (dx / dist) * overlap;
                ry += (dy / dist) * overlap;
            } else if (distSq === 0) {
                // Center exactly on AABB boundary — push out through nearest face
                const pushLeft = rx - obs.x;
                const pushRight = obs.x + obs.w - rx;
                const pushTop = ry - obs.y;
                const pushBottom = obs.y + obs.h - ry;
                const minX = Math.min(pushLeft, pushRight);
                const minY = Math.min(pushTop, pushBottom);
                if (minX < minY) {
                    rx = pushLeft < pushRight ? obs.x - radius : obs.x + obs.w + radius;
                } else {
                    ry = pushTop < pushBottom ? obs.y - radius : obs.y + obs.h + radius;
                }
            }
        }
    }
    // Hard clamp to world bounds as final safety net (prevents clipping outside the map)
    rx = Math.max(radius, Math.min(WORLD_W - radius, rx));
    ry = Math.max(radius, Math.min(WORLD_H - radius, ry));
    return { x: rx, y: ry };
}

/** Returns true if two circles overlap. */
export function circlesOverlap(ax: number, ay: number, ar: number, bx: number, by: number, br: number): boolean {
    const dx = ax - bx, dy = ay - by;
    const sumR = ar + br;
    return dx * dx + dy * dy < sumR * sumR;
}

/** Returns true if a segment from (ax,ay)→(bx,by) intersects an AABB (expanded by radius). */
function segmentVsExpandedAABB(
    ax: number, ay: number, bx: number, by: number,
    obs: ArenaObstacle, radius: number,
): boolean {
    const ex = obs.x - radius;
    const ey = obs.y - radius;
    const ew = obs.w + radius * 2;
    const eh = obs.h + radius * 2;

    // Parametric ray vs expanded AABB (slab test)
    const dx = bx - ax, dy = by - ay;
    let tmin = 0, tmax = 1;

    if (Math.abs(dx) < 1e-9) {
        if (ax < ex || ax > ex + ew) return false;
    } else {
        const tx1 = (ex - ax) / dx;
        const tx2 = (ex + ew - ax) / dx;
        tmin = Math.max(tmin, Math.min(tx1, tx2));
        tmax = Math.min(tmax, Math.max(tx1, tx2));
    }

    if (Math.abs(dy) < 1e-9) {
        if (ay < ey || ay > ey + eh) return false;
    } else {
        const ty1 = (ey - ay) / dy;
        const ty2 = (ey + eh - ay) / dy;
        tmin = Math.max(tmin, Math.min(ty1, ty2));
        tmax = Math.min(tmax, Math.max(ty1, ty2));
    }

    return tmin <= tmax;
}

/** Returns true if a circle of `radius` swept from (px,py) to (nx,ny) hits any obstacle. */
export function sweptCircleHitsObstacle(
    px: number, py: number, nx: number, ny: number,
    radius: number, obstacles: ArenaObstacle[],
): boolean {
    for (const obs of obstacles) {
        if (segmentVsExpandedAABB(px, py, nx, ny, obs, radius)) return true;
    }
    return false;
}
