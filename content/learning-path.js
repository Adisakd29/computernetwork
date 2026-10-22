'use strict';
/* NetLab Progressive Unlock: the ONLY place where the default rules live. A class may override any of them
   (classes.path JSONB, edited on the teacher page); students without a class use DEFAULTS.
   sequential   weeks open in order: week N needs week N-1 Completed (or a teacher unlock); week 1 is always open
   require      which conditions make a week Completed (the pre-test score itself never locks anything)
     pre          the pre-test was taken
     content      every core section was read (supplementary sections are optional)
     checks       every in-lesson exercise of the core sections was answered correctly
     practice     (3.2) the best practical session of the week ("ฝึกปฏิบัติ": Guided + Independent + Troubleshooting under one
                  timer, server/practical.js) scored at least practical.passPct with the class weights
     post         the post-test (best attempt) scored at least passPct
     (before 3.2: guided = every Guided mission >= guidedPct, solve = every step-4 main mission >= guidedPct. A stored
      setting with those keys is read as practice = guided || solve; see merge() in server/path.js)
   practical    the practical session: passPct, weights of the three parts (percent, sum 100; a part a week does not
                have is left out and the others are scaled up), maxAttempts, cooldownMin between attempts (best attempt counts)
   post         post-test attempts: maxAttempts, cooldownMin between attempts, review = when the answer key is shown
                ('pass-or-last' = after passing or after the last allowed attempt; 'always' = after every attempt)
   openDates    optional { w5: 'YYYY-MM-DD' }: a week also waits for its date (a teacher unlock skips the date) */
const DEFAULTS = Object.freeze({
  sequential: true,
  passPct: 70,
  require: Object.freeze({ pre: true, content: true, checks: true, practice: true, post: true }),
  practical: Object.freeze({ passPct: 70, weights: Object.freeze({ guided: 30, independent: 40, trouble: 30 }), maxAttempts: 3, cooldownMin: 10 }),
  post: Object.freeze({ maxAttempts: 3, cooldownMin: 10, review: 'pass-or-last' }),
  openDates: Object.freeze({})
});
/* classes that existed before Progressive Unlock: unchanged behaviour until their teacher turns it on
   (written once by the migration in server/path.js; one post-test attempt with the answer key, as before) */
const LEGACY_CLASS = Object.freeze({ sequential: false, post: Object.freeze({ maxAttempts: 1, cooldownMin: 0, review: 'always' }) });
const LIMITS = Object.freeze({ passPct: [40, 100], practicalPct: [40, 100], weight: [0, 100], maxAttempts: [1, 10], cooldownMin: [0, 1440] });
const REQUIRE_LABEL = Object.freeze({
  pre: 'ทำแบบทดสอบก่อนเรียน',
  content: 'อ่านเนื้อหาหลักครบทุกหัวข้อ',
  checks: 'ทำแบบฝึกหัดระหว่างเรียนถูกครบทุกข้อ',
  practice: 'ผ่านฝึกปฏิบัติรวมตามเกณฑ์',
  post: 'แบบทดสอบหลังเรียนผ่านเกณฑ์'
});
/* the three parts of a practical session, in the order students do them */
const PARTS = Object.freeze([
  Object.freeze({ id: 'guided', title: 'Guided Lab', th: 'ฝึกตามขั้นตอน' }),
  Object.freeze({ id: 'independent', title: 'Independent Lab', th: 'ฝึกด้วยตนเอง' }),
  Object.freeze({ id: 'trouble', title: 'Troubleshooting Lab', th: 'ฝึกแก้ปัญหาเครือข่าย' })
]);
module.exports = { DEFAULTS, LEGACY_CLASS, LIMITS, REQUIRE_LABEL, PARTS };
