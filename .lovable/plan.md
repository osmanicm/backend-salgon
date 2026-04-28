## Agregar botón "Cerrar sesión" en el header móvil

Actualmente la versión móvil del header (`MobileHeader`) muestra un avatar estático sin acción de cerrar sesión. Los usuarios (admin y agente) en móvil no tienen forma directa de salir desde la barra superior.

### Cambio propuesto

En `src/components/layout/MobileHeader.tsx`:
- Agregar un botón de logout (icono `LogOut` de lucide-react) al lado del avatar.
- Conectar `useAuth()` para obtener `signOut` e iniciales reales del perfil.
- Al hacer clic: ejecutar `await signOut()`, mostrar toast `"Sesión cerrada"`, y navegar a `/auth` con `useNavigate()` de `@tanstack/react-router`.
- Mantener el mismo estilo visual (botón redondo, `h-9 w-9`, hover `bg-muted`) consistente con los otros íconos del header móvil.

Esto aplica automáticamente a ambos roles (admin y agente) ya que ambos comparten el mismo `MobileHeader` vía `AppShell`.

### Archivos modificados
- `src/components/layout/MobileHeader.tsx`