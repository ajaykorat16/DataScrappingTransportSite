const { startBrowser } = require('./browser/index');
const cheerio = require('cheerio');
const dayjs = require('dayjs')
const fs = require('fs');
const csv = require("csv-stringify");



async function scrapData(url) {
  const finishedRides = []
  const browser = await startBrowser();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.Login__container--wspMA')

  await page.click('#email');
  await page.type('#email', process.env.LOGIN_EMAIL);
  await page.click('#password');
  await page.type('#password', process.env.LOGIN_PASSWORD);
  await page.keyboard.press('Enter');
  await page.waitForNavigation({ waitUntil: 'networkidle0' });


  await page.waitForSelector('.Layout__main--1qVkz');
  await page.click('a[href="/finished/"]');

  await page.waitForSelector('table');
  const data = await getData(page);

  for (let item of data) {
    const { bookingNumber, date, driver, link, } = item
    await page.goto(`${process.env.DOMAIN}${link}`)
    await page.waitForSelector('article');
    const pageContent = await page.content();

    const { price } = await extractPageData(pageContent)
    const rideData = {
      bookingNumber,
      date,
      driver,
      price
    };

    finishedRides.push(rideData);
  }

  csv.stringify(finishedRides, { header: true, columns: { bookingNumber: "BookingNumber", date: "Date", driver: "Driver", price: "Price" } }, (err, output) => {
    fs.writeFileSync("demoA.csv", output);
  });

  const driverData = getDriverData(finishedRides)

  csv.stringify(driverData, { header: true, columns: { driver: "Name", price: "Price" } }, (err, output) => {
    fs.writeFileSync("demoA.csv", output);
  });

  await browser.close();
}


// ****************************************************************************************************************************
// here we fetch the price from data
async function extractPageData(pageContent) {
  const $ = cheerio.load(pageContent);

  const highlightsSection = $('.DetailPage__highlights--1uyrQ section:first-of-type');

  const priceElement = highlightsSection.find('dl[aria-label="Price"] strong');

  const price = priceElement.text().trim();

  return { price };
}


// *******************************************************************************************************************************




// ******************************************************************************************************************************
//make the date in formate
function parseDate(dateText) {
  const parsedDate = dayjs(dateText, 'D MMM, HH:mm').set('year', dayjs().year());
  return parsedDate.format('YYYY-MM-DD');
}

// *******************************************************************************************************************************




// ********************************************************************************************************************************
//get the data from table
async function getData(page) {
  const data = [];
  let nextPageButton;
  let prevPageLastDate;
  const oneWeekAgo = dayjs().subtract(1, 'week').format('YYYY-MM-DD');
  let lastWeekDate = dayjs().subtract(1, 'week').subtract(1, 'day').format('YYYY-MM-DD');

  do {
    const html = await page.content();
    const $ = cheerio.load(html);
    const currentDate = dayjs().format('YYYY-MM-DD');

    let foundNewData = false;

    $('tr').each((i, element) => {
      const dateDiv = $(element).find('td div div.Date__isHighlighted--32bB2');
      const date = parseDate(dateDiv.text().trim());

      if (date && date >= oneWeekAgo && date <= currentDate) {
        const tdElements = $(element).find('td');

        const bookingNumber = $(tdElements[0]).text().trim();
        const rideDate = $(tdElements[1]).text().trim();

        const driverData = $(tdElements[5]);
        const driver = $(driverData).find('span').text().trim();
        const car = $(driverData).find('div').eq(1).text().trim();

        const status = $(tdElements[6]).find('div');
        const link = $(status).find('a').attr('href');

        const scrapedItem = {
          bookingNumber,
          date: rideDate,
          driver: `${driver}(${car})`,
          link,
        };

        data.push(scrapedItem);
        prevPageLastDate = parseDate(data[data.length - 1]?.date)
        foundNewData = true;
      }
    });


    if (foundNewData === false) {
      break
    }

    nextPageButton = await page.$('.Pagination__page--18yDb img[direction="right"]');

    if (nextPageButton) {
      await nextPageButton.click();
      await page.waitForSelector('table');
    }

  } while (nextPageButton && prevPageLastDate >= lastWeekDate);

  // console.log(data[data.length - 1]?.bookingNumber);
  return data;
}



// **************************************************************************************************************************
//remove duplicate driver entry
const getDriverData = (driverData) => {
  const driverDetails = {};

  driverData.forEach((data) => {
    const { driver, price } = data;

    if (driverDetails[driver]) {
      driverDetails[driver].totalPrice += parseFloat(price.slice(1))
    } else {
      driverDetails[driver] = {
        driver: driver,
        totalPrice: parseFloat(price.slice(1))
      };
    }
  });

  const result = [];
  for (const data in driverDetails) {
    const { driver, totalPrice } = driverDetails[data]

    const driverData = {
      driver,
      price: `£${parseFloat(totalPrice).toFixed(2)}`
    }
    result.push(driverData);
  }

  return result;
};





scrapData(`${process.env.DOMAIN}/planned/`);


