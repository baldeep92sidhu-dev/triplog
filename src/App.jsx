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
        } catch { }
    }, [key, value]);

    return [value, setValue];
}

// ═══════════════════════════ CONSTANTS ═══════════════════════════
const EXPENSE_TYPES = ['Fuel', 'DEF', 'Maintenance', 'Toll', 'Food', 'Parking', 'Other'];
const EXPENSE_COLORS = { Fuel: '#F59E0B', DEF: '#8B5CF6', Maintenance: '#EF4444', Toll: '#8B5CF6', Food: '#10B981', Parking: '#3B82F6', Other: '#6B7280' };
const EXPENSE_ICONS = { Fuel: '⛽', DEF: '🛢️', Maintenance: '🔧', Toll: '💰', Food: '🍽️', Parking: '🅿️', Other: '🧾' };
const TRIP_STATUSES = ['Scheduled', 'In Progress', 'Completed', 'Cancelled'];
const STATUS_COLORS = { Scheduled: '#7C3AED', 'In Progress': '#F59E0B', Completed: '#2563EB', Cancelled: '#DC2626' };
const US_STATES = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'];
const CA_PROVINCES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];
const TOLLS = [
    { name: 'Golden Gate Bridge (CA)', state: 'CA', country: 'USA' },
    { name: 'George Washington Bridge (NY)', state: 'NY', country: 'USA' },
    { name: 'Lincoln Tunnel (NY)', state: 'NY', country: 'USA' },
    { name: 'Holland Tunnel (NY)', state: 'NY', country: 'USA' },
    { name: 'Verrazano-Narrows Bridge (NY)', state: 'NY', country: 'USA' },
    { name: 'New Jersey Turnpike (NJ)', state: 'NJ', country: 'USA' },
    { name: 'Pennsylvania Turnpike (PA)', state: 'PA', country: 'USA' },
    { name: 'Indiana Toll Road (IN)', state: 'IN', country: 'USA' },
    { name: 'Illinois Tollway (IL)', state: 'IL', country: 'USA' },
    { name: 'Ohio Turnpike (OH)', state: 'OH', country: 'USA' },
    { name: 'Peace Bridge (NY-ON)', state: 'NY', country: 'USA', border: 'Canada' },
    { name: 'Rainbow Bridge (NY-ON)', state: 'NY', country: 'USA', border: 'Canada' },
    { name: 'Lewiston-Queenston Bridge (NY-ON)', state: 'NY', country: 'USA', border: 'Canada' },
    { name: 'Thousand Islands Bridge (NY-ON)', state: 'NY', country: 'USA', border: 'Canada' },
    { name: 'Ambassador Bridge (MI-ON)', state: 'MI', country: 'USA', border: 'Canada' },
    { name: 'Bluewater Bridge (MI-ON)', state: 'MI', country: 'USA', border: 'Canada' },
    { name: 'Trans-Canada Highway (401)', province: 'ON', country: 'Canada' },
    { name: 'Deerfoot Trail', province: 'AB', country: 'Canada' },
    { name: 'Confederation Bridge (PE)', province: 'PE', country: 'Canada' },
];

const INIT_TRIPS = [];
const INIT_EXPENSES = [];

// ═══════════════════════════ UTILS ═══════════════════════════════
function curMonth() { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; }
function fmtC(v) { return '$' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

function calcTripRevenue(trip) {
    const rate = parseFloat(trip.trip_rate) || 0;
    const dist = parseFloat(trip.distance) || 0;
    if (trip.rate_type === 'total') return rate;
    if (trip.rate_type === 'per_km') return rate * (dist * 1.60934);
    return rate * dist;
}

const ThemeCtx = createContext({ T: {}, dark: false, toggle: () => { }, useKm: false, toggleUnits: () => { }, useLiters: false, toggleFuelUnits: () => { } });

function ThemeProvider({ children }) {
    const [dark, setDark] = useLocalStorage('tl_dark', false);
    const [useKm, setUseKm] = useLocalStorage('tl_useKm', false);
    const [useLiters, setUseLiters] = useLocalStorage('tl_useLiters', false);
    const light = { primary: '#1E40AF', accent: '#3B82F6', bg: '#F0F4FF', card: '#FFFFFF', text: '#1E293B', textSec: '#64748B', border: '#E2E8F0' };
    const darkT = { primary: '#3B82F6', accent: '#60A5FA', bg: '#0F172A', card: '#1E293B', text: '#F1F5F9', textSec: '#94A3B8', border: '#334155' };
    const T = dark ? darkT : light;
    const toggle = useCallback(() => setDark(p => !p), []);
    const toggleUnits = useCallback(() => setUseKm(p => !p), []);
    const toggleFuelUnits = useCallback(() => setUseLiters(p => !p), []);
    const val = useMemo(() => ({ T, dark, toggle, useKm, toggleUnits, useLiters, toggleFuelUnits }), [T, dark, toggle, useKm, toggleUnits, useLiters, toggleFuelUnits]);
    return <ThemeCtx.Provider value={val}>{children}</ThemeCtx.Provider>;
}
const useT = () => useContext(ThemeCtx);

// ═══════════════════════════ STAT CARD — 2 per row ═══════════════
// Wider cards: icon left, value+label right, full half-screen width
function SC({ bg, icon, value, label, subLabel, onClick }) {
    return (
        <div onClick={onClick} style={{
            flex: '0 0 calc(50% - 6px)',
            background: bg,
            borderRadius: 14,
            padding: '14px 16px',
            margin: '0 0 8px 0',
            boxShadow: `0 3px 10px ${bg}55`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            minWidth: 0,
            cursor: onClick ? 'pointer' : 'default',
        }}>
            <div style={{
                background: 'rgba(255,255,255,.22)',
                borderRadius: 10,
                width: 44,
                height: 44,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
            }}>{icon}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.85)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>{label}</div>
                {subLabel && <div style={{ fontSize: 10, color: 'rgba(255,255,255,.65)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subLabel}</div>}
            </div>
        </div>
    );
}

// 2-column grid wrapper for stat cards
function StatGrid({ children }) {
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 12px 4px' }}>
            {children}
        </div>
    );
}

function Lbl({ c, T }) { return <div style={{ fontSize: 13, fontWeight: 600, color: T.textSec, marginBottom: 4, textTransform: 'uppercase', letterSpacing: .5 }}>{c}</div>; }

function iSt(T, ex) { return { border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px', fontSize: 15, color: T.text, background: T.card, marginBottom: 12, width: '100%', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', ...ex }; }

function TB({ on, label, onClick, T }) {
    return <button onClick={onClick} style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: `1px solid ${on ? T.primary : T.border}`, background: on ? T.primary : T.card, color: on ? '#fff' : T.textSec, fontWeight: 600, fontSize: 13, cursor: 'pointer', textAlign: 'center' }}>{label}</button>;
}

// ═══════════════════════════ MODAL SHEET ═════════════════════════
function Sheet({ visible, onClose, title, T, children }) {
    if (!visible) return null;
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 500, display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
            <div style={{ background: T.bg, borderRadius: '24px 24px 0 0', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 20px 16px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: T.text }}>{title}</span>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: T.textSec, lineHeight: 1 }}>✕</button>
                </div>
                <div style={{ overflowY: 'auto', flex: 1, padding: 20, paddingBottom: 40 }}>{children}</div>
            </div>
        </div>
    );
}

// ═══════════════════════════ CITY DATABASE + SEARCH ══════════════
// 400+ cities across Canada & USA — instant offline search, no API needed
const CITIES = [
    ['Acton', 'ON', 43.6317, -80.0453], ['Ajax', 'ON', 43.8509, -79.0204], ['Alliston', 'ON', 44.1501, -79.8667],
    ['Almonte', 'ON', 45.2284, -76.1895], ['Amherstburg', 'ON', 42.1001, -83.1001], ['Arnprior', 'ON', 45.4334, -76.3548],
    ['Aurora', 'ON', 43.9985, -79.4676], ['Aylmer', 'ON', 42.7723, -80.9842], ['Bancroft', 'ON', 45.0559, -77.8525],
    ['Barrie', 'ON', 44.3894, -79.6903], ['Belleville', 'ON', 44.1628, -77.3832], ['Bolton', 'ON', 43.8748, -79.7296],
    ['Bowmanville', 'ON', 43.9140, -78.6885], ['Bradford', 'ON', 44.1167, -79.5667], ['Brampton', 'ON', 43.7315, -79.7624],
    ['Brantford', 'ON', 43.1394, -80.2644], ['Brockville', 'ON', 44.5895, -75.6866], ['Burlington', 'ON', 43.3255, -79.7990],
    ['Caledonia', 'ON', 43.0747, -79.9517], ['Cambridge', 'ON', 43.3616, -80.3144], ['Carleton Place', 'ON', 45.1334, -76.1418],
    ['Chatham', 'ON', 42.4048, -82.1910], ['Clinton', 'ON', 43.6100, -81.5400], ['Cobourg', 'ON', 43.9595, -78.1677],
    ['Cochrane', 'ON', 49.0584, -81.0168], ['Collingwood', 'ON', 44.5001, -80.2167], ['Cornwall', 'ON', 45.0275, -74.7267],
    ['Delhi', 'ON', 42.8501, -80.5001], ['Dryden', 'ON', 49.7831, -92.8378], ['Dundas', 'ON', 43.2667, -79.9500],
    ['Elliot Lake', 'ON', 46.3834, -82.6501], ['Espanola', 'ON', 46.2584, -81.7668], ['Exeter', 'ON', 43.3501, -81.4834],
    ['Fergus', 'ON', 43.7068, -80.3762], ['Fort Erie', 'ON', 42.9001, -79.0167], ['Fort Frances', 'ON', 48.6084, -93.4001],
    ['Gananoque', 'ON', 44.3334, -76.1667], ['Georgetown', 'ON', 43.6501, -79.9167], ['Gravenhurst', 'ON', 44.9167, -79.3667],
    ['Grimsby', 'ON', 43.2001, -79.5667], ['Guelph', 'ON', 43.5448, -80.2482], ['Haileybury', 'ON', 47.4501, -79.6334],
    ['Halton Hills', 'ON', 43.6334, -79.9167], ['Hamilton', 'ON', 43.2557, -79.8711], ['Hanover', 'ON', 44.1501, -81.0334],
    ['Hawkesbury', 'ON', 45.6001, -74.6001], ['Hearst', 'ON', 49.6834, -83.6667], ['Huntsville', 'ON', 45.3334, -79.2167],
    ['Ingersoll', 'ON', 43.0390, -80.8834], ['Kapuskasing', 'ON', 49.4167, -82.4334], ['Kenora', 'ON', 49.7667, -94.4834],
    ['Kingston', 'ON', 44.2312, -76.4860], ['Kirkland Lake', 'ON', 48.1501, -80.0334], ['Kitchener', 'ON', 43.4516, -80.4925],
    ['Leamington', 'ON', 42.0501, -82.5990], ['Lindsay', 'ON', 44.3501, -78.7334], ['London', 'ON', 42.9849, -81.2453],
    ['Markham', 'ON', 43.8561, -79.3370], ['Meaford', 'ON', 44.6001, -80.5834], ['Milton', 'ON', 43.5168, -79.8774],
    ['Mississauga', 'ON', 43.5890, -79.6441], ['Midland', 'ON', 44.7501, -79.8834], ['Napanee', 'ON', 44.2501, -76.9501],
    ['New Hamburg', 'ON', 43.3834, -80.7167], ['Newmarket', 'ON', 44.0501, -79.4667], ['Niagara Falls', 'ON', 43.0962, -79.0377],
    ['Niagara-on-the-Lake', 'ON', 43.2548, -79.0715], ['North Bay', 'ON', 46.3091, -79.4608], ['Oakville', 'ON', 43.4501, -79.6834],
    ['Orangeville', 'ON', 43.9167, -80.0934], ['Orillia', 'ON', 44.5993, -79.4202], ['Oshawa', 'ON', 43.8971, -78.8658],
    ['Ottawa', 'ON', 45.4215, -75.6972], ['Owen Sound', 'ON', 44.5667, -80.9434], ['Parry Sound', 'ON', 45.3501, -80.0334],
    ['Pembroke', 'ON', 45.8167, -77.1001], ['Perth', 'ON', 44.9001, -76.2501], ['Peterborough', 'ON', 44.3091, -78.3197],
    ['Picton', 'ON', 44.0001, -77.1334], ['Port Hope', 'ON', 43.9501, -78.3001], ['Port Colborne', 'ON', 42.8834, -79.2501],
    ['Prescott', 'ON', 44.7167, -75.5167], ['Renfrew', 'ON', 45.4667, -76.6834], ['Richmond Hill', 'ON', 43.8828, -79.4403],
    ['Sarnia', 'ON', 42.9745, -82.4066], ['Sault Ste Marie', 'ON', 46.5136, -84.3358], ['Simcoe', 'ON', 42.8334, -80.3001],
    ['Smiths Falls', 'ON', 44.9001, -76.0167], ['St Catharines', 'ON', 43.1594, -79.2469], ['St Thomas', 'ON', 42.7751, -81.1932],
    ['Stoney Creek', 'ON', 43.2167, -79.7501], ['Stratford', 'ON', 43.3709, -80.9822], ['Strathroy', 'ON', 42.9584, -81.6168],
    ['Sturgeon Falls', 'ON', 46.3667, -79.9334], ['Sudbury', 'ON', 46.5220, -80.9528], ['Thessalon', 'ON', 46.2501, -83.5501],
    ['Thunder Bay', 'ON', 48.3809, -89.2477], ['Tillsonburg', 'ON', 42.8596, -80.7283], ['Timmins', 'ON', 48.4758, -81.3305],
    ['Toronto', 'ON', 43.6532, -79.3832], ['Trenton', 'ON', 44.1001, -77.5834], ['Uxbridge', 'ON', 44.1084, -79.1237],
    ['Vaughan', 'ON', 43.8361, -79.4983], ['Wallaceburg', 'ON', 42.5967, -82.3884], ['Wasaga Beach', 'ON', 44.5201, -80.0167],
    ['Waterloo', 'ON', 43.4668, -80.5164], ['Welland', 'ON', 42.9834, -79.2501], ['Whitby', 'ON', 43.8834, -78.9418],
    ['Windsor', 'ON', 42.3149, -83.0364], ['Wingham', 'ON', 43.8834, -81.3084], ['Woodstock', 'ON', 43.1298, -80.7470],
    ['Montreal', 'QC', 45.5017, -73.5673], ['Quebec City', 'QC', 46.8139, -71.2082], ['Laval', 'QC', 45.5991, -73.7124],
    ['Longueuil', 'QC', 45.5315, -73.5182], ['Sherbrooke', 'QC', 45.4042, -71.8929], ['Saguenay', 'QC', 48.4285, -71.0688],
    ['Trois-Rivieres', 'QC', 46.3432, -72.5418], ['Drummondville', 'QC', 45.8836, -72.4854], ['Granby', 'QC', 45.3987, -72.7312],
    ['Saint-Jerome', 'QC', 45.7834, -74.0001], ['Joliette', 'QC', 46.0167, -73.4501], ['Rouyn-Noranda', 'QC', 48.2334, -79.0167],
    ['Rimouski', 'QC', 48.4501, -68.5334], ['Sept-Iles', 'QC', 50.2167, -66.3834], ['Shawinigan', 'QC', 46.5667, -72.7501],
    ['Victoriaville', 'QC', 46.0501, -71.9667], ['Thetford Mines', 'QC', 46.1001, -71.3001],
    ['Calgary', 'AB', 51.0447, -114.0719], ['Edmonton', 'AB', 53.5461, -113.4938], ['Red Deer', 'AB', 52.2681, -113.8112],
    ['Lethbridge', 'AB', 49.6956, -112.8451], ['St Albert', 'AB', 53.6334, -113.6251], ['Medicine Hat', 'AB', 50.0405, -110.6764],
    ['Grande Prairie', 'AB', 55.1707, -118.7884], ['Airdrie', 'AB', 51.2917, -114.0144], ['Spruce Grove', 'AB', 53.5457, -113.9195],
    ['Leduc', 'AB', 53.2667, -113.5501], ['Fort McMurray', 'AB', 56.7265, -111.3790], ['Camrose', 'AB', 53.0167, -112.8334],
    ['Lloydminster', 'AB', 53.2834, -110.0001], ['Brooks', 'AB', 50.5667, -111.8834], ['High River', 'AB', 50.5834, -113.8667],
    ['Banff', 'AB', 51.1784, -115.5708], ['Canmore', 'AB', 51.0890, -115.3597], ['Jasper', 'AB', 52.8734, -118.0822],
    ['Vancouver', 'BC', 49.2827, -123.1207], ['Surrey', 'BC', 49.1913, -122.8490], ['Burnaby', 'BC', 49.2488, -122.9805],
    ['Richmond', 'BC', 49.1666, -123.1336], ['Kelowna', 'BC', 49.8880, -119.4960], ['Abbotsford', 'BC', 49.0504, -122.3045],
    ['Coquitlam', 'BC', 49.2838, -122.7932], ['Langley', 'BC', 49.1042, -122.6604], ['Kamloops', 'BC', 50.6745, -120.3273],
    ['Nanaimo', 'BC', 49.1659, -123.9401], ['Chilliwack', 'BC', 49.1579, -121.9514], ['Victoria', 'BC', 48.4284, -123.3656],
    ['Prince George', 'BC', 53.9171, -122.7497], ['Vernon', 'BC', 50.2671, -119.2720], ['Penticton', 'BC', 49.4990, -119.5937],
    ['Fort St John', 'BC', 56.2518, -120.8487], ['Dawson Creek', 'BC', 55.7596, -120.2370], ['Terrace', 'BC', 54.5168, -128.6001],
    ['Winnipeg', 'MB', 49.8951, -97.1384], ['Brandon', 'MB', 49.8485, -99.9501], ['Steinbach', 'MB', 49.5251, -96.6834],
    ['Thompson', 'MB', 55.7435, -97.8553], ['Portage la Prairie', 'MB', 49.9728, -98.2917], ['Selkirk', 'MB', 50.1441, -96.8844],
    ['Saskatoon', 'SK', 52.1332, -106.6700], ['Regina', 'SK', 50.4452, -104.6189], ['Prince Albert', 'SK', 53.2001, -105.7501],
    ['Moose Jaw', 'SK', 50.3934, -105.5518], ['Swift Current', 'SK', 50.2834, -107.7968], ['Yorkton', 'SK', 51.2167, -102.4667],
    ['North Battleford', 'SK', 52.7834, -108.2834],
    ['Halifax', 'NS', 44.6488, -63.5752], ['Sydney', 'NS', 46.1368, -60.1942], ['Truro', 'NS', 45.3651, -63.2860],
    ['Moncton', 'NB', 46.0878, -64.7782], ['Saint John', 'NB', 45.2733, -66.0633], ['Fredericton', 'NB', 45.9636, -66.6431],
    ['Miramichi', 'NB', 47.0251, -65.4834], ['Bathurst', 'NB', 47.6167, -65.6501], ['Edmundston', 'NB', 47.3668, -68.3251],
    ['Charlottetown', 'PE', 46.2382, -63.1311], ["St John's", 'NL', 47.5615, -52.7126], ['Corner Brook', 'NL', 48.9500, -57.9500],
    ['Whitehorse', 'YT', 60.7212, -135.0568], ['Yellowknife', 'NT', 62.4540, -114.3718],
    ['Columbus', 'OH', 39.9612, -82.9988], ['Cleveland', 'OH', 41.4993, -81.6944], ['Cincinnati', 'OH', 39.1031, -84.5120],
    ['Toledo', 'OH', 41.6639, -83.5552], ['Akron', 'OH', 41.0814, -81.5190], ['Dayton', 'OH', 39.7589, -84.1916],
    ['Youngstown', 'OH', 41.0998, -80.6495], ['Canton', 'OH', 40.7989, -81.3784], ['Chillicothe', 'OH', 39.3328, -82.9824],
    ['Mansfield', 'OH', 40.7584, -82.5154], ['Lima', 'OH', 40.7423, -84.1052], ['Findlay', 'OH', 41.0442, -83.6499],
    ['Sandusky', 'OH', 41.4484, -82.7077], ['Zanesville', 'OH', 39.9403, -82.0132],
    ['Chicago', 'IL', 41.8781, -87.6298], ['Rockford', 'IL', 42.2711, -89.0940], ['Peoria', 'IL', 40.6936, -89.5890],
    ['Springfield', 'IL', 39.7817, -89.6501], ['Joliet', 'IL', 41.5250, -88.0817], ['Naperville', 'IL', 41.7508, -88.1535],
    ['Aurora', 'IL', 41.7606, -88.3201], ['Elgin', 'IL', 42.0354, -88.2826], ['Waukegan', 'IL', 42.3636, -87.8448],
    ['Champaign', 'IL', 40.1164, -88.2434], ['Bloomington', 'IL', 40.4842, -88.9937], ['Decatur', 'IL', 39.8403, -88.9548],
    ['Detroit', 'MI', 42.3314, -83.0458], ['Grand Rapids', 'MI', 42.9634, -85.6681], ['Lansing', 'MI', 42.7325, -84.5555],
    ['Flint', 'MI', 43.0125, -83.6875], ['Ann Arbor', 'MI', 42.2808, -83.7430], ['Kalamazoo', 'MI', 42.2917, -85.5872],
    ['Saginaw', 'MI', 43.4195, -83.9508], ['Port Huron', 'MI', 42.9709, -82.4249], ['Bay City', 'MI', 43.5945, -83.8888],
    ['Traverse City', 'MI', 44.7631, -85.6206], ['Marquette', 'MI', 46.5476, -87.3953],
    ['Indianapolis', 'IN', 39.7684, -86.1581], ['Fort Wayne', 'IN', 41.1300, -85.1289], ['Evansville', 'IN', 37.9716, -87.5711],
    ['South Bend', 'IN', 41.6764, -86.2520], ['Hammond', 'IN', 41.5831, -87.5001], ['Gary', 'IN', 41.5934, -87.3465],
    ['Muncie', 'IN', 40.1934, -85.3864], ['Terre Haute', 'IN', 39.4667, -87.4139], ['Kokomo', 'IN', 40.4864, -86.1336],
    ['Milwaukee', 'WI', 43.0389, -87.9065], ['Madison', 'WI', 43.0731, -89.4012], ['Green Bay', 'WI', 44.5133, -88.0133],
    ['Kenosha', 'WI', 42.5847, -87.8212], ['Racine', 'WI', 42.7261, -87.7829], ['Appleton', 'WI', 44.2619, -88.4154],
    ['Minneapolis', 'MN', 44.9778, -93.2650], ['Saint Paul', 'MN', 44.9537, -93.0900], ['Rochester', 'MN', 44.0121, -92.4802],
    ['Duluth', 'MN', 46.7867, -92.1005], ['Saint Cloud', 'MN', 45.5608, -94.1625],
    ['Des Moines', 'IA', 41.5868, -93.6250], ['Cedar Rapids', 'IA', 41.9779, -91.6656], ['Davenport', 'IA', 41.5236, -90.5776],
    ['Sioux City', 'IA', 42.4999, -96.4003], ['Waterloo', 'IA', 42.4928, -92.3426],
    ['Omaha', 'NE', 41.2565, -95.9345], ['Lincoln', 'NE', 40.8136, -96.7026], ['Grand Island', 'NE', 40.9250, -98.3420],
    ['Fargo', 'ND', 46.8772, -96.7898], ['Bismarck', 'ND', 46.8083, -100.7837],
    ['Sioux Falls', 'SD', 43.5446, -96.7311], ['Rapid City', 'SD', 44.0805, -103.2310],
    ['Wichita', 'KS', 37.6872, -97.3301], ['Topeka', 'KS', 39.0489, -95.6780], ['Overland Park', 'KS', 38.9822, -94.6708],
    ['Kansas City', 'MO', 39.0997, -94.5786], ['St Louis', 'MO', 38.6270, -90.1994], ['Springfield', 'MO', 37.2153, -93.2982],
    ['Columbia', 'MO', 38.9517, -92.3341], ['St Joseph', 'MO', 39.7675, -94.8467], ['Joplin', 'MO', 37.0842, -94.5133],
    ['New York City', 'NY', 40.7128, -74.0060], ['Buffalo', 'NY', 42.8864, -78.8784], ['Albany', 'NY', 42.6526, -73.7562],
    ['Rochester', 'NY', 43.1566, -77.6088], ['Syracuse', 'NY', 43.0481, -76.1474], ['Yonkers', 'NY', 40.9312, -73.8988],
    ['Utica', 'NY', 43.1009, -75.2327], ['Watertown', 'NY', 43.9748, -75.9107],
    ['Philadelphia', 'PA', 39.9526, -75.1652], ['Pittsburgh', 'PA', 40.4406, -79.9959], ['Allentown', 'PA', 40.6023, -75.4714],
    ['Erie', 'PA', 42.1292, -80.0851], ['Reading', 'PA', 40.3356, -75.9269], ['Scranton', 'PA', 41.4090, -75.6624],
    ['Lancaster', 'PA', 40.0379, -76.3055], ['Harrisburg', 'PA', 40.2732, -76.8867], ['Altoona', 'PA', 40.5187, -78.3947],
    ['Boston', 'MA', 42.3601, -71.0589], ['Worcester', 'MA', 42.2626, -71.8023], ['Springfield', 'MA', 42.1015, -72.5898],
    ['Providence', 'RI', 41.8240, -71.4128], ['Hartford', 'CT', 41.7637, -72.6851], ['New Haven', 'CT', 41.3083, -72.9279],
    ['Bridgeport', 'CT', 41.1865, -73.1952], ['Manchester', 'NH', 42.9956, -71.4548],
    ['Burlington', 'VT', 44.4759, -73.2121], ['Portland', 'ME', 43.6591, -70.2568],
    ['Newark', 'NJ', 40.7357, -74.1724], ['Jersey City', 'NJ', 40.7178, -74.0431], ['Trenton', 'NJ', 40.2171, -74.7429],
    ['Baltimore', 'MD', 39.2904, -76.6122], ['Washington', 'DC', 38.9072, -77.0369], ['Wilmington', 'DE', 39.7447, -75.5484],
    ['Atlanta', 'GA', 33.7490, -84.3880], ['Savannah', 'GA', 32.0835, -81.0998], ['Augusta', 'GA', 33.4735, -82.0105],
    ['Charlotte', 'NC', 35.2271, -80.8431], ['Raleigh', 'NC', 35.7796, -78.6382], ['Greensboro', 'NC', 36.0726, -79.7920],
    ['Durham', 'NC', 35.9940, -78.8986], ['Winston-Salem', 'NC', 36.0999, -80.2442], ['Asheville', 'NC', 35.5951, -82.5515],
    ['Nashville', 'TN', 36.1627, -86.7816], ['Memphis', 'TN', 35.1495, -90.0490], ['Knoxville', 'TN', 35.9606, -83.9207],
    ['Chattanooga', 'TN', 35.0456, -85.3097], ['Clarksville', 'TN', 36.5298, -87.3595],
    ['Louisville', 'KY', 38.2527, -85.7585], ['Lexington', 'KY', 38.0406, -84.5037], ['Bowling Green', 'KY', 36.9685, -86.4808],
    ['Birmingham', 'AL', 33.5207, -86.8025], ['Montgomery', 'AL', 32.3668, -86.3000], ['Huntsville', 'AL', 34.7304, -86.5861],
    ['Mobile', 'AL', 30.6954, -88.0399],
    ['Jackson', 'MS', 32.2988, -90.1848], ['Gulfport', 'MS', 30.3674, -89.0928],
    ['New Orleans', 'LA', 29.9511, -90.0715], ['Baton Rouge', 'LA', 30.4515, -91.1871], ['Shreveport', 'LA', 32.5252, -93.7502],
    ['Lafayette', 'LA', 30.2241, -92.0198], ['Lake Charles', 'LA', 30.2266, -93.2174],
    ['Charleston', 'WV', 38.3498, -81.6326], ['Morgantown', 'WV', 39.6295, -79.9559],
    ['Columbia', 'SC', 34.0007, -81.0348], ['Charleston', 'SC', 32.7765, -79.9311], ['Greenville', 'SC', 34.8526, -82.3940],
    ['Little Rock', 'AR', 34.7465, -92.2896], ['Fort Smith', 'AR', 35.3859, -94.3985], ['Fayetteville', 'AR', 36.0822, -94.1719],
    ['Oklahoma City', 'OK', 35.4676, -97.5164], ['Tulsa', 'OK', 36.1540, -95.9928], ['Norman', 'OK', 35.2226, -97.4395],
    ['Richmond', 'VA', 37.5407, -77.4360], ['Virginia Beach', 'VA', 36.8529, -75.9780], ['Norfolk', 'VA', 36.8508, -76.2859],
    ['Roanoke', 'VA', 37.2710, -79.9414],
    ['Jacksonville', 'FL', 30.3322, -81.6557], ['Miami', 'FL', 25.7617, -80.1918], ['Tampa', 'FL', 27.9506, -82.4572],
    ['Orlando', 'FL', 28.5383, -81.3792], ['Fort Lauderdale', 'FL', 26.1224, -80.1373], ['Tallahassee', 'FL', 30.4518, -84.2807],
    ['Pensacola', 'FL', 30.4213, -87.2169], ['Gainesville', 'FL', 29.6516, -82.3248], ['Lakeland', 'FL', 28.0395, -81.9498],
    ['Houston', 'TX', 29.7604, -95.3698], ['San Antonio', 'TX', 29.4241, -98.4936], ['Dallas', 'TX', 32.7767, -96.7970],
    ['Austin', 'TX', 30.2672, -97.7431], ['Fort Worth', 'TX', 32.7555, -97.3308], ['El Paso', 'TX', 31.7619, -106.4850],
    ['Laredo', 'TX', 27.5306, -99.4803], ['Amarillo', 'TX', 35.2220, -101.8313], ['Lubbock', 'TX', 33.5779, -101.8552],
    ['Corpus Christi', 'TX', 27.8006, -97.3964], ['Waco', 'TX', 31.5493, -97.1467], ['Abilene', 'TX', 32.4487, -99.7331],
    ['Tyler', 'TX', 32.3513, -95.3011], ['Midland', 'TX', 31.9973, -102.0779], ['Odessa', 'TX', 31.8457, -102.3676],
    ['Wichita Falls', 'TX', 33.9137, -98.4934], ['McAllen', 'TX', 26.2034, -98.2300], ['Beaumont', 'TX', 30.0802, -94.1266],
    ['Los Angeles', 'CA', 34.0522, -118.2437], ['San Diego', 'CA', 32.7157, -117.1611], ['San Jose', 'CA', 37.3382, -121.8863],
    ['San Francisco', 'CA', 37.7749, -122.4194], ['Fresno', 'CA', 36.7378, -119.7871], ['Sacramento', 'CA', 38.5816, -121.4944],
    ['Long Beach', 'CA', 33.7701, -118.1937], ['Oakland', 'CA', 37.8044, -122.2711], ['Bakersfield', 'CA', 35.3733, -119.0187],
    ['Anaheim', 'CA', 33.8366, -117.9143], ['Riverside', 'CA', 33.9806, -117.3755], ['Stockton', 'CA', 37.9577, -121.2908],
    ['Modesto', 'CA', 37.6391, -120.9969], ['Visalia', 'CA', 36.3302, -119.2921], ['Salinas', 'CA', 36.6777, -121.6555],
    ['Phoenix', 'AZ', 33.4484, -112.0740], ['Tucson', 'AZ', 32.2226, -110.9747], ['Mesa', 'AZ', 33.4152, -111.8315],
    ['Chandler', 'AZ', 33.3062, -111.8413], ['Scottsdale', 'AZ', 33.4942, -111.9261], ['Flagstaff', 'AZ', 35.1983, -111.6513],
    ['Las Vegas', 'NV', 36.1699, -115.1398], ['Henderson', 'NV', 36.0397, -114.9819], ['Reno', 'NV', 39.5296, -119.8138],
    ['Portland', 'OR', 45.5051, -122.6750], ['Eugene', 'OR', 44.0521, -123.0868], ['Salem', 'OR', 44.9429, -123.0351],
    ['Bend', 'OR', 44.0582, -121.3153], ['Medford', 'OR', 42.3265, -122.8756],
    ['Seattle', 'WA', 47.6062, -122.3321], ['Spokane', 'WA', 47.6588, -117.4260], ['Tacoma', 'WA', 47.2529, -122.4443],
    ['Bellevue', 'WA', 47.6101, -122.2015], ['Everett', 'WA', 47.9790, -122.2021], ['Yakima', 'WA', 46.6021, -120.5059],
    ['Bellingham', 'WA', 48.7519, -122.4787],
    ['Denver', 'CO', 39.7392, -104.9903], ['Colorado Springs', 'CO', 38.8339, -104.8214], ['Fort Collins', 'CO', 40.5853, -105.0844],
    ['Pueblo', 'CO', 38.2544, -104.6091], ['Boulder', 'CO', 40.0150, -105.2705], ['Grand Junction', 'CO', 39.0639, -108.5506],
    ['Salt Lake City', 'UT', 40.7608, -111.8910], ['Provo', 'UT', 40.2338, -111.6585], ['Ogden', 'UT', 41.2230, -111.9738],
    ['St George', 'UT', 37.1041, -113.5841],
    ['Albuquerque', 'NM', 35.0844, -106.6504], ['Las Cruces', 'NM', 32.3199, -106.7637], ['Santa Fe', 'NM', 35.6870, -105.9378],
    ['Billings', 'MT', 45.7833, -108.5007], ['Missoula', 'MT', 46.8721, -113.9940], ['Great Falls', 'MT', 47.4941, -111.2833],
    ['Boise', 'ID', 43.6150, -116.2023], ['Nampa', 'ID', 43.5407, -116.5635], ['Idaho Falls', 'ID', 43.4665, -112.0340],
    ['Cheyenne', 'WY', 41.1340, -104.8202], ['Casper', 'WY', 42.8501, -106.3252],
    ['Anchorage', 'AK', 61.2181, -149.9003], ['Fairbanks', 'AK', 64.8378, -147.7164],
    ['Honolulu', 'HI', 21.3069, -157.8583],
];

// Haversine + road factor for driving distance estimate
function calcDrivingDist(oLat, oLon, dLat, dLon) {
    const R = 3959, dLa = (dLat - oLat) * Math.PI / 180, dLo = (dLon - oLon) * Math.PI / 180;
    const a = Math.sin(dLa / 2) ** 2 + Math.cos(oLat * Math.PI / 180) * Math.cos(dLat * Math.PI / 180) * Math.sin(dLo / 2) ** 2;
    const air = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    // Road factor by distance bracket (calibrated)
    let f = air < 25 ? 1.30 : air < 60 ? 1.20 : air < 150 ? 1.18 : air < 300 ? 1.20 : air < 600 ? 1.25 : 1.30;
    const miles = air * f;
    return { miles: parseFloat(miles.toFixed(1)), km: parseFloat((miles * 1.60934).toFixed(1)), source: 'estimate' };
}

// ── Custom city cache — persisted in localStorage ──────────────────
const _cityCache = { list: [] };
(function loadCache() {
    try {
        const raw = localStorage.getItem('tl_custom_cities');
        if (raw) { const p = JSON.parse(raw); if (Array.isArray(p)) _cityCache.list = p; }
    } catch (e) { }
})();

function saveCustomCity(name, province, lat, lon) {
    try {
        const key = (name + '|' + province).toLowerCase();
        const existingIdx = _cityCache.list.findIndex(function (c) {
            return ((c[0] || '') + '|' + (c[1] || '')).toLowerCase() === key;
        });
        const parsedLat = parseFloat(lat) || 0;
        const parsedLon = parseFloat(lon) || 0;
        if (existingIdx >= 0) {
            // Update coords in place — this is the fix for coords resetting
            _cityCache.list[existingIdx] = [name, province, parsedLat, parsedLon];
        } else {
            // New city — add it
            _cityCache.list.push([name, province, parsedLat, parsedLon]);
        }
        localStorage.setItem('tl_custom_cities', JSON.stringify(_cityCache.list));
    } catch (e) { }
}

// ── Shared Company database — persisted in localStorage ────────────
// One shared list used for BOTH shipper and receiver fields, since
// backhauls often mean the same company appears as both.
// Each entry: {id, name, address, city} where city is the full
// "City, Province/State" string matched against origin/destination.
const _companyCache = { list: [] };
(function loadCompanyCache() {
    try {
        const raw = localStorage.getItem('tl_companies');
        if (raw) { const p = JSON.parse(raw); if (Array.isArray(p)) _companyCache.list = p; }
    } catch (e) { }
})();

// Saves/updates a company after a trip is created.
// role: 'origin' | 'destination' — tells us which city to attach.
function saveCompany(name, address, city, postal, lat, lon) {
    if (!name || !name.trim()) return;
    const nameKey = name.trim().toLowerCase();
    const existingIdx = _companyCache.list.findIndex(function (c) { return c.name.toLowerCase() === nameKey; });
    const prev = existingIdx >= 0 ? _companyCache.list[existingIdx] : null;
    const entry = {
        id: prev ? prev.id : Date.now() + Math.random(),
        name: name.trim(),
        address: (address || '').trim(),
        city: (city || '').trim(),
        // Postal/lat/lon: use new values if provided, otherwise keep previous (don't wipe precision on a plain re-save)
        postal: (postal && postal.trim()) ? postal.trim().toUpperCase() : (prev ? prev.postal : ''),
        lat: (lat != null) ? lat : (prev ? prev.lat : null),
        lon: (lon != null) ? lon : (prev ? prev.lon : null)
    };
    if (existingIdx >= 0) {
        _companyCache.list[existingIdx] = entry;
    } else {
        _companyCache.list.push(entry);
    }
    try { localStorage.setItem('tl_companies', JSON.stringify(_companyCache.list)); } catch (e) { }
}

function searchCompanies(query) {
    const q = (query || '').trim().toLowerCase();
    if (q.length < 1) return [];
    return _companyCache.list.filter(function (c) { return c.name.toLowerCase().includes(q); }).slice(0, 6);
}

function getAllCompanies() { return _companyCache.list; }

function deleteCompany(id) {
    _companyCache.list = _companyCache.list.filter(function (c) { return c.id !== id; });
    try { localStorage.setItem('tl_companies', JSON.stringify(_companyCache.list)); } catch (e) { }
}

function updateCompany(id, name, address, city, postal, lat, lon) {
    const idx = _companyCache.list.findIndex(function (c) { return c.id === id; });
    if (idx >= 0) {
        _companyCache.list[idx] = { id: id, name: (name || '').trim(), address: (address || '').trim(), city: (city || '').trim(), postal: (postal || '').trim().toUpperCase(), lat: lat != null ? lat : null, lon: lon != null ? lon : null };
        try { localStorage.setItem('tl_companies', JSON.stringify(_companyCache.list)); } catch (e) { }
    }
}

// Province/state → approximate center coordinates (regular hyphens)
const PROV_COORDS = {
    ON: [44.0, -79.0], QC: [46.5, -72.5], BC: [53.7, -127.6], AB: [53.9, -116.5],
    MB: [53.7, -98.8], SK: [52.9, -106.4], NS: [44.7, -63.0], NB: [46.5, -66.5],
    NL: [53.1, -57.6], PE: [46.4, -63.2], NT: [64.3, -119.2], YT: [64.0, -135.0], NU: [70.3, -83.1],
    AL: [32.8, -86.8], AK: [64.2, -153.3], AZ: [34.3, -111.6], AR: [34.8, -92.2],
    CA: [36.8, -119.4], CO: [39.0, -105.5], CT: [41.6, -72.7], DE: [38.9, -75.5],
    FL: [27.6, -81.5], GA: [32.7, -83.4], HI: [20.8, -156.3], ID: [44.1, -114.5],
    IL: [40.0, -89.1], IN: [39.9, -86.3], IA: [42.0, -93.2], KS: [38.5, -98.4],
    KY: [37.5, -85.3], LA: [31.2, -92.4], ME: [45.2, -69.0], MD: [39.0, -76.8],
    MA: [42.3, -71.8], MI: [44.3, -85.4], MN: [46.4, -93.9], MS: [32.7, -89.6],
    MO: [38.4, -92.5], MT: [46.9, -109.5], NE: [41.5, -99.9], NV: [39.3, -116.6],
    NH: [43.5, -71.6], NJ: [40.2, -74.7], NM: [34.3, -106.0], NY: [42.9, -75.5],
    NC: [35.5, -79.4], ND: [47.5, -100.4], OH: [40.3, -82.7], OK: [35.6, -97.5],
    OR: [44.1, -120.5], PA: [40.9, -77.8], RI: [41.7, -71.5], SC: [33.8, -80.9],
    SD: [44.4, -100.2], TN: [35.8, -86.4], TX: [31.5, -99.3], UT: [39.4, -111.1],
    VT: [44.1, -72.7], VA: [37.5, -79.0], WA: [47.4, -120.5], WV: [38.6, -80.5],
    WI: [44.4, -89.8], WY: [43.0, -107.5], DC: [38.9, -77.0],
};

function getCustomCities() { return _cityCache.list; }

// Fast fuzzy search across built-in + saved custom cities
function localSearch(q) {
    const raw = (q || '').trim().toLowerCase();
    if (raw.length < 2) return [];
    const comma = raw.indexOf(',');
    const cityPart = comma > 0 ? raw.slice(0, comma).trim() : raw;
    const provPart = comma > 0 ? raw.slice(comma + 1).trim() : '';
    // Custom cities override built-in coords for same name+province
    const customKeys = new Set(getCustomCities().map(function (c) { return (c[0] + '|' + c[1]).toLowerCase(); }));
    // Built-in cities — skip any that have a custom override
    const filteredBuiltIn = CITIES.filter(function (c) {
        return !customKeys.has((c[0] + '|' + c[1]).toLowerCase());
    });
    // Custom comes first so dedup works, then remaining built-ins
    const all = [...getCustomCities(), ...filteredBuiltIn];
    const exact = [], starts = [], contains = [], fuzzy = [];
    all.forEach(function (row) {
        const n = row[0], p = row[1], lat = row[2], lon = row[3];
        const nl = n.toLowerCase(), pl = p.toLowerCase();
        if (provPart && !pl.startsWith(provPart.toLowerCase())) return;
        const entry = { label: n + ', ' + p, lat: lat, lon: lon };
        if (nl === cityPart) exact.push(entry);
        else if (nl.startsWith(cityPart)) starts.push(entry);
        else if (nl.includes(cityPart)) contains.push(entry);
        else if (cityPart.length >= 3) {
            var qi = 0;
            for (var i = 0; i < nl.length && qi < cityPart.length; i++) { if (nl[i] === cityPart[qi]) qi++; }
            if (qi === cityPart.length) fuzzy.push(entry);
        }
    });
    return [...exact, ...starts, ...contains, ...fuzzy].slice(0, 8);
}

// Claude geocode — fallback when city not in local db
async function claudeFallbackSearch(q) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 600,
            messages: [{
                role: 'user', content:
                    'Geocode this city in Canada or USA: "' + q + '"\n' +
                    'Return a JSON array of up to 5 matches.\n' +
                    'Each item: {"label":"City, XX","name":"City","province":"XX","lat":0.0,"lon":0.0}\n' +
                    'Use 2-letter state/province codes. Real places only. Raw JSON array, no markdown.'
            }]
        })
    });
    if (!res.ok) throw new Error(res.status);
    const d = await res.json();
    const txt = ((d.content || []).find(function (b) { return b.type === 'text'; }) || {}).text || '';
    const clean = txt.replace(/```[a-z]*\n?/gi, '').trim();
    const arr = JSON.parse(clean);
    if (!Array.isArray(arr)) throw new Error('bad');
    return arr.filter(function (r) { return r.lat && r.lon && r.name && r.province; }).map(function (r) {
        return { label: r.label || (r.name + ', ' + r.province), lat: parseFloat(r.lat), lon: parseFloat(r.lon), name: r.name, province: r.province, fromAI: true };
    });
}

// ── Canadian FSA lookup table (first 3 chars of postal code) ──────
// Built-in, no API needed, works offline from GitHub Pages
const CA_FSA = {
    // ON — GTA / Mississauga / Brampton / Hamilton / Niagara / London / Windsor / Ottawa / Kitchener
    'M1B': ['Scarborough', 'ON', 43.8121, -79.2133], 'M1C': ['Scarborough', 'ON', 43.7841, -79.1617],
    'M1E': ['Scarborough', 'ON', 43.7653, -79.1884], 'M1G': ['Scarborough', 'ON', 43.7704, -79.2170],
    'M1H': ['Scarborough', 'ON', 43.7692, -79.2376], 'M1J': ['Scarborough', 'ON', 43.7434, -79.2291],
    'M1K': ['Scarborough', 'ON', 43.7272, -79.2637], 'M1L': ['Scarborough', 'ON', 43.7465, -79.2943],
    'M1M': ['Scarborough', 'ON', 43.7237, -79.2422], 'M1N': ['Scarborough', 'ON', 43.6951, -79.2591],
    'M1P': ['Scarborough', 'ON', 43.7572, -79.2695], 'M1R': ['Scarborough', 'ON', 43.7506, -79.2987],
    'M1S': ['Scarborough', 'ON', 43.7941, -79.2634], 'M1T': ['Scarborough', 'ON', 43.7835, -79.3004],
    'M1V': ['Scarborough', 'ON', 43.8152, -79.2638], 'M1W': ['Scarborough', 'ON', 43.7994, -79.3139],
    'M1X': ['Scarborough', 'ON', 43.8350, -79.2232],
    'M2H': ['North York', 'ON', 43.8017, -79.3613], 'M2J': ['North York', 'ON', 43.7785, -79.3490],
    'M2K': ['North York', 'ON', 43.7841, -79.3942], 'M2L': ['North York', 'ON', 43.7525, -79.3755],
    'M2M': ['North York', 'ON', 43.7942, -79.4087], 'M2N': ['North York', 'ON', 43.7707, -79.4062],
    'M2P': ['North York', 'ON', 43.7511, -79.4007], 'M2R': ['North York', 'ON', 43.8024, -79.4446],
    'M3A': ['North York', 'ON', 43.7527, -79.3294], 'M3B': ['North York', 'ON', 43.7454, -79.3563],
    'M3C': ['North York', 'ON', 43.7282, -79.3396], 'M3H': ['North York', 'ON', 43.7714, -79.4510],
    'M3J': ['North York', 'ON', 43.7636, -79.4875], 'M3K': ['North York', 'ON', 43.7392, -79.4717],
    'M3L': ['North York', 'ON', 43.7365, -79.5115], 'M3M': ['North York', 'ON', 43.7282, -79.5315],
    'M3N': ['North York', 'ON', 43.7673, -79.5258],
    'M4A': ['North York', 'ON', 43.7318, -79.3131], 'M4B': ['East York', 'ON', 43.7086, -79.3038],
    'M4C': ['East York', 'ON', 43.6956, -79.3171], 'M4E': ['East Toronto', 'ON', 43.6792, -79.2955],
    'M4G': ['Leaside', 'ON', 43.7103, -79.3633], 'M4H': ['East York', 'ON', 43.7057, -79.3474],
    'M4J': ['East York', 'ON', 43.6862, -79.3368], 'M4K': ['East Toronto', 'ON', 43.6792, -79.3541],
    'M4L': ['East Toronto', 'ON', 43.6656, -79.3288], 'M4M': ['East Toronto', 'ON', 43.6617, -79.3390],
    'M4N': ['Lawrence Park', 'ON', 43.7246, -79.3905], 'M4P': ['Davisville', 'ON', 43.7122, -79.3939],
    'M4R': ['North Toronto', 'ON', 43.7229, -79.4097], 'M4S': ['Davisville', 'ON', 43.7053, -79.3975],
    'M4T': ['Midtown Toronto', 'ON', 43.6897, -79.3927], 'M4V': ['Deer Park', 'ON', 43.6864, -79.4015],
    'M4W': ['Rosedale', 'ON', 43.6795, -79.3779], 'M4X': ['Cabbagetown', 'ON', 43.6652, -79.3685],
    'M4Y': ['Church-Yonge Corridor', 'ON', 43.6660, -79.3833],
    'M5A': ['Distillery District', 'ON', 43.6549, -79.3590], 'M5B': ['Garden District', 'ON', 43.6575, -79.3801],
    'M5C': ['St James Town', 'ON', 43.6513, -79.3757], 'M5E': ['Berczy Park', 'ON', 43.6455, -79.3713],
    'M5G': ['Discovery District', 'ON', 43.6578, -79.3876], 'M5H': ['Adelaide', 'ON', 43.6487, -79.3821],
    'M5J': ['Harbourfront', 'ON', 43.6423, -79.3826], 'M5L': ['Commerce Court', 'ON', 43.6482, -79.3773],
    'M5M': ['Bedford Park', 'ON', 43.7328, -79.4280], 'M5N': ['Roselawn', 'ON', 43.7174, -79.4208],
    'M5P': ['Forest Hill', 'ON', 43.6980, -79.4202], 'M5R': ['Annex', 'ON', 43.6726, -79.4083],
    'M5S': ['University', 'ON', 43.6647, -79.3972], 'M5T': ['Kensington Market', 'ON', 43.6540, -79.4010],
    'M5V': ['Downtown Toronto', 'ON', 43.6449, -79.4031], 'M5X': ['First Canadian Place', 'ON', 43.6486, -79.3817],
    'M6A': ['Lawrence Heights', 'ON', 43.7179, -79.4543], 'M6B': ['Glencairn', 'ON', 43.7047, -79.4549],
    'M6C': ['Humewood-Cedarvale', 'ON', 43.6961, -79.4291], 'M6E': ['Caledonia-Fairbank', 'ON', 43.6888, -79.4512],
    'M6G': ['Christie', 'ON', 43.6766, -79.4201], 'M6H': ['Dovercourt-Wallace', 'ON', 43.6589, -79.4345],
    'M6J': ['Trinity-Bellwoods', 'ON', 43.6462, -79.4173], 'M6K': ['Brockton Village', 'ON', 43.6372, -79.4320],
    'M6L': ['North Park', 'ON', 43.7145, -79.4830], 'M6M': ['Del Ray', 'ON', 43.6926, -79.4797],
    'M6N': ['Runnymede', 'ON', 43.6654, -79.4812], 'M6P': ['High Park North', 'ON', 43.6600, -79.4618],
    'M6R': ['Parkdale', 'ON', 43.6397, -79.4468], 'M6S': ['Roncesvalles', 'ON', 43.6498, -79.4617],
    'M8V': ['Mimico', 'ON', 43.6048, -79.5058], 'M8W': ['Alderwood', 'ON', 43.6028, -79.5404],
    'M8X': ['Kingsway South', 'ON', 43.6483, -79.5150], 'M8Y': ['Sunnylea', 'ON', 43.6345, -79.5031],
    'M8Z': ['Mimico NW', 'ON', 43.6196, -79.5292], 'M9A': ['Islington', 'ON', 43.6605, -79.5333],
    'M9B': ['Cloverdale', 'ON', 43.6477, -79.5596], 'M9C': ['Eringate', 'ON', 43.6453, -79.5731],
    'M9L': ['Humber Summit', 'ON', 43.7568, -79.5939], 'M9M': ['Humberlea', 'ON', 43.7268, -79.5460],
    'M9N': ['Weston', 'ON', 43.7074, -79.5193], 'M9P': ['Westmount', 'ON', 43.6936, -79.5274],
    'M9R': ['Kingsview Village', 'ON', 43.6882, -79.5637], 'M9V': ['Thistletown', 'ON', 43.7407, -79.5941],
    'M9W': ['Malton', 'ON', 43.7227, -79.6193],
    // Mississauga
    'L4T': ['Mississauga', 'ON', 43.7155, -79.6430], 'L4V': ['Mississauga', 'ON', 43.6975, -79.6327],
    'L4W': ['Mississauga', 'ON', 43.6472, -79.6249], 'L4X': ['Mississauga', 'ON', 43.6366, -79.6031],
    'L4Y': ['Mississauga', 'ON', 43.6139, -79.5990], 'L4Z': ['Mississauga', 'ON', 43.6002, -79.6469],
    'L5A': ['Mississauga', 'ON', 43.5850, -79.6135], 'L5B': ['Mississauga', 'ON', 43.5930, -79.6383],
    'L5C': ['Mississauga', 'ON', 43.5738, -79.6252], 'L5E': ['Mississauga', 'ON', 43.5573, -79.5640],
    'L5G': ['Mississauga', 'ON', 43.5568, -79.5853], 'L5H': ['Mississauga', 'ON', 43.5419, -79.5904],
    'L5J': ['Mississauga', 'ON', 43.5256, -79.6191], 'L5K': ['Mississauga', 'ON', 43.5376, -79.6425],
    'L5L': ['Mississauga', 'ON', 43.5515, -79.6584], 'L5M': ['Mississauga', 'ON', 43.5648, -79.6773],
    'L5N': ['Mississauga', 'ON', 43.5776, -79.7115], 'L5R': ['Mississauga', 'ON', 43.6119, -79.6685],
    'L5S': ['Mississauga', 'ON', 43.6729, -79.6682], 'L5T': ['Mississauga', 'ON', 43.6603, -79.6590],
    'L5V': ['Mississauga', 'ON', 43.6253, -79.7024], 'L5W': ['Mississauga', 'ON', 43.6442, -79.6875],
    // Brampton
    'L6P': ['Brampton', 'ON', 43.7681, -79.6941], 'L6R': ['Brampton', 'ON', 43.7572, -79.7254],
    'L6S': ['Brampton', 'ON', 43.7348, -79.7192], 'L6T': ['Brampton', 'ON', 43.7165, -79.7354],
    'L6V': ['Brampton', 'ON', 43.6935, -79.7654], 'L6W': ['Brampton', 'ON', 43.6766, -79.7566],
    'L6X': ['Brampton', 'ON', 43.6905, -79.7913], 'L6Y': ['Brampton', 'ON', 43.6649, -79.7810],
    'L6Z': ['Brampton', 'ON', 43.7327, -79.7937], 'L7A': ['Brampton', 'ON', 43.7495, -79.8228],
    // Hamilton & Niagara
    'L8E': ['Stoney Creek', 'ON', 43.2280, -79.7277], 'L8G': ['Stoney Creek', 'ON', 43.2107, -79.7569],
    'L8H': ['Hamilton', 'ON', 43.2379, -79.8131], 'L8J': ['Hamilton', 'ON', 43.1977, -79.8053],
    'L8K': ['Hamilton', 'ON', 43.2339, -79.8418], 'L8L': ['Hamilton', 'ON', 43.2569, -79.8533],
    'L8M': ['Hamilton', 'ON', 43.2484, -79.8374], 'L8N': ['Hamilton', 'ON', 43.2444, -79.8557],
    'L8P': ['Hamilton', 'ON', 43.2503, -79.8706], 'L8R': ['Hamilton', 'ON', 43.2607, -79.8648],
    'L8S': ['Hamilton', 'ON', 43.2574, -79.8875], 'L8T': ['Hamilton', 'ON', 43.2270, -79.8638],
    'L8V': ['Hamilton', 'ON', 43.2209, -79.8506], 'L8W': ['Hamilton', 'ON', 43.2025, -79.8629],
    'L9A': ['Hamilton', 'ON', 43.2327, -79.9022], 'L9B': ['Hamilton', 'ON', 43.2017, -79.9118],
    'L9C': ['Hamilton', 'ON', 43.2462, -79.9173], 'L9G': ['Ancaster', 'ON', 43.2138, -79.9752],
    'L9H': ['Dundas', 'ON', 43.2658, -79.9565], 'L9K': ['Hamilton', 'ON', 43.2767, -79.9462],
    'L2A': ['Fort Erie', 'ON', 42.9141, -79.0280], 'L2E': ['Niagara Falls', 'ON', 43.1018, -79.0707],
    'L2G': ['Niagara Falls', 'ON', 43.0835, -79.0799], 'L2H': ['Niagara Falls', 'ON', 43.0730, -79.1205],
    'L2J': ['Niagara Falls', 'ON', 43.1182, -79.0850], 'L2M': ['St Catharines', 'ON', 43.1802, -79.2143],
    'L2N': ['St Catharines', 'ON', 43.1984, -79.2395], 'L2P': ['St Catharines', 'ON', 43.1598, -79.2313],
    'L2R': ['St Catharines', 'ON', 43.1588, -79.2464], 'L2S': ['St Catharines', 'ON', 43.1487, -79.2717],
    'L2T': ['St Catharines', 'ON', 43.1379, -79.2547], 'L2V': ['Welland', 'ON', 42.9918, -79.2399],
    'L2W': ['Welland', 'ON', 42.9709, -79.2596], 'L3B': ['Welland', 'ON', 42.9816, -79.2382],
    'L3C': ['Welland', 'ON', 42.9979, -79.2822],
    // London / Windsor / Kitchener-Waterloo / Sarnia
    'N2A': ['Kitchener', 'ON', 43.4543, -80.4422], 'N2B': ['Kitchener', 'ON', 43.4624, -80.4739],
    'N2C': ['Kitchener', 'ON', 43.4267, -80.4432], 'N2E': ['Kitchener', 'ON', 43.4071, -80.4745],
    'N2G': ['Kitchener', 'ON', 43.4462, -80.5107], 'N2H': ['Kitchener', 'ON', 43.4583, -80.5003],
    'N2J': ['Waterloo', 'ON', 43.4820, -80.5340], 'N2K': ['Waterloo', 'ON', 43.4863, -80.5064],
    'N2L': ['Waterloo', 'ON', 43.4739, -80.5523], 'N2M': ['Kitchener', 'ON', 43.4329, -80.5233],
    'N2N': ['Kitchener', 'ON', 43.4224, -80.5466], 'N2P': ['Kitchener', 'ON', 43.3965, -80.4668],
    'N2R': ['Kitchener', 'ON', 43.4002, -80.5194], 'N2T': ['Waterloo', 'ON', 43.4468, -80.5833],
    'N2V': ['Waterloo', 'ON', 43.4648, -80.5855],
    'N5V': ['London', 'ON', 43.0156, -81.1703], 'N5W': ['London', 'ON', 42.9941, -81.1857],
    'N5X': ['London', 'ON', 43.0312, -81.2177], 'N5Y': ['London', 'ON', 43.0082, -81.2258],
    'N5Z': ['London', 'ON', 42.9865, -81.2265], 'N6A': ['London', 'ON', 42.9973, -81.2472],
    'N6B': ['London', 'ON', 42.9833, -81.2398], 'N6C': ['London', 'ON', 42.9670, -81.2433],
    'N6E': ['London', 'ON', 42.9453, -81.2476], 'N6G': ['London', 'ON', 43.0148, -81.2879],
    'N6H': ['London', 'ON', 42.9975, -81.2892], 'N6J': ['London', 'ON', 42.9676, -81.2771],
    'N6K': ['London', 'ON', 42.9626, -81.3030], 'N6L': ['London', 'ON', 42.9413, -81.2875],
    'N6M': ['London', 'ON', 42.9516, -81.2124], 'N6P': ['London', 'ON', 42.9300, -81.2666],
    'N7A': ['Sarnia', 'ON', 42.9947, -82.4147], 'N7M': ['Sarnia', 'ON', 42.9680, -82.3887],
    'N7S': ['Sarnia', 'ON', 42.9482, -82.3783], 'N7T': ['Sarnia', 'ON', 42.9760, -82.4289],
    'N7V': ['Sarnia', 'ON', 43.0072, -82.4406], 'N7W': ['Sarnia', 'ON', 42.9590, -82.3573],
    'N8A': ['Windsor', 'ON', 42.3159, -82.9765], 'N8H': ['Windsor', 'ON', 42.2868, -82.9449],
    'N8N': ['Windsor', 'ON', 42.3034, -82.9342], 'N8P': ['Windsor', 'ON', 42.3366, -82.9568],
    'N8R': ['Windsor', 'ON', 42.3104, -82.9985], 'N8S': ['Windsor', 'ON', 42.3330, -83.0090],
    'N8T': ['Windsor', 'ON', 42.3002, -83.0211], 'N8V': ['Windsor', 'ON', 42.2902, -83.0295],
    'N8W': ['Windsor', 'ON', 42.3177, -83.0488], 'N8X': ['Windsor', 'ON', 42.3031, -83.0432],
    'N8Y': ['Windsor', 'ON', 42.3259, -83.0606], 'N9A': ['Windsor', 'ON', 42.3188, -83.0388],
    'N9B': ['Windsor', 'ON', 42.3122, -83.0668], 'N9C': ['Windsor', 'ON', 42.3062, -83.0713],
    'N9E': ['Windsor', 'ON', 42.2886, -83.0605], 'N9G': ['Windsor', 'ON', 42.2819, -83.0440],
    'N9H': ['Windsor', 'ON', 42.2679, -83.0593], 'N9J': ['Windsor', 'ON', 42.2568, -83.0293],
    'N9V': ['Windsor', 'ON', 42.3437, -83.0776], 'N9Y': ['Windsor', 'ON', 42.2910, -83.0167],
    // Ottawa
    'K1A': ['Ottawa', 'ON', 45.4215, -75.6972], 'K1B': ['Ottawa', 'ON', 45.4312, -75.6234],
    'K1C': ['Ottawa', 'ON', 45.4498, -75.5841], 'K1E': ['Ottawa', 'ON', 45.4699, -75.5522],
    'K1G': ['Ottawa', 'ON', 45.4082, -75.6505], 'K1H': ['Ottawa', 'ON', 45.3880, -75.6717],
    'K1J': ['Ottawa', 'ON', 45.4492, -75.6301], 'K1K': ['Ottawa', 'ON', 45.4349, -75.6547],
    'K1L': ['Ottawa', 'ON', 45.4313, -75.6684], 'K1M': ['Ottawa', 'ON', 45.4311, -75.6843],
    'K1N': ['Ottawa', 'ON', 45.4267, -75.6936], 'K1P': ['Ottawa', 'ON', 45.4215, -75.6977],
    'K1R': ['Ottawa', 'ON', 45.4166, -75.7087], 'K1S': ['Ottawa', 'ON', 45.4065, -75.6867],
    'K1T': ['Ottawa', 'ON', 45.3712, -75.6565], 'K1V': ['Ottawa', 'ON', 45.3657, -75.6872],
    'K1Y': ['Ottawa', 'ON', 45.4010, -75.7294], 'K1Z': ['Ottawa', 'ON', 45.4004, -75.7397],
    'K2A': ['Ottawa', 'ON', 45.3946, -75.7614], 'K2B': ['Ottawa', 'ON', 45.3793, -75.7835],
    'K2C': ['Ottawa', 'ON', 45.3665, -75.7575], 'K2E': ['Ottawa', 'ON', 45.3373, -75.7208],
    'K2G': ['Ottawa', 'ON', 45.3451, -75.7584], 'K2H': ['Ottawa', 'ON', 45.3576, -75.7926],
    'K2J': ['Ottawa', 'ON', 45.2988, -75.7408], 'K2K': ['Ottawa', 'ON', 45.3381, -75.8246],
    'K2L': ['Ottawa', 'ON', 45.3214, -75.8344], 'K2M': ['Ottawa', 'ON', 45.3112, -75.8564],
    'K2P': ['Ottawa', 'ON', 45.4107, -75.6945], 'K2R': ['Ottawa', 'ON', 45.3067, -75.9006],
    'K2S': ['Ottawa', 'ON', 45.3017, -75.7934], 'K2T': ['Ottawa', 'ON', 45.3408, -75.9058],
    'K0H': ['Kingston area', 'ON', 44.2312, -76.4860],
    // Other ON rural FSAs
    'K0A': ['Ottawa Valley', 'ON', 45.3000, -76.0000], 'K0B': ['Eastern ON', 'ON', 45.5000, -74.8000],
    'K0C': ['Brockville area', 'ON', 44.5895, -75.6866], 'K0E': ['Kingston rural', 'ON', 44.3000, -76.2000],
    'K0G': ['Perth area', 'ON', 44.9001, -76.2501], 'K0J': ['Renfrew area', 'ON', 45.4667, -76.6834],
    'K0K': ['Trenton area', 'ON', 44.1001, -77.5834], 'K0L': ['Bancroft area', 'ON', 45.0559, -77.8525],
    'K0M': ['Haliburton area', 'ON', 45.0500, -78.5000],
    'L0A': ['Uxbridge area', 'ON', 44.1084, -79.1237], 'L0B': ['Newmarket rural', 'ON', 44.0501, -79.4667],
    'L0C': ['Bradford area', 'ON', 44.1167, -79.5667], 'L0E': ['Barrie area S', 'ON', 44.3894, -79.6903],
    'L0G': ['Peel rural', 'ON', 43.9000, -79.8000], 'L0H': ['Caledon area', 'ON', 43.9000, -79.9000],
    'L0J': ['Georgetown area', 'ON', 43.6501, -79.9167], 'L0K': ['Midland area', 'ON', 44.7501, -79.8834],
    'L0L': ['Barrie rural', 'ON', 44.5001, -80.2167], 'L0M': ['Collingwood area', 'ON', 44.5001, -80.2167],
    'L0N': ['Guelph rural', 'ON', 43.5448, -80.2482], 'L0P': ['Cambridge area', 'ON', 43.3616, -80.3144],
    'L0R': ['Hamilton rural', 'ON', 43.2557, -79.8711], 'L0S': ['Niagara rural', 'ON', 43.0962, -79.0377],
    'L3P': ['Markham', 'ON', 43.8561, -79.3370], 'L3R': ['Markham', 'ON', 43.8561, -79.3370],
    'L3S': ['Markham', 'ON', 43.8561, -79.3370], 'L3T': ['Thornhill', 'ON', 43.8200, -79.4100],
    'L4B': ['Richmond Hill', 'ON', 43.8828, -79.4403], 'L4C': ['Richmond Hill', 'ON', 43.8828, -79.4403],
    'L4E': ['Richmond Hill', 'ON', 43.9300, -79.4500], 'L4G': ['Aurora', 'ON', 43.9985, -79.4676],
    'L4H': ['Vaughan', 'ON', 43.8361, -79.4983], 'L4J': ['Thornhill', 'ON', 43.8090, -79.4337],
    'L4K': ['Vaughan', 'ON', 43.8079, -79.5200], 'L4L': ['Vaughan', 'ON', 43.7891, -79.5501],
    'L6A': ['Maple', 'ON', 43.8556, -79.5258], 'L6B': ['Markham', 'ON', 43.8561, -79.2638],
    'L6C': ['Markham', 'ON', 43.9000, -79.3500], 'L6E': ['Markham', 'ON', 43.8845, -79.2774],
    // QUEBEC
    'H1A': ['Montreal', 'QC', 45.5893, -73.5360], 'H1B': ['Montreal', 'QC', 45.5850, -73.5104],
    'H1G': ['Montreal', 'QC', 45.5831, -73.5596], 'H1H': ['Montreal', 'QC', 45.5708, -73.5719],
    'H1J': ['Montreal', 'QC', 45.5622, -73.5388], 'H1N': ['Montreal', 'QC', 45.5406, -73.5642],
    'H1R': ['Montreal', 'QC', 45.5573, -73.6200], 'H1S': ['Montreal', 'QC', 45.5423, -73.5895],
    'H1T': ['Montreal', 'QC', 45.5512, -73.5714], 'H1V': ['Montreal', 'QC', 45.5461, -73.5751],
    'H1W': ['Montreal', 'QC', 45.5374, -73.5488], 'H1Y': ['Montreal', 'QC', 45.5476, -73.6002],
    'H1Z': ['Montreal', 'QC', 45.5518, -73.6305], 'H2A': ['Montreal', 'QC', 45.5590, -73.6389],
    'H2B': ['Montreal', 'QC', 45.5700, -73.6578], 'H2E': ['Montreal', 'QC', 45.5497, -73.6461],
    'H2G': ['Montreal', 'QC', 45.5382, -73.6233], 'H2H': ['Montreal', 'QC', 45.5316, -73.6009],
    'H2J': ['Montreal', 'QC', 45.5247, -73.5853], 'H2K': ['Montreal', 'QC', 45.5313, -73.5544],
    'H2L': ['Montreal', 'QC', 45.5221, -73.5607], 'H2M': ['Montreal', 'QC', 45.5592, -73.6627],
    'H2N': ['Montreal', 'QC', 45.5588, -73.6832], 'H2P': ['Montreal', 'QC', 45.5538, -73.6557],
    'H2R': ['Montreal', 'QC', 45.5445, -73.6708], 'H2S': ['Montreal', 'QC', 45.5349, -73.6484],
    'H2T': ['Montreal', 'QC', 45.5254, -73.6195], 'H2V': ['Montreal', 'QC', 45.5100, -73.6130],
    'H2W': ['Montreal', 'QC', 45.5136, -73.5717], 'H2X': ['Montreal', 'QC', 45.5107, -73.5703],
    'H2Y': ['Montreal', 'QC', 45.5048, -73.5583], 'H2Z': ['Montreal', 'QC', 45.4980, -73.5628],
    'H3A': ['Montreal', 'QC', 45.5040, -73.5775], 'H3B': ['Montreal', 'QC', 45.4997, -73.5662],
    'H3C': ['Montreal', 'QC', 45.4920, -73.5617], 'H3G': ['Montreal', 'QC', 45.4923, -73.5789],
    'H3H': ['Montreal', 'QC', 45.4875, -73.5853], 'H3J': ['Montreal', 'QC', 45.4812, -73.5862],
    'H3K': ['Montreal', 'QC', 45.4728, -73.5835], 'H3L': ['Montreal', 'QC', 45.5436, -73.6963],
    'H3M': ['Montreal', 'QC', 45.5336, -73.7110], 'H3N': ['Montreal', 'QC', 45.5270, -73.6831],
    'H3P': ['Montreal', 'QC', 45.4995, -73.6434], 'H3R': ['Montreal', 'QC', 45.4936, -73.6523],
    'H3S': ['Montreal', 'QC', 45.4900, -73.6278], 'H3T': ['Montreal', 'QC', 45.4810, -73.6285],
    'H3V': ['Montreal', 'QC', 45.4735, -73.6308], 'H3W': ['Montreal', 'QC', 45.4665, -73.6255],
    'H3X': ['Montreal', 'QC', 45.4546, -73.6470], 'H3Y': ['Westmount', 'QC', 45.4847, -73.5997],
    'H3Z': ['Westmount', 'QC', 45.4781, -73.6055], 'H4A': ['Montreal', 'QC', 45.4668, -73.6095],
    'H4B': ['Montreal', 'QC', 45.4612, -73.6207], 'H4C': ['Montreal', 'QC', 45.4720, -73.5745],
    'H4E': ['Montreal', 'QC', 45.4575, -73.5836], 'H4G': ['Montreal', 'QC', 45.4522, -73.5950],
    'H4H': ['Montreal', 'QC', 45.4461, -73.5738], 'H4J': ['Montreal', 'QC', 45.5204, -73.7019],
    'H4K': ['Montreal', 'QC', 45.5069, -73.7207], 'H4L': ['Montreal', 'QC', 45.4951, -73.7143],
    'H4M': ['Montreal', 'QC', 45.5012, -73.6843], 'H4N': ['Montreal', 'QC', 45.5094, -73.6603],
    'H4P': ['Montreal', 'QC', 45.4986, -73.6601], 'H4R': ['Montreal', 'QC', 45.5162, -73.7395],
    'H4S': ['Montreal', 'QC', 45.5121, -73.7658], 'H4T': ['Montreal', 'QC', 45.4848, -73.6784],
    'H4V': ['Montreal', 'QC', 45.4592, -73.6062], 'H4W': ['Montreal', 'QC', 45.4496, -73.6164],
    'H4X': ['Montreal', 'QC', 45.4440, -73.6354], 'H4Y': ['Dorval', 'QC', 45.4496, -73.7413],
    'H7A': ['Laval', 'QC', 45.6547, -73.7359], 'H7B': ['Laval', 'QC', 45.6673, -73.7175],
    'H7C': ['Laval', 'QC', 45.6436, -73.6957], 'H7E': ['Laval', 'QC', 45.6392, -73.6706],
    'H7G': ['Laval', 'QC', 45.6127, -73.7202], 'H7H': ['Laval', 'QC', 45.6098, -73.7497],
    'H7J': ['Laval', 'QC', 45.6008, -73.7670], 'H7K': ['Laval', 'QC', 45.6149, -73.7779],
    'H7L': ['Laval', 'QC', 45.6259, -73.7920], 'H7M': ['Laval', 'QC', 45.5954, -73.6917],
    'H7N': ['Laval', 'QC', 45.5878, -73.6728], 'H7P': ['Laval', 'QC', 45.5891, -73.7372],
    'H7R': ['Laval', 'QC', 45.5809, -73.7670], 'H7S': ['Laval', 'QC', 45.6376, -73.7657],
    'H7T': ['Laval', 'QC', 45.6504, -73.7626], 'H7V': ['Laval', 'QC', 45.6684, -73.7577],
    'H7W': ['Laval', 'QC', 45.6799, -73.7395], 'H7X': ['Laval', 'QC', 45.6820, -73.7164],
    'H7Y': ['Laval', 'QC', 45.6894, -73.7023],
    'H8P': ['LaSalle', 'QC', 45.4285, -73.6406], 'H8R': ['LaSalle', 'QC', 45.4285, -73.6406],
    'H8S': ['LaSalle', 'QC', 45.4285, -73.6406], 'H8T': ['LaSalle', 'QC', 45.4285, -73.6406],
    'H8Y': ['Pointe-Claire', 'QC', 45.4696, -73.8195], 'H8Z': ['Dollard-des-Ormeaux', 'QC', 45.4927, -73.8200],
    'H9A': ['Dollard-des-Ormeaux', 'QC', 45.4927, -73.8200], 'H9B': ['Dollard-des-Ormeaux', 'QC', 45.4927, -73.8200],
    'H9C': ['Dollard-des-Ormeaux', 'QC', 45.4927, -73.8200], 'H9E': ['Kirkland', 'QC', 45.4557, -73.8756],
    'H9G': ['Pierrefonds', 'QC', 45.4930, -73.8640], 'H9H': ['Pierrefonds', 'QC', 45.4930, -73.8640],
    'H9J': ['Pierrefonds', 'QC', 45.4930, -73.8640], 'H9K': ['Pierrefonds', 'QC', 45.4930, -73.8640],
    'H9P': ['Vaudreuil', 'QC', 45.4012, -74.0284], 'H9R': ['Pointe-Claire', 'QC', 45.4696, -73.8195],
    'H9S': ['Pointe-Claire', 'QC', 45.4696, -73.8195], 'H9W': ['Beaconsfield', 'QC', 45.4383, -73.8637],
    'H9X': ['Ste-Anne-de-Bellevue', 'QC', 45.4066, -73.9572],
    'G1A': ['Quebec City', 'QC', 46.8139, -71.2082], 'G1B': ['Quebec City', 'QC', 46.8468, -71.1505],
    'G1C': ['Quebec City', 'QC', 46.8403, -71.1911], 'G1E': ['Quebec City', 'QC', 46.8713, -71.1476],
    'G1G': ['Quebec City', 'QC', 46.8556, -71.2514], 'G1H': ['Quebec City', 'QC', 46.8489, -71.2900],
    'G1J': ['Quebec City', 'QC', 46.8372, -71.2600], 'G1K': ['Quebec City', 'QC', 46.8172, -71.2214],
    'G1L': ['Quebec City', 'QC', 46.8256, -71.2349], 'G1M': ['Quebec City', 'QC', 46.8107, -71.2597],
    'G1N': ['Quebec City', 'QC', 46.7966, -71.2640], 'G1P': ['Quebec City', 'QC', 46.7891, -71.3175],
    'G1R': ['Quebec City', 'QC', 46.8085, -71.2142], 'G1S': ['Quebec City', 'QC', 46.8013, -71.2432],
    'G1T': ['Quebec City', 'QC', 46.8066, -71.2759], 'G1V': ['Quebec City', 'QC', 46.7852, -71.2863],
    'G1W': ['Quebec City', 'QC', 46.7755, -71.3108], 'G1X': ['Quebec City', 'QC', 46.7780, -71.3483],
    'G2A': ['Quebec City', 'QC', 46.8579, -71.3219], 'G2B': ['Quebec City', 'QC', 46.8783, -71.3353],
    'G2C': ['Quebec City', 'QC', 46.9007, -71.3210], 'G2E': ['Quebec City', 'QC', 46.8303, -71.3550],
    'G2G': ['Quebec City', 'QC', 46.8432, -71.3778], 'G2J': ['Quebec City', 'QC', 46.8639, -71.3576],
    'G2K': ['Quebec City', 'QC', 46.8756, -71.3649], 'G2L': ['Quebec City', 'QC', 46.8870, -71.3508],
    'G2M': ['Quebec City', 'QC', 46.8939, -71.3356], 'G2N': ['Quebec City', 'QC', 46.9110, -71.3110],
    'G3A': ['Quebec City', 'QC', 46.9200, -71.2840], 'G3B': ['Quebec City', 'QC', 46.9378, -71.2589],
    'G3E': ['Lac-Saint-Charles', 'QC', 46.9500, -71.3800], 'G3G': ['Stoneham', 'QC', 47.0339, -71.3769],
    'G3H': ['Shannon', 'QC', 46.8833, -71.5167], 'G3J': ['Quebec City', 'QC', 46.9000, -71.3200],
    'G3K': ['Quebec City', 'QC', 46.9200, -71.3400], 'G3L': ['Pont-Rouge', 'QC', 46.7545, -71.6989],
    'G3M': ['Quebec City area', 'QC', 46.8500, -71.5000], 'G3N': ['Quebec City area', 'QC', 46.7500, -71.4000],
    'G3Z': ['Quebec City area', 'QC', 46.8000, -71.4000],
    'G4A': ['Riviere-du-Loup', 'QC', 47.8333, -69.5333], 'G4R': ['Sept-Iles', 'QC', 50.2167, -66.3834],
    'G4S': ['Sept-Iles', 'QC', 50.2167, -66.3834], 'G4T': ['Baie-Comeau', 'QC', 49.2167, -68.1500],
    'G4V': ['Riviere-du-Loup', 'QC', 47.8333, -69.5333], 'G4W': ['Riviere-du-Loup', 'QC', 47.8333, -69.5333],
    'G4X': ['Gaspe', 'QC', 48.8333, -64.4833], 'G4Z': ['Matane', 'QC', 48.8500, -67.5333],
    'G5A': ['La Malbaie', 'QC', 47.6500, -70.1500], 'G5B': ['Jonquiere', 'QC', 48.4168, -71.2351],
    'G5C': ['Jonquiere', 'QC', 48.4168, -71.2351], 'G5H': ['Saguenay', 'QC', 48.4285, -71.0688],
    'G5J': ['Saguenay', 'QC', 48.4285, -71.0688], 'G5K': ['Saguenay', 'QC', 48.4285, -71.0688],
    'G5L': ['Saguenay', 'QC', 48.4285, -71.0688], 'G5N': ['Saguenay', 'QC', 48.4285, -71.0688],
    'G5R': ['Rimouski', 'QC', 48.4501, -68.5334], 'G5T': ['Rimouski', 'QC', 48.4501, -68.5334],
    'G5V': ['Rimouski', 'QC', 48.4501, -68.5334], 'G5X': ['Rimouski', 'QC', 48.4501, -68.5334],
    'G5Z': ['Rimouski', 'QC', 48.4501, -68.5334],
    'G6A': ['Levis', 'QC', 46.8036, -71.1772], 'G6B': ['Levis', 'QC', 46.8036, -71.1772],
    'G6C': ['Levis', 'QC', 46.8036, -71.1772], 'G6E': ['Levis', 'QC', 46.8036, -71.1772],
    'G6G': ['Levis', 'QC', 46.8036, -71.1772], 'G6H': ['Levis', 'QC', 46.8036, -71.1772],
    'G6J': ['Levis', 'QC', 46.8036, -71.1772], 'G6K': ['Levis', 'QC', 46.8036, -71.1772],
    'G6L': ['Levis', 'QC', 46.8036, -71.1772], 'G6P': ['Levis', 'QC', 46.8036, -71.1772],
    'G6S': ['Levis', 'QC', 46.8036, -71.1772], 'G6T': ['Levis', 'QC', 46.8036, -71.1772],
    'G6V': ['Levis', 'QC', 46.8036, -71.1772], 'G6W': ['Levis', 'QC', 46.8036, -71.1772],
    'G6X': ['Levis', 'QC', 46.8036, -71.1772], 'G6Y': ['Levis', 'QC', 46.8036, -71.1772],
    'G6Z': ['Levis', 'QC', 46.8036, -71.1772],
    'J0A': ['Granby area', 'QC', 45.3987, -72.7312], 'J0B': ['Sherbrooke area', 'QC', 45.4042, -71.8929],
    'J0C': ['Drummondville area', 'QC', 45.8836, -72.4854], 'J0E': ['Saint-Hyacinthe area', 'QC', 45.6167, -72.9501],
    'J0G': ['Sorel area', 'QC', 46.0334, -73.1167], 'J0H': ['Longueuil area', 'QC', 45.5315, -73.5182],
    'J0J': ['Chateauguay area', 'QC', 45.3667, -73.7500], 'J0K': ['Joliette area', 'QC', 46.0167, -73.4501],
    'J0L': ['Laval area', 'QC', 45.5991, -73.7124], 'J0M': ['Quebec area', 'QC', 46.5000, -71.5000],
    'J0N': ['Gatineau area', 'QC', 45.4833, -75.7167], 'J0P': ['Valleyfield area', 'QC', 45.2501, -74.1334],
    'J0R': ['Saint-Jerome area', 'QC', 45.7834, -74.0001], 'J0S': ['Salaberry area', 'QC', 45.2501, -74.1334],
    'J0T': ['Mont-Tremblant area', 'QC', 46.1167, -74.5833], 'J0V': ['Lachute area', 'QC', 45.6500, -74.3333],
    'J0W': ['Laurentides area', 'QC', 46.0000, -74.7000], 'J0X': ['Gatineau area', 'QC', 45.5000, -75.8000],
    'J0Y': ['Laurentides area', 'QC', 46.5000, -75.5000], 'J0Z': ['Northern QC', 'QC', 47.5000, -73.5000],
    'J1A': ['Sherbrooke', 'QC', 45.4042, -71.8929], 'J1B': ['Sherbrooke', 'QC', 45.4042, -71.8929],
    'J1C': ['Sherbrooke', 'QC', 45.4042, -71.8929], 'J1E': ['Sherbrooke', 'QC', 45.4042, -71.8929],
    'J1G': ['Sherbrooke', 'QC', 45.4042, -71.8929], 'J1H': ['Sherbrooke', 'QC', 45.4042, -71.8929],
    'J1J': ['Sherbrooke', 'QC', 45.4042, -71.8929], 'J1K': ['Sherbrooke', 'QC', 45.4042, -71.8929],
    'J1L': ['Sherbrooke', 'QC', 45.4042, -71.8929], 'J1M': ['Sherbrooke', 'QC', 45.4042, -71.8929],
    'J1N': ['Sherbrooke', 'QC', 45.4042, -71.8929], 'J1R': ['Sherbrooke', 'QC', 45.4042, -71.8929],
    'J1S': ['Sherbrooke', 'QC', 45.4042, -71.8929], 'J1T': ['Sherbrooke', 'QC', 45.4042, -71.8929],
    'J1X': ['Sherbrooke', 'QC', 45.4042, -71.8929], 'J1Z': ['Sherbrooke', 'QC', 45.4042, -71.8929],
    'J2A': ['Granby', 'QC', 45.3987, -72.7312], 'J2B': ['Granby', 'QC', 45.3987, -72.7312],
    'J2C': ['Granby', 'QC', 45.3987, -72.7312], 'J2E': ['Granby', 'QC', 45.3987, -72.7312],
    'J2G': ['Drummondville', 'QC', 45.8836, -72.4854], 'J2H': ['Drummondville', 'QC', 45.8836, -72.4854],
    'J2K': ['Saint-Hyacinthe', 'QC', 45.6167, -72.9501], 'J2L': ['Saint-Hyacinthe', 'QC', 45.6167, -72.9501],
    'J2N': ['Joliette', 'QC', 46.0167, -73.4501], 'J2P': ['Joliette', 'QC', 46.0167, -73.4501],
    'J2R': ['Sorel-Tracy', 'QC', 46.0334, -73.1167], 'J2S': ['Saint-Hyacinthe', 'QC', 45.6167, -72.9501],
    'J2T': ['Saint-Hyacinthe', 'QC', 45.6167, -72.9501], 'J2W': ['Saint-Jean-sur-Richelieu', 'QC', 45.3167, -73.2667],
    'J2X': ['Saint-Jean-sur-Richelieu', 'QC', 45.3167, -73.2667], 'J2Y': ['Saint-Jean-sur-Richelieu', 'QC', 45.3167, -73.2667],
    'J3A': ['Longueuil', 'QC', 45.5315, -73.5182], 'J3B': ['Longueuil', 'QC', 45.5315, -73.5182],
    'J3E': ['Longueuil', 'QC', 45.5315, -73.5182], 'J3G': ['Longueuil', 'QC', 45.5315, -73.5182],
    'J3H': ['Brossard', 'QC', 45.4584, -73.4667], 'J3L': ['Chambly', 'QC', 45.4500, -73.2833],
    'J3M': ['Saint-Hubert', 'QC', 45.5000, -73.4167], 'J3N': ['Longueuil', 'QC', 45.5315, -73.5182],
    'J3P': ['Longueuil', 'QC', 45.5315, -73.5182], 'J3R': ['Brossard', 'QC', 45.4584, -73.4667],
    'J3V': ['Brossard', 'QC', 45.4584, -73.4667], 'J3X': ['La Prairie', 'QC', 45.4167, -73.5000],
    'J3Y': ['Longueuil', 'QC', 45.5315, -73.5182], 'J3Z': ['Longueuil', 'QC', 45.5315, -73.5182],
    'J4B': ['Longueuil', 'QC', 45.5315, -73.5182], 'J4G': ['Longueuil', 'QC', 45.5315, -73.5182],
    'J4H': ['Longueuil', 'QC', 45.5315, -73.5182], 'J4J': ['Longueuil', 'QC', 45.5315, -73.5182],
    'J4K': ['Longueuil', 'QC', 45.5315, -73.5182], 'J4L': ['Longueuil', 'QC', 45.5315, -73.5182],
    'J4M': ['Longueuil', 'QC', 45.5315, -73.5182], 'J4N': ['Longueuil', 'QC', 45.5315, -73.5182],
    'J4P': ['Saint-Lambert', 'QC', 45.5000, -73.5000], 'J4R': ['Saint-Lambert', 'QC', 45.5000, -73.5000],
    'J4S': ['Longueuil', 'QC', 45.5315, -73.5182], 'J4T': ['Longueuil', 'QC', 45.5315, -73.5182],
    'J4V': ['Longueuil', 'QC', 45.5315, -73.5182], 'J4W': ['Longueuil', 'QC', 45.5315, -73.5182],
    'J4X': ['Longueuil', 'QC', 45.5315, -73.5182], 'J4Y': ['Longueuil', 'QC', 45.5315, -73.5182],
    'J4Z': ['Longueuil', 'QC', 45.5315, -73.5182],
    'J5A': ['Repentigny', 'QC', 45.7334, -73.4584], 'J5B': ['Repentigny', 'QC', 45.7334, -73.4584],
    'J5C': ['Repentigny', 'QC', 45.7334, -73.4584], 'J5J': ['Terrebonne', 'QC', 45.7001, -73.6334],
    'J5K': ['Terrebonne', 'QC', 45.7001, -73.6334], 'J5L': ['Blainville', 'QC', 45.6667, -73.8834],
    'J5M': ['Blainville', 'QC', 45.6667, -73.8834], 'J5R': ['Repentigny', 'QC', 45.7334, -73.4584],
    'J5T': ['Terrebonne', 'QC', 45.7001, -73.6334], 'J5V': ['Terrebonne', 'QC', 45.7001, -73.6334],
    'J5W': ['Terrebonne', 'QC', 45.7001, -73.6334], 'J5X': ['Terrebonne', 'QC', 45.7001, -73.6334],
    'J5Y': ['Terrebonne', 'QC', 45.7001, -73.6334], 'J5Z': ['Terrebonne', 'QC', 45.7001, -73.6334],
    'J6A': ['Saint-Jerome', 'QC', 45.7834, -74.0001], 'J6E': ['Saint-Jerome', 'QC', 45.7834, -74.0001],
    'J6J': ['Chateauguay', 'QC', 45.3667, -73.7500], 'J6K': ['Chateauguay', 'QC', 45.3667, -73.7500],
    'J6N': ['Salaberry-de-Valleyfield', 'QC', 45.2501, -74.1334], 'J6R': ['Salaberry-de-Valleyfield', 'QC', 45.2501, -74.1334],
    'J6S': ['Salaberry-de-Valleyfield', 'QC', 45.2501, -74.1334], 'J6T': ['Salaberry-de-Valleyfield', 'QC', 45.2501, -74.1334],
    'J6V': ['Saint-Jerome', 'QC', 45.7834, -74.0001], 'J6W': ['Saint-Jerome', 'QC', 45.7834, -74.0001],
    'J6X': ['Saint-Jerome', 'QC', 45.7834, -74.0001], 'J6Y': ['Saint-Jerome', 'QC', 45.7834, -74.0001],
    'J6Z': ['Saint-Jerome', 'QC', 45.7834, -74.0001],
    'J7A': ['Deux-Montagnes', 'QC', 45.5333, -73.9167], 'J7B': ['Deux-Montagnes', 'QC', 45.5333, -73.9167],
    'J7C': ['Mirabel', 'QC', 45.6667, -74.0833], 'J7E': ['Boisbriand', 'QC', 45.6167, -73.8333],
    'J7G': ['Sainte-Therese', 'QC', 45.6500, -73.8500], 'J7H': ['Sainte-Therese', 'QC', 45.6500, -73.8500],
    'J7J': ['Sainte-Therese', 'QC', 45.6500, -73.8500], 'J7K': ['Lachute', 'QC', 45.6500, -74.3333],
    'J7L': ['Lachute', 'QC', 45.6500, -74.3333], 'J7M': ['Sainte-Therese', 'QC', 45.6500, -73.8500],
    'J7N': ['Mirabel', 'QC', 45.6667, -74.0833], 'J7P': ['Sainte-Therese', 'QC', 45.6500, -73.8500],
    'J7R': ['Sainte-Therese', 'QC', 45.6500, -73.8500], 'J7T': ['Mirabel', 'QC', 45.6667, -74.0833],
    'J7V': ['Vaudreuil-Dorion', 'QC', 45.4012, -74.0284], 'J7W': ['Vaudreuil-Dorion', 'QC', 45.4012, -74.0284],
    'J7X': ['Vaudreuil-Dorion', 'QC', 45.4012, -74.0284], 'J7Y': ['Vaudreuil-Dorion', 'QC', 45.4012, -74.0284],
    'J7Z': ['Gatineau', 'QC', 45.4833, -75.7167],
    'J8A': ['Gatineau', 'QC', 45.4833, -75.7167], 'J8B': ['Gatineau', 'QC', 45.4833, -75.7167],
    'J8C': ['Gatineau', 'QC', 45.4833, -75.7167], 'J8E': ['Gatineau', 'QC', 45.4833, -75.7167],
    'J8G': ['Gatineau', 'QC', 45.4833, -75.7167], 'J8H': ['Gatineau', 'QC', 45.4833, -75.7167],
    'J8L': ['Gatineau', 'QC', 45.4833, -75.7167], 'J8M': ['Gatineau', 'QC', 45.4833, -75.7167],
    'J8N': ['Gatineau', 'QC', 45.4833, -75.7167], 'J8P': ['Gatineau', 'QC', 45.4833, -75.7167],
    'J8R': ['Gatineau', 'QC', 45.4833, -75.7167], 'J8T': ['Gatineau', 'QC', 45.4833, -75.7167],
    'J8V': ['Gatineau', 'QC', 45.4833, -75.7167], 'J8X': ['Gatineau', 'QC', 45.4833, -75.7167],
    'J8Y': ['Gatineau', 'QC', 45.4833, -75.7167], 'J8Z': ['Gatineau', 'QC', 45.4833, -75.7167],
    'J9A': ['Hull-Gatineau', 'QC', 45.4219, -75.7088], 'J9B': ['Aylmer-Gatineau', 'QC', 45.3936, -75.8435],
    'J9H': ['Gatineau', 'QC', 45.4833, -75.7167], 'J9J': ['Gatineau', 'QC', 45.4833, -75.7167],
    'J9L': ['Mont-Laurier', 'QC', 46.5500, -75.5000], 'J9P': ['Val-d Or', 'QC', 48.1000, -77.7833],
    'J9T': ['Rouyn-Noranda', 'QC', 48.2334, -79.0167], 'J9V': ['Rouyn-Noranda', 'QC', 48.2334, -79.0167],
    'J9X': ['Rouyn-Noranda', 'QC', 48.2334, -79.0167], 'J9Y': ['Rouyn-Noranda', 'QC', 48.2334, -79.0167],
    'J9Z': ['Rouyn-Noranda', 'QC', 48.2334, -79.0167],
    // ALBERTA
    'T1H': ['Lethbridge', 'AB', 49.7019, -112.8434], 'T1J': ['Lethbridge', 'AB', 49.6955, -112.8553],
    'T1K': ['Lethbridge', 'AB', 49.6850, -112.8227], 'T1M': ['Lethbridge', 'AB', 49.7107, -112.7887],
    'T2A': ['Calgary', 'AB', 51.0459, -113.9768], 'T2B': ['Calgary', 'AB', 51.0597, -113.9603],
    'T2C': ['Calgary', 'AB', 50.9903, -114.0009], 'T2E': ['Calgary', 'AB', 51.0779, -114.0277],
    'T2G': ['Calgary', 'AB', 51.0326, -114.0718], 'T2H': ['Calgary', 'AB', 50.9982, -114.0779],
    'T2J': ['Calgary', 'AB', 50.9731, -114.0730], 'T2K': ['Calgary', 'AB', 51.0881, -114.0743],
    'T2L': ['Calgary', 'AB', 51.0818, -114.0997], 'T2M': ['Calgary', 'AB', 51.0700, -114.0757],
    'T2N': ['Calgary', 'AB', 51.0563, -114.0987], 'T2P': ['Calgary', 'AB', 51.0499, -114.0720],
    'T2R': ['Calgary', 'AB', 51.0404, -114.0822], 'T2S': ['Calgary', 'AB', 51.0197, -114.0812],
    'T2T': ['Calgary', 'AB', 51.0283, -114.1020], 'T2V': ['Calgary', 'AB', 50.9913, -114.1049],
    'T2W': ['Calgary', 'AB', 50.9631, -114.1230], 'T2X': ['Calgary', 'AB', 50.9347, -114.0832],
    'T2Y': ['Calgary', 'AB', 50.9225, -114.0630], 'T2Z': ['Calgary', 'AB', 50.9268, -113.9975],
    'T3A': ['Calgary', 'AB', 51.0755, -114.1731], 'T3B': ['Calgary', 'AB', 51.0744, -114.1989],
    'T3C': ['Calgary', 'AB', 51.0359, -114.1405], 'T3E': ['Calgary', 'AB', 51.0234, -114.1580],
    'T3G': ['Calgary', 'AB', 51.1209, -114.1970], 'T3H': ['Calgary', 'AB', 51.0197, -114.1958],
    'T3J': ['Calgary', 'AB', 51.1149, -113.9524], 'T3K': ['Calgary', 'AB', 51.1315, -114.0499],
    'T3L': ['Calgary', 'AB', 51.1301, -114.1868], 'T3M': ['Calgary', 'AB', 50.9042, -114.0209],
    'T3N': ['Calgary', 'AB', 51.1715, -114.0658], 'T3P': ['Calgary', 'AB', 51.1804, -114.0359],
    'T3R': ['Calgary', 'AB', 51.1706, -114.1706], 'T3Z': ['Calgary', 'AB', 51.0162, -114.2509],
    'T4A': ['Airdrie', 'AB', 51.3088, -114.0174], 'T4B': ['Airdrie', 'AB', 51.2793, -114.0196],
    'T4N': ['Red Deer', 'AB', 52.2718, -113.8116], 'T4P': ['Red Deer', 'AB', 52.2556, -113.7787],
    'T4R': ['Red Deer', 'AB', 52.2953, -113.8261], 'T4S': ['Red Deer', 'AB', 52.3107, -113.8626],
    'T4X': ['Sherwood Park', 'AB', 53.5273, -113.3182],
    'T5A': ['Edmonton', 'AB', 53.5846, -113.3699], 'T5B': ['Edmonton', 'AB', 53.5601, -113.4519],
    'T5C': ['Edmonton', 'AB', 53.5812, -113.5003], 'T5E': ['Edmonton', 'AB', 53.5904, -113.5338],
    'T5G': ['Edmonton', 'AB', 53.5657, -113.4808], 'T5H': ['Edmonton', 'AB', 53.5427, -113.4909],
    'T5J': ['Edmonton', 'AB', 53.5442, -113.4946], 'T5K': ['Edmonton', 'AB', 53.5387, -113.5185],
    'T5L': ['Edmonton', 'AB', 53.5664, -113.5312], 'T5M': ['Edmonton', 'AB', 53.5510, -113.5413],
    'T5N': ['Edmonton', 'AB', 53.5444, -113.5383], 'T5P': ['Edmonton', 'AB', 53.5369, -113.5740],
    'T5R': ['Edmonton', 'AB', 53.5267, -113.5580], 'T5S': ['Edmonton', 'AB', 53.5310, -113.6200],
    'T5T': ['Edmonton', 'AB', 53.5097, -113.6281], 'T5V': ['Edmonton', 'AB', 53.5743, -113.4633],
    'T5W': ['Edmonton', 'AB', 53.5586, -113.4329], 'T5X': ['Edmonton', 'AB', 53.6006, -113.5077],
    'T5Y': ['Edmonton', 'AB', 53.6119, -113.4580], 'T5Z': ['Edmonton', 'AB', 53.5940, -113.4105],
    'T6A': ['Edmonton', 'AB', 53.5264, -113.4295], 'T6B': ['Edmonton', 'AB', 53.5228, -113.4061],
    'T6C': ['Edmonton', 'AB', 53.5134, -113.4297], 'T6E': ['Edmonton', 'AB', 53.5165, -113.4828],
    'T6G': ['Edmonton', 'AB', 53.5257, -113.5278], 'T6H': ['Edmonton', 'AB', 53.5009, -113.5154],
    'T6J': ['Edmonton', 'AB', 53.4882, -113.4953], 'T6K': ['Edmonton', 'AB', 53.4866, -113.4430],
    'T6L': ['Edmonton', 'AB', 53.4870, -113.3953], 'T6M': ['Edmonton', 'AB', 53.4901, -113.6170],
    'T6N': ['Edmonton', 'AB', 53.4684, -113.4085], 'T6P': ['Edmonton', 'AB', 53.4729, -113.3648],
    'T6R': ['Edmonton', 'AB', 53.4746, -113.5316], 'T6S': ['Edmonton', 'AB', 53.4633, -113.4836],
    'T6T': ['Edmonton', 'AB', 53.4615, -113.3991], 'T6W': ['Edmonton', 'AB', 53.4424, -113.5553],
    'T6X': ['Sherwood Park', 'AB', 53.4986, -113.2845],
    'T7N': ['St Albert', 'AB', 53.6347, -113.6398], 'T7P': ['St Albert', 'AB', 53.6529, -113.6234],
    'T7X': ['St Albert', 'AB', 53.6172, -113.5827],
    'T8A': ['Sherwood Park', 'AB', 53.5376, -113.2700], 'T8B': ['Sherwood Park', 'AB', 53.5161, -113.2826],
    'T8C': ['Leduc', 'AB', 53.2575, -113.5504], 'T8H': ['Leduc', 'AB', 53.2667, -113.5501],
    'T8L': ['Fort Saskatchewan', 'AB', 53.7131, -113.2115], 'T8N': ['Fort Saskatchewan', 'AB', 53.7069, -113.2042],
    'T8V': ['Grande Prairie', 'AB', 55.1707, -118.7884], 'T8W': ['Grande Prairie', 'AB', 55.1606, -118.7484],
    'T8X': ['Grande Prairie', 'AB', 55.1811, -118.8197],
    'T9H': ['Fort McMurray', 'AB', 56.7265, -111.3790], 'T9J': ['Fort McMurray', 'AB', 56.7432, -111.4002],
    'T9K': ['Fort McMurray', 'AB', 56.7631, -111.3658],
    'T9V': ['Lloydminster', 'AB', 53.2834, -110.0001], 'T9W': ['Lloydminster', 'AB', 53.2995, -110.0263],
    // BC
    'V2P': ['Chilliwack', 'BC', 49.1579, -121.9514], 'V2R': ['Chilliwack', 'BC', 49.1579, -121.9514],
    'V2S': ['Abbotsford', 'BC', 49.0504, -122.3045], 'V2T': ['Abbotsford', 'BC', 49.0504, -122.3045],
    'V2W': ['Maple Ridge', 'BC', 49.2198, -122.5985], 'V2X': ['Maple Ridge', 'BC', 49.2198, -122.5985],
    'V2Y': ['Langley', 'BC', 49.0997, -122.6604], 'V2Z': ['Langley', 'BC', 49.0997, -122.6604],
    'V3A': ['Langley', 'BC', 49.0997, -122.6604], 'V3B': ['Port Coquitlam', 'BC', 49.2620, -122.7890],
    'V3C': ['Port Coquitlam', 'BC', 49.2620, -122.7890], 'V3E': ['Coquitlam', 'BC', 49.2838, -122.7932],
    'V3H': ['Port Moody', 'BC', 49.2842, -122.8519], 'V3J': ['Coquitlam', 'BC', 49.2838, -122.7932],
    'V3K': ['Coquitlam', 'BC', 49.2838, -122.7932], 'V3L': ['New Westminster', 'BC', 49.2057, -122.9110],
    'V3M': ['New Westminster', 'BC', 49.2057, -122.9110], 'V3N': ['Burnaby', 'BC', 49.2488, -122.9805],
    'V3R': ['Surrey', 'BC', 49.1913, -122.8490], 'V3S': ['Surrey', 'BC', 49.1913, -122.8490],
    'V3T': ['Surrey', 'BC', 49.1913, -122.8490], 'V3V': ['Surrey', 'BC', 49.1913, -122.8490],
    'V3W': ['Surrey', 'BC', 49.1913, -122.8490], 'V3X': ['Surrey', 'BC', 49.1913, -122.8490],
    'V3Y': ['Langley', 'BC', 49.0997, -122.6604], 'V4A': ['Surrey', 'BC', 49.1913, -122.8490],
    'V4B': ['White Rock', 'BC', 49.0254, -122.8020], 'V4C': ['Surrey', 'BC', 49.1913, -122.8490],
    'V4G': ['Delta', 'BC', 49.0847, -123.0586], 'V4K': ['Delta', 'BC', 49.0847, -123.0586],
    'V4L': ['Delta', 'BC', 49.0847, -123.0586], 'V4M': ['Delta', 'BC', 49.0847, -123.0586],
    'V4N': ['Surrey', 'BC', 49.1913, -122.8490], 'V4R': ['Maple Ridge', 'BC', 49.2198, -122.5985],
    'V5A': ['Burnaby', 'BC', 49.2488, -122.9805], 'V5B': ['Burnaby', 'BC', 49.2488, -122.9805],
    'V5C': ['Burnaby', 'BC', 49.2488, -122.9805], 'V5E': ['Burnaby', 'BC', 49.2488, -122.9805],
    'V5G': ['Burnaby', 'BC', 49.2488, -122.9805], 'V5H': ['Burnaby', 'BC', 49.2488, -122.9805],
    'V5J': ['Burnaby', 'BC', 49.2488, -122.9805], 'V5K': ['Vancouver', 'BC', 49.2827, -123.1207],
    'V5L': ['Vancouver', 'BC', 49.2827, -123.1207], 'V5M': ['Vancouver', 'BC', 49.2827, -123.1207],
    'V5N': ['Vancouver', 'BC', 49.2827, -123.1207], 'V5P': ['Vancouver', 'BC', 49.2827, -123.1207],
    'V5R': ['Vancouver', 'BC', 49.2827, -123.1207], 'V5S': ['Vancouver', 'BC', 49.2827, -123.1207],
    'V5T': ['Vancouver', 'BC', 49.2827, -123.1207], 'V5V': ['Vancouver', 'BC', 49.2827, -123.1207],
    'V5W': ['Vancouver', 'BC', 49.2827, -123.1207], 'V5X': ['Vancouver', 'BC', 49.2827, -123.1207],
    'V5Y': ['Vancouver', 'BC', 49.2827, -123.1207], 'V5Z': ['Vancouver', 'BC', 49.2827, -123.1207],
    'V6A': ['Vancouver', 'BC', 49.2827, -123.1207], 'V6B': ['Vancouver', 'BC', 49.2827, -123.1207],
    'V6C': ['Vancouver', 'BC', 49.2827, -123.1207], 'V6E': ['Vancouver', 'BC', 49.2827, -123.1207],
    'V6G': ['Vancouver', 'BC', 49.2827, -123.1207], 'V6H': ['Vancouver', 'BC', 49.2827, -123.1207],
    'V6J': ['Vancouver', 'BC', 49.2827, -123.1207], 'V6K': ['Vancouver', 'BC', 49.2827, -123.1207],
    'V6L': ['Vancouver', 'BC', 49.2827, -123.1207], 'V6M': ['Vancouver', 'BC', 49.2827, -123.1207],
    'V6N': ['Vancouver', 'BC', 49.2827, -123.1207], 'V6P': ['Vancouver', 'BC', 49.2827, -123.1207],
    'V6R': ['Vancouver', 'BC', 49.2827, -123.1207], 'V6S': ['Vancouver', 'BC', 49.2827, -123.1207],
    'V6T': ['UBC Vancouver', 'BC', 49.2606, -123.2460], 'V6V': ['Richmond', 'BC', 49.1666, -123.1336],
    'V6W': ['Richmond', 'BC', 49.1666, -123.1336], 'V6X': ['Richmond', 'BC', 49.1666, -123.1336],
    'V6Y': ['Richmond', 'BC', 49.1666, -123.1336], 'V6Z': ['Vancouver', 'BC', 49.2827, -123.1207],
    'V7A': ['Richmond', 'BC', 49.1666, -123.1336], 'V7B': ['Richmond', 'BC', 49.1666, -123.1336],
    'V7C': ['Richmond', 'BC', 49.1666, -123.1336], 'V7E': ['Richmond', 'BC', 49.1666, -123.1336],
    'V7G': ['North Vancouver', 'BC', 49.3163, -123.0693], 'V7H': ['North Vancouver', 'BC', 49.3163, -123.0693],
    'V7J': ['North Vancouver', 'BC', 49.3163, -123.0693], 'V7K': ['North Vancouver', 'BC', 49.3163, -123.0693],
    'V7L': ['North Vancouver', 'BC', 49.3163, -123.0693], 'V7M': ['North Vancouver', 'BC', 49.3163, -123.0693],
    'V7N': ['North Vancouver', 'BC', 49.3163, -123.0693], 'V7P': ['North Vancouver', 'BC', 49.3163, -123.0693],
    'V7R': ['North Vancouver', 'BC', 49.3163, -123.0693], 'V7S': ['West Vancouver', 'BC', 49.3692, -123.1653],
    'V7T': ['West Vancouver', 'BC', 49.3692, -123.1653], 'V7V': ['West Vancouver', 'BC', 49.3692, -123.1653],
    'V7W': ['West Vancouver', 'BC', 49.3692, -123.1653],
    'V8N': ['Victoria', 'BC', 48.4284, -123.3656], 'V8P': ['Victoria', 'BC', 48.4284, -123.3656],
    'V8R': ['Victoria', 'BC', 48.4284, -123.3656], 'V8S': ['Victoria', 'BC', 48.4284, -123.3656],
    'V8T': ['Victoria', 'BC', 48.4284, -123.3656], 'V8V': ['Victoria', 'BC', 48.4284, -123.3656],
    'V8W': ['Victoria', 'BC', 48.4284, -123.3656], 'V8X': ['Saanich', 'BC', 48.5000, -123.4167],
    'V8Y': ['Saanich', 'BC', 48.5000, -123.4167], 'V8Z': ['Saanich', 'BC', 48.5000, -123.4167],
    'V9A': ['Victoria', 'BC', 48.4284, -123.3656], 'V9B': ['Langford', 'BC', 48.4493, -123.5056],
    'V9C': ['Colwood', 'BC', 48.4260, -123.4958], 'V9E': ['View Royal', 'BC', 48.4511, -123.4345],
    'V9L': ['Duncan', 'BC', 48.7787, -123.7076], 'V9M': ['Courtenay', 'BC', 49.6887, -124.9934],
    'V9N': ['Courtenay', 'BC', 49.6887, -124.9934], 'V9P': ['Parksville', 'BC', 49.3141, -124.3117],
    'V9R': ['Nanaimo', 'BC', 49.1659, -123.9401], 'V9S': ['Nanaimo', 'BC', 49.1659, -123.9401],
    'V9T': ['Nanaimo', 'BC', 49.1659, -123.9401], 'V9V': ['Nanaimo', 'BC', 49.1659, -123.9401],
    'V9W': ['Campbell River', 'BC', 50.0167, -125.2501], 'V9Y': ['Port Alberni', 'BC', 49.2336, -124.8053],
    // MANITOBA
    'R0J': ['McCreary', 'MB', 50.7833, -99.4833], 'R0K': ['Brandon area', 'MB', 49.8485, -99.9501],
    'R0G': ['Portage la Prairie area', 'MB', 49.9728, -98.2917],
    'R0H': ['Morden area', 'MB', 49.1918, -98.0876], 'R0L': ['Swan River area', 'MB', 52.1001, -101.2668],
    'R0M': ['Russell area', 'MB', 50.7667, -101.2833], 'R0A': ['Steinbach area', 'MB', 49.5251, -96.6834],
    'R0B': ['Lac du Bonnet area', 'MB', 50.2500, -95.5000], 'R0C': ['Selkirk area', 'MB', 50.1441, -96.8844],
    'R0E': ['Beausejour area', 'MB', 50.0617, -96.5195],
    'R2C': ['Winnipeg', 'MB', 49.8951, -97.1384], 'R2E': ['Winnipeg', 'MB', 49.8951, -97.1384],
    'R2G': ['Winnipeg', 'MB', 49.8951, -97.1384], 'R2H': ['Winnipeg', 'MB', 49.8951, -97.1384],
    'R2J': ['Winnipeg', 'MB', 49.8951, -97.1384], 'R2K': ['Winnipeg', 'MB', 49.8951, -97.1384],
    'R2L': ['Winnipeg', 'MB', 49.8951, -97.1384], 'R2M': ['Winnipeg', 'MB', 49.8951, -97.1384],
    'R2N': ['Winnipeg', 'MB', 49.8951, -97.1384], 'R2P': ['Winnipeg', 'MB', 49.8951, -97.1384],
    'R2R': ['Winnipeg', 'MB', 49.8951, -97.1384], 'R2V': ['Winnipeg', 'MB', 49.8951, -97.1384],
    'R2W': ['Winnipeg', 'MB', 49.8951, -97.1384], 'R2X': ['Winnipeg', 'MB', 49.8951, -97.1384],
    'R2Y': ['Winnipeg', 'MB', 49.8951, -97.1384],
    'R3A': ['Winnipeg', 'MB', 49.8951, -97.1384], 'R3B': ['Winnipeg', 'MB', 49.8951, -97.1384],
    'R3C': ['Winnipeg', 'MB', 49.8951, -97.1384], 'R3E': ['Winnipeg', 'MB', 49.8951, -97.1384],
    'R3G': ['Winnipeg', 'MB', 49.8951, -97.1384], 'R3H': ['Winnipeg', 'MB', 49.8951, -97.1384],
    'R3J': ['Winnipeg', 'MB', 49.8951, -97.1384], 'R3K': ['Winnipeg', 'MB', 49.8951, -97.1384],
    'R3L': ['Winnipeg', 'MB', 49.8951, -97.1384], 'R3M': ['Winnipeg', 'MB', 49.8951, -97.1384],
    'R3N': ['Winnipeg', 'MB', 49.8951, -97.1384], 'R3P': ['Winnipeg', 'MB', 49.8951, -97.1384],
    'R3R': ['Winnipeg', 'MB', 49.8951, -97.1384], 'R3S': ['Winnipeg', 'MB', 49.8951, -97.1384],
    'R3T': ['Winnipeg', 'MB', 49.8951, -97.1384], 'R3V': ['Winnipeg', 'MB', 49.8951, -97.1384],
    'R3W': ['Winnipeg', 'MB', 49.8951, -97.1384], 'R3X': ['Winnipeg', 'MB', 49.8951, -97.1384],
    'R3Y': ['Winnipeg', 'MB', 49.8951, -97.1384],
    'R4A': ['Winnipeg', 'MB', 49.8951, -97.1384], 'R4G': ['Winnipeg', 'MB', 49.8951, -97.1384],
    'R4H': ['Winnipeg', 'MB', 49.8951, -97.1384], 'R5A': ['Steinbach', 'MB', 49.5251, -96.6834],
    'R5G': ['Steinbach', 'MB', 49.5251, -96.6834], 'R6M': ['Morden', 'MB', 49.1918, -98.0876],
    'R6W': ['Winkler', 'MB', 49.1818, -97.9376], 'R7A': ['Brandon', 'MB', 49.8485, -99.9501],
    'R7B': ['Brandon', 'MB', 49.8485, -99.9501], 'R7C': ['Brandon', 'MB', 49.8485, -99.9501],
    'R7N': ['Brandon', 'MB', 49.8485, -99.9501], 'R8A': ['Dauphin', 'MB', 51.1501, -100.0501],
    'R8N': ['Thompson', 'MB', 55.7435, -97.8553], 'R9A': ['The Pas', 'MB', 53.8251, -101.2501],
    // SASKATCHEWAN
    'S4L': ['Regina', 'SK', 50.4452, -104.6189], 'S4N': ['Regina', 'SK', 50.4452, -104.6189],
    'S4P': ['Regina', 'SK', 50.4452, -104.6189], 'S4R': ['Regina', 'SK', 50.4452, -104.6189],
    'S4S': ['Regina', 'SK', 50.4452, -104.6189], 'S4T': ['Regina', 'SK', 50.4452, -104.6189],
    'S4V': ['Regina', 'SK', 50.4452, -104.6189], 'S4W': ['Regina', 'SK', 50.4452, -104.6189],
    'S4X': ['Regina', 'SK', 50.4452, -104.6189], 'S4Y': ['Regina', 'SK', 50.4452, -104.6189],
    'S4Z': ['Regina', 'SK', 50.4452, -104.6189], 'S6H': ['Moose Jaw', 'SK', 50.3934, -105.5518],
    'S6J': ['Moose Jaw', 'SK', 50.3934, -105.5518], 'S6K': ['Moose Jaw', 'SK', 50.3934, -105.5518],
    'S7H': ['Saskatoon', 'SK', 52.1332, -106.6700], 'S7J': ['Saskatoon', 'SK', 52.1332, -106.6700],
    'S7K': ['Saskatoon', 'SK', 52.1332, -106.6700], 'S7L': ['Saskatoon', 'SK', 52.1332, -106.6700],
    'S7M': ['Saskatoon', 'SK', 52.1332, -106.6700], 'S7N': ['Saskatoon', 'SK', 52.1332, -106.6700],
    'S7P': ['Saskatoon', 'SK', 52.1332, -106.6700], 'S7R': ['Saskatoon', 'SK', 52.1332, -106.6700],
    'S7S': ['Saskatoon', 'SK', 52.1332, -106.6700], 'S7T': ['Saskatoon', 'SK', 52.1332, -106.6700],
    'S7V': ['Saskatoon', 'SK', 52.1332, -106.6700], 'S7W': ['Saskatoon', 'SK', 52.1332, -106.6700],
    'S9A': ['Prince Albert', 'SK', 53.2001, -105.7501], 'S9H': ['Swift Current', 'SK', 50.2834, -107.7968],
    'S9V': ['North Battleford', 'SK', 52.7834, -108.2834], 'S9X': ['Yorkton', 'SK', 51.2167, -102.4667],
    // NOVA SCOTIA
    'B3A': ['Halifax', 'NS', 44.6488, -63.5752], 'B3B': ['Halifax', 'NS', 44.6488, -63.5752],
    'B3H': ['Halifax', 'NS', 44.6488, -63.5752], 'B3J': ['Halifax', 'NS', 44.6488, -63.5752],
    'B3K': ['Halifax', 'NS', 44.6488, -63.5752], 'B3L': ['Halifax', 'NS', 44.6488, -63.5752],
    'B3M': ['Halifax', 'NS', 44.6488, -63.5752], 'B3N': ['Halifax', 'NS', 44.6488, -63.5752],
    'B3P': ['Halifax', 'NS', 44.6488, -63.5752], 'B3R': ['Halifax', 'NS', 44.6488, -63.5752],
    'B3S': ['Halifax', 'NS', 44.6488, -63.5752], 'B3T': ['Halifax', 'NS', 44.6488, -63.5752],
    'B2R': ['Dartmouth', 'NS', 44.6667, -63.5667], 'B2S': ['Dartmouth', 'NS', 44.6667, -63.5667],
    'B2T': ['Dartmouth', 'NS', 44.6667, -63.5667], 'B2V': ['Dartmouth', 'NS', 44.6667, -63.5667],
    'B2W': ['Dartmouth', 'NS', 44.6667, -63.5667], 'B2X': ['Dartmouth', 'NS', 44.6667, -63.5667],
    'B2Y': ['Dartmouth', 'NS', 44.6667, -63.5667], 'B2Z': ['Dartmouth', 'NS', 44.6667, -63.5667],
    'B1A': ['Glace Bay', 'NS', 46.1970, -59.9574], 'B1B': ['Sydney', 'NS', 46.1368, -60.1942],
    'B1P': ['Sydney', 'NS', 46.1368, -60.1942], 'B2A': ['New Glasgow', 'NS', 45.5918, -62.6501],
    'B2G': ['Antigonish', 'NS', 45.6237, -61.9969], 'B2J': ['Truro', 'NS', 45.3651, -63.2860],
    'B2N': ['Truro', 'NS', 45.3651, -63.2860], 'B4N': ['Kentville', 'NS', 45.0702, -64.4951],
    'B4V': ['Bridgewater', 'NS', 44.3751, -64.5168], 'B5A': ['Yarmouth', 'NS', 43.8334, -66.1168],
    // NEW BRUNSWICK
    'E1A': ['Moncton', 'NB', 46.0878, -64.7782], 'E1B': ['Moncton', 'NB', 46.0878, -64.7782],
    'E1C': ['Moncton', 'NB', 46.0878, -64.7782], 'E1E': ['Moncton', 'NB', 46.0878, -64.7782],
    'E1G': ['Moncton', 'NB', 46.0878, -64.7782], 'E1H': ['Moncton', 'NB', 46.0878, -64.7782],
    'E1J': ['Riverview', 'NB', 46.0607, -64.8033], 'E1V': ['Miramichi', 'NB', 47.0251, -65.4834],
    'E2A': ['Bathurst', 'NB', 47.6167, -65.6501], 'E2K': ['Campbellton', 'NB', 48.0051, -66.6734],
    'E3A': ['Fredericton', 'NB', 45.9636, -66.6431], 'E3B': ['Fredericton', 'NB', 45.9636, -66.6431],
    'E3C': ['Fredericton', 'NB', 45.9636, -66.6431], 'E3V': ['Edmundston', 'NB', 47.3668, -68.3251],
    'E4A': ['Woodstock', 'NB', 46.1500, -67.5600], 'E4Z': ['Saint John', 'NB', 45.2733, -66.0633],
    'E5A': ['Saint John', 'NB', 45.2733, -66.0633], 'E5B': ['Saint John', 'NB', 45.2733, -66.0633],
    // PEI
    'C1A': ['Charlottetown', 'PE', 46.2382, -63.1311], 'C1B': ['Charlottetown', 'PE', 46.2382, -63.1311],
    'C1C': ['Charlottetown', 'PE', 46.2382, -63.1311], 'C1E': ['Charlottetown', 'PE', 46.2382, -63.1311],
    'C1N': ['Summerside', 'PE', 46.3951, -63.7901],
    // NEWFOUNDLAND
    'A1A': ['St. Johns', 'NL', 47.5615, -52.7126], 'A1B': ['St. Johns', 'NL', 47.5615, -52.7126],
    'A1C': ['St. Johns', 'NL', 47.5615, -52.7126], 'A1S': ['Mount Pearl', 'NL', 47.5190, -52.8057],
    'A1V': ['Grand Falls-Windsor', 'NL', 48.9334, -55.6667], 'A1W': ['Corner Brook', 'NL', 48.9500, -57.9500],
    'A2A': ['Corner Brook', 'NL', 48.9500, -57.9500], 'A2H': ['Grand Falls-Windsor', 'NL', 48.9334, -55.6667],
    'A2V': ['Labrador City', 'NL', 52.9501, -66.9167],
    // TERRITORIES
    'X1A': ['Yellowknife', 'NT', 62.4540, -114.3718], 'Y1A': ['Whitehorse', 'YT', 60.7212, -135.0568],
    'X0A': ['Iqaluit', 'NU', 63.7467, -68.5170],
};

// ── Postal/ZIP lookup ──────────────────────────────────────────────
// Canada: built-in FSA table (instant, offline, no API needed)
// USA: Zippopotam.us (free, CORS-friendly)
async function lookupPostalCode(code) {
    const clean = code.trim().replace(/\s+/g, '').toUpperCase();
    // Canadian postal: A1A1A1 or A1A (FSA only)
    const isCA = /^[A-Z]\d[A-Z](\d[A-Z]\d)?$/.test(clean);
    // US ZIP: exactly 5 digits
    const isUS = /^\d{5}$/.test(clean);
    if (!isCA && !isUS) throw new Error('invalid');

    if (isUS) {
        // Zippopotam works well for US ZIPs
        try {
            const res = await fetch('https://api.zippopotam.us/us/' + clean, { headers: { 'Accept': 'application/json' } });
            if (res.ok) {
                const d = await res.json();
                const p = d.places && d.places[0];
                if (p) return { name: p['place name'], province: p['state abbreviation'], lat: parseFloat(p.latitude), lon: parseFloat(p.longitude) };
            }
        } catch (e) { }
        throw new Error('notfound');
    }

    if (isCA) {
        // Look up FSA (first 3 chars) in built-in table — instant, no API, works offline
        const fsa = clean.slice(0, 3);
        const entry = CA_FSA[fsa];
        if (entry) return { name: entry[0], province: entry[1], lat: entry[2], lon: entry[3] };
        throw new Error('notfound');
    }
}

// ── Manual save form — shown when city not found ──────────────────
function ManualSaveForm({ value, T, onSave }) {
    const q = value.trim();
    const comma = q.lastIndexOf(',');
    const defaultName = comma > 0 ? q.slice(0, comma).trim() : q;
    const defaultProv = comma > 0 ? q.slice(comma + 1).trim().toUpperCase().slice(0, 2) : '';
    const [tab, setTab] = useState('postal');
    const [postal, setPostal] = useState('');
    const [postalLoading, setPostalLoading] = useState(false);
    const [postalError, setPostalError] = useState('');
    // Confirm step — shown after lookup so user can correct city name
    const [confirm, setConfirm] = useState(null); // {name,prov,lat,lon}
    const [confirmName, setConfirmName] = useState('');
    const [confirmProv, setConfirmProv] = useState('');
    // Manual tab fields
    const [name, setName] = useState(defaultName);
    const [prov, setProv] = useState(defaultProv);
    const [lat, setLat] = useState('');
    const [lon, setLon] = useState('');
    const inpSt = { border: '1px solid ' + T.border, borderRadius: 7, padding: '9px 10px', fontSize: 14, color: T.text, background: T.bg, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };

    async function doPostalLookup() {
        const code = postal.trim();
        if (!code) return;
        const clean = code.replace(/\s+/g, '').toUpperCase();
        const isCA = /^[A-Z]\d[A-Z](\d[A-Z]\d)?$/.test(clean);
        const isUS = /^\d{5}$/.test(clean);
        if (!isCA && !isUS) {
            setPostalError('🇨🇦 Canada: full postal code (e.g. K0H1Z0) · 🇺🇸 USA: 5-digit ZIP (e.g. 46750)');
            return;
        }
        setPostalLoading(true); setPostalError(''); setConfirm(null);
        try {
            const result = await lookupPostalCode(code);
            // Always show confirm step — city name EMPTY so user must type it
            // Coordinates from FSA are useful even if city name isn't
            setConfirm({ lat: result ? result.lat : 0, lon: result ? result.lon : 0, province: result ? result.province : '' });
            setConfirmName(''); // never pre-fill — user types exact city
            setConfirmProv(result ? result.province : (isCA ? '' : ''));
        } catch (e) {
            // Even if lookup fails, show confirm with empty fields
            setConfirm({ lat: 0, lon: 0, province: '' });
            setConfirmName('');
            setConfirmProv(isCA ? clean.slice(0, 1) === 'M' || clean.slice(0, 1) === 'L' || clean.slice(0, 1) === 'K' || clean.slice(0, 1) === 'N' ? 'ON' :
                clean.slice(0, 1) === 'H' || clean.slice(0, 1) === 'G' || clean.slice(0, 1) === 'J' ? 'QC' :
                    clean.slice(0, 1) === 'T' ? 'AB' :
                        clean.slice(0, 1) === 'V' ? 'BC' :
                            clean.slice(0, 1) === 'S' ? 'SK' :
                                clean.slice(0, 1) === 'R' ? 'MB' :
                                    clean.slice(0, 1) === 'E' ? 'NB' :
                                        clean.slice(0, 1) === 'B' ? 'NS' :
                                            clean.slice(0, 1) === 'C' ? 'PE' :
                                                clean.slice(0, 1) === 'A' ? 'NL' : '' : '');
        }
        setPostalLoading(false);
    }

    function doManualSave(e) {
        e.preventDefault();
        if (!name.trim()) return;
        onSave(name, prov, lat, lon);
    }

    return (
        <div style={{ padding: '12px 14px', borderBottom: '1px solid ' + T.border }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.textSec, marginBottom: 8, textTransform: 'uppercase', letterSpacing: .4 }}>
                📍 City not found — add it
            </div>

            {/* Tab switcher */}
            <div style={{ display: 'flex', background: T.bg, borderRadius: 8, padding: 3, gap: 3, marginBottom: 10 }}>
                {[['postal', '📮 Postal / ZIP'], ['manual', '✏️ Manual']].map(([k, l]) => (
                    <button key={k} onMouseDown={function (e) { e.preventDefault(); setTab(k); setConfirm(null); }} onTouchEnd={function (e) { e.preventDefault(); setTab(k); setConfirm(null); }}
                        style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', background: tab === k ? T.card : T.bg, color: tab === k ? T.text : T.textSec, fontWeight: tab === k ? 700 : 400, fontSize: 12, cursor: 'pointer', boxShadow: tab === k ? '0 1px 3px rgba(0,0,0,.1)' : 'none', fontFamily: 'inherit' }}>
                        {l}
                    </button>
                ))}
            </div>

            {/* Postal / ZIP tab */}
            {tab === 'postal' && (<div>
                {!confirm && (<>
                    <div style={{ fontSize: 11, color: T.textSec, marginBottom: 6, lineHeight: 1.5 }}>
                        Enter postal/ZIP code — you can edit the city name before saving:
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                        <input value={postal} onChange={function (e) { setPostal(e.target.value.toUpperCase()); setPostalError(''); }}
                            placeholder="e.g. K0H1Z0 or 46750"
                            style={{ ...inpSt, flex: 1, letterSpacing: 1 }} autoComplete="off"
                            onKeyDown={function (e) { if (e.key === 'Enter') { e.preventDefault(); doPostalLookup(); } }} />
                        <button onMouseDown={function (e) { e.preventDefault(); doPostalLookup(); }}
                            onTouchEnd={function (e) { e.preventDefault(); doPostalLookup(); }}
                            disabled={postalLoading}
                            style={{ background: T.primary, color: '#fff', border: 'none', borderRadius: 7, padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, opacity: postalLoading ? 0.7 : 1 }}>
                            {postalLoading ? '…' : 'Look up'}
                        </button>
                    </div>
                    {postalError && <div style={{ fontSize: 11, color: '#DC2626', marginBottom: 6, lineHeight: 1.4 }}>{postalError}</div>}
                    <div style={{ fontSize: 10, color: T.textSec, lineHeight: 1.6 }}>
                        🇨🇦 Canada: full postal code — <b>K0H1Z0</b>, <b>R0J1B0</b>, <b>L5B3J1</b><br />
                        🇺🇸 USA: 5-digit ZIP — <b>46750</b>, <b>48201</b>, <b>60601</b>
                    </div>
                </>)}

                {/* ── Confirm step: editable city name + province before saving ── */}
                {confirm && (
                    <div>
                        <div style={{ background: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: 8, padding: '8px 10px', marginBottom: 10, fontSize: 11, color: '#1E40AF', lineHeight: 1.5 }}>
                            ✅ Got coordinates from postal code. Now type the <b>exact city name</b> below:
                        </div>
                        {/* City name — always empty, user must type */}
                        <div style={{ fontSize: 10, color: T.textSec, marginBottom: 3 }}>City Name <span style={{ color: '#EF4444' }}>*</span></div>
                        <input value={confirmName} onChange={function (e) { setConfirmName(e.target.value); }}
                            placeholder="Type exact city name e.g. Kaladar"
                            style={{ ...inpSt, marginBottom: 6, fontWeight: 600, fontSize: 15, borderColor: confirmName ? T.primary : '#EF4444' }}
                            autoCorrect="off" autoCapitalize="words" />
                        {!confirmName && <div style={{ fontSize: 10, color: '#EF4444', marginBottom: 6 }}>City name required</div>}
                        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 10, color: T.textSec, marginBottom: 3 }}>Province/State</div>
                                <input value={confirmProv} onChange={function (e) { setConfirmProv(e.target.value.toUpperCase().slice(0, 2)); }}
                                    style={inpSt} maxLength={2} placeholder="ON" />
                            </div>
                            <div style={{ flex: 2 }}>
                                <div style={{ fontSize: 10, color: T.textSec, marginBottom: 3 }}>
                                    {confirm.lat && confirm.lon ? 'Coordinates (from postal FSA)' : 'Coordinates — unknown'}
                                </div>
                                <div style={{ padding: '9px 10px', background: T.bg, borderRadius: 7, border: '1px solid ' + T.border, fontSize: 12, color: confirm.lat ? T.textSec : '#EF4444' }}>
                                    {confirm.lat && confirm.lon ? confirm.lat.toFixed(4) + ', ' + confirm.lon.toFixed(4) : 'Not found — add manually'}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button onMouseDown={function (e) { e.preventDefault(); if (!confirmName.trim()) return; onSave(confirmName.trim(), confirmProv, String(confirm.lat || 0), String(confirm.lon || 0)); }}
                                onTouchEnd={function (e) { e.preventDefault(); if (!confirmName.trim()) return; onSave(confirmName.trim(), confirmProv, String(confirm.lat || 0), String(confirm.lon || 0)); }}
                                style={{ flex: 2, background: confirmName.trim() ? T.primary : '#94A3B8', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 14, fontWeight: 700, cursor: confirmName.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                                💾 {confirmName.trim() ? 'Save ' + confirmName.trim() : 'Enter city name first'}
                            </button>
                            <button onMouseDown={function (e) { e.preventDefault(); setConfirm(null); setPostal(''); }}
                                onTouchEnd={function (e) { e.preventDefault(); setConfirm(null); setPostal(''); }}
                                style={{ flex: 1, background: T.bg, color: T.textSec, border: '1px solid ' + T.border, borderRadius: 8, padding: '11px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                Back
                            </button>
                        </div>
                    </div>
                )}
            </div>)}

            {/* Manual tab */}
            {tab === 'manual' && (
                <div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                        <div style={{ flex: 2 }}>
                            <div style={{ fontSize: 10, color: T.textSec, marginBottom: 3 }}>City Name</div>
                            <input value={name} onChange={function (e) { setName(e.target.value); }} placeholder="e.g. Kaladar" style={inpSt} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 10, color: T.textSec, marginBottom: 3 }}>Province/State</div>
                            <input value={prov} onChange={function (e) { setProv(e.target.value.toUpperCase().slice(0, 2)); }} placeholder="ON" style={inpSt} maxLength={2} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 10, color: T.textSec, marginBottom: 3 }}>Latitude <span style={{ fontWeight: 400 }}>(optional)</span></div>
                            <input value={lat} onChange={function (e) { setLat(e.target.value.replace(/[^0-9.\-]/g, '')); }} placeholder="e.g. 44.63" style={inpSt} inputMode="decimal" />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 10, color: T.textSec, marginBottom: 3 }}>Longitude <span style={{ fontWeight: 400 }}>(optional)</span></div>
                            <input value={lon} onChange={function (e) { setLon(e.target.value.replace(/[^0-9.\-]/g, '')); }} placeholder="e.g. -77.12" style={inpSt} inputMode="decimal" />
                        </div>
                    </div>
                    <button onMouseDown={doManualSave} onTouchEnd={function (e) { e.preventDefault(); doManualSave(e); }}
                        style={{ width: '100%', background: T.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        💾 Save City
                    </button>
                </div>
            )}
        </div>
    );
}

// ── Result row — simple tap to select, coord display only ──────────
function ResultRow({ item, isLast, T, onPick, onEdit }) {
    return (
        <div style={{ borderBottom: isLast ? 'none' : '1px solid ' + T.border }}>
            <div style={{ display: 'flex', alignItems: 'center', background: T.card }}>
                {/* Main tap area — selects the city */}
                <div
                    onMouseDown={function (e) { e.preventDefault(); onPick(item); }}
                    onTouchEnd={function (e) { e.preventDefault(); onPick(item); }}
                    style={{ flex: 1, padding: '11px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, minHeight: 46 }}
                    onMouseEnter={function (e) { e.currentTarget.style.background = T.bg; }}
                    onMouseLeave={function (e) { e.currentTarget.style.background = T.card; }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>📍</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{item.label}</div>
                        <div style={{ fontSize: 10, color: T.textSec, marginTop: 1 }}>
                            {item.lat && item.lon
                                ? 'Lat ' + parseFloat(item.lat).toFixed(4) + ' · Lon ' + parseFloat(item.lon).toFixed(4)
                                : 'No coordinates · tap ✏️ to add'}
                            {item.fromAI ? <span style={{ color: '#059669', marginLeft: 4 }}>· 🤖</span> : null}
                        </div>
                    </div>
                </div>
                {/* Edit button — separate from pick area */}
                <div
                    onMouseDown={function (e) { e.preventDefault(); e.stopPropagation(); onEdit(item); }}
                    onTouchEnd={function (e) { e.preventDefault(); e.stopPropagation(); onEdit(item); }}
                    style={{ padding: '0 14px', cursor: 'pointer', color: T.textSec, fontSize: 16, flexShrink: 0, alignSelf: 'stretch', display: 'flex', alignItems: 'center' }}>
                    ✏️
                </div>
            </div>
        </div>
    );
}

function PlacesAuto({ value, onChange, placeholder, T, onSelect }) {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState('');
    // editTarget: the city being coord-edited, shown BELOW the dropdown
    const [editTarget, setEditTarget] = useState(null);
    const [editLat, setEditLat] = useState('');
    const [editLon, setEditLon] = useState('');
    const picking = useRef(false);
    const timer = useRef(null);
    const reqId = useRef(0);
    const wrapRef = useRef(null);

    function handleChange(v) {
        onChange(v);
        clearTimeout(timer.current);
        setStatus(''); setEditTarget(null);
        const q = v.trim();
        if (q.length < 2) { setResults([]); setOpen(false); setLoading(false); return; }
        const local = localSearch(q);
        if (local.length > 0) { setResults(local); setOpen(true); setLoading(false); return; }
        if (q.length >= 3) {
            setResults([]); setLoading(true); setOpen(true);
            const id = ++reqId.current;
            timer.current = setTimeout(async function () {
                if (reqId.current !== id) return;
                try {
                    const arr = await claudeFallbackSearch(q);
                    if (reqId.current !== id) return;
                    if (arr.length > 0) { arr.forEach(function (r) { saveCustomCity(r.name, r.province, r.lat, r.lon); }); setResults(arr); setStatus('ai'); }
                    else setStatus('noresult');
                } catch (e) { if (reqId.current !== id) return; setStatus('noresult'); }
                setLoading(false);
            }, 500);
        }
    }

    function pick(item) {
        picking.current = false;
        onChange(item.label);
        setResults([]); setOpen(false); setLoading(false); setStatus(''); setEditTarget(null);
        onSelect && onSelect({ display: item.label, lat: item.lat, lon: item.lon });
    }

    function pickWithCoords(item, latStr, lonStr) {
        const lat = parseFloat(latStr);
        const lon = parseFloat(lonStr);
        const hasCoords = !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0;
        // Update saved coords
        const parts = item.label.split(',');
        const n = (parts[0] || '').trim();
        const p = (parts[1] || '').trim();
        if (hasCoords && n && p) saveCustomCity(n, p, lat, lon);
        pick({ ...item, lat: hasCoords ? lat : item.lat, lon: hasCoords ? lon : item.lon });
    }

    function openEdit(item) {
        setEditTarget(item);
        setEditLat(item.lat ? String(item.lat) : '');
        setEditLon(item.lon ? String(item.lon) : '');
        setOpen(false); // close dropdown so keyboard doesn't fight
    }

    // Coord input style
    const cInp = { border: '1px solid ' + T.border, borderRadius: 7, padding: '9px 10px', fontSize: 16, color: T.text, background: T.card, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };

    const showDrop = open && (loading || results.length > 0 || status === 'noresult');
    // blockBlur prevents onBlur from closing dropdown when tapping inside it
    const blockBlur = useRef(false);

    return (
        <div style={{ marginBottom: 12 }}>
            <style>{`@keyframes _sp{to{transform:rotate(360deg);}}`}</style>

            {/* ── Full-screen coord editor modal (z-index above Sheet) ── */}
            {editTarget && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 900, display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.6)' }}
                    onTouchStart={function (e) { e.stopPropagation(); }}>
                    <div style={{ flex: 1 }} onTouchEnd={function () { setEditTarget(null); }} />
                    <div style={{ background: T.card, borderRadius: '20px 20px 0 0', padding: 20, paddingBottom: 40, boxShadow: '0 -4px 24px rgba(0,0,0,.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>📍 Update Coordinates</div>
                                <div style={{ fontSize: 12, color: T.textSec, marginTop: 2 }}>{editTarget.label}</div>
                            </div>
                            <button onTouchEnd={function (e) { e.preventDefault(); setEditTarget(null); }}
                                onClick={function () { setEditTarget(null); }}
                                style={{ background: T.bg, border: 'none', borderRadius: 20, width: 32, height: 32, fontSize: 18, color: T.textSec, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                        </div>
                        {editTarget.lat && editTarget.lon ? (
                            <div style={{ background: T.bg, borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: T.textSec }}>
                                Current: {parseFloat(editTarget.lat).toFixed(6)}, {parseFloat(editTarget.lon).toFixed(6)}
                            </div>
                        ) : null}
                        <div style={{ fontSize: 12, color: T.textSec, marginBottom: 12, lineHeight: 1.5, background: '#FEF3C7', borderRadius: 8, padding: '8px 12px' }}>
                            💡 Long-press your city on <b>Google Maps</b> → tap the pin → copy the coordinates shown.
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: T.textSec, marginBottom: 6 }}>LATITUDE</div>
                                <input value={editLat}
                                    onChange={function (e) { setEditLat(e.target.value); }}
                                    placeholder="e.g. 43.2557"
                                    style={cInp}
                                    type="text"
                                    inputMode="decimal"
                                    autoComplete="off" />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: T.textSec, marginBottom: 6 }}>LONGITUDE</div>
                                <input value={editLon}
                                    onChange={function (e) { setEditLon(e.target.value); }}
                                    placeholder="e.g. -79.8711"
                                    style={cInp}
                                    type="text"
                                    inputMode="decimal"
                                    autoComplete="off" />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button
                                onClick={function () { pickWithCoords(editTarget, editLat, editLon); }}
                                style={{ flex: 2, background: T.primary, color: '#fff', border: 'none', borderRadius: 12, padding: '14px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                                ✅ Save & Select
                            </button>
                            <button
                                onClick={function () { pick(editTarget); }}
                                style={{ flex: 1, background: T.bg, color: T.textSec, border: '1px solid ' + T.border, borderRadius: 12, padding: '14px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                                Skip
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main input */}
            <div style={{ position: 'relative' }}>
                <input value={value}
                    onChange={function (e) { handleChange(e.target.value); }}
                    onFocus={function () { if (results.length > 0 || status === 'noresult') { setOpen(true); } }}
                    onBlur={function () {
                        // Don't close if user is interacting with dropdown or edit button
                        setTimeout(function () {
                            if (!blockBlur.current) setOpen(false);
                            blockBlur.current = false;
                        }, 350);
                    }}
                    placeholder={placeholder}
                    autoComplete="off" autoCorrect="off" autoCapitalize="words" spellCheck={false}
                    style={iSt(T, { marginBottom: 0, paddingRight: 36, borderRadius: showDrop ? '8px 8px 0 0' : 8, fontSize: 16 })} />
                <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    {loading ? <div style={{ width: 15, height: 15, border: '2px solid ' + T.border, borderTopColor: T.primary, borderRadius: '50%', animation: '_sp .65s linear infinite' }} /> : <span style={{ fontSize: 14, opacity: .35 }}>🔍</span>}
                </div>
            </div>

            {/* Dropdown */}
            {showDrop && (
                <div
                    onTouchStart={function () { blockBlur.current = true; }}
                    onMouseDown={function () { blockBlur.current = true; }}
                    style={{ background: T.card, border: '2px solid ' + T.primary, borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden', boxShadow: '0 8px 20px rgba(0,0,0,.13)' }}>
                    {loading && <div style={{ padding: '12px 15px', display: 'flex', alignItems: 'center', gap: 10, color: T.textSec, fontSize: 13 }}><div style={{ width: 13, height: 13, border: '2px solid ' + T.border, borderTopColor: T.primary, borderRadius: '50%', animation: '_sp .65s linear infinite', flexShrink: 0 }} />Searching…</div>}
                    {status === 'noresult' && !loading && <ManualSaveForm value={value} T={T} onSave={function (name, prov, latStr, lonStr) {
                        const lat = parseFloat(latStr), lon = parseFloat(lonStr);
                        const hasCoords = !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0;
                        const coords = hasCoords ? [lat, lon] : (PROV_COORDS[prov.toUpperCase()] || [43.5, -80.0]);
                        const label = name.trim() + ', ' + prov.trim().toUpperCase();
                        saveCustomCity(name.trim(), prov.trim().toUpperCase(), coords[0], coords[1]);
                        onChange(label); setOpen(false); setStatus('');
                        onSelect && onSelect({ display: label, lat: coords[0], lon: coords[1] });
                    }} />}
                    {results.map(function (item, i) {
                        return (
                            <ResultRow key={i} item={item} isLast={i === results.length - 1} T={T}
                                onPick={function (it) { blockBlur.current = false; pick(it); }}
                                onEdit={function (it) { blockBlur.current = false; openEdit(it); }} />
                        );
                    })}
                    {!loading && results.length > 0 && (
                        <div style={{ padding: '4px 15px 6px', fontSize: 10, color: T.textSec, borderTop: '1px solid ' + T.border, background: T.bg }}>
                            {status === 'ai' ? '🤖 AI search' : '📍 Local database'} · tap ✏️ to edit coordinates
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════ CONTACT AUTOCOMPLETE ════════════════
// Shipper/Receiver/Deadhead name field — searches SHARED company database.
// On pick, returns address, city, postal AND lat/lon so origin/destination
// can auto-fill with a PRECISE pinpoint, not just a vague city center.
function ContactAutoComplete({ type, value, onChange, onSelectCompany, T, placeholder, postal, onPostalChange }) {
    const [results, setResults] = useState([]);
    const [open, setOpen] = useState(false);
    const [postalLoading, setPostalLoading] = useState(false);
    const [postalError, setPostalError] = useState('');
    const picking = useRef(false);
    const accent = type === 'shipper' ? '#3B82F6' : type === 'deadhead' ? '#F97316' : '#DC2626';
    const borderLight = type === 'shipper' ? '#BFDBFE' : type === 'deadhead' ? '#FDBA74' : '#FECACA';

    function handleChange(v) {
        onChange(v);
        const found = searchCompanies(v);
        setResults(found);
        setOpen(found.length > 0);
    }

    function pick(c) {
        picking.current = false;
        onChange(c.name);
        setResults([]); setOpen(false);
        onSelectCompany && onSelectCompany(c);
    }

    function handleBlur() {
        setTimeout(function () { if (!picking.current) setOpen(false); }, 250);
    }

    async function doLookup() {
        const code = (postal || '').trim();
        if (!code) return;
        const clean = code.replace(/\s+/g, '').toUpperCase();
        const isCA = /^[A-Z]\d[A-Z](\d[A-Z]\d)?$/.test(clean);
        const isUS = /^\d{5}$/.test(clean);
        if (!isCA && !isUS) { setPostalError('Invalid code'); return; }
        setPostalLoading(true); setPostalError('');
        try {
            const result = await lookupPostalCode(code);
            if (result && result.lat && result.lon) {
                onSelectCompany && onSelectCompany({ name: value, address: '', city: '', postalOnly: true, lat: result.lat, lon: result.lon, postalCityName: result.name, postalProvince: result.province });
            } else {
                setPostalError('Not found');
            }
        } catch (e) { setPostalError('Not found'); }
        setPostalLoading(false);
    }

    return (
        <div>
            <div style={{ position: 'relative', marginBottom: 6 }}>
                <input value={value} onChange={function (e) { handleChange(e.target.value); }}
                    onFocus={function () { if (results.length > 0) setOpen(true); }}
                    onBlur={handleBlur}
                    placeholder={placeholder}
                    autoComplete="off" autoCorrect="off" autoCapitalize="words" spellCheck={false}
                    style={{ width: '100%', boxSizing: 'border-box', border: '1px solid ' + borderLight, borderRadius: 7, padding: '8px 10px', fontSize: 13, color: T.text, background: T.card, outline: 'none', fontFamily: 'inherit' }} />
                {open && results.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: T.card, border: '2px solid ' + accent, borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden', boxShadow: '0 6px 16px rgba(0,0,0,.15)' }}>
                        {results.map(function (c, i) {
                            return (
                                <div key={i}
                                    onTouchStart={function () { picking.current = true; }}
                                    onTouchEnd={function (e) { e.preventDefault(); pick(c); }}
                                    onMouseDown={function (e) { e.preventDefault(); pick(c); }}
                                    style={{ padding: '9px 12px', borderBottom: i < results.length - 1 ? '1px solid ' + T.border : 'none', cursor: 'pointer' }}
                                    onMouseEnter={function (e) { e.currentTarget.style.background = T.bg; }}
                                    onMouseLeave={function (e) { e.currentTarget.style.background = T.card; }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{c.name}</div>
                                    {(c.address || c.city) && <div style={{ fontSize: 11, color: T.textSec, marginTop: 1 }}>{c.address}{c.address && c.city ? ', ' : ''}{c.city}</div>}
                                    {c.postal && <div style={{ fontSize: 10, color: accent, marginTop: 1, fontWeight: 600 }}>📮 {c.postal}{c.lat ? ' · pinpointed' : ''}</div>}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            {/* ── Postal/ZIP field for precise pinpoint (important for large cities) ── */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input value={postal || ''} onChange={function (e) { onPostalChange && onPostalChange(e.target.value.toUpperCase()); setPostalError(''); }}
                    placeholder="Postal/ZIP (optional, pinpoints exact spot)"
                    style={{ flex: 1, boxSizing: 'border-box', border: '1px solid ' + borderLight, borderRadius: 7, padding: '7px 10px', fontSize: 12, color: T.text, background: T.card, outline: 'none', fontFamily: 'inherit', letterSpacing: .5 }}
                    onKeyDown={function (e) { if (e.key === 'Enter') { e.preventDefault(); doLookup(); } }} />
                <button onMouseDown={function (e) { e.preventDefault(); doLookup(); }} onTouchEnd={function (e) { e.preventDefault(); doLookup(); }}
                    disabled={postalLoading}
                    style={{ background: accent, color: '#fff', border: 'none', borderRadius: 7, padding: '7px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, opacity: postalLoading ? 0.6 : 1 }}>
                    {postalLoading ? '…' : '📍 Pin'}
                </button>
            </div>
            {postalError && <div style={{ fontSize: 10, color: '#EF4444', marginTop: 3 }}>{postalError}</div>}
        </div>
    );
}

// ═══════════════════════════ VEHICLES SCREEN ═════════════════════
const VEHICLE_TYPES = ['Semi Truck', 'Box Truck', 'Flatbed', 'Tanker', 'Reefer', 'Dump Truck', 'Pickup/Work Truck', 'Sprinter Van', 'Other'];

// ── North American semi / commercial truck brands & their models ──
const TRUCK_BRANDS = [
    'Freightliner', 'Peterbilt', 'Kenworth', 'Volvo', 'International', 'Mack', 'Western Star', 'Sterling', 'White', 'Ford', 'Ram', 'Chevrolet / GMC', 'Hino', 'Isuzu', 'UD Trucks', 'Fuso', 'Other',
];

const TRUCK_MODELS = {
    'Freightliner': ['Cascadia', 'Classic XL', 'Columbia', 'Century Class', 'Coronado', 'Argosy', 'M2 106', 'M2 112', 'Business Class M2', 'Sprinter', '114SD', '108SD', '122SD'],
    'Peterbilt': ['389', '388', '379', '378', '367', '365', '362', '359', '357', '579', '567', '567 EPIQ', '587', '520', '520 EV', '220', '337', '348', '536'],
    'Kenworth': ['T680', 'T880', 'T660', 'T600', 'T800', 'W900', 'W990', 'C500', 'T170', 'T270', 'T370', 'T470', 'K270', 'K370', 'T680E', 'T680 FCEV'],
    'Volvo': ['VNL 760', 'VNL 780', 'VNL 740', 'VNL 860', 'VNL 400', 'VNL 300', 'VHD', 'VAH', 'VNR 300', 'VNR 400', 'VNX', 'FE', 'FM', 'FH'],
    'International': ['LT Series', 'RH Series', 'HV Series', 'HX Series', 'MV Series', 'CV Series', 'ProStar', 'LoneStar', 'WorkStar', 'DuraStar', 'TransStar', 'PayStar', '9900i', '9200i'],
    'Mack': ['Anthem', 'Pinnacle', 'Granite', 'TerraPro', 'LR Electric', 'MD Series', 'MD6', 'MD7', 'CH', 'CX', 'CL', 'RD', 'DM', 'R Model'],
    'Western Star': ['49X', '4900', '4700', '4800', '5700XE', '6900', '47X', '49XS', 'X Series'],
    'Sterling': ['A-Line', 'L-Line', 'AT9500', 'LT9500', 'Acterra', 'Condor', 'Bullet 45', 'Bullet 55'],
    'White': ['Road Commander', 'Freightliner FLC', 'WIA', 'WCA', 'WCM', '7064T', '3000'],
    'Ford': ['F-650', 'F-750', 'F-550', 'F-450', 'F-350', 'Transit', 'E-Series', 'Super Duty'],
    'Ram': ['ProMaster', '2500', '3500', '4500', '5500', 'Chassis Cab'],
    'Chevrolet / GMC': ['Silverado 3500HD', 'Sierra 3500HD', 'Express', 'Savana', 'Low Cab Forward 4500', 'Low Cab Forward 5500'],
    'Hino': ['155', '195', '258', '268', '338', '500 Series', '700 Series', 'XL8', 'XL11'],
    'Isuzu': ['NQR', 'NPR', 'NRR', 'FTR', 'FVR', 'FXR', 'FRR', 'NPR-HD', 'NPR-XD'],
    'UD Trucks': ['Croner', 'Quon', 'Condor', 'Kuzer'],
    'Fuso': ['Canter', 'Fighter', 'Shogun', 'Rosa', 'FE180', 'FG4X4'],
    'Other': ['Other / Custom'],
};

// Reusable native select styled to match the app
function SelField({ label, value, onChange, options, placeholder, T, required }) {
    const selSt = { border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px', fontSize: 14, color: value ? T.text : T.textSec, background: T.bg, marginBottom: 12, width: '100%', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', appearance: 'none', WebkitAppearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%2364748B' d='M6 8L0 0h12z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 32 };
    return (
        <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.textSec, marginBottom: 4, textTransform: 'uppercase', letterSpacing: .5 }}>{label}{required && <span style={{ color: '#EF4444' }}>*</span>}</div>
            <select value={value} onChange={e => onChange(e.target.value)} style={selSt}>
                <option value="">{placeholder}</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
        </div>
    );
}

// Year range 1990 → current year
const YEAR_OPTIONS = (() => { const y = []; const cur = new Date().getFullYear(); for (let i = cur; i >= 1990; i--)y.push(String(i)); return y; })();

function Vehicles({ vehicles, setVehicles, trailers, setTrailers }) {
    const { T } = useT();
    const [activeTab, setActiveTab] = useState('trucks'); // 'trucks' | 'trailers' | 'companies'
    const blank = { id: null, unit_number: '', make: '', model: '', year: '', vehicle_type: 'Semi Truck', fuel_tank_capacity: '', license_plate: '', driver_name: '', notes: '' };
    const [form, setForm] = useState(blank);
    const [editing, setEditing] = useState(false);
    const [confirmDel, setConfirmDel] = useState(null);
    const [saved, setSaved] = useState(false);
    // Trailer add state
    const [newTrailer, setNewTrailer] = useState('');
    const [trailerSaved, setTrailerSaved] = useState(false);
    const [confirmDelTrailer, setConfirmDelTrailer] = useState(null);
    // Companies state — force re-render since _companyCache is module-level
    const [companiesList, setCompaniesList] = useState(() => getAllCompanies());
    const [companySearch, setCompanySearch] = useState('');
    const [editingCompany, setEditingCompany] = useState(null); // company being edited
    const [companyForm, setCompanyForm] = useState({ name: '', address: '', city: '', postal: '' });
    const [confirmDelCompany, setConfirmDelCompany] = useState(null);
    const sf = (k, v) => { setForm(p => ({ ...p, [k]: v })); setSaved(false); };

    function refreshCompanies() { setCompaniesList(getAllCompanies().slice()); }
    function startEditCompany(c) { setEditingCompany(c.id); setCompanyForm({ name: c.name, address: c.address, city: c.city, postal: c.postal || '' }); }
    function cancelEditCompany() { setEditingCompany(null); setCompanyForm({ name: '', address: '', city: '', postal: '' }); }
    function saveEditCompany() {
        if (!companyForm.name.trim()) { alert('Company name is required.'); return; }
        // Preserve existing lat/lon pinpoint — editing text fields shouldn't wipe a saved precise location
        const existing = companiesList.find(c => c.id === editingCompany);
        updateCompany(editingCompany, companyForm.name, companyForm.address, companyForm.city, companyForm.postal, existing ? existing.lat : null, existing ? existing.lon : null);
        refreshCompanies();
        cancelEditCompany();
    }
    function removeCompany(id) { deleteCompany(id); refreshCompanies(); setConfirmDelCompany(null); }
    const filteredCompanies = companySearch.trim()
        ? companiesList.filter(c => c.name.toLowerCase().includes(companySearch.toLowerCase()) || (c.city || '').toLowerCase().includes(companySearch.toLowerCase()))
        : companiesList;

    // When make changes, reset model so stale model doesn't persist
    function setMake(v) { setForm(p => ({ ...p, make: v, model: '' })); setSaved(false); }

    function startNew() { setForm({ ...blank, id: Date.now() }); setEditing(true); setSaved(false); }
    function startEdit(v) { setForm({ ...v }); setEditing(true); setSaved(false); }
    function cancelEdit() { setForm(blank); setEditing(false); }
    function saveVehicle() {
        if (!form.unit_number.trim()) { alert('Unit Number is required.'); return; }
        if (!form.vehicle_type) { alert('Vehicle Type is required.'); return; }
        setVehicles(vs => {
            const exists = vs.find(v => v.id === form.id);
            return exists ? vs.map(v => v.id === form.id ? { ...form } : v) : [...vs, { ...form, id: form.id || Date.now() }];
        });
        setSaved(true);
        setTimeout(() => { setSaved(false); setEditing(false); setForm(blank); }, 1200);
    }
    function deleteVehicle(id) { setVehicles(vs => vs.filter(v => v.id !== id)); setConfirmDel(null); }

    // Generic text field
    const field = (label, key, placeholder, opts = {}) => (
        <div key={key}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.textSec, marginBottom: 4, textTransform: 'uppercase', letterSpacing: .5 }}>{label}{opts.required && <span style={{ color: '#EF4444' }}>*</span>}</div>
            <input value={form[key] || ''} onChange={e => sf(key, e.target.value)} placeholder={placeholder}
                style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px', fontSize: 14, color: T.text, background: T.bg, marginBottom: 12, width: '100%', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }} />
        </div>
    );

    // Models available for selected make
    const modelOptions = form.make && TRUCK_MODELS[form.make] ? TRUCK_MODELS[form.make] : Object.values(TRUCK_MODELS).flat();

    if (editing) {
        return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.bg, overflow: 'hidden' }}>
                <div style={{ background: T.primary, padding: '20px 20px 16px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={cancelEdit} style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>← Back</button>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{form.id && vehicles.find(v => v.id === form.id) ? 'Edit Vehicle' : 'Add Vehicle'}</div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 16, paddingBottom: 40 }}>
                    <div style={{ background: T.card, borderRadius: 16, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
                        {field('Unit Number', 'unit_number', 'e.g. TRK-001', { required: true })}
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.textSec, marginBottom: 4, textTransform: 'uppercase', letterSpacing: .5 }}>Vehicle Type<span style={{ color: '#EF4444' }}>*</span></div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                            {VEHICLE_TYPES.map(vt => { const a = form.vehicle_type === vt; return <button key={vt} onClick={() => sf('vehicle_type', vt)} style={{ padding: '7px 12px', borderRadius: 20, border: `1px solid ${a ? T.primary : T.border}`, background: a ? T.primary : T.card, color: a ? '#fff' : T.textSec, fontSize: 12, fontWeight: a ? 700 : 400, cursor: 'pointer' }}>{vt}</button>; })}
                        </div>

                        {/* ── Make dropdown ── */}
                        <SelField label="Make / Brand" value={form.make} onChange={setMake} options={TRUCK_BRANDS} placeholder="Select manufacturer…" T={T} />

                        {/* ── Model dropdown — filtered by selected make ── */}
                        <SelField label="Model" value={form.model} onChange={v => sf('model', v)}
                            options={modelOptions}
                            placeholder={form.make ? `Select ${form.make} model…` : 'Select make first…'}
                            T={T} />
                        {/* Allow freeform if model isn't in list */}
                        {form.model === 'Other / Custom' && (
                            <input value={form._customModel || ''} onChange={e => sf('_customModel', e.target.value)}
                                placeholder="Enter model name…"
                                style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px', fontSize: 14, color: T.text, background: T.bg, marginBottom: 12, width: '100%', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }} />
                        )}

                        {/* ── Year dropdown 1990 → present ── */}
                        <SelField label="Year" value={form.year} onChange={v => sf('year', v)} options={YEAR_OPTIONS} placeholder="Select year…" T={T} />

                        {field('License Plate', 'license_plate', 'e.g. ABC 1234')}
                        {field('Fuel Tank Capacity (Gal)', 'fuel_tank_capacity', 'e.g. 200')}
                        {field('Driver Name', 'driver_name', 'Assigned driver')}
                        {field('Notes', 'notes', 'Any additional info')}
                        <button onClick={saveVehicle} style={{ width: '100%', background: T.primary, color: '#fff', border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>💾 Save Vehicle</button>
                        {saved && <div style={{ marginTop: 10, background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#065F46', fontWeight: 600 }}>✅ Vehicle saved!</div>}
                    </div>
                </div>
            </div>
        );
    }
    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.bg, overflow: 'hidden' }}>
            <div style={{ background: T.primary, padding: '20px 20px 16px', flexShrink: 0 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 12 }}>🚛 Fleet</div>
                {/* Tab switcher */}
                <div style={{ display: 'flex', background: 'rgba(255,255,255,.15)', borderRadius: 10, padding: 3, gap: 3 }}>
                    {[['trucks', '🚛 Trucks'], ['trailers', '🚚 Trailers'], ['companies', '🏢 Companies']].map(([k, l]) => (
                        <button key={k} onClick={() => setActiveTab(k)}
                            style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: activeTab === k ? '#fff' : 'transparent', color: activeTab === k ? T.primary : 'rgba(255,255,255,.85)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                            {l}{k === 'trailers' && trailers.length > 0 ? ` (${trailers.length})` : ''}{k === 'companies' && companiesList.length > 0 ? ` (${companiesList.length})` : ''}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── TRUCKS TAB ── */}
            {activeTab === 'trucks' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 100px', position: 'relative' }}>
                    {vehicles.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 20px', color: T.textSec }}>
                            <div style={{ fontSize: 64 }}>🚛</div>
                            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 16, color: T.text }}>No Vehicles Yet</div>
                            <div style={{ fontSize: 14, marginTop: 8 }}>Add your first truck to get started</div>
                            <button onClick={startNew} style={{ marginTop: 24, background: T.primary, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>+ Add Vehicle</button>
                        </div>
                    ) : vehicles.map(v => (
                        <div key={v.id} style={{ background: T.card, borderRadius: 16, marginBottom: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.07)' }}>
                            {confirmDel === v.id ? (
                                <div style={{ background: '#FEF2F2', padding: '14px 16px' }}>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: '#DC2626', marginBottom: 8 }}>🗑️ Delete {v.unit_number}?</div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button onClick={() => deleteVehicle(v.id)} style={{ flex: 1, background: '#DC2626', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Yes, Delete</button>
                                        <button onClick={() => setConfirmDel(null)} style={{ flex: 1, background: T.border, color: T.text, border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div style={{ background: T.primary, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>Unit: {v.unit_number}</div>
                                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.8)', marginTop: 2 }}>{v.vehicle_type}</div>
                                        </div>
                                        <div style={{ background: 'rgba(255,255,255,.2)', borderRadius: 8, padding: '4px 10px', fontSize: 12, color: '#fff', fontWeight: 600 }}>{v.year || '—'}</div>
                                    </div>
                                    <div style={{ padding: '12px 16px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                                            {v.make && <div><span style={{ color: T.textSec }}>Make: </span><span style={{ fontWeight: 600, color: T.text }}>{v.make}</span></div>}
                                            {v.model && <div><span style={{ color: T.textSec }}>Model: </span><span style={{ fontWeight: 600, color: T.text }}>{v.model}</span></div>}
                                            {v.license_plate && <div><span style={{ color: T.textSec }}>Plate: </span><span style={{ fontWeight: 600, color: T.text }}>{v.license_plate}</span></div>}
                                            {v.fuel_tank_capacity && <div><span style={{ color: T.textSec }}>Tank: </span><span style={{ fontWeight: 600, color: T.text }}>{v.fuel_tank_capacity} gal</span></div>}
                                            {v.driver_name && <div style={{ gridColumn: '1/-1' }}><span style={{ color: T.textSec }}>Driver: </span><span style={{ fontWeight: 600, color: T.text }}>{v.driver_name}</span></div>}
                                        </div>
                                        {v.notes && <div style={{ fontSize: 12, color: T.textSec, marginTop: 8, fontStyle: 'italic' }}>{v.notes}</div>}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, padding: '0 16px 12px', borderTop: `1px solid ${T.border}` }}>
                                        <button onClick={() => startEdit(v)} style={{ background: 'none', border: 'none', color: T.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer', paddingTop: 10 }}>✏️ Edit</button>
                                        <button onClick={() => setConfirmDel(v.id)} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: 'pointer', paddingTop: 10 }}>🗑️ Delete</button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                    {vehicles.length > 0 && (
                        <button onClick={startNew} style={{ position: 'fixed', right: 20, bottom: 76, width: 56, height: 56, borderRadius: 28, background: T.primary, border: 'none', color: '#fff', fontSize: 28, cursor: 'pointer', boxShadow: `0 4px 16px ${T.primary}88`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>+</button>
                    )}
                </div>
            )}

            {/* ── TRAILERS TAB ── */}
            {activeTab === 'trailers' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 100px' }}>
                    {/* Add trailer input */}
                    <div style={{ background: T.card, borderRadius: 16, padding: 16, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.textSec, marginBottom: 8, textTransform: 'uppercase', letterSpacing: .5 }}>Add Trailer Unit</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input
                                value={newTrailer}
                                onChange={e => setNewTrailer(e.target.value.toUpperCase())}
                                placeholder="e.g. TRL-042"
                                style={{ flex: 1, border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px', fontSize: 15, color: T.text, background: T.bg, outline: 'none', fontFamily: 'inherit' }}
                                onKeyDown={e => { if (e.key === 'Enter') addTrailer(); }}
                            />
                            <button onClick={addTrailer}
                                style={{ background: T.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                                + Add
                            </button>
                        </div>
                        {trailerSaved && (
                            <div style={{ marginTop: 8, fontSize: 12, color: '#059669', fontWeight: 600 }}>✅ Trailer saved!</div>
                        )}
                    </div>

                    {/* Trailer list */}
                    {trailers.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: T.textSec }}>
                            <div style={{ fontSize: 56 }}>🚚</div>
                            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 12, color: T.text }}>No Trailers Yet</div>
                            <div style={{ fontSize: 13, marginTop: 6 }}>Trailers are auto-saved when you create trips, or add them manually above.</div>
                        </div>
                    ) : [...trailers].sort((a, b) => a.unit_number.localeCompare(b.unit_number)).map(tr => (
                        <div key={tr.id} style={{ background: T.card, borderRadius: 12, marginBottom: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
                            {confirmDelTrailer === tr.id ? (
                                <div style={{ background: '#FEF2F2', padding: '12px 14px' }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#DC2626', marginBottom: 8 }}>🗑️ Delete {tr.unit_number}?</div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button onClick={() => { setTrailers(ts => ts.filter(t => t.id !== tr.id)); setConfirmDelTrailer(null); }} style={{ flex: 1, background: '#DC2626', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
                                        <button onClick={() => setConfirmDelTrailer(null)} style={{ flex: 1, background: T.border, color: T.text, border: 'none', borderRadius: 7, padding: '8px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px' }}>
                                    <span style={{ fontSize: 20, marginRight: 12 }}>🚚</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{tr.unit_number}</div>
                                    </div>
                                    <button onClick={() => setConfirmDelTrailer(tr.id)} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>🗑️</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ── COMPANIES TAB — shared shipper/receiver database ── */}
            {activeTab === 'companies' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 100px' }}>
                    <div style={{ fontSize: 11, color: T.textSec, marginBottom: 12, lineHeight: 1.5, background: T.card, borderRadius: 10, padding: '10px 12px' }}>
                        💡 Companies are saved automatically after you create a trip with a Shipper/Receiver. One shared list — pick the same company for either role since backhauls often repeat.
                    </div>
                    <input value={companySearch} onChange={e => setCompanySearch(e.target.value)} placeholder="🔍 Search companies…"
                        style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 14, color: T.text, background: T.card, outline: 'none', fontFamily: 'inherit', marginBottom: 14 }} />

                    {filteredCompanies.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: T.textSec }}>
                            <div style={{ fontSize: 56 }}>🏢</div>
                            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 12, color: T.text }}>{companiesList.length === 0 ? 'No Companies Yet' : 'No Results'}</div>
                            <div style={{ fontSize: 13, marginTop: 6 }}>{companiesList.length === 0 ? 'Add a Shipper or Receiver when creating a trip — they\'ll appear here automatically.' : 'Try a different search'}</div>
                        </div>
                    ) : filteredCompanies.map(c => (
                        <div key={c.id} style={{ background: T.card, borderRadius: 12, marginBottom: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
                            {confirmDelCompany === c.id ? (
                                <div style={{ background: '#FEF2F2', padding: '12px 14px' }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#DC2626', marginBottom: 8 }}>🗑️ Delete {c.name}?</div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button onClick={() => removeCompany(c.id)} style={{ flex: 1, background: '#DC2626', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
                                        <button onClick={() => setConfirmDelCompany(null)} style={{ flex: 1, background: T.border, color: T.text, border: 'none', borderRadius: 7, padding: '8px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                    </div>
                                </div>
                            ) : editingCompany === c.id ? (
                                <div style={{ padding: '14px' }}>
                                    <div style={{ fontSize: 10, color: T.textSec, marginBottom: 3 }}>Company Name</div>
                                    <input value={companyForm.name} onChange={e => setCompanyForm(p => ({ ...p, name: e.target.value }))}
                                        style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${T.border}`, borderRadius: 7, padding: '8px 10px', fontSize: 13, color: T.text, background: T.bg, outline: 'none', fontFamily: 'inherit', marginBottom: 8 }} />
                                    <div style={{ fontSize: 10, color: T.textSec, marginBottom: 3 }}>Address</div>
                                    <input value={companyForm.address} onChange={e => setCompanyForm(p => ({ ...p, address: e.target.value }))}
                                        placeholder="e.g. 123 Main St"
                                        style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${T.border}`, borderRadius: 7, padding: '8px 10px', fontSize: 13, color: T.text, background: T.bg, outline: 'none', fontFamily: 'inherit', marginBottom: 8 }} />
                                    <div style={{ fontSize: 10, color: T.textSec, marginBottom: 3 }}>City</div>
                                    <input value={companyForm.city} onChange={e => setCompanyForm(p => ({ ...p, city: e.target.value }))}
                                        placeholder="e.g. Richmond Hill, ON"
                                        style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${T.border}`, borderRadius: 7, padding: '8px 10px', fontSize: 13, color: T.text, background: T.bg, outline: 'none', fontFamily: 'inherit', marginBottom: 8 }} />
                                    <div style={{ fontSize: 10, color: T.textSec, marginBottom: 3 }}>Postal/ZIP</div>
                                    <input value={companyForm.postal} onChange={e => setCompanyForm(p => ({ ...p, postal: e.target.value.toUpperCase() }))}
                                        placeholder="e.g. L4B 1B4 or 90001"
                                        style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${T.border}`, borderRadius: 7, padding: '8px 10px', fontSize: 13, color: T.text, background: T.bg, outline: 'none', fontFamily: 'inherit', marginBottom: 6 }} />
                                    {(() => {
                                        const ex = companiesList.find(cc => cc.id === c.id); return ex && ex.lat ? (
                                            <div style={{ fontSize: 10, color: '#059669', marginBottom: 8 }}>📍 Precise pinpoint saved — editing text above won't affect it. To update coordinates, re-select this company from a trip's Shipper/Receiver field using the postal Pin button.</div>
                                        ) : null;
                                    })()}
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button onClick={saveEditCompany} style={{ flex: 1, background: T.primary, color: '#fff', border: 'none', borderRadius: 7, padding: '9px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>💾 Save</button>
                                        <button onClick={cancelEditCompany} style={{ flex: 1, background: T.bg, color: T.textSec, border: `1px solid ${T.border}`, borderRadius: 7, padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px' }}>
                                    <span style={{ fontSize: 20, marginRight: 12 }}>🏢</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{c.name}</div>
                                        {c.address && <div style={{ fontSize: 12, color: T.textSec, marginTop: 1 }}>{c.address}</div>}
                                        {c.city && <div style={{ fontSize: 12, color: T.textSec }}>{c.city}</div>}
                                        {(c.postal || c.lat) && (
                                            <div style={{ fontSize: 11, color: '#059669', marginTop: 2, fontWeight: 600 }}>
                                                {c.postal ? '📮 ' + c.postal : ''}{c.postal && c.lat ? ' · ' : ''}{c.lat ? '📍 Pinpointed' : ''}
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={() => startEditCompany(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 6, color: T.accent }}>✏️</button>
                                    <button onClick={() => setConfirmDelCompany(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 6, color: '#EF4444' }}>🗑️</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    function addTrailer() {
        const num = newTrailer.trim().toUpperCase();
        if (!num) return;
        const exists = trailers.some(t => t.unit_number.toUpperCase() === num);
        if (exists) { alert(`Trailer ${num} already exists.`); return; }
        setTrailers(ts => [...ts, { id: Date.now(), unit_number: num }]);
        setNewTrailer('');
        setTrailerSaved(true);
        setTimeout(() => setTrailerSaved(false), 2000);
    }
}

// ═══════════════════════════ BORDER CROSSINGS ════════════════════
// All major USA-Canada border crossings with exact coordinates
const BORDER_CROSSINGS = [
    // ONTARIO ↔ MICHIGAN
    { id: 'amb', name: 'Ambassador Bridge', ca: 'Windsor, ON', us: 'Detroit, MI', caLat: 42.3149, caLon: -83.0728, usLat: 42.3236, usLon: -83.0603, region: 'ON-MI' },
    { id: 'det', name: 'Detroit-Windsor Tunnel', ca: 'Windsor, ON', us: 'Detroit, MI', caLat: 42.3201, caLon: -83.0431, usLat: 42.3270, usLon: -83.0402, region: 'ON-MI' },
    { id: 'blue', name: 'Blue Water Bridge', ca: 'Sarnia, ON', us: 'Port Huron, MI', caLat: 42.9745, caLon: -82.4066, usLat: 43.0016, usLon: -82.4249, region: 'ON-MI' },
    // ONTARIO ↔ NEW YORK
    { id: 'peace', name: 'Peace Bridge', ca: 'Fort Erie, ON', us: 'Buffalo, NY', caLat: 42.9001, caLon: -79.0493, usLat: 42.8895, usLon: -78.8784, region: 'ON-NY' },
    { id: 'rain', name: 'Rainbow Bridge', ca: 'Niagara Falls, ON', us: 'Niagara Falls, NY', caLat: 43.0895, caLon: -79.0695, usLat: 43.0879, usLon: -79.0621, region: 'ON-NY' },
    { id: 'lewis', name: 'Lewiston-Queenston Bridge', ca: 'Queenston, ON', us: 'Lewiston, NY', caLat: 43.1662, caLon: -79.0494, usLat: 43.1726, usLon: -79.0437, region: 'ON-NY' },
    { id: 'thou', name: 'Thousand Islands Bridge', ca: 'Lansdowne, ON', us: 'Alexandria Bay, NY', caLat: 44.3728, caLon: -75.9704, usLat: 44.3424, usLon: -75.9241, region: 'ON-NY' },
    { id: 'corn', name: 'Cornwall-Massena Bridge', ca: 'Cornwall, ON', us: 'Massena, NY', caLat: 45.0275, caLon: -74.7267, usLat: 44.9278, usLon: -74.8918, region: 'ON-NY' },
    { id: 'hills', name: 'Hill Island Bridge (Thousand Islands)', ca: 'Hill Island, ON', us: 'Collins Landing, NY', caLat: 44.3833, caLon: -76.0167, usLat: 44.3500, usLon: -76.0000, region: 'ON-NY' },
    // ONTARIO ↔ MINNESOTA / NORTH DAKOTA
    { id: 'int', name: 'International Falls Bridge', ca: 'Fort Frances, ON', us: 'International Falls, MN', caLat: 48.6084, caLon: -93.4001, usLat: 48.5946, usLon: -93.4099, region: 'ON-MN' },
    // BRITISH COLUMBIA ↔ WASHINGTON / IDAHO
    { id: 'pcb', name: 'Pacific Highway (BC-WA)', ca: 'Surrey, BC', us: 'Blaine, WA', caLat: 49.0021, caLon: -122.7518, usLat: 48.9940, usLon: -122.7526, region: 'BC-WA' },
    { id: 'dpbc', name: 'Douglas/Peace Arch (BC-WA)', ca: 'Surrey, BC', us: 'Blaine, WA', caLat: 49.0022, caLon: -122.7566, usLat: 48.9988, usLon: -122.7570, region: 'BC-WA' },
    { id: 'osoy', name: 'Osoyoos/Oroville (BC-WA)', ca: 'Osoyoos, BC', us: 'Oroville, WA', caLat: 49.0001, caLon: -119.4431, usLat: 48.9353, usLon: -119.4332, region: 'BC-WA' },
    { id: 'kootn', name: 'Kingsgate/Eastport (BC-ID)', ca: 'Creston, BC', us: 'Eastport, ID', caLat: 49.0000, caLon: -116.1667, usLat: 48.9940, usLon: -116.1823, region: 'BC-ID' },
    // ALBERTA ↔ MONTANA
    { id: 'coots', name: 'Coutts/Sweetgrass (AB-MT)', ca: 'Coutts, AB', us: 'Sweetgrass, MT', caLat: 49.0000, caLon: -111.9667, usLat: 48.9972, usLon: -111.9659, region: 'AB-MT' },
    { id: 'carw', name: 'Carway/Piegan (AB-MT)', ca: 'Carway, AB', us: 'Piegan, MT', caLat: 49.0000, caLon: -113.3667, usLat: 48.9972, usLon: -113.3640, region: 'AB-MT' },
    // SASKATCHEWAN ↔ NORTH DAKOTA / MONTANA
    { id: 'nport', name: 'North Portal/Portal (SK-ND)', ca: 'North Portal, SK', us: 'Portal, ND', caLat: 49.0000, caLon: -102.5500, usLat: 48.9972, usLon: -102.5524, region: 'SK-ND' },
    { id: 'wgate', name: 'Willowcreek/Westgate (SK-MT)', ca: 'Val Marie, SK', us: 'Morgan, MT', caLat: 49.0000, caLon: -107.9667, usLat: 48.9972, usLon: -107.9627, region: 'SK-MT' },
    // MANITOBA ↔ NORTH DAKOTA / MINNESOTA
    { id: 'emers', name: 'Emerson/Pembina (MB-ND)', ca: 'Emerson, MB', us: 'Pembina, ND', caLat: 49.0000, caLon: -97.2167, usLat: 48.9659, usLon: -97.2413, region: 'MB-ND' },
    { id: 'piney', name: 'Piney/Milltown (MB-MN)', ca: 'Piney, MB', us: 'Milltown, MN', caLat: 49.0000, caLon: -95.8500, usLat: 48.9972, usLon: -95.8482, region: 'MB-MN' },
    // QUEBEC ↔ NEW YORK / VERMONT / NEW HAMPSHIRE
    { id: 'champ', name: 'Champlain/Rouses Point (QC-NY)', ca: 'Lacolle, QC', us: 'Rouses Point, NY', caLat: 45.0833, caLon: -73.4333, usLat: 44.9956, usLon: -73.3641, region: 'QC-NY' },
    { id: 'lacolle', name: 'Lacolle/Champlain (QC-NY)', ca: 'Lacolle, QC', us: 'Champlain, NY', caLat: 45.0883, caLon: -73.3750, usLat: 44.9883, usLon: -73.4390, region: 'QC-NY' },
    { id: 'rock', name: 'Rockburn/Coventry (QC-NY)', ca: 'Rockburn, QC', us: 'Coventry, NY', caLat: 45.0500, caLon: -74.1000, usLat: 44.9800, usLon: -74.1500, region: 'QC-NY' },
    { id: 'starm', name: 'St-Armand/Philipsburg (QC-VT)', ca: 'St-Armand, QC', us: 'Philipsburg, VT', caLat: 45.0167, caLon: -73.0667, usLat: 44.9800, usLon: -73.0700, region: 'QC-VT' },
    { id: 'dtroit', name: 'Dundee/Derby Line (QC-VT)', ca: 'Dundee, QC', us: 'Derby Line, VT', caLat: 45.0028, caLon: -72.0972, usLat: 44.9972, usLon: -72.1000, region: 'QC-VT' },
    // NEW BRUNSWICK ↔ MAINE
    { id: 'woofl', name: 'Woodstock/Houlton (NB-ME)', ca: 'Woodstock, NB', us: 'Houlton, ME', caLat: 46.1500, caLon: -67.5600, usLat: 46.1303, usLon: -67.8436, region: 'NB-ME' },
    { id: 'stst', name: 'St. Stephen/Calais (NB-ME)', ca: 'St. Stephen, NB', us: 'Calais, ME', caLat: 45.2000, caLon: -67.2833, usLat: 45.1856, usLon: -67.2794, region: 'NB-ME' },
    { id: 'edmain', name: 'Edmundston/Madawaska (NB-ME)', ca: 'Edmundston, NB', us: 'Madawaska, ME', caLat: 47.3668, caLon: -68.3251, usLat: 47.3561, usLon: -68.3333, region: 'NB-ME' },
    // NOVA SCOTIA (ferry — not a road crossing, skip)
];

// Detect if a trip crosses the USA-Canada border
// Returns true if one city is in Canada and the other in USA
const CA_PROV_SET = new Set(['ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE', 'NT', 'NU', 'YT']);
const US_STATE_SET = new Set(['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC']);

function detectCountry(label) {
    if (!label) return null;
    const parts = label.split(',');
    const code = (parts[parts.length - 1] || '').trim().toUpperCase();
    // Handle "City, Province, Canada" or "City, State, USA"
    const code2 = (parts[parts.length - 2] || '').trim().toUpperCase();
    if (CA_PROV_SET.has(code) || code === 'CANADA' || CA_PROV_SET.has(code2)) return 'CA';
    if (US_STATE_SET.has(code) || code === 'USA' || US_STATE_SET.has(code2)) return 'US';
    // Try to infer from province in second-to-last slot
    return null;
}

function isCrossBorder(originLabel, destLabel) {
    const oC = detectCountry(originLabel);
    const dC = detectCountry(destLabel);
    if (!oC || !dC) return false;
    return oC !== dC;
}
function AddTripModal({ visible, onClose, onSave, editTrip, T, vehicles, trips }) {
    const { useKm } = useT();
    const blank = { trip_number: '', trailer_number: '', shipper_name: '', shipper_address: '', shipper_postal: '', receiver_name: '', receiver_address: '', receiver_postal: '', origin: '', destination: '', distance: '', pickup_date: '', delivery_date: '', notes: '', status: 'Scheduled', trip_rate: '', rate_type: 'per_mile', currency: 'CAD', vehicle_id: '', deadhead_name: '', deadhead_address: '', deadhead_postal: '', deadhead_from: '', deadhead_distance: '' };
    const [f, setF] = useState(blank);
    const [oC, setOC] = useState(null);
    const [dC, setDC] = useState(null);
    const [dhC, setDhC] = useState(null); // coords for deadhead "from" point
    const [showDeadhead, setShowDeadhead] = useState(false);
    const [dhDistCalced, setDhDistCalced] = useState(false);
    const [gps, setGps] = useState(false);
    const [distCalced, setDistCalced] = useState(false);
    const [distLoading, setDistLoading] = useState(false);
    const [dupWarning, setDupWarning] = useState(false);
    const [selectedBorder, setSelectedBorder] = useState(null);
    const [borderSearch, setBorderSearch] = useState('');

    // Auto-generate next trip number
    function nextTripNumber(existingTrips) {
        const nums = existingTrips.map(t => { const m = (t.trip_number || '').match(/(\d+)$/); return m ? parseInt(m[1], 10) : 0; });
        const max = nums.length ? Math.max(...nums) : 0;
        return `TRP-${String(max + 1).padStart(3, '0')}`;
    }

    useEffect(() => {
        if (!visible) return;
        if (editTrip) {
            setF({ trip_number: editTrip.trip_number || '', trailer_number: editTrip.trailer_number || '', shipper_name: editTrip.shipper_name || '', shipper_address: editTrip.shipper_address || '', shipper_postal: editTrip.shipper_postal || '', receiver_name: editTrip.receiver_name || '', receiver_address: editTrip.receiver_address || '', receiver_postal: editTrip.receiver_postal || '', origin: editTrip.origin || '', destination: editTrip.destination || '', distance: String(editTrip.distance || ''), pickup_date: editTrip.pickup_date || editTrip.trip_date || '', delivery_date: editTrip.delivery_date || '', notes: editTrip.notes || '', status: editTrip.status || 'In Progress', trip_rate: String(editTrip.trip_rate || ''), rate_type: editTrip.rate_type || 'per_mile', currency: editTrip.currency || 'CAD', vehicle_id: editTrip.vehicle_id || '', deadhead_name: editTrip.deadhead_name || '', deadhead_address: editTrip.deadhead_address || '', deadhead_postal: editTrip.deadhead_postal || '', deadhead_from: editTrip.deadhead_from || '', deadhead_distance: String(editTrip.deadhead_distance || '') });
            setOC(editTrip.origin_lat ? { lat: editTrip.origin_lat, lon: editTrip.origin_lon } : null);
            setDC(editTrip.dest_lat ? { lat: editTrip.dest_lat, lon: editTrip.dest_lon } : null);
            setDhC(editTrip.dh_lat ? { lat: editTrip.dh_lat, lon: editTrip.dh_lon } : null);
            setShowDeadhead(!!(editTrip.deadhead_from && editTrip.deadhead_from.trim()));
            setDhDistCalced(!!editTrip.deadhead_distance);
            setDistCalced(false); setDupWarning(false); setSelectedBorder(null); setBorderSearch('');
        } else {
            const auto = nextTripNumber(trips || []);
            setF({ ...blank, trip_number: auto });
            setOC(null); setDC(null); setDhC(null); setShowDeadhead(false); setDhDistCalced(false); setDistCalced(false); setDupWarning(false); setSelectedBorder(null); setBorderSearch('');
        }
    }, [visible, editTrip]);

    const s = (k, v) => {
        setF(p => ({ ...p, [k]: v }));
        if (k === 'trip_number') {
            const dup = (trips || []).some(t =>
                t.trip_number &&
                t.trip_number.trim().toLowerCase() === v.trim().toLowerCase() &&
                (!editTrip || t.id !== editTrip.id)
            );
            setDupWarning(dup);
        }
    };

    function computeDriving(oCoord, dCoord, border) {
        const brd = border || selectedBorder;
        if (brd && oCoord && dCoord) {
            // Determine which side of border to use based on origin country
            const oCountry = detectCountry(f.origin) || 'CA';
            const borderLat = oCountry === 'CA' ? brd.caLat : brd.usLat;
            const borderLon = oCountry === 'CA' ? brd.caLon : brd.usLon;
            const borderLat2 = oCountry === 'CA' ? brd.usLat : brd.caLat;
            const borderLon2 = oCountry === 'CA' ? brd.usLon : brd.caLon;
            const r1 = calcDrivingDist(oCoord.lat, oCoord.lon, borderLat, borderLon);
            const r2 = calcDrivingDist(borderLat2, borderLon2, dCoord.lat, dCoord.lon);
            const totalMiles = parseFloat((r1.miles + r2.miles).toFixed(1));
            const totalKm = parseFloat((totalMiles * 1.60934).toFixed(1));
            s('distance', String(totalMiles));
            setDistCalced({
                miles: totalMiles, km: totalKm, source: 'border',
                seg1: `${r1.miles.toFixed(1)} mi origin→border`,
                seg2: `${r2.miles.toFixed(1)} mi border→dest`
            });
        } else if (oCoord && dCoord) {
            const result = calcDrivingDist(oCoord.lat, oCoord.lon, dCoord.lat, dCoord.lon);
            s('distance', result.miles.toFixed(1));
            setDistCalced({ miles: result.miles, km: result.km, source: 'estimate' });
        }
        setDistLoading(false);
    }

    // Calculates the deadhead leg: from last drop-off point → this trip's origin
    function computeDeadheadDist(dhCoord, originCoord) {
        if (!dhCoord || !originCoord) { setDhDistCalced(false); return; }
        const result = calcDrivingDist(dhCoord.lat, dhCoord.lon, originCoord.lat, originCoord.lon);
        s('deadhead_distance', result.miles.toFixed(1));
        setDhDistCalced({ miles: result.miles, km: result.km });
    }

    const onOS = c => { setOC(c); if (dC) computeDriving(c, dC, selectedBorder); if (dhC) computeDeadheadDist(dhC, c); };
    const onDS = c => { setDC(c); if (oC) computeDriving(oC, c, selectedBorder); };

    const distNum = parseFloat(f.distance) || 0;
    const rateNum = parseFloat(f.trip_rate) || 0;
    const earnings = f.rate_type === 'per_mile' ? (rateNum * distNum) : rateNum;
    const perMileEarned = f.rate_type === 'total' && distNum > 0 ? (rateNum / distNum).toFixed(3) : null;

    function gpsGet(field) {
        setGps(true);
        if (!navigator.geolocation) { setGps(false); return; }
        navigator.geolocation.getCurrentPosition(pos => {
            setGps(false);
            const co = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            const label = `${co.lat.toFixed(4)}, ${co.lon.toFixed(4)}`;
            if (field === 'origin') { s('origin', label); setOC({ ...co, display: label }); if (dC) computeDriving({ ...co }, dC, selectedBorder); }
            else { s('destination', label); setDC({ ...co, display: label }); if (oC) computeDriving(oC, { ...co }, selectedBorder); }
        }, () => setGps(false));
    }

    function save() {
        if (!f.vehicle_id) { alert('Please select a vehicle/truck for this trip.'); return; }
        if (!f.trip_number.trim()) { alert('Please enter a Trip Number.'); return; }
        if (dupWarning) { alert(`Trip number "${f.trip_number}" already exists. Please use a unique number.`); return; }
        if (!f.origin || !f.destination || !f.pickup_date) { alert('Please fill Origin, Destination, and Pickup Date.'); return; }
        const selectedVehicle = vehicles.find(v => String(v.id) === String(f.vehicle_id));
        onSave({
            trip_number: f.trip_number.trim(), trailer_number: f.trailer_number.trim(), shipper_name: f.shipper_name.trim(), shipper_address: f.shipper_address.trim(), shipper_postal: f.shipper_postal.trim(), receiver_name: f.receiver_name.trim(), receiver_address: f.receiver_address.trim(), receiver_postal: f.receiver_postal.trim(), origin: f.origin, destination: f.destination, distance: parseFloat(f.distance) || 0, pickup_date: f.pickup_date, delivery_date: f.delivery_date, trip_date: f.pickup_date, notes: f.notes, status: f.status, trip_rate: parseFloat(f.trip_rate) || 0, rate_type: f.rate_type, currency: f.currency, vehicle_id: f.vehicle_id, vehicle_label: selectedVehicle ? `${selectedVehicle.unit_number} — ${selectedVehicle.vehicle_type}` : '', origin_lat: oC?.lat || null, origin_lon: oC?.lon || null, dest_lat: dC?.lat || null, dest_lon: dC?.lon || null,
            deadhead_name: showDeadhead ? f.deadhead_name.trim() : '', deadhead_address: showDeadhead ? f.deadhead_address.trim() : '', deadhead_postal: showDeadhead ? f.deadhead_postal.trim() : '', deadhead_from: showDeadhead ? f.deadhead_from.trim() : '', deadhead_distance: showDeadhead ? (parseFloat(f.deadhead_distance) || 0) : 0, dh_lat: showDeadhead ? (dhC?.lat || null) : null, dh_lon: showDeadhead ? (dhC?.lon || null) : null,
            border_crossing: selectedBorder ? selectedBorder.name : null
        });
        // Save companies to the shared database AFTER trip is created —
        // shipper gets the origin city, receiver gets the destination city
        if (f.shipper_name.trim()) saveCompany(f.shipper_name, f.shipper_address, f.origin, f.shipper_postal, oC?.lat, oC?.lon);
        if (f.receiver_name.trim()) saveCompany(f.receiver_name, f.receiver_address, f.destination, f.receiver_postal, dC?.lat, dC?.lon);
        if (showDeadhead && f.deadhead_name.trim()) saveCompany(f.deadhead_name, f.deadhead_address, f.deadhead_from, f.deadhead_postal, dhC?.lat, dhC?.lon);
    }

    const gpsBtn = (field) => (<button onClick={() => gpsGet(field)} style={{ background: 'none', border: 'none', color: T.accent, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: '0 0 8px', marginTop: -4, fontFamily: 'inherit' }}>{gps ? '⏳' : '📍'} Use GPS Location</button>);

    return (
        <Sheet visible={visible} onClose={onClose} title={editTrip ? 'Edit Trip' : 'New Trip'} T={T}>
            <Lbl c={<span>Select Vehicle <span style={{ color: '#EF4444' }}>*</span></span>} T={T} />
            {vehicles.length === 0 ? (
                <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#DC2626' }}>⚠️ No vehicles added yet</div>
                    <div style={{ fontSize: 12, color: '#7F1D1D', marginTop: 4 }}>Go to the Vehicles tab and add a truck before creating a trip.</div>
                </div>
            ) : (
                <div style={{ marginBottom: 12 }}>
                    {vehicles.map(v => {
                        const sel = String(f.vehicle_id) === String(v.id); return (
                            <div key={v.id} onClick={() => s('vehicle_id', String(v.id))} style={{ border: `2px solid ${sel ? T.primary : T.border}`, borderRadius: 10, padding: '10px 14px', marginBottom: 8, cursor: 'pointer', background: sel ? T.primary + '12' : T.card, display: 'flex', alignItems: 'center', gap: 12, transition: 'all .15s' }}>
                                <div style={{ width: 36, height: 36, borderRadius: 18, background: sel ? T.primary : '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🚛</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: sel ? T.primary : T.text }}>Unit: {v.unit_number}</div>
                                    <div style={{ fontSize: 12, color: T.textSec }}>{v.vehicle_type}{v.make ? ` · ${v.make}` : ''}{v.model ? ` ${v.model}` : ''}</div>
                                    {v.driver_name && <div style={{ fontSize: 11, color: T.textSec }}>Driver: {v.driver_name}</div>}
                                </div>
                                {sel && <span style={{ fontSize: 18, color: T.primary }}>✅</span>}
                            </div>
                        );
                    })}
                    {!f.vehicle_id && <div style={{ fontSize: 12, color: '#EF4444', marginTop: -4, marginBottom: 4 }}>⚠️ Vehicle selection is required</div>}
                </div>
            )}
            {/* ── Trip # and Trailer # side by side ── */}
            <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1.4 }}>
                    <Lbl c={<span>Trip # <span style={{ color: '#EF4444' }}>*</span></span>} T={T} />
                    <input value={f.trip_number} onChange={e => s('trip_number', e.target.value)} placeholder="TRP-001"
                        style={{ ...iSt(T), borderColor: dupWarning ? '#EF4444' : undefined, marginBottom: dupWarning ? 4 : 12 }} />
                </div>
                <div style={{ flex: 1 }}>
                    <Lbl c="Trailer #" T={T} />
                    <input value={f.trailer_number} onChange={e => s('trailer_number', e.target.value)} placeholder="e.g. TRL-042"
                        style={iSt(T)} />
                </div>
            </div>
            {dupWarning && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>⚠️ Trip #{f.trip_number} already exists</span>
                    <button onClick={() => s('trip_number', nextTripNumber(trips || []))} style={{ fontSize: 11, color: T.primary, background: 'none', border: `1px solid ${T.primary}`, borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>Use next →</button>
                </div>
            )}

            {/* ── Optional Deadhead Leg — empty miles before reaching this trip's pickup ── */}
            {!showDeadhead ? (
                <button onClick={() => setShowDeadhead(true)}
                    style={{ width: '100%', background: T.card, border: `1px dashed #94A3B8`, borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#64748B', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span>💨</span> Add deadhead leg (repositioning before this pickup)
                </button>
            ) : (
                <div style={{ background: '#FFF7ED', border: '1px solid #FDBA74', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#C2410C', textTransform: 'uppercase', letterSpacing: .5 }}>💨 Deadhead Leg</div>
                        <button onClick={() => { setShowDeadhead(false); s('deadhead_from', ''); s('deadhead_distance', ''); s('deadhead_name', ''); s('deadhead_address', ''); setDhC(null); setDhDistCalced(false); }}
                            style={{ fontSize: 11, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>✕ Remove</button>
                    </div>
                    <div style={{ fontSize: 11, color: '#9A3412', marginBottom: 8, lineHeight: 1.4 }}>
                        Where you started from before reaching pickup — e.g. your last drop-off customer or yard. Miles here count as empty (no revenue) but still cost fuel.
                    </div>
                    {/* Company/yard name — same shared database as Shipper/Receiver */}
                    <ContactAutoComplete type="deadhead" value={f.deadhead_name} onChange={v => s('deadhead_name', v)}
                        postal={f.deadhead_postal} onPostalChange={v => s('deadhead_postal', v)}
                        onSelectCompany={c => {
                            if (c.postalOnly) {
                                // Precise pinpoint from postal/ZIP lookup
                                const label = c.postalCityName + ', ' + c.postalProvince;
                                s('deadhead_from', label);
                                const coord = { display: label, lat: c.lat, lon: c.lon };
                                setDhC(coord); if (oC) computeDeadheadDist(coord, oC);
                                return;
                            }
                            if (c.address) s('deadhead_address', c.address);
                            if (c.postal) s('deadhead_postal', c.postal);
                            // Prefer exact lat/lon saved on the company (from a prior postal pin) over city-center guess
                            if (c.lat && c.lon) {
                                const label = c.city || c.name;
                                s('deadhead_from', label);
                                const coord = { display: label, lat: c.lat, lon: c.lon };
                                setDhC(coord); if (oC) computeDeadheadDist(coord, oC);
                            } else if (c.city) {
                                s('deadhead_from', c.city);
                                const match = localSearch(c.city)[0];
                                if (match) { const coord = { display: match.label, lat: match.lat, lon: match.lon }; setDhC(coord); if (oC) computeDeadheadDist(coord, oC); }
                            }
                        }}
                        placeholder="Company / yard name" T={T} />
                    <div style={{ marginTop: 8 }} />
                    <input value={f.deadhead_address} onChange={e => s('deadhead_address', e.target.value)} placeholder="Address e.g. 789 Depot Rd"
                        style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #FDBA74', borderRadius: 7, padding: '8px 10px', fontSize: 13, color: T.text, background: T.card, outline: 'none', fontFamily: 'inherit', marginBottom: 8 }} />
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#9A3412', marginBottom: 4, textTransform: 'uppercase', letterSpacing: .4 }}>Starting City</div>
                    <PlacesAuto value={f.deadhead_from} onChange={v => { s('deadhead_from', v); if (!v) { setDhC(null); setDhDistCalced(false); } }}
                        placeholder="Search last drop-off / starting city" T={T}
                        onSelect={c => { setDhC(c); if (oC) computeDeadheadDist(c, oC); }} />
                    {dhDistCalced && f.deadhead_distance ? (
                        <div style={{ background: '#FFEDD5', border: '1px solid #FDBA74', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                            <span style={{ fontSize: 14 }}>💨</span>
                            <div style={{ flex: 1 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#C2410C' }}>{parseFloat(f.deadhead_distance).toFixed(1)} deadhead miles</span>
                                <span style={{ fontSize: 11, color: '#9A3412', marginLeft: 6 }}>({dhDistCalced.km.toFixed(1)} km)</span>
                            </div>
                            <button onClick={() => { setDhDistCalced(false); s('deadhead_distance', ''); }} style={{ background: 'none', border: 'none', color: '#9A3412', cursor: 'pointer', fontSize: 11 }}>Edit</button>
                        </div>
                    ) : f.deadhead_from ? (
                        <input value={f.deadhead_distance} onChange={e => { s('deadhead_distance', e.target.value.replace(/[^0-9.]/g, '')); }}
                            placeholder="Deadhead miles (auto-fills once origin selected)"
                            style={{ ...iSt(T), marginTop: 2, marginBottom: 0, fontSize: 13 }} />
                    ) : null}
                </div>
            )}

            {/* ── Shipper (pickup contact) ── */}
            <div style={{ background: '#EFF6FF', border: `1px solid #BFDBFE`, borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#1E40AF', marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5, display: 'flex', alignItems: 'center', gap: 5 }}>
                    📤 Shipper
                </div>
                <ContactAutoComplete type="shipper" value={f.shipper_name} onChange={v => s('shipper_name', v)}
                    postal={f.shipper_postal} onPostalChange={v => s('shipper_postal', v)}
                    onSelectCompany={c => {
                        if (c.postalOnly) {
                            const label = c.postalCityName + ', ' + c.postalProvince;
                            s('origin', label);
                            onOS({ display: label, lat: c.lat, lon: c.lon });
                            return;
                        }
                        if (c.address) s('shipper_address', c.address);
                        if (c.postal) s('shipper_postal', c.postal);
                        if (c.lat && c.lon) {
                            const label = c.city || c.name;
                            s('origin', label);
                            onOS({ display: label, lat: c.lat, lon: c.lon });
                        } else if (c.city) {
                            s('origin', c.city);
                            const match = localSearch(c.city)[0];
                            if (match) { onOS({ display: match.label, lat: match.lat, lon: match.lon }); }
                        }
                    }}
                    placeholder="Company / contact name" T={T} />
                <div style={{ marginTop: 8 }} />
                <input value={f.shipper_address} onChange={e => s('shipper_address', e.target.value)} placeholder="Address e.g. 123 John Ave"
                    style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #BFDBFE', borderRadius: 7, padding: '8px 10px', fontSize: 13, color: T.text, background: T.card, outline: 'none', fontFamily: 'inherit' }} />
            </div>
            <Lbl c="Origin" T={T} />
            <PlacesAuto value={f.origin} onChange={v => { s('origin', v); if (!v) { setOC(null); setDistCalced(false); } }} placeholder="Search address or city (Canada/USA)" T={T} onSelect={onOS} />
            {gpsBtn('origin')}

            {/* ── Receiver (delivery contact) ── */}
            <div style={{ background: '#FEF2F2', border: `1px solid #FECACA`, borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#DC2626', marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5, display: 'flex', alignItems: 'center', gap: 5 }}>
                    📥 Receiver
                </div>
                <ContactAutoComplete type="receiver" value={f.receiver_name} onChange={v => s('receiver_name', v)}
                    postal={f.receiver_postal} onPostalChange={v => s('receiver_postal', v)}
                    onSelectCompany={c => {
                        if (c.postalOnly) {
                            const label = c.postalCityName + ', ' + c.postalProvince;
                            s('destination', label);
                            onDS({ display: label, lat: c.lat, lon: c.lon });
                            return;
                        }
                        if (c.address) s('receiver_address', c.address);
                        if (c.postal) s('receiver_postal', c.postal);
                        if (c.lat && c.lon) {
                            const label = c.city || c.name;
                            s('destination', label);
                            onDS({ display: label, lat: c.lat, lon: c.lon });
                        } else if (c.city) {
                            s('destination', c.city);
                            const match = localSearch(c.city)[0];
                            if (match) { onDS({ display: match.label, lat: match.lat, lon: match.lon }); }
                        }
                    }}
                    placeholder="Company / contact name" T={T} />
                <div style={{ marginTop: 8 }} />
                <input value={f.receiver_address} onChange={e => s('receiver_address', e.target.value)} placeholder="Address e.g. 456 Main St"
                    style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #FECACA', borderRadius: 7, padding: '8px 10px', fontSize: 13, color: T.text, background: T.card, outline: 'none', fontFamily: 'inherit' }} />
            </div>
            <Lbl c="Destination" T={T} />
            <PlacesAuto value={f.destination} onChange={v => { s('destination', v); if (!v) { setDC(null); setDistCalced(false); setSelectedBorder(null); } }} placeholder="Search address or city (Canada/USA)" T={T} onSelect={onDS} />
            {gpsBtn('destination')}

            {/* ── Border Crossing — auto-shown when cross-border trip detected ── */}
            {oC && dC && isCrossBorder(f.origin, f.destination) && (
                <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: .5 }}>🛃 Border Crossing</div>
                        {selectedBorder && <button onClick={() => { setSelectedBorder(null); if (oC && dC) computeDriving(oC, dC, null); }} style={{ fontSize: 11, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>✕ Clear</button>}
                    </div>
                    {selectedBorder ? (
                        <div style={{ background: '#F5F3FF', border: '2px solid #7C3AED', borderRadius: 10, padding: '10px 14px' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#5B21B6' }}>{selectedBorder.name}</div>
                            <div style={{ fontSize: 11, color: '#7C3AED', marginTop: 2 }}>{selectedBorder.ca} ↔ {selectedBorder.us}</div>
                        </div>
                    ) : (
                        <div>
                            <input
                                value={borderSearch}
                                onChange={e => setBorderSearch(e.target.value)}
                                placeholder="Search border crossing…"
                                style={{ ...iSt(T), marginBottom: 6 }} />
                            <div style={{ maxHeight: 180, overflowY: 'auto', border: `1px solid ${T.border}`, borderRadius: 10, background: T.card }}>
                                {BORDER_CROSSINGS.filter(b =>
                                    !borderSearch ||
                                    b.name.toLowerCase().includes(borderSearch.toLowerCase()) ||
                                    b.ca.toLowerCase().includes(borderSearch.toLowerCase()) ||
                                    b.us.toLowerCase().includes(borderSearch.toLowerCase()) ||
                                    b.region.toLowerCase().includes(borderSearch.toLowerCase())
                                ).map(b => (
                                    <div key={b.id}
                                        onClick={() => { setSelectedBorder(b); setBorderSearch(''); if (oC && dC) computeDriving(oC, dC, b); }}
                                        style={{ padding: '10px 14px', borderBottom: `1px solid ${T.border}`, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2 }}
                                        onTouchStart={e => e.currentTarget.style.background = T.bg}
                                        onTouchEnd={e => { e.currentTarget.style.background = T.card; }}
                                        onMouseEnter={e => e.currentTarget.style.background = T.bg}
                                        onMouseLeave={e => e.currentTarget.style.background = T.card}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>🛃 {b.name}</div>
                                        <div style={{ fontSize: 11, color: T.textSec }}>{b.ca} ↔ {b.us} · {b.region}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ fontSize: 10, color: T.textSec, marginTop: 4 }}>Cross-border trip detected · select your border crossing</div>
                        </div>
                    )}
                </div>
            )}

            <Lbl c="Distance" T={T} />
            {distCalced && f.distance ? (
                <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: distCalced.source === 'border' ? 6 : 0 }}>
                        <span style={{ fontSize: 16 }}>🛣️</span>
                        <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: '#059669' }}>{parseFloat(f.distance).toFixed(1)} miles</span>
                            <span style={{ fontSize: 12, color: '#555', marginLeft: 8 }}>({distCalced.km.toFixed(1)} km)</span>
                        </div>
                        <button onClick={() => { setDistCalced(false); s('distance', ''); }} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap' }}>Edit</button>
                    </div>
                    {distCalced.source === 'border' && selectedBorder && (
                        <div style={{ fontSize: 11, color: '#065F46', background: 'rgba(0,0,0,.04)', borderRadius: 6, padding: '6px 8px' }}>
                            <div>📍 {distCalced.seg1} · via {selectedBorder.name}</div>
                            <div style={{ marginTop: 2 }}>📍 {distCalced.seg2}</div>
                        </div>
                    )}
                    {distCalced.source !== 'border' && <div style={{ fontSize: 11, color: '#065F46' }}>📐 Estimated driving distance</div>}
                </div>
            ) : (
                <input value={f.distance} onChange={e => { s('distance', e.target.value.replace(/[^0-9.]/g, '')); setDistCalced(false); }} placeholder="Auto-fills when both cities selected" style={iSt(T)} />
            )}

            {/* ── Pickup & Delivery dates side by side ── */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 0 }}>
                <div style={{ flex: 1 }}>
                    <Lbl c={<span>📅 Pickup Date <span style={{ color: '#EF4444' }}>*</span></span>} T={T} />
                    <input type="date" value={f.pickup_date} onChange={e => s('pickup_date', e.target.value)} style={{ ...iSt(T), fontSize: 13 }} />
                </div>
                <div style={{ flex: 1 }}>
                    <Lbl c="🏁 Delivery Date" T={T} />
                    <input type="date" value={f.delivery_date} onChange={e => s('delivery_date', e.target.value)}
                        min={f.pickup_date || undefined}
                        style={{ ...iSt(T), fontSize: 13 }} />
                </div>
            </div>
            {f.pickup_date && f.delivery_date && f.delivery_date >= f.pickup_date && (() => {
                const d1 = new Date(f.pickup_date), d2 = new Date(f.delivery_date);
                const days = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
                return days > 0 ? (<div style={{ fontSize: 11, color: T.textSec, marginTop: -8, marginBottom: 12, paddingLeft: 2 }}>🕐 {days} day{days !== 1 ? 's' : ''} transit</div>) : null;
            })()}
            {/* Status — only shown when editing an existing trip */}
            {editTrip && (<>
                <Lbl c="Status" T={T} />
                <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: 12 }}>
                    {TRIP_STATUSES.map(st => { const a = f.status === st; const col = STATUS_COLORS[st] || T.primary; return <button key={st} onClick={() => s('status', st)} style={{ padding: '7px 14px', borderRadius: 20, marginRight: 8, marginBottom: 8, border: `1px solid ${a ? col : T.border}`, background: a ? col : T.card, color: a ? '#fff' : T.textSec, fontWeight: a ? 700 : 400, fontSize: 13, cursor: 'pointer' }}>{st}</button>; })}
                </div>
            </>)}
            <Lbl c="Rate Type" T={T} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <TB on={f.rate_type === 'per_mile'} label="$/mile" onClick={() => s('rate_type', 'per_mile')} T={T} />
                <TB on={f.rate_type === 'per_km'} label="$/km" onClick={() => s('rate_type', 'per_km')} T={T} />
                <TB on={f.rate_type === 'total'} label="Total Pay" onClick={() => s('rate_type', 'total')} T={T} />
            </div>
            <Lbl c={f.rate_type === 'per_mile' ? 'Rate ($/mile)' : f.rate_type === 'per_km' ? 'Rate ($/km)' : 'Total Pay ($)'} T={T} />
            <input value={f.trip_rate} onChange={e => s('trip_rate', e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" style={iSt(T)} />
            {rateNum > 0 && distNum > 0 && (
                <div style={{ background: T.primary + '18', border: `1px solid ${T.primary}44`, borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.primary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>💰 Earnings Preview</div>
                    {f.rate_type === 'per_mile' && <div style={{ fontSize: 14, color: T.text }}><span style={{ fontWeight: 600 }}>${rateNum}/mi</span> × <span style={{ fontWeight: 600 }}>{distNum.toFixed(1)} mi</span> = <span style={{ fontSize: 17, fontWeight: 800, color: T.primary }}>${earnings.toFixed(2)}</span></div>}
                    {f.rate_type === 'per_km' && <div style={{ fontSize: 14, color: T.text }}><span style={{ fontWeight: 600 }}>${rateNum}/km</span> × <span style={{ fontWeight: 600 }}>{(distNum * 1.60934).toFixed(1)} km</span> = <span style={{ fontSize: 17, fontWeight: 800, color: T.primary }}>${(rateNum * (distNum * 1.60934)).toFixed(2)}</span></div>}
                    {f.rate_type === 'total' && <div style={{ fontSize: 14, color: T.text }}>Total Pay: <span style={{ fontSize: 17, fontWeight: 800, color: T.primary }}>${rateNum.toFixed(2)}</span>{perMileEarned && <span style={{ fontSize: 12, color: T.textSec, marginLeft: 8 }}>(≈ ${perMileEarned}/mi)</span>}</div>}
                    {f.deadhead_distance && parseFloat(f.deadhead_distance) > 0 && (
                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.primary}33`, fontSize: 12, color: T.textSec }}>
                            💨 +{parseFloat(f.deadhead_distance).toFixed(1)} deadhead mi · Total trip: <b style={{ color: T.text }}>{(distNum + parseFloat(f.deadhead_distance)).toFixed(1)} mi</b>
                        </div>
                    )}
                </div>
            )}
            <Lbl c="Currency" T={T} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <TB on={f.currency === 'CAD'} label="CAD $" onClick={() => s('currency', 'CAD')} T={T} />
                <TB on={f.currency === 'USD'} label="USD $" onClick={() => s('currency', 'USD')} T={T} />
            </div>
            <Lbl c="Notes" T={T} />
            <textarea value={f.notes} onChange={e => s('notes', e.target.value)} placeholder="Additional notes..." rows={3} style={{ ...iSt(T), resize: 'vertical', height: 80 }} />
            <button onClick={save} style={{ width: '100%', background: T.primary, color: '#fff', border: 'none', borderRadius: 12, padding: 16, fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>{editTrip ? 'Update Trip' : 'Save Trip'}</button>
        </Sheet>
    );
}

// ═══════════════════════════ ADD EXPENSE MODAL ═══════════════════
function AddExpenseModal({ visible, onClose, onSave, tripId, editExpense, T }) {
    const blank = { expense_type: 'Fuel', amount: '', description: '', expense_date: '', quantity: '', pump_city: '', toll_name: '', unit_type: 'liters', currency: 'CAD', usd_rate: '1.35' };
    const [f, setF] = useState(blank);
    const [tollS, setTollS] = useState([]);
    const [showToll, setShowToll] = useState(false);
    useEffect(() => {
        if (!visible) return;
        if (editExpense) { setF({ expense_type: editExpense.expense_type || 'Fuel', amount: String(editExpense.amount || ''), description: editExpense.description || '', expense_date: editExpense.expense_date || '', quantity: editExpense.quantity ? String(editExpense.quantity) : '', pump_city: editExpense.pump_city || '', toll_name: editExpense.toll_name || '', unit_type: editExpense.unit_type || 'liters', currency: editExpense.currency || 'CAD', usd_rate: '1.35' }); }
        else setF(blank);
        setShowToll(false);
    }, [visible, editExpense]);
    const s = (k, v) => setF(p => ({ ...p, [k]: v }));
    function tollInp(v) { s('toll_name', v); setTollS(TOLLS.filter(t => t.name.toLowerCase().includes(v.toLowerCase()))); setShowToll(true); }
    function save() {
        if (!f.amount || !f.expense_date) { alert('Please fill Amount and Date.'); return; }
        let amt = parseFloat(f.amount) || 0;
        if (f.currency === 'USD') amt *= (parseFloat(f.usd_rate) || 1.35);
        onSave({ trip_id: tripId, expense_type: f.expense_type, amount: amt, description: f.description, expense_date: f.expense_date, quantity: f.quantity ? parseFloat(f.quantity) : null, pump_city: f.pump_city, toll_name: f.toll_name, unit_type: f.unit_type, currency: f.currency });
    }
    const isFD = f.expense_type === 'Fuel' || f.expense_type === 'DEF';
    const isToll = f.expense_type === 'Toll';
    const cad = ((parseFloat(f.amount) || 0) * (parseFloat(f.usd_rate) || 1.35)).toFixed(2);
    return (
        <Sheet visible={visible} onClose={onClose} title={editExpense ? 'Edit Expense' : 'Add Expense'} T={T}>
            <Lbl c="Expense Type" T={T} />
            <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: 14 }}>
                {EXPENSE_TYPES.map(t => { const a = f.expense_type === t; const col = EXPENSE_COLORS[t] || '#6B7280'; return (<button key={t} onClick={() => s('expense_type', t)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px', borderRadius: 20, marginRight: 8, marginBottom: 8, border: `1px solid ${a ? col : T.border}`, background: a ? col : T.card, color: a ? '#fff' : T.textSec, fontWeight: a ? 600 : 400, fontSize: 13, cursor: 'pointer' }}><span>{EXPENSE_ICONS[t]}</span>{t}</button>); })}
            </div>
            {isFD && (<>
                <Lbl c="Unit Type" T={T} />
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}><TB on={f.unit_type === 'liters'} label="Liters" onClick={() => s('unit_type', 'liters')} T={T} /><TB on={f.unit_type === 'gallons'} label="Gallons" onClick={() => s('unit_type', 'gallons')} T={T} /></div>
                <Lbl c={`Quantity (${f.unit_type})`} T={T} />
                <input value={f.quantity} onChange={e => s('quantity', e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.0" style={iSt(T)} />
                <Lbl c="Pump City/Location" T={T} />
                <PlacesAuto value={f.pump_city} onChange={v => s('pump_city', v)} placeholder="Search city or address where fuel was purchased" T={T} onSelect={c => s('pump_city', c.display)} />
            </>)}
            {isToll && (<>
                <Lbl c="Toll Road/Bridge" T={T} />
                <div style={{ position: 'relative', marginBottom: 12 }}>
                    <input value={f.toll_name} onChange={e => tollInp(e.target.value)} onFocus={() => { setTollS(TOLLS.filter(t => t.name.toLowerCase().includes(f.toll_name.toLowerCase()))); setShowToll(true); }} placeholder="Search toll road..." style={iSt(T, { marginBottom: 0 })} onBlur={() => setTimeout(() => setShowToll(false), 200)} />
                    {showToll && tollS.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,.12)', maxHeight: 250, overflowY: 'auto' }}>
                            {tollS.slice(0, 8).map((toll, i) => (<div key={i} onMouseDown={() => { s('toll_name', toll.name); setShowToll(false); }} style={{ padding: '10px 12px', borderBottom: i < Math.min(tollS.length, 8) - 1 ? `1px solid ${T.border}` : 'none', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = T.bg} onMouseLeave={e => e.currentTarget.style.background = T.card}><div style={{ fontSize: 13, color: T.text }}>{toll.name}</div><div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>{toll.state || toll.province || ''}{toll.country === 'Canada' ? ', CA' : ', USA'}</div></div>))}
                        </div>
                    )}
                </div>
            </>)}
            <Lbl c="Currency" T={T} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}><TB on={f.currency === 'CAD'} label="CAD $" onClick={() => s('currency', 'CAD')} T={T} /><TB on={f.currency === 'USD'} label="USD $" onClick={() => s('currency', 'USD')} T={T} /></div>
            {f.currency === 'USD' && (<div style={{ background: T.card, borderRadius: 8, padding: 10, marginBottom: 12, border: `1px solid ${T.border}` }}><div style={{ fontSize: 12, fontWeight: 600, color: T.textSec, marginBottom: 6 }}>USD to CAD Conversion</div><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 14, fontWeight: 'bold', color: T.text }}>Rate: </span><input value={f.usd_rate} onChange={e => s('usd_rate', e.target.value.replace(/[^0-9.]/g, ''))} placeholder="1.35" style={{ flex: 1, border: `1px solid ${T.border}`, borderRadius: 6, padding: '6px 8px', fontSize: 13, color: T.text, background: T.bg, outline: 'none' }} /><span style={{ fontSize: 12, color: T.textSec, whiteSpace: 'nowrap' }}>(= ${cad} CAD)</span></div></div>)}
            <Lbl c={`Amount (${f.currency}$)`} T={T} />
            <input value={f.amount} onChange={e => { let v = e.target.value.replace(/[^0-9.]/g, ''); const p = v.split('.'); if (p.length > 2) v = p[0] + '.' + p.slice(1).join(''); s('amount', v); }} placeholder="0.00" style={iSt(T)} />
            <Lbl c="Date" T={T} />
            <input type="date" value={f.expense_date} onChange={e => s('expense_date', e.target.value)} style={iSt(T)} />
            <div style={{ height: 4 }} />
            <Lbl c="Description" T={T} />
            <textarea value={f.description} onChange={e => s('description', e.target.value)} placeholder="Details about this expense..." rows={3} style={{ ...iSt(T), resize: 'vertical', height: 70 }} />
            <button onClick={save} style={{ width: '100%', background: T.primary, color: '#fff', border: 'none', borderRadius: 12, padding: 16, fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>{editExpense ? 'Update Expense' : 'Save Expense'}</button>
        </Sheet>
    );
}

// ═══════════════════════════ DASHBOARD ═══════════════════════════
function Dashboard({ trips, expenses, navigate }) {
    const { T, useKm, useLiters } = useT();
    const [fMode, setFMode] = useState('month');
    const [sd, setSd] = useState('');
    const [ed, setEd] = useState('');
    const cm = curMonth();

    const mT = useMemo(() => trips.filter(t => t.trip_date && t.trip_date.substring(0, 7) === cm && t.status === 'Completed'), [trips, cm]);
    const mTAll = useMemo(() => trips.filter(t => t.trip_date && t.trip_date.substring(0, 7) === cm), [trips, cm]);
    const mInProgress = useMemo(() => trips.filter(t => t.status === 'In Progress').length, [trips]);
    const mScheduled = useMemo(() => trips.filter(t => t.status === 'Scheduled').length, [trips]);
    const mE = useMemo(() => expenses.filter(e => e.expense_date && e.expense_date.substring(0, 7) === cm), [expenses, cm]);
    const mMiRaw = useMemo(() => mT.reduce((s, t) => s + (parseFloat(t.distance) || 0), 0), [mT]);
    const mMi = useKm ? (mMiRaw * 1.60934) : mMiRaw;
    const distUnit = useKm ? 'km' : 'mi';
    const mEx = useMemo(() => mE.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0), [mE]);
    const mRev = useMemo(() => mT.reduce((s, t) => s + calcTripRevenue(t), 0), [mT]);
    const mFuel = useMemo(() => mE.filter(e => e.expense_type === 'Fuel').reduce((s, e) => s + (parseFloat(e.amount) || 0), 0), [mE]);
    const mFuelStats = useMemo(() => {
        const fuelExp = mE.filter(e => e.expense_type === 'Fuel' && parseFloat(e.quantity) > 0);
        if (!fuelExp.length) return null;
        const totalLiters = fuelExp.reduce((s, e) => { const q = parseFloat(e.quantity) || 0; return s + (e.unit_type === 'gallons' ? q * 3.78541 : q); }, 0);
        const totalGallons = totalLiters / 3.78541;
        const distKm = mMiRaw * 1.60934;
        const mpg = totalGallons > 0 ? (mMiRaw / totalGallons) : 0;
        const l100 = distKm > 0 ? (totalLiters / distKm) * 100 : 0;
        const kmpl = totalLiters > 0 ? (distKm / totalLiters) : 0;
        return { mpg: mpg.toFixed(1), l100: l100.toFixed(1), kmpl: kmpl.toFixed(2), hasData: true };
    }, [mE, mMiRaw]);
    // Primary metric flips based on fuel unit preference; opposite shown as subLabel
    const mEcoDisplay = mFuelStats ? (useLiters ? `${mFuelStats.l100} L/100` : `${mFuelStats.mpg} MPG`) : 'No fuel qty';
    const mEcoSub = mFuelStats ? (useLiters ? `${mFuelStats.mpg} MPG · ${mFuelStats.kmpl} km/L` : `${mFuelStats.l100} L/100km · ${mFuelStats.kmpl} km/L`) : undefined;

    const tEx = useMemo(() => expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0), [expenses]);
    const completedTrips = useMemo(() => trips.filter(t => t.status === 'Completed'), [trips]);
    // Loaded miles = each trip's main distance (origin→destination)
    const loadedMilesRaw = useMemo(() => completedTrips.reduce((s, t) => s + (parseFloat(t.distance) || 0), 0), [completedTrips]);
    // Deadhead miles = the optional repositioning leg attached to each trip
    const deadheadMilesRaw = useMemo(() => completedTrips.reduce((s, t) => s + (parseFloat(t.deadhead_distance) || 0), 0), [completedTrips]);
    const tMiRaw = loadedMilesRaw + deadheadMilesRaw; // total miles driven, loaded + deadhead combined
    const tMi = useKm ? (tMiRaw * 1.60934) : tMiRaw;
    const tRev = useMemo(() => completedTrips.reduce((s, t) => s + calcTripRevenue(t), 0), [completedTrips]);
    const tFuel = useMemo(() => expenses.filter(e => e.expense_type === 'Fuel').reduce((s, e) => s + (parseFloat(e.amount) || 0), 0), [expenses]);
    const comp = completedTrips.length;
    const profit = mRev - mEx;
    const tProfit = tRev - tEx;

    // Loaded vs Deadhead breakdown — the real cost-per-mile metric
    const loadedMiles = useKm ? (loadedMilesRaw * 1.60934) : loadedMilesRaw;
    const deadheadMiles = useKm ? (deadheadMilesRaw * 1.60934) : deadheadMilesRaw;
    const deadheadPct = tMiRaw > 0 ? ((deadheadMilesRaw / tMiRaw) * 100) : 0;
    // True cost per loaded mile = all costs ÷ only loaded miles (deadhead still costs fuel but earns nothing)
    const costPerLoadedMile = loadedMilesRaw > 0 ? (tEx / loadedMilesRaw) : 0;
    const revPerLoadedMile = loadedMilesRaw > 0 ? (tRev / loadedMilesRaw) : 0;

    const recent = useMemo(() => {
        if (fMode === 'month') return trips.slice(0, 3);
        if (fMode === 'custom' && sd && ed) return trips.filter(t => t.trip_date >= sd && t.trip_date <= ed).slice(0, 3);
        return trips.slice(0, 3);
    }, [trips, fMode, sd, ed]);

    return (
        <div style={{ overflowY: 'auto', flex: 1, background: T.bg, paddingBottom: 24 }}>
            {/* Header */}
            <div style={{ padding: '24px 20px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 28 }}>🚛</span>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: T.text }}>TripLog</div>
                    <div style={{ fontSize: 14, color: T.textSec }}>Trucking Management Dashboard</div>
                </div>
                <button onClick={() => navigate('Settings')} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, width: 44, height: 44, fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⚙️</button>
            </div>

            {/* Filter Period */}
            <div style={{ padding: '0 20px 16px' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 10 }}>Filter Period</div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {[['month', 'This Month'], ['custom', 'Date Range']].map(([m, l]) => (
                        <button key={m} onClick={() => setFMode(m)} style={{ padding: '6px 12px', borderRadius: 20, border: `1px solid ${T.primary}`, background: fMode === m ? T.primary : T.card, color: fMode === m ? '#fff' : T.primary, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>{l}</button>
                    ))}
                </div>
            </div>

            {fMode === 'custom' && (
                <div style={{ padding: '0 20px 16px', display: 'flex', gap: 8 }}>
                    {[['From', sd, setSd], ['To', ed, setEd]].map(([l, v, fn]) => (
                        <div key={l} style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: T.textSec, marginBottom: 4 }}>{l}</div>
                            <input type="date" value={v} onChange={e => fn(e.target.value)} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px', fontSize: 14, color: T.text, background: T.card, width: '100%', boxSizing: 'border-box', outline: 'none' }} />
                        </div>
                    ))}
                </div>
            )}

            {/* Scheduled alert */}
            {mScheduled > 0 && (
                <div onClick={() => navigate('Trips', { filter: 'Scheduled' })} style={{ margin: '0 16px 8px', background: '#F5F3FF', border: '1.5px solid #7C3AED', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <span style={{ fontSize: 22 }}>📅</span>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#5B21B6' }}>{mScheduled} Trip{mScheduled > 1 ? 's' : ''} Scheduled</div>
                        <div style={{ fontSize: 11, color: '#7C3AED', marginTop: 1 }}>Upcoming trips planned in advance</div>
                    </div>
                    <span style={{ fontSize: 16, color: '#7C3AED' }}>›</span>
                </div>
            )}
            {/* In Progress alert */}
            {mInProgress > 0 && (
                <div onClick={() => navigate('Trips', { filter: 'In Progress' })} style={{ margin: '0 16px 10px', background: '#FEF3C7', border: '1.5px solid #F59E0B', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <span style={{ fontSize: 22 }}>🚛</span>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>{mInProgress} Trip{mInProgress > 1 ? 's' : ''} In Progress</div>
                        <div style={{ fontSize: 11, color: '#B45309', marginTop: 1 }}>Revenue & miles added to totals once marked Completed</div>
                    </div>
                    <span style={{ fontSize: 16, color: '#D97706' }}>›</span>
                </div>
            )}

            {/* ── THIS MONTH — 2 per row ── */}
            <div style={{ padding: '4px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: T.primary, textTransform: 'uppercase', letterSpacing: .8 }}>📅 {fMode === 'month' ? 'This Month' : 'Period'}</span>
                <span style={{ fontSize: 10, color: T.textSec }}>Completed trips only</span>
            </div>
            <StatGrid>
                {/* Row 1 — Blue: Trips | Receipts */}
                <SC bg="#1E40AF" icon="🗺️" value={String(mTAll.length)} label="Trips This Month" onClick={() => navigate('Trips', { filter: 'All' })} />
                <SC bg="#2563EB" icon="🧾" value={String(mE.length)} label="Receipts Logged" />
                {/* Row 2 — Red: Expenses | Fuel Spent */}
                <SC bg="#DC2626" icon="💳" value={`$${mEx.toFixed(0)}`} label="Total Expenses" />
                <SC bg="#EF4444" icon="⛽" value={`$${mFuel.toFixed(0)}`} label="Fuel Spent" />
                {/* Row 3 — Yellow: Fuel Economy | Miles */}
                <SC bg="#D97706" icon="⛽" value={mEcoDisplay} label={useLiters ? 'Fuel Econ (L/100)' : 'Fuel Econ (MPG)'} subLabel={mEcoSub} />
                <SC bg="#F59E0B" icon="🛣️" value={`${mMi.toFixed(1)} ${distUnit}`} label="Miles Driven" />
                {/* Row 4 — Green: Revenue | Profit */}
                <SC bg="#059669" icon="📈" value={`$${mRev.toFixed(0)}`} label="Revenue" />
                <SC bg={profit >= 0 ? '#10B981' : '#DC2626'} icon="🏦" value={`$${profit.toFixed(0)}`} label="Profit / Loss" />
            </StatGrid>

            {/* ── ALL TIME — 2 per row ── */}
            <div style={{ padding: '12px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: .8 }}>📊 All Time</span>
                <span style={{ fontSize: 10, color: T.textSec }}>Completed trips only</span>
            </div>
            <StatGrid>
                {/* Row 1 — Blue: All Trips | Completed */}
                <SC bg="#1E40AF" icon="🗺️" value={String(trips.length)} label="All Trips" />
                <SC bg="#2563EB" icon="✅" value={String(comp)} label="Completed" />
                {/* Row 2 — Red: Total Cost | Fuel Cost */}
                <SC bg="#DC2626" icon="💳" value={fmtC(tEx)} label="Total Cost" />
                <SC bg="#EF4444" icon="⛽" value={fmtC(tFuel)} label="Fuel Cost" />
                {/* Row 3 — Yellow: Total Miles | All Expenses */}
                <SC bg="#D97706" icon="🛣️" value={`${tMi.toFixed(0)} ${distUnit}`} label={useKm ? 'Total Km' : 'Total Miles'} />
                <SC bg="#F59E0B" icon="🧾" value={String(expenses.length)} label="All Expenses" />
                {/* Row 4 — Green: Revenue | Profit/Loss */}
                <SC bg="#059669" icon="📊" value={fmtC(tRev)} label="Total Revenue" />
                <SC bg={tProfit >= 0 ? '#10B981' : '#DC2626'} icon="💰" value={fmtC(tProfit)} label="Total Profit/Loss" />
            </StatGrid>

            {/* ── Loaded vs Deadhead breakdown — true cost-per-loaded-mile ── */}
            {tMiRaw > 0 && (
                <div style={{ margin: '4px 16px 8px' }}>
                    <div style={{ padding: '4px 0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#0891B2', textTransform: 'uppercase', letterSpacing: .8 }}>📦 Loaded vs 💨 Deadhead</span>
                    </div>
                    <div style={{ background: T.card, borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
                        {/* Visual bar */}
                        <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', marginBottom: 10, background: T.border }}>
                            <div style={{ width: `${100 - deadheadPct}%`, background: '#059669' }} />
                            <div style={{ width: `${deadheadPct}%`, background: '#DC2626' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 10, height: 10, borderRadius: 5, background: '#059669' }} />
                                <span style={{ fontSize: 12, color: T.textSec }}>Loaded: <b style={{ color: T.text }}>{loadedMiles.toFixed(0)} {distUnit}</b> ({(100 - deadheadPct).toFixed(0)}%)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 10, height: 10, borderRadius: 5, background: '#DC2626' }} />
                                <span style={{ fontSize: 12, color: T.textSec }}>Deadhead: <b style={{ color: T.text }}>{deadheadMiles.toFixed(0)} {distUnit}</b> ({deadheadPct.toFixed(0)}%)</span>
                            </div>
                        </div>
                        {/* True cost-per-loaded-mile */}
                        <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                            <div style={{ flex: 1, textAlign: 'center' }}>
                                <div style={{ fontSize: 18, fontWeight: 800, color: '#DC2626' }}>${costPerLoadedMile.toFixed(2)}</div>
                                <div style={{ fontSize: 10, color: T.textSec, marginTop: 2 }}>True cost / loaded mi</div>
                            </div>
                            <div style={{ width: 1, background: T.border }} />
                            <div style={{ flex: 1, textAlign: 'center' }}>
                                <div style={{ fontSize: 18, fontWeight: 800, color: '#059669' }}>${revPerLoadedMile.toFixed(2)}</div>
                                <div style={{ fontSize: 10, color: T.textSec, marginTop: 2 }}>Revenue / loaded mi</div>
                            </div>
                            <div style={{ width: 1, background: T.border }} />
                            <div style={{ flex: 1, textAlign: 'center' }}>
                                <div style={{ fontSize: 18, fontWeight: 800, color: (revPerLoadedMile - costPerLoadedMile) >= 0 ? '#059669' : '#DC2626' }}>${(revPerLoadedMile - costPerLoadedMile).toFixed(2)}</div>
                                <div style={{ fontSize: 10, color: T.textSec, marginTop: 2 }}>Net / loaded mi</div>
                            </div>
                        </div>
                        {deadheadPct > 20 && (
                            <div style={{ marginTop: 10, background: '#FEF3C7', borderRadius: 8, padding: '8px 10px', fontSize: 11, color: '#92400E', lineHeight: 1.4 }}>
                                ⚠️ {deadheadPct.toFixed(0)}% deadhead is high — look for backhauls to cut empty miles.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Recent Trips */}
            <div style={{ padding: '12px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>Recent Trips</div>
                <button onClick={() => navigate('Trips')} style={{ background: 'none', border: 'none', color: T.accent, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>See All</button>
            </div>

            {recent.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: T.textSec }}>
                    <div style={{ fontSize: 48 }}>🚛</div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginTop: 12 }}>No trips in this period.</div>
                    <div style={{ fontSize: 14, marginTop: 4 }}>Go to Trips tab to add your first trip.</div>
                </div>
            ) : recent.map(trip => {
                const sc = STATUS_COLORS[trip.status] || '#D97706';
                return (
                    <div key={trip.id} onClick={() => navigate('TripDetail', { tripId: trip.id })} style={{ margin: '0 20px 10px', background: T.card, borderRadius: 14, padding: 16, cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,.06)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                    <span style={{ color: T.accent }}>📍</span>
                                    <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{trip.origin || 'N/A'} → {trip.destination || 'N/A'}</span>
                                </div>
                                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: T.textSec }}>
                                    <span>📅 {trip.pickup_date || trip.trip_date || 'No date'}</span>
                                    {trip.delivery_date && <span>🏁 {trip.delivery_date}</span>}
                                    <span>🛣️ {trip.distance || 0} mi</span>
                                </div>
                            </div>
                            <div style={{ background: sc + '20', borderRadius: 10, padding: '4px 10px', marginLeft: 8 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: sc }}>{trip.status || 'Active'}</span>
                            </div>
                        </div>
                    </div>
                );
            })}

            <button onClick={() => navigate('Trips')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, margin: '8px 20px 0', width: 'calc(100% - 40px)', background: T.primary, color: '#fff', border: 'none', borderRadius: 12, padding: 15, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                + Log New Trip
            </button>
        </div>
    );
}

// ═══════════════════════════ TRIPS SCREEN ════════════════════════
function Trips({ trips, setTrips, navigate, vehicles, initialFilter, onSaveTrip }) {
    const { T } = useT();
    const [filter, setFilter] = useState(initialFilter || 'All');
    useEffect(() => { if (initialFilter) setFilter(initialFilter); }, [initialFilter]);
    const [show, setShow] = useState(false);
    const [edit, setEdit] = useState(null);
    const [confirmId, setConfirmId] = useState(null);
    const [sortAsc, setSortAsc] = useState(false); // false = newest first (descending)
    const fColors = { All: T.primary, Scheduled: '#7C3AED', 'In Progress': '#F59E0B', Completed: '#2563EB', Cancelled: '#DC2626' };
    const STATUS_ORDER = { Scheduled: 0, 'In Progress': 1, 'Completed': 2, 'Cancelled': 3 };

    const filtered = useMemo(() => {
        const base = filter === 'All' ? trips : trips.filter(t => t.status === filter);
        return [...base].sort((a, b) => {
            // Primary: status order
            const sa = STATUS_ORDER[a.status] ?? 2;
            const sb = STATUS_ORDER[b.status] ?? 2;
            if (sa !== sb) return sa - sb;
            // Secondary: pickup_date (or trip_date fallback), asc or desc
            const da = a.pickup_date || a.trip_date || '';
            const db = b.pickup_date || b.trip_date || '';
            if (da && db) {
                return sortAsc ? da.localeCompare(db) : db.localeCompare(da);
            }
            // Tertiary: created_at timestamp
            const ca = a.created_at || 0;
            const cb = b.created_at || 0;
            return sortAsc ? ca - cb : cb - ca;
        });
    }, [trips, filter, sortAsc]);

    function save(data) {
        const tripData = { ...data, created_at: edit?.created_at || Date.now() };
        const ok = onSaveTrip ? onSaveTrip({ ...tripData, id: edit?.id }) : true;
        if (ok === false) return;
        if (edit) setTrips(ts => ts.map(t => t.id === edit.id ? { ...t, ...tripData } : t));
        else setTrips(ts => [{ ...tripData, id: Date.now(), created_at: Date.now() }, ...ts]);
        setShow(false); setEdit(null);
    }
    function del(id) { setTrips(ts => ts.filter(t => t.id !== id)); setConfirmId(null); }

    function changeStatus(tripId, newStatus) {
        if (newStatus === 'In Progress') {
            const trip = trips.find(t => t.id === tripId);
            if (trip) {
                const conflict = trips.find(t => String(t.vehicle_id) === String(trip.vehicle_id) && t.status === 'In Progress' && t.id !== tripId);
                if (conflict) { alert(`⚠️ This vehicle already has a trip In Progress:\n"${conflict.trip_number} — ${conflict.origin} → ${conflict.destination}"\n\nMark that trip Completed first.`); return; }
            }
        }
        setTrips(ts => ts.map(t => t.id === tripId ? { ...t, status: newStatus } : t));
    }

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.bg, overflow: 'hidden' }}>
            <div style={{ background: T.primary, padding: '20px 20px 16px', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>My Trips</div>
                    <button onClick={() => setSortAsc(p => !p)}
                        style={{ background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 8, padding: '6px 12px', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {sortAsc ? '↑ Oldest' : '↓ Newest'}
                    </button>
                </div>
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                    {['All', 'Scheduled', 'In Progress', 'Completed', 'Cancelled'].map(f => { const a = filter === f; return <button key={f} onClick={() => setFilter(f)} style={{ padding: '7px 14px', borderRadius: 20, border: 'none', background: a ? '#fff' : 'rgba(255,255,255,.2)', color: a ? (fColors[f] || T.primary) : '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>{f}</button>; })}
                </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 100px' }}>
                {filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 48, color: T.textSec }}><div style={{ fontSize: 56 }}>🚛</div><div style={{ fontSize: 17, fontWeight: 600, marginTop: 16 }}>No trips found</div><div style={{ fontSize: 14, marginTop: 6 }}>Tap + to log your first trip</div></div>
                ) : filtered.map(trip => (
                    <div key={trip.id} style={{ background: T.card, borderRadius: 16, marginBottom: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.07)' }}>
                        {confirmId === trip.id ? (
                            <div style={{ background: '#FEF2F2', padding: '14px 16px' }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: '#DC2626', marginBottom: 10 }}>🗑️ Delete this trip?</div>
                                <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>{trip.origin} → {trip.destination}</div>
                                <div style={{ display: 'flex', gap: 8 }}><button onClick={() => del(trip.id)} style={{ flex: 1, background: '#DC2626', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Yes, Delete</button><button onClick={() => setConfirmId(null)} style={{ flex: 1, background: T.border, color: T.text, border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button></div>
                            </div>
                        ) : (
                            <>
                                <div onClick={() => navigate('TripDetail', { tripId: trip.id })} style={{ cursor: 'pointer' }}>
                                    <div style={{ background: STATUS_COLORS[trip.status] || T.primary, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ flex: 1, overflow: 'hidden' }}>
                                            {trip.trip_number && <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,.8)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Trip # {trip.trip_number}</div>}
                                            {/* Shipper / Receiver names — small labels above origin/destination */}
                                            {(trip.shipper_name || trip.receiver_name) && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 1 }}>
                                                    <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '45%' }}>
                                                        {trip.shipper_name || ''}
                                                    </span>
                                                    {(trip.shipper_name && trip.receiver_name) && <span style={{ fontSize: 10, color: 'rgba(255,255,255,.5)' }}>→</span>}
                                                    <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '45%' }}>
                                                        {trip.receiver_name || ''}
                                                    </span>
                                                </div>
                                            )}
                                            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{trip.origin || 'Unknown'} → {trip.destination || 'Unknown'}</div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                                            <span style={{ background: 'rgba(255,255,255,.25)', color: '#fff', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 10, marginLeft: 8, whiteSpace: 'nowrap', letterSpacing: .3 }}>{trip.status || 'Active'}</span>
                                            {trip.deadhead_distance > 0 && <span style={{ background: 'rgba(0,0,0,.25)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, whiteSpace: 'nowrap' }}>💨 +{parseFloat(trip.deadhead_distance).toFixed(0)}mi</span>}
                                        </div>
                                    </div>
                                    <div style={{ padding: 14 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.textSec }}>
                                            <span>📅 {trip.pickup_date || trip.trip_date || 'No date'}</span>
                                            {trip.delivery_date && <span>🏁 {trip.delivery_date}</span>}
                                            <span>🛣️ {trip.distance || 0} miles</span>
                                        </div>
                                        {trip.border_crossing && <div style={{ fontSize: 11, color: '#7C3AED', marginTop: 4, fontWeight: 600 }}>🛃 {trip.border_crossing}</div>}
                                        {trip.vehicle_label && <div style={{ fontSize: 12, color: T.accent, marginTop: 4, fontWeight: 600 }}>🚛 {trip.vehicle_label}{trip.trailer_number ? ` · 🚚 ${trip.trailer_number}` : ''}</div>}
                                        {trip.notes ? <div style={{ fontSize: 12, color: T.textSec, marginTop: 4 }}>{trip.notes}</div> : null}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px 10px', borderTop: `1px solid ${T.border}` }}>
                                    {/* ── Status dropdown ── */}
                                    <div style={{ position: 'relative' }}>
                                        <select
                                            value={trip.status || 'In Progress'}
                                            onChange={e => { e.stopPropagation(); changeStatus(trip.id, e.target.value); }}
                                            onClick={e => e.stopPropagation()}
                                            style={{ border: `1px solid ${STATUS_COLORS[trip.status] || T.border}`, borderRadius: 7, padding: '5px 24px 5px 8px', fontSize: 12, fontWeight: 700, color: STATUS_COLORS[trip.status] || T.text, background: T.card, cursor: 'pointer', outline: 'none', appearance: 'none', WebkitAppearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%2364748B' d='M5 6L0 0h10z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 7px center', fontFamily: 'inherit' }}>
                                            {TRIP_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
                                        </select>
                                    </div>
                                    {/* ── Edit / Delete ── */}
                                    <div style={{ display: 'flex', gap: 16 }}>
                                        <button onClick={e => { e.stopPropagation(); setEdit(trip); setShow(true); }} style={{ background: 'none', border: 'none', color: T.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>✏️ Edit</button>
                                        <button onClick={e => { e.stopPropagation(); setConfirmId(trip.id); }} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>🗑️ Delete</button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
            <button onClick={() => { setEdit(null); setShow(true); }} style={{ position: 'absolute', right: 20, bottom: 76, width: 56, height: 56, borderRadius: 28, background: T.primary, border: 'none', color: '#fff', fontSize: 28, cursor: 'pointer', boxShadow: `0 4px 16px ${T.primary}88`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>+</button>
            <AddTripModal visible={show} onClose={() => { setShow(false); setEdit(null); }} onSave={save} editTrip={edit} T={T} vehicles={vehicles} trips={trips} />
        </div>
    );
}

// ═══════════════════════════ POD FULLSCREEN VIEWER ═══════════════
function PodViewer({ pod, onClose, T }) {
    if (!pod) return null;
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.95)', zIndex: 900, display: 'flex', flexDirection: 'column' }} onClick={onClose}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', flexShrink: 0 }}>
                <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>POD — {pod.label || 'Proof of Delivery'}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.55)', marginTop: 2 }}>{pod.date}</div>
                </div>
                <button onClick={onClose} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', borderRadius: 8, width: 36, height: 36, fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                <img src={pod.data} alt="POD" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 12 }} />
            </div>
        </div>
    );
}

// ═══════════════════════════ TRIP DETAIL ═════════════════════════
function TripDetail({ tripId, trips, expenses, setExpenses, pods, setPods, goBack }) {
    const { T } = useT();
    const [activeTab, setActiveTab] = useState('expenses'); // 'expenses' | 'pods'
    const [show, setShow] = useState(false);
    const [editE, setEditE] = useState(null);
    const [confirmExpId, setConfirmExpId] = useState(null);
    const [viewPod, setViewPod] = useState(null);
    const [confirmPodId, setConfirmPodId] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [podLabel, setPodLabel] = useState('');
    const [showLabelInput, setShowLabelInput] = useState(false);
    const [pendingFile, setPendingFile] = useState(null);
    const fileRef = useRef(null);

    const trip = useMemo(() => trips.find(t => t.id === tripId) || null, [trips, tripId]);
    const tExp = useMemo(() => expenses.filter(e => e.trip_id === tripId), [expenses, tripId]);
    const tPods = useMemo(() => pods.filter(p => p.trip_id === tripId).sort((a, b) => b.id - a.id), [pods, tripId]);
    const total = useMemo(() => tExp.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0), [tExp]);

    const fuelEconomy = useMemo(() => {
        const fuelExp = tExp.filter(e => e.expense_type === 'Fuel' && parseFloat(e.quantity) > 0);
        const dist = parseFloat(trip?.distance) || 0;
        if (!fuelExp.length || !dist) return null;
        const totalLiters = fuelExp.reduce((s, e) => { const q = parseFloat(e.quantity) || 0; return s + (e.unit_type === 'gallons' ? q * 3.78541 : q); }, 0);
        const totalGallons = totalLiters / 3.78541;
        const distKm = dist * 1.60934;
        return { mpg: totalGallons > 0 ? (dist / totalGallons).toFixed(2) : null, l100: distKm > 0 ? ((totalLiters / distKm) * 100).toFixed(2) : null, kpl: totalLiters > 0 ? (distKm / totalLiters).toFixed(2) : null, totalLiters: totalLiters.toFixed(1), totalGallons: totalGallons.toFixed(2) };
    }, [tExp, trip]);

    function saveE(data) { if (editE) setExpenses(es => es.map(e => e.id === editE.id ? { ...e, ...data } : e)); else setExpenses(es => [...es, { ...data, id: Date.now() }]); setShow(false); setEditE(null); }
    function delE(id) { setExpenses(es => es.filter(e => e.id !== id)); setConfirmExpId(null); }

    // ── POD upload: pick file → preview label input → save ──
    function handleFileChange(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        const reader = new FileReader();
        reader.onload = ev => {
            setPendingFile({ data: ev.target.result, name: file.name });
            setPodLabel('');
            setShowLabelInput(true);
            setUploading(false);
        };
        reader.onerror = () => setUploading(false);
        reader.readAsDataURL(file);
        // reset input so same file can be re-selected
        e.target.value = '';
    }

    function savePod() {
        if (!pendingFile) return;
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
        setPods(ps => [...ps, {
            id: Date.now(),
            trip_id: tripId,
            data: pendingFile.data,
            label: podLabel.trim() || 'POD',
            date: dateStr,
        }]);
        setPendingFile(null);
        setPodLabel('');
        setShowLabelInput(false);
    }

    function cancelPod() { setPendingFile(null); setPodLabel(''); setShowLabelInput(false); }
    function delPod(id) { setPods(ps => ps.filter(p => p.id !== id)); setConfirmPodId(null); }

    const d = trip || { origin: 'Origin City', destination: 'Destination City', trip_date: 'N/A', distance: 0, status: 'In Progress' };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.bg, overflow: 'hidden' }}>

            {/* ── Fullscreen POD viewer ── */}
            <PodViewer pod={viewPod} onClose={() => setViewPod(null)} T={T} />

            {/* ── Header ── */}
            <div style={{ background: STATUS_COLORS[d.status] || T.primary, padding: '16px 20px 20px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <button onClick={goBack} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 26, cursor: 'pointer', padding: 4, lineHeight: 1 }}>←</button>
                    <span style={{ fontSize: 20, fontWeight: 700, color: '#fff', flex: 1 }}>Trip Details</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,.12)', borderRadius: 16, padding: 14 }}>
                    {d.trip_number && <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,.65)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 }}>Trip # {d.trip_number}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ color: 'rgba(255,255,255,.8)' }}>📍</span>
                        <span style={{ fontSize: 15, fontWeight: 600, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.origin || 'N/A'}</span>
                        <span style={{ color: 'rgba(255,255,255,.6)' }}>→</span>
                        <span style={{ fontSize: 15, fontWeight: 600, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.destination || 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.85)' }}>📅 {d.pickup_date || d.trip_date || 'N/A'}</span>
                        {d.delivery_date && <span style={{ fontSize: 12, color: 'rgba(255,255,255,.85)' }}>🏁 {d.delivery_date}</span>}
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.85)' }}>🛣️ {d.distance || 0} mi</span>
                        <div style={{ background: 'rgba(255,255,255,.2)', borderRadius: 10, padding: '2px 10px' }}><span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>{d.status || 'Active'}</span></div>
                    </div>
                </div>
            </div>

            {/* ── Shipper / Receiver info ── */}
            {(d.shipper_name || d.shipper_address || d.receiver_name || d.receiver_address) && (
                <div style={{ display: 'flex', margin: '12px 16px 0', gap: 8 }}>
                    {(d.shipper_name || d.shipper_address) && (
                        <div style={{ flex: 1, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 12, padding: '10px 12px' }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: '#1E40AF', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>📤 Shipper</div>
                            {d.shipper_name && <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{d.shipper_name}</div>}
                            {d.shipper_address && <div style={{ fontSize: 11, color: '#1E40AF', marginTop: 2 }}>📍 {d.shipper_address}</div>}
                        </div>
                    )}
                    {(d.receiver_name || d.receiver_address) && (
                        <div style={{ flex: 1, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '10px 12px' }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: '#DC2626', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>📥 Receiver</div>
                            {d.receiver_name && <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{d.receiver_name}</div>}
                            {d.receiver_address && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 2 }}>📍 {d.receiver_address}</div>}
                        </div>
                    )}
                </div>
            )}

            {/* ── Deadhead leg info ── */}
            {d.deadhead_from && d.deadhead_distance > 0 && (
                <div style={{ margin: '8px 16px 0', background: '#FFF7ED', border: '1px solid #FDBA74', borderRadius: 12, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#C2410C', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>💨 Deadhead Leg (before pickup)</div>
                    {d.deadhead_name && <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{d.deadhead_name}</div>}
                    {d.deadhead_address && <div style={{ fontSize: 12, color: '#C2410C', marginTop: 1 }}>📍 {d.deadhead_address}</div>}
                    <div style={{ fontSize: 13, color: '#1E293B', marginTop: 4 }}>{d.deadhead_from} → {d.origin}</div>
                    <div style={{ fontSize: 12, color: '#9A3412', marginTop: 2 }}>{parseFloat(d.deadhead_distance).toFixed(1)} empty miles · no revenue</div>
                </div>
            )}
            {/* ── Summary bar ── */}
            <div style={{ display: 'flex', margin: '12px 16px 0', gap: 8 }}>
                <div style={{ flex: 1, background: '#EFF6FF', borderRadius: 12, padding: '10px 14px', textAlign: 'center' }}><div style={{ fontSize: 20, fontWeight: 800, color: T.primary }}>{tExp.length}</div><div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>Expenses</div></div>
                <div style={{ flex: 1, background: '#FEF2F2', borderRadius: 12, padding: '10px 14px', textAlign: 'center' }}><div style={{ fontSize: 20, fontWeight: 800, color: '#DC2626' }}>${total.toFixed(0)}</div><div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>Trip Cost</div></div>
                <div style={{ flex: 1, background: '#F0FDF4', borderRadius: 12, padding: '10px 14px', textAlign: 'center' }}><div style={{ fontSize: 20, fontWeight: 800, color: '#059669' }}>{tPods.length}</div><div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>PODs</div></div>
            </div>

            {/* ── Tab switcher ── */}
            <div style={{ display: 'flex', margin: '12px 16px 0', background: T.card, borderRadius: 12, padding: 4, gap: 4, border: `1px solid ${T.border}` }}>
                {[['expenses', '🧾 Expenses'], ['pods', '📄 PODs']].map(([k, l]) => (
                    <button key={k} onClick={() => setActiveTab(k)} style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', background: activeTab === k ? T.primary : 'transparent', color: activeTab === k ? '#fff' : T.textSec, fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all .15s' }}>
                        {l}{k === 'pods' && tPods.length > 0 ? ` (${tPods.length})` : ''}
                    </button>
                ))}
            </div>

            {/* ══════════ EXPENSES TAB ══════════ */}
            {activeTab === 'expenses' && (<>
                <div style={{ margin: '10px 16px 8px', background: '#FEF3C7', borderRadius: 12, padding: 12 }}>
                    {fuelEconomy ? (
                        <>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>⛽ Fuel Economy</div>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <div style={{ flex: 1, background: 'rgba(255,255,255,.6)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 800, color: '#D97706' }}>{fuelEconomy.mpg}</div><div style={{ fontSize: 10, color: '#92400E', fontWeight: 600, marginTop: 1 }}>MPG</div></div>
                                <div style={{ flex: 1, background: 'rgba(255,255,255,.6)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 800, color: '#D97706' }}>{fuelEconomy.l100}</div><div style={{ fontSize: 10, color: '#92400E', fontWeight: 600, marginTop: 1 }}>L/100km</div></div>
                                <div style={{ flex: 1, background: 'rgba(255,255,255,.6)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 800, color: '#D97706' }}>{fuelEconomy.kpl}</div><div style={{ fontSize: 10, color: '#92400E', fontWeight: 600, marginTop: 1 }}>km/L</div></div>
                            </div>
                            <div style={{ marginTop: 6, fontSize: 10, color: '#92400E', textAlign: 'center' }}>{fuelEconomy.totalLiters} L ({fuelEconomy.totalGallons} gal) over {d.distance} mi</div>
                        </>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 20 }}>⛽</span>
                            <div><div style={{ fontSize: 12, fontWeight: 700, color: '#D97706' }}>Fuel Economy</div><div style={{ fontSize: 11, color: '#92400E' }}>Add a Fuel expense with quantity to calculate</div></div>
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 16px 8px' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Expenses</div>
                    <button onClick={() => { setEditE(null); setShow(true); }} style={{ display: 'flex', alignItems: 'center', gap: 4, background: T.primary, color: '#fff', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Add</button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px' }}>
                    {tExp.length === 0 ? (<div style={{ textAlign: 'center', padding: 32, color: T.textSec }}><div style={{ fontSize: 40 }}>🧾</div><div style={{ fontSize: 15, marginTop: 12 }}>No expenses recorded yet</div></div>) : tExp.map(exp => {
                        const col = EXPENSE_COLORS[exp.expense_type] || '#6B7280';
                        return (
                            <div key={exp.id} style={{ background: T.card, borderRadius: 12, marginBottom: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
                                {confirmExpId === exp.id ? (
                                    <div style={{ background: '#FEF2F2', padding: '12px 14px' }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: '#DC2626', marginBottom: 8 }}>🗑️ Delete this expense?</div>
                                        <div style={{ display: 'flex', gap: 8 }}><button onClick={() => delE(exp.id)} style={{ flex: 1, background: '#DC2626', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Yes, Delete</button><button onClick={() => setConfirmExpId(null)} style={{ flex: 1, background: T.border, color: T.text, border: 'none', borderRadius: 7, padding: '8px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button></div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', padding: 14 }}>
                                        <div style={{ width: 42, height: 42, borderRadius: 21, background: col + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 12, fontSize: 20, flexShrink: 0 }}>{EXPENSE_ICONS[exp.expense_type] || '🧾'}</div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{exp.expense_type || 'Other'}</div>
                                            {exp.description ? <div style={{ fontSize: 12, color: T.textSec, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp.description}</div> : null}
                                            <div style={{ display: 'flex', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: 11, color: T.textSec }}>{exp.expense_date || 'No date'}</span>
                                                {exp.quantity ? <span style={{ fontSize: 11, color: T.textSec }}>| {exp.quantity} {exp.unit_type || 'gal'}</span> : null}
                                                {exp.pump_city ? <span style={{ fontSize: 11, color: T.textSec }}>| {exp.pump_city}</span> : null}
                                                {exp.toll_name ? <span style={{ fontSize: 11, color: T.textSec }}>| {exp.toll_name}</span> : null}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 16, fontWeight: 700, color: col, marginRight: 8 }}>${(parseFloat(exp.amount) || 0).toFixed(2)}</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            <button onClick={() => { setEditE(exp); setShow(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 4, color: T.accent }}>✏️</button>
                                            <button onClick={() => setConfirmExpId(exp.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 4, color: '#EF4444' }}>🗑️</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                <AddExpenseModal visible={show} onClose={() => { setShow(false); setEditE(null); }} onSave={saveE} tripId={tripId} editExpense={editE} T={T} />
            </>)}

            {/* ══════════ PODs TAB ══════════ */}
            {activeTab === 'pods' && (<>
                {/* Hidden file input — accept images, allow camera on mobile */}
                <input ref={fileRef} type="file" accept="image/*" capture="environment"
                    style={{ display: 'none' }} onChange={handleFileChange} />

                {/* ── Label + preview before saving ── */}
                {showLabelInput && pendingFile && (
                    <div style={{ margin: '12px 16px', background: T.card, borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,.1)', border: `2px solid ${T.primary}` }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.primary, marginBottom: 10 }}>📄 New POD — Add Label</div>
                        <img src={pendingFile.data} alt="preview" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 10, marginBottom: 10 }} />
                        <input value={podLabel} onChange={e => setPodLabel(e.target.value)}
                            placeholder="Label (e.g. Delivery Receipt, Bill of Lading…)"
                            style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px', fontSize: 14, color: T.text, background: T.bg, width: '100%', boxSizing: 'border-box', outline: 'none', marginBottom: 10 }} />
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={savePod} style={{ flex: 1, background: T.primary, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>💾 Save POD</button>
                            <button onClick={cancelPod} style={{ flex: 1, background: T.border, color: T.text, border: 'none', borderRadius: 10, padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                        </div>
                    </div>
                )}

                {/* ── Upload button ── */}
                {!showLabelInput && (
                    <div style={{ padding: '12px 16px 8px', display: 'flex', gap: 8 }}>
                        <button onClick={() => fileRef.current?.click()}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: T.primary, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                            {uploading ? '⏳ Loading…' : '📷 Add POD'}
                        </button>
                    </div>
                )}

                {/* ── POD thumbnail grid ── */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 32px' }}>
                    {tPods.length === 0 && !showLabelInput ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: T.textSec }}>
                            <div style={{ fontSize: 56 }}>📄</div>
                            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 16, color: T.text }}>No PODs yet</div>
                            <div style={{ fontSize: 13, marginTop: 6 }}>Tap "Add POD" to upload a proof of delivery photo</div>
                            <div style={{ fontSize: 11, marginTop: 8, color: T.textSec, lineHeight: 1.5 }}>Accepts photos from your camera roll or take a new photo directly</div>
                        </div>
                    ) : tPods.map(pod => (
                        <div key={pod.id} style={{ background: T.card, borderRadius: 14, marginBottom: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                            {confirmPodId === pod.id ? (
                                <div style={{ background: '#FEF2F2', padding: '14px 16px' }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#DC2626', marginBottom: 8 }}>🗑️ Delete "{pod.label}"?</div>
                                    <div style={{ fontSize: 11, color: '#64748B', marginBottom: 10 }}>This cannot be undone.</div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button onClick={() => delPod(pod.id)} style={{ flex: 1, background: '#DC2626', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Yes, Delete</button>
                                        <button onClick={() => setConfirmPodId(null)} style={{ flex: 1, background: T.border, color: T.text, border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Thumbnail — tap to fullscreen */}
                                    <div onClick={() => setViewPod(pod)} style={{ cursor: 'pointer', position: 'relative' }}>
                                        <img src={pod.data} alt={pod.label} style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
                                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent,rgba(0,0,0,.55))', padding: '20px 12px 8px' }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{pod.label}</div>
                                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.75)', marginTop: 2 }}>{pod.date}</div>
                                        </div>
                                        <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,.4)', borderRadius: 6, padding: '3px 8px', fontSize: 10, color: '#fff', fontWeight: 600 }}>Tap to view</div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 12px', borderTop: `1px solid ${T.border}` }}>
                                        <button onClick={() => setConfirmPodId(pod.id)} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>🗑️ Delete</button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </>)}

        </div>
    );
}

// ═══════════════════════════ REPORTS ═════════════════════════════
function Reports({ trips, expenses }) {
    const { T } = useT();
    const byType = useMemo(() => { const m = {}; EXPENSE_TYPES.forEach(t => m[t] = 0); expenses.forEach(e => { m[e.expense_type || 'Other'] = (m[e.expense_type || 'Other'] || 0) + (parseFloat(e.amount) || 0); }); return m; }, [expenses]);
    const total = useMemo(() => expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0), [expenses]);
    const tMi = useMemo(() => trips.reduce((s, t) => s + (parseFloat(t.distance) || 0), 0), [trips]);
    const cpm = tMi > 0 ? total / tMi : 0;
    const bySt = useMemo(() => { const m = { 'In Progress': 0, Completed: 0, Cancelled: 0 }; trips.forEach(t => m[t.status || 'In Progress']++); return m; }, [trips]);
    return (
        <div style={{ flex: 1, overflowY: 'auto', background: T.bg, paddingBottom: 24 }}>
            <div style={{ background: T.primary, padding: '20px 20px 28px' }}><div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>Reports & Analytics</div><div style={{ fontSize: 13, color: 'rgba(255,255,255,.8)', marginTop: 4 }}>Financial summary of all trips</div></div>
            <div style={{ margin: 16, background: T.card, borderRadius: 16, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,.07)' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 16 }}>Key Metrics</div>
                <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                    <div><div style={{ fontSize: 22, fontWeight: 800, color: T.primary }}>{trips.length}</div><div style={{ fontSize: 12, color: T.textSec, marginTop: 4 }}>Total Trips</div></div>
                    <div style={{ width: 1, background: T.border }} />
                    <div><div style={{ fontSize: 22, fontWeight: 800, color: '#DC2626' }}>${total.toFixed(0)}</div><div style={{ fontSize: 12, color: T.textSec, marginTop: 4 }}>Total Cost</div></div>
                    <div style={{ width: 1, background: T.border }} />
                    <div><div style={{ fontSize: 22, fontWeight: 800, color: '#059669' }}>${cpm.toFixed(2)}</div><div style={{ fontSize: 12, color: T.textSec, marginTop: 4 }}>Cost/Mile</div></div>
                </div>
            </div>
            <div style={{ margin: '0 16px 16px', background: T.card, borderRadius: 16, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,.07)' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 16 }}>Expense Breakdown</div>
                {EXPENSE_TYPES.map(type => {
                    const val = byType[type] || 0; const pct = total > 0 ? (val / total * 100) : 0; const col = EXPENSE_COLORS[type] || '#6B7280'; return (
                        <div key={type} style={{ marginBottom: 14 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 28, height: 28, borderRadius: 14, background: col + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{EXPENSE_ICONS[type]}</div><span style={{ fontSize: 14, color: T.text, fontWeight: 500 }}>{type}</span></div>
                                <div style={{ textAlign: 'right' }}><div style={{ fontSize: 14, fontWeight: 700, color: col }}>${val.toFixed(2)}</div><div style={{ fontSize: 11, color: T.textSec }}>{pct.toFixed(1)}%</div></div>
                            </div>
                            <div style={{ height: 6, background: T.border, borderRadius: 3, overflow: 'hidden' }}><div style={{ height: 6, background: col, borderRadius: 3, width: `${pct}%`, transition: 'width .5s ease' }} /></div>
                        </div>
                    );
                })}
            </div>
            <div style={{ margin: '0 16px 16px', background: T.card, borderRadius: 16, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,.07)' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 16 }}>Trip Status Breakdown</div>
                <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                    {TRIP_STATUSES.map(s => {
                        const col = STATUS_COLORS[s] || '#6B7280'; return (
                            <div key={s} style={{ textAlign: 'center', flex: 1 }}>
                                <div style={{ width: 50, height: 50, borderRadius: 25, border: `2px solid ${col}`, background: col + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontSize: 20, fontWeight: 800, color: col }}>{bySt[s] || 0}</div>
                                <div style={{ fontSize: 11, color: T.textSec }}>{s}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════ SETTINGS ════════════════════════════
function Settings({ vc, setVc, navigate }) {
    const { T, dark, toggle, useKm, toggleUnits, useLiters, toggleFuelUnits } = useT();
    function Row({ em, bg, label, sub, onPr, right }) {
        return (<div onClick={onPr} style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${T.border}`, cursor: onPr ? 'pointer' : 'default', background: T.card }}><div style={{ width: 36, height: 36, borderRadius: 10, background: (bg || T.primary) + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 14, fontSize: 18 }}>{em}</div><div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 500, color: T.text }}>{label}</div>{sub && <div style={{ fontSize: 12, color: T.textSec, marginTop: 2 }}>{sub}</div>}</div>{right || <span style={{ color: T.textSec, fontSize: 18 }}>›</span>}</div>);
    }
    function Tog({ on, fn }) { return (<div onClick={fn} style={{ width: 46, height: 26, borderRadius: 13, background: on ? T.primary : T.border, display: 'flex', alignItems: 'center', padding: 2, justifyContent: on ? 'flex-end' : 'flex-start', cursor: 'pointer', transition: 'background .2s', flexShrink: 0 }}><div style={{ width: 22, height: 22, borderRadius: 11, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} /></div>); }
    const sec = (t) => <div style={{ padding: '20px 20px 8px' }}><div style={{ fontSize: 12, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: 1 }}>{t}</div></div>;
    return (
        <div style={{ flex: 1, overflowY: 'auto', background: T.bg, paddingBottom: 24 }}>
            <div style={{ background: T.primary, padding: '20px 20px 30px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <button onClick={() => navigate && navigate('Dashboard')} style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>← Back</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 28, background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🚛</div>
                    <div><div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>TripLog</div><div style={{ fontSize: 13, color: 'rgba(255,255,255,.8)' }}>Trucking Management App</div></div>
                </div>
            </div>
            {sec('Preferences')}
            <div style={{ margin: '0 16px 20px', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,.05)' }}>
                <Row em="🌙" bg="#7C3AED" label="Dark Mode" sub={dark ? 'Currently enabled' : 'Currently disabled'} onPr={toggle} right={<Tog on={dark} fn={toggle} />} />
                <Row em="🔔" bg="#F59E0B" label="Notifications" sub="Manage alerts and reminders" />
                <Row em="📏" bg="#0891B2" label="Distance Units" sub={useKm ? 'Kilometers (km)' : 'Miles (mi)'} onPr={toggleUnits} right={<Tog on={useKm} fn={toggleUnits} />} />
                <Row em="⛽" bg="#059669" label="Fuel Units" sub={useLiters ? 'Litres — shows L/100km as primary' : 'Gallons — shows MPG as primary'} onPr={toggleFuelUnits} right={<Tog on={useLiters} fn={toggleFuelUnits} />} />
            </div>
            {sec('App Info')}
            <div style={{ margin: '0 16px 20px', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,.05)' }}>
                <Row em="ℹ️" bg="#1E40AF" label="About TripLog" sub="Version 1.0.0" />
                <Row em="❓" bg="#059669" label="Help & Support" sub="FAQs and contact info" />
                <Row em="🔒" bg="#DC2626" label="Privacy Policy" />
            </div>
            <div style={{ margin: '0 16px', background: '#FEF2F2', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 28 }}>🚛</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1E293B', marginTop: 8 }}>TripLog - Trucking Made Easy</div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Track trips, manage expenses, stay profitable.</div>
            </div>
        </div>
    );
}

// ═══════════════════════════ TAB BAR ═════════════════════════════
function TabBar({ active, onPress, T }) {
    const tabs = [
        { k: 'Dashboard', i: '📊', l: 'Home' },
        { k: 'Trips', i: '🚛', l: 'Trips' },
        { k: 'Vehicles', i: '🔧', l: 'Fleet' },
        { k: 'Reports', i: '📈', l: 'Reports' },
    ];
    return (
        <div style={{ display: 'flex', background: T.card, borderTop: `1px solid ${T.border}`, boxShadow: '0 -2px 12px rgba(0,0,0,.08)', flexShrink: 0, zIndex: 50, paddingBottom: 'env(safe-area-inset-bottom,0px)' }}>
            {tabs.map(tab => (
                <button key={tab.k} onClick={() => onPress(tab.k)}
                    style={{ flex: 1, paddingTop: 8, paddingBottom: 6, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, minHeight: 52, WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}>
                    <span style={{ fontSize: 20 }}>{tab.i}</span>
                    <span style={{ fontSize: 9, fontWeight: 600, color: active === tab.k ? T.primary : '#94A3B8' }}>{tab.l}</span>
                </button>
            ))}
        </div>
    );
}

// ═══════════════════════════ APP INNER ═══════════════════════════
function AppInner() {
    const { T } = useT();
    const [trips, setTrips] = useLocalStorage('tl_trips', INIT_TRIPS);
    const [expenses, setExpenses] = useLocalStorage('tl_expenses', INIT_EXPENSES);
    const [vehicles, setVehicles] = useLocalStorage('tl_vehicles', []);
    const [trailers, setTrailers] = useLocalStorage('tl_trailers', []);
    const [pods, setPods] = useLocalStorage('tl_pods', []);
    const [vc, setVc] = useLocalStorage('tl_vc', { unit_number: '', vehicle_type: '', fuel_tank_capacity: '', driver_name: '' });
    const [stack, setStack] = useState(['Dashboard']);
    const [selId, setSelId] = useState(null);
    const [tripsFilter, setTripsFilter] = useState('All');
    const cur = stack[stack.length - 1];
    const activeTab = [...stack].reverse().find(s => s !== 'TripDetail') || 'Dashboard';
    function nav(screen, params) {
        if (screen === 'TripDetail') { setSelId(params.tripId); setStack(p => [...p, 'TripDetail']); }
        else {
            if (screen === 'Trips' && params?.filter) setTripsFilter(params.filter);
            else if (screen === 'Trips') setTripsFilter('All');
            setStack([screen]);
        }
    }
    function goBack() { if (stack.length > 1) setStack(p => p.slice(0, -1)); }

    function saveTrip(data) {
        if (data.trailer_number && data.trailer_number.trim()) {
            const num = data.trailer_number.trim().toUpperCase();
            setTrailers(ts => {
                const exists = ts.some(t => t.unit_number.toUpperCase() === num);
                if (exists) return ts;
                return [...ts, { id: Date.now(), unit_number: num }];
            });
        }
        if (data.status === 'In Progress' && data.vehicle_id) {
            const conflict = trips.find(t =>
                String(t.vehicle_id) === String(data.vehicle_id) &&
                t.status === 'In Progress' &&
                (!data.id || t.id !== data.id)
            );
            if (conflict) {
                alert(`⚠️ Vehicle already has a trip In Progress:\n"${conflict.trip_number} — ${conflict.origin} → ${conflict.destination}"\n\nMark that trip Completed before starting a new one.`);
                return false;
            }
        }
        return true;
    }
    return (
        <>
            <style>{`
  html,body{margin:0;padding:0;height:100%;overflow:hidden;overscroll-behavior:none;-webkit-overflow-scrolling:touch;}
  #root{position:fixed;top:0;left:0;right:0;bottom:0;overflow:hidden;}
  *{touch-action:manipulation;-webkit-tap-highlight-color:transparent;}
  button{-webkit-user-select:none;user-select:none;}
`}</style>
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif", maxWidth: 430, margin: '0 auto', background: T.bg, overflow: 'hidden', paddingTop: 'env(safe-area-inset-top,0px)' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                    {cur === 'Dashboard' && <Dashboard trips={trips} expenses={expenses} navigate={nav} />}
                    {cur === 'Trips' && <Trips trips={trips} setTrips={setTrips} navigate={nav} vehicles={vehicles} initialFilter={tripsFilter} onSaveTrip={saveTrip} />}
                    {cur === 'Vehicles' && <Vehicles vehicles={vehicles} setVehicles={setVehicles} trailers={trailers} setTrailers={setTrailers} />}
                    {cur === 'Reports' && <Reports trips={trips} expenses={expenses} />}
                    {cur === 'Settings' && <Settings vc={vc} setVc={setVc} navigate={nav} />}
                    {cur === 'TripDetail' && <TripDetail tripId={selId} trips={trips} expenses={expenses} setExpenses={setExpenses} pods={pods} setPods={setPods} goBack={goBack} />}
                </div>
                {cur !== 'TripDetail' && <TabBar active={activeTab} onPress={nav} T={T} />}
            </div>
        </>
    );
}

export default function App() {
    return <ThemeProvider><AppInner /></ThemeProvider>;
}