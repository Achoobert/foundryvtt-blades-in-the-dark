/** Headless CI needs software WebGL for Foundry / Pixi (avoids getExtension errors). */
export function applyChromeLaunchArgs(launchOptions) {
  launchOptions.args.push(
    '--window-size=1366,768',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--use-angle=swiftshader-webgl',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist'
  );
  return launchOptions;
}
