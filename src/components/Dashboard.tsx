import React, { useState, useMemo } from 'react';
import { Activity } from '../types';
import { ActivityCard } from './ActivityCard';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Search, Filter, Calendar } from 'lucide-react';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface Props {
  activities: Activity[];
}

export const Dashboard: React.FC<Props> = ({ activities }) => {
  const [searchExec, setSearchExec] = useState('');
  const [searchArea, setSearchArea] = useState('');
  const [searchDate, setSearchDate] = useState('');

  const filteredActs = useMemo(() => {
    return activities.filter(a => {
      const execStr = String(a.executante || '').toLowerCase();
      const matchExec = execStr.includes(searchExec.toLowerCase());
      
      const areaStr = String(a.atividade || '').toLowerCase();
      const matchArea = areaStr.includes(searchArea.toLowerCase());
      
      const dateStr = String(a.data || '');
      const matchDate = dateStr.includes(searchDate);
      
      return matchExec && matchArea && matchDate;
    }).sort((a,b) => parseInt(a.ordem) - parseInt(b.ordem));
  }, [activities, searchExec, searchArea, searchDate]);

  // Aggregation for chart: Total, Pending, Rescheduled, Completed
  const total = activities.length;
  const pending = activities.filter(a => a.status === 'pending').length;
  const completed = activities.filter(a => a.status === 'completed').length;
  const rescheduled = activities.filter(a => a.status === 'rescheduled').length;

  const dataChart = [
    { name: 'Pendentes', value: pending, color: '#6366f1' }, // indigo-500
    { name: 'Concluídos', value: completed, color: '#22c55e' }, // green-500
    { name: 'Reprogramados', value: rescheduled, color: '#f59e0b' }, // amber-500
  ].filter(d => d.value > 0);

  const exportReport = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Relatório de Atividades');

    sheet.columns = [
      { header: 'Ordem', key: 'ordem', width: 10 },
      { header: 'Atividade', key: 'atividade', width: 40 },
      { header: 'Data', key: 'data', width: 15 },
      { header: 'Executante', key: 'executante', width: 25 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Observações', key: 'observacoes', width: 50 },
      { header: 'Anexo (Foto)', key: 'foto', width: 20 },
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { horizontal: 'center' };

    for (const a of activities) {
      let statusColor = 'FF6366F1'; // blue/indigo for pending
      let statusText = 'Pendente';
      
      if (a.status === 'completed') {
        statusColor = 'FF22C55E'; // green
        statusText = 'Concluído';
      } else if (a.status === 'rescheduled') {
        statusColor = 'FFF59E0B'; // orange/amber
        statusText = 'Reprogramado';
      }

      const row = sheet.addRow({
        ordem: a.ordem,
        atividade: a.atividade,
        data: a.data,
        executante: a.executante,
        status: statusText,
        observacoes: a.observacoes,
        foto: a.photoUrl ? 'Imagem inclusa' : 'Sem foto'
      });

      // Style the row with status color directly
      row.eachCell({ includeEmpty: true }, (cell) => {
        // apply background color if needed, maybe just color the text or the row
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: statusColor }
        };
        // make text white or dark depending on background
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      });

      if (a.photoUrl) {
         // Optionally embed image if base64. ExcelJS supports base64 images.
         try {
           const imageId = workbook.addImage({
             base64: a.photoUrl,
             extension: 'jpeg',
           });
           
           // enlarge the row height
           row.height = 80;
           sheet.addImage(imageId, {
             tl: { col: 6, row: row.number - 1 },
             ext: { width: 100, height: 100 }
           });
           row.getCell(7).value = ''; // clear text
         } catch(e) {
           console.log("Error embedding image");
         }
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `relatorio_atividades_${Date.now()}.xlsx`);
  };

  return (
    <div className="flex flex-col gap-6 pb-6">
      
      {/* Charts & Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <h2 className="text-sm font-bold text-slate-700 mb-4">Status Geral</h2>
            <div className="mt-2 grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl flex flex-col items-center justify-center border border-slate-100">
                 <span className="text-3xl font-bold text-slate-800">{total}</span>
                 <span className="text-[10px] uppercase font-semibold text-slate-400 mt-1 tracking-wider">Total</span>
              </div>
              <div className="bg-green-50 p-4 rounded-xl flex flex-col items-center justify-center border border-green-100">
                 <span className="text-3xl font-bold text-green-600">{completed}</span>
                 <span className="text-[10px] uppercase font-semibold text-green-700 mt-1 tracking-wider">Concluídos</span>
              </div>
              <div className="bg-amber-50 p-4 rounded-xl flex flex-col items-center justify-center border border-amber-100">
                 <span className="text-3xl font-bold text-amber-600">{rescheduled}</span>
                 <span className="text-[10px] uppercase font-semibold text-amber-700 mt-1 tracking-wider">Reprogramados</span>
              </div>
              <div className="bg-indigo-50 p-4 rounded-xl flex flex-col items-center justify-center border border-indigo-100">
                 <span className="text-3xl font-bold text-indigo-600">{pending}</span>
                 <span className="text-[10px] uppercase font-semibold text-indigo-700 mt-1 tracking-wider">Pendentes</span>
              </div>
            </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center">
            <h2 className="text-sm font-bold text-slate-700 uppercase w-full">Distribuição</h2>
            <div className="w-full h-48 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dataChart}
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {dataChart.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
        </div>
        <div className="bg-indigo-900 rounded-2xl p-6 text-white relative overflow-hidden flex flex-col justify-center shadow-md">
           <div className="relative z-10 flex flex-col items-center text-center">
              <div className="bg-indigo-800/50 p-3 rounded-full mb-4">
                 <svg className="w-8 h-8 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
              </div>
              <h3 className="text-base font-bold opacity-90 mb-2">Compartilhamento em Tempo Real</h3>
              <p className="text-xs text-indigo-200 mb-6 max-w-[220px]">Envie este link para que sua equipe acompanhe e atualize as atividades instantaneamente.</p>
              
              <button 
                onClick={() => {
                   const url = window.location.href;
                   navigator.clipboard.writeText(url);
                   alert('Link copiado! Agora é só enviar para a equipe.');
                }}
                className="w-full py-3 px-4 bg-white text-indigo-900 text-sm font-bold rounded-xl hover:bg-indigo-50 hover:scale-[1.02] active:scale-95 transition-all shadow-lg flex justify-center items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg> Copiar Link de Acesso
              </button>
           </div>
           {/* Decorative elements */}
           <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-indigo-500/30 rounded-full blur-3xl pointer-events-none"></div>
           <div className="absolute -left-10 -top-10 w-40 h-40 bg-indigo-300/10 rounded-full blur-3xl pointer-events-none"></div>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white px-6 py-4 rounded-2xl border border-slate-200 shadow-sm flex-wrap">
        <div className="flex flex-1 w-full gap-4 relative min-w-[250px]">
          <div className="relative flex-1 max-w-xs">
             <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
             <input 
               type="text" 
               placeholder="Buscar executante..." 
               className="w-full pl-9 pr-3 py-1.5 bg-slate-100 border-none rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
               value={searchExec}
               onChange={e => setSearchExec(e.target.value)}
             />
          </div>
          <div className="relative flex-1 max-w-xs">
             <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
             <input 
               type="text" 
               placeholder="Buscar atividade..." 
               className="w-full pl-9 pr-3 py-1.5 bg-slate-100 border-none rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
               value={searchArea}
               onChange={e => setSearchArea(e.target.value)}
             />
          </div>
          <div className="relative flex-1 max-w-xs">
             <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
             <input 
               type="text" 
               placeholder="Data (ex: 01/11/1986)..." 
               className="w-full pl-9 pr-3 py-1.5 bg-slate-100 border-none rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
               value={searchDate}
               onChange={e => setSearchDate(e.target.value)}
             />
          </div>
        </div>
        <div className="w-full md:w-auto flex mt-2 md:mt-0">
          <button onClick={exportReport} className="w-full md:w-auto bg-indigo-50 text-indigo-700 font-medium px-4 py-2 rounded-lg text-sm hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg> Extrair Relatório
          </button>
        </div>
      </div>

      {/* Activity List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
         {filteredActs.map(act => (
            <ActivityCard key={act.id} activity={act} />
         ))}
         {filteredActs.length === 0 && (
            <div className="col-span-full py-16 flex flex-col justify-center items-center text-slate-500 border border-dashed border-slate-300 rounded-2xl bg-white shadow-sm">
               <Search className="w-8 h-8 text-slate-300 mb-2"/>
               <span className="text-sm">Nenhuma atividade localizada com estes filtros.</span>
            </div>
         )}
      </div>

    </div>
  );
}

