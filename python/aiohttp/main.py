import os
import sys
import asyncio
import aiohttp
from time import time

CONCURRENCY = int(os.environ.get('CONCURRENCY', 10))
REQUEST_TIMEOUT = int(os.environ.get('REQUEST_TIMEOUT', 5))
URL_LIMIT = int(os.environ.get('LIMIT', 1000))

def file_reader():
    count = 0
    with open('/mnt/appdata/urls.txt', 'r') as file:
        for line in file:
            yield line.strip()
            count += 1
            if count >= URL_LIMIT:
                break

print(f"Starting crawl")
print(f" * CONCURRENCY: {CONCURRENCY}")
print(f" * REQUEST_TIMEOUT: {REQUEST_TIMEOUT}s")
print(f" * URL_LIMIT: {URL_LIMIT}")

headers = {
    'User-Agent': 'crawler-test',
    'Accept-Encoding': 'gzip, deflate, br'
}

conn = aiohttp.TCPConnector(limit=CONCURRENCY)
semaphore = asyncio.Semaphore(CONCURRENCY)

def get_exception(exc):
    if not exc.__cause__:
        return exc.__class__.__name__
    return get_exception(exc.__cause__)

async def make_request(url):
    async with semaphore:
        start = time()

        timeout=aiohttp.ClientTimeout(total=REQUEST_TIMEOUT)

        async with aiohttp.ClientSession(headers=headers, timeout=timeout) as session:
            try:
                async with session.get(url) as response:
                    code = response.status
            except Exception as exc:
                code = get_exception(exc)
            finally:
                duration = time() - start
                print(f"{url} - {code} - {duration:.2f}s")
                return {'url': url, 'code': code, 'time': duration}

async def main():
    urls = file_reader()
    tasks = [make_request(url) for url in urls]

    results = await asyncio.gather(*tasks)

    aggregates = {}
    for result in results:
        code = result['code']
        aggregates[code] = aggregates.get(code, 0) + 1

    avg_time = sum(result['time'] for result in results) / len(results)
    median_time = sorted(result['time'] for result in results)[len(results) // 2]

    print(f"Average time: {avg_time * 1000:.2f}ms")
    print(f"Median time: {median_time * 1000:.2f}ms")
    print(f"Total URLs: {sum(aggregates.values())}")

    print(aggregates)

try:
    start = time()
    asyncio.run(main())
except Exception as exc:
    print(exc)
finally:
    print(f"Total time: {time() - start:.2f}s")