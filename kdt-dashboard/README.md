# KDT Sales Dashboard (Next.js)

This is a web application built with [Next.js](https://nextjs.org) that serves as a dashboard for visualizing K-Digital Training (KDT) program data. It uses a modern tech stack including React, TypeScript, and Tailwind CSS.

## 📂 Project Structure

- **`src/app/page.tsx`**: The main page of the dashboard. This is the primary view that users will see.
- **`src/components/`**: Contains the reusable React components.
    - **`ui/`**: Holds generic, base UI components like `card.tsx`.
    - **`dashboard/`**: Holds components specifically designed for this dashboard, such as `summary-card.tsx` for displaying key metrics.
- **`src/lib/`**: Contains utility functions. `utils.ts` includes a helper for managing CSS classes.
- **`package.json`**: Lists the project's dependencies (like Next.js, React, Tailwind CSS) and defines the scripts to run, build, and lint the application.

## 🎯 Purpose of this Folder

This application is intended to be the primary frontend for interacting with the KDT dataset. Unlike the Python-based Streamlit dashboards, this Next.js app is designed to be a standalone, production-ready web application that can be deployed to hosting services like Vercel.

## 📈 Current Status

The project is in its **initial development phase**.

- A basic page layout exists.
- A reusable `SummaryCard` component has been created to display key performance indicators (KPIs).
- The main page currently shows a single summary card with **hardcoded placeholder data**.
- There is no real data fetching or backend integration yet.

## 💡 Next Steps & Suggested Improvements

1.  **Clean Up Boilerplate**: The main page (`src/app/page.tsx`) still contains a lot of the default example code and links from `create-next-app`. This should be removed to build the actual dashboard interface.
2.  **Implement Data Fetching**: The components need to be connected to a data source. This could involve:
    - Creating an API endpoint (e.g., in Next.js API routes) that reads from the JSON or CSV files.
    - Fetching data directly from a database or a dedicated backend service.
3.  **Build the Dashboard Layout**: A proper dashboard layout should be designed and implemented, likely using a CSS grid to arrange multiple summary cards, charts, and data tables.
4.  **Update This README**: This file should be kept up-to-date with the project's status, and a "How to Run" section should be maintained with the correct commands (`npm run dev`).