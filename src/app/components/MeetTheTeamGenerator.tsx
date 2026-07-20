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

function teamNameFontSize(text: string): number {
  const len = text.length;
  if (len <= 20) return 37;
  if (len <= 30) return 30;
  if (len <= 42) return 23;
  return 17;
}

function factFontSize(text: string): number {
  const len = text.length;
  if (len <= 22) return 25;
  if (len <= 36) return 20;
  return 16;
}

interface MeetTheTeamGeneratorProps {
  onBack: () => void;
}

const FACT_TOPS = [513, 643, 773];

export function MeetTheTeamGenerator({ onBack }: MeetTheTeamGeneratorProps) {
  const [image, setImage] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showEmailPicker, setShowEmailPicker] = useState(false);

  const [teamName, setTeamName] = useState("");
  const [fact1, setFact1] = useState("");
  const [fact2, setFact2] = useState("");
  const [fact3, setFact3] = useState("");
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
        const newScale = Math.min(parentWidth / 1080, 1);
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
      const options = { width: 1080, height: 1080, pixelRatio: 1, canvasWidth: 1080, canvasHeight: 1080, skipFonts: true };
      await toPng(previewRef.current, options);
      await new Promise((resolve) => setTimeout(resolve, 150));
      const dataUrl = await toPng(previewRef.current, options);

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile && navigator.share) {
        try {
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const file = new File([blob], `Meet_The_Care_Team_${Date.now()}.png`, { type: "image/png" });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: "Meet the Care Team" });
            return;
          }
        } catch {}
      }

      const link = document.createElement("a");
      link.download = "Meet_The_Care_Team.png";
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to generate image", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const facts = [fact1, fact2, fact3];
  const displayTeamName = teamName || "TEAM NAME HERE";

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
            <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#f86464", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em" }}>
              Meet the Care Team
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
              <HelpCircle className="w-4 h-4" style={{ color: "#f86464" }} />
              How to Get Your Graphic
            </button>

            {/* Step 01 – Photo */}
            <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4" style={{ border: "1px solid #E3E8EE" }}>
              <div>
                <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, color: "#0067B1", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 2 }}>Step 01</p>
                <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#06263F", fontSize: 15, textTransform: "uppercase" }}>Upload Team Photo</h2>
                <p style={{ fontFamily: "Montserrat, sans-serif", color: "#5B6B7A", fontSize: 12, marginTop: 3 }}>Photo appears in the rounded panel on the right of the graphic.</p>
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

            {/* Step 02 – Team Name */}
            <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4" style={{ border: "1px solid #E3E8EE" }}>
              <div>
                <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, color: "#0067B1", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 2 }}>Step 02</p>
                <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#06263F", fontSize: 15, textTransform: "uppercase" }}>Team Name</h2>
                <p style={{ fontFamily: "Montserrat, sans-serif", color: "#5B6B7A", fontSize: 12, marginTop: 3 }}>Appears in the amber bar at the bottom of the graphic.</p>
              </div>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. 3rd Floor Care Team"
                maxLength={50}
                style={{ width: "100%", fontFamily: "Montserrat, sans-serif", fontSize: 14, color: "#17202A", background: "#F5F7FA", border: "1px solid #E3E8EE", borderRadius: 12, padding: "12px 16px", outline: "none" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#0067B1"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,103,177,0.12)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#E3E8EE"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>

            {/* Step 03 – Facts */}
            <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4" style={{ border: "1px solid #E3E8EE" }}>
              <div>
                <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, color: "#0067B1", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 2 }}>Step 03</p>
                <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#06263F", fontSize: 15, textTransform: "uppercase" }}>Enter 3 Facts</h2>
                <p style={{ fontFamily: "Montserrat, sans-serif", color: "#5B6B7A", fontSize: 12, marginTop: 3 }}>Highlights about the care team — specialties, awards, years of service, etc.</p>
              </div>
              <div className="space-y-3">
                {[
                  { val: fact1, set: setFact1, label: "Fact 1" },
                  { val: fact2, set: setFact2, label: "Fact 2" },
                  { val: fact3, set: setFact3, label: "Fact 3" },
                ].map(({ val, set, label }) => (
                  <div key={label} className="flex items-start gap-3">
                    <span className="mt-3 flex-shrink-0">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="7" r="7" fill="#f86464" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      value={val}
                      onChange={(e) => set(e.target.value)}
                      placeholder={`Enter ${label.toLowerCase()}…`}
                      maxLength={60}
                      className="flex-1 rounded-xl border border-[#E3E8EE] bg-[#F5F7FA] px-4 py-3 text-sm text-[#17202A] font-['Montserrat'] placeholder:text-[#9AA7B4] focus:outline-none transition"
                      style={{ fontSize: 14 }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "#0067B1"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,103,177,0.12)"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "#E3E8EE"; e.currentTarget.style.boxShadow = "none"; }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Step 04 – Facility */}
            <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4" style={{ border: "1px solid #E3E8EE" }}>
              <div>
                <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, color: "#0067B1", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 2 }}>Step 04</p>
                <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#06263F", fontSize: 15, textTransform: "uppercase" }}>Select Facility</h2>
                <p style={{ fontFamily: "Montserrat, sans-serif", color: "#5B6B7A", fontSize: 12, marginTop: 3 }}>Choose the facility this graphic is being made for.</p>
              </div>
              <FacilitySelector value={facility} onChange={setFacility} />
            </div>

            {/* Step 05 – Download */}
            <div className="bg-white rounded-2xl p-6 shadow-sm space-y-3" style={{ border: "1px solid #E3E8EE" }}>
              <div>
                <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, color: "#0067B1", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 2 }}>Step 05</p>
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
                  <Sparkles className="w-3 h-3" style={{ color: "#f86464" }} />
                  <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.18em", color: "#5B6B7A" }}>Live Preview</span>
                </div>
              </div>

              {/* Canvas wrapper */}
              <div
                ref={containerRef}
                className="w-full aspect-square rounded-2xl overflow-hidden relative"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", border: "4px solid white", boxShadow: "inset 0 2px 8px rgba(0,0,0,0.2)" }}
              >
                <div
                  style={{
                    width: 1080,
                    height: 1080,
                    transform: `scale(${scale})`,
                    transformOrigin: "center center",
                    position: "absolute",
                  }}
                >
                  <div
                    ref={previewRef}
                    style={{ width: 1080, height: 1080, position: "relative", overflow: "hidden", background: "linear-gradient(to bottom, #003b71, #0d5a96)" }}
                  >
                    {/* Facility logo area – top left */}
                    <div
                      style={{
                        position: "absolute",
                        left: 655,
                        top: 100,
                        width: 360,
                        height: 100,
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
                        <img
                          src={facilityLogoDataUrl}
                          alt={facility}
                          style={{ width: "100%", height: "100%", objectFit: "contain" }}
                        />
                      ) : (
                        <>
                          <svg width="18" height="18" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
                            <circle cx="6.5" cy="6.5" r="6.5" fill="#F86464" />
                          </svg>
                          <span
                            style={{
                              fontFamily: "Montserrat, sans-serif",
                              fontWeight: 600,
                              fontSize: 18,
                              color: facilityLogoLoading ? "rgba(255,255,255,0.5)" : "white",
                              letterSpacing: "1.82px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {facilityLogoLoading ? "LOADING…" : facility ? "NO LOGO" : "WHITE LOGO HERE"}
                          </span>
                        </>
                      )}
                    </div>

                    {/* "Meet the" cursive */}
                    <p
                      style={{
                        position: "absolute",
                        left: 65,
                        top: 164,
                        width: 600,
                        fontFamily: "'Dancing Script', cursive",
                        fontWeight: 700,
                        fontSize: 100,
                        color: "#f86464",
                        lineHeight: 1,
                      }}
                    >
                      Meet the
                    </p>

                    {/* "CARE TEAM" */}
                    <p
                      style={{
                        position: "absolute",
                        left: 53,
                        top: 268,
                        width: 950,
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 800,
                        fontSize: 150,
                        color: "white",
                        letterSpacing: "-1.5px",
                        lineHeight: 1,
                        textTransform: "uppercase",
                      }}
                    >
                      CARE TEAM
                    </p>

                    {/* Facts */}
                    {facts.map((val, i) => {
                      const text = val || `INSERT FACT #${i + 1}`;
                      const fs = factFontSize(text);
                      const hasVal = Boolean(val);
                      return (
                        <div
                          key={i}
                          style={{
                            position: "absolute",
                            left: 65,
                            top: FACT_TOPS[i],
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 19,
                            width: 340,
                          }}
                        >
                          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                            <circle cx="14" cy="14" r="14" fill="#F86464" />
                          </svg>
                          <p
                            style={{
                              fontFamily: "Montserrat, sans-serif",
                              fontWeight: 600,
                              fontSize: fs,
                              color: hasVal ? "#eaf2f9" : "rgba(234,242,249,0.35)",
                              lineHeight: 1.35,
                              wordBreak: "break-word",
                            }}
                          >
                            {text}
                          </p>
                        </div>
                      );
                    })}

                    {/* Photo panel */}
                    <div
                      style={{
                        position: "absolute",
                        left: 425,
                        top: 425,
                        width: 655,
                        height: 467,
                        borderRadius: "65px 0 0 65px",
                        overflow: "hidden",
                        background: "#cfe0ee",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {image ? (
                        <img src={image} alt="Team" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <span
                          style={{
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 600,
                            fontSize: 24,
                            color: "#0d5a96",
                            letterSpacing: "2.88px",
                            textAlign: "center",
                            textTransform: "uppercase",
                          }}
                        >
                          ADD PHOTO
                        </span>
                      )}
                    </div>

                    {/* Amber bottom bar */}
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 949,
                        width: 1080,
                        height: 131,
                        background: "#f1b367",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <p
                        style={{
                          fontFamily: "Montserrat, sans-serif",
                          fontWeight: 800,
                          fontSize: teamNameFontSize(displayTeamName),
                          color: "#003b71",
                          textAlign: "center",
                          textTransform: "uppercase",
                          width: "100%",
                          padding: "0 40px",
                        }}
                      >
                        {displayTeamName}
                      </p>
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
          style={{ background: "rgba(0,59,113,0.75)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowInstructions(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-t-3xl px-7 py-5 flex items-center justify-between" style={{ background: "#003b71" }}>
              <div>
                <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, color: "#cfe0ee", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 4 }}>Signature HealthCARE</p>
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
                { num: "01", title: "Upload Team Photo", body: "Upload a team photo or group headshot. It will appear in the rounded panel on the right side of the graphic." },
                { num: "02", title: "Enter Team Name", body: "Type your care team's name as it should appear in the amber banner at the bottom — e.g. '3rd Floor Care Team'." },
                { num: "03", title: "Enter 3 Facts", body: "Highlight three things about your team — specialties, years of combined experience, awards, or anything that shows what makes them great." },
                { num: "04", title: "Select Facility", body: "Choose your facility to place the correct logo in the top-left corner of the graphic." },
                { num: "05", title: "Download & Share", body: "Click Download to save the 1080×1080 graphic. Post it to Facebook, LinkedIn, or any social platform." },
              ].map(({ num, title, body }) => (
                <div key={num} className="flex gap-4">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "#003b71" }}>
                    <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "white", fontSize: 11, letterSpacing: "0.04em" }}>{num}</span>
                  </div>
                  <div>
                    <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#06263F", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.02em" }}>{title}</h3>
                    <p style={{ fontFamily: "Montserrat, sans-serif", color: "#5B6B7A", fontSize: 13, lineHeight: 1.55, marginTop: 4 }}>{body}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-7 pb-6">
              <button
                onClick={() => setShowInstructions(false)}
                className="w-full text-white font-['Montserrat'] font-bold uppercase text-xs tracking-[0.18em] py-4 rounded-xl transition-all"
                style={{ background: "#003b71" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#0d5a96")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "#003b71")}
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
          const subject = encodeURIComponent("Meet the Care Team — Signature HealthCARE");
          const body = encodeURIComponent(
            `Hi,\n\nAttached is a Meet the Care Team graphic from Signature HealthCARE — celebrating an outstanding care team.\n\nShare it on Facebook or LinkedIn and tag us at @SignatureHealthCARE!\n\n(Note: the graphic has been saved to your downloads — please attach it before sending.)`
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
