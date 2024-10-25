import {createInterface} from "node:readline";
import * as reqwest from "@reqwest/fetch";
import {PromisePool} from "@supercharge/promise-pool";

const CONCURRENCY = parseInt(process.env.CONCURRENCY || 10);
const timeout = parseInt(process.env.REQUEST_TIMEOUT || 5) * 1000;
const headers = {
  "User-Agent": process.env.USER_AGENT || "node-reqwest"
};

const makeRequest = async url => {
  const startTime = new Date();

  const onComplete = (code, bodyLength = 0) => {
    const duration = new Date() - startTime;
    console.log(`${url},${code},${startTime.toISOString()},${duration},${bodyLength}`);
  };

  try {
    const { status, body } = await reqwest.fetch(url, {headers, timeout});
    onComplete(status, body.length);
  } catch (error) {
    onComplete(error.message);
  }
};

await PromisePool
  .for(createInterface({input: process.stdin}))
  .withConcurrency(CONCURRENCY)
  .process(makeRequest);
