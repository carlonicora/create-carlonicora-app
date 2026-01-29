# Frontend (Next.js) - CLAUDE.md

This file provides guidance specific to the Web frontend. See also the [root CLAUDE.md](../../CLAUDE.md) for general project rules.

## Architecture Documentation

| Task | Read |
|------|------|
| Core principles | [docs/architecture/00-core-principles.md](../../docs/architecture/00-core-principles.md) |
| Models | [docs/architecture/frontend/01-models.md](../../docs/architecture/frontend/01-models.md) |
| Interfaces | [docs/architecture/frontend/02-interfaces.md](../../docs/architecture/frontend/02-interfaces.md) |
| Services | [docs/architecture/frontend/03-services.md](../../docs/architecture/frontend/03-services.md) |
| Template | [docs/architecture/frontend/template.md](../../docs/architecture/frontend/template.md) |
| Anti-patterns | [docs/architecture/anti-patterns.md](../../docs/architecture/anti-patterns.md) |

## Core Rules

1. **ALWAYS use callApi()** - Never use raw `fetch()` for API calls
2. **Models implement rehydrate() and createJsonApi()** - Consistent serialization/deserialization
3. **Use ModuleFactory** - Standard resource configuration for each entity
4. **Containers fetch, components render** - Clear separation of concerns
5. **Jotai for shared state** - Use atoms for cross-component state
6. **next-intl for i18n** - All user-facing text uses `useTranslations()`

## File Organization

```
src/features/{domain}/
├── data/
│   ├── {Entity}.ts           # Model class (extends AbstractApiData)
│   ├── {Entity}Interface.ts  # TypeScript interface
│   └── {Entity}Service.ts    # API service (extends AbstractService)
├── {Entity}Module.ts         # ModuleFactory configuration
├── {Entity}Atom.ts           # Jotai atoms (if needed)
├── components/
│   ├── {Entity}Container.tsx # Data fetching, state management
│   └── {Entity}Component.tsx # Pure presentational component
└── __tests__/
    └── {Entity}.spec.tsx     # Component tests
```

## Key Patterns

### Model Pattern
```typescript
export class Photograph extends AbstractApiData {
  title: string = "";
  createdAt: Date = new Date();

  static rehydrate(data: PhotographInterface): Photograph {
    const photo = new Photograph();
    photo.id = data.id;
    photo.title = data.title;
    photo.createdAt = new Date(data.createdAt);
    return photo;
  }

  createJsonApi(): JsonApiData {
    return {
      type: "photographs",
      id: this.id,
      attributes: {
        title: this.title,
      },
    };
  }
}
```

### Service Pattern
```typescript
export class PhotographService extends AbstractService<Photograph> {
  async findByRoll(rollId: string): Promise<Photograph[]> {
    const response = await this.callApi({
      type: Modules.Photograph,
      endpoint: EndpointCreator.index({ parentType: "rolls", parentId: rollId }),
    });
    return response.data.map(Photograph.rehydrate);
  }
}
```

### ModuleFactory Pattern
```typescript
export const PhotographModule = (factory: ModuleFactory) =>
  factory({
    pageUrl: "/photographs",
    name: "photographs",
    model: Photograph,
    moduleId: "photograph-module",
    inclusions: {
      roll: RollModule,
      metadata: MetadataModule,
    },
  });
```

### Container/Component Pattern
```typescript
// Container: handles data
export const PhotographListContainer = ({ rollId }: Props) => {
  const [photographs, setPhotographs] = useState<Photograph[]>([]);

  useEffect(() => {
    photographService.findByRoll(rollId).then(setPhotographs);
  }, [rollId]);

  return <PhotographList photographs={photographs} />;
};

// Component: pure render
export const PhotographList = ({ photographs }: { photographs: Photograph[] }) => (
  <div>{photographs.map(p => <PhotographCard key={p.id} photo={p} />)}</div>
);
```

## Testing

```bash
# Run web tests
pnpm --filter {{name}}-web test

# Run with coverage
pnpm --filter {{name}}-web test:coverage

# Run in watch mode
pnpm --filter {{name}}-web test:watch
```

### Testing Utilities

```typescript
import {
  MockJsonApiProvider,
  renderWithProviders,
  createMockApiData,
  screen,
} from "@carlonicora/nextjs-jsonapi/testing";

// Create mock data
const mockPhoto = createMockApiData({
  type: "photographs",
  id: "123",
  attributes: { title: "Test Photo" },
});

// Render with providers
renderWithProviders(<PhotographCard photo={mockPhoto} />);

// Assert
expect(screen.getByText("Test Photo")).toBeInTheDocument();
```

## Common Mistakes

| Mistake | Correct Approach |
|---------|------------------|
| Using `fetch()` directly | Use `callApi()` from service |
| `overridesJsonApiCreation: true` without method | Implement dedicated `createJsonApi()` in model |
| Missing `type: Modules.Entity` in service calls | Always specify the module type |
| State in presentational components | Move state to containers or atoms |
| Hardcoded strings | Use `useTranslations()` for i18n |
| Missing `rehydrate()` | All models must implement static `rehydrate()` |
