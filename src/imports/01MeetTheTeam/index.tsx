function Group1() {
  return (
    <div className="absolute contents left-[65px] top-[513px]">
      <div className="absolute left-[65px] size-[28px] top-[515px]" data-name="Ellipse">
        <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 28 28">
          <circle cx="14" cy="14" fill="var(--fill-0, #F86464)" id="Ellipse" r="14" />
        </svg>
      </div>
      <p className="[word-break:break-word] absolute font-['Montserrat:SemiBold',sans-serif] font-semibold leading-[normal] left-[112px] text-[#eaf2f9] text-[25px] top-[513px] whitespace-nowrap">INSERT FACT #1</p>
    </div>
  );
}

function Group() {
  return (
    <div className="absolute contents left-[65px] top-[643px]">
      <div className="absolute left-[65px] size-[28px] top-[645px]" data-name="Ellipse">
        <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 28 28">
          <circle cx="14" cy="14" fill="var(--fill-0, #F86464)" id="Ellipse" r="14" />
        </svg>
      </div>
      <p className="[word-break:break-word] absolute font-['Montserrat:SemiBold',sans-serif] font-semibold leading-[normal] left-[112px] text-[#eaf2f9] text-[25px] top-[643px] whitespace-nowrap">INSERT FACT #2</p>
    </div>
  );
}

function Group2() {
  return (
    <div className="absolute contents left-[65px] top-[773px]">
      <div className="absolute left-[65px] size-[28px] top-[775px]" data-name="Ellipse">
        <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 28 28">
          <circle cx="14" cy="14" fill="var(--fill-0, #F86464)" id="Ellipse" r="14" />
        </svg>
      </div>
      <p className="[word-break:break-word] absolute font-['Montserrat:SemiBold',sans-serif] font-semibold leading-[normal] left-[112px] text-[#eaf2f9] text-[25px] top-[773px] whitespace-nowrap">INSERT FACT #3</p>
    </div>
  );
}

export default function Component01MeetTheTeam() {
  return (
    <div className="bg-gradient-to-b from-[#003b71] relative size-full to-[#0d5a96]" data-name="01 — Meet the Team">
      <div className="absolute border-2 border-[rgba(255,255,255,0.75)] border-dashed h-[40px] left-[65px] rounded-[16px] top-[64px] w-[214px]" data-name="Rectangle" />
      <div className="absolute left-[82px] size-[13px] top-[77px]" data-name="Ellipse">
        <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 13 13">
          <circle cx="6.5" cy="6.5" fill="var(--fill-0, #F86464)" id="Ellipse" r="6.5" />
        </svg>
      </div>
      <p className="[word-break:break-word] absolute font-['Montserrat:SemiBold',sans-serif] font-semibold leading-[normal] left-[103px] text-[13px] text-white top-[76px] tracking-[1.82px] whitespace-nowrap">WHITE LOGO HERE</p>
      <p className="[text-box-edge:cap_alphabetic] [text-box-trim:trim-both] [word-break:break-word] absolute font-['Andresta_Montera:Regular',sans-serif] h-[90px] leading-[normal] left-[65px] not-italic text-[#f86464] text-[100px] top-[164px] w-[600px]">Meet the</p>
      <p className="[text-box-edge:cap_alphabetic] [text-box-trim:trim-both] [word-break:break-word] absolute font-['Montserrat:ExtraBold',sans-serif] font-extrabold h-[157px] leading-[normal] left-[calc(50%-487px)] text-[150px] text-white top-[268px] tracking-[-1.5px] w-[950px]">CARE TEAM</p>
      <Group1 />
      <Group />
      <Group2 />
      <div className="absolute bg-[#f1b367] h-[131px] left-0 top-[949px] w-[1080px]" data-name="Rectangle" />
      <p className="-translate-x-1/2 [word-break:break-word] absolute font-['Montserrat:ExtraBold',sans-serif] font-extrabold h-[45px] leading-[normal] left-[540px] text-[#003b71] text-[37px] text-center top-[992px] w-[1080px]">TEAM NAME HERE</p>
      <div className="absolute flex h-[467px] items-center justify-center left-[425px] top-[425px] w-[655px]">
        <div className="-scale-y-100 flex-none rotate-180">
          <div className="bg-[#cfe0ee] h-[467px] relative rounded-br-[65px] rounded-tr-[65px] w-[655px]" data-name="Rectangle" />
        </div>
      </div>
      <p className="-translate-x-1/2 [word-break:break-word] absolute font-['Montserrat:SemiBold',sans-serif] font-semibold leading-[normal] left-[782.5px] text-[#0d5a96] text-[24px] text-center top-[636px] tracking-[2.88px] whitespace-nowrap">ADD PHOTO</p>
    </div>
  );
}