"""Independent desert overlay: state, exact mask, field composition and controls."""
import functools,http.server,os,pathlib,threading
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).parent.parent
class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get('ATLAS_CHROMIUM_PATH'))
    page=browser.new_page(viewport={'width':1440,'height':1000});errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(f'http://127.0.0.1:{server.server_port}/');page.wait_for_function('ready && atlasCities.ready()')
    def click(s):
        if s=='#atlasReset' and page.locator('#mapDrawer').evaluate("d=>d.matches(':modal')"):page.locator('#closeDrawer').click()
        page.locator(s).click()
        page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))')
        if s.startswith('[data-month=') or s.startswith('[data-field='):page.wait_for_function('document.querySelector("#layerStatus").hidden')
    def snapshot():return page.evaluate('JSON.stringify({state,climate:climateLayers.settings,learning:atlasLearning.settings})')
    def pixels():return page.locator('#map').evaluate('c=>c.toDataURL()')
    def active():
        assert page.evaluate('atlasNavigation.settings.desert')
        assert page.locator('#desertBelt').get_attribute('aria-pressed')=='true'
        assert page.locator('#desertMapKey').is_visible()
    assert page.locator('#desertBelt').get_attribute('aria-pressed')=='false'
    assert page.evaluate('document.querySelector("#currentsControl").nextElementSibling.id')=='desertBelt'
    # Use fixed whole-world framing to isolate overlay state from height-fit
    # recalculation when its footer key changes the canvas height.
    click('#navWorld')
    before=snapshot();image=pixels();click('#desertBelt');active()
    assert snapshot()==before and pixels()!=image
    # Inspect the rendered mask itself, including transparent ocean/steppe cells.
    mask=page.evaluate('''()=>{
      let raster;const drawImage=ctx.drawImage;ctx.drawImage=function(c){raster=c};
      try{atlasNavigation.drawDesert()}finally{ctx.drawImage=drawImage}
      const a=raster.getContext('2d').getImageData(0,0,W,H).data;
      const counts={marked:{4:0,5:0},clear:{4:0,5:0},outside:0};
      for(let i=0;i<grid.length;i++){
        if(grid[i]===4||grid[i]===5)counts[a[i*4+3]?'marked':'clear'][grid[i]]++;
        else if(a[i*4+3])counts.outside++;
      }return counts;
    }''')
    assert mask['outside']==0 and all(n>0 for n in mask['marked'].values()),mask
    assert all(n==0 for n in mask['clear'].values()), 'Desert cells must have continuous fill, not sparse hatching'
    assert 'מילוי ורוד בולט' in page.locator('#desertMapKey').inner_text()
    assert 'לצבעי הנתונים המקוריים כבו את המתג' in page.locator('#desertBeltNote').inner_text()
    click('#desertBelt');assert snapshot()==before and pixels()==image
    # Same switch track as ocean currents, with keyboard support.
    def switch_style(selector):return page.locator(selector).evaluate('e=>{const s=getComputedStyle(e,"::after");return [s.width,s.height,s.backgroundColor,s.boxShadow]}')
    assert switch_style('#desertBelt')==switch_style('#currentsToggle')
    page.locator('#desertBelt').focus();page.keyboard.press('Space');active()
    page.keyboard.press('Enter');assert not page.evaluate('atlasNavigation.settings.desert')
    click('[data-field="temperature"]');page.wait_for_function('document.querySelector("#layerStatus").hidden')
    click('#tabInfo');page.locator('#sampleLocation').select_option('2');click('#tabLayers')
    click('#currentsToggle');click('[data-month="7"]');page.evaluate('atlasNavigation.zoomAt(1.7)')
    before=snapshot();image=pixels();click('#desertBelt');active();assert snapshot()==before
    assert page.locator('#cityMarker').is_visible()
    assert switch_style('#desertBelt')==switch_style('#currentsToggle')
    click('#desertBelt');assert snapshot()==before and pixels()==image
    click('#desertBelt')
    # Both actual ERA5 fields, both months, with currents left on.
    for field in ['precipitation','temperature']:
        click('[data-field="'+field+'"]')
        for month in [1,7]:
            click('[data-month="'+str(month)+'"]');active()
            assert page.evaluate('climateLayers.settings.field')==field
            assert page.evaluate('climateLayers.settings.currents')
            assert page.locator('#cityMarker').is_visible()
        page.screenshot(path=str(root/('desert-'+field+'-currents.png')),full_page=True)
    click('#navWorld');active();assert page.evaluate('state.zoom')==1
    page.locator('#learningAccordion summary').click()
    for overlay in ['atmosphere','solar','terrain']:click('#'+overlay+'Toggle');active()
    page.wait_for_function('atlasLearning.terrainReady()',timeout=60000)
    before=snapshot();image=pixels();click('#desertBelt');assert snapshot()==before
    click('#desertBelt');assert snapshot()==before and pixels()==image
    click('#climateBase');active();click('#currentsToggle');active()
    page.evaluate('()=>{state.view="detail";state.selected=1;state.tab="compare";render()}');active()
    page.locator('#clear').evaluate('e=>e.click()');active()
    click('#atlasReset');assert not page.evaluate('atlasNavigation.settings.desert')
    assert page.locator('#desertMapKey').is_hidden()
    # Mobile menu remains open while combining or removing overlay switches.
    page.set_viewport_size({'width':390,'height':844})
    click('#openDrawer');click('#desertBelt');active()
    assert page.locator('#mapDrawer').is_visible()
    click('#currentsToggle');click('[data-field="precipitation"]');active()
    page.locator('#desertBelt').scroll_into_view_if_needed()
    page.screenshot(path=str(root/'desert-mobile-switch.png'),full_page=True)
    click('#closeDrawer');active()
    page.screenshot(path=str(root/'desert-mobile-map.png'),full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    click('#openDrawer');click('#desertBelt')
    assert not page.evaluate('atlasNavigation.settings.desert')
    assert page.evaluate('climateLayers.settings.field==="precipitation" && climateLayers.settings.currents')
    assert not errors,errors
    print('DESERT_OVERLAY_PASSED: independent reversible switch; continuous BWh/BWk-only color fill with transparent non-desert cells; both ERA5 fields and months; currents, teaching overlays and city preserved; camera and selection persistence; full reset; matching switch appearance; keyboard and mobile',flush=True)
    browser.close()
server.shutdown()

