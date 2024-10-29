## Languages / runtimes

### Bun

[lib/bun/main.js](lib/bun/main.js) Use built-in `fetch`. Unfortunately I'm getting a segmentation fault when running it with the 10K URLs. It also fails the Edward Snowden test https://github.com/oven-sh/bun/issues/14560.

### Deno

[deno/main.js](lib/deno/main.js): Use built-in `HttpClient.fetch`. It's really fast, it uses rust internally. Had to disable connection pooling to fix memory issues, although it only happens with more than 10K URLs.

### .NET

[lib/dotnet/main.cs](lib/dotnet/main.cs): Use built-in `HttpClient`. Was honestly expecting more, considering some people like to say it can be as fast as Rust, not this time I guess. It's just barely faster than Python and Ruby. It also does not follow https to http redirects and there's no way to turn this behavior off also, in my opinion, if something is not allowed, the result should be to raise an exception not to return 301.

### Go

[lib/go/main.go](lib/go/main.go): Use built-in `net/http`. One of the best performing, quite verbose and I find it hard to read, but doesn't need to install external dependencies.

### Java

[lib/java/main.java](lib/java/main.java): Use built-in `HttpClient`. One of the slowest, performance is also quite variable although always slow, while the rest of the clients are quite consistent. Tried using virtual thread pool, fixed thread pool, although `HttpClient` internally uses a cached thread pool and performance was similar with the other two options. I also tried [OkHttp](https://square.github.io/okhttp/) and [Apache HttpClient](https://hc.apache.org/httpcomponents-client-5.4.x/index.html), which weren't any faster.

### Node.js

* [lib/node/fetch/main.js](lib/node/fetch/main.js): The slowest. Internally it uses [undici](https://github.com/nodejs/undici).
* [lib/node/reqwest/main.js](lib/node/reqwest/main.js): Wrote a wrapper around Rust's [reqwest](https://docs.rs/reqwest/latest/reqwest/) using [napi-rs](https://napi.rs/). Performance is one of the best.
* [lib/node/undici/main.js](lib/node/undici/main.js): Use [undici](https://github.com/nodejs/undici) `request`, which should be significantly faster than `fetch` in theory. Although in reality it's only about 10% faster. The documentation is not great and it was hard to find how to automatically follow redirects.

### Python

[lib/python/aiohttp/main.py](lib/python/aiohttp/main.py): Use [aiohttp](https://docs.aiohttp.org/en/stable/), there's no built-in way of doing this with Python. This seems to be the most recommended way of performing asynchronous HTTP requests in Python. Performance is similar to .NET and Ruby.

### Ruby


[lib/ruby/async/main.rb](lib/ruby/async/main.rb): Use [async](https://github.com/socketry/async) with [http.rb](https://github.com/httprb/http), there's no built-in way of doing this with Ruby. Wasn't expecting much from Ruby, considering many people keep saying it's slow, but in this case it performed like .NET and faster than Node.js and Java. The default HTTP client provided by `async` does not automatically follow redirects, so I had to use `http.rb`. Tried a few other options that can handle parallel requests, but they were slower:
* [faraday](https://github.com/lostisland/faraday) with `hydra`.
* [async-http-faraday](https://github.com/socketry/async-http-faraday): this is a faraday adapter provided by `async`.
* [curb](https://github.com/taf2/curb) with `async`.
  
### Rust

[lib/rust/reqwest/src/main.rs](lib/rust/reqwest/src/main.rs): Use [reqwest](https://docs.rs/reqwest/latest/reqwest/). This requires installing a few third party dependencies: reqwest, tokio and futures. It wasn't that difficult to get it working and I find the code to be more readable than go. It's the best performing.

## Results

```
┌──────────┬─────────────────┬─────────────┬───────────┬────────┬──────┬──────┬───────────┬───────────┬────────────┬──────┬─────┬──────┬─────┬───────────┐
│ language │ method          │ concurrency │ totalUrls │ time   │ avg  │ max  │ okReqsSec │ okReqsPct │ avgBodyLen │ 2xx  │ 3xx │ 4xx  │ 5xx │ Exception │
├──────────┼─────────────────┼─────────────┼───────────┼────────┼──────┼──────┼───────────┼───────────┼────────────┼──────┼─────┼──────┼─────┼───────────┤
│ Rust     │ reqwest         │         150 │     10000 │  49149 │  680 │ 5018 │       162 │       0.8 │     256487 │ 7980 │   1 │  971 │  21 │      1027 │
│ Deno     │ fetch           │         150 │     10000 │  58016 │  813 │ 5101 │       138 │       0.8 │     258782 │ 8007 │   1 │  952 │  25 │      1015 │
│ Go       │ net/http        │         125 │     10000 │  64000 │  763 │ 5067 │       125 │       0.8 │     260033 │ 8004 │   1 │  970 │  21 │      1004 │
│ Node.js  │ reqwest (Rust)  │         125 │     10000 │  71716 │  854 │ 5568 │       112 │       0.8 │     258417 │ 8000 │   1 │  964 │  22 │      1013 │
│ .NET     │ HttpClient      │          75 │     10000 │ 106468 │  766 │ 6479 │        73 │      0.77 │     258980 │ 7739 │ 279 │  977 │  24 │       981 │
│ Ruby     │ async + http.rb │          75 │     10000 │ 107077 │  683 │ 8003 │        74 │       0.8 │     257226 │ 7977 │   0 │  992 │  25 │      1006 │
│ Python   │ aiohttp         │          75 │     10000 │ 108243 │  769 │ 6082 │        73 │      0.79 │     259900 │ 7943 │   0 │  979 │  27 │      1051 │
│ Java     │ HttpClient      │          50 │     10000 │ 172855 │  862 │ 5362 │        45 │      0.79 │     238532 │ 7853 │  37 │ 1010 │  24 │      1076 │
│ Node.js  │ undici request  │          50 │     10000 │ 192018 │  950 │ 8611 │        41 │      0.79 │     254941 │ 7865 │  26 │ 1003 │  23 │      1083 │
│ Node.js  │ fetch           │          50 │     10000 │ 209810 │ 1036 │ 5125 │        38 │      0.79 │     259108 │ 7885 │   1 │  997 │  26 │      1091 │
└──────────┴─────────────────┴─────────────┴───────────┴────────┴──────┴──────┴───────────┴───────────┴────────────┴──────┴─────┴──────┴─────┴───────────┘
```
<p align="center"><sup>times are in milliseconds</sup></p>
