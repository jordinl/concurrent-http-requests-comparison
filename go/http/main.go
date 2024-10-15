package main

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"strconv"
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

var Headers = map[string]string{
	"User-Agent":      "crawler-test",
	"Accept-Encoding": "gzip, deflate, br",
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

func makeRequest(url string, headers map[string]string, timeout time.Duration) result {
	start := time.Now()

	onError := func(code string) result {
		duration := time.Since(start).Round(time.Millisecond)
		fmt.Printf("\033[31m[%s] %s: %s\n", code, url, duration)
		return result{code: "Exception", duration: duration}
	}

	onSuccess := func(status int, bodyLength int) result {
		duration := time.Since(start).Round(time.Millisecond)
		code := fmt.Sprintf("%dxx", status/100)
		var color string
		if status < 300 {
			color = "\033[32m"
		} else {
			color = "\033[33m"
		}
		fmt.Printf("%s[%d] %s: %s / %d\n", color, status, url, duration, bodyLength)
		return result{code: code, duration: duration}
	}

	client := &http.Client{
		Timeout: timeout,
	}

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return onError("REQUEST_ERROR")
	}

	for key, value := range headers {
		req.Header.Set(key, value)
	}

	resp, err := client.Do(req)
	if err != nil {
		urlError := errors.Unwrap(err)
		code := fmt.Sprintf("%T", urlError)
		return onError(code)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return onError("READ_BODY_ERROR")
	}

	bodyLength := len(body)

	return onSuccess(resp.StatusCode, bodyLength)
}

func main() {
	concurrency := getEnv("CONCURRENCY", 10)
	requestTimeout := getEnv("REQUEST_TIMEOUT", 5)
	urlLimit := getEnv("LIMIT", 1000)

	file, err := os.Open("/mnt/appdata/urls.txt")
	if err != nil {
		panic(err)
	}
	defer file.Close()

	fmt.Printf(" Starting index.:\n")
	fmt.Printf(" * CONCURRENCY: %d\n", concurrency)
	fmt.Printf(" * REQUEST_TIMEOUT: %d\n", requestTimeout)
	fmt.Printf(" * LIMIT: %d\n", urlLimit)

	urlScanner := bufio.NewScanner(file)

	count := 0

	start := time.Now()

	semaphore := make(chan struct{}, concurrency)
	resultsCh := make(chan result, urlLimit)

	var wg sync.WaitGroup
	for urlScanner.Scan() {
		url := urlScanner.Text()
		semaphore <- struct{}{}
		wg.Add(1)
		go func(url string) {
			defer wg.Done()
			defer func() { <-semaphore }()
			resultsCh <- makeRequest(url, Headers, time.Duration(requestTimeout)*time.Second)
		}(url)
		count++
		if count >= urlLimit {
			break
		}
	}

	wg.Wait()
	close(resultsCh)
	close(semaphore)

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
