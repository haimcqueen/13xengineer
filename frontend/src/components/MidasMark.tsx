type Props = {
  size?: number;
  className?: string;
  withWordmark?: boolean;
};

export default function MidasMark({
  size = 40,
  className,
  withWordmark = false,
}: Props) {
  return (
    <span className={`inline-flex items-center gap-3 ${className ?? ""}`}>
      <img
        src="/midas_logo.jpeg"
        alt="MIDAS"
        decoding="async"
        draggable={false}
        className="block select-none"
        style={{ height: size, width: "auto", borderRadius: size * 0.18 }}
      />
      {withWordmark && (
        <span
          className="font-display text-rose"
          style={{
            fontSize: size * 0.42,
            lineHeight: 1,
            fontStyle: "italic",
            fontWeight: 300,
            letterSpacing: "-0.025em",
            fontVariationSettings: '"opsz" 144, "SOFT" 100, "WONK" 1',
          }}
        >
          MIDAS
        </span>
      )}
    </span>
  );
}
