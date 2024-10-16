import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.net.URI
import java.time.Duration
import java.time.Instant
import java.util.concurrent.*

private val Concurrency = System.getenv("CONCURRENCY")?.toIntOrNull() ?: 10
private val UserAgent = System.getenv("USER_AGENT")?.toString() ?: "kotlin-http-client"
private val RequestTimeout = System.getenv("REQUEST_TIMEOUT")?.toLongOrNull() ?: 5
private val client = HttpClient.newBuilder()
  .followRedirects(HttpClient.Redirect.ALWAYS)
  .version(HttpClient.Version.HTTP_1_1)
  .build()

private val RequestBuilder = HttpRequest.newBuilder()
  .header("User-Agent", UserAgent)
  .header("Accept-Encoding", "gzip, deflate, br")
  .GET()

private val semaphore = Semaphore(Concurrency)

private fun makeRequest(url: String): CompletableFuture<Unit> {
  semaphore.acquire()
  val startTime = Instant.now()

  fun onComplete(code: String, bodyLength: Int = 0) {
    val duration = Duration.between(startTime, Instant.now()).toMillis()
    println("$url,$code,$startTime,$duration,$bodyLength")
  }

  return client.sendAsync(RequestBuilder.uri(URI.create(url)).build(), HttpResponse.BodyHandlers.ofString())
    .orTimeout(RequestTimeout, TimeUnit.SECONDS)
    .thenApply { response ->
      val code = response.statusCode().toString();
      val bodyLength = response.body()?.length ?: 0
      onComplete(code, bodyLength)
    }
    .exceptionally { ex ->
      val code = (ex.cause ?: ex).javaClass.simpleName
      onComplete(code)
    }
    .whenComplete { _, _ -> semaphore.release() }
}

fun main() {
  val urls = generateSequence(::readLine)
  val futures = urls.map { makeRequest(it) }
  CompletableFuture.allOf(*futures.toList().toTypedArray()).join()
}
