use std::time::{Duration, SystemTime};
use std::fs::File;
use std::env;
use std::io::{self, prelude::*, BufReader};
use reqwest;
use reqwest::header::USER_AGENT;
use tokio;
use futures::prelude::*;
use std::collections::HashMap;

struct Result {
    code: String,
    time: Duration
}


fn get_env(key: &str, default: u16) -> u16 {
    env::var(key)
        .ok()
        .and_then(|limit| limit.parse::<u16>().ok())
        .unwrap_or(default)
}

#[tokio::main]
async fn main() -> io::Result<()> {
    let url_limit = get_env("LIMIT", 1000);
    let request_timeout = get_env("REQUEST_TIMEOUT", 5);
    let concurrency = get_env("CONCURRENCY", 10);

    println!("Starting crawl:");
    println!(" * {}: {:?}", "URL_LIMIT", url_limit);
    println!(" * {}: {:?}", "REQUEST_TIMEOUT", request_timeout);
    println!(" * {}: {:?}", "CONCURRENCY", concurrency);

    let time = SystemTime::now();

    let file = File::open("data/urls.txt")?;
    let reader = BufReader::new(file);

    let results = stream::iter(reader.lines().take(url_limit as usize))
        .map(|line| {
            async move {
                let start = SystemTime::now();
                let url = line.unwrap();

                let client = reqwest::Client::builder()
                    .timeout(Duration::from_secs(request_timeout as u64))
                    .build()
                    .unwrap();

                let response = client.get(&url)
                    .header(USER_AGENT, "crawler-test")
                    .header("Accept-Encoding", "gzip, deflate, br")
                    .send()
                    .await;

                match response {
                    Ok(response) => {
                        let time = start.elapsed().unwrap();
                        println!("{}: {} -- {:?}", url, response.status(), time);
                        Result {
                            code: response.status().to_string(),
                            time
                        }
                    }
                    Err(err) => {
                        let time = start.elapsed().unwrap();
                        println!("{}: {} -- {:?}", url, err, time);
                        Result {
                            code: err.without_url().to_string(),
                            time
                        }
                    }
                }
            }
        })
        .buffer_unordered(concurrency as usize)
        .collect::<Vec<Result>>()
        .await;


    let aggregates = results.iter().fold(HashMap::new(), |mut acc, result| {
        *acc.entry(result.code.clone()).or_insert(0) += 1;
        acc
    });

    let mut sorted_aggregates = aggregates.iter().collect::<Vec<(&String, &u16)>>();

    sorted_aggregates.sort_by(|a, b| b.1.cmp(&a.1));

    for (code, count) in &mut sorted_aggregates {
        println!("{}: {}", code, count);
    }

    let total_time = time.elapsed().unwrap();
    let total_urls = aggregates.values().sum::<u16>();
    let mut sorted_times = results.iter().map(|result| result.time).collect::<Vec<Duration>>();
    sorted_times.sort_by(|a, b| b.cmp(a));
    let avg_time = sorted_times.iter().sum::<Duration>() / total_urls as u32;
    let median_time = sorted_times[sorted_times.len() / 2];

    println!("Total time: {:?}", total_time);
    println!("Total URLs: {:?}", total_urls);
    println!("Average time: {:?}", avg_time);
    println!("Median time: {:?}", median_time);

    Ok(())
}