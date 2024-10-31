using System.Diagnostics;

class Program
{
  private static readonly SocketsHttpHandler HttpHandler = new() { PooledConnectionLifetime = TimeSpan.Zero };
  private static readonly HttpClient HttpClient = new(HttpHandler);
  private static readonly int Concurrency = int.Parse(Environment.GetEnvironmentVariable("CONCURRENCY") ?? "10");
  private const int TimeoutSeconds = 5;
  private static readonly ParallelOptions ParallelOptions = new () { MaxDegreeOfParallelism = Concurrency };
  private static readonly string UserAgent = Environment.GetEnvironmentVariable("USER_AGENT") ?? "dotnet-http-client";

  private static IEnumerable<string> ReadUrls()
  {
    using var stdin = new StreamReader(Console.OpenStandardInput());

    while (!stdin.EndOfStream)
    {
      var line = stdin.ReadLine();
      if (string.IsNullOrWhiteSpace(line)) continue;
      yield return line;
    }
  }

  static async Task Main()
  {
    HttpClient.DefaultRequestHeaders.Add("User-Agent", UserAgent);

    var urls = ReadUrls();

    await Parallel.ForEachAsync(urls, ParallelOptions, async (url, cancellationToken) =>
    {
      var start = DateTime.Now;
      var stopwatch = Stopwatch.StartNew();
      string code;
      var bodyLength = 0;
      try
      {
        var cancellationSource = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        cancellationSource.CancelAfter(TimeSpan.FromSeconds(TimeoutSeconds));
        using var response = await HttpClient.GetAsync(new Uri(url), cancellationSource.Token);
        code = ((int)response.StatusCode).ToString();
        if (response.IsSuccessStatusCode)
        {
          var body = await response.Content.ReadAsStringAsync(cancellationToken);
          bodyLength = body.Length;
        }
      }
      catch (Exception ex)
      {
        code = (ex.InnerException ?? ex).GetType().Name;
      }
      stopwatch.Stop();
      var duration = stopwatch.ElapsedMilliseconds;
      Console.WriteLine($"{url},{code},{start:s},{duration},{bodyLength}");
    });
  }
}
