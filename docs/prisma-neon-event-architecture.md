**Objetivo**
Unificar la persistencia del venue console para que eventos, posters y tickets dejen de depender del JSON local como fuente principal y puedan vivir en Prisma + Neon.

**Qué cambió**
- El proyecto ya tenía Prisma para `checkout`, usuarios y venue.
- Ahora `src/lib/events.ts` puede usar Prisma como store principal para eventos cuando existe `DATABASE_URL`.
- El modelo `Event` en Prisma ahora incluye:
  - `consolePayload Json?`
  - `publishedAt DateTime?`
- `consolePayload` guarda el payload editorial del venue:
  - summary
  - venueName / venueAddress
  - heroImage
  - variant / templates / motifs
  - poster metadata y assets
  - ticket metadata y assets
  - lineup / genre / momentos operativos
  - draft/published poster design
  - draft/published ticket design

**Por qué esta forma**
- Evita seguir duplicando modelos entre JSON local y Prisma.
- Mantiene el esquema core de negocio relativamente limpio.
- Permite evolucionar después hacia tablas más finas sin bloquear el producto hoy.
- Hace posible mover la fuente de verdad a Neon sin romper local dev de inmediato.

**Fuente de verdad**
- Con `DATABASE_URL`: Prisma/Neon.
- Sin `DATABASE_URL`: fallback legacy a `data/events.json`.
- Si quieres forzar el modo legacy aunque exista DB: `FORO_FORCE_FILE_EVENTS=true`.

**Dónde queda cada cosa**
- Metadata escalable de eventos:
  - `Event` en Prisma/Neon
- Payload editorial del venue:
  - `Event.consolePayload`
- Posters materializados locales:
  - `public/uploads/events/<slug>/posters/*`
- Si se configura Vercel Blob:
  - assets via `/api/blob/...`

**Pasos para activar Neon**
1. Crea una base en Neon.
2. Copia el connection string a `DATABASE_URL`.
3. Revisa el entorno:

```bash
npm run neon:check
```

4. Corre:

```bash
npm run prisma:generate
npm run prisma:push
```

5. Levanta la app:

```bash
npm run dev
```

**Neon recomendado**
- `DATABASE_URL`: URL pooled/normal de la app.
- `DIRECT_URL`: URL directa para migraciones Prisma cuando Neon la provea.

**Notas honestas**
- No eliminé el fallback JSON todavía, porque hoy mantiene operativo el entorno local mientras conectas Neon.
- La arquitectura ya quedó preparada para que Prisma sea la ruta principal.
- El siguiente paso natural sería migrar también `site content` y demás configuración visual fuera de JSON/local file cuando quieras dejar toda la app sobre la misma base.
