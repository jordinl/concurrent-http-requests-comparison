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

fun main() {
  val start = Instant.now()

  println("Starting crawl:")
  println(" * CONCURRENCY: $CONCURRENCY")
  println(" * LIMIT: $LIMIT")

  val urls = File("$DATA_DIR/urls.txt").readLines().take(LIMIT)

  val results = ConcurrentLinkedQueue<Pair<String, Int>>()
  val executor = Executors.newFixedThreadPool(CONCURRENCY)

  val futures = urls.map { url ->
    executor.submit {
      val startTime = Instant.now()

      val request = RequestBuilder.uri(URI.create(url)).build()

      try {
        val future = client.sendAsync(request, HttpResponse.BodyHandlers.ofString())
        val response = future.get(5, TimeUnit.SECONDS)
        val code = response.statusCode().toString()
        val time = Duration.between(startTime, Instant.now()).toMillis().toInt()
        println("$url $code -- $time ms")
        if (response.statusCode() in 200 until 300) {
          val body = response.body()?.replace("\u0000", "")
        }
        results.add(code to time)
      } catch (ex: Exception) {
        val time = Duration.between(startTime, Instant.now()).toMillis().toInt()
        val code = (ex.cause ?: ex).javaClass.simpleName
        System.err.println("$url: $code -- ${time}ms")
        results.add(code to time)
      }
    }
  }

  futures.forEach { it.get() }
  executor.shutdown()

  val aggregates = results.groupBy({ it.first }, { it.second }).mapValues { it.value.count() }
  val avgTime = results.map { it.second }.average()
  val medianTime = results.sortedBy { it.second }[results.size / 2].second

  println("Total time: ${Duration.between(start, Instant.now()).seconds}s")
  println("Average time: $avgTime")
  println("Median time: $medianTime")
  println("Total URLs: ${results.size}")

  aggregates.entries.sortedByDescending { it.value }.forEach { (code, count) ->
    println("$code: $count")
  }
}
