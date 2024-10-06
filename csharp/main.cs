using System.Collections.Concurrent;
using System.Net;

class Program
{
    private static readonly HttpClient httpClient = new();
    private static readonly int CONCURRENCY = int.Parse(Environment.GetEnvironmentVariable("CONCURRENCY") ?? "10");
    private static readonly int REQUEST_TIMEOUT = int.Parse(Environment.GetEnvironmentVariable("REQUEST_TIMEOUT") ?? "5");
    private static readonly int LIMIT = int.Parse(Environment.GetEnvironmentVariable("LIMIT") ?? "1000");
    private static readonly string DATA_DIR = Environment.GetEnvironmentVariable("DATA_DIR") ?? "../data";

    static async Task Main()
    {
        var start = DateTime.Now;

        httpClient.DefaultRequestHeaders.Add("User-Agent", "crawler-test");
        httpClient.DefaultRequestHeaders.Add("Accept-Encoding", "gzip, deflate, br");
        httpClient.Timeout = TimeSpan.FromSeconds(REQUEST_TIMEOUT);

        Console.WriteLine("Starting crawl:");
        Console.WriteLine($" * CONCURRENCY: {CONCURRENCY}");
        Console.WriteLine($" * REQUEST_TIMEOUT: {REQUEST_TIMEOUT}");
        Console.WriteLine($" * LIMIT: {LIMIT}");

        var urls = File.ReadLines(Path.Combine(DATA_DIR, "urls.txt")).Take(LIMIT);

        var results = new ConcurrentBag<(string Code, double Time)>();
        var semaphore = new SemaphoreSlim(CONCURRENCY, CONCURRENCY);

        var tasks = urls.Select(async url =>
        {
            await semaphore.WaitAsync();

            var start = DateTime.Now;
            try
            {
                using HttpResponseMessage response = await httpClient.GetAsync(url);
                var code = ((int)response.StatusCode).ToString();
                var time = (DateTime.Now - start).TotalMilliseconds;
                Console.WriteLine($"{url} {code} -- {time} ms");
                results.Add((code, time));
            }
            catch (Exception ex)
            {
                var time = (DateTime.Now - start).TotalMilliseconds;
                var code = ex.GetType().Name;
                Console.Error.WriteLine($"{url}: {code} -- {time}ms");
                results.Add((code, time));
            }
            finally
            {
                semaphore.Release();
            }
        });
        await Task.WhenAll(tasks);

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



