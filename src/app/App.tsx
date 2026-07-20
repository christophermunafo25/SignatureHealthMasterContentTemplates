import React, { useState } from "react";
import { LandingPage } from "@/app/components/LandingPage";
import { Generator } from "@/app/components/Generator";
import { SpotlightGenerator } from "@/app/components/SpotlightGenerator";
import { MeetTheTeamGenerator } from "@/app/components/MeetTheTeamGenerator";
import { NewHireWelcomeGenerator } from "@/app/components/NewHireWelcomeGenerator";
import { WorkAnniversaryGenerator } from "@/app/components/WorkAnniversaryGenerator";
import "@/styles/fonts.css";

type View = "landing" | "sos" | "spotlight" | "meettheteam" | "newhirewelcome" | "workanniversary";

export default function App() {
  const [view, setView] = useState<View>("landing");

  return (
    <div className="min-h-screen bg-background">
      {view === "landing" && (
        <LandingPage onSelect={(id) => setView(id as View)} />
      )}
      {view === "sos" && (
        <Generator onBack={() => setView("landing")} />
      )}
      {view === "spotlight" && (
        <SpotlightGenerator onBack={() => setView("landing")} />
      )}
      {view === "meettheteam" && (
        <MeetTheTeamGenerator onBack={() => setView("landing")} />
      )}
      {view === "newhirewelcome" && (
        <NewHireWelcomeGenerator onBack={() => setView("landing")} />
      )}
      {view === "workanniversary" && (
        <WorkAnniversaryGenerator onBack={() => setView("landing")} />
      )}
    </div>
  );
}
