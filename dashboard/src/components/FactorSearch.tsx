import { useState, useRef, useEffect } from "react";

interface Props {
  factors: string[];
  selected: string[];
  onToggle: (factor: string) => void;
  maxSelect?: number;
  placeholder?: string;
}

export default function FactorSearch({
  factors,
  selected,
  onToggle,
  maxSelect = 10,
  placeholder = "Search factors...",
}: Props) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = factors.filter((f) =>
    f.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div ref={ref} className="relative">
      {/* Selected tags */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {selected.map((f) => (
          <button
            key={f}
            onClick={() => onToggle(f)}
            className="px-2 py-0.5 bg-[#3b82f6]/20 text-[#3b82f6] text-xs rounded-md hover:bg-[#3b82f6]/30 transition-colors"
          >
            {f} &times;
          </button>
        ))}
      </div>

      {/* Search input */}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-[#1e293b] border border-[#334155] rounded-md text-sm text-[#f1f5f9] placeholder-[#64748b] focus:outline-none focus:border-[#3b82f6]"
      />

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-[#1e293b] border border-[#334155] rounded-md shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-[#64748b]">No factors found</div>
          ) : (
            filtered.map((f) => {
              const isSelected = selected.includes(f);
              const disabled = !isSelected && selected.length >= maxSelect;
              return (
                <button
                  key={f}
                  onClick={() => {
                    if (!disabled) onToggle(f);
                  }}
                  disabled={disabled}
                  className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                    isSelected
                      ? "bg-[#3b82f6]/20 text-[#3b82f6]"
                      : disabled
                      ? "text-[#475569] cursor-not-allowed"
                      : "text-[#cbd5e1] hover:bg-[#334155]"
                  }`}
                >
                  {f}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
