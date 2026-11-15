// Key names as this computer calls them: Alt is Option on a Mac.
if (/Mac|iPhone|iPad/.test(navigator.platform)) for (const el of document.querySelectorAll('kbd.alt')) el.textContent = '⌥ Option';
