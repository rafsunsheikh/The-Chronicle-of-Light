import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The app is served from different paths depending on the host:
//   • Vercel / local dev → the domain root ("/")
//   • GitHub Pages       → the repo sub-path ("/The-Chronicle-of-Light/")
// Vercel sets VERCEL=1 at build time, so key the base off that. This keeps the
// asset URLs (and the OAuth redirect, which uses import.meta.env.BASE_URL)
// correct on both deploys.
export default defineConfig({
  plugins: [react()],
  base: process.env.VERCEL ? '/' : '/The-Chronicle-of-Light/',
});
