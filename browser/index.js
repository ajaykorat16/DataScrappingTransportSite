const puppeteer = require('puppeteer')

async function startBrowser() {
  let browser;
  try {
    console.log("Opening the browser....")
    browser = await puppeteer.launch({
      headless:false,
      defaultViewport: null,
      args: ['--start-maximized'] // Add this line to set the browser window to full width.
    });
    const page = await browser.newPage();
    await page.goto('https://google.com/');
  } catch (error) {
    console.log(`Could not create browser instance ${error}`)
  }

  return browser
}

module.exports={startBrowser}