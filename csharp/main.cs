using System.Collections.Concurrent;

internal class BetterHttpClient
{
  private readonly HttpClient _client = new(new HttpClientHandler { AllowAutoRedirect = false });
  private const int MaxRedirects = 10;
  private const int TimeoutSeconds = 5;

  public BetterHttpClient()
  {
    _client.DefaultRequestHeaders.Add("User-Agent", "crawler-test");
    _client.DefaultRequestHeaders.Add("Accept-Encoding", "gzip, deflate, br");
    _client.Timeout = TimeSpan.FromSeconds(TimeoutSeconds);
  }

  public async Task<HttpResponseMessage> GetAsync(Uri url, CancellationToken cancellationToken)
  {
    for (var redirects = 0; redirects < MaxRedirects; redirects++)
    {
      var response = await _client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, cancellationToken);

      var status = (int)response.StatusCode;

      if (status is < 300 or >= 400)
      {
        return response;
      }

      url = new Uri(response.RequestMessage.RequestUri, response.Headers!.Location!);
      response.Dispose();
    }

    throw new TooManyRedirectsException();
  }
}

internal class TooManyRedirectsException : Exception;


class Program
{
    private static readonly BetterHttpClient httpClient = new();
    private static readonly int CONCURRENCY = int.Parse(Environment.GetEnvironmentVariable("CONCURRENCY") ?? "10");
    private static readonly int LIMIT = int.Parse(Environment.GetEnvironmentVariable("LIMIT") ?? "1000");
    private static readonly string DATA_DIR = Environment.GetEnvironmentVariable("DATA_DIR") ?? "../data";

    static async Task Main()
    {
        var start = DateTime.Now;

        Console.WriteLine("Starting crawl:");
        Console.WriteLine($" * CONCURRENCY: {CONCURRENCY}");
        Console.WriteLine($" * LIMIT: {LIMIT}");

        var urls = File.ReadLines(Path.Combine(DATA_DIR, "urls.txt")).Take(LIMIT);

        var results = new ConcurrentBag<(string Code, int Time)>();
        var parallelOptions = new ParallelOptions { MaxDegreeOfParallelism = CONCURRENCY };

        await Parallel.ForEachAsync(urls, parallelOptions, async (url, cancellationToken) =>
        {
            var start = DateTime.Now;
            try
            {
                using var response = await httpClient.GetAsync(new Uri(url), cancellationToken);
                var code = ((int)response.StatusCode).ToString();
                var time = (int)(DateTime.Now - start).TotalMilliseconds;
                Console.WriteLine($"{url} {code} -- {time} ms");
                if (response.IsSuccessStatusCode)
                {
                    var body = await response.Content.ReadAsStringAsync();
                    var _out = body.Replace("\0", "");
                }
                results.Add((code, time));
            }
            catch (Exception ex)
            {
                var time = (int)(DateTime.Now - start).TotalMilliseconds;
                var code = (ex.InnerException ?? ex).GetType().Name;
                Console.Error.WriteLine($"{url}: {code} -- {time}ms");
                results.Add((code, time));
            }
        });

        var aggregates = results.GroupBy(r => r.Code).ToDictionary(g => g.Key, g => g.Count());
        var avgTime = results.Average(r => r.Time);
        var medianTime = results.OrderBy(r => r.Time).ElementAt(results.Count / 2).Time;

        Console.WriteLine($"Total time: {(DateTime.Now - start).TotalSeconds}s");
        Console.WriteLine($"Average time: {avgTime}");
        Console.WriteLine($"Median time: {medianTime}");
        Console.WriteLine($"Total URLs: {results.Count}");

        foreach (var aggregate in aggregates.OrderByDescending(x => x.Value))
        {
            Console.WriteLine($"{aggregate.Key}: {aggregate.Value}");
        }
    }

}
