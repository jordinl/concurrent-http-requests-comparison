import {createInterface} from "node:readline";
import {PromisePool} from "@supercharge/promise-pool";
import {Agent, interceptors} from "undici";

const CONCURRENCY = parseInt(process.env.CONCURRENCY || 10);
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || 5) * 1000;
const headers = {
  "User-Agent": process.env.USER_AGENT || "node-undici-request"
};

const client = new Agent({connect: {timeout: REQUEST_TIMEOUT, keepAlive: false}})
  .compose(
    interceptors.redirect({maxRedirections: 5, throwOnMaxRedirects: true})
  );

const makeRequest = async url => {
  const startTime = new Date();

  const onComplete = (code, bodyLength = 0) => {
    const duration = new Date() - startTime;
    console.log(`${url},${code},${startTime.toISOString()},${duration},${bodyLength}`);
  };

  try {
    const signal = AbortSignal.timeout(REQUEST_TIMEOUT);
    const response = await client.request({origin: url, path: "/", method: "GET", signal, headers});
    const body = await response.body.text({signal});
    onComplete(response.statusCode, body.length);
  } catch (error) {
    const code = typeof error.code === "string" ? error.code : error.name;
    onComplete(code);
  }
};

await PromisePool
  .for(createInterface({input: process.stdin}))
  .withConcurrency(CONCURRENCY)
  .process(makeRequest);
