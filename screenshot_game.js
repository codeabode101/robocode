const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const envContent = fs.readFileSync('.dev.vars', 'utf-8');
  const match = envContent.match(/WORKOS_API_KEY=(.+)/);
  const key = match[1].trim();
  const { SignJWT } = await import('jose');
  const jwt = await new SignJWT({ sub: 'test-user-id' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(key));

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addCookies([{
    name: 'session', value: jwt,
    domain: 'robocode.rahejaom.workers.dev', path: '/',
    httpOnly: true, secure: true,
  }]);

  const page = await ctx.newPage();
  page.on('pageerror', err => console.log('PAGE_ERR:', err.message));

  await page.goto('https://robocode.rahejaom.workers.dev/game', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(5000);

  // Force click the Got it! button  
  await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const b of buttons) {
      if (b.textContent.includes('Got it')) {
        b.click();
        break;
      }
    }
  });
  console.log('Force clicked Got it!');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/g1.png' });
  console.log('S1: after dismiss');

  // Walk north
  await page.keyboard.down('w');
  await page.waitForTimeout(3000);
  await page.keyboard.up('w');
  await page.screenshot({ path: '/tmp/g2.png' });
  console.log('S2: north');

  // More north
  await page.keyboard.down('w');
  await page.waitForTimeout(3000);
  await page.keyboard.up('w');
  await page.screenshot({ path: '/tmp/g3.png' });
  console.log('S3: more north');

  // East
  await page.keyboard.down('d');
  await page.waitForTimeout(4000);
  await page.keyboard.up('d');
  await page.screenshot({ path: '/tmp/g4.png' });
  console.log('S4: east');

  // Far east
  await page.keyboard.down('d');
  await page.waitForTimeout(4000);
  await page.keyboard.up('d');
  await page.screenshot({ path: '/tmp/g5.png' });
  console.log('S5: far east');

  // Northwest
  await page.keyboard.down('a');
  await page.keyboard.down('w');
  await page.waitForTimeout(5000);
  await page.keyboard.up('a');
  await page.keyboard.up('w');
  await page.screenshot({ path: '/tmp/g6.png' });
  console.log('S6: northwest');

  await browser.close();
  console.log('Done');
})().catch(e => console.error(e));
