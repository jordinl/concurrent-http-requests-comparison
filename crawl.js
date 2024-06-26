import {readFileSync} from 'fs';
import {PromisePool} from '@supercharge/promise-pool'
import got from 'got'

const CONCURRENCY = parseInt(process.env.CONCURRENCY || 20)
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || 10)
const filePath = process.argv[2] || 'data/top-1000.txt'
const file = readFileSync(filePath, 'utf8')
const urls = file.split(/\n/)
const start = new Date()

const requestOptions = {
    throwHttpErrors: false,
    headers: {
        'User-Agent': 'crawler-test',
        'Accept-Encoding': 'gzip, deflate, br'
    },
    timeout: {
        request: REQUEST_TIMEOUT * 1000
    },
    maxRedirects: 5,
    retry: {
        limit: 0

    }
}

const makeRequest = async url => {
    try {
        const {statusCode, timings} = await got(url, requestOptions)
        const {phases} = timings
        console.log(`${url}: ${statusCode} -- ${phases.total}ms`)
        return {code: statusCode, time: phases.total}
    } catch (error) {
        const {phases} = error.timings
        console.error(`${url}: ${error.code} -- ${phases.total}ms`)
        return {code: error.code || 'error', time: phases.total}
    }
}

console.log(`Starting crawl\n * Concurrency: ${CONCURRENCY}\n * Timeout: ${REQUEST_TIMEOUT}s\n * File: ${filePath}\n`)

const {results, errors} = await PromisePool
    .for(urls)
    .withConcurrency(CONCURRENCY)
    .process(makeRequest)

const aggregates = results.reduce((agg, result) => {
    return {...agg, [result.code]: (agg[result.code] || 0) + 1}
}, {})
const avgTime = results.reduce((agg, {time}) => agg + time, 0) / results.length
const medianTime = results.map(({time}) => time).sort()[Math.floor(results.length / 2)]

console.log(`Total time: ${(Date.now() - start) / 1000}s`)
console.log(`Average time: ${avgTime}`)
console.log(`Median time: ${medianTime}`)
console.log(`Total URLs: ${Object.values(aggregates).reduce((agg, count) => agg + count, 0)}`)

console.log(aggregates)
