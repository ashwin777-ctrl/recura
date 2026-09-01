# GSD Project Lifecycle & Autonomous Execution

> Synthesized from **gsd** (Get-Stuff-Done) and **ralph** PRD workflows.

---

## 1. Autonomous Phase Lifecycle
When implementing complex features or major refactoring:
1. **Spec & Ambiguity Scoring**: Identify requirements, constraints, and edge cases before coding.
2. **Atomic Changes**: Commit small, logical, well-tested units of work.
3. **Verification Loop**: Run `npm test`, `npm run typecheck`, and `npm run test:e2e` after changes before declaring a phase complete.
4. **Live Validation**: Validate against actual production/staging infrastructure rather than simulated mocks alone.
