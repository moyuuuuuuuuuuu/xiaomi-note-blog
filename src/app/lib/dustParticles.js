export function createDustParticle(random, width, height) {
  return {
    x: random() * width,
    y: random() * height,
    vx: Number(((random() - 0.5) * 0.2).toFixed(3)),
    vy: Number(((random() - 0.5) * 0.2).toFixed(3)),
    size: random() * 2,
    alpha: random() * 0.6,
  };
}

export function advanceDustParticle(particle, bounds, pointer) {
  let vx = particle.vx;
  let vy = particle.vy;

  if (pointer) {
    const dx = particle.x - pointer.x;
    const dy = particle.y - pointer.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0 && distance < pointer.radius) {
      const force = Math.min(0.35, (1 - distance / pointer.radius) * 0.35);
      vx += (dx / distance) * force;
      vy += (dy / distance) * force;
    }
  }

  vx *= 0.985;
  vy *= 0.985;
  let x = particle.x + vx;
  let y = particle.y + vy;
  if (x > bounds.width) x = 0;
  if (x < 0) x = bounds.width;
  if (y > bounds.height) y = 0;
  if (y < 0) y = bounds.height;
  return { ...particle, x, y, vx, vy };
}
