import { motion, useReducedMotion } from 'motion/react';
import type { CSSProperties, PropsWithChildren } from 'react';

interface RevealProps extends PropsWithChildren {
  delay?: number;
  className?: string;
  style?: CSSProperties;
}

export function Reveal({ children, delay = 0, className = '', style }: RevealProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      style={style}
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.42, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
