use futures::prelude::*;
use std::env;
use std::error::Error;
use std::io::{self, prelude::*};
use std::process;
use std::str::FromStr;
use std::time::{Duration};
use chrono::Utc;
use reqwest;
use reqwest::header::{HeaderMap, USER_AGENT};
use tokio;

fn get_env_or<T>(name: &str, default: T) -> T
where
    T: FromStr,
{
    env::var(name)
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(default)
}

async fn handle_response(response: reqwest::Response) -> (String, usize) {
    let code = response.status().as_str().to_string();
    match response.text().await {
        Ok(body) => (code, body.len()),
        Err(err) => handle_error(err).await,
    }
}

async fn handle_error(err: impl Error) -> (String, usize) {
    let mut last_err: &dyn Error = &err;
    while let Some(source) = last_err.source() {
        last_err = source;
    }
    let code = last_err.to_string()
        .split(":")
        .collect::<Vec<&str>>()
        .first()
        .unwrap()
        .to_string();

    (code, 0)
}

#[tokio::main]
async fn main() -> io::Result<()> {
    let request_timeout = get_env_or("REQUEST_TIMEOUT", 5);
    let concurrency = get_env_or("CONCURRENCY", 10);
    let user_agent = get_env_or("USER_AGENT", "reqwest-fetch".to_string());
    let stdin = io::stdin();
    let reader = stdin.lock();
    let mut default_headers = HeaderMap::new();
    default_headers.insert(USER_AGENT, user_agent.parse().unwrap());

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(request_timeout as u64))
        .default_headers(default_headers)
        .build()
        .unwrap();

    stream::iter(reader.lines())
        .map(|line| {
            let client = client.clone();
            async move {
                let start = Utc::now();
                let url = line.unwrap();

                let response = client.get(&url)
                    .send()
                    .await;

                let (code, body_length) = match response {
                    Ok(response) => handle_response(response).await,
                    Err(err) => handle_error(err).await,
                };

                let duration = (Utc::now() - start).num_milliseconds();

                println!("{},{},{},{},{}", url, code, start.to_rfc3339(), duration, body_length);
            }
        })
        .buffer_unordered(concurrency as usize)
        .collect::<Vec<()>>()
        .await;

    process::exit(0);
}
