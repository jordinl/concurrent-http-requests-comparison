import os
import sys
import asyncio
import aiohttp
from datetime import datetime

CONCURRENCY = int(os.environ.get('CONCURRENCY', 10))
REQUEST_TIMEOUT = int(os.environ.get('REQUEST_TIMEOUT', 5))
USER_AGENT = os.environ.get('USER_AGENT', 'python-aiohttp')

headers = {
    'User-Agent': USER_AGENT,
    'Accept-Encoding': 'gzip, deflate, br'
}

semaphore = asyncio.Semaphore(CONCURRENCY)

def get_exception(exc):
    if not exc.__cause__:
        return exc.__class__.__name__
    return get_exception(exc.__cause__)

async def make_request(url):
    async with semaphore:
        start = datetime.now()
        body_length = 0

        timeout=aiohttp.ClientTimeout(total=REQUEST_TIMEOUT)

        async with aiohttp.ClientSession(headers=headers, timeout=timeout) as session:
            try:
                async with session.get(url) as response:
                    body = await response.text()
                    body_length = len(body)
                    code = response.status
            except Exception as exc:
                code = get_exception(exc)
            finally:
                duration = round((datetime.now() - start).total_seconds() * 1000)
                print(f"{url},{code},{start.isoformat()},{duration},{body_length}")

async def main():
    tasks = [make_request(url.strip()) for url in sys.stdin]
    await asyncio.gather(*tasks)

asyncio.run(main())
