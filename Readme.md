# KDT Dataset Project Overview

This directory contains data and analysis scripts related to the K-Digital Training (KDT) program. The primary goal is to process, analyze, and visualize data about various training institutions, courses, and their performance over time.

## 📂 File Descriptions

### 📊 Data Files
- **`result_kdtdata_YYYYMM.(xlsx|csv)`**: The primary datasets. Each file appears to be a snapshot of KDT program data for a specific year and month. They contain information on training courses, institutions, student enrollment, and revenue.
- **`kdt_dataset_YYYYMM.json`**: JSON formatted data, likely used for specific web dashboard components.
- **`새 Microsoft Excel 워크시트.(xlsx|csv)`**: Temporary or unorganized data files. These should be renamed for clarity.

### 🚀 Main Applications (Interactive Dashboards)
These files are interactive web applications built with Streamlit that allow users to explore the KDT data.
- **`streamlit_app_ver.1.02.py`**: The most recent and advanced version of the dashboard. It provides analysis by training institution, course, and NCS (National Competency Standards) code. It includes features to automatically group similar institution names. **This is likely the main file to run.**
- **`streamlit_app_ver.1.01.py`**: An earlier version of the dashboard.
- **`streamlit_app.py`**: A simpler, foundational version of the dashboard.
- **`app.py`**: A separate, more focused Streamlit app for analyzing a single company's performance.

### 🛠️ Analysis & Utility Scripts
- **`machinelearning_kdt.py`**: A script used for exploratory data analysis and generating plots with the Plotly library. It seems designed for internal analysis rather than a public-facing dashboard.
- **`requirements.txt`**: A list of the required Python libraries needed to run the analysis scripts.

## 🎯 Purpose of this Folder

This folder serves as the central repository for:
1.  **Storing** KDT program data from various periods.
2.  **Analyzing** the performance of training institutions and courses.
3.  **Visualizing** the data through interactive dashboards to make it understandable for stakeholders.

## 💡 Suggestions for Improvement

To make the project easier to understand and maintain, especially for non-developers, consider the following:

1.  **Consolidate Application Files**: There are several `streamlit_app...py` files. It would be best to identify the primary, most up-to-date version and move the older ones into an `archive/` folder to avoid confusion.
2.  **Centralize Data Source**: The scripts currently load data from different files and even hardcoded URLs. It would be more reliable to have a single, designated data file or database that all scripts read from.
3.  **Improve File Naming**: Files like `새 Microsoft Excel 워크시트.csv` should be given descriptive names (e.g., `preliminary_analysis_2025_Q3.csv`) to clarify their purpose.
4.  **Enhance This README**: This file could be further improved with a "How to Run" section, detailing the exact command to start the main Streamlit application (e.g., `streamlit run streamlit_app_ver.1.02.py`).
