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

// ── Manual save form — shown when city not found ──────────────────
function ManualSaveForm({ value, T, onSave }) {
    const q = value.trim();
    const comma = q.lastIndexOf(',');
    const defaultName = comma > 0 ? q.slice(0, comma).trim() : q;
    const defaultProv = comma > 0 ? q.slice(comma + 1).trim().toUpperCase().slice(0, 2) : '';
    const [name, setName] = useState(defaultName);
    const [prov, setProv] = useState(defaultProv);
    const [lat, setLat] = useState('');
    const [lon, setLon] = useState('');
    const inpSt = { border: '1px solid ' + T.border, borderRadius: 7, padding: '7px 10px', fontSize: 13, color: T.text, background: T.bg, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };
    function doSave(e) { e.preventDefault(); if (!name.trim()) return; onSave(name, prov, lat, lon); }
    return (
        <div style={{ padding: '12px 14px', borderBottom: '1px solid ' + T.border }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.textSec, marginBottom: 8, textTransform: 'uppercase', letterSpacing: .4 }}>
                📍 Save to my cities
            </div>
            {/* City name + Province */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <div style={{ flex: 2 }}>
                    <div style={{ fontSize: 10, color: T.textSec, marginBottom: 3 }}>City Name</div>
                    <input value={name} onChange={function (e) { setName(e.target.value); }} placeholder="e.g. Ingersoll" style={inpSt} />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: T.textSec, marginBottom: 3 }}>Province/State</div>
                    <input value={prov} onChange={function (e) { setProv(e.target.value.toUpperCase().slice(0, 2)); }} placeholder="ON" style={inpSt} maxLength={2} />
                </div>
            </div>
            {/* Optional lat / lon */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: T.textSec, marginBottom: 3 }}>Latitude <span style={{ color: T.textSec, fontWeight: 400 }}>(optional)</span></div>
                    <input value={lat} onChange={function (e) { setLat(e.target.value.replace(/[^0-9.\-]/g, '')); }} placeholder="e.g. 43.04" style={inpSt} inputMode="decimal" />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: T.textSec, marginBottom: 3 }}>Longitude <span style={{ color: T.textSec, fontWeight: 400 }}>(optional)</span></div>
                    <input value={lon} onChange={function (e) { setLon(e.target.value.replace(/[^0-9.\-]/g, '')); }} placeholder="e.g. -80.88" style={inpSt} inputMode="decimal" />
                </div>
            </div>
            <div style={{ fontSize: 10, color: T.textSec, marginBottom: 8, lineHeight: 1.4 }}>
                💡 Lat/Lon is optional — find it on <b>Google Maps</b> by long-pressing your city. More accurate = better distance calculation.
            </div>
            <button onMouseDown={doSave} onTouchEnd={function (e) { e.preventDefault(); doSave(e); }}
                style={{ width: '100%', background: T.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                💾 Save City
            </button>
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

function Vehicles({ vehicles, setVehicles }) {
    const { T } = useT();
    const blank = { id: null, unit_number: '', make: '', model: '', year: '', vehicle_type: 'Semi Truck', fuel_tank_capacity: '', license_plate: '', driver_name: '', notes: '' };
    const [form, setForm] = useState(blank);
    const [editing, setEditing] = useState(false);
    const [confirmDel, setConfirmDel] = useState(null);
    const [saved, setSaved] = useState(false);
    const sf = (k, v) => { setForm(p => ({ ...p, [k]: v })); setSaved(false); };

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
                <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 4 }}>🚛 Vehicles</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.8)' }}>Manage your truck fleet</div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 100px' }}>
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
            </div>
            {vehicles.length > 0 && (
                <button onClick={startNew} style={{ position: 'absolute', right: 20, bottom: 76, width: 56, height: 56, borderRadius: 28, background: T.primary, border: 'none', color: '#fff', fontSize: 28, cursor: 'pointer', boxShadow: `0 4px 16px ${T.primary}88`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>+</button>
            )}
        </div>
    );
}

// ═══════════════════════════ ADD TRIP MODAL ══════════════════════
function AddTripModal({ visible, onClose, onSave, editTrip, T, vehicles, trips }) {
    const { useKm } = useT();
    const blank = { trip_number: '', origin: '', destination: '', distance: '', pickup_date: '', delivery_date: '', notes: '', status: 'Scheduled', trip_rate: '', rate_type: 'per_mile', currency: 'CAD', vehicle_id: '' };
    const [f, setF] = useState(blank);
    const [oC, setOC] = useState(null);
    const [dC, setDC] = useState(null);
    const [gps, setGps] = useState(false);
    const [distCalced, setDistCalced] = useState(false);
    const [distLoading, setDistLoading] = useState(false);
    const [dupWarning, setDupWarning] = useState(false);

    // Auto-generate next trip number — finds highest existing numeric suffix and increments
    function nextTripNumber(existingTrips) {
        const nums = existingTrips.map(t => {
            const m = (t.trip_number || '').match(/(\d+)$/);
            return m ? parseInt(m[1], 10) : 0;
        });
        const max = nums.length ? Math.max(...nums) : 0;
        const next = max + 1;
        return `TRP-${String(next).padStart(3, '0')}`;
    }

    useEffect(() => {
        if (!visible) return;
        if (editTrip) {
            setF({ trip_number: editTrip.trip_number || '', origin: editTrip.origin || '', destination: editTrip.destination || '', distance: String(editTrip.distance || ''), pickup_date: editTrip.pickup_date || editTrip.trip_date || '', delivery_date: editTrip.delivery_date || '', notes: editTrip.notes || '', status: editTrip.status || 'In Progress', trip_rate: String(editTrip.trip_rate || ''), rate_type: editTrip.rate_type || 'per_mile', currency: editTrip.currency || 'CAD', vehicle_id: editTrip.vehicle_id || '' });
            setOC(editTrip.origin_lat ? { lat: editTrip.origin_lat, lon: editTrip.origin_lon } : null);
            setDC(editTrip.dest_lat ? { lat: editTrip.dest_lat, lon: editTrip.dest_lon } : null);
            setDistCalced(false); setDupWarning(false);
        } else {
            // Auto-fill next trip number for new trips
            const auto = nextTripNumber(trips || []);
            setF({ ...blank, trip_number: auto });
            setOC(null); setDC(null); setDistCalced(false); setDupWarning(false);
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

    function computeDriving(oCoord, dCoord) {
        const result = calcDrivingDist(oCoord.lat, oCoord.lon, dCoord.lat, dCoord.lon);
        s('distance', result.miles.toFixed(1));
        setDistCalced({ miles: result.miles, km: result.km, source: 'estimate' });
        setDistLoading(false);
    }

    const onOS = c => { setOC(c); if (dC) computeDriving(c, dC); };
    const onDS = c => { setDC(c); if (oC) computeDriving(oC, c); };

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
            if (field === 'origin') { s('origin', label); setOC({ ...co, display: label }); if (dC) computeDriving({ ...co }, dC); }
            else { s('destination', label); setDC({ ...co, display: label }); if (oC) computeDriving(oC, { ...co }); }
        }, () => setGps(false));
    }

    function save() {
        if (!f.vehicle_id) { alert('Please select a vehicle/truck for this trip.'); return; }
        if (!f.trip_number.trim()) { alert('Please enter a Trip Number.'); return; }
        if (dupWarning) { alert(`Trip number "${f.trip_number}" already exists. Please use a unique number.`); return; }
        if (!f.origin || !f.destination || !f.pickup_date) { alert('Please fill Origin, Destination, and Pickup Date.'); return; }
        const selectedVehicle = vehicles.find(v => String(v.id) === String(f.vehicle_id));
        onSave({
            trip_number: f.trip_number.trim(), origin: f.origin, destination: f.destination, distance: parseFloat(f.distance) || 0, pickup_date: f.pickup_date, delivery_date: f.delivery_date, trip_date: f.pickup_date,// keep for backward compat with dashboard/reports
            notes: f.notes, status: f.status, trip_rate: parseFloat(f.trip_rate) || 0, rate_type: f.rate_type, currency: f.currency, vehicle_id: f.vehicle_id, vehicle_label: selectedVehicle ? `${selectedVehicle.unit_number} — ${selectedVehicle.vehicle_type}` : '', origin_lat: oC?.lat || null, origin_lon: oC?.lon || null, dest_lat: dC?.lat || null, dest_lon: dC?.lon || null
        });
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
            <Lbl c={<span>Trip Number <span style={{ color: '#EF4444' }}>*</span></span>} T={T} />
            <input value={f.trip_number} onChange={e => s('trip_number', e.target.value)} placeholder="e.g. TRP-001, TRIP-2024-01, BOL#12345"
                style={{ ...iSt(T), borderColor: dupWarning ? '#EF4444' : undefined, marginBottom: dupWarning ? 4 : 12 }} />
            {dupWarning && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>⚠️ Trip #{f.trip_number} already exists</span>
                    <button onClick={() => s('trip_number', nextTripNumber(trips || []))} style={{ fontSize: 11, color: T.primary, background: 'none', border: `1px solid ${T.primary}`, borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>Use next →</button>
                </div>
            )}
            <Lbl c="Origin" T={T} />
            <PlacesAuto value={f.origin} onChange={v => { s('origin', v); if (!v) { setOC(null); setDistCalced(false); } }} placeholder="Search address or city (Canada/USA)" T={T} onSelect={onOS} />
            {gpsBtn('origin')}
            <Lbl c="Destination" T={T} />
            <PlacesAuto value={f.destination} onChange={v => { s('destination', v); if (!v) { setDC(null); setDistCalced(false); } }} placeholder="Search address or city (Canada/USA)" T={T} onSelect={onDS} />
            {gpsBtn('destination')}
            <Lbl c="Distance" T={T} />
            {distCalced && f.distance ? (
                <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>🛣️</span>
                    <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#059669' }}>{parseFloat(f.distance).toFixed(1)} miles</span>
                        <span style={{ fontSize: 12, color: '#555', marginLeft: 8 }}>({distCalced.km.toFixed(1)} km)</span>
                        <div style={{ fontSize: 11, color: '#065F46', marginTop: 2 }}>📐 Estimated driving distance</div>
                    </div>
                    <button onClick={() => { setDistCalced(false); s('distance', ''); }} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap' }}>Edit</button>
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
    const tMiRaw = useMemo(() => completedTrips.reduce((s, t) => s + (parseFloat(t.distance) || 0), 0), [completedTrips]);
    const tMi = useKm ? (tMiRaw * 1.60934) : tMiRaw;
    const tRev = useMemo(() => completedTrips.reduce((s, t) => s + calcTripRevenue(t), 0), [completedTrips]);
    const tFuel = useMemo(() => expenses.filter(e => e.expense_type === 'Fuel').reduce((s, e) => s + (parseFloat(e.amount) || 0), 0), [expenses]);
    const comp = completedTrips.length;
    const profit = mRev - mEx;
    const tProfit = tRev - tEx;

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
                <div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: T.text }}>TripLog</div>
                    <div style={{ fontSize: 14, color: T.textSec }}>Trucking Management Dashboard</div>
                </div>
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
function Trips({ trips, setTrips, navigate, vehicles, initialFilter }) {
    const { T } = useT();
    const [filter, setFilter] = useState(initialFilter || 'All');
    // Sync if parent changes initialFilter (e.g. navigating from dashboard banner)
    useEffect(() => { if (initialFilter) setFilter(initialFilter); }, [initialFilter]);
    const [show, setShow] = useState(false);
    const [edit, setEdit] = useState(null);
    const [confirmId, setConfirmId] = useState(null);
    const fColors = { All: T.primary, Scheduled: '#7C3AED', 'In Progress': '#F59E0B', Completed: '#2563EB', Cancelled: '#DC2626' };
    const STATUS_ORDER = { Scheduled: 0, 'In Progress': 1, 'Completed': 2, 'Cancelled': 3 };
    const filtered = useMemo(() => {
        const base = filter === 'All' ? trips : trips.filter(t => t.status === filter);
        return [...base].sort((a, b) => { const sa = STATUS_ORDER[a.status] ?? 2; const sb = STATUS_ORDER[b.status] ?? 2; if (sa !== sb) return sa - sb; return (b.trip_date || '').localeCompare(a.trip_date || ''); });
    }, [trips, filter]);
    function save(data) { if (edit) setTrips(ts => ts.map(t => t.id === edit.id ? { ...t, ...data } : t)); else setTrips(ts => [{ ...data, id: Date.now() }, ...ts]); setShow(false); setEdit(null); }
    function del(id) { setTrips(ts => ts.filter(t => t.id !== id)); setConfirmId(null); }
    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.bg, overflow: 'hidden' }}>
            <div style={{ background: T.primary, padding: '20px 20px 16px', flexShrink: 0 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 14 }}>My Trips</div>
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
                                            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{trip.origin || 'Unknown'} → {trip.destination || 'Unknown'}</div>
                                        </div>
                                        <span style={{ background: 'rgba(255,255,255,.25)', color: '#fff', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 10, marginLeft: 8, whiteSpace: 'nowrap', letterSpacing: .3 }}>{trip.status || 'Active'}</span>
                                    </div>
                                    <div style={{ padding: 14 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.textSec }}>
                                            <span>📅 {trip.pickup_date || trip.trip_date || 'No date'}</span>
                                            {trip.delivery_date && <span>🏁 {trip.delivery_date}</span>}
                                            <span>🛣️ {trip.distance || 0} miles</span>
                                        </div>
                                        {trip.vehicle_label && <div style={{ fontSize: 12, color: T.accent, marginTop: 5, fontWeight: 600 }}>🚛 {trip.vehicle_label}</div>}
                                        {trip.notes ? <div style={{ fontSize: 12, color: T.textSec, marginTop: 4 }}>{trip.notes}</div> : null}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px 10px', borderTop: `1px solid ${T.border}` }}>
                                    {/* ── Status dropdown ── */}
                                    <div style={{ position: 'relative' }}>
                                        <select
                                            value={trip.status || 'In Progress'}
                                            onChange={e => { e.stopPropagation(); setTrips(ts => ts.map(t => t.id === trip.id ? { ...t, status: e.target.value } : t)); }}
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
function Settings({ vc, setVc }) {
    const { T, dark, toggle, useKm, toggleUnits, useLiters, toggleFuelUnits } = useT();
    function Row({ em, bg, label, sub, onPr, right }) {
        return (<div onClick={onPr} style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${T.border}`, cursor: onPr ? 'pointer' : 'default', background: T.card }}><div style={{ width: 36, height: 36, borderRadius: 10, background: (bg || T.primary) + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 14, fontSize: 18 }}>{em}</div><div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 500, color: T.text }}>{label}</div>{sub && <div style={{ fontSize: 12, color: T.textSec, marginTop: 2 }}>{sub}</div>}</div>{right || <span style={{ color: T.textSec, fontSize: 18 }}>›</span>}</div>);
    }
    function Tog({ on, fn }) { return (<div onClick={fn} style={{ width: 46, height: 26, borderRadius: 13, background: on ? T.primary : T.border, display: 'flex', alignItems: 'center', padding: 2, justifyContent: on ? 'flex-end' : 'flex-start', cursor: 'pointer', transition: 'background .2s', flexShrink: 0 }}><div style={{ width: 22, height: 22, borderRadius: 11, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} /></div>); }
    const sec = (t) => <div style={{ padding: '20px 20px 8px' }}><div style={{ fontSize: 12, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: 1 }}>{t}</div></div>;
    return (
        <div style={{ flex: 1, overflowY: 'auto', background: T.bg, paddingBottom: 24 }}>
            <div style={{ background: T.primary, padding: '20px 20px 30px' }}>
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
    const tabs = [{ k: 'Dashboard', i: '📊', l: 'Dashboard' }, { k: 'Trips', i: '🚛', l: 'Trips' }, { k: 'Vehicles', i: '🔧', l: 'Vehicles' }, { k: 'Reports', i: '📈', l: 'Reports' }, { k: 'Settings', i: '⚙️', l: 'Settings' }];
    return (
        <div style={{ display: 'flex', background: T.card, borderTop: `1px solid ${T.border}`, boxShadow: '0 -2px 12px rgba(0,0,0,.08)', flexShrink: 0, zIndex: 50, paddingBottom: 'env(safe-area-inset-bottom)' }}>
            {tabs.map(tab => (<button key={tab.k} onClick={() => onPress(tab.k)} style={{ flex: 1, paddingTop: 10, paddingBottom: 8, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minHeight: 56 }}><span style={{ fontSize: 22 }}>{tab.i}</span><span style={{ fontSize: 10, fontWeight: 600, color: active === tab.k ? T.primary : '#94A3B8' }}>{tab.l}</span></button>))}
        </div>
    );
}

// ═══════════════════════════ APP INNER ═══════════════════════════
function AppInner() {
    const { T } = useT();
    const [trips, setTrips] = useLocalStorage('tl_trips', INIT_TRIPS);
    const [expenses, setExpenses] = useLocalStorage('tl_expenses', INIT_EXPENSES);
    const [vehicles, setVehicles] = useLocalStorage('tl_vehicles', []);
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
    return (
        <div style={{ width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', fontFamily: "'Segoe UI',system-ui,sans-serif", maxWidth: 430, margin: '0 auto', background: T.bg, overflow: 'hidden', position: 'relative', paddingTop: 'env(safe-area-inset-top)' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {cur === 'Dashboard' && <Dashboard trips={trips} expenses={expenses} navigate={nav} />}
                {cur === 'Trips' && <Trips trips={trips} setTrips={setTrips} navigate={nav} vehicles={vehicles} initialFilter={tripsFilter} />}
                {cur === 'Vehicles' && <Vehicles vehicles={vehicles} setVehicles={setVehicles} />}
                {cur === 'Reports' && <Reports trips={trips} expenses={expenses} />}
                {cur === 'Settings' && <Settings vc={vc} setVc={setVc} />}
                {cur === 'TripDetail' && <TripDetail tripId={selId} trips={trips} expenses={expenses} setExpenses={setExpenses} pods={pods} setPods={setPods} goBack={goBack} />}
            </div>
            {cur !== 'TripDetail' && <TabBar active={activeTab} onPress={nav} T={T} />}
        </div>
    );
}

export default function App() {
    return <ThemeProvider><AppInner /></ThemeProvider>;
}