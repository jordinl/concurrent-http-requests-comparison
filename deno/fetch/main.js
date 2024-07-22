import { TextLineStream, Semaphore } from './deps.js';

const CONCURRENCY = parseInt(Deno.env.get('CONCURRENCY') || 10)
// const REQUEST_TIMEOUT = parseInt(Deno.env.get('REQUEST_TIMEOUT') || 5)
const LIMIT = parseInt(Deno.env.get('LIMIT') || 10000)
// const ACCEPT_ENCODING = Deno.env.get('ACCEPT_ENCODING')

const start = new Date()

const headers = {
    'User-Agent': 'crawler-test',
}

console.log(`Starting crawl:`)
console.log(` * CONCURRENCY: ${CONCURRENCY}`)


const iterator = (async function* () {
    const file = await Deno.open('/mnt/appdata/urls.txt')

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

const makeRequest = async url => {
    const startTime = Date.now()

    try {
        const controller = new AbortController();
        const signal = controller.signal;
        const timeout = setTimeout(() => controller.abort('timeout error'), 5000);
        const response = await fetch(url, { headers, signal });
        clearTimeout(timeout);
        const time = Date.now() - startTime
        console.log(`${url}: ${response.status} -- ${time}ms`)
        return { code: response.status, time }
    } catch (error) {
        const time = Date.now() - startTime
        const messageParts = (error.message || error).split(": ").filter(u => !u.match(/https?:\/\//))
        const code = messageParts[1] || messageParts[0]
        console.error(`${url}: ${code} -- ${time}ms`)
        return { code, time }
    }
}

const semaphore = new Semaphore(CONCURRENCY);

for await (const url of iterator) {
    await semaphore.acquire();
    (async () => {
        await makeRequest(url);
        semaphore.release();
    })()
}

// const { results, errors } = await PromisePool
//     .for(iterator)
//     .withConcurrency(CONCURRENCY)
//     .process(makeRequest)
//
// const aggregates = results.reduce((agg, result) => {
//     return { ...agg, [result.code]: (agg[result.code] || 0) + 1 }
// }, {})
// const avgTime = results.reduce((agg, result) => {
//     return agg + result.time
// }, 0) / results.length
// const medianTime = results.map(r => r.time).sort()[Math.floor(results.length / 2)]
//
// console.log(`Total time: ${(Date.now() - start) / 1000}s`)
// console.log(`Average time: ${avgTime}`)
// console.log(`Median time: ${medianTime}`)
// console.log(`Total URLs: ${Object.values(aggregates).reduce((agg, count) => agg + count, 0)}`)
//
// console.log(aggregates)
