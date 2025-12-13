# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working Style & Approach

**CRITICAL: Think First, Code Once - Not the Other Way Around**

When tackling any non-trivial task, especially those involving complex systems (UI interactions, state management, API integrations, etc.):

### Required Process
1. **ANALYZE THOROUGHLY FIRST** - Read and understand ALL relevant code before making any changes
2. **MAP THE SYSTEM** - Identify all dependencies, interactions, and potential side effects
3. **CLARIFY REQUIREMENTS** - If ANYTHING is unclear, ambiguous, or could be interpreted multiple ways, **STOP and ASK QUESTIONS**. Never assume or guess at requirements.
4. **DESIGN A COMPLETE SOLUTION** - Think through the entire approach on "paper" first
5. **PRESENT THE PLAN** - Explain the strategy clearly before writing any code
6. **IMPLEMENT CAREFULLY** - Make changes systematically, following the agreed plan
7. **STICK TO THE PLAN** - Don't pivot to quick fixes that create new problems

### Absolutely Forbidden
- ❌ Making reactive changes without understanding root causes
- ❌ Fixing one bug and creating another (going in circles)
- ❌ Changing approach multiple times mid-task
- ❌ Quick fixes that break other things
- ❌ Jumping to implementation before thorough analysis

### If You Get Stuck
- **STOP** - Don't keep trying random fixes
- **STEP BACK** - Re-analyze the entire system
- **ADD CONSOLE LOGS** - Only by seeing the logs you can understand what's going on
- **ASK** - Request clarification or context from the user
- **REDESIGN** - Create a new plan based on better understanding

**Remember:** Breaking more things than you fix wastes time and causes frustration. Spending 10 minutes on proper analysis upfront is better than 60 minutes going in circles.
