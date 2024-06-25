import { readFileSync } from 'fs';
import { PromisePool } from '@supercharge/promise-pool'
import superagent from 'superagent'

const CONCURRENCY = parseInt(process.env.CONCURRENCY || 20)
const file = readFileSync('data/top-1000.txt', 'utf8')
const urls = file.split(/\n/)
const start = new Date()

console.log(`Starting crawl with ${CONCURRENCY} concurrency`)


const makeRequest = async url => {
    const time = Date.now()
    try {
        const response = await superagent.get(url)
            .timeout(10000)
            .set('User-Agent', 'crawler-test')
            .set('Accept-Encoding', 'gzip, deflate, br')
            .ok(() => true)
        console.error(`${url}: ${response.status}`)
        return { code: response.status, time: Date.now() - time }
    } catch (error) {
        console.error(`${url}: ${error.code} ${error.errno}`)
        return { code: error.code || 'error', time: Date.now() - time }
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

console.log(aggregates)
