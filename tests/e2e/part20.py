# Part 20 (3.2): one practical session per week ("ฝึกปฏิบัติ") in a real browser: the 12 checks of the requirement (item 10).
#  1 five lesson steps (rail, dashboard strip, results)            2 no challenge / solve / extra step or link; old URLs redirect
#  3 Troubleshooting is the last part inside ฝึกปฏิบัติ             4 one timer: start once, switching parts never restarts it
#  5 reload / cleared browser storage / another device: same deadline (also via GET /api/practical/active)
#  6 a simulator mission opened from the practical (3.3: in the Embedded Virtual Lab workspace on the same page) keeps the
#    time (#prWsClock, same deadline); its submit is recorded into the session (#prWsNote) and the card changes state at once
#  7 the total is computed correctly (from the result parts and the weights, and by hand from the real answers)
#  8 no double counting (same mission twice, same task twice, through another menu; no key in two weeks)
#  9 old scores kept (earlier work migrated to a "ระบบเดิม" result; history tab; nothing deleted)
# 10 the lock: week 2 stays locked until week 1 is complete with the practical passed
# 11 the teacher sees per-activity results (matrix cell -> detail with items and reasons) and a void gives the attempt back
# 12 desktop 1280x800 and phone 360x740 (touch): no horizontal scroll on the lab page, results, the embedded workspace,
#    teacher matrix and detail
# plus: time up -> the session closes by itself (status timeout, also from the bar on another page); check marks only on
#    passed activities, a reason on every other one; answers after the deadline are refused.
# usage: E2E_BASE=http://127.0.0.1:3990 E2E_DATABASE_URL=postgres://... python3 tests/e2e/part20.py <out-dir>
#   (needs the tests/e2e/setup.js fixture: teacher kru4 / Teach1234, legacy class ปวช.2/4 with s1, s2 / Stud1234;
#    it makes its own class, which uses the default rules: sequential, practical 70%, weights 30/40/30, 3 attempts, 10 min)
import asyncio, sys, os, subprocess, json, re, time
from playwright.async_api import async_playwright
OUT=sys.argv[1] if len(sys.argv)>1 else '/tmp/netlab-e2e'; os.makedirs(OUT,exist_ok=True)
BASE=os.environ.get('E2E_BASE','http://127.0.0.1:3990')
DB=os.environ.get('E2E_DATABASE_URL','postgres://postgres@127.0.0.1:5433/netlab_e2e')
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
H={'X-NetLab':'1'}
STEPS=['ก่อนเรียน','เนื้อหา','ฝึกปฏิบัติ','หลังเรียน','สรุปผล']
VIEWS=[('desktop',1280,800,False),('phone',360,740,True)]
MIGRATE="""const db=require('./server/db'),P=require('./server/practical');(async()=>{await db.init(process.env.DATABASE_URL);await P.migrate();await db.close();})().catch(e=>{console.error(e);process.exit(1)})"""
issues=[]
def bad(m): issues.append(m); print('  ✗',m)
def ok(m): print('  ✓',m)
def check(c,m): ok(m) if c else bad(m)
def sql(q): return subprocess.check_output(['psql',DB,'-tAqc',q]).decode().strip()
# lesson answers of week 1 and the task answers of the week 1 practical, from the server's own content
K=json.loads(subprocess.check_output(['node','-e',r"""
const { LESSONS, formOf } = require('./server/lessons'); const C = require('./server/content'); const P = require('./server/practical');
const right = q => q.type === 'choice' ? q.correct : q.type === 'multi' ? q.correct : q.type === 'tf' ? q.answer : q.answers[0];
const L = LESSONS.get('w1'); let n = 0; const checks = [];
for (const s of L.sections) for (const b of s.blocks) if (b.type === 'check') { if (!s.extra) checks.push({ key: `L:w1:c:${n}`, answer: right(b.q) }); n++; }
const tasks = {}; for (const i of P.setOf('w1').items) if (i.kind === 'task') tasks[i.key] = C.TASKS.get(i.key).task.answers[0];
console.log(JSON.stringify({ sections: L.sections.filter(s => !s.extra).map(s => s.id), checks, pre: L.quiz.length, postRight: formOf(L, 'post').map(right), tasks,
  items: { w1: P.setOf('w1').items.map(i => ({ key: i.key, part: i.part, kind: i.kind, max: i.max })) } }));"""],cwd=ROOT,stderr=subprocess.DEVNULL))
TASKS=list(K['tasks'])   # w1-8, w1-9, w1-10

async def req(ctx,method,path,body=None):
    r=await getattr(ctx.request,method)(BASE+path,**({'data':body} if body is not None else {}),headers=H)
    try: j=await r.json()
    except Exception: j={}
    return r.status,j
async def login(ctx,u,p):
    s,j=await req(ctx,'post','/api/auth/login',{'username':u,'password':p}); assert s==200, j
async def new_ctx(b,w,h,touch,theme='light'):
    ctx=await b.new_context(viewport={'width':w,'height':h},has_touch=touch,is_mobile=touch,color_scheme=theme)
    await ctx.add_init_script(f"try{{localStorage.setItem('netlab-theme','{theme}');localStorage.setItem('netlab-onboard','done')}}catch(e){{}}")
    return ctx
async def page(ctx):
    pg=await ctx.new_page(); pg._errs=[]; pg.on('pageerror',lambda e:pg._errs.append(str(e))); pg.on('dialog',lambda d: asyncio.ensure_future(d.accept()))
    return pg
async def make_student(b,T,cid,no,name,w=1280,h=800,touch=False):
    s,cr=await req(T,'post',f'/api/teacher/classes/{cid}/students',{'rows':[{'no':str(no),'name':name}]}); c=cr['created'][0]
    ctx=await new_ctx(b,w,h,touch); await login(ctx,c['username'],c['password'])
    await req(ctx,'post','/api/auth/password',{'current':c['password'],'next':'Prac1234'})
    s,me=await req(ctx,'get','/api/me'); return ctx,me['user']['id']
async def hscroll(pg):
    """document.scrollingElement.scrollWidth against innerWidth and the device width (mobile emulation may widen innerWidth)"""
    d=await pg.evaluate('({sw:document.scrollingElement.scrollWidth,iw:innerWidth})')
    return d['sw']-min(d['iw'],pg.viewport_size['width'])
def secs(t):
    m=re.match(r'^\s*(\d+):(\d\d)\s*$',t or ''); return int(m.group(1))*60+int(m.group(2)) if m else None
async def clock(pg,sel='#prClock'): return secs(await pg.inner_text(sel))
async def active(ctx):
    s,j=await req(ctx,'get','/api/practical/active'); return j
async def state(ctx,wid='w1'):
    s,j=await req(ctx,'get',f'/api/practical/{wid}'); return j
async def answer(pg,key,text):
    card=pg.locator(f'#task-{key}'); await card.locator('input').fill(text); await card.locator('.row .btn').click()
    await pg.wait_for_function(f"(()=>{{const m=document.querySelector('#task-{key} .msg');return m&&!/กำลังตรวจ/.test(m.textContent)&&m.textContent.trim().length>0}})()",timeout=10000)
    await pg.wait_for_timeout(300)
    return await pg.locator(f'#task-{key}.solved').count()==1
async def learn_w1(ctx):
    await req(ctx,'post','/api/lessons/w1/quiz',{'kind':'pre','answers':[0]*K['pre']})
    for s in K['sections']: await req(ctx,'post','/api/lessons/w1/visit',{'section':s})
    for c in K['checks']: await req(ctx,'post','/api/lessons/w1/check',c)
    return await req(ctx,'post','/api/lessons/w1/quiz',{'kind':'post','answers':K['postRight']})
async def recorded_practical(ctx,wid,frac):
    """a whole session through the API with every activity at frac of its full marks, written as the server records it during
    the session (the real answer and simulator paths are covered by the browser flow above); returns the submitted state"""
    s,j=await req(ctx,'post',f'/api/practical/{wid}/start'); assert s==200, j
    sid=j['running']['id']
    if frac>0:
        sql("INSERT INTO practical_items(session_id,item,part,score,max,solved) VALUES "+','.join(f"({sid},'{i['key']}','{i['part']}',{round(frac*i['max'],1)},{i['max']},{'true' if frac>=1 else 'false'})" for i in K['items'][wid]))
    s,j=await req(ctx,'post',f'/api/practical/{wid}/submit'); assert s==200 and j['submitted'], j
    return j
def expected_total(res):
    """recompute the session total from the item scores and the weights (server/practical.js evaluate)"""
    parts=[]
    for p in res['parts']:
        fr=[(i['score']/10 if i['passed'] else 0) if i['kind']=='task' else min(1,i['score']/i['max']) for i in p['items']]
        pct=round(100*sum(round(f*100)/100 for f in fr)/len(fr)) if fr else 0
        parts.append((p['id'],p['weight'],pct))
    ws=sum(w for _,w,_ in parts)
    return {i:pct for i,_,pct in parts}, round(sum(w*pct for _,w,pct in parts)/ws)
async def solve_x15(pg,scope='#prWsSim '):
    """the basic Troubleshooting mission of week 1 in the simulator UI: the cause is the cable, plug link l3, test, submit
    (scope: the embedded workspace of the practical page)"""
    S=scope
    await pg.wait_for_selector(S+'.nls-troubleshoot-submit',state='attached',timeout=15000); await pg.wait_for_timeout(600)
    await pg.evaluate("""s=>{const r=document.querySelector(s+'input[name="nls-troubleshoot-cause"][value="cable"]');r.checked=true;r.dispatchEvent(new Event('change',{bubbles:true}))}""",S)
    if await pg.locator(S+'.nls-troubleshoot-esel option[value="pc3"]').count(): await pg.select_option(S+'.nls-troubleshoot-esel','pc3')
    await pg.wait_for_timeout(300)
    lk=pg.locator(S+'input[data-link="l3"]').first
    if not await lk.count():
        await pg.select_option(S+'.nls-troubleshoot-esel',await pg.evaluate("s=>[...document.querySelectorAll(s+'.nls-troubleshoot-esel option')].map(o=>o.value).find(v=>/sw/i.test(v))",S))
        await pg.wait_for_timeout(300); lk=pg.locator(S+'input[data-link="l3"]').first
    await lk.evaluate("e=>{e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}))}"); await pg.wait_for_timeout(300)
    await pg.locator(S+'.nls-troubleshoot-test').evaluate('e=>e.click()'); await pg.wait_for_timeout(1200)
    async with pg.expect_response(lambda r:'/api/sims/troubleshoot/submit' in r.url) as rr:
        await pg.locator(S+'.nls-troubleshoot-submit').evaluate('e=>e.click()')
    return await (await rr.value).json()

async def student_flow(b,T,cid,tag,w,h,touch,no):
    S,uid=await make_student(b,T,cid,no,f'นักเรียน {tag}',w,h,touch)
    pg=await page(S)
    print(f'== [{tag} {w}x{h}] 1. five steps')
    await pg.goto(BASE+'/#/lesson/w1'); await pg.wait_for_selector('.rail .rstep'); await pg.wait_for_timeout(400)
    rs=await pg.evaluate("[...document.querySelectorAll('.rail .rstep')].map(a=>({step:a.dataset.step,label:a.querySelector('.rl').firstChild.textContent.trim(),href:a.getAttribute('href')}))")
    check([x['label'] for x in rs]==STEPS and [x['step'] for x in rs]==['pre','content','lab','post','summary'],f'{tag}: the rail has exactly the 5 steps {[x["label"] for x in rs]}')
    await pg.goto(BASE+'/#/'); await pg.wait_for_selector('.resumep .minirail'); await pg.wait_for_timeout(300)
    segs=await pg.eval_on_selector_all('.resumep .minirail .seg','e=>e.map(x=>x.dataset.step)')
    check(segs==['pre','content','lab','post','summary'],f'{tag}: dashboard step strip has 5 steps ({segs})')
    await pg.goto(BASE+'/#/results'); await pg.wait_for_selector('.rescards',state='attached'); await pg.wait_for_timeout(300)
    check(await pg.locator('[data-step=lab]').count()>=18 and 'ฝึกแก้ปัญหา' not in await pg.inner_text('#app'),f'{tag}: results page has one "ฝึกปฏิบัติ" result per week, no step-4 column')

    print(f'== [{tag}] 2. no challenge / solve / extra tab or link; old URLs redirect')
    OLD=r'/solve|/extra|/challenge|#/room/'
    for rt in ['#/lesson/w1','#/lesson/w1/content','#/lesson/w1/lab','#/lesson/w1/summary','#/learn','#/']:
        await pg.goto(BASE+'/'+rt); await pg.wait_for_selector('#app > *'); await pg.wait_for_timeout(500)
        hrefs=await pg.eval_on_selector_all('a[href]','e=>e.map(a=>a.getAttribute("href"))')
        txt=await pg.inner_text('body')
        bad_=[x for x in hrefs if re.search(OLD,x)]+[t for t in ['ภารกิจท้าทาย','ฝึกทบทวนเพิ่มเติม'] if t in txt]
        check(not bad_,f'{tag}: {rt} has no link or tab to the old challenge / solve / extra steps {bad_[:3]}')
    for old in ['#/lesson/w1/solve','#/lesson/w1/extra','#/lesson/w1/challenge','#/lesson/w1/challenge/r1','#/lesson/w1/extra/r1','#/room/r1']:
        await pg.goto(BASE+'/'+old); await pg.wait_for_selector('#prPage[data-week=w1]'); await pg.wait_for_timeout(200)
        check(pg.url.endswith('#/lesson/w1/lab'),f'{tag}: {old} -> #/lesson/w1/lab')

    print(f'== [{tag}] 3. Troubleshooting is a part of ฝึกปฏิบัติ')
    await pg.wait_for_selector('#prPage[data-mode=pre] #prPlan')
    st0=await state(S)
    parts=await pg.eval_on_selector_all('#prPlan .prplanpart','e=>e.map(x=>x.dataset.part)')
    check(parts==['guided','independent','trouble'],f'{tag}: the plan has Guided, Independent and Troubleshooting Lab in order ({parts})')
    check(await pg.locator('#prPlan .prplanpart[data-part=trouble] .prplanitem[data-key="troubleshoot:x15"]').count()==1,f'{tag}: the Troubleshooting mission x15 is inside the practical plan')
    check((await pg.inner_text('#prMinutes')).strip()==f"{st0['minutes']} นาที" and await pg.locator('#prStart').count()==1,f'{tag}: one total time ({st0["minutes"]} นาที) and one start button before starting')
    check(await pg.locator('#prTimer, #prClock').count()==0,f'{tag}: no timer runs before "เริ่มฝึกปฏิบัติ"')
    check(await hscroll(pg)<=0,f'{tag}: no horizontal scroll on the plan')
    await pg.screenshot(path=f'{OUT}/p20_{tag}_plan.png',full_page=True)

    print(f'== [{tag}] 4. one timer: start once, switching parts never restarts it')
    await pg.click('#prStart'); await pg.wait_for_selector('#prClock')
    a0=await active(S); dl=a0['session']['deadline']
    check(a0['session']['week']=='w1' and dl-a0['session']['startedAt']==st0['minutes']*60000,f'{tag}: the server holds one session with deadline = start + {st0["minutes"]} min')
    s,again=await req(S,'post','/api/practical/w1/start')
    check(s==200 and again['running']['deadline']==dl and again['running']['id']==a0['session']['id'],f'{tag}: starting again returns the same session and deadline (no new timer)')
    c0=await clock(pg); seen=[c0]
    for pid in ['independent','trouble','guided','trouble']:
        await pg.wait_for_timeout(1300); await pg.click(f'.prtabs .prpart[data-part={pid}]')
        await pg.wait_for_selector(f'.prtabs .prpart[data-part={pid}][aria-selected=true]'); await pg.wait_for_timeout(200)
        seen.append(await clock(pg))
        if await pg.locator('#prTimer').count()!=1 or await pg.locator('[role=timer]').count()!=1: bad(f'{tag}: {pid}: more than one timer on the page')
    check(all(x is not None for x in seen) and all(seen[i+1]<seen[i] for i in range(len(seen)-1)) and seen[0]-seen[-1]<=12,f'{tag}: the clock keeps counting down across Guided -> Independent -> Troubleshooting -> Guided ({seen})')
    check(seen[0]<=st0['minutes']*60 and seen[-1]<st0['minutes']*60,f'{tag}: it never shows the full {st0["minutes"]}:00 again')
    check(await pg.locator('#prPanel .prtimer, #prPanel [role=timer]').count()==0,f'{tag}: the Troubleshooting part has no timer of its own')
    await pg.click('.prtabs .prpart[data-part=guided]'); await pg.wait_for_selector('#task-w1-8')
    # the three hands-on tasks: right first time (10), with a hint (5), one wrong answer then right (8)
    r1=await answer(pg,TASKS[0],K['tasks'][TASKS[0]])
    hb=pg.locator(f'#task-{TASKS[1]} .hint'); await hb.click(); armed='กดอีกครั้ง' in await hb.inner_text(); await hb.click(); await pg.wait_for_selector(f'#task-{TASKS[1]} .hinttext')
    r2=await answer(pg,TASKS[1],K['tasks'][TASKS[1]])
    w3=await answer(pg,TASKS[2],'10.10.10.10'); r3=await answer(pg,TASKS[2],K['tasks'][TASKS[2]])
    check(r1 and armed and r2 and not w3 and r3,f'{tag}: hands-on tasks graded on the server (hint asks for a second tap; a wrong answer is refused)')
    await pg.wait_for_timeout(900)
    check(await pg.get_attribute(f'.pritem[data-key="{TASKS[0]}"]','data-state')=='passed' and (await pg.get_attribute('.prtabs .prpart[data-part=guided]','data-passed'))=='3',f'{tag}: the Guided tab counts 3 passed activities')
    check(await hscroll(pg)<=0,f'{tag}: no horizontal scroll while the practical runs')
    await pg.screenshot(path=f'{OUT}/p20_{tag}_running.png',full_page=False)

    print(f'== [{tag}] 5. reload, cleared storage, another device: same deadline')
    b1=await active(S); c1=await clock(pg)
    await pg.reload(); await pg.wait_for_selector('#prClock'); await pg.wait_for_timeout(400)
    b2=await active(S); c2=await clock(pg)
    exp=(b2['session']['deadline']-b2['now'])/1000
    check(b1['session']['deadline']==b2['session']['deadline']==dl,f'{tag}: /api/practical/active deadline identical before and after reload')
    check(c2<=c1 and abs(c2-exp)<=2,f'{tag}: after reload the clock continues ({c1}s -> {c2}s; server says {exp:.0f}s left)')
    await pg.evaluate("localStorage.clear();sessionStorage.clear()"); await pg.reload(); await pg.wait_for_selector('#prClock'); await pg.wait_for_timeout(400)
    c3=await clock(pg); b3=await active(S)
    check(b3['session']['deadline']==dl and c3<=c2,f'{tag}: clearing browser storage does not reset the timer ({c3}s)')
    D2=await new_ctx(b,1280 if touch else 360,800 if touch else 740,not touch); await D2.add_cookies(await S.cookies()); p2=await page(D2)
    await p2.goto(BASE+'/#/lesson/w1/lab'); await p2.wait_for_selector('#prClock'); await p2.wait_for_timeout(400)
    c4=await clock(p2); c5=await clock(pg)
    check(abs(c4-c5)<=2,f'{tag}: another device shows the same time ({c4}s vs {c5}s)')
    await D2.close()

    print(f'== [{tag}] 6. a simulator mission opened from the practical (embedded workspace) keeps the time and is recorded')
    await pg.click('.prtabs .prpart[data-part=trouble]'); await pg.wait_for_selector('.prOpenSim[data-key="troubleshoot:x15"]')
    check(await pg.get_attribute('.pritem[data-key="troubleshoot:x15"]','data-state')=='todo',f'{tag}: x15 starts as "ยังไม่ทำ"')
    check(await pg.locator('#prPanel a[href^="#/sim/"], #prPanel a[data-go]').count()==0,f'{tag}: the mission card has no link to the simulator page')
    cb=await clock(pg); await pg.click('.prOpenSim[data-key="troubleshoot:x15"]')
    await pg.wait_for_selector('#prWs[data-key="troubleshoot:x15"][data-mode=run] #prWsSim .nls-embedded',timeout=20000); await pg.wait_for_timeout(500)
    check(pg.url.endswith('#/lesson/w1/lab') and await pg.locator('#prWsClock[data-timed="1"]').is_visible(),f'{tag}: the simulator opens inside the practical page with the session clock')
    cws=await clock(pg,'#prWsClock'); a1=await active(S); exp=(a1['session']['deadline']-a1['now'])/1000
    check(cws is not None and cws<=cb and abs(cws-exp)<=3 and a1['session']['deadline']==dl,f'{tag}: the workspace continues the same clock ({cb}s -> {cws}s, server {exp:.0f}s), same deadline on the server')
    check(await hscroll(pg)<=0,f'{tag}: no horizontal scroll with the workspace open')
    await pg.screenshot(path=f'{OUT}/p20_{tag}_sim_ws.png',full_page=False)
    res=await solve_x15(pg)
    check(res.get('score')==10 and res.get('practical',{}).get('recorded') is True and res['practical']['session']==a1['session']['id'],f'{tag}: the simulator submit (10/10) is recorded into the running session {res.get("practical")}')
    await pg.wait_for_selector('#prWsNote.ok'); await pg.wait_for_selector('.pritem[data-key="troubleshoot:x15"][data-state=passed]',timeout=8000)
    check('บันทึกผลลงฝึกปฏิบัติแล้ว' in await pg.inner_text('#prWsNote') and await pg.locator('#prRecNote').count()==0,f'{tag}: the workspace says it was saved into the practical')
    check(await pg.get_attribute('#prWsStatus','data-state')=='passed',f'{tag}: the workspace status turns "ผ่าน" without a reload')
    await pg.click('#prWsClose'); await pg.wait_for_selector('#prWs',state='detached'); await pg.wait_for_timeout(600)
    if await pg.get_attribute('.prtabs .prpart[data-part=trouble]','aria-selected')!='true': await pg.click('.prtabs .prpart[data-part=trouble]')
    await pg.wait_for_selector('.pritem[data-key="troubleshoot:x15"]')
    check(await pg.get_attribute('.pritem[data-key="troubleshoot:x15"]','data-state')=='passed' and pg.url.endswith('#/lesson/w1/lab'),f'{tag}: back on the list, x15 is "ผ่าน"')
    ca=await clock(pg); check(ca<=cws,f'{tag}: the clock still continues after closing the workspace ({cws}s -> {ca}s)')

    print(f'== [{tag}] 8. no double counting')
    sid=a1['session']['id']
    before=(await state(S))['running']['result']['total']
    # 3.5: there is no other simulator menu for students: the old link lands on this practical page; x15 reopened there and sent again lower
    await pg.goto(BASE+'/#/sim/troubleshoot/x15'); await pg.wait_for_function("location.hash==='#/lesson/w1/lab'",timeout=10000); await pg.wait_for_selector('#prClock')
    if await pg.get_attribute('.prtabs .prpart[data-part=trouble]','aria-selected')!='true': await pg.click('.prtabs .prpart[data-part=trouble]')
    await pg.click('.prOpenSim[data-key="troubleshoot:x15"]'); await pg.wait_for_selector('#prWs[data-key="troubleshoot:x15"] #prWsSim .nls-troubleshoot-submit',state='attached',timeout=15000)
    again=await pg.evaluate("api('POST','/api/sims/troubleshoot/submit',{mission:'x15',payload:{}})")
    await pg.click('#prWsClose')
    rows=sql(f"SELECT count(*)||':'||max(score) FROM practical_items WHERE session_id={sid} AND item='troubleshoot:x15'")
    n_,best_=rows.split(':')
    check(again.get('practical',{}).get('recorded') is True and again['score']<10 and n_=='1' and float(best_)==10,f'{tag}: x15 reopened (old link -> practical page) and submitted again with a lower score: one item, best kept ({rows}, new score {again.get("score")})')
    s,j=await req(S,'post','/api/check',{'key':TASKS[0],'answer':K['tasks'][TASKS[0]]})
    check(s==200 and j.get('already') and j.get('points')==10,f'{tag}: answering a passed task again changes nothing ({j.get("points")})')
    after=(await state(S))['running']['result']['total']
    check(after==before,f'{tag}: the running total is unchanged by the repeats ({before}% -> {after}%)')
    await pg.goto(BASE+'/#/lesson/w1/lab'); await pg.wait_for_selector('#prClock')

    print(f'== [{tag}] 7. submit; the total is computed correctly; check marks only on passed activities')
    await pg.click('#prSubmit'); await pg.wait_for_selector('#prConfirm:not([hidden]) #prSubmitYes')
    check('ยังไม่ได้ทำ 3 จาก 7 กิจกรรม' in await pg.inner_text('#prConfirm'),f'{tag}: the in-page confirmation says what is still not done')
    await pg.click('#prSubmitYes'); await pg.wait_for_selector('#prResult[data-status=submitted]'); await pg.wait_for_timeout(500)
    st=await state(S); sess=[x for x in st['sessions'] if x['id']==sid][0]; res=sess['result']
    pp,tot=expected_total(res)
    check(res['total']==tot and all(p['pct']==pp[p['id']] for p in res['parts']),f'{tag}: total recomputed from the parts and the weights = {tot}% (server {res["total"]}%, parts {pp})')
    hand=round((30*round(100*(1+0.5+0.8+0+0)/5)+40*0+30*100)/100)
    check(res['total']==hand==44,f'{tag}: by hand: Guided (10+5+8 of 30, two missions 0) = 46%, Independent 0%, Troubleshooting 100% -> 30/40/30 = {hand}%')
    check((await pg.inner_text('#prTotal')).strip()==f'{tot}%' and await pg.get_attribute('#prResult','data-passed')=='false',f'{tag}: the page shows {tot}% and "ยังไม่ผ่านเกณฑ์"')
    for p in res['parts']:
        h=await pg.inner_text(f'.prrespart[data-part={p["id"]}] h3')
        if f"{p['pct']}%" not in h or f"น้ำหนัก {p['weight']}%" not in h: bad(f'{tag}: part {p["id"]} shows {h!r}, expected {p["pct"]}% weight {p["weight"]}%')
    marks=await pg.evaluate("[...document.querySelectorAll('.prresitem')].map(li=>({k:li.dataset.key,p:li.dataset.passed,mark:!!li.querySelector('.prmark.ok'),why:!!li.querySelector('.prreason'),fix:!!li.querySelector('.prfix')}))")
    passed={i['key'] for p in res['parts'] for i in p['items'] if i['passed']}
    check(len(marks)==7 and all(m['mark']==(m['k'] in passed) and (m['p']=='true')==(m['k'] in passed) for m in marks),f'{tag}: a check mark only on the {len(passed)} passed activities')
    check(all(m['why'] and m['fix'] for m in marks if m['k'] not in passed),f'{tag}: every activity not passed shows its reason and what to fix')
    check(await pg.locator('#prCooldown[data-next]').count()==1 and await pg.locator('#prStart[disabled]').count()==1,f'{tag}: a new attempt waits for the class cooldown')
    check(await hscroll(pg)<=0,f'{tag}: no horizontal scroll on the results')
    await pg.screenshot(path=f'{OUT}/p20_{tag}_results.png',full_page=True)
    await pg.goto(BASE+'/#/lesson/w1/summary'); await pg.wait_for_selector('#prSummary .compare'); await pg.wait_for_timeout(300)
    check(f'{tot}%' in await pg.inner_text('#prSummary'),f'{tag}: the summary shows the same total')
    check(not pg._errs,f'{tag}: no page errors {pg._errs[:2]}')
    return S,uid,sid,pg

async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        T=await new_ctx(b,1280,800,False); await login(T,'kru4','Teach1234')
        s,cls=await req(T,'post','/api/teacher/classes',{'name':'ปวช.2/20 ฝึกปฏิบัติรวม'}); cid=cls['id']
        print('== 9. old scores are kept (earlier work -> "ระบบเดิม" result)')
        # first, as in a real upgrade: the one-time migration runs before anyone has used the 3.2 practical
        s2=sql("SELECT id FROM users WHERE username='s2'")
        sql(f"""INSERT INTO lab_runs(user_id,lab_id,started_at,deadline,ended_at,status) VALUES({s2},'w2',now()-interval '40 day',now()-interval '40 day'+interval '30 min',now()-interval '40 day'+interval '20 min','finished');
                INSERT INTO task_progress(user_id,task_key,lab_id,attempts,hint_used,solved,points,solved_at) VALUES ({s2},'w2-8','w2',0,false,true,10,now()-interval '40 day'),({s2},'w2-9','w2',1,false,true,8,now()-interval '40 day');
                INSERT INTO sim_results(user_id,sim,mission,best,max,last,attempts,first_full_at) VALUES ({s2},'topology','t2',10,10,10,1,now()-interval '40 day') ON CONFLICT DO NOTHING;
                INSERT INTO quiz_attempts(user_id,lesson_id,kind,answers,results,score,max,submitted_at) VALUES({s2},'w2','post','[]','[]',9,10,now()-interval '39 day')""")
        before_rows=sql(f"SELECT (SELECT count(*) FROM task_progress WHERE user_id={s2})||','||(SELECT count(*) FROM sim_results WHERE user_id={s2})||','||(SELECT count(*) FROM lab_runs WHERE user_id={s2})")
        sql("DELETE FROM app_migrations WHERE id='practical-1'"); subprocess.check_output(['node','-e',MIGRATE],cwd=ROOT,env={**os.environ,'DATABASE_URL':DB})
        subprocess.check_output(['node','-e',MIGRATE],cwd=ROOT,env={**os.environ,'DATABASE_URL':DB})   # a second start-up changes nothing
        leg=sql(f"SELECT count(*) FROM practical_sessions WHERE user_id={s2} AND status='legacy'")
        after_rows=sql(f"SELECT (SELECT count(*) FROM task_progress WHERE user_id={s2})||','||(SELECT count(*) FROM sim_results WHERE user_id={s2})||','||(SELECT count(*) FROM lab_runs WHERE user_id={s2})")
        check(leg=='1' and before_rows==after_rows,f'migration: one "ระบบเดิม" result for week 2; the old rows are all kept ({before_rows} -> {after_rows})')
        O=await new_ctx(b,360,740,True); await login(O,'s2','Stud1234'); pg=await page(O)
        st=await state(O,'w2'); lg=[x for x in st['sessions'] if x['legacy']][0]
        await pg.goto(BASE+'/#/lesson/w2/lab'); await pg.wait_for_selector('#prResult[data-status=legacy]')
        okk=[k for k in ['w2-8','w2-9','topology:t2'] if await pg.get_attribute(f'.prresitem[data-key="{k}"]','data-passed')=='true']
        check(len(okk)==3,'the old task answers and the old simulator result count as passed in the "ระบบเดิม" result')
        check((await pg.inner_text('#prTotal')).strip()==f"{lg['total']}%" and 'ผลจากงานเดิมก่อนปรับระบบ' in await pg.inner_text('#prBestFact'),f'the page shows the old total {lg["total"]}% marked as earlier work')
        check(await pg.locator('#prStart:not([data-retake])').count()==1 and st['attempts']['used']==0,'the old result uses no attempt: the first round can still be started')
        check(await hscroll(pg)<=0,'phone: no horizontal scroll on the old result')
        await pg.goto(BASE+'/#/results'); await pg.wait_for_selector('.rescards',state='attached'); await pg.wait_for_timeout(400)
        t=await pg.evaluate("[...document.querySelectorAll('.rescard')][1].innerText")
        check(f"{lg['total']}%" in t and '9/10' in t,'results page keeps the old post-test score and shows the old practical result')
        tp=await T.new_page(); tp._errs=[]; tp.on('pageerror',lambda e:tp._errs.append(str(e)))
        await tp.goto(BASE+'/teacher.html'); await tp.wait_for_selector('.side'); await tp.locator('.side .navbtn:has-text("ปวช.2/4")').click(); await tp.wait_for_selector('#prMatrix')
        cell=tp.locator(f'#prMatrix button.prcell[data-uid="{s2}"][data-week="w2"]')
        check(await cell.count()==1 and f"{lg['total']}%" in await cell.inner_text() and await cell.locator('.prtag.legacy').count()==1,'teacher matrix: week 2 shows the old result with the "เดิม" tag')
        await tp.locator('.tabs button:has-text("ประวัติ (ระบบเดิม)")').click(); await tp.wait_for_selector('table.histm')
        row=await tp.inner_text('table.histm tr:has-text("สมหญิง ทดสอบ")')
        check('18' in row,f'the history tab still shows the old week 2 lab score 18 ({row.split()[-3:]})')
        await tp.close()

        flows={}
        for tag,w,h,touch in VIEWS:
            flows[tag]=await student_flow(b,T,cid,tag,w,h,touch,len(flows)+1)

        print('== 8b. one key in one week only')
        S=flows['desktop'][0]; seen={}; dup=[]
        for i in range(1,19):
            j=await state(S,f'w{i}')
            if j.get('error')=='locked': continue
            for pt in j['parts']:
                for it in pt['items']:
                    if it['key'] in seen: dup.append(it['key'])
                    seen[it['key']]=f'w{i}'
        ids=json.loads(subprocess.check_output(['node','-e',"const P=require('./server/practical');const s=new Map();const d=[];for(const w of P.IDS)for(const i of P.setOf(w).items){if(s.has(i.key))d.push(i.key);s.set(i.key,w)}console.log(JSON.stringify(d))"],cwd=ROOT,stderr=subprocess.DEVNULL))
        check(not dup and not ids,f'no activity is in the practical of two weeks ({dup[:3]}{ids[:3]})')

        print('== time up: the session closes by itself (phone, on the practical page)')
        TU,tuId=await make_student(b,T,cid,10,'นักเรียน หมดเวลา',360,740,True); pg=await page(TU)
        await pg.goto(BASE+'/#/lesson/w1/lab'); await pg.wait_for_selector('#prStart'); await pg.tap('#prStart'); await pg.wait_for_selector('#prClock')
        okA=await answer(pg,TASKS[0],K['tasks'][TASKS[0]])
        sql(f"UPDATE practical_sessions SET deadline=now()+interval '8 seconds' WHERE user_id={tuId} AND status='running'")
        await pg.reload(); await pg.wait_for_selector('#prClock'); await pg.wait_for_timeout(500)
        cu=await clock(pg); urgent=await pg.locator('#prTimer.urgent').count()
        check(okA and cu is not None and cu<=8 and urgent==1,f'phone: with under a minute left the timer turns urgent ({cu}s)')
        await pg.wait_for_selector('#prResult[data-status=timeout]',timeout=30000)   # no click: the page asks again at 0 and the server closes it
        await pg.wait_for_timeout(500)
        t=await pg.inner_text('#prResult')
        marks=await pg.evaluate("[...document.querySelectorAll('.prresitem')].map(li=>({k:li.dataset.key,p:li.dataset.passed,mark:!!li.querySelector('.prmark.ok'),why:!!li.querySelector('.prreason')}))")
        check('หมดเวลา ระบบส่งงานให้อัตโนมัติ' in t,'time up: the result says the system submitted at the deadline (status timeout)')
        check([m['k'] for m in marks if m['mark']]==[TASKS[0]] and all(m['why'] for m in marks if m['k']!=TASKS[0]),f'time up: the only check mark is on the answered task; every other activity has a reason')
        st=await state(TU); check(st['running'] is None and st['sessions'][0]['status']=='timeout' and st['attempts']['used']==1,'the server closed the session as timeout and it used one attempt')
        s,j=await req(TU,'post','/api/check',{'key':TASKS[1],'answer':K['tasks'][TASKS[1]]})
        check(s==409 and j.get('error')=='closed','an answer after the deadline is refused (409 closed)')
        check(await hscroll(pg)<=0,'phone: no horizontal scroll on the timeout result')
        await pg.screenshot(path=f'{OUT}/p20_phone_timeout.png',full_page=True)

        print('== time up while on another page: the bar says so and links to the result (desktop)')
        TB,tbId=await make_student(b,T,cid,11,'นักเรียน หมดเวลาที่ห้องจำลอง'); pg=await page(TB)
        await req(TB,'post','/api/practical/w1/start')
        await pg.goto(BASE+'/#/glossary'); await pg.wait_for_selector('#prBar[data-week=w1]')
        sql(f"UPDATE practical_sessions SET deadline=now()+interval '6 seconds' WHERE user_id={tbId} AND status='running'")
        await pg.goto(BASE+'/#/results'); await pg.wait_for_selector('.rescards',state='attached')   # a route change re-reads the session (as every minute)
        await pg.wait_for_selector('#prBar.over',timeout=30000)
        check('หมดเวลา' in await pg.inner_text('#prBar'),'the bar on another page says the time is up and the work was submitted')
        await pg.click('#prBarLink'); await pg.wait_for_selector('#prResult[data-status=timeout]')
        ok('"ดูผล" opens the timeout result')

        print('== 10. the lock: week 2 waits for week 1 with the practical passed')
        L,lId=await make_student(b,T,cid,12,'นักเรียน ล็อก',360,740,True); pg=await page(L)
        s,j=await learn_w1(L); check(s==200 and j.get('passed'),'week 1: pre-test, reading, exercises and post-test done')
        s,pth=await req(L,'get','/api/path'); w1=pth['weeks'][0]; w2=pth['weeks'][1]
        check(w1['status']!='completed' and w1['missing']==['practice'] and not w2['open'],f'without the practical week 1 is not complete and week 2 is locked ({w1["missing"]})')
        await pg.goto(BASE+'/#/lesson/w2/lab'); await pg.wait_for_selector('.lockpanel')
        check('ต้องผ่านสัปดาห์ที่ 1 ก่อน' in await pg.inner_text('.lockmsg') and await pg.locator('#prPage').count()==0,'#/lesson/w2/lab shows only the lock panel')
        s1_,_=await req(L,'get','/api/practical/w2'); s2_,_=await req(L,'post','/api/practical/w2/start')
        check(s1_==403 and s2_==403,f'the server refuses the week 2 practical while locked ({s1_}, {s2_})')
        j=await recorded_practical(L,'w1',0.6)
        s,pth=await req(L,'get','/api/path')
        check(not j['best']['passed'] and not pth['weeks'][1]['open'],f'a practical below the pass mark ({j["best"]["total"]}% < 70%) keeps week 2 locked')
        sql(f"UPDATE practical_sessions SET started_at=started_at-interval '1 hour', deadline=deadline-interval '1 hour', ended_at=ended_at-interval '1 hour' WHERE user_id={lId}")   # skip the 10-minute cooldown
        j=await recorded_practical(L,'w1',1)
        s,pth=await req(L,'get','/api/path')
        check(j['best']['passed'] and pth['weeks'][0]['status']=='completed' and pth['weeks'][1]['open'],f'the practical passed ({j["best"]["total"]}%): week 1 completed, week 2 open')
        # the work was done through the API (as on another device): the app re-reads the path on a reload (or after 20 s)
        await pg.goto(BASE+'/#/learn'); await pg.reload(); await pg.wait_for_selector('.lpath .lpstep'); await pg.wait_for_timeout(500)
        cl=await pg.get_attribute('.lpstep[data-week=w2]','class')
        check('st-available' in cl,f'the learning path shows week 2 open ({cl})')
        await pg.goto(BASE+'/#/lesson/w2/lab'); await pg.wait_for_selector('#prStart')
        check(await pg.locator('.lockpanel').count()==0,'#/lesson/w2/lab now offers "เริ่มฝึกปฏิบัติ"')
        await pg.goto(BASE+'/#/lesson/w1/lab'); await pg.wait_for_selector('#prResult')
        check(await pg.get_attribute('#prResult','data-passed')=='true' and await pg.locator('.prhistrow').count()==2,'week 1 shows the passed round and the history of both rounds')

        print('== 11. the teacher sees per-activity results; a void gives the attempt back')
        D,dId,dSid,_=flows['desktop']
        for tag,w,h,touch in VIEWS:
            TV=await new_ctx(b,w,h,touch); await TV.add_cookies(await T.cookies()); tp=await page(TV)
            await tp.goto(BASE+'/teacher.html'); await tp.wait_for_function("typeof CLASSES!=='undefined'&&CLASSES.length>0")
            await tp.evaluate(f"go({{type:'class',id:{cid}}})"); await tp.wait_for_selector('#prMatrix')
            check((await tp.eval_on_selector_all('.tabs button','e=>e.map(x=>x.textContent.trim())'))[0]=='ผลฝึกปฏิบัติ','the class opens on "ผลฝึกปฏิบัติ"')
            check(await hscroll(tp)<=0,f'teacher {tag}: no horizontal page scroll on the matrix (the table scrolls inside its frame)')
            await tp.screenshot(path=f'{OUT}/p20_teacher_matrix_{tag}.png',full_page=True)
            c=tp.locator(f'#prMatrix button.prcell[data-uid="{dId}"][data-week="w1"]')
            check('44%' in await c.inner_text() and 'ไม่ผ่าน' in await c.inner_text(),f'teacher {tag}: the matrix cell shows 44% ไม่ผ่าน')
            await c.click(); await tp.wait_for_selector(f'#prDetail[data-uid="{dId}"][data-week=w1] section.prsess[data-session="{dSid}"]')
            sec=tp.locator(f'section.prsess[data-session="{dSid}"]')
            prow=await sec.locator('table.prparts tr').evaluate_all('e=>e.slice(1).map(r=>[...r.cells].map(c=>c.textContent))')
            check([x[2] for x in prow]==['46%','0%','100%'],f'teacher {tag}: the three part scores 46 / 0 / 100 ({[x[2] for x in prow]})')
            if not await sec.locator('table.pritems').is_visible(): await sec.locator('details summary').click()
            rows=await sec.locator('table.pritems tr').evaluate_all('e=>e.slice(1).map(r=>({res:r.cells[3].textContent,why:r.cells[4].textContent,score:r.cells[2].textContent}))')
            check(len(rows)==7 and sum(1 for r in rows if r['res']=='ผ่าน')==4 and all(r['why'].strip() not in ('','-') for r in rows if r['res']!='ผ่าน'),f'teacher {tag}: 7 activities, 4 passed, a reason on each of the 3 others')
            check(['10/10','5/10','8/10'] == [r['score'] for r in rows[:3]],f'teacher {tag}: task scores 10/10, 5/10 (hint), 8/10 (one wrong answer) ({[r["score"] for r in rows[:3]]})')
            check(await hscroll(tp)<=0,f'teacher {tag}: no horizontal page scroll on the detail')
            await tp.screenshot(path=f'{OUT}/p20_teacher_detail_{tag}.png',full_page=True)
            if tag=='phone':
                await tp.click(f'.prVoidBtn[data-sid="{dSid}"]'); await tp.wait_for_selector(f'#prVoid[data-session="{dSid}"]')
                await tp.locator('#prVoid button[type=submit]').click(); await tp.wait_for_timeout(300)
                check('ใส่เหตุผลก่อน' in await tp.inner_text('#prVoid .msg') and sql(f"SELECT voided_at IS NULL FROM practical_sessions WHERE id={dSid}")=='t','a void without a reason is refused')
                await tp.fill('#prVoidReason','เครื่องค้างระหว่างทำ'); await tp.locator('#prVoid button[type=submit]').click()
                await tp.wait_for_selector(f'section.prsess.voided[data-session="{dSid}"]')
                check('0/3' in await tp.inner_text('#prAttempts') and 'เครื่องค้างระหว่างทำ' in await tp.inner_text(f'section.prsess[data-session="{dSid}"]'),'after the void: attempts 0/3, the round stays listed with the reason')
                st=await state(D); vs=[x for x in st['sessions'] if x['id']==dSid][0]
                check(st['attempts']['used']==0 and st['attempts']['left']==3 and st['attempts']['nextAt'] is None and vs['voided'] and st['best'] is None,'the student got the attempt back (no cooldown, the voided round no longer counts, the record stays)')
                dp=await page(D); await dp.goto(BASE+'/#/lesson/w1/lab'); await dp.wait_for_selector('#prResult')
                check(await dp.locator('#prStart:not([disabled]):not([data-retake])').count()==1 and 'ครูยกเลิกรอบนี้' in await dp.inner_text('#prResult'),'the student can start round 1 again; the old round is marked as cancelled by the teacher')
            check(not tp._errs,f'teacher {tag}: no page errors {tp._errs[:2]}')
            await TV.close()
        await b.close()
    print(f'\npart20: {len(issues)} issue(s)'); [print('  -',i) for i in issues]
    sys.exit(1 if issues else 0)
asyncio.run(main())
