import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { toPng } from 'html-to-image';
import { ImageCropper } from './ImageCropper';
import { Download, Upload, RefreshCw, Sparkles, HelpCircle, X, ArrowLeft, Mail } from 'lucide-react';
import { EmailClientPicker, EMAIL_CLIENTS } from './EmailClientPicker';
import { FacilitySelector } from './FacilitySelector';
import { fetchLogoAsDataUrl } from './facilityLogos';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import bgImage from '../../imports/image.png';
import svgPaths from '../../imports/InstructionVersion/svg-sbmagc0o7i';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export function Generator({ onBack }: { onBack?: () => void }) {
  const [image, setImage] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showEmailPicker, setShowEmailPicker] = useState(false);

  const [name, setName] = useState('');
  const [fact1, setFact1] = useState('');
  const [fact2, setFact2] = useState('');
  const [fact3, setFact3] = useState('');
  const [facility, setFacility] = useState('');

  const previewRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const [bgDataUrl, setBgDataUrl] = useState<string | null>(null);
  const [facilityLogoDataUrl, setFacilityLogoDataUrl] = useState<string | null>(null);
  const [facilityLogoLoading, setFacilityLogoLoading] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const parentWidth = containerRef.current.offsetWidth;
        const newScale = Math.min(parentWidth / 1440, 1);
        setScale(newScale);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const loadBg = async () => {
      try {
        const response = await fetch(bgImage);
        const blob = await response.blob();
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        setBgDataUrl(dataUrl);
      } catch (e) {
        console.error('Background load failed', e);
        setBgDataUrl(null);
      }
    };
    loadBg();
  }, []);

  useEffect(() => {
    if (!facility) {
      setFacilityLogoDataUrl(null);
      return;
    }
    setFacilityLogoLoading(true);
    fetchLogoAsDataUrl(facility).then((url) => {
      setFacilityLogoDataUrl(url);
      setFacilityLogoLoading(false);
    });
  }, [facility]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const reader = new FileReader();
      reader.onload = () => {
        setOriginalImage(reader.result as string);
        setIsCropping(true);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg'] },
    maxFiles: 1,
  });

  const handleCropComplete = (croppedImg: string) => {
    setImage(croppedImg);
    setIsCropping(false);
  };

  const handleDownload = async () => {
    if (!previewRef.current) return;
    setIsGenerating(true);
    try {
      const options = {
        width: 1440,
        height: 1440,
        pixelRatio: 1,
        canvasWidth: 1440,
        canvasHeight: 1440,
        skipFonts: true,
      };

      await toPng(previewRef.current, options);
      await new Promise((resolve) => setTimeout(resolve, 150));
      const dataUrl = await toPng(previewRef.current, options);

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobile && navigator.share) {
        try {
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const fileName = `Stories_of_Service_${Date.now()}.png`;
          const file = new File([blob], fileName, { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'Stories of Service',
              text: 'My Signature HealthCARE Stories of Service graphic',
            });
            return;
          }
        } catch (shareError) {
          console.log('Share failed', shareError);
        }
      }

      const link = document.createElement('a');
      link.download = `Stories_of_Service.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to generate image', err);
    } finally {
      setIsGenerating(false);
    }
  };

  function nameFontSize(text: string): number {
    const len = text.length;
    if (len <= 15) return 51.627;
    if (len <= 22) return 44;
    if (len <= 30) return 36;
    if (len <= 38) return 29;
    return 23;
  }

  const facts = [fact1, fact2, fact3];

  const STAR_HEIGHT = 60.627;
  const FACT_LINE_HEIGHT = 1.1;
  const FACT_TOPS = [544, 704.63, 875.23];

  const factRows = facts.map((val, i) => {
    const text = val || `Fact #${i + 1}`;
    const fontSize = Math.max(22, Math.min(45, 920 / (text.length * 0.58)));
    const textOffset = Math.max(0, STAR_HEIGHT / 2 - (fontSize * FACT_LINE_HEIGHT) / 2);
    return { text, fontSize, textOffset, top: FACT_TOPS[i], hasVal: Boolean(val) };
  });

  return (
    <div className="min-h-screen bg-[#F5F7FA] font-['Montserrat'] overflow-x-hidden">
      {isCropping && originalImage && (
        <ImageCropper
          imageSrc={originalImage}
          onCancel={() => setIsCropping(false)}
          onCropComplete={handleCropComplete}
        />
      )}

      {/* Header */}
      <header className="bg-[#06263F] border-b border-[#06263F]">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center gap-4">
          {onBack && (
            <>
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 text-[#DCEBF7] hover:text-white transition-colors font-['Montserrat'] font-semibold text-[11px] uppercase tracking-[0.18em]"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                All Templates
              </button>
              <div className="w-px h-4 bg-[#DCEBF7]/20" />
            </>
          )}
          <div>
            <p
              className="text-[#DCEBF7] text-[11px] font-['Montserrat'] font-semibold uppercase tracking-[0.2em] leading-none mb-1"
            >
              Signature HealthCARE
            </p>
          </div>
          <div className="ml-auto">
            <span className="text-[#F6AB60] font-['Montserrat'] font-semibold text-[11px] uppercase tracking-widest">
              Graphic Generator
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10 lg:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Left column – controls */}
          <div className="lg:col-span-5 space-y-5 order-1">

            {/* Instructions button */}
            <button
              onClick={() => setShowInstructions(true)}
              className="w-full flex items-center justify-center gap-2 bg-[#06263F] hover:bg-[#0a3a5e] text-white font-['Montserrat'] font-bold uppercase text-xs tracking-[0.18em] py-3.5 rounded-xl transition-all"
            >
              <HelpCircle className="w-4 h-4 text-[#F6AB60]" />
              How to Get Your Graphic
            </button>

            {/* Step 01 – Photo */}
            <div className="bg-white rounded-2xl border border-[#E3E8EE] p-6 shadow-sm space-y-4">
              <div>
                <p className="font-['Montserrat'] font-semibold text-[#0067B1] uppercase tracking-[0.18em] text-[10px]">Step 01</p>
                <h2 className="font-['Montserrat'] font-extrabold text-[#06263F] uppercase text-base mt-0.5">Upload Image</h2>
              </div>
              <div
                {...getRootProps()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 group',
                  isDragActive
                    ? 'border-[#0067B1] bg-[#DCEBF7]/40'
                    : 'border-[#E3E8EE] hover:border-[#0067B1]/40 hover:bg-[#DCEBF7]/20'
                )}
              >
                <input {...getInputProps()} />
                {image ? (
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-[#E3E8EE] shadow">
                    <img src={image} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-[#06263F]/75 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                      <RefreshCw className="w-5 h-5 text-white" />
                    </div>
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[#DCEBF7] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Upload className="w-5 h-5 text-[#0067B1]" />
                  </div>
                )}
                <p className="font-['Montserrat'] font-bold text-[10px] uppercase tracking-widest text-[#5B6B7A]">
                  {image ? 'Replace Photo' : 'Click or Drag to Upload'}
                </p>
              </div>
            </div>

            {/* Step 02 – Name */}
            <div className="bg-white rounded-2xl border border-[#E3E8EE] p-6 shadow-sm space-y-4">
              <div>
                <p className="font-['Montserrat'] font-semibold text-[#0067B1] uppercase tracking-[0.18em] text-[10px]">Step 02</p>
                <h2 className="font-['Montserrat'] font-extrabold text-[#06263F] uppercase text-base mt-0.5">Enter Name</h2>
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jane Smith, RN"
                maxLength={40}
                className="w-full rounded-xl border border-[#E3E8EE] bg-[#F5F7FA] px-4 py-3 text-sm text-[#17202A] font-['Montserrat'] placeholder:text-[#9AA7B4] focus:outline-none focus:ring-2 focus:ring-[#0067B1]/40 focus:border-[#0067B1] transition"
              />
            </div>

            {/* Step 03 – Facts */}
            <div className="bg-white rounded-2xl border border-[#E3E8EE] p-6 shadow-sm space-y-4">
              <div>
                <p className="font-['Montserrat'] font-semibold text-[#0067B1] uppercase tracking-[0.18em] text-[10px]">Step 03</p>
                <h2 className="font-['Montserrat'] font-extrabold text-[#06263F] uppercase text-base mt-0.5">Enter 3 Facts</h2>
                <p className="text-[#5B6B7A] text-xs mt-1 font-['Montserrat']">These will appear on the left side of the graphic.</p>
              </div>
              <div className="space-y-3">
                {[
                  { val: fact1, set: setFact1, label: 'Fact 1' },
                  { val: fact2, set: setFact2, label: 'Fact 2' },
                  { val: fact3, set: setFact3, label: 'Fact 3' },
                ].map(({ val, set, label }) => (
                  <div key={label} className="flex items-start gap-3">
                    <span className="mt-3 text-[#C8102E] text-lg leading-none flex-shrink-0">★</span>
                    <input
                      type="text"
                      value={val}
                      onChange={(e) => set(e.target.value)}
                      placeholder={`Enter ${label.toLowerCase()}…`}
                      maxLength={60}
                      className="flex-1 rounded-xl border border-[#E3E8EE] bg-[#F5F7FA] px-4 py-3 text-sm text-[#17202A] font-['Montserrat'] placeholder:text-[#9AA7B4] focus:outline-none focus:ring-2 focus:ring-[#0067B1]/40 focus:border-[#0067B1] transition"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Step 04 – Facility */}
            <div className="bg-white rounded-2xl border border-[#E3E8EE] p-6 shadow-sm space-y-4">
              <div>
                <p className="font-['Montserrat'] font-semibold text-[#0067B1] uppercase tracking-[0.18em] text-[10px]">Step 04</p>
                <h2 className="font-['Montserrat'] font-extrabold text-[#06263F] uppercase text-base mt-0.5">Select Facility</h2>
                <p className="text-[#5B6B7A] text-xs mt-1 font-['Montserrat']">Choose the facility this graphic is being made for.</p>
              </div>
              <FacilitySelector value={facility} onChange={setFacility} />
            </div>

            {/* Step 05 – Export */}
            <div className="bg-white rounded-2xl border border-[#E3E8EE] p-6 shadow-sm space-y-3">
              <div>
                <p className="font-['Montserrat'] font-semibold text-[#0067B1] uppercase tracking-[0.18em] text-[10px]">Step 05</p>
                <h2 className="font-['Montserrat'] font-extrabold text-[#06263F] uppercase text-base mt-0.5">Save & Share</h2>
              </div>
              <button
                onClick={handleDownload}
                disabled={isGenerating}
                className="w-full bg-[#0067B1] hover:bg-[#005494] text-white font-['Montserrat'] font-bold uppercase text-xs tracking-[0.18em] py-4 rounded-xl transition-all flex items-center justify-center gap-2.5 shadow-md disabled:opacity-60"
              >
                {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {isGenerating ? 'Generating…' : 'Download Graphic'}
              </button>
              <button
                onClick={() => setShowEmailPicker(true)}
                disabled={isGenerating}
                className="w-full border-2 border-[#0067B1] text-[#0067B1] hover:bg-[#DCEBF7] font-['Montserrat'] font-bold uppercase text-xs tracking-[0.18em] py-3.5 rounded-xl transition-all flex items-center justify-center gap-2.5 disabled:opacity-60"
              >
                <Mail className="w-4 h-4" />
                Share Graphic
              </button>
            </div>

          </div>

          {/* Right column – preview */}
          <div className="lg:col-span-7 lg:sticky lg:top-10 order-2">
            <div className="bg-white rounded-3xl border border-[#E3E8EE] shadow-lg p-6 flex flex-col items-center">
              <div className="w-full flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-['Montserrat'] font-extrabold text-[#06263F] uppercase text-sm tracking-tight">Preview</h3>
                  <p className="text-[9px] font-['Montserrat'] font-semibold text-[#9AA7B4] uppercase tracking-widest mt-0.5">Social Ready</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-[#F6AB60]" />
                  <span className="text-[9px] font-['Montserrat'] font-bold uppercase tracking-widest text-[#5B6B7A]">Live Preview</span>
                </div>
              </div>

              {/* Canvas wrapper */}
              <div
                ref={containerRef}
                className="w-full aspect-square rounded-2xl overflow-hidden relative bg-[#06263F] border-4 border-white shadow-inner"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <div
                  style={{
                    width: 1440,
                    height: 1440,
                    transform: `scale(${scale})`,
                    transformOrigin: 'center center',
                    position: 'absolute',
                  }}
                >
                  <div
                    ref={previewRef}
                    style={{ width: 1440, height: 1440, position: 'relative', overflow: 'hidden' }}
                  >
                    {/* Static background image */}
                    {bgDataUrl && (
                      <img
                        src={bgDataUrl}
                        alt="Background"
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    )}

                    {/* Headshot – exact Figma coords: inner box centered in left-[655.42] top-[475.41] w-[675.046] h-[743.622] wrapper */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '475.41px',
                        left: '655.42px',
                        width: '675.046px',
                        height: '743.622px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <div
                        style={{
                          width: '617.04px',
                          height: '692.478px',
                          transform: 'rotate(5deg)',
                          overflow: 'hidden',
                          borderRadius: '5px',
                          backgroundColor: '#121212',
                          flexShrink: 0,
                        }}
                      >
                        {image ? (
                          <img
                            src={image}
                            alt="Headshot"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '42px', fontFamily: 'Archivo, sans-serif', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.84px', textAlign: 'center' }}>
                              Headshot Here
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Name – exact Figma coords: left-[961.47] top-[1198] -translate-x-1/2, rotate-5 */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '1198px',
                        left: '961.47px',
                        transform: 'translateX(-50%) rotate(5deg)',
                        width: '584.828px',
                        height: '85.766px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <p
                        style={{
                          fontFamily: 'Archivo, sans-serif',
                          fontWeight: 500,
                          fontStyle: 'italic',
                          fontSize: `${nameFontSize(name || 'Name Entered Here')}px`,
                          color: '#121212',
                          textTransform: 'uppercase',
                          letterSpacing: '1.0325px',
                          textAlign: 'center',
                          whiteSpace: 'nowrap',
                          lineHeight: 1,
                        }}
                      >
                        {name || 'Name Entered Here'}
                      </p>
                    </div>

                    {/* Facts – precomputed rows, simple map for React compat */}
                    {factRows.map((row, i) => (
                      <div
                        key={i}
                        style={{
                          position: 'absolute',
                          top: `${row.top}px`,
                          left: '104px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '20.25px',
                        }}
                      >
                        <div style={{ width: '60.627px', height: '60.627px', flexShrink: 0 }}>
                          <svg width="60.627" height="60.627" viewBox="0 0 57.6595 54.8374" fill="none" style={{ display: 'block', width: '100%', height: '100%' }}>
                            <path d={svgPaths.p5dd2ba0} fill="#FF5A5B" />
                          </svg>
                        </div>
                        <p
                          style={{
                            marginTop: `${row.textOffset}px`,
                            width: '460px',
                            fontFamily: 'Archivo, sans-serif',
                            fontWeight: 500,
                            fontSize: `${row.fontSize}px`,
                            color: row.hasVal ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.9px',
                            lineHeight: String(FACT_LINE_HEIGHT),
                            whiteSpace: 'normal',
                            wordBreak: 'break-word',
                          }}
                        >
                          {row.text}
                        </p>
                      </div>
                    ))}

                    {/* Facility logo area – bottom-left */}
                    <div
                      style={{
                        position: 'absolute',
                        left: 90,
                        top: 1174,
                        width: 458,
                        height: 134,
                        border: facilityLogoDataUrl ? 'none' : '1.5px solid white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      {facilityLogoDataUrl ? (
                        <img
                          src={facilityLogoDataUrl}
                          alt={facility}
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                      ) : (
                        <span
                          style={{
                            fontFamily: 'Archivo, sans-serif',
                            fontWeight: 500,
                            fontSize: 22,
                            color: facilityLogoLoading ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.25)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.44px',
                            textAlign: 'center',
                          }}
                        >
                          {facilityLogoLoading ? 'Loading…' : facility ? 'No Logo Available' : 'Facility Logo Here'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Instructions modal */}
      {showInstructions && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#06263F]/70 backdrop-blur-sm"
          onClick={() => setShowInstructions(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="bg-[#06263F] rounded-t-3xl px-7 py-5 flex items-center justify-between">
              <div>
                <p className="font-['Montserrat'] font-semibold text-[#DCEBF7] uppercase tracking-[0.18em] text-[10px]">Signature HealthCARE</p>
                <h2 className="font-['Montserrat'] font-extrabold text-white uppercase text-lg leading-tight mt-0.5">How to Get Your Graphic</h2>
              </div>
              <button
                onClick={() => setShowInstructions(false)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Steps */}
            <div className="px-7 py-6 space-y-5">
              {[
                {
                  num: '01',
                  title: 'Upload Image',
                  body: 'Click the upload area or drag and drop a headshot. For best results, use a clear, forward-facing photo with good lighting. The image can be cropped after uploading.',
                },
                {
                  num: '02',
                  title: 'Enter Name',
                  body: 'Type the name as it should appear on the graphic. This will be displayed in the banner area below the photo.',
                },
                {
                  num: '03',
                  title: 'Enter 3 Facts',
                  body: 'Enter three facts about the service story — years of experience, role, a personal milestone, or anything that reflects the journey with Signature HealthCARE. Keep each fact short and impactful.',
                },
                {
                  num: '04',
                  title: 'Download & Share',
                  body: 'Click "Download Graphic" to save the 1440×1440 Stories of Service image. Post it to Facebook, LinkedIn, or any social platform. Tag @SignatureHealthCARE and use #StoriesOfService!',
                },
              ].map(({ num, title, body }) => (
                <div key={num} className="flex gap-4">
                  <div className="w-9 h-9 rounded-full bg-[#0067B1] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="font-['Montserrat'] font-extrabold text-white text-[11px] tracking-wide">{num}</span>
                  </div>
                  <div>
                    <h3 className="font-['Montserrat'] font-extrabold text-[#06263F] uppercase text-sm tracking-tight">{title}</h3>
                    <p className="font-['Montserrat'] text-[#5B6B7A] text-sm leading-relaxed mt-1">{body}</p>
                  </div>
                </div>
              ))}

              <div className="bg-[#DCEBF7] rounded-xl p-4 mt-2">
                <p className="font-['Montserrat'] text-[#06263F] text-xs leading-relaxed">
                  <span className="font-semibold">Tip:</span> The graphic updates live as each field is filled in — check the preview on the right before downloading.
                </p>
              </div>
            </div>

            <div className="px-7 pb-6">
              <button
                onClick={() => setShowInstructions(false)}
                className="w-full bg-[#0067B1] hover:bg-[#005494] text-white font-['Montserrat'] font-bold uppercase text-xs tracking-[0.18em] py-4 rounded-xl transition-all"
              >
                Got it — Let's Go
              </button>
            </div>
          </div>
        </div>
      )}

      <EmailClientPicker
        isOpen={showEmailPicker}
        onClose={() => setShowEmailPicker(false)}
        isDownloading={isGenerating}
        onSelect={async (clientId) => {
          setShowEmailPicker(false);
          await handleDownload();
          const subject = encodeURIComponent('Stories of Service — Signature HealthCARE');
          const body = encodeURIComponent(
            `Hi,\n\nAttached is a Stories of Service graphic from Signature HealthCARE — celebrating a team member's milestones and service journey.\n\nFeel free to share it on Facebook or LinkedIn and tag us at @SignatureHealthCARE with #StoriesOfService!\n\n(Note: the graphic has been saved to your downloads — please attach it before sending.)`
          );
          const client = EMAIL_CLIENTS.find((c) => c.id === clientId)!;
          const url = client.getUrl(subject, body);
          if (client.newTab) {
            window.open(url, '_blank');
          } else {
            window.location.href = url;
          }
        }}
      />
    </div>
  );
}
