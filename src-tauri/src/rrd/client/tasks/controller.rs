//! Projections of the configured engine controller; no connection or policy authority.
use super::*;
use rrd_contract::EndpointControllerProtocol;

/// Leave time for engine admission/publication in addition to the provider timeout.
/// Refuse a duration the granted session cannot cover; never silently shorten it.
pub(super) fn controller_timeout(
    configuration: &EndpointConfiguration,
) -> Result<Duration, RrdError> {
    let profile = configuration
        .profile
        .as_ref()
        .ok_or("No endpoint profile is configured")?;
    let policy = profile
        .selection_policy
        .as_ref()
        .ok_or("No controller policy is configured")?;
    let binding = profile
        .bindings
        .iter()
        .find(|b| b.id == policy.controller_binding_id)
        .ok_or("Configured controller binding is absent")?;
    Duration::from_millis(binding.limits.timeout_ms)
        .checked_add(REQUEST_TIMEOUT)
        .ok_or_else(|| "Controller timeout exceeds the native clock".into())
}

pub(super) fn controller_protocol(protocol: &EndpointControllerProtocol) -> &'static str {
    match protocol {
        EndpointControllerProtocol::ChatCompletions { .. } => "chat_completions",
        EndpointControllerProtocol::SystemOne {} => "system_one",
    }
}
