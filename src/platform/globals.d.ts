/** True in the Chrome (MV3) build, false in the Firefox build; set by scripts/build.mjs. */
declare const __CHROME__: boolean;

declare module 'webextension-polyfill/dist/browser-polyfill.min.js' {
  const browserApi: typeof browser;
  export default browserApi;
}
/** The website and account service; scripts/build.mjs sets it (CB_SITE for a local copy). */
declare const __SITE__: string;
