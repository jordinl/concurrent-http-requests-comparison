import scrapy
from scrapy.spidermiddlewares.httperror import HttpError
import os

class MainSpider(scrapy.Spider):
    name = 'main'
    start_urls = [l.strip() for l in open('../jobanni/data/top-1000.txt').readlines()]

    custom_settings = {
        'REQUEST_FINGERPRINTER_IMPLEMENTATION': '2.7',
        'USER_AGENT': 'crawler-test',
        'ROBOTSTXT_OBEY': False,
        'CONCURRENT_REQUESTS': os.environ.get('CONCURRENCY', 20),
        'RETRY_ENABLED': False,
        'TELNETCONSOLE_ENABLED': False,
        'DOWNLOAD_TIMEOUT': 10,
        'LOG_LEVEL': 'INFO',
        'REDIRECT_ENABLED': True,
        'REDIRECT_MAX_TIMES': 5,
        'FEED_FORMAT': 'json',
        'FEED_URI': 'tmp/output.json',
        'REACTOR_THREADPOOL_MAXSIZE': os.environ.get('CONCURRENCY', 20)
    }

    def start_requests(self):
        for url in self.start_urls:
            yield scrapy.Request(url, callback=self.parse,
                                    errback=self.errback,
                                    dont_filter=True)

    def parse(self, response):
        yield { 'code': response.status, 'url': response.request.url }

    def errback(self, failure):
        code = failure.value.response.status if failure.check(HttpError) else failure.type.__name__
        url = failure.request.url
        yield { 'code': code, 'url': url }