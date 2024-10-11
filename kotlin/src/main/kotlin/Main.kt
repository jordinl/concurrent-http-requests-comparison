import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.io.File
import java.net.URI
import java.time.Duration
import java.time.Instant
import java.util.concurrent.*

private val CONCURRENCY = System.getenv("CONCURRENCY")?.toIntOrNull() ?: 10
private val LIMIT = System.getenv("LIMIT")?.toIntOrNull() ?: 1000
private val DATA_DIR = System.getenv("DATA_DIR") ?: "../data"
private val client = HttpClient.newBuilder()
  .followRedirects(HttpClient.Redirect.ALWAYS)
  .version(HttpClient.Version.HTTP_1_1)
  .build()

private val RequestBuilder = HttpRequest.newBuilder()
  .header("User-Agent", "crawler-test")
  .header("Accept-Encoding", "gzip, deflate, br")
  .GET()

data class Result(val code: String, val time: Long)

fun main() {
  val start = Instant.now()

  println("Starting crawl:")
  println(" * CONCURRENCY: $CONCURRENCY")
  println(" * LIMIT: $LIMIT")

  val urls = File("$DATA_DIR/urls.txt").readLines().take(LIMIT)

  val executor = Executors.newFixedThreadPool(CONCURRENCY)

  val futures : List<CompletableFuture<Result>> = urls.map { url ->
    CompletableFuture.supplyAsync({
      val startTime = Instant.now()

      client.sendAsync(RequestBuilder.uri(URI.create(url)).build(), HttpResponse.BodyHandlers.ofString())
        .orTimeout(5, TimeUnit.SECONDS)
        .thenApply { response ->
          if (response.statusCode() in 200 until 300) {
            val body = response.body()?.replace("\u0000", "")
          }
          response.statusCode().toString()
        }
        .exceptionally { ex -> (ex.cause ?: ex).javaClass.simpleName }
        .thenApply { code ->
          val time = Duration.between(startTime, Instant.now()).toMillis()
          println("$url $code -- $time ms")
          Result(code, time)
        }
        .join()
    }, executor)
  }

  var results = futures.map { it.join() }
  val aggregates = results.groupBy({ it.code }, { it.time }).mapValues { it.value.count() }
  val avgTime = results.map { it.time }.average()
  val medianTime = results.sortedBy { it.time }[results.size / 2].time

  println("Total time: ${Duration.between(start, Instant.now()).seconds}s")
  println("Average time: $avgTime")
  println("Median time: $medianTime")
  println("Total URLs: ${results.size}")

  aggregates.entries.sortedByDescending { it.value }.forEach { (code, count) ->
    println("$code: $count")
  }

  executor.shutdown()
}
