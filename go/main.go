package main

import (
  "bufio"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"
)

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

func makeRequest(url string, headers map[string]string, timeout time.Duration) {
	start := time.Now()

	onComplete := func(code string, rest ...int) {
		bodyLength := 0
		if len(rest) > 0 {
			bodyLength = rest[0]
		}
		duration := time.Since(start).Milliseconds()
		fmt.Printf("%s,%s,%s,%d,%d\n", url, code, start.Format(time.RFC3339), duration, bodyLength)
	}

	client := &http.Client{
		Timeout: timeout,
	}

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		onComplete("REQUEST_ERROR")
		return
	}

	for key, value := range headers {
		req.Header.Set(key, value)
	}

	resp, err := client.Do(req)
	if err != nil {
		urlError := errors.Unwrap(err)
		code := fmt.Sprintf("%T", urlError)
		onComplete(code)
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		onComplete("READ_BODY_ERROR")
		return
	}

	onComplete(strconv.Itoa(resp.StatusCode), len(body))
}

func main() {
	concurrency := getEnv("CONCURRENCY", 10)
	requestTimeout := getEnv("REQUEST_TIMEOUT", 5)

	semaphore := make(chan struct{}, concurrency)

	scanner := bufio.NewScanner(os.Stdin)

	var wg sync.WaitGroup
	for scanner.Scan() {
		url := scanner.Text()
		semaphore <- struct{}{}
		wg.Add(1)
		go func(url string) {
			defer wg.Done()
			defer func() { <-semaphore }()
			makeRequest(url, Headers, time.Duration(requestTimeout)*time.Second)
		}(url)
	}

	wg.Wait()
	close(semaphore)
}
