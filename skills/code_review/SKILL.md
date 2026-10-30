---
name: Code Review
description: Performs a comprehensive Code Review comparing the current state with the main branch.
---

# Code Review Skill

This skill performs a complete Code Review by comparing the current changes (commits + working directory) against the base branch (`main` or `origin/main`).

## Agent Instructions

When executing this skill, rigorously follow these steps:

1.  **Get Changes**:
    Execute the helper script appropriate for the current Operating System.

    *   **Windows (PowerShell)**:
        ```powershell
        powershell -ExecutionPolicy Bypass -File "$HOME\.opencode\skills\code_review\get_changes.ps1"
        ```
    *   **Linux / macOS (Bash)**:
        ```bash
        bash "$HOME/.opencode/skills/code_review/get_changes.sh"
        ```

2.  **Analyze the Diff**:
    Read the command output. If the diff is too long, process it in chunks or attempt to summarize.

3.  **Perform Comprehensive Review**:
    Act as an **Expert Senior Backend Engineer in DDD**. Analyze the following points:
    *   **Architecture (DDD)**: Layers (Domain, Use Cases, Infra), Abstractions, DI.
    *   **Code Quality**: SOLID, naming, error handling.
    *   **Security**: Validations, secrets.
    *   **Tests**: Coverage, edge cases.
    *   **Performance**: N+1, complexity.

4.  **Generate Report**:
    Present the report in **Markdown**.
    *   **Language**: **MUST be in Spanish** (native-level technical explanations). Variable names/Code in **English**.
    *   Generate a **Mermaid** diagram if changes impact architecture.
    *   Use the format: **Resumen**, **Hallazgos Críticos**, **Sugerencias de Mejora**, **Conclusión**.
