import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import boundaries from "eslint-plugin-boundaries";

export default tseslint.config(
  {
    ignores: ["dist", "dist-ssr", "src-tauri/**", "node_modules", "*.config.js", "*.config.ts"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      boundaries: boundaries,
    },
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./tsconfig.json",
        },
      },
      "boundaries/elements": [
        {
          type: "app",
          pattern: ["src/app/*", "src/app/**"],
        },
        {
          type: "pages",
          pattern: ["src/pages/*", "src/pages/**"],
        },
        {
          type: "widgets",
          pattern: ["src/widgets/*", "src/widgets/**"],
        },
        {
          type: "features",
          pattern: ["src/features/*", "src/features/**"],
        },
        {
          type: "entities",
          pattern: ["src/entities/*", "src/entities/**"],
        },
        {
          type: "shared",
          pattern: ["src/shared/*", "src/shared/**"],
        },
      ],
      "boundaries/ignore": ["src/main.tsx", "src/vite-env.d.ts"],
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "boundaries/no-unknown-files": "error",
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          policies: [
            {
              from: { element: { type: "app" } },
              allow: [
                { to: { element: { type: "app" } } },
                { to: { element: { type: "pages" } } },
                { to: { element: { type: "widgets" } } },
                { to: { element: { type: "features" } } },
                { to: { element: { type: "entities" } } },
                { to: { element: { type: "shared" } } },
              ],
            },
            {
              from: { element: { type: "pages" } },
              allow: [
                { to: { element: { type: "pages" } } },
                { to: { element: { type: "widgets" } } },
                { to: { element: { type: "features" } } },
                { to: { element: { type: "entities" } } },
                { to: { element: { type: "shared" } } },
              ],
            },
            {
              from: { element: { type: "widgets" } },
              allow: [
                { to: { element: { type: "widgets" } } },
                { to: { element: { type: "features" } } },
                { to: { element: { type: "entities" } } },
                { to: { element: { type: "shared" } } },
              ],
            },
            {
              from: { element: { type: "features" } },
              allow: [
                { to: { element: { type: "features" } } },
                { to: { element: { type: "entities" } } },
                { to: { element: { type: "shared" } } },
              ],
            },
            {
              from: { element: { type: "entities" } },
              allow: [
                { to: { element: { type: "entities" } } },
                { to: { element: { type: "shared" } } },
              ],
            },
            {
              from: { element: { type: "shared" } },
              allow: [{ to: { element: { type: "shared" } } }],
            },
          ],
        },
      ],
    },
  },
);
