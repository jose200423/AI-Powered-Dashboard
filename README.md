# Rappi Monitoring Dashboard

Dashboard de análisis de monitoreo sintético de disponibilidad de tiendas Rappi (febrero 2026). Visualiza series de tiempo acumulativas, detecta incidentes automáticamente e incluye un asistente de IA con soporte de imágenes.

---

## Requisitos

- [Node.js](https://nodejs.org/) v18 o superior
- Cuenta de Azure OpenAI con un deployment de **GPT-4o** o **GPT-4 Turbo Vision** (para el chatbot con análisis de imágenes)

---

## Instalación

```bash
cd rappi-dashboard
npm install
```

---

## Configuración del chatbot

Crea un archivo `.env` en la raíz del proyecto:

```env
VITE_AZURE_ENDPOINT=https://tu-recurso.openai.azure.com
VITE_AZURE_API_KEY=tu-api-key
VITE_AZURE_DEPLOYMENT=nombre-del-deployment
```

Sin estas variables el dashboard funciona igual, pero el chatbot mostrará un aviso de que no está configurado.

---

## Comandos

```bash
npm run dev      # Servidor de desarrollo → http://localhost:5173
npm run build    # Build de producción → /dist
npm run preview  # Previsualizar el build
```

---

## Funcionalidades

### Visualizaciones

| Gráfico | Qué muestra |
|---|---|
| Serie de tiempo | Evolución acumulada del día. Con varios días seleccionados muestra el promedio. Incluye banda de zona normal (media ± 1 desviación estándar histórica). |
| Caídas y subidas por hora | Variación neta de verificaciones por hora. Barras rojas = caída neta, amarillas = incidentes en esa hora, naranja = normal. |
| Scatter de incidentes | Cada incidente como un punto. Eje X = hora, eje Y = magnitud, tamaño = severidad. |
| Mapa de calor | Grilla día × hora con color rojo→verde según disponibilidad promedio. Clic en celda filtra ese día. |
| Comparativa todos los días | Los 11 días superpuestos para detectar outliers y patrones. |
| Resumen del período | Tarjeta con métricas calculadas: total incidentes, hora con más problemas, recuperación más lenta y tendencia del período. |
| Tabla de incidentes | Detalle de cada caída: hora, magnitud, duración estimada de recuperación. Ordenable por columna. |

### Filtros

- **Selector de fechas** — chips para seleccionar uno o varios días
- **Rango horario** — acota el análisis a una franja específica del día; todos los cálculos se actualizan reactivamente
- **Modo comparación** — superpone múltiples días en la gráfica principal con colores distintos

### Chatbot con IA (Azure OpenAI)

- Responde preguntas en lenguaje natural sobre los datos en español
- Conoce el contexto actual del dashboard: día seleccionado, filtros activos, incidentes en pantalla
- **Soporta imágenes**: botón 📎 para adjuntar capturas de pantalla de cualquier gráfica

---

## Estructura del proyecto

```
src/
├── App.jsx                        # Componente raíz, estado global y orquestación
├── App.css                        # Todos los estilos (tema oscuro)
├── index.css                      # Reset global
├── main.jsx                       # Punto de entrada React
├── components/
│   ├── FilterBar.jsx              # Chips de fechas, rango horario, modo comparación
│   ├── MainLineChart.jsx          # Serie de tiempo + banda de zona normal
│   ├── VelocityBarChart.jsx       # Caídas y subidas por hora
│   ├── IncidentScatter.jsx        # Scatter de incidentes
│   ├── HeatmapPanel.jsx           # Mapa de calor día × hora
│   ├── ComparativeLineChart.jsx   # Todos los días superpuestos
│   ├── IncidentSummary.jsx        # Resumen automático del período
│   ├── IncidentsTable.jsx         # Tabla detallada de incidentes
│   ├── ChartWrapper.jsx           # Lazy render por IntersectionObserver
│   ├── Chatbot.jsx                # Chatbot Azure OpenAI + soporte de imágenes
│   └── ChatbotContainer.jsx       # Contenedor aislado del chatbot (evita re-renders)
├── utils/
│   └── dataLoader.js              # Carga, enriquecimiento y filtrado de datos
└── hooks/
    └── useStaggered.js            # Carga progresiva escalonada de componentes
```

---

## Datos

Los datos se leen desde `public/data.json`. Son 11 días (1–11 de febrero 2026) de verificaciones sintéticas acumulativas de tiendas Rappi, con entre 537 y 1,076 registros por día en horario 06:00–23:59.

Cada registro tiene la forma `{ "time": "HH:MM", "value": N }` donde `value` es el conteo acumulado de verificaciones desde el inicio del día.
