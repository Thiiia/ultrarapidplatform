// Defines the data schemas for users, schools, classes, assignments, scores,
// session telemetry, and content objects using Zod.

import { z } from "zod";

/**
 * Enums
 */
export const UserRoleSchema = z.enum(["student", "teacher", "admin", "editor"]);

export const UserStatusSchema = z.enum([
  "active",
  "inactive",
  "invited",
  "suspended",
]);

export const AssignmentStatusSchema = z.enum([
  "assigned",
  "in_progress",
  "completed",
  "overdue",
]);

export const ContentTypeSchema = z.enum([
  "game",
  "level",
  "lesson",
  "challenge",
  "asset_bundle",
]);

export const ContentStatusSchema = z.enum([
  "draft",
  "review",
  "published",
  "archived",
]);

export const SessionOutcomeSchema = z.enum([
  "completed",
  "quit",
  "timeout",
  "crash",
  "failed_launch",
]);

export const AppAreaSchema = z.enum([
  "auth",
  "teacher_dashboard",
  "student_dashboard",
  "editor",
  "launcher",
]);

export const EnvironmentSchema = z.enum([
  "development",
  "preview",
  "production",
]);

export const ScoreTypeSchema = z.enum([
  "auto",
  "manual",
  "final",
  "checkpoint",
]);

export const FailureStageSchema = z.enum([
  "auth",
  "download",
  "handoff",
  "runtime",
  "unknown",
]);

/**
 * Shared helpers
 */
export const IdSchema = z.string().min(1);
export const TimestampSchema = z
  .string()
  .datetime({ offset: true })
  .or(z.string().datetime());

/**
 * School
 */
export const SchoolSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),

  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

/**
 * User
 */
export const UserAnalyticsSchema = z.object({
  loginCount: z.number().int().min(0),
  totalHoursPlayed: z.number().min(0),
  totalLaunches: z.number().int().min(0),
  assignmentsCompleted: z.number().int().min(0),
  averageScore: z.number().min(0).max(100).optional(),
});

export const UserSchema = z.object({
  id: IdSchema,

  auth0Sub: z.string().min(1).optional(),

  role: UserRoleSchema,
  email: z.string().email(),
  name: z.string().min(1).nullable().optional(),
  displayName: z.string().min(1).optional(),

  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  avatarUrl: z.string().url().optional(),

  status: UserStatusSchema,

  schoolId: IdSchema.nullable().optional(),

  /**
   * These are API/view-model relationship fields.
   * Store the relationships in relational tables, not as copied arrays in Auth0.
   */
  classIds: z.array(IdSchema).optional(),
  studentIds: z.array(IdSchema).optional(),
  teacherIds: z.array(IdSchema).optional(),
  currentLessonIds: z.array(IdSchema).optional(),

  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  lastLoginAt: TimestampSchema.optional(),

  analytics: UserAnalyticsSchema.optional(),
});

/**
 * Class
 */
export const ClassSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  term: z.string().optional(),

  schoolId: IdSchema,

  teacherId: IdSchema,
  studentIds: z.array(IdSchema),

  assignmentIds: z.array(IdSchema),
  isArchived: z.boolean(),

  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

/**
 * Lesson
 */
export const LessonSchema = z.object({
  id: IdSchema,
  title: z.string().min(1),
  slug: z.string().min(1).optional(),
  description: z.string().optional(),

  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

/**
 * Assignment
 */
export const AssignmentSettingsSchema = z.object({
  maxAttempts: z.number().int().min(1).optional(),
  scoringMode: z.enum(["best", "latest", "average"]).optional(),
  passingScore: z.number().min(0).max(100).optional(),
  allowLateSubmission: z.boolean().optional(),
});

export const AssignmentSchema = z.object({
  id: IdSchema,
  title: z.string().min(1),
  description: z.string().optional(),

  createdByUserId: IdSchema,
  classId: IdSchema.optional(),
  studentId: IdSchema.optional(),

  lessonId: IdSchema.optional(),
  contentId: IdSchema.optional(),
  gameId: IdSchema.optional(),

  dueAt: TimestampSchema.optional(),
  availableFrom: TimestampSchema.optional(),
  availableUntil: TimestampSchema.optional(),

  status: AssignmentStatusSchema,

  settings: AssignmentSettingsSchema.optional(),

  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

/**
 * Score
 */
export const ScoreSchema = z.object({
  id: IdSchema,

  userId: IdSchema,
  classId: IdSchema.optional(),
  assignmentId: IdSchema,
  contentId: IdSchema.optional(),
  lessonId: IdSchema.optional(),
  gameId: IdSchema.optional(),
  sessionId: IdSchema.optional(),
  launchId: IdSchema.optional(),

  rawScore: z.number().min(0),
  maxScore: z.number().positive(),
  percentScore: z.number().min(0).max(100),
  passed: z.boolean().optional(),

  attemptNumber: z.number().int().min(1),
  scoreType: ScoreTypeSchema,

  submittedAt: TimestampSchema,
  createdAt: TimestampSchema,
});

/**
 * Session telemetry
 */
export const SessionTelemetryMetadataSchema = z.object({
  startupTimeMs: z.number().int().min(0).optional(),
  failureCode: z.string().optional(),
  failureStage: FailureStageSchema.optional(),
  deviceType: z.string().optional(),
  browser: z.string().optional(),
  os: z.string().optional(),
});

export const SessionTelemetrySchema = z.object({
  id: IdSchema,
  sessionId: IdSchema,
  launchId: IdSchema,

  userId: IdSchema,
  role: UserRoleSchema,
  classId: IdSchema.optional(),
  assignmentId: IdSchema.optional(),
  contentId: IdSchema.optional(),
  lessonId: IdSchema.optional(),
  gameId: IdSchema.optional(),

  appArea: AppAreaSchema,
  environment: EnvironmentSchema,

  loginAt: TimestampSchema.optional(),
  launchRequestedAt: TimestampSchema.optional(),
  launchSucceededAt: TimestampSchema.optional(),
  playStartedAt: TimestampSchema.optional(),
  playEndedAt: TimestampSchema.optional(),

  durationSeconds: z.number().int().min(0).optional(),
  outcome: SessionOutcomeSchema.optional(),

  metadata: SessionTelemetryMetadataSchema.optional(),

  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

/**
 * Content object
 */
export const ContentConfigSchema = z.object({
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  estimatedMinutes: z.number().int().min(0).optional(),
  gradeBand: z.string().optional(),
  subject: z.string().optional(),
  launcherEnabled: z.boolean().optional(),
});

export const ContentPublishSchema = z.object({
  publishedAt: TimestampSchema.optional(),
  archivedAt: TimestampSchema.optional(),
  reviewNotes: z.string().optional(),
});

export const ContentObjectSchema = z.object({
  id: IdSchema,
  title: z.string().min(1),
  slug: z.string().min(1),

  type: ContentTypeSchema,
  status: ContentStatusSchema,
  version: z.number().int().min(1),

  authorId: IdSchema,
  lastEditedByUserId: IdSchema.optional(),

  summary: z.string().optional(),
  thumbnailUrl: z.string().url().optional(),

  tags: z.array(z.string()),

  config: ContentConfigSchema.optional(),
  publish: ContentPublishSchema.optional(),

  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

/**
 * Dashboard API schemas
 */
export const StudentDashboardDataSchema = z.object({
  id: IdSchema,
  name: z.string().nullable(),
  email: z.string().email(),
  school: SchoolSchema.pick({
    id: true,
    name: true,
  }).nullable(),
  classes: z.array(
    z.object({
      id: IdSchema,
      name: z.string(),
      teacher: z.object({
        id: IdSchema,
        name: z.string().nullable(),
        email: z.string().email(),
      }),
    }),
  ),
  teachers: z.array(
    z.object({
      id: IdSchema,
      name: z.string().nullable(),
      email: z.string().email(),
    }),
  ),
  currentLessons: z.array(
    z.object({
      assignmentId: IdSchema,
      title: z.string(),
      slug: z.string().nullable().optional(),
      status: AssignmentStatusSchema,
      dueAt: z.date().nullable().optional(),
      className: z.string().nullable(),
      teacherName: z.string(),
    }),
  ),
});

export const TeacherDashboardDataSchema = z.object({
  id: IdSchema,
  name: z.string().nullable(),
  email: z.string().email(),
  school: SchoolSchema.pick({
    id: true,
    name: true,
  }).nullable(),
  classes: z.array(
    z.object({
      id: IdSchema,
      name: z.string(),
      studentCount: z.number().int().min(0),
      assignments: z.array(
        z.object({
          id: IdSchema,
          title: z.string(),
          status: AssignmentStatusSchema,
          dueAt: z.date().nullable().optional(),
          lessonTitle: z.string(),
        }),
      ),
    }),
  ),
  students: z.array(
    z.object({
      id: IdSchema,
      name: z.string().nullable(),
      email: z.string().email(),
      classIds: z.array(IdSchema),
      classNames: z.array(z.string()),
    }),
  ),
});

/**
 * Inferred TypeScript types
 */
export type UserRole = z.infer<typeof UserRoleSchema>;
export type UserStatus = z.infer<typeof UserStatusSchema>;
export type AssignmentStatus = z.infer<typeof AssignmentStatusSchema>;
export type ContentType = z.infer<typeof ContentTypeSchema>;
export type ContentStatus = z.infer<typeof ContentStatusSchema>;
export type SessionOutcome = z.infer<typeof SessionOutcomeSchema>;
export type AppArea = z.infer<typeof AppAreaSchema>;
export type Environment = z.infer<typeof EnvironmentSchema>;
export type ScoreType = z.infer<typeof ScoreTypeSchema>;

export type School = z.infer<typeof SchoolSchema>;
export type User = z.infer<typeof UserSchema>;
export type Class = z.infer<typeof ClassSchema>;
export type Lesson = z.infer<typeof LessonSchema>;
export type Assignment = z.infer<typeof AssignmentSchema>;
export type Score = z.infer<typeof ScoreSchema>;
export type SessionTelemetry = z.infer<typeof SessionTelemetrySchema>;
export type ContentObject = z.infer<typeof ContentObjectSchema>;

export type StudentDashboardData = z.infer<typeof StudentDashboardDataSchema>;
export type TeacherDashboardData = z.infer<typeof TeacherDashboardDataSchema>;

/**
 * Optional create/update variants
 */
export const CreateSchoolSchema = SchoolSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  id: IdSchema.optional(),
  createdAt: TimestampSchema.optional(),
  updatedAt: TimestampSchema.optional(),
});

export const UpdateSchoolSchema = SchoolSchema.partial().extend({
  id: IdSchema,
});

export const CreateUserSchema = UserSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
}).extend({
  id: IdSchema.optional(),
  createdAt: TimestampSchema.optional(),
  updatedAt: TimestampSchema.optional(),
});

export const UpdateUserSchema = UserSchema.partial().extend({
  id: IdSchema,
});

export const CreateClassSchema = ClassSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  id: IdSchema.optional(),
  createdAt: TimestampSchema.optional(),
  updatedAt: TimestampSchema.optional(),
});

export const UpdateClassSchema = ClassSchema.partial().extend({
  id: IdSchema,
});

export const CreateLessonSchema = LessonSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  id: IdSchema.optional(),
  createdAt: TimestampSchema.optional(),
  updatedAt: TimestampSchema.optional(),
});

export const UpdateLessonSchema = LessonSchema.partial().extend({
  id: IdSchema,
});

export const CreateAssignmentSchema = AssignmentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  id: IdSchema.optional(),
  createdAt: TimestampSchema.optional(),
  updatedAt: TimestampSchema.optional(),
});

export const UpdateAssignmentSchema = AssignmentSchema.partial().extend({
  id: IdSchema,
});

export const CreateScoreSchema = ScoreSchema.omit({
  id: true,
  createdAt: true,
}).extend({
  id: IdSchema.optional(),
});

export const UpdateScoreSchema = ScoreSchema.partial().extend({
  id: IdSchema,
});

export const CreateSessionTelemetrySchema = SessionTelemetrySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  id: IdSchema.optional(),
  createdAt: TimestampSchema.optional(),
  updatedAt: TimestampSchema.optional(),
});

export const UpdateSessionTelemetrySchema = SessionTelemetrySchema.partial().extend({
  id: IdSchema,
});

export const CreateContentObjectSchema = ContentObjectSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  id: IdSchema.optional(),
  createdAt: TimestampSchema.optional(),
  updatedAt: TimestampSchema.optional(),
});

export const UpdateContentObjectSchema = ContentObjectSchema.partial().extend({
  id: IdSchema,
});