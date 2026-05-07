// Widget loader — compiled to a single IIFE by esbuild.
// Runs on the client's website. Creates an iframe served from the platform
// domain so CSS cannot bleed in either direction.
// No framework, no external deps. Target: ~5kb minified.

function init(): void {
  const script = document.currentScript as HTMLScriptElement | null;
  if (!script) {
    console.error('[CRM Widget] Could not locate script element');
    return;
  }

  const widgetKey = script.getAttribute('data-key');
  if (!widgetKey) {
    console.error('[CRM Widget] Missing data-key attribute on <script> tag');
    return;
  }
  if (!/^wk_[a-f0-9]+$/.test(widgetKey)) {
    console.error('[CRM Widget] Invalid data-key format');
    return;
  }

  let platformOrigin: string;
  try {
    platformOrigin = new URL(script.src).origin;
  } catch {
    console.error('[CRM Widget] Could not determine platform origin from script src');
    return;
  }

  const iframe = document.createElement('iframe');
  iframe.src = `${platformOrigin}/widget-frame.html?key=${encodeURIComponent(widgetKey)}`;
  iframe.setAttribute('title', 'Contact form');
  iframe.setAttribute('scrolling', 'no');
  iframe.style.cssText = 'border:none;width:100%;height:520px;display:block;overflow:hidden;';

  script.insertAdjacentElement('afterend', iframe);

  // Resize iframe to match frame content height via postMessage from frame
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.origin !== platformOrigin) return;
    // event.data is `any` — safe to access after type guard
    if (typeof event.data?.crmHeight === 'number') {
      iframe.style.height = `${(event.data.crmHeight as number) + 4}px`;
    }
  });
}

init();
