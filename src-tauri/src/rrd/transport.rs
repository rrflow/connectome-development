use url::{Host, Url};

fn is_loopback(host: Host<&str>) -> bool {
    match host {
        Host::Domain(host) => host.eq_ignore_ascii_case("localhost"),
        Host::Ipv4(address) => address.is_loopback(),
        Host::Ipv6(address) => address.is_loopback(),
    }
}

pub(super) fn is_loopback_origin(url: &Url) -> bool {
    url.host().is_some_and(is_loopback)
}

pub(super) fn rrd_origin(endpoint: &str) -> Result<Url, String> {
    let url = Url::parse(endpoint).map_err(|error| format!("invalid RRD endpoint: {error}"))?;
    if !matches!(url.scheme(), "http" | "https")
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || url.path() != "/"
    {
        return Err("RRD endpoint must be a credential-free HTTP(S) origin".into());
    }
    let host = url
        .host()
        .ok_or_else(|| "RRD endpoint has no host".to_owned())?;
    if url.scheme() == "http" && !is_loopback(host) {
        return Err("remote RRD endpoints require HTTPS".into());
    }

    Ok(url)
}

pub(super) fn public_rrd_url(endpoint: &str, path: &str) -> Result<Url, String> {
    // Every path here is a public, read-only engine operation; the operation
    // catalogue carries the reference text the API reference shows.
    if !matches!(
        path,
        "/v1/health/live" | "/v1/health/ready" | "/v1/capabilities" | "/v1/schema/endpoints"
    ) {
        return Err("RRD request is outside the public bootstrap allowlist".into());
    }

    let mut url = rrd_origin(endpoint)?;
    url.set_path(path);
    Ok(url)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bootstrap_transport_allows_only_public_rrd_gets() {
        assert!(public_rrd_url("http://127.0.0.1:9477", "/v1/health/live").is_ok());
        assert!(public_rrd_url("http://localhost:9477", "/v1/health/ready").is_ok());
        assert!(public_rrd_url("https://runtime.example.com", "/v1/capabilities").is_ok());
        assert!(public_rrd_url("http://runtime.example.com", "/v1/capabilities").is_err());
        assert!(public_rrd_url("https://runtime.example.com/path", "/v1/capabilities").is_err());
        assert!(public_rrd_url("https://user@runtime.example.com", "/v1/capabilities").is_err());
        assert!(public_rrd_url("http://127.0.0.1:9477", "/v1/context/assemble").is_err());
        assert!(public_rrd_url("http://127.0.0.1:9477", "/v1/schema/endpoints").is_ok());
        // The OpenAPI document stays out: the catalogue carries the reference text.
        assert!(public_rrd_url("http://127.0.0.1:9477", "/v1/schema/openapi").is_err());
    }

    #[test]
    fn every_allowed_public_path_is_a_public_read_only_engine_operation() {
        let catalogue = rrd_contract::endpoint_catalogue();
        for path in [
            "/v1/health/live",
            "/v1/health/ready",
            "/v1/capabilities",
            "/v1/schema/endpoints",
        ] {
            assert!(public_rrd_url("http://127.0.0.1:9477", path).is_ok());
            let descriptor = catalogue
                .resolve_http(rrd_contract::HttpMethod::Get, path)
                .unwrap_or_else(|| panic!("{path} is a catalogued GET operation"));
            assert_eq!(
                descriptor.authentication,
                rrd_contract::EndpointAuthentication::Public
            );
            assert!(!descriptor.mutation);
        }
    }
}
