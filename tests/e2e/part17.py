# Part 17: Progressive Unlock (sequential learning path) in a real browser.
# Statuses with icon + text, URL skipping (lock panel, no content), unlock toast once, dashboard "เรียนต่อจากจุดล่าสุด",
# 3.2: a week needs its practical passed (one session per week); post-test retakes (attempts left, cooldown, no answer key), simulator 403, teacher tab (pass mark, unlock one student,
# history, revoke, sequential on/off), guest banner, 360 px layout, dark theme, axe-core.
# usage: E2E_BASE=http://127.0.0.1:3990 E2E_DATABASE_URL=postgres://... python3 tests/e2e/part17.py <out-dir>
#   (needs the tests/e2e/setup.js fixture: teacher kru4 / Teach1234; it creates its own class, which uses sequential learning)
import asyncio, sys, os, subprocess, json, time
from playwright.async_api import async_playwright
OUT=sys.argv[1] if len(sys.argv)>1 else '/tmp/netlab-e2e'; os.makedirs(OUT,exist_ok=True)
BASE=os.environ.get('E2E_BASE','http://127.0.0.1:3990')
DB=os.environ.get('E2E_DATABASE_URL','postgres://postgres@127.0.0.1:5433/netlab_e2e')
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AXE_PATH=os.path.join(ROOT,'node_modules','axe-core','axe.min.js')
AXE_RUN="async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return r.violations.map(v=>v.id+'('+v.impact+'):'+v.nodes.length+' '+v.nodes.slice(0,2).map(n=>n.target.join(' ')).join(' | '))}"
LOCK9='ต้องผ่านสัปดาห์ที่ 9 ก่อน จึงจะสามารถเรียนบทเรียนนี้ได้'
GUEST='โหมดผู้เยี่ยมชม: อ่านบทเรียนได้ทุกสัปดาห์ แต่ความก้าวหน้าจะไม่ถูกบันทึกและไม่มีการปลดล็อก เข้าสู่ระบบเพื่อเรียนตามลำดับ'
H={'X-NetLab':'1'}
issues=[]
def bad(m): issues.append(m); print('  ✗',m)
def ok(m): print('  ✓',m)
def check(c,m): ok(m) if c else bad(m)
def sql(q): return subprocess.check_output(['psql',DB,'-tAqc',q]).decode().strip()
# right / wrong answers of weeks 1 and 2, computed from the lesson files (as tests/path.test.js does)
KEYS=json.loads(subprocess.check_output(['node','-e',r"""
const { LESSONS, formOf } = require('./server/lessons'); const { WEEKS } = require('./content/curriculum');
const right = q => q.type === 'choice' ? q.correct : q.type === 'multi' ? q.correct : q.type === 'tf' ? q.answer : q.answers[0];
const wrongOf = q => q.type === 'choice' ? (q.correct + 1) % q.options.length : q.type === 'tf' ? !q.answer : q.type === 'multi' ? [0, 1, 2].filter(i => !q.correct.includes(i)).slice(0, 1).concat(q.correct.length ? [] : [0]) : 'zz-wrong';
const out = {};
for (const wid of ['w1', 'w2']) { const L = LESSONS.get(wid); let n = 0; const checks = [];
  for (const s of L.sections) for (const b of s.blocks) if (b.type === 'check') { if (!s.extra) checks.push({ key: `L:${wid}:c:${n}`, answer: right(b.q) }); n++; }
  const post = formOf(L, 'post');
  out[wid] = { sections: L.sections.filter(s => !s.extra).map(s => s.id), checks, pre: L.quiz.length, postRight: post.map(right), postWrong: post.map(wrongOf),
    guided: WEEKS.find(w => w.id === wid).guided, w10: LESSONS.get('w10').sections.map(s => s.title) };
}
console.log(JSON.stringify(out));"""],cwd=ROOT))

async def post(ctx,path,body=None):
    r=await ctx.request.post(BASE+path,data=body or {},headers=H); return r.status,(await r.json() if r.headers.get('content-type','').startswith('application/json') else {})
async def get(ctx,path):
    r=await ctx.request.get(BASE+path,headers=H); return await r.json()
async def login(ctx,u,p):
    s,j=await post(ctx,'/api/auth/login',{'username':u,'password':p}); assert s==200, j
async def complete_week(ctx,uid,wid):
    k=KEYS[wid]
    await post(ctx,f'/api/lessons/{wid}/quiz',{'kind':'pre','answers':[0]*k['pre']})
    for s in k['sections']: await post(ctx,f'/api/lessons/{wid}/visit',{'section':s})
    for c in k['checks']: await post(ctx,f'/api/lessons/{wid}/check',c)
    await pass_practical(ctx,uid,wid)
    return await post(ctx,f'/api/lessons/{wid}/quiz',{'kind':'post','answers':k['postRight']})
async def pass_practical(ctx,uid,wid):
    # 3.2: the week needs its practical passed (one session). Start and submit through the API; the activity results are
    # written as the server records them during the session (real answers and simulator submits are tested in part20)
    s,j=await post(ctx,f'/api/practical/{wid}/start'); assert s==200, j
    sql(f"""INSERT INTO practical_items(session_id,item,part,score,max,solved)
             SELECT {j['running']['id']},x.key,x.part,10,10,true FROM json_to_recordset('{json.dumps([{'key':i['key'],'part':p['id']} for p in j['parts'] for i in p['items']])}') AS x(key text,part text)""")
    s,j=await post(ctx,f'/api/practical/{wid}/submit'); assert s==200 and j['best']['passed'], j
async def statuses(pg):
    return await pg.evaluate("[...document.querySelectorAll('.lpath .lpstep')].map(li=>li.className.match(/st-(\\w+)/)[1])")
async def axe(pg,name):
    await pg.add_script_tag(path=AXE_PATH); v=await pg.evaluate(AXE_RUN)
    check(not v,f'axe-core WCAG 2.1 AA: {name} '+('; '.join(v[:3])))

async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        # --- a new class (sequential learning is on for new classes) with two students
        T=await b.new_context(viewport={'width':1280,'height':900}); await login(T,'kru4','Teach1234')
        s,cls=await post(T,'/api/teacher/classes',{'name':'ปวช.2/17 เรียนตามลำดับ'}); cid=cls['id']
        s,cr=await post(T,f'/api/teacher/classes/{cid}/students',{'rows':[{'no':'1','name':'นักเรียน ลำดับหนึ่ง'},{'no':'2','name':'นักเรียน ลำดับสอง'}]})
        studs=[]
        for c in cr['created']:
            ctx=await b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True); await login(ctx,c['username'],c['password'])
            await post(ctx,'/api/auth/password',{'current':c['password'],'next':'Path1234'})
            me=await get(ctx,'/api/me'); studs.append((ctx,me['user']['id'],c['username']))
        A,aId,aUser=studs[0]
        check((await get(A,'/api/path'))['sequential'] is True,'the new class uses sequential learning')
        pg=await A.new_page(); E=[]; pg.on('pageerror',lambda e:E.append(str(e))); pg.on('dialog',lambda d: asyncio.ensure_future(d.accept()))
        req=[]; pg.on('request',lambda r:req.append(r.url))

        print('== 1. a new student: week 1 available, weeks 2-18 locked (icon + text label)')
        await pg.goto(BASE+'/#/learn'); await pg.wait_for_selector('.lpath .lpstep')
        st=await statuses(pg)
        check(len(st)==18 and st[0]=='available' and all(x=='locked' for x in st[1:]),f'path statuses: {st[:4]}...')
        lab=await pg.evaluate("[...document.querySelectorAll('.lpath .lpstep')].map(li=>({svg:!!li.querySelector('.lpic svg'),t:li.querySelector('.lpst').textContent,lock:(li.querySelector('.lplock')||{}).textContent||''}))")
        check(all(x['svg'] for x in lab) and 'พร้อมเรียน' in lab[0]['t'] and all('ล็อก' in x['t'] for x in lab[1:]),'every week has an SVG status icon and a text label')
        check(lab[1]['lock']=='ต้องผ่านสัปดาห์ที่ 1 ก่อน จึงจะสามารถเรียนบทเรียนนี้ได้','locked week 2 states the server message exactly')
        check(await pg.locator('.lpath a.lpcard').nth(5).evaluate('e=>e.tabIndex>=0 && !e.hasAttribute("aria-disabled")'),'locked weeks stay focusable (links to the explanation)')
        check(await pg.locator('#side .lnk.lk').count()==17,'sidebar marks 17 locked weeks')
        await pg.screenshot(path=f'{OUT}/p17_390_path_new.png',full_page=False)

        print('== 2. typing #/lesson/w10 shows the lock panel, no lesson content')
        req.clear(); await pg.goto(BASE+'/#/lesson/w10'); await pg.wait_for_selector('.lockpanel')
        check((await pg.inner_text('.lockmsg')).strip()==LOCK9,'lock panel shows the exact message')
        btn=pg.locator('.lockpanel a.btn:has-text("ไปเรียนสัปดาห์ที่ 1")'); check(await btn.count()==1 and await btn.get_attribute('href')=='#/lesson/w1','button "ไปเรียนสัปดาห์ที่ 1" goes to the current week')
        txt=await pg.inner_text('#app')
        check(await pg.locator('.lsec,.rail,.qcard,.task').count()==0 and not any(t in txt for t in KEYS['w1']['w10']),'none of the week 10 content or section titles is shown')
        check(not any('/api/lessons/w10' in u for u in req),'the page never requests week 10 content')
        await pg.screenshot(path=f'{OUT}/p17_390_lock_w10.png')
        for sub in ['lab','post','content/s2']:
            await pg.goto(BASE+f'/#/lesson/w10/{sub}'); await pg.wait_for_selector('.lockpanel')
        check(await pg.locator('.task,.startcard,.qcard,.lsec').count()==0,'#/lesson/w10/lab, /post and /content/s2 also show only the lock panel')
        await btn.click() if await btn.count() else None
        await pg.wait_for_timeout(300); check(pg.url.endswith('#/lesson/w1'),'the button opens week 1')
        st_,j=await post(A,'/api/lessons/w2/visit',{'section':'s1'}); check(st_==403 and j.get('error')=='locked','server still refuses a locked week (403 locked)')

        print('== 3. completing week 1 (API) unlocks week 2 only; toast once after reload')
        await pg.goto(BASE+'/#/learn'); await pg.wait_for_selector('.lpath')   # this device has seen week 1 open
        r=await complete_week(A,aId,'w1'); check(r[0]==200 and r[1].get('passed') is True,'week 1 post-test passed through the API')
        await pg.reload(); await pg.wait_for_selector('.lpath .lpstep')
        try:
            await pg.wait_for_selector('.utoast:has-text("ปลดล็อกสัปดาห์ที่ 2")',timeout=3000); ok('toast "ปลดล็อกสัปดาห์ที่ 2 แล้ว" appears')
        except Exception: bad('no unlock toast after reload')
        check(await pg.locator('.utoast[role=status]').count()==1,'toast has role="status"')
        check(await pg.locator('.lpstep[data-week=w2].justopen').count()==1,'week 2 card plays the unlock animation')
        anim=await pg.evaluate("getComputedStyle(document.querySelector('.utoast')).animationName"); check(anim!='none',f'toast animates when motion is allowed ({anim})')
        st=await statuses(pg); check(st[0]=='completed' and st[1]=='available' and all(x=='locked' for x in st[2:]),f'week 1 completed, week 2 available, weeks 3-18 locked ({st[:4]})')
        await pg.screenshot(path=f'{OUT}/p17_390_unlocked_toast.png')
        await pg.wait_for_timeout(5600); check(await pg.locator('.utoast').count()==0,'toast dismisses itself')
        await pg.reload(); await pg.wait_for_selector('.lpath .lpstep'); await pg.wait_for_timeout(1200)
        check(await pg.locator('.utoast').count()==0 and await pg.locator('.justopen').count()==0,'second reload: no toast, no animation (shown once)')
        await pg.goto(BASE+'/#/lesson/w3'); await pg.wait_for_selector('.lockpanel')
        check('ต้องผ่านสัปดาห์ที่ 2 ก่อน' in await pg.inner_text('.lockmsg'),'week 3 still locked')
        check(await pg.locator('.lockpanel .critlist a.clink').count()>0,'lock panel lists what is still missing in week 2, with links')

        print('== 4. dashboard "เรียนต่อจากจุดล่าสุด"')
        await pg.goto(BASE+'/#/'); await pg.wait_for_selector('.resumep')
        t=await pg.inner_text('.resumep')
        check('เรียนต่อจากจุดล่าสุด' in t and 'สัปดาห์ที่ 2' in t,'panel shows the current week (2)')
        check(await pg.locator('.resumep a.btn').count()==1 and 'w2' in await pg.locator('.resumep a.btn').get_attribute('href'),'one big continue button to week 2')
        check('ผ่านแล้ว' in t and '1 สัปดาห์' in t and '17 สัปดาห์' in t,'completed 1 / remaining 17 weeks')
        check('ผ่านฝึกปฏิบัติรวมตามเกณฑ์' in t and 'Guided Lab / ภารกิจจำลอง' not in t and 'Virtual Machine' not in t,'3.2: the practical condition is one item "ผ่านฝึกปฏิบัติรวมตามเกณฑ์" (no separate Guided condition)')
        check('ปลดล็อกถัดไป' in t and 'สัปดาห์ที่ 3' in t,'next week to unlock: 3')
        links=await pg.eval_on_selector_all('.resumep .critlist a.clink','els=>els.map(e=>e.getAttribute("href"))')
        check(len(links)>=3 and all(h.startswith('#/') for h in links),f'missing conditions listed with links ({len(links)})')
        cl=[h for h in links if '/content' in h]
        if cl:
            await pg.locator(f'.resumep a.clink[href="{cl[0]}"]').click(); await pg.wait_for_selector('.lsec',timeout=10000); ok(f'condition link opens {cl[0]}')
        else: bad('no content link among the missing conditions')
        await pg.goto(BASE+'/#/'); await pg.wait_for_selector('.resumep'); await pg.screenshot(path=f'{OUT}/p17_390_dashboard.png',full_page=True)

        print('== 5. post-test retake: a failing attempt')
        dk=json.dumps({'quiz:w2:post':KEYS['w2']['postWrong']})
        await pg.evaluate(f"localStorage.setItem('netlab-drafts-u{aId}',{json.dumps(dk)})")
        await pg.goto(BASE+'/#/lesson/w2/post'); await pg.wait_for_selector('.quizintro')
        it=await pg.inner_text('.quizintro'); check('ครั้งที่ 1 จาก 3' in it and '70%' in it,'intro states attempt 1 of 3 and the pass mark')
        await pg.locator('.quizbar button').click()
        await pg.wait_for_selector('.attbox',timeout=10000)
        t=await pg.inner_text('.attbox')
        check('เหลืออีก' in t and '2 ครั้ง' in t and '1 จาก 3' in t,'shows attempts used and attempts left (2)')
        check('คะแนนดีที่สุด' in t,'shows the best score')
        cd=await pg.inner_text('.cooldown'); check('ทำใหม่ได้เวลา' in cd and 'นาที' in cd,'cooldown countdown with the time of the next attempt: '+cd)
        check(await pg.locator('.attbox button:has-text("ทำแบบทดสอบใหม่")').is_disabled(),'retake button waits for the cooldown')
        check(await pg.locator('.review').count()==0 and 'เฉลยและคำอธิบาย' not in await pg.inner_text('#app'),'no answer key while attempts remain')
        check(await pg.locator('.revlock').count()==1 and 'ยังไม่ถึงเกณฑ์' in await pg.inner_text('.revlock'),'server message shown instead of the key')
        await pg.screenshot(path=f'{OUT}/p17_390_retake.png',full_page=True)
        # the same week asked again while waiting -> 429 cooldown, clear Thai text
        await pg.evaluate("LASTPOST={}"); sql(f"UPDATE quiz_attempt_log SET created_at=now() WHERE user_id={aId}")
        s_,j=await post(A,'/api/lessons/w2/quiz',{'kind':'post','answers':KEYS['w2']['postWrong']}); check(s_==429 and j.get('error')=='cooldown','server answers 429 cooldown during the wait')

        print('== simulator: submitting a mission of a locked week')
        await pg.goto(BASE+'/#/sim/switching/sw1'); await pg.wait_for_selector('[data-act="submit"]',timeout=15000)
        await pg.locator('[data-act="submit"]').first.click()
        try: await pg.wait_for_selector('.simlock',timeout=6000); ok('lock notice shown: '+(await pg.inner_text('.simlock')).split('\n')[1][:60])
        except Exception: bad('no lock notice after a 403 from the simulator')

        print('== 6. teacher tab')
        tp=await T.new_page(); TE=[]; tp.on('pageerror',lambda e:TE.append(str(e))); tp.on('dialog',lambda d: asyncio.ensure_future(d.accept()))
        async def open_tab():
            await tp.goto(BASE+'/teacher.html'); await tp.wait_for_selector('.side')
            await tp.locator(f'.side .navbtn:has-text("ปวช.2/17")').click(); await tp.wait_for_selector('.tabs')
            await tp.locator('.tabs button:has-text("เส้นทางการเรียน")').click(); await tp.wait_for_selector('#pathrules')
        await open_tab()
        t=await tp.inner_text('.ptable'); check('นักเรียน ลำดับหนึ่ง' in t and 'สัปดาห์ที่ 2' in t,'per-student progress with the week each student is stuck at')
        check('หลังเรียน' in t or 'Guided' in t or 'เนื้อหา' in t,'missing conditions listed per student')
        await tp.fill('#ppass','80'); await tp.locator('#pathrules button[type=submit]').click(); await tp.wait_for_timeout(800)
        await open_tab(); check(await tp.input_value('#ppass')=='80','pass mark 80% persists after a reload')
        await tp.screenshot(path=f'{OUT}/p17_1280_teacher_path.png',full_page=True)
        # a reduced-motion device of the same student, looking before the unlock
        RM=await b.new_context(viewport={'width':390,'height':844},reduced_motion='reduce'); await login(RM,aUser,'Path1234')
        rp=await RM.new_page(); await rp.goto(BASE+'/#/learn'); await rp.wait_for_selector('.lpath .lpstep')
        await tp.locator('.ptable tr:has-text("นักเรียน ลำดับหนึ่ง") button').click(); await tp.wait_for_selector('#stuunlock')
        t=await tp.inner_text('#app') if await tp.locator('#app').count() else await tp.inner_text('main')
        check('แบบทดสอบหลังเรียนที่ไม่ผ่านเกณฑ์' in t and 'ไม่ผ่าน' in t,'student detail lists the failed post-test attempt')
        await tp.select_option('#stuunlock select','w5'); await tp.fill('#stuunlock input','ย้ายมาจากห้องอื่น')
        await tp.locator('#stuunlock button').click(); await tp.wait_for_timeout(800); await tp.wait_for_selector('#pathhistory')
        h=await tp.inner_text('#pathhistory'); check('ย้ายมาจากห้องอื่น' in h and 'ครูปลดล็อก' in h and 'มีผลอยู่' in h,'history lists the unlock with its reason')
        await pg.goto(BASE+'/#/learn'); await pg.reload(); await pg.wait_for_selector('.lpath .lpstep')
        st=await statuses(pg); check(st[4]=='available' and st[5]=='locked' and st[2]=='locked',f'student sees week 5 open, week 6 (and 3) still locked ({st[2]},{st[4]},{st[5]})')
        check('ครูปลดล็อกให้' in await pg.inner_text('.lpstep[data-week=w5]'),'week 5 card says the teacher unlocked it')
        await pg.goto(BASE+'/#/lesson/w5'); await pg.wait_for_selector('.lhead'); check(await pg.locator('.lockpanel').count()==0,'week 5 lesson opens')
        await rp.reload(); await rp.wait_for_selector('.lpath .lpstep')
        try:
            await rp.wait_for_selector('.utoast',timeout=3000)
            a=await rp.evaluate("[getComputedStyle(document.querySelector('.utoast')).animationName,document.querySelector('.justopen .lpic')?getComputedStyle(document.querySelector('.justopen .lpic')).animationName:'none']")
            check(all(x=='none' for x in a),f'prefers-reduced-motion: toast shown without animation ({a})')
        except Exception: bad('reduced-motion device: no toast for week 5')
        await RM.close()
        await tp.locator('#pathhistory button:has-text("ยกเลิก")').first.click(); await tp.wait_for_timeout(900); await tp.wait_for_selector('#pathhistory')
        check('ยกเลิกแล้ว' in await tp.inner_text('#pathhistory'),'revoked: history keeps it as "ยกเลิกแล้ว"')
        await pg.goto(BASE+'/#/learn'); await pg.reload(); await pg.wait_for_selector('.lpath .lpstep')
        st=await statuses(pg); check(st[4]=='locked' and st[0]=='completed','after revoking, week 5 is locked again; week 1 stays completed')
        # turn sequential learning off and on again for the class
        await open_tab(); await tp.uncheck('#pseq'); await tp.locator('#pathrules button[type=submit]').click(); await tp.wait_for_timeout(800)
        await pg.reload(); await pg.wait_for_selector('.lpath .lpstep'); st=await statuses(pg)
        check('locked' not in st and await pg.locator('.lplegend .st-locked').count()==0,'sequential off: statuses without locks')
        await open_tab(); await tp.check('#pseq'); await tp.locator('#pathrules button[type=submit]').click(); await tp.wait_for_timeout(1000)
        await pg.reload(); await pg.wait_for_selector('.lpath .lpstep'); st=await statuses(pg); check(st[5]=='locked','sequential on again: later weeks locked')
        check(not TE,'teacher page: no JS errors '+'; '.join(TE[:2]))

        print('== 7. guest banner')
        G=await b.new_context(viewport={'width':390,'height':844}); gp=await G.new_page()
        await gp.goto(BASE+'/#/learn'); await gp.wait_for_selector('.lpath')
        check(GUEST in await gp.inner_text('.guestbar'),'guest banner has the exact text')
        check(await gp.locator('.lpstep.st-locked').count()==0,'guests see no locks')
        await gp.goto(BASE+'/#/lesson/w10'); await gp.wait_for_selector('.lhead'); check(await gp.locator('.lockpanel').count()==0,'guests can read week 10')
        await G.close()

        print('== 8. 360 px, desktop grid, dark theme, accessibility')
        N=await b.new_context(viewport={'width':360,'height':780},has_touch=True,is_mobile=True); await login(N,aUser,'Path1234'); np_=await N.new_page(); NE=[]; np_.on('pageerror',lambda e:NE.append(str(e)))
        for rt,sel in [('#/learn','.lpath .lpstep'),('#/','.resumep'),('#/lesson/w10','.lockpanel'),('#/lesson/w2/post','.attbox')]:
            await np_.goto(BASE+'/'+rt); await np_.wait_for_selector(sel)
            o=await np_.evaluate('document.documentElement.scrollWidth-innerWidth'); check(o<=0,f'360px {rt}: no horizontal scroll ({o})')
        await np_.goto(BASE+'/#/learn'); await np_.wait_for_selector('.lpath .lpstep')
        con=await np_.evaluate("getComputedStyle(document.querySelector('.lpstep'),'::after').content"); check(con not in ('none','normal'),'phone: vertical path with connectors')
        await np_.screenshot(path=f'{OUT}/p17_360_path.png',full_page=True)
        await axe(np_,'#/learn light')
        await np_.evaluate("localStorage.setItem('netlab-theme','dark')"); await np_.reload(); await np_.wait_for_selector('.lpath .lpstep')
        await np_.screenshot(path=f'{OUT}/p17_360_path_dark.png',full_page=True); await axe(np_,'#/learn dark')
        await np_.goto(BASE+'/#/lesson/w10'); await np_.wait_for_selector('.lockpanel'); await np_.screenshot(path=f'{OUT}/p17_360_lock_dark.png'); await axe(np_,'lock panel dark')
        await np_.goto(BASE+'/#/'); await np_.wait_for_selector('.resumep'); await np_.screenshot(path=f'{OUT}/p17_360_dashboard_dark.png',full_page=True); await axe(np_,'dashboard dark')
        await np_.goto(BASE+'/#/lesson/w2/post'); await np_.wait_for_selector('.attbox'); await np_.screenshot(path=f'{OUT}/p17_360_retake_dark.png',full_page=True); await axe(np_,'post-test retake dark')
        check(not NE,'360px: no JS errors '+'; '.join(NE[:2]))
        D=await b.new_context(viewport={'width':1280,'height':900}); await login(D,aUser,'Path1234'); dp=await D.new_page()
        await dp.goto(BASE+'/#/learn'); await dp.wait_for_selector('.lpath .lpstep')
        y=await dp.evaluate("[...document.querySelectorAll('.lpstep')].slice(0,2).map(e=>Math.round(e.getBoundingClientRect().top))")
        check(y[0]==y[1],'desktop: weeks in a two-column (or wider) grid')
        await dp.screenshot(path=f'{OUT}/p17_1280_path.png',full_page=True); await axe(dp,'#/learn desktop light')
        await dp.goto(BASE+'/#/lesson/w10'); await dp.wait_for_selector('.lockpanel'); await axe(dp,'lock panel light')
        await T.add_init_script("localStorage.setItem('netlab-theme','dark')")
        await open_tab(); await tp.emulate_media(color_scheme='dark'); await tp.screenshot(path=f'{OUT}/p17_1280_teacher_path_dark.png',full_page=True)
        check(not E,'student page: no JS errors '+'; '.join(E[:2]))
        await b.close()
    print('\nISSUES',len(issues)); [print(' -',i) for i in issues]
    sys.exit(1 if issues else 0)
asyncio.run(main())
