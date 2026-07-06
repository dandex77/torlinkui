import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  url: string;
}

const Terminal: React.FC<TerminalProps> = ({ url }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize terminal
    const term = new XTerm({
      cursorBlink: true,
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

    // Connect to WebSocket
    const socket = new WebSocket(url);

    socket.onopen = () => {
      console.log('WebSocket connected');
    };

    socket.onmessage = (event) => {
      console.log('Received message:', event.data);
      try {
        // If it's a JSON message (like 'update', 'search_start', etc.)
        const msg = JSON.parse(event.data);
        if (msg.type === 'data') {
          term.write(msg.data);
        } else if (msg.type === 'raw') {
          // Handle the 'raw' type we added to server/index.js
          term.write(msg.data);
        }
      } catch (e) {
        // If it's not JSON, it's raw terminal data
        term.write(event.data.toString());
      }
    };

    socket.onclose = () => {
      console.log('WebSocket disconnected');
      term.write('\r\n\x1b[31mConnection closed.\x1b[0m\r\n');
    };

    // Handle terminal input
    term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        // Send raw data as per server implementation fallback
        socket.send(data);
      }
    });

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'resize',
          cols: term.cols,
          rows: term.rows
        }));
      }
    };

    window.addEventListener('resize', handleResize);

    // Initial resize to ensure correct dimensions
    setTimeout(handleResize, 0);

    return () => {
      window.removeEventListener('resize', handleResize);
      socket.close();
      term.dispose();
    };
  }, [url]);

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