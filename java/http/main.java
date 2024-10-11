import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URI;

class Main {
  private static final Integer LIMIT = getEnv("LIMIT", 1000);
  private static final Integer CONCURRENCY = getEnv("CONCURRENCY", 10);
  private static final String FILE_PATH = "/mnt/appdata/urls.txt";

  private static final HttpClient CLIENT = HttpClient.newBuilder()
    .followRedirects(HttpClient.Redirect.ALWAYS)
    .version(HttpClient.Version.HTTP_1_1)
    .build();

  private static HttpRequest buildHttpRequest(String url) {
    return HttpRequest.newBuilder()
      .uri(URI.create(url))
      .header("User-Agent", "crawler-test")
      .header("Accept-Encoding", "gzip, deflate, br")
      .GET()
      .build();
  }

  private static Integer getEnv(String variableName, Integer defaultValue) {
    String value = System.getenv(variableName);
    return value != null ? Integer.parseInt(value) : defaultValue;
  }

  public static AbstractMap.SimpleEntry<String, Long> makeRequest(String url) {
    long startTime = System.currentTimeMillis();

    return CLIENT.sendAsync(buildHttpRequest(url), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8))
      .orTimeout(5, TimeUnit.SECONDS)
      .thenApply(response -> {
        var responseBody = response.body().replace("\0", "");
        return Integer.toString(response.statusCode());
      })
      .exceptionally(ex -> {
        var cause = ex.getCause();
        return (cause != null ? cause : ex).getClass().getSimpleName();
      })
      .thenApply(code -> {
        var time = (System.currentTimeMillis() - startTime);
        System.out.println("URL " + url + " -- Code: " + code + " -- Request Time: " + time + "ms");
        return new AbstractMap.SimpleEntry<>(code, time);
      })
      .join();
  }

  public static void main(String[] args) throws IOException {
    long start = System.currentTimeMillis();

    System.out.println("Starting");
    System.out.println(" * LIMIT: " + LIMIT);
    System.out.println(" * CONCURRENCY: " + CONCURRENCY);

    var executor = Executors.newFixedThreadPool(CONCURRENCY);

    var futures = Files.lines(Path.of(FILE_PATH))
      .limit(LIMIT)
      .map(url -> CompletableFuture.supplyAsync(() -> makeRequest(url), executor))
      .toList();

    var results = futures.stream()
      .map(CompletableFuture::join)
      .toList();

    executor.shutdown();

    var aggregates = results.stream()
      .collect(Collectors.groupingByConcurrent(AbstractMap.SimpleEntry::getKey, Collectors.counting()))
      .entrySet()
      .stream()
      .sorted(Map.Entry.comparingByValue(Comparator.reverseOrder()))
      .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue, (e1, e2) -> e1, LinkedHashMap::new));

    var times = results.stream()
      .map(AbstractMap.SimpleEntry::getValue)
      .sorted()
      .toList();

    var avgTime = times.stream()
      .mapToDouble(Long::doubleValue)
      .average()
      .orElse(0);

    var medianTime = times.get(times.size() / 2);
    var maxTime = times.stream()
      .max(Long::compareTo)
      .orElse(0L);

    var totalTime = (System.currentTimeMillis() - start) / 1000;
    var totalUrls = aggregates.values().stream().mapToLong(Long::longValue).sum();

    System.out.println("Total time: " + totalTime + "s");
    System.out.println("Average time: " + avgTime);
    System.out.println("Median time: " + medianTime);
    System.out.println("Max time: " + maxTime);
    System.out.println("Total URLs: " + totalUrls);

    for (Map.Entry<String, Long> entry : aggregates.entrySet()) {
      System.out.println(entry.getKey() + ": " + entry.getValue());
    }
  }
}
