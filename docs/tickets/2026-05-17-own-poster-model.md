# Ticket: Reemplazar el falso diseñador IA por un modelo propio de posters

## Problema

El flujo actual de `/venue` estuvo llamando a un servicio Python que renderiza posters deterministas con `Pillow` y 4 familias fijas. Eso **no cumple** el ask original:

- no es nuestro propio diseñador entrenado
- no aprende una estética propia
- no produce conceptos verdaderamente nuevos desde una frase
- no es un pipeline real de `brief -> conceptos -> imagen`

## Objetivo correcto

Construir y desplegar un **diseñador propio** en Python que, a partir de una sola frase del usuario y del contexto estructurado del evento:

1. construya un brief editorial
2. genere 3 conceptos radicalmente distintos
3. renderice 3 posters premium
4. devuelva imágenes reales para selección en `/venue`

## Arquitectura propuesta

### Etapa 1: Brief Builder

Entrada:

- frase del usuario
- título
- fecha/hora
- venue
- ciudad
- lineup
- precio
- restricciones

Salida:

- JSON editorial normalizado

Campos mínimos:

- `title`
- `subtitle`
- `event_type`
- `genre`
- `description`
- `date`
- `venue`
- `city`
- `mood`
- `visual_priority`
- `realism_level`
- `format`
- `language_on_poster`
- `required_text`
- `design_constraints`
- `references`

### Etapa 2: Concept Generator

Entrada:

- brief editorial normalizado

Salida:

- 3 conceptos claramente distintos

Cada concepto debe incluir:

- `proposal_id`
- `style_title`
- `design_storytelling`
- `art_direction`
- `image_prompt`

### Etapa 3: Renderer propio

Backend recomendado:

- `diffusers`
- modelo base `SDXL` o `FLUX`
- fine-tuning con `LoRA`
- inferencia servida por `ComfyUI API` o servicio Python propio

### Etapa 4: Editorial Finisher

Opcional pero recomendado:

- overlay tipográfico controlado
- control de jerarquía
- export a variantes `desktop / tablet / mobile`

## Stack recomendado

### Entrenamiento

- Python
- `torch`
- `diffusers`
- `transformers`
- `accelerate`
- `peft`
- `safetensors`

### Inferencia

- `ComfyUI` como motor de inferencia local o server GPU
- o servicio FastAPI que cargue pipeline `diffusers`

### Orquestación desde app

- `/venue` genera el brief
- `/api/poster-designer/generate` manda al backend propio
- `/api/poster-designer/generate` nunca debe volver a un renderer determinista sin avisar

## Dataset necesario

No se puede “entrenar nuestro propio diseñador” sin dataset y curaduría.

Necesitamos:

- posters de jazz/culturales premium
- posters editoriales coleccionables
- referencias con figura humana fuerte
- etiquetas por:
  - mood
  - composición
  - paleta
  - tipo de protagonista
  - densidad tipográfica
  - estilo ilustrado/editorial/photo-first

Meta inicial:

- `300-1000` referencias curadas para fine-tuning LoRA
- captions editoriales consistentes

## Fases de implementación

### Fase A

Eliminar el engaño actual:

- el backend debe declarar si está en `deterministic`, `openai` o `own-model`
- si no hay backend válido, debe fallar con error claro

### Fase B

Levantar backend de inferencia propio:

- `ComfyUI` o `diffusers` local/server
- endpoint real de generación

### Fase C

Entrenar LoRA de estilo:

- dataset curado
- captions estructurados
- validación visual por lote

### Fase D

Conectar `/venue` al backend propio:

- prompt único
- 3 posters
- selección
- persistencia
- limpieza de temporales

## Criterios de aceptación

- una sola frase debe producir 3 posters realmente distintos
- el output no debe reciclar 4 familias fijas
- el backend reporta claramente `own-model`
- `/venue` muestra las imágenes reales devueltas por el backend propio
- si no hay selección y guardado, los posters temporales se eliminan

## Riesgos

- sin GPU, esto no será serio
- sin dataset curado, el “modelo propio” solo será un wrapper mediocre
- sin captions y taxonomy, LoRA aprende ruido visual
- sin finisher editorial, la imagen cruda seguirá sin verse como cartel premium

## Decisión del equipo

El estado actual sirve solo como prototipo de flujo, no como diseñador final.

La siguiente implementación válida debe apuntar a:

- backend propio de inferencia
- fine-tuning LoRA
- dataset curado
- renderer real, no plantillas Pillow
