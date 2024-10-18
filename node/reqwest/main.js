import {createInterface} from "node:readline";
import * as reqwest from "@reqwest/fetch";
import {PromisePool} from "@supercharge/promise-pool";

const CONCURRENCY = parseInt(process.env.CONCURRENCY || 10);
const timeout = parseInt(process.env.REQUEST_TIMEOUT || 5) * 1000;
const headers = {
  "User-Agent": "crawler-test"
};

const makeRequest = async url => {
  const startTime = new Date();
  let bodyLength = 0;
  let code;

  try {
    const response = await reqwest.fetch(url, {headers, timeout});
    code = response.status;
    bodyLength = response.body.length;
  } catch (error) {
    code = error.message;
  }
  const duration = new Date() - startTime;
  console.log(`${url},${code},${startTime.toISOString()},${duration},${bodyLength}`);
};

await PromisePool
  .for(createInterface({input: process.stdin}))
  .withConcurrency(CONCURRENCY)
  .process(makeRequest);
