using System.Collections.Concurrent;

internal class BetterHttpClient
{
  private static readonly SocketsHttpHandler HttpHandler = new() { PooledConnectionIdleTimeout = TimeSpan.FromSeconds(1), AllowAutoRedirect = false };
  private static readonly HttpClient Client = new(HttpHandler);
  private const int MaxRedirects = 10;
  private const int TimeoutSeconds = 5;

  public BetterHttpClient()
  {
    Client.DefaultRequestHeaders.Add("User-Agent", "crawler-test");
    Client.DefaultRequestHeaders.Add("Accept-Encoding", "gzip, deflate, br");
  }

  public async Task<HttpResponseMessage> GetAsync(Uri url, CancellationToken cancellationToken)
  {
    var cancellationSource = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
    cancellationSource.CancelAfter(TimeSpan.FromSeconds(TimeoutSeconds));
    for (var redirects = 0; redirects < MaxRedirects; redirects++)
    {
      var response = await Client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, cancellationSource.Token);

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
  private static readonly BetterHttpClient HttpClient = new();
  private static readonly int Concurrency = int.Parse(Environment.GetEnvironmentVariable("CONCURRENCY") ?? "10");
  private static readonly int Limit = int.Parse(Environment.GetEnvironmentVariable("LIMIT") ?? "1000");
  private static readonly string DataDir = Environment.GetEnvironmentVariable("DATA_DIR") ?? "../data";

  static async Task Main()
  {
    var start = DateTime.Now;

    Console.WriteLine("Starting crawl:");
    Console.WriteLine($" * CONCURRENCY: {Concurrency}");
    Console.WriteLine($" * LIMIT: {Limit}");

    var urls = File.ReadLines(Path.Combine(DataDir, "urls.txt")).Take(Limit);

    var results = new ConcurrentBag<(string Code, int Time)>();
    var parallelOptions = new ParallelOptions { MaxDegreeOfParallelism = Concurrency };

    await Parallel.ForEachAsync(urls, parallelOptions, async (url, cancellationToken) =>
    {
      var start = DateTime.Now;
      try
      {
        using var response = await HttpClient.GetAsync(new Uri(url), cancellationToken);
        var code = ((int)response.StatusCode).ToString();
        var time = (int)(DateTime.Now - start).TotalMilliseconds;
        Console.WriteLine($"{url} {code} -- {time} ms");
        if (response.IsSuccessStatusCode)
        {
          var body = await response.Content.ReadAsStringAsync(cancellationToken);
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
