# Part 21 (3.3): the Embedded Virtual Lab of the practical page (#/lesson/wN/lab) in a real browser: the 14 checks of the
# requirement (item 8), on desktop 1280x800, tablet 768x1024 (touch) and phone 360x740 (touch).
#  1 "เปิดห้องจำลอง" keeps the page on #/lesson/wN/lab (no hash change, no mission list page)
#  2 only the chosen mission is shown (its title, no other mission title of that simulator)
#  3 no mission grid/list and no free mode inside #prWs
#  4 no way to switch mission from the workspace: no element offers it, clicking every control keeps the mission, the
#    other cards are hidden (focus mode)
#  5 the simulator tools work inside: topology t1 built by real clicks/taps (place, cable, IP, ping, undo/redo, submit with
#    the simulator's own button), t8 coach steps by real clicks then finished from its saved draft, troubleshoot x15, and on
#    desktop subnet s1 (w3), switching sw1 (w4), crimp c1 (w5)
#  6 the one practical timer: #prWsClock = deadline - server time (GET /api/practical/active) before, during, expanded,
#    after closing; the deadline never changes; opening before "เริ่มฝึกปฏิบัติ" starts nothing
#  7 the score is recorded (practical_items + sim_results by SQL, and the card)
#  8 no duplicates (submitting twice and once more lower: one practical_items row, one sim_results row, best kept)
#  9 closing the workspace keeps the work (reopen shows the saved devices) and the card status
# 10 reopening: during the session it counts; after the session it opens in review mode, says it does not count and is
#    not recorded
# 11 after a passing submit the card status updates without a reload
# 12 no horizontal page overflow with the workspace open and expanded; expand / Escape / back button
# 13 the lesson lock: a locked week's mission endpoint is 403 and the page shows the lock; completing week 1 opens week 2
# 14 the standalone simulators (3.5: teachers only): #/sims and #/sim/topology still show the full list and free mode; a
#    mission there is graded
# 3.5 no sidebar / bottom-nav / dashboard / onboarding link to #/sims or #/practice for guests and students (1280, 360);
#    #/sims, #/sim/topology, #/practice -> #/learn, #/sim/topology/t8 -> #/lesson/w1/lab, #/sim/topology/t9 -> #/lesson/w18/lab,
#    #/practice/u3 -> the first lesson of unit 3; teachers still open #/sims, #/practice, #/sim/...; the week 18 extra t9 opens
#    embedded (data-mode=extra) and its submit is not a practical item
# usage: E2E_BASE=http://127.0.0.1:3990 E2E_DATABASE_URL=postgres://... python3 tests/e2e/part21.py <out-dir>
#   (needs the tests/e2e/setup.js fixture: teacher kru4 / Teach1234, legacy class ปวช.2/4 (all weeks open))
import asyncio, sys, os, subprocess, json, re, time
from playwright.async_api import async_playwright
OUT=sys.argv[1] if len(sys.argv)>1 else '/tmp/netlab-e2e'; os.makedirs(OUT,exist_ok=True)
BASE=os.environ.get('E2E_BASE','http://127.0.0.1:3990')
DB=os.environ.get('E2E_DATABASE_URL','postgres://postgres@127.0.0.1:5433/netlab_e2e')
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
H={'X-NetLab':'1'}
VIEWS=[('desktop',1280,800,False),('tablet',768,1024,True),('phone',360,740,True)]
SOLVER=re.search(r'SOLVER=r"""(.*?)"""',open(os.path.join(ROOT,'tests','e2e','phase4.py'),encoding='utf-8').read(),re.S).group(1)
# a finished t8 network (2 networks through a router), as the simulator stores it in its draft
T8={"devices":[
 {"id":"sw1","type":"switch","name":"Switch1","x":400,"y":300,"ports":24},
 {"id":"pc1","type":"pc","name":"PC1","x":250,"y":480,"ifaces":[{"name":"eth0","ip":"192.168.1.10","prefix":24}],"gateway":"192.168.1.1","dns":[],"dhcp":False},
 {"id":"pc2","type":"pc","name":"PC2","x":550,"y":480,"ifaces":[{"name":"eth0","ip":"192.168.1.11","prefix":24}],"gateway":"192.168.1.1","dns":[],"dhcp":False},
 {"id":"r1","type":"router","name":"Router1","x":700,"y":140,"ifaces":[{"name":"g0/0","ip":"192.168.1.1","prefix":24},{"name":"g0/1","ip":"192.168.2.1","prefix":24},{"name":"g0/2","ip":"","prefix":""},{"name":"g0/3","ip":"","prefix":""}],"routes":[]},
 {"id":"pc3","type":"pc","name":"PC3","x":900,"y":300,"ifaces":[{"name":"eth0","ip":"192.168.2.10","prefix":24}],"gateway":"192.168.2.1","dns":[],"dhcp":False}],
 "links":[
 {"id":"l1","a":{"dev":"pc1","port":"eth0"},"b":{"dev":"sw1","port":"p1"},"medium":"utp","up":True},
 {"id":"l2","a":{"dev":"pc2","port":"eth0"},"b":{"dev":"sw1","port":"p2"},"medium":"utp","up":True},
 {"id":"l3","a":{"dev":"r1","port":"g0/0"},"b":{"dev":"sw1","port":"p3"},"medium":"utp","up":True},
 {"id":"l4","a":{"dev":"pc3","port":"eth0"},"b":{"dev":"r1","port":"g0/1"},"medium":"utp","up":True}]}
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
console.log(JSON.stringify({ sections: L.sections.filter(s => !s.extra).map(s => s.id), checks, pre: L.quiz.length, postRight: formOf(L, 'post').map(right),
  items: P.setOf('w1').items.map(i => ({ key: i.key, part: i.part, kind: i.kind, max: i.max })) }));"""],cwd=ROOT,stderr=subprocess.DEVNULL))

async def req(ctx,method,path,body=None):
    r=await getattr(ctx.request,method)(BASE+path,**({'data':body} if body is not None else {}),headers=H)
    try: j=await r.json()
    except Exception: j={}
    return r.status,j
async def login(ctx,u,p):
    s,j=await req(ctx,'post','/api/auth/login',{'username':u,'password':p}); assert s==200, j
async def new_ctx(b,w,h,touch,theme='light'):
    ctx=await b.new_context(viewport={'width':w,'height':h},has_touch=touch,is_mobile=touch,color_scheme=theme)
    # __hs records every hash change of the tab (case 1); __boot is reset only by a real page load (case 11)
    await ctx.add_init_script(f"try{{localStorage.setItem('netlab-theme','{theme}');localStorage.setItem('netlab-onboard','done')}}catch(e){{}}"
                              "window.__hs=[];window.__boot=Math.random();addEventListener('hashchange',()=>window.__hs.push(location.hash));")
    return ctx
async def page(ctx):
    pg=await ctx.new_page(); pg._errs=[]; pg.on('pageerror',lambda e:pg._errs.append(str(e))); pg.on('dialog',lambda d: asyncio.ensure_future(d.accept()))
    return pg
NO=[100]
async def make_student(b,T,cid,name,w=1280,h=800,touch=False):
    NO[0]+=1
    s,cr=await req(T,'post',f'/api/teacher/classes/{cid}/students',{'rows':[{'no':str(NO[0]),'name':name}]}); assert cr.get('created'), cr
    c=cr['created'][0]
    ctx=await new_ctx(b,w,h,touch); await login(ctx,c['username'],c['password'])
    await req(ctx,'post','/api/auth/password',{'current':c['password'],'next':'Emb12345'})
    s,me=await req(ctx,'get','/api/me'); return ctx,me['user']['id']
async def hscroll(pg):
    d=await pg.evaluate('({sw:document.scrollingElement.scrollWidth,iw:innerWidth})')
    return d['sw']-min(d['iw'],pg.viewport_size['width'])
def secs(t):
    m=re.match(r'^\s*(\d+):(\d\d)\s*$',t or ''); return int(m.group(1))*60+int(m.group(2)) if m else None
async def server_left(ctx):
    s,j=await req(ctx,'get','/api/practical/active'); return (j['session']['deadline']-j['now'])/1000, j['session']['deadline']
async def tap_or_click(pg,loc,touch):
    await loc.scroll_into_view_if_needed()
    if touch: await loc.tap()
    else: await loc.click()
async def open_ws(pg,key,mode,touch=False):
    await tap_or_click(pg,pg.locator(f'.prOpenSim[data-key="{key}"]').first,touch)
    await pg.wait_for_selector(f'#prWs[data-key="{key}"][data-mode={mode}] #prWsSim .nls-embedded',timeout=20000)
    await pg.wait_for_timeout(600)
async def close_ws(pg,touch=False):
    await tap_or_click(pg,pg.locator('#prWsClose'),touch); await pg.wait_for_selector('#prWs',state='detached'); await pg.wait_for_timeout(400)
async def visible_items(pg):
    return await pg.evaluate("[...document.querySelectorAll('#prPage .pritem,#prPage .prplanitem,#prPage .prresitem')].filter(e=>e.offsetParent!==null).map(e=>e.dataset.key)")
async def embedded_view(pg):
    """what the workspace offers: free mode text, 'choose a mission' text, visible mission lists, links to simulator pages"""
    return await pg.evaluate("""()=>{const s=document.getElementById('prWs');const t=s.innerText;const vis=e=>e&&e.offsetParent!==null;
      return {free:/โหมดอิสระ|ฝึกอิสระ/.test(t),choose:/เลือกภารกิจ/.test(t),
        lists:[...s.querySelectorAll('[class*="-missions"],[class*="mlist"],[class*="-mbtn"]')].filter(vis).length,
        links:[...s.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')).filter(h=>/^#\\/(sims?|lesson)/.test(h)),
        mods:s.querySelectorAll('.nls-embedded').length}}""")

# ---------- topology by real pointer input inside the workspace ----------
SIMQ='#prWsSim '
async def center(pg,sel):
    # centred in the viewport, so a tap at its coordinates never lands on the fixed bottom navigation of the phone layout
    # (instant: the page may scroll smoothly; then wait until the box stops moving)
    # (the focused IP field is blurred first: a focused field keeps the page scrolled to itself)
    loc=pg.locator(sel).first; await loc.evaluate("e=>{const a=document.activeElement;if(a&&a!==document.body&&a.blur)a.blur();e.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'})}")
    bb=await loc.bounding_box()
    for _ in range(20):
        await pg.wait_for_timeout(100); b2=await loc.bounding_box()
        if b2==bb: break
        bb=b2
    return bb['x']+bb['width']/2, bb['y']+bb['height']/2
async def point(pg,x,y,touch):
    if touch: await pg.touchscreen.tap(x,y)
    else: await pg.mouse.click(x,y)
async def topo_ids(pg):
    return await pg.evaluate("s=>[...document.querySelectorAll(s+'[data-r=netl] [data-id]')].map(g=>g.getAttribute('data-id'))",SIMQ)
async def topo_net(pg):
    """devices and cables on the canvas"""
    return await pg.evaluate("s=>[document.querySelectorAll(s+'[data-r=netl] [data-id]').length,new Set([...document.querySelectorAll(s+'svg [data-link]')].map(e=>e.getAttribute('data-link'))).size]",SIMQ)
async def topo_place(pg,t,fx,fy,touch):
    await tap_or_click(pg,pg.locator(SIMQ+f'[data-type={t}]').first,touch)
    await pg.evaluate("s=>document.querySelector(s+'svg.nls-topology-canvas').scrollIntoView({block:'center'})",SIMQ); await pg.wait_for_timeout(150)
    bb=await pg.locator(SIMQ+'svg.nls-topology-canvas').bounding_box()
    await point(pg,bb['x']+bb['width']*fx,bb['y']+bb['height']*fy,touch); await pg.wait_for_timeout(250)
async def topo_dev(pg,did,touch):
    await point(pg,*(await center(pg,SIMQ+f'[data-r=netl] [data-id="{did}"]')),touch); await pg.wait_for_timeout(200)
async def topo_tool(pg,tool,touch):
    await tap_or_click(pg,pg.locator(SIMQ+f'[data-tool={tool}]').first,touch); await pg.wait_for_timeout(150)
async def topo_two_pcs(pg,touch):
    """two PCs and a switch, cabled with UTP; returns (pcs, switch)"""
    await topo_place(pg,'pc',.2,.3,touch); await topo_place(pg,'pc',.2,.75,touch); await topo_place(pg,'switch',.6,.5,touch)
    ids=await topo_ids(pg); pcs=[i for i in ids if i.startswith('pc')]; sws=[i for i in ids if i.startswith('sw')]
    if len(pcs)<2 or not sws: return pcs,None
    await topo_tool(pg,'utp',touch)
    for pc in pcs[:2]: await topo_dev(pg,pc,touch); await topo_dev(pg,sws[0],touch)
    await topo_tool(pg,'select',touch)
    return pcs,sws[0]
async def topo_ip(pg,pcs,touch):
    for i,pc in enumerate(pcs[:2]):
        await topo_dev(pg,pc,touch)
        ip=pg.locator('[data-k=ip]:visible').first; await ip.wait_for(timeout=5000)
        await ip.fill(f'192.168.1.{10+i}'); await ip.dispatch_event('change')
        mk=pg.locator('[data-k=mask]:visible').first; await mk.fill('255.255.255.0'); await mk.dispatch_event('change'); await pg.wait_for_timeout(200)
        cl=pg.locator(SIMQ+'[data-act=sheet-close]:visible')   # the settings bottom sheet of narrow screens
        if await cl.count(): await tap_or_click(pg,cl.first,touch); await pg.wait_for_timeout(700)   # the canvas view moves back after the sheet closes
async def topo_ping(pg,pcs,touch):
    await topo_tool(pg,'ping',touch); await topo_dev(pg,pcs[0],touch); await topo_dev(pg,pcs[1],touch); await pg.wait_for_timeout(2500)
    await topo_tool(pg,'select',touch)
async def topo_submit(pg,touch,sim='topology'):
    async with pg.expect_response(lambda r:f'/api/sims/{sim}/submit' in r.url) as rr:
        await tap_or_click(pg,pg.locator(SIMQ+'[data-m="submit"]').first,touch)
    return await (await rr.value).json()
async def t8_finish(pg,touch):
    """the coach's "ถัดไป" through the remaining steps, then the tutorial's own submit button"""
    for i in range(16):
        if await pg.locator(SIMQ+'[data-m="submit"]:visible').count(): break
        nx=pg.locator(SIMQ+'[data-act="tut-next"]')
        if await nx.count() and await nx.first.is_enabled(): await tap_or_click(pg,nx.first,touch); await pg.wait_for_timeout(500); continue
        await pg.wait_for_timeout(1500)
    return await topo_submit(pg,touch)
async def solve_x15(pg,scope='#prWsSim '):
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
def rows(uid,sid,key):
    sim,m=key.split(':')
    pi=sql(f"SELECT count(*)||':'||COALESCE(max(score),-1) FROM practical_items WHERE session_id={sid} AND item='{key}'")
    sr=sql(f"SELECT count(*)||':'||COALESCE(max(best),-1)||':'||COALESCE(max(attempts),0) FROM sim_results WHERE user_id={uid} AND sim='{sim}' AND mission='{m}'")
    return pi,sr

async def student_flow(b,T,cid,tag,w,h,touch,titles):
    S,uid=await make_student(b,T,cid,f'นักเรียน ฝัง {tag}',w,h,touch); pg=await page(S)
    TAP=lambda loc: tap_or_click(pg,loc,touch)
    dl=None
    async def timer(where,sel):
        left,d=await server_left(S); c=secs(await pg.inner_text(sel))
        check(c is not None and abs(c-left)<=3 and d==dl,f'{tag}: 6. {where}: {sel} {c}s = deadline - server time {left:.1f}s, deadline unchanged')
    print(f'== [{tag} {w}x{h}] before "เริ่มฝึกปฏิบัติ": a mission does not open and starts no timer')
    await pg.goto(BASE+'/#/lesson/w1/lab'); await pg.wait_for_selector('#prPlan .prOpenSim[data-key="topology:t8"]')
    check(await pg.locator('#prPage a[href^="#/sim/"], #prPage a[data-go]').count()==0,f'{tag}: no link from the practical page to a simulator page')
    await TAP(pg.locator('#prPlan .prOpenSim[data-key="topology:t8"]')); await pg.wait_for_selector('.prwsneed')
    s,a=await req(S,'get','/api/practical/active')
    check('กดเริ่มฝึกปฏิบัติก่อน' in await pg.inner_text('.prwsneed') and await pg.locator('#prWs').count()==0 and a['session'] is None,f'{tag}: 6. before start the card says "กดเริ่มฝึกปฏิบัติก่อน"; no workspace, no session started')
    await TAP(pg.locator('#prStart')); await pg.wait_for_selector('#prClock'); await pg.wait_for_timeout(800)
    _,dl=await server_left(S); sid=sql(f"SELECT id FROM practical_sessions WHERE user_id={uid} AND status='running'")
    await timer('before opening','#prClock')

    print(f'== [{tag}] 1-4. t8 opens on this page, only this mission, no list, no free mode, no way to another mission')
    await pg.evaluate("window.__hs=[]"); boot=await pg.evaluate("window.__boot")
    await open_ws(pg,'topology:t8','run',touch)
    hs=await pg.evaluate("window.__hs")
    check(pg.url.endswith('#/lesson/w1/lab') and hs==[],f'{tag}: 1. the URL stays #/lesson/w1/lab (hash changes {hs})')
    t=await pg.inner_text('#prWsSim'); others=[x for k,x in titles.items() if k!='t8' and x in t]
    check((await pg.inner_text('#prWsTitle')).strip()==titles['t8'] and titles['t8'] in t and not others,f'{tag}: 2. only mission t8 is shown (other topology missions in the workspace: {others[:2]})')
    ev=await embedded_view(pg)
    check(not ev['free'] and not ev['choose'] and ev['lists']==0 and not ev['links'] and ev['mods']==1,f'{tag}: 3. no mission grid/list, no free mode, no link to the simulators or lessons {ev}')
    vis=await visible_items(pg)
    check(vis==['topology:t8'] and not await pg.locator('.prtabs').is_visible() and not await pg.locator('#prTimer').is_visible(),f'{tag}: 4. focus mode: only this card is visible ({vis}); part tabs and the page timer bar are hidden')
    check(await pg.locator('#prWs .prOpenSim').count()==0 and await pg.locator('#prWs [data-mission]:not([data-mission="t8"])').count()==0,f'{tag}: 4. nothing in the workspace offers another mission')
    await timer('workspace open','#prWsClock')
    check(await pg.get_attribute('#prWsClock','data-timed')=='1' and await pg.get_attribute('#prWsStatus','data-state')=='todo',f'{tag}: the workspace clock is the session clock; status "ยังไม่ได้ส่ง"')
    check(await hscroll(pg)<=0,f'{tag}: 12. no horizontal page overflow with the workspace open')
    await pg.screenshot(path=f'{OUT}/p21_{tag}_t8_open.png')

    print(f'== [{tag}] 5. t8 coach by real {"taps" if touch else "clicks"}: place, cable, IP, ping')
    coach0=await pg.inner_text(SIMQ+'[data-r=coach]') if await pg.locator(SIMQ+'[data-r=coach]').count() else ''
    pcs,sw=await topo_two_pcs(pg,touch)
    check(len(pcs)>=2 and sw,f'{tag}: 5. two PCs and a switch placed on the canvas ({await topo_ids(pg)})')
    if len(pcs)>=2 and sw:
        await topo_ip(pg,pcs,touch); await topo_ping(pg,pcs,touch); await pg.wait_for_timeout(1500)
    coach1=await pg.inner_text(SIMQ+'[data-r=coach]') if await pg.locator(SIMQ+'[data-r=coach]').count() else ''
    done=await pg.locator(SIMQ+'.nls-topology-dots .nls-topology-d-done, '+SIMQ+'.nls-topology-cok').count()
    check(coach1!=coach0 and done>=1,f'{tag}: 5. the step-by-step coach follows the real network ({done} step(s) ticked)')
    n_dev=len(await topo_ids(pg))
    print(f'== [{tag}] 9. close keeps the work; reopen shows it')
    await close_ws(pg,touch)
    check(await pg.evaluate("document.querySelectorAll('.nls-embedded,#prWs').length")==0 and not await pg.evaluate("document.documentElement.classList.contains('prwsx-on')"),f'{tag}: closed: the simulator instance is gone, the list is back')
    check(len(await visible_items(pg))>=3 and await pg.get_attribute('.pritem[data-key="topology:t8"]','data-state')=='todo',f'{tag}: 9. the list shows all cards again; t8 still "ยังไม่ทำ"')
    await timer('after closing','#prClock')
    await open_ws(pg,'topology:t8','run',touch)
    check(len(await topo_ids(pg))==n_dev and n_dev>=3,f'{tag}: 9. reopened: the {n_dev} devices placed before are still there')
    await close_ws(pg,touch)
    # the finished network as a stored draft of t8, with another "current" mission: the embedded t8 must open t8 with its own work
    await pg.evaluate("d=>{let o={};try{o=JSON.parse(localStorage.getItem('nl-sim-topology-draft'))||{}}catch(e){} o.v=o.v||1;o.cur='t1';o.works=Object.assign(o.works||{},{t8:d});o.tut={step:7,max:7,enteredDone:true};localStorage.setItem('nl-sim-topology-draft',JSON.stringify(o))}",T8)
    await open_ws(pg,'topology:t8','run',touch)
    check((await pg.inner_text('#prWsTitle')).strip()==titles['t8'] and len(await topo_ids(pg))==5,f'{tag}: a stored draft opens t8 with its own saved network (5 devices), not the draft\'s current mission t1')
    r=await t8_finish(pg,touch)
    check(r.get('score')==10 and (r.get('practical') or {}).get('recorded') is True,f'{tag}: 5/7. t8 submitted with the simulator\'s own button: {r.get("score")}/{r.get("max")} recorded {r.get("practical")}')
    await pg.wait_for_selector('.pritem[data-key="topology:t8"][data-state=passed]',timeout=8000)
    check(await pg.evaluate("window.__boot")==boot and await pg.get_attribute('#prWsStatus','data-state')=='passed' and 'บันทึกผลลงฝึกปฏิบัติแล้ว' in await pg.inner_text('#prWsNote'),f'{tag}: 11. card and workspace status "ผ่าน" at once, without a reload; note "บันทึกผลลงฝึกปฏิบัติแล้ว"')
    check(await pg.get_attribute('.prtabs .prpart[data-part=guided]','data-passed')=='1',f'{tag}: 11. the Guided part progress counts it')
    await timer('after the submit','#prWsClock')

    print(f'== [{tag}] 12. expand / Escape / back button')
    xb=pg.locator('#prWsExpand')
    if await xb.is_visible():
        await TAP(xb); await pg.wait_for_timeout(500)
        g=await pg.evaluate("(()=>{const w=document.getElementById('prWs'),r=w.getBoundingClientRect(),c=document.getElementById('prWsClock').getBoundingClientRect(),x=document.getElementById('prWsClose').getBoundingClientRect();return {cls:w.className,html:document.documentElement.classList.contains('prwsx-on'),w:r.width,h:r.height,iw:innerWidth,ih:innerHeight,cy:c.top,xb:x.bottom}})()")
        check('prwsx' in g['cls'].split() and g['html'] and await xb.get_attribute('aria-pressed')=='true' and abs(g['w']-g['iw'])<2 and 0<=g['cy']<g['ih'] and g['xb']<=g['ih'],f'{tag}: 12. expanded: fills the screen, clock and close button visible {g}')
        check(await hscroll(pg)<=0,f'{tag}: 12. no horizontal page overflow when expanded')
        await timer('expanded','#prWsClock')
        await pg.screenshot(path=f'{OUT}/p21_{tag}_expanded.png')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
        check('prwsx' not in (await pg.get_attribute('#prWs','class')).split() and not await pg.evaluate("document.documentElement.classList.contains('prwsx-on')") and await xb.get_attribute('aria-pressed')=='false',f'{tag}: 12. Escape returns to the normal view, the workspace stays open')
        await TAP(xb); await pg.wait_for_timeout(300); await pg.go_back(); await pg.wait_for_timeout(700)
        check(await pg.locator('#prWs[data-key="topology:t8"]').count()==1 and 'prwsx' not in (await pg.get_attribute('#prWs','class')).split() and pg.url.endswith('#/lesson/w1/lab'),f'{tag}: 12. the back button leaves the expanded view, not the page')
    else:
        geo=await pg.evaluate("(()=>{const w=document.getElementById('prWs').getBoundingClientRect(),c=document.getElementById('prPage').getBoundingClientRect();return [Math.round(w.width),Math.round(c.width)]})()")
        check(tag=='desktop' and abs(geo[0]-geo[1])<=2,f'{tag}: 12. no "ขยายพื้นที่" button only on desktop, where the workspace spans the content width {geo}')
    await close_ws(pg,touch)

    print(f'== [{tag}] 4. clicking every control of another mission (t14) never changes the mission')
    await open_ws(pg,'topology:t14','run',touch); await pg.evaluate("window.__hs=[]")
    n=await pg.evaluate("""()=>{const s=document.getElementById('prWsSim');const skip=/^(submit|reset|fs|save)$/;
      const bs=[...s.querySelectorAll('button,[role=button],a[href]')].filter(e=>e.offsetParent!==null&&!e.disabled&&!skip.test(e.dataset.act||e.dataset.m||e.dataset.tool||''));
      bs.forEach(e=>{try{e.click()}catch(x){}});return bs.length}""")
    await pg.wait_for_timeout(1200)
    dk=await pg.locator('#prWs').get_attribute('data-key') if await pg.locator('#prWs').count() else None
    ev=await embedded_view(pg) if dk else {}
    t=await pg.inner_text('#prWsSim') if dk else ''; others=[x for k,x in titles.items() if k!='t14' and x in t]
    check(dk=='topology:t14' and (await pg.inner_text('#prWsTitle')).strip()==titles['t14'] and not others and await pg.evaluate("window.__hs")==[] and ev.get('mods')==1 and ev.get('lists')==0 and not ev.get('free'),f'{tag}: 4. after clicking all {n} controls the workspace still shows t14 only, same URL {ev}')
    if await pg.locator('#prWs').count(): await close_ws(pg,touch)

    print(f'== [{tag}] 5/7/8/9. t1 built by real {"taps" if touch else "clicks"} and submitted twice')
    await TAP(pg.locator('.prtabs .prpart[data-part=independent]')); await pg.wait_for_selector('.prOpenSim[data-key="topology:t1"]')
    await open_ws(pg,'topology:t1','run',touch)
    check((await pg.inner_text('#prWsTitle')).strip()==titles['t1'] and 'Independent Lab' in await pg.inner_text('#prWs .prwspart'),f'{tag}: t1 opens from the Independent Lab card')
    pcs,sw=await topo_two_pcs(pg,touch)
    n0=await topo_net(pg)
    await tap_or_click(pg,pg.locator(SIMQ+'[data-act=undo]').first,touch); await pg.wait_for_timeout(300); n_undo=await topo_net(pg)
    await tap_or_click(pg,pg.locator(SIMQ+'[data-act=redo]').first,touch); await pg.wait_for_timeout(300); n_redo=await topo_net(pg)
    await close_ws(pg,touch); await open_ws(pg,'topology:t1','run',touch)
    n1=await topo_net(pg)
    check(n0==[3,2] and n1==n0,f'{tag}: 9. t1: the devices and cables [devices, cables] survive closing and reopening ({n0} -> {n1})')
    await topo_ip(pg,pcs,touch); await topo_ping(pg,pcs,touch)
    r1=await topo_submit(pg,touch)
    if r1.get('score')!=10:
        print('   t1 result',json.dumps({k:v for k,v in r1.items() if k not in ('practical',)},ensure_ascii=False)[:900])
        print('   t1 devices',await pg.evaluate("(()=>{try{const d=JSON.parse(localStorage.getItem('nl-sim-topology-draft')).works.t1;return d.devices.map(x=>x.id+':'+(x.ifaces||[]).map(i=>i.ip+'/'+i.prefix).join(','))}catch(e){return String(e)}})()"))
        await pg.screenshot(path=f'{OUT}/p21_{tag}_t1_fail.png')
    check(r1.get('score')==10 and (r1.get('practical') or {}).get('recorded') is True and str(r1['practical'].get('session'))==sid,f'{tag}: 5/7. t1 (placed, cabled, IPs, ping by hand) graded {r1.get("score")}/{r1.get("max")} and recorded into session {sid}')
    check(n_undo==[3,1] and n_redo==n0,f'{tag}: 5. undo / redo work in the workspace ({n0} -> undo {n_undo} -> redo {n_redo})')
    await pg.wait_for_selector('.pritem[data-key="topology:t1"][data-state=passed]',timeout=8000)
    pi,sr=rows(uid,sid,'topology:t1')
    check(pi=='1:10' and sr.startswith('1:10:'),f'{tag}: 7. SQL: one practical_items row 10/10 ({pi}), one sim_results row best 10 ({sr})')
    check('10/10' in await pg.inner_text('.pritem[data-key="topology:t1"]'),f'{tag}: 7. the card shows "รอบนี้ได้ 10/10"')
    r2=await topo_submit(pg,touch); await pg.wait_for_timeout(800)
    lower=await pg.evaluate("api('POST','/api/sims/topology/submit',{mission:'t1',payload:{devices:[],links:[]}})")
    pi2,sr2=rows(uid,sid,'topology:t1')
    check((r2.get('practical') or {}).get('recorded') is True,f'{tag}: 10. reopened in the running session, a submit still counts ({r2.get("score")})')
    check(pi2=='1:10' and sr2.split(':')[:2]==['1','10'] and int(sr2.split(':')[2])>=3 and lower.get('score',10)<10,f'{tag}: 8. submitted twice more (once {lower.get("score")}/10): still one practical_items row ({pi2}) and one sim_results row ({sr2}), best kept')
    check(await pg.get_attribute('.pritem[data-key="topology:t1"]','data-state')=='passed',f'{tag}: 8. the card stays "ผ่าน"')
    await close_ws(pg,touch)
    await timer('after t1','#prClock')

    print(f'== [{tag}] 5. troubleshoot x15 in the workspace')
    await TAP(pg.locator('.prtabs .prpart[data-part=trouble]')); await pg.wait_for_selector('.prOpenSim[data-key="troubleshoot:x15"]')
    await open_ws(pg,'troubleshoot:x15','run',touch)
    ev=await embedded_view(pg); check(not ev['free'] and ev['lists']==0 and not ev['links'],f'{tag}: x15 embedded: no list, no free mode {ev}')
    r=await solve_x15(pg)
    check(r.get('score')==10 and (r.get('practical') or {}).get('recorded') is True,f'{tag}: 5. x15 solved (cable plugged, tested, submitted) and recorded ({r.get("score")})')
    await pg.wait_for_selector('.pritem[data-key="troubleshoot:x15"][data-state=passed]',timeout=8000)
    check(await hscroll(pg)<=0,f'{tag}: 12. no horizontal overflow with x15 open')
    await pg.screenshot(path=f'{OUT}/p21_{tag}_x15.png')
    await close_ws(pg,touch)
    await timer('after x15','#prClock')
    _,d2=await server_left(S); check(d2==dl,f'{tag}: 6. the deadline never changed during the session')

    print(f'== [{tag}] 10. after the session: review mode, not counted')
    await TAP(pg.locator('#prSubmit')); await TAP(pg.locator('#prSubmitYes')); await pg.wait_for_selector('#prResult[data-status=submitted]')
    tot=sql(f"SELECT result->>'total' FROM practical_sessions WHERE id={sid}"); nitems=sql(f"SELECT count(*)||':'||sum(score) FROM practical_items WHERE session_id={sid}")
    await pg.wait_for_selector('#prResult .prOpenSim[data-key="topology:t1"]')
    await open_ws(pg,'topology:t1','review',touch)
    mt=await pg.inner_text('#prWs .prwsmode')
    check('ไม่นับ' in mt and await pg.get_attribute('#prWsClock','data-timed')=='0' and 'ไม่จับเวลา' in await pg.inner_text('#prWsClock'),f'{tag}: 10. review mode: labelled "ไม่นับ", not timed ({mt[:60]!r})')
    check(await visible_items(pg)==['topology:t1'] and len(await topo_ids(pg))>=3,f'{tag}: 10. review shows the saved t1 work, only this card')
    r=await topo_submit(pg,touch); await pg.wait_for_timeout(800)
    nitems2=sql(f"SELECT count(*)||':'||sum(score) FROM practical_items WHERE session_id={sid}")
    check(not (r.get('practical') or {}).get('recorded') and 'ไม่นับ' in await pg.inner_text('#prWsNote') and nitems2==nitems and sql(f"SELECT result->>'total' FROM practical_sessions WHERE id={sid}")==tot,f'{tag}: 10. a review submit is graded ({r.get("score")}) but not recorded; the session stays {tot}% ({nitems} -> {nitems2})')
    await close_ws(pg,touch)
    check(await pg.get_attribute('.prresitem[data-key="topology:t1"]','data-passed')=='true',f'{tag}: 9. the result still shows t1 passed after closing')
    check(await hscroll(pg)<=0,f'{tag}: 12. no horizontal overflow on the results')
    check(not pg._errs,f'{tag}: no page errors {pg._errs[:2]}')
    await S.close()

async def weeks_flow(b,T,cid,tag,w,h,touch):
    """the other simulator types of weeks 3-5 in the workspace, each submitted with its own button"""
    S,uid=await make_student(b,T,cid,f'นักเรียน สัปดาห์ 3-5 {tag}',w,h,touch); pg=await page(S)
    TAP=lambda loc: tap_or_click(pg,loc,touch)
    async def start(wk):
        await pg.goto(BASE+f'/#/lesson/{wk}/lab'); await pg.wait_for_selector('#prStart'); await TAP(pg.locator('#prStart')); await pg.wait_for_selector('#prClock')
        return sql(f"SELECT id FROM practical_sessions WHERE user_id={uid} AND status='running'")
    async def finish():
        await TAP(pg.locator('#prSubmit')); await TAP(pg.locator('#prSubmitYes')); await pg.wait_for_selector('#prResult')
    async def part_of(key):
        p=await pg.evaluate("k=>{for(const p of PR.st.parts) if(p.items.some(i=>i.key===k)) return p.id}",key)
        if await pg.locator(f'.prOpenSim[data-key="{key}"]').count()==0: await TAP(pg.locator(f'.prtabs .prpart[data-part={p}]'))
        await pg.wait_for_selector(f'.prOpenSim[data-key="{key}"]')
    print(f'== [{tag}] 5. week 3 subnet s1')
    sid=await start('w3'); await part_of('subnet:s1'); await open_ws(pg,'subnet:s1','run',touch)
    ev=await embedded_view(pg); check(not ev['free'] and ev['lists']==0 and not ev['links'],f'{tag}: subnet s1 embedded {ev}')
    async with pg.expect_response(lambda r: r.url.endswith('/api/sims/subnet/new')) as rr:
        await TAP(pg.locator(SIMQ+'[data-act="new"]').first)
    prob=(await (await rr.value).json())['problem']; prob['mission']='s1'; await pg.wait_for_timeout(500)
    ans=await pg.evaluate(SOLVER,prob)
    for k,v in ans.items():
        loc=pg.locator(f'{SIMQ}[data-key="{k}"]')
        if await loc.evaluate('e=>e.tagName')=='SELECT': await loc.select_option(v)
        else: await loc.fill(v)
    async with pg.expect_response(lambda r:'/api/sims/subnet/submit' in r.url) as rr:
        await TAP(pg.locator(SIMQ+'button[type=submit]').first)
    r=await (await rr.value).json()
    await pg.wait_for_selector('.pritem[data-key="subnet:s1"][data-state=passed]',timeout=8000)
    pi,sr=rows(uid,sid,'subnet:s1')
    check(r['score']==r['max'] and r['practical']['recorded'] and pi.startswith('1:') and sr.startswith('1:'),f'{tag}: 5. subnet s1 ("โจทย์ใหม่", answers, submit) {r["score"]}/{r["max"]} recorded; rows {pi} / {sr}')
    await close_ws(pg,touch); await finish()
    print(f'== [{tag}] 5. week 4 switching sw1')
    sid=await start('w4'); await part_of('switching:sw1'); await open_ws(pg,'switching:sw1','run',touch)
    ev=await embedded_view(pg); check(not ev['free'] and ev['lists']==0 and not ev['links'],f'{tag}: switching sw1 embedded {ev}')
    pb=pg.locator(SIMQ+'[data-act=ping]')
    if await pb.count(): await TAP(pb.first); await pg.wait_for_timeout(800)
    async with pg.expect_response(lambda r:'/api/sims/switching/submit' in r.url) as rr:
        await TAP(pg.locator(SIMQ+'[data-act=submit]').first)
    r=await (await rr.value).json(); await pg.wait_for_timeout(1500)
    stt=await pg.get_attribute('.pritem[data-key="switching:sw1"]','data-state')
    pi,sr=rows(uid,sid,'switching:sw1')
    check(isinstance(r.get('score'),(int,float)) and r['practical']['recorded'] and stt==('passed' if r['score']>=0.7*r['max'] else 'done') and pi.startswith('1:') and sr.startswith('1:'),f'{tag}: 5. switching sw1 (ping, submit) {r.get("score")}/{r.get("max")} recorded, card {stt}, rows {pi} / {sr}')
    await close_ws(pg,touch); await finish()
    print(f'== [{tag}] 5. week 5 crimp c1')
    sid=await start('w5'); await part_of('crimp:c1'); await open_ws(pg,'crimp:c1','run',touch)
    ev=await embedded_view(pg); check(not ev['free'] and ev['lists']==0 and not ev['links'],f'{tag}: crimp c1 embedded {ev}')
    B=['wo','o','wg','bl','wb','g','wbr','br']
    async def act(sel): await TAP(pg.locator(SIMQ+sel).first); await pg.wait_for_timeout(120)
    for end in (0,1):
        await act(f'[data-act=end][data-i="{end}"]')
        await act('[data-act=std][data-v=T568B]'); await act('[data-act=next]')
        await act('[data-act=strip]'); await act('[data-act=next]')
        for i,c in enumerate(B): await act(f'[data-act=wire][data-code={c}]'); await act(f'[data-act=slot][data-i="{i}"]')
        await act('[data-act=next]'); await act('[data-act=cut]'); await act('[data-act=next]')
        await act('[data-act=push]'); await act('[data-act=next]'); await act('[data-act=crimp]'); await pg.wait_for_timeout(1500)
    await act('[data-act=test]'); await pg.wait_for_timeout(500)
    async with pg.expect_response(lambda r:'/api/sims/crimp/submit' in r.url) as rr:
        await act('[data-act=submit]')
    r=await (await rr.value).json()
    await pg.wait_for_selector('.pritem[data-key="crimp:c1"][data-state=passed]',timeout=8000)
    pi,sr=rows(uid,sid,'crimp:c1')
    check(r['score']==r['max'] and r['practical']['recorded'] and pi.startswith('1:') and sr.startswith('1:'),f'{tag}: 5. crimp c1 (both ends T568B, wires, cut, push, crimp, test, submit) {r["score"]}/{r["max"]} recorded; rows {pi} / {sr}')
    check(await hscroll(pg)<=0,f'{tag}: 12. no horizontal overflow with crimp open')
    await pg.screenshot(path=f'{OUT}/p21_{tag}_crimp.png')
    await close_ws(pg,touch); await finish()
    check(not pg._errs,f'{tag}: no page errors {pg._errs[:2]}')
    await S.close()

async def learn_w1(ctx):
    await req(ctx,'post','/api/lessons/w1/quiz',{'kind':'pre','answers':[0]*K['pre']})
    for s in K['sections']: await req(ctx,'post','/api/lessons/w1/visit',{'section':s})
    for c in K['checks']: await req(ctx,'post','/api/lessons/w1/check',c)
    return await req(ctx,'post','/api/lessons/w1/quiz',{'kind':'post','answers':K['postRight']})

async def lock_flow(b,T):
    print('== 13. the lesson lock with the embedded lab (a class with the default sequential rules)')
    s,cls=await req(T,'post','/api/teacher/classes',{'name':'ปวช.2/21 ห้องจำลองฝัง'}); cid=cls['id']
    L,lId=await make_student(b,T,cid,'นักเรียน ล็อก ฝัง',360,740,True); pg=await page(L)
    s1,j1=await req(L,'get','/api/practical/w2/mission/topology/t2'); s0,j0=await req(L,'get','/api/practical/w1/mission/topology/t8')
    check(s1==403 and s0==200 and j0.get('sim',{}).get('missions',[{}])[0].get('id')=='t8' and len(j0['sim']['missions'])==1,f'13. the mission endpoint: locked week 2 -> {s1}; open week 1 -> {s0} with exactly that mission')
    s,j=await req(L,'get','/api/practical/w1/mission/subnet/s1'); check(s==404 and j.get('error')=='not_in_week',f'a mission of another week through week 1 -> {s} {j.get("error")}')
    await pg.goto(BASE+'/#/lesson/w2/lab'); await pg.wait_for_selector('.lockpanel')
    check(await pg.locator('#prPage, .prOpenSim, #prWs').count()==0 and 'ต้องผ่านสัปดาห์ที่ 1 ก่อน' in await pg.inner_text('.lockmsg'),'13. #/lesson/w2/lab shows only the lock (no mission button)')
    s,j=await learn_w1(L); check(s==200 and j.get('passed'),'week 1 lessons and post-test done')
    # the week 1 practical: x15 really in the embedded workspace, the rest written as the server records it
    await pg.goto(BASE+'/#/lesson/w1/lab'); await pg.wait_for_selector('#prStart'); await pg.locator('#prStart').tap(); await pg.wait_for_selector('#prClock')
    sid=sql(f"SELECT id FROM practical_sessions WHERE user_id={lId} AND status='running'")
    await pg.locator('.prtabs .prpart[data-part=trouble]').tap(); await open_ws(pg,'troubleshoot:x15','run',True)
    r=await solve_x15(pg); check((r.get('practical') or {}).get('recorded') is True,'13. x15 done in the embedded workspace of week 1 (recorded)')
    await close_ws(pg,True)
    sql("INSERT INTO practical_items(session_id,item,part,score,max,solved) VALUES "+','.join(f"({sid},'{i['key']}','{i['part']}',{i['max']},{i['max']},true)" for i in K['items'] if i['key']!='troubleshoot:x15'))
    await pg.locator('#prSubmit').tap(); await pg.locator('#prSubmitYes').tap(); await pg.wait_for_selector('#prResult[data-passed=true]')
    s,pth=await req(L,'get','/api/path')
    check(pth['weeks'][0]['status']=='completed' and pth['weeks'][1]['open'],'13. week 1 completed with the practical passed: week 2 open')
    s2,j2=await req(L,'get','/api/practical/w2/mission/topology/t2')
    check(s2==200 and j2['sim']['missions'][0]['id']=='t2','13. the week 2 mission endpoint now answers')
    await pg.goto(BASE+'/#/learn'); await pg.reload(); await pg.wait_for_selector('.lpath .lpstep')
    await pg.goto(BASE+'/#/lesson/w2/lab'); await pg.wait_for_selector('#prStart')
    check(await pg.locator('.lockpanel').count()==0 and await pg.locator('.prOpenSim[data-key="topology:t2"]').count()==1,'13. #/lesson/w2/lab now offers its missions')
    await pg.locator('#prStart').tap(); await pg.wait_for_selector('#prClock'); await open_ws(pg,'topology:t2','run',True)
    check(pg.url.endswith('#/lesson/w2/lab'),'13. a week 2 mission opens embedded once the week is open')
    await close_ws(pg,True)
    check(not pg._errs,f'no page errors {pg._errs[:2]}')
    await L.close()

UNIT3=json.loads(subprocess.check_output(['node','-e',"const {LESSONS}=require('./server/lessons');console.log(JSON.stringify([...LESSONS.values()].filter(l=>l.unit===3).sort((a,b)=>a.week-b.week)[0].id))"],cwd=ROOT,stderr=subprocess.DEVNULL))
OLD_TOOL=re.compile(r'^#/(sims?\b|sim/|practice)')
async def standalone_flow(b,T,cid):
    print('== 14. the standalone simulators are unchanged for teachers (3.5: staff only)')
    for tag,w,h,touch in [VIEWS[0],VIEWS[2]]:
        C=await new_ctx(b,w,h,touch); await C.add_cookies(await T.cookies()); pg=await page(C)
        await pg.goto(BASE+'/#/sims'); await pg.wait_for_selector('.simcard')
        check(await pg.locator('.simcard').count()>=10 and await pg.locator('.nls-embedded').count()==0,f'teacher {tag}: 14. #/sims lists all the simulators')
        await pg.goto(BASE+'/#/sim/topology'); await pg.wait_for_selector('.nls-topology-mbtn',timeout=15000); await pg.wait_for_timeout(600)
        d=await pg.evaluate("({m:document.querySelectorAll('.nls-topology-mbtn').length,free:/โหมดอิสระ|อิสระ/.test(document.querySelector('.simroot').innerText),emb:document.querySelectorAll('.nls-embedded').length})")
        check(d['m']>=19 and d['free'] and d['emb']==0,f'teacher {tag}: 14. #/sim/topology: the full mission list and free mode {d}')
        check(await hscroll(pg)<=0,f'teacher {tag}: no horizontal overflow on #/sim/topology')
        await pg.goto(BASE+'/#/sim/troubleshoot'); await pg.wait_for_selector('.nls-troubleshoot-mbtn',timeout=15000)
        check(await pg.locator('.nls-troubleshoot-mbtn').count()>=15 and await pg.locator('.nls-embedded').count()==0,f'teacher {tag}: 14. #/sim/troubleshoot: the full mission list')
        if tag=='desktop':
            await pg.goto(BASE+'/#/sim/troubleshoot/x15'); await pg.wait_for_timeout(300)
            check(pg.url.endswith('#/sim/troubleshoot/x15'),'teacher: 14. a deep link #/sim/troubleshoot/x15 stays on the standalone page')
            r=await solve_x15(pg,'')
            check(r.get('score')==10 and not (r.get('practical') or {}).get('recorded'),f'teacher: 14. a mission on the standalone page is graded ({r.get("score")}/10) and not recorded as a practical')
            await pg.goto(BASE+'/#/practice'); await pg.wait_for_selector('.fchip')
            check(pg.url.endswith('#/practice'),'teacher: #/practice still opens the practice page')
        check(not pg._errs,f'teacher {tag}: no page errors {pg._errs[:2]}')
        await C.close()

async def menus_flow(b,T,cid):
    """3.5: the simulator menu and the practice menu are gone for students and guests (links and redirects)"""
    print('== 3.5. no simulator / practice menu for guests and students; old links redirect')
    REDIR=[('#/sims','#/learn'),('#/sim/topology','#/learn'),('#/sim/topology/t8','#/lesson/w1/lab'),('#/sim/topology/t9','#/lesson/w18/lab'),
           ('#/practice','#/learn'),('#/practice/u3',f'#/lesson/{UNIT3}/content')]
    for who in ['guest','student']:
        for tag,w,h,touch in [VIEWS[0],VIEWS[2]]:
            if who=='guest': C=await new_ctx(b,w,h,touch)
            else: C,_=await make_student(b,T,cid,f'นักเรียน เมนู {tag}',w,h,touch)
            pg=await page(C)
            await pg.goto(BASE+'/#/'); await pg.wait_for_selector('#side nav'); await pg.wait_for_timeout(700)
            side=await pg.eval_on_selector_all('#side a[href]','e=>e.map(a=>a.getAttribute("href"))')
            bnav=await pg.eval_on_selector_all('#bnav a[href]','e=>e.map(a=>a.getAttribute("href"))')
            dash=await pg.eval_on_selector_all('#app a[href]','e=>e.map(a=>a.getAttribute("href"))')
            stxt=await pg.inner_text('#side nav')
            bad_=[x for x in side+bnav+dash if OLD_TOOL.match(x)]
            check(not bad_ and 'ห้องปฏิบัติการจำลอง' not in stxt and 'ฝึกทำข้อสอบ' not in stxt,f'{who} {tag}: no sidebar / bottom-nav / dashboard link to #/sims or #/practice {bad_[:3]}')
            tools=[t.strip().split('\n')[0] for t in await pg.locator('#app .tools .tool').all_inner_texts()]
            check(tools==(['การสอบ'] if who=='student' else []),f'{who} {tag}: dashboard tool cards: {tools}')
            if touch:
                bn=[x.strip() for x in await pg.locator('#bnav a, #bnav button').all_inner_texts()]
                want=['หน้าแรก','บทเรียน','การสอบ' if who=='student' else 'คำศัพท์','ผลการเรียน','เมนู']
                check(bn==want,f'{who} {tag}: bottom nav {bn}')
            # the first-visit tour on the dashboard (also opened from "วิธีใช้งาน") must not send them to a removed menu
            await pg.evaluate("localStorage.removeItem('netlab-onboard')"); await pg.goto(BASE+'/#/help'); await pg.wait_for_selector('.onboard')
            hrefs=[]
            for i in range(4):
                hrefs+=await pg.eval_on_selector_all('.onboard a[href]','e=>e.map(a=>a.getAttribute("href"))')
                nx=pg.locator('.onboard button:has-text("ถัดไป")')
                if await nx.count(): await nx.click()
            await pg.evaluate("localStorage.setItem('netlab-onboard','done')")
            bad_=[x for x in hrefs if OLD_TOOL.match(x)]
            check(not bad_,f'{who} {tag}: the onboarding tour links no removed menu {bad_}')
            for old,want in REDIR:
                await pg.goto(BASE+'/#/learn'); await pg.wait_for_selector('#app > *')
                await pg.goto(BASE+'/'+old)
                try: await pg.wait_for_function(f"location.hash==={json.dumps(want)}",timeout=10000); ok(f'{who} {tag}: {old} -> {want}')
                except Exception: bad(f'{who} {tag}: {old} -> {await pg.evaluate("location.hash")} (expected {want})')
            await pg.wait_for_timeout(300)
            check(await pg.locator('.simcard, .fchip, .nls-topology-mbtn').count()==0,f'{who} {tag}: no simulator list or practice page shown after the redirects')
            check(not pg._errs,f'{who} {tag}: no page errors {pg._errs[:2]}')
            await C.close()
    # teachers keep the standalone pages
    C=await new_ctx(b,1280,800,False); await C.add_cookies(await T.cookies()); pg=await page(C)
    for rt,sel in [('#/sims','.simcard'),('#/practice','.fchip'),('#/sim/topology/t8','.nls-topology-mbtn')]:
        await pg.goto(BASE+'/'+rt); await pg.wait_for_selector(sel,timeout=15000); await pg.wait_for_timeout(300)
        check((await pg.evaluate('location.hash'))==rt,f'teacher: {rt} opens (not redirected)')
    await C.close()

async def extras_flow(b,T,cid):
    """3.5: the optional extras of a week (curriculum `more`) open in the same workspace (data-mode=extra), never counted"""
    print('== 3.5. week 18 extras: the course project t9 opens embedded (extra), its submit is not a practical item')
    S,uid=await make_student(b,T,cid,'นักเรียน กิจกรรมเพิ่มเติม',1280,800,False); pg=await page(S)
    await pg.goto(BASE+'/#/lesson/w18/lab'); await pg.wait_for_selector('#prExtra .prextraitem[data-key="topology:t9"]')
    cap=pg.locator('#prExtra .prextraitem.capstone[data-key="topology:t9"][data-kind=mission]')
    check(await cap.count()==1 and 'โครงงานปิดท้ายรายวิชา' in await cap.locator('.prcap').inner_text(),'t9 is listed under กิจกรรมเพิ่มเติม as "โครงงานปิดท้ายรายวิชา"')
    check(await pg.locator('#prPlan .prplanitem[data-key="topology:t9"]').count()==0,'t9 is not an activity of the practical session')
    await pg.wait_for_function("(document.querySelector('.prextrabest[data-key=\"topology:t9\"]')||{}).textContent==='ยังไม่เคยส่ง'",timeout=8000); ok('best score before any submit: "ยังไม่เคยส่ง"')
    await pg.click('#prStart'); await pg.wait_for_selector('#prClock')
    sid=sql(f"SELECT id FROM practical_sessions WHERE user_id={uid} AND status='running'")
    await pg.evaluate("window.__hs=[]")
    await pg.click('#prExtra .prOpenSim[data-key="topology:t9"]')
    await pg.wait_for_selector('#prWs[data-key="topology:t9"][data-mode=extra] #prWsSim .nls-embedded',timeout=20000); await pg.wait_for_timeout(800)
    ev=await embedded_view(pg)
    check(pg.url.endswith('#/lesson/w18/lab') and await pg.evaluate("window.__hs")==[] and not ev['free'] and ev['lists']==0 and not ev['links'],f't9 opens embedded on the week 18 page (data-mode=extra), no list, no free mode {ev}')
    check('ไม่นับคะแนนฝึกปฏิบัติ' in await pg.inner_text('#prWs .prwsmode') and 'ส่งงานโครงงาน' in await pg.inner_text('#prWsSim'),'the workspace says the extra does not count; the project submit button is there')
    left,_=await server_left(S); c=secs(await pg.inner_text('#prWsClock'))
    check(c is not None and abs(c-left)<=3,f'while the week 18 practical runs, the extra shows its time left ({c}s, server {left:.0f}s)')
    async with pg.expect_response(lambda r:'/api/sims/topology/submit' in r.url) as rr:
        await pg.locator('#prWsSim [data-m="submit"]').first.click()
    r=await (await rr.value).json(); await pg.wait_for_timeout(1000)
    n=sql(f"SELECT count(*) FROM practical_items WHERE session_id={sid} AND item='topology:t9'")
    sr=sql(f"SELECT count(*) FROM sim_results WHERE user_id={uid} AND sim='topology' AND mission='t9'")
    check(isinstance(r.get('score'),(int,float)) and not (r.get('practical') or {}).get('recorded') and n=='0' and sr=='1',f't9 submitted with its own button ({r.get("score")}/{r.get("max")}): not recorded in the session (practical_items {n}), best kept in sim_results ({sr})')
    note=await pg.inner_text('#prWsNote'); check('ไม่นับคะแนนฝึกปฏิบัติ' in note,f'the note says it does not count ({note[:60]!r})')
    await pg.click('#prWsClose'); await pg.wait_for_selector('#prWs',state='detached')
    await pg.reload(); await pg.wait_for_selector('#prClock')
    await pg.wait_for_function("/คะแนนดีที่สุด/.test((document.querySelector('.prextrabest[data-key=\"topology:t9\"]')||{}).textContent||'')",timeout=8000)
    ok('after the submit the extra shows its best score: '+await pg.inner_text('.prextrabest[data-key="topology:t9"]'))
    st=(await req(S,'get','/api/practical/w18'))[1]
    keys=[i['key'] for p in st['running']['result']['parts'] for i in p['items']]
    check('topology:t9' not in keys,'the running result has no t9 item')
    s,j=await req(S,'get','/api/practical/w18/mission/topology/t9'); check(s==200 and j.get('extra') is True,f'the mission endpoint accepts the extra ({s}, extra={j.get("extra")})')
    s,j=await req(S,'get','/api/practical/w1/mission/topology/t9'); check(s==404,f'... but not through another week ({s} {j.get("error")})')
    check(not pg._errs,f'no page errors {pg._errs[:2]}')
    await S.close()
    G=await new_ctx(b,360,740,True); gp=await page(G)
    await gp.goto(BASE+'/#/lesson/w18/lab'); await gp.wait_for_selector('#prExtra .prOpenSim[data-key="topology:t9"]'); await gp.locator('#prExtra .prOpenSim[data-key="topology:t9"]').tap()
    await gp.wait_for_selector('#prWs[data-key="topology:t9"][data-mode=extra] #prWsSim .nls-embedded',timeout=20000); await gp.wait_for_timeout(600)
    check(await hscroll(gp)<=0,'guest 360: t9 opens embedded (extra) with no horizontal overflow')
    check(not gp._errs,f'guest: no page errors {gp._errs[:2]}')
    await G.close()

async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        T=await new_ctx(b,1280,800,False); await login(T,'kru4','Teach1234')
        s,cl=await req(T,'get','/api/teacher/classes'); cls=cl.get('classes') if isinstance(cl,dict) else cl
        cid=[c for c in cls if c.get('name')=='ปวช.2/4'][0]['id']   # the fixture class: all weeks open
        s,tp=await req(T,'get','/api/sims/topology'); titles={m['id']:m['title'] for m in tp['missions']}
        only=os.environ.get('P21_ONLY','')
        for tag,w,h,touch in VIEWS:
            if not only or tag in only: await student_flow(b,T,cid,tag,w,h,touch,titles)
        if not only or 'weeks' in only: await weeks_flow(b,T,cid,'desktop',1280,800,False)
        if not only or 'lock' in only: await lock_flow(b,T)
        if not only or 'standalone' in only: await standalone_flow(b,T,cid)
        if not only or 'menus' in only: await menus_flow(b,T,cid)
        if not only or 'extras' in only: await extras_flow(b,T,cid)
        await b.close()
    print(f'\npart21: {len(issues)} issue(s)'); [print('  -',i) for i in issues]
    sys.exit(1 if issues else 0)
asyncio.run(main())
