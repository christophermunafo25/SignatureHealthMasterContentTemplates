function Group() {
  return (
    <div className="absolute contents left-[122px] top-[954px]">
      <div className="absolute border-2 border-[rgba(255,255,255,0.75)] border-dashed h-[92px] left-[122px] rounded-[16px] top-[954px] w-[301px]" data-name="Rectangle" />
      <div className="absolute left-[186px] size-[13px] top-[991px]" data-name="Ellipse">
        <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 13 13">
          <circle cx="6.5" cy="6.5" fill="var(--fill-0, #F86464)" id="Ellipse" r="6.5" />
        </svg>
      </div>
      <p className="[word-break:break-word] absolute font-['Montserrat:SemiBold',sans-serif] font-semibold leading-[normal] left-[207px] text-[13px] text-white top-[990px] tracking-[1.56px] whitespace-nowrap">WHITE LOGO HERE</p>
    </div>
  );
}

export default function Component05WorkAnniversary() {
  return (
    <div className="bg-[#f1b367] relative size-full" data-name="05 — Work Anniversary">
      <div className="absolute h-[36.5px] left-[51px] top-[162px] w-[495.5px]" data-name="image 1" />
      <div className="-translate-x-1/2 -translate-y-1/2 [word-break:break-word] absolute flex flex-col font-['Montserrat:ExtraBold',sans-serif] font-extrabold h-[285px] justify-center leading-[0] left-[277.5px] text-[400px] text-center text-white top-[360.5px] tracking-[-12px] w-[471px]">
        <p className="leading-[normal]">#</p>
      </div>
      <div className="-translate-x-1/2 -translate-y-1/2 [word-break:break-word] absolute flex flex-col font-['Dancing_Script:Regular',sans-serif] font-normal justify-center leading-[0] left-[273px] text-[#003b71] text-[175px] text-center top-[515px] w-[352px]">
        <p className="leading-[normal]">years</p>
      </div>
      <p className="-translate-x-1/2 [word-break:break-word] absolute font-['Montserrat:ExtraBold',sans-serif] font-extrabold h-[57px] leading-[normal] left-[277.5px] text-[47px] text-center text-white top-[744px] w-[471px]">NAME HERE</p>
      <div className="absolute bg-[#003b71] h-[160px] left-0 top-[920px] w-[1080px]" data-name="Rectangle" />
      <Group />
      <div className="absolute flex h-[1080px] items-center justify-center left-[547px] top-0 w-[533px]">
        <div className="-scale-y-100 flex-none rotate-180">
          <div className="bg-[#cfe0ee] h-[1080px] relative rounded-br-[65px] rounded-tr-[65px] shadow-[-10px_5px_30px_0px_rgba(0,0,0,0.1)] w-[533px]" data-name="Rectangle" />
        </div>
      </div>
      <div className="-translate-x-1/2 -translate-y-1/2 [word-break:break-word] absolute flex flex-col font-['Montserrat:SemiBold',sans-serif] font-semibold h-[49px] justify-center leading-[0] left-[813.5px] text-[#0d5a96] text-[24px] text-center top-[547.5px] tracking-[2.88px] w-[533px]">
        <p className="leading-[normal]">ADD PHOTO</p>
      </div>
      <p className="-translate-x-1/2 [word-break:break-word] absolute font-['Montserrat:SemiBold',sans-serif] font-semibold leading-[normal] left-[278px] text-[#003b71] text-[40px] text-center top-[151px] tracking-[6px] uppercase w-[386px]">Celebrating</p>
      <p className="-translate-x-1/2 [word-break:break-word] absolute font-['Montserrat:SemiBold',sans-serif] font-semibold leading-[normal] left-[calc(50%-262.5px)] text-[23px] text-[rgba(255,255,255,0.75)] text-center top-[801px] tracking-[2.76px] w-[471px]">JOB TITLE</p>
    </div>
  );
}