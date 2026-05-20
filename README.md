<div align="center">
  <h1>Elevate—Blueprints to 3D</h1>
  <img 
    width="420" 
    alt="Elevate Logo" 
    src="https://github.com/user-attachments/assets/1eec6f73-aed7-4001-8091-1e0bd40acc35" 
  />

  <p>
    Blueprint-to-3D engine for developers, architects, and CAD workflows.
  </p>

  <p>
    <a href="https://github.com/ccarvalho-eng/elevate/actions/workflows/ci.yml">
      <img 
        alt="CI" 
        src="https://github.com/ccarvalho-eng/elevate/actions/workflows/ci.yml/badge.svg" 
      />
    </a>
    <img 
      alt="TypeScript Strict" 
      src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" 
    />
    <img 
      alt="React 18" 
      src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" 
    />
    <img 
      alt="Three.js" 
      src="https://img.shields.io/badge/Three.js-3D-111111?logo=three.js&logoColor=white" 
    />
    <img 
      alt="License Apache 2.0" 
      src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" 
    />
  </p>
</div>

Elevate is a local web app for turning a house blueprint into rough, interactive 3D perspective views. It is not CAD software; the goal is a fast spatial preview from a floor plan.

## What It Does

- Accepts PNG, JPG, JPEG, and PDF blueprints.
- Validates uploads using file signatures and size limits.
- Renders PDF page 1 into an image canvas.
- Extracts rough wall geometry from high-contrast floor plans.
- Converts the plan into a simple 3D wall/floor model.
- Provides preset views: roof-off, exterior, front, side, and interior.

## Development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

## Quality Gates

```bash
npm run format:check
npm run lint
npm test
npm run build
npm run e2e
```

Run everything:

```bash
npm run ci
```

## Current Limits

- Best results come from clean, high-contrast one-story floor plans.
- The model is approximate and intended for visual perspective only.
- Roof modeling, furniture, construction details, accounts, sharing, and CAD export are out of scope for V1.

## License

Elevate is licensed under the Apache License 2.0. See [LICENSE](./LICENSE).
