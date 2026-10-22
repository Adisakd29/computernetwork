// WIPES the database, then creates: teacher kru4 / Teach1234, class P4 (all weeks open), students s1,s2 / Stud1234
process.chdir(require('path').join(__dirname,'..','..'));
const db=require('../../server/db'), auth=require('../../server/auth');
(async()=>{
  await db.init(process.env.DATABASE_URL);
  await db.q('TRUNCATE users,classes RESTART IDENTITY CASCADE');
  const t=(await db.q("INSERT INTO users(username,password_hash,display_name,role,must_change_pw) VALUES('kru4',$1,'ครูทดสอบ','teacher',false) RETURNING id",[await auth.hashPassword('Teach1234')])).rows[0].id;
  // the fixture class behaves like a class that existed before Progressive Unlock (all weeks open, one post-test);
  // sequential learning is tested by part17 with classes of its own
  const legacy=require('../../server/path').merge(require('../../content/learning-path').LEGACY_CLASS);
  const c=(await db.q("INSERT INTO classes(name,code,teacher_id,path) VALUES('ปวช.2/4','P4P4P4',$1,$2) RETURNING id",[t,JSON.stringify(legacy)])).rows[0].id;
  for(const [u,n,no] of [['s1','สมชาย ทดสอบ','1'],['s2','สมหญิง ทดสอบ','2']])
    await db.q("INSERT INTO users(username,password_hash,display_name,role,class_id,student_no,must_change_pw) VALUES($1,$2,$3,'student',$4,$5,false)",[u,await auth.hashPassword('Stud1234'),n,c,no]);
  console.log('setup ok class',c); await db.close();
})().catch(e=>{console.error(e);process.exit(1);});
