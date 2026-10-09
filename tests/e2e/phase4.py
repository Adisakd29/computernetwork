import asyncio, json, sys, zipfile, re
from playwright.async_api import async_playwright
SP=sys.argv[1]; BASE='http://127.0.0.1:3990'
ANS=json.load(open(SP+'/bankans.json'))
issues=[]
SOLVER=r"""
(pr) => {
  const ip2i = s => s.split('.').reduce((n,o)=>n*256+ +o,0);
  const i2ip = n => [n>>>24,(n>>>16)&255,(n>>>8)&255,n&255].join('.');
  const mk = p => p? (0xFFFFFFFF << (32-p))>>>0 : 0;
  const net = (ip,p) => (ip & mk(p))>>>0;
  const needH = n => { let h=2; while (2**h-2 < n) h++; return h; };
  const a = {};
  if (pr.kind==='host') {
    const ip = ip2i(pr.ip); const f = ip>>>24;
    let p = pr.mission==='s1' ? (f<128?8:f<192?16:24) : pr.mask ? (32 - Math.log2((~ip2i(pr.mask)>>>0)+1)) : pr.prefix;
    const n = net(ip,p), b = n + 2**(32-p) - 1;
    Object.assign(a,{network:i2ip(n),broadcast:i2ip(b),first:i2ip(n+1),last:i2ip(b-1),hosts:String(2**(32-p)-2)});
    if (pr.mission==='s1') a.cls = f<128?'A':f<192?'B':'C';
    if (pr.mask) a.prefix='/'+p; else a.mask='/'+p;
  } else if (pr.kind==='same') { const x=net(ip2i(pr.ipA),pr.prefix), y=net(ip2i(pr.ipB),pr.prefix); Object.assign(a,{netA:i2ip(x),netB:i2ip(y),same:x===y?'ใช่':'ไม่ใช่'}); }
  else if (pr.kind==='count') { Object.assign(a,{count:String(2**(pr.x-pr.prefix)),hostsPer:String(2**(32-pr.x)-2),nth:i2ip(ip2i(pr.block)+(pr.k-1)*2**(32-pr.x)),forN:'/'+(32-needH(pr.n))}); }
  else if (pr.kind==='vlsm') { const o = pr.reqs.map((r,i)=>i).sort((x,y)=>pr.reqs[y].hosts-pr.reqs[x].hosts||x-y); let c=ip2i(pr.block); for (const i of o){const h=needH(pr.reqs[i].hosts); a['net'+i]=i2ip(c); a['pre'+i]='/'+(32-h); c+=2**h;} }
  return a;
}
"""
def bad(m): issues.append(m); print('  ✗',m)
def ok(m): print('  ✓',m)
def check(c,m): ok(m) if c else bad(m)
FILL=r"""
async ([box, a, wrong]) => {
  const txt = e => e.textContent.trim();
  const clickOpt = (root, text) => { const l=[...root.querySelectorAll('label.opt')].find(l=>txt(l)===text); if(!l) throw new Error('no option '+text); l.querySelector('input').click(); };
  const type = (inp, v) => { inp.value=v; inp.dispatchEvent(new Event('input',{bubbles:true})); };
  const t=a.type;
  if (wrong) { // deliberately wrong / partial answer
    if (t==='tf') { clickOpt(box, a.answer?'ผิด':'ถูก'); return; }
    if (t==='choice' || (t==='diagram' && (a.answerType||'choice')==='choice')) { clickOpt(box, a.options[(a.correct+1)%a.options.length]); return; }
    if (t==='multi' || t==='diagram') { clickOpt(box, a.options[[...a.options.keys()].find(i=>!a.correct.includes(i))]); return; }
    if (t==='scenario') { box.querySelectorAll('.scstep').forEach((s,k)=>{ const o=[...s.querySelectorAll('label.opt')].find(l=>txt(l)!==a.steps[k]); o.querySelector('input').click(); }); return; }
    const s=box.querySelector('select'); if(s){ box.querySelectorAll('select').forEach(x=>{x.selectedIndex=1;x.dispatchEvent(new Event('change',{bubbles:true}));}); return; }
    const b=box.querySelector('.obtn:not([disabled])'); if(b){ b.click(); return; }
    box.querySelectorAll('input[type=text]').forEach(i=>type(i,'1.1.1.1')); return;
  }
  if (t==='choice' || (t==='diagram' && (a.answerType||'choice')==='choice')) clickOpt(box, a.options[a.correct]);
  else if (t==='multi' || t==='diagram') a.correct.forEach(i=>clickOpt(box,a.options[i]));
  else if (t==='tf') clickOpt(box, a.answer?'ถูก':'ผิด');
  else if (t==='match') box.querySelectorAll('select').forEach((s,i)=>{ s.value=String(a.answer[i]); s.dispatchEvent(new Event('change',{bubbles:true})); });
  else if (t==='fill') box.querySelectorAll('input.blank').forEach((i,k)=>type(i,a.blanks[k][0]));
  else if (t==='subnet') { const ins=box.querySelectorAll('.subgrid input'); Object.values(a.sub).forEach((v,k)=>type(ins[k],v)); }
  else if (t==='command') type(box.querySelector('.cmdin'), a.example);
  else if (t==='scenario') box.querySelectorAll('.scstep').forEach((s,k)=>clickOpt(s,a.steps[k]));
  else if (t==='order') {
    for (let tgt=0; tgt<a.items.length; tgt++) {
      for (let guard=0; guard<10; guard++) {
        const lis=[...box.querySelectorAll('.oitem')]; const cur=lis.findIndex(li=>txt(li.querySelector('.ot'))===a.items[tgt]);
        if (cur<=tgt) break; lis[cur].querySelector('.obtn').click();
      }
    }
  }
}
"""
async def errs_of(pg):
    E=[]; pg.on('pageerror',lambda e: E.append(str(e))); return E

async def login(ctx,u,p):
    r=await ctx.request.post(BASE+'/api/auth/login',data={'username':u,'password':p},headers={'X-NetLab':'1'})
    assert r.ok, await r.text()

async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        # ---------------- guest: sims hub + every simulator mounts ----------------
        print('== guest: simulators')
        g=await b.new_context(viewport={'width':1280,'height':900}); pg=await g.new_page(); E=await errs_of(pg)
        await pg.goto(BASE+'/#/sims'); await pg.wait_for_selector('.simcard')
        check(await pg.locator('.simcard').count()==5,'sims hub shows 5 simulators')
        nav=await pg.locator('#side nav').inner_text(); check('ห้องปฏิบัติการจำลอง' in nav and 'ฝึกทำข้อสอบ' in nav,'sidebar links to simulators and practice')
        check('การสอบ' not in nav,'exam link hidden for guests')
        for sid in ['topology','subnet','crimp','terminal','troubleshoot']:
            await pg.goto(BASE+'/#/sim/'+sid); await pg.wait_for_function('document.querySelector(".simroot") && document.querySelector(".simroot").children.length>0',timeout=15000)
            n=await pg.evaluate('document.querySelector(".simroot").querySelectorAll("*").length'); check(n>30,f'{sid} mounted in app ({n} elements)')
            await pg.screenshot(path=f'{SP}/p4_sim_{sid}.png')
        await pg.goto(BASE+'/#/rooms'); await pg.wait_for_selector('.room')
        check(await pg.evaluate('typeof SIMI')=='object' and await pg.evaluate('SIMI===null'),'leaving a simulator destroys it')
        check(not E,'no JS errors on sim pages: '+'; '.join(E[:3]))
        # ---------------- guest: practice all 10 types with correct answers ----------------
        print('== guest: practice mode')
        await pg.goto(BASE+'/#/practice'); await pg.wait_for_selector('.fchip')
        await pg.screenshot(path=SP+'/p4_practice_setup.png',full_page=True)
        seen={}; wrongs=0
        for rnd in range(5):
            await pg.goto(BASE+'/#/learn'); await pg.goto(BASE+'/#/practice'); await pg.wait_for_selector('.fchip')
            if rnd==2: await pg.click('.fchip:has-text("พิมพ์คำสั่ง")')
            if rnd==3: await pg.click('.fchip:has-text("พิมพ์คำสั่ง")'); await pg.click('.fchip:has-text("คำนวณ Subnet")')
            if rnd==4: await pg.click('.fchip:has-text("คำนวณ Subnet")'); await pg.click('.fchip:has-text("เรียงลำดับ")')
            N=5 if rnd in (2,3) else 20
            await pg.select_option('.panel select',str(N))
            await pg.click('button:has-text("เริ่มฝึก")'); await pg.wait_for_selector('.bqcard')
            for i in range(N):
                await pg.wait_for_selector('.bq[data-qid]')
                if rnd in (2,3) and ANS[await pg.get_attribute('.bq','data-qid')]['type']!=('command' if rnd==2 else 'subnet'): bad('type filter ignored')
                if rnd==4 and ANS[await pg.get_attribute('.bq','data-qid')]['type']!='order': bad('type filter ignored')
                qid=await pg.get_attribute('.bq','data-qid'); a=ANS[qid]
                wrong = (i%7==3)
                btn=pg.locator('button:has-text("ตรวจคำตอบ")')
                check(await btn.is_disabled(),'check button disabled before answering') if i==0 and rnd==0 else None
                await pg.evaluate(FILL,[await pg.query_selector('.bq'),a,wrong])
                if a['type']=='order' and wrong:
                    pass
                await btn.click(); await pg.wait_for_selector('.bqfb .verdict')
                v=await pg.inner_text('.bqfb .verdict')
                if 'null' in await pg.inner_text('.bqfb'): bad(qid+' feedback contains "null"')
                if wrong:
                    wrongs+=1
                    if v=='ถูกต้อง': bad(f'{qid} ({a["type"]}) wrong answer graded correct')
                    else:
                        fb=await pg.inner_text('.bqfb'); 
                        if 'คำตอบที่ถูก' not in fb and a['type'] not in ('order',): bad(f'{qid} wrong-answer feedback lacks correct answer: {fb[:80]}')
                else:
                    seen.setdefault(a['type'],[0,0]); seen[a['type']][1]+=1
                    if v=='ถูกต้อง': seen[a['type']][0]+=1
                    else: bad(f'{qid} ({a["type"]}) correct answer via UI graded: {v}')
                if i==2 and rnd==0: await pg.screenshot(path=SP+'/p4_practice_q.png',full_page=True)
                await pg.click('button:has-text("ข้อต่อไป"), button:has-text("ดูสรุปผล")')
            await pg.wait_for_selector('.scorebig')
        TH={'choice':'ปรนัย','multi':'เลือกได้หลายข้อ','tf':'ถูก/ผิด','match':'จับคู่','order':'เรียงลำดับ','fill':'เติมคำ','subnet':'คำนวณ Subnet','diagram':'วิเคราะห์แผนผัง','command':'พิมพ์คำสั่ง','scenario':'สถานการณ์แก้ปัญหา'}
        for typ in [t for t in TH if t not in seen]:   # top up any type the random rounds missed
            await pg.evaluate('localStorage.removeItem("netlab-practice")'); await pg.goto(BASE+'/#/learn'); await pg.goto(BASE+'/#/practice'); await pg.wait_for_selector('.fchip')
            await pg.click(f'.fchip:text-is("{TH[typ]}")'); await pg.select_option('.panel select','5'); await pg.click('button:has-text("เริ่มฝึก")')
            for i in range(5):
                await pg.wait_for_selector('.bq[data-qid]'); qid=await pg.get_attribute('.bq','data-qid'); a=ANS[qid]
                await pg.evaluate(FILL,[await pg.query_selector('.bq'),a,False]); await pg.click('button:has-text("ตรวจคำตอบ")'); await pg.wait_for_selector('.bqfb .verdict')
                v=await pg.inner_text('.bqfb .verdict'); seen.setdefault(a['type'],[0,0]); seen[a['type']][1]+=1
                if v=='ถูกต้อง': seen[a['type']][0]+=1
                else: bad(f'{qid} ({a["type"]}) correct answer via UI graded: {v}')
                await pg.click('button:has-text("ข้อต่อไป"), button:has-text("ดูสรุปผล")')
        print('   per type (right/attempted):',seen)
        check(len(seen)==10,f'practice covered {len(seen)}/10 question types')
        check(all(v[0]==v[1] for v in seen.values()),'every correct answer entered through the UI was graded correct')
        await pg.screenshot(path=SP+'/p4_practice_done.png',full_page=True)
        check(not E,'no JS errors in practice: '+'; '.join(E[:3]))
        await g.close()

        # ---------------- teacher creates exam ----------------
        print('== teacher: create exam')
        t=await b.new_context(viewport={'width':1280,'height':900},accept_downloads=True); await login(t,'kru4','Teach1234')
        tp=await t.new_page(); TE=await errs_of(tp); tp.on('dialog',lambda d: asyncio.ensure_future(d.accept()))
        await tp.goto(BASE+'/teacher.html'); await tp.wait_for_selector('.side')
        await tp.locator('.side .navbtn',has_text='ปวช.2/4').click(); await tp.wait_for_selector('.tabs')
        await tp.locator('.tabs button',has_text='การสอบ').click(); await tp.wait_for_selector('text=สร้างการสอบ')
        await tp.click('button:has-text("+ สร้างการสอบ")'); await tp.wait_for_selector('form.card .labpick')
        await tp.fill('form.card input[type=text]','สอบย่อย หน่วย 3')
        await tp.click('form.card button[type=submit]'); await tp.wait_for_timeout(300)
        m=await tp.inner_text('form.card .msg.bad'); check('หน่วย' in m,'validation: must choose a unit ('+m+')')
        await tp.check('.labpick input[value="3"]')
        await tp.check('.labpick input[value="6"]')
        nums=tp.locator('form.card input[type=number]')
        await nums.nth(0).fill('3'); await nums.nth(1).fill('3'); await nums.nth(2).fill('2'); await nums.nth(3).fill('15')
        info=await tp.inner_text('form.card p.muted >> nth=0'); check('รวม 8 ข้อ' in info,'live count shows total 8 ('+info[:60]+')')
        await tp.screenshot(path=SP+'/p4_t_examform.png',full_page=True)
        await tp.click('form.card button[type=submit]'); await tp.wait_for_selector('td:has-text("สอบย่อย หน่วย 3")')
        row=await tp.locator('tr',has_text='สอบย่อย หน่วย 3').inner_text(); check('เปิดสอบ' in row and '8' in row,'exam listed as open with 8 questions')
        # second exam that opens in future
        await tp.click('button:has-text("+ สร้างการสอบ")'); await tp.wait_for_selector('form.card .labpick')
        await tp.fill('form.card input[type=text]','สอบปลายภาค'); await tp.check('.labpick input[value="1"]')
        await tp.fill('form.card input[type=datetime-local] >> nth=0','2031-01-01T08:00')
        await tp.click('form.card button[type=submit]'); await tp.wait_for_selector('td:has-text("สอบปลายภาค")')
        check('ยังไม่เปิด' in await tp.locator('tr',has_text='สอบปลายภาค').inner_text(),'future exam shows "not open yet"')

        # ---------------- student takes exam ----------------
        print('== student: exam')
        s=await b.new_context(viewport={'width':1280,'height':900}); await login(s,'s1','Stud1234')
        sp=await s.new_page(); SE=await errs_of(sp); sp.on('dialog',lambda d: asyncio.ensure_future(d.accept()))
        await sp.goto(BASE+'/#/exams'); await sp.wait_for_selector('.examcard')
        check(await sp.locator('.examcard').count()==2,'student sees 2 exams')
        check('การสอบ' in await sp.locator('#side nav').inner_text(),'exam link shown when logged in')
        await sp.locator('.examcard',has_text='สอบปลายภาค').click(); await sp.wait_for_selector('h1:has-text("สอบปลายภาค")')
        check(await sp.locator('button:has-text("เริ่มทำข้อสอบ")').count()==0,'cannot start an exam that is not open')
        await sp.goto(BASE+'/#/exams'); await sp.locator('.examcard',has_text='สอบย่อย').click(); await sp.click('button:has-text("เริ่มทำข้อสอบ")')
        await sp.wait_for_selector('.exambar'); qs=await sp.locator('.bq[data-qid]').count(); check(qs==8,f'exam has {qs} questions')
        clock=await sp.inner_text('.exambar .clock'); check(re.match(r'1[45]:\d\d',clock) is not None,'timer counts down from 15 min ('+clock+')')
        ids=[await x.get_attribute('data-qid') for x in await sp.query_selector_all('.bq[data-qid]')]
        check(all(ANS[i]['type'] for i in ids) and len(set(ANS[i]['type'] for i in ids))>=1,'exam questions drawn from bank: '+','.join(ids))
        boxes=await sp.query_selector_all('.bq[data-qid]')
        for k,(bx,i) in enumerate(zip(boxes,ids)):
            if k==7: break   # leave last unanswered for now
            await sp.evaluate(FILL,[bx,ANS[i],k==0])   # first one deliberately wrong
        await sp.wait_for_timeout(2500)
        sv=await sp.inner_text('.exambar'); check('บันทึกแล้ว' in sv,'answers autosaved to server')
        done=await sp.locator('.qn.done').count(); check(done==7,f'question navigator marks {done}/8 answered')
        await sp.screenshot(path=SP+'/p4_exam.png',full_page=True)
        # resume after reload, server-side copy (clear local copy first)
        await sp.evaluate('Object.keys(localStorage).filter(k=>k.startsWith("netlab-exam-")).forEach(k=>localStorage.removeItem(k))')
        await sp.reload(); await sp.wait_for_selector('.exambar')
        done2=await sp.locator('.qn.done').count(); check(done2==7,f'after reload answers restored from server ({done2}/8)')
        ids2=[await x.get_attribute('data-qid') for x in await sp.query_selector_all('.bq[data-qid]')]
        check(ids2==ids,'same questions after reload')
        # can't start twice / question set fixed: answer last one, submit
        boxes=await sp.query_selector_all('.bq[data-qid]')
        await sp.evaluate(FILL,[boxes[7],ANS[ids[7]],False])
        await sp.click('.exambar button:has-text("ส่งข้อสอบ")'); await sp.wait_for_selector('.scorebig')
        sc=await sp.inner_text('.scorebig'); print('   exam score',sc)
        mx=re.search(r'([\d.]+)/(\d+)',sc); score=float(mx.group(1)); mxv=int(mx.group(2))
        check(mxv==8 and 6.9<=score<8,'score reflects 7 correct + 1 wrong (got '+sc.replace('\n',' ')+')')
        check('{{' not in await sp.inner_text('.review'),'review hides fill-in markers')
        check(await sp.locator('.review li').count()==8,'review with answers and explanations shown after submit')
        await sp.screenshot(path=SP+'/p4_exam_result.png',full_page=True)
        r=await s.request.put(BASE+'/api/exams/1/answers',data={'answers':{ids[0]:0}},headers={'X-NetLab':'1'})
        check(r.status in (400,409),f'changing answers after submit is refused (HTTP {r.status})')
        r=await s.request.post(BASE+'/api/exams/1/start',headers={'X-NetLab':'1'}); j=await r.json()
        check(j.get('submitted') or r.status>=400,'starting again does not give a new attempt')
        r=await s.request.get(BASE+'/api/teacher/classes/1/exams'); check(r.status==403,f'student blocked from teacher exam API ({r.status})')

        # ---------------- student: subnet simulator mission through the app ----------------
        print('== student: simulator scoring')
        await sp.goto(BASE+'/#/sim/subnet'); await sp.wait_for_selector('.nls-subnet-mbtn')
        await sp.click('[data-mission="s2"]')
        async with sp.expect_response(lambda r: r.url.endswith('/api/sims/subnet/new')) as rr:
            await sp.click('[data-act="new"]')
        prob=(await (await rr.value).json())['problem']; prob['mission']='s2'
        await sp.wait_for_selector('[data-key]')
        ans=await sp.evaluate(SOLVER,prob)
        for k,v in ans.items():
            loc=sp.locator(f'[data-key="{k}"]')
            if await loc.evaluate('e=>e.tagName')=='SELECT': await loc.select_option(v)
            else: await loc.fill(v)
        await sp.click('button[type=submit]'); await sp.wait_for_selector('.nls-subnet-score')
        check('10/10' in await sp.inner_text('.nls-subnet-score'),'subnet mission solved in app = 10/10')
        d=await (await s.request.get(BASE+'/api/sims/subnet')).json()
        check(d['done'].get('s2',{}).get('best')==10,'best score stored on server')
        r=await s.request.post(BASE+'/api/sims/subnet/submit',data={'mission':'s2','payload':{'answers':ans},'token':'forged.token'},headers={'X-NetLab':'1'})
        check(r.status==400,'forged problem token rejected')
        await sp.goto(BASE+'/#/sims'); await sp.wait_for_selector('.simcard')
        st=await sp.locator('.simcard',has_text='Subnet').inner_text(); check('1/' in st,'hub shows 1 mission passed for subnet')
        check(not SE,'no JS errors for student: '+'; '.join(SE[:3]))

        # ---------------- teacher: results ----------------
        print('== teacher: results')
        await tp.reload(); await tp.wait_for_selector('.side')
        await tp.locator('.side .navbtn',has_text='ปวช.2/4').click(); await tp.wait_for_selector('.tabs')
        await tp.locator('.tabs button',has_text='การสอบ').click(); await tp.wait_for_selector('td:has-text("สอบย่อย")')
        await tp.locator('tr',has_text='สอบย่อย').locator('button:has-text("ผลสอบ")').click(); await tp.wait_for_selector('text=วิเคราะห์รายข้อ')
        txt=await tp.inner_text('main')
        check('สมชาย ทดสอบ' in txt and 'ส่งแล้ว' in txt and 'ยังไม่สอบ' in txt,'results table shows submitted and not-yet students')
        check(await tp.locator('main table >> nth=1').locator('tr').count()==9,'item analysis lists 8 questions')
        await tp.screenshot(path=SP+'/p4_t_results.png',full_page=True)
        async with tp.expect_download() as dl: await tp.click('text=ส่งออก Excel')
        f=await dl.value; await f.save_as(SP+'/p4_exam.xlsx'); check(zipfile.is_zipfile(SP+'/p4_exam.xlsx'),'exam Excel export downloads')
        await tp.locator('tr',has_text='สมชาย').locator('button:has-text("ให้สอบใหม่")').click(); await tp.wait_for_timeout(800)
        check('ยังไม่สอบ' in await tp.locator('tr',has_text='สมชาย').inner_text(),'teacher reset lets student retake')
        await tp.click('button:has-text("‹ รายการสอบ")'); await tp.wait_for_selector('td:has-text("สอบปลายภาค")')
        await tp.locator('tr',has_text='สอบปลายภาค').locator('button:has-text("แก้ไข")').click(); await tp.wait_for_selector('form.card')
        await tp.fill('form.card input[type=datetime-local] >> nth=0',''); await tp.fill('form.card input[type=text]','สอบปลายภาค (แก้ไข)')
        await tp.click('form.card button[type=submit]'); await tp.wait_for_selector('td:has-text("สอบปลายภาค (แก้ไข)")')
        check('เปิดสอบ' in await tp.locator('tr',has_text='สอบปลายภาค (แก้ไข)').inner_text(),'edit exam: title and open time changed')
        await tp.locator('tr',has_text='สอบปลายภาค (แก้ไข)').locator('button:has-text("ลบ")').click(); await tp.wait_for_timeout(800)
        check(await tp.locator('td:has-text("สอบปลายภาค")').count()==0,'delete exam works')
        await tp.locator('.tabs button',has_text='ห้องจำลอง').click(); await tp.wait_for_selector('.matrix')
        await tp.click('button:has-text("ฝึกคำนวณ"), .row button >> nth=1')
        await tp.wait_for_timeout(300)
        mt=await tp.inner_text('main'); check('สมชาย ทดสอบ' in mt,'simulator matrix lists students')
        found=False
        for k in range(5):
            await tp.locator('.row.noprint button').nth(k).click(); await tp.wait_for_timeout(150)
            if await tp.locator('.matrix td.cell.finished').count()>0: found=True; break
        check(found,'simulator matrix shows the full-score mission')
        await tp.screenshot(path=SP+'/p4_t_sims.png',full_page=True)
        check(not TE,'no JS errors on teacher page: '+'; '.join(TE[:3]))

        # ---------------- phone width + dark ----------------
        print('== phone / dark')
        mp=await s.new_page(); await mp.set_viewport_size({'width':390,'height':844}); ME=await errs_of(mp)
        for h in ['#/sims','#/practice','#/exams','#/sim/topology','#/sim/subnet','#/sim/crimp','#/sim/terminal','#/sim/troubleshoot']:
            await mp.goto(BASE+'/'+h); await mp.wait_for_timeout(1200)
            ov=await mp.evaluate('document.documentElement.scrollWidth-innerWidth'); check(ov<=0,f'{h} fits 390px (overflow {ov})')
        await mp.goto(BASE+'/#/practice'); await mp.wait_for_selector('.fchip'); await mp.click('button:has-text("เริ่มฝึก")'); await mp.wait_for_selector('.bq')
        for i in range(8):
            ov=await mp.evaluate('document.documentElement.scrollWidth-innerWidth')
            if ov>0: bad(f'practice question {await mp.get_attribute(".bq","class")} overflows {ov}px')
            qid=await mp.get_attribute('.bq','data-qid'); await mp.evaluate(FILL,[await mp.query_selector('.bq'),ANS[qid],False])
            await mp.click('button:has-text("ตรวจคำตอบ")'); await mp.wait_for_selector('.bqfb .verdict')
            ov=await mp.evaluate('document.documentElement.scrollWidth-innerWidth')
            if ov>0: bad(f'feedback for {qid} overflows {ov}px')
            if i==1: await mp.screenshot(path=SP+'/p4_m_practice.png',full_page=True)
            await mp.click('button:has-text("ข้อต่อไป"), button:has-text("ดูสรุปผล")')
        await mp.goto(BASE+'/#/exams'); await mp.locator('.examcard',has_text='สอบย่อย').click(); await mp.click('button:has-text("เริ่มทำข้อสอบ")'); await mp.wait_for_selector('.exambar')
        ov=await mp.evaluate('document.documentElement.scrollWidth-innerWidth'); check(ov<=0,f'exam page fits phone ({ov})')
        await mp.screenshot(path=SP+'/p4_m_exam.png')
        await mp.emulate_media(color_scheme='dark'); await mp.goto(BASE+'/#/sims'); await mp.wait_for_selector('.simcard'); await mp.screenshot(path=SP+'/p4_m_dark_sims.png',full_page=True)
        await mp.goto(BASE+'/#/practice'); await mp.wait_for_selector('.fchip'); await mp.click('button:has-text("เริ่มฝึก")'); await mp.wait_for_selector('.bq'); await mp.screenshot(path=SP+'/p4_m_dark_q.png',full_page=True)
        check(not ME,'no JS errors on phone: '+'; '.join(ME[:3]))
        await b.close()
    print('\nISSUES',len(issues)); [print(' -',i) for i in issues]
asyncio.run(main())

sys.exit(1 if issues else 0)
