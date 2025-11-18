---
inclusion: always
---

# Git Workflow Rules

## Branch Strategy by Development Domain

**MANDATORY**: When starting work on a new development domain (group of related tasks), you MUST:

### 1. Identify Development Domains

Development domains are logical groupings of tasks, such as:
- **setup**: Project structure and configuration (tasks 1)
- **data-models**: Core data models and types (task 2)
- **ffmpeg-service**: FFmpeg wrapper implementation (tasks 3.x)
- **file-management**: File manager service (tasks 4.x)
- **conversion-service**: Conversion service and job queue (tasks 5.x)
- **upload-api**: Upload controller and validation (tasks 6.x)
- **status-api**: Status endpoint (tasks 7.x)
- **download-api**: Download controller (tasks 8.x)
- **cancel-api**: Cancel endpoint (tasks 9.x)
- **cleanup-api**: Cleanup endpoint (task 10)
- **server-setup**: Express server and routes (task 11)
- **frontend-ui**: Frontend HTML interface (task 12)
- **frontend-js**: Frontend JavaScript logic (tasks 13.x)
- **configuration**: System configuration (task 14)
- **error-handling**: Error handling implementation (tasks 15.x)
- **testing**: Final testing and verification (tasks 16, 18)
- **documentation**: Documentation (task 17)

### 2. Starting a New Domain

When beginning work on a new domain:

```bash
# Create and checkout new branch
git checkout -b feature/[domain-name]

# Push branch to remote
git push -u origin feature/[domain-name]
```

**Branch naming convention:**
- `feature/setup`
- `feature/data-models`
- `feature/ffmpeg-service`
- `feature/file-management`
- `feature/conversion-service`
- `feature/upload-api`
- etc.

### 3. Working Within a Domain

While working on tasks within the same domain:

1. Complete the task implementation
2. Verify all tests pass (if applicable)
3. Stage changes:
```bash
git add .
```

4. Commit with descriptive message:
```bash
git commit -m "[type]: [task description]"
```

5. Push to feature branch:
```bash
git push
```

6. Mark task as complete
7. Continue to next task in the same domain

### 4. Completing a Domain

When ALL tasks in a domain are complete:

1. Ensure all tests pass
2. Push final changes:
```bash
git push
```

3. Create Pull Request to main:
```bash
# Using GitHub CLI (if available)
gh pr create --base main --head feature/[domain-name] --title "[Domain Name] Implementation" --body "Implements tasks [X-Y]: [brief description]"
```

4. If GitHub CLI is not available, inform the user:
   - "✅ Domain '[domain-name]' complete. Please create a PR from `feature/[domain-name]` to `main` on GitHub."
   - Provide PR title and description

5. Wait for user confirmation before proceeding to next domain

### 5. After PR Merge

Once the user confirms PR is merged:

```bash
# Switch back to main
git checkout main

# Pull latest changes
git pull origin main

# Delete local feature branch
git branch -d feature/[domain-name]
```

Then start the next domain with a new branch.

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

## Complete Workflow Example

```bash
# Starting FFmpeg Service domain (tasks 3.x)
git checkout -b feature/ffmpeg-service
git push -u origin feature/ffmpeg-service

# Task 3: Implement FFmpegWrapper
# ... implement code ...
git add .
git commit -m "feat: implement FFmpegWrapper service with audio extraction"
git push

# Task 3.1: Property test
# ... implement test ...
git add .
git commit -m "test: add property test for audio parameters preservation"
git push

# Task 3.2: Property test
# ... implement test ...
git add .
git commit -m "test: add property test for PCM encoding"
git push

# Task 3.3: Unit tests
# ... implement tests ...
git add .
git commit -m "test: add unit tests for FFmpegWrapper"
git push

# Domain complete - create PR
# Inform user: "✅ FFmpeg Service domain complete. Creating PR..."
gh pr create --base main --head feature/ffmpeg-service --title "FFmpeg Service Implementation" --body "Implements tasks 3, 3.1, 3.2, 3.3: FFmpeg wrapper with audio extraction, validation, and comprehensive tests"
```

## Important Notes

- NEVER skip the commit and push steps
- Always use clear, descriptive commit messages
- Include the task number or description in the commit message
- Create a NEW branch for each development domain
- Keep feature branches updated with regular pushes
- Create PR only when ALL tasks in the domain are complete
- Wait for user confirmation of PR merge before starting next domain
- If push fails, inform the user and ask for guidance
- If uncertain about domain boundaries, ask the user for clarification

## Current Domain Tracking

When starting a new domain, you MUST:
1. Announce: "Starting new domain: [domain-name]"
2. Create the feature branch
3. Push the branch to remote
4. Proceed with tasks

When completing a domain, you MUST:
1. Announce: "Domain [domain-name] complete"
2. Create or request PR creation
3. Wait for user confirmation before proceeding
