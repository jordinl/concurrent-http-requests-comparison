require 'uri/wss'
require 'async'
require 'async/barrier'
require 'async/semaphore'
require 'async/http/internet/instance'

CONCURRENCY = ENV.fetch('CONCURRENCY', 10).to_i
REQUEST_TIMEOUT = ENV.fetch('REQUEST_TIMEOUT', 5).to_i
URL_LIMIT = ENV.fetch('LIMIT', 1000).to_i
DATA_DIR = ENV.fetch('DATA_DIR', 'data')


puts "Starting crawl"
puts " * Concurrency: #{CONCURRENCY}"
puts " * Request Timeout: #{REQUEST_TIMEOUT}"
puts " * URL Limit: #{URL_LIMIT}"

HEADERS = {
  'user-agent' => 'crawler-test',
  'accept-encoding' => 'gzip, deflate, br'
}.freeze

file = File.open("#{DATA_DIR}/urls.txt", 'r')

urls = []
file.each_line do |line|
  urls << line.strip

  break if urls.length >= URL_LIMIT
end

barrier = Async::Barrier.new

def make_request(url, redirects: 0)
  result = Async::HTTP::Internet.get(url, headers: HEADERS, retries: 0) do |response|
    code = response.status
    location = response.headers['location']
    { url:, code:, location: }
  end

  if result[:code] < 300 || result[:code] > 399 || redirects >= 5
    return result
  end

  if result[:location]
    redirect_url = URI.join(url, result[:location]).to_s
    make_request(redirect_url, redirects: redirects + 1)
  else
    result
  end
end

start = Time.now

Sync do
  semaphore = Async::Semaphore.new(CONCURRENCY)

  results = urls.map do |url|
    semaphore.async do |task|
      time = Time.now
      begin
        task.with_timeout(REQUEST_TIMEOUT) do
          time = Time.now
          result = make_request(url)
          duration = Time.now - time
          puts "#{url} - #{result[:code]} - #{duration}"
          { **result, duration: }
        end
      rescue => e
        duration = Time.now - time
        code = e.class.name
        puts "#{url} - #{e.class.name} - #{duration}"
        { url:, code:, duration: }
      end
    end
  end.map(&:wait)

  aggregates = results.inject({}) do |agg, result|
    agg[result[:code]] ||= 0
    agg[result[:code]] += 1
    agg
  end

  avg_time = results.map { |r| r[:duration] }.inject(:+) / results.length
  median_time = results.sort_by { |r| r[:duration] }[results.length / 2][:duration]

  aggregates.sort_by { |_, v| -v }.each do |code, count|
    puts "#{code}: #{count}"
  end

  puts "Average time: #{avg_time}"
  puts "Median time: #{median_time}"
  puts "Total urls: #{aggregates.values.inject(:+)}"
ensure
  barrier.stop
end

puts "Total time: #{Time.now - start}"
