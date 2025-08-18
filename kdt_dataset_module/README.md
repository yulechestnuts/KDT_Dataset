# KDT Dataset Module

This directory represents a modularized version of the KDT data analysis project. It separates the data processing, visualization, and user interface components into organized subdirectories.

## 📂 Folder Structure

- **`streamlit_app_ver.1.03.py`**: The main Streamlit application file. This script integrates the different modules to create the interactive dashboard. To run the analysis, this is the file you should execute.

- **`utils/`**: A Python package containing all the core data processing logic.
    - `data_loader.py`: Loads the dataset from its source.
    - `data_preprocessing.py`: Cleans and prepares the data for analysis (e.g., handling missing values, formatting dates).
    - `institution_grouping.py`: Groups different variations of institution names into a single, standardized name (e.g., combines "이젠" and "이젠컴퓨터학원" into "이젠아카데미").
    - `training_type_classification.py`: Categorizes courses into different types, such as "Leading Company Type" or "Incumbent Training".

- **`visualization/`**: A Python package for creating all the visual elements of the dashboard.
    - `charts.py`: Functions that generate specific plots, like bar charts and line charts, using Altair and Plotly.
    - `reports.py`: Functions that assemble charts and data tables into comprehensive analytical views (e.g., the full report for a single institution).

- **`components/`**: Contains frontend components written in React (`.jsx`).
    - `ranking.jsx`: A sophisticated, interactive table for ranking institutions. This component is embedded within the Streamlit application to provide a better user experience than standard tables.

- **`server/`**: A simple backend server built with Node.js and Express.
    - `index.js`: An API for managing "posts" stored in a `posts.json` file. **Note:** This server appears to be for a separate, unrelated feature (like a bulletin board) and may not be essential for the main KDT data analysis.

## 🎯 Purpose of this Folder

The primary purpose of this module is to provide a clean, organized, and maintainable structure for the KDT analysis application. By separating logic into different modules, it becomes easier to update and debug the application.

## 💡 Suggestions for Improvement

1.  **Clarify Server's Purpose**: The Node.js server's role is unclear. A note in this README should explain what it's for, or it should be removed if it's an unused experiment.
2.  **Consistent Frontend Strategy**: The project mixes Streamlit's Python-based UI with embedded React components. For long-term maintenance, it would be beneficial to choose a single frontend strategy. Either build the entire UI in Streamlit or move to a full JavaScript frontend that fetches data from a Python API.
3.  **Add Code Documentation**: Adding comments and docstrings to the functions within the `utils` and `visualization` modules would help new developers (and non-developers) understand the specific logic of the project more quickly.
