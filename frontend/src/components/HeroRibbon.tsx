export function HeroRibbon() {
  const lines = Array.from({ length: 14 }, (_, i) => i);
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute -top-10 right-[-20%] hidden h-[620px] w-[1100px] text-ribbon opacity-[0.18] md:block lg:right-[-10%]"
      viewBox="0 0 1100 620"
      fill="none"
    >
      {lines.map((i) => (
        <path
          key={i}
          d={`M0 ${420 - i * 6} C 260 ${180 + i * 9}, 520 ${620 - i * 12}, 780 ${300 - i * 4} S 1100 ${120 + i * 10}, 1100 ${120 + i * 10}`}
          stroke="currentColor"
          strokeWidth="1"
        />
      ))}
    </svg>
  );
}
