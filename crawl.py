import os
import json
from datetime import datetime

import scrapy
from scrapy.crawler import CrawlerProcess
from spider import MainSpider

os.remove('tmp/output.json')

process = CrawlerProcess()

time = datetime.now()
process.crawl(MainSpider)
process.start()

with open('tmp/output.json') as f:
    data = json.load(f)
    aggregates = {}
    for item in data:
        code = item['code']
        if code not in aggregates:
            aggregates[code] = 0
        aggregates[code] += 1
    print(aggregates)

print(datetime.now() - time)