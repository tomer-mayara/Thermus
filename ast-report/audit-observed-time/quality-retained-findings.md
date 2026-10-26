# Retained habit-hooks findings

Candidate: `8a13ba7b3f6b49c6f02377fd51f12fc18b8dc2ae` against main `581f30cfaa32b01399422b087b0f0bdc3b800f70`.

The complete-candidate habit-hooks run exits 1 with two findings in the changed production file. This is reviewed retention, not a clean lint pass. The snooze file is empty.

- `src/logs/audit/otlp-audit-encoding.ts:23`, eventAttributes complexity: retain the closed Audit event union's explicit field allowlists in one translator. Its branches select the supported tool, administration, destination, or synthetic payload and prevent extra caller fields from reaching the wire. Extracting per-branch wrappers adds indirection without separating a responsibility. The timestamp fix is outside this unchanged function and adds no branch.
- `src/logs/audit/otlp-audit-encoding.ts:46`, comment: retain the short named-field-copy comment because it records the data-minimization guarantee behind explicit translation. A generic object serializer would silently export additional caller fields; the comment explains why that tempting replacement is wrong.

The manager accepts both dispositions. They change no metric rule, exception, lint setting, or security requirement. Independent review and measured MI/CRAP evidence are separate.

## Maintainability review

The encoder file measures MI 53.45070666566668, compared with 53.87515480541661 at the base (drop 0.42444813974993). The file has four cohesive translation helpers and 28 decision paths at both revisions. The only changed function, encodeAuditEvent, retains five decision paths. The existing MI 85 goal miss is retained: the explicit event union's field allowlists, strict timestamp conversion, safe typed failure, and request-byte bound belong to this narrow OTLP boundary. Splitting these into wrappers or moving the record literal would hide that complete contract without simplifying the timestamp fix. The added local value avoids repeating the validated conversion and adds no decisions. No new file or metric exception is introduced. The detailed file inspection is encoder-metrics.log; final CRAP and process findings are recorded separately.
