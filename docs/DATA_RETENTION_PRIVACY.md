# Data Retention and Privacy Controls

## Retention Policy
- Processing artifacts in Redis are ephemeral and expire by TTL.
- Persisted outputs are limited to required operational windows.
- Logs must avoid storing raw sensitive document content.

## Deletion Policy
- Support explicit report deletion by report identifier.
- Ensure derived artifacts are removed together with source records.
- Maintain deletion audit records without retaining sensitive payloads.

## Privacy Controls
- Restrict access to operational data by least privilege.
- Encrypt data in transit and enforce managed secret storage.
- Review third-party model/provider settings for data-handling alignment.

## Verification
- Run monthly retention/deletion control checks.
- Capture evidence in release-readiness snapshots before public launch.
