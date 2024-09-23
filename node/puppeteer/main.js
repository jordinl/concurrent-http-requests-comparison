import fs from 'fs';
import {PromisePool} from '@supercharge/promise-pool'
import puppeteer from "puppeteer";

const CONCURRENCY = parseInt(process.env.CONCURRENCY || 10)
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || 5)
const LIMIT = parseInt(process.env.LIMIT || 1000)
const start = new Date()
const dataDir = process.env.DATA_DIR || './data'

console.log(`Starting crawl:`)
console.log(` * CONCURRENCY: ${CONCURRENCY}`)
console.log(` * REQUEST_TIMEOUT: ${REQUEST_TIMEOUT}`)
console.log(` * LIMIT: ${LIMIT}`)


const blockedResourceTypes = [
  "beacon",
  "csp_report",
  "font",
  "image",
  "imageset",
  "media",
  "object",
  "texttrack",
  "stylesheet",
];

const blockedUrls = [
  // "favicon.ico",
  // "cookielaw.org",
  // "onetrust.com",
  // "googlesyndication.com",
  // "googletagmanager.com",
  // "google-analytics.com",
  // "licdn.com",
  // "ads-twitter.com",
  // "doubleclick.net",
  // "google.com/pagead",
  // "demandbase.com",
  // "company-target.com",
  // "sfdcstatic.com",
  // "gstatic.com",
  // "sentry.io",
  // "cdndex.io",
  // "player.vimeo.com",
];

const launchBrowser = async () => {
  return await puppeteer.launch({
    ...(process.env.CHROMIUM_BIN
      ? {
        executablePath: process.env.CHROMIUM_BIN,
        args: ["--no-sandbox", "--disable-setuid-sandbox"], // TODO: see if we can remove this
      }
      : {}),
    headless: "shell",
  });
};

const browser = await launchBrowser();

const makeRequest = async (url) => {
  const page = await browser.newPage();

  await page.setDefaultTimeout(5000)
  await page.setRequestInterception(true);

  page.on("request", (request) => {
    const url = request.url().split("?")[0];
    if (blockedResourceTypes.includes(request.resourceType()) ||
      blockedUrls.some(blockedUrl => url.includes(blockedUrl))) {
      request.respond({
        status: 200
      });
    } else {
      request.continue();
    }
  });

  let result;
  const startTime = Date.now();

  try {
    const response = await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 10000
    });

    const title = await page.evaluate(() => document.querySelector('h1,h2,h3,h4,h5')?.textContent?.trim());

    const code = title ? response.status() : 'NO TITLE';

    const time = Date.now() - startTime;
    console.log(`${url}: ${code} -- ${title} -- ${time}ms`)
    result = { code, time };
  } catch (err) {
    const time = Date.now() - startTime;
    const code = err.message;
    console.log(`${url}: ${code} -- ${time}ms`)
    result = { code, time };
  } finally {
    await page.close();
    // await browser.close();
  }

  return result;
};

const iterator = (async function* () {
  const readableStream = fs.createReadStream(`./urls.txt`, {encoding: 'utf8'})

  let count = 0
  let last = ''
  for await (const chunk of readableStream) {
    const lines = (last + chunk).split('\n')
    last = lines.pop()
    for (const line of lines) {
      yield line
      count++
      if (count >= LIMIT) {
        return
      }
    }
  }
})();

const {results, errors} = await PromisePool
  .for(iterator)
  .withConcurrency(CONCURRENCY)
  .process(makeRequest)

await browser.close();

const aggregates = results.reduce((agg, result) => {
  return {...agg, [result.code]: (agg[result.code] || 0) + 1}
}, {})
const avgTime = results.reduce((agg, result) => {
  return agg + result.time
}, 0) / results.length
const medianTime = results.map(r => r.time).sort()[Math.floor(results.length / 2)]

console.log(`Total time: ${(Date.now() - start) / 1000}s`)
console.log(`Average time: ${avgTime}`)
console.log(`Median time: ${medianTime}`)
console.log(`Total URLs: ${Object.values(aggregates).reduce((agg, count) => agg + count, 0)}`)

console.log(aggregates)

