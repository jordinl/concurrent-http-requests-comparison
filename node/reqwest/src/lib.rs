use napi_derive::napi;
use reqwest;
use std::collections::HashMap;
use std::time::Duration;
use std::error::Error;

#[napi(constructor)]
pub struct Response {
    pub code: String,
    pub body: Option<String>,
}

#[napi(object)]
pub struct RequestOptions {
    pub headers: Option<HashMap<String, String>>,
    pub timeout: Option<u32>,
}

async fn handle_response(response: reqwest::Response) -> Response {
    let code = response.status().as_str().to_string();
    match response.text().await {
        Ok(body) => Response { code, body: Some(body) },
        Err(err) => handle_error(err).await,
    }
}

async fn handle_error(err: impl Error) -> Response {
    let mut last_err: &dyn Error = &err;
    while let Some(source) = last_err.source() {
        last_err = source;
    }
    let code = last_err.to_string().split(":").next().unwrap_or("").to_string();
    Response { code, body: None }
}

#[napi]
async fn fetch_url(url: String, opts: Option<RequestOptions>) -> Response {
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
        Err(err) => handle_error(err).await,
    }
}
