import { useState, useEffect, useMemo, useCallback, useRef, createContext, useContext } from "react";

// ═══════════════════════════ PERSISTENT STORAGE ═══════════════════
function useLocalStorage(key, initialValue) {
const [value, setValue] = useState(() => {
try {
const stored = localStorage.getItem(key);
return stored !== null ? JSON.parse(stored) : initialValue;
} catch {
return initialValue;
}
});

useEffect(() => {
try {
localStorage.setItem(key, JSON.stringify(value));
} catch {}
}, [key, value]);

return [value, setValue];
}

// ═══════════════════════════ CONSTANTS ═══════════════════════════
const EXPENSE_TYPES  = ['Fuel','DEF','Maintenance','Toll','Food','Parking','Other'];
const EXPENSE_COLORS = {Fuel:'#F59E0B',DEF:'#8B5CF6',Maintenance:'#EF4444',Toll:'#8B5CF6',Food:'#10B981',Parking:'#3B82F6',Other:'#6B7280'};
const EXPENSE_ICONS  = {Fuel:'⛽',DEF:'🛢️',Maintenance:'🔧',Toll:'💰',Food:'🍽️',Parking:'🅿️',Other:'🧾'};
const TRIP_STATUSES  = ['In Progress','Completed','Cancelled'];
const STATUS_COLORS  = {'In Progress':'#F59E0B', Completed:'#2563EB', Cancelled:'#DC2626'};
const US_STATES    = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'];
const CA_PROVINCES = ['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'];
const TOLLS = [
{name:'Golden Gate Bridge (CA)',state:'CA',country:'USA'},
{name:'George Washington Bridge (NY)',state:'NY',country:'USA'},
{name:'Lincoln Tunnel (NY)',state:'NY',country:'USA'},
{name:'Holland Tunnel (NY)',state:'NY',country:'USA'},
{name:'Verrazano-Narrows Bridge (NY)',state:'NY',country:'USA'},
{name:'New Jersey Turnpike (NJ)',state:'NJ',country:'USA'},
{name:'Pennsylvania Turnpike (PA)',state:'PA',country:'USA'},
{name:'Indiana Toll Road (IN)',state:'IN',country:'USA'},
{name:'Illinois Tollway (IL)',state:'IL',country:'USA'},
{name:'Ohio Turnpike (OH)',state:'OH',country:'USA'},
{name:'Peace Bridge (NY-ON)',state:'NY',country:'USA',border:'Canada'},
{name:'Rainbow Bridge (NY-ON)',state:'NY',country:'USA',border:'Canada'},
{name:'Lewiston-Queenston Bridge (NY-ON)',state:'NY',country:'USA',border:'Canada'},
{name:'Thousand Islands Bridge (NY-ON)',state:'NY',country:'USA',border:'Canada'},
{name:'Ambassador Bridge (MI-ON)',state:'MI',country:'USA',border:'Canada'},
{name:'Bluewater Bridge (MI-ON)',state:'MI',country:'USA',border:'Canada'},
{name:'Trans-Canada Highway (401)',province:'ON',country:'Canada'},
{name:'Deerfoot Trail',province:'AB',country:'Canada'},
{name:'Confederation Bridge (PE)',province:'PE',country:'Canada'},
];

const INIT_TRIPS = [];
const INIT_EXPENSES = [];

// ═══════════════════════════ UTILS ═══════════════════════════════
function _airMiles(la1,lo1,la2,lo2){
const R=3959,dLa=(la2-la1)*Math.PI/180,dLo=(lo2-lo1)*Math.PI/180;
const a=Math.sin(dLa/2)**2+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dLo/2)**2;
return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function getDrivingDist(origin,destination,oLat,oLon,dLat,dLon){
const oLa=oLat||0,oLo=oLon||0,dLa=dLat||0,dLo=dLon||0;
const air=_airMiles(oLa,oLo,dLa,dLo);
let f;
if(air<5)  f=2.50;
else if(air<25)  f=1.25;
else if(air<60)  f=1.18;
else if(air<100) f=1.17;
else if(air<160) f=1.12;
else if(air<260) f=1.15;
else if(air<450) f=1.22;
else             f=1.35;
const latD=Math.abs(oLa-dLa),lonD=Math.abs(oLo-dLo);
const avgLat=(oLa+dLa)/2,avgLon=(oLo+dLo)/2;
function isON(la,lo){
if(la>43.8&&la<48.0&&lo>-95.0&&lo<-74.0) return true;
if(la>42.2&&la<43.9&&lo>-84.5&&lo<-79.0) return true;
return false;
}
const inON_A=isON(oLa,oLo), inON_B=isON(dLa,dLo);
let anyBorder=false;
function applyBorder(origLa,origLo,destLa,destLo){
const isTorArea=origLa>43.2;
if(destLa>42.4&&destLa<43.4&&destLo>-79.5&&destLo<-78.0){if(origLa>43.4){f=Math.max(f,1.70);anyBorder=true;}return;}
if(destLa>42.5&&destLa<43.5&&destLo>-78.0&&destLo<-76.5){f=Math.max(f,1.78);anyBorder=true;return;}
if(destLa>42.5&&destLa<43.5&&destLo>-76.5&&destLo<-75.5){f=Math.max(f,1.62);anyBorder=true;return;}
if(destLa>42.0&&destLa<44.0&&destLo>-75.5&&destLo<-73.0){f=Math.max(f,1.15);anyBorder=true;return;}
if(destLo>-75.5&&destLa<42.5){f=Math.max(f,isTorArea?1.52:1.28);anyBorder=true;return;}
if(destLa>40.5&&destLa<42.4&&destLo>-82.5&&destLo<-80.0){if(destLa<41.8&&destLo<-81.3)f=Math.max(f,isTorArea?1.62:1.80);anyBorder=true;return;}
if(destLa>39.8&&destLa<41.5&&destLo>-81.0&&destLo<-79.0){f=Math.max(f,isTorArea?1.48:1.55);anyBorder=true;return;}
if(destLa>38.5&&destLa<41.5&&destLo>-85.5&&destLo<-82.0){f=Math.max(f,1.40);anyBorder=true;return;}
if(destLo<-83.0&&destLa>41.5&&destLa<43.5){f=Math.max(f,1.12);anyBorder=true;return;}
}
if(inON_A&&!inON_B) applyBorder(oLa,oLo,dLa,dLo);
if(inON_B&&!inON_A) applyBorder(dLa,dLo,oLa,oLo);
const detCity=(oLa>42.0&&oLa<43.0&&oLo>-84.5&&oLo<-82.8);
const clevCity=(dLa>41.0&&dLa<42.5&&dLo>-82.5&&dLo<-81.0);
const detCity2=(dLa>42.0&&dLa<43.0&&dLo>-84.5&&dLo<-82.8);
const clevCity2=(oLa>41.0&&oLa<42.5&&oLo>-82.5&&oLo<-81.0);
const detClevErie=((detCity&&clevCity)||(detCity2&&clevCity2));
if(detClevErie) f=Math.max(f,1.85);
const muskoka=(avgLat>43.7&&avgLat<44.8&&lonD<0.8&&latD>0.5&&latD<1.5&&air>40&&air<70);
if(muskoka) f=Math.max(f,1.65);
const qew=(avgLat>42.7&&avgLat<43.5&&avgLon>-80.0&&avgLon<-78.5&&latD<0.7&&lonD<1.5&&air<80&&!anyBorder);
if(qew) f=Math.min(f,1.02);
const hwy401=(avgLat>42.0&&avgLat<44.5&&lonD>1.5&&latD<1.5&&air>80&&!anyBorder&&!detClevErie);
if(hwy401) f=Math.min(f,1.13);
const miles=air*f;
return{miles:parseFloat(miles.toFixed(1)),km:parseFloat((miles*1.60934).toFixed(1))};
}

function curMonth(){const n=new Date();return`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;}
function fmtC(v){return'$'+v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');}

function calcTripRevenue(trip){
const rate=parseFloat(trip.trip_rate)||0;
const dist=parseFloat(trip.distance)||0;
if(trip.rate_type==='total') return rate;
if(trip.rate_type==='per_km') return rate*(dist*1.60934);
return rate*dist;
}

const ThemeCtx = createContext({T:{},dark:false,toggle:()=>{},useKm:false,toggleUnits:()=>{},useLiters:false,toggleFuelUnits:()=>{}});

function ThemeProvider({children}){
const [dark,setDark] = useLocalStorage('tl_dark', false);
const [useKm,setUseKm] = useLocalStorage('tl_useKm', false);
const [useLiters,setUseLiters] = useLocalStorage('tl_useLiters', false);
const light = {primary:'#1E40AF',accent:'#3B82F6',bg:'#F0F4FF',card:'#FFFFFF',text:'#1E293B',textSec:'#64748B',border:'#E2E8F0'};
const darkT  = {primary:'#3B82F6',accent:'#60A5FA',bg:'#0F172A',card:'#1E293B',text:'#F1F5F9',textSec:'#94A3B8',border:'#334155'};
const T = dark ? darkT : light;
const toggle = useCallback(()=>setDark(p=>!p),[]);
const toggleUnits = useCallback(()=>setUseKm(p=>!p),[]);
const toggleFuelUnits = useCallback(()=>setUseLiters(p=>!p),[]);
const val = useMemo(()=>({T,dark,toggle,useKm,toggleUnits,useLiters,toggleFuelUnits}),[T,dark,toggle,useKm,toggleUnits,useLiters,toggleFuelUnits]);
return <ThemeCtx.Provider value={val}>{children}</ThemeCtx.Provider>;
}
const useT = () => useContext(ThemeCtx);

// ═══════════════════════════ STAT CARD — 2 per row ═══════════════
// Wider cards: icon left, value+label right, full half-screen width
function SC({bg,icon,value,label,subLabel}){
return(
<div style={{
  flex:'0 0 calc(50% - 6px)',
  background:bg,
  borderRadius:14,
  padding:'14px 16px',
  margin:'0 0 8px 0',
  boxShadow:`0 3px 10px ${bg}55`,
  display:'flex',
  alignItems:'center',
  gap:12,
  minWidth:0,
}}>
  <div style={{
    background:'rgba(255,255,255,.22)',
    borderRadius:10,
    width:44,
    height:44,
    flexShrink:0,
    display:'flex',
    alignItems:'center',
    justifyContent:'center',
    fontSize:22,
  }}>{icon}</div>
  <div style={{minWidth:0,flex:1}}>
    <div style={{fontSize:20,fontWeight:800,color:'#fff',lineHeight:1.1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{value}</div>
    <div style={{fontSize:11,color:'rgba(255,255,255,.85)',marginTop:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',fontWeight:600}}>{label}</div>
    {subLabel&&<div style={{fontSize:10,color:'rgba(255,255,255,.65)',marginTop:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{subLabel}</div>}
  </div>
</div>
);
}

// 2-column grid wrapper for stat cards
function StatGrid({children}){
return(
<div style={{display:'flex',flexWrap:'wrap',gap:8,padding:'0 12px 4px'}}>
  {children}
</div>
);
}

function Lbl({c,T}){return <div style={{fontSize:13,fontWeight:600,color:T.textSec,marginBottom:4,textTransform:'uppercase',letterSpacing:.5}}>{c}</div>;}

function iSt(T,ex){return{border:`1px solid ${T.border}`,borderRadius:8,padding:'10px 12px',fontSize:15,color:T.text,background:T.card,marginBottom:12,width:'100%',boxSizing:'border-box',outline:'none',fontFamily:'inherit',...ex};}

function TB({on,label,onClick,T}){
return <button onClick={onClick} style={{flex:1,padding:'10px 12px',borderRadius:8,border:`1px solid ${on?T.primary:T.border}`,background:on?T.primary:T.card,color:on?'#fff':T.textSec,fontWeight:600,fontSize:13,cursor:'pointer',textAlign:'center'}}>{label}</button>;
}

// ═══════════════════════════ MODAL SHEET ═════════════════════════
function Sheet({visible,onClose,title,T,children}){
if(!visible)return null;
return(
<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:500,display:'flex',alignItems:'flex-end'}} onClick={onClose}>
<div style={{background:T.bg,borderRadius:'24px 24px 0 0',width:'100%',maxHeight:'90vh',display:'flex',flexDirection:'column'}} onClick={e=>e.stopPropagation()}>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 20px 16px',borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
<span style={{fontSize:20,fontWeight:700,color:T.text}}>{title}</span>
<button onClick={onClose} style={{background:'none',border:'none',fontSize:24,cursor:'pointer',color:T.textSec,lineHeight:1}}>✕</button>
</div>
<div style={{overflowY:'auto',flex:1,padding:20,paddingBottom:40}}>{children}</div>
</div>
</div>
);
}

// ═══════════════════════════ CITY SEARCH ═════════════════════════
const CITIES=[
['Acton','ON',43.6317,-80.0453],['Ajax','ON',43.8509,-79.0204],['Alliston','ON',44.1501,-79.8667],
['Almonte','ON',45.2284,-76.1895],['Amherstburg','ON',42.1001,-83.1001],['Arnprior','ON',45.4334,-76.3548],
['Aurora','ON',43.9985,-79.4676],['Aylmer','ON',42.7723,-80.9842],['Bancroft','ON',45.0559,-77.8525],
['Barrie','ON',44.3894,-79.6903],['Belleville','ON',44.1628,-77.3832],['Bolton','ON',43.8748,-79.7296],
['Bowmanville','ON',43.9140,-78.6885],['Bradford','ON',44.1167,-79.5667],['Brampton','ON',43.7315,-79.7624],
['Brantford','ON',43.1394,-80.2644],['Brockville','ON',44.5895,-75.6866],['Burlington','ON',43.3255,-79.7990],
['Caledonia','ON',43.0747,-79.9517],['Cambridge','ON',43.3616,-80.3144],['Carleton Place','ON',45.1334,-76.1418],
['Chatham','ON',42.4048,-82.1910],['Clinton','ON',43.6100,-81.5400],['Cobourg','ON',43.9595,-78.1677],
['Cochrane','ON',49.0584,-81.0168],['Collingwood','ON',44.5001,-80.2167],['Cornwall','ON',45.0275,-74.7267],
['Delhi','ON',42.8501,-80.5001],['Dryden','ON',49.7831,-92.8378],['Dundas','ON',43.2667,-79.9500],
['Elliot Lake','ON',46.3834,-82.6501],['Espanola','ON',46.2584,-81.7668],['Exeter','ON',43.3501,-81.4834],
['Fergus','ON',43.7068,-80.3762],['Fort Erie','ON',42.9001,-79.0167],['Fort Frances','ON',48.6084,-93.4001],
['Gananoque','ON',44.3334,-76.1667],['Georgetown','ON',43.6501,-79.9167],['Gravenhurst','ON',44.9167,-79.3667],
['Grimsby','ON',43.2001,-79.5667],['Guelph','ON',43.5448,-80.2482],['Haileybury','ON',47.4501,-79.6334],
['Halton Hills','ON',43.6334,-79.9167],['Hamilton','ON',43.2557,-79.8711],['Hanover','ON',44.1501,-81.0334],
['Hawkesbury','ON',45.6001,-74.6001],['Hearst','ON',49.6834,-83.6667],['Huntsville','ON',45.3334,-79.2167],
['Ingersoll','ON',43.0390,-80.8834],['Kapuskasing','ON',49.4167,-82.4334],['Kenora','ON',49.7667,-94.4834],
['Kingston','ON',44.2312,-76.4860],['Kirkland Lake','ON',48.1501,-80.0334],['Kitchener','ON',43.4516,-80.4925],
['Leamington','ON',42.0501,-82.5990],['Lindsay','ON',44.3501,-78.7334],['London','ON',42.9849,-81.2453],
['Markham','ON',43.8561,-79.3370],['Meaford','ON',44.6001,-80.5834],['Milton','ON',43.5168,-79.8774],
['Mississauga','ON',43.5890,-79.6441],['Midland','ON',44.7501,-79.8834],['Napanee','ON',44.2501,-76.9501],
['New Hamburg','ON',43.3834,-80.7167],['Newmarket','ON',44.0501,-79.4667],['Niagara Falls','ON',43.0962,-79.0377],
['Niagara-on-the-Lake','ON',43.2548,-79.0715],['North Bay','ON',46.3091,-79.4608],['Oakville','ON',43.4501,-79.6834],
['Orangeville','ON',43.9167,-80.0934],['Orillia','ON',44.5993,-79.4202],['Oshawa','ON',43.8971,-78.8658],
['Ottawa','ON',45.4215,-75.6972],['Owen Sound','ON',44.5667,-80.9434],['Parry Sound','ON',45.3501,-80.0334],
['Pembroke','ON',45.8167,-77.1001],['Perth','ON',44.9001,-76.2501],['Peterborough','ON',44.3091,-78.3197],
['Picton','ON',44.0001,-77.1334],['Port Hope','ON',43.9501,-78.3001],['Port Colborne','ON',42.8834,-79.2501],
['Prescott','ON',44.7167,-75.5167],['Renfrew','ON',45.4667,-76.6834],['Richmond Hill','ON',43.8828,-79.4403],
['Sarnia','ON',42.9745,-82.4066],['Sault Ste Marie','ON',46.5136,-84.3358],['Simcoe','ON',42.8334,-80.3001],
['Smiths Falls','ON',44.9001,-76.0167],['St Catharines','ON',43.1594,-79.2469],['St Thomas','ON',42.7751,-81.1932],
['Stoney Creek','ON',43.2167,-79.7501],['Stratford','ON',43.3709,-80.9822],['Strathroy','ON',42.9584,-81.6168],
['Sturgeon Falls','ON',46.3667,-79.9334],['Sudbury','ON',46.5220,-80.9528],['Thessalon','ON',46.2501,-83.5501],
['Thunder Bay','ON',48.3809,-89.2477],['Tillsonburg','ON',42.8596,-80.7283],['Timmins','ON',48.4758,-81.3305],
['Toronto','ON',43.6532,-79.3832],['Trenton','ON',44.1001,-77.5834],['Uxbridge','ON',44.1084,-79.1237],
['Vaughan','ON',43.8361,-79.4983],['Wallaceburg','ON',42.5967,-82.3884],['Wasaga Beach','ON',44.5201,-80.0167],
['Waterloo','ON',43.4668,-80.5164],['Welland','ON',42.9834,-79.2501],['Whitby','ON',43.8834,-78.9418],
['Windsor','ON',42.3149,-83.0364],['Wingham','ON',43.8834,-81.3084],['Woodstock','ON',43.1298,-80.7470],
['Montreal','QC',45.5017,-73.5673],['Quebec City','QC',46.8139,-71.2082],['Laval','QC',45.5991,-73.7124],
['Longueuil','QC',45.5315,-73.5182],['Sherbrooke','QC',45.4042,-71.8929],['Saguenay','QC',48.4285,-71.0688],
['Trois-Rivieres','QC',46.3432,-72.5418],['Drummondville','QC',45.8836,-72.4854],['Granby','QC',45.3987,-72.7312],
['Calgary','AB',51.0447,-114.0719],['Edmonton','AB',53.5461,-113.4938],['Red Deer','AB',52.2681,-113.8112],
['Lethbridge','AB',49.6956,-112.8451],['Medicine Hat','AB',50.0405,-110.6764],['Grande Prairie','AB',55.1707,-118.7884],
['Fort McMurray','AB',56.7265,-111.3790],['Banff','AB',51.1784,-115.5708],['Canmore','AB',51.0890,-115.3597],
['Vancouver','BC',49.2827,-123.1207],['Surrey','BC',49.1913,-122.8490],['Burnaby','BC',49.2488,-122.9805],
['Richmond','BC',49.1666,-123.1336],['Kelowna','BC',49.8880,-119.4960],['Abbotsford','BC',49.0504,-122.3045],
['Kamloops','BC',50.6745,-120.3273],['Nanaimo','BC',49.1659,-123.9401],['Victoria','BC',48.4284,-123.3656],
['Prince George','BC',53.9171,-122.7497],['Winnipeg','MB',49.8951,-97.1384],['Brandon','MB',49.8485,-99.9501],
['Saskatoon','SK',52.1332,-106.6700],['Regina','SK',50.4452,-104.6189],['Prince Albert','SK',53.2001,-105.7501],
['Halifax','NS',44.6488,-63.5752],['Moncton','NB',46.0878,-64.7782],['Saint John','NB',45.2733,-66.0633],
['Fredericton','NB',45.9636,-66.6431],['Charlottetown','PE',46.2382,-63.1311],["St John's",'NL',47.5615,-52.7126],
['Whitehorse','YT',60.7212,-135.0568],['Yellowknife','NT',62.4540,-114.3718],
['Columbus','OH',39.9612,-82.9988],['Cleveland','OH',41.4993,-81.6944],['Cincinnati','OH',39.1031,-84.5120],
['Toledo','OH',41.6639,-83.5552],['Akron','OH',41.0814,-81.5190],['Dayton','OH',39.7589,-84.1916],
['Youngstown','OH',41.0998,-80.6495],['Canton','OH',40.7989,-81.3784],['Chillicothe','OH',39.3328,-82.9824],
['Chicago','IL',41.8781,-87.6298],['Rockford','IL',42.2711,-89.0940],['Peoria','IL',40.6936,-89.5890],
['Springfield','IL',39.7817,-89.6501],['Kansas City','MO',39.0997,-94.5786],['St Louis','MO',38.6270,-90.1994],
['Detroit','MI',42.3314,-83.0458],['Grand Rapids','MI',42.9634,-85.6681],['Lansing','MI',42.7325,-84.5555],
['Ann Arbor','MI',42.2808,-83.7430],['Flint','MI',43.0125,-83.6875],['Kalamazoo','MI',42.2917,-85.5872],
['Indianapolis','IN',39.7684,-86.1581],['Fort Wayne','IN',41.1300,-85.1289],['South Bend','IN',41.6764,-86.2520],
['Milwaukee','WI',43.0389,-87.9065],['Madison','WI',43.0731,-89.4012],['Green Bay','WI',44.5133,-88.0133],
['Minneapolis','MN',44.9778,-93.2650],['Saint Paul','MN',44.9537,-93.0900],['Duluth','MN',46.7867,-92.1005],
['Des Moines','IA',41.5868,-93.6250],['Cedar Rapids','IA',41.9779,-91.6656],['Omaha','NE',41.2565,-95.9345],
['Fargo','ND',46.8772,-96.7898],['Sioux Falls','SD',43.5446,-96.7311],['Wichita','KS',37.6872,-97.3301],
['New York City','NY',40.7128,-74.0060],['Buffalo','NY',42.8864,-78.8784],['Albany','NY',42.6526,-73.7562],
['Rochester','NY',43.1566,-77.6088],['Syracuse','NY',43.0481,-76.1474],
['Philadelphia','PA',39.9526,-75.1652],['Pittsburgh','PA',40.4406,-79.9959],['Erie','PA',42.1292,-80.0851],
['Boston','MA',42.3601,-71.0589],['Providence','RI',41.8240,-71.4128],['Hartford','CT',41.7637,-72.6851],
['Newark','NJ',40.7357,-74.1724],['Baltimore','MD',39.2904,-76.6122],['Washington','DC',38.9072,-77.0369],
['Atlanta','GA',33.7490,-84.3880],['Charlotte','NC',35.2271,-80.8431],['Raleigh','NC',35.7796,-78.6382],
['Nashville','TN',36.1627,-86.7816],['Memphis','TN',35.1495,-90.0490],['Louisville','KY',38.2527,-85.7585],
['Birmingham','AL',33.5207,-86.8025],['Jacksonville','FL',30.3322,-81.6557],['Miami','FL',25.7617,-80.1918],
['Tampa','FL',27.9506,-82.4572],['Orlando','FL',28.5383,-81.3792],['Houston','TX',29.7604,-95.3698],
['San Antonio','TX',29.4241,-98.4936],['Dallas','TX',32.7767,-96.7970],['Austin','TX',30.2672,-97.7431],
['Fort Worth','TX',32.7555,-97.3308],['El Paso','TX',31.7619,-106.4850],['Amarillo','TX',35.2220,-101.8313],
['Los Angeles','CA',34.0522,-118.2437],['San Diego','CA',32.7157,-117.1611],['San Jose','CA',37.3382,-121.8863],
['San Francisco','CA',37.7749,-122.4194],['Sacramento','CA',38.5816,-121.4944],['Fresno','CA',36.7378,-119.7871],
['Phoenix','AZ',33.4484,-112.0740],['Tucson','AZ',32.2226,-110.9747],['Las Vegas','NV',36.1699,-115.1398],
['Portland','OR',45.5051,-122.6750],['Eugene','OR',44.0521,-123.0868],['Seattle','WA',47.6062,-122.3321],
['Spokane','WA',47.6588,-117.4260],['Denver','CO',39.7392,-104.9903],['Colorado Springs','CO',38.8339,-104.8214],
['Salt Lake City','UT',40.7608,-111.8910],['Albuquerque','NM',35.0844,-106.6504],
['Billings','MT',45.7833,-108.5007],['Boise','ID',43.6150,-116.2023],['Cheyenne','WY',41.1340,-104.8202],
['Anchorage','AK',61.2181,-149.9003],['Honolulu','HI',21.3069,-157.8583],
];

function localSearch(q){
const raw=(q||'').trim().toLowerCase();
if(raw.length<2)return[];
const comma=raw.indexOf(',');
const cityPart=comma>0?raw.slice(0,comma).trim():raw;
const provPart=comma>0?raw.slice(comma+1).trim():'';
const exact=[],starts=[],contains=[],fuzzy=[];
CITIES.forEach(([n,p,lat,lon])=>{
const nl=n.toLowerCase(),pl=p.toLowerCase();
if(provPart&&!pl.startsWith(provPart))return;
if(nl===cityPart)                        exact.push({label:`${n}, ${p}`,lat,lon});
else if(nl.startsWith(cityPart))         starts.push({label:`${n}, ${p}`,lat,lon});
else if(nl.includes(cityPart))           contains.push({label:`${n}, ${p}`,lat,lon});
else if(cityPart.length>=3){
let qi=0;
for(let i=0;i<nl.length&&qi<cityPart.length;i++){if(nl[i]===cityPart[qi])qi++;}
if(qi===cityPart.length)fuzzy.push({label:`${n}, ${p}`,lat,lon});
}
});
return[...exact,...starts,...contains,...fuzzy].slice(0,8);
}

const _aiCache={};

function PlacesAuto({value,onChange,placeholder,T,onSelect}){
const [results,setResults]=useState([]);
const [loading,setLoading]=useState(false);
const [open,setOpen]=useState(false);
const [error,setError]=useState('');
const timer=useRef(null);
const req=useRef(0);
const picking=useRef(false);

async function handleChange(v){
onChange(v);
clearTimeout(timer.current);
const q=v.trim();
if(q.length<2){setResults([]);setOpen(false);setLoading(false);setError('');return;}
const local=localSearch(q);
if(local.length>0){setResults(local);setOpen(true);}
setLoading(true);setError('');
const id=++req.current;
timer.current=setTimeout(async()=>{
if(req.current!==id)return;
try{
const res=await fetch('https://api.anthropic.com/v1/messages',{
method:'POST',
headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:600,messages:[{role:'user',content:`List up to 8 real cities/towns matching "${q}" in Canada or USA. Return ONLY a JSON array. Each item must have label (e.g. "Chillicothe, OH"), lat, lon as numbers. No markdown, no explanation, just the raw JSON array.`}]})
});
if(!res.ok){if(req.current!==id)return;setLoading(false);if(local.length===0){setError(`Search unavailable (${res.status})`);setOpen(true);}return;}
const d=await res.json();
if(req.current!==id)return;
const txt=((d.content||[]).find(b=>b.type==='text')||{}).text||'';
const clean=txt.replace(/```[a-z]*\n?/gi,'').trim();
const arr=JSON.parse(clean);
if(Array.isArray(arr)&&arr.length>0){_aiCache[q]=arr;setResults(arr);setOpen(true);}
else if(local.length===0){setOpen(false);}
setLoading(false);
}catch(e){
if(req.current!==id)return;
setLoading(false);
if(local.length===0){setError('No results found — check spelling');setOpen(true);}
}
},local.length>0?300:400);
}

function pick(item){
picking.current=false;
onChange(item.label);
setResults([]);setOpen(false);setLoading(false);setError('');
onSelect&&onSelect({display:item.label,lat:item.lat,lon:item.lon});
}

function handleBlur(){
setTimeout(()=>{if(!picking.current)setOpen(false);},300);
}

const show=open||(loading&&value.trim().length>=2);

return(
<div style={{marginBottom:12}}>
<style>{`@keyframes _sp{to{transform:rotate(360deg);}}`}</style>
<div style={{position:'relative'}}>
<input value={value} onChange={e=>handleChange(e.target.value)} onFocus={()=>{if(results.length>0)setOpen(true);}} onBlur={handleBlur}
placeholder={placeholder} autoComplete="off" autoCorrect="off" autoCapitalize="words" spellCheck={false}
style={iSt(T,{marginBottom:0,paddingRight:36,borderRadius:show?'8px 8px 0 0':8,fontSize:16})}/>
<div style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}>
{loading?<div style={{width:15,height:15,border:`2px solid ${T.border}`,borderTopColor:T.primary,borderRadius:'50%',animation:'_sp .65s linear infinite'}}/>:<span style={{fontSize:14,opacity:.35}}>🔍</span>}
</div>
</div>
{show&&(
<div style={{background:T.card,border:`2px solid ${T.primary}`,borderTop:'none',borderRadius:'0 0 10px 10px',overflow:'hidden',boxShadow:'0 8px 20px rgba(0,0,0,.13)'}}>
{loading&&results.length===0&&(<div style={{padding:'12px 15px',display:'flex',alignItems:'center',gap:10,color:T.textSec,fontSize:13}}><div style={{width:13,height:13,border:`2px solid ${T.border}`,borderTopColor:T.primary,borderRadius:'50%',animation:'_sp .65s linear infinite',flexShrink:0}}/>Searching cities & towns…</div>)}
{error&&!loading&&results.length===0&&(<div style={{padding:'12px 15px',fontSize:13,color:'#EF4444'}}>{error}</div>)}
{results.map((item,i)=>(
<div key={i} onTouchStart={()=>{picking.current=true;}} onTouchEnd={e=>{e.preventDefault();pick(item);}} onMouseDown={e=>{e.preventDefault();pick(item);}}
style={{padding:'13px 15px',borderBottom:i<results.length-1?`1px solid ${T.border}`:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:10,background:T.card,minHeight:48}}
onMouseEnter={e=>e.currentTarget.style.background=T.bg} onMouseLeave={e=>e.currentTarget.style.background=T.card}>
<span style={{fontSize:16,flexShrink:0}}>📍</span>
<span style={{fontSize:15,fontWeight:600,color:T.text,lineHeight:1.3}}>{item.label}</span>
</div>
))}
{!loading&&results.length>0&&(<div style={{padding:'4px 15px 6px',fontSize:10,color:T.textSec,borderTop:`1px solid ${T.border}`,background:T.bg}}>🤖 AI-powered · tap to select</div>)}
</div>
)}
</div>
);
}

// ═══════════════════════════ VEHICLES SCREEN ═════════════════════
const VEHICLE_TYPES=['Semi Truck','Box Truck','Flatbed','Tanker','Reefer','Dump Truck','Pickup/Work Truck','Sprinter Van','Other'];

// ── North American semi / commercial truck brands & their models ──
const TRUCK_BRANDS=[
'Freightliner','Peterbilt','Kenworth','Volvo','International','Mack','Western Star','Sterling','White','Ford','Ram','Chevrolet / GMC','Hino','Isuzu','UD Trucks','Fuso','Other',
];

const TRUCK_MODELS={
'Freightliner':['Cascadia','Classic XL','Columbia','Century Class','Coronado','Argosy','M2 106','M2 112','Business Class M2','Sprinter','114SD','108SD','122SD'],
'Peterbilt':['389','388','379','378','367','365','362','359','357','579','567','567 EPIQ','587','520','520 EV','220','337','348','536'],
'Kenworth':['T680','T880','T660','T600','T800','W900','W990','C500','T170','T270','T370','T470','K270','K370','T680E','T680 FCEV'],
'Volvo':['VNL 760','VNL 780','VNL 740','VNL 860','VNL 400','VNL 300','VHD','VAH','VNR 300','VNR 400','VNX','FE','FM','FH'],
'International':['LT Series','RH Series','HV Series','HX Series','MV Series','CV Series','ProStar','LoneStar','WorkStar','DuraStar','TransStar','PayStar','9900i','9200i'],
'Mack':['Anthem','Pinnacle','Granite','TerraPro','LR Electric','MD Series','MD6','MD7','CH','CX','CL','RD','DM','R Model'],
'Western Star':['49X','4900','4700','4800','5700XE','6900','47X','49XS','X Series'],
'Sterling':['A-Line','L-Line','AT9500','LT9500','Acterra','Condor','Bullet 45','Bullet 55'],
'White':['Road Commander','Freightliner FLC','WIA','WCA','WCM','7064T','3000'],
'Ford':['F-650','F-750','F-550','F-450','F-350','Transit','E-Series','Super Duty'],
'Ram':['ProMaster','2500','3500','4500','5500','Chassis Cab'],
'Chevrolet / GMC':['Silverado 3500HD','Sierra 3500HD','Express','Savana','Low Cab Forward 4500','Low Cab Forward 5500'],
'Hino':['155','195','258','268','338','500 Series','700 Series','XL8','XL11'],
'Isuzu':['NQR','NPR','NRR','FTR','FVR','FXR','FRR','NPR-HD','NPR-XD'],
'UD Trucks':['Croner','Quon','Condor','Kuzer'],
'Fuso':['Canter','Fighter','Shogun','Rosa','FE180','FG4X4'],
'Other':['Other / Custom'],
};

// Reusable native select styled to match the app
function SelField({label,value,onChange,options,placeholder,T,required}){
const selSt={border:`1px solid ${T.border}`,borderRadius:8,padding:'10px 12px',fontSize:14,color:value?T.text:T.textSec,background:T.bg,marginBottom:12,width:'100%',boxSizing:'border-box',outline:'none',fontFamily:'inherit',appearance:'none',WebkitAppearance:'none',backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%2364748B' d='M6 8L0 0h12z'/%3E%3C/svg%3E")`,backgroundRepeat:'no-repeat',backgroundPosition:'right 12px center',paddingRight:32};
return(
<div>
<div style={{fontSize:12,fontWeight:700,color:T.textSec,marginBottom:4,textTransform:'uppercase',letterSpacing:.5}}>{label}{required&&<span style={{color:'#EF4444'}}>*</span>}</div>
<select value={value} onChange={e=>onChange(e.target.value)} style={selSt}>
<option value="">{placeholder}</option>
{options.map(o=><option key={o} value={o}>{o}</option>)}
</select>
</div>
);
}

// Year range 1990 → current year
const YEAR_OPTIONS=(()=>{const y=[];const cur=new Date().getFullYear();for(let i=cur;i>=1990;i--)y.push(String(i));return y;})();

function Vehicles({vehicles,setVehicles}){
const {T}=useT();
const blank={id:null,unit_number:'',make:'',model:'',year:'',vehicle_type:'Semi Truck',fuel_tank_capacity:'',license_plate:'',driver_name:'',notes:''};
const [form,setForm]=useState(blank);
const [editing,setEditing]=useState(false);
const [confirmDel,setConfirmDel]=useState(null);
const [saved,setSaved]=useState(false);
const sf=(k,v)=>{setForm(p=>({...p,[k]:v}));setSaved(false);};

// When make changes, reset model so stale model doesn't persist
function setMake(v){setForm(p=>({...p,make:v,model:''}));setSaved(false);}

function startNew(){setForm({...blank,id:Date.now()});setEditing(true);setSaved(false);}
function startEdit(v){setForm({...v});setEditing(true);setSaved(false);}
function cancelEdit(){setForm(blank);setEditing(false);}
function saveVehicle(){
if(!form.unit_number.trim()){alert('Unit Number is required.');return;}
if(!form.vehicle_type){alert('Vehicle Type is required.');return;}
setVehicles(vs=>{
const exists=vs.find(v=>v.id===form.id);
return exists?vs.map(v=>v.id===form.id?{...form}:v):[...vs,{...form,id:form.id||Date.now()}];
});
setSaved(true);
setTimeout(()=>{setSaved(false);setEditing(false);setForm(blank);},1200);
}
function deleteVehicle(id){setVehicles(vs=>vs.filter(v=>v.id!==id));setConfirmDel(null);}

// Generic text field
const field=(label,key,placeholder,opts={})=>(
<div key={key}>
<div style={{fontSize:12,fontWeight:700,color:T.textSec,marginBottom:4,textTransform:'uppercase',letterSpacing:.5}}>{label}{opts.required&&<span style={{color:'#EF4444'}}>*</span>}</div>
<input value={form[key]||''} onChange={e=>sf(key,e.target.value)} placeholder={placeholder}
style={{border:`1px solid ${T.border}`,borderRadius:8,padding:'10px 12px',fontSize:14,color:T.text,background:T.bg,marginBottom:12,width:'100%',boxSizing:'border-box',outline:'none',fontFamily:'inherit'}}/>
</div>
);

// Models available for selected make
const modelOptions=form.make&&TRUCK_MODELS[form.make]?TRUCK_MODELS[form.make]:Object.values(TRUCK_MODELS).flat();

if(editing){
return(
<div style={{flex:1,display:'flex',flexDirection:'column',background:T.bg,overflow:'hidden'}}>
<div style={{background:T.primary,padding:'20px 20px 16px',flexShrink:0,display:'flex',alignItems:'center',gap:12}}>
<button onClick={cancelEdit} style={{background:'rgba(255,255,255,.2)',border:'none',color:'#fff',borderRadius:8,padding:'6px 12px',cursor:'pointer',fontSize:13,fontWeight:600}}>← Back</button>
<div style={{fontSize:20,fontWeight:800,color:'#fff'}}>{form.id&&vehicles.find(v=>v.id===form.id)?'Edit Vehicle':'Add Vehicle'}</div>
</div>
<div style={{flex:1,overflowY:'auto',padding:16,paddingBottom:40}}>
<div style={{background:T.card,borderRadius:16,padding:20,boxShadow:'0 2px 8px rgba(0,0,0,.06)'}}>
{field('Unit Number','unit_number','e.g. TRK-001',{required:true})}
<div style={{fontSize:12,fontWeight:700,color:T.textSec,marginBottom:4,textTransform:'uppercase',letterSpacing:.5}}>Vehicle Type<span style={{color:'#EF4444'}}>*</span></div>
<div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:12}}>
{VEHICLE_TYPES.map(vt=>{const a=form.vehicle_type===vt;return <button key={vt} onClick={()=>sf('vehicle_type',vt)} style={{padding:'7px 12px',borderRadius:20,border:`1px solid ${a?T.primary:T.border}`,background:a?T.primary:T.card,color:a?'#fff':T.textSec,fontSize:12,fontWeight:a?700:400,cursor:'pointer'}}>{vt}</button>;})}
</div>

{/* ── Make dropdown ── */}
<SelField label="Make / Brand" value={form.make} onChange={setMake} options={TRUCK_BRANDS} placeholder="Select manufacturer…" T={T}/>

{/* ── Model dropdown — filtered by selected make ── */}
<SelField label="Model" value={form.model} onChange={v=>sf('model',v)}
options={modelOptions}
placeholder={form.make?`Select ${form.make} model…`:'Select make first…'}
T={T}/>
{/* Allow freeform if model isn't in list */}
{form.model==='Other / Custom'&&(
<input value={form._customModel||''} onChange={e=>sf('_customModel',e.target.value)}
placeholder="Enter model name…"
style={{border:`1px solid ${T.border}`,borderRadius:8,padding:'10px 12px',fontSize:14,color:T.text,background:T.bg,marginBottom:12,width:'100%',boxSizing:'border-box',outline:'none',fontFamily:'inherit'}}/>
)}

{/* ── Year dropdown 1990 → present ── */}
<SelField label="Year" value={form.year} onChange={v=>sf('year',v)} options={YEAR_OPTIONS} placeholder="Select year…" T={T}/>

{field('License Plate','license_plate','e.g. ABC 1234')}
{field('Fuel Tank Capacity (Gal)','fuel_tank_capacity','e.g. 200')}
{field('Driver Name','driver_name','Assigned driver')}
{field('Notes','notes','Any additional info')}
<button onClick={saveVehicle} style={{width:'100%',background:T.primary,color:'#fff',border:'none',borderRadius:10,padding:14,fontSize:15,fontWeight:700,cursor:'pointer'}}>💾 Save Vehicle</button>
{saved&&<div style={{marginTop:10,background:'#ECFDF5',border:'1px solid #6EE7B7',borderRadius:8,padding:'10px 14px',display:'flex',alignItems:'center',gap:8,fontSize:14,color:'#065F46',fontWeight:600}}>✅ Vehicle saved!</div>}
</div>
</div>
</div>
);
}
return(
<div style={{flex:1,display:'flex',flexDirection:'column',background:T.bg,overflow:'hidden'}}>
<div style={{background:T.primary,padding:'20px 20px 16px',flexShrink:0}}>
<div style={{fontSize:24,fontWeight:800,color:'#fff',marginBottom:4}}>🚛 Vehicles</div>
<div style={{fontSize:13,color:'rgba(255,255,255,.8)'}}>Manage your truck fleet</div>
</div>
<div style={{flex:1,overflowY:'auto',padding:'16px 16px 100px'}}>
{vehicles.length===0?(
<div style={{textAlign:'center',padding:'60px 20px',color:T.textSec}}>
<div style={{fontSize:64}}>🚛</div>
<div style={{fontSize:18,fontWeight:700,marginTop:16,color:T.text}}>No Vehicles Yet</div>
<div style={{fontSize:14,marginTop:8}}>Add your first truck to get started</div>
<button onClick={startNew} style={{marginTop:24,background:T.primary,color:'#fff',border:'none',borderRadius:12,padding:'12px 28px',fontSize:15,fontWeight:700,cursor:'pointer'}}>+ Add Vehicle</button>
</div>
):vehicles.map(v=>(
<div key={v.id} style={{background:T.card,borderRadius:16,marginBottom:12,overflow:'hidden',boxShadow:'0 2px 8px rgba(0,0,0,.07)'}}>
{confirmDel===v.id?(
<div style={{background:'#FEF2F2',padding:'14px 16px'}}>
<div style={{fontSize:14,fontWeight:700,color:'#DC2626',marginBottom:8}}>🗑️ Delete {v.unit_number}?</div>
<div style={{display:'flex',gap:8}}>
<button onClick={()=>deleteVehicle(v.id)} style={{flex:1,background:'#DC2626',color:'#fff',border:'none',borderRadius:8,padding:'10px 0',fontSize:14,fontWeight:700,cursor:'pointer'}}>Yes, Delete</button>
<button onClick={()=>setConfirmDel(null)} style={{flex:1,background:T.border,color:T.text,border:'none',borderRadius:8,padding:'10px 0',fontSize:14,fontWeight:600,cursor:'pointer'}}>Cancel</button>
</div>
</div>
):(
<>
<div style={{background:T.primary,padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<div>
<div style={{fontSize:16,fontWeight:800,color:'#fff'}}>Unit: {v.unit_number}</div>
<div style={{fontSize:12,color:'rgba(255,255,255,.8)',marginTop:2}}>{v.vehicle_type}</div>
</div>
<div style={{background:'rgba(255,255,255,.2)',borderRadius:8,padding:'4px 10px',fontSize:12,color:'#fff',fontWeight:600}}>{v.year||'—'}</div>
</div>
<div style={{padding:'12px 16px'}}>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,fontSize:13}}>
{v.make&&<div><span style={{color:T.textSec}}>Make: </span><span style={{fontWeight:600,color:T.text}}>{v.make}</span></div>}
{v.model&&<div><span style={{color:T.textSec}}>Model: </span><span style={{fontWeight:600,color:T.text}}>{v.model}</span></div>}
{v.license_plate&&<div><span style={{color:T.textSec}}>Plate: </span><span style={{fontWeight:600,color:T.text}}>{v.license_plate}</span></div>}
{v.fuel_tank_capacity&&<div><span style={{color:T.textSec}}>Tank: </span><span style={{fontWeight:600,color:T.text}}>{v.fuel_tank_capacity} gal</span></div>}
{v.driver_name&&<div style={{gridColumn:'1/-1'}}><span style={{color:T.textSec}}>Driver: </span><span style={{fontWeight:600,color:T.text}}>{v.driver_name}</span></div>}
</div>
{v.notes&&<div style={{fontSize:12,color:T.textSec,marginTop:8,fontStyle:'italic'}}>{v.notes}</div>}
</div>
<div style={{display:'flex',justifyContent:'flex-end',gap:16,padding:'0 16px 12px',borderTop:`1px solid ${T.border}`}}>
<button onClick={()=>startEdit(v)} style={{background:'none',border:'none',color:T.accent,fontSize:13,fontWeight:600,cursor:'pointer',paddingTop:10}}>✏️ Edit</button>
<button onClick={()=>setConfirmDel(v.id)} style={{background:'none',border:'none',color:'#EF4444',fontSize:13,fontWeight:600,cursor:'pointer',paddingTop:10}}>🗑️ Delete</button>
</div>
</>
)}
</div>
))}
</div>
{vehicles.length>0&&(
<button onClick={startNew} style={{position:'absolute',right:20,bottom:76,width:56,height:56,borderRadius:28,background:T.primary,border:'none',color:'#fff',fontSize:28,cursor:'pointer',boxShadow:`0 4px 16px ${T.primary}88`,display:'flex',alignItems:'center',justifyContent:'center',zIndex:10}}>+</button>
)}
</div>
);
}

// ═══════════════════════════ ADD TRIP MODAL ══════════════════════
function AddTripModal({visible,onClose,onSave,editTrip,T,vehicles}){
const {useKm}=useT();
const blank={trip_number:'',origin:'',destination:'',distance:'',trip_date:'',notes:'',status:'In Progress',trip_rate:'',rate_type:'per_mile',currency:'CAD',vehicle_id:''};
const [f,setF]=useState(blank);
const [oC,setOC]=useState(null);
const [dC,setDC]=useState(null);
const [gps,setGps]=useState(false);
const [distCalced,setDistCalced]=useState(false);
const [distLoading,setDistLoading]=useState(false);

useEffect(()=>{
if(!visible)return;
if(editTrip){
setF({trip_number:editTrip.trip_number||'',origin:editTrip.origin||'',destination:editTrip.destination||'',distance:String(editTrip.distance||''),trip_date:editTrip.trip_date||'',notes:editTrip.notes||'',status:editTrip.status||'In Progress',trip_rate:String(editTrip.trip_rate||''),rate_type:editTrip.rate_type||'per_mile',currency:editTrip.currency||'CAD',vehicle_id:editTrip.vehicle_id||''});
setOC(editTrip.origin_lat?{lat:editTrip.origin_lat,lon:editTrip.origin_lon}:null);
setDC(editTrip.dest_lat?{lat:editTrip.dest_lat,lon:editTrip.dest_lon}:null);
setDistCalced(false);
}else{setF(blank);setOC(null);setDC(null);setDistCalced(false);}
},[visible,editTrip]);

const s=(k,v)=>setF(p=>({...p,[k]:v}));

function computeDriving(originLabel,destLabel,oCoord,dCoord){
const result=getDrivingDist(originLabel,destLabel,oCoord.lat,oCoord.lon,dCoord.lat,dCoord.lon);
s('distance',result.miles.toFixed(1));
setDistCalced({miles:result.miles,km:result.km,mode:'driving'});
setDistLoading(false);
}

const onOS=c=>{setOC(c);if(dC)computeDriving(c.display,dC.display||f.destination,c,dC);};
const onDS=c=>{setDC(c);if(oC)computeDriving(oC.display||f.origin,c.display,oC,c);};

const distNum=parseFloat(f.distance)||0;
const rateNum=parseFloat(f.trip_rate)||0;
const earnings=f.rate_type==='per_mile'?(rateNum*distNum):rateNum;
const perMileEarned=f.rate_type==='total'&&distNum>0?(rateNum/distNum).toFixed(3):null;

function gpsGet(field){
setGps(true);
if(!navigator.geolocation){setGps(false);return;}
navigator.geolocation.getCurrentPosition(pos=>{
setGps(false);
const co={lat:pos.coords.latitude,lon:pos.coords.longitude};
const label=`${co.lat.toFixed(4)}, ${co.lon.toFixed(4)}`;
if(field==='origin'){s('origin',label);setOC({...co,display:label});if(dC)computeDriving(label,dC.display||f.destination,{...co,display:label},dC);}
else{s('destination',label);setDC({...co,display:label});if(oC)computeDriving(oC.display||f.origin,label,oC,{...co,display:label});}
},()=>setGps(false));
}

function save(){
if(!f.vehicle_id){alert('Please select a vehicle/truck for this trip.');return;}
if(!f.trip_number.trim()){alert('Please enter a Trip Number.');return;}
if(!f.origin||!f.destination||!f.trip_date){alert('Please fill Origin, Destination, and Date.');return;}
const selectedVehicle=vehicles.find(v=>String(v.id)===String(f.vehicle_id));
onSave({trip_number:f.trip_number.trim(),origin:f.origin,destination:f.destination,distance:parseFloat(f.distance)||0,trip_date:f.trip_date,notes:f.notes,status:f.status,trip_rate:parseFloat(f.trip_rate)||0,rate_type:f.rate_type,currency:f.currency,vehicle_id:f.vehicle_id,vehicle_label:selectedVehicle?`${selectedVehicle.unit_number} — ${selectedVehicle.vehicle_type}`:'',origin_lat:oC?.lat||null,origin_lon:oC?.lon||null,dest_lat:dC?.lat||null,dest_lon:dC?.lon||null});
}

const gpsBtn=(field)=>(<button onClick={()=>gpsGet(field)} style={{background:'none',border:'none',color:T.accent,fontSize:12,cursor:'pointer',display:'flex',alignItems:'center',gap:4,padding:'0 0 8px',marginTop:-4,fontFamily:'inherit'}}>{gps?'⏳':'📍'} Use GPS Location</button>);

return(
<Sheet visible={visible} onClose={onClose} title={editTrip?'Edit Trip':'New Trip'} T={T}>
<Lbl c={<span>Select Vehicle <span style={{color:'#EF4444'}}>*</span></span>} T={T}/>
{vehicles.length===0?(
<div style={{background:'#FEF2F2',border:'1.5px solid #FECACA',borderRadius:10,padding:'12px 14px',marginBottom:12}}>
<div style={{fontSize:13,fontWeight:700,color:'#DC2626'}}>⚠️ No vehicles added yet</div>
<div style={{fontSize:12,color:'#7F1D1D',marginTop:4}}>Go to the Vehicles tab and add a truck before creating a trip.</div>
</div>
):(
<div style={{marginBottom:12}}>
{vehicles.map(v=>{const sel=String(f.vehicle_id)===String(v.id);return(
<div key={v.id} onClick={()=>s('vehicle_id',String(v.id))} style={{border:`2px solid ${sel?T.primary:T.border}`,borderRadius:10,padding:'10px 14px',marginBottom:8,cursor:'pointer',background:sel?T.primary+'12':T.card,display:'flex',alignItems:'center',gap:12,transition:'all .15s'}}>
<div style={{width:36,height:36,borderRadius:18,background:sel?T.primary:'#E2E8F0',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>🚛</div>
<div style={{flex:1}}>
<div style={{fontSize:14,fontWeight:700,color:sel?T.primary:T.text}}>Unit: {v.unit_number}</div>
<div style={{fontSize:12,color:T.textSec}}>{v.vehicle_type}{v.make?` · ${v.make}`:''}{v.model?` ${v.model}`:''}</div>
{v.driver_name&&<div style={{fontSize:11,color:T.textSec}}>Driver: {v.driver_name}</div>}
</div>
{sel&&<span style={{fontSize:18,color:T.primary}}>✅</span>}
</div>
);})}
{!f.vehicle_id&&<div style={{fontSize:12,color:'#EF4444',marginTop:-4,marginBottom:4}}>⚠️ Vehicle selection is required</div>}
</div>
)}
<Lbl c={<span>Trip Number <span style={{color:'#EF4444'}}>*</span></span>} T={T}/>
<input value={f.trip_number} onChange={e=>s('trip_number',e.target.value)} placeholder="e.g. TRP-001, TRIP-2024-01, BOL#12345" style={iSt(T)}/>
<Lbl c="Origin" T={T}/>
<PlacesAuto value={f.origin} onChange={v=>{s('origin',v);if(!v){setOC(null);setDistCalced(false);}}} placeholder="Search address or city (Canada/USA)" T={T} onSelect={onOS}/>
{gpsBtn('origin')}
<Lbl c="Destination" T={T}/>
<PlacesAuto value={f.destination} onChange={v=>{s('destination',v);if(!v){setDC(null);setDistCalced(false);}}} placeholder="Search address or city (Canada/USA)" T={T} onSelect={onDS}/>
{gpsBtn('destination')}
<Lbl c="Distance" T={T}/>
{distCalced&&f.distance?(
<div style={{background:'#ECFDF5',border:'1px solid #6EE7B7',borderRadius:8,padding:'10px 14px',marginBottom:12,display:'flex',alignItems:'center',gap:8}}>
<span style={{fontSize:16}}>🛣️</span>
<div style={{flex:1}}>
<span style={{fontSize:15,fontWeight:700,color:'#059669'}}>{parseFloat(f.distance).toFixed(1)} miles</span>
<span style={{fontSize:12,color:'#555',marginLeft:8}}>({distCalced.km.toFixed(1)} km)</span>
<div style={{fontSize:11,color:'#065F46',marginTop:2}}>🚛 Estimated driving distance</div>
</div>
<button onClick={()=>{setDistCalced(false);s('distance','');}} style={{background:'none',border:'none',color:'#64748B',cursor:'pointer',fontSize:11,whiteSpace:'nowrap'}}>Edit</button>
</div>
):(
<input value={f.distance} onChange={e=>{s('distance',e.target.value.replace(/[^0-9.]/g,''));setDistCalced(false);}} placeholder="Auto-fills when both cities selected" style={iSt(T)}/>
)}
<Lbl c="Trip Date" T={T}/>
<input type="date" value={f.trip_date} onChange={e=>s('trip_date',e.target.value)} style={iSt(T)}/>
<div style={{height:4}}/>
<Lbl c="Status" T={T}/>
<div style={{display:'flex',flexWrap:'wrap',marginBottom:12}}>
{TRIP_STATUSES.map(st=>{const a=f.status===st;return <button key={st} onClick={()=>s('status',st)} style={{padding:'7px 14px',borderRadius:20,marginRight:8,marginBottom:8,border:`1px solid ${a?T.primary:T.border}`,background:a?T.primary:T.card,color:a?'#fff':T.textSec,fontWeight:a?600:400,fontSize:13,cursor:'pointer'}}>{st}</button>;})}
</div>
<Lbl c="Rate Type" T={T}/>
<div style={{display:'flex',gap:8,marginBottom:12}}>
<TB on={f.rate_type==='per_mile'} label="$/mile" onClick={()=>s('rate_type','per_mile')} T={T}/>
<TB on={f.rate_type==='per_km'} label="$/km" onClick={()=>s('rate_type','per_km')} T={T}/>
<TB on={f.rate_type==='total'} label="Total Pay" onClick={()=>s('rate_type','total')} T={T}/>
</div>
<Lbl c={f.rate_type==='per_mile'?'Rate ($/mile)':f.rate_type==='per_km'?'Rate ($/km)':'Total Pay ($)'} T={T}/>
<input value={f.trip_rate} onChange={e=>s('trip_rate',e.target.value.replace(/[^0-9.]/g,''))} placeholder="0.00" style={iSt(T)}/>
{rateNum>0&&distNum>0&&(
<div style={{background:T.primary+'18',border:`1px solid ${T.primary}44`,borderRadius:10,padding:'12px 14px',marginBottom:14}}>
<div style={{fontSize:12,fontWeight:700,color:T.primary,marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>💰 Earnings Preview</div>
{f.rate_type==='per_mile'&&<div style={{fontSize:14,color:T.text}}><span style={{fontWeight:600}}>${rateNum}/mi</span> × <span style={{fontWeight:600}}>{distNum.toFixed(1)} mi</span> = <span style={{fontSize:17,fontWeight:800,color:T.primary}}>${earnings.toFixed(2)}</span></div>}
{f.rate_type==='per_km'&&<div style={{fontSize:14,color:T.text}}><span style={{fontWeight:600}}>${rateNum}/km</span> × <span style={{fontWeight:600}}>{(distNum*1.60934).toFixed(1)} km</span> = <span style={{fontSize:17,fontWeight:800,color:T.primary}}>${(rateNum*(distNum*1.60934)).toFixed(2)}</span></div>}
{f.rate_type==='total'&&<div style={{fontSize:14,color:T.text}}>Total Pay: <span style={{fontSize:17,fontWeight:800,color:T.primary}}>${rateNum.toFixed(2)}</span>{perMileEarned&&<span style={{fontSize:12,color:T.textSec,marginLeft:8}}>(≈ ${perMileEarned}/mi)</span>}</div>}
</div>
)}
<Lbl c="Currency" T={T}/>
<div style={{display:'flex',gap:8,marginBottom:12}}>
<TB on={f.currency==='CAD'} label="CAD $" onClick={()=>s('currency','CAD')} T={T}/>
<TB on={f.currency==='USD'} label="USD $" onClick={()=>s('currency','USD')} T={T}/>
</div>
<Lbl c="Notes" T={T}/>
<textarea value={f.notes} onChange={e=>s('notes',e.target.value)} placeholder="Additional notes..." rows={3} style={{...iSt(T),resize:'vertical',height:80}}/>
<button onClick={save} style={{width:'100%',background:T.primary,color:'#fff',border:'none',borderRadius:12,padding:16,fontSize:16,fontWeight:700,cursor:'pointer',marginTop:8}}>{editTrip?'Update Trip':'Save Trip'}</button>
</Sheet>
);
}

// ═══════════════════════════ ADD EXPENSE MODAL ═══════════════════
function AddExpenseModal({visible,onClose,onSave,tripId,editExpense,T}){
const blank={expense_type:'Fuel',amount:'',description:'',expense_date:'',quantity:'',pump_city:'',toll_name:'',unit_type:'liters',currency:'CAD',usd_rate:'1.35'};
const [f,setF]=useState(blank);
const [tollS,setTollS]=useState([]);
const [showToll,setShowToll]=useState(false);
useEffect(()=>{
if(!visible)return;
if(editExpense){setF({expense_type:editExpense.expense_type||'Fuel',amount:String(editExpense.amount||''),description:editExpense.description||'',expense_date:editExpense.expense_date||'',quantity:editExpense.quantity?String(editExpense.quantity):'',pump_city:editExpense.pump_city||'',toll_name:editExpense.toll_name||'',unit_type:editExpense.unit_type||'liters',currency:editExpense.currency||'CAD',usd_rate:'1.35'});}
else setF(blank);
setShowToll(false);
},[visible,editExpense]);
const s=(k,v)=>setF(p=>({...p,[k]:v}));
function tollInp(v){s('toll_name',v);setTollS(TOLLS.filter(t=>t.name.toLowerCase().includes(v.toLowerCase())));setShowToll(true);}
function save(){
if(!f.amount||!f.expense_date){alert('Please fill Amount and Date.');return;}
let amt=parseFloat(f.amount)||0;
if(f.currency==='USD')amt*=(parseFloat(f.usd_rate)||1.35);
onSave({trip_id:tripId,expense_type:f.expense_type,amount:amt,description:f.description,expense_date:f.expense_date,quantity:f.quantity?parseFloat(f.quantity):null,pump_city:f.pump_city,toll_name:f.toll_name,unit_type:f.unit_type,currency:f.currency});
}
const isFD=f.expense_type==='Fuel'||f.expense_type==='DEF';
const isToll=f.expense_type==='Toll';
const cad=((parseFloat(f.amount)||0)*(parseFloat(f.usd_rate)||1.35)).toFixed(2);
return(
<Sheet visible={visible} onClose={onClose} title={editExpense?'Edit Expense':'Add Expense'} T={T}>
<Lbl c="Expense Type" T={T}/>
<div style={{display:'flex',flexWrap:'wrap',marginBottom:14}}>
{EXPENSE_TYPES.map(t=>{const a=f.expense_type===t;const col=EXPENSE_COLORS[t]||'#6B7280';return(<button key={t} onClick={()=>s('expense_type',t)} style={{display:'flex',alignItems:'center',gap:4,padding:'8px 12px',borderRadius:20,marginRight:8,marginBottom:8,border:`1px solid ${a?col:T.border}`,background:a?col:T.card,color:a?'#fff':T.textSec,fontWeight:a?600:400,fontSize:13,cursor:'pointer'}}><span>{EXPENSE_ICONS[t]}</span>{t}</button>);})}
</div>
{isFD&&(<>
<Lbl c="Unit Type" T={T}/>
<div style={{display:'flex',gap:8,marginBottom:12}}><TB on={f.unit_type==='liters'} label="Liters" onClick={()=>s('unit_type','liters')} T={T}/><TB on={f.unit_type==='gallons'} label="Gallons" onClick={()=>s('unit_type','gallons')} T={T}/></div>
<Lbl c={`Quantity (${f.unit_type})`} T={T}/>
<input value={f.quantity} onChange={e=>s('quantity',e.target.value.replace(/[^0-9.]/g,''))} placeholder="0.0" style={iSt(T)}/>
<Lbl c="Pump City/Location" T={T}/>
<PlacesAuto value={f.pump_city} onChange={v=>s('pump_city',v)} placeholder="Search city or address where fuel was purchased" T={T} onSelect={c=>s('pump_city',c.display)}/>
</>)}
{isToll&&(<>
<Lbl c="Toll Road/Bridge" T={T}/>
<div style={{position:'relative',marginBottom:12}}>
<input value={f.toll_name} onChange={e=>tollInp(e.target.value)} onFocus={()=>{setTollS(TOLLS.filter(t=>t.name.toLowerCase().includes(f.toll_name.toLowerCase())));setShowToll(true);}} placeholder="Search toll road..." style={iSt(T,{marginBottom:0})} onBlur={()=>setTimeout(()=>setShowToll(false),200)}/>
{showToll&&tollS.length>0&&(
<div style={{position:'absolute',top:'100%',left:0,right:0,background:T.card,border:`1px solid ${T.border}`,borderRadius:8,zIndex:1000,boxShadow:'0 4px 12px rgba(0,0,0,.12)',maxHeight:250,overflowY:'auto'}}>
{tollS.slice(0,8).map((toll,i)=>(<div key={i} onMouseDown={()=>{s('toll_name',toll.name);setShowToll(false);}} style={{padding:'10px 12px',borderBottom:i<Math.min(tollS.length,8)-1?`1px solid ${T.border}`:'none',cursor:'pointer'}} onMouseEnter={e=>e.currentTarget.style.background=T.bg} onMouseLeave={e=>e.currentTarget.style.background=T.card}><div style={{fontSize:13,color:T.text}}>{toll.name}</div><div style={{fontSize:11,color:T.textSec,marginTop:2}}>{toll.state||toll.province||''}{toll.country==='Canada'?', CA':', USA'}</div></div>))}
</div>
)}
</div>
</>)}
<Lbl c="Currency" T={T}/>
<div style={{display:'flex',gap:8,marginBottom:12}}><TB on={f.currency==='CAD'} label="CAD $" onClick={()=>s('currency','CAD')} T={T}/><TB on={f.currency==='USD'} label="USD $" onClick={()=>s('currency','USD')} T={T}/></div>
{f.currency==='USD'&&(<div style={{background:T.card,borderRadius:8,padding:10,marginBottom:12,border:`1px solid ${T.border}`}}><div style={{fontSize:12,fontWeight:600,color:T.textSec,marginBottom:6}}>USD to CAD Conversion</div><div style={{display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:14,fontWeight:'bold',color:T.text}}>Rate: </span><input value={f.usd_rate} onChange={e=>s('usd_rate',e.target.value.replace(/[^0-9.]/g,''))} placeholder="1.35" style={{flex:1,border:`1px solid ${T.border}`,borderRadius:6,padding:'6px 8px',fontSize:13,color:T.text,background:T.bg,outline:'none'}}/><span style={{fontSize:12,color:T.textSec,whiteSpace:'nowrap'}}>(= ${cad} CAD)</span></div></div>)}
<Lbl c={`Amount (${f.currency}$)`} T={T}/>
<input value={f.amount} onChange={e=>{let v=e.target.value.replace(/[^0-9.]/g,'');const p=v.split('.');if(p.length>2)v=p[0]+'.'+p.slice(1).join('');s('amount',v);}} placeholder="0.00" style={iSt(T)}/>
<Lbl c="Date" T={T}/>
<input type="date" value={f.expense_date} onChange={e=>s('expense_date',e.target.value)} style={iSt(T)}/>
<div style={{height:4}}/>
<Lbl c="Description" T={T}/>
<textarea value={f.description} onChange={e=>s('description',e.target.value)} placeholder="Details about this expense..." rows={3} style={{...iSt(T),resize:'vertical',height:70}}/>
<button onClick={save} style={{width:'100%',background:T.primary,color:'#fff',border:'none',borderRadius:12,padding:16,fontSize:16,fontWeight:700,cursor:'pointer',marginTop:8}}>{editExpense?'Update Expense':'Save Expense'}</button>
</Sheet>
);
}

// ═══════════════════════════ DASHBOARD ═══════════════════════════
function Dashboard({trips,expenses,navigate}){
const {T,useKm,useLiters}=useT();
const [fMode,setFMode]=useState('month');
const [sd,setSd]=useState('');
const [ed,setEd]=useState('');
const cm=curMonth();

const mT=useMemo(()=>trips.filter(t=>t.trip_date&&t.trip_date.substring(0,7)===cm&&t.status==='Completed'),[trips,cm]);
const mTAll=useMemo(()=>trips.filter(t=>t.trip_date&&t.trip_date.substring(0,7)===cm),[trips,cm]);
const mInProgress=useMemo(()=>trips.filter(t=>t.status==='In Progress').length,[trips]);
const mE=useMemo(()=>expenses.filter(e=>e.expense_date&&e.expense_date.substring(0,7)===cm),[expenses,cm]);
const mMiRaw=useMemo(()=>mT.reduce((s,t)=>s+(parseFloat(t.distance)||0),0),[mT]);
const mMi=useKm?(mMiRaw*1.60934):mMiRaw;
const distUnit=useKm?'km':'mi';
const mEx=useMemo(()=>mE.reduce((s,e)=>s+(parseFloat(e.amount)||0),0),[mE]);
const mRev=useMemo(()=>mT.reduce((s,t)=>s+calcTripRevenue(t),0),[mT]);
const mFuel=useMemo(()=>mE.filter(e=>e.expense_type==='Fuel').reduce((s,e)=>s+(parseFloat(e.amount)||0),0),[mE]);
const mFuelStats=useMemo(()=>{
const fuelExp=mE.filter(e=>e.expense_type==='Fuel'&&parseFloat(e.quantity)>0);
if(!fuelExp.length)return null;
const totalLiters=fuelExp.reduce((s,e)=>{const q=parseFloat(e.quantity)||0;return s+(e.unit_type==='gallons'?q*3.78541:q);},0);
const totalGallons=totalLiters/3.78541;
const distKm=mMiRaw*1.60934;
const mpg=totalGallons>0?(mMiRaw/totalGallons):0;
const l100=distKm>0?(totalLiters/distKm)*100:0;
const kmpl=totalLiters>0?(distKm/totalLiters):0;
return{mpg:mpg.toFixed(1),l100:l100.toFixed(1),kmpl:kmpl.toFixed(2),hasData:true};
},[mE,mMiRaw]);
// Primary metric flips based on fuel unit preference; opposite shown as subLabel
const mEcoDisplay=mFuelStats?(useLiters?`${mFuelStats.l100} L/100`:`${mFuelStats.mpg} MPG`):'No fuel qty';
const mEcoSub=mFuelStats?(useLiters?`${mFuelStats.mpg} MPG · ${mFuelStats.kmpl} km/L`:`${mFuelStats.l100} L/100km · ${mFuelStats.kmpl} km/L`):undefined;

const tEx=useMemo(()=>expenses.reduce((s,e)=>s+(parseFloat(e.amount)||0),0),[expenses]);
const completedTrips=useMemo(()=>trips.filter(t=>t.status==='Completed'),[trips]);
const tMiRaw=useMemo(()=>completedTrips.reduce((s,t)=>s+(parseFloat(t.distance)||0),0),[completedTrips]);
const tMi=useKm?(tMiRaw*1.60934):tMiRaw;
const tRev=useMemo(()=>completedTrips.reduce((s,t)=>s+calcTripRevenue(t),0),[completedTrips]);
const tFuel=useMemo(()=>expenses.filter(e=>e.expense_type==='Fuel').reduce((s,e)=>s+(parseFloat(e.amount)||0),0),[expenses]);
const comp=completedTrips.length;
const profit=mRev-mEx;
const tProfit=tRev-tEx;

const recent=useMemo(()=>{
if(fMode==='month')return trips.slice(0,3);
if(fMode==='custom'&&sd&&ed)return trips.filter(t=>t.trip_date>=sd&&t.trip_date<=ed).slice(0,3);
return trips.slice(0,3);
},[trips,fMode,sd,ed]);

return(
<div style={{overflowY:'auto',flex:1,background:T.bg,paddingBottom:24}}>
{/* Header */}
<div style={{padding:'24px 20px 16px',display:'flex',alignItems:'center',gap:10}}>
<span style={{fontSize:28}}>🚛</span>
<div>
<div style={{fontSize:28,fontWeight:800,color:T.text}}>TripLog</div>
<div style={{fontSize:14,color:T.textSec}}>Trucking Management Dashboard</div>
</div>
</div>

{/* Filter Period */}
<div style={{padding:'0 20px 16px'}}>
<div style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:10}}>Filter Period</div>
<div style={{display:'flex',gap:8}}>
{[['month','This Month'],['custom','Date Range']].map(([m,l])=>(
<button key={m} onClick={()=>setFMode(m)} style={{padding:'6px 12px',borderRadius:20,border:`1px solid ${T.primary}`,background:fMode===m?T.primary:T.card,color:fMode===m?'#fff':T.primary,fontWeight:600,fontSize:12,cursor:'pointer'}}>{l}</button>
))}
</div>
</div>

{fMode==='custom'&&(
<div style={{padding:'0 20px 16px',display:'flex',gap:8}}>
{[['From',sd,setSd],['To',ed,setEd]].map(([l,v,fn])=>(
<div key={l} style={{flex:1}}>
<div style={{fontSize:12,fontWeight:600,color:T.textSec,marginBottom:4}}>{l}</div>
<input type="date" value={v} onChange={e=>fn(e.target.value)} style={{border:`1px solid ${T.border}`,borderRadius:8,padding:'10px 12px',fontSize:14,color:T.text,background:T.card,width:'100%',boxSizing:'border-box',outline:'none'}}/>
</div>
))}
</div>
)}

{/* In Progress alert */}
{mInProgress>0&&(
<div style={{margin:'0 16px 10px',background:'#FEF3C7',border:'1.5px solid #F59E0B',borderRadius:12,padding:'10px 14px',display:'flex',alignItems:'center',gap:10}}>
<span style={{fontSize:22}}>🚛</span>
<div style={{flex:1}}>
<div style={{fontSize:13,fontWeight:700,color:'#92400E'}}>{mInProgress} Trip{mInProgress>1?'s':''} In Progress</div>
<div style={{fontSize:11,color:'#B45309',marginTop:1}}>Revenue & miles added to totals once marked Completed</div>
</div>
</div>
)}

{/* ── THIS MONTH — 2 per row ── */}
<div style={{padding:'4px 16px 8px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
<span style={{fontSize:11,fontWeight:800,color:T.primary,textTransform:'uppercase',letterSpacing:.8}}>📅 {fMode==='month'?'This Month':'Period'}</span>
<span style={{fontSize:10,color:T.textSec}}>Completed trips only</span>
</div>
<StatGrid>
<SC bg="#7C3AED" icon="🛣️" value={`${mMi.toFixed(1)} ${distUnit}`} label="Miles Driven"/>
<SC bg="#059669" icon="⛽" value={mEcoDisplay} label={useLiters?'Fuel Economy (L/100)':'Fuel Economy (MPG)'} subLabel={mEcoSub}/>
<SC bg="#0891B2" icon="📈" value={`$${mRev.toFixed(0)}`} label="Revenue"/>
<SC bg={profit>=0?'#059669':'#DC2626'} icon="🏦" value={`$${profit.toFixed(0)}`} label="Profit / Loss"/>
<SC bg="#DC2626" icon="💳" value={`$${mEx.toFixed(0)}`} label="Total Expenses"/>
<SC bg="#D97706" icon="⛽" value={`$${mFuel.toFixed(0)}`} label="Fuel Spent"/>
<SC bg="#1E40AF" icon="🗺️" value={String(mTAll.length)} label="Trips This Month"/>
<SC bg="#6366F1" icon="🧾" value={String(mE.length)} label="Receipts Logged"/>
</StatGrid>

{/* ── ALL TIME — 2 per row ── */}
<div style={{padding:'12px 16px 8px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
<span style={{fontSize:11,fontWeight:800,color:'#059669',textTransform:'uppercase',letterSpacing:.8}}>📊 All Time</span>
<span style={{fontSize:10,color:T.textSec}}>Completed trips only</span>
</div>
<StatGrid>
<SC bg="#1E40AF" icon="🗺️" value={String(trips.length)} label="All Trips"/>
<SC bg="#2563EB" icon="✅" value={String(comp)} label="Completed"/>
<SC bg="#0891B2" icon="📊" value={fmtC(tRev)} label="Total Revenue"/>
<SC bg={tProfit>=0?'#059669':'#DC2626'} icon="💰" value={fmtC(tProfit)} label="Total Profit/Loss"/>
<SC bg="#DC2626" icon="💳" value={fmtC(tEx)} label="Total Cost"/>
<SC bg="#7C3AED" icon="🛣️" value={`${tMi.toFixed(0)} ${distUnit}`} label={useKm?'Total Km':'Total Miles'}/>
<SC bg="#D97706" icon="⛽" value={fmtC(tFuel)} label="Fuel Cost"/>
<SC bg="#6366F1" icon="🧾" value={String(expenses.length)} label="All Expenses"/>
</StatGrid>

{/* Recent Trips */}
<div style={{padding:'12px 20px 12px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<div style={{fontSize:18,fontWeight:700,color:T.text}}>Recent Trips</div>
<button onClick={()=>navigate('Trips')} style={{background:'none',border:'none',color:T.accent,fontSize:14,fontWeight:600,cursor:'pointer'}}>See All</button>
</div>

{recent.length===0?(
<div style={{textAlign:'center',padding:32,color:T.textSec}}>
<div style={{fontSize:48}}>🚛</div>
<div style={{fontSize:15,fontWeight:600,marginTop:12}}>No trips in this period.</div>
<div style={{fontSize:14,marginTop:4}}>Go to Trips tab to add your first trip.</div>
</div>
):recent.map(trip=>{
const sc=STATUS_COLORS[trip.status]||'#D97706';
return(
<div key={trip.id} onClick={()=>navigate('TripDetail',{tripId:trip.id})} style={{margin:'0 20px 10px',background:T.card,borderRadius:14,padding:16,cursor:'pointer',boxShadow:'0 2px 6px rgba(0,0,0,.06)'}}>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
<div style={{flex:1}}>
<div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
<span style={{color:T.accent}}>📍</span>
<span style={{fontSize:14,fontWeight:600,color:T.text}}>{trip.origin||'N/A'} → {trip.destination||'N/A'}</span>
</div>
<div style={{display:'flex',gap:12,fontSize:12,color:T.textSec}}>
<span>📅 {trip.trip_date||'No date'}</span>
<span>🛣️ {trip.distance||0} mi</span>
</div>
</div>
<div style={{background:sc+'20',borderRadius:10,padding:'4px 10px',marginLeft:8}}>
<span style={{fontSize:11,fontWeight:700,color:sc}}>{trip.status||'Active'}</span>
</div>
</div>
</div>
);
})}

<button onClick={()=>navigate('Trips')} style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,margin:'8px 20px 0',width:'calc(100% - 40px)',background:T.primary,color:'#fff',border:'none',borderRadius:12,padding:15,fontSize:15,fontWeight:700,cursor:'pointer'}}>
+ Log New Trip
</button>
</div>
);
}

// ═══════════════════════════ TRIPS SCREEN ════════════════════════
function Trips({trips,setTrips,navigate,vehicles}){
const {T}=useT();
const [filter,setFilter]=useState('All');
const [show,setShow]=useState(false);
const [edit,setEdit]=useState(null);
const [confirmId,setConfirmId]=useState(null);
const fColors={All:T.primary,'In Progress':'#F59E0B',Completed:'#2563EB',Cancelled:'#DC2626'};
const STATUS_ORDER={'In Progress':0,'Completed':1,'Cancelled':2};
const filtered=useMemo(()=>{
const base=filter==='All'?trips:trips.filter(t=>t.status===filter);
return [...base].sort((a,b)=>{const sa=STATUS_ORDER[a.status]??1;const sb=STATUS_ORDER[b.status]??1;if(sa!==sb)return sa-sb;return(b.trip_date||'').localeCompare(a.trip_date||'');});
},[trips,filter]);
function save(data){if(edit)setTrips(ts=>ts.map(t=>t.id===edit.id?{...t,...data}:t));else setTrips(ts=>[{...data,id:Date.now()},...ts]);setShow(false);setEdit(null);}
function del(id){setTrips(ts=>ts.filter(t=>t.id!==id));setConfirmId(null);}
return(
<div style={{flex:1,display:'flex',flexDirection:'column',background:T.bg,overflow:'hidden'}}>
<div style={{background:T.primary,padding:'20px 20px 16px',flexShrink:0}}>
<div style={{fontSize:24,fontWeight:800,color:'#fff',marginBottom:14}}>My Trips</div>
<div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:4}}>
{['All','In Progress','Completed','Cancelled'].map(f=>{const a=filter===f;return <button key={f} onClick={()=>setFilter(f)} style={{padding:'7px 14px',borderRadius:20,border:'none',background:a?'#fff':'rgba(255,255,255,.2)',color:a?(fColors[f]||T.primary):'#fff',fontWeight:600,fontSize:13,cursor:'pointer',whiteSpace:'nowrap'}}>{f}</button>;})}
</div>
</div>
<div style={{flex:1,overflowY:'auto',padding:'16px 16px 100px'}}>
{filtered.length===0?(
<div style={{textAlign:'center',padding:48,color:T.textSec}}><div style={{fontSize:56}}>🚛</div><div style={{fontSize:17,fontWeight:600,marginTop:16}}>No trips found</div><div style={{fontSize:14,marginTop:6}}>Tap + to log your first trip</div></div>
):filtered.map(trip=>(
<div key={trip.id} style={{background:T.card,borderRadius:16,marginBottom:12,overflow:'hidden',boxShadow:'0 2px 8px rgba(0,0,0,.07)'}}>
{confirmId===trip.id?(
<div style={{background:'#FEF2F2',padding:'14px 16px'}}>
<div style={{fontSize:14,fontWeight:600,color:'#DC2626',marginBottom:10}}>🗑️ Delete this trip?</div>
<div style={{fontSize:12,color:'#64748B',marginBottom:12}}>{trip.origin} → {trip.destination}</div>
<div style={{display:'flex',gap:8}}><button onClick={()=>del(trip.id)} style={{flex:1,background:'#DC2626',color:'#fff',border:'none',borderRadius:8,padding:'10px 0',fontSize:14,fontWeight:700,cursor:'pointer'}}>Yes, Delete</button><button onClick={()=>setConfirmId(null)} style={{flex:1,background:T.border,color:T.text,border:'none',borderRadius:8,padding:'10px 0',fontSize:14,fontWeight:600,cursor:'pointer'}}>Cancel</button></div>
</div>
):(
<>
<div onClick={()=>navigate('TripDetail',{tripId:trip.id})} style={{cursor:'pointer'}}>
<div style={{background:STATUS_COLORS[trip.status]||T.primary,padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<div style={{flex:1,overflow:'hidden'}}>
{trip.trip_number&&<div style={{fontSize:11,fontWeight:800,color:'rgba(255,255,255,.8)',textTransform:'uppercase',letterSpacing:1,marginBottom:2}}>Trip # {trip.trip_number}</div>}
<div style={{fontSize:15,fontWeight:700,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{trip.origin||'Unknown'} → {trip.destination||'Unknown'}</div>
</div>
<span style={{background:'rgba(255,255,255,.25)',color:'#fff',fontSize:11,fontWeight:800,padding:'3px 10px',borderRadius:10,marginLeft:8,whiteSpace:'nowrap',letterSpacing:.3}}>{trip.status||'Active'}</span>
</div>
<div style={{padding:14}}>
<div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:T.textSec}}><span>📅 {trip.trip_date||'No date'}</span><span>🛣️ {trip.distance||0} miles</span></div>
{trip.vehicle_label&&<div style={{fontSize:12,color:T.accent,marginTop:5,fontWeight:600}}>🚛 {trip.vehicle_label}</div>}
{trip.notes?<div style={{fontSize:12,color:T.textSec,marginTop:4}}>{trip.notes}</div>:null}
</div>
</div>
<div style={{display:'flex',justifyContent:'flex-end',gap:16,padding:'0 14px 12px',borderTop:`1px solid ${T.border}`}}>
<button onClick={()=>{setEdit(trip);setShow(true);}} style={{background:'none',border:'none',color:T.accent,fontSize:13,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:4,paddingTop:10}}>✏️ Edit</button>
<button onClick={()=>setConfirmId(trip.id)} style={{background:'none',border:'none',color:'#EF4444',fontSize:13,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:4,paddingTop:10}}>🗑️ Delete</button>
</div>
</>
)}
</div>
))}
</div>
<button onClick={()=>{setEdit(null);setShow(true);}} style={{position:'absolute',right:20,bottom:76,width:56,height:56,borderRadius:28,background:T.primary,border:'none',color:'#fff',fontSize:28,cursor:'pointer',boxShadow:`0 4px 16px ${T.primary}88`,display:'flex',alignItems:'center',justifyContent:'center',zIndex:10}}>+</button>
<AddTripModal visible={show} onClose={()=>{setShow(false);setEdit(null);}} onSave={save} editTrip={edit} T={T} vehicles={vehicles}/>
</div>
);
}

// ═══════════════════════════ TRIP DETAIL ═════════════════════════
function TripDetail({tripId,trips,expenses,setExpenses,goBack}){
const {T}=useT();
const [show,setShow]=useState(false);
const [editE,setEditE]=useState(null);
const [confirmExpId,setConfirmExpId]=useState(null);
const trip=useMemo(()=>trips.find(t=>t.id===tripId)||null,[trips,tripId]);
const tExp=useMemo(()=>expenses.filter(e=>e.trip_id===tripId),[expenses,tripId]);
const total=useMemo(()=>tExp.reduce((s,e)=>s+(parseFloat(e.amount)||0),0),[tExp]);
const fuelEconomy=useMemo(()=>{
const fuelExp=tExp.filter(e=>e.expense_type==='Fuel'&&parseFloat(e.quantity)>0);
const dist=parseFloat(trip?.distance)||0;
if(!fuelExp.length||!dist)return null;
const totalLiters=fuelExp.reduce((s,e)=>{const q=parseFloat(e.quantity)||0;return s+(e.unit_type==='gallons'?q*3.78541:q);},0);
const totalGallons=totalLiters/3.78541;
const distKm=dist*1.60934;
return{mpg:totalGallons>0?(dist/totalGallons).toFixed(2):null,l100:distKm>0?((totalLiters/distKm)*100).toFixed(2):null,kpl:totalLiters>0?(distKm/totalLiters).toFixed(2):null,totalLiters:totalLiters.toFixed(1),totalGallons:totalGallons.toFixed(2)};
},[tExp,trip]);
function saveE(data){if(editE)setExpenses(es=>es.map(e=>e.id===editE.id?{...e,...data}:e));else setExpenses(es=>[...es,{...data,id:Date.now()}]);setShow(false);setEditE(null);}
function delE(id){setExpenses(es=>es.filter(e=>e.id!==id));setConfirmExpId(null);}
const d=trip||{origin:'Origin City',destination:'Destination City',trip_date:'N/A',distance:0,status:'In Progress'};
return(
<div style={{flex:1,display:'flex',flexDirection:'column',background:T.bg,overflow:'hidden'}}>
<div style={{background:STATUS_COLORS[d.status]||T.primary,padding:'16px 20px 24px',flexShrink:0}}>
<div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
<button onClick={goBack} style={{background:'none',border:'none',color:'#fff',fontSize:26,cursor:'pointer',padding:4,lineHeight:1}}>←</button>
<span style={{fontSize:20,fontWeight:700,color:'#fff',flex:1}}>Trip Details</span>
</div>
<div style={{background:'rgba(255,255,255,.12)',borderRadius:16,padding:16}}>
{d.trip_number&&<div style={{fontSize:12,fontWeight:800,color:'rgba(255,255,255,.65)',textTransform:'uppercase',letterSpacing:1.2,marginBottom:8}}>Trip # {d.trip_number}</div>}
<div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
<span style={{color:'rgba(255,255,255,.8)'}}>📍</span>
<span style={{fontSize:16,fontWeight:600,color:'#fff',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.origin||'N/A'}</span>
<span style={{color:'rgba(255,255,255,.6)'}}>→</span>
<span style={{fontSize:16,fontWeight:600,color:'#fff',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.destination||'N/A'}</span>
</div>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<span style={{fontSize:13,color:'rgba(255,255,255,.85)'}}>📅 {d.trip_date||'N/A'}</span>
<span style={{fontSize:13,color:'rgba(255,255,255,.85)'}}>🛣️ {d.distance||0} mi</span>
<div style={{background:'rgba(255,255,255,.2)',borderRadius:10,padding:'2px 10px'}}><span style={{color:'#fff',fontSize:11,fontWeight:700}}>{d.status||'Active'}</span></div>
</div>
</div>
</div>
<div style={{display:'flex',margin:'16px 16px 8px',gap:8}}>
<div style={{flex:1,background:'#EFF6FF',borderRadius:12,padding:14,textAlign:'center'}}><div style={{fontSize:22,fontWeight:800,color:T.primary}}>{tExp.length}</div><div style={{fontSize:12,color:'#64748B',marginTop:2}}>Expenses</div></div>
<div style={{flex:2,background:'#FEF2F2',borderRadius:12,padding:14,textAlign:'center'}}><div style={{fontSize:22,fontWeight:800,color:'#DC2626'}}>${total.toFixed(2)}</div><div style={{fontSize:12,color:'#64748B',marginTop:2}}>Total Trip Cost</div></div>
</div>
<div style={{margin:'0 16px 8px',background:'#FEF3C7',borderRadius:12,padding:14}}>
{fuelEconomy?(
<>
<div style={{fontSize:11,fontWeight:700,color:'#92400E',textTransform:'uppercase',letterSpacing:.8,marginBottom:8}}>⛽ Fuel Economy</div>
<div style={{display:'flex',gap:8}}>
<div style={{flex:1,background:'rgba(255,255,255,.6)',borderRadius:8,padding:'10px 12px',textAlign:'center'}}><div style={{fontSize:22,fontWeight:800,color:'#D97706'}}>{fuelEconomy.mpg}</div><div style={{fontSize:11,color:'#92400E',fontWeight:600,marginTop:2}}>MPG</div><div style={{fontSize:10,color:'#B45309',marginTop:1}}>miles per gallon</div></div>
<div style={{flex:1,background:'rgba(255,255,255,.6)',borderRadius:8,padding:'10px 12px',textAlign:'center'}}><div style={{fontSize:22,fontWeight:800,color:'#D97706'}}>{fuelEconomy.l100}</div><div style={{fontSize:11,color:'#92400E',fontWeight:600,marginTop:2}}>L/100km</div><div style={{fontSize:10,color:'#B45309',marginTop:1}}>liters per 100 km</div></div>
<div style={{flex:1,background:'rgba(255,255,255,.6)',borderRadius:8,padding:'10px 12px',textAlign:'center'}}><div style={{fontSize:22,fontWeight:800,color:'#D97706'}}>{fuelEconomy.kpl}</div><div style={{fontSize:11,color:'#92400E',fontWeight:600,marginTop:2}}>km/L</div><div style={{fontSize:10,color:'#B45309',marginTop:1}}>kilometers per liter</div></div>
</div>
<div style={{marginTop:8,fontSize:11,color:'#92400E',textAlign:'center'}}>{fuelEconomy.totalLiters} L ({fuelEconomy.totalGallons} gal) used over {d.distance} miles</div>
</>
):(
<div style={{textAlign:'center',padding:'4px 0'}}><div style={{fontSize:20}}>⛽</div><div style={{fontSize:13,fontWeight:700,color:'#D97706',marginTop:4}}>Fuel Economy</div><div style={{fontSize:12,color:'#92400E',marginTop:2}}>Add a Fuel expense with quantity to calculate MPG & L/100km</div></div>
)}
</div>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0 16px 8px'}}>
<div style={{fontSize:17,fontWeight:700,color:T.text}}>Expenses</div>
<button onClick={()=>{setEditE(null);setShow(true);}} style={{display:'flex',alignItems:'center',gap:4,background:T.primary,color:'#fff',border:'none',borderRadius:10,padding:'8px 14px',fontSize:13,fontWeight:600,cursor:'pointer'}}>+ Add Expense</button>
</div>
<div style={{flex:1,overflowY:'auto',padding:'0 16px 24px'}}>
{tExp.length===0?(<div style={{textAlign:'center',padding:32,color:T.textSec}}><div style={{fontSize:40}}>🧾</div><div style={{fontSize:15,marginTop:12}}>No expenses recorded yet</div></div>):tExp.map(exp=>{
const col=EXPENSE_COLORS[exp.expense_type]||'#6B7280';
return(
<div key={exp.id} style={{background:T.card,borderRadius:12,marginBottom:10,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.05)'}}>
{confirmExpId===exp.id?(
<div style={{background:'#FEF2F2',padding:'12px 14px'}}>
<div style={{fontSize:13,fontWeight:600,color:'#DC2626',marginBottom:8}}>🗑️ Delete this expense?</div>
<div style={{display:'flex',gap:8}}><button onClick={()=>delE(exp.id)} style={{flex:1,background:'#DC2626',color:'#fff',border:'none',borderRadius:7,padding:'8px 0',fontSize:13,fontWeight:700,cursor:'pointer'}}>Yes, Delete</button><button onClick={()=>setConfirmExpId(null)} style={{flex:1,background:T.border,color:T.text,border:'none',borderRadius:7,padding:'8px 0',fontSize:13,fontWeight:600,cursor:'pointer'}}>Cancel</button></div>
</div>
):(
<div style={{display:'flex',alignItems:'center',padding:14}}>
<div style={{width:42,height:42,borderRadius:21,background:col+'22',display:'flex',alignItems:'center',justifyContent:'center',marginRight:12,fontSize:20,flexShrink:0}}>{EXPENSE_ICONS[exp.expense_type]||'🧾'}</div>
<div style={{flex:1,minWidth:0}}>
<div style={{fontSize:14,fontWeight:600,color:T.text}}>{exp.expense_type||'Other'}</div>
{exp.description?<div style={{fontSize:12,color:T.textSec,marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{exp.description}</div>:null}
<div style={{display:'flex',gap:6,marginTop:2,flexWrap:'wrap'}}>
<span style={{fontSize:11,color:T.textSec}}>{exp.expense_date||'No date'}</span>
{exp.quantity?<span style={{fontSize:11,color:T.textSec}}>| {exp.quantity} {exp.unit_type||'gal'}</span>:null}
{exp.pump_city?<span style={{fontSize:11,color:T.textSec}}>| {exp.pump_city}</span>:null}
{exp.toll_name?<span style={{fontSize:11,color:T.textSec}}>| {exp.toll_name}</span>:null}
</div>
</div>
<div style={{fontSize:16,fontWeight:700,color:col,marginRight:8}}>${(parseFloat(exp.amount)||0).toFixed(2)}</div>
<div style={{display:'flex',flexDirection:'column',gap:2}}>
<button onClick={()=>{setEditE(exp);setShow(true);}} style={{background:'none',border:'none',cursor:'pointer',fontSize:16,padding:4,color:T.accent}}>✏️</button>
<button onClick={()=>setConfirmExpId(exp.id)} style={{background:'none',border:'none',cursor:'pointer',fontSize:16,padding:4,color:'#EF4444'}}>🗑️</button>
</div>
</div>
)}
</div>
);
})}
</div>
<AddExpenseModal visible={show} onClose={()=>{setShow(false);setEditE(null);}} onSave={saveE} tripId={tripId} editExpense={editE} T={T}/>
</div>
);
}

// ═══════════════════════════ REPORTS ═════════════════════════════
function Reports({trips,expenses}){
const {T}=useT();
const byType=useMemo(()=>{const m={};EXPENSE_TYPES.forEach(t=>m[t]=0);expenses.forEach(e=>{m[e.expense_type||'Other']=(m[e.expense_type||'Other']||0)+(parseFloat(e.amount)||0);});return m;},[expenses]);
const total=useMemo(()=>expenses.reduce((s,e)=>s+(parseFloat(e.amount)||0),0),[expenses]);
const tMi=useMemo(()=>trips.reduce((s,t)=>s+(parseFloat(t.distance)||0),0),[trips]);
const cpm=tMi>0?total/tMi:0;
const bySt=useMemo(()=>{const m={'In Progress':0,Completed:0,Cancelled:0};trips.forEach(t=>m[t.status||'In Progress']++);return m;},[trips]);
return(
<div style={{flex:1,overflowY:'auto',background:T.bg,paddingBottom:24}}>
<div style={{background:T.primary,padding:'20px 20px 28px'}}><div style={{fontSize:24,fontWeight:800,color:'#fff'}}>Reports & Analytics</div><div style={{fontSize:13,color:'rgba(255,255,255,.8)',marginTop:4}}>Financial summary of all trips</div></div>
<div style={{margin:16,background:T.card,borderRadius:16,padding:20,boxShadow:'0 2px 8px rgba(0,0,0,.07)'}}>
<div style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:16}}>Key Metrics</div>
<div style={{display:'flex',justifyContent:'space-around',textAlign:'center'}}>
<div><div style={{fontSize:22,fontWeight:800,color:T.primary}}>{trips.length}</div><div style={{fontSize:12,color:T.textSec,marginTop:4}}>Total Trips</div></div>
<div style={{width:1,background:T.border}}/>
<div><div style={{fontSize:22,fontWeight:800,color:'#DC2626'}}>${total.toFixed(0)}</div><div style={{fontSize:12,color:T.textSec,marginTop:4}}>Total Cost</div></div>
<div style={{width:1,background:T.border}}/>
<div><div style={{fontSize:22,fontWeight:800,color:'#059669'}}>${cpm.toFixed(2)}</div><div style={{fontSize:12,color:T.textSec,marginTop:4}}>Cost/Mile</div></div>
</div>
</div>
<div style={{margin:'0 16px 16px',background:T.card,borderRadius:16,padding:20,boxShadow:'0 2px 8px rgba(0,0,0,.07)'}}>
<div style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:16}}>Expense Breakdown</div>
{EXPENSE_TYPES.map(type=>{const val=byType[type]||0;const pct=total>0?(val/total*100):0;const col=EXPENSE_COLORS[type]||'#6B7280';return(
<div key={type} style={{marginBottom:14}}>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
<div style={{display:'flex',alignItems:'center',gap:8}}><div style={{width:28,height:28,borderRadius:14,background:col+'22',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13}}>{EXPENSE_ICONS[type]}</div><span style={{fontSize:14,color:T.text,fontWeight:500}}>{type}</span></div>
<div style={{textAlign:'right'}}><div style={{fontSize:14,fontWeight:700,color:col}}>${val.toFixed(2)}</div><div style={{fontSize:11,color:T.textSec}}>{pct.toFixed(1)}%</div></div>
</div>
<div style={{height:6,background:T.border,borderRadius:3,overflow:'hidden'}}><div style={{height:6,background:col,borderRadius:3,width:`${pct}%`,transition:'width .5s ease'}}/></div>
</div>
);})}
</div>
<div style={{margin:'0 16px 16px',background:T.card,borderRadius:16,padding:20,boxShadow:'0 2px 8px rgba(0,0,0,.07)'}}>
<div style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:16}}>Trip Status Breakdown</div>
<div style={{display:'flex',justifyContent:'space-around'}}>
{TRIP_STATUSES.map(s=>{const col=STATUS_COLORS[s]||'#6B7280';return(
<div key={s} style={{textAlign:'center',flex:1}}>
<div style={{width:50,height:50,borderRadius:25,border:`2px solid ${col}`,background:col+'18',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 8px',fontSize:20,fontWeight:800,color:col}}>{bySt[s]||0}</div>
<div style={{fontSize:11,color:T.textSec}}>{s}</div>
</div>
);})}
</div>
</div>
</div>
);
}

// ═══════════════════════════ SETTINGS ════════════════════════════
function Settings({vc,setVc}){
const {T,dark,toggle,useKm,toggleUnits,useLiters,toggleFuelUnits}=useT();
function Row({em,bg,label,sub,onPr,right}){
return(<div onClick={onPr} style={{display:'flex',alignItems:'center',padding:'16px 20px',borderBottom:`1px solid ${T.border}`,cursor:onPr?'pointer':'default',background:T.card}}><div style={{width:36,height:36,borderRadius:10,background:(bg||T.primary)+'22',display:'flex',alignItems:'center',justifyContent:'center',marginRight:14,fontSize:18}}>{em}</div><div style={{flex:1}}><div style={{fontSize:15,fontWeight:500,color:T.text}}>{label}</div>{sub&&<div style={{fontSize:12,color:T.textSec,marginTop:2}}>{sub}</div>}</div>{right||<span style={{color:T.textSec,fontSize:18}}>›</span>}</div>);
}
function Tog({on,fn}){return(<div onClick={fn} style={{width:46,height:26,borderRadius:13,background:on?T.primary:T.border,display:'flex',alignItems:'center',padding:2,justifyContent:on?'flex-end':'flex-start',cursor:'pointer',transition:'background .2s',flexShrink:0}}><div style={{width:22,height:22,borderRadius:11,background:'#fff',boxShadow:'0 1px 3px rgba(0,0,0,.2)'}}/></div>);}
const sec=(t)=><div style={{padding:'20px 20px 8px'}}><div style={{fontSize:12,fontWeight:700,color:T.textSec,textTransform:'uppercase',letterSpacing:1}}>{t}</div></div>;
return(
<div style={{flex:1,overflowY:'auto',background:T.bg,paddingBottom:24}}>
<div style={{background:T.primary,padding:'20px 20px 30px'}}>
<div style={{display:'flex',alignItems:'center',gap:14}}>
<div style={{width:56,height:56,borderRadius:28,background:'rgba(255,255,255,.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28}}>🚛</div>
<div><div style={{fontSize:20,fontWeight:800,color:'#fff'}}>TripLog</div><div style={{fontSize:13,color:'rgba(255,255,255,.8)'}}>Trucking Management App</div></div>
</div>
</div>
{sec('Preferences')}
<div style={{margin:'0 16px 20px',borderRadius:16,overflow:'hidden',boxShadow:'0 1px 6px rgba(0,0,0,.05)'}}>
<Row em="🌙" bg="#7C3AED" label="Dark Mode" sub={dark?'Currently enabled':'Currently disabled'} onPr={toggle} right={<Tog on={dark} fn={toggle}/>}/>
<Row em="🔔" bg="#F59E0B" label="Notifications" sub="Manage alerts and reminders"/>
<Row em="📏" bg="#0891B2" label="Distance Units" sub={useKm?'Kilometers (km)':'Miles (mi)'} onPr={toggleUnits} right={<Tog on={useKm} fn={toggleUnits}/>}/>
<Row em="⛽" bg="#059669" label="Fuel Units" sub={useLiters?'Litres — shows L/100km as primary':'Gallons — shows MPG as primary'} onPr={toggleFuelUnits} right={<Tog on={useLiters} fn={toggleFuelUnits}/>}/>
</div>
{sec('App Info')}
<div style={{margin:'0 16px 20px',borderRadius:16,overflow:'hidden',boxShadow:'0 1px 6px rgba(0,0,0,.05)'}}>
<Row em="ℹ️" bg="#1E40AF" label="About TripLog" sub="Version 1.0.0"/>
<Row em="❓" bg="#059669" label="Help & Support" sub="FAQs and contact info"/>
<Row em="🔒" bg="#DC2626" label="Privacy Policy"/>
</div>
<div style={{margin:'0 16px',background:'#FEF2F2',borderRadius:12,padding:16,textAlign:'center'}}>
<div style={{fontSize:28}}>🚛</div>
<div style={{fontSize:14,fontWeight:600,color:'#1E293B',marginTop:8}}>TripLog - Trucking Made Easy</div>
<div style={{fontSize:12,color:'#64748B',marginTop:4}}>Track trips, manage expenses, stay profitable.</div>
</div>
</div>
);
}

// ═══════════════════════════ TAB BAR ═════════════════════════════
function TabBar({active,onPress,T}){
const tabs=[{k:'Dashboard',i:'📊',l:'Dashboard'},{k:'Trips',i:'🚛',l:'Trips'},{k:'Vehicles',i:'🔧',l:'Vehicles'},{k:'Reports',i:'📈',l:'Reports'},{k:'Settings',i:'⚙️',l:'Settings'}];
return(
<div style={{display:'flex',background:T.card,borderTop:`1px solid ${T.border}`,boxShadow:'0 -2px 12px rgba(0,0,0,.08)',flexShrink:0,zIndex:50,paddingBottom:'env(safe-area-inset-bottom)'}}>
{tabs.map(tab=>(<button key={tab.k} onClick={()=>onPress(tab.k)} style={{flex:1,paddingTop:10,paddingBottom:8,border:'none',background:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:2,minHeight:56}}><span style={{fontSize:22}}>{tab.i}</span><span style={{fontSize:10,fontWeight:600,color:active===tab.k?T.primary:'#94A3B8'}}>{tab.l}</span></button>))}
</div>
);
}

// ═══════════════════════════ APP INNER ═══════════════════════════
function AppInner(){
const {T}=useT();
const [trips,    setTrips]    = useLocalStorage('tl_trips',    INIT_TRIPS);
const [expenses, setExpenses] = useLocalStorage('tl_expenses', INIT_EXPENSES);
const [vehicles, setVehicles] = useLocalStorage('tl_vehicles', []);
const [vc,       setVc]       = useLocalStorage('tl_vc',       {unit_number:'',vehicle_type:'',fuel_tank_capacity:'',driver_name:''});
const [stack,setStack]=useState(['Dashboard']);
const [selId,setSelId]=useState(null);
const cur=stack[stack.length-1];
const activeTab=[...stack].reverse().find(s=>s!=='TripDetail')||'Dashboard';
function nav(screen,params){if(screen==='TripDetail'){setSelId(params.tripId);setStack(p=>[...p,'TripDetail']);}else setStack([screen]);}
function goBack(){if(stack.length>1)setStack(p=>p.slice(0,-1));}
return(
<div style={{width:'100%',height:'100dvh',display:'flex',flexDirection:'column',fontFamily:"'Segoe UI',system-ui,sans-serif",maxWidth:430,margin:'0 auto',background:T.bg,overflow:'hidden',position:'relative',paddingTop:'env(safe-area-inset-top)'}}>
<div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
{cur==='Dashboard'  && <Dashboard  trips={trips} expenses={expenses} navigate={nav}/>}
{cur==='Trips'      && <Trips      trips={trips} setTrips={setTrips} navigate={nav} vehicles={vehicles}/>}
{cur==='Vehicles'   && <Vehicles   vehicles={vehicles} setVehicles={setVehicles}/>}
{cur==='Reports'    && <Reports    trips={trips} expenses={expenses}/>}
{cur==='Settings'   && <Settings   vc={vc} setVc={setVc}/>}
{cur==='TripDetail' && <TripDetail tripId={selId} trips={trips} expenses={expenses} setExpenses={setExpenses} goBack={goBack}/>}
</div>
{cur!=='TripDetail'&&<TabBar active={activeTab} onPress={nav} T={T}/>}
</div>
);
}

export default function App(){
return <ThemeProvider><AppInner/></ThemeProvider>;
}
