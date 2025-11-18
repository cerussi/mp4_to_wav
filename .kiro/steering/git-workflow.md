---
inclusion: always
---

# Git Workflow Rules

## Commit After Task Completion

**MANDATORY**: After completing ANY task from the implementation plan, you MUST:

1. Stage all changes:
```bash
git add .
```

2. Create a commit with a descriptive message following this format:
```bash
git commit -m "feat: [task description]"
```

3. Push to remote repository:
```bash
git push
```

## Commit Message Format

Use conventional commit format:

- `feat:` - New feature implementation
- `fix:` - Bug fix
- `test:` - Adding or updating tests
- `refactor:` - Code refactoring
- `docs:` - Documentation changes
- `chore:` - Build process or auxiliary tool changes

### Examples:

- `feat: set up project structure and dependencies`
- `feat: implement FFmpegWrapper service with audio extraction`
- `test: add property tests for audio parameters preservation`
- `feat: implement upload controller with file validation`
- `fix: correct sample rate detection in FFmpegWrapper`

## Task Completion Workflow

1. Complete the task implementation
2. Verify all tests pass (if applicable)
3. Stage changes: `git add .`
4. Commit with descriptive message
5. Push to remote: `git push`
6. Mark task as complete
7. Report completion to user

## Important Notes

- NEVER skip the commit and push steps
- Always use clear, descriptive commit messages
- Include the task number or description in the commit message
- If a task has multiple sub-tasks, you MAY commit after each sub-task OR after all sub-tasks are complete
- If push fails, inform the user and ask for guidance
