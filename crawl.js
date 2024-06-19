import { readFileSync } from 'fs';
import { PromisePool } from '@supercharge/promise-pool'
import superagent from 'superagent'

const file = readFileSync('../jobanni/data/top-1000.txt', 'utf8')

const urls = file.split(/\n/)

const start = new Date()


const makeRequest = async url => {
    try {
        const response = await superagent.get(url)
            .timeout(10000)
            .set('User-Agent', 'crawler-test')
            .ok(() => true)
        console.error(`${url}: ${response.status}`)
        return response.status
    } catch (error) {
        console.error(`${url}: ${error.code} ${error.errno}`)
        return error.code || 'error'
    }
}

const { results, errors } = await PromisePool
    .for(urls)
    .withConcurrency(50)
    .process(makeRequest)

const aggregates = results.reduce((agg, number) => {
    return { ...agg, [number]: (agg[number] || 0) + 1 }
}, {})

console.log(`Total time: ${(Date.now() - start) / 1000}s`)

console.log(aggregates)
