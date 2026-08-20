# Operation 70: Dynamics

## Trigger and purpose

Use Dynamics when behavior depends on time, load, retries, queues, resource
accumulation, version skew, failure, or a stateful transition. A static
architecture diagram is not evidence of dynamic safety.

## Dynamics procedure

1. Define workload arrival profile, service capacity, time horizon, and
   operating conditions.
2. Model stocks and flows: `dS/dt = inflow - outflow`. Identify the stock that
   grows when capacity is exceeded.
3. For a queue, record arrival rate `lambda`, service rate `mu`, utilization
   `rho = lambda / mu`, queue length, wait time, and bounded capacity. Use
   Little's Law: `L = lambda * W` when its conditions apply.
4. Measure tail latency (`p95`, `p99`, and `p99.9` where material), not only an
   average. Mark the utilization cliff as `rho` approaches `1.0`.
5. Draw feedback loops for client retries, timeouts, throttling, queue
   backpressure, resource exhaustion, and recovery. Test whether the loop can
   create a retry storm or other metastable failure that persists after the
   trigger stops.
6. Model event ordering, propagation latency, protocol version skew, and each
   transition phase. Include client behavior adaptation and bottleneck
   migration as scale grows.
7. Specify bounded backpressure, load shedding, retry budgets, and recovery
   predicates. Link each predicate to an Evidence Request.

## DYN card

A `DYN-*` card MUST contain workload, stocks, flows, rates, capacity, queue
limits, tail metrics, feedback loops, failure modes, version skew, operating
conditions, and falsification thresholds. It MUST state whether a result is a
simulation, benchmark, fault injection, or production observation.

## Metastable failure checks

The card MUST check these conditions:

- retries increase arrival rate after a timeout;
- queue or resource stock has no bounded drain path;
- recovery removes the trigger but leaves positive feedback active;
- one failed dependency causes synchronized retries or cascading load;
- a version transition changes event order or retry semantics;
- backpressure or load shedding violates a hard invariant.

## Example and gate

Positive: a benchmark records `lambda`, `mu`, queue depth, p99 latency, retry
count, and recovery time while a dependency is slowed. It can falsify the
claim that a bounded queue prevents cascading failure.

Negative: “Average latency is 20 ms, so the service is safe at load.” The claim
does not model tail latency, queue growth, retry feedback, or capacity.

The Dynamics Gate MUST reject a dynamic claim that has no workload, capacity,
tail metric, or failure predicate.
