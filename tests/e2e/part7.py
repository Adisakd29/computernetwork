# Part 7 (2.6 master brief): learning plan (student) + class insights (teacher, aggregated, private), breadcrumbs,
# Focus Mode, onboarding, empty/error states, new simulator missions listed. usage: python3 tests/e2e/part7.py <out-dir>
import asyncio, sys, json, os, subprocess
from playwright.async_api import async_playwright
OUT=sys.argv[1]; BASE=os.environ.get('E2E_BASE','http://127.0.0.1:3990')
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
issues=[]
def bad(m): issues.append(m); print('  ✗',m)
def ok(m): print('  ✓',m)
def check(c,m): ok(m) if c else bad(m)
NODE=lambda js: json.loads(subprocess.check_output(['node','-e',js],cwd=ROOT))
# answers for the w3 post-test (form B): first 4 wrong, rest right; and 3 bank items from unit 3 answered wrong
KEY=NODE("""const {LESSONS}=require('./server/lessons');const L=LESSONS.get('w3');
const right=q=>q.type==='choice'?q.correct:q.type==='multi'?q.correct:q.type==='tf'?q.answer:q.answers[0];
const wrong=q=>q.type==='choice'?(q.correct+1)%q.options.length:q.type==='multi'?[...q.options.keys()].filter(i=>!q.correct.includes(i)).slice(0,1):q.type==='tf'?!q.answer:'zzz';
const b=require('./server/bank');const u3=[...b.Q.values()].filter(q=>q.unit===3&&!q.retired&&q.type==='choice').slice(0,3).map(q=>({id:q.id,a:(q.correct+1)%q.options.length}));
console.log(JSON.stringify({post:L.quizB.map((q,i)=>i<4?wrong(q):right(q)),pre:L.quiz.map(right),bank:u3}))""")
H={'X-NetLab':'1'}
async def login(ctx,u,p):
    r=await ctx.request.post(BASE+'/api/auth/login',data={'username':u,'password':p},headers=H); assert r.ok, await r.text()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        print('== learning plan for a student (own data only)')
        st=await b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True); await login(st,'s1','Stud1234')
        r=await st.request.post(BASE+'/api/lessons/w3/quiz',data={'kind':'pre','answers':KEY['pre']},headers=H)
        r=await st.request.post(BASE+'/api/lessons/w3/quiz',data={'kind':'post','answers':KEY['post']},headers=H)
        check(r.ok,'student submits the w3 post-test (4 wrong) '+('' if r.ok else await r.text()))
        for x in KEY['bank']: await st.request.post(BASE+'/api/practice/check',data={'id':x['id'],'answer':x['a']},headers=H)
        plan=await (await st.request.get(BASE+'/api/game/plan')).json()
        check(len(plan['lessons'])==18 and any(l['id']=='w3' and l['status']=='doing' for l in plan['lessons']),'plan lists 18 lessons; w3 is in progress (content not read yet)')
        check(len(plan['review'])>=1 and all(t['lesson']=='w3' for t in plan['review']),f'topics to review come from the wrong answers ({len(plan["review"])} topics, all in week 3)')
        check(any(x['kind']=='lesson' and x['id']=='w3' for x in plan['pending']),'pending work includes the unfinished week 3')
        pg=await st.new_page(); E=[]; pg.on('pageerror',lambda e:E.append(str(e)))
        await pg.goto(BASE+'/#/me'); await pg.wait_for_selector('.plan .sugg a',timeout=10000)
        t=await pg.inner_text('.plan')
        check('หัวข้อที่ควรทบทวน' in t and 'งานที่ค้างอยู่' in t and 'ทำได้ดี' in t and 'ยังต้องฝึก' in t,'"แผนการเรียนของฉัน" shows finished, to-review, strong, weak and pending')
        await pg.locator('.plan .sugg a[href*="/content/"]').first.tap(); await pg.wait_for_selector('.lsec'); await pg.wait_for_timeout(600)
        check('/lesson/w3/content/s' in pg.url,'a topic to review opens that lesson section')
        await pg.goto(BASE+'/#/'); await pg.wait_for_selector('.plan',timeout=8000)
        check(await pg.locator('.plan h2:has-text("หัวข้อที่ควรทบทวน")').count()==1,'dashboard shows the top topics to review')
        await pg.screenshot(path=f'{OUT}/p7_plan_390.png',full_page=True)
        other=await b.new_context(); await login(other,'s2','Stud1234')
        p2=await (await other.request.get(BASE+'/api/game/plan')).json()
        check(not p2['review'] and all(l['status']=='todo' for l in p2['lessons'] if l['id']=='w3'),'another student does not see s1\'s results in their plan')
        cid=(await (await st.request.get(BASE+'/api/me')).json())
        ins=await other.request.get(BASE+'/api/teacher/classes/1/insights')
        check(ins.status in (401,403,404),f'a student cannot open class insights ({ins.status})')
        check(not E,'no JS errors '+'; '.join(E[:2]))

        print('== class insights for the teacher (aggregated, minimum 3 students)')
        tc=await b.new_context(viewport={'width':1366,'height':900}); await login(tc,'kru4','Teach1234')
        cls=(await (await tc.request.get(BASE+'/api/teacher/classes')).json())['classes'][0]
        d=await (await tc.request.get(BASE+f'/api/teacher/classes/{cls["id"]}/insights')).json()
        check(d['topics']==[] and d['postItems']==[],'with fewer than 3 students answering, nothing is shown (privacy)')
        await tc.request.patch(BASE+f'/api/teacher/classes/{cls["id"]}',data={'joinOpen':True},headers=H)
        for k in ['3','4']:
            c2=await b.new_context(); r=await c2.request.post(BASE+'/api/auth/register',data={'classCode':'P4P4P4','username':'p7s'+k,'name':'นักเรียน ทดลอง'+k,'studentNo':'3'+k,'password':'Stud1234x'},headers=H)
            if not r.ok: r=await c2.request.post(BASE+'/api/auth/login',data={'username':'p7s'+k,'password':'Stud1234x'},headers=H)
            await c2.request.post(BASE+'/api/lessons/w3/quiz',data={'kind':'pre','answers':KEY['pre']},headers=H)
            await c2.request.post(BASE+'/api/lessons/w3/quiz',data={'kind':'post','answers':KEY['post']},headers=H)
            await c2.close()
        d=await (await tc.request.get(BASE+f'/api/teacher/classes/{cls["id"]}/insights')).json()
        s=json.dumps(d,ensure_ascii=False)
        check(len(d['postItems'])>=1 and d['postItems'][0]['pct']==0 and d['postItems'][0]['n']>=3,f'hardest post-test items listed with % correct ({len(d["postItems"])} items)')
        check(len(d['topics'])>=1,'hardest lesson topics listed')
        check('สมชาย' not in s and 'p7s3' not in s and 'user' not in s.lower(),'insights contain no student names or ids')
        tp=await tc.new_page(); await tp.goto(BASE+f'/teacher.html'); await tp.wait_for_timeout(1200)
        try:
            await tp.evaluate(f"go({{type:'class',id:{cls['id']}}})"); await tp.wait_for_selector('[role=tab]')
            await tp.locator('[role=tab]:has-text("วิเคราะห์ผล")').click(); await tp.wait_for_selector('.insights .pilist',timeout=10000)
            check(True,'teacher dashboard shows "หัวข้อที่นักเรียนส่วนใหญ่ยังไม่เข้าใจ"')
            await tp.screenshot(path=f'{OUT}/p7_insights_1366.png',full_page=True)
        except Exception as e:
            bad('teacher dashboard insights card: '+str(e)[:120]); await tp.screenshot(path=f'{OUT}/p7_insights_fail.png',full_page=True)
        await tc.close()

        print('== breadcrumbs, Focus Mode, onboarding, empty/error states')
        g=await b.new_context(viewport={'width':1366,'height':800}); pg=await g.new_page(); E=[]; pg.on('pageerror',lambda e:E.append(str(e)))
        await pg.goto(BASE+'/#/'); await pg.wait_for_selector('.onboard')
        await pg.click('.onboard button:has-text("ถัดไป")'); await pg.click('.onboard button:has-text("ถัดไป")'); await pg.click('.onboard button:has-text("ถัดไป")')
        check('4/4' in await pg.inner_text('.onboard'),'onboarding has 4 steps')
        await pg.click('.onboard button:has-text("เริ่มเรียนเลย")'); await pg.wait_for_timeout(200)
        await pg.reload(); await pg.wait_for_selector('.cont, .toolcards, h2'); await pg.wait_for_timeout(500)
        check(await pg.locator('.onboard').count()==0,'onboarding is not shown again after finishing')
        await pg.goto(BASE+'/#/help'); await pg.wait_for_selector('.onboard'); check(True,'onboarding can be reopened from "วิธีใช้งาน"')
        await pg.goto(BASE+'/#/lesson/w4/content'); await pg.wait_for_selector('.lsec')
        cr=await pg.inner_text('.crumbs'); check('หน้าแรก' in cr and 'บทเรียน' in cr and 'สัปดาห์ 4' in cr and 'เนื้อหา' in cr,'lesson page has breadcrumb หน้าแรก › บทเรียน › สัปดาห์ 4 › เนื้อหา')
        await pg.locator('.crumbs a:has-text("บทเรียน")').click(); await pg.wait_for_timeout(400); check(pg.url.endswith('#/learn'),'breadcrumb link navigates')
        await pg.goto(BASE+'/#/sim/subnet'); await pg.wait_for_selector('.crumbs'); check('ห้องปฏิบัติการจำลอง' in await pg.inner_text('.crumbs'),'simulator page has a breadcrumb')
        await pg.goto(BASE+'/#/room/r2'); await pg.wait_for_selector('#prPage .crumbs, .lhead .crumbs'); await pg.wait_for_timeout(300); cr=await pg.inner_text('.crumbs')
        check('สัปดาห์ 2' in cr and 'ฝึกปฏิบัติ' in cr and 'ฝึกทบทวน' not in cr and pg.url.endswith('#/lesson/w2/lab'),f'old room link opens the practical of week 2 with a breadcrumb (3.2: #/lesson/w2/lab; {cr!r})')
        await pg.goto(BASE+'/#/lesson/w4/content'); await pg.wait_for_selector('.focusbtn')
        await pg.click('.focusbtn'); await pg.wait_for_timeout(300)
        vis=await pg.evaluate("[...['.side','.ltoc','.lhead .rail']].map(s=>{const e=document.querySelector(s);return e?getComputedStyle(e).display:'none'})")
        w=await pg.evaluate("document.querySelector('.lbody').getBoundingClientRect().width")
        check(all(v=='none' for v in vis) and w<=780 and await pg.locator('#focusexit').is_visible(),f'Focus Mode hides menu, step rail and TOC; one reading column ({round(w)}px)')
        await pg.screenshot(path=f'{OUT}/p7_focus_1366.png')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        check(await pg.evaluate("!document.body.classList.contains('focus')") and await pg.locator('#focusexit').count()==0,'Escape leaves Focus Mode')
        await pg.goto(BASE+'/#/no-such-page'); await pg.wait_for_selector('.statebox'); t=await pg.inner_text('.statebox')
        check('ไม่พบหน้านี้' in t and await pg.locator('.statebox a').count()>=2,'unknown page shows a helpful not-found state with next steps')
        await pg.goto(BASE+'/#/lesson/w99'); await pg.wait_for_selector('.statebox'); check(await pg.locator('.statebox button:has-text("ลองใหม่")').count()==1,'error state offers "ลองใหม่"')
        check(not E or all('ไม่พบบทเรียน' in x for x in E),'no unexpected JS errors '+'; '.join(E[:2]))
        await g.close()

        print('== new simulator missions are listed (topology t8, subnet s8-s10, crimp c6-c7, terminal m9-m11, troubleshoot x9-x13)')
        sims=await (await b.new_context()).request.get(BASE+'/api/sims')
        d=await sims.json(); ids={s['id']:[m['id'] for m in s['missions']] for s in d['sims']}
        want={'topology':['t8'],'subnet':['s8','s9','s10'],'crimp':['c6','c7'],'terminal':['m9','m10','m11'],'troubleshoot':['x9','x10','x11','x12','x13']}
        miss=[f'{k}:{m}' for k,v in want.items() for m in v if m not in ids.get(k,[])]
        check(not miss,'all new missions available '+','.join(miss))
        await b.close()
    print('\nISSUES',len(issues)); [print(' -',i) for i in issues]
    sys.exit(1 if issues else 0)
asyncio.run(main())
