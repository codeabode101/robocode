import { test, chromium } from '@playwright/test';

test('check draw calls and renderer info', async () => {
  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu', '--use-gl=angle'] });
  const page = await browser.newPage();

  const email = `perftest_${Date.now()}@test.com`;
  const res = await page.request.post('https://robocode.rahejaom.workers.dev/api/auth/signup', {
    data: { email, password: 'TestPass123!', name: 'PerfTest' }
  });
  console.log(`Signup: ${res.status()}`);

  await page.goto('https://robocode.rahejaom.workers.dev/game', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('canvas', { timeout: 20000 });
  await page.waitForTimeout(5000);

  // Try to get Three.js renderer info
  const info = await page.evaluate(() => {
    // @ts-ignore
    const renderer = window.__renderer || (document.querySelector('canvas')?.__threeRenderer);
    // Try finding THREE renderer info from WebGL context
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { noWebGL: true };
    
    return {
      webglVersion: canvas.getContext('webgl2') ? 'webgl2' : 'webgl',
      vendor: gl.getParameter(gl.VENDOR),
      renderer: gl.getParameter(gl.RENDERER),
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxDrawBuffers: gl.getParameter(gl.MAX_DRAW_BUFFERS),
      shaderTypes: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
    };
  });

  console.log('WebGL Info:', JSON.stringify(info, null, 2));

  // Try reading Three.js renderer info from the DOM
  const rendererInfo = await page.evaluate(() => {
    // Check for THREE.js info elements
    const infoEl = document.getElementById('info') || document.querySelector('.info');
    if (infoEl) return infoEl.textContent;
    return null;
  });
  console.log('Renderer info element:', rendererInfo);

  // Check total texture count on canvas
  const textureInfo = await page.evaluate(() => {
    // List all images that might be textures
    return document.querySelectorAll('img').length;
  });
  console.log(`Images in page: ${textureInfo}`);

  await browser.close();
});
