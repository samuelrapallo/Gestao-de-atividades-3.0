import React, { useState, useRef, useEffect } from 'react';
import { Mic, StopCircle, Camera, CheckCircle2, RotateCcw, Clock, Info, X, Play } from 'lucide-react';
import { Activity, ActivityStatus } from '../types';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { resizeImage } from '../lib/media';

interface Props {
  activity: Activity;
}

// declare global typed window for speech
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export const ActivityCard: React.FC<Props> = ({ activity }) => {
  const [editing, setEditing] = useState(false);
  const [obsv, setObsv] = useState(activity.observacoes);
  
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  const [photoUrl, setPhotoUrl] = useState(activity.photoUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showInstructions, setShowInstructions] = useState(false);

  // Sync state if changed externally
  useEffect(() => {
    setObsv(activity.observacoes);
    setPhotoUrl(activity.photoUrl);
  }, [activity]);

  const handleUpdate = async (updates: Partial<Activity>) => {
    try {
      await updateDoc(doc(db, 'activities', activity.id), {
        ...updates,
        updatedAt: Date.now()
      });
    } catch (e) {
      console.error("Error updating doc", e);
      alert("Erro ao atualizar!");
    }
  };

  const handleStatus = (status: ActivityStatus) => {
    handleUpdate({ status });
  };

  const toggleRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Seu navegador não suporta reconhecimento de voz.");
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      const currentObsv = obsv ? `${obsv} ${transcript}` : transcript;
      setObsv(currentObsv);
      if (!editing) {
        // If not editing, auto-save the transcription immediately
        handleUpdate({ observacoes: currentObsv });
      }
    };

    recognition.onerror = (event: any) => {
      console.error(event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    try {
      recognition.start();
    } catch (e) {
      // might already be started
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const file = e.target.files[0];
        const base64 = await resizeImage(file, 800);
        setPhotoUrl(base64);
        handleUpdate({ photoUrl: base64 });
      } catch (err) {
        alert("Erro ao processar imagem.");
      }
    }
  };

  const saveObservation = () => {
    handleUpdate({ observacoes: obsv });
    setEditing(false);
  };

  // Status colors
  const sColor = {
    pending: 'bg-white border-slate-200',
    completed: 'bg-slate-50 border-emerald-200/40',
    rescheduled: 'bg-slate-50 border-amber-200/40'
  };

  return (
    <div className={`p-5 rounded-2xl border flex flex-col gap-4 shadow-sm transition-colors ${sColor[activity.status]}`}>
      <div className="flex justify-between items-start">
        <div className="flex flex-col">
          <span className="text-xs font-mono text-slate-600">#{activity.ordem}</span>
          <h3 className="font-medium text-slate-800 leading-tight mt-1 line-clamp-2">{activity.atividade}</h3>
          <p className="text-xs text-slate-500 italic mt-1.5 flex items-center gap-2">
            <span className="not-italic text-slate-700 bg-slate-100 px-2 py-0.5 rounded font-medium">{activity.executante}</span>
            {activity.data}
          </p>
        </div>
        <button 
          onClick={() => setShowInstructions(true)}
          className="text-slate-400 p-1.5 rounded-full hover:text-indigo-600 transition-colors"
          title="Instruções"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </button>
      </div>

      <div className="flex flex-col gap-2 mt-1">
        {activity.status === 'pending' ? (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => handleStatus('completed')}
              className="flex-1 bg-green-100 text-green-700 py-2 rounded-lg font-bold text-[10px] uppercase flex justify-center items-center tracking-wider hover:bg-green-200 active:scale-95 transition-all"
            >
              Concluir
            </button>
            <button 
              onClick={() => handleStatus('rescheduled')}
              className="flex-1 bg-amber-100 text-amber-700 py-2 rounded-lg font-bold text-[10px] uppercase flex justify-center items-center tracking-wider hover:bg-amber-200 active:scale-95 transition-all"
            >
              Reprogramar
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${activity.status === 'completed' ? 'bg-green-500' : 'bg-amber-500'}`}></span>
              <span className={`text-[10px] font-bold uppercase ${activity.status === 'completed' ? 'text-green-600' : 'text-amber-600'}`}>
                {activity.status === 'completed' ? 'CONCLUÍDO' : 'REPROGRAMADO'}
              </span>
            </div>
            <button 
              onClick={() => handleStatus('pending')}
              className="px-2 py-1 border border-slate-200 text-slate-600 rounded text-[10px] font-bold uppercase hover:bg-slate-100 active:scale-95 transition-all"
              title="Refazer"
            >
              Refazer
            </button>
          </div>
        )}
      </div>

      {showInstructions && (
        <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50 text-sm text-indigo-900 relative">
          <button onClick={() => setShowInstructions(false)} className="absolute top-2 right-2 text-indigo-400 hover:text-indigo-600">
            <X className="w-4 h-4" />
          </button>
          <h4 className="font-bold mb-1 text-xs uppercase tracking-wide opacity-80">Instruções da Atividade:</h4>
          <p className="text-slate-600">Realize a atividade indicada conforme as normas de segurança. Preencha as observações em caso de anormalidades, ou tire foto do local/equipamento.</p>
        </div>
      )}

      {/* Observations & Media */}
      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mt-auto">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Observações</h4>
        
        {editing ? (
          <div className="flex flex-col gap-2">
            <textarea 
              value={obsv}
              onChange={(e) => setObsv(e.target.value)}
              className="w-full h-24 p-3 text-sm rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
              placeholder="Descreva os detalhes da atividade..."
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-1">
              <button 
                onClick={() => setEditing(false)} 
                className="p-1.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                title="Cancelar"
              >
                <X className="w-4 h-4" />
              </button>
              <button onClick={saveObservation} className="py-1.5 px-4 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-lg shadow-indigo-100 flex items-center">
                Salvar Mudanças
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 min-h-[40px] bg-white rounded-xl border border-slate-200 p-3">
            <p 
              className={`flex-1 text-sm cursor-text ${!obsv ? 'text-slate-400 italic' : 'text-slate-700'}`}
              onClick={() => setEditing(true)}
            >
              {obsv || "Descreva os detalhes da atividade..."}
            </p>
          </div>
        )}
        
        <div className="mt-3 flex gap-2 flex-wrap empty:hidden">
          {activity.audioUrl && (
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-full px-3 py-1 w-fit shadow-sm">
              <audio src={activity.audioUrl} controls className="h-8 max-w-[150px]" />
              <button onClick={() => handleUpdate({ audioUrl: '' })} className="p-1 text-slate-400 hover:text-red-500 rounded-full"><X className="w-4 h-4" /></button>
            </div>
          )}
          {photoUrl && (
            <div className="relative group">
              <img src={photoUrl} alt="Anexo" className="h-16 w-16 object-cover rounded-xl border border-slate-200 shadow-sm" />
              <button 
                onClick={() => handleUpdate({ photoUrl: '' })} 
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow hover:bg-red-600 scale-0 group-hover:scale-100 transition-transform"
              >
                <X className="w-3 h-3"/>
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <button 
                onClick={toggleRecording}
                className={`p-1.5 rounded-full transition-colors flex items-center gap-2 shadow-sm border ${isRecording ? 'bg-indigo-50 border-indigo-200 text-indigo-700 px-3 animate-pulse' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                title={isRecording ? 'Parar reconhecimento' : 'Ditar observação'}
             >
                {isRecording ? <StopCircle className="w-4 h-4"/> : <Mic className="w-4 h-4" />}
                {isRecording && <span className="text-[10px] font-bold uppercase tracking-wider pr-1">Dite agora</span>}
             </button>

             <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 bg-white border border-slate-200 shadow-sm text-slate-600 hover:bg-slate-50 rounded-full transition-colors flex items-center justify-center"
                title="Anexar Foto"
             >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
             </button>
             <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handlePhotoUpload}
             />
          </div>
        </div>

      </div>

    </div>
  );
}
