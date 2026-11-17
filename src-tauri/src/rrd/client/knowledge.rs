//! Project-bound knowledge configuration through the canonical public SDK.

use super::*;
use rrd_contract::{
    KnowledgeTree, KnowledgeTreeCatalogue, ListKnowledgeTrees, ReplaceKnowledgeTrees,
    ReplaceKnowledgeTreesResult,
};

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RrdKnowledgeTreesRequest {
    pub expected_instance: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RrdReplaceKnowledgeTreesRequest {
    pub expected_instance: String,
    pub expected_revision: u64,
    pub trees: Vec<KnowledgeTree>,
}

fn accepted_project(
    service: &ServiceView,
    expected_instance: &str,
) -> Result<CanonicalId, RrdError> {
    if service.instance != expected_instance {
        return Err(
            "the knowledge request's expected RRD instance differs from the native session".into(),
        );
    }
    if !service.capabilities.iter().any(|capability| {
        capability.name == "knowledge-tree-catalogue"
            && capability.contract_version == 1
            && matches!(capability.status.as_str(), "available" | "experimental")
    }) {
        return Err("this estate does not offer knowledge-tree-catalogue v1".into());
    }
    let installed = service
        .installed_estate
        .as_ref()
        .filter(|installed| installed.instance_id == expected_instance)
        .ok_or("knowledge trees require this session's installed project identity")?;
    canonical(&installed.project_id, "installed project").map_err(RrdError::from)
}

fn validate_catalogue_target(
    catalogue: &KnowledgeTreeCatalogue,
    project: &CanonicalId,
    scope: &str,
) -> Result<(), RrdError> {
    if &catalogue.project_id != project || catalogue.scope != scope {
        return Err("RRD returned a knowledge catalogue for another project or scope".into());
    }
    Ok(())
}

impl NativeRrdClient {
    pub async fn knowledge_trees(
        &self,
        request: RrdKnowledgeTreesRequest,
    ) -> Result<KnowledgeTreeCatalogue, RrdError> {
        let project = accepted_project(&self.service, &request.expected_instance)?;
        let request = ListKnowledgeTrees {
            project_id: project.clone(),
            scope: self.scope(),
        };
        let catalogue = self
            .send(false, |session, options| async move {
                self.client
                    .list_knowledge_trees(&session, request, options)
                    .await
            })
            .await?;
        validate_catalogue_target(&catalogue, &project, &self.scope())?;
        Ok(catalogue)
    }

    pub async fn replace_knowledge_trees(
        &self,
        request: RrdReplaceKnowledgeTreesRequest,
    ) -> Result<ReplaceKnowledgeTreesResult, RrdError> {
        let project = accepted_project(&self.service, &request.expected_instance)?;
        let revision = request
            .expected_revision
            .checked_add(1)
            .ok_or("knowledge catalogue revision overflow")?;
        let request = ReplaceKnowledgeTrees {
            project_id: project.clone(),
            scope: self.scope(),
            expected_revision: request.expected_revision,
            trees: request.trees,
        };
        let result = self
            .send(true, |session, options| async move {
                self.client
                    .replace_knowledge_trees(&session, request, options)
                    .await
            })
            .await?;
        validate_catalogue_target(&result.catalogue, &project, &self.scope())?;
        if result.catalogue.revision != revision {
            return Err(
                "RRD returned a knowledge replacement with the wrong accepted revision".into(),
            );
        }
        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rrd::view::{CapabilityView, InstalledEstateView};

    fn service() -> ServiceView {
        ServiceView {
            implementation: "rrflow".into(),
            implementation_version: "1.0.0".into(),
            instance: "instance-original".into(),
            deployment_form: "single_node_server".into(),
            storage_profile: "rrflow_kv".into(),
            endpoint_presentation: "loopback_http_websocket".into(),
            installed_estate: Some(InstalledEstateView {
                project_id: "project-original".into(),
                estate_id: "estate-original".into(),
                instance_id: "instance-original".into(),
            }),
            configuration_revision: 1,
            configuration_sha256: "a".repeat(64),
            capabilities: vec![CapabilityView {
                name: "knowledge-tree-catalogue".into(),
                contract_version: 1,
                status: "experimental".into(),
                limitation: None,
            }],
        }
    }

    #[test]
    fn knowledge_commands_bind_the_accepted_instance_project_and_capability() {
        let valid = service();
        assert_eq!(
            accepted_project(&valid, "instance-original")
                .unwrap()
                .as_str(),
            "project-original"
        );
        assert!(accepted_project(&valid, "instance-other").is_err());
        let mut old_engine = service();
        old_engine.capabilities.clear();
        assert!(accepted_project(&old_engine, "instance-original").is_err());
        let mut unavailable = service();
        unavailable.capabilities[0].status = "unavailable".into();
        assert!(accepted_project(&unavailable, "instance-original").is_err());
        let mut unsupported = service();
        unsupported.capabilities[0].contract_version = 2;
        assert!(accepted_project(&unsupported, "instance-original").is_err());
        let mut unbound = service();
        unbound.installed_estate = None;
        assert!(accepted_project(&unbound, "instance-original").is_err());
        let mut wrong_project = service();
        wrong_project.installed_estate.as_mut().unwrap().instance_id = "instance-other".into();
        assert!(accepted_project(&wrong_project, "instance-original").is_err());
    }

    #[test]
    fn returned_knowledge_configuration_cannot_retarget_the_native_session() {
        let project = canonical("project-original", "project").unwrap();
        let catalogue =
            KnowledgeTreeCatalogue::empty(project.clone(), "instance:instance-original".into())
                .unwrap();
        assert!(
            validate_catalogue_target(&catalogue, &project, "instance:instance-original").is_ok()
        );
        assert!(
            validate_catalogue_target(&catalogue, &project, "instance:instance-other").is_err()
        );
        assert!(validate_catalogue_target(
            &catalogue,
            &canonical("project-other", "project").unwrap(),
            "instance:instance-original"
        )
        .is_err());
    }
}
