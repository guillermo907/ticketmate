# Query para Codex - Renovación Estética, Flujo de Guardado, UX, Upload Propio y Refactorización

## Contexto
El sitio cuenta con temas claros y oscuros, y un generador de posters para eventos (`venue-workspace.tsx`). El archivo `venue-workspace.tsx` ha crecido bastante (casi 3000 líneas) y requiere optimización urgente. Queremos mejorar sustancialmente la estética visual para inyectarle "innovación artística", arreglar el flujo de guardado de los posters y corregir bugs funcionales.

## Tareas a Implementar

### 1. Renovación Artística y Estética del Wizard (Look & Feel)
**Archivos principales**: `venue-workspace.module.scss` y relacionados.
- Todo el look del wizard (pasos, formularios, switches, botones) es actualmente monótono y carece de innovación artística.
- **Objetivo**: Rediseña la UI del wizard para que se sienta verdaderamente premium, moderna e innovadora.
- **Recomendaciones**: Usa animaciones de micro-interacciones para los switches, estados de "hover" dinámicos, glassmorphism sutil, tipografía cuidada y un layout que no parezca un "formulario aburrido" sino una herramienta de creación artística.

### 2. Flujo de Guardado y Persistencia del Póster
**Archivo principal**: `src/components/venue/venue-workspace.tsx`
- **Problema actual**: Al generar el póster, el flujo termina de forma abrupta y no es claro cómo guardar ni persiste al recargar la página.
- **Solución UX**:
  1. Cuando el proceso de generación se completa, haz que el resultado sea el foco principal (animación, auto-scroll).
  2. Habilita y resalta claramente un siguiente paso/botón obligatorio de "Guardar Póster" o "Confirmar Dirección Visual".
  3. Al guardar, asegúrate de que la URL de la imagen generada o subida persista en el borrador (draft/BD) de manera que si el usuario sale y regresa a la página, el póster generado siga ahí intacto y asociado al evento.

### 3. Dinamismo en la Sección "Dirección Visual" y Transiciones Globales
**Archivos sugeridos**: `src/app/globals.scss` y CSS modules.
- Agrega transiciones sutiles globales: `transition: background-color 0.4s ease, color 0.4s ease, border-color 0.4s ease;` (respetando `prefers-reduced-motion`).
- Al avanzar por los pasos y específicamente en la sección de "Dirección Visual", el fondo o los acentos de color deben cambiar dinámicamente dependiendo de la opción o preset que el usuario seleccione.

### 4. Rediseño Elegante para los Elementos de Información
**Archivos principales**: CSS modules del generador de pósters / `venue-workspace.tsx`
- Los bloques o "swatches" donde aparece la información superpuesta (textos, fechas, etc.) sobre los pósters son muy básicos.
- **Objetivo**: Diseñar etiquetas mucho más elegantes, profesionales y premium. Utiliza glassmorphism (fondos translúcidos con `backdrop-filter: blur()`), bordes delicados (rgba), sombras modernas (`box-shadow` suaves) y excelente contraste tipográfico.

### 5. Opción "Upload my own" en el Generador de Posters
**Archivos principales**: `src/components/venue/venue-workspace.tsx`, `src/lib/event-types.ts`, `src/lib/poster-designer.ts`
- Agrega una tercera opción principal: "Upload my own" (subir mi propio póster finalizado).
- Habilita un área de subida de imagen. Procesa la imagen para que se ajuste de forma responsiva al layout de la página (sin alterar su diseño original).
- Sobre ella, solo se debe dar la opción de superponer la capa de los campos de información rediseñados en el punto anterior. Modifica `designSourceMode` para admitir `"local" | "ai" | "upload"`.

### 6. Bugfix: Campo de Lineup
**Archivo principal**: `src/components/venue/venue-workspace.tsx`
- El input del campo "Lineup" no permite ingresar comas (`,`) con el teclado. Revisa cómo se maneja `onChange` / `onKeyDown` y arréglalo para que los usuarios puedan separar artistas con comas.

### 7. Refactorización para Escalabilidad, Legibilidad y Accesibilidad
**Archivos principales**: `src/components/venue/venue-workspace.tsx`
El componente `VenueWorkspace` es un monolito gigante. Debes implementar estas mejoras arquitectónicas:
- **Componentización**: Divide el archivo en sub-componentes especializados (`VenueWorkspaceEssentials.tsx`, `VenueWorkspaceStory.tsx`, `VenueWorkspaceVisual.tsx`) agrupados en una carpeta `workspace/`.
- **Hooks Personalizados**: Mueve lógicas de IA y estados a hooks (`useVenueForm()`, `usePosterAiProposals()`).
- **Simplicidad**: Consolida la avalancha de estados `useState` individuales usando `useReducer` o un gestor de formularios. Extrae utilidades a `src/lib/venue-utils.ts`.
- **Accesibilidad**: Asegura etiquetas `label` para los inputs, buen contraste (WCAG) en las nuevas interfaces premium y manejo de foco al avanzar de paso en el wizard.

## Instrucciones para Codex/Cursor
- Analiza todos los requerimientos y aplica los cambios paso a paso, asegurándote de no romper la funcionalidad existente (generadores local/AI).
- **El foco número uno debe ser elevar radicalmente el nivel estético (Aesthetics)**: el wizard ya no debe verse como un dashboard común; debe ser inmersivo, responsivo y artístico.
- Asegura que el flujo de persistencia del póster funcione al 100%.
