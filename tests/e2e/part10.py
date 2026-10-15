# Part 10 (2.9): the 12 practice rooms merged into the 18-week lessons.
# - no "ห้องฝึก" menu or cards; #/rooms and every #/room/rN lead to the challenge inside its week
# - all 18 weeks: 6-step rail, challenge page, lab page with simulator links that open the right mission
# - Linux VM missions: every one of the 27 is reachable once (r5 in its challenge, r9-r12 in the week labs)
# - a student with 2.8 room answers: migration credits the kept week copy, nothing is asked twice, XP unchanged,
#   teacher matrix and student results agree; phone and desktop
# usage: python3 tests/e2e/part10.py <out-dir>
import asyncio, sys, json, os, subprocess
from playwright.async_api import async_playwright
OUT=sys.argv[1]; BASE='http://127.0.0.1:3990'
DB=os.environ.get('E2E_DATABASE_URL','postgres://postgres@127.0.0.1:5433/netlab_e2e')
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
issues=[]
def bad(m): issues.append(m); print('  ✗',m)
def ok(m): print('  ✓',m)
def check(c,m): ok(m) if c else bad(m)
def sql(q): return subprocess.check_output(['psql',DB,'-tAc',q]).decode().strip()
async def login(ctx,u,p):
    r=await ctx.request.post(BASE+'/api/auth/login',data={'username':u,'password':p},headers={'X-NetLab':'1'}); assert r.ok, await r.text()
INFO=json.loads(subprocess.check_output(['node','-e',"""
const {ROOMS,VMX}=require('./content/labs');const c=require('./server/content');
console.log(JSON.stringify({host:Object.fromEntries(ROOMS.map(r=>[r.id,r.host])),twins:[...c.TWINS].map(([a,b])=>[a,b.key]),
 vm:ROOMS.filter(r=>r.vmTasks).map(r=>[r.id,r.vmTasks.length,r.vmShared||null])}))"""],cwd=ROOT))

async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        print('== navigation: one learning menu')
        C=await b.new_context(viewport={'width':1366,'height':860}); pg=await C.new_page(); E=[]; pg.on('pageerror',lambda e:E.append(str(e)))
        await pg.goto(BASE+'/#/'); await pg.wait_for_selector('#side nav')
        nav=await pg.inner_text('#side nav'); check('ห้องฝึก' not in nav and 'บทเรียน 18 สัปดาห์' in nav,'sidebar has no "ห้องฝึก 12 ห้อง"; "บทเรียน 18 สัปดาห์" stays')
        body=await pg.inner_text('#app'); check('ห้องฝึก 12 ห้อง' not in body,'dashboard has no card pointing to the old room list')
        await pg.goto(BASE+'/#/rooms'); await pg.wait_for_timeout(500); check(pg.url.endswith('#/learn'),'#/rooms redirects to the lesson list')
        wrong=[]
        for rid,host in INFO['host'].items():
            await pg.goto(BASE+'/#/room/'+rid); await pg.wait_for_selector('.roomhead',timeout=8000)
            if not pg.url.endswith(f'#/lesson/{host}/challenge/{rid}'): wrong.append(rid+' -> '+pg.url.split('#')[1])
            if await pg.locator('.rail .rstep.on').inner_text()=='' : wrong.append(rid+' rail')
        check(not wrong,'all 12 old room URLs open the challenge inside its week '+'; '.join(wrong[:3]))
        await pg.goto(BASE+'/#/lesson/w8/challenge/r9'); await pg.wait_for_timeout(500)
        check(pg.url.endswith('#/lesson/w9/challenge/r9'),'a related challenge opened from another week redirects to its own week (one copy)')

        print('== all 18 weeks: steps, challenge page, lab with simulator links')
        probs=[]
        for w in range(1,19):
            await pg.goto(BASE+f'/#/lesson/w{w}'); await pg.wait_for_selector('.rail')
            steps=[x.strip() for x in await pg.locator('.rail .rstep .rl').all_inner_texts()]
            labels=[s.split('\n')[0] for s in steps]
            if labels!=['ก่อนเรียน','เนื้อหา','ฝึกปฏิบัติ','ภารกิจท้าทาย','หลังเรียน','สรุปผล']: probs.append(f'w{w} rail {labels}')
            await pg.goto(BASE+f'/#/lesson/w{w}/challenge'); await pg.wait_for_selector('.panel h2')
            if await pg.locator('.room.chal').count()==0: probs.append(f'w{w} challenge page has no challenge (own or related)')
            await pg.goto(BASE+f'/#/lesson/w{w}/lab'); await pg.wait_for_selector('.roomhead')
            n_lab=await pg.locator('.simlinks a').count()
            if n_lab==0:   # 3.0: a week may have only troubleshooting missions, shown on its challenge page
                await pg.goto(BASE+f'/#/lesson/w{w}/challenge'); await pg.wait_for_selector('.panel h2'); await pg.wait_for_timeout(300)
                if await pg.locator('.simlinks a').count()==0: probs.append(f'w{w} has no simulator missions on its lab or challenge page')
        check(not probs,'every week has the 6 steps, a challenge page and simulator links '+'; '.join(probs[:4]))
        await pg.goto(BASE+'/#/lesson/w13/lab'); await pg.wait_for_selector('.simlinks a')
        href=await pg.locator('.simlinks a').first.get_attribute('href'); await pg.locator('.simlinks a').first.click()
        sim,ms=href.split('/')[2],href.split('/')[3]
        await pg.wait_for_function('document.querySelector(".simroot") && document.querySelector(".simroot").children.length>0',timeout=15000); await pg.wait_for_timeout(600)
        act=await pg.evaluate("(()=>{const e=document.querySelector('.simroot [aria-pressed=\"true\"], .simroot .nls-topology-on, .simroot [class*=\"-on\"]');return e?e.textContent:''})()")
        check(len(act)>0,f'simulator link {href} opens the simulator with a mission selected')
        await pg.screenshot(path=f'{OUT}/p10_simlink.png')
        check(not E,'no JS errors (guest) '+'; '.join(E[:2]))

        print('== Linux VM missions: all 27 reachable exactly once')
        await pg.evaluate("localStorage.setItem('netlab-v2',JSON.stringify({name:'ทดสอบ VM'}))"); await pg.reload(); await pg.wait_for_timeout(500)   # guests need a name before Start
        pg.on('dialog',lambda d: asyncio.ensure_future(d.accept()))
        total=0; where=[]
        for rid,n,shared in INFO['vm']:
            total+=n
            if shared:
                await pg.goto(BASE+f'/#/lesson/{shared}/lab'); await pg.wait_for_selector('.roomhead')
                st=pg.locator('.btn.start')
                if await st.count(): await st.click(); await pg.wait_for_timeout(300)
                cnt=await pg.locator(f'[id^="task-{shared}-vm"]').count()
                where.append((rid,shared,cnt==n and await pg.locator('.vmstatus').count()>0 and await pg.locator('button:has-text("เปิด Linux VM")').count()>0))
                await pg.goto(BASE+f'/#/lesson/{INFO["host"][rid]}/challenge/{rid}'); await pg.wait_for_selector('.roomhead')
                note=await pg.inner_text('.mergenote') if await pg.locator('.mergenote').count() else ''
                where.append((rid+' note',shared,'ภารกิจ Linux VM' in note and await pg.locator(f'[id^="task-{rid}-vm"]').count()==0))
            else:
                await pg.goto(BASE+f'/#/lesson/{INFO["host"][rid]}/challenge/{rid}'); await pg.wait_for_selector('.roomhead')
                st=pg.locator('.btn.start')
                if await st.count(): await st.click(); await pg.wait_for_timeout(300)
                cnt=await pg.locator(f'[id^="task-{rid}-vm"]').count()
                where.append((rid,rid,cnt==n and await pg.locator('.vmstatus').count()>0 and await pg.locator('button:has-text("เปิด Linux VM")').count()>0))
        check(total==27,f'27 Linux VM missions in total ({total})')
        check(all(x[2] for x in where),'each VM mission set is shown once with the VM panel, rooms point to the week lab: '+str([x for x in where if not x[2]]))
        await pg.screenshot(path=f'{OUT}/p10_vm_note.png'); await C.close()

        print('== student with 2.8 room answers: migration and scores')
        uid=sql("SELECT id FROM users WHERE username='s1'")
        # what 2.8 stored: room answers only (r9-0 and r9-1 are now merged into w8, r9-vm0 into w12-vm0, r9-4 stays in r9)
        sql(f"""INSERT INTO lab_runs(user_id,lab_id,started_at,deadline,ended_at,status) VALUES({uid},'r9',now()-interval '2 day',now()-interval '2 day'+interval '30 min',now()-interval '2 day'+interval '20 min','finished');
                INSERT INTO task_progress(user_id,task_key,lab_id,attempts,hint_used,solved,points,solved_at) VALUES
                ({uid},'r9-0','r9',0,false,true,10,now()-interval '2 day'),({uid},'r9-1','r9',1,false,true,8,now()-interval '2 day'),
                ({uid},'r9-4','r9',0,false,true,10,now()-interval '2 day'),({uid},'r9-vm0','r9',0,false,true,10,now()-interval '2 day');
                INSERT INTO attempt_log(user_id,task_key,lab_id,correct,answer) VALUES ({uid},'r9-0','r9',true,'lab-pc07');""")
        S=await b.new_context(viewport={'width':1366,'height':860}); await login(S,'s1','Stud1234')
        xp_before=(await (await S.request.get(BASE+'/api/game/me')).json()).get('xp',{}).get('total')
        sql("DELETE FROM app_migrations WHERE id='2.9-merge-rooms'")
        raw=subprocess.check_output(['node','scripts/merge-rooms.js','--apply'],cwd=ROOT,env={**os.environ,'DATABASE_URL':DB}).decode(); out=json.loads(raw[raw.index('{'):])
        check(out.get('inserted',0)>=3,f'migration credited the kept copies ({out.get("inserted")} inserted, backup {out.get("backupTable")})')
        check(sql(f"SELECT string_agg(task_key||':'||points,',' ORDER BY task_key) FROM task_progress WHERE user_id={uid} AND linked_from IS NOT NULL")=='w12-vm0:10,w8-0:10,w8-1:8','w8-0, w8-1 and w12-vm0 credited with the original points')
        check(sql(f"SELECT count(*) FROM task_progress WHERE user_id={uid} AND task_key LIKE 'r9-%'")=='4','original room rows kept as history')
        xp_after=(await (await S.request.get(BASE+'/api/game/me')).json()).get('xp',{}).get('total')
        check(xp_before is not None and xp_before==xp_after,f'XP unchanged by the migration ({xp_before} -> {xp_after})')
        for vw,vh,mob in [(1366,860,False),(390,844,True)]:
            T=await b.new_context(viewport={'width':vw,'height':vh},has_touch=mob,is_mobile=mob); await login(T,'s1','Stud1234'); pg=await T.new_page(); E=[]; pg.on('pageerror',lambda e:E.append(str(e)))
            await pg.goto(BASE+'/#/lesson/w8/lab'); await pg.wait_for_selector('.roomhead')
            if await pg.locator('.btn.start').count(): await pg.locator('.btn.start').click(); await pg.wait_for_selector('#task-w8-0')
            check(await pg.locator('#task-w8-0.solved').count()==1 and await pg.locator('#task-w8-1.solved').count()==1,f'{vw}px: week 8 lab shows the merged questions already solved (no need to answer again)')
            await pg.goto(BASE+'/#/lesson/w9/challenge/r9'); await pg.wait_for_selector('.roomhead'); await pg.wait_for_selector('#task-r9-4.solved',timeout=8000)
            check(await pg.locator('#task-r9-0').count()==0 and await pg.locator('#task-r9-4.solved').count()==1,f'{vw}px: challenge r9 hides merged copies and keeps its own solved answer')
            check('สัปดาห์ 8' in await pg.inner_text('.mergenote'),f'{vw}px: challenge explains where the merged questions went')
            ov=await pg.evaluate('document.documentElement.scrollWidth-innerWidth'); check(ov<=0,f'{vw}px: no horizontal scroll on the challenge')
            await pg.screenshot(path=f'{OUT}/p10_r9_{vw}.png',full_page=True)
            await pg.goto(BASE+'/#/lesson/w9/challenge'); await pg.wait_for_selector('.room.chal')
            txt=await pg.inner_text('.room.chal >> nth=0'); check('10/40' in txt and '15 นาที' in txt and 'เต็ม 40 คะแนน' in txt,f'{vw}px: challenge card shows score, time and full marks ({txt.splitlines()[-2:]})')
            await pg.screenshot(path=f'{OUT}/p10_challenges_{vw}.png',full_page=True)
            await pg.goto(BASE+'/#/lesson/w9/summary'); await pg.wait_for_selector('.compare')
            st=await pg.inner_text('#app'); check('ภารกิจท้าทาย' in st and 'หัวข้อที่ควรทบทวน' in st,f'{vw}px: summary shows challenge score and what to review')
            await pg.goto(BASE+'/#/results'); await pg.wait_for_timeout(800)
            check('ภารกิจท้าทาย' in await pg.inner_text('#app'),f'{vw}px: results page has the challenge column/total')
            ov=await pg.evaluate('document.documentElement.scrollWidth-innerWidth'); check(ov<=0,f'{vw}px: results page fits')
            check(not E,f'{vw}px: no JS errors '+'; '.join(E[:2])); await T.close()
        ans=await S.request.post(BASE+'/api/check',data={'key':'r9-0','answer':'lab-pc07'},headers={'X-NetLab':'1'})
        check(ans.status==410,'answering a merged copy is refused with a pointer to the week lab')

        print('== teacher view')
        Tc=await b.new_context(viewport={'width':1280,'height':900}); await login(Tc,'kru4','Teach1234')
        cid=sql("SELECT id FROM classes LIMIT 1")
        rep=await (await Tc.request.get(BASE+f'/api/teacher/classes/{cid}/report')).json()
        row=[r for r in rep['rows'] if r['username']=='s1'][0]
        check(row['labs']['r9']['points']==10 and row['labs']['w8']['points']==18 and row['labs']['w12']['points']==10,f"teacher matrix: r9 10, w8 18, w12 10 ({row['labs'].get('r9',{}).get('points')}, {row['labs'].get('w8',{}).get('points')}, {row['labs'].get('w12',{}).get('points')})")
        check([l for l in rep['labs'] if l['id']=='r9'][0]['max']==40,'teacher matrix: r9 full marks now 40 (4 questions)')
        tp=await Tc.new_page(); TE=[]; tp.on('pageerror',lambda e:TE.append(str(e)))
        await tp.goto(BASE+'/teacher.html'); await tp.wait_for_selector('.side'); await tp.locator('.side .navbtn').nth(1).click(); await tp.wait_for_selector('.tabs')
        await tp.locator('.tabs button',has_text='งานที่มอบหมาย').click(); await tp.wait_for_selector('.labpick')
        lp=await tp.inner_text('.labpick'); check('ภารกิจท้าทายในบทเรียน' in lp and 'ห้อง 9 เดิม' in lp,'teacher can still assign challenges and sees the old room number')
        await tp.screenshot(path=f'{OUT}/p10_teacher_assign.png',full_page=True)
        check(not TE,'no JS errors on the teacher page '+'; '.join(TE[:2]))
        await b.close()
    print(f'\npart10: {len(issues)} issue(s)'); sys.exit(1 if issues else 0)
asyncio.run(main())
