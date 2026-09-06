# Decide persisted-format evolution and migration

Type: grilling
Blocked by: 04
Parent: [Ariadne production readiness](../map.md)

## Question

How are every authoritative persisted format and derived projection versioned, detected, upgraded, backed up, and rejected when too new or corrupt? Decide whether migration is automatic or explicit, whether upgrades are reversible, how interrupted migration resumes, which history must be retained, and what evidence proves that an existing `.ariadne` workspace reaches the new format without semantic or event loss.
