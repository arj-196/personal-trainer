# PRD: Goal-Aligned Recipe Suggestions

## Overview

Personal Trainer should help users decide what to cook based on the ingredients they already have at home and their fitness goal. The feature will accept a user-provided ingredient list, combine it with the user's training profile and nutrition goal, and return recipe suggestions that are practical, goal-aligned, and realistic to cook.

## Problem

The current product helps users train, but it does not help them turn their goal into daily eating decisions. Users often know their goal, but they do not know what to cook with the ingredients they already have. This creates friction between plan quality and real-world execution.

## Goal

Enable a user to provide ingredients on hand and receive recipe suggestions that:

- use the available ingredients as much as possible
- support the user's stated fitness goal
- are simple enough to cook at home
- explain why each recipe fits the goal

## Non-Goals

- full calorie tracking
- grocery ordering or delivery integration
- automatic pantry recognition from photos
- medically regulated nutrition advice
- highly customized meal planning for clinical conditions in v1

## Target User

A user already using Personal Trainer for workout planning who wants practical meal suggestions without needing a separate nutrition app.

## User Stories

- As a user, I want to enter the ingredients I have so I can get recipes I can cook immediately.
- As a user, I want recipe suggestions to reflect my goal, such as fat loss, muscle gain, or maintenance.
- As a user, I want the trainer to tell me which ingredients are used and which extra ingredients are optional.
- As a user, I want a short explanation for why a recipe matches my goal.
- As a user, I want substitutions when I do not have one of the ideal ingredients.

## Product Principles

- Practical over perfect: suggestions should be cookable with common household constraints.
- Goal-aware: recommendations should align with the user's active training and nutrition objective.
- Transparent: the system should explain recipe fit, missing ingredients, and tradeoffs.
- Low-friction: pantry input should be fast and forgiving.

## Primary Use Case

1. The user opens a recipe suggestion view from their workspace.
2. The user enters ingredients available at home.
3. The system reads the user's current goal from the trainer profile or workout context.
4. The system returns a ranked list of recipe suggestions.
5. Each recipe shows:
   - title
   - fit score or ranking reason
   - ingredients used from pantry
   - missing ingredients, if any
   - estimated prep/cook time
   - macro-oriented summary
   - short coaching explanation
6. The user can select a recipe to view cooking steps and substitutions.

## Example Goals

- Fat loss
- Muscle gain
- Maintenance
- Higher protein intake
- Faster post-workout recovery

## Functional Requirements

### Pantry Input

- The user can enter ingredients as free text.
- The system should normalize ingredient names and basic synonyms.
- The system should tolerate spelling variations and pluralization.
- The system should allow optional pantry metadata:
  - quantity
  - unit
  - ingredient freshness priority

### Goal Awareness

- The system must infer the user's active goal from workspace/profile data when available.
- The user must be able to override the goal for recipe suggestions.
- The recipe ranker must consider goal fit as a primary scoring factor.

### Recipe Suggestions

- The system must return multiple recipe suggestions, not just one.
- Each suggestion must prioritize ingredients already on hand.
- The system may include a small number of missing ingredients when the recipe value is high.
- The system must clearly separate:
  - ingredients the user already has
  - ingredients that are missing
  - optional add-ons
- The system must provide step-by-step preparation instructions.
- The system must provide substitutions when a key ingredient is missing.

### Nutrition Guidance

- Each recipe must include a lightweight nutrition summary.
- The summary should focus on practical dimensions such as:
  - protein-forward
  - carb-supportive
  - lighter calorie density
  - recovery-friendly
- In v1, exact calories and macros may be estimates rather than precise calculations.

### Explanation and Trust

- The system must explain why the recipe matches the user's goal.
- The system must indicate if a suggestion is a strong fit, decent fit, or fallback option.
- The system must avoid presenting uncertain nutrition values as precise facts.

## Non-Functional Requirements

- The recipe response should feel fast enough for interactive use.
- The feature should work for both CLI-backed data flows and the frontend UI.
- The system should degrade gracefully when goal data is missing by asking the user to choose a goal.
- The feature should be easy to extend with richer nutrition logic later.

## Proposed UX

### Frontend

- Add a "Recipes" entry point from the main workout dashboard.
- Show an ingredient input area using chips or comma-separated free text.
- Display recipe cards ranked by best fit.
- Allow filtering by:
  - goal
  - prep time
  - missing ingredient count
  - meal type

### Trainer Backend

- Add a recipe recommendation service in Python.
- Read active workspace context and profile data.
- Support recipe scoring based on pantry match plus goal fit.

## Suggested Output Shape

Each recipe suggestion should include:

- `title`
- `summary`
- `goal_fit_reason`
- `pantry_ingredients_used`
- `missing_ingredients`
- `optional_ingredients`
- `estimated_prep_minutes`
- `estimated_cook_minutes`
- `instructions`
- `substitutions`
- `nutrition_summary`
- `confidence_note`

## Data Requirements

### Inputs

- workspace id
- user goal
- pantry ingredients
- optional exclusions or dislikes
- optional meal type

### Dependencies

- user profile data from the trainer workspace
- recipe catalog or recipe-generation logic
- ingredient normalization and matching logic

## Recommendation Strategy

Recipes should be ranked using a weighted score across:

- goal alignment
- pantry ingredient coverage
- protein adequacy for the goal
- preparation simplicity
- missing ingredient penalty
- variety penalty to avoid repeating the same recommendation too often

## MVP Scope

- manual pantry entry
- support for 3 to 5 high-level goals
- ranked recipe suggestions
- simple cooking steps
- explanation of goal fit
- clear missing ingredient list
- frontend view for recipe discovery
- Python backend service for recommendation logic

## Future Scope

- saved pantry state per workspace
- recipe feedback and thumbs up/down learning
- grocery list generation for missing ingredients
- weekly meal suggestions tied to the workout plan
- allergy handling
- cuisine preferences
- budget-aware recipe ranking
- meal prep batch cooking mode

## Success Metrics

- percentage of active users who try the recipe feature
- repeat usage within 7 days
- average number of recipe views per session
- percentage of sessions that lead to a recipe detail open
- user feedback on recipe usefulness and practicality

## Risks

- weak recipe suggestions if the recipe catalog is too small or poorly tagged
- inaccurate goal alignment if user profile data is incomplete
- trust issues if nutrition claims sound too precise
- poor pantry parsing if ingredient normalization is brittle

## Open Questions

- Should recipes come from a curated internal catalog, LLM generation, or a hybrid model?
- How should we represent nutrition goals in the current workspace model?
- Do we need an explicit user preference model for dislikes, allergies, and cuisine style in v1?
- Should the feature suggest recipes with missing ingredients at all, or only pantry-complete meals by default?
- Should the recipe feature live only in the frontend initially, or also be exposed through the trainer CLI?

## Delivery Plan

### Phase 1

- define goal model and pantry input contract
- implement backend ingredient normalization
- implement recipe ranking and response schema
- build frontend recipe suggestion page

### Phase 2

- add feedback collection on suggested recipes
- improve substitutions and missing ingredient handling
- add richer nutrition summaries

### Phase 3

- personalize based on prior recipe selections
- generate shopping lists and weekly meal guidance

