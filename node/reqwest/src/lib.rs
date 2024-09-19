use napi_derive::napi;
use napi::Result;
use reqwest;
use std::collections::HashMap;
use std::time::Duration;
use std::error::Error;
use regex::Regex;

#[napi(constructor)]
pub struct Response {
    pub status: u16,
    pub body: Option<String>,
    pub url: String,
    pub headers: HashMap<String, String>
}

#[napi(object)]
pub struct RequestOptions {
    pub headers: Option<HashMap<String, String>>,
    pub timeout: Option<u32>,
}

async fn handle_response(response: reqwest::Response) -> Result<Response> {
    let status = response.status().as_u16();
    let url = response.url().to_string();
    let headers = response.headers()
                          .iter()
                          .map(|(name, value)| {
                              (name.to_string(), value.to_str().unwrap_or("").to_string())
                          })
                          .collect();
    match response.text().await {
        Ok(body) => Ok(Response { status, url, headers, body: Some(body) }),
        Err(err) => Err(handle_error(err)),
    }
}

fn handle_error(err: impl Error) -> napi::Error {
    let mut last_err: &dyn Error = &err;
    while let Some(source) = last_err.source() {
        last_err = source;
    }
    let re = Regex::new(r":|\(").unwrap();
    let message = re.split(last_err.to_string().as_str())
                    .next()
                    .unwrap_or("")
                    .trim()
                    .to_lowercase()
                    .to_string();

    napi::Error::new(napi::Status::GenericFailure, message)
}

#[napi]
async fn fetch(url: String, opts: Option<RequestOptions>) -> Result<Response> {
    let client = reqwest::Client::builder()
        .build()
        .unwrap();

    let mut request = client.get(&url);

    if let Some(opts) = opts {
        if let Some(timeout) = opts.timeout {
            request = request.timeout(Duration::from_millis(timeout as u64));
        }
        if let Some(headers) = opts.headers {
            for (key, value) in headers {
                request = request.header(key, value);
            }
        }
    }

    match request.send().await {
        Ok(response) => handle_response(response).await,
        Err(err) => Err(handle_error(err)),
    }
}
