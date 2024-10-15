import { TextLineStream, PromisePool } from './deps.js';

const CONCURRENCY = parseInt(Deno.env.get('CONCURRENCY') || 10)
const REQUEST_TIMEOUT = parseInt(Deno.env.get('REQUEST_TIMEOUT') || 5)
const LIMIT = parseInt(Deno.env.get('LIMIT') || 1000)
const dataDir = Deno.env.get('DATA_DIR') || './data'

const start = new Date()

const headers = {
    'User-Agent': 'crawler-test',
}

console.log(`Starting crawl:`)
console.log(` * CONCURRENCY: ${CONCURRENCY}`)
console.log(` * REQUEST_TIMEOUT: ${REQUEST_TIMEOUT}`)
console.log(` * LIMIT: ${LIMIT}`)

const iterator = (async function* () {
    const file = await Deno.open(`${dataDir}/urls.txt`)

    const readable = file.readable
        .pipeThrough(new TextDecoderStream()) // decode Uint8Array to string
        .pipeThrough(new TextLineStream()) // split string line by line

    let count = 0
    for await (const line of readable) {
        yield line
        count++
        if (count >= LIMIT) {
            return
        }
    }
})();

const client = Deno.createHttpClient({poolMaxIdlePerHost: 0});

const makeRequest = async url => {
    const startTime = Date.now()

    try {
        const signal = AbortSignal.timeout(5000);
        const response = await fetch(url, { headers, signal, client });
        const body = await response.text();
        const bodyLength = body.length;
        const time = Date.now() - startTime
        const color = response.ok ? "green" : "yellow"
        console.log(`%c[${response.status}] ${url}: ${time}ms / Length: ${bodyLength}`, `color: ${color}`);
        const code = `${response.status.toString()[0]}xx`;
        return { code, time }
    } catch (error) {
        const time = Date.now() - startTime
        const messageParts = (error.message || error).split(": ").filter(u => !u.match(/https?:\/\//))
        const exName = messageParts[1] || messageParts[0]
        console.error(`%c[${exName}] ${url}: ${time}ms`, "color: red")
        return { code: 'Exception', time }
    }
}

const { results } = await PromisePool
    .for(iterator)
    .withConcurrency(CONCURRENCY)
    .process(makeRequest)

const defaultAggregates = {
  "2xx": 0,
  "3xx": 0,
  "4xx": 0,
  "5xx": 0,
  "Exception": 0
};

const aggregates = results.reduce((agg, result) => {
    return { ...agg, [result.code]: agg[result.code] + 1 }
}, defaultAggregates)
const times = results.map(r => r.time);
const avgTime = Math.round(times.reduce((agg, time) => agg + time, 0) / results.length);
const medianTime = times.sort()[Math.floor(times.length / 2)]
const maxTime = Math.max(...times);

console.log(`Total time: ${(Date.now() - start) / 1000}s`)
console.log(`Average time: ${avgTime}ms`)
console.log(`Median time: ${medianTime}ms`)
console.log(`Max time: ${maxTime}ms`)
console.log(`Total URLs: ${Object.values(aggregates).reduce((agg, count) => agg + count, 0)}`)
console.log(aggregates)
