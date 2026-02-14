import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { RemoteControl } from './components/RemoteControl';
import { OutputRoute } from './components/OutputRoute';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
const isRemoteRoute = window.location.pathname.startsWith('/remote');
const isOutputRoute = window.location.pathname.startsWith('/output');

root.render(
  <React.StrictMode>
    {isOutputRoute ? <OutputRoute /> : isRemoteRoute ? <RemoteControl /> : <App />}
  </React.StrictMode>
);
