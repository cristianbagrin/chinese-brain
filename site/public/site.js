// Shared by the website's pages. No inline scripts: the site's CSP allows only files from here.

// Key names as this computer calls them: Alt is Option on a Mac.
if (/Mac|iPhone|iPad/.test(navigator.platform)) for (const el of document.querySelectorAll('kbd.alt')) el.textContent = '⌥ Option';

// The video loads from YouTube only when pressed (privacy-enhanced mode, no cookies before that).
for (const b of document.querySelectorAll('button.video[data-video]')) {
  b.addEventListener('click', () => {
    const f = document.createElement('iframe');
    f.src = `https://www.youtube-nocookie.com/embed/${b.dataset.video}?autoplay=1&rel=0`;
    f.title = b.getAttribute('aria-label') || 'Video';
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.allowFullscreen = true;
    const box = document.createElement('div');
    box.className = 'video on';
    box.append(f);
    b.replaceWith(box);
  }, { once: true });
}

// Just installed: the extension opens this page with #welcome.
const title = document.getElementById('title');
if (title && location.hash === '#welcome') title.textContent = "You're set. Try it right here.";

// The install hint disappears once the extension is on this page.
const noext = document.getElementById('noext');
const seen = () => { if (noext && document.documentElement.dataset.cbExt) noext.hidden = true; };
seen();
window.addEventListener('message', (e) => { if (e.source === window && e.data?.cb === 'ready') seen(); });
