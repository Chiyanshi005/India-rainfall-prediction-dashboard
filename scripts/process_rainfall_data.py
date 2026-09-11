"""
Data Preprocessing Pipeline for India Rainfall Analysis and Prediction Dashboard.
Processes:
1. 'rainfall in india 1901-2015.csv' (Historical 115-year meteorological subdivisions)
2. 'district wise rainfall normal.csv' (Climatological normals for 641 districts across 35 States/UTs)

Computes statistical summaries, OLS regression models, seasonal shares, decadal baselines,
and exports an optimized JSON and JS data module for instant frontend performance.
"""

import csv
import json
import math
import os
from collections import defaultdict

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HISTORICAL_CSV = os.path.join(BASE_DIR, 'projects', 'india_rainfall_prediction_dashboard', 'sources', 'rainfall in india 1901-2015.csv')
DISTRICT_CSV = os.path.join(BASE_DIR, 'projects', 'india_rainfall_prediction_dashboard', 'sources', 'district wise rainfall normal.csv')
OUTPUT_DIR = os.path.join(BASE_DIR, 'data')
os.makedirs(OUTPUT_DIR, exist_ok=True)

MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
SEASONS = ['Jan-Feb', 'Mar-May', 'Jun-Sep', 'Oct-Dec']
SEASON_LABELS = {
    'Jan-Feb': 'Winter (Jan–Feb)',
    'Mar-May': 'Pre-Monsoon / Summer (Mar–May)',
    'Jun-Sep': 'Southwest Monsoon (Jun–Sep)',
    'Oct-Dec': 'Post-Monsoon (Oct–Dec)'
}

def to_float(val):
    if val is None:
        return None
    val_str = str(val).strip().upper()
    if val_str in ('', 'NA', 'NAN', 'NULL', 'NONE'):
        return None
    try:
        return round(float(val_str), 2)
    except:
        return None

def compute_ols_regression(x_vals, y_vals):
    """Compute Ordinary Least Squares (OLS) slope, intercept, R2, RMSE, s_e, and parameters for out-of-sample prediction intervals."""
    n = len(x_vals)
    if n < 2:
        return {'slope': 0, 'intercept': 0, 'r2': 0, 'rmse': 0, 's_e': 0, 'x_mean': 0, 'sum_x_sq': 0, 'n': 0}
    x_mean = sum(x_vals) / n
    y_mean = sum(y_vals) / n
    numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(x_vals, y_vals))
    denominator = sum((x - x_mean) ** 2 for x in x_vals)
    if denominator == 0:
        return {'slope': 0, 'intercept': round(y_mean, 2), 'r2': 0, 'rmse': 0, 's_e': 0, 'x_mean': x_mean, 'sum_x_sq': 0, 'n': n}
    slope = numerator / denominator
    intercept = y_mean - slope * x_mean
    residuals = [y - (intercept + slope * x) for x, y in zip(x_vals, y_vals)]
    ss_tot = sum((y - y_mean) ** 2 for y in y_vals)
    ss_res = sum(r ** 2 for r in residuals)
    rmse = math.sqrt(ss_res / n)
    s_e = math.sqrt(ss_res / (n - 2)) if n > 2 else rmse
    r2 = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
    return {
        'slope': round(slope, 4),
        'intercept': round(intercept, 2),
        'r2': round(max(0, r2), 6),
        'rmse': round(rmse, 2),
        's_e': round(s_e, 2),
        'x_mean': round(x_mean, 2),
        'sum_x_sq': round(denominator, 2),
        'n': n
    }

def process_historical():
    print(f"Reading historical CSV: {HISTORICAL_CSV}")
    with open(HISTORICAL_CSV, 'r', encoding='utf-8') as f:
        rows = list(csv.DictReader(f))

    # Clean rows & build subdivision mapping
    subdivision_raw = defaultdict(list)
    for r in rows:
        sub = r['SUBDIVISION'].strip()
        year = int(r['YEAR'].strip())
        
        # Monthly values
        month_vals = {}
        for m in MONTHS:
            month_vals[m] = to_float(r.get(m))
            
        # Annual and seasonal
        ann = to_float(r.get('ANNUAL'))
        s_vals = {s: to_float(r.get(s)) for s in SEASONS}
        
        subdivision_raw[sub].append({
            'year': year,
            'months': month_vals,
            'annual': ann,
            'seasons': s_vals
        })

    # Impute missing values with subdivision-specific monthly medians/means
    # First calculate subdivision month averages
    sub_month_means = {}
    for sub, entries in subdivision_raw.items():
        m_sums = {m: [] for m in MONTHS}
        for e in entries:
            for m in MONTHS:
                if e['months'][m] is not None:
                    m_sums[m].append(e['months'][m])
        sub_month_means[sub] = {m: sum(vals)/len(vals) if vals else 0.0 for m, vals in m_sums.items()}

    # Impute any missing month and recalculate missing annual / seasonal if needed
    for sub, entries in subdivision_raw.items():
        for e in entries:
            for m in MONTHS:
                if e['months'][m] is None:
                    e['months'][m] = round(sub_month_means[sub][m], 2)
            # Check seasons
            if e['seasons']['Jan-Feb'] is None:
                e['seasons']['Jan-Feb'] = round(e['months']['JAN'] + e['months']['FEB'], 2)
            if e['seasons']['Mar-May'] is None:
                e['seasons']['Mar-May'] = round(e['months']['MAR'] + e['months']['APR'] + e['months']['MAY'], 2)
            if e['seasons']['Jun-Sep'] is None:
                e['seasons']['Jun-Sep'] = round(e['months']['JUN'] + e['months']['JUL'] + e['months']['AUG'] + e['months']['SEP'], 2)
            if e['seasons']['Oct-Dec'] is None:
                e['seasons']['Oct-Dec'] = round(e['months']['OCT'] + e['months']['NOV'] + e['months']['DEC'], 2)
            # Check annual
            if e['annual'] is None:
                e['annual'] = round(sum(e['months'][m] for m in MONTHS), 2)

    # Sort each subdivision by year
    for sub in subdivision_raw:
        subdivision_raw[sub].sort(key=lambda x: x['year'])

    # Build national aggregate time series (1901-2015)
    all_years = sorted(list(set(e['year'] for entries in subdivision_raw.values() for e in entries)))
    national_timeseries = []
    
    for y in all_years:
        y_ann_vals = [e['annual'] for entries in subdivision_raw.values() for e in entries if e['year'] == y]
        y_months = {m: [e['months'][m] for entries in subdivision_raw.values() for e in entries if e['year'] == y] for m in MONTHS}
        y_seasons = {s: [e['seasons'][s] for entries in subdivision_raw.values() for e in entries if e['year'] == y] for s in SEASONS}
        
        ann_mean = round(sum(y_ann_vals) / len(y_ann_vals), 2)
        month_means = {m: round(sum(vals)/len(vals), 2) for m, vals in y_months.items()}
        season_means = {s: round(sum(vals)/len(vals), 2) for s, vals in y_seasons.items()}
        
        national_timeseries.append({
            'year': y,
            'annual': ann_mean,
            'months': month_means,
            'seasons': season_means
        })

    # Calculate 5-year rolling average for national series
    for i, item in enumerate(national_timeseries):
        window = national_timeseries[max(0, i-4):i+1]
        roll_5 = sum(w['annual'] for w in window) / len(window)
        item['rolling_5yr'] = round(roll_5, 2)

    # National LPA (Long Period Average)
    national_lpa = round(sum(n['annual'] for n in national_timeseries) / len(national_timeseries), 2)
    for n in national_timeseries:
        departure = ((n['annual'] - national_lpa) / national_lpa) * 100
        n['departure_pct'] = round(departure, 2)
        # Official IMD All-India Category Thresholds
        if departure > 10.0:
            n['imd_status'] = 'Excess'
        elif departure >= -10.0:
            n['imd_status'] = 'Normal'
        elif departure >= -29.0:
            n['imd_status'] = 'Deficient'
        else:
            n['imd_status'] = 'Scanty / Drought'

    # Compute regression for national
    x_nat = [n['year'] for n in national_timeseries]
    y_nat = [n['annual'] for n in national_timeseries]
    national_regression = compute_ols_regression(x_nat, y_nat)

    # National Holt's linear exponential smoothing parameters at terminal year (2015)
    alpha = 0.2
    beta = 0.1
    L_nat = national_timeseries[0]['annual']
    T_nat = national_timeseries[1]['annual'] - national_timeseries[0]['annual']
    for row in national_timeseries[1:]:
        last_L = L_nat
        L_nat = alpha * row['annual'] + (1 - alpha) * (L_nat + T_nat)
        T_nat = beta * (L_nat - last_L) + (1 - beta) * T_nat
    
    # National 10-Year Rolling MA (2006-2015 terminal decade mean)
    recent_10_nat = [n['annual'] for n in national_timeseries if n['year'] >= 2006]
    ma10_nat = round(sum(recent_10_nat) / len(recent_10_nat), 2)

    # Compute Decadal Averages for national
    decades = defaultdict(list)
    for n in national_timeseries:
        dec_label = f"{(n['year'] // 10) * 10}s"
        decades[dec_label].append(n['annual'])
    national_decades = [{'decade': d, 'mean_annual': round(sum(vals)/len(vals), 2), 'count': len(vals)} for d, vals in sorted(decades.items())]

    # Process each subdivision statistics
    subdivision_profiles = {}
    for sub, entries in subdivision_raw.items():
        ann_vals = [e['annual'] for e in entries]
        years = [e['year'] for e in entries]
        lpa = round(sum(ann_vals) / len(ann_vals), 2)
        
        # OLS regression for subdivision
        reg = compute_ols_regression(years, ann_vals)

        # Holt's linear parameters at T=2015
        L_sub = entries[0]['annual']
        T_sub = entries[1]['annual'] - entries[0]['annual']
        for row in entries[1:]:
            last_L = L_sub
            L_sub = alpha * row['annual'] + (1 - alpha) * (L_sub + T_sub)
            T_sub = beta * (L_sub - last_L) + (1 - beta) * T_sub

        # 10-Year Rolling MA (2006-2015 terminal decade mean)
        recent_10_sub = [e['annual'] for e in entries if e['year'] >= 2006]
        ma10_sub = round(sum(recent_10_sub) / len(recent_10_sub), 2)
        
        # Monthly averages and normalized weights
        m_avgs = {}
        m_mins = {}
        m_maxs = {}
        for m in MONTHS:
            m_list = [e['months'][m] for e in entries]
            m_avgs[m] = round(sum(m_list) / len(m_list), 2)
            m_mins[m] = round(min(m_list), 2)
            m_maxs[m] = round(max(m_list), 2)

        sum_m = sum(m_avgs.values())
        m_weights = {m: round(m_avgs[m] / sum_m, 5) for m in MONTHS} if sum_m > 0 else {m: 1/12 for m in MONTHS}

        # Seasonal averages
        s_avgs = {}
        for s in SEASONS:
            s_list = [e['seasons'][s] for e in entries]
            s_avgs[s] = round(sum(s_list) / len(s_list), 2)

        # Extreme years
        max_entry = max(entries, key=lambda x: x['annual'])
        min_entry = min(entries, key=lambda x: x['annual'])

        # Decadal averages for subdivision
        sub_decades = defaultdict(list)
        for e in entries:
            d_lbl = f"{(e['year'] // 10) * 10}s"
            sub_decades[d_lbl].append(e['annual'])
        decadal_summary = [{'decade': d, 'mean_annual': round(sum(vals)/len(vals), 2)} for d, vals in sorted(sub_decades.items())]

        # Add rolling averages and departures to annual entries
        for i, e in enumerate(entries):
            win = entries[max(0, i-4):i+1]
            e['rolling_5yr'] = round(sum(w['annual'] for w in win) / len(win), 2)
            e['departure_pct'] = round(((e['annual'] - lpa) / lpa) * 100, 2)
            # Official IMD Subdivision Category Thresholds
            if e['departure_pct'] >= 20.0:
                e['imd_status'] = 'Excess'
            elif e['departure_pct'] >= -19.0:
                e['imd_status'] = 'Normal'
            elif e['departure_pct'] >= -59.0:
                e['imd_status'] = 'Deficient'
            else:
                e['imd_status'] = 'Scanty / Drought'

        # Standard Deviation and Coefficient of Variation (CV)
        variance = sum((x - lpa) ** 2 for x in ann_vals) / len(ann_vals)
        std_dev = math.sqrt(variance)
        cv = round((std_dev / lpa) * 100, 2) if lpa > 0 else 0

        subdivision_profiles[sub] = {
            'lpa': lpa,
            'std_dev': round(std_dev, 2),
            'cv': cv,
            'regression': reg,
            'holt_params': {'L_2015': round(L_sub, 2), 'T_2015': round(T_sub, 2)},
            'ma10_terminal': ma10_sub,
            'monthly_avg': m_avgs,
            'monthly_weights': m_weights,
            'monthly_min': m_mins,
            'monthly_max': m_maxs,
            'seasonal_avg': s_avgs,
            'monsoon_share_pct': round((s_avgs['Jun-Sep'] / lpa) * 100, 2) if lpa > 0 else 0,
            'max_year': {'year': max_entry['year'], 'rainfall': max_entry['annual']},
            'min_year': {'year': min_entry['year'], 'rainfall': min_entry['annual']},
            'decades': decadal_summary,
            'timeseries': entries
        }

    return {
        'all_years': all_years,
        'subdivisions': sorted(list(subdivision_raw.keys())),
        'national_lpa': national_lpa,
        'national_regression': national_regression,
        'national_holt': {'L_2015': round(L_nat, 2), 'T_2015': round(T_nat, 2)},
        'national_ma10': ma10_nat,
        'national_decades': national_decades,
        'national_timeseries': national_timeseries,
        'subdivision_profiles': subdivision_profiles
    }

def process_districts():
    print(f"Reading district CSV: {DISTRICT_CSV}")
    with open(DISTRICT_CSV, 'r', encoding='utf-8') as f:
        rows = list(csv.DictReader(f))

    districts = []
    state_groups = defaultdict(list)

    for r in rows:
        state = r['STATE_UT_NAME'].strip()
        dist_name = r['DISTRICT'].strip()
        ann = to_float(r['ANNUAL'])
        
        m_vals = {m: to_float(r[m]) for m in MONTHS}
        s_vals = {s: to_float(r[s]) for s in SEASONS}

        dist_obj = {
            'state': state,
            'district': dist_name,
            'annual': ann,
            'months': m_vals,
            'seasons': s_vals,
            'monsoon_share': round((s_vals['Jun-Sep'] / ann) * 100, 1) if ann and ann > 0 else 0
        }
        districts.append(dist_obj)
        state_groups[state].append(dist_obj)

    # Sort districts overall
    districts.sort(key=lambda x: x['annual'], reverse=True)
    for i, d in enumerate(districts, 1):
        d['all_india_rank'] = i

    # State summaries
    state_summaries = {}
    for state, d_list in sorted(state_groups.items()):
        d_list.sort(key=lambda x: x['annual'], reverse=True)
        for j, item in enumerate(d_list, 1):
            item['state_rank'] = j
        mean_ann = round(sum(d['annual'] for d in d_list) / len(d_list), 2)
        state_summaries[state] = {
            'district_count': len(d_list),
            'mean_annual': mean_ann,
            'wettest_district': {'name': d_list[0]['district'], 'annual': d_list[0]['annual']},
            'driest_district': {'name': d_list[-1]['district'], 'annual': d_list[-1]['annual']}
        }

    return {
        'states': sorted(list(state_groups.keys())),
        'total_districts': len(districts),
        'state_summaries': state_summaries,
        'districts': districts
    }

def main():
    historical_data = process_historical()
    district_data = process_districts()

    combined_payload = {
        'metadata': {
            'title': 'India Meteorological Rainfall Analytics & Predictive Dashboard Data',
            'years': f"{min(historical_data['all_years'])}-{max(historical_data['all_years'])}",
            'total_subdivisions': len(historical_data['subdivisions']),
            'total_districts': district_data['total_districts'],
            'total_states': len(district_data['states']),
            'months': MONTHS,
            'seasons': SEASONS,
            'season_labels': SEASON_LABELS
        },
        'historical': historical_data,
        'districts_data': district_data
    }

    # Write JSON
    json_path = os.path.join(OUTPUT_DIR, 'rainfall_data.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(combined_payload, f, separators=(',', ':'))
    print(f"Exported JSON to: {json_path} (Size: {os.path.getsize(json_path)/1024:.1f} KB)")

    # Write JS file for zero-cors, instant browser loading
    js_path = os.path.join(OUTPUT_DIR, 'rainfall_data.js')
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write("window.RAINFALL_DATA = ")
        json.dump(combined_payload, f, separators=(',', ':'))
        f.write(";")
    print(f"Exported JS to: {js_path} (Size: {os.path.getsize(js_path)/1024:.1f} KB)")

    # Print validation verification stats
    print("\n--- Validation Statistics ---")
    print(f"National LPA: {historical_data['national_lpa']} mm")
    print(f"OLS Slope: {historical_data['national_regression']['slope']} mm/yr, R2: {historical_data['national_regression']['r2']}")
    print(f"Top 3 Subdivisions: {[s for s in sorted(historical_data['subdivisions'], key=lambda x: historical_data['subdivision_profiles'][x]['lpa'], reverse=True)[:3]]}")
    print(f"Top 3 Wettest Districts: {[d['district'] + ' (' + str(d['annual']) + ' mm)' for d in district_data['districts'][:3]]}")
    print(f"Top 3 Driest Districts: {[d['district'] + ' (' + str(d['annual']) + ' mm)' for d in district_data['districts'][-3:]]}")

if __name__ == '__main__':
    main()
