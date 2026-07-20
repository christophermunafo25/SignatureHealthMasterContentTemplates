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
import svgPaths from "../../imports/EmployeeSpotlights/svg-wip1rnzfz9";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

function nameFontSize(text: string): number {
  const len = text.length;
  if (len <= 15) return 36;
  if (len <= 22) return 30;
  if (len <= 30) return 24;
  if (len <= 38) return 19;
  return 15;
}

function quoteFontSize(text: string): number {
  const len = text.length;
  if (len <= 55) return 50;
  if (len <= 80) return 42;
  if (len <= 110) return 34;
  return 28;
}

interface SpotlightGeneratorProps {
  onBack: () => void;
}

export function SpotlightGenerator({ onBack }: SpotlightGeneratorProps) {
  const [image, setImage] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showEmailPicker, setShowEmailPicker] = useState(false);

  const [name, setName] = useState("");
  const [quote, setQuote] = useState("");
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
        const newScale = Math.min(parentWidth / 1440, 1);
        setScale(newScale);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
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
    if (acceptedFiles.length > 0) {
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
          const fileName = `Employee_Spotlight_${Date.now()}.png`;
          const file = new File([blob], fileName, { type: "image/png" });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: "Employee Spotlight" });
            return;
          }
        } catch {}
      }

      const link = document.createElement("a");
      link.download = "Employee_Spotlight.png";
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to generate image", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const displayQuote = quote || "Residents Love her. She truly makes a difference in their lives.";
  const qFontSize = quoteFontSize(displayQuote);

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
      <header style={{ background: "#06263F", borderBottom: "1px solid #0a3a5e" }}>
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[#DCEBF7] hover:text-white transition-colors"
            style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.18em" }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All Templates
          </button>
          <div className="w-px h-4" style={{ background: "rgba(220,235,247,0.2)" }} />
          <div>
            <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, color: "#DCEBF7", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", lineHeight: 1, marginBottom: 2 }}>
              Signature HealthCARE
            </p>
          </div>
          <div className="ml-auto">
            <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#FF9E19", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em" }}>
              Employee Spotlight
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
              style={{ background: "#06263F" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#0a3a5e")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#06263F")}
            >
              <HelpCircle className="w-4 h-4" style={{ color: "#FF9E19" }} />
              How to Get Your Graphic
            </button>

            {/* Step 01 – Photo */}
            <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4" style={{ border: "1px solid #E3E8EE" }}>
              <div>
                <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, color: "#0067B1", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 2 }}>Step 01</p>
                <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#06263F", fontSize: 15, textTransform: "uppercase", letterSpacing: "0.02em" }}>Upload Headshot</h2>
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
                  <div className="w-12 h-12 rounded-full flex items-center justify-center group-hover:scale-105 transition-transform" style={{ background: "#DCEBF7" }}>
                    <Upload className="w-5 h-5" style={{ color: "#0067B1" }} />
                  </div>
                )}
                <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.16em", color: "#5B6B7A" }}>
                  {image ? "Replace Photo" : "Click or Drag to Upload"}
                </p>
              </div>
            </div>

            {/* Step 02 – Name */}
            <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4" style={{ border: "1px solid #E3E8EE" }}>
              <div>
                <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, color: "#0067B1", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 2 }}>Step 02</p>
                <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#06263F", fontSize: 15, textTransform: "uppercase", letterSpacing: "0.02em" }}>Employee Name</h2>
                <p style={{ fontFamily: "Montserrat, sans-serif", color: "#5B6B7A", fontSize: 12, marginTop: 3 }}>Appears in the name strip at the bottom of the polaroid.</p>
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jane Smith, CNA"
                maxLength={40}
                style={{
                  width: "100%",
                  fontFamily: "Montserrat, sans-serif",
                  fontSize: 14,
                  color: "#17202A",
                  background: "#F5F7FA",
                  border: "1px solid #E3E8EE",
                  borderRadius: 12,
                  padding: "12px 16px",
                  outline: "none",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#0067B1"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,103,177,0.12)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#E3E8EE"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>

            {/* Step 03 – Quote */}
            <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4" style={{ border: "1px solid #E3E8EE" }}>
              <div>
                <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, color: "#0067B1", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 2 }}>Step 03</p>
                <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#06263F", fontSize: 15, textTransform: "uppercase", letterSpacing: "0.02em" }}>Enter Quote</h2>
                <p style={{ fontFamily: "Montserrat, sans-serif", color: "#5B6B7A", fontSize: 12, marginTop: 3 }}>A quote about this employee — what makes them shine.</p>
              </div>
              <textarea
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                placeholder="e.g. Residents love her. She truly makes a difference in their lives."
                maxLength={160}
                rows={4}
                style={{
                  width: "100%",
                  fontFamily: "Montserrat, sans-serif",
                  fontSize: 14,
                  color: "#17202A",
                  background: "#F5F7FA",
                  border: "1px solid #E3E8EE",
                  borderRadius: 12,
                  padding: "12px 16px",
                  outline: "none",
                  resize: "vertical",
                  lineHeight: 1.6,
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#0067B1"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,103,177,0.12)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#E3E8EE"; e.currentTarget.style.boxShadow = "none"; }}
              />
              <p style={{ fontFamily: "Montserrat, sans-serif", color: "#9AA7B4", fontSize: 11, textAlign: "right" }}>{quote.length}/160</p>
            </div>

            {/* Step 04 – Facility */}
            <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4" style={{ border: "1px solid #E3E8EE" }}>
              <div>
                <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, color: "#0067B1", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 2 }}>Step 04</p>
                <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#06263F", fontSize: 15, textTransform: "uppercase", letterSpacing: "0.02em" }}>Select Facility</h2>
                <p style={{ fontFamily: "Montserrat, sans-serif", color: "#5B6B7A", fontSize: 12, marginTop: 3 }}>Choose the facility this graphic is being made for.</p>
              </div>
              <FacilitySelector value={facility} onChange={setFacility} />
            </div>

            {/* Step 05 – Download */}
            <div className="bg-white rounded-2xl p-6 shadow-sm space-y-3" style={{ border: "1px solid #E3E8EE" }}>
              <div>
                <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, color: "#0067B1", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 2 }}>Step 05</p>
                <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#06263F", fontSize: 15, textTransform: "uppercase", letterSpacing: "0.02em" }}>Save & Share</h2>
              </div>
              <button
                onClick={handleDownload}
                disabled={isGenerating}
                className="w-full text-white font-['Montserrat'] font-bold uppercase text-xs tracking-[0.18em] py-4 rounded-xl transition-all flex items-center justify-center gap-2.5 shadow-md disabled:opacity-60"
                style={{ background: "#0067B1" }}
                onMouseEnter={(e) => !isGenerating && ((e.currentTarget as HTMLElement).style.background = "#005494")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "#0067B1")}
              >
                {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {isGenerating ? "Generating…" : "Download Graphic"}
              </button>
              <button
                onClick={() => setShowEmailPicker(true)}
                disabled={isGenerating}
                className="w-full font-['Montserrat'] font-bold uppercase text-xs tracking-[0.18em] py-3.5 rounded-xl transition-all flex items-center justify-center gap-2.5 disabled:opacity-60"
                style={{ color: "#0067B1", border: "2px solid #0067B1", background: "transparent" }}
                onMouseEnter={(e) => { if (!(e.currentTarget as HTMLButtonElement).disabled) (e.currentTarget as HTMLElement).style.background = "#DCEBF7"; }}
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
                  <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, color: "#9AA7B4", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.18em", marginTop: 2 }}>Social Ready · 1440×1440</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" style={{ color: "#FF9E19" }} />
                  <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.18em", color: "#5B6B7A" }}>Live Preview</span>
                </div>
              </div>

              {/* Canvas wrapper */}
              <div
                ref={containerRef}
                className="w-full aspect-square rounded-2xl overflow-hidden relative"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "#06263F", border: "4px solid white", boxShadow: "inset 0 2px 8px rgba(0,0,0,0.2)" }}
              >
                <div
                  style={{
                    width: 1440,
                    height: 1440,
                    transform: `scale(${scale})`,
                    transformOrigin: "center center",
                    position: "absolute",
                  }}
                >
                  <div
                    ref={previewRef}
                    style={{ width: 1440, height: 1440, position: "relative", overflow: "hidden" }}
                  >
                    {/* Background gradient */}
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(131.459deg, rgb(0, 103, 177) 46.497%, rgb(220, 235, 247) 100%)" }} />

                    {/* Orange accent rectangle */}
                    <div style={{ position: "absolute", left: 80, top: 592, width: 781, height: 518, borderRadius: 45, background: "#ff9e19" }} />

                    {/* EMPLOYEE overline SVG */}
                    <svg
                      style={{ position: "absolute", left: 103, top: 129, width: 629, height: 71 }}
                      viewBox="0 0 629 71"
                      fill="none"
                      preserveAspectRatio="none"
                    >
                      <path d={svgPaths.pc1c9cf0} fill="white" />
                      <path d={svgPaths.p48c5500} fill="white" />
                      <path d={svgPaths.p63f0400} fill="white" />
                      <path d={svgPaths.p261b6d00} fill="white" />
                      <path d={svgPaths.p1271b3c0} fill="white" />
                      <path d={svgPaths.p1908dc00} fill="white" />
                      <path d={svgPaths.p2d11fe00} fill="white" />
                      <path d={svgPaths.p74ee600} fill="white" />
                    </svg>

                    {/* Spotlights cursive SVG */}
                    <svg
                      style={{ position: "absolute", left: 80, top: 213, width: 923, height: 264 }}
                      viewBox="0 0 923 264"
                      fill="none"
                      preserveAspectRatio="none"
                    >
                      <path d={svgPaths.p2b238000} fill="#FF9E19" />
                      <path d={svgPaths.p27e2d980} fill="#FF9E19" />
                      <path d={svgPaths.p2c67c80} fill="#FF9E19" />
                      <path d={svgPaths.p3ed00480} fill="#FF9E19" />
                      <path d={svgPaths.p35089d00} fill="#FF9E19" />
                      <path d={svgPaths.p1d4ec680} fill="#FF9E19" />
                      <path d={svgPaths.p19996000} fill="#FF9E19" />
                      <path d={svgPaths.p6c47080} fill="#FF9E19" />
                      <path d={svgPaths.p1e770180} fill="#FF9E19" />
                      <path d={svgPaths.p39ef600} fill="#FF9E19" />
                    </svg>

                    {/* Decorative stars */}
                    {/* Large outline star at top-right */}
                    <div style={{ position: "absolute", left: 1300, top: 271.09, width: 72.284, height: 72.284, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ transform: "rotate(-8deg)" }}>
                        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                          <path d={svgPaths.p27d88ac0} stroke="#FF9E19" strokeLinecap="round" strokeWidth="2" opacity="0.15" />
                        </svg>
                      </div>
                    </div>
                    {/* Star1 – small filled */}
                    <div style={{ position: "absolute", left: 980, top: 174.44, width: 37.071, height: 37.071, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ transform: "rotate(-10deg)" }}>
                        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                          <path d={svgPaths.p3ba93c14} fill="#FF9E19" opacity="0.12" />
                        </svg>
                      </div>
                    </div>
                    {/* Star2 – medium filled bottom-left */}
                    <div style={{ position: "absolute", left: 209.36, top: 1180, width: 53.338, height: 53.338, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ transform: "rotate(14deg)" }}>
                        <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                          <path d={svgPaths.p2c1b4780} fill="#FF9E19" opacity="0.10" />
                        </svg>
                      </div>
                    </div>
                    {/* Star3 – tiny right */}
                    <div style={{ position: "absolute", left: 1320, top: 1117.07, width: 30.773, height: 30.773, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ transform: "rotate(-6deg)" }}>
                        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                          <path d={svgPaths.p9af7500} fill="#FF9E19" opacity="0.08" />
                        </svg>
                      </div>
                    </div>
                    {/* Star4 – left mid */}
                    <div style={{ position: "absolute", left: 90, top: 408.88, width: 45.363, height: 45.363, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ transform: "rotate(-18deg)" }}>
                        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                          <path d={svgPaths.pc4dd900} fill="#FF9E19" opacity="0.09" />
                        </svg>
                      </div>
                    </div>
                    {/* Star5 – top right */}
                    <div style={{ position: "absolute", left: 1374.43, top: 160, width: 45.178, height: 45.178, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ transform: "rotate(8deg)" }}>
                        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                          <path d={svgPaths.p3dd14f80} fill="#FF9E19" opacity="0.11" />
                        </svg>
                      </div>
                    </div>

                    {/* Opening quote mark */}
                    <div style={{ position: "absolute", left: 112, top: 627, width: 97, height: 73 }}>
                      <svg width="97" height="73" viewBox="0 0 97 73" fill="none">
                        <path d={svgPaths.p3a50b400} fill="#06263F" />
                      </svg>
                    </div>

                    {/* Quote text */}
                    <p
                      style={{
                        position: "absolute",
                        left: 209,
                        top: 729,
                        width: 455,
                        fontFamily: "Archivo, sans-serif",
                        fontStyle: "italic",
                        fontWeight: 400,
                        fontSize: qFontSize,
                        color: "#06263f",
                        textTransform: "uppercase",
                        letterSpacing: "1px",
                        lineHeight: 1.2,
                        wordBreak: "break-word",
                      }}
                    >
                      {displayQuote}
                    </p>

                    {/* Closing quote mark (rotated 180) */}
                    <div style={{ position: "absolute", left: 630, top: 1003, width: 97, height: 73, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ transform: "rotate(180deg)" }}>
                        <svg width="97" height="73" viewBox="0 0 97 73" fill="none">
                          <path d={svgPaths.p3a50b400} fill="#06263F" />
                        </svg>
                      </div>
                    </div>

                    {/* Polaroid frame */}
                    <div
                      style={{
                        position: "absolute",
                        left: 727,
                        top: 431,
                        width: 639.903,
                        height: 917.318,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div
                        style={{
                          transform: "rotate(-4deg)",
                          flexShrink: 0,
                          width: 580,
                          height: 879,
                          background: "white",
                          borderRadius: 12,
                          filter: "drop-shadow(8px 12px 12px rgba(0,0,0,0.25))",
                          position: "relative",
                        }}
                      >
                        {/* Photo area */}
                        <div
                          style={{
                            position: "absolute",
                            top: 24,
                            left: 24,
                            right: 24,
                            height: 720,
                            background: "#1a1a1a",
                            borderRadius: 6,
                            overflow: "hidden",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {image ? (
                            <img src={image} alt="Headshot" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <span
                              style={{
                                color: "rgba(255,255,255,0.3)",
                                fontFamily: "Archivo, sans-serif",
                                fontWeight: 600,
                                fontSize: 32,
                                textTransform: "uppercase",
                                letterSpacing: "0.64px",
                                textAlign: "center",
                              }}
                            >
                              Headshot Here
                            </span>
                          )}
                        </div>

                        {/* Name strip */}
                        <div
                          style={{
                            position: "absolute",
                            top: 768,
                            left: 24,
                            right: 24,
                            background: "#f6ab60",
                            borderRadius: 6,
                            padding: 16,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <p
                            style={{
                              fontFamily: "Archivo, sans-serif",
                              fontWeight: 800,
                              fontSize: nameFontSize(name || "NAME ENTERED HERE"),
                              color: "#121212",
                              textTransform: "uppercase",
                              letterSpacing: "0.36px",
                              textAlign: "center",
                              whiteSpace: "nowrap",
                              lineHeight: 1,
                            }}
                          >
                            {name || "NAME ENTERED HERE"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Facility logo area – bottom-left */}
                    <div
                      style={{
                        position: "absolute",
                        left: 90,
                        top: 1214,
                        width: 540,
                        height: 134,
                        border: facilityLogoDataUrl ? "none" : "1.5px solid white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      {facilityLogoDataUrl ? (
                        <img
                          src={facilityLogoDataUrl}
                          alt={facility}
                          style={{ width: "100%", height: "100%", objectFit: "contain" }}
                        />
                      ) : (
                        <span
                          style={{
                            fontFamily: "Archivo, sans-serif",
                            fontWeight: 500,
                            fontSize: 22,
                            color: facilityLogoLoading ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.25)",
                            textTransform: "uppercase",
                            letterSpacing: "0.44px",
                            textAlign: "center",
                          }}
                        >
                          {facilityLogoLoading ? "Loading…" : facility ? "No Logo Available" : "Facility Logo Here"}
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(6,38,63,0.7)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowInstructions(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-t-3xl px-7 py-5 flex items-center justify-between" style={{ background: "#06263F" }}>
              <div>
                <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, color: "#DCEBF7", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 4 }}>Signature HealthCARE</p>
                <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "white", fontSize: 18, textTransform: "uppercase", lineHeight: 1.1 }}>How to Get Your Graphic</h2>
              </div>
              <button
                onClick={() => setShowInstructions(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.1)" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.2)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)")}
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            <div className="px-7 py-6 space-y-5">
              {[
                { num: "01", title: "Upload Headshot", body: "Click the upload area or drag and drop a clear headshot photo. Crop as needed." },
                { num: "02", title: "Enter Name", body: "Type the employee's name as it should appear in the orange name strip at the bottom of the polaroid." },
                { num: "03", title: "Enter Quote", body: "Write a short, compelling quote about this employee — what makes them special, a compliment from a resident, or an achievement." },
                { num: "04", title: "Download & Share", body: 'Click "Download Graphic" to save the 1440×1440 Employee Spotlight image. Post to Facebook or LinkedIn and tag @SignatureHealthCARE.' },
              ].map(({ num, title, body }) => (
                <div key={num} className="flex gap-4">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "#0067B1" }}>
                    <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "white", fontSize: 11, letterSpacing: "0.04em" }}>{num}</span>
                  </div>
                  <div>
                    <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#06263F", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.02em" }}>{title}</h3>
                    <p style={{ fontFamily: "Montserrat, sans-serif", color: "#5B6B7A", fontSize: 13, lineHeight: 1.55, marginTop: 4 }}>{body}</p>
                  </div>
                </div>
              ))}

              <div className="rounded-xl p-4" style={{ background: "#DCEBF7" }}>
                <p style={{ fontFamily: "Montserrat, sans-serif", color: "#06263F", fontSize: 12, lineHeight: 1.55 }}>
                  <strong>Tip:</strong> Keep quotes concise for the best visual impact — under 80 characters works best at full size.
                </p>
              </div>
            </div>

            <div className="px-7 pb-6">
              <button
                onClick={() => setShowInstructions(false)}
                className="w-full text-white font-['Montserrat'] font-bold uppercase text-xs tracking-[0.18em] py-4 rounded-xl transition-all"
                style={{ background: "#0067B1" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#005494")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "#0067B1")}
              >
                Got it — Let&apos;s Go
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
          const subject = encodeURIComponent("Employee Spotlight — Signature HealthCARE");
          const body = encodeURIComponent(
            `Hi,\n\nAttached is an Employee Spotlight graphic from Signature HealthCARE — celebrating one of our outstanding team members.\n\nShare it on Facebook or LinkedIn and tag us at @SignatureHealthCARE!\n\n(Note: the graphic has been saved to your downloads — please attach it before sending.)`
          );
          const client = EMAIL_CLIENTS.find((c) => c.id === clientId)!;
          const url = client.getUrl(subject, body);
          if (client.newTab) {
            window.open(url, "_blank");
          } else {
            window.location.href = url;
          }
        }}
      />
    </div>
  );
}
