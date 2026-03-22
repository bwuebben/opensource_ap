import { useRef, useEffect, useCallback } from "react";
// @ts-expect-error - no types for dist-min
import Plotly from "plotly.js-dist-min";

interface PlotProps {
  data: Plotly.Data[];
  layout?: Partial<Plotly.Layout>;
  config?: Partial<Plotly.Config>;
  style?: React.CSSProperties;
  onRelayout?: (event: Record<string, unknown>) => void;
}

export default function Plot({ data, layout = {}, config = {}, style, onRelayout }: PlotProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onRelayoutRef = useRef(onRelayout);
  onRelayoutRef.current = onRelayout;

  const draw = useCallback(() => {
    if (!ref.current) return;
    Plotly.react(ref.current, data, layout, config);
  }, [data, layout, config]);

  useEffect(() => {
    draw();
    const el = ref.current;
    if (el && onRelayoutRef.current) {
      el.on("plotly_relayout", (e: Record<string, unknown>) => {
        onRelayoutRef.current?.(e);
      });
    }
    return () => {
      if (el) Plotly.purge(el);
    };
  }, [draw]);

  // Resize on container changes
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => Plotly.Plots.resize(el));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} style={style} />;
}
