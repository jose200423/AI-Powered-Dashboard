import { useState, memo } from 'react';
import Chatbot from './Chatbot';

/**
 * Completely isolated chatbot state so toggling open/close
 * never triggers a re-render of the main dashboard.
 */
const ChatbotContainer = memo(function ChatbotContainer({ allDays, dashboardContext }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {!open && (
        <button
          className="chat-fab"
          onClick={() => setOpen(true)}
          title="Abrir asistente"
          aria-label="Abrir chat"
        >
          💬
        </button>
      )}
      <Chatbot allDays={allDays} dashboardContext={dashboardContext} open={open} onClose={() => setOpen(false)} />
    </>
  );
});

export default ChatbotContainer;
