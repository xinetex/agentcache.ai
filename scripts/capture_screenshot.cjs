const puppeteer = require('puppeteer');

(async () => {
    console.log('📸 Launching browser...');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Set viewport for high-res desktop view
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

    const url = 'http://localhost:3456/studio.html';
    console.log(`🌐 Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle0' });

    // Click Fleet Intelligence Tab
    console.log('🖱️ Switching to Fleet Intelligence tab...');
    try {
        // Wait for the button to exist
        await page.waitForSelector('button[onclick="switchTab(\'fleet\')"]', { timeout: 5000 });
        await page.click('button[onclick="switchTab(\'fleet\')"]');

        // Wait for the tab to activate and content to show
        await page.waitForSelector('#view-fleet:not(.hidden)', { timeout: 5000 });

        // Wait a bit for the "Loading" state to resolve (it will fail to fetch but show the UI)
        await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
        console.error('⚠️ Could not switch tab:', e.message);
    }

    console.log('📸 Taking screenshot...');
    await page.screenshot({ path: 'public/assets/studio-real.png', fullPage: false });

    await browser.close();
    console.log('✅ Screenshot saved to public/assets/studio-real.png');
    process.exit(0);
})();
