import React, { useState, useRef, useEffect, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { toPng } from "html-to-image";
import { ImageCropper } from "./ImageCropper";
import { Download, Upload, RefreshCw, Sparkles, HelpCircle, X, ArrowLeft, Mail } from "lucide-react";
import { EmailClientPicker, EMAIL_CLIENTS } from "./EmailClientPicker";
import { FacilitySelector } from "./FacilitySelector";
import { fetchLogoAsDataUrl } from "./facilityLogos";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

function nameFontSize(text: string): number {
  const len = text.length;
  if (len <= 15) return 47;
  if (len <= 22) return 38;
  if (len <= 30) return 30;
  if (len <= 38) return 24;
  return 18;
}

function titleFontSize(text: string): number {
  const len = text.length;
  if (len <= 22) return 23;
  if (len <= 36) return 18;
  return 14;
}

function yearsFontSize(text: string): number {
  const len = text.length;
  if (len <= 2) return 400;
  if (len <= 3) return 280;
  return 200;
}

interface WorkAnniversaryGeneratorProps {
  onBack: () => void;
}

export function WorkAnniversaryGenerator({ onBack }: WorkAnniversaryGeneratorProps) {
  const [image, setImage] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showEmailPicker, setShowEmailPicker] = useState(false);

  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [years, setYears] = useState("");
  const [facility, setFacility] = useState("");

  const previewRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [facilityLogoDataUrl, setFacilityLogoDataUrl] = useState<string | null>(null);
  const [facilityLogoLoading, setFacilityLogoLoading] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const parentWidth = containerRef.current.offsetWidth;
        setScale(Math.min(parentWidth / 1080, 1));
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!facility) { setFacilityLogoDataUrl(null); return; }
    setFacilityLogoLoading(true);
    fetchLogoAsDataUrl(facility).then((url) => {
      setFacilityLogoDataUrl(url);
      setFacilityLogoLoading(false);
    });
  }, [facility]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const reader = new FileReader();
      reader.onload = () => { setOriginalImage(reader.result as string); setIsCropping(true); };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg"] },
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
      const options = { width: 1080, height: 1080, pixelRatio: 1, canvasWidth: 1080, canvasHeight: 1080, skipFonts: true };
      await toPng(previewRef.current, options);
      await new Promise((resolve) => setTimeout(resolve, 150));
      const dataUrl = await toPng(previewRef.current, options);

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile && navigator.share) {
        try {
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const file = new File([blob], `Work_Anniversary_${Date.now()}.png`, { type: "image/png" });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: "Work Anniversary" });
            return;
          }
        } catch {}
      }

      const link = document.createElement("a");
      link.download = "Work_Anniversary.png";
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to generate image", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const displayName = name || "NAME HERE";
  const displayTitle = jobTitle || "JOB TITLE";
  const displayYears = years || "#";

  return (
    <div className="min-h-screen font-['Montserrat'] overflow-x-hidden" style={{ background: "#F5F7FA" }}>
      {isCropping && originalImage && (
        <ImageCropper
          imageSrc={originalImage}
          onCancel={() => setIsCropping(false)}
          onCropComplete={handleCropComplete}
        />
      )}

      {/* Header */}
      <header style={{ background: "#003b71", borderBottom: "1px solid #002a55" }}>
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 transition-colors"
            style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.18em", color: "#cfe0ee" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "white")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#cfe0ee")}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All Templates
          </button>
          <div className="w-px h-4" style={{ background: "rgba(207,224,238,0.2)" }} />
          <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, color: "#cfe0ee", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase" }}>
            Signature HealthCARE
          </p>
          <div className="ml-auto">
            <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#f1b367", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em" }}>
              Work Anniversary
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10 lg:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Controls */}
          <div className="lg:col-span-5 space-y-5 order-1">

            <button
              onClick={() => setShowInstructions(true)}
              className="w-full flex items-center justify-center gap-2 text-white font-['Montserrat'] font-bold uppercase text-xs tracking-[0.18em] py-3.5 rounded-xl transition-all"
              style={{ background: "#003b71" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#0d5a96")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "#003b71")}
            >
              <HelpCircle className="w-4 h-4" style={{ color: "#f1b367" }} />
              How to Get Your Graphic
            </button>

            {/* Step 01 – Photo */}
            <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4" style={{ border: "1px solid #E3E8EE" }}>
              <div>
                <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, color: "#0067B1", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 2 }}>Step 01</p>
                <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#06263F", fontSize: 15, textTransform: "uppercase" }}>Upload Headshot</h2>
                <p style={{ fontFamily: "Montserrat, sans-serif", color: "#5B6B7A", fontSize: 12, marginTop: 3 }}>Photo appears in the right-side panel of the graphic.</p>
              </div>
              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 group",
                  isDragActive ? "border-[#0067B1] bg-[#DCEBF7]/40" : "border-[#E3E8EE] hover:border-[#0067B1]/40 hover:bg-[#DCEBF7]/20"
                )}
              >
                <input {...getInputProps()} />
                {image ? (
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden shadow" style={{ border: "2px solid #E3E8EE" }}>
                    <img src={image} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" style={{ background: "rgba(6,38,63,0.75)" }}>
                      <RefreshCw className="w-5 h-5 text-white" />
                    </div>
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full flex items-center justify-center group-hover:scale-105 transition-transform" style={{ background: "#cfe0ee" }}>
                    <Upload className="w-5 h-5" style={{ color: "#003b71" }} />
                  </div>
                )}
                <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.16em", color: "#5B6B7A" }}>
                  {image ? "Replace Photo" : "Click or Drag to Upload"}
                </p>
              </div>
            </div>

            {/* Step 02 – Years */}
            <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4" style={{ border: "1px solid #E3E8EE" }}>
              <div>
                <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, color: "#0067B1", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 2 }}>Step 02</p>
                <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#06263F", fontSize: 15, textTransform: "uppercase" }}>Years of Service</h2>
                <p style={{ fontFamily: "Montserrat, sans-serif", color: "#5B6B7A", fontSize: 12, marginTop: 3 }}>The number displayed large on the left side of the graphic.</p>
              </div>
              <input
                type="number"
                min={1}
                max={99}
                value={years}
                onChange={(e) => setYears(e.target.value)}
                placeholder="e.g. 10"
                style={{ width: "100%", fontFamily: "Montserrat, sans-serif", fontSize: 14, color: "#17202A", background: "#F5F7FA", border: "1px solid #E3E8EE", borderRadius: 12, padding: "12px 16px", outline: "none" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#0067B1"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,103,177,0.12)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#E3E8EE"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>

            {/* Step 03 – Name */}
            <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4" style={{ border: "1px solid #E3E8EE" }}>
              <div>
                <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, color: "#0067B1", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 2 }}>Step 03</p>
                <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#06263F", fontSize: 15, textTransform: "uppercase" }}>Employee Name</h2>
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jane Smith, RN"
                maxLength={50}
                style={{ width: "100%", fontFamily: "Montserrat, sans-serif", fontSize: 14, color: "#17202A", background: "#F5F7FA", border: "1px solid #E3E8EE", borderRadius: 12, padding: "12px 16px", outline: "none" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#0067B1"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,103,177,0.12)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#E3E8EE"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>

            {/* Step 04 – Job Title */}
            <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4" style={{ border: "1px solid #E3E8EE" }}>
              <div>
                <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, color: "#0067B1", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 2 }}>Step 04</p>
                <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#06263F", fontSize: 15, textTransform: "uppercase" }}>Job Title</h2>
              </div>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Registered Nurse"
                maxLength={60}
                style={{ width: "100%", fontFamily: "Montserrat, sans-serif", fontSize: 14, color: "#17202A", background: "#F5F7FA", border: "1px solid #E3E8EE", borderRadius: 12, padding: "12px 16px", outline: "none" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#0067B1"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,103,177,0.12)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#E3E8EE"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>

            {/* Step 05 – Facility */}
            <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4" style={{ border: "1px solid #E3E8EE" }}>
              <div>
                <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, color: "#0067B1", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 2 }}>Step 05</p>
                <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#06263F", fontSize: 15, textTransform: "uppercase" }}>Select Facility</h2>
              </div>
              <FacilitySelector value={facility} onChange={setFacility} />
            </div>

            {/* Step 06 – Download */}
            <div className="bg-white rounded-2xl p-6 shadow-sm space-y-3" style={{ border: "1px solid #E3E8EE" }}>
              <div>
                <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, color: "#0067B1", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 2 }}>Step 06</p>
                <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#06263F", fontSize: 15, textTransform: "uppercase" }}>Save & Share</h2>
              </div>
              <button
                onClick={handleDownload}
                disabled={isGenerating}
                className="w-full text-white font-['Montserrat'] font-bold uppercase text-xs tracking-[0.18em] py-4 rounded-xl transition-all flex items-center justify-center gap-2.5 shadow-md disabled:opacity-60"
                style={{ background: "#003b71" }}
                onMouseEnter={(e) => !isGenerating && ((e.currentTarget as HTMLElement).style.background = "#0d5a96")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "#003b71")}
              >
                {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {isGenerating ? "Generating…" : "Download Graphic"}
              </button>
              <button
                onClick={() => setShowEmailPicker(true)}
                disabled={isGenerating}
                className="w-full font-['Montserrat'] font-bold uppercase text-xs tracking-[0.18em] py-3.5 rounded-xl transition-all flex items-center justify-center gap-2.5 disabled:opacity-60"
                style={{ color: "#003b71", border: "2px solid #003b71", background: "transparent" }}
                onMouseEnter={(e) => { if (!(e.currentTarget as HTMLButtonElement).disabled) (e.currentTarget as HTMLElement).style.background = "#cfe0ee"; }}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
              >
                <Mail className="w-4 h-4" />
                Share Graphic
              </button>
            </div>

          </div>

          {/* Preview */}
          <div className="lg:col-span-7 lg:sticky lg:top-10 order-2">
            <div className="bg-white rounded-3xl shadow-lg p-6 flex flex-col items-center" style={{ border: "1px solid #E3E8EE" }}>
              <div className="w-full flex items-center justify-between mb-5">
                <div>
                  <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#06263F", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.04em" }}>Preview</h3>
                  <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, color: "#9AA7B4", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.18em", marginTop: 2 }}>Social Ready · 1080×1080</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" style={{ color: "#f1b367" }} />
                  <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.18em", color: "#5B6B7A" }}>Live Preview</span>
                </div>
              </div>

              <div
                ref={containerRef}
                className="w-full aspect-square rounded-2xl overflow-hidden relative"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", border: "4px solid white", boxShadow: "inset 0 2px 8px rgba(0,0,0,0.2)" }}
              >
                <div style={{ width: 1080, height: 1080, transform: `scale(${scale})`, transformOrigin: "center center", position: "absolute" }}>
                  <div
                    ref={previewRef}
                    style={{ width: 1080, height: 1080, position: "relative", overflow: "hidden", background: "#f1b367" }}
                  >
                    {/* Right photo panel */}
                    <div
                      style={{
                        position: "absolute",
                        left: 547,
                        top: 0,
                        width: 533,
                        height: 1080,
                        borderRadius: "65px 0 0 65px",
                        overflow: "hidden",
                        background: "#cfe0ee",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "-10px 5px 30px 0px rgba(0,0,0,0.1)",
                      }}
                    >
                      {image ? (
                        <img src={image} alt="Headshot" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, fontSize: 24, color: "#0d5a96", letterSpacing: "2.88px", textAlign: "center", textTransform: "uppercase" }}>
                          ADD PHOTO
                        </span>
                      )}
                    </div>

                    {/* "CELEBRATING" */}
                    <p
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 151,
                        width: 547,
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 600,
                        fontSize: 40,
                        color: "#003b71",
                        textAlign: "center",
                        letterSpacing: "6px",
                        textTransform: "uppercase",
                        lineHeight: 1,
                      }}
                    >
                      Celebrating
                    </p>

                    {/* Large year number */}
                    <p
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 218,
                        width: 547,
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 800,
                        fontSize: yearsFontSize(displayYears),
                        color: "white",
                        textAlign: "center",
                        letterSpacing: "-12px",
                        lineHeight: 1,
                      }}
                    >
                      {displayYears}
                    </p>

                    {/* "years" cursive */}
                    <p
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 515,
                        width: 547,
                        fontFamily: "'Dancing Script', cursive",
                        fontWeight: 400,
                        fontSize: 175,
                        color: "#003b71",
                        textAlign: "center",
                        lineHeight: 1,
                      }}
                    >
                      years
                    </p>

                    {/* Name */}
                    <p
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 744,
                        width: 547,
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 800,
                        fontSize: nameFontSize(displayName),
                        color: "white",
                        textAlign: "center",
                        lineHeight: 1.1,
                      }}
                    >
                      {displayName}
                    </p>

                    {/* Job title */}
                    <p
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 801,
                        width: 547,
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 600,
                        fontSize: titleFontSize(displayTitle),
                        color: "rgba(255,255,255,0.75)",
                        textAlign: "center",
                        letterSpacing: "2.76px",
                        textTransform: "uppercase",
                      }}
                    >
                      {displayTitle}
                    </p>

                    {/* Navy bottom bar */}
                    <div style={{ position: "absolute", left: 0, top: 920, width: 1080, height: 160, background: "#003b71" }} />

                    {/* Facility logo */}
                    <div
                      style={{
                        position: "absolute",
                        left: 122,
                        top: 954,
                        width: 301,
                        height: 92,
                        border: facilityLogoDataUrl ? "none" : "2px dashed rgba(255,255,255,0.75)",
                        borderRadius: 16,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        gap: facilityLogoDataUrl ? 0 : 10,
                      }}
                    >
                      {facilityLogoDataUrl ? (
                        <img src={facilityLogoDataUrl} alt={facility} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      ) : (
                        <>
                          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
                            <circle cx="6.5" cy="6.5" r="6.5" fill="#F86464" />
                          </svg>
                          <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, fontSize: 13, color: facilityLogoLoading ? "rgba(255,255,255,0.5)" : "white", letterSpacing: "1.56px", whiteSpace: "nowrap" }}>
                            {facilityLogoLoading ? "LOADING…" : facility ? "NO LOGO" : "WHITE LOGO HERE"}
                          </span>
                        </>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,59,113,0.75)", backdropFilter: "blur(4px)" }} onClick={() => setShowInstructions(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="rounded-t-3xl px-7 py-5 flex items-center justify-between" style={{ background: "#003b71" }}>
              <div>
                <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, color: "#cfe0ee", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 4 }}>Signature HealthCARE</p>
                <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "white", fontSize: 18, textTransform: "uppercase", lineHeight: 1.1 }}>How to Get Your Graphic</h2>
              </div>
              <button onClick={() => setShowInstructions(false)} className="rounded-full p-2 transition-colors" style={{ background: "rgba(255,255,255,0.1)" }} onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.2)")} onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)")}>
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="p-7 space-y-5">
              {[
                { step: "01", title: "Upload a Headshot", desc: "Add a photo of the employee. It will appear in the right-side panel." },
                { step: "02", title: "Enter Years of Service", desc: "Type the number of years — it appears large on the left side." },
                { step: "03", title: "Enter the Name", desc: "Type the employee's full name and credential." },
                { step: "04", title: "Enter the Job Title", desc: "Add their role or department." },
                { step: "05", title: "Select Facility", desc: "Choose the facility to load the correct logo." },
                { step: "06", title: "Download & Share", desc: "Download the 1080×1080 PNG and post it on social media or share via email." },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#f1b367" }}>
                    <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 10, color: "#003b71" }}>{step}</span>
                  </div>
                  <div>
                    <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#06263F", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</p>
                    <p style={{ fontFamily: "Montserrat, sans-serif", color: "#5B6B7A", fontSize: 12, lineHeight: 1.5, marginTop: 2 }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Email picker modal */}
      {showEmailPicker && (
        <EmailClientPicker
          onClose={() => setShowEmailPicker(false)}
          onSelect={async (clientId) => {
            setShowEmailPicker(false);
            if (!previewRef.current) return;
            setIsGenerating(true);
            try {
              const options = { width: 1080, height: 1080, pixelRatio: 1, canvasWidth: 1080, canvasHeight: 1080, skipFonts: true };
              await toPng(previewRef.current, options);
              await new Promise((r) => setTimeout(r, 150));
              const dataUrl = await toPng(previewRef.current, options);
              const client = EMAIL_CLIENTS.find((c) => c.id === clientId);
              if (client) window.open(client.composeUrl({ subject: "Work Anniversary", body: "Please find the Work Anniversary graphic attached." }), "_blank");
            } catch (err) {
              console.error("Failed to generate image", err);
            } finally {
              setIsGenerating(false);
            }
          }}
        />
      )}
    </div>
  );
}
