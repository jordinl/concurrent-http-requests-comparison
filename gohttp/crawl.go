package main

import (
    "bufio"
    "errors"
    "fmt"
    "net/http"
    "os"
    "strconv"
    "sort"
    "sync"
    "time"
)

type result struct {
    code     string
    duration time.Duration
}

type aggregate struct {
    code  string
    count int
}

func getEnv(key string, fallback int) int {
    value, exists := os.LookupEnv(key)
    if !exists {
        return fallback
    }
    intVal, err := strconv.Atoi(value)
    if err != nil {
        return fallback
    }
    return intVal
}

func readUrls() ([]string) {
    filePath := "data/top-1000.txt"
    if len(os.Args) > 1 {
        filePath = os.Args[1]
    }

    fmt.Printf(" * File: %s\n\n", filePath)

    file, err := os.Open(filePath)
    if err != nil {
        panic(err)
    }
    defer file.Close()

    var urls []string
    scanner := bufio.NewScanner(file)
    for scanner.Scan() {
        urls = append(urls, scanner.Text())
    }

    if err := scanner.Err(); err != nil {
        panic(err)
    }

    return urls
}

func makeRequest(url string, headers map[string]string, timeout time.Duration) result {
    start := time.Now()

    client := &http.Client{
        Timeout: timeout,
    }

    req, err := http.NewRequest("GET", url, nil)
    if err != nil {
        return result{code: "REQUEST_ERROR", duration: time.Since(start)}
    }

    for key, value := range headers {
        req.Header.Set(key, value)
    }

    resp, err := client.Do(req)
    if err != nil {
        urlError := errors.Unwrap(err)
        code := fmt.Sprintf("%T", urlError)
        return result{code: code, duration: time.Since(start)}
    }
    defer resp.Body.Close()

    return result{code: strconv.Itoa(resp.StatusCode), duration: time.Since(start)}
}


func main() {
    concurrency := getEnv("CONCURRENCY", 10)
    requestTimeout := getEnv("REQUEST_TIMEOUT", 5)

    headers := map[string]string{
        "User-Agent":      "crawler-test",
        "Accept-Encoding": "gzip, deflate, br",
    }

    fmt.Printf(" Starting crawl:\n")
    fmt.Printf(" * Concurrency: %d\n", concurrency)
    fmt.Printf(" * Request timeout: %d\n", requestTimeout)

    urls := readUrls()

    start := time.Now()

    semaphoreChan := make(chan struct{}, concurrency)
    resultsCh := make(chan result, len(urls))

    var wg sync.WaitGroup
    for _, url := range urls {
        semaphoreChan <- struct{}{}
        wg.Add(1)
        go func(url string) {
            defer wg.Done()
            result := makeRequest(url, headers, time.Duration(requestTimeout) * time.Second)
            resultsCh <- result
            fmt.Println(url, result.code, result.duration)
            <-semaphoreChan
        }(url)
    }

    wg.Wait()
    close(resultsCh)
    close(semaphoreChan)

    var results []result
    for res := range resultsCh {
        results = append(results, res)
    }

    aggregates := make(map[string]int)
    var totalTime time.Duration
    for _, res := range results {
        aggregates[res.code]++
        totalTime += res.duration
    }

    var sortedAggregates []aggregate
    for code, count := range aggregates {
        sortedAggregates = append(sortedAggregates, aggregate{code: code, count: count})
    }
    sort.Slice(sortedAggregates, func(i, j int) bool {
        return sortedAggregates[i].count > sortedAggregates[j].count
    })

    avgTime := totalTime / time.Duration(len(results))
    sort.Slice(results, func(i, j int) bool {
        return results[i].duration < results[j].duration
    })
    medianTime := results[len(results)/2].duration

    fmt.Printf("Total time: %.2fs\n", time.Since(start).Seconds())
    fmt.Printf("Average time: %v\n", avgTime)
    fmt.Printf("Median time: %v\n", medianTime)
    fmt.Printf("Total URLs: %d\n", len(results))

    for _, agg := range sortedAggregates {
        fmt.Printf("%s: %d\n", agg.code, agg.count)
    }
}
