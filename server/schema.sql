-- NetLab database schema (PostgreSQL). Safe to run on every start.
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('student','teacher','admin')),
  class_id      INTEGER,
  student_no    TEXT,
  must_change_pw BOOLEAN NOT NULL DEFAULT FALSE,
  disabled      BOOLEAN NOT NULL DEFAULT FALSE,
  created_by    INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS classes (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  code        TEXT NOT NULL UNIQUE,
  teacher_id  INTEGER NOT NULL REFERENCES users(id),
  join_open   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_class_fk FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

-- one timed run per student per lab
CREATE TABLE IF NOT EXISTS lab_runs (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lab_id      TEXT NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deadline    TIMESTAMPTZ NOT NULL,
  ended_at    TIMESTAMPTZ,
  status      TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','finished','timeout')),
  PRIMARY KEY (user_id, lab_id)
);

-- one row per student per task; points are computed by the server only
CREATE TABLE IF NOT EXISTS task_progress (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_key    TEXT NOT NULL,
  lab_id      TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  wrong_seen  JSONB NOT NULL DEFAULT '[]'::jsonb,
  hint_used   BOOLEAN NOT NULL DEFAULT FALSE,
  solved      BOOLEAN NOT NULL DEFAULT FALSE,
  points      INTEGER NOT NULL DEFAULT 0,
  solved_at   TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, task_key)
);
CREATE INDEX IF NOT EXISTS task_progress_lab_idx ON task_progress(user_id, lab_id);

-- every submitted answer, for history and "most missed" statistics
CREATE TABLE IF NOT EXISTS attempt_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_key    TEXT NOT NULL,
  lab_id      TEXT NOT NULL,
  correct     BOOLEAN NOT NULL,
  answer      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS attempt_log_task_idx ON attempt_log(task_key);
CREATE INDEX IF NOT EXISTS attempt_log_user_idx ON attempt_log(user_id);

CREATE TABLE IF NOT EXISTS assignments (
  id          SERIAL PRIMARY KEY,
  class_id    INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  lab_id      TEXT NOT NULL,
  due_at      TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, lab_id)
);

-- pre-test / post-test: one official attempt each per lesson
CREATE TABLE IF NOT EXISTS quiz_attempts (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id   TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('pre','post')),
  answers     JSONB NOT NULL,
  results     JSONB NOT NULL,
  score       INTEGER NOT NULL,
  max         INTEGER NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id, kind)
);

-- lesson reading progress and in-lesson exercises
CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id   TEXT NOT NULL,
  visited     JSONB NOT NULL DEFAULT '[]'::jsonb,
  checks      JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);

-- simulator missions: best score per student per mission
CREATE TABLE IF NOT EXISTS sim_results (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sim         TEXT NOT NULL,
  mission     TEXT NOT NULL,
  best        INTEGER NOT NULL DEFAULT 0,
  max         INTEGER NOT NULL,
  last        INTEGER NOT NULL DEFAULT 0,
  attempts    INTEGER NOT NULL DEFAULT 0,
  first_full_at TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, sim, mission)
);

-- practice-mode answers (question bank)
CREATE TABLE IF NOT EXISTS bank_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  qid         TEXT NOT NULL,
  correct     BOOLEAN NOT NULL,
  score       REAL NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bank_log_user_idx ON bank_log(user_id);

-- teacher-made exams drawn from the bank
CREATE TABLE IF NOT EXISTS exams (
  id          SERIAL PRIMARY KEY,
  class_id    INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  config      JSONB NOT NULL,
  minutes     INTEGER NOT NULL,
  open_at     TIMESTAMPTZ,
  close_at    TIMESTAMPTZ,
  show_review BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  INTEGER REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS exam_attempts (
  exam_id     INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  qids        JSONB NOT NULL,
  answers     JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deadline    TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  score       REAL,
  max         INTEGER,
  results     JSONB,
  PRIMARY KEY (exam_id, user_id)
);

-- Phase 5: gamification and analytics
ALTER TABLE users   ADD COLUMN IF NOT EXISTS lb_public   BOOLEAN NOT NULL DEFAULT FALSE;  -- student agrees to show name on class leaderboard
ALTER TABLE classes ADD COLUMN IF NOT EXISTS leaderboard BOOLEAN NOT NULL DEFAULT FALSE;  -- teacher turns the class leaderboard on

-- one row per student per active day (local time), written after successful learning actions
CREATE TABLE IF NOT EXISTS activity (
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day      DATE NOT NULL,
  actions  INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, day)
);

-- badges are computed from server-graded data and stored the first time they are earned
CREATE TABLE IF NOT EXISTS user_badges (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge     TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen      BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (user_id, badge)
);

-- weekly challenge goals completed (xp is fixed when stored)
CREATE TABLE IF NOT EXISTS challenge_done (
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week     TEXT NOT NULL,
  goal     TEXT NOT NULL,
  xp       INTEGER NOT NULL,
  done_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, week, goal)
);

-- 2.4: guest progress linked into an account, password-reset requests sent to the teacher
ALTER TABLE lab_runs ADD COLUMN IF NOT EXISTS imported BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS reset_requests (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS reset_requests_open_idx ON reset_requests(user_id) WHERE resolved_at IS NULL;
-- 2.4 part 4: which form of the lesson quiz was used (A = pre-test items, B = parallel post-test)
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS form TEXT NOT NULL DEFAULT 'A';
ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS last_section TEXT;   -- where the student was reading (resume)

-- 2.7: personal accounts (email + password, Google sign-in), profile fields, email links. Additive only:
-- existing accounts keep username/password and all scores (everything is keyed by users.id).
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;                    -- lower-case
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS student_code TEXT;             -- school student id (optional)
ALTER TABLE users ADD COLUMN IF NOT EXISTS grade_level TEXT;              -- e.g. ปวช.2 (optional)
ALTER TABLE users ADD COLUMN IF NOT EXISTS room_name TEXT;                -- e.g. 2/4 (optional)
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;                   -- 'c0'..'c7' colour badge, or 'google'
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;               -- Google profile picture (only shown when avatar='google')
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_method TEXT;            -- 'teacher' | 'classcode' | 'email' | 'google'
CREATE UNIQUE INDEX IF NOT EXISTS users_email_uq ON users (email) WHERE email IS NOT NULL;

-- sign-in methods proven by an identity provider (provider + subject is the identity, never the e-mail text)
CREATE TABLE IF NOT EXISTS auth_identities (
  provider    TEXT NOT NULL,
  subject     TEXT NOT NULL,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  PRIMARY KEY (provider, subject)
);
CREATE INDEX IF NOT EXISTS auth_identities_user_idx ON auth_identities(user_id);

-- one-time links sent by e-mail (verify address / reset password); only the hash is stored
CREATE TABLE IF NOT EXISTS email_tokens (
  token_hash  TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose     TEXT NOT NULL CHECK (purpose IN ('verify','reset')),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_tokens_user_idx ON email_tokens(user_id, purpose);

-- 2.8: simulator work that a teacher reviews with a rubric (capstone, troubleshooting reports). Latest attempts are kept;
-- the automatic score still goes to sim_results as before, the teacher's rubric scores live here.
CREATE TABLE IF NOT EXISTS sim_submissions (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sim           TEXT NOT NULL,
  mission       TEXT NOT NULL,
  payload       JSONB NOT NULL,
  problem       JSONB,
  auto_score    INTEGER NOT NULL,
  auto_max      INTEGER NOT NULL,
  rubric        JSONB NOT NULL DEFAULT '[]'::jsonb,      -- automatic criteria [{id,title,score,max,note}]
  report        TEXT,
  teacher_scores JSONB,                                  -- {criterionId: score}
  teacher_comment TEXT,
  reviewed_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sim_submissions_user_idx ON sim_submissions(user_id, sim, mission, created_at DESC);

-- 2.9: practice rooms merged into the 18-week lessons ------------------------------------------------------------
-- linked_from: this row was credited from an identical task the student had already solved elsewhere (a merged room
-- question, or the same Linux VM mission done inside a practice room). Points are kept so the week lab shows the real
-- result, but XP, streaks and "new activity" ignore linked rows so nothing is counted twice.
ALTER TABLE task_progress ADD COLUMN IF NOT EXISTS linked_from TEXT;
-- one-time data migrations (id, when, summary); a migration never runs twice
CREATE TABLE IF NOT EXISTS app_migrations (
  id      TEXT PRIMARY KEY,
  ran_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  info    JSONB
);

-- 3.0 Phase 5: Student Network Skills Portfolio (docs/MIGRATION-3.0-P5.md) --------------------------------------
-- Additive only: three new tables and one new column with a default. No existing row or column is changed.
-- evidence a teacher observed in class (real equipment, oral checks), level 1-4 of content/rubrics.js OBS_LEVELS
CREATE TABLE IF NOT EXISTS skill_observations (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill       TEXT NOT NULL,
  level       SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 4),
  title       TEXT NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  week        SMALLINT CHECK (week BETWEEN 1 AND 18),
  observed_on DATE NOT NULL DEFAULT CURRENT_DATE,
  teacher_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS skill_observations_user_idx ON skill_observations(user_id);
-- the student's reflection and the teacher's comment per skill ('capstone' and 'overall' are also allowed keys)
CREATE TABLE IF NOT EXISTS portfolio_notes (
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill           TEXT NOT NULL,
  reflection      TEXT NOT NULL DEFAULT '',
  reflected_at    TIMESTAMPTZ,
  teacher_comment TEXT NOT NULL DEFAULT '',
  commented_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  commented_at    TIMESTAMPTZ,
  PRIMARY KEY (user_id, skill)
);
-- capstone presentation and defense, scored by the teacher with content/rubrics.js CAPSTONE (1-4 per criterion)
CREATE TABLE IF NOT EXISTS capstone_reviews (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  scores      JSONB NOT NULL DEFAULT '{}'::jsonb,
  comment     TEXT NOT NULL DEFAULT '',
  teacher_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- class option: the post-test of a week opens only after the week's Guided Lab missions are passed (off by default)
ALTER TABLE classes ADD COLUMN IF NOT EXISTS require_practice BOOLEAN NOT NULL DEFAULT FALSE;
-- 3.0 Phase 6: a generated simulator problem counts for the score only once (token nonce); later submits are practice
CREATE TABLE IF NOT EXISTS sim_tokens_used (
  nonce    TEXT PRIMARY KEY,
  user_id  INTEGER REFERENCES users(id) ON DELETE CASCADE,
  used_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sim_tokens_used_at_idx ON sim_tokens_used(used_at);

-- Progressive Unlock (docs/MIGRATION-PATH.md) ---------------------------------------------------------------------
-- Additive only. classes.path = the class's learning-path rules (NULL = defaults of content/learning-path.js).
-- Classes that existed before this version are set to the legacy rules once by server/path.js (migration 'path-1').
ALTER TABLE classes ADD COLUMN IF NOT EXISTS path JSONB;
-- a week marked Completed stays Completed (raising the pass mark later never takes it back)
CREATE TABLE IF NOT EXISTS week_completions (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id    TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  criteria     JSONB NOT NULL DEFAULT '{}'::jsonb,       -- rules and results at the moment it was completed
  PRIMARY KEY (user_id, lesson_id)
);
-- weeks opened outside the normal order: by a teacher (one student or a whole class) or kept open for work done before
-- the class used sequential learning ('legacy'); revoked rows stay as history
CREATE TABLE IF NOT EXISTS path_unlocks (
  id          SERIAL PRIMARY KEY,
  class_id    INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  lesson_id   TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('teacher','legacy','settings')),   -- settings = a rule change (history only)
  reason      TEXT NOT NULL DEFAULT '',
  actor_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at  TIMESTAMPTZ,
  revoked_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  CHECK (class_id IS NOT NULL OR user_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS path_unlocks_user_idx ON path_unlocks(user_id);
CREATE INDEX IF NOT EXISTS path_unlocks_class_idx ON path_unlocks(class_id);
-- when sequential learning first applied to a student (and in which class): earlier work is checked once at that moment
CREATE TABLE IF NOT EXISTS path_activation (
  user_id      INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  class_id     INTEGER,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  report       JSONB NOT NULL DEFAULT '{}'::jsonb
);
-- every post-test attempt (quiz_attempts keeps the best one, which the existing reports read)
CREATE TABLE IF NOT EXISTS quiz_attempt_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id   TEXT NOT NULL,
  kind        TEXT NOT NULL,
  answers     JSONB NOT NULL,
  results     JSONB NOT NULL,
  score       INTEGER NOT NULL,
  max         INTEGER NOT NULL,
  form        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  voided_at   TIMESTAMPTZ                                  -- a teacher reset: kept as history, no longer counted
);
CREATE INDEX IF NOT EXISTS quiz_attempt_log_user_idx ON quiz_attempt_log(user_id, lesson_id, kind);
