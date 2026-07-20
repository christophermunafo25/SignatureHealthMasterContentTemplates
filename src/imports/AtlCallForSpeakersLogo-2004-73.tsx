function Group() {
  return (
    <div className="absolute contents left-[101px] top-[1005px]">
      <div className="absolute h-[127px] left-[101px] rounded-[12.171px] top-[1005px] w-[997px]" style={{ backgroundImage: "linear-gradient(86.3592deg, rgb(0, 132, 255) 31.503%, rgb(0, 255, 217) 100%)" }} />
      <p className="-translate-x-1/2 absolute font-['Poppins:Bold',sans-serif] leading-[1.2] left-[599.5px] not-italic text-[#001324] text-[45px] text-center top-[1031px] tracking-[-0.45px] uppercase w-[997px] whitespace-pre-wrap">Join Me at #AtlantaAIWeek</p>
    </div>
  );
}

function Group1() {
  return (
    <div className="-translate-x-1/2 absolute contents left-[calc(50%-0.5px)] top-[1005px]">
      <Group />
      <p className="-translate-x-1/2 absolute font-['Poppins:SemiBold',sans-serif] leading-[1.2] left-[calc(50%+0.06px)] not-italic text-[#001324] text-[30.143px] text-center top-[1085px] tracking-[4.5214px] uppercase w-[713.595px] whitespace-pre-wrap">www.atlantaAiWeek.com</p>
    </div>
  );
}

export default function AtlCallForSpeakersLogo() {
  return (
    <div className="relative size-full" data-name="ATL_Call for Speakers_Logo" style={{ backgroundImage: "url(\'data:image/svg+xml;utf8,<svg viewBox=\\'0 0 1200 1200\\' xmlns=\\'http://www.w3.org/2000/svg\\' preserveAspectRatio=\\'none\\'><rect x=\\'0\\' y=\\'0\\' height=\\'100%\\' width=\\'100%\\' fill=\\'url(%23grad)\\' opacity=\\'1\\'/><defs><radialGradient id=\\'grad\\' gradientUnits=\\'userSpaceOnUse\\' cx=\\'0\\' cy=\\'0\\' r=\\'10\\' gradientTransform=\\'matrix(0.0000021475 -96.05 88.79 0.0000019852 600 1200)\\'><stop stop-color=\\'rgba(0,50,153,1)\\' offset=\\'0\\'/><stop stop-color=\\'rgba(0,34,94,1)\\' offset=\\'0.5\\'/><stop stop-color=\\'rgba(0,26,65,1)\\' offset=\\'0.75\\'/><stop stop-color=\\'rgba(0,19,36,1)\\' offset=\\'1\\'/></radialGradient></defs></svg>\')" }}>
      <p className="-translate-x-1/2 absolute font-['Poppins:Black',sans-serif] leading-[1.2] left-[calc(50%-0.5px)] not-italic text-[123.28px] text-center text-white top-[215px] tracking-[-1.2328px] uppercase">I’m Attending!</p>
      <p className="-translate-x-1/2 absolute font-['Poppins:Medium',sans-serif] leading-[1.2] left-[calc(50%-1px)] not-italic opacity-75 text-[27px] text-center text-white top-[363px] tracking-[8.1px] uppercase w-[982px] whitespace-pre-wrap">April 20-22 • Atlanta Tech Village</p>
      <Group1 />
    </div>
  );
}