// use futures::prelude::*;
use napi_derive::napi;
use reqwest;
use reqwest::header::USER_AGENT;
use std::time::Duration;

#[napi(constructor)]
pub struct Response {
    pub code: u16,
    pub body: String,
    pub total_time: i64,
}

#[napi(object)]
pub struct FetchOptions {
    pub user_agent: Option<String>,
}

#[napi]
async fn fetch_url(url: String, opts: Option<FetchOptions>) -> Response {
    let start = std::time::Instant::now();
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .unwrap();

    let mut request = client.get(&url);

    if let Some(opts) = opts {
        if let Some(user_agent) = opts.user_agent {
            request = request.header(USER_AGENT, user_agent);
        }
    }

    let response = request.send().await;

    let total_time = start.elapsed().as_millis() as i64;

    match response {
        Ok(response) => {
            let code = response.status().as_u16();
            let body = response.text().await.unwrap();
            Response { code, body, total_time }
        }
        Err(err) => {
            Response { code: 1000, body: err.to_string(), total_time }
        }
    }
}
