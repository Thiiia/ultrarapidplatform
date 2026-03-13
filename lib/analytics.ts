// lib/analytics.ts
import { track } from '@vercel/analytics'

export type UserRole = 'teacher' | 'student' | 'admin'
export type AppArea =
  | 'auth'
  | 'teacher_dashboard'
  | 'student_dashboard'
  | 'editor'
  | 'launcher'

type CommonProps = {
  role: UserRole
  user_id_hash: string
  session_id: string
  environment: 'development' | 'preview' | 'production'
  app_area: AppArea
  timestamp: string
  class_id?: string
  assignment_id?: string
  game_id?: string
  launch_id?: string
  content_id?: string
  score_type?: 'auto' | 'manual' | 'final' | 'checkpoint'
  attempt_number?: number
}

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
  | "score_submitted";

export function trackEvent(
  event: AnalyticsEvent,
  props: CommonProps & Record<string, string | number | boolean | undefined>
) {
  track(event, props)
}