import React, { useState } from 'react';
import { Download, Terminal, Check, Copy, FileCode, Monitor, X } from 'lucide-react';
import { Logo } from './Logo';

interface ExeBuilderGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExeBuilderGuideModal: React.FC<ExeBuilderGuideModalProps> = ({ isOpen, onClose }) => {
  const [copiedScript, setCopiedScript] = useState<string | null>(null);

  if (!isOpen) return null;

  const electronPackageSnippet = `{
  "name": "e-access-web-desktop",
  "version": "2.4.0",
  "main": "electron/main.js",
  "scripts": {
    "build:exe": "vite build && electron-builder --win nsis"
  },
  "devDependencies": {
    "electron": "^30.0.0",
    "electron-builder": "^24.13.0"
  }
}`;

  const electronMainSnippet = `const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1366,
    height: 800,
    title: 'E-ACCESS WEB - Medical Software Solutions',
    icon: path.join(__dirname, '../public/icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  // Load built index.html for production offline desktop app
  win.loadFile(path.join(__dirname, '../dist/index.html'));
  win.removeMenu(); // Professional clean desktop header
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});`;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(id);
    setTimeout(() => setCopiedScript(null), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-2xl w-full text-slate-100 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="bg-slate-800/80 px-6 py-4 border-b border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <Logo variant="icon" size={36} themeMode="dark" />
            <div>
              <h3 className="font-extrabold text-sm text-white tracking-wide">E-ACCESS WEB</h3>
              <p className="text-[11px] text-sky-400 font-medium">Packageur Windows — Medical Software Solutions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
          <div className="p-3 bg-blue-950/60 border border-blue-800 rounded-xl text-xs text-blue-200 flex items-start space-x-2">
            <Download className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <span>
              <strong>E-ACCESS WEB</strong> est conçu avec une architecture hors-ligne 100% autonome. Vous pouvez générer un installateur <strong>E-Access-Web-Setup</strong> autonome en 3 commandes.
            </span>
          </div>

          {/* Steps */}
          <div className="space-y-4 text-xs">
            <div className="space-y-1">
              <h4 className="font-bold text-slate-200 text-xs flex items-center space-x-2">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">1</span>
                <span>Commandes de Compilation Windows</span>
              </h4>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-400 space-y-1">
                <div># 1. Installer Electron pour Windows</div>
                <div className="text-white">npm install -D electron electron-builder</div>
                <div className="pt-2 text-slate-500"># 2. Générer l'exécutable .EXE dans le dossier dist_electron/</div>
                <div className="text-white">npx electron-builder --win nsis</div>
              </div>
            </div>

            {/* Electron main.js snippet */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-200 text-xs flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">2</span>
                  <span>Fichier <code className="text-emerald-400 font-mono">electron/main.js</code></span>
                </h4>
                <button
                  onClick={() => copyToClipboard(electronMainSnippet, 'main')}
                  className="text-[10px] text-slate-400 hover:text-white flex items-center space-x-1"
                >
                  {copiedScript === 'main' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedScript === 'main' ? 'Copié' : 'Copier script'}</span>
                </button>
              </div>
              <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[10px] text-slate-300 overflow-x-auto">
                {electronMainSnippet}
              </pre>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/80 px-6 py-3 border-t border-slate-700 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition"
          >
            J'ai compris
          </button>
        </div>
      </div>
    </div>
  );
};
