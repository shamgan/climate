"""Verify source-backed city charts, markers and existing atlas preservation."""
import functools,gzip,hashlib,http.server,json,math,os,pathlib,struct,threading
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).parent.parent
baseline=json.loads((root/'scripts/cities_baseline.json').read_text())
def blob(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
for name,sha in baseline['assets'].items():assert blob((root/name).read_bytes())==sha,name
html=(root/'index.html').read_bytes().decode()
for current,original in baseline.get('htmlReplacements',[]):
    assert html.count(current)==1,current
    html=html.replace(current,original)
for a in baseline['htmlAdditions']:
    assert html.count(a)==1,a
    html=html.replace(a,'')
assert blob(html.encode())==baseline['htmlBlob']
print('CITY_PRESERVATION_PASSED: existing layer assets and original HTML preserved apart from recorded city integration and requested desert overlay changes',flush=True)
data=json.loads((root/'data/cities/climatology.json').read_text(encoding='utf-8'))
assert data['period']=='1991-2020' and data['months']==list(range(1,13)) and len(data['cities'])==20
assert len({c['id'] for c in data['cities']})==20
manifest=json.loads((root/'data/era5/manifest.json').read_text())
arrays={}
for key in ['temperature','precipitation']:
    for month in [1,7]:arrays[key,month]=gzip.decompress((root/f'data/era5/{key}-{month:02}.bin.gz').read_bytes())
matches=0
for c in data['cities']:
    for key in ['temperature','precipitation']:
        layer=manifest['layers'][key];lons=layer['longitudes'];lats=layer['latitudes']
        x=min(range(len(lons)),key=lambda i:abs(lons[i]-c['gridLon']));y=min(range(len(lats)),key=lambda i:abs(lats[i]-c['gridLat']))
        assert abs(lons[x]-c['gridLon'])<1e-8 and abs(lats[y]-c['gridLat'])<1e-8
        for month in [1,7]:
            raw=struct.unpack_from('<H',arrays[key,month],2*(y*len(lons)+x))[0]
            assert abs(raw*layer['scale']+layer['offset']-c[key][month-1])<1e-7,(c['id'],key,month)
            matches+=1
assert matches==80
print('CITY_DATA_PASSED: 20 cities, 12 real months each; all 80 January/July values match the existing map cells',flush=True)
class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/'
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get('ATLAS_CHROMIUM_PATH'))
    page=browser.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(url);page.wait_for_function('ready && window.atlasCities && atlasCities.ready()')
    def click(s):page.locator(s).click()
    def tab(name):
        if not page.locator('#mapDrawer').is_visible():click('#openDrawer')
        click('#tab'+name.capitalize())
    def shot(name):page.wait_for_timeout(180);page.screenshot(path=str(root/(name+'.png')),full_page=True)
    def marker_check(city):
        assert page.locator('#cityMarker').is_visible()
        xy=page.evaluate('p=>{const v=projection(p);return [view.x+v[0]*view.s,view.y+v[1]*view.s]}',[city['lon'],city['lat']])
        actual=page.locator('#cityMarker').evaluate('e=>[parseFloat(e.style.left),parseFloat(e.style.top)]')
        assert math.dist(xy,actual)<.01,(city['name'],xy,actual)
        assert page.locator('#cityMapLabel').inner_text()==city['name']
        assert page.locator('#cityMarker').evaluate("e=>getComputedStyle(e).backgroundColor")=='rgb(213, 29, 44)'
    assert page.evaluate('document.querySelector("#currentsControl").nextElementSibling.id')=='desertBelt'
    assert not page.locator('.navigation-shortcuts #desertBelt').count()
    assert page.locator('#cityMarker').is_hidden()
    assert page.locator('#mapStage button').count()==0
    shot('cities-layers-menu')
    tab('info');assert page.locator('#cityChooser option').count()==21
    for i in [2,8,3,10,13,17]:
        page.locator('#cityChooser').select_option(str(i));city=data['cities'][i]
        marker_check(city)
        assert page.locator('#cityCard [data-rain-month]').count()==12
        assert page.locator('#cityCard [data-temperature-month]').count()==12
        rows=page.locator('#cityCard .city-data-table tbody tr');assert rows.count()==12
        for month in range(12):
            values=rows.nth(month).locator('td').all_text_contents()
            assert float(values[0].replace(',','').replace('\u200e',''))==city['temperature'][month]
            assert float(values[1].replace(',','').replace('\u200e',''))==city['precipitation'][month]
        assert 'לא מדידה בתחנה' in page.locator('#cityCard').inner_text()
        if i in [2,8,3]:shot('cities-'+city['id']+'-desktop')
    # Months are keyboard/touch accessible; expanded dialog returns to the info panel.
    page.locator('#cityCard [data-city-month="0"]').focus();page.keyboard.press('ArrowRight')
    assert 'פברואר' in page.locator('#cityCard .city-month-readout').inner_text()
    click('#expandCityChart');assert page.locator('#cityChartDialog').is_visible()
    assert page.locator('#cityDialogContent [data-rain-month]').count()==12
    shot('cities-climograph-expanded');page.keyboard.press('Escape')
    assert page.locator('#cityChartDialog').is_hidden() and page.locator('#mapDrawer').is_visible()
    # Marker remains accurate after camera, month, layer and panel changes.
    page.evaluate('atlasNavigation.zoomAt(3)');click('#focusCity');marker_check(data['cities'][17])
    tab('layers');click('[data-field="precipitation"]');page.wait_for_function('document.querySelector("#layerStatus").hidden');tab('info')
    assert page.locator('#sampleLocation option').count()==21
    page.locator('#sampleLocation').select_option('3');marker_check(data['cities'][3])
    assert page.locator('#sampleLocation').input_value()=='3' and 'מומבאי' in page.locator('#pointReadout').inner_text()
    assert page.locator('#cityCard').evaluate('e=>e.previousElementSibling.id')=='pointReadout'
    tab('layers');click('[data-month="7"]');tab('info')
    assert page.locator('#sampleLocation').input_value()=='3'
    assert 'יולי' in page.locator('#cityCard .city-month-readout').inner_text()
    tab('layers');click('[data-field="temperature"]');tab('info');assert page.locator('#sampleLocation').input_value()=='3'
    shot('cities-temperature-marker')
    tab('layers');click('#atlasReset');assert page.locator('#cityMarker').is_hidden()
    assert page.evaluate('climateLayers.settings.point') is None
    # All 20 cities remain selectable, including southern, tropical and cold cases.
    tab('info')
    for i,c in enumerate(data['cities']):
        page.locator('#cityChooser').select_option(str(i));marker_check(c)
        assert page.locator('#cityCard [data-rain-month]').count()==12
    page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(100);tab('info')
    page.locator('#cityChooser').select_option('8');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    shot('cities-tromso-mobile-panel');click('#focusCity');assert page.locator('#mapDrawer').is_hidden();marker_check(data['cities'][8])
    shot('cities-tromso-mobile-map')
    tab('info');click('#expandCityChart');assert page.locator('#cityChartDialog').is_visible();page.keyboard.press('Escape');assert page.locator('#mapDrawer').is_visible()
    tab('layers');click('#atlasReset');assert page.locator('#cityMarker').is_hidden()
    # Isolate optional city-data failures and recover without breaking the map.
    retry=browser.new_page();retry.on('pageerror',lambda e:errors.append(str(e)))
    retry.route('**/data/cities/climatology.json*',lambda route:route.fulfill(status=503,body='unavailable'))
    retry.goto(url);retry.wait_for_function('ready && window.atlasCities');retry.locator('#tabInfo').click();retry.locator('#retryCities').wait_for()
    assert retry.locator('#layerStatus').is_hidden()
    retry.unroute('**/data/cities/climatology.json*');retry.locator('#retryCities').click();retry.wait_for_function('atlasCities.ready()')
    assert retry.locator('#cityChooser option').count()==21
    assert not errors,errors
    print('CITY_BROWSER_PASSED: desert button moved; 20-city selections; single red marker at true projected coordinates; all 12 chart/table values; keyboard and expanded dialog; original city readout and month/layer changes; reset; mobile/map/panel; optional-data retry; no runtime errors',flush=True)
    browser.close()
server.shutdown()
