import { defineConfig, type Plugin } from 'vite';

// THE UPDATE CHECK: every build gets an id; `version.json` next to the bundle
// carries it, and the app compares the two on launch (and on returning to
// the home-screen app). A newer server build reloads itself with a
// cache-busting URL — iOS standalone apps hold on to stale HTML otherwise.
const BUILD_ID = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

function versionFile(): Plugin {
  return {
    name: 'version-file',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID }) });
    },
  };
}

export default defineConfig({
  // relative asset paths so the build works at any URL (GitHub Pages subpath included)
  base: './',
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [versionFile()],
});
