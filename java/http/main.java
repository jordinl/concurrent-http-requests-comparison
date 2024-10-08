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
import java.time.Duration;

class Result {
  private String code;
  private long time;

  public Result(String code, long time) {
    this.code = code;
    this.time = time;
  }

  public String getCode() {
    return code;
  }

  public long getTime() {
    return time;
  }
}

class Main {
  private static final Integer LIMIT = getEnv("LIMIT", 1000);
  private static final Integer CONCURRENCY = getEnv("CONCURRENCY", 10);
  private static final Integer REQUEST_TIMEOUT = getEnv("REQUEST_TIMEOUT", 5);
  private static final String FILE_PATH = "/mnt/appdata/urls.txt";
  public static CountDownLatch latch = new CountDownLatch(LIMIT);
  public static Semaphore semaphore = new Semaphore(CONCURRENCY);

  private static final HttpClient CLIENT = HttpClient.newBuilder()
    .followRedirects(HttpClient.Redirect.ALWAYS)
    .version(HttpClient.Version.HTTP_1_1)
    .build();

  private static HttpRequest buildHttpRequest(String url) {
    return HttpRequest.newBuilder()
      .uri(URI.create(url))
      .header("User-Agent", "crawler-test")
      .header("Accept-Encoding", "gzip, deflate, br")
      .timeout(Duration.ofSeconds(REQUEST_TIMEOUT))
      .GET()
      .build();
  }

  private static Integer getEnv(String variableName, Integer defaultValue) {
    String value = System.getenv(variableName);
    return value != null ? Integer.parseInt(value) : defaultValue;
  }

  public static Result makeRequest(String url)  {
    long startTime = System.currentTimeMillis();
    String code = "";

    try {
      HttpRequest request = buildHttpRequest(url);
      var future = CLIENT.sendAsync(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
      HttpResponse<String> response = future.get(REQUEST_TIMEOUT, TimeUnit.SECONDS);
      String responseBody = response.body().replace("\0", "");
      code = Integer.toString(response.statusCode());
    } catch (Exception e) {
      var cause = e.getCause();
      code = (cause != null ? cause : e).getClass().getSimpleName();
    }

    long endTime = System.currentTimeMillis();
    long requestTime = endTime - startTime;
    System.out.println("URL " + url + " -- Code: " + code + " -- Request Time: " + requestTime + "ms");
    return new Result(code, requestTime);
  }

  public static void main(String[] args) throws IOException {
    long start = System.currentTimeMillis();

    System.out.println("Starting");
    System.out.println(" * LIMIT: " + LIMIT);
    System.out.println(" * CONCURRENCY: " + CONCURRENCY);
    System.out.println(" * REQUEST_TIMEOUT: " + REQUEST_TIMEOUT);

    var executor = Executors.newVirtualThreadPerTaskExecutor();

    var futures = Files.lines(Path.of(FILE_PATH))
      .limit(LIMIT)
      .map(url -> CompletableFuture.supplyAsync(() -> {
        try {
          semaphore.acquire();
          return makeRequest(url);
        } catch(InterruptedException e) {
          throw new CompletionException(e);
        } finally {
          semaphore.release();
        }
      }, executor))
      .toList();

    CompletableFuture.allOf(futures.toArray(CompletableFuture[]::new)).join();

    var results = futures.stream()
      .map(CompletableFuture::join)
      .toList();

    executor.shutdown();

    var aggregates = results.stream()
      .collect(Collectors.groupingByConcurrent(Result::getCode, Collectors.counting()))
      .entrySet()
      .stream()
      .sorted(Map.Entry.comparingByValue(Comparator.reverseOrder()))
      .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue, (e1, e2) -> e1, LinkedHashMap::new));

    double avgTime = results.stream()
      .mapToLong(Result::getTime)
      .average()
      .orElse(0);

    List<Long> times = results.stream()
      .map(Result::getTime)
      .sorted()
      .toList();

    long medianTime = times.get(times.size() / 2);
    long maxTime = times.stream()
      .max(Long::compareTo)
      .orElse(0L);

    long totalTime = (System.currentTimeMillis() - start) / 1000;
    long totalUrls = aggregates.values().stream().mapToLong(Long::longValue).sum();

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
