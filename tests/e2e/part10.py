# Part 10 (2.9, updated for 3.2): the 12 former practice rooms live inside the 18-week lessons.
# - no "ห้องฝึก" menu or cards; #/rooms -> #/learn; every #/room/rN and the old step URLs (/challenge, /solve, /extra,
#   /challenge/rN) lead to the one practical of the week (#/lesson/wN/lab; 3.2 removed the optional review sets and step 4)
# - all 18 weeks: 5-step rail, a practical plan (Guided / Independent / Troubleshooting or analysis) whose simulator missions
#   open the right mission
# - Linux VM missions (Terminal Simulator in the browser): every one of the 27 is in exactly one week's practical
# - a student with 2.8 room answers: merge-rooms credits the kept week copy, the 3.2 migration keeps it as a "ระบบเดิม"
#   result of the week practical (nothing asked twice), XP unchanged, teacher report and student results agree; phone and desktop
# usage: E2E_BASE=http://127.0.0.1:3990 E2E_DATABASE_URL=postgres://... python3 tests/e2e/part10.py <out-dir>
import asyncio, sys, json, os, subprocess
from playwright.async_api import async_playwright
OUT=sys.argv[1]; BASE=os.environ.get('E2E_BASE','http://127.0.0.1:3990')
DB=os.environ.get('E2E_DATABASE_URL','postgres://postgres@127.0.0.1:5433/netlab_e2e')
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
H={'X-NetLab':'1'}
issues=[]
def bad(m): issues.append(m); print('  ✗',m)
def ok(m): print('  ✓',m)
def check(c,m): ok(m) if c else bad(m)
def sql(q): return subprocess.check_output(['psql',DB,'-tAc',q]).decode().strip()
async def login(ctx,u,p):
    r=await ctx.request.post(BASE+'/api/auth/login',data={'username':u,'password':p},headers=H); assert r.ok, await r.text()
INFO=json.loads(subprocess.check_output(['node','-e',"""
const {ROOMS}=require('./content/labs');
console.log(JSON.stringify({host:Object.fromEntries(ROOMS.map(r=>[r.id,r.host]))}))"""],cwd=ROOT))
STEPS=['ก่อนเรียน','เนื้อหา','ฝึกปฏิบัติ','หลังเรียน','สรุปผล']
# the 3.2 migration (server/practical.js migrate) runs once at start-up; to test it on data made here it is run again by hand
MIGRATE="""const db=require('./server/db'),P=require('./server/practical');(async()=>{await db.init(process.env.DATABASE_URL);await P.migrate();await db.close();})().catch(e=>{console.error(e);process.exit(1)})"""

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
            await pg.goto(BASE+'/#/room/'+rid)
            try: await pg.wait_for_selector(f'#prPage[data-week="{host}"]',timeout=8000)   # the previous week's page may still be on screen for a moment
            except Exception: pass
            if not pg.url.endswith(f'#/lesson/{host}/lab'): wrong.append(rid+' -> '+pg.url.split('#')[1])
            if await pg.locator('.rail .rstep').count()!=5 or await pg.locator('#prPage').get_attribute('data-week')!=host: wrong.append(rid+' rail/page')
        check(not wrong,'all 12 old room URLs open the practical of their week (5-step rail) '+'; '.join(wrong[:3]))
        await pg.goto(BASE+'/#/lesson/w9/challenge/r9'); await pg.wait_for_selector('#prPage'); await pg.wait_for_timeout(300)
        check(pg.url.endswith('#/lesson/w9/lab'),'an old challenge-room URL (#/lesson/w9/challenge/r9) opens the week practical')

        print('== all 18 weeks: 5 steps, old step URLs redirect, a practical plan with simulator missions')
        probs=[]
        for w in range(1,19):
            await pg.goto(BASE+f'/#/lesson/w{w}'); await pg.wait_for_selector('.rail')
            labels=[s.strip().split('\n')[0] for s in await pg.locator('.rail .rstep .rl').all_inner_texts()]
            if labels!=STEPS: probs.append(f'w{w} rail {labels}')
            for old in ('challenge','solve','extra'):
                await pg.goto(BASE+f'/#/lesson/w{w}/{old}'); await pg.wait_for_selector(f'#prPage[data-week="w{w}"]'); await pg.wait_for_timeout(150)
                if not pg.url.endswith(f'#/lesson/w{w}/lab'): probs.append(f'w{w} /{old} -> {pg.url.split("#")[1]}')
            await pg.wait_for_selector('#prPlan .prplanpart')
            parts=await pg.eval_on_selector_all('#prPlan .prplanpart','e=>e.map(x=>x.dataset.part)')
            nm=await pg.locator('#prPlan .prplanitem[data-kind=mission]').count()
            if parts[0]!='guided' or 'trouble' not in parts or nm==0: probs.append(f'w{w} plan parts {parts}, missions {nm}')
            if await pg.locator('#app a[href$="/extra"], #app a[href$="/solve"], #app a[href*="/challenge"]').count(): probs.append(f'w{w} still links to an old step')
        check(not probs,'every week has the 5 steps; /challenge, /solve and /extra open the practical; the plan has Guided first, a Troubleshooting (or analysis) part and simulator missions '+'; '.join(probs[:4]))
        check(not E,'no JS errors (guest) '+'; '.join(E[:2])); await C.close()

        # 3.3: the missions of the plan open in the Embedded Virtual Lab of the practical page (a teacher previews them;
        # students open them once the timer runs), not through a link to the simulator page
        T=await b.new_context(viewport={'width':1366,'height':860}); await login(T,'kru4','Teach1234'); tp=await T.new_page(); TE=[]; tp.on('pageerror',lambda e:TE.append(str(e)))
        await tp.goto(BASE+'/#/lesson/w13/lab'); await tp.wait_for_selector('#prPlan .prplanitem[data-kind=mission] .prOpenSim')
        check(await tp.locator('#prPlan a[href^="#/sim/"]').count()==0,'the plan has no links to the simulator pages')
        lk=tp.locator('#prPlan .prplanitem[data-kind=mission] .prOpenSim').first; key=await lk.get_attribute('data-key'); await lk.click()
        await tp.wait_for_selector(f'#prWs[data-key="{key}"][data-mode=preview] #prWsSim .nls-embedded',timeout=15000); await tp.wait_for_timeout(600)
        sim,mid=key.split(':'); info=await T.request.get(BASE+f'/api/practical/w13/mission/{sim}/{mid}',headers={'X-NetLab':'1'})
        title=(await info.json())['sim']['missions'][0]['title']
        check(tp.url.endswith('#/lesson/w13/lab') and (await tp.inner_text('#prWsTitle')).strip()==title and title in await tp.inner_text('#prWsSim'),f'mission {key} opens embedded in the practical page with that mission ({title})')
        await tp.screenshot(path=f'{OUT}/p10_simlink.png')
        check(not TE,'no JS errors (teacher on the student pages) '+'; '.join(TE[:2])); await T.close()

        print('== Linux VM missions: all 27 in exactly one week practical')
        S=await b.new_context(viewport={'width':1366,'height':860}); await login(S,'s1','Stud1234')
        vm={}; keys={}; dup=[]
        for w in range(1,19):
            st=await (await S.request.get(BASE+f'/api/practical/w{w}',headers=H)).json()
            for part in st['parts']:
                for it in part['items']:
                    if it['key'] in keys: dup.append(it['key'])
                    keys[it['key']]=f'w{w}'
                    if it.get('vm'): vm.setdefault(f'w{w}',[]).append(it['key'])
        total=sum(len(v) for v in vm.values())
        check(total==27,f'27 Linux VM missions in total ({total}: {dict((k,len(v)) for k,v in vm.items())})')
        check(not dup,f'no item is in two weeks ({dup[:3]})')
        # one VM week in the UI: the VM panel is shown with its tasks once the practical runs
        wvm=sorted(vm,key=lambda x:int(x[1:]))[0]
        pg=await S.new_page(); E=[]; pg.on('pageerror',lambda e:E.append(str(e)))
        await pg.goto(BASE+f'/#/lesson/{wvm}/lab'); await pg.wait_for_selector('#prStart'); await pg.click('#prStart'); await pg.wait_for_selector('#prClock')
        n=await pg.locator('#prPanel .pritem[data-kind=task]').count()
        vmrows=await pg.eval_on_selector_all('#prPanel .pritem[data-kind=task]','e=>e.map(x=>x.dataset.key)')
        check(await pg.locator('#prPanel .vmhead').count()==1 and await pg.locator('#prPanel .vmstatus').count()==1 and await pg.locator('#prPanel button:has-text("เปิดเครื่องจำลอง")').count()==1
              and all(k in vmrows for k in vm[wvm]),f'{wvm}: the Guided part shows the Linux VM panel (Terminal Simulator in the browser) and its {len(vm[wvm])} VM tasks ({n} tasks shown)')
        check('Virtual Machine' not in await pg.inner_text('#prPanel'),'the VM panel does not call the simulator a real Virtual Machine')
        await pg.screenshot(path=f'{OUT}/p10_vm_panel.png')
        s_,j=(await S.request.post(BASE+f'/api/practical/{wvm}/submit',headers=H)).status,None
        check(s_==200,'the VM week practical submitted (frees the timer for the next checks)')
        check(not E,'no JS errors '+'; '.join(E[:2])); await pg.close()

        print('== student with 2.8 room answers: migrations and scores')
        uid=sql("SELECT id FROM users WHERE username='s2'")
        # what 2.8 stored: room answers only (r9-0 and r9-1 are now merged into w8, r9-vm0 into w12-vm0, r9-4 stays in retired r9)
        sql(f"""INSERT INTO lab_runs(user_id,lab_id,started_at,deadline,ended_at,status) VALUES({uid},'r9',now()-interval '2 day',now()-interval '2 day'+interval '30 min',now()-interval '2 day'+interval '20 min','finished');
                INSERT INTO task_progress(user_id,task_key,lab_id,attempts,hint_used,solved,points,solved_at) VALUES
                ({uid},'r9-0','r9',0,false,true,10,now()-interval '2 day'),({uid},'r9-1','r9',1,false,true,8,now()-interval '2 day'),
                ({uid},'r9-4','r9',0,false,true,10,now()-interval '2 day'),({uid},'r9-vm0','r9',0,false,true,10,now()-interval '2 day');
                INSERT INTO attempt_log(user_id,task_key,lab_id,correct,answer) VALUES ({uid},'r9-0','r9',true,'lab-pc07');""")
        S2=await b.new_context(viewport={'width':1366,'height':860}); await login(S2,'s2','Stud1234')
        xp_before=(await (await S2.request.get(BASE+'/api/game/me')).json()).get('xp',{}).get('total')
        sql("DELETE FROM app_migrations WHERE id='2.9-merge-rooms'")
        raw=subprocess.check_output(['node','scripts/merge-rooms.js','--apply'],cwd=ROOT,env={**os.environ,'DATABASE_URL':DB}).decode(); out=json.loads(raw[raw.index('{'):])
        check(out.get('inserted',0)>=3,f'2.9 migration credited the kept copies ({out.get("inserted")} inserted, backup {out.get("backupTable")})')
        check(sql(f"SELECT string_agg(task_key||':'||points,',' ORDER BY task_key) FROM task_progress WHERE user_id={uid} AND linked_from IS NOT NULL")=='w12-vm0:10,w8-0:10,w8-1:8','w8-0, w8-1 and w12-vm0 credited with the original points')
        check(sql(f"SELECT count(*) FROM task_progress WHERE user_id={uid} AND task_key LIKE 'r9-%'")=='4','original room rows kept as history')
        sql("DELETE FROM app_migrations WHERE id='practical-1'")
        subprocess.check_output(['node','-e',MIGRATE],cwd=ROOT,env={**os.environ,'DATABASE_URL':DB})
        leg=sql(f"SELECT string_agg(lesson_id,',' ORDER BY lesson_id) FROM practical_sessions WHERE user_id={uid} AND status='legacy'")
        check(leg=='w12,w8',f'3.2 migration: the earlier work became "ระบบเดิม" results of weeks 8 and 12 ({leg})')
        xp_after=(await (await S2.request.get(BASE+'/api/game/me')).json()).get('xp',{}).get('total')
        check(xp_before is not None and xp_before==xp_after,f'XP unchanged by the migrations ({xp_before} -> {xp_after})')
        st8=await (await S2.request.get(BASE+'/api/practical/w8',headers=H)).json()
        for vw,vh,mob in [(1366,860,False),(360,740,True)]:
            T=await b.new_context(viewport={'width':vw,'height':vh},has_touch=mob,is_mobile=mob); await login(T,'s2','Stud1234'); pg=await T.new_page(); E=[]; pg.on('pageerror',lambda e:E.append(str(e)))
            await pg.goto(BASE+'/#/lesson/w8/lab'); await pg.wait_for_selector('#prResult')
            check(await pg.get_attribute('#prResult','data-status')=='legacy' and await pg.locator('.prresitem[data-key="w8-0"][data-passed=true]').count()==1 and await pg.locator('.prresitem[data-key="w8-1"][data-passed=true]').count()==1,
                  f'{vw}px: week 8 practical shows the merged questions as passed in the "ระบบเดิม" result (not asked again)')
            check((await pg.inner_text('#prTotal')).strip()==f"{st8['best']['total']}%",f'{vw}px: the old result total is the server total ({st8["best"]["total"]}%)')
            check(await pg.locator('#prStart').count()==1 and await pg.get_attribute('#prStart','data-retake') is None,f'{vw}px: the old result uses no attempt: "เริ่มฝึกปฏิบัติ" is still the first round')
            ov=await pg.evaluate('document.scrollingElement.scrollWidth-innerWidth'); check(ov<=0,f'{vw}px: no horizontal scroll on the practical result')
            await pg.screenshot(path=f'{OUT}/p10_w8_legacy_{vw}.png',full_page=True)
            await pg.goto(BASE+'/#/results'); await pg.wait_for_selector('.rescards',state='attached'); await pg.wait_for_timeout(500)
            rt=await pg.inner_text('#app'); check('ภารกิจท้าทาย' not in rt and 'ฝึกทบทวนเพิ่มเติม' not in rt,f'{vw}px: results page has no challenge / optional review column')
            lab=await pg.evaluate("(()=>{const t=document.querySelector('.restable tr[data-week=w8] td[data-step=lab]');const c=[...document.querySelectorAll('.rescard')][7];return (t&&t.offsetParent?t:c.querySelector('[data-step=lab] dd')).textContent})()")
            check(lab.startswith(f"{st8['best']['total']}%"),f'{vw}px: results page shows the week 8 practical result ({lab})')
            ov=await pg.evaluate('document.scrollingElement.scrollWidth-innerWidth'); check(ov<=0,f'{vw}px: results page fits')
            check(not E,f'{vw}px: no JS errors '+'; '.join(E[:2])); await T.close()
        ans=await S2.request.post(BASE+'/api/check',data={'key':'r9-0','answer':'lab-pc07'},headers=H)
        check(ans.status in (409,410),f'answering a former room question is refused ({ans.status})')

        print('== teacher view')
        Tc=await b.new_context(viewport={'width':1280,'height':900}); await login(Tc,'kru4','Teach1234')
        cid=sql("SELECT id FROM classes LIMIT 1")
        m=await (await Tc.request.get(BASE+f'/api/teacher/classes/{cid}/practical',headers=H)).json()
        row=next(s for s in m['students'] if s['id']==int(uid))
        check(row['weeks']['w8'] and row['weeks']['w8']['legacy'] and row['weeks']['w8']['best']==st8['best']['total'],f"teacher practical matrix: week 8 = the old result {row['weeks']['w8']}")
        tp=await Tc.new_page(); TE=[]; tp.on('pageerror',lambda e:TE.append(str(e)))
        await tp.goto(BASE+'/teacher.html'); await tp.wait_for_selector('.side'); await tp.locator('.side .navbtn').nth(1).click(); await tp.wait_for_selector('.tabs')
        await tp.locator('.tabs button',has_text='งานที่มอบหมาย').click(); await tp.wait_for_selector('#assignForm .labpick')
        lp=await tp.inner_text('#assignForm .labpick')
        check(await tp.locator('#assignForm .labpick input[type=checkbox]').count()==18 and 'ฝึกทบทวนเพิ่มเติม' not in lp and 'ห้อง 9 เดิม' not in lp,'teacher assigns the 18 week practicals; the former review sets are gone from the picker')
        await tp.locator('.tabs button',has_text='ประวัติ (ระบบเดิม)').click(); await tp.wait_for_selector('table.histm')
        hr=tp.locator('table.histm tr',has_text='สมหญิง ทดสอบ')
        check(await hr.count()==1 and '10' in await hr.inner_text(),'the history tab still shows the student\'s old room score')
        await tp.screenshot(path=f'{OUT}/p10_teacher_history.png',full_page=True)
        check(not TE,'no JS errors on the teacher page '+'; '.join(TE[:2]))
        await b.close()
    print(f'\npart10: {len(issues)} issue(s)'); sys.exit(1 if issues else 0)
asyncio.run(main())
