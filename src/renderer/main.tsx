import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
createRoot(document.getElementById('root')!).render(<main className="setup"><div className="logo">C.C.</div><p className="eyebrow">YOUR SEMESTER, SIMPLIFIED</p><h1>C.C. Lime</h1><p>A little structure. A lot more headspace.</p><button onClick={() => (window as any).lime.testNotification()}>Test desktop reminder</button><p className="muted">Desktop installation and persistence check</p></main>);
