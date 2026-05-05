import type { UserProfileSummary, WorkoutPlan } from './workout';

export type MobileWorkspacesResponse = {
  workspaces: string[];
};

export type MobileProfileResponse = {
  profile: UserProfileSummary | null;
};

export type MobilePlanResponse = {
  plan: WorkoutPlan | null;
};

export type MobileApiErrorResponse = {
  error: string;
};
