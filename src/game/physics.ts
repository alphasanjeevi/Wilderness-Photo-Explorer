export interface CircleCollider {
  kind: 'circle';
  x: number;
  z: number;
  r: number;
  tag: string;
}

export interface BoxCollider {
  kind: 'box';
  cx: number;
  cz: number;
  halfW: number;
  halfL: number;
  cosA: number;
  sinA: number;
  maxBound: number;
  tag: string;
}

export interface JeepCollisionResult {
  x: number;
  z: number;
  vx: number;
  vz: number;
  collided: boolean;
  impactStrength: number;
}

export class ColliderWorld {
  private circles: CircleCollider[] = [];
  private boxes: BoxCollider[] = [];

  public addCircle(x: number, z: number, r: number, tag = 'obstacle'): void {
    this.circles.push({ kind: 'circle', x, z, r, tag });
  }

  public addBox(
    cx: number,
    cz: number,
    halfW: number,
    halfL: number,
    angleRad = 0,
    tag = 'structure'
  ): void {
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);
    const maxBound = Math.hypot(halfW, halfL);
    this.boxes.push({
      kind: 'box',
      cx,
      cz,
      halfW,
      halfL,
      cosA,
      sinA,
      maxBound,
      tag,
    });
  }

  /**
   * Resolves a two-axle jeep capsule (front & rear bumper circles along yaw)
   * against all static world colliders and slides velocity cleanly along walls.
   */
  public resolveJeep(
    x: number,
    z: number,
    yaw: number,
    vx: number,
    vz: number
  ): JeepCollisionResult {
    const axleOffset = 1.1;
    const jeepRadius = 1.05;
    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);

    let px = x;
    let pz = z;
    let outVx = vx;
    let outVz = vz;
    let collided = false;
    let impactStrength = 0;

    for (let iter = 0; iter < 3; iter++) {
      // Check both front and rear circles of the jeep chassis
      for (const dir of [1, -1]) {
        const cx = px + sinY * axleOffset * dir;
        const cz = pz + cosY * axleOffset * dir;

        // 1. Circle colliders (trees, rocks, columns, posts)
        for (let i = 0; i < this.circles.length; i++) {
          const c = this.circles[i];
          const dx = cx - c.x;
          const dz = cz - c.z;
          const minDist = jeepRadius + c.r;
          const distSq = dx * dx + dz * dz;
          if (distSq < minDist * minDist) {
            const dist = Math.sqrt(distSq) || 0.001;
            const nx = dx / dist;
            const nz = dz / dist;
            const pen = minDist - dist;
            px += nx * pen;
            pz += nz * pen;

            const vn = outVx * nx + outVz * nz;
            if (vn < 0) {
              impactStrength = Math.max(impactStrength, -vn);
              outVx -= vn * 1.15 * nx;
              outVz -= vn * 1.15 * nz;
              outVx *= 0.88;
              outVz *= 0.88;
            }
            collided = true;
          }
        }

        // 2. Oriented Box colliders (bridge railings, camp deck, tent, ruins plinth, cliffs)
        for (let i = 0; i < this.boxes.length; i++) {
          const b = this.boxes[i];
          const relX = cx - b.cx;
          const relZ = cz - b.cz;

          // Broadphase skip
          const broad = b.maxBound + jeepRadius + 0.5;
          if (Math.abs(relX) > broad || Math.abs(relZ) > broad) continue;

          // Transform into box local space (rotation by -angle)
          const localX = relX * b.cosA + relZ * b.sinA;
          const localZ = -relX * b.sinA + relZ * b.cosA;

          const clampedX = Math.max(-b.halfW, Math.min(b.halfW, localX));
          const clampedZ = Math.max(-b.halfL, Math.min(b.halfL, localZ));

          let dlx = localX - clampedX;
          let dlz = localZ - clampedZ;
          const distSq = dlx * dlx + dlz * dlz;

          if (distSq < jeepRadius * jeepRadius) {
            let lnx = 0;
            let lnz = 0;
            let pen = 0;

            if (distSq > 1e-6) {
              const dist = Math.sqrt(distSq);
              lnx = dlx / dist;
              lnz = dlz / dist;
              pen = jeepRadius - dist;
            } else {
              // Deep overlap inside box: push out via nearest face
              const penX = b.halfW - Math.abs(localX);
              const penZ = b.halfL - Math.abs(localZ);
              if (penX < penZ) {
                lnx = localX >= 0 ? 1 : -1;
                pen = penX + jeepRadius;
              } else {
                lnz = localZ >= 0 ? 1 : -1;
                pen = penZ + jeepRadius;
              }
            }

            // Transform normal back to world space (rotation by +angle)
            const wnx = lnx * b.cosA - lnz * b.sinA;
            const wnz = lnx * b.sinA + lnz * b.cosA;

            px += wnx * pen;
            pz += wnz * pen;

            const vn = outVx * wnx + outVz * wnz;
            if (vn < 0) {
              impactStrength = Math.max(impactStrength, -vn);
              outVx -= vn * 1.15 * wnx;
              outVz -= vn * 1.15 * wnz;
              outVx *= 0.9;
              outVz *= 0.9;
            }
            collided = true;
          }
        }
      }
    }

    return { x: px, z: pz, vx: outVx, vz: outVz, collided, impactStrength };
  }

  /**
   * Lightweight obstacle separation for grounded wildlife so animals walk around trunks and rocks.
   */
  public resolveAnimal(x: number, z: number, radius = 0.55): { x: number; z: number } {
    let px = x;
    let pz = z;

    for (let i = 0; i < this.circles.length; i++) {
      const c = this.circles[i];
      const dx = px - c.x;
      const dz = pz - c.z;
      const minDist = radius + c.r;
      const dSq = dx * dx + dz * dz;
      if (dSq < minDist * minDist) {
        const d = Math.sqrt(dSq) || 0.001;
        const pen = minDist - d;
        px += (dx / d) * pen;
        pz += (dz / d) * pen;
      }
    }

    for (let i = 0; i < this.boxes.length; i++) {
      const b = this.boxes[i];
      const relX = px - b.cx;
      const relZ = pz - b.cz;
      const broad = b.maxBound + radius;
      if (Math.abs(relX) > broad || Math.abs(relZ) > broad) continue;

      const localX = relX * b.cosA + relZ * b.sinA;
      const localZ = -relX * b.sinA + relZ * b.cosA;
      const clampedX = Math.max(-b.halfW, Math.min(b.halfW, localX));
      const clampedZ = Math.max(-b.halfL, Math.min(b.halfL, localZ));
      const dlx = localX - clampedX;
      const dlz = localZ - clampedZ;
      const dSq = dlx * dlx + dlz * dlz;
      if (dSq < radius * radius && dSq > 1e-6) {
        const d = Math.sqrt(dSq);
        const pen = radius - d;
        const lnx = dlx / d;
        const lnz = dlz / d;
        px += (lnx * b.cosA - lnz * b.sinA) * pen;
        pz += (lnx * b.sinA + lnz * b.cosA) * pen;
      }
    }

    return { x: px, z: pz };
  }
}
