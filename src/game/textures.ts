import * as THREE from 'three';

export function createGroundDetailTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#e8e5dc';
    ctx.fillRect(0, 0, size, size);

    // Subtle organic soil & leaf speckle for low-poly PBR roughness/albedo richness
    for (let i = 0; i < 1600; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 0.8 + Math.random() * 2.4;
      const shade = 205 + Math.floor(Math.random() * 42);
      ctx.fillStyle = `rgb(${shade}, ${shade - 4}, ${shade - 10})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(28, 28);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.06,
      size / 2,
      size / 2,
      size * 0.48
    );
    grad.addColorStop(0, 'rgba(18, 24, 16, 0.58)');
    grad.addColorStop(0.55, 'rgba(18, 24, 16, 0.24)');
    grad.addColorStop(1, 'rgba(18, 24, 16, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createWoodPlankTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#9c7349';
    ctx.fillRect(0, 0, size, size);
    const plankCount = 8;
    const h = size / plankCount;
    for (let i = 0; i < plankCount; i++) {
      const shade = (i % 3) * 10 - 10;
      ctx.fillStyle = `rgb(${150 + shade}, ${108 + shade}, ${68 + shade})`;
      ctx.fillRect(0, i * h + 2, size, h - 4);
      ctx.fillStyle = 'rgba(45, 28, 12, 0.45)';
      ctx.fillRect(0, i * h, size, 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
