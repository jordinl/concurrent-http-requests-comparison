import {createInterface} from "node:readline";
import {PromisePool} from '@supercharge/promise-pool'

const CONCURRENCY = parseInt(process.env.CONCURRENCY || 10)
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || 5)

const headers = {
  'User-Agent': 'crawler-test',
  'Accept-Encoding': 'gzip, deflate, br'
}

const makeRequest = async url => {
  const startTime = new Date();
  let code;
  let bodyLength = 0;

  try {
    const signal = AbortSignal.timeout(REQUEST_TIMEOUT * 1000);
    const response = await fetch(url, {headers, signal})
    const body = await response.text();
    code = response.status;
    bodyLength = body.length;
  } catch (error) {
    code = error.cause?.code || error.name;
  }
  const duration = new Date() - startTime;
  console.log(`${url},${code},${startTime.toISOString()},${duration},${bodyLength}`);
}

await PromisePool
  .for(createInterface({input: process.stdin}))
  .withConcurrency(CONCURRENCY)
  .process(makeRequest)
