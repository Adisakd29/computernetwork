# Part 19 (3.1, updated for 3.2): clear lesson steps with real statuses. 3.2: 5 steps (ก่อนเรียน, เนื้อหา, ฝึกปฏิบัติ,
# หลังเรียน, สรุปผล); the former step 4 "ฝึกแก้ปัญหา" and the optional review sets are part of the one practical session.
# 1 a new student: 5 steps with the new names, no check anywhere (390/1366, light/dark), dashboard step strip, path
# 2 every simulator mission of week 1 done outside the practical with full marks: step 3 still "ยังไม่เริ่ม", no green check
# 3 post-test below the pass mark -> "ต้องทบทวน"; post passed but practical not -> summary lists the practical with a working
#   link, the primary button goes there, locked week 2 is not offered, pre-test reads "ทำแล้ว"
# 4 a practical submitted with a low score -> step 3 "ต้องทบทวน", never "ผ่านแล้ว"
# 5 the Troubleshooting part is inside the practical (w7), an analysis week (w3) names it "กิจกรรมวิเคราะห์"
# 7 teacher: "ผลฝึกปฏิบัติ" replaces "คะแนนแล็บ", old scores under "ประวัติ (ระบบเดิม)"; the practical condition, pass mark and
#   weights persist; no guided/solve conditions left; the "เส้นทางการเรียน" tab has no horizontal page scroll at 360 and 390 px
# 5b everything but the practical: week 1 not Completed, the summary lists only the practical
# 8 x15 (the old link #/sim/troubleshoot/x15 opens the week 1 practical; 3.5): it opens only in a running practical, embedded:
#   no terminal, the basic note, solved by plugging the cable (score 10, recorded); the week is not Completed until the
#   practical is submitted and passed; then week 1 is Completed and the summary goes to week 2
# 6 old URLs (/extra, /challenge, /challenge/r9, /extra/r9, /solve) open the practical; no optional review cards anywhere
# 9 legacy class (sequential off) with old scores: scores shown, statuses match the server, old work kept as "ระบบเดิม"
# Every page at 390 and 1366 px, light and dark; no horizontal scroll; axe-core WCAG 2.1 AA on the new pages.
# usage: E2E_BASE=http://127.0.0.1:3990 E2E_DATABASE_URL=postgres://... python3 tests/e2e/part19.py <out-dir>
#   (needs the tests/e2e/setup.js fixture: teacher kru4 / Teach1234, legacy class ปวช.2/4 with student s1 / Stud1234)
import asyncio, sys, os, subprocess, json
from playwright.async_api import async_playwright
OUT=sys.argv[1] if len(sys.argv)>1 else '/tmp/netlab-e2e'; os.makedirs(OUT,exist_ok=True)
BASE=os.environ.get('E2E_BASE','http://127.0.0.1:3990')
DB=os.environ.get('E2E_DATABASE_URL','postgres://postgres@127.0.0.1:5433/netlab_e2e')
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AXE_PATH=os.path.join(ROOT,'node_modules','axe-core','axe.min.js')
AXE_RUN="async(sel)=>{const r=await axe.run(document.querySelector(sel)||document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return r.violations.map(v=>v.id+'('+v.impact+'):'+v.nodes.length+' '+v.nodes.slice(0,2).map(n=>n.target.join(' ')).join(' | '))}"
H={'X-NetLab':'1'}
STEPS=['ก่อนเรียน','เนื้อหา','ฝึกปฏิบัติ','หลังเรียน','สรุปผล']
MIGRATE="""const db=require('./server/db'),P=require('./server/practical');(async()=>{await db.init(process.env.DATABASE_URL);await P.migrate();await db.close();})().catch(e=>{console.error(e);process.exit(1)})"""
issues=[]
def bad(m): issues.append(m); print('  ✗',m)
def ok(m): print('  ✓',m)
def check(c,m): ok(m) if c else bad(m)
def sql(q): return subprocess.check_output(['psql',DB,'-tAqc',q]).decode().strip()
# answers of weeks 1 and 2 and the practical plan of every week (from the server's own data)
K=json.loads(subprocess.check_output(['node','-e',r"""
const { LESSONS, formOf } = require('./server/lessons'); const P = require('./server/practical');
const right = q => q.type === 'choice' ? q.correct : q.type === 'multi' ? q.correct : q.type === 'tf' ? q.answer : q.answers[0];
const wrongOf = q => q.type === 'choice' ? (q.correct + 1) % q.options.length : q.type === 'tf' ? !q.answer : q.type === 'multi' ? [0, 1, 2].filter(i => !q.correct.includes(i)).slice(0, 1).concat(q.correct.length ? [] : [0]) : 'zz-wrong';
const out = { weeks: {} };
for (const wid of ['w1', 'w2']) { const L = LESSONS.get(wid); let n = 0; const checks = [];
  for (const s of L.sections) for (const b of s.blocks) if (b.type === 'check') { if (!s.extra) checks.push({ key: `L:${wid}:c:${n}`, answer: right(b.q) }); n++; }
  const post = formOf(L, 'post');
  out.weeks[wid] = { sections: L.sections.filter(s => !s.extra).map(s => s.id), checks, pre: L.quiz.length, postRight: post.map(right), postWrong: post.map(wrongOf) }; }
for (const wid of P.IDS) { const s = P.setOf(wid); out.weeks[wid] = Object.assign(out.weeks[wid] || {}, { type: s.type, items: s.items.map(i => ({ key: i.key, part: i.part, kind: i.kind, max: i.max })) }); }
console.log(JSON.stringify(out));"""],cwd=ROOT,stderr=subprocess.DEVNULL))
W1=K['weeks']['w1']

async def post(ctx,path,body=None,method='post'):
    r=await getattr(ctx.request,method)(BASE+path,data=body or {},headers=H)
    return r.status,(await r.json() if r.headers.get('content-type','').startswith('application/json') else {})
async def get(ctx,path):
    r=await ctx.request.get(BASE+path,headers=H); return await r.json()
async def login(ctx,u,p):
    s,j=await post(ctx,'/api/auth/login',{'username':u,'password':p}); assert s==200, j
async def new_ctx(b,w,theme='light'):
    ctx=await b.new_context(viewport={'width':w,'height':900 if w>500 else 844},has_touch=w<500,is_mobile=w<500,color_scheme=theme)
    await ctx.add_init_script(f"try{{localStorage.setItem('netlab-theme','{theme}');localStorage.setItem('netlab-onboard','done')}}catch(e){{}}")
    return ctx
async def page(ctx):
    pg=await ctx.new_page(); pg._errs=[]; pg.on('pageerror',lambda e:pg._errs.append(str(e))); pg.on('dialog',lambda d: asyncio.ensure_future(d.accept()))
    return pg
async def goto(pg,route,sel='.lhead'):
    await pg.goto(BASE+'/'+route); await pg.wait_for_selector(sel); await pg.wait_for_timeout(500)
async def rail(pg):
    return await pg.evaluate("""[...document.querySelectorAll('.rail .rstep')].map(a=>({cls:a.className,label:a.querySelector('.rl').firstChild.textContent.trim(),
      st:(a.querySelector('.rst')||{}).textContent||'',check:!!a.querySelector('.rn svg path[d^="M8 12.5"]'),href:a.getAttribute('href'),step:a.dataset.step}))""")
async def no_checks(pg):
    """no element anywhere on the page claims a passed step: no .done step, no "ผ่านแล้ว" chip, no check-mark glyph"""
    return await pg.evaluate("""(()=>{const t=document.getElementById('app').innerText;return {done:document.querySelectorAll('.rstep.done,.seg.done,.ss-done').length,
      glyph:(t.match(/✓/g)||[]).length,word:[...document.querySelectorAll('.rstep .rst,.sschip')].filter(x=>x.textContent.includes('ผ่านแล้ว')).length}})()""")
# measured against the device width: with mobile emulation Chrome widens innerWidth to fit wide content, which would hide an overflow
async def hscroll(pg): return await pg.evaluate('document.documentElement.scrollWidth')-pg.viewport_size['width']
async def axe(pg,sel,name):
    await pg.add_script_tag(path=AXE_PATH); v=await pg.evaluate(AXE_RUN,sel)
    check(not v,f'axe-core WCAG 2.1 AA: {name} '+('; '.join(v[:3])))
async def make_student(b,T,cid,no,name,w=390,theme='light'):
    s,cr=await post(T,f'/api/teacher/classes/{cid}/students',{'rows':[{'no':str(no),'name':name}]}); c=cr['created'][0]
    ctx=await new_ctx(b,w,theme); await login(ctx,c['username'],c['password'])
    await post(ctx,'/api/auth/password',{'current':c['password'],'next':'Step1234'})
    me=await get(ctx,'/api/me'); return ctx,me['user']['id']
async def pathweek(ctx,wid): return next(x for x in (await get(ctx,'/api/path'))['weeks'] if x['id']==wid)
async def practical(ctx,wid,frac):
    """one practical session: start, the activity results as the server records them during the session (each item at frac of
    its full marks; real answers and simulator submits are tested in part20), submit. Returns the submitted state."""
    s,j=await post(ctx,f'/api/practical/{wid}/start'); assert s==200, j
    sid=j['running']['id']
    rows=','.join(f"({sid},'{i['key']}','{i['part']}',{round(frac*i['max'],1)},{i['max']},{'true' if frac>=1 else 'false'})" for i in K['weeks'][wid]['items'])
    if frac>0: sql(f"INSERT INTO practical_items(session_id,item,part,score,max,solved) VALUES {rows} ON CONFLICT DO NOTHING")   # items already done for real stay
    s,j=await post(ctx,f'/api/practical/{wid}/submit'); assert s==200 and j['submitted'], j
    return j
async def learn_w1(ctx,post_right=True,visit=True,prac=None):
    k=W1
    await post(ctx,'/api/lessons/w1/quiz',{'kind':'pre','answers':[0]*k['pre']})
    if visit:
        for s in k['sections']: await post(ctx,'/api/lessons/w1/visit',{'section':s})
        for c in k['checks']: await post(ctx,'/api/lessons/w1/check',c)
    if prac is not None: await practical(ctx,'w1',prac)
    if post_right is not None:
        return await post(ctx,'/api/lessons/w1/quiz',{'kind':'post','answers':k['postRight' if post_right else 'postWrong']})

async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        T=await new_ctx(b,1366); await login(T,'kru4','Teach1234')
        s,cls=await post(T,'/api/teacher/classes',{'name':'ปวช.2/19 ขั้นตอนบทเรียน'}); cid=cls['id']
        req=(await get(T,f'/api/teacher/classes/{cid}/path'))['settings']['require']
        check(req.get('practice') is True and 'solve' not in req and 'guided' not in req,f'a new class requires the practical (one condition; no guided/solve) {req}')

        print('== 1. a new student sees 5 steps with the new names and no check anywhere (390/1366, light/dark)')
        A,aId=await make_student(b,T,cid,1,'นักเรียน ใหม่')
        for w,theme in [(390,'light'),(390,'dark'),(1366,'light'),(1366,'dark')]:
            ctx=await new_ctx(b,w,theme); await ctx.add_cookies(await A.cookies()); pg=await page(ctx)
            await goto(pg,'#/lesson/w1')
            r=await rail(pg); nc=await no_checks(pg)
            check([x['label'] for x in r]==STEPS,f'{w}/{theme}: rail labels {[x["label"] for x in r]}')
            check(all(x['st']=='ยังไม่เริ่ม' for x in r) and not any(x['check'] for x in r),f'{w}/{theme}: every step says "ยังไม่เริ่ม" (text, not colour only)')
            check(nc=={'done':0,'glyph':0,'word':0},f'{w}/{theme}: no check anywhere on the lesson page {nc}')
            check([x['href'] for x in r]==[f'#/lesson/w1/{k}' for k in ['pre','content','lab','post','summary']],'the steps link to pre, content, lab, post, summary (no /solve)')
            check(await hscroll(pg)<=0,f'{w}/{theme}: no horizontal scroll')
            await pg.screenshot(path=f'{OUT}/p19_new_{w}_{theme}.png',full_page=w>500)
            await goto(pg,'#/','.resumep')
            nc=await no_checks(pg); check(nc['done']==0 and nc['glyph']==0,f'{w}/{theme}: dashboard "เรียนต่อจากจุดล่าสุด" shows no check {nc}')
            segs=await pg.eval_on_selector_all('.resumep .minirail .seg','e=>e.map(x=>x.dataset.step)')
            check(segs==['pre','content','lab','post','summary'],f'{w}/{theme}: resume card shows the 5-step strip ({segs})')
            if w==390 and theme=='light': await axe(pg,'#app','dashboard (new student)')
            await goto(pg,'#/learn','.lpath')
            check(await pg.locator('.lpstep.st-completed').count()==0,f'{w}/{theme}: learning path has no completed week')
            await ctx.close()

        print('== 2. all week 1 missions done outside the practical with full marks: step 3 still "ยังไม่เริ่ม"')
        B,bId=await make_student(b,T,cid,2,'นักเรียน ทำนอกฝึกปฏิบัติ',1366)
        for i in [x for x in W1['items'] if x['kind']=='mission']:
            sim,m=i['key'].split(':'); sql(f"INSERT INTO sim_results(user_id,sim,mission,best,max) VALUES({bId},'{sim}','{m}',{i['max']},{i['max']}) ON CONFLICT DO NOTHING")
        pg=await page(B); await goto(pg,'#/lesson/w1/lab','#prPage[data-mode=pre]')
        r=await rail(pg)
        check(r[2]['st']=='ยังไม่เริ่ม' and 'done' not in r[2]['cls'].split() and not r[2]['check'],f'step 3 is "{r[2]["st"]}" with no check although every mission is 10/10 in the simulator')
        nc=await no_checks(pg); check(nc['done']==0 and nc['glyph']==0,f'no green check anywhere {nc}')
        check((await pathweek(B,'w1'))['steps']['practice']=='todo','server agrees: steps.practice = todo (work outside the session is not counted)')
        check(await pg.locator('#prStart').count()==1 and await pg.locator('#prResult').count()==0,'the practical page offers "เริ่มฝึกปฏิบัติ" and shows no result')
        await axe(pg,'#app','#/lesson/w1/lab before starting (student)')
        await pg.screenshot(path=f'{OUT}/p19_lab_pre_1366.png',full_page=True)

        print('== 3. post-test below the pass mark -> "ต้องทบทวน"; post passed but practical not -> summary lists the practical')
        C_,cId=await make_student(b,T,cid,3,'นักเรียน หลังเรียนต่ำ')
        s,j=await learn_w1(C_,post_right=False,visit=False); check(s==200 and j.get('passed') is False,f'post-test submitted below the pass mark ({j.get("score")}/{j.get("max")})')
        pg=await page(C_); await goto(pg,'#/lesson/w1/post')
        r=await rail(pg)
        check('needrev' in r[3]['cls'].split() and r[3]['st']=='ต้องทบทวน' and not r[3]['check'],f'post step: "{r[3]["st"]}" (amber, redo icon)')
        check(await pg.locator('.rail .rstep.needrev .rn svg').count()==1,'the review step shows the redo icon')
        check((await pathweek(C_,'w1'))['steps']['post']=='review','server agrees: steps.post = review')
        await pg.screenshot(path=f'{OUT}/p19_post_review_390.png')
        D,dId=await make_student(b,T,cid,4,'นักเรียน ยังไม่ฝึกปฏิบัติ')
        s,j=await learn_w1(D,post_right=True); check(s==200 and j.get('passed') is True,'post-test passed through the API (no practical done)')
        w=await pathweek(D,'w1'); check(w['status']!='completed' and w['missing']==['practice'],f'week 1 is not Completed (status {w["status"]}, missing {w["missing"]})')
        pg=await page(D); await goto(pg,'#/lesson/w1/summary','.todop')
        t=await pg.inner_text('.todop'); r=await rail(pg)
        check('ผ่านฝึกปฏิบัติรวมตามเกณฑ์' in t,'summary "สิ่งที่ยังต้องทำ" lists the practical condition')
        check(r[3]['st']=='ผ่านแล้ว' and r[4]['st']!='ผ่านแล้ว' and r[2]['st']=='ยังไม่เริ่ม',f'rail: post passed, practice "{r[2]["st"]}", summary "{r[4]["st"]}"')
        lk=pg.locator('.todop a.clink[href="#/lesson/w1/lab"]').first
        check(await lk.count()==1,'the practical condition links to #/lesson/w1/lab')
        nav=await pg.evaluate("[...document.querySelectorAll('.sumnav a')].map(a=>({h:a.getAttribute('href'),big:a.classList.contains('big'),t:a.textContent}))")
        check(nav and nav[0]['big'] and nav[0]['h']=='#/lesson/w1/lab',f'summary primary button goes to the first unmet item ({nav[:1]})')
        check(not any(x['h']=='#/lesson/w2' for x in nav) and 'สัปดาห์ 2' in await pg.inner_text('.sumnav'),f'locked week 2 is not offered as a button; the reason is shown ({[x["h"] for x in nav]})')
        check(r[0]['st']=='ทำแล้ว' and 'taken' in r[0]['cls'].split() and 'done' not in r[0]['cls'].split(),f'pre-test step reads "ทำแล้ว" (no pass mark), not "ผ่านแล้ว" ({r[0]["st"]})')
        await axe(pg,'#app','#/lesson/w1/summary')
        await pg.screenshot(path=f'{OUT}/p19_summary_missing_practice_390.png',full_page=True)
        await lk.click(); await pg.wait_for_selector('#prPage[data-week=w1]'); check(pg.url.endswith('#/lesson/w1/lab') and not pg._errs,'the link opens the practical of week 1')

        print('== 4. a practical submitted with a low score: step 3 is "ต้องทบทวน", not "ผ่านแล้ว"')
        E_,eId=await make_student(b,T,cid,5,'นักเรียน ฝึกปฏิบัติต่ำ')
        pg=await page(E_); await goto(pg,'#/lesson/w1/lab','#prStart')
        await pg.click('#prStart'); await pg.wait_for_selector('#prClock'); await pg.click('#prSubmit'); await pg.click('#prSubmitYes'); await pg.wait_for_selector('#prResult')
        await pg.wait_for_timeout(800); r=await rail(pg)
        check(await pg.get_attribute('#prResult','data-passed')=='false' and (await pg.inner_text('#prTotal')).strip()=='0%','submitted with no work: result 0%, not passed')
        check(r[2]['st']=='ต้องทบทวน' and 'needrev' in r[2]['cls'].split() and 'done' not in r[2]['cls'].split(),f'step 3 is "{r[2]["st"]}" after a low practical')
        check(r[0]['st']=='ยังไม่เริ่ม','pre-test not taken: "ยังไม่เริ่ม"')
        check((await pathweek(E_,'w1'))['steps']['practice']=='review','server agrees: steps.practice = review')
        check(await pg.locator('.prresitem .prmark.ok').count()==0 and await pg.locator('.prresitem .prreason').count()==len(W1['items']),'no check mark on any activity, every activity has a reason')
        await axe(pg,'#prResult','practical result panel')
        await pg.screenshot(path=f'{OUT}/p19_lab_low_390.png',full_page=True)

        print('== 5. Troubleshooting is a part of the practical; an analysis week names it')
        await post(T,f'/api/teacher/classes/{cid}/unlock',{'lesson':'w7','reason':'ทดสอบส่วน Troubleshooting'})
        await post(T,f'/api/teacher/classes/{cid}/unlock',{'lesson':'w3','reason':'ทดสอบกิจกรรมวิเคราะห์'})
        ana=next(w for w in ['w3','w15','w17'] if K['weeks'][w]['type']=='analysis')
        for w_,theme in [(390,'light'),(1366,'dark')]:
            ctx=await new_ctx(b,w_,theme); await ctx.add_cookies(await A.cookies()); pg=await page(ctx)
            await goto(pg,'#/lesson/w7/lab','#prPlan')
            parts=await pg.eval_on_selector_all('#prPlan .prplanpart','e=>e.map(x=>x.dataset.part)')
            h=await pg.inner_text('#prPlan .prplanpart[data-part=trouble] h3')
            trouble=[i['key'] for i in K['weeks']['w7']['items'] if i['part']=='trouble']
            inpart=[k for k in trouble if await pg.locator(f'#prPlan .prplanpart[data-part=trouble] .prplanitem[data-key="{k}"]').count()==1]
            check(parts[-1]=='trouble' and 'Troubleshooting Lab' in h and inpart==trouble,
                  f'{w_}/{theme}: w7 practical ends with the Troubleshooting Lab part and its missions {trouble}')
            check(await pg.locator('#prMinutes').count()==1 and 'นาที' in await pg.inner_text('#prMinutes'),f'{w_}/{theme}: one total time for the whole practical ({await pg.inner_text("#prMinutes")})')
            check(await hscroll(pg)<=0,f'{w_}/{theme}: no horizontal scroll on the practical plan')
            await axe(pg,'#app',f'#/lesson/w7/lab {w_}/{theme}')
            await pg.screenshot(path=f'{OUT}/p19_lab_w7_{w_}_{theme}.png',full_page=True)
            await ctx.close()
        pg=await page(A); await goto(pg,f'#/lesson/{ana}/lab','#prPlan')
        check('กิจกรรมวิเคราะห์' in await pg.inner_text('#prPlan .prplanpart[data-part=trouble] h3'),f'{ana} (analysis week): the last part is named "กิจกรรมวิเคราะห์"')

        print('== 7. teacher: practical matrix and history tab; practical condition, pass mark and weights persist')
        tp=await T.new_page(); tp.on('dialog',lambda d: asyncio.ensure_future(d.accept()))
        await tp.goto(BASE+'/teacher.html'); await tp.wait_for_selector('.side')
        await tp.locator('.side .navbtn:has-text("ปวช.2/19")').click(); await tp.wait_for_selector('.tabs')
        tabs=await tp.eval_on_selector_all('.tabs button','e=>e.map(x=>x.textContent.trim())')
        check(tabs[0]=='ผลฝึกปฏิบัติ' and 'ประวัติ (ระบบเดิม)' in tabs and 'คะแนนแล็บ' not in tabs,f'tabs: "ผลฝึกปฏิบัติ" first, "ประวัติ (ระบบเดิม)" kept, no "คะแนนแล็บ" ({tabs[:3]}...)')
        await tp.wait_for_selector('#prMatrix')
        cell=tp.locator(f'#prMatrix button.prcell[data-uid="{eId}"][data-week="w1"]')
        check(await cell.count()==1 and '0%' in await cell.inner_text(),'the matrix shows the low practical of week 1 (0%)')
        await tp.screenshot(path=f'{OUT}/p19_teacher_matrix.png',full_page=True)
        await tp.locator('.tabs button:has-text("ประวัติ (ระบบเดิม)")').click(); await tp.wait_for_timeout(800)
        check('ห้องนี้ไม่มีคะแนนจากระบบเดิม' in await tp.inner_text('main') or await tp.locator('table.histm').count()==1,'history tab opens (this new class has no old scores)')
        await tp.locator('.tabs button:has-text("เส้นทางการเรียน")').click(); await tp.wait_for_selector('#pathrules')
        cb=tp.locator('#preq-practice input[type=checkbox]')
        check(await cb.count()==1 and await cb.is_checked() and await tp.locator('#preq-solve, #preq-guided').count()==0 and 'ผ่านฝึกปฏิบัติรวมตามเกณฑ์' in await tp.inner_text('#preq-practice'),'one practical condition, checked by default; no guided / solve conditions')
        check('เกณฑ์ผ่านภารกิจ Guided Lab' not in await tp.inner_text('#pathrules'),'no separate Guided pass mark (guidedPct) any more')
        await tp.fill('#prPass','60'); await tp.fill('#prWG','20'); await tp.fill('#prWI','50'); await tp.fill('#prWT','30')
        check('ครบ' in await tp.inner_text('#prWSum'),'the weight sum shows "ครบ" at 100%')
        await tp.locator('#pathrules button[type=submit]').click(); await tp.wait_for_selector('#pathSaved',timeout=8000)
        await tp.reload(); await tp.wait_for_selector('.side'); await tp.locator('.side .navbtn:has-text("ปวช.2/19")').click(); await tp.wait_for_selector('.tabs')
        await tp.locator('.tabs button:has-text("เส้นทางการเรียน")').click(); await tp.wait_for_selector('#pathrules')
        vals=[await tp.input_value(x) for x in ['#prPass','#prWG','#prWI','#prWT']]
        check(vals==['60','20','50','30'],f'pass mark and weights stay after saving and reloading ({vals})')
        pr=(await get(T,f'/api/teacher/classes/{cid}/path'))['settings']['practical']
        check(pr['passPct']==60 and pr['weights']=={'guided':20,'independent':50,'trouble':30},f'server stored the practical settings {pr}')
        await tp.fill('#prWT','40'); check('ต้องรวมได้ 100%' in await tp.inner_text('#prWSum'),'a sum of 110% is flagged')
        await tp.locator('#pathrules button[type=submit]').click(); await tp.wait_for_timeout(1200)
        check((await get(T,f'/api/teacher/classes/{cid}/path'))['settings']['practical']['weights']['trouble']==30 and await tp.locator('#pathrules .msg.bad').count()==1,'weights that do not sum to 100 are refused with a message')
        await tp.click('#prDefaults'); await tp.locator('#pathrules button[type=submit]').click(); await tp.wait_for_selector('#pathSaved',timeout=8000)
        pr=(await get(T,f'/api/teacher/classes/{cid}/path'))['settings']['practical']
        check(pr['passPct']==70 and pr['weights']=={'guided':30,'independent':40,'trouble':30},f'"ใช้ค่าเริ่มต้น" restores 70% and 30/40/30 ({pr})')
        await tp.screenshot(path=f'{OUT}/p19_teacher_path.png')
        for w_ in (360,390):
            M=await new_ctx(b,w_); await M.add_cookies(await T.cookies()); mp=await page(M)
            await mp.goto(BASE+'/teacher.html'); await mp.wait_for_function("typeof CLASSES!=='undefined'&&CLASSES.length>0")
            await mp.evaluate(f"go({{type:'class',id:{cid}}})"); await mp.wait_for_selector('.tabs')
            await mp.locator('.tabs button:has-text("เส้นทางการเรียน")').click(); await mp.wait_for_selector('#pathrules'); await mp.wait_for_selector('.ptable'); await mp.wait_for_timeout(500)
            check(await hscroll(mp)<=0,f'teacher path tab {w_}px: no horizontal page scroll ({await mp.evaluate("document.documentElement.scrollWidth")}px wide)')
            wr=await mp.evaluate("[...document.querySelectorAll('.tablewrap')].map(t=>({tab:t.getAttribute('tabindex'),lbl:t.getAttribute('aria-label'),scroll:t.scrollWidth>t.clientWidth}))")
            check(wr and all(x['tab']=='0' and x['lbl'] for x in wr) and any(x['scroll'] for x in wr),f'{w_}px: wide tables scroll inside a focusable, labelled container ({len(wr)} tables)')
            await mp.locator('.ptable button').first.click(); await mp.wait_for_selector('#stuunlock'); await mp.wait_for_timeout(400)
            check(await hscroll(mp)<=0,f'{w_}px: one student\'s path detail has no horizontal page scroll')
            await mp.screenshot(path=f'{OUT}/p19_teacher_path_{w_}.png',full_page=True)
            await M.close()

        print('== 5b. everything but the practical: week 1 not Completed, only the practical is missing')
        F,fId=await make_student(b,T,cid,6,'นักเรียน ครบยกเว้นฝึกปฏิบัติ')
        s,j=await learn_w1(F); check(s==200 and j.get('passed') is True,'week 1: pre, all reading, exercises and post-test done')
        w=await pathweek(F,'w1'); check(w['status']!='completed' and w['missing']==['practice'],f'week 1 not Completed, missing only the practical ({w["status"]}, {w["missing"]})')
        pg=await page(F); await goto(pg,'#/lesson/w1/summary','.todop')
        r=await rail(pg); check([x['st'] for x in r]==['ทำแล้ว','ผ่านแล้ว','ยังไม่เริ่ม','ผ่านแล้ว','ยังไม่เริ่ม'],f'rail matches the real states {[x["st"] for x in r]}')
        t=await pg.inner_text('.todop')
        check('ผ่านฝึกปฏิบัติรวมตามเกณฑ์' in t and await pg.locator('.todop a.clink[href="#/lesson/w1/lab"]').count()==1,'summary lists the practical condition with a link to the practical')

        print('== 8. x15 in the week 1 practical (3.5: embedded; #/sim/troubleshoot/x15 redirects there): no terminal, basic note, solved by plugging the cable')
        await pg.goto(BASE+'/#/sim/troubleshoot/x15'); await pg.wait_for_function("location.hash==='#/lesson/w1/lab'",timeout=10000)
        await pg.wait_for_selector('.prOpenSim[data-key="troubleshoot:x15"]'); ok('the old link #/sim/troubleshoot/x15 opens the week 1 practical')
        await pg.locator('.prOpenSim[data-key="troubleshoot:x15"]').first.tap(); await pg.wait_for_selector('.prwsneed')
        check(await pg.locator('#prWs').count()==0 and 'กดเริ่มฝึกปฏิบัติก่อน' in await pg.inner_text('.prwsneed'),'outside a running practical the mission does not open: "กดเริ่มฝึกปฏิบัติก่อน"')
        await pg.locator('#prStart').tap(); await pg.wait_for_selector('#prClock')
        await pg.locator('.prtabs .prpart[data-part=trouble]').tap(); await pg.locator('.prOpenSim[data-key="troubleshoot:x15"]').tap()
        await pg.wait_for_selector('#prWs[data-key="troubleshoot:x15"][data-mode=run] #prWsSim .nls-troubleshoot-submit',state='attached',timeout=15000); await pg.wait_for_timeout(800)
        Q='#prWsSim '
        tsec=pg.locator(Q+'[data-stage="1t"]')
        check(await tsec.count()==1 and not await tsec.is_visible() and await pg.locator(Q+'.nls-troubleshoot-termbox').evaluate('e=>!e.offsetParent'),'the command terminal section is not shown')
        check(await pg.locator(Q+'.nls-troubleshoot-note',has_text='ภารกิจพื้นฐาน').count()==1,'the basic-mission note is shown')
        cond=await pg.inner_text(Q+'[data-stage="4"] .nls-troubleshoot-muted')
        check('ทดสอบการเชื่อมต่อ จาก PC3 ไป FileServer' in cond and 'ping' not in cond and '192.168' not in cond,f'the pass condition uses device names ({cond.strip()})')
        if await pg.locator(Q+'.nls-troubleshoot-esel option[value="pc3"]').count(): await pg.select_option(Q+'.nls-troubleshoot-esel','pc3'); await pg.wait_for_timeout(300)
        ed=await pg.inner_text(Q+'.nls-troubleshoot-editor')
        check(await pg.locator(Q+'.nls-troubleshoot-editor [data-f]').count()==0 and not any(x in ed for x in ['DHCP','Subnet','Gateway','DNS','Firewall','IP address']) and await pg.locator(Q+'.nls-troubleshoot-editor [data-link]').count()>=1,
              f'basic mission: the fix panel shows only the cable toggle ({ed.strip()[:80]!r})')
        await pg.screenshot(path=f'{OUT}/p19_x15_start_390.png',full_page=True)
        await pg.evaluate("""()=>{const r=document.querySelector('#prWsSim input[name="nls-troubleshoot-cause"][value="cable"]');r.checked=true;r.dispatchEvent(new Event('change',{bubbles:true}))}""")
        await pg.select_option(Q+'.nls-troubleshoot-esel','pc3') if await pg.locator(Q+'.nls-troubleshoot-esel option[value="pc3"]').count() else None
        await pg.wait_for_timeout(300)
        lk=pg.locator(Q+'input[data-link="l3"]').first
        if not await lk.count():
            await pg.select_option(Q+'.nls-troubleshoot-esel',await pg.evaluate("[...document.querySelectorAll('#prWsSim .nls-troubleshoot-esel option')].map(o=>o.value).find(v=>/sw/i.test(v))"))
            await pg.wait_for_timeout(300); lk=pg.locator(Q+'input[data-link="l3"]').first
        await lk.evaluate("e=>{e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}))}")
        await pg.wait_for_timeout(300)
        await pg.locator(Q+'.nls-troubleshoot-test').evaluate('e=>e.click()'); await pg.wait_for_timeout(1500)
        tr=await pg.inner_text(Q+'.nls-troubleshoot-testres')
        check('ผ่าน 1/1' in tr and 'ทดสอบการเชื่อมต่อ จาก PC3 ไป FileServer' in tr and 'ping' not in tr.lower() and '192.168' not in tr,f'test result worded with device names ({tr.strip()[:90]!r})')
        await pg.locator(Q+'.nls-troubleshoot-submit').evaluate('e=>e.click()')
        await pg.wait_for_function("()=>/\\d+\\s*\\/\\s*10/.test((document.querySelector('#prWsSim .nls-troubleshoot-result')||{}).textContent||'')",timeout=10000)
        res=await pg.inner_text(Q+'.nls-troubleshoot-result'); check('10/10' in res.replace(' ',''),f'plugging the cable scores 10 ({res[:80]!r})')
        check(sql(f"SELECT best FROM sim_results WHERE user_id={fId} AND sim='troubleshoot' AND mission='x15'")=='10','the server stored 10 for x15')
        await pg.wait_for_selector('#prWsNote.ok'); nt=await pg.inner_text('#prWsNote')
        check('บันทึกผลลงฝึกปฏิบัติแล้ว' in nt and sql(f"SELECT count(*) FROM practical_items i JOIN practical_sessions s ON s.id=i.session_id WHERE s.user_id={fId} AND i.item='troubleshoot:x15' AND i.score=10")=='1',f'the result is recorded into the running week 1 practical ({nt.strip()[:70]!r})')
        await pg.screenshot(path=f'{OUT}/p19_x15_done_390.png',full_page=True)
        await pg.locator('#prWsClose').tap()
        w=await pathweek(F,'w1'); check(w['status']!='completed' and w['missing']==['practice'],'x15 done while the practical still runs does not complete week 1')
        j=await practical(F,'w1',1)
        check(j['best']['passed'] and j['best']['total']==100,f'week 1 practical passed ({j["best"]["total"]}%)')
        await goto(pg,'#/lesson/w1/summary','.todop')
        w=await pathweek(F,'w1'); r=await rail(pg)
        check(w['status']=='completed' and r[2]['st']=='ผ่านแล้ว' and r[4]['st']=='ผ่านแล้ว','after the practical passes, week 1 is Completed and steps 3 and 5 are "ผ่านแล้ว"')
        nav=await pg.evaluate("[...document.querySelectorAll('.sumnav a.btn.big')].map(a=>a.getAttribute('href'))")
        check(nav==['#/lesson/w2'],f'completed week: the primary button goes to week 2 ({nav})')
        t=await pg.inner_text('#prSummary'); check('100%' in t and 'ผ่านเกณฑ์' in t,'summary shows the practical result 100% passed')
        await pg.screenshot(path=f'{OUT}/p19_completed_390.png')

        print('== 6. old URLs open the practical (guest); no optional review cards anywhere')
        for w_,theme in [(390,'light'),(390,'dark'),(1366,'light'),(1366,'dark')]:
            ctx=await new_ctx(b,w_,theme); pg=await page(ctx)
            bad_=[]
            for old in ['#/lesson/w9/extra','#/lesson/w9/challenge','#/lesson/w9/challenge/r9','#/lesson/w9/extra/r9','#/lesson/w9/solve','#/room/r9']:
                await pg.goto(BASE+'/'+old); await pg.wait_for_selector('#prPage[data-week=w9]'); await pg.wait_for_timeout(250)
                if not pg.url.endswith('#/lesson/w9/lab'): bad_.append(old+' -> '+pg.url.split('#')[1])
            check(not bad_,f'{w_}/{theme}: every old URL of week 9 opens #/lesson/w9/lab '+'; '.join(bad_))
            r=await rail(pg)
            check([x['label'] for x in r]==STEPS and [x['step'] for x in r if 'on' in x['cls'].split()]==['lab'],f'{w_}/{theme}: 5-step rail with "ฝึกปฏิบัติ" current')
            check(await pg.locator('#prPage[data-mode=guest] #prLogin').count()==1,f'{w_}/{theme}: guests see the plan and "เข้าสู่ระบบ"')
            check(await hscroll(pg)<=0,f'{w_}/{theme}: no horizontal scroll on #/lesson/w9/lab')
            await axe(pg,'#app',f'#/lesson/w9/lab guest {w_}/{theme}')
            await pg.screenshot(path=f'{OUT}/p19_lab_w9_{w_}_{theme}.png',full_page=True)
            await goto(pg,'#/lesson/w9/summary','.todop')
            t=await pg.inner_text('#app')
            check(await pg.locator('.xcard').count()==0 and 'ฝึกทบทวนเพิ่มเติม' not in t and await pg.locator('#prSummary').count()==1,f'{w_}/{theme}: summary has the practical box and no optional review card')
            await goto(pg,'#/lesson/w9','.lhead'); check(await pg.locator('.xcard').count()==0 and 'ฝึกทบทวนเพิ่มเติม' not in await pg.inner_text('#app'),f'{w_}/{theme}: lesson overview has no optional review card')
            await goto(pg,'#/results','#app h1')
            rt=await pg.inner_text('#app'); check('ภารกิจท้าทาย' not in rt and 'ฝึกทบทวนเพิ่มเติม' not in rt and 'ฝึกปฏิบัติ' in rt,f'{w_}/{theme}: results page has one "ฝึกปฏิบัติ" column and no old names')
            check(not pg._errs,f'{w_}/{theme}: no page errors {pg._errs[:2]}')
            await ctx.close()

        print('== 9. legacy class (sequential off) with old scores')
        L1=await new_ctx(b,1366); await login(L1,'s1','Stud1234'); me=await get(L1,'/api/me'); sId=me['user']['id']
        check((await get(L1,'/api/path'))['sequential'] is False,'the fixture class does not use sequential learning')
        sql(f"""INSERT INTO quiz_attempts(user_id,lesson_id,kind,answers,results,score,max,submitted_at) VALUES({sId},'w2','pre','[]','[]',4,10,now()-interval '30 days'),
             ({sId},'w2','post','[]','[]',8,10,now()-interval '29 days'),({sId},'w3','post','[]','[]',5,10,now()-interval '20 days')""")
        for i in K['weeks']['w2']['items']:
            if i['kind']=='mission':
                sim,m=i['key'].split(':'); sql(f"INSERT INTO sim_results(user_id,sim,mission,best,max) VALUES({sId},'{sim}','{m}',9,10) ON CONFLICT DO NOTHING")
            else: sql(f"INSERT INTO task_progress(user_id,task_key,lab_id,attempts,solved,points,solved_at) VALUES({sId},'{i['key']}','w2',0,true,10,now()-interval '29 days') ON CONFLICT DO NOTHING")
        sql("DELETE FROM app_migrations WHERE id='practical-1'"); subprocess.check_output(['node','-e',MIGRATE],cwd=ROOT,env={**os.environ,'DATABASE_URL':DB})
        check(sql(f"SELECT count(*) FROM practical_sessions WHERE user_id={sId} AND lesson_id='w2' AND status='legacy'")=='1','the old week 2 work is kept as one "ระบบเดิม" practical result')
        pg=await page(L1); await goto(pg,'#/lesson/w2/summary','.todop')
        r=await rail(pg); w2=await pathweek(L1,'w2')
        MAP={'todo':'ยังไม่เริ่ม','doing':'กำลังทำ','done':'ผ่านแล้ว','review':'ต้องทบทวน'}
        srv=[MAP[w2['steps'][k]] for k in ['pre','learn','practice','post','summary']]; srv[0]='ทำแล้ว' if w2['steps']['pre']=='done' else srv[0]
        check([x['st'] for x in r]==srv,f'rail statuses match the server ({srv})')
        check(r[0]['st']=='ทำแล้ว' and r[2]['st']=='ผ่านแล้ว' and r[3]['st']=='ผ่านแล้ว' and r[1]['st']!='ผ่านแล้ว','old scores: pre taken ("ทำแล้ว"), practical (old tasks 10/10, missions 9/10) and post 8/10 passed; reading not done')
        nav=await pg.evaluate("[...document.querySelectorAll('.sumnav a')].map(a=>({h:a.getAttribute('href'),big:a.classList.contains('big')}))")
        check(nav and nav[0]['big'] and nav[0]['h'].startswith('#/lesson/w2/content') and any(x['h']=='#/lesson/w3' and not x['big'] for x in nav),f'not completed, next week open (sequential off): first unmet item is primary, week 3 offered as a secondary button ({nav})')
        t=await pg.inner_text('#app'); check('ดีที่สุด 8/10' in t and '4/10' in t and 'ผลจากงานเดิมก่อนปรับระบบ' in t,'old scores are shown (pre 4/10, post best 8/10, the practical marked as earlier work)')
        await goto(pg,'#/lesson/w2/lab','#prResult'); check(await pg.get_attribute('#prResult','data-status')=='legacy','the practical page shows the old result ("ระบบเดิม")')
        await goto(pg,'#/lesson/w3/post'); r=await rail(pg); check(r[3]['st']=='ต้องทบทวน','an old post-test of 5/10 shows "ต้องทบทวน"')
        await goto(pg,'#/results','#app h1'); t=await pg.inner_text('.restable'); check('8/10' in t and '5/10' in t,'results page still shows the old post-test scores')
        await pg.screenshot(path=f'{OUT}/p19_legacy_results_1366.png',full_page=True)

        print('== wording')
        out=subprocess.run(['grep','-rn','ภารกิจท้าทาย',os.path.join(ROOT,'public')],capture_output=True,text=True).stdout.strip()
        check(not out,'no "ภารกิจท้าทาย" left in public/ '+out[:200])
        await b.close()
    print(f'\n{len(issues)} problem(s)'); [print('  -',i) for i in issues]
    sys.exit(1 if issues else 0)
asyncio.run(main())
