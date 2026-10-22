# Part 13 (3.0 Phase 4): lessons, figures and hands-on lab tasks
# - every lesson section (core + เนื้อหาเสริม) of all 18 weeks opens at 360px: no horizontal scroll, no page errors,
#   every figure and interactive widget renders (no "แสดงภาพนี้ไม่ได้" / "โหลดสื่อนี้ไม่สำเร็จ"); the same at 1366px for the figures
# - the new missions (topology t14-t19, terminal m12-m20, wifi wf1-wf6) open by deep link at 390px and 1366px
# - week practicals (3.2, a student session): a terminal hands-on task is answered from real command output and graded; a configuration form (w6) is graded
# - the week 6 practical lists the Wi-Fi lab
# usage: python3 tests/e2e/part13.py <out-dir>
import asyncio, sys, json, os, subprocess
from playwright.async_api import async_playwright
OUT=sys.argv[1]; BASE=os.environ.get('E2E_BASE','http://127.0.0.1:3990')
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
issues=[]
def bad(m): issues.append(m); print('  ✗',m)
def ok(m): print('  ✓',m)
def check(c,m): ok(m) if c else bad(m)
NEW=json.loads(subprocess.check_output(['node','-e',"""const {MODS}=require('./server/sims-api');
const o={topology:MODS.topology.missions.map(m=>m.id).filter(id=>+id.slice(1)>=14),terminal:MODS.terminal.missions.map(m=>m.id).filter(id=>+id.slice(1)>=12),wifi:MODS.wifi.missions.map(m=>m.id)};
console.log(JSON.stringify(o))"""],cwd=ROOT,stderr=subprocess.DEVNULL))
BROKEN="(document.body.innerText.match(/แสดงภาพนี้ไม่ได้|โหลดสื่อนี้ไม่สำเร็จ/g)||[]).length"

async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        G=await b.new_context(viewport={'width':1366,'height':860}); gp=await G.new_page()
        lessons=[]
        for w in range(1,19):
            j=await (await G.request.get(BASE+f'/api/lessons/w{w}')).json()
            lessons.append((f'w{w}',[s['id'] for s in j['sections']],[s['id'] for s in j['sections'] if s.get('extra')]))
        await G.close()
        total=sum(len(s) for _,s,_ in lessons); extra=sum(len(x) for _,_,x in lessons)
        for vw,vh,mob in [(360,800,True),(1366,860,False)]:
            print(f'== every lesson section at {vw}px ({total} sections, {extra} of them supplementary)')
            C=await b.new_context(viewport={'width':vw,'height':vh},has_touch=mob,is_mobile=mob); pg=await C.new_page(); E=[]; pg.on('pageerror',lambda e:E.append(str(e)))
            await pg.goto(BASE+'/'); await pg.wait_for_selector('.side, .mtop')
            over=[]; broken=[]; figs=0
            for lid,secs,_ in lessons:
                # the content step renders every section of the lesson (core + supplementary) on one page
                await pg.evaluate(f"location.hash='#/lesson/{lid}/content/{secs[0]}'")
                try: await pg.wait_for_function(f"document.querySelectorAll('.lsec').length>={len(secs)} && location.hash.includes('/{lid}/')",timeout=15000)
                except Exception: broken.append(f'{lid}: only {await pg.evaluate("document.querySelectorAll(\'.lsec\').length")} of {len(secs)} sections shown'); continue
                # figures are inserted when they scroll into view: scroll through the whole lesson once
                await pg.evaluate("(async()=>{for(let y=0;y<document.body.scrollHeight;y+=600){scrollTo(0,y);await new Promise(r=>setTimeout(r,25));}scrollTo(0,0)})()")
                await pg.wait_for_timeout(300)
                n=await pg.evaluate(BROKEN)
                if n: broken.append(f'{lid} ({n})')
                figs+=await pg.evaluate("document.querySelectorAll('.lsec figure.dgm .dgmsvg svg, .lsec figure.wdg > div > *').length")
                if vw<=400:
                    ov=await pg.evaluate('document.documentElement.scrollWidth-innerWidth')
                    if ov>0: over.append(f'{lid} +{ov}px')
            if vw<=400: check(not over,f'no horizontal scroll in any section at {vw}px '+'; '.join(over[:5]))
            check(not broken,f'every figure and widget renders ({figs} rendered) '+'; '.join(broken[:5]))
            check(not E,f'no page errors at {vw}px '+'; '.join(E[:2]))
            if vw<=400:
                await pg.evaluate("location.hash='#/lesson/w4/content/x6'"); await pg.wait_for_timeout(900)
                await pg.screenshot(path=f'{OUT}/p13_w4x6_360.png',full_page=True)
            await C.close()

        for vw,vh,mob in [(1366,860,False),(390,844,True)]:
            print(f'== new simulator missions open by deep link at {vw}px')
            C=await b.new_context(viewport={'width':vw,'height':vh},has_touch=mob,is_mobile=mob); pg=await C.new_page(); E=[]; pg.on('pageerror',lambda e:E.append(str(e)))
            probs=[]
            for sim,ms in NEW.items():
                for m in ms:
                    await pg.goto(BASE+f'/#/sim/{sim}/{m}')
                    try: await pg.wait_for_function('document.querySelector(".simroot") && document.querySelector(".simroot").children.length>0',timeout=15000)
                    except Exception: probs.append(f'{sim}/{m} did not mount'); continue
                    await pg.wait_for_timeout(400)
                    ov=await pg.evaluate('document.documentElement.scrollWidth-innerWidth')
                    if ov>0: probs.append(f'{sim}/{m} overflow {ov}px')
            n=sum(len(v) for v in NEW.values())
            check(n>=21 and not probs,f'{n} new missions open without horizontal scroll '+'; '.join(probs[:4]))
            check(not E,f'no page errors at {vw}px '+'; '.join(E[:2]))
            if not mob:
                await pg.goto(BASE+'/#/sim/wifi/wf2'); await pg.wait_for_timeout(1500); await pg.screenshot(path=f'{OUT}/p13_wifi_wf2.png',full_page=True)
            await C.close()

        print('== week labs: hands-on tasks')
        # 3.2: hands-on tasks are answered inside the week practical (students only, one running session at a time)
        C=await b.new_context(viewport={'width':1366,'height':900})
        r=await C.request.post(BASE+'/api/auth/login',data={'username':'s1','password':'Stud1234'},headers={'X-NetLab':'1'}); assert r.ok
        pg=await C.new_page(); E=[]; pg.on('pageerror',lambda e:E.append(str(e)))
        opened=[]
        async def open_lab(w):
            for x in opened: await C.request.post(BASE+f'/api/practical/{x}/submit',headers={'X-NetLab':'1'})   # frees the timer for the next week
            opened.clear()
            await pg.goto(BASE+f'/#/lesson/{w}/lab'); await pg.wait_for_selector(f'#prPage[data-week="{w}"] #prStart, #prPage[data-week="{w}"] #prClock')
            if await pg.locator('#prStart').count(): await pg.click('#prStart')
            await pg.wait_for_selector('#prClock'); await pg.wait_for_selector('.task'); await pg.wait_for_timeout(300); opened.append(w)
        async def term(cmd,wait=300):
            inp=pg.locator('.term input'); await inp.fill(cmd); await inp.press('Enter'); await pg.wait_for_timeout(wait)
            return await pg.inner_text('.term .screen')
        async def answer(key,text):
            card=pg.locator(f'#task-{key}'); await card.locator('input').fill(text); await card.locator('button:has-text("ตรวจคำตอบ")').click()
            try: await pg.wait_for_selector(f'#task-{key}.solved',timeout=8000); return True
            except Exception: return False
        await open_lab('w1')
        out=await term('net view')
        check('TEACHER-PC' in out and await pg.locator('.term').count()==1,'week 1 lab now has the Command Prompt simulator and net view works')
        check(await answer('w1-8','TEACHER-PC'),'w1 hands-on task graded correct from the net view output')
        await open_lab('w18')
        out=await term('icacls C:\\Share\\Homework')
        check('BUILTIN\\Users:(OI)(CI)(M)' in out,'icacls shows the NTFS entries of the shared folder')
        card=pg.locator('#task-w18-5'); await card.locator('input').fill('F'); await card.locator('button:has-text("ตรวจคำตอบ")').click(); await pg.wait_for_timeout(1500)
        check(await pg.locator('#task-w18-5.solved').count()==0,'a wrong reading (F) is not accepted')
        check(await answer('w18-5','M'),'the right reading (M) is accepted')
        await pg.screenshot(path=f'{OUT}/p13_w18_lab.png',full_page=True)
        await open_lab('w14')
        out=await term('ping www.netlab.test',3000); out2=await term('tracert www.netlab.test',4500)
        check('TTL=59' in out and '203.0.113.80' in out2.split('Tracing route to www.netlab.test')[-1],'ping TTL and tracert hops agree (64 - 5 routers = 59)')
        await open_lab('w6')
        card=pg.locator('#task-w6-6'); sels=card.locator('select')
        for i,v in enumerate(['2.4 GHz','11','20 MHz','802.11ax (Wi-Fi 6)']): await sels.nth(i).select_option(v)
        await card.locator("button:has-text(\"บันทึกการตั้งค่า\")").click(); await pg.wait_for_timeout(1500)
        check(await pg.locator('#task-w6-6.solved').count()==0,'w6 form: channel 11 (used next door) is rejected')
        await sels.nth(1).select_option('6'); await card.locator("button:has-text(\"บันทึกการตั้งค่า\")").click()
        try: await pg.wait_for_selector('#task-w6-6.solved',timeout=8000); ok('w6 form: channel 6 / 20 MHz / 802.11ax is accepted')
        except Exception: bad('w6 form: correct settings not accepted')
        check(await pg.locator('#prPanel .pritem[data-key="wifi:wf1"] a[href="#/sim/wifi/wf1"]').count()==1,'week 6 practical (Guided Lab) lists the Wi-Fi planning lab with a link')
        check(not E,'no page errors in the week labs '+'; '.join(E[:2]))
        await C.close(); await b.close()
    print(f'\npart13: {len(issues)} issue(s)'); sys.exit(1 if issues else 0)
asyncio.run(main())
