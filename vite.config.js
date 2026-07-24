import { defineConfig } from 'vite';

// GitHub Pages serves this project at /Polopocket/, so the production
// build needs that base path baked into asset URLs; local dev keeps root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Polopocket/' : '/',
}));
