# PRD: Jeff the Cook

## 1. Overview

Jeff the Cook is a personal, voice-first web app that helps the user generate recipe recommendations from ingredients they have available. The app is designed for a single user and will be hosted on Vercel.

The primary interaction model is:
- the user speaks ingredients and constraints into the app
- the app transcribes and interprets the input into a proposed parameter update
- the user reviews the updated parameters in the top section of the UI
- the user explicitly confirms generation
- the app generates 3 recipe options
- the user can tap a recipe card to expand details
- the user can save a good recipe as an immutable snapshot in Vercel Blob storage

The app is not a traditional chat UI. It is a **state-driven recipe workspace** with voice as the main input method.

## 2. Product goals

### Goals
- Let the user provide ingredients and cooking preferences by voice
- Avoid forcing the user to type ingredients
- Let the user review interpreted changes before recipe generation
- Generate 3 recipe recommendations from the current confirmed state
- Allow follow-up voice refinements to improve the results
- Allow manual correction of parameters in the UI
- Save recipe snapshots to Vercel Blob storage
- Keep the system simple enough to build and deploy on Vercel

### Non-goals
- Multi-user authentication or user management
- Social or collaborative features
- Editable saved recipes
- SQL database usage
- Curated recipe database
- Offline support
- Medical-grade nutritional accuracy

## 3. Primary user

Single personal user only.

There is no auth for the MVP.

## 4. Core product principles

1. **Voice-first, not voice-only**
   - The microphone is the primary input.
   - The user can manually correct fields in the UI.

2. **Review before generation**
   - Voice input should not immediately regenerate recipes.
   - The app must interpret updates first and wait for user confirmation.

3. **Top section is the source of truth**
   - The parameters shown in the top section represent the current draft state.
   - Recommendations always correspond to the last confirmed state, not raw chat history.

4. **Ingredients are available inventory, not mandatory inputs**
   - The user is listing what they have.
   - The app should not force recipes to use all listed ingredients.

5. **Saved recipes are immutable snapshots**
   - A saved recipe is a frozen copy of the selected recipe plus the state used to generate it.

## 5. UX summary

## Main screen layout

The app has one primary screen with these regions:

1. **Header**
   - App title: `Jeff the Cook!`
   - Optional subtle status text such as `Listening...`, `Interpreting...`, `Ready to generate`

2. **Top parameters section**
   - Ingredients
   - Notes
   - Mode

3. **Generate confirmation action**
   - Button: `Generate Recipes`

4. **Bottom recommendations section**
   - Show 3 recipe options in compact cards
   - Tapping a card expands details
   - Only one card expanded at a time

5. **Bottom-centered microphone button**
   - The main interaction control
   - Starts speech capture

## Top parameters section details

### Ingredients
- Displays available ingredients
- Double-click to edit manually
- Contents are reparsed after edit

### Notes
- Displays natural-language preferences and constraints
- Examples:
  - air fried
  - high protein
  - spicy
  - under 20 minutes
- Double-click to edit manually
- Notes are internally parsed into structured constraints

### Mode
- Must appear in the top parameters section
- Use a visible segmented control or pill selector
- Modes:
  - Strict
  - Hybrid
  - Anything
- Mode is directly selectable, not double-click text editing

## Recommendations section details

- Always show exactly 3 recipe cards after generation
- Default state is collapsed
- Collapsed card shows:
  - title
  - short rationale or summary
  - total time
- Expanded card shows:
  - title
  - rationale
  - estimated total time
  - available ingredients used
  - available ingredients unused
  - extra ingredients needed
  - preparation steps
  - save button
- Only one card should be expanded at a time

## 6. Core user flows

### Flow A: Initial recipe generation
1. User opens the app
2. User taps the microphone
3. User speaks available ingredients and preferences
4. App transcribes the speech
5. App interprets the speech into a proposed draft update
6. Top section updates to show the interpreted parameters
7. User reviews and optionally edits Ingredients, Notes, or Mode
8. User presses `Generate Recipes`
9. App generates 3 recipe recommendations
10. Bottom section displays the 3 recipe cards

### Flow B: Voice refinement
1. User taps the microphone again
2. User says a refinement such as:
   - make it spicier
   - under 15 minutes
   - air fryer only
   - remove potatoes
3. App transcribes and interprets the utterance
4. App updates the draft state in the top section
5. App does **not** generate yet
6. User reviews the changes
7. User presses `Generate Recipes`
8. App refreshes the 3 recipe recommendations

### Flow C: Manual correction
1. User double-clicks Ingredients or Notes
2. Field becomes editable
3. User updates the value
4. App reparses the field into structured state
5. App marks recommendations as stale if draft != committed
6. User presses `Generate Recipes` to refresh recommendations

### Flow D: Recipe expansion
1. User sees 3 compact recipe cards
2. User taps one card
3. That card expands to show full details
4. Other cards remain collapsed

### Flow E: Save recipe snapshot
1. User expands or selects a recipe
2. User presses `Save`
3. App stores the recipe snapshot in Vercel Blob
4. Saved recipes list/view shows the snapshot later

### Flow F: View saved recipes
1. User opens saved recipes view
2. App lists saved recipe snapshots
3. User taps one
4. App displays the saved recipe snapshot
5. User may delete it, but not edit it

## 7. Functional requirements

### 7.1 Main workspace
- The app must have a single main workspace view
- The top section must display:
  - Ingredients
  - Notes
  - Mode
- The bottom section must display recipe recommendations
- The microphone button must be visible and easily accessible
- The layout must work well on mobile and desktop

### 7.2 Voice input
- The app must support tap-to-start voice input
- The app must transcribe user speech into text
- The app must interpret speech into a proposed state update
- The app must support voice updates such as:
  - adding ingredients
  - removing ingredients
  - changing cooking style
  - changing time constraints
  - changing diet preferences
  - changing mode
  - requesting different recipe direction
- Voice input must update the **draft** state, not auto-generate recommendations

### 7.3 Draft vs committed state
The app must maintain two separate recipe states:

- **Draft state**
  - The current visible parameters after interpretation or manual edits

- **Committed state**
  - The last parameter set used to generate the displayed recommendations

The app must:
- compare draft and committed state
- indicate when recommendations are out of date
- require explicit confirmation before generating recommendations from the draft state

### 7.4 Confirmation before generation
- The app must not automatically regenerate recommendations after voice input
- The app must require the user to confirm generation via a `Generate Recipes` action
- The app should show a visible stale/pending indicator when draft != committed

### 7.5 Inline editing
- Ingredients must support double-click editing
- Notes must support double-click editing
- On blur or save, edited content must be reparsed into structured state
- Mode must be editable via direct selection UI, not freeform text
- Manual corrections must affect the draft state only until confirmed

### 7.6 Modes
The app must support these modes:

#### Strict
- Recipe may only use ingredients explicitly listed by the user
- No extra ingredients allowed
- Recipe does not need to use all listed ingredients

#### Hybrid
- Recipe may use a sensible subset of listed ingredients
- Recipe may add a limited set of common pantry extras
- Pantry extras must come from a predefined app-controlled list

#### Anything
- Listed ingredients are available/preferred ingredients
- Recipe may use a sensible subset of listed ingredients
- Recipe may introduce additional ingredients freely if needed

### 7.7 Ingredient usage rule
- User-provided ingredients represent available inventory
- The system must not require recipes to use all listed ingredients
- Each recipe should use a meaningful subset of the available ingredients
- Each recommendation must show:
  - available ingredients used
  - available ingredients unused
  - extra ingredients needed

### 7.8 Recommendations
- The app must generate exactly 3 recipe options per generation cycle
- Each recommendation must contain:
  - id
  - title
  - summary
  - rationale
  - estimated total time
  - available ingredients used
  - available ingredients unused
  - extra ingredients needed
  - preparation steps
- Only one recommendation card may be expanded at a time
- Expanded details must be easy to scan on mobile

### 7.9 Follow-up refinement
- The app must support repeated voice-driven refinement cycles
- A follow-up must update the draft state
- The app must preserve the current working session state in memory
- The app is not required to display chat bubbles as the primary UI
- The UX should feel conversational through state updates, not through a chat transcript

### 7.10 Saved recipes
- The app must allow the user to save a selected generated recipe
- Saved recipes must be immutable snapshots
- Saved recipes must not be editable in MVP
- The app must support:
  - save
  - list
  - open
  - delete
- Saved recipes must persist in Vercel Blob storage
- The local filesystem must not be used for persistent saved data

## 8. Non-functional requirements

- Must be deployable to Vercel
- Must use Vercel Blob for persistent saved recipe storage
- Must not require SQL or relational database infrastructure
- Must be mobile-friendly
- Must handle AI or transcription failures gracefully
- Must provide acceptable responsiveness for interactive use
- Must keep architecture simple and maintainable for an MVP
- Must use server-side routes for sensitive storage operations

## 9. Technical architecture

## Frontend
Use **Next.js App Router** with TypeScript.

Recommended frontend responsibilities:
- microphone UI and listening state
- transcription initiation
- top parameter display and inline editing
- mode selector
- stale/pending state indicator
- generate action
- 3 recommendation cards with expandable details
- save action
- saved recipes list and detail views

## Backend/API
Use Next.js route handlers for server-side logic.

Recommended server responsibilities:
- transcription integration
- utterance interpretation
- recipe generation
- validation/repair
- save/list/get/delete saved recipes in Vercel Blob

## Storage
Use **Vercel Blob** for recipe snapshot storage.

Storage rules:
- one saved recipe per blob file
- blob content should be JSON
- do not use SQL
- do not rely on local disk persistence
- use blob path prefixes for organization

## AI pipeline
Recommended multi-step flow:
1. Transcribe audio to text
2. Interpret transcript into structured state patch
3. Let user review the draft
4. Generate recipe recommendations from committed confirmation
5. Validate output against mode and constraints
6. Repair or retry if validation fails

This is preferred over one giant prompt because it is easier to debug and improve.

## 10. Recommended routes

Implement route handlers like:

- `POST /api/transcribe`
  - input: recorded audio
  - output: transcript

- `POST /api/interpret-utterance`
  - input: transcript + current draft state
  - output: interpreted intent + state patch + updated draft state preview

- `POST /api/generate-recommendations`
  - input: confirmed recipe state
  - output: 3 recipe recommendations

- `POST /api/save-recipe`
  - input: selected recommendation + committed recipe state
  - output: saved snapshot metadata

- `GET /api/saved-recipes`
  - output: list of saved recipe snapshots or metadata

- `GET /api/saved-recipes/[id]`
  - output: one saved recipe snapshot

- `DELETE /api/saved-recipes/[id]`
  - deletes a saved recipe snapshot

## 11. Data model

```ts
export type RecipeMode = "strict" | "hybrid" | "anything";

export type ParsedConstraints = {
  maxMinutes?: number;
  methodTags?: string[];
  dietTags?: string[];
  flavorTags?: string[];
  exclusions?: string[];
};

export type RecipeState = {
  ingredients: string[];
  notesRaw: string;
  mode: RecipeMode;
  parsedConstraints: ParsedConstraints;
};

export type RecipeWorkspaceState = {
  draft: RecipeState;
  committed: RecipeState | null;
  hasPendingChanges: boolean;
};

export type Recommendation = {
  id: string;
  title: string;
  summary: string;
  rationale: string;
  totalMinutes?: number;
  availableIngredientsUsed: string[];
  availableIngredientsUnused: string[];
  extraIngredients: string[];
  steps: string[];
};

export type SavedRecipeSnapshot = {
  id: string;
  savedAt: string;
  recipeState: RecipeState;
  recommendation: Recommendation;
};
```

## 12. Blob storage design

Use one file per saved recipe snapshot.

Recommended blob pathname pattern:
```txt
saved-recipes/YYYY/MM/recipe_<id>.json
```

Each blob should contain a `SavedRecipeSnapshot` JSON document.

Do not maintain a single mutable index file as the source of truth.
Instead:
- store one blob per recipe
- list by prefix
- sort by saved timestamp in app/server logic

## 13. Pantry extras list for Hybrid mode

Define the Hybrid pantry extras list in code, not only in prompts.

Suggested initial extras:
- salt
- pepper
- oil
- butter
- vinegar
- soy sauce
- dried chili flakes
- paprika
- cumin
- dried herbs
- mustard

This list should be easy to change in a single configuration file.

## 14. Validation rules

Before returning generated recommendations, validate them against the confirmed state.

Validation requirements:
- Recipe must respect selected mode
- Recipe must respect explicit exclusions
- Recipe should respect maxMinutes when provided
- In Strict mode:
  - no extra ingredients allowed
- In Hybrid mode:
  - extra ingredients must be in the allowed pantry extras list
- Recipe does not need to use all listed ingredients
- The app should ensure the response includes both used and unused available ingredients

If validation fails:
- try a repair pass once
- otherwise regenerate once
- otherwise return a user-friendly error state

## 15. State interpretation rules

Speech should be interpreted into explicit intents and patches.

Example intents:
- `add_ingredients`
- `remove_ingredients`
- `update_notes`
- `update_constraints`
- `set_mode`
- `request_regeneration_direction`

Example response shape:
```ts
type InterpretedUtterance = {
  transcript: string;
  intent: string;
  statePatch: Partial<RecipeState>;
  explanation?: string;
};
```

The frontend should apply the patch to the draft state and wait for confirmation.

## 16. UI component plan

Recommended component structure:

```txt
app/
  page.tsx
  saved/page.tsx
  api/
    transcribe/route.ts
    interpret-utterance/route.ts
    generate-recommendations/route.ts
    save-recipe/route.ts
    saved-recipes/
      route.ts
      [id]/route.ts

components/
  Header.tsx
  RecipeWorkspace.tsx
  RecipeStatePanel.tsx
  EditableIngredientsField.tsx
  EditableNotesField.tsx
  ModeSelector.tsx
  GenerateButton.tsx
  PendingChangesBanner.tsx
  RecommendationsPanel.tsx
  RecommendationCard.tsx
  ExpandedRecipeDetails.tsx
  MicButton.tsx
  SavedRecipeButton.tsx
  SavedRecipeList.tsx

lib/
  ai/
    interpretUtterance.ts
    generateRecommendations.ts
    validateRecommendations.ts
    repairRecommendations.ts
  blob/
    saveRecipeSnapshot.ts
    listRecipeSnapshots.ts
    getRecipeSnapshot.ts
    deleteRecipeSnapshot.ts
  config/
    pantryExtras.ts
  state/
    applyStatePatch.ts
    recipeStateEquality.ts
  types/
    recipe.ts
```

## 17. UX behavior requirements

- After voice interpretation, the top section must visibly reflect the proposed changes
- The app should visually indicate pending changes when draft != committed
- The bottom recommendation section should remain unchanged until the user confirms generation
- The user must always understand whether the current recommendations match the visible parameters
- The mic button should remain the main call to action
- The Generate button should appear between the parameter section and recommendations section

## 18. Error handling

Handle these cases gracefully:

### Transcription failure
- Show a friendly error
- Keep the current draft unchanged
- Let the user retry

### Interpretation failure
- Show the transcript and allow manual editing
- Do not auto-generate

### Generation failure
- Keep the current workspace state
- Show retry action

### Save failure
- Show unsaved state and retry option
- Do not lose the recipe currently on screen

### No good recipe found
- Return 3 best-effort alternatives if possible
- Otherwise show a helpful empty/error state

## 19. Implementation notes for Codex

### Build priorities
Implement in this order:

1. Static main workspace UI matching the mockup
2. Editable top section with Ingredients, Notes, Mode
3. 3 expandable recommendation cards
4. Draft vs committed state model
5. Generate button workflow
6. Save snapshot workflow
7. Saved recipes list/detail view
8. Voice transcription integration
9. Utterance interpretation
10. Recommendation generation + validation

### Important constraints
- Keep the codebase simple and readable
- Prefer small reusable components
- Use TypeScript throughout
- Avoid overengineering
- Do not introduce auth
- Do not introduce SQL
- Do not use local filesystem for persistence
- Use Vercel Blob for saved recipe snapshots
- Do not auto-generate after speech interpretation
- Do not force recipes to use all provided ingredients

### Success criteria
The MVP is successful when:
- the user can speak available ingredients and preferences
- the app updates the top parameter section with interpreted changes
- the user can confirm generation explicitly
- the app returns 3 recipe options
- tapping a card expands full details
- the user can save a recipe snapshot
- saved snapshots persist via Vercel Blob
- recipes sensibly use a subset of available ingredients rather than forcing all ingredients

## 20. Optional stretch goals
Not required for MVP, but structure the code so these are easy later:
- favorites tag
- print view
- markdown export for a saved recipe
- stronger speech provider swap
- nutrition estimation
- shopping list generation

## 21. Final instruction to Codex

Build the MVP exactly around the state-driven workspace model described above.

Do not turn this into a chat-first UI.

The visual hierarchy must be:
1. top parameters section
2. explicit generate action
3. bottom recommendations section
4. persistent bottom microphone button

The top section must include **Ingredients**, **Notes**, and **Mode**.

The bottom section must show **3 recipe options**, each expandable on tap.

Voice input must update draft parameters and wait for explicit confirmation before generating.

Generated recipes should use a sensible subset of available ingredients and must **not** be required to use all listed ingredients.
