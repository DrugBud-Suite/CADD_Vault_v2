# CADD Vault Codebase Documentation

## Overall Architecture

The CADD Vault application follows a **Client-Server Architecture**.

* **Frontend:** A single-page application built with **React** and **TypeScript**, utilizing a **Component-Based Architecture**. It interacts with the backend data store (Supabase) via a client library.
* **Backend Scripts:** A collection of **Python scripts** responsible for data processing, transformation, and database updates. These scripts interact with external APIs (GitHub, Crossref, Europe PMC, bioRxiv) and the Supabase database.

The frontend and backend scripts are loosely coupled, communicating primarily through the Supabase database. The frontend focuses on user interface and interaction, while the backend handles data management and external data enrichment.

## Backend Scripts (`cadd-vault-backend-scripts/`)

This directory contains Python scripts for managing and updating the CADD Vault data.

### `.env`

* **Primary Purpose:** Stores environment variables, particularly sensitive information like API keys.
* **Responsibilities:** Provides configuration values to the Python scripts.
* **Interactions:** Read by `update_database.py` to load API keys and other settings.
* **Configuration:** Contains `PERSONAL_ACCESS_TOKEN` for GitHub API authentication and Supabase details loaded from the frontend `.env`.

### `models.py`

* **Primary Purpose:** Defines data structures (dataclasses) used throughout the backend scripts.
* **Responsibilities:** Provides a clear and type-hinted representation of configuration settings, database entries, processing results, and data fetched from external APIs (publications, repositories).
* **Key Data Structures:**
    * `Config`: Stores script configuration (email, GitHub token, timeout).
    * `Entry`: Represents a single record from the `packages` table in the database. Includes fields for package details, repository information, and publication data.
        * `from_dict(data: Dict[str, Any]) -> "Entry"`: Class method to create an `Entry` instance from a dictionary, handling potential JSON string for tags and ensuring all fields are present.
    * `ProcessingResult`: Summarizes the outcome of the database update process, including counts of total, successful, and failed entries, and a list of errors.
        * `add_error(entry_name: str, error_message: str)`: Method to add an error entry to the results.
    * `Publication`: Represents structured data fetched from publication-related APIs.
    * `Repository`: Represents structured data fetched from repository-related APIs.
* **Interactions:** Imported and used by `services.py` and `update_database.py` to define and manipulate data.
* **Design Patterns:** Uses Python's `dataclasses` for defining structured data with type hints.

### `services.py`

* **Primary Purpose:** Provides services for interacting with external APIs to fetch publication and repository data.
* **Responsibilities:** Encapsulates the logic for making API calls, handling responses, and extracting relevant information from sources like GitHub, Crossref, Europe PMC, bioRxiv, and chemRxiv. Includes logic for normalizing DOIs and checking preprint publication status.
* **Key Classes/Methods:**
    * `PublicationService`: Handles publication data.
        * `__init__(self, config: Config)`: Initializes the service with configuration, sets up headers (including email for API identification), and initializes API clients (Crossref, Impactor). Includes configuration for identifying preprint domains and patterns.
        * `normalize_doi(self, doi: str) -> Optional[str]`: Cleans and standardizes DOI formats.
        * `is_preprint(self, url: str) -> bool`: Checks if a given URL is from a known preprint server.
        * `_extract_doi(self, url: str) -> Optional[str]`: Extracts a DOI from a URL string.
        * `check_publication_status(self, url: str) -> PreprintResult`: Asynchronously checks if a preprint URL has a published version using various API checks (arXiv, bioRxiv, chemRxiv).
        * `_identify_preprint(self, url: str) -> Tuple[Optional[str], Optional[str]]`: Identifies the preprint type and extracts its ID from a URL.
        * `_search_crossref_for_title(self, title: str, preprint_doi: Optional[str] = None) -> Optional[str]`: Searches Crossref for a publication by title, with an option to exclude a specific preprint DOI.
        * `_check_arxiv(self, arxiv_id: str) -> Tuple[Optional[str], Optional[str]]`: Asynchronously checks for a published version of an arXiv paper using arXiv metadata and Europe PMC.
        * `_check_biorxiv(self, biorxiv_id: str) -> Tuple[Optional[str], Optional[str]]`: Asynchronously checks for a published version of a bioRxiv paper using the bioRxiv API.
        * `_check_chemrxiv(self, chemrxiv_id: str) -> Tuple[Optional[str], Optional[str]]`: Asynchronously checks for a published version of a chemRxiv paper using the Europe PMC API.
        * `_get_doi_title(self, doi: str) -> Optional[str]`: Asynchronously fetches the title of a publication given its DOI using Crossref.
        * `get_citations(self, url: str) -> Optional[int]`: Asynchronously fetches the citation count for a publication using Crossref. Includes backoff for retries.
        * `get_journal_info(self, url: str) -> Optional[Dict[str, str]]`: Asynchronously fetches journal information for a publication using Crossref. Includes backoff for retries.
        * `get_impact_factor(self, journal_info: Dict[str, str]) -> Optional[float]`: Asynchronously fetches the journal impact factor using the paperscraper library. Includes caching and exclusion logic for certain journal types.
        * `_get_cached_impact_factor(self, journal: str) -> Optional[float]`: Retrieves impact factor from an in-memory cache.
        * `_cache_impact_factor(self, journal: str, impact_factor: float) -> None`: Stores impact factor in the in-memory cache.
        * `_is_excluded_journal(self, journal: str) -> bool`: Determines if a journal should be excluded from impact factor lookup based on predefined terms.
    * `RepositoryService`: Handles repository data.
        * `__init__(self, config: Config)`: Initializes the service with configuration, sets up headers (including GitHub token if available).
        * `get_repository_data(self, url: str) -> Optional[Repository]`: Asynchronously fetches repository data (stars, last commit, license, language) from the GitHub API.
        * `_extract_repo_path(url: str) -> Optional[str]`: Extracts the `owner/repo` path from a GitHub URL.
        * `_get_last_commit(self, repo_path: str) -> Optional[str]`: Asynchronously fetches the date of the last commit for a given repository path using the GitHub API.
        * `_calculate_time_ago(date_str: Optional[str]) -> Optional[str]`: Calculates a human-readable "time ago" string from a date string.
* **Interactions:** Imports `Config`, `Entry`, `ProcessingResult`, `Publication`, and `Repository` from `models.py`. Uses `httpx` and `habanero` for API calls. Used by `update_database.py`.
* **Design Patterns:** Uses classes to group related API interactions. Employs asynchronous programming (`asyncio`, `httpx`) for efficient I/O. Includes error handling and retry logic (`backoff`). Uses `lru_cache` for caching impact factors.

### `transform_csv.py`

* **Primary Purpose:** Transforms data from a source CSV file (`tagged_cadd_vault_data.csv`) into a format suitable for importing into the Supabase `packages` table.
* **Responsibilities:** Reads a CSV, maps columns to the Supabase schema, performs data transformations (e.g., converting comma-separated tags to JSON arrays, parsing numbers, parsing GitHub URLs), generates UUIDs for new entries, and writes the transformed data to a new CSV file (`transformed_packages.csv`).
* **Key Functions:**
    * `parse_date(date_str)`: Attempts to parse various date string formats into ISO 8601 format.
    * `parse_github_info(repo_url)`: Extracts GitHub owner and repository name from a GitHub URL.
* **Interactions:** Reads `tagged_cadd_vault_data.csv` and writes `transformed_packages.csv`. Uses Python's `csv` and `json` modules, `uuid` for ID generation, and `urlparse` for URL parsing.
* **Notable Logic:** Handles data type conversions (string to int/float/JSON), provides warnings for parsing errors, and ensures the output CSV includes all required Supabase columns in a specified order.

### `update_database.py`

* **Primary Purpose:** The main script for fetching existing entries from the Supabase database, enriching them with data from external APIs using the services, and updating the entries in Supabase.
* **Responsibilities:** Orchestrates the data update process. Loads environment variables, initializes the Supabase client, fetches all existing package entries, iterates through them, calls the `PublicationService` and `RepositoryService` to get updated information, compares fetched data with existing data, and updates the Supabase database only if changes are detected. Logs the process and summarizes the results.
* **Key Functions:**
    * `update_database()`: The main asynchronous function that performs the entire update process.
* **Interactions:** Imports `Config`, `Entry`, and `ProcessingResult` from `models.py`, and `PublicationService` and `RepositoryService` from `services.py`. Uses `asyncio` to run asynchronous operations. Interacts with the Supabase database using the `supabase` client library. Loads environment variables using `dotenv`.
* **Notable Logic:**
    * Loads environment variables from both backend and frontend `.env` files.
    * Initializes `PublicationService` and `RepositoryService`.
    * Fetches all entries from the `packages` table.
    * Iterates through entries, calling services to get updated data.
    * Conditionally updates entry data based on whether the existing field is `None`.
    * Compares the updated data with the original data to determine if a database update is necessary.
    * Performs database updates using the Supabase client's `update` and `eq` methods.
    * Tracks processing results and logs errors.
    * Uses `asyncio.run()` to execute the main asynchronous function.

## Frontend (`cadd-vault-frontend/`)

This directory contains the React and TypeScript code for the CADD Vault web application.

* **Primary Purpose:** Stores environment variables for the frontend application.
* **Responsibilities:** Provides configuration values such as Supabase URL and API key, admin UID, and Cloudflare Turnstile site keys.
* **Interactions:** Read by the frontend application during the build process (Vite) and at runtime to configure services like Supabase and Cloudflare Turnstile. Also read by `update_database.py`.
* **Configuration:** Contains `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ADMIN_UID`, `PERSONAL_ACCESS_TOKEN`, and Cloudflare Turnstile keys (`VITE_TURNSTILE_SITE_KEY_DEV`, `VITE_TURNSTILE_SITE_KEY_PROD`).

### `README.md`

* **Primary Purpose:** Provides an overview of the CADD Vault Frontend project.
* **Responsibilities:** Explains the application's purpose, key features, and the technologies used (Tech Stack). Includes badges for GitHub stars, license, and PR status.
* **Content:** Describes package Browse, filtering, searching, detailed views, responsive design, theme toggle, and potential admin features. Lists core technologies like React, TypeScript, Vite, MUI, Zustand, React Router DOM, and Firebase.
* **Interactions:** Serves as the main entry point for understanding the project at a high level.

### `eslint.config.js`

* **Primary Purpose:** Configuration file for ESLint, a linter for identifying and reporting on patterns found in ECMAScript/JavaScript code.
* **Responsibilities:** Defines linting rules and configurations for the project, including recommended rules from ESLint, TypeScript ESLint, and React Hooks. Configures rules for React Refresh.
* **Interactions:** Used by the `lint` script defined in `package.json`.
* **Configuration:** Extends recommended rule sets, specifies files to lint (`**/*.{ts,tsx}`), configures language options (ECMAScript version, globals), and includes plugins for React Hooks and React Refresh. Ignores the `dist` directory.

### `index.html`

* **Primary Purpose:** The main HTML file that serves as the entry point for the frontend application.
* **Responsibilities:** Sets up the basic HTML structure, includes meta tags (charset, viewport, favicon), links to fonts, defines the root element (`<div id="root">`) where the React application will be mounted, and includes the script tag to load the main JavaScript/TypeScript bundle generated by Vite. Also includes the Cloudflare Turnstile script and a Content Security Policy.
* **Dynamic Content:** The `<div id="root">` is the region where the dynamic React content is rendered.
* **SEO Considerations:** Includes a `<title>` tag and meta tags for character set and viewport.
* **Interactions:** Loaded by the browser. The script tag loads `src/main.tsx` (via the build process). Includes an external script for Cloudflare Turnstile.
* **Configuration:** Defines a Content Security Policy (`Content-Security-Policy`) to control resource loading, including allowing scripts and frames from Cloudflare.

### `package-lock.json`

* **Primary Purpose:** Records the exact versions of dependencies used in the project.
* **Responsibilities:** Ensures that installations are consistent across different environments by locking down dependency versions.
* **Content:** Lists all direct and transitive dependencies with their precise versions and integrity hashes.
* **Interactions:** Used by npm or yarn when installing dependencies (`npm install` or `yarn install`).

### `package.json`

* **Primary Purpose:** Manifest file for the frontend project.
* **Responsibilities:** Lists project dependencies, development dependencies, and defines scripts for common tasks like development, building, linting, and previewing.
* **Content:**
    * `name`, `private`, `version`, `type`: Basic project information.
    * `scripts`:
        * `dev`: Starts the development server using Vite.
        * `build`: Compiles TypeScript and builds the project using Vite.
        * `lint`: Runs ESLint on the project files.
        * `preview`: Serves the built project for previewing.
    * `dependencies`: Lists runtime dependencies (e.g., React, MUI, Supabase, Zustand, React Router DOM).
    * `devDependencies`: Lists dependencies used only for development and building (e.g., Vite, TypeScript, ESLint, testing libraries).
* **Interactions:** Used by package managers (npm, yarn) to install dependencies and run scripts.

### `public/`

* **Primary Purpose:** Directory for static assets that should be served directly without being processed by the build pipeline.
* **Content:** Contains static files like `caddvault_white_logo.png`.
* **Interactions:** Files in this directory are accessible directly from the root of the deployed application (e.g., `/caddvault_white_logo.png`).

### `src/`

* **Primary Purpose:** Contains the main source code for the React application.
* **Responsibilities:** Houses the application's components, pages, context, utility functions, and entry point.

#### `src/App.css`

* **Primary Purpose:** Provides global CSS styles for the application.
* **Responsibilities:** Defines styles that apply across multiple components or the entire application.
* **Styling Approach:** Likely contains general styling rules, potentially including variables or resets.

#### `src/App.tsx`

* **Primary Purpose:** The main application component.
* **Responsibilities:** Sets up the application structure, including routing, theme context, and potentially global state providers. Renders the main layout and handles navigation between different pages.
* **Interactions:** Imports and uses components from `src/components/` and pages from `src/pages/`. Uses `react-router-dom` for routing. Likely uses `ThemeContext` and `AuthContext`.
* **Design Patterns:** Acts as the root component, orchestrating the application's main parts. Uses React Router for declarative navigation.

#### `src/index.css`

* **Primary Purpose:** Entry point for global CSS styles.
* **Responsibilities:** Imports or defines base styles, potentially including font imports or CSS resets.
* **Styling Approach:** Sets up foundational styles for the application.

#### `src/main.tsx`

* **Primary Purpose:** The entry point for the React application.
* **Responsibilities:** Renders the root React component (`App`) into the DOM. Sets up strict mode and potentially other top-level providers.
* **Interactions:** Imports `React`, `ReactDOM`, and `App`. Renders `App` into the element with `id="root"` in `index.html`.

#### `src/supabase.ts`

* **Primary Purpose:** Initializes and exports the Supabase client instance.
* **Responsibilities:** Configures the Supabase client with the project URL and anonymous key from environment variables. Provides a single point of access to the Supabase client for the rest of the application.
* **Interactions:** Reads environment variables (`import.meta.env`). Used by components and pages that interact with the Supabase database (e.g., for authentication, data fetching, data manipulation).

#### `src/theme.ts`

* **Primary Purpose:** Defines the Material UI theme for the application.
* **Responsibilities:** Configures the application's visual styling, including color palettes, typography, spacing, and component overrides. Supports light and dark modes.
* **Styling Approach:** Uses Material UI's theming capabilities to provide a consistent look and feel.
* **Interactions:** Used by `src/components/ThemeContext.tsx` to provide the theme to the application.

#### `src/types.ts`

* **Primary Purpose:** Defines TypeScript types and interfaces used across the frontend application.
* **Responsibilities:** Provides type safety and clarity for data structures, component props, and state.
* **Content:** Likely includes types for package data, user information, filtering options, and any other custom data structures.

#### `src/vite-env.d.ts`

* **Primary Purpose:** TypeScript declaration file for Vite environment variables.
* **Responsibilities:** Provides type definitions for environment variables exposed by Vite (`import.meta.env`), enabling type checking for these variables.

#### `src/assets/`

* **Primary Purpose:** Contains static assets like images that are processed by the build pipeline.
* **Content:** Includes various versions of the CADD Vault logo (`caddvault_dark.png`, `caddvault_medium.png`, `caddvault_white.png`).
* **Interactions:** Images in this directory are typically imported into components and processed by Vite (e.g., for optimization or hashing).

#### `src/components/`

* **Primary Purpose:** Contains reusable React components that make up the application's user interface.

##### `src/components/AdminRoute.tsx`

* **Primary Purpose:** A custom route component for protecting routes that require administrator privileges.
* **Responsibilities:** Checks if the currently authenticated user has admin privileges (likely by comparing `auth.uid()` with `VITE_ADMIN_UID`). If not, it redirects the user to another page (e.g., the home page).
* **Interactions:** Uses `react-router-dom` for routing and `AuthContext` for authentication status.

##### `src/components/CaptchaWidget.tsx`

* **Primary Purpose:** Encapsulates the Cloudflare Turnstile Captcha widget.
* **Responsibilities:** Renders the Captcha widget, handles its lifecycle (rendering, resetting), and provides the Captcha response token to parent components. Likely implements the logic outlined in `.md`.
* **Interactions:** Interacts with the global `window.turnstile` object. Used by authentication-related components like `LoginModal.tsx` and `SignupModal.tsx`.

##### `src/components/FilterSidebar.tsx`

* **Primary Purpose:** Provides a sidebar interface for filtering and sorting the list of packages.
* **Responsibilities:** Displays filtering options (e.g., by tags, categories, license) and sorting options. Allows users to select criteria to refine the package list.
* **Interactions:** Uses state management (likely Zustand via `filterStore.ts`) to manage filter and sort criteria. Interacts with user input events.

##### `src/components/Header.tsx`

* **Primary Purpose:** The application's header component.
* **Responsibilities:** Displays the application title/logo, navigation links, and potentially user authentication status or controls (e.g., login/signup buttons, user menu).
* **Interactions:** Uses `react-router-dom` for navigation links. May interact with `AuthContext` for displaying user status. Includes the `ThemeToggle` component.

##### `src/components/Layout.tsx`

* **Primary Purpose:** Provides a consistent layout structure for the application's pages.
* **Responsibilities:** Defines the overall page layout, including the header, main content area, and potentially sidebars or footers.
* **Interactions:** Renders the `Header` component and the content of the current page (passed as children).

##### `src/components/LoginModal.tsx`

* **Primary Purpose:** A modal component for user login.
* **Responsibilities:** Provides input fields for email and password, handles login form submission, interacts with the Supabase authentication service, and displays feedback (e.g., error messages). Includes the `CaptchaWidget`.
* **Interactions:** Uses the Supabase client (`src/supabase.ts`) for authentication. Uses `AuthContext` to update authentication state. Uses `CaptchaWidget` for bot verification.

##### `src/components/PackageCard.tsx`

* **Primary Purpose:** Displays a summary of a single package in a card format.
* **Responsibilities:** Shows key information about a package, such as name, description, tags, and potentially aggregated rating or GitHub stars. Provides a link to the package detail page.
* **Interactions:** Receives package data as props. Uses `react-router-dom` for navigation. May display data fetched from the `packages` table, including `average_rating` and `ratings_count`.

##### `src/components/PackageList.tsx`

* **Primary Purpose:** Displays a list or grid of `PackageCard` or `PackageListItem` components.
* **Responsibilities:** Fetches package data (potentially with filtering and sorting applied) and renders it using a list or grid layout. Handles loading states and empty results.
* **Interactions:** Uses the Supabase client (`src/supabase.ts`) to fetch data from the `packages` table. Uses state management (likely Zustand via `filterStore.ts`) to apply filters and sorting. May use `react-window` for efficient rendering of large lists.

##### `src/components/PackageListItem.tsx`

* **Primary Purpose:** Displays a summary of a single package in a list item format.
* **Responsibilities:** Similar to `PackageCard.tsx` but optimized for list views. Shows key information and provides a link to the package detail page. Includes tooltips for GitHub stars, last commit ago, and citations.
* **Interactions:** Receives package data as props. Uses `react-router-dom` for navigation. Uses `@mui/material` `Tooltip` component.

##### `src/components/PackageSummary.tsx`

* **Primary Purpose:** Displays detailed information about a single package.
* **Responsibilities:** Presents comprehensive data for a selected package, including description, links, publication details, repository information, and rating input.
* **Interactions:** Receives package data as props. Displays various fields from the package data. Includes the `RatingInput` component. Will be modified to include a tooltip for the description.

##### `src/components/RatingInput.tsx`

* **Primary Purpose:** Allows authenticated users to submit a rating for a package.
* **Responsibilities:** Provides a UI for selecting a rating (e.g., star rating component). Handles the submission of the rating to the Supabase `ratings` table. Displays the user's existing rating if available.
* **Interactions:** Uses the Supabase client (`src/supabase.ts`) to insert and query the `ratings` table. Uses `AuthContext` to get the current user's ID.

##### `src/components/SignupModal.tsx`

* **Primary Purpose:** A modal component for user signup.
* **Responsibilities:** Provides input fields for signup details (e.g., email, password), handles form submission, interacts with the Supabase authentication service, and displays feedback. Includes the `CaptchaWidget`.
* **Interactions:** Uses the Supabase client (`src/supabase.ts`) for authentication. Uses `AuthContext` to update authentication state. Uses `CaptchaWidget` for bot verification.

##### `src/components/TableOfContentsSidebar.tsx`

* **Primary Purpose:** Generates and displays a table of contents for the current page.
* **Responsibilities:** Scans the page content for headings and creates a hierarchical navigation list. Allows users to quickly jump to different sections of the page.
* **Interactions:** Likely uses DOM manipulation or a library to identify headings.

##### `src/components/ThemeContext.tsx`

* **Primary Purpose:** Provides a React context for managing the application's theme (light/dark mode).
* **Responsibilities:** Stores the current theme state and provides a function to toggle the theme. Uses React Context API to make the theme accessible to components throughout the application.
* **Interactions:** Uses `src/theme.ts` to define the theme objects. Used by components that need to access or change the theme.

##### `src/components/ThemeToggle.tsx`

* **Primary Purpose:** A UI component (e.g., a button or switch) for toggling between light and dark themes.
* **Responsibilities:** Displays the current theme status and allows the user to switch themes.
* **Interactions:** Uses `ThemeContext` to access the current theme and the function to toggle it.

#### `src/context/`

* **Primary Purpose:** Contains React Context providers for managing global application state.

##### `src/context/AuthContext.tsx`

* **Primary Purpose:** Provides a React context for managing user authentication state.
* **Responsibilities:** Stores the current user's authentication status and user information. Provides functions for logging in, signing up, logging out, and accessing the current user. Uses React Context API to make authentication state accessible.
* **Interactions:** Uses the Supabase client (`src/supabase.ts`) for authentication operations. Used by components and pages that require authentication information or actions.

#### `src/pages/`

* **Primary Purpose:** Contains the main page components of the application.

##### `src/pages/AboutPage.tsx`

* **Primary Purpose:** Displays information about the CADD Vault project.
* **Responsibilities:** Presents details about the project's goals, contributors, technologies, or other relevant information.

##### `src/pages/AddPackagePage.tsx`

* **Primary Purpose:** A page for administrators to add new package entries to the database.
* **Responsibilities:** Provides a form for inputting package details. Handles form submission and interacts with the Supabase database to insert new entries. Likely protected by `AdminRoute`.
* **Interactions:** Uses the Supabase client (`src/supabase.ts`) to insert data into the `packages` table.

##### `src/pages/EditPackagePage.tsx`

* **Primary Purpose:** A page for administrators to edit existing package entries in the database.
* **Responsibilities:** Fetches the details of a specific package, provides a form pre-filled with the existing data, handles form submission, and interacts with the Supabase database to update the entry. Likely protected by `AdminRoute`.
* **Interactions:** Uses the Supabase client (`src/supabase.ts`) to fetch and update data in the `packages` table. Uses `react-router-dom` to get the package ID from the URL. Renders `PackageSummary`.

##### `src/pages/HomePage.tsx`

* **Primary Purpose:** The main landing page of the application.
* **Responsibilities:** Displays the `FilterSidebar` and the `PackageList`. Serves as the central hub for Browse packages.
* **Interactions:** Renders `FilterSidebar` and `PackageList`.

##### `src/pages/PackageDetailPage.tsx`

* **Primary Purpose:** Displays the detailed information for a single package.
* **Responsibilities:** Fetches the data for a specific package based on its ID from the URL and renders the `PackageSummary` component.
* **Interactions:** Uses the Supabase client (`src/supabase.ts`) to fetch data. Uses `react-router-dom` to get the package ID from the URL. Renders `PackageSummary`.

#### `src/store/`

* **Primary Purpose:** Contains Zustand stores for managing application state.

##### `src/store/filterStore.ts`

* **Primary Purpose:** A Zustand store for managing the state of package filtering and sorting.
* **Responsibilities:** Stores the current filter criteria and sorting options selected by the user. Provides actions to update these criteria.
* **Interactions:** Used by `FilterSidebar.tsx` to display and update filter/sort options. Used by `PackageList.tsx` to apply filters and sorting when fetching data.

#### `src/utils/`

* **Primary Purpose:** Contains utility functions used across the application.

##### `src/utils/filterPackages.ts`

* **Primary Purpose:** Provides a utility function for filtering a list of packages based on specified criteria.
* **Responsibilities:** Takes a list of package entries and filter criteria as input and returns a filtered list.
* **Interactions:** Used by `PackageList.tsx` to filter the fetched package data.

### `tsconfig.app.json`

* **Primary Purpose:** TypeScript configuration specifically for the application code (`src/`).
* **Responsibilities:** Defines compiler options for building the main application code, including target JavaScript version, libraries, module system, JSX factory, and strictness rules.
* **Configuration:** Sets `target` to ES2020, includes DOM and Iterable libraries, uses ESNext modules, enables strict checks, and configures JSX for React.

### `tsconfig.json`

* **Primary Purpose:** The main TypeScript configuration file for the project.
* **Responsibilities:** References other `tsconfig.*.json` files to define the overall TypeScript project structure.
* **Configuration:** References `tsconfig.app.json` (for application code) and `tsconfig.node.json` (for Node.js specific code like Vite configuration).

### `tsconfig.node.json`

* **Primary Purpose:** TypeScript configuration specifically for Node.js environment files (like `vite.config.ts`).
* **Responsibilities:** Defines compiler options suitable for Node.js environments, including target JavaScript version, libraries, and module system.
* **Configuration:** Sets `target` to ES2022, includes ES2023 libraries, uses ESNext modules, and enables strict checks.

### `vite.config.ts`

* **Primary Purpose:** Configuration file for Vite, the build tool.
* **Responsibilities:** Defines how the project should be built and served during development. Configures plugins (like the React plugin), base URL for deployment, CSS handling, and development server settings.
* **Interactions:** Uses `@vitejs/plugin-react`.
* **Configuration:** Sets the `base` URL for deployment, includes the React plugin, disables PostCSS, and configures the development server port and strictness.

## Project Dependencies

### Core Frameworks and Libraries

* **React (v19.0.0):** The core JavaScript library for building user interfaces.
* **TypeScript (~5.7.2):** Adds static typing to JavaScript, improving code maintainability and catching errors early.
* **Material UI (MUI) (^5.17.1):** A popular React UI framework implementing Google's Material Design. Provides pre-built components and a theming system.
    * `@mui/icons-material (^5.17.1)`: Provides Material Design icons.
    * `@mui/lab (^5.0.0-alpha.72)`: Contains experimental or supplementary MUI components.
    * `@mui/material (^5.17.1)`: The core Material UI components library.
* **Zustand (^5.0.3):** A small, fast, and scalable bearbones state-management solution using simplified flux principles.
* **React Router DOM (^7.5.0):** Provides declarative routing for React applications.
* **Supabase JS (^2.49.4):** The official JavaScript client library for interacting with a Supabase backend. Provides methods for authentication, database access, storage, and real-time subscriptions.
* **React Icons (^5.5.0):** A library providing a collection of popular icon sets as React components.
* **React Window (^1.8.11):** A library for efficiently rendering large lists and tabular data by only rendering the visible rows.

### Key Third-Party Integrations

* **Supabase:** Used as the backend-as-a-service, providing database, authentication, and storage capabilities.
* **Cloudflare Turnstile:** Integrated for bot verification, particularly in authentication flows.
* **GitHub API:** Used by backend scripts (`services.py`) to fetch repository information (stars, last commit, license, language).
* **Crossref API:** Used by backend scripts (`services.py`) to fetch publication information (citations, journal details, title).
* **Europe PMC API:** Used by backend scripts (`services.py`) as a source for checking preprint publication status.
* **bioRxiv API:** Used by backend scripts (`services.py`) for checking bioRxiv preprint publication status.
* **chemRxiv (via Europe PMC):** ChemRxiv preprints are checked via the Europe PMC API in the backend scripts.
* **paperscraper:** A Python library used by backend scripts (`services.py`) to fetch journal impact factors.

### Internal Package Dependencies

* The frontend (`cadd-vault-frontend/`) and backend scripts (`cadd-vault-backend-scripts/`) are developed within the same repository but function as distinct parts of the application, interacting primarily through the Supabase database. There are no direct code dependencies between the frontend and backend script directories in the traditional sense of one importing modules from the other, except for the backend script `update_database.py` reading environment variables from the frontend's `.env` file.

## High-Level Architectural Diagram (Text Description)

```mermaid
graph TD
    A[User Browser] -->|HTTP/HTTPS| B(Frontend Application)
    B -->|Supabase JS Client| C[Supabase Backend]
    C -->|Database Operations| D[Supabase Database (PostgreSQL)]
    C -->|Authentication API| E[Supabase Auth]
    C -->|Storage API| F[Supabase Storage]
    G[Backend Scripts] -->|Supabase Client| C
    G -->|HTTP Requests| H[External APIs]
    H --> I[GitHub API]
    H --> J[Crossref API]
    H --> K[Europe PMC API]
    H --> L[bioRxiv API]
    G -->|File System Access| M[CSV Files (.csv)]
    G -->|Environment Variables| N[.env files]
    D -->|RLS Policies| B, G
    D -->|Database Triggers| D