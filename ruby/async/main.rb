require 'async'
require 'async/semaphore'
require 'date'
require 'http'

STDOUT.sync = true

CONCURRENCY = ENV.fetch('CONCURRENCY', 10).to_i
REQUEST_TIMEOUT = ENV.fetch('REQUEST_TIMEOUT', 5).to_i
USER_AGENT = ENV.fetch('USER_AGENT', 'ruby-async-http')

HEADERS = {
  'user-agent' => USER_AGENT,
  'accept-encoding' => 'gzip, deflate, br'
}.freeze

def make_request(url)
  start_time = Time.now
  on_complete = -> (code, body_length = 0) {
    duration = ((Time.now - start_time) * 1000).round
    puts "#{url},#{code},#{start_time.to_datetime},#{duration},#{body_length}"
  }
  response = HTTP.follow.timeout(REQUEST_TIMEOUT).get(url)
  on_complete.(response.code, response.to_s.length)
rescue Exception => e
  on_complete.(e.class.name)
end

Sync do
  semaphore = Async::Semaphore.new(CONCURRENCY)

  $stdin.each_line.map do |line|
    semaphore.async do
      make_request(line.strip)
    end
  end.each(&:wait)
end

