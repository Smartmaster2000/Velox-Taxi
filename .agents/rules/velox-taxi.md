---
trigger: always_on
---

# Quota Saving Rules for Velox Taxi Project

## 1. ALWAYS START WITH A PLAN
For any complex task (more than one file or a new feature), the agent MUST first create a detailed plan and wait for user approval before writing any code.

## 2. BE CONCISE AND EFFICIENT
- Generate ONLY the specific code requested
- Avoid unnecessary explanations or extra files
- Keep responses focused and efficient
- Do not rewrite entire files unless absolutely necessary

## 3. USE SUBAGENTS FOR COMPLEX TASKS
When a task involves multiple components (frontend, backend, database), spawn subagents to work in parallel:
- UI/UX Subagent: For frontend changes
- API Subagent: For backend/endpoint changes  
- Database Subagent:For Supabase queries and RLS policies

## 4. PRIORITIZE USER VALUE
When proposing solutions, prioritize features that provide the most user-facing value first:
1. Core functionality (booking, accepting rides)
2. Real-time features (tracking, notifications)
3. Polish and UI improvements

## 5. MINIMIZE TOKEN USAGE
- Use `plan` mode for complex tasks
- Describe file purposes instead of pasting entire files
- Only paste the exact block of code that's broken
- Respect the 5-hour quota refresh window