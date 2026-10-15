'use strict';
/* NetLab Progressive Unlock: the ONLY place where the default rules live. A class may override any of them
   (classes.path JSONB, edited on the teacher page); students without a class use DEFAULTS.
   sequential   weeks open in order: week N needs week N-1 Completed (or a teacher unlock); week 1 is always open
   require      which conditions make a week Completed (the pre-test score itself never locks anything)
     pre          the pre-test was taken
     content      every core section was read (supplementary sections are optional)
     checks       every in-lesson exercise of the core sections was answered correctly
     guided       every Guided Lab mission of the week (content/curriculum.js) scored at least guidedPct
     post         the post-test (best attempt) scored at least passPct
   post         post-test attempts: maxAttempts, cooldownMin between attempts, review = when the answer key is shown
                ('pass-or-last' = after passing or after the last allowed attempt; 'always' = after every attempt)
   openDates    optional { w5: 'YYYY-MM-DD' }: a week also waits for its date (a teacher unlock skips the date) */
const DEFAULTS = Object.freeze({
  sequential: true,
  passPct: 70,
  guidedPct: 70,
  require: Object.freeze({ pre: true, content: true, checks: true, guided: true, post: true }),
  post: Object.freeze({ maxAttempts: 3, cooldownMin: 10, review: 'pass-or-last' }),
  openDates: Object.freeze({})
});
/* classes that existed before Progressive Unlock: unchanged behaviour until their teacher turns it on
   (written once by the migration in server/path.js; one post-test attempt with the answer key, as before) */
const LEGACY_CLASS = Object.freeze({ sequential: false, post: Object.freeze({ maxAttempts: 1, cooldownMin: 0, review: 'always' }) });
const LIMITS = Object.freeze({ passPct: [40, 100], guidedPct: [40, 100], maxAttempts: [1, 10], cooldownMin: [0, 1440] });
const REQUIRE_LABEL = Object.freeze({
  pre: 'ทำแบบทดสอบก่อนเรียน',
  content: 'อ่านเนื้อหาหลักครบทุกหัวข้อ',
  checks: 'ทำแบบฝึกหัดระหว่างเรียนถูกครบทุกข้อ',
  guided: 'ผ่าน Guided Lab (ภารกิจปฏิบัติหลัก) ของสัปดาห์',
  post: 'แบบทดสอบหลังเรียนผ่านเกณฑ์'
});
module.exports = { DEFAULTS, LEGACY_CLASS, LIMITS, REQUIRE_LABEL };
