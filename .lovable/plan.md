
## Objetivo
Publicar la versión actual del proyecto en un repositorio de GitHub usando la integración nativa de Lovable (sincronización bidireccional automática).

## Pasos

### 1. Conectar Lovable con GitHub
En el editor de Lovable:
- Abre el menú **+** (esquina inferior izquierda del chat)
- Selecciona **GitHub** → **Connect project**
- Autoriza la **Lovable GitHub App** en GitHub
- Elige la cuenta u organización donde se creará el repositorio

> Nota: solo se puede conectar una cuenta de GitHub por cuenta de Lovable.

### 2. Crear el repositorio
- Una vez autorizado, haz clic en **Create Repository** dentro de Lovable
- Lovable creará automáticamente un nuevo repo con todo el código actual del proyecto
- A partir de ese momento la sincronización es **bidireccional y en tiempo real**: los cambios hechos en Lovable se suben a GitHub y viceversa

### 3. (Opcional) Configurar visibilidad y colaboradores
Directamente en GitHub:
- Ajustar el repo como **público o privado** según necesites
- Invitar colaboradores desde **Settings → Collaborators**
- Configurar reglas de protección de rama si trabajarás con PRs

### 4. (Opcional) Descargar el código como ZIP
Si solo quieres una copia local sin mantener sincronización:
- En GitHub: **Code → Download ZIP**
- O clonar: `git clone <url-del-repo>`

### Consideraciones importantes
- **Datos de la base de datos** (Lovable Cloud) NO se exportan con el código. Si necesitas respaldarlos, ve a **Cloud → Database → Tables** y exporta cada tabla como CSV.
- **Variables de entorno y secrets** tampoco se suben al repo; deberás configurarlos aparte si despliegas fuera de Lovable.
- Importar un repo ya existente a Lovable **no está soportado** todavía, así que este flujo solo aplica para crear un repo nuevo desde este proyecto.

¿Quieres que proceda o tienes alguna preferencia sobre el nombre del repo o la cuenta/organización destino?
