import { useEffect, useRef } from 'react';
import { advanceDustParticle, createDustParticle } from '../lib/dustParticles.js';

interface DustParticlesProps {
  className?: string;
}

export function DustParticles({ className = '' }: DustParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mobile = window.matchMedia('(max-width: 767px)');
    let particles: ReturnType<typeof createDustParticle>[] = [];
    let pointer: { x: number; y: number; radius: number } | null = null;
    let frame = 0;
    let width = 0;
    let height = 0;

    const draw = () => {
      context.clearRect(0, 0, width, height);
      context.fillStyle = 'rgb(95 120 165)';
      for (const particle of particles) {
        context.globalAlpha = Math.min(0.22, particle.alpha);
        context.beginPath();
        context.arc(particle.x, particle.y, Math.max(0.65, particle.size), 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = Array.from({ length: mobile.matches ? 18 : 36 }, () => createDustParticle(Math.random, width, height));
      draw();
    };

    const animate = () => {
      if (!document.hidden && !reduceMotion.matches) {
        particles = particles.map((particle) => advanceDustParticle(particle, { width, height }, pointer));
        draw();
      }
      frame = window.requestAnimationFrame(animate);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top, radius: 72 };
    };
    const clearPointer = () => { pointer = null; };
    const handleMotionChange = () => { pointer = null; draw(); };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    mobile.addEventListener('change', resize);
    reduceMotion.addEventListener('change', handleMotionChange);
    if (!reduceMotion.matches) {
      window.addEventListener('pointermove', handlePointerMove, { passive: true });
      window.addEventListener('pointerleave', clearPointer);
    }
    resize();
    frame = window.requestAnimationFrame(animate);

    return () => {
      observer.disconnect();
      mobile.removeEventListener('change', resize);
      reduceMotion.removeEventListener('change', handleMotionChange);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', clearPointer);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
