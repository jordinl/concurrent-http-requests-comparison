import {TextLineStream, PromisePool} from './deps.js';

const CONCURRENCY = parseInt(Deno.env.get('CONCURRENCY') || 10);
const timeout = parseInt(Deno.env.get('REQUEST_TIMEOUT') || 5) * 1000;
const headers = {
  'User-Agent': Deno.env.get('USER_AGENT') || 'deno-fetch',
}

const urls = (async function* () {
  const readable = Deno.stdin.readable
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream());

  for await (const line of readable) {
    yield line;
  }
})();

const client = Deno.createHttpClient({poolMaxIdlePerHost: 0});

const makeRequest = async url => {
  const startTime = new Date();
  let code;
  let bodyLength = 0;

  try {
    const signal = AbortSignal.timeout(timeout);
    const response = await fetch(url, {headers, signal, client})
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
  .for(urls)
  .withConcurrency(CONCURRENCY)
  .process(makeRequest);
