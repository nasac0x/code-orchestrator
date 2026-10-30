---
name: Smart Commit
description: Manages changes, branches, rebase, and commits automatically following best practices.
---

# Smart Commit Skill

This skill manages the flow of committing changes, ensuring they are on the correct branch, rebased with main, and committed or pushed.

## Agent Instructions

Follow this logic map precisely. Interact with the user in **Spanish**, but generate branch names and commit messages in **English**.

### Phase 1: Status & Branch Check
1.  Run `git status -sb`.
2.  **IF Output is empty (Clean Working Tree)**:
    *   Go to **Phase 4 (Sync & Push)** directly.
3.  **IF on `main` (or `master`)**:
    *   State: "Tienes cambios directamente en la rama main."
    *   **Propose**: Analyze changes (`git diff --stat`) and propose a new branch name (Conventional Commits).
    *   **Ask**: "¿Deseas mover estos cambios a una nueva rama llamada `[PROPOSED_NAME]`?"
    *   **IF YES**: Execute `git checkout -b [PROPOSED_NAME]`. (Changes carry over).
    *   **IF NO**: Warn "No recomendado" but proceed.

### Phase 2: Staging & Commit
1.  Check for **Untracked Files** (`??`).
    *   If exist, **Ask**: "¿Incluir archivos no rastreados?"
    *   Yes: `git add .` | No: `git add -u`.
2.  If currently clean but `git add` hasn't run, run `git add .`.
3.  Generate **Commit Message** (English, Conventional).
4.  **Ask**: "Propongo el mensaje: `[MESSAGE]`. ¿Proceder?"
5.  **IF YES**: Execute `git commit -m "[MESSAGE]"`.
6.  **IF NO**: Ask for message and commit.

### Phase 3: Sync (Rebase)
1.  **Ask**: "¿Deseas actualizar (rebase) tu rama con `origin/main` para traer los últimos cambios?"
2.  **IF YES**:
    *   Execute: `git fetch origin main`.
    *   Execute: `git rebase origin/main`.
    *   **CRITICAL**: If conflicts occur, STOP and inform the user.

### Phase 4: Push
1.  Check remote status (`git ls-remote`, `git log`).
2.  **Condition A**: Branch doesn't exist on remote.
    *   **Ask**: "¿Publicar rama (`git push -u ...`)?" -> Execute.
3.  **Condition B**: Local is ahead (`git log origin..HEAD`).
    *   **Ask**: "¿Subir commits (`git push`)?" -> Execute.
4.  **Condition C**: Clean.
    *   Inform: "Todo actualizado."
