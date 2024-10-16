import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.*;
import java.util.function.BiConsumer;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URI;

class Main {
  private static final String UserAgent = System.getenv().getOrDefault("USER_AGENT", "java-http-client");
  private static final Integer CONCURRENCY = getEnv("CONCURRENCY", 10);
  private static final Integer RequestTimeout = getEnv("REQUEST_TIMEOUT", 5);
  private static final Semaphore semaphore = new Semaphore(CONCURRENCY);

  private static final HttpClient CLIENT = HttpClient.newBuilder()
    .followRedirects(HttpClient.Redirect.ALWAYS)
    .version(HttpClient.Version.HTTP_1_1)
    .build();

  private static HttpRequest buildHttpRequest(String url) {
    return HttpRequest.newBuilder()
      .uri(URI.create(url))
      .header("User-Agent", UserAgent)
      .header("Accept-Encoding", "gzip, deflate, br")
      .GET()
      .build();
  }

  private static Integer getEnv(String variableName, Integer defaultValue) {
    String value = System.getenv(variableName);
    return value != null ? Integer.parseInt(value) : defaultValue;
  }

  public static CompletableFuture<Void> makeRequest(String url) {
    var startTime = Instant.now();

    BiConsumer<String, Integer> onComplete = (code, bodyLength) -> {
      var duration = Duration.between(startTime, Instant.now()).toMillis();
      System.out.println(url + "," + code + "," + startTime + "," + duration + "," + bodyLength);
    };

    try {
      semaphore.acquire();
    } catch (InterruptedException e) {
      onComplete.accept("InterruptedException", 0);
      return CompletableFuture.completedFuture(null);
    }

    return CLIENT.sendAsync(buildHttpRequest(url), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8))
      .orTimeout(RequestTimeout, TimeUnit.SECONDS)
      .thenAccept(response -> {
        var bodyLength = response.body().length();
        var code = Integer.toString(response.statusCode());
        onComplete.accept(code, bodyLength);
      })
      .exceptionally(ex -> {
        var cause = ex.getCause();
        var code = (cause != null ? cause : ex).getClass().getSimpleName();
        onComplete.accept(code, 0);
        return null;
      })
      .whenComplete((_, _) -> semaphore.release());
  }

  public static void main(String[] args) {
    BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));

    var futures = reader.lines()
      .map(Main::makeRequest)
      .toList();

    CompletableFuture.allOf(futures.toArray(CompletableFuture[]::new)).join();
  }
}
