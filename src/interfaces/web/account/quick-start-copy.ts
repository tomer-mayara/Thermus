export const QUICK_START_COPY_SCRIPT = `
const copyButton = document.querySelector('#quick-start-copy');
const copyLabel = copyButton.querySelector('[data-copy-label]');
const copyStatus = document.querySelector('#quick-start-copy-status');
const manualGuide = document.querySelector('#quick-start-manual');
const guideText = document.querySelector('#quick-start-markdown');
let copyTimer;
copyButton.hidden = false;
copyButton.addEventListener('click', async () => {
  clearTimeout(copyTimer);
  copyStatus.textContent = '';
  copyLabel.textContent = 'Copy guide as Markdown';
  try {
    await navigator.clipboard.writeText(guideText.value);
    copyLabel.textContent = 'Copied';
    copyStatus.textContent = 'Guide copied to clipboard.';
    copyTimer = setTimeout(() => { copyLabel.textContent = 'Copy guide as Markdown'; }, 2500);
  } catch {
    copyStatus.textContent = 'Clipboard access is unavailable. Select and copy the guide below.';
    manualGuide.setAttribute('open', '');
    guideText.focus();
    guideText.select();
  }
});
`;
