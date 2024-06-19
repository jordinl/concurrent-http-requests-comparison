import { readFileSync } from 'fs';
import { PromisePool } from '@supercharge/promise-pool'

const file = readFileSync('../jobanni/data/top-1000.txt', 'utf8')

const urls = file.split(/\n/)

const start = new Date()

const { results, errors } = await PromisePool
    .for(urls)
    .withConcurrency(20)
    .process(async url => {
        try {
            const response = await fetch(url, {signal: AbortSignal.timeout(10000)})
            console.log(`${url}: ${response.status}`)
            return response.status
        } catch (error) {
            console.error(`${url}: ${error.cause && error.cause.toString() || error.toString()}`)
            return 'error'
        }
    })

const aggregates = results.reduce((agg, number) => {
    return { ...agg, [number]: (agg[number] || 0) + 1 }
}, {})

console.log(`Total time: ${(Date.now() - start) / 1000}s`)

console.log(aggregates)
