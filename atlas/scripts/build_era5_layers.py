"""Build real 0.25-degree ERA5 monthly normals from World Bank CCKP public data."""
import gzip, hashlib, json, pathlib, urllib.parse, urllib.request, xml.etree.ElementTree as ET
import numpy as np
import xarray as xr

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'data'/'era5'
OUT.mkdir(parents=True,exist_ok=True)
BASE='https://wbg-cckp.s3.us-west-2.amazonaws.com/'
NS={'s':'http://s3.amazonaws.com/doc/2006-03-01/'}
def discover(variable):
    keys=[];token=None
    while True:
        query={'list-type':'2','prefix':f'era5-x0.25/{variable}/','max-keys':'1000'}
        if token:query['continuation-token']=token
        with urllib.request.urlopen(BASE+'?'+urllib.parse.urlencode(query),timeout=90) as response:root=ET.fromstring(response.read())
        keys.extend(n.text for n in root.findall('s:Contents/s:Key',NS))
        token=root.findtext('s:NextContinuationToken',default=None,namespaces=NS)
        if not token:break
    selected=[k for k in keys if k.endswith('1991-2020.nc') and f'climatology-{variable}-monthly-mean_' in k and '_climatology_mean_' in k]
    print('CANDIDATES',variable,json.dumps(selected),flush=True)
    assert len(selected)==1, f'Expected exactly one monthly climatology, got {selected}'
    return selected[0]

manifest={'schemaVersion':2,'period':'1991–2020','months':[1,7],'provider':'World Bank CCKP / Copernicus ECMWF ERA5','providerUrl':'https://climateknowledgeportal.worldbank.org/index.php/metadata','gridStepDegrees':0.25,'encoding':'signed int16 little endian, gzip; -32768 means no data','scale':0.1,'layers':{}}
for name,variable in [('temperature','tas'),('precipitation','pr')]:
    key=discover(variable);url=BASE+key;source=OUT/(variable+'.source.nc')
    print('SOURCE_URL',url,flush=True)
    urllib.request.urlretrieve(url,source)
    with xr.open_dataset(source,decode_times=False) as ds:
        print('DATASET_METADATA',json.dumps({'variables':{k:{'dims':list(v.dims),'shape':list(v.shape),'attrs':{a:str(b) for a,b in v.attrs.items()}} for k,v in ds.data_vars.items()},'coords':{k:{'shape':list(v.shape),'first':str(v.values.flat[0]),'last':str(v.values.flat[-1]),'attrs':{a:str(b) for a,b in v.attrs.items()}} for k,v in ds.coords.items()},'attrs':{k:str(v) for k,v in ds.attrs.items()}},ensure_ascii=True),flush=True)
        assert variable in ds.data_vars
        a=ds[variable].squeeze(drop=True)
        latdim=next(d for d in a.dims if d.lower() in ('lat','latitude'))
        londim=next(d for d in a.dims if d.lower() in ('lon','longitude'))
        timedim=next(d for d in a.dims if d not in (latdim,londim))
        assert a.sizes[timedim]==12
        a=a.transpose(timedim,latdim,londim)
        lats=np.asarray(a[latdim],dtype=float);lons=(np.asarray(a[londim],dtype=float)+180)%360-180
        lati=np.argsort(lats)[::-1];loni=np.argsort(lons);lats=lats[lati];lons=lons[loni]
        assert np.allclose(np.diff(lats),-.25,atol=1e-5) and np.allclose(np.diff(lons),.25,atol=1e-5)
        assert len(lons)==1440 and len(lats) in (720,721)
        units=str(a.attrs.get('units','')).lower().replace(' ','')
        layer={'name':'ERA5 '+variable,'unit':'°C' if name=='temperature' else 'mm/month','scale':.1,'latitudes':lats.tolist(),'longitudes':lons.tolist(),'sourceUrl':url,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'originalUnits':a.attrs.get('units'),'sourceAttributes':{k:str(v) for k,v in a.attrs.items()},'frames':{}}
        for month in (1,7):
            values=np.asarray(a.isel({timedim:month-1}),dtype=np.float64)[np.ix_(lati,loni)]
            if name=='temperature':
                if units in ('k','kelvin','degk'):values-=273.15;conversion='Kelvin minus 273.15'
                else:
                    assert units in ('c','°c','degc','celsius','degree_celsius','degrees_celsius','degreesc','degreec'),units
                    conversion='Source already in degrees Celsius'
                assert -100<float(np.nanmin(values)) and float(np.nanmax(values))<65
            else:
                if units in ('mm','mm/month','mmmonth-1'):conversion='Source monthly total in mm, no daily-to-monthly multiplication'
                elif units in ('mm/day','mmday-1','mmd-1'):values*=31;conversion='Mean mm/day multiplied by 31 days'
                elif units in ('kgm-2s-1','kg/m2/s'):values*=31*86400;conversion='kg/m2/s multiplied by 86400 seconds and 31 days'
                else:raise ValueError('Unverified precipitation unit '+units)
                assert float(np.nanmin(values))>=-0.01 and float(np.nanmax(values))<3000
                values=np.maximum(values,0)
            valid=np.isfinite(values)
            assert valid.mean()>.98, 'Unexpected land-only or incomplete source grid'
            encoded=np.full(values.shape,-32768,dtype='<i2');encoded[valid]=np.rint(values[valid]*10).astype('<i2')
            packed=gzip.compress(encoded.tobytes(),compresslevel=9,mtime=0)
            filename=f'{name}-{month:02}.bin.gz';(OUT/filename).write_bytes(packed)
            layer['frames'][str(month)]={'url':'data/era5/'+filename,'sha256':hashlib.sha256(packed).hexdigest(),'bytes':len(packed),'minimum':round(float(np.nanmin(values)),2),'maximum':round(float(np.nanmax(values)),2),'validCells':int(valid.sum())}
        layer['conversion']=conversion;manifest['layers'][name]=layer
    source.unlink()
    print('PREPARED',name,json.dumps(layer['frames']),flush=True)
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
print('ERA5_BUILD_COMPLETE',flush=True)
