
import React, { useState, useEffect, useRef } from 'react';
import { Slide, MediaType } from '../types';
import { DEFAULT_BACKGROUNDS, VIDEO_BACKGROUNDS, SOLID_COLORS } from '../constants';
import { saveMedia, getMedia } from '../services/localMedia';

interface SlideEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  slide: Slide | null; 
  onSave: (slide: Slide) => void;
  onImportPowerPointVisual?: (file: File) => Promise<Slide[]>;
  onImportPowerPointText?: (file: File) => Promise<Slide[]>;
  onInsertSlides?: (slides: Slide[], replaceCurrentId?: string | null) => void;
}

const getYoutubeId = (url: string) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

export const SlideEditorModal: React.FC<SlideEditorModalProps> = ({
  isOpen,
  onClose,
  slide,
  onSave,
  onImportPowerPointVisual,
  onImportPowerPointText,
  onInsertSlides,
}) => {
  const [content, setContent] = useState('');
  const [label, setLabel] = useState('');
  const [bgUrl, setBgUrl] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>('image');
  const [activeTab, setActiveTab] = useState<'image'|'video'|'color'>('image');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [pptxError, setPptxError] = useState<string | null>(null);
  const [pptxStatus, setPptxStatus] = useState('');
  const [isImportingPptx, setIsImportingPptx] = useState(false);
  
  // For previewing local IndexedDB blobs
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pptxVisualInputRef = useRef<HTMLInputElement>(null);
  const pptxTextInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setUploadError(null);
      setPptxError(null);
      setPptxStatus('');
      if (slide) {
        setContent(slide.content);
        setLabel(slide.label || '');
        setBgUrl(slide.backgroundUrl || '');
        setMediaType(slide.mediaType || 'image');
        if (slide.mediaType) setActiveTab(slide.mediaType);
      } else {
        setContent('');
        setLabel('New Slide');
        setBgUrl('');
        setMediaType('image');
        setActiveTab('image');
      }
    }
  }, [isOpen, slide]);

  // Handle Local URL Preview Resolution
  useEffect(() => {
    let active = true;
    const resolvePreview = async () => {
        if (bgUrl && bgUrl.startsWith('local://')) {
            try {
                // getMedia now returns the blob URL string directly from cache/db
                const url = await getMedia(bgUrl);
                if (url && active) {
                    setPreviewUrl(url);
                    // Do NOT revoke here, as it's cached globally
                }
            } catch (e) {
                console.error("Failed to load preview", e);
            }
        } else {
            setPreviewUrl(bgUrl);
        }
    };
    resolvePreview();
    return () => { active = false; };
  }, [bgUrl]);

  useEffect(() => {
    if (bgUrl && getYoutubeId(bgUrl) && mediaType !== 'video') {
        setMediaType('video');
        setActiveTab('video');
    }
  }, [bgUrl]);

  if (!isOpen) return null;

  const handleSave = () => {
    let finalMediaType = mediaType;
    if (bgUrl && getYoutubeId(bgUrl)) {
        finalMediaType = 'video';
    } else if (bgUrl && bgUrl.startsWith('#')) {
        finalMediaType = 'color';
    }

    const newSlide: Slide = {
      id: slide ? slide.id : Date.now().toString(),
      content,
      label,
      backgroundUrl: bgUrl || undefined,
      mediaType: bgUrl ? finalMediaType : undefined
    };
    onSave(newSlide);
    onClose();
  };

  const handleMediaSelect = (url: string, type: MediaType) => {
    setBgUrl(url);
    setMediaType(type);
    setUploadError(null);
    setPptxError(null);
  };

  const clearBackground = () => {
    setBgUrl('');
    setMediaType('image');
    setUploadError(null);
    setPptxError(null);
    setPptxStatus('');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = event.target.files?.[0];
    
    if (file) {
      setIsUploading(true);
      try {
        // Save to IndexedDB (No size limit here practically)
        const localId = await saveMedia(file);
        setBgUrl(localId);

        if (file.type.startsWith('video/')) {
            setMediaType('video');
            setActiveTab('video');
        } else {
            setMediaType('image');
            setActiveTab('image');
        }
      } catch (err) {
        console.error(err);
        setUploadError("Failed to save file to local database.");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const applyImportedSlide = (importedSlide: Slide) => {
    setLabel(importedSlide.label || 'Slide 1');
    setContent(importedSlide.content || '');
    setBgUrl(importedSlide.backgroundUrl || '');
    const nextType: MediaType = importedSlide.mediaType || 'image';
    setMediaType(nextType);
    setActiveTab(nextType === 'video' ? 'video' : nextType === 'color' ? 'color' : 'image');
  };

  const handlePowerPointImport = async (
    event: React.ChangeEvent<HTMLInputElement>,
    mode: 'visual' | 'text'
  ) => {
    setPptxError(null);
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const lower = file.name.toLowerCase();
    const isPdf = lower.endsWith('.pdf');
    if (!lower.endsWith('.pptx') && !lower.endsWith('.ppt') && !isPdf) {
      setPptxError('Please select a PowerPoint/PDF file (.pptx or .pdf).');
      return;
    }
    if (mode === 'text' && isPdf) {
      setPptxError('Text import supports PowerPoint files only (.pptx). Use Visual import for PDF.');
      return;
    }
    const importer = mode === 'visual' ? onImportPowerPointVisual : onImportPowerPointText;
    if (!importer) {
      setPptxError(mode === 'visual'
        ? 'Visual PowerPoint import is not available in this view.'
        : 'Text PowerPoint import is not available in this view.');
      return;
    }

    setIsImportingPptx(true);
    setPptxStatus(mode === 'visual'
      ? 'Importing PowerPoint with original layout/background...'
      : 'Importing PowerPoint text for Lumina theming...');
    try {
      const importedSlides = await importer(file);
      if (!Array.isArray(importedSlides) || importedSlides.length === 0) {
        throw new Error('No slides were imported from this file.');
      }

      if (importedSlides.length > 1 && onInsertSlides) {
        onInsertSlides(importedSlides, slide?.id || null);
        setPptxStatus('');
        onClose();
        return;
      }

      applyImportedSlide(importedSlides[0]);
      if (importedSlides.length > 1) {
        setPptxStatus(`${mode === 'visual' ? 'Visual' : 'Text'} import: first slide loaded in editor. File has ${importedSlides.length} slides.`);
      } else {
        setPptxStatus(mode === 'visual' ? 'Visual PowerPoint slide imported.' : 'Text PowerPoint slide imported.');
      }
    } catch (error: any) {
      setPptxError(error?.message || 'PowerPoint import failed.');
      setPptxStatus('');
    } finally {
      setIsImportingPptx(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="bg-zinc-950 border border-zinc-800 rounded-sm shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900">
          <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-widest">{slide ? 'Edit Slide' : 'Add New Slide'}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white px-2">ESC</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Label Input */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Label (Index)</label>
            <input 
              type="text" 
              className="w-full bg-zinc-900 border border-zinc-700 rounded-sm px-3 py-2 text-white focus:border-blue-600 focus:outline-none placeholder-zinc-700 text-sm font-mono"
              placeholder="VERSE 1"
              value={label}
              onChange={e => setLabel(e.target.value)}
              maxLength={20}
            />
          </div>

          {/* Content Input */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Slide Content</label>
            <textarea
              className="w-full h-40 bg-zinc-900 border border-zinc-700 rounded-sm px-3 py-2 text-white focus:border-blue-600 focus:outline-none resize-none font-sans text-base leading-relaxed"
              placeholder="..."
              value={content}
              onChange={e => setContent(e.target.value)}
              maxLength={1000} // Prevent crash via paste bomb
            />
            <div className="text-[9px] text-zinc-600 text-right mt-1">{content.length}/1000</div>
          </div>

          {/* Background Selection */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Background Asset</label>
            
            <div className="flex flex-wrap gap-px mb-4 bg-zinc-800 border border-zinc-800 rounded-sm overflow-hidden p-px">
                <button 
                  onClick={() => setActiveTab('image')}
                  className={`px-4 py-1.5 text-xs font-medium transition-colors flex-1 ${activeTab === 'image' ? 'bg-zinc-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}
                >
                  Images
                </button>
                <button 
                  onClick={() => setActiveTab('video')}
                  className={`px-4 py-1.5 text-xs font-medium transition-colors flex-1 ${activeTab === 'video' ? 'bg-zinc-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}
                >
                  Videos
                </button>
                <button 
                  onClick={() => setActiveTab('color')}
                  className={`px-4 py-1.5 text-xs font-medium transition-colors flex-1 ${activeTab === 'color' ? 'bg-zinc-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}
                >
                  Color
                </button>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 mb-3">
              {activeTab === 'image' && DEFAULT_BACKGROUNDS.map((url, i) => (
                <button 
                  key={i}
                  onClick={() => handleMediaSelect(url, 'image')}
                  className={`aspect-video rounded-sm border-2 overflow-hidden bg-cover bg-center ${bgUrl === url ? 'border-blue-500 opacity-100' : 'border-transparent opacity-50 hover:opacity-100'}`}
                  style={{ backgroundImage: `url(${url})` }}
                />
              ))}

              {activeTab === 'video' && VIDEO_BACKGROUNDS.map((url, i) => (
                 <button 
                   key={i}
                   onClick={() => handleMediaSelect(url, 'video')}
                   className={`aspect-video rounded-sm border-2 overflow-hidden bg-black flex items-center justify-center ${bgUrl === url ? 'border-blue-500 opacity-100' : 'border-transparent opacity-50 hover:opacity-100'}`}
                 >
                    <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-500 text-[9px]">VIDEO {i+1}</div>
                 </button>
              ))}

              {activeTab === 'color' && SOLID_COLORS.map((color, i) => (
                 <button 
                   key={i}
                   onClick={() => handleMediaSelect(color, 'color')}
                   className={`aspect-video rounded-sm border-2 overflow-hidden ${bgUrl === color ? 'border-blue-500' : 'border-transparent opacity-80 hover:opacity-100'}`}
                   style={{ backgroundColor: color }}
                 />
              ))}
            </div>
            
            <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                    <div className="flex-1 relative">
                        <input 
                            type="text"
                            placeholder={activeTab === 'image' ? "URL..." : activeTab === 'video' ? "YouTube / Video URL..." : "Hex Color..."}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-sm px-3 py-2 text-xs text-zinc-300 focus:border-blue-600 focus:outline-none font-mono"
                            value={bgUrl}
                            onChange={e => handleMediaSelect(e.target.value, activeTab)}
                        />
                        {/* Preview Indicator */}
                        {bgUrl.startsWith('local://') && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] bg-zinc-800 text-zinc-400 px-1 rounded border border-zinc-700">LOCAL</div>
                        )}
                    </div>

                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-2 text-xs font-bold rounded-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 whitespace-nowrap"
                      disabled={isUploading || isImportingPptx}
                    >
                      {isUploading ? 'SAVING...' : 'UPLOAD'}
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      className="hidden" 
                      accept="image/*,video/*"
                    />
                    <button 
                      onClick={() => pptxVisualInputRef.current?.click()}
                      className="px-3 py-2 text-xs font-bold rounded-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 whitespace-nowrap"
                      disabled={isUploading || isImportingPptx}
                    >
                      {isImportingPptx ? 'VIS...' : 'PPTX VIS'}
                    </button>
                    <input 
                      type="file" 
                      ref={pptxVisualInputRef}
                      onChange={(event) => handlePowerPointImport(event, 'visual')}
                      className="hidden" 
                      accept=".pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint"
                    />
                    <button 
                      onClick={() => pptxTextInputRef.current?.click()}
                      className="px-3 py-2 text-xs font-bold rounded-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 whitespace-nowrap"
                      disabled={isUploading || isImportingPptx}
                    >
                      {isImportingPptx ? 'TXT...' : 'PPTX TXT'}
                    </button>
                    <input 
                      type="file" 
                      ref={pptxTextInputRef}
                      onChange={(event) => handlePowerPointImport(event, 'text')}
                      className="hidden" 
                      accept=".pptx,.ppt,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint"
                    />
                    <button 
                      onClick={clearBackground}
                      className="px-3 py-2 text-xs font-bold rounded-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-zinc-700"
                      disabled={isImportingPptx}
                    >
                      CLR
                    </button>
                </div>
                {uploadError && (
                    <div className="text-[10px] text-red-400 bg-red-900/10 border border-red-900/30 p-2 rounded-sm font-mono">
                        Error: {uploadError}
                    </div>
                )}
                {pptxError && (
                    <div className="text-[10px] text-red-400 bg-red-900/10 border border-red-900/30 p-2 rounded-sm font-mono">
                        PPTX: {pptxError}
                    </div>
                )}
                {pptxStatus && (
                    <div className="text-[10px] text-cyan-300 bg-cyan-900/10 border border-cyan-900/30 p-2 rounded-sm font-mono">
                        {pptxStatus}
                    </div>
                )}
                
                {/* Visual Preview Box */}
                {previewUrl && (activeTab === 'image' || activeTab === 'video') && (
                    <div className="mt-2 aspect-video w-32 rounded-sm border border-zinc-700 bg-black overflow-hidden relative">
                         {activeTab === 'video' || (previewUrl.startsWith('blob:') && mediaType === 'video') ? (
                             <video src={previewUrl} className="w-full h-full object-cover" muted />
                         ) : (
                             <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: `url(${previewUrl})` }} />
                         )}
                         <div className="absolute bottom-0 left-0 bg-black/70 text-white text-[8px] px-1">PREVIEW</div>
                    </div>
                )}

                <div className="text-[9px] text-zinc-600 italic">
                    Note: `PPTX VIS` retains original layout/background. `PPTX TXT` imports text for Lumina styling.
                </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center p-4 border-t border-zinc-800 bg-zinc-900">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-white transition-colors"
          >
            CANCEL
          </button>
          <button 
            onClick={handleSave}
            disabled={isUploading || isImportingPptx}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-sm text-xs font-bold tracking-wide transition-all shadow-sm disabled:opacity-50"
          >
            CONFIRM
          </button>
        </div>
      </div>
    </div>
  );
};
