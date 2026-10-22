# Part 16 (3.0 Phase 6): Content-Security-Policy does not break the app; guest post-test asks for login
# - visits student and teacher pages (lessons with figures, labs, every simulator, practice, exams, portfolio, all teacher tabs)
#   and fails on any "Content Security Policy" console message or page error
# usage: python3 tests/e2e/part16.py <out-dir>
import asyncio, sys, os, json, subprocess
from playwright.async_api import async_playwright
OUT=sys.argv[1]; BASE=os.environ.get('E2E_BASE','http://127.0.0.1:3990')
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
issues=[]
def bad(m): issues.append(m); print('  ✗',m)
def ok(m): print('  ✓',m)
def check(c,m): ok(m) if c else bad(m)
SIMS=json.loads(subprocess.check_output(['node','-e',"const {MODS,SIMS}=require('./server/sims-api');console.log(JSON.stringify(SIMS.map(s=>[s,MODS[s].missions[0].id])))"],cwd=ROOT,stderr=subprocess.DEVNULL))
async def login(ctx,u,p):
    r=await ctx.request.post(BASE+'/api/auth/login',data={'username':u,'password':p},headers={'X-NetLab':'1'}); assert r.ok, await r.text()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        h=(await (await b.new_context()).request.get(BASE+'/')).headers
        check('content-security-policy' in h or 'content-security-policy-report-only' in h,'pages are served with a Content-Security-Policy (report-only in e2e, see run.sh; violations are still reported)')
        print('== student pages under the policy')
        S=await b.new_context(viewport={'width':1366,'height':900}); await login(S,'s1','Stud1234'); pg=await S.new_page()
        msgs=[]; pg.on('console',lambda m: msgs.append(m.text) if 'Content Security Policy' in m.text or 'Content-Security-Policy' in m.text else None)
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        routes=['#/','#/learn','#/lesson/w4/content','#/lesson/w8/content','#/lesson/w12/lab','#/lesson/w14/lab','#/practice','#/exams','#/me','#/portfolio','#/glossary','#/profile','#/results','#/sims']+[f'#/sim/{s}/{m}' for s,m in SIMS]
        for r in routes:
            await pg.goto(BASE+'/'+r); await pg.wait_for_timeout(900)
            await pg.evaluate("(async()=>{for(let y=0;y<document.body.scrollHeight;y+=900){scrollTo(0,y);await new Promise(r=>setTimeout(r,20));}})()"); await pg.wait_for_timeout(200)
        check(not msgs,f'no CSP violations on {len(routes)} student pages '+'; '.join(msgs[:3]))
        check(not errs,'no page errors '+'; '.join(errs[:2]))
        print('== teacher page under the policy (inline script allowed by its hash)')
        T=await b.new_context(viewport={'width':1366,'height':900}); await login(T,'kru4','Teach1234'); tp=await T.new_page()
        tm=[]; tp.on('console',lambda m: tm.append(m.text) if 'Content Security Policy' in m.text else None); te=[]; tp.on('pageerror',lambda e: te.append(str(e)))
        await tp.goto(BASE+'/teacher.html'); await tp.wait_for_selector('.side')
        await tp.locator('.side .navbtn').nth(1).click(); await tp.wait_for_selector('.tabs')
        n=await tp.locator('.tabs button').count()
        for i in range(n):
            await tp.locator('.tabs button').nth(i).click(); await tp.wait_for_timeout(700)
        check(n>=11 and not tm,f'teacher page and its {n} tabs run with no CSP violation '+'; '.join(tm[:3]))
        check(not te,'no page errors on the teacher page '+'; '.join(te[:2]))
        print('== guest post-test')
        G=await b.new_context(viewport={'width':390,'height':844}); gp=await G.new_page()
        await gp.goto(BASE+'/#/lesson/w2/post'); await gp.wait_for_selector('.quizintro')
        t=await gp.inner_text('.quizintro'); check('เข้าสู่ระบบ' in t and await gp.locator('.qcard').count()==0,'guest sees a login prompt instead of the post-test')
        await b.close()
    print(f'\npart16: {len(issues)} issue(s)'); sys.exit(1 if issues else 0)
asyncio.run(main())
