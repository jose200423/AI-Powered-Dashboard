import { useState, useRef, useEffect } from 'react';
import { fmtDate } from '../utils/dataLoader';

const ENDPOINT   = import.meta.env.VITE_AZURE_ENDPOINT;
const API_KEY    = import.meta.env.VITE_AZURE_API_KEY;
const DEPLOYMENT = import.meta.env.VITE_AZURE_DEPLOYMENT;

function buildSystemPrompt(allDays, dashboardContext) {
  const base = `Eres un asistente experto en análisis de monitoreo sintético de tiendas Rappi.
Tienes datos de verificaciones acumuladas diarias del 1 al 11 de febrero 2026.
Son verificaciones acumulativas de monitoreo sintético de tiendas: sube durante el día,
los picos = más tiendas activas, las caídas abruptas = incidentes.
Datos: 11 días, ~1070 puntos por día, horario 06:00–23:59.
Si el usuario te envía una imagen de una gráfica, analízala y explícala en el contexto del dashboard de monitoreo Rappi.`;

  if (!allDays?.length) return base;

  const daySummaries = allDays.map(day => {
    const d = fmtDate(day.date);
    return `  • ${d}: max=${day.stats.max.toLocaleString()}, avg=${day.stats.avg.toLocaleString()}, growth=${day.growth.toLocaleString()}, incidentes=${day.incidentCount}, hora_pico=${day.peakHour?.label ?? 'N/A'}`;
  }).join('\n');

  let currentView = '';
  if (dashboardContext) {
    const { selectedDates, startTime, endTime, selectedDays } = dashboardContext;
    const filteredLabel = startTime !== '06:00' || endTime !== '23:59'
      ? ` (filtro horario ${startTime}–${endTime})`
      : '';
    const daysLabel = selectedDates.map(fmtDate).join(', ') || 'ninguno';

    const viewStats = selectedDays?.length
      ? selectedDays.map(day => {
          const incidents = (day.filteredIncidents ?? day.incidents ?? []);
          const incDesc = incidents.length
            ? incidents.slice(0, 3).map(i => `${i.time} delta=${i.delta.toLocaleString()}`).join('; ')
            : 'ninguno';
          return `  • ${fmtDate(day.date)}${filteredLabel}: max=${day.stats?.max?.toLocaleString() ?? 'N/A'}, incidentes=${incidents.length}, top_incidentes=[${incDesc}]`;
        }).join('\n')
      : '  (sin días seleccionados)';

    currentView = `

VISTA ACTUAL DEL DASHBOARD (lo que el usuario está viendo ahora):
  Días seleccionados: ${daysLabel}${filteredLabel}
  Comparación activa: ${selectedDates.length > 1 ? 'sí (' + selectedDates.length + ' días)' : 'no'}
${viewStats}
Cuando respondas, prioriza esta vista actual por sobre los datos globales si la pregunta es sobre "ahora", "lo que ves", "el gráfico actual", etc.`;
  }

  return `${base}

STATS POR DÍA (dataset completo):
${daySummaries}${currentView}

Responde en español. Sé conciso y orientado a datos. Cita métricas específicas cuando sea posible.`;
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Chatbot({ allDays, dashboardContext, open, onClose }) {
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: '¡Hola! Soy tu asistente de análisis Rappi. Conozco los datos del 1 al 11 de febrero 2026 y veo en tiempo real lo que está mostrando el dashboard. También puedes enviarme una captura de pantalla de cualquier gráfica para que te la explique. ¿Sobre qué día, incidente o métrica quieres saber?',
  }]);
  const [input,    setInput]    = useState('');
  const [image,    setImage]    = useState(null);   // { file, base64, preview }
  const [loading,  setLoading]  = useState(false);
  const configured = Boolean(ENDPOINT && API_KEY && DEPLOYMENT);
  const bottomRef  = useRef(null);
  const fileRef    = useRef(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  function handleImageSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    toBase64(file).then(base64 => setImage({ file, base64, preview, type: file.type }));
    e.target.value = '';
  }

  function removeImage() {
    if (image?.preview) URL.revokeObjectURL(image.preview);
    setImage(null);
  }

  async function sendMessage() {
    const text = input.trim();
    if ((!text && !image) || loading) return;

    // Build user message content
    const userContent = image
      ? [
          ...(text ? [{ type: 'text', text }] : [{ type: 'text', text: 'Explícame esta gráfica.' }]),
          { type: 'image_url', image_url: { url: `data:${image.type};base64,${image.base64}` } },
        ]
      : text;

    const userMsg     = { role: 'user', content: userContent, preview: image?.preview };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    removeImage();
    setLoading(true);

    if (!configured) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ Azure OpenAI no está configurado. Agrega VITE_AZURE_ENDPOINT, VITE_AZURE_API_KEY y VITE_AZURE_DEPLOYMENT en .env y reinicia.',
      }]);
      setLoading(false);
      return;
    }

    try {
      const url = `${ENDPOINT}/openai/deployments/${DEPLOYMENT}/chat/completions?api-version=2024-02-01`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': API_KEY },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: buildSystemPrompt(allDays, dashboardContext) },
            ...newMessages.map(m => ({ role: m.role, content: m.content })),
          ],
          max_tokens: 900,
          temperature: 0.3,
        }),
      });

      if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
      const data  = await res.json();
      const reply = data.choices?.[0]?.message?.content ?? 'Sin respuesta.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Error: ${e.message}`,
      }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function renderContent(content) {
    if (typeof content === 'string') return content;
    return content.find(c => c.type === 'text')?.text ?? '';
  }

  return (
    <>
      {open && <div className="chat-overlay" onClick={onClose} />}
      <aside className={`chatbot-panel ${open ? 'open' : ''}`}>
        <div className="chatbot-header">
          <span className="chatbot-icon">🤖</span>
          <div>
            <p className="chatbot-title">Asistente Rappi</p>
            <p className="chatbot-sub">{configured ? `Azure OpenAI · ${dashboardContext?.selectedDates?.length ?? 0} día(s) en vista` : 'Sin configurar'}</p>
          </div>
          <span className={`chatbot-dot ${configured ? 'green' : 'red'}`} />
          <button className="chatbot-close" onClick={onClose}>✕</button>
        </div>

        <div className="chatbot-messages">
          {messages.map((m, i) => (
            <div key={i} className={`chat-msg ${m.role}`}>
              {m.preview && (
                <img src={m.preview} alt="captura enviada" className="chat-img-preview" />
              )}
              <p>{renderContent(m.content)}</p>
            </div>
          ))}
          {loading && (
            <div className="chat-msg assistant">
              <p className="typing"><span /><span /><span /></p>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Image preview before sending */}
        {image && (
          <div className="chat-img-pending">
            <img src={image.preview} alt="imagen seleccionada" />
            <button className="chat-img-remove" onClick={removeImage}>✕</button>
          </div>
        )}

        <div className="chatbot-input-row">
          <button
            className="chatbot-img-btn"
            onClick={() => fileRef.current?.click()}
            title="Adjuntar captura de pantalla"
            disabled={loading}
          >
            📎
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageSelect}
          />
          <textarea
            className="chatbot-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Pregunta o adjunta una captura…"
            rows={2}
            disabled={loading}
          />
          <button
            className="chatbot-send"
            onClick={sendMessage}
            disabled={loading || (!input.trim() && !image)}
          >
            ➤
          </button>
        </div>
      </aside>
    </>
  );
}
