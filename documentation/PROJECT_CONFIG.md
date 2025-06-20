# Project Configuration UI

This document describes the structure, usage, and integration of the project configuration page (`pages/projects/[id]/config.vue`) in the Cloudless.gr platform.

## Purpose
The configuration page provides a unified interface for editing all project-specific settings, including:
- General project metadata (name, description, tags)
- Dataset source and preprocessing
- Model training defaults
- Environment/deployment defaults
- Secrets and environment variables

## UI Structure
The page is split into logical sections, each managed by a dedicated component:

| Section                | Component                    | Purpose                                      |
|------------------------|------------------------------|----------------------------------------------|
| Project Metadata       | ProjectMetadataForm.vue      | Name, description, tags                      |
| Dataset Configuration  | DatasetConfigForm.vue        | Source, features, target, preprocessing      |
| Model Defaults         | ModelDefaultsForm.vue        | Algorithm, epochs, learning rate, etc.       |
| Environment Settings   | EnvironmentConfigForm.vue    | Instance type, autoscaling, min/max instances|
| Secrets & Variables    | SecretsManager.vue           | API keys, environment variables, etc.        |

All components use `v-model` for two-way binding and are type-safe.

## Example State Structure
```js
config = {
  metadata: {
    name: '',
    description: '',
    tags: [],
  },
  dataset: {
    source: '',
    features: [],
    target: '',
    preprocessing: false,
  },
  modelDefaults: {
    algorithm: '',
    epochs: 10,
    learningRate: 0.001,
    batch_size: 32,
    earlyStopping: false,
  },
  environment: {
    instanceType: '',
    autoScaling: false,
    minInstances: 1,
    maxInstances: 1,
  },
  secrets: {},
}
```

## Saving & Backend Integration
- The config is saved using the Pinia store method `updateProject(projectId, { config })`.
- The backend expects the config as a property on the project object.
- The project ID is always passed as a string (handles both string and array cases).

## Best Practices
- Each section/component is responsible for its own validation and emits updates via `v-model`.
- The main page coordinates saving and loading state.
- All types are defined in `types/project.ts` for consistency.

## Extending
- To add new config sections, create a new component and add it to the page and config object.
- Update the backend schema if new config fields are required.

---
_Last updated: 2025-06-20_
