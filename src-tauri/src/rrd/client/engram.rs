//! The installed engram's authority record: its instances and the lifecycle
//! operations recorded against them.
//!
//! The engine contract still names this "estate" (`RrdClient::read_estate`,
//! `ReadEstate`, the `estate-read` operation); Connectome presents it as an
//! engram. The read names the engram in its resource path, and the only one
//! this client may name is the one the engine's own capability document
//! reports as installed; an engine that reports none is refused here, before
//! any request.

use super::*;
use crate::rrd::view::engram::{self, EngramView};
use rrd_contract::ReadEstate;

/// The engram the engine installed, as its capability document named it.
fn installed_engram(service: &ServiceView) -> Result<CanonicalId, RrdError> {
    let installed = service.installed_estate.as_ref().ok_or_else(|| {
        RrdError::from(
            "the engine's capability document names no installed engram, so there is no engram              to read"
                .to_owned(),
        )
    })?;
    CanonicalId::new(installed.estate_id.clone())
        .map_err(|error| format!("the installed engram id is not canonical: {error}").into())
}

impl NativeRrdClient {
    /// Reads the installed engram's snapshot. The SDK validates the response
    /// against the contract before Connectome projects it.
    pub async fn engram(&self) -> Result<EngramView, RrdError> {
        let id = installed_engram(&self.service)?;
        let snapshot = self
            .send(false, |session, options| async move {
                self.client
                    .read_estate(&session, id, ReadEstate {}, options)
                    .await
            })
            .await?;
        Ok(engram::engram(&snapshot))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rrd::view::InstalledEstateView;

    fn service(installed_estate: Option<InstalledEstateView>) -> ServiceView {
        ServiceView {
            implementation: "rrflow".into(),
            implementation_version: "1.0.0".into(),
            instance: "instance-a".into(),
            deployment_form: "embedded".into(),
            storage_profile: "local".into(),
            endpoint_presentation: "loopback".into(),
            installed_estate,
            configuration_revision: 1,
            configuration_sha256: "0".repeat(64),
            capabilities: Vec::new(),
        }
    }

    #[test]
    fn engram_read_names_only_the_installed_engram() {
        let refused = installed_engram(&service(None)).expect_err("no installed engram");
        assert!(refused.message.contains("names no installed engram"));

        let named = installed_engram(&service(Some(InstalledEstateView {
            project_id: "project-a".into(),
            estate_id: "engram-a".into(),
            instance_id: "instance-a".into(),
        })))
        .expect("installed engram");
        assert_eq!(named.as_str(), "engram-a");
    }
}
