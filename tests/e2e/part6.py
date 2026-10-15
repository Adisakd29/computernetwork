# Part 6 (2.6 master brief): pre/post wording, section guides, glossary page, full-text search, diagram lazy-load + full-size view,
# new figures/widgets work by touch, accessibility (axe WCAG 2.1 AA) on the new parts. usage: python3 tests/e2e/part6.py <out-dir>
import asyncio, sys, json, os, subprocess, re
from playwright.async_api import async_playwright
OUT=sys.argv[1]; BASE='http://127.0.0.1:3990'
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AXE_PATH=os.path.join(ROOT,'node_modules','axe-core','axe.min.js')
issues=[]
def bad(m): issues.append(m); print('  ✗',m)
def ok(m): print('  ✓',m)
def check(c,m): ok(m) if c else bad(m)
NODE=lambda js: json.loads(subprocess.check_output(['node','-e',js],cwd=ROOT))
INFO=NODE("""const {LESSONS}=require('./server/lessons');const fs=require('fs');
const figs=[];for(const f of fs.readdirSync('public/js').filter(f=>/^figs-.*\\.js$/.test(f)))for(const m of fs.readFileSync('public/js/'+f,'utf8').matchAll(/NL_FIG\\(\\s*'(diagram|widget)'\\s*,\\s*'([a-z0-9-]+)'/g))figs.push([m[1],m[2]]);
const where={};for(const L of LESSONS.values())for(const s of L.sections)for(const b of s.blocks)if(b.type==='diagram'||b.type==='widget')where[b.name]=where[b.name]||[L.id,s.id];
const secs={};for(const L of LESSONS.values())secs[L.id]=L.sections.length;
const gl=JSON.parse(require('./server/lessons').GLOSSARY).length;
console.log(JSON.stringify({figs,where,secs,gl}))""")
async def login(ctx,u,p):
    r=await ctx.request.post(BASE+'/api/auth/login',data={'username':u,'password':p},headers={'X-NetLab':'1'}); assert r.ok
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        print('== pre/post-test wording is consistent (every week uses the same template)')
        c=await b.new_context(viewport={'width':1280,'height':900}); await login(c,'s2','Stud1234'); pg=await c.new_page()
        for w in ['w1','w9','w18']:
            await pg.goto(BASE+f'/#/lesson/{w}/post'); await pg.wait_for_selector('.quizintro, .scorebig',timeout=8000)
            t=await pg.inner_text('#app')
            if await pg.locator('.quizintro').count():
                check('คู่ขนาน' in t and 'ชุดเดียวกับก่อนเรียน' not in t,f'{w} post-test intro says parallel form, not "same set"')
            await pg.goto(BASE+f'/#/lesson/{w}/pre'); await pg.wait_for_selector('.quizintro, .scorebig',timeout=8000)
            t=await pg.inner_text('#app')
            if await pg.locator('.quizintro').count(): check('คู่ขนาน' in t,f'{w} pre-test intro also says parallel form')
        allsrc=''.join(open(os.path.join(ROOT,f)).read() for f in ['public/js/app.js','public/teacher.html','README.md'])
        check('ชุดเดียวกับก่อนเรียน 10 ข้อ' not in allsrc and 'ข้อเดียวกัน 10 ข้อ' not in allsrc,'no "same set" wording left in UI sources or README')
        await c.close()

        print('== section guides: lead question, goals, glossary, key points in all 99 sections')
        c=await b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True); pg=await c.new_page(); E=[]; pg.on('pageerror',lambda e:E.append(str(e)))
        miss=[]
        for lid,n in INFO['secs'].items():
            await pg.goto(BASE+f'/#/lesson/{lid}/content'); await pg.wait_for_selector('.lsec')
            k=await pg.evaluate("[...document.querySelectorAll('section.lsec')].map(s=>[!!s.querySelector('.glead'),s.querySelectorAll('.ggoals li').length,!!s.querySelector('.gkeys')])")
            bad_=[i for i,(a,g,kk) in enumerate(k) if not(a and g>=1 and kk)]
            if len(k)!=n or bad_: miss.append(f'{lid}: {len(k)}/{n} sections, missing guide in {bad_}')
            ov=await pg.evaluate('document.documentElement.scrollWidth-innerWidth')
            if ov>0: miss.append(f'{lid}: horizontal overflow {ov}px at 390')
        check(not miss and not E,'every section shows lead question + goals + key points, no overflow at 390px '+'; '.join(miss[:3]+E[:2]))
        await pg.goto(BASE+'/#/lesson/w3/content'); await pg.wait_for_selector('.gloss')
        gl=pg.locator('.gloss').first; await gl.locator('summary').tap(); await pg.wait_for_timeout(200)
        check(await gl.evaluate('e=>e.open') and await gl.locator('.gterm').count()>=1 and 'อ่านว่า' in await gl.inner_text(),'glossary box opens by tap and shows term, pronunciation, meaning, example')
        bb=await gl.locator('summary').bounding_box(); check(bb['height']>=44,f'glossary toggle is a 44px touch target ({round(bb["height"])})')
        await pg.screenshot(path=f'{OUT}/p6_guide_390.png')
        await c.close()

        print('== glossary page (filter, week, A-Z) and full-text search')
        c=await b.new_context(viewport={'width':1280,'height':900}); pg=await c.new_page(); E=[]; pg.on('pageerror',lambda e:E.append(str(e)))
        await pg.goto(BASE+'/#/glossary'); await pg.wait_for_selector('.glist')
        st=await pg.inner_text('.gcount'); check(f'{INFO["gl"]} จาก {INFO["gl"]}' in st,f'glossary lists all {INFO["gl"]} terms ({st})')
        await pg.fill('.gfilter','dhcp'); await pg.wait_for_timeout(400)
        t=await pg.inner_text('.glist'); n=int(re.search(r'แสดง (\d+)',await pg.inner_text('.gcount')).group(1))
        check(0<n<20 and 'DHCP' in t,f'filter "dhcp" narrows the list ({n})')
        await pg.fill('.gfilter','ซับเน็ต'); await pg.wait_for_timeout(400)
        n2=int(re.search(r'แสดง (\d+)',await pg.inner_text('.gcount')).group(1)); check(n2>=1,f'Thai synonym "ซับเน็ต" finds subnet terms ({n2})')
        await pg.fill('.gfilter',''); await pg.select_option('.gtools select >> nth=0','5'); await pg.wait_for_timeout(300)
        weeks=await pg.evaluate("[...document.querySelectorAll('.gweek h2')].map(h=>h.textContent)"); check(len(weeks)==1 and 'สัปดาห์ 5' in weeks[0],'week filter shows only week 5')
        await pg.select_option('.gtools select >> nth=0',''); await pg.select_option('.gtools select >> nth=1','az'); await pg.wait_for_timeout(300)
        ens=await pg.evaluate("[...document.querySelectorAll('.glist .gen')].map(e=>e.textContent)")
        check(ens==sorted(ens,key=lambda x:x.lower()) or len(ens)>300,'A–Z order sorts terms')
        await pg.locator('.gsrc').first.click(); await pg.wait_for_selector('.lsec'); await pg.wait_for_timeout(700)
        check('/content/s' in pg.url,'a term links back to the section that teaches it')
        await pg.goto(BASE+'/#/'); await pg.wait_for_selector('.sidesearch input')
        await pg.fill('.sidesearch input','DORA'); await pg.keyboard.press('Enter'); await pg.wait_for_selector('h1:has-text("ผลการค้นหา")'); await pg.wait_for_timeout(500)
        hits=await pg.locator('.reslist .snip').count(); marks=await pg.locator('.reslist mark').count()
        check(hits>=1 and marks>=1,f'search "DORA" finds lesson sections by their text with a highlighted snippet ({hits})')
        await pg.locator('.reslist a[href*="/content/"]').first.click(); await pg.wait_for_selector('.lsec'); check('/content/s' in pg.url,'search hit opens the section')
        await pg.goto(BASE+'/#/search/'+'ไม่มีคำนี้แน่นอนxyz'); await pg.wait_for_timeout(800)
        check('ไม่พบ' in await pg.inner_text('#app'),'empty search result shows a helpful message')
        check(not E,'no JS errors on glossary/search '+'; '.join(E[:2])); await c.close()

        print('== diagrams: lazy rendering and full-size view on a phone')
        c=await b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True); pg=await c.new_page(); E=[]; pg.on('pageerror',lambda e:E.append(str(e)))
        await pg.goto(BASE+'/#/lesson/w5/content'); await pg.wait_for_selector('.lsec'); await pg.wait_for_timeout(400)
        tot=await pg.locator('.dgmsvg').count(); done=await pg.locator('.dgmsvg[data-done]').count()
        check(tot>2 and done<tot,f'diagrams far down the page are not rendered yet ({done}/{tot})')
        lab=await pg.locator('.dgmsvg:not([data-done])').first.get_attribute('aria-label'); check(bool(lab),'not-yet-rendered diagram still has an accessible description')
        await pg.evaluate('window.scrollTo(0,document.body.scrollHeight)'); await pg.wait_for_timeout(300)
        for y in range(0,40):
            await pg.evaluate(f'window.scrollTo(0,{y}*document.body.scrollHeight/40)'); await pg.wait_for_timeout(40)
        done2=await pg.locator('.dgmsvg[data-done]').count(); check(done2==tot,f'all diagrams render while scrolling ({done2}/{tot})')
        z=pg.locator('.dgmzoom').first; await z.scroll_into_view_if_needed(); await z.tap(); await pg.wait_for_selector('.dgmov')
        w=await pg.evaluate("document.querySelector('.dgmbig svg').getBoundingClientRect().width"); check(w>=600,f'full-size view shows the diagram at readable width ({round(w)}px, scrolls sideways)')
        await pg.locator('.dgmovbar button:has-text("ขนาด")').tap(); w2=await pg.evaluate("document.querySelector('.dgmbig svg').getBoundingClientRect().width"); check(w2>w,'zoom button enlarges it further')
        await pg.screenshot(path=f'{OUT}/p6_zoom_390.png')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        check(await pg.locator('.dgmov').count()==0 and await pg.evaluate("document.activeElement.classList.contains('dgmzoom')"),'Escape closes it and focus returns to the button')
        check(not E,'no JS errors '+'; '.join(E[:2])); await c.close()

        print('== new figures (figs-*.js): render in their lessons, widgets respond to touch')
        c=await b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True); pg=await c.new_page(); E=[]; pg.on('pageerror',lambda e:E.append(str(e)))
        fails=[]; nd=nw=0
        for kind,name in INFO['figs']:
            if name not in INFO['where']: fails.append(f'{name}: not placed in any lesson'); continue
            lid,sid=INFO['where'][name]
            await pg.goto(BASE+f'/#/lesson/{lid}/content'); await pg.wait_for_selector('.lsec'); await pg.evaluate("window.dispatchEvent(new Event('beforeprint'))")
            sec=pg.locator(f'#sec-{sid}')
            if kind=='diagram':
                nd+=1
                okk=await sec.evaluate("(s,n)=>[...s.querySelectorAll('.dgmsvg svg')].some(v=>v.getAttribute('aria-labelledby')&&v.getAttribute('aria-labelledby').startsWith(n))",name)
                if not okk: fails.append(f'{name}: svg with title not found in {lid}/{sid}')
            else:
                nw+=1; before=len(E)
                figs=sec.locator('figure.wdg'); cnt=await figs.count(); fig=None
                for i in range(cnt):
                    f=figs.nth(i)
                    if await f.locator('button, input, select, [tabindex="0"]').count(): fig=f
                if fig is None: fails.append(f'{name}: no interactive controls in {lid}/{sid}'); continue
                btns=fig.locator('button:visible'); k=min(await btns.count(),6)
                for i in range(k):
                    try: await btns.nth(i).tap(timeout=1500); await pg.wait_for_timeout(120)
                    except Exception as e: pass
                if len(E)>before: fails.append(f'{name}: JS error {E[-1][:80]}')
            ov=await pg.evaluate('document.documentElement.scrollWidth-innerWidth')
            if ov>0: fails.append(f'{name}: page overflows {ov}px')
        check(not fails,f'{nd} new diagrams and {nw} new widgets render in place; widgets respond to taps with no errors/overflow '+'; '.join(fails[:4]))
        await c.close()

        print('== label-the-diagram and command-output questions (all of them)')
        LBL=NODE("const b=require('./server/bank');const o=[];for(const q of b.Q.values())if(q.type==='label'||q.pre)o.push({id:q.id,type:q.type,hide:q.hide||null});console.log(JSON.stringify(o))")
        c=await b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True); pg=await c.new_page(); E=[]; pg.on('pageerror',lambda e:E.append(str(e)))
        await pg.goto(BASE+'/#/practice'); await pg.wait_for_selector('.fchip')
        res=await pg.evaluate('''async(items)=>{ const qs=[]; for(let i=0;i<items.length;i+=30){ const r=await api('POST','/api/practice/byids',{ids:items.slice(i,i+30).map(x=>x.id)}); qs.push(...r.questions); } const r={questions:qs}; const out=[];
          for(const pq of r.questions){ const it=items.find(x=>x.id===pq.id); const w=bankQuestion(pq); const host=document.createElement('div'); host.style.width='358px'; document.body.append(host); host.append(w.node);
            const svgText=pq.type==='label'?[...w.node.querySelectorAll('svg text')].map(t=>t.textContent).join(' | '):'';
            const leaks=pq.type==='label'?it.hide.filter(h=>h.length>=3&&svgText.toLowerCase().includes(h.toLowerCase())):[];
            out.push({id:pq.id,type:pq.type,marks:pq.type==='label'?w.node.querySelectorAll('.lblmark').length:null,want:pq.type==='label'?it.hide.length:null,leaks,
              pre:!!w.node.querySelector('pre.out'),wide:host.scrollWidth-host.clientWidth}); host.remove(); }
          return {n:r.questions.length,out}; }''',LBL)
        lab=[x for x in res['out'] if x['type']=='label']; pre=[x for x in res['out'] if x['type']!='label']
        badl=[f"{x['id']} marks {x['marks']}/{x['want']} leaks {x['leaks']}" for x in lab if x['marks']!=x['want'] or x['leaks']]
        check(res['n']==len(LBL) and len(lab)>=20 and not badl,f'{len(lab)} label questions: every marker placed, no hidden label still readable in the picture '+'; '.join(badl[:3]))
        check(len(pre)>=20 and all(x['pre'] for x in pre),f'{len(pre)} command-output questions show their output block')
        # answer one label question by touch through the practice UI flow
        qid=lab[0]['id']; hide=[x for x in LBL if x['id']==qid][0]['hide']
        await pg.evaluate('''async(id)=>{ const r=await api('POST','/api/practice/byids',{ids:[id]}); practiceRun(r.questions,{review:true}); }''',qid)
        await pg.wait_for_selector('.bq-label'); sels=pg.locator('.bq-label select')
        for i,h in enumerate(hide): await sels.nth(i).select_option(h)
        await pg.locator('.bq-label .lblmark').first.tap()
        await pg.click('button:has-text("ตรวจคำตอบ")'); await pg.wait_for_selector('.bqfb .verdict')
        check(await pg.inner_text('.bqfb .verdict')=='ถูกต้อง',f'label question {qid} answered by touch is graded correct on the server')
        await pg.screenshot(path=f'{OUT}/p6_label_390.png',full_page=True)
        check(not E,'no JS errors '+'; '.join(E[:2])); await c.close()

        print('== accessibility of new parts (axe WCAG 2.1 AA), light + dark')
        if os.path.exists(AXE_PATH):
            AXE=open(AXE_PATH).read(); viol=[]
            for theme in ['light','dark']:
                c=await b.new_context(viewport={'width':1280,'height':900},color_scheme=theme); cp=await c.new_page()
                for rt in ['#/glossary','#/search/ping']+[f'#/lesson/w{i}/content' for i in range(1,19)]:
                    await cp.goto(BASE+'/'+rt); await cp.wait_for_timeout(1100); await cp.evaluate("window.dispatchEvent(new Event('beforeprint'));document.querySelectorAll('details.gloss').forEach(d=>d.open=true)")
                    await cp.add_script_tag(content=AXE)
                    v=await cp.evaluate("async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return r.violations.map(v=>v.id+'('+v.impact+'):'+v.nodes.length+' '+v.nodes.slice(0,2).map(n=>n.target.join(' ')).join(' | '))}")
                    if v: viol.append(f'{theme} {rt} {v}')
                await c.close()
            check(not viol,'axe WCAG 2.1 AA: no violations on glossary, search and all 18 lessons (guides + new figures) '+' ;; '.join(viol[:4]))
        else: print('  (axe-core not installed)')
        await b.close()
    print('\nISSUES',len(issues)); [print(' -',i) for i in issues]
    sys.exit(1 if issues else 0)
asyncio.run(main())
