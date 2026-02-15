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
const getActiveRoutePath = () => {
  const hash = window.location.hash || '';
  if (hash.startsWith('#/')) {
    const hashRoute = hash.slice(1);
    const queryIndex = hashRoute.indexOf('?');
    return queryIndex >= 0 ? hashRoute.slice(0, queryIndex) : hashRoute;
  }
  return window.location.pathname;
};

const activeRoutePath = getActiveRoutePath();
const isRemoteRoute = activeRoutePath.startsWith('/remote');
const isOutputRoute = activeRoutePath.startsWith('/output');

root.render(
  <React.StrictMode>
    {isOutputRoute ? <OutputRoute /> : isRemoteRoute ? <RemoteControl /> : <App />}
  </React.StrictMode>
);
