// Widget entry point.
// Compiled to a single ~15-20kb IIFE by esbuild (see build.mjs).
// No framework dependencies — must not conflict with host site JS or CSS.
// The widget renders inside a sandboxed iframe served from the platform domain.

(function () {
  const script = document.currentScript as HTMLScriptElement | null;
  const widgetKey = script?.getAttribute('data-key');

  if (!widgetKey) {
    console.error('[CRM Widget] Missing data-key attribute on <script> tag');
    return;
  }

  if (!/^wk_[a-zA-Z0-9]+$/.test(widgetKey)) {
    console.error('[CRM Widget] Invalid data-key format');
    return;
  }

  // Derive platform base URL from the script src origin
  const scriptSrc = script?.src ?? '';
  let platformOrigin = '';
  try {
    platformOrigin = new URL(scriptSrc).origin;
  } catch {
    console.error('[CRM Widget] Could not determine platform origin from script src');
    return;
  }

  // TODO Phase 1: render iframe pointing to platform widget page
  // The iframe URL encodes the widget key so the platform can serve the right config.
  // It is served from the platform domain (not the host site), preventing CSS bleed.
  console.info('[CRM Widget] Initialized', { widgetKey, platformOrigin });
})();
