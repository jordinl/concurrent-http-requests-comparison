import {createInterface} from "node:readline";
import {PromisePool} from "@supercharge/promise-pool";

const CONCURRENCY = parseInt(process.env.CONCURRENCY || 10);
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || 5);
const headers = {
  "User-Agent": process.env.USER_AGENT || "node-fetch",
  "Accept-Encoding": "gzip, deflate, br"
};

const makeRequest = async url => {
  const startTime = new Date();

  const onComplete = (code, bodyLength = 0) => {
    const duration = new Date() - startTime;
    console.log(`${url},${code},${startTime.toISOString()},${duration},${bodyLength}`);
  };

  try {
    const signal = AbortSignal.timeout(REQUEST_TIMEOUT * 1000);
    const response = await fetch(url, {headers, signal});
    const body = await response.text();
    onComplete(response.status, body.length);
  } catch (error) {
    onComplete(error.cause?.code || error.name);
  }
};

await PromisePool
  .for(createInterface({input: process.stdin}))
  .withConcurrency(CONCURRENCY)
  .process(makeRequest);
