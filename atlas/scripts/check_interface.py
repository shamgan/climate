import functools, http.server, json, pathlib, threading, gzip, struct, os
from playwright.sync_api import sync_playwright

root=pathlib.Path(__file__).parent.parent
class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/'
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get('ATLAS_CHROMIUM_PATH'))
    page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda e:(errors.append(str(e)),print('PAGE_ERROR='+str(e),flush=True)))
    page.goto(url);page.wait_for_function('ready && window.atlasInterface')
    def click(s):
        if s=='#atlasReset' and page.locator('#mapDrawer').evaluate("d=>d.matches(':modal')"):page.locator('#closeDrawer').click()
        page.locator(s).click()
        if s.startswith('[data-month=') or s.startswith('[data-field='):page.wait_for_function('document.querySelector("#layerStatus").hidden',timeout=60000)
    def dock(name):
        if not page.locator('#mapDrawer').is_visible(): click('#openDrawer')
        click('#tab'+name.capitalize())
    def settings():
        dock('layers')
        if not page.locator('.display-settings').evaluate('e=>e.open'): click('.display-settings summary')
    def info(kind='data'):
        dock('info')
        if page.locator('#infoChoices').is_visible(): click('#'+kind+'Info')
    def shot(name): page.screenshot(path=str(root/(name+'.png')),full_page=True)
    assert page.locator('.latitude-label').count()==5
    assert page.locator('#mapStage button').count()==0
    assert page.evaluate('state.framing==="height" && Math.abs(H*view.s-cssH)<2')
    assert page.locator('#openDrawer').is_hidden()
    assert page.locator('#resetView').is_hidden()
    assert page.locator('.map-tools #atlasReset').is_visible()
    assert not page.locator('#learningAccordion').evaluate('e=>e.open')
    for selector in ['.drawer-bottom .creator-credit','.drawer-brand .eyebrow']:
        assert page.locator(selector).evaluate('e=>parseFloat(getComputedStyle(e).fontSize)')>=12,selector
    normal_size=page.locator('#currentsToggle').evaluate('e=>parseFloat(getComputedStyle(e).fontSize)')
    normal_lat=page.locator('.latitude-label').first.evaluate('e=>parseFloat(getComputedStyle(e).fontSize)')
    def continent_font():
        return page.evaluate('''()=>{
          const fonts=[],old=ctx.fillText;ctx.fillText=function(t,...args){fonts.push(parseFloat(this.font.match(/[\\d.]+(?=px)/)[0])*view.s);return old.call(this,t,...args)};
          try{draw()}finally{ctx.fillText=old}return Math.max(...fonts);
        }''')
    normal_canvas=continent_font()
    click('#fontSize')
    assert page.locator('#currentsToggle').evaluate('e=>parseFloat(getComputedStyle(e).fontSize)')>=normal_size*1.35
    assert page.locator('.latitude-label').first.evaluate('e=>parseFloat(getComputedStyle(e).fontSize)')>=normal_lat*1.35
    assert continent_font()>=normal_canvas*1.30
    assert page.evaluate('document.scrollingElement.scrollHeight<=innerHeight+1 && document.scrollingElement.scrollWidth<=innerWidth')
    click('#fontSize')
    assert page.locator('#mapStage').bounding_box()['y']<=1
    assert not page.locator('.masthead,.header-menu').count()
    assert page.locator('#mapDrawer .drawer-brand h1').count()==1
    assert page.locator('.drawer-bottom #sources').count()==1 and page.locator('.drawer-bottom #fontSize').count()==1
    shot('ui-desktop')
    width=page.locator('#mapStage').bounding_box()['width']
    click('#closeDrawer');assert page.locator('#mapStage').bounding_box()['width']>width+250
    click('#openDrawer');page.locator('#tabLayers').focus();page.keyboard.press('ArrowLeft')
    assert page.locator('#tabLegend').get_attribute('aria-selected')=='true'
    page.keyboard.press('Escape');assert not page.locator('#mapDrawer').is_visible()
    dock('legend');click('#legendItems [data-region="101"]')
    assert page.locator('#tabInfo').get_attribute('aria-selected')=='true'
    assert page.evaluate('state.selected')==101
    dock('legend');click('#clear');assert page.evaluate('state.selected')==0
    click('#navWorld')
    dock('layers');click('#currentsToggle');click('#openCurrents')
    assert page.locator('#currentLegend').is_visible()
    assert page.locator('#currentSelect option').count()==30
    assert 3<=page.locator('.current-map-label').count()<=7
    settings();click('#currentLabelsToggle');assert not page.locator('#currentMapLabels').is_visible()
    click('#currentLabelsToggle');assert page.locator('.current-map-label').count()>=3
    info('current');page.locator('#currentSelect').select_option('gulf')
    assert page.locator('.current-card dd').count()==4
    assert page.locator('.current-source a').count()>=1
    page.locator('#currentBasin').select_option('indian');page.locator('#currentType').select_option('cold')
    assert page.locator('#currentSelect option').count()==2
    assert 'מערב אוסטרליה' in page.locator('#currentSelect').inner_text()
    page.locator('#currentType').select_option('all');page.locator('#currentSelect').select_option('leeuwin')
    assert 'דרומה' in page.locator('#currentDetails').inner_text()
    click('#resetCurrent');assert page.locator('.current-card').count()==0
    page.locator('#currentSelect').select_option('leeuwin');click('#focusCurrent')
    assert page.evaluate('state.zoom')==3
    click('#navWorld');page.locator('#currentBasin').select_option('all')
    jan=page.locator('#map').evaluate('(c)=>c.toDataURL()')
    dock('layers');click('[data-month="7"]');assert jan!=page.locator('#map').evaluate('(c)=>c.toDataURL()')
    info('current');page.locator('#currentSelect').select_option('monsoon');shot('currents-desktop')
    dock('layers')
    detail_height=page.locator('#climateDetail').bounding_box()['height']
    addition_y=page.locator('#currentsToggle').bounding_box()['y']
    click('[data-field="temperature"]')
    assert page.locator('#climateDetail').is_visible()
    assert page.locator('#climateDetail').get_attribute('aria-disabled')=='true'
    assert page.locator('#mainMode').is_disabled() and page.locator('#detailMode').is_disabled()
    assert abs(page.locator('#climateDetail').bounding_box()['height']-detail_height)<2
    assert abs(page.locator('#currentsToggle').bounding_box()['y']-addition_y)<2
    assert page.locator('.map-summary #monthControl').is_visible()
    assert page.locator('.month-track [data-month]').count()==12
    assert not page.locator('#backToClimate').count()
    page.wait_for_function('document.querySelector("#layerStatus").hidden')
    assert page.locator('#compactLegend .field-gradient').is_visible()
    shot('currents-over-temperature')
    page.wait_for_function('["temperature","precipitation"].every(k=>[1,7].every(m=>climateLayers.loadedFrames()[k].includes(m)))',timeout=60000)
    info();page.locator('#sampleLocation').select_option('3')
    readout=page.locator('#pointReadout').inner_text();print('MUMBAI_VALUES='+readout)
    manifest=json.loads((root/'data/era5/manifest.json').read_text())
    assert manifest['gridStepDegrees']==.25
    for key in ['temperature','precipitation']:
        layer=manifest['layers'][key]
        assert len(layer['latitudes'])==721 and len(layer['longitudes'])==1440
        row=min(range(721),key=lambda i:abs(layer['latitudes'][i]-19.1));col=min(range(1440),key=lambda i:abs(layer['longitudes'][i]-72.9))
        for month in [1,7]:
            raw=gzip.decompress((root/layer['frames'][str(month)]['url']).read_bytes())
            value=struct.unpack_from('<H',raw,2*(row*1440+col))[0]/10+layer['offset']
            expected=f'{value:.1f}' if key=='temperature' else str(round(value))
            assert expected in readout,(key,month,expected)
    # A non-seasonal month uses a genuine source frame, and playback can pause.
    click('[data-month="2"]')
    selected=json.loads((root/'data/cities/climatology.json').read_text(encoding='utf-8'))['cities'][3]
    assert str(selected['temperature'][1]) in page.locator('#pointReadout').inner_text()
    assert 'פברואר' in page.locator('#monthPlaybackStatus').inner_text()
    click('#playMonths')
    page.wait_for_function('climateLayers.settings.month!==2 && document.querySelector("#layerStatus").hidden',timeout=60000)
    click('#playMonths')
    paused_month=page.evaluate('climateLayers.settings.month')
    page.wait_for_timeout(1600)
    assert page.evaluate('climateLayers.settings.month')==paused_month
    assert page.locator('#playMonths').get_attribute('aria-pressed')=='false'
    click('[data-month="7"]')
    # Click feedback identifies a sourced location and retains its exact anchor.
    point=[20,5]
    xy=page.evaluate('p=>{const v=projection(p),r=canvas.getBoundingClientRect();return [r.left+view.x+v[0]*view.s,r.top+view.y+v[1]*view.s]}',point)
    page.mouse.click(*xy);page.wait_for_function('document.querySelector("#selectedPointMarker") && !document.querySelector("#selectedPointMarker").hidden')
    page.wait_for_function('window.atlasPlaces && atlasPlaces.ready()',timeout=60000)
    pin=page.locator('#selectedPointMarker')
    projected=page.evaluate('()=>{const p=projection(climateLayers.settings.point);return [view.x+p[0]*view.s,view.y+p[1]*view.s]}')
    actual=pin.evaluate('e=>[parseFloat(e.style.left),parseFloat(e.style.top)]')
    assert sum((a-b)**2 for a,b in zip(actual,projected))<.01,(actual,projected)
    name=page.evaluate('atlasPlaceName(climateLayers.settings.point)')
    assert name and name in page.locator('.point-place').inner_text()
    assert 'נקודה שנבחרה' not in page.locator('.point-place').inner_text()
    retained=page.evaluate('climateLayers.settings.point')
    click('[data-month="1"]');assert page.evaluate('climateLayers.settings.point')==retained and pin.is_visible()
    xy=page.evaluate('p=>{const v=projection(p),r=canvas.getBoundingClientRect();return [r.left+view.x+v[0]*view.s,r.top+view.y+v[1]*view.s]}',point)
    page.mouse.move(*xy);assert page.locator('#tooltip').is_visible()
    assert '°C' in page.locator('#tooltip').inner_text()
    assert page.locator('#compactLegend .field-value-indicator').is_visible()
    tick_text=page.locator('#compactLegend .field-ticks').inner_text()
    for tick in range(-60,41,10):assert str(tick) in tick_text
    shot('ui-hover-selected-point')
    page.mouse.move(1430,10);assert page.locator('#compactLegend .field-value-indicator').is_hidden()
    info();page.locator('#sampleLocation').select_option('3')
    # The large mode also redraws the existing SVG climograph, without clipping.
    svg_normal=page.locator('#cityCard svg g').get_attribute('font-size')
    click('#fontSize')
    assert float(page.locator('#cityCard svg g').get_attribute('font-size'))>=float(svg_normal)*1.35
    for i in range(20):
        page.locator('#sampleLocation').select_option(str(i))
        assert page.locator('#cityCard svg').evaluate('''svg=>{
          const b=svg.viewBox.baseVal;
          return [...svg.querySelectorAll('text')].every(t=>{const r=t.getBBox();return r.x>=-1&&r.y>=-1&&r.x+r.width<=b.width+1&&r.y+r.height<=b.height+1});
        }''')
    shot('fullscreen-large-city')
    click('#fontSize')
    dock('layers');click('#currentsToggle');settings();click('#showLabels');info();shot('temperature-desktop')
    click('#zoomIn');click('#zoomIn');shot('temperature-zoom');click('#navWorld')
    ticks=page.locator('#compactLegend .field-ticks').inner_text()
    dock('layers');click('[data-month="1"]');assert ticks==page.locator('#compactLegend .field-ticks').inner_text()
    click('[data-field="precipitation"]');assert page.locator('[data-field="temperature"]').get_attribute('aria-pressed')=='false'
    assert page.locator('[data-field="precipitation"]').get_attribute('aria-pressed')=='true'
    click('[data-month="7"]');info();page.locator('#sampleLocation').select_option('3');shot('precipitation-desktop')
    dock('layers');click('#climateBase');click('#detailMode');dock('legend')
    assert page.locator('#legendItems button').count()==13
    click('#clear');info();click('[data-tab="compare"]');assert page.evaluate('state.tab')=='compare'
    click('[data-tab="inquiry"]');assert page.evaluate('state.tab')=='inquiry'
    dock('layers');click('#mainMode')
    page.set_viewport_size({'width':390,'height':844})
    page.wait_for_function('!document.querySelector("#mapDrawer").open')
    assert page.locator('#mapStage').bounding_box()['y']<200
    assert page.locator('#mapStage').bounding_box()['height']>400
    assert page.evaluate('document.scrollingElement.scrollHeight<=innerHeight+1')
    assert page.locator('.latitude-label:visible').count()==0 and page.evaluate('state.latitudes')
    assert page.evaluate('state.framing!=="world" || state.zoom===1')
    shot('ui-mobile');dock('layers')
    assert page.locator('#mapDrawer').evaluate("d=>d.matches(':modal')")
    sheet=page.locator('#mapDrawer').bounding_box()
    assert sheet['y']>0 and abs(sheet['y']+sheet['height']-844)<2
    assert page.locator('#sheetHandle').is_visible()
    shot('ui-mobile-controls')
    for _ in range(20):
        page.keyboard.press('Tab')
        assert page.evaluate('document.querySelector("#mapDrawer").contains(document.activeElement)')
    page.keyboard.press('Escape');assert not page.locator('#mapDrawer').is_visible()
    assert page.locator('#openDrawer').evaluate('e=>e===document.activeElement')
    dock('layers');click('[data-field="precipitation"]');click('#applyDrawer');shot('layers-mobile')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    dock('layers');click('#latitudes');assert not page.evaluate('state.latitudes')
    click('#latitudes');assert page.evaluate('state.latitudes') and page.locator('.latitude-label:visible').count()==0;click('#applyDrawer')
    dock('layers');click('#fontSize');assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    dock('layers');click('#sources');assert page.locator('#sourceDialog').is_visible();click('#closeSources')
    retry=browser.new_page();retry.on('pageerror',lambda e:errors.append(str(e)))
    retry.route('**/data/era5/manifest.json*',lambda route:route.fulfill(status=503,body='unavailable'))
    retry.goto(url);retry.wait_for_function('ready && window.atlasInterface')
    retry.locator('[data-field="temperature"]').click();retry.locator('#retryLayer').wait_for()
    assert retry.locator('#layerStatus').is_visible()
    retry.unroute('**/data/era5/manifest.json*');retry.locator('#retryLayer').click()
    retry.wait_for_function('document.querySelector("#layerStatus").hidden')
    # A missing individual month must report an error, never reuse another month.
    retry.route('**/data/era5/temperature-03.bin.gz*',lambda route:route.fulfill(status=503,body='unavailable'))
    retry.locator('[data-month="2"]').click();retry.wait_for_function('document.querySelector("#layerStatus").hidden')
    retry.locator('#playMonths').click();retry.locator('#retryLayer').wait_for()
    assert retry.locator('#layerStatus').is_visible()
    assert retry.evaluate('climateLayers.settings.month')==3
    assert 3 not in retry.evaluate('climateLayers.loadedFrames().temperature')
    assert retry.locator('#playMonths').get_attribute('aria-pressed')=='false'
    retry.unroute('**/data/era5/temperature-03.bin.gz*');retry.locator('#retryLayer').click()
    retry.wait_for_function('document.querySelector("#layerStatus").hidden')
    assert 3 in retry.evaluate('climateLayers.loadedFrames().temperature')
    # Playback waits for a slow frame instead of skipping months or showing stale data.
    delayed=[]
    retry.route('**/data/era5/temperature-04.bin.gz*',lambda route:delayed.append(route))
    retry.locator('#playMonths').click()
    retry.wait_for_function('climateLayers.settings.month===4 && !document.querySelector("#layerStatus").hidden')
    retry.wait_for_timeout(1600)
    assert delayed and retry.evaluate('climateLayers.settings.month')==4
    assert 4 not in retry.evaluate('climateLayers.loadedFrames().temperature')
    assert retry.locator('#playMonths').get_attribute('aria-pressed')=='true'
    delayed[0].continue_()
    retry.wait_for_function('document.querySelector("#layerStatus").hidden')
    retry.locator('#playMonths').click()
    assert 4 in retry.evaluate('climateLayers.loadedFrames().temperature')
    assert retry.locator('#playMonths').get_attribute('aria-pressed')=='false'
    retry.unroute('**/data/era5/temperature-04.bin.gz*')
    # The map must fill its frame even when max-height limits its aspect ratio.
    dock('layers');click('#fontSize')
    for width,height in [(1280,720),(1280,800),(1440,900),(1920,1080),(1024,768),(800,1280),(390,844)]:
        page.set_viewport_size({'width':width,'height':height})
        page.wait_for_timeout(80)
        if width>900: dock('layers')
        for closed in ([False,True] if width>900 else [True]):
            if closed and page.locator('#mapDrawer').is_visible(): click('#closeDrawer')
            frame=page.locator('.map-section').bounding_box()
            stage=page.locator('#mapStage').bounding_box()
            canvas=page.locator('#map').bounding_box()
            assert abs(stage['x']-frame['x'])<=1,(width,height,closed,'left strip',stage,frame)
            assert abs(stage['width']-frame['width'])<=1,(width,height,closed,'unused width',stage,frame)
            gap=stage['width']-canvas['width']
            assert abs(canvas['x']-stage['x'])<=1
            assert (90<=gap<=stage['width']*.55) if width>900 else abs(gap)<=1,(width,gap)
            assert page.locator('.latitude-label:visible').count()==(5 if width>900 else 0)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            assert page.evaluate('document.scrollingElement.scrollHeight<=innerHeight+1')
            assert stage['y']<=1 and canvas['y']<=1
            page.evaluate('window.scrollTo(0,1000)');assert page.evaluate('scrollY')==0
            if width==1280 and height==720 and closed: shot('width-fixed-desktop')
    # Mobile omits labels; desktop labels stay in their gutter in both text modes.
    for width,height in [(1280,720),(844,390),(390,844),(320,568)]:
        page.set_viewport_size({'width':width,'height':height})
        for large in [False,True]:
            if page.evaluate('document.body.classList.contains("large")')!=large:
                dock('layers');click('#fontSize')
            if page.locator('#mapDrawer').is_visible():click('#closeDrawer')
            page.wait_for_timeout(80)
            assert page.locator('.latitude-label:visible').count()==(5 if width>900 else 0)
            boxes=page.locator('.latitude-label:visible').evaluate_all('es=>es.map(e=>{const r=e.getBoundingClientRect();return [r.left,r.top,r.right,r.bottom]})')
            for i,a in enumerate(boxes):
                for b in boxes[i+1:]:
                    assert not (a[0]<b[2] and a[2]>b[0] and a[1]<b[3] and a[3]>b[1]),(width,height,large,a,b)
            assert page.evaluate('document.scrollingElement.scrollHeight<=innerHeight+1 && document.scrollingElement.scrollWidth<=innerWidth')
    print('WIDTH_CHECKS_PASSED: 7 screen sizes, desktop dock and mobile bottom sheet, intentional latitude gutter, no document scroll, height/world framing')
    assert not errors,errors
    print('BROWSER_CHECKS_PASSED: map-first desktop/mobile layout; no controls over canvas; drawer, keyboard tabs, Escape, modal focus; climate legends, comparison, inquiry; actual ERA5 values; 29 currents with limited labels; 12 real months, playback, persistent point/place, hover scale indicator, zoom, labels, font size, sources, retry; no runtime errors')
    browser.close()
server.shutdown()
