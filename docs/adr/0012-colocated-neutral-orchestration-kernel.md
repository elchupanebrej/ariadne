# Co-located neutral orchestration kernel

If a kernel survives the matched thin-baseline evaluation, implement it as an owner-neutral internal module co-located in this repository, with its own repository-visible attempt ledger and one-shot or in-process execution. Do not extend `AriadneHarnessController` or add a package, service, or database: those alternatives either merge epistemic and orchestration ownership or add an unproven lifecycle. Delete or inline the module if the thin baseline passes the same contract.
