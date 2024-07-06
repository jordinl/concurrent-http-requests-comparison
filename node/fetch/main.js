import fs from 'fs';
import {PromisePool} from '@supercharge/promise-pool'

const CONCURRENCY = parseInt(process.env.CONCURRENCY || 10)
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || 5)
const LIMIT = parseInt(process.env.LIMIT || 1000)
const start = new Date()

console.log(`Starting crawl:`)
console.log(` * CONCURRENCY: ${CONCURRENCY}`)
console.log(` * REQUEST_TIMEOUT: ${REQUEST_TIMEOUT}`)
console.log(` * LIMIT: ${LIMIT}`)

const headers = {
    'User-Agent': 'crawler-test',
    'Accept-Encoding': 'gzip, deflate, br'
}

const iterator = (async function* () {
    const readableStream = fs.createReadStream('/mnt/appdata/urls.txt', {encoding: 'utf8'})

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

const makeRequest = async url => {
    const startTime = Date.now()

    try {
        const response = await fetch(url, {headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT * 1000)})
        const time = Date.now() - startTime
        console.log(`${url}: ${response.status} -- ${time}ms`)
        return {code: response.status, time}
    } catch (error) {
        const time = Date.now() - startTime
        const code = error.cause?.code || error.name
        console.error(`${url}: ${code} -- ${time}ms`)
        return {code, time}
    }
}

const {results, errors} = await PromisePool
    .for(iterator)
    .withConcurrency(CONCURRENCY)
    .process(makeRequest)

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
