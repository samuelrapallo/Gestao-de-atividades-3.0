import React, { useState, useEffect } from 'react';
import { useSpreadsheet, uploadSpreadsheet, deleteSpreadsheet } from './lib/data';
import { auth, loginAnonymously, logout, db } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Dashboard } from './components/Dashboard';
import { FileDown, UploadCloud, LogIn, LogOut, Copy, Trash2, ArrowLeft } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Spreadsheet } from './types';

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const docId = params.get('sheet');

  const { spreadsheet, activities, loading } = useSpreadsheet(docId);
  const [user, setUser] = useState<any>(null);
  
  const [uploading, setUploading] = useState(false);
  const [userSheets, setUserSheets] = useState<Spreadsheet[]>([]);

  useEffect(() => {
    let syncing = false;
    const unsub = onAuthStateChanged(auth, async u => {
      setUser(u);
      if (u) {
        const q = query(collection(db, 'spreadsheets'), where('adminUid', '==', u.uid));
        onSnapshot(q, snap => {
          const s = snap.docs.map(d => ({id: d.id, ...d.data()})) as Spreadsheet[];
          setUserSheets(s.sort((a,b) => b.createdAt - a.createdAt));
        });
      } else {
        setUserSheets([]);
        if (!syncing) {
            syncing = true;
            try {
               await loginAnonymously();
            } catch (err) {
               console.error("Anonymous login error", err);
            }
            syncing = false;
        }
      }
    });
    return unsub;
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !user) return;
    try {
      setUploading(true);
      const id = await uploadSpreadsheet(e.target.files[0], user.uid);
      window.location.href = `/?sheet=${id}`;
    } catch (err) {
      alert("Erro ao importar planilha. Verifique o formato.");
    } finally {
      setUploading(false);
    }
  };

  const copyLink = (id: string) => {
    const url = `${window.location.origin}/?sheet=${id}`;
    navigator.clipboard.writeText(url);
    alert('Link copiado! Envie para seus colaboradores.');
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (confirm('Tem certeza que deseja apagar esta planilha e todas suas atividades?')) {
      try {
        await deleteSpreadsheet(id);
        if (docId === id) {
          window.location.href = '/';
        }
      } catch (err) {
        console.error("Erro ao apagar planilha:", err);
        alert("Ocorreu um erro ao apagar a planilha. Tente novamente.");
      }
    }
  };

  if (loading && docId) {
    return <div className="min-h-screen flex items-center justify-center font-semibold text-slate-500 bg-slate-50">Adquirindo dados em tempo real...</div>;
  }

  // Active Document View
  if (docId && spreadsheet) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-12">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => window.location.href = '/'} className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="font-bold text-lg leading-tight text-slate-800 truncate max-w-[200px] md:max-w-md">{spreadsheet.filename}</h1>
                <p className="text-xs text-slate-500 font-mono">Sincronização Ativa</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => copyLink(spreadsheet.id)} 
                className="text-indigo-600 font-medium text-sm flex items-center gap-1.5 hover:bg-indigo-50 py-1.5 px-3 rounded-lg border border-transparent hover:border-indigo-100 transition-colors"
                title="Copiar link de acesso"
              >
                <Copy className="w-4 h-4"/> <span className="hidden sm:inline">Compartilhar</span>
              </button>
              {user?.uid === spreadsheet.adminUid && (
                <button onClick={(e) => handleDelete(spreadsheet.id, e)} className="text-red-500 font-medium text-sm flex items-center gap-1.5 hover:bg-red-50 py-1.5 px-3 rounded-lg border border-transparent hover:border-red-100 transition-colors" title="Apagar planilha inteira">
                  <Trash2 className="w-4 h-4"/> <span className="hidden sm:inline">Apagar</span>
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto p-4 md:p-6 mt-4">
          <Dashboard activities={activities} />
        </main>
      </div>
    );
  }

  // Admin / Landing Page
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md mx-auto w-full space-y-8">
        
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Gestão de Atividades</h2>
          <p className="mt-2 text-sm text-slate-500">Importe sua planilha executiva e colabore em tempo real.</p>
        </div>

        {!user ? (
          <div className="bg-white py-12 px-6 shadow-sm rounded-2xl border border-slate-200 text-center flex flex-col items-center justify-center">
             <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
             <p className="text-sm text-slate-500">Preparando ambiente...</p>
          </div>
        ) : (
          <div className="bg-white py-6 px-6 shadow-sm rounded-2xl border border-slate-200 flex flex-col gap-6">
             <div className="flex items-center justify-between pb-4 border-b border-slate-100">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-slate-300 flex items-center justify-center text-slate-600 font-bold">
                   {user.isAnonymous ? 'G' : (user.displayName?.[0] || 'U')}
                 </div>
                 <div className="flex flex-col">
                   <span className="text-sm font-semibold text-slate-700 leading-tight truncate">{user.isAnonymous ? 'Convidado' : user.displayName || 'Usuário'}</span>
                   <span className="text-[10px] text-green-600 flex items-center gap-1 mt-0.5"><span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Sincronizado</span>
                 </div>
               </div>
               <button onClick={logout} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors"><LogOut className="w-5 h-5"/></button>
             </div>

             <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 transition relative">
               <UploadCloud className="w-8 h-8 text-indigo-500 mb-2"/>
               <h3 className="text-sm font-semibold text-slate-700">Carregar Planilha (.xlsx, .csv)</h3>
               <p className="text-xs text-slate-400 mt-1 max-w-[250px] text-center">Colunas esperadas: ATIVIDADE, ORDEM, DATA, EXECUTANTE</p>
               <input 
                 type="file" 
                 accept=".xlsx, .xls, .csv" 
                 onChange={handleFileUpload}
                 disabled={uploading}
                 className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-wait"
               />
               {uploading && <div className="absolute inset-0 bg-white/80 rounded-xl flex flex-col items-center justify-center font-bold text-indigo-600 text-sm">Processando...</div>}
             </div>

             {userSheets.length > 0 && (
               <div>
                 <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Suas Planilhas</h4>
                 <div className="flex flex-col gap-3">
                   {userSheets.map(s => (
                     <div key={s.id} className="border border-slate-100 rounded-lg p-3 flex flex-col gap-2 hover:border-indigo-200 hover:bg-indigo-50/10 transition group relative">
                       <div className="flex items-center justify-between">
                         <a href={`/?sheet=${s.id}`} className="font-medium text-sm text-slate-700 hover:text-indigo-600 line-clamp-1 pr-6 flex-1">{s.filename}</a>
                         <button onClick={(e) => handleDelete(s.id, e)} className="text-slate-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition absolute right-2 top-2">
                           <Trash2 className="w-4 h-4"/>
                         </button>
                       </div>
                       <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-slate-400">{new Date(s.createdAt).toLocaleDateString()}</span>
                          <button onClick={() => copyLink(s.id)} className="text-xs font-semibold text-indigo-600 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-md flex items-center gap-1 transition-colors">
                            <Copy className="w-3 h-3"/> Link
                          </button>
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
             )}

          </div>
        )}

      </div>
    </div>
  );
}

