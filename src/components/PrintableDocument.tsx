import React, { useState, useEffect } from 'react';
import { Printer, FileDown, Settings2, X, Check, MapPin, Phone, Mail, Loader2 } from 'lucide-react';
import { Logo } from './Logo';
import { safeGetItem, safeSetItem } from '../utils/safeStorage';
import {
  CabinetSettings,
  Prescription,
  MedicalCertificate,
  AnalysisRequest,
  Invoice,
  Appointment,
  Patient,
  UltrasoundReport,
} from '../types';
import { t } from '../utils/translations';
import { getStatusConfig } from '../utils/statusConfig';
import { translateToArabic } from '../utils/arabicTranslator';

export type PrintableDocType =
  | 'prescription'
  | 'certificate'
  | 'analysis'
  | 'ultrasound'
  | 'invoice'
  | 'schedule'
  | 'report'
  | 'patient_record';

export type PaperSize = 'A4' | 'A5';
export type PrintOutputMode = 'printer' | 'pdf';

interface PrintableDocumentProps {
  type: PrintableDocType;
  settings: CabinetSettings;
  data: {
    prescription?: Prescription;
    certificate?: MedicalCertificate;
    analysis?: AnalysisRequest;
    ultrasound?: UltrasoundReport;
    invoice?: Invoice;
    schedule?: { date: string; appointments: Appointment[] };
    report?: { title: string; summary: string; items: { label: string; value: string }[] };
    patientRecord?: Patient;
  };
  onClose: () => void;
  onPrint?: () => void;
}

const splitBilingual = (text: string, type: 'name' | 'speciality' | 'address' | 'cabinet'): { fr: string; ar: string } => {
  if (!text) return { fr: '', ar: '' };
  
  const hasArabic = (str: string) => /[\u0600-\u06FF]/.test(str);
  const hasLatin = (str: string) => /[a-zA-Z]/.test(str);
  
  // First, check if there is an explicit separator
  const separators = ['/', '|', ' — ', ' - ', ' – '];
  for (const sep of separators) {
    if (text.includes(sep)) {
      const parts = text.split(sep);
      const part0 = parts[0].trim();
      const part1 = parts[1].trim();
      
      if (hasArabic(part1) && hasLatin(part0)) {
        return { fr: part0, ar: part1 };
      }
      if (hasArabic(part0) && hasLatin(part1)) {
        return { fr: part1, ar: part0 };
      }
      if (hasArabic(part0)) {
        return { fr: part1, ar: part0 };
      }
      return { fr: part0, ar: part1 };
    }
  }
  
  // If no separator but contains BOTH Latin and Arabic, split them using regex!
  if (hasArabic(text) && hasLatin(text)) {
    const latinMatch = text.match(/[a-zA-Z0-9\s\.,\-\(\)\'\’\@\+\:]+/g);
    const arabicMatch = text.match(/[\u0600-\u06FF0-9\s\.,\-\(\)\'\’\@\+\:]+/g);
    
    let fr = latinMatch ? latinMatch.join(' ').replace(/\s+/g, ' ').trim() : '';
    let ar = arabicMatch ? arabicMatch.join(' ').replace(/\s+/g, ' ').trim() : '';
    
    return { fr: fr || text, ar: ar || text };
  }
  
  // Fallbacks: If only Arabic, return as both or let it be
  if (hasArabic(text)) {
    return { fr: text, ar: text };
  }
  
  // If only French, translate it to Arabic automatically!
  return { fr: text, ar: translateToArabic(text, type) };
};

export const PrintableDocument: React.FC<PrintableDocumentProps> = ({
  type,
  settings,
  data,
  onClose,
}) => {
  const [paperSize, setPaperSize] = useState<PaperSize>(() => {
    return (safeGetItem('medicab_print_format') as PaperSize) || 'A4';
  });
  const [outputMode, setOutputMode] = useState<PrintOutputMode>(() => {
    return (safeGetItem('medicab_print_output') as PrintOutputMode) || 'printer';
  });
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const lang = settings.language || 'fr';

  const docName = splitBilingual(settings.doctorName, 'name');
  const spec = splitBilingual(settings.speciality, 'speciality');
  const addr = splitBilingual(settings.address, 'address');
  const cabName = splitBilingual(settings.name, 'cabinet');
  const phone = splitBilingual(settings.phone, 'address');
  const email = splitBilingual(settings.email, 'address');

  useEffect(() => {
    safeSetItem('medicab_print_format', paperSize);
  }, [paperSize]);

  useEffect(() => {
    safeSetItem('medicab_print_output', outputMode);
  }, [outputMode]);

  useEffect(() => {
    document.body.classList.remove('print-a4', 'print-a5');
    document.body.classList.add(paperSize === 'A4' ? 'print-a4' : 'print-a5');

    return () => {
      document.body.classList.remove('print-a4', 'print-a5');
    };
  }, [paperSize]);

  const getDocTitle = (): string => {
    if (type === 'prescription') return `Ordonnance_${data.prescription?.patientName || 'Patient'}`;
    if (type === 'certificate') return `Certificat_${data.certificate?.patientName || 'Patient'}`;
    if (type === 'analysis') return `Analyse_${data.analysis?.patientName || 'Patient'}`;
    if (type === 'ultrasound') return `Echographie_${data.ultrasound?.patientName || 'Patient'}`;
    if (type === 'invoice') return `Facture_${data.invoice?.number || 'Doc'}`;
    if (type === 'schedule') return `Planning_RDV_${data.schedule?.date || ''}`;
    if (type === 'patient_record') return `Dossier_${data.patientRecord?.lastName || 'Patient'}`;
    return 'Document_Medical';
  };

  const handleDirectPrint = async () => {
    const title = getDocTitle();
    const originalTitle = document.title;
    
    // Check if running in Electron environment with IPC bridge
    const electronApi = (window as any).electron;
    if (electronApi) {
      try {
        const res = await (electronApi.printDocument
          ? electronApi.printDocument({ pageSize: paperSize })
          : electronApi.ipcRenderer.invoke('print-document', { pageSize: paperSize }));
        if (res && res.success) {
          return;
        }
      } catch (e) {
        console.error('Electron print IPC error, falling back to browser print:', e);
      }
    }

    document.title = title;
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.title = originalTitle;
      }, 1000);
    }, 100);
  };

  const handleDirectPDFDownload = async () => {
    setIsGeneratingPDF(true);
    const title = getDocTitle();
    const element = document.getElementById('printable-area');
    
    if (element) {
      try {
        const opt: any = {
          margin: paperSize === 'A5' ? 4 : 8,
          filename: `${title}_${paperSize}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: 'mm', format: paperSize.toLowerCase(), orientation: 'portrait' },
        };
        
        const html2pdfModule = await import('html2pdf.js');
        const html2pdf = (html2pdfModule as any).default || html2pdfModule;
        await html2pdf().set(opt).from(element).save();
        setIsGeneratingPDF(false);
        return;
      } catch (err) {
        console.error('Failed to generate PDF with html2pdf, falling back to standard print-to-pdf:', err);
      }
    }

    // Fallback: Open print dialog preset to save as PDF
    setIsGeneratingPDF(false);
    const originalTitle = document.title;
    document.title = `${title}.pdf`;
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.title = originalTitle;
      }, 1000);
    }, 100);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex flex-col print:bg-white print:block overflow-hidden">
      
      {/* Dynamic Generating Loader Overlay */}
      {isGeneratingPDF && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[100] flex flex-col items-center justify-center space-y-4">
          <div className="bg-slate-900 border border-slate-700/80 p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm text-center space-y-4 animate-scale-in">
            <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
            <div>
              <h4 className="font-bold text-white text-sm">Génération du PDF en cours</h4>
              <p className="text-xs text-slate-400 mt-1">جاري توليد ملف الـ PDF الطبي وتحميله مباشرة...</p>
              <p className="text-[10px] text-slate-500 mt-1">Veuillez ne pas fermer cette fenêtre</p>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Top Bar for Controls (Hidden in Print) */}
      <div className="print:hidden bg-slate-900 border-b border-slate-800 text-slate-100 p-4 shadow-lg shrink-0">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          
          {/* Title / Close button */}
          <div className="flex items-center space-x-2">
            <Settings2 className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm text-white">{t('print_title', lang)}</h3>
          </div>

          {/* Options Grid */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Paper Size selector */}
            <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 font-semibold px-1">{t('print_paper_size', lang)}:</span>
              <button
                type="button"
                onClick={() => setPaperSize('A4')}
                className={`py-1 px-2.5 rounded-lg font-bold transition flex items-center space-x-1 ${
                  paperSize === 'A4'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {paperSize === 'A4' && <Check className="w-3 h-3" />}
                <span>A4</span>
              </button>
              <button
                type="button"
                onClick={() => setPaperSize('A5')}
                className={`py-1 px-2.5 rounded-lg font-bold transition flex items-center space-x-1 ${
                  paperSize === 'A5'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {paperSize === 'A5' && <Check className="w-3 h-3" />}
                <span>A5</span>
              </button>
            </div>
          </div>

          {/* Action Trigger Buttons */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl shadow-md text-xs flex items-center space-x-1.5 border border-slate-700 transition"
            >
              <X className="w-4 h-4 text-rose-400" />
              <span>Retour / العودة</span>
            </button>
            
            <button
              type="button"
              onClick={handleDirectPrint}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl shadow-lg text-xs flex items-center space-x-1.5 transition"
            >
              <Printer className="w-4 h-4 text-teal-100" />
              <span>{t('print_action_printer', lang)} / طباعة</span>
            </button>

            <button
              type="button"
              onClick={handleDirectPDFDownload}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg text-xs flex items-center space-x-1.5 transition"
            >
              <FileDown className="w-4 h-4 text-indigo-100" />
              <span>Direct PDF / تحميل PDF</span>
            </button>
          </div>

        </div>
      </div>

      {/* Scrollable Document Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center print:overflow-visible print:p-0 print:block">
        <div
          className={`bg-white text-slate-900 rounded-2xl shadow-2xl w-full p-6 print:p-0 print:shadow-none print:max-w-none print:rounded-none relative transition-all my-auto ${
            paperSize === 'A5' ? 'max-w-lg' : 'max-w-2xl'
          }`}
        >
          {/* Printable Area Page Layout */}
          <div
            id="printable-area"
            className={`flex flex-col justify-between border border-slate-200 print:border-none bg-white ${
              paperSize === 'A5'
                ? 'p-4 print:p-1 min-h-[520px] text-xs space-y-3'
                : 'p-6 print:p-2 min-h-[750px] text-xs space-y-5'
            }`}
          >
          {/* Header with Cabinet Info & Logo */}
          <div>
            <div className="border-b-2 border-emerald-600 pb-3 mb-4">
              {/* Bilingual 3-Column Layout Row: Left (French), Center (Logo), Right (Arabic) */}
              <div className="grid grid-cols-5 gap-3 items-center text-xs">
                {/* Left Column: French Info (LTR) - Width 40% (2/5) */}
                <div className="col-span-2 text-left space-y-1" style={{ direction: 'ltr' }}>
                  {cabName.fr && (
                    <h1 className={`${paperSize === 'A5' ? 'text-xs' : 'text-sm'} font-black text-slate-900 uppercase tracking-wide leading-tight`}>
                      {cabName.fr}
                    </h1>
                  )}
                  {docName.fr && (
                    <p className="text-[10px] font-bold text-slate-800 leading-tight">{docName.fr}</p>
                  )}
                  {spec.fr && (
                    <p className="text-[10px] font-semibold text-emerald-700 leading-tight">{spec.fr}</p>
                  )}
                </div>

                {/* Center Column: Logo - Width 20% (1/5) */}
                <div className="col-span-1 flex items-center justify-center">
                  {settings.logoUrl ? (
                    <img
                      src={settings.logoUrl}
                      alt="Logo Cabinet"
                      className={`${paperSize === 'A5' ? 'h-16 max-h-18' : 'h-24 max-h-28'} w-auto object-contain`}
                    />
                  ) : (
                    <Logo variant="icon" size={paperSize === 'A5' ? 48 : 64} themeMode="light" />
                  )}
                </div>

                {/* Right Column: Arabic Info (RTL) - Width 40% (2/5) */}
                <div className="col-span-2 text-right space-y-1" style={{ direction: 'rtl' }}>
                  {cabName.ar && (
                    <h1 className={`${paperSize === 'A5' ? 'text-xs' : 'text-sm'} font-black text-slate-900 tracking-wide leading-tight`}>
                      {cabName.ar}
                    </h1>
                  )}
                  {docName.ar && (
                    <p className="text-[10px] font-bold text-slate-800 leading-tight">{docName.ar}</p>
                  )}
                  {spec.ar && (
                    <p className="text-[10px] font-semibold text-emerald-700 leading-tight">{spec.ar}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Document Specific Content */}
            {type === 'prescription' && data.prescription && (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-500 font-medium">Patient : </span>
                    <strong className="text-slate-900 uppercase">{data.prescription.patientName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Âge : </span>
                    <strong className="text-slate-900">{data.prescription.patientAge} ans</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Date : </span>
                    <strong className="text-slate-900">
                      {new Date(data.prescription.date).toLocaleDateString('fr-FR')}
                    </strong>
                  </div>
                </div>

                <div className="text-center py-1.5 border-b border-slate-200">
                  <h2 className="text-base font-bold uppercase tracking-widest text-slate-800 underline decoration-emerald-500 underline-offset-4">
                    ORDONNANCE MÉDICALE
                  </h2>
                </div>

                <div className="space-y-3 py-2 min-h-[200px]">
                  {data.prescription.items.map((item, idx) => (
                    <div key={idx} className="space-y-0.5 text-xs">
                      <div className="font-bold text-xs text-slate-900 flex items-center space-x-2">
                        <span className="text-emerald-600 font-mono">{idx + 1}.</span>
                        <span>{item.medicineName}</span>
                      </div>
                      <div className="pl-5 text-slate-700 font-medium">
                        • Posologie : {item.dosage} — pendant {item.duration}
                      </div>
                      {item.instructions && (
                        <div className="pl-5 text-slate-500 italic text-[11px]">
                          Conseil : {item.instructions}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {data.prescription.notes && (
                  <div className="p-2.5 bg-amber-50 rounded border border-amber-200 text-xs text-amber-900">
                    <strong>Recommandations : </strong> {data.prescription.notes}
                  </div>
                )}
              </div>
            )}

            {type === 'certificate' && data.certificate && (
              <div className="space-y-4 py-2">
                <div className="text-center py-2 border-b border-slate-200">
                  <h2 className="text-base font-bold uppercase tracking-widest text-slate-900 underline decoration-emerald-500 underline-offset-4">
                    {data.certificate.type === 'sick_leave'
                      ? 'CERTIFICAT D’ARRÊT DE TRAVAIL'
                      : data.certificate.type === 'fitness'
                      ? 'CERTIFICAT D’APTITUDE PHYSIQUE'
                      : data.certificate.type === 'work_resume'
                      ? 'CERTIFICAT DE REPRISE DE TRAVAIL'
                      : 'CERTIFICAT MÉDICAL'}
                  </h2>
                </div>

                <div className="text-xs text-slate-800 leading-relaxed space-y-3 pt-2">
                  <p>
                    Je soussigné, <strong>{settings.doctorName}</strong>, docteur en médecine, certifie avoir examiné ce jour :
                  </p>
                  <p className="text-xs font-bold bg-slate-50 p-2.5 rounded border border-slate-200 uppercase">
                    M. / Mme / Mlle : {data.certificate.patientName}
                  </p>
                  <p>
                    {data.certificate.type === 'sick_leave' ? (
                      <>
                        Et atteste que son état de santé nécessite un arrêt de travail d'une durée de{' '}
                        <strong className="text-emerald-700 font-bold">{data.certificate.durationDays} jour(s)</strong>, du{' '}
                        <strong>{data.certificate.startDate}</strong> au <strong>{data.certificate.endDate}</strong>, sauf complication.
                      </>
                    ) : (
                      <>{data.certificate.reasonOrObservation}</>
                    )}
                  </p>
                  <p className="text-slate-500 italic text-[11px] pt-1">
                    Certificat délivré à la demande de l'intéressé(e) pour faire valoir ce que de droit.
                  </p>
                </div>
              </div>
            )}

            {type === 'analysis' && data.analysis && (
              <div className="space-y-4 py-2">
                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-500 font-medium">Patient : </span>
                    <strong className="text-slate-900 uppercase">{data.analysis.patientName}</strong>
                    {data.analysis.patientAge && (
                      <span className="text-slate-600 ml-2">({data.analysis.patientAge} ans)</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Date de prescription : </span>
                    <strong className="text-slate-900">
                      {new Date(data.analysis.date).toLocaleDateString('fr-FR')}
                    </strong>
                  </div>
                </div>

                <div className="text-center py-1.5 border-b border-slate-200">
                  <h2 className="text-base font-bold uppercase tracking-widest text-slate-900 underline decoration-emerald-500 underline-offset-4">
                    PRESCRIPTION DE BILAN BIOLOGIQUE
                  </h2>
                  <p className="text-[10px] text-slate-500 italic mt-0.5">Demande d'Analyses Médicales & Biologiques</p>
                </div>

                {data.analysis.indication && (
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                    <strong className="text-slate-800">Indication / Motif médical : </strong>
                    <span className="text-slate-700 italic">{data.analysis.indication}</span>
                  </div>
                )}

                <div className="space-y-2 pt-1 min-h-[220px]">
                  <div className="font-bold text-xs text-slate-800 border-b border-slate-200 pb-1 flex items-center justify-between">
                    <span>Analyses & Bilans demandés :</span>
                    {data.analysis.groupPresetName && (
                      <span className="text-[11px] font-normal text-slate-500 italic">[{data.analysis.groupPresetName}]</span>
                    )}
                  </div>

                  {data.analysis.testsRequested && data.analysis.testsRequested.length > 0 ? (
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 pt-1">
                      {data.analysis.testsRequested.map((test, i) => (
                        <div key={i} className="flex items-start space-x-2 text-xs">
                          <span className="text-emerald-600 font-bold shrink-0">•</span>
                          <span className="font-semibold text-slate-900">{test}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-400 italic text-xs py-2">Aucun bilan sélectionné dans la liste.</div>
                  )}

                  {data.analysis.customTests && (
                    <div className="mt-4 pt-3 border-t border-slate-200 space-y-1">
                      <div className="font-bold text-xs text-slate-800">Autres Examens / Analyses Spéciales :</div>
                      <div className="text-xs text-slate-800 whitespace-pre-line pl-3 italic border-l-2 border-emerald-500 py-1">
                        {data.analysis.customTests}
                      </div>
                    </div>
                  )}
                </div>

                {data.analysis.notes && (
                  <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900">
                    <strong>Recommandations pour le laboratoire : </strong> {data.analysis.notes}
                  </div>
                )}
              </div>
            )}

            {type === 'ultrasound' && data.ultrasound && (
              <div className="space-y-3.5 py-1 text-slate-800">
                {/* Patient summary bar */}
                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-500 font-medium">Patient(e) : </span>
                    <strong className="text-slate-900 uppercase">{data.ultrasound.patientName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Âge : </span>
                    <strong className="text-slate-900">{data.ultrasound.patientAge} ans</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Date d'examen : </span>
                    <strong className="text-slate-900">
                      {new Date(data.ultrasound.date).toLocaleDateString('fr-FR')}
                    </strong>
                  </div>
                </div>

                {/* Exam Title */}
                <div className="text-center py-1.5 border-b-2 border-emerald-600">
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
                    COMPTE RENDU D'ÉCHOGRAPHIE
                  </h2>
                  <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide mt-0.5">
                    {data.ultrasound.examTypeName || 'Échographie Médicale'}
                  </p>
                </div>

                {/* Indication & Equipment */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded border border-slate-200">
                  {data.ultrasound.indication && (
                    <div>
                      <span className="font-bold text-slate-700">Indication / Motif : </span>
                      <span className="text-slate-800 italic">{data.ultrasound.indication}</span>
                    </div>
                  )}
                  {data.ultrasound.equipment && (
                    <div>
                      <span className="font-bold text-slate-700">Technique / Sonde : </span>
                      <span className="text-slate-800">{data.ultrasound.equipment}</span>
                    </div>
                  )}
                </div>

                {/* Findings / Résultats */}
                <div className="space-y-1.5 pt-1">
                  <div className="font-bold text-xs text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-0.5">
                    Résultats Détaillés :
                  </div>
                  <div className="text-xs text-slate-800 whitespace-pre-line leading-relaxed pl-1 font-serif">
                    {data.ultrasound.findings}
                  </div>
                </div>

                {/* Images if any */}
                {data.ultrasound.images && data.ultrasound.images.length > 0 && (
                  <div className="pt-2 border-t border-slate-200">
                    <div className="font-bold text-[11px] text-slate-700 mb-1.5 uppercase">Clichés échographiques joints :</div>
                    <div className="grid grid-cols-3 gap-2">
                      {data.ultrasound.images.slice(0, 3).map((img, i) => (
                        <div key={i} className="border border-slate-300 rounded overflow-hidden h-24 bg-slate-950 flex items-center justify-center">
                          <img src={img} alt={`Cliché ${i + 1}`} className="max-h-full max-w-full object-contain" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conclusion */}
                <div className="p-3 bg-emerald-50/70 rounded-lg border-2 border-emerald-600/60 text-xs space-y-1 mt-2">
                  <div className="font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                    <span>CONCLUSION :</span>
                  </div>
                  <div className="text-slate-900 font-semibold whitespace-pre-line leading-relaxed">
                    {data.ultrasound.conclusion}
                  </div>
                </div>

                {/* Recommendations */}
                {data.ultrasound.recommendations && (
                  <div className="p-2.5 bg-amber-50/80 rounded-lg border border-amber-300 text-xs text-amber-950">
                    <strong>Conduite à tenir / Recommandations : </strong>
                    <span className="font-medium">{data.ultrasound.recommendations}</span>
                  </div>
                )}
              </div>
            )}

            {type === 'invoice' && data.invoice && (
              <div className="space-y-4 py-2">
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                  <div>
                    <div className="font-bold text-xs text-slate-900">Facture N° {data.invoice.number}</div>
                    <div className="text-slate-500 text-[11px]">Date : {new Date(data.invoice.date).toLocaleDateString('fr-FR')}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-[11px] text-slate-900">Client / Patient :</div>
                    <div className="text-xs font-bold text-emerald-700 uppercase">{data.invoice.patientName}</div>
                  </div>
                </div>

                <table className="w-full text-xs text-left border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-100 font-bold text-slate-700 uppercase text-[10px]">
                    <tr>
                      <th className="p-2">Prestation / Description</th>
                      <th className="p-2 text-right">Montant ({settings.currency})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.invoice.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-2 font-medium text-slate-900">{item.description}</td>
                        <td className="p-2 text-right font-bold text-slate-900">{item.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex justify-end pt-1">
                  <div className="w-56 space-y-1 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <div className="flex justify-between text-slate-600 text-[11px]">
                      <span>Sous-total :</span>
                      <span>{data.invoice.subtotal.toFixed(2)} {settings.currency}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 text-[11px]">
                      <span>TVA ({settings.taxRate}%) :</span>
                      <span>{data.invoice.taxAmount.toFixed(2)} {settings.currency}</span>
                    </div>
                    <div className="flex justify-between font-bold text-xs text-slate-900 border-t pt-1 border-slate-300">
                      <span>Total à payer :</span>
                      <span className="text-emerald-700">{data.invoice.total.toFixed(2)} {settings.currency}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {type === 'schedule' && data.schedule && (
              <div className="space-y-4 py-2">
                <div className="text-center py-2 border-b border-slate-200">
                  <h2 className="text-base font-bold uppercase tracking-widest text-slate-900 underline decoration-emerald-500 underline-offset-4">
                    PLANNING DU CABINET — {data.schedule.date}
                  </h2>
                </div>

                <table className="w-full text-xs text-left border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-100 font-bold text-slate-700 uppercase text-[10px]">
                    <tr>
                      <th className="p-2">Heure</th>
                      <th className="p-2">Patient</th>
                      <th className="p-2">Téléphone</th>
                      <th className="p-2">Motif</th>
                      <th className="p-2">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.schedule.appointments.map((apt) => (
                      <tr key={apt.id}>
                        <td className="p-2 font-mono font-bold text-emerald-700">{apt.time}</td>
                        <td className="p-2 font-bold uppercase">{apt.patientName}</td>
                        <td className="p-2 text-slate-600 font-mono">{apt.phone}</td>
                        <td className="p-2">{apt.reason}</td>
                        <td className="p-2">
                          <span
                            style={{
                              backgroundColor: getStatusConfig(apt.status).hex,
                              color: getStatusConfig(apt.status).textColor,
                            }}
                            className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                          >
                            {getStatusConfig(apt.status).label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {type === 'patient_record' && data.patientRecord && (
              <div className="space-y-3 py-2">
                <div className="text-center py-1.5 border-b border-slate-200">
                  <h2 className="text-base font-bold uppercase tracking-widest text-slate-900 underline decoration-emerald-500 underline-offset-4">
                    DOSSIER MÉDICAL — {data.patientRecord.lastName.toUpperCase()} {data.patientRecord.firstName}
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded border border-slate-200 text-xs">
                  <div><strong>CIN :</strong> {data.patientRecord.cin || 'N/A'}</div>
                  <div><strong>Âge / Sexe :</strong> {data.patientRecord.age} ans ({data.patientRecord.gender})</div>
                  <div><strong>Téléphone :</strong> {data.patientRecord.phone}</div>
                  <div><strong>Groupe Sanguin :</strong> {data.patientRecord.bloodGroup}</div>
                  <div>
                    <strong>Mutuelle / Assurance :</strong>{' '}
                    {data.patientRecord.insuranceType === 'Assurance privée'
                      ? `Assurance privée (${data.patientRecord.privateInsuranceName || ''})`
                      : data.patientRecord.insuranceType || 'Aucune'}
                  </div>
                  <div><strong>N° Assurance :</strong> {data.patientRecord.insuranceNumber || 'N/A'}</div>
                  <div><strong>Profession :</strong> {data.patientRecord.profession}</div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div><strong>Pathologies / Maladie :</strong> {data.patientRecord.medicalRecord.diseases.join(', ') || 'Aucune'}</div>
                  <div><strong>Allergies connues :</strong> {data.patientRecord.medicalRecord.allergies.join(', ') || 'Aucune'}</div>
                  <div><strong>Traitements en cours :</strong> {data.patientRecord.medicalRecord.treatments.join(', ') || 'Aucun'}</div>
                  <div><strong>Antécédents :</strong> {data.patientRecord.medicalRecord.antecedents || 'Rien à signaler'}</div>
                </div>
              </div>
            )}
          </div>

          {/* Footer with Cachet & Signature Stamp */}
          <div>
            <div className="pt-4 border-t border-slate-200 flex justify-between items-end mt-6 text-xs">
              <div className="text-[10px] text-slate-400">
                <p>Fait le {new Date().toLocaleDateString('fr-FR')}</p>
              </div>

              <div className="text-center w-40 space-y-1">
                <span className="font-bold text-slate-800 text-[10px] block">
                  Signature & Cachet
                </span>

                <div className="h-16 border border-dashed border-slate-300 rounded-lg flex items-center justify-center p-1 bg-slate-50">
                  {settings.signatureUrl ? (
                    <div className="flex items-center justify-center">
                      <img src={settings.signatureUrl} alt="Signature" className="h-12 w-auto object-contain" />
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 italic">
                      [ Signature / Cachet ]
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Solid separator line and French contact details */}
            <div className="border-t-2 border-slate-300 mt-4 pt-2 text-center text-[10px] text-slate-600">
              <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-1">
                {addr.fr && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-emerald-700 shrink-0" /> {addr.fr}
                  </span>
                )}
                {phone.fr && (
                  <span className="flex items-center gap-1 font-mono">
                    <Phone className="h-3.5 w-3.5 text-emerald-700 shrink-0" /> Tél: {phone.fr}
                  </span>
                )}
                {email.fr && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5 text-emerald-700 shrink-0" /> Email: {email.fr}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);
};
