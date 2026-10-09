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
