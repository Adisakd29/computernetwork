# Part 9 (2.8): supplementary sections and their labs, skills panel, rubric-reviewed work (x14 random faults) end to end:
# student opens x14 (signed random scenario), submits a report -> teacher reviews it in "ตรวจงานโครงงาน" -> student sees
# the feedback in the API; t9 capstone opens; teacher skills matrix renders. Phone (390 px, touch) and desktop.
# usage: python3 tests/e2e/part9.py <out-dir>
import asyncio, sys, json, os, subprocess
from playwright.async_api import async_playwright
OUT=sys.argv[1]; BASE=os.environ.get('E2E_BASE','http://127.0.0.1:3990')
DB=os.environ.get('E2E_DATABASE_URL','postgres://postgres@127.0.0.1:5433/netlab_e2e')
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
issues=[]
def bad(m): issues.append(m); print('  ✗',m)
def ok(m): print('  ✓',m)
def check(c,m): ok(m) if c else bad(m)
def sql(q): return subprocess.check_output(['psql',DB,'-tAc',q]).decode().strip()
async def login(ctx,u,p):
    r=await ctx.request.post(BASE+'/api/auth/login',data={'username':u,'password':p},headers={'X-NetLab':'1'}); assert r.ok, await r.text()
EXTRA=json.loads(subprocess.check_output(['node','-e',"""
const fs=require('fs');const o={};for(let w=1;w<=18;w++){const f='./content/lessons/extra/w'+w+'.js';if(fs.existsSync(f))o['w'+w]=require(f).map(s=>({id:s.id,d:s.blocks.filter(b=>b.type==='diagram').length,w:s.blocks.filter(b=>b.type==='widget').length}));}
console.log(JSON.stringify(o))"""],cwd=ROOT))

async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for vw,vh,mob in [(390,844,True),(1366,860,False)]:
            print(f'== supplementary sections at {vw}px')
            C=await b.new_context(viewport={'width':vw,'height':vh},has_touch=mob,is_mobile=mob); pg=await C.new_page(); E=[]; pg.on('pageerror',lambda e:E.append(str(e)))
            nsec=0; fails=[]
            for w,secs in EXTRA.items():
                for s in secs:
                    await pg.goto(BASE+f'/#/lesson/{w}/content/{s["id"]}'); await pg.wait_for_selector('.xdivider',timeout=10000)
                    sec=pg.locator(f'.secend[data-sec="{s["id"]}"]')
                    await pg.evaluate("window.scrollTo(0,document.body.scrollHeight)"); await pg.wait_for_timeout(250)
                    await pg.evaluate("document.querySelectorAll('.dgmsvg').forEach(d=>d._put&&d._put())"); await pg.wait_for_timeout(100)
                    txt=await pg.inner_text('main') if await pg.locator('main').count() else await pg.inner_text('body')
                    if 'โหลดสื่อนี้ไม่สำเร็จ' in txt or 'แสดงภาพนี้ไม่ได้' in txt: fails.append(f'{w}/{s["id"]} figure failed')
                    ov=await pg.evaluate('document.documentElement.scrollWidth-innerWidth')
                    if ov>0: fails.append(f'{w}/{s["id"]} overflow {ov}px')
                    nsec+=1
            check(not fails,f'{nsec} supplementary sections render every figure/lab without errors or horizontal scroll '+'; '.join(fails[:4]))
            await pg.goto(BASE+'/#/lesson/w2/content/x2'); await pg.wait_for_selector('.xdivider')
            check(await pg.locator('.toc .xbadge, nav .xbadge, .xbadge').count()>=3,'supplementary sections carry the "เสริม" badge')
            prog=await pg.inner_text('body'); check('เสริม' in prog,'progress text separates core and supplementary sections')
            await pg.locator('.xdivider').first.screenshot(path=f'{OUT}/p9_divider_{vw}.png')
            await pg.screenshot(path=f'{OUT}/p9_w2x2_{vw}.png')
            check(not E,f'no JS errors at {vw}px '+'; '.join(E[:2])); await C.close()

        print('== interactive labs respond to input (signal, mux, error detection, crypto)')
        C=await b.new_context(viewport={'width':1366,'height':900}); pg=await C.new_page(); E=[]; pg.on('pageerror',lambda e:E.append(str(e)))
        for w,x in [('w2','x2'),('w2','x3'),('w4','x3'),('w4','x4'),('w16','x1'),('w1','x2'),('w10','x2')]:
            await pg.goto(BASE+f'/#/lesson/{w}/content/{x}'); await pg.wait_for_selector('.xdivider'); await pg.wait_for_timeout(300)
            f=pg.locator('figure.wdg').last; await f.scroll_into_view_if_needed()
            changed=False; used=[]
            ctls=f.locator('input[type=range], select, input[type=text], textarea, button')
            n=await ctls.count()
            if n==0: bad(f'{w}/{x}: lab has no controls'); continue
            for i in range(min(n,6)):
                ctl=ctls.nth(i)
                if not await ctl.is_visible() or await ctl.is_disabled(): continue
                before=await f.inner_html()
                tag=await ctl.evaluate('e=>e.tagName+(e.type?":"+e.type:"")'); used.append(tag)
                if 'range' in tag: await ctl.evaluate("e=>{const v=+e.value===+e.max?+e.min:+e.max;e.value=String(v);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))}")
                elif tag.startswith('SELECT'): await ctl.evaluate("e=>{e.selectedIndex=(e.selectedIndex+1)%e.options.length;e.dispatchEvent(new Event('change',{bubbles:true}))}")
                elif tag.startswith('INPUT') or tag.startswith('TEXTAREA'): await ctl.fill('NetLab 2.8'); await ctl.dispatch_event('input'); await ctl.dispatch_event('change')
                else: await ctl.click()
                await pg.wait_for_timeout(300)
                if await f.inner_html()!=before: changed=True; break
            check(changed,f'{w}/{x}: lab output changes when a control is used (tried {",".join(used)})')
        check(not E,'no JS errors in labs '+'; '.join(E[:2])); await C.close()

        print('== x14 random faults: student submits a report on a phone')
        S=await b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True); await login(S,'s1','Stud1234'); pg=await S.new_page(); E=[]; pg.on('pageerror',lambda e:E.append(str(e)))
        await pg.goto(BASE+'/#/sim/troubleshoot'); await pg.wait_for_selector('.nls-troubleshoot-mbtn',timeout=15000)
        await pg.locator('.nls-troubleshoot-mbtn',has_text='สุ่มเหตุขัดข้อง').first.tap(); await pg.wait_for_selector('.nls-troubleshoot-genbar',timeout=15000)   # 3.1: x15 is listed after x14
        check(True,'x14 opens with a server-generated scenario')
        code=await pg.inner_text('.nls-troubleshoot-genbar')
        ov=await pg.evaluate('document.documentElement.scrollWidth-innerWidth'); check(ov<=0,'x14 has no horizontal page scroll at 390px')
        await pg.screenshot(path=f'{OUT}/p9_x14_390.png')
        # submit through the same API the page uses (the page keeps the signed token in localStorage)
        d=await (await S.request.post(BASE+'/api/sims/troubleshoot/new',data={'mission':'x14'},headers={'X-NetLab':'1'})).json()
        check(bool(d.get('token')) and 'topo' in d.get('problem',{}),'the server issues a signed random scenario for x14')
        if d.get('token'):
            r=await S.request.post(BASE+'/api/sims/troubleshoot/submit',data={'mission':'x14','token':d['token'],'payload':{'topo':d['problem']['topo'],'actions':[],'rpt':{'causes':[]},'report':'อาการ: ping ไม่ผ่าน\nสาเหตุ: ทดสอบ e2e'}},headers={'X-NetLab':'1'})
            j=await r.json(); check(r.ok and j.get('submission') and j['max']==20 and j.get('rubric'),'x14 submission is graded with a rubric and stored for review')
        check(not E,'no JS errors in x14 '+'; '.join(E[:2]))

        print('== skills panel')
        await pg.goto(BASE+'/#/me'); await pg.wait_for_selector('.skillgrid',timeout=10000)
        check(await pg.locator('.skillgrid .skill').count()==10,'progress page shows 10 skills')
        txt=await pg.inner_text('.skillgrid'); check('วิเคราะห์และแก้ปัญหา' in txt,'troubleshooting skill is listed in Thai')
        ov=await pg.evaluate('document.documentElement.scrollWidth-innerWidth'); check(ov<=0,'skills panel has no horizontal scroll at 390px')
        await pg.locator('.skillgrid').screenshot(path=f'{OUT}/p9_skills_390.png')

        print('== teacher reviews the report')
        T=await b.new_context(viewport={'width':1280,'height':900}); await login(T,'kru4','Teach1234'); tp=await T.new_page(); TE=[]; tp.on('pageerror',lambda e:TE.append(str(e)))
        await tp.goto(BASE+'/teacher.html'); await tp.wait_for_selector('.side'); await tp.locator('.side .navbtn').nth(1).click(); await tp.wait_for_selector('.tabs')
        await tp.locator('.tabs button',has_text='ตรวจงานโครงงาน').click(); await tp.wait_for_selector('text=ส่งแล้ว')
        btn=tp.locator('button',has_text='สุ่มเหตุขัดข้อง'); await btn.first.click(); await tp.wait_for_selector('text=รายงานของนักเรียน')
        check('ทดสอบ e2e' in await tp.inner_text('body'),'teacher sees the student report and the automatic rubric')
        check('null' not in await tp.inner_text('.card >> nth=0'),'no stray "null" text')
        inp=tp.locator('input[type=number]'); await inp.nth(0).fill('4'); await inp.nth(1).fill('2.5')
        await tp.locator('textarea').first.fill('ระบุหลักฐานชัดเจน'); await tp.locator('button',has_text='บันทึกการตรวจ').first.click(); await tp.wait_for_selector('text=บันทึกแล้ว')
        rv=sql("SELECT teacher_scores::text||'|'||teacher_comment FROM sim_submissions WHERE mission='x14' ORDER BY id DESC LIMIT 1")
        check('"quality": 4' in rv and '"comm": 2.5' in rv and 'ระบุหลักฐานชัดเจน' in rv,'teacher scores and comment are saved on the server')
        await inp.nth(0).fill('99'); await tp.locator('button',has_text='บันทึกการตรวจ').first.click(); await tp.wait_for_timeout(500)
        check('ต้องอยู่ระหว่าง' in await tp.inner_text('body'),'out-of-range score is refused with a Thai message')
        await tp.screenshot(path=f'{OUT}/p9_teacher_review.png',full_page=True)
        mine=await (await S.request.get(BASE+'/api/sims/troubleshoot/review/x14')).json()
        check((mine.get('submission') or {}).get('teacher_comment')=='ระบุหลักฐานชัดเจน','the student receives the teacher feedback')
        await tp.locator('.tabs button',has_text='วิเคราะห์ผล').click(); await tp.wait_for_timeout(1500)
        check('ทักษะ' in await tp.inner_text('body'),'analytics tab shows the class skill matrix')
        check(not TE,'no JS errors on teacher pages '+'; '.join(TE[:2]))

        print('== t9 capstone opens on a phone and desktop')
        for vw,vh,mob in [(390,844,True),(1366,860,False)]:
            C=await b.new_context(viewport={'width':vw,'height':vh},has_touch=mob,is_mobile=mob); await login(C,'s2','Stud1234'); q=await C.new_page(); QE=[]; q.on('pageerror',lambda e:QE.append(str(e)))
            await q.goto(BASE+'/#/sim/topology'); await q.wait_for_selector('.nls-topology-mbtn',timeout=15000)
            m=q.locator('.nls-topology-mbtn',has_text='โครงงานปิดท้าย'); await (m.tap() if mob else m.click()); await q.wait_for_timeout(800)
            check('ส่งงานโครงงาน' in await q.inner_text('body'),f't9 capstone opens with its submit button at {vw}px')
            ov=await q.evaluate('document.documentElement.scrollWidth-innerWidth'); check(ov<=0,f't9 has no horizontal page scroll at {vw}px')
            await q.screenshot(path=f'{OUT}/p9_t9_{vw}.png'); check(not QE,f'no JS errors in t9 at {vw}px '+'; '.join(QE[:2])); await C.close()
        await b.close()
    print(f'\npart9: {len(issues)} issue(s)'); sys.exit(1 if issues else 0)
asyncio.run(main())
