import svgPaths from "./svg-q5akg9b99k";

function Star() {
  return (
    <div className="absolute flex items-center justify-center left-[1300px] size-[72.284px] top-[271.09px]">
      <div className="-rotate-8 flex-none">
        <div className="relative size-[64px]" data-name="star">
          <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 64 64">
            <g id="star" opacity="0.15">
              <path d={svgPaths.p27d88ac0} id="Vector" stroke="var(--stroke-0, #FF9E19)" strokeLinecap="round" strokeWidth="2" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}

function Camera() {
  return (
    <div className="relative shrink-0 size-[64px]" data-name="camera">
      <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 64 64">
        <g id="camera" opacity="0.2">
          <path d={svgPaths.p3f4f1d00} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
}

function PhotoPlaceholder() {
  return (
    <div className="absolute bg-[#1a1a1a] content-stretch flex flex-col h-[720px] items-center justify-center left-[24px] right-[24px] rounded-[6px] top-[24px]" data-name="Photo Placeholder">
      <Camera />
      <p className="[word-break:break-word] font-['Archivo:SemiBold',sans-serif] font-semibold leading-[normal] opacity-30 relative shrink-0 text-[32px] text-white tracking-[0.64px] uppercase whitespace-nowrap" style={{ fontVariationSettings: '"wdth" 100' }}>
        Headshot Here
      </p>
    </div>
  );
}

function NameStripBackground() {
  return (
    <div className="absolute bg-[#f6ab60] content-stretch flex flex-col items-center justify-center left-[24px] p-[16px] right-[24px] rounded-[6px] top-[768px]" data-name="Name Strip Background">
      <p className="[word-break:break-word] font-['Archivo:ExtraBold',sans-serif] font-extrabold leading-[normal] relative shrink-0 text-[#121212] text-[36px] text-center tracking-[0.36px] uppercase whitespace-nowrap" style={{ fontVariationSettings: '"wdth" 100' }}>
        NAME ENTERED HERE
      </p>
    </div>
  );
}

function PolaroidContainerFrame() {
  return (
    <div className="absolute flex h-[917.318px] items-center justify-center left-[727px] top-[431px] w-[639.903px]">
      <div className="-rotate-4 flex-none">
        <div className="bg-white drop-shadow-[8px_12px_12px_rgba(0,0,0,0.25)] h-[879px] relative rounded-[12px] w-[580px]" data-name="Polaroid Container Frame">
          <PhotoPlaceholder />
          <NameStripBackground />
        </div>
      </div>
    </div>
  );
}

function Star1() {
  return (
    <div className="absolute flex items-center justify-center left-[980px] size-[37.071px] top-[174.44px]">
      <div className="-rotate-10 flex-none">
        <div className="relative size-[32px]" data-name="star">
          <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 32">
            <g id="star" opacity="0.12">
              <path d={svgPaths.p3ba93c14} fill="var(--fill-0, #FF9E19)" id="Vector" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}

function Star2() {
  return (
    <div className="absolute flex items-center justify-center left-[209.36px] size-[53.338px] top-[1180px]">
      <div className="flex-none rotate-14">
        <div className="relative size-[44px]" data-name="star">
          <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 44 44">
            <g id="star" opacity="0.1">
              <path d={svgPaths.p2c1b4780} fill="var(--fill-0, #FF9E19)" id="Vector" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}

function Star3() {
  return (
    <div className="absolute flex items-center justify-center left-[1320px] size-[30.773px] top-[1117.07px]">
      <div className="-rotate-6 flex-none">
        <div className="relative size-[28px]" data-name="star">
          <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 28 28">
            <g id="star" opacity="0.08">
              <path d={svgPaths.p9af7500} fill="var(--fill-0, #FF9E19)" id="Vector" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}

function Star4() {
  return (
    <div className="absolute flex items-center justify-center left-[90px] size-[45.363px] top-[408.88px]">
      <div className="-rotate-18 flex-none">
        <div className="relative size-[36px]" data-name="star">
          <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 36 36">
            <g id="star" opacity="0.09">
              <path d={svgPaths.pc4dd900} fill="var(--fill-0, #FF9E19)" id="Vector" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}

function Star5() {
  return (
    <div className="absolute flex items-center justify-center left-[1374.43px] size-[45.178px] top-[160px]">
      <div className="flex-none rotate-8">
        <div className="relative size-[40px]" data-name="star">
          <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 40 40">
            <g id="star" opacity="0.11">
              <path d={svgPaths.p3dd14f80} fill="var(--fill-0, #FF9E19)" id="Vector" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}

export default function EmployeeSpotlights() {
  return (
    <div className="relative size-full" style={{ backgroundImage: "linear-gradient(131.459deg, rgb(0, 103, 177) 46.497%, rgb(220, 235, 247) 100%)" }} data-name="employee-spotlights">
      <div className="absolute bg-[#ff9e19] h-[518px] left-[80px] rounded-[45px] top-[592px] w-[781px]" />
      <Star />
      <div className="absolute h-[71px] left-[103px] top-[129px] w-[629px]" data-name="Employee Overline">
        <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 629 71">
          <g id="Employee Overline">
            <path d={svgPaths.pc1c9cf0} fill="var(--fill-0, white)" />
            <path d={svgPaths.p48c5500} fill="var(--fill-0, white)" />
            <path d={svgPaths.p63f0400} fill="var(--fill-0, white)" />
            <path d={svgPaths.p261b6d00} fill="var(--fill-0, white)" />
            <path d={svgPaths.p1271b3c0} fill="var(--fill-0, white)" />
            <path d={svgPaths.p1908dc00} fill="var(--fill-0, white)" />
            <path d={svgPaths.p2d11fe00} fill="var(--fill-0, white)" />
            <path d={svgPaths.p74ee600} fill="var(--fill-0, white)" />
          </g>
        </svg>
      </div>
      <div className="absolute h-[264px] left-[80px] top-[213px] w-[923px]" data-name="Spotlights Cursive">
        <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 923 264">
          <g id="Spotlights Cursive">
            <path d={svgPaths.p2b238000} fill="var(--fill-0, #FF9E19)" />
            <path d={svgPaths.p27e2d980} fill="var(--fill-0, #FF9E19)" />
            <path d={svgPaths.p2c67c80} fill="var(--fill-0, #FF9E19)" />
            <path d={svgPaths.p3ed00480} fill="var(--fill-0, #FF9E19)" />
            <path d={svgPaths.p35089d00} fill="var(--fill-0, #FF9E19)" />
            <path d={svgPaths.p1d4ec680} fill="var(--fill-0, #FF9E19)" />
            <path d={svgPaths.p19996000} fill="var(--fill-0, #FF9E19)" />
            <path d={svgPaths.p6c47080} fill="var(--fill-0, #FF9E19)" />
            <path d={svgPaths.p1e770180} fill="var(--fill-0, #FF9E19)" />
            <path d={svgPaths.p39ef600} fill="var(--fill-0, #FF9E19)" />
          </g>
        </svg>
      </div>
      <PolaroidContainerFrame />
      <Star1 />
      <Star2 />
      <Star3 />
      <Star4 />
      <Star5 />
      <p className="[text-box-edge:cap_alphabetic] [text-box-trim:trim-both] [word-break:break-word] absolute font-['Archivo:Italic',sans-serif] font-normal italic leading-[1.2] left-[209px] text-[#06263f] text-[50px] top-[729px] tracking-[1px] uppercase w-[455px]" style={{ fontVariationSettings: '"wdth" 100' }}>
        Residents Love her. She truly makes a difference in their lives.
      </p>
      <div className="absolute h-[73px] left-[112px] top-[627px] w-[97px]" data-name="“">
        <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 97 73">
          <path d={svgPaths.p3a50b400} fill="var(--fill-0, #06263F)" id="â" />
        </svg>
      </div>
      <div className="absolute flex h-[73px] items-center justify-center left-[630px] top-[1003px] w-[97px]">
        <div className="flex-none rotate-180">
          <div className="h-[73px] relative w-[97px]" data-name="“">
            <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 97 73">
              <path d={svgPaths.p3a50b400} fill="var(--fill-0, #06263F)" id="â" />
            </svg>
          </div>
        </div>
      </div>
      <div className="absolute border border-solid border-white h-[134px] left-[90px] top-[1214px] w-[540px]" />
      <div className="-translate-x-1/2 -translate-y-1/2 [text-box-edge:cap_alphabetic] [text-box-trim:trim-both] [word-break:break-word] absolute flex flex-col font-['Archivo:Medium',sans-serif] font-medium justify-center leading-[0] left-[360px] text-[42.108px] text-center text-white top-[1286.5px] tracking-[0.8422px] uppercase whitespace-nowrap" style={{ fontVariationSettings: '"wdth" 100' }}>
        <p className="leading-[1.1]">Facility Logo Here</p>
      </div>
    </div>
  );
}