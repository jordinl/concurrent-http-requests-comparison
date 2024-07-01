import { readFileSync } from 'node:fs';
import { PromisePool } from '@supercharge/promise-pool'

const CONCURRENCY = parseInt(Deno.env.get('CONCURRENCY') || 10)
const REQUEST_TIMEOUT = parseInt(Deno.env.get('REQUEST_TIMEOUT') || 5)
const filePath = Deno.args[0] || 'data/top-1000.txt'
const file = readFileSync(filePath, 'utf8')
const urls = file.split(/\n/)
const start = new Date()

console.log(`Starting crawl with ${CONCURRENCY} concurrency`)
console.log(`Request timeout: ${REQUEST_TIMEOUT}s`)
console.log(`Reading URLs from ${filePath}`)

const headers = {
    'User-Agent': 'crawler-test',
    'Accept-Encoding': 'gzip, deflate, br'
}

const makeRequest = async url => {
    const startTime = Date.now()

    TypeError

    try {
        const controller = new AbortController();
        const signal = controller.signal;
        const timeout = setTimeout(() => controller.abort('TIMEOUT_ERROR'), 5000);
        const response = await fetch(url, { headers, signal })
        clearTimeout(timeout);
        const time = Date.now() - startTime
        console.log(`${url}: ${response.status} -- ${time}ms`)
        return { code: response.status, time }
    } catch (error) {
        const time = Date.now() - startTime
        const code = error.name || error
        console.error(`${url}: ${code} -- ${time}ms`)
        return { code, time }
    }
}

const { results, errors } = await PromisePool
    .for(urls)
    .withConcurrency(CONCURRENCY)
    .process(makeRequest)

const aggregates = results.reduce((agg, result) => {
    return { ...agg, [result.code]: (agg[result.code] || 0) + 1 }
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
