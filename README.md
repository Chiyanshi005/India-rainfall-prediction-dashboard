# India Rainfall Analytics & Predictive Dashboard

An interactive dashboard for analysing historical rainfall patterns across India using IMD rainfall data from **1901–2015**, with district-level climatological analysis and statistical forecasting.

## 📊 Project Overview

The **India Rainfall Analytics & Predictive Dashboard** provides an interactive way to explore long-term rainfall patterns across India.

The dashboard combines historical rainfall data with district-level climatological normals to support:

* Historical rainfall trend analysis
* Monthly and seasonal rainfall analysis
* Subdivision-level comparison
* District-level climatological analysis
* Wettest and driest region identification
* Statistical rainfall forecasting
* Interactive filtering and data exploration

## 📁 Dataset

The project uses Indian rainfall datasets covering historical and climatological information.

### Historical Rainfall Dataset

* Period: **1901–2015**
* Includes annual, monthly and seasonal rainfall measurements
* Covers multiple meteorological subdivisions across India

### District Rainfall Normal Dataset

* **641 districts**
* Monthly, seasonal and annual rainfall normals

## 📈 Dashboard Features

### Historical Trends

Visualises long-term annual rainfall patterns and identifies changes across the historical period.

### Monthly & Seasonal Dynamics

Provides analysis of monthly rainfall distribution and major seasonal patterns, including the Southwest Monsoon.

### Subdivision Comparison

Allows comparison of rainfall patterns across Indian meteorological subdivisions.

### District Climatological Normals

Provides district-level rainfall normals and highlights the wettest and driest districts.

### Predictive Modelling

The dashboard includes statistical rainfall projections based on the historical 1901–2015 dataset.

The forecasting section includes:

* OLS linear extrapolation
* Historical baseline statistics
* Forecast horizon
* Confidence interval
* R² and RMSE metrics
* IMD rainfall category interpretation

> **Important:** The historical dataset ends in 2015. Forecast values beyond 2015 are model-based statistical projections and should not be interpreted as guaranteed future rainfall values.

## 🛠️ Technologies Used

* HTML5
* CSS3
* JavaScript
* Python
* Chart.js
* Statistical forecasting
* IMD rainfall datasets
* Clario AI-assisted development
* Antigravity IDE

## 📂 Project Structure

```text
India-rainfall-prediction-dashboard/
│
├── assets/
├── data/
│   ├── datasets/
│   ├── rainfall_data.js
│   └── rainfall_data.json
│
├── projects/
├── scripts/
│   └── process_rainfall_data.py
│
├── app.js
├── index.html
├── index.css
├── .gitignore
└── README.md
```

## 🚀 Running the Dashboard

1. Clone the repository:

```bash
git clone https://github.com/Chiyanshi005/India-rainfall-prediction-dashboard.git
```

2. Open the project folder.

3. Launch `index.html` using a local web server.

4. Explore the interactive dashboard and its analytical tabs.

## 🎯 Project Objective

The objective of this project is to transform historical Indian rainfall data into an interactive analytical dashboard that makes climate patterns, regional differences and statistical rainfall projections easier to explore and understand.

## 👩‍💻 Author

**Chiyanshi Dhanotiya**

GitHub:
https://github.com/Chiyanshi005

## 📌 Disclaimer

This dashboard is an academic/project-based analytical application. Forecasts are statistical model-based projections derived from the available historical dataset and should not be treated as official meteorological predictions.
