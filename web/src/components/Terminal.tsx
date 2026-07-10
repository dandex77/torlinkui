import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useWebSocket } from '../hooks/useWebSocket';

interface TerminalProps {
  url: string;
}

const Terminal: React.FC<TerminalProps> = ({ url }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);

  // Use the robust WebSocket hook for automatic reconnection
  const { sendMessage } = useWebSocket({
    url,
    onMessage: (event) => {
      if (!xtermRef.current) return;
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'data' || msg.type === 'raw') {
          xtermRef.current.write(msg.data);
        }
      } catch (e) {
        // If it's not JSON, it's raw terminal data
        xtermRef.current.write(event.data.toString());
      }
    },
    onClose: () => {
      console.log('WebSocket disconnected');
      xtermRef.current?.write('\r\n\x1b[31mConnection lost. Attempting to reconnect...\x1b[0m\r\n');
    },
  });

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize terminal
    const term = new XTerm({
      cursorBlink: true,
      scrollback: 1000,
      theme: {
        background: '#1e1e1e',
      },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    xtermRef.current = term;

    // Attach to DOM
    term.open(terminalRef.current);
    fitAddon.fit();

    // Handle terminal input
    term.onData((data) => {
      if (data) {
        sendMessage(data);
      }
    });

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
      sendMessage({
        type: 'resize',
        cols: term.cols,
        rows: term.rows
      });
    };

    window.addEventListener('resize', handleResize);

    // Initial resize to ensure correct dimensions
    setTimeout(handleResize, 0);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, [url, sendMessage]);

  return (
    <div 
      ref={terminalRef} 
      style={{ 
        width: '100%', 
        height: '100%', 
        backgroundColor: '#1e1e1e',
        padding: '10px'
      }} 
    />
  );
};

export default Terminal;
