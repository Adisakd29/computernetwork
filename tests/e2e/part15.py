# Part 15 (phase 6 fixes, UI + performance): portfolio print view, practice "passed" rule, teacher portfolio table, lesson rail on phones,
# contrast / keyboard-scrollable regions (axe), week-lab Command Prompt on phones, portfolio error state, naming, lazy figure files.
# usage: E2E_BASE=http://127.0.0.1:3990 python3 tests/e2e/part15.py <out-dir>   (needs the tests/e2e/setup.js fixture: kru4, s1, s2)
import asyncio, sys, os, subprocess, json
from playwright.async_api import async_playwright
OUT=sys.argv[1] if len(sys.argv)>1 else '/tmp/netlab-e2e'; os.makedirs(OUT,exist_ok=True)
BASE=os.environ.get('E2E_BASE','http://127.0.0.1:3990')
DB=os.environ.get('E2E_DATABASE_URL','postgres://postgres@127.0.0.1:5433/netlab_e2e')
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AXE_PATH=os.path.join(ROOT,'node_modules','axe-core','axe.min.js')
FIGRE=('/js/figs-','/js/diagrams','/js/widgets')
issues=[]
def bad(m): issues.append(m); print('  ✗',m)
def ok(m): print('  ✓',m)
def check(c,m): ok(m) if c else bad(m)
def sql(q): return subprocess.check_output(['psql',DB,'-tAqc',q]).decode().strip()
async def login(ctx,u,p):
    r=await ctx.request.post(BASE+'/api/auth/login',data={'username':u,'password':p},headers={'X-NetLab':'1'}); assert r.ok, await r.text()
AXE_RUN="async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return r.violations.map(v=>v.id+'('+v.impact+'):'+v.nodes.length+' '+v.nodes.slice(0,2).map(n=>n.target.join(' ')).join(' | '))}"
LONG='\n'.join(f'บรรทัดที่ {i}: วาง AP ห่างผนังคอนกรีต วัดสัญญาณ RSSI แล้วจดผล' for i in range(1,31))+'\nบรรทัดสุดท้าย: สรุปว่าช่อง 1 6 11 ไม่ทับกัน'

async def main():
    s1=sql("SELECT id FROM users WHERE username='s1'"); s2=sql("SELECT id FROM users WHERE username='s2'")
    # s2: three Guided Lab missions of week 4 at 7/10 (passed), 10/10 (full marks) and 6/10 (not passed)
    sql(f"INSERT INTO sim_results(user_id,sim,mission,best,max,last,attempts) VALUES({s2},'switching','sw1',7,10,7,1),({s2},'switching','sw2',10,10,10,1),({s2},'switching','sw7',6,10,6,1) ON CONFLICT DO NOTHING")
    async with async_playwright() as p:
        b=await p.chromium.launch()

        print('== lazy figure files')
        G=await b.new_context(viewport={'width':1280,'height':900},service_workers='block'); gp=await G.new_page(); req=[]; E=[]
        gp.on('request',lambda r:req.append(r.url)); gp.on('pageerror',lambda e:E.append(str(e)))
        await gp.goto(BASE+'/#/',wait_until='networkidle'); await gp.wait_for_selector('.hero')
        figreq=[u for u in req if any(k in u for k in FIGRE)]
        check(not figreq,f'#/ does not request the 14 figure files ({len(figreq)} requested)')
        check(await gp.evaluate("!window.NL_DIAGRAMS&&!window.NL_WIDGETS"),'no figure registry on the dashboard')
        html=(await (await G.request.get(BASE+'/')).text())
        check(not any(f'js/{n}' in html for n in ['figs-a.js','diagrams.js','widgets.js']),'index.html has no figure <script> tags')
        sw=await (await G.request.get(BASE+'/sw.js')).text()
        check(all(f'/js/{n}.js' in sw for n in ['diagrams','diagrams2','widgets','widgets2']+[f'figs-{c}' for c in 'abcdefghij']),'service worker still precaches all 14 figure files (offline lessons keep their figures)')
        figs_bad=[]; nd=nw=0
        for w in ['w1','w3','w5','w8','w13','w16']:
            L=await (await G.request.get(BASE+f'/api/lessons/{w}')).json()
            want_d=sum(1 for s in L['sections'] for x in s['blocks'] if x['type']=='diagram'); want_w=sum(1 for s in L['sections'] for x in s['blocks'] if x['type']=='widget')
            req.clear(); await gp.goto(BASE+f'/#/lesson/{w}/content'); await gp.wait_for_selector('.lsec'); await gp.wait_for_timeout(300)
            await gp.evaluate("window.dispatchEvent(new Event('beforeprint'))")
            r=await gp.evaluate("""()=>({d:document.querySelectorAll('figure.dgm .dgmsvg svg, figure.dgm .dgmsvg .nlfj-dual').length, dn:document.querySelectorAll('figure.dgm').length,
              broken:[...document.querySelectorAll('figure.dgm')].filter(f=>f.textContent.includes('แสดงภาพนี้ไม่ได้')).length,
              wn:document.querySelectorAll('figure.wdg').length, wfail:[...document.querySelectorAll('figure.wdg')].filter(f=>f.textContent.includes('โหลดสื่อนี้ไม่สำเร็จ')||f.children.length<2||!f.children[1].children.length).length})""")
            nd+=r['dn']; nw+=r['wn']
            if r['dn']!=want_d or r['d']<want_d or r['broken'] or r['wn']!=want_w or r['wfail']: figs_bad.append(f"{w} {r} want d{want_d} w{want_w}")
        check(not figs_bad and nd>20,f'lessons with figures render every diagram ({nd}) and widget ({nw}) after the lazy load '+'; '.join(figs_bad[:3]))
        await gp.screenshot(path=f'{OUT}/p15_lesson_w16.png')
        # practice: a label question still shows its picture with numbered markers
        await gp.goto(BASE+'/#/practice'); await gp.wait_for_selector('.fchip')
        await gp.locator('.chips .fchip',has_text='ติดป้ายชื่อภาพ').click(); await gp.locator('button.btn.big',has_text='เริ่มฝึก').click()
        await gp.wait_for_selector('.bq-label')
        r=await gp.evaluate("({svg:!!document.querySelector('.bq-label .dgmsvg svg'),marks:document.querySelectorAll('.bq-label .lblmark').length})")
        check(r['svg'] and r['marks']>=2,f'practice label question shows its diagram with markers {r}')
        await gp.screenshot(path=f'{OUT}/p15_practice_label.png')
        check(not E,'no page errors (lazy figures) '+'; '.join(E[:2])); await G.close()

        print('== week-lab Command Prompt on a phone (w8)')
        P=await b.new_context(viewport={'width':360,'height':740},has_touch=True,is_mobile=True); await login(P,'s2','Stud1234'); pp=await P.new_page(); E=[]; pp.on('pageerror',lambda e:E.append(str(e)))
        await pp.goto(BASE+'/#/lesson/w8/lab'); await pp.wait_for_selector('#prStart, .term .screen')   # 3.2: the week practical (one timer)
        if await pp.locator('#prStart').count(): await pp.locator('#prStart').click()
        await pp.wait_for_selector('.term .screen')
        m=await pp.evaluate("""()=>{const i=document.querySelector('.term .inrow input'),s=document.querySelector('.term .screen');const q=[...document.querySelectorAll('.term .quick button')].map(b=>b.getBoundingClientRect().height);
          return {h:i.getBoundingClientRect().height,fs:parseFloat(getComputedStyle(i).fontSize),qmin:Math.min(...q),tab:s.getAttribute('tabindex'),role:s.getAttribute('role'),label:s.getAttribute('aria-label')}}""")
        check(m['h']>=40 and m['fs']>=16,f'command input is >= 40px tall with a 16px font (no iOS zoom) {m["h"]:.0f}px / {m["fs"]}px')
        check(m['qmin']>=40,f'quick command buttons are >= 40px tall ({m["qmin"]:.0f})')
        check(m['tab']=='0' and m['role'] and m['label'],'output area is keyboard-scrollable with a role and a name')
        await pp.locator('.term .inrow input').fill('ipconfig /all'); await pp.locator('.term .inrow input').press('Enter'); await pp.wait_for_timeout(200)
        out=await pp.inner_text('.term .screen')
        check('Connection-specific DNS Suffix  . : lab.internal' in out and 'Lease Obtained. . . . . . . . . . : Tuesday, October 13, 2026 8:02:14 AM' in out and 'Lease Expires . . . . . . . . . . : Wednesday, October 14, 2026 8:02:14 AM' in out,'ipconfig /all shows the DNS suffix and a dated lease (obtained and expires)')
        check(await pp.locator('.term .thint').is_visible(),'"เลื่อนดูด้านข้าง" cue appears when the output is wider than the box')
        await pp.locator('.term .twrap').click()
        r=await pp.evaluate("(()=>{const s=document.querySelector('.term .screen');return {w:s.scrollWidth-s.clientWidth,hint:document.querySelector('.term .thint').hidden}})()")
        check(r['w']<=2 and r['hint'],f'"ตัดบรรทัด" wraps long lines and the cue goes away {r}')
        await pp.locator('.term .inrow input').fill('net config workstation'); await pp.locator('.term .inrow input').press('Enter')
        await pp.locator('.term .inrow input').fill('getmac'); await pp.locator('.term .inrow input').press('Enter'); await pp.wait_for_timeout(200)
        out=await pp.inner_text('.term .screen')
        check('NetBT_Tcpip_{4F2A91C3-7B1E-4D22-9A60-11C0E5B7D3A8} (001A2B3C4D5E)' in out and 'Tcpip_{4F2A91C3-7B1E-4D22-9A60-11C0E5B7D3A8}' in out and '00155D' not in out,'net config workstation uses the same MAC and GUID as getmac')
        # sticky timer must not cover the top of the terminal when typing
        await pp.evaluate("window.scrollTo(0,document.querySelector('.term').getBoundingClientRect().top+scrollY+120)")
        await pp.evaluate("document.activeElement.blur()"); await pp.locator('.term .inrow input').focus(); await pp.wait_for_timeout(300)
        r=await pp.evaluate("(()=>{const t=document.querySelector('#prTimer').getBoundingClientRect(),m=document.querySelector('.term').getBoundingClientRect();return {timerBottom:t.bottom,termTop:m.top}})()")
        check(r['termTop']>=r['timerBottom'],f'the sticky timer does not cover the terminal while typing {r}')
        await pp.screenshot(path=f'{OUT}/p15_term_360.png')
        ov=await pp.evaluate('document.documentElement.scrollWidth-innerWidth'); check(ov<=0,f'no horizontal page scroll at 360px ({ov})')
        check(not E,'no page errors (terminal) '+'; '.join(E[:2]))
        await P.request.post(BASE+'/api/practical/w8/submit',headers={'X-NetLab':'1'}); await P.close()
        # 3.2: missions count in the practical only inside a session: week 4 with sw1 7/10, sw2 10/10 and sw7 6/10 recorded in one session
        S2=await b.new_context(); await login(S2,'s2','Stud1234'); r=await S2.request.post(BASE+'/api/practical/w4/start',headers={'X-NetLab':'1'}); assert r.ok, await r.text()
        sql(f"""INSERT INTO practical_items(session_id,item,part,score,max,solved) SELECT id,x.item,'guided',x.sc,10,x.sc>=10 FROM practical_sessions,
             (VALUES ('switching:sw1',7),('switching:sw2',10),('switching:sw7',6)) AS x(item,sc) WHERE user_id={s2} AND lesson_id='w4' AND status='running'""")
        r=await S2.request.post(BASE+'/api/practical/w4/submit',headers={'X-NetLab':'1'}); assert r.ok; await S2.close()

        print('== lesson rail, naming and "passed" rule (s2, 390px)')
        M=await b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True); await login(M,'s2','Stud1234'); mp=await M.new_page(); E=[]; mp.on('pageerror',lambda e:E.append(str(e)))
        sd=await M.request.get(BASE+'/api/sims/done'); ok(f'GET /api/sims/done -> {sd.status} ('+('used' if sd.status==200 else 'app falls back to /api/sims')+')')
        for step in ['post','summary']:
            await mp.goto(BASE+f'/#/lesson/w4/{step}'); await mp.wait_for_selector('.rail .rstep.on'); await mp.wait_for_timeout(400)
            r=await mp.evaluate("(()=>{const n=document.querySelector('.rail').getBoundingClientRect(),o=document.querySelector('.rail .rstep.on').getBoundingClientRect();return {l:o.left-n.left,r:n.right-o.right,y:scrollY}})()")
            check(r['l']>=-1 and r['r']>=-1 and r['y']==0,f'390px {step}: the current step is scrolled into view inside the rail, page not moved {r}')
        await mp.screenshot(path=f'{OUT}/p15_rail_390.png')
        await mp.wait_for_selector('#prSummary .compare'); t=await mp.inner_text('#prSummary')
        check('กิจกรรมที่ยังไม่ผ่าน' in t and 'ได้ 6/10 (60%) ต้องได้อย่างน้อย 70%' in t,'summary lists the 6/10 mission as not passed and states the 70 % rule')
        await mp.goto(BASE+'/#/lesson/w4/lab'); await mp.wait_for_selector('#prResult'); await mp.wait_for_timeout(400)
        st=lambda k: mp.get_attribute(f'.prresitem[data-key="switching:{k}"]','data-passed')
        check([await st('sw1'),await st('sw2'),await st('sw7')]==['true','true','false'],'practical result: 7/10 and 10/10 passed, 6/10 not (the 70 % rule)')
        check('ผ่าน 2/6' in await mp.inner_text('.prrespart[data-part=guided] h3'),'Guided Lab counts 2 passed of its 6 activities')
        check(await mp.locator('.prresitem[data-key="switching:sw7"] .prreason').count()==1 and await mp.locator('.prresitem[data-key="switching:sw7"] .prmark.ok').count()==0,'the 6/10 mission has a reason and no check mark')
        await mp.screenshot(path=f'{OUT}/p15_w4_result_390.png',full_page=True)
        await mp.goto(BASE+'/#/lesson/w14/challenge'); await mp.wait_for_selector('#prPlan .prplanpart[data-part=trouble] h3'); await mp.wait_for_timeout(200)
        h=await mp.inner_text('#prPlan .prplanpart[data-part=trouble] h3')
        check(mp.url.endswith('#/lesson/w14/lab') and 'Troubleshooting Lab' in h and 'ฝึกแก้ปัญหาเครือข่าย' in h,f'the old /challenge URL opens the practical; the Troubleshooting part has its English name with the Thai one ({h!r})')
        await mp.goto(BASE+'/#/lesson/w8/content'); await mp.wait_for_selector('.lsec')
        xd=await mp.locator('.xdivider').inner_text() if await mp.locator('.xdivider').count() else ''
        check('ความรู้เพิ่มเติมของสัปดาห์นี้' in xd and 'การสื่อสารข้อมูล' not in xd,f'supplementary divider is generic ({xd!r})')
        hs=await mp.evaluate("[...document.querySelectorAll('.fsbar .fsbtn')].map(b=>b.getBoundingClientRect().height)")
        check(hs and min(hs)>=40,f'font-size buttons are >= 40px ({hs})')
        check(not E,'no page errors (s2) '+'; '.join(E[:2])); await M.close()

        print('== student portfolio: print view, labels, keyboard, error state')
        S=await b.new_context(viewport={'width':1280,'height':900}); await login(S,'s1','Stud1234'); pg=await S.new_page(); E=[]; pg.on('pageerror',lambda e:E.append(str(e)))
        await pg.goto(BASE+'/#/portfolio'); await pg.wait_for_selector('.pf .pfsk')
        check(await pg.inner_text('.pf h1')=='แฟ้มผลงานทักษะ' and 'Student Network Skills Portfolio' in await pg.inner_text('.pf .pfhead'),'portfolio H1 matches the menu ("แฟ้มผลงานทักษะ") and keeps the English subtitle')
        labels=await pg.evaluate("[...document.querySelectorAll('.pf textarea')].map(t=>t.getAttribute('aria-label'))")
        check(len(labels)==12 and len(set(labels))==12 and 'สะท้อนการเรียนรู้ของฉัน: เครือข่ายไร้สาย' in labels,f'{len(labels)} reflection boxes, each with its own label naming the skill')
        await pg.locator('.pf .pfsk').nth(6).focus(); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(700)
        fid=await pg.evaluate("document.activeElement.tagName+'#'+(document.activeElement.closest('.pfsec')||{}).id")
        check(fid=='H2#pf-wireless',f'Enter on a skill card moves focus to that section heading ({fid})')
        ta=pg.locator('#pf-wireless textarea'); await ta.fill(LONG); await pg.locator('#pf-wireless button:has-text("บันทึก")').click(); await pg.wait_for_selector('#pf-wireless .pfmsg.ok')
        await pg.reload(); await pg.wait_for_selector('#pf-wireless textarea'); await pg.locator('#pf-wireless textarea').focus()
        for theme in ['light','dark']:
            await pg.emulate_media(media='print',color_scheme=theme)
            r=await pg.evaluate("""()=>{const c=document.querySelector('#pf-wireless .pfprint'),t=document.querySelector('#pf-wireless textarea'),e=document.querySelector('#pf-design .pfprint'),pf=document.querySelector('.pf');
              return {vis:getComputedStyle(c).display,ta:getComputedStyle(t).display,txt:c.innerText,clip:c.scrollHeight-c.clientHeight,empty:e.innerText,ph:e.innerText.includes('งานใดเป็นหลักฐาน'),col:getComputedStyle(pf).color,bg:getComputedStyle(pf).backgroundColor,card:getComputedStyle(document.querySelector('.pf .pfcard')).backgroundColor}}""")
            check(r['vis']=='block' and r['ta']=='none' and 'บรรทัดที่ 1:' in r['txt'] and 'บรรทัดสุดท้าย' in r['txt'] and r['clip']<=1,f'{theme} print: the whole 31-line reflection prints as text (no clipped textarea, no focus ring)')
            check(r['empty']=='ยังไม่ได้เขียน' and not r['ph'],f'{theme} print: an empty reflection prints "ยังไม่ได้เขียน", not the placeholder question')
            check(r['col']=='rgb(28, 37, 48)' and r['bg']=='rgb(255, 255, 255)' and r['card']=='rgb(255, 255, 255)',f'{theme} print: dark text on white ({r["col"]} on {r["bg"]})')
            pdf=await pg.pdf(format='A4'); open(f'{OUT}/p15_portfolio_print_{theme}.pdf','wb').write(pdf)
            await pg.screenshot(path=f'{OUT}/p15_portfolio_print_{theme}.png',full_page=True)
        await pg.emulate_media(media='screen',color_scheme='light')
        # error states: server error and offline
        await pg.route('**/api/portfolio',lambda r:r.fulfill(status=500,content_type='application/json',body='{"error":"server","message":"Internal error"}'))
        await pg.goto(BASE+'/#/'); await pg.goto(BASE+'/#/portfolio'); await pg.wait_for_selector('.pf .pferr')
        t=await pg.inner_text('.pf .pferr')
        check('เซิร์ฟเวอร์ขัดข้อง' in t and 'Internal error' not in t and await pg.locator('.pferr button:has-text("ลองใหม่")').count()==1,'HTTP 500: Thai message with a "ลองใหม่" button')
        await pg.unroute('**/api/portfolio'); await pg.locator('.pferr button:has-text("ลองใหม่")').click(); await pg.wait_for_selector('.pf .pfsk')
        ok('"ลองใหม่" loads the portfolio once the server answers')
        await pg.route('**/api/portfolio',lambda r:r.abort('internetdisconnected'))
        await pg.goto(BASE+'/#/'); await pg.goto(BASE+'/#/portfolio'); await pg.wait_for_selector('.pf .pferr')
        t=await pg.inner_text('.pf .pferr')
        check('อินเทอร์เน็ต' in t and 'Failed to fetch' not in t and await pg.locator('.pferr button:has-text("ลองใหม่")').count()==1,'offline: says the page needs the internet, with "ลองใหม่"')
        await pg.unroute('**/api/portfolio')
        # defense rubric on a phone: criterion column wraps, the table scrolls inside its box
        Q=await b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True); await login(Q,'s1','Stud1234'); qp=await Q.new_page()
        await qp.goto(BASE+'/#/portfolio'); await qp.wait_for_selector('#pf-capstone table.rubdef')
        r=await qp.evaluate("""()=>{const t=document.querySelector('#pf-capstone table.rubdef'),td=t.querySelector('tbody td'),w=t.closest('.tw');
          return {ws:getComputedStyle(td).whiteSpace,tw:t.getBoundingClientRect().width,box:w.clientWidth,scroll:getComputedStyle(w).overflowX,page:document.documentElement.scrollWidth-innerWidth,tdw:td.getBoundingClientRect().width}}""")
        check(r['ws']=='normal' and r['tw']>=600 and r['scroll']=='auto' and r['page']<=0 and r['tdw']<220,f'defense rubric at 390px: criterion wraps, table {r["tw"]:.0f}px scrolls inside its box, no page scroll')
        await qp.screenshot(path=f'{OUT}/p15_rubric_390.png',full_page=True); await Q.close()
        check(not E,'no page errors (portfolio) '+'; '.join(E[:2]))

        if os.path.exists(AXE_PATH):
            AXE=open(AXE_PATH).read(); viol=[]
            for theme in ['light','dark']:
                c=await b.new_context(viewport={'width':1280,'height':900},color_scheme=theme); await login(c,'s1','Stud1234'); cp=await c.new_page()
                for rt in ['#/portfolio','#/lesson/w4/summary']:
                    await cp.goto(BASE+'/'+rt); await cp.wait_for_timeout(1200); await cp.add_script_tag(content=AXE)
                    v=await cp.evaluate(AXE_RUN)
                    if v: viol.append(f'{theme} {rt} {v}')
                await c.close()
            check(not viol,'axe WCAG 2.1 AA: 0 violations on the portfolio and the week summary (skill pills), light + dark '+' ;; '.join(viol[:4]))
        else: print('  (axe-core not installed)')

        print('== teacher: class portfolio table at 1366 and tabs')
        T=await b.new_context(viewport={'width':1366,'height':900}); await login(T,'kru4','Teach1234'); tp=await T.new_page(); E=[]; tp.on('pageerror',lambda e:E.append(str(e)))
        await tp.goto(BASE+'/teacher.html'); await tp.wait_for_selector('.side'); await tp.locator('.side .navbtn').nth(1).click(); await tp.wait_for_selector('.tabs')
        r=await tp.evaluate("(()=>{const t=document.querySelector('.tabs');const bs=[...t.querySelectorAll('button')];return {ov:t.scrollWidth-t.clientWidth,out:bs.filter(b=>b.getBoundingClientRect().right>innerWidth).length,rows:new Set(bs.map(b=>Math.round(b.getBoundingClientRect().top))).size}})()")
        check(r['ov']<=0 and r['out']==0,f'all teacher tabs are visible (they wrap instead of scrolling off-screen) {r}')
        await tp.locator('.tabs button',has_text='ห้องจำลอง').click(); await tp.wait_for_selector('.matrix')
        await tp.locator('button',has_text='ห้องปฏิบัติการ Switching และ VLAN').click(); await tp.wait_for_timeout(300)
        row=await tp.locator('.matrix tr:has-text("สมหญิง ทดสอบ")').inner_text()
        check(row.rstrip().endswith('2/'+row.rstrip().split('/')[-1]) and await tp.locator('.matrix tr:has-text("สมหญิง ทดสอบ") td.finished').count()==2,'teacher simulator results use the same 70 % rule (7/10 and 10/10 passed, 6/10 not): 2 passed')
        await tp.locator('.tabs button',has_text='แฟ้มผลงานทักษะ').click(); await tp.wait_for_selector('.pftable .pfopen')
        r=await tp.evaluate("""()=>{const b=document.querySelector('.pftable .pfopen').getBoundingClientRect(),w=document.querySelector('.pftable').closest('.tablewrap');
          const th=[...document.querySelectorAll('.pftable th.skh')].map(h=>h.getBoundingClientRect().height);
          return {right:b.right,vis:b.right<=innerWidth&&b.left>=0,ov:w.scrollWidth-w.clientWidth,thmax:Math.max(...th),title:document.querySelector('.pftable th.skh abbr').title}}""")
        check(r['vis'] and r['ov']<=0,f'1366px: the open action (student name) is on screen and the table fits {r}')
        check(r['thmax']<40 and 'Network Design' in r['title'],f'skill headers are one short line with a full-name tooltip {r}')
        await tp.screenshot(path=f'{OUT}/p15_teacher_pf_1366.png',full_page=True)
        await tp.locator('.pftable tr:has-text("สมชาย ทดสอบ") .pfopen').click(); await tp.wait_for_selector('.pf #pf-cabling')
        ok('clicking the student name opens the portfolio')
        if os.path.exists(AXE_PATH):
            viol=[]
            for theme in ['light','dark']:
                await tp.emulate_media(color_scheme=theme); await tp.add_script_tag(content=AXE)
                v=await tp.evaluate(AXE_RUN)
                if v: viol.append(f'{theme} {v}')
            check(not viol,'axe: teacher view of a portfolio, light + dark, 0 violations '+' ;; '.join(viol[:3]))
        check(not E,'no page errors (teacher) '+'; '.join(E[:2]))
        await b.close()
    print(f'\npart15: {len(issues)} issue(s)'); sys.exit(1 if issues else 0)
asyncio.run(main())
