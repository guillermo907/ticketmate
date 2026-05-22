# Ticket: Arreglar diferenciación real entre diseñador local vs IA en Venue Wizard

## Contexto

En el `venue console`, el flujo de generación de poster todavía mezcla responsabilidades del diseñador local y del diseñador IA. Eso hace que el proceso no sea suficientemente claro para el usuario final y que algunas decisiones parezcan duplicadas o inconsistentes.

El síntoma más visible hoy:

- `modo local` todavía expone un `brief creativo`, aunque ese prompt debería pertenecer al flujo IA y no al local
- las opciones del diseñador local no se diferencian suficiente de las del diseñador IA
- en la práctica ambos modos se perciben como si compartieran las mismas decisiones
- el wizard necesita más claridad visual conforme avanza
- la funcionalidad completa del flujo necesita QA end-to-end

## Hallazgo del PM

Esto no debe tratarse como un ajuste cosmético. Es un problema de producto y de modelo mental:

- `Local` es un configurador del sistema interno
- `IA` es un generador de propuestas a partir de un brief

Si ambos modos comparten las mismas opciones principales, el usuario no entiende qué está comprando, qué está configurando ni por qué existen dos modos.

## Problema a resolver

Separar completamente la experiencia de `Local` y `IA` dentro del paso de dirección visual.

### Local

El diseñador local debe ofrecer:

- rutas visuales locales propias
- controles locales propios
- opción clara para usar o no fotos
- upload de foto del usuario cuando aplique
- recorte/normalización consistente para usar la foto en el poster local

No debe pedir `brief creativo` si ese texto no tiene un efecto real en el pipeline local.

### IA

El diseñador IA debe ofrecer:

- un prompt guiado y claro
- generación de propuestas IA a partir de ese prompt
- selector entre las propuestas generadas
- aplicación explícita de la propuesta elegida al preview/handoff

## Requerimientos

### UX y producto

- Remover el `brief creativo` del modo `Local` si no alimenta el pipeline local de forma real.
- Definir opciones propias para `Local` que no parezcan una copia del flujo IA.
- Mantener el `brief/prompt` como elemento principal del modo `IA`.
- Hacer evidente en todo momento si el usuario está en `Local` o `IA`.
- El usuario no debe sentir que ambos modos hacen lo mismo con distinta etiqueta.

### Visual wizard

- Conforme avanzamos en el wizard, debe haber cambios sutiles del color de fondo del card principal para indicar progreso.
- Los estados visuales por paso deben sentirse progresivos: inicio, en curso, completado.
- `Local` e `IA` deben tener tratamientos cromáticos claramente distintos, pero coherentes con el tema.
- Los cambios de color no deben romper contraste ni legibilidad.

### Posters locales con foto

- Agregar o mantener una opción clara de incluir foto en el poster local.
- Permitir que el usuario suba su propia foto para esa ruta local.
- La foto debe ser recortada/normalizada correctamente antes de integrarse en el poster.
- El resultado no debe deformar imagen ni romper jerarquía visual del layout.

### QA funcional

- Probar todo el flujo completo desde `Paso 1` hasta publicación.
- Probar `Local` sin foto.
- Probar `Local` con foto subida por usuario.
- Probar `IA` con prompt por defecto.
- Probar `IA` editando el prompt.
- Probar carga de propuestas IA, selector de propuesta y aplicación al preview.
- Probar persistencia al guardar draft.
- Probar persistencia al publicar.
- Probar regreso entre pasos sin perder estado.
- Probar que no haya controles redundantes o que aparenten hacer algo cuando no hacen nada.

## Criterios de aceptación

- En `Local`, el usuario no ve controles que pertenecen conceptualmente al flujo IA.
- En `IA`, el usuario ve un prompt claro, propuestas generadas y selector de propuesta.
- El wizard comunica claramente progreso y estado.
- El card principal cambia de color sutilmente conforme se completan pasos.
- `Local` e `IA` se distinguen visual y funcionalmente.
- La opción de foto local funciona con imagen subida por usuario y queda bien integrada.
- Todo el flujo queda validado manualmente en `/venue`.

## QA checklist

- [ ] El modo `Local` no muestra `brief creativo` si no aplica.
- [ ] El modo `IA` sí muestra prompt y generación.
- [ ] Los posters IA se pueden alternar y elegir.
- [ ] El preview reacciona correctamente al modo elegido.
- [ ] Los pasos cambian visualmente con el avance.
- [ ] El fondo del card cambia sutilmente por completion.
- [ ] `Local` e `IA` tienen fondos y acentos distinguibles.
- [ ] Upload de foto local funciona.
- [ ] El recorte/normalización de foto local no rompe el poster.
- [ ] Guardar y volver a abrir mantiene el estado esperado.

## Archivos probables a tocar

- `src/components/venue/venue-workspace.tsx`
- `src/components/venue/venue-workspace.module.scss`
- `src/lib/poster-designer.ts`
- `src/components/events/poster-page-renderers.tsx`
- `src/app/actions/events.ts`
