# Operation 10: Frame

## Trigger and purpose

Use Frame when a request names a technology, component, vendor, or code change
before it states the required behavior. Use Frame also when a requirement is
ambiguous or when different stakeholders report different outcomes.

Frame separates a Behavioral Requirement from a Proposed Mechanism. It MUST
not decide the mechanism. The mechanism remains a `CAN-*` candidate for later
Explore and Value operations.

## Frame procedure

1. Copy the request into the input record. Mark every technology noun as a
   proposed mechanism, not as a requirement.
2. State the required behavior as a verb, direct object, and bounded constraint.
   Use observable inputs, outputs, time limits, failure behavior, and data
   ownership. Avoid vendor names and vague adjectives.
3. Write the behavioral delta as a Hoare triple: `{preconditions} C
   {postconditions}`. Add invariants that MUST remain true during `C`.
4. Inspect the boundary at function, module, service, system, and operational
   pipeline levels. Record where the requirement is observed and where a
   mechanism may be placed.
5. Inspect the user, data owner, operator, adversary, downstream consumer, and
   future maintainer perspectives.
6. Record unknowns and contradictions as `UNK-*` and `CTR-*`. Attach a
   falsification condition to each important assumption.

## FRAME card

A `FRAME-*` card MUST contain:

| Field | Requirement |
| --- | --- |
| `id`, `title` | Canonical ID and short problem name |
| `context` | Observable system context and affected boundary |
| `required_behavior` | Technology-agnostic behavior statement |
| `proposed_mechanism` | Original mechanism, explicitly marked as proposed |
| `preconditions` | State and event conditions before execution |
| `postconditions` | Observable result after execution |
| `invariants` | Properties that MUST remain true |
| `constraints` | Hard limits, safety rules, and ownership rules |
| `behavioral_delta` | Required behavior minus actual behavior |
| `perspectives` | Stakeholder and operating-condition findings |
| `unknowns`, `contradictions` | Linked `UNK-*` and `CTR-*` nodes |
| `provenance` | Provenance for every significant statement |

The card MUST state who can observe success and how a test can falsify it. A
FRAME card that contains only a library or product name is invalid.

## Separation operators

- **Function from implementation:** replace a technology noun with a behavior.
- **Required from actual behavior:** state the expected invariant and the
  measured or observed violation separately.
- **System boundary:** move the analysis boundary until the function and its
  ownership are explicit.
- **Perspective:** inspect user, data owner, operator, adversary, downstream,
  and maintainer effects.

## Examples

Positive:

> Proposed mechanism: “Add Kafka for checkout events.” Required behavior:
> “During a worker restart, accepted checkout events MUST be retained and
> delivered once to invoice generation within 30 seconds. Duplicate delivery
> MUST NOT duplicate an invoice.”

Negative:

> “The system MUST use Kafka to be scalable.”

The negative form smuggles a mechanism into the requirement and gives no
observable workload, retention, delivery, or idempotence invariant.

## Handoff and gate

Frame MUST hand off its `FRAME-*`, invariants, unknowns, and contradictions to
Diagnose, Explore, or Knowledge. The Semantic Gate MUST reject a frame that
does not separate required behavior from the proposed mechanism.
