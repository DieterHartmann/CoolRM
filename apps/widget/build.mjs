import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync } from 'fs';

const watch = process.argv.includes('--watch');

mkdirSync('dist', { recursive: true });
copyFileSync('public/widget-frame.html', 'dist/widget-frame.html');

const ctx = await esbuild.context({
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: !watch,
  outfile: 'dist/widget.js',
  target: ['es2018', 'chrome80', 'firefox78', 'safari13'],
  format: 'iife',
  globalName: '_CRMWidget',
  define: {
    'process.env.NODE_ENV': watch ? '"development"' : '"production"',
  },
});

if (watch) {
  await ctx.watch();
  console.log('Watching widget for changes…');
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log('Widget built → dist/widget.js + dist/widget-frame.html');
}
