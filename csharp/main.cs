using System;
using System.Collections.Concurrent;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

class Program
{
    private readonly IHttpClientFactory _httpClientFactory;
    private static readonly int CONCURRENCY = int.Parse(Environment.GetEnvironmentVariable("CONCURRENCY") ?? "10");
    private static readonly int REQUEST_TIMEOUT = int.Parse(Environment.GetEnvironmentVariable("REQUEST_TIMEOUT") ?? "5");
    private static readonly int LIMIT = int.Parse(Environment.GetEnvironmentVariable("LIMIT") ?? "1000");
    private static readonly string DATA_DIR = Environment.GetEnvironmentVariable("DATA_DIR") ?? "../data";

    public Program(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    static async Task Main(string[] args)
    {
        var builder = Host.CreateDefaultBuilder(args)
        .ConfigureLogging((hostContext, logging) =>
        {
            logging.ClearProviders();
        })
            .ConfigureServices((hostContext, services) =>
            {
                services.AddHttpClient();
                services.AddTransient<Program>();
            });

        using (var host = builder.Build())
        {
            var program = host.Services.GetRequiredService<Program>();
            await program.Run(host.Services.GetRequiredService<IHostApplicationLifetime>().ApplicationStopping);
        }
    }

    private async Task Run(CancellationToken cancellationToken)
    {
        var start = DateTime.Now;

        Console.WriteLine("Starting crawl:");
        Console.WriteLine($" * CONCURRENCY: {CONCURRENCY}");
        Console.WriteLine($" * REQUEST_TIMEOUT: {REQUEST_TIMEOUT}");
        Console.WriteLine($" * LIMIT: {LIMIT}");

        var urls = File.ReadLines(Path.Combine(DATA_DIR, "urls.txt")).Take(LIMIT);

        var results = new ConcurrentBag<(string Code, double Time)>();
        var semaphore = new SemaphoreSlim(CONCURRENCY, CONCURRENCY);
        var tasks = new List<Task>();

        foreach (var url in urls)
        {
            await semaphore.WaitAsync(cancellationToken);
            Console.WriteLine($"Starting {url}");

            tasks.Add(Task.Run(async () =>
            {
                var start = DateTime.Now;
                try
                {
                    using var httpClient = _httpClientFactory.CreateClient();
                    httpClient.DefaultRequestHeaders.Add("User-Agent", "crawler-test");
                    httpClient.DefaultRequestHeaders.Add("Accept-Encoding", "gzip, deflate, br");
                    httpClient.Timeout = TimeSpan.FromSeconds(REQUEST_TIMEOUT);
                    using (HttpResponseMessage response = await httpClient.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, cancellationToken))
                    {
                        var code = ((int)response.StatusCode).ToString();
                        var time = (DateTime.Now - start).TotalMilliseconds;
                        Console.WriteLine($"{url} {code} -- {time} ms");
                        results.Add((code, time));
                    }
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
            }, cancellationToken));
        }
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