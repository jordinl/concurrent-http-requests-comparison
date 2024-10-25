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

func getEnv(key string, fallback string) string {
	value, exists := os.LookupEnv(key)
	if !exists {
		return fallback
	}
	return value
}

func getEnvInt(key string, fallback int) int {
	strValue := getEnv(key, strconv.Itoa(fallback))
	value, err := strconv.Atoi(strValue)
	if err != nil {
		return fallback
	}
	return value
}

var concurrency = getEnvInt("CONCURRENCY", 10)
var requestTimeout = getEnvInt("REQUEST_TIMEOUT", 5)
var userAgent = getEnv("USER_AGENT", "go-http")
var transport = &http.Transport{
	DisableKeepAlives: true,
}
var client = &http.Client{
	Timeout:   time.Duration(requestTimeout) * time.Second,
	Transport: transport,
}

var Headers = map[string]string{
	"User-Agent": userAgent,
}

func makeRequest(url string) {
	start := time.Now()

	onComplete := func(code string, rest ...int) {
		bodyLength := 0
		if len(rest) > 0 {
			bodyLength = rest[0]
		}
		duration := time.Since(start).Milliseconds()
		fmt.Printf("%s,%s,%s,%d,%d\n", url, code, start.Format(time.RFC3339), duration, bodyLength)
	}

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		onComplete("REQUEST_ERROR")
		return
	}

	for key, value := range Headers {
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
			makeRequest(url)
		}(url)
	}

	wg.Wait()
	close(semaphore)
}
