// Chrome build only (esbuild `inject`): every free `browser` in a bundle becomes
// Mozilla's promise-based polyfill over `chrome.*`, so the sources stay `browser.*`.
import polyfill from 'webextension-polyfill/dist/browser-polyfill.min.js';

export { polyfill as browser };
