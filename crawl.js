import { readFileSync } from 'fs';
import { PromisePool } from '@supercharge/promise-pool'
import superagent from 'superagent'

const CONCURRENCY = parseInt(process.env.CONCURRENCY || 10)
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || 5)
const filePath = process.argv[2] || 'data/top-1000.txt'
const file = readFileSync(filePath, 'utf8')
const urls = file.split(/\n/)
const start = new Date()


console.log(`Starting crawl with ${CONCURRENCY} concurrency`)
console.log(`Request timeout: ${REQUEST_TIMEOUT}s`)
console.log(`Reading URLs from ${filePath}`)

const makeRequest = async url => {
    const startTime = Date.now()
    try {
        const response = await superagent.get(url)
            .timeout(REQUEST_TIMEOUT * 1000)
            .set('User-Agent', 'crawler-test')
            .set('Accept-Encoding', 'gzip, deflate, br')
            .ok(() => true)
        const time = Date.now() - startTime
        console.log(`${url}: ${response.status} -- ${time}ms`)
        return { code: response.status, time }
    } catch (error) {
        const time = Date.now() - startTime
        console.error(`${url}: ${error.code} ${error.errno} -- ${time}ms`)
        return { code: error.code || 'error', time }
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
