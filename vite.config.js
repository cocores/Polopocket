import { defineConfig } from 'vite';

// Relative asset paths so the same build works whether it's served from
// a domain root (Vercel) or a subpath (GitHub Pages at /Polopocket/).
export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
}));
