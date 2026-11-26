# `@hp/shared`

Shared Horse Pocket source used by the portal, Couch, Wad, and Shed. It is
plain TypeScript (and later CSS) that each app's Vite build bundles. There is
no npm workspace and no publish step.

## How to import

Each app maps `@hp/shared` with a Vite `resolve.alias` and TypeScript `paths`.
Import from the package name:

```ts
import { SHARED_PACKAGE } from '@hp/shared';
```

Do not add a `file:` dependency or a root `workspaces` field. App adoption
(moving SideMenu, backups, theme tokens, and so on) is later #23 work, opened
by each app's owner.

When you add files, keep TypeScript compatible with Wad's stricter flags
(`import type`, `verbatimModuleSyntax`, `erasableSyntaxOnly`).
