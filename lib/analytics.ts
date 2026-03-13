// lib/analytics.ts
import { track } from "@vercel/analytics";
import { track as trackServer } from "@vercel/analytics/server";
import type {
  AppArea,
  Environment,
  ScoreType,
  UserRole,
} from "@/lib/schemas";

export type AnalyticsEvent =
  | "login_completed"
  | "logout_completed"
  | "play_session_started"
  | "play_session_ended"
  | "game_launch_requested"
  | "game_launch_succeeded"
  | "game_launch_failed"
  | "assignment_viewed"
  | "assignment_completed"
  | "score_submitted"
  | "score_submission_failed";

export type AnalyticsCommonProps = {
  role: UserRole;
  user_id_hash?: string;
  session_id?: string;
  environment: Environment;
  app_area: AppArea;
  timestamp: string;
  class_id?: string;
  assignment_id?: string;
  game_id?: string;
  launch_id?: string;
  content_id?: string;
  score_type?: ScoreType;
  attempt_number?: number;
};

export type AnalyticsProps = AnalyticsCommonProps &
  Record<string, string | number | boolean | undefined>;

export function getEnvironment(): Environment {
  if (process.env.VERCEL_ENV === "production") return "production";
  if (process.env.VERCEL_ENV === "preview") return "preview";
  return "development";
}

export function createTimestamp(): string {
  return new Date().toISOString();
}

export async function trackEventServer(
  event: AnalyticsEvent,
  props: AnalyticsProps
) {
  try {
    await trackServer(event, props);
  } catch (error) {
    console.error(`Failed to track server event "${event}":`, error);
  }
}

export function trackEventClient(
  event: AnalyticsEvent,
  props: AnalyticsProps
) {
  try {
    track(event, props);
  } catch (error) {
    console.error(`Failed to track client event "${event}":`, error);
  }
}

/**
 * Optional helper builders for common events
 */
export function buildLoginCompletedEvent(input: {
  role: UserRole;
  user_id_hash?: string;
  session_id?: string;
  login_method: string;
  success: boolean;
}) {
  return {
    event: "login_completed" as const,
    props: {
      role: input.role,
      user_id_hash: input.user_id_hash,
      session_id: input.session_id,
      environment: getEnvironment(),
      app_area: "auth" as const,
      timestamp: createTimestamp(),
      login_method: input.login_method,
      success: input.success,
    },
  };
}

export function buildAssignmentViewedEvent(input: {
  role: UserRole;
  user_id_hash?: string;
  session_id?: string;
  assignment_id: string;
  class_id?: string;
  view_source?: string;
  assignment_status?: string;
}) {
  return {
    event: "assignment_viewed" as const,
    props: {
      role: input.role,
      user_id_hash: input.user_id_hash,
      session_id: input.session_id,
      environment: getEnvironment(),
      app_area: "student_dashboard" as const,
      timestamp: createTimestamp(),
      assignment_id: input.assignment_id,
      class_id: input.class_id,
      view_source: input.view_source,
      assignment_status: input.assignment_status,
    },
  };
}

export function buildLaunchRequestedEvent(input: {
  role: UserRole;
  user_id_hash?: string;
  session_id?: string;
  assignment_id?: string;
  game_id: string;
  launch_id: string;
  launch_source?: string;
}) {
  return {
    event: "game_launch_requested" as const,
    props: {
      role: input.role,
      user_id_hash: input.user_id_hash,
      session_id: input.session_id,
      environment: getEnvironment(),
      app_area: "launcher" as const,
      timestamp: createTimestamp(),
      assignment_id: input.assignment_id,
      game_id: input.game_id,
      launch_id: input.launch_id,
      launch_source: input.launch_source,
    },
  };
}

export function buildScoreSubmittedEvent(input: {
  role: UserRole;
  user_id_hash?: string;
  session_id?: string;
  assignment_id: string;
  game_id?: string;
  launch_id?: string;
  score_type: ScoreType;
  score_value: number;
  max_score: number;
  percent_score: number;
  attempt_number: number;
}) {
  return {
    event: "score_submitted" as const,
    props: {
      role: input.role,
      user_id_hash: input.user_id_hash,
      session_id: input.session_id,
      environment: getEnvironment(),
      app_area: "launcher" as const,
      timestamp: createTimestamp(),
      assignment_id: input.assignment_id,
      game_id: input.game_id,
      launch_id: input.launch_id,
      score_type: input.score_type,
      score_value: input.score_value,
      max_score: input.max_score,
      percent_score: input.percent_score,
      attempt_number: input.attempt_number,
    },
  };
}