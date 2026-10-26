# Part 22 (3.6): step order inside a week and lesson terminals without quick command buttons, in a real browser.
#  A. no quick command buttons: the practical page terminal (w8, .term) has no .quick row; the embedded terminal missions
#     (terminal:m1, troubleshoot:x9 in w8) have no .nls-terminal-qb; the teacher's standalone #/sim/terminal still has them
#  B. the teacher ticks "ล็อกลำดับขั้นในสัปดาห์" (#pstep) for the fixture class (saved as settings.stepOrder, history line)
#  C. a student, desktop 1280x800 and phone 360x740 (touch):
#     - week 1: rail steps 3 (ฝึกปฏิบัติ) and 4 (หลังเรียน) locked; the lab page shows #prOrder with links to the 3 earlier
#       steps instead of #prStart; a mission button gives a message instead of opening; POST start, the mission endpoint
#       and a post-test submit answer 409 step_locked; the post page shows #stepOrder and no questions
#     - after the pre-test only, the lab still lists content and exercises; after reading every core section and answering
#       the exercises, the lab opens (#prStart, rail step 3 unlocked) while the post-test lists only the practical
#     - the practical passed (activities written as the server records them, start + submit), the post-test opens and is
#       submitted through the page; the week is completed
#  D. the teacher unticks #pstep: a fresh student can start the practical at once
# usage: E2E_BASE=http://127.0.0.1:3990 E2E_DATABASE_URL=postgres://... python3 tests/e2e/part22.py <out-dir>
#   (tests/e2e/setup.js fixture; run.sh sets STEP_ORDER=off, so the order applies only once the class setting is on)
import asyncio, sys, os, subprocess, json, re
from playwright.async_api import async_playwright
OUT=sys.argv[1] if len(sys.argv)>1 else '/tmp/netlab-e2e'; os.makedirs(OUT,exist_ok=True)
BASE=os.environ.get('E2E_BASE','http://127.0.0.1:3990')
DB=os.environ.get('E2E_DATABASE_URL','postgres://postgres@127.0.0.1:5433/netlab_e2e')
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
H={'X-NetLab':'1'}
issues=[]
def bad(m): issues.append(m); print('  ✗',m)
def ok(m): print('  ✓',m)
def check(c,m): ok(m) if c else bad(m)
def sql(q): return subprocess.check_output(['psql',DB,'-tAqc',q]).decode().strip()
K=json.loads(subprocess.check_output(['node','-e',r"""
const { LESSONS, formOf } = require('./server/lessons'); const P = require('./server/practical');
const right = q => q.type === 'choice' ? q.correct : q.type === 'multi' ? q.correct : q.type === 'tf' ? q.answer : q.answers[0];
const L = LESSONS.get('w1'); let n = 0; const checks = [];
for (const s of L.sections) for (const b of s.blocks) if (b.type === 'check') { if (!s.extra) checks.push({ key: `L:w1:c:${n}`, answer: right(b.q) }); n++; }
console.log(JSON.stringify({ sections: L.sections.filter(s => !s.extra).map(s => s.id), checks, pre: L.quiz.length,
  post: formOf(L, 'post').map(q => ({ t: q.type, o: q.options, c: q.correct, a: q.answer, ans: q.answers })), postRight: formOf(L, 'post').map(right),
  items: P.setOf('w1').items.map(i => ({ key: i.key, part: i.part, max: i.max })) }));"""],cwd=ROOT,stderr=subprocess.DEVNULL))

async def req(ctx,method,path,body=None):
    r=await getattr(ctx.request,method)(BASE+path,**({'data':body} if body is not None else {}),headers=H)
    try: j=await r.json()
    except Exception: j={}
    return r.status,j
async def login(ctx,u,p):
    s,j=await req(ctx,'post','/api/auth/login',{'username':u,'password':p}); assert s==200, j
async def new_ctx(b,w,h,touch):
    ctx=await b.new_context(viewport={'width':w,'height':h},has_touch=touch,is_mobile=touch)
    await ctx.add_init_script("try{localStorage.setItem('netlab-onboard','done')}catch(e){}")
    return ctx
async def page(ctx):
    pg=await ctx.new_page(); pg._errs=[]; pg.on('pageerror',lambda e:pg._errs.append(str(e))); pg.on('dialog',lambda d: asyncio.ensure_future(d.accept()))
    return pg
NO=[200]
async def make_student(b,T,cid,name,w=1280,h=800,touch=False):
    NO[0]+=1
    s,cr=await req(T,'post',f'/api/teacher/classes/{cid}/students',{'rows':[{'no':str(NO[0]),'name':name}]}); assert cr.get('created'), cr
    c=cr['created'][0]; ctx=await new_ctx(b,w,h,touch); await login(ctx,c['username'],c['password'])
    await req(ctx,'post','/api/auth/password',{'current':c['password'],'next':'Step1234'})
    s,me=await req(ctx,'get','/api/me'); return ctx,me['user']['id']
async def hscroll(pg):
    d=await pg.evaluate('({sw:document.scrollingElement.scrollWidth,iw:innerWidth})'); return d['sw']-min(d['iw'],pg.viewport_size['width'])
async def tap(pg,sel,touch):
    loc=pg.locator(sel).first; await loc.scroll_into_view_if_needed()
    await (loc.tap() if touch else loc.click())
async def rail(pg):
    return await pg.evaluate("Object.fromEntries([...document.querySelectorAll('.rail .rstep')].map(a=>[a.dataset.step,{lock:a.classList.contains('rlock')&&a.dataset.locked==='1',icon:!!a.querySelector('.rn svg'),st:(a.querySelector('.rst')||{}).textContent}]))")
async def path_order(ctx,wid='w1'):
    s,p=await req(ctx,'get','/api/path'); return [w for w in p['weeks'] if w['id']==wid][0].get('order')

async def path_tab(b,T,cid,tick):
    """the teacher's "เส้นทางการเรียน" tab: set #pstep and save"""
    C=await new_ctx(b,1280,900,False); await C.add_cookies(await T.cookies()); tp=await page(C)
    await tp.goto(BASE+'/teacher.html'); await tp.wait_for_function("typeof CLASSES!=='undefined'&&CLASSES.length>0")
    await tp.evaluate(f"go({{type:'class',id:{cid}}})"); await tp.wait_for_selector('.tabs')
    await tp.locator('.tabs button:has-text("เส้นทางการเรียน")').click(); await tp.wait_for_selector('#pathrules #pstep')
    lbl=await tp.evaluate("(()=>{const i=document.getElementById('pstep');const l=i.closest('label')||document.querySelector('label[for=pstep]');return l?l.textContent:''})()")
    was=await tp.is_checked('#pstep')
    if tick: await tp.check('#pstep')
    else: await tp.uncheck('#pstep')
    await tp.locator('#pathrules button[type=submit]').click(); await tp.wait_for_selector('#pathSaved',timeout=8000)
    saved=await tp.inner_text('#pathSaved')
    s,d=await req(T,'get',f'/api/teacher/classes/{cid}/path')
    check(d['settings']['stepOrder'] is tick and 'ล็อกลำดับขั้นในสัปดาห์' in lbl,f'teacher: "{lbl.strip()[:40]}" was {was}, saved as settings.stepOrder={d["settings"]["stepOrder"]}')
    want='เปิดล็อกลำดับขั้นในสัปดาห์' if tick else 'ปิดล็อกลำดับขั้นในสัปดาห์'
    hist=sql(f"SELECT reason FROM path_unlocks WHERE class_id={cid} AND kind='settings' ORDER BY id DESC LIMIT 1")
    check(want in saved and want in hist,f'teacher: the change is confirmed and kept in the history ("{want}")')
    check(not tp._errs,f'teacher: no page errors {tp._errs[:2]}')
    await C.close()

async def terminals(b,T,cid):
    print('== A. no quick command buttons in the lesson terminals (practical page), teacher standalone keeps them')
    S,uid=await make_student(b,T,cid,'นักเรียน เทอร์มินัล',1280,800,False); pg=await page(S)
    await pg.goto(BASE+'/#/lesson/w8/lab'); await pg.wait_for_selector('#prStart'); await pg.click('#prStart'); await pg.wait_for_selector('#prClock')
    await pg.click('.prtabs .prpart[data-part=guided]'); await pg.wait_for_selector('#prPanel .term')
    q=await pg.evaluate("({term:document.querySelectorAll('#prPanel .term').length,quick:document.querySelectorAll('#prPanel .term .quick, #prPanel .quick').length,btn:document.querySelectorAll('#prPanel .term button').length})")
    check(q['term']==1 and q['quick']==0,f'w8 practical terminal: no quick command row {q}')
    inp=pg.locator('#prPanel .term input'); await inp.fill('ipconfig'); await inp.press('Enter'); await pg.wait_for_timeout(400)
    check('IPv4' in await pg.inner_text('#prPanel .term .screen'),'the terminal still runs a typed command (ipconfig)')
    for key in ['terminal:m1','troubleshoot:x9']:
        p=await pg.evaluate("k=>{for(const p of PR.st.parts) if(p.items.some(i=>i.key===k)) return p.id}",key)
        await pg.click(f'.prtabs .prpart[data-part={p}]'); await pg.click(f'.prOpenSim[data-key="{key}"]')
        await pg.wait_for_selector(f'#prWs[data-key="{key}"] #prWsSim .nls-embedded',timeout=20000); await pg.wait_for_timeout(800)
        d=await pg.evaluate("({qb:document.querySelectorAll('#prWsSim .nls-terminal-qb').length,term:document.querySelectorAll('#prWsSim .nls-terminal-in').length})")
        check(d['qb']==0 and (d['term']>=1 or key.startswith('troubleshoot')),f'embedded {key}: no quick command buttons {d}')
        await pg.click('#prWsClose'); await pg.wait_for_selector('#prWs',state='detached')
    check(not pg._errs,f'no page errors {pg._errs[:2]}')
    await S.close()
    C=await new_ctx(b,1280,800,False); await C.add_cookies(await T.cookies()); tp=await page(C)
    await tp.goto(BASE+'/#/sim/terminal'); await tp.wait_for_selector('.nls-terminal-in',timeout=15000); await tp.wait_for_timeout(600)
    n=await tp.locator('.nls-terminal-qb').count()
    check(n>0 and await tp.locator('.nls-embedded').count()==0,f'teacher standalone #/sim/terminal keeps its quick command buttons ({n})')
    await C.close()

async def student_flow(b,T,cid,tag,w,h,touch):
    S,uid=await make_student(b,T,cid,f'นักเรียน ลำดับขั้น {tag}',w,h,touch); pg=await page(S)
    print(f'== C. [{tag} {w}x{h}] nothing done yet: practical and post-test locked')
    await pg.goto(BASE+'/#/lesson/w1/lab'); await pg.wait_for_selector('#prOrder'); await pg.wait_for_timeout(400)
    r=await rail(pg)
    check(r['lab']['lock'] and r['post']['lock'] and r['lab']['icon'] and r['lab']['st']=='ล็อก' and not r['pre']['lock'] and not r['content']['lock'],f'{tag}: rail steps 3 and 4 locked ("ล็อก" with an icon), 1 and 2 open')
    items=await pg.evaluate("[...document.querySelectorAll('#prOrder .prorderlist li[data-key]')].map(li=>({k:li.dataset.key,h:(li.querySelector('a')||{}).getAttribute&&li.querySelector('a').getAttribute('href')}))")
    check([x['k'] for x in items]==['pre','content','checks'] and all(x['h'] and x['h'].startswith('#/lesson/w1') for x in items) and await pg.locator('#prStart').count()==0,f'{tag}: the lab page lists the 3 earlier steps with links, no "เริ่มฝึกปฏิบัติ" {items}')
    await tap(pg,'.prOpenSim[data-key="topology:t8"]',touch); await pg.wait_for_selector('.prwsneed')
    check(await pg.locator('#prWs').count()==0 and 'ให้ครบก่อน' in await pg.inner_text('.prwsneed'),f'{tag}: a mission button gives a message instead of opening ({(await pg.inner_text(".prwsneed"))[:50]!r})')
    s1,j1=await req(S,'post','/api/practical/w1/start'); s2,j2=await req(S,'get','/api/practical/w1/mission/topology/t8')
    s3,j3=await req(S,'get','/api/practical/w1')
    check(s1==409 and j1.get('error')=='step_locked' and [m['key'] for m in j1.get('missing',[])]==['pre','content','checks'] and s2==409 and j2.get('error')=='step_locked',f'{tag}: API start -> {s1} {j1.get("error")}, mission endpoint -> {s2} {j2.get("error")}')
    check(s3==200 and j3.get('order',{}).get('ok') is False and sql(f"SELECT count(*) FROM practical_sessions WHERE user_id={uid}")=='0',f'{tag}: GET /api/practical/w1 order.ok=false; no session was started')
    check(await hscroll(pg)<=0,f'{tag}: no horizontal overflow on the locked lab page')
    await pg.screenshot(path=f'{OUT}/p22_{tag}_lab_locked.png',full_page=True)
    await tap(pg,'#prOrder li[data-key=pre] a',touch); await pg.wait_for_timeout(500)
    check(pg.url.endswith('#/lesson/w1/pre'),f'{tag}: the link goes to the pre-test')
    await pg.goto(BASE+'/#/lesson/w1/post'); await pg.wait_for_selector('#stepOrder[data-step=post]'); await pg.wait_for_timeout(300)
    pk=await pg.eval_on_selector_all('#stepOrder li[data-key]','e=>e.map(x=>x.dataset.key)')
    check(await pg.locator('.qcard').count()==0 and pk==['pre','content','checks','practice'],f'{tag}: the post page shows #stepOrder ({pk}) and no questions')
    s,j=await req(S,'post','/api/lessons/w1/quiz',{'kind':'post','answers':K['postRight']})
    s4,g=await req(S,'get','/api/lessons/w1/gate')
    check(s==409 and j.get('error')=='step_locked' and (g.get('order') or {}).get('ok') is False,f'{tag}: a post-test submit -> {s} {j.get("error")}; gate order.ok={((g.get("order") or {}).get("ok"))}')
    o=await path_order(S); check(o and o['practice']['ok'] is False and o['post']['ok'] is False,f'{tag}: /api/path week 1 order: practice and post not ok')
    await pg.screenshot(path=f'{OUT}/p22_{tag}_post_locked.png',full_page=True)

    print(f'== C. [{tag}] pre-test, then reading and exercises: the practical opens, the post-test still waits for it')
    s,j=await req(S,'post','/api/lessons/w1/quiz',{'kind':'pre','answers':[0]*K['pre']}); assert s==200, j
    await pg.goto(BASE+'/#/lesson/w1/lab'); await pg.reload(); await pg.wait_for_selector('#prOrder')
    ks=await pg.eval_on_selector_all('#prOrder .prorderlist li[data-key]','e=>e.map(x=>x.dataset.key)')
    check(ks==['content','checks'],f'{tag}: after the pre-test the lab lists only the content and the exercises ({ks})')
    # reading every core section through the page, the exercises through the same API the page uses
    for sec in K['sections']:
        await pg.goto(BASE+f'/#/lesson/w1/content/{sec}'); await pg.wait_for_selector('.lsec'); await pg.wait_for_timeout(150)
        await req(S,'post','/api/lessons/w1/visit',{'section':sec})
    for c in K['checks']: s,j=await req(S,'post','/api/lessons/w1/check',c)
    await pg.goto(BASE+'/#/lesson/w1/lab'); await pg.reload(); await pg.wait_for_selector('#prStart'); await pg.wait_for_timeout(300)
    r=await rail(pg)
    check(await pg.locator('#prOrder').count()==0 and not r['lab']['lock'] and r['post']['lock'],f'{tag}: the lab opens ("เริ่มฝึกปฏิบัติ", rail step 3 unlocked); step 4 still locked')
    await pg.goto(BASE+'/#/lesson/w1/post'); await pg.wait_for_selector('#stepOrder[data-step=post]')
    pk=await pg.eval_on_selector_all('#stepOrder li[data-key]','e=>e.map(x=>x.dataset.key)')
    check(pk==['practice'] and await pg.locator('.qcard').count()==0,f'{tag}: the post-test lists only the practical ({pk})')

    print(f'== C. [{tag}] the practical passed: the post-test opens and is submitted on the page')
    await pg.goto(BASE+'/#/lesson/w1/lab'); await pg.wait_for_selector('#prStart'); await tap(pg,'#prStart',touch); await pg.wait_for_selector('#prClock')
    sid=sql(f"SELECT id FROM practical_sessions WHERE user_id={uid} AND status='running'")
    check(bool(sid),f'{tag}: "เริ่มฝึกปฏิบัติ" started the session')
    sql("INSERT INTO practical_items(session_id,item,part,score,max,solved) VALUES "+','.join(f"({sid},'{i['key']}','{i['part']}',{i['max']},{i['max']},true)" for i in K['items']))
    await tap(pg,'#prSubmit',touch); await tap(pg,'#prSubmitYes',touch); await pg.wait_for_selector('#prResult[data-passed=true]')
    await pg.goto(BASE+'/#/lesson/w1/post'); await pg.reload(); await pg.wait_for_selector('.qcard'); await pg.wait_for_timeout(400)
    r=await rail(pg)
    check(await pg.locator('#stepOrder').count()==0 and await pg.locator('.qcard').count()==len(K['post']) and not r['post']['lock'] and not r['lab']['lock'],f'{tag}: the post-test opens with its {len(K["post"])} questions; no step locked')
    for i,q in enumerate(K['post']):
        card=pg.locator('.qcard').nth(i)
        exact=lambda t: card.locator('label.opt').filter(has_text=re.compile('^\\s*'+re.escape(t)+'\\s*$')).first   # options may be shown in another order
        if q['t']=='choice': l=exact(q['o'][q['c']]); await (l.tap() if touch else l.click())
        elif q['t']=='multi':
            for k in q['c']: l=exact(q['o'][k]); await (l.tap() if touch else l.click())
        elif q['t']=='tf':
            l=card.locator('label.opt',has_text=re.compile('^\\s*'+('ถูก' if q['a'] else 'ผิด')+'\\s*$')).first; await (l.tap() if touch else l.click())
        else: await card.locator('input[type=text]').fill(q['ans'][0])
    async with pg.expect_response(lambda r_:'/api/lessons/w1/quiz' in r_.url) as rr:
        await tap(pg,'button:has-text("ส่งแบบทดสอบหลังเรียน")',touch)
    res=await rr.value; j=await res.json()
    check(res.status==200 and j.get('passed'),f'{tag}: the post-test is submitted through the page ({res.status}, {j.get("score")}/{j.get("max")})')
    s,p=await req(S,'get','/api/path'); w1=p['weeks'][0]
    check(w1['status']=='completed' and w1['order']['practice']['ok'] and w1['order']['post']['ok'],f'{tag}: week 1 completed, both steps ok ({w1["status"]})')
    check(await hscroll(pg)<=0,f'{tag}: no horizontal overflow on the post-test')
    check(not pg._errs,f'{tag}: no page errors {pg._errs[:2]}')
    await S.close()

async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        T=await new_ctx(b,1280,800,False); await login(T,'kru4','Teach1234')
        s,cl=await req(T,'get','/api/teacher/classes'); cls=cl.get('classes') if isinstance(cl,dict) else cl
        cid=[c for c in cls if c.get('name')=='ปวช.2/4'][0]['id']
        await terminals(b,T,cid)
        print('== B. the teacher turns the step order on')
        await path_tab(b,T,cid,True)
        for tag,w,h,touch in [('desktop',1280,800,False),('phone',360,740,True)]:
            await student_flow(b,T,cid,tag,w,h,touch)
        print('== D. the teacher turns it off: a fresh student can start at once')
        await path_tab(b,T,cid,False)
        S,uid=await make_student(b,T,cid,'นักเรียน ไม่ล็อกลำดับ',360,740,True); pg=await page(S)
        await pg.goto(BASE+'/#/lesson/w1/lab'); await pg.wait_for_selector('#prStart'); await pg.wait_for_timeout(300)
        r=await rail(pg)
        check(await pg.locator('#prOrder').count()==0 and not r['lab']['lock'] and not r['post']['lock'],'no #prOrder, no locked rail step')
        await pg.locator('#prStart').tap(); await pg.wait_for_selector('#prClock'); ok('"เริ่มฝึกปฏิบัติ" starts the practical without the earlier steps')
        s,j=await req(S,'get','/api/practical/w1/mission/topology/t8'); check(s==200,f'the mission endpoint answers ({s})')
        check(not pg._errs,f'no page errors {pg._errs[:2]}')
        await b.close()
    print(f'\npart22: {len(issues)} issue(s)'); [print('  -',i) for i in issues]
    sys.exit(1 if issues else 0)
asyncio.run(main())
