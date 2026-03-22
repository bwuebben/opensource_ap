import { useFactorContext } from "./FactorContext";

interface Props {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function FactorName({ name, className, style }: Props) {
  const { openFactor } = useFactorContext();

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        openFactor(name);
      }}
      className={`cursor-pointer hover:underline decoration-dotted underline-offset-2 ${className || "font-mono text-[#3b82f6]"}`}
      style={style}
      title={`Click for details on ${name}`}
    >
      {name}
    </button>
  );
}
