import fs from 'fs';
import * as reqwest from './index.js';
import {PromisePool} from '@supercharge/promise-pool'

const CONCURRENCY = parseInt(process.env.CONCURRENCY || 10)
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || 5)
const LIMIT = parseInt(process.env.LIMIT || 1000)
const start = new Date()
const dataDir = process.env.DATA_DIR || './data'

console.log(`Starting crawl:`)
console.log(` * CONCURRENCY: ${CONCURRENCY}`)
console.log(` * REQUEST_TIMEOUT: ${REQUEST_TIMEOUT}`)
console.log(` * LIMIT: ${LIMIT}`)

const headers = {
  'User-Agent': 'crawler-test',
}

const iterator = (async function* () {
  const readableStream = fs.createReadStream(`${dataDir}/urls.txt`, {encoding: 'utf8'})

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
  const start = new Date();
  const response = await reqwest.fetchUrl(url, { headers, timeout: 5000 })
  const time = new Date() - start;
  const code = response.code;
  console.log(`${url}: ${code} -- ${time}ms`)
  return { code, time }
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

