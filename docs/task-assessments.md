# Task assessments

**Assess a file** sends one explicitly requested assessment through the
configured controller for the selected RRFlow task. It uses the task budget and
the assessment policy returned by the current engine session.

## Before requesting an assessment

- The task needs an available budget and the engine must expose the assessment
  operations and an enabled policy.
- Choose one file from the current typed source inventory. The request includes
  its admitted identity, content digest and a bounded byte limit.
- Review the destination and the current network, source-export and context-export
  settings. Confirm source and practice export before sending anything.
- Enter the assessment and a short practice description. Binary, score and
  choice assessments are supported; the controller may also abstain.

The UI does not call the selector or create a selector attempt before assessment.
It does not choose a provider or model. Missing or disabled engine policy fails
closed. A declaration made in this form is user-authored and is not an imported,
verified or SWAG-authored template.

## Results and recovery

After the single request, the UI uses the engine's protected read operation to
display the admitted result. It records only the task and attempt coordinates
locally so a later **Check assessment result** can request a fresh read. Reopen
or reconnect first, then use that control; a denied or unavailable read removes
the displayed result. If the request reply is uncertain, read the same attempt
instead of repeating the request.

An assessment is advisory. It does not prove correctness, train a model, or
measure model quality. The UI displays an abstention as an abstention. Raw
identifiers and digests are under provenance details; normal use does not require
typing an internal attempt ID.

Repeated-work stop reasons require explicit review and confirmation before
resuming. Resume must preserve the existing deadline, limits and charged effort.
It does not reset the budget or permit recovery of unknown work. Repetition
tracking limits are not resumable. Review changed task inputs before requesting
new work.
